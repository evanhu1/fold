import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { CACHE_VERSION, coerceArticleTree } from "@/lib/article-tree";
import { ARTICLE_TREE_FORMAT } from "@/lib/article-tree-schema";
import { countWords } from "@/lib/text";
import type { ArticleTree, FoldRecord } from "@/lib/types";

type FoldRow = {
  id: string;
  article_url: string | null;
  article_title: string | null;
  original_text: string;
  fold_json: string;
  created_at: string;
};

type LegacyCompressionLevel = {
  label?: string;
  targetWords?: number | "full";
  text?: string;
};

type LegacyArticleMapSection = {
  title?: string;
  summary?: string;
  detailsMarkdown?: string;
};

declare global {
  var __foldDbReady__: Promise<void> | undefined;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

async function ensureSchema(): Promise<void> {
  if (global.__foldDbReady__) {
    return global.__foldDbReady__;
  }

  const sql = getSql();

  global.__foldDbReady__ = sql
    .query(`
      CREATE TABLE IF NOT EXISTS folds (
        id TEXT PRIMARY KEY,
        article_title TEXT,
        original_text TEXT NOT NULL,
        levels_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    .then(() =>
      sql.query(`
        ALTER TABLE folds
        ADD COLUMN IF NOT EXISTS article_title TEXT
      `),
    )
    .then(() =>
      sql.query(`
        ALTER TABLE folds
        ADD COLUMN IF NOT EXISTS article_url TEXT
      `),
    )
    .then(() =>
      sql.query(`
        ALTER TABLE folds
        DROP COLUMN IF EXISTS original_word_count
      `),
    )
    .then(() =>
      sql.query(`
        CREATE INDEX IF NOT EXISTS folds_article_url_created_at_idx
        ON folds (article_url, created_at DESC)
      `),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      global.__foldDbReady__ = undefined;
      throw error;
    });

  return global.__foldDbReady__;
}

function createFoldId(): string {
  return randomBytes(7).toString("base64url");
}

export async function saveFold(input: {
  articleUrl: string | null;
  articleTitle: string | null;
  originalText: string;
  articleTree: ArticleTree;
}): Promise<FoldRecord> {
  await ensureSchema();

  const sql = getSql();
  const id = createFoldId();
  const createdAt = new Date().toISOString();

  await sql.query(
    `INSERT INTO folds (id, article_url, article_title, original_text, levels_json, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)`,
    [
      id,
      input.articleUrl,
      input.articleTitle,
      input.originalText,
      JSON.stringify(input.articleTree),
      createdAt,
    ],
  );

  return {
    id,
    articleUrl: input.articleUrl,
    articleTitle: input.articleTitle,
    originalText: input.originalText,
    articleTree: input.articleTree,
    createdAt,
  };
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildLegacyArticleTreeFromLevels(
  value: unknown,
  originalText: string,
): ArticleTree | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const levels = value.filter(
    (item): item is LegacyCompressionLevel =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as LegacyCompressionLevel).text === "string",
  );

  if (levels.length === 0) {
    return null;
  }

  const compressedLevels = levels.filter((level) => level.targetWords !== "full");
  const longSummary = compressedLevels[0]?.text?.trim() || originalText;
  const rootClaim =
    splitIntoSentences(longSummary)[0] ||
    splitIntoSentences(originalText)[0] ||
    "This article develops a single main idea.";

  return {
    format: ARTICLE_TREE_FORMAT,
    cacheVersion: 0,
    rootClaim,
    sections: [
      {
        id: "section-1",
        claim:
          splitIntoSentences(longSummary)[0] ||
          "This fold was generated with the previous summary-based format.",
        summary: longSummary,
        sourceMarkdown: originalText,
        sourceWordCount: countWords(originalText),
      },
    ],
  };
}

function buildLegacyArticleTreeFromMap(value: unknown): ArticleTree | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    thesis?: unknown;
    overview?: unknown;
    sections?: unknown;
  };

  const rootClaim =
    normalizeLegacyString(record.thesis) ||
    splitIntoSentences(normalizeLegacyString(record.overview))[0] ||
    "";
  const rawSections = Array.isArray(record.sections) ? record.sections : [];

  const sections = rawSections
    .map((rawSection, index) => {
      if (!rawSection || typeof rawSection !== "object") {
        return null;
      }

      const section = rawSection as LegacyArticleMapSection;
      const sourceMarkdown = normalizeLegacyString(section.detailsMarkdown);
      const summary =
        normalizeLegacyString(section.summary) ||
        splitIntoSentences(sourceMarkdown).slice(0, 3).join(" ");
      const claim =
        splitIntoSentences(summary)[0] ||
        normalizeLegacyString(section.title) ||
        `Section ${index + 1}`;

      if (!summary || !sourceMarkdown) {
        return null;
      }

      return {
        id: `section-${index + 1}`,
        claim,
        summary,
        sourceMarkdown,
        sourceWordCount: countWords(sourceMarkdown),
      };
    })
    .filter((section): section is ArticleTree["sections"][number] => section !== null);

  if (!rootClaim || sections.length === 0) {
    return null;
  }

  return {
    format: ARTICLE_TREE_FORMAT,
    cacheVersion: 0,
    rootClaim,
    sections,
  };
}

function normalizeLegacyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseStoredArticleTree(
  rawJson: string,
  originalText: string,
  allowLegacyFallback: boolean,
): ArticleTree | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const articleTree = coerceArticleTree(parsed);
  if (articleTree) {
    return articleTree;
  }

  if (!allowLegacyFallback) {
    return null;
  }

  return (
    buildLegacyArticleTreeFromMap(parsed) ??
    buildLegacyArticleTreeFromLevels(parsed, originalText)
  );
}

export async function getFoldById(id: string): Promise<FoldRecord | null> {
  await ensureSchema();

  const sql = getSql();
  const result = (await sql.query(
    `SELECT id, article_url, article_title, original_text, levels_json::text AS fold_json, created_at
     FROM folds
     WHERE id = $1`,
    [id],
  )) as FoldRow[];

  const row = result[0];
  if (!row) {
    return null;
  }

  const articleTree = parseStoredArticleTree(row.fold_json, row.original_text, true);
  if (!articleTree) {
    return null;
  }

  return {
    id: row.id,
    articleUrl: row.article_url,
    articleTitle: row.article_title,
    originalText: row.original_text,
    articleTree,
    createdAt: row.created_at,
  };
}

export async function getLatestFoldByArticleUrl(
  articleUrl: string,
): Promise<FoldRecord | null> {
  await ensureSchema();

  const sql = getSql();
  const result = (await sql.query(
    `SELECT id, article_url, article_title, original_text, levels_json::text AS fold_json, created_at
     FROM folds
     WHERE article_url = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [articleUrl],
  )) as FoldRow[];

  const row = result[0];
  if (!row) {
    return null;
  }

  const articleTree = parseStoredArticleTree(row.fold_json, row.original_text, false);
  if (!articleTree || articleTree.cacheVersion !== CACHE_VERSION) {
    return null;
  }

  return {
    id: row.id,
    articleUrl: row.article_url,
    articleTitle: row.article_title,
    originalText: row.original_text,
    articleTree,
    createdAt: row.created_at,
  };
}
