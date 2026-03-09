import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { CompressionLevel, FoldRecord } from "@/lib/types";

type FoldRow = {
  id: string;
  article_title: string | null;
  original_text: string;
  original_word_count: number;
  levels_json: string;
  created_at: string;
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
        original_word_count INTEGER NOT NULL,
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
  articleTitle: string | null;
  originalText: string;
  originalWordCount: number;
  levels: CompressionLevel[];
}): Promise<FoldRecord> {
  await ensureSchema();

  const sql = getSql();
  const id = createFoldId();
  const createdAt = new Date().toISOString();

  await sql.query(
    `INSERT INTO folds (id, article_title, original_text, original_word_count, levels_json, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)`,
    [
      id,
      input.articleTitle,
      input.originalText,
      input.originalWordCount,
      JSON.stringify(input.levels),
      createdAt,
    ],
  );

  return {
    id,
    articleTitle: input.articleTitle,
    originalText: input.originalText,
    originalWordCount: input.originalWordCount,
    levels: input.levels,
    createdAt,
  };
}

export async function getFoldById(id: string): Promise<FoldRecord | null> {
  await ensureSchema();

  const sql = getSql();
  const result = (await sql.query(
    `SELECT id, article_title, original_text, original_word_count, levels_json::text, created_at
     FROM folds
     WHERE id = $1`,
    [id],
  )) as FoldRow[];

  const row = result[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    articleTitle: row.article_title,
    originalText: row.original_text,
    originalWordCount: row.original_word_count,
    levels: JSON.parse(row.levels_json) as CompressionLevel[],
    createdAt: row.created_at,
  };
}
