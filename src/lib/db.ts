import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { CompressionLevel, FoldRecord } from "@/lib/types";

type FoldRow = {
  id: string;
  original_text: string;
  original_word_count: number;
  levels_json: string;
  created_at: string;
};

declare global {
  var __foldDb__: Database.Database | undefined;
}

function getDb(): Database.Database {
  if (global.__foldDb__) {
    return global.__foldDb__;
  }

  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const dbPath = join(dataDir, "fold.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS folds (
      id TEXT PRIMARY KEY,
      original_text TEXT NOT NULL,
      original_word_count INTEGER NOT NULL,
      levels_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  global.__foldDb__ = db;
  return db;
}

function createFoldId(): string {
  return randomBytes(7).toString("base64url");
}

export function saveFold(input: {
  originalText: string;
  originalWordCount: number;
  levels: CompressionLevel[];
}): FoldRecord {
  const db = getDb();
  const id = createFoldId();
  const createdAt = new Date().toISOString();

  const insert = db.prepare(
    `INSERT INTO folds (id, original_text, original_word_count, levels_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  insert.run(
    id,
    input.originalText,
    input.originalWordCount,
    JSON.stringify(input.levels),
    createdAt,
  );

  return {
    id,
    originalText: input.originalText,
    originalWordCount: input.originalWordCount,
    levels: input.levels,
    createdAt,
  };
}

export function getFoldById(id: string): FoldRecord | null {
  const db = getDb();
  const select = db.prepare(
    `SELECT id, original_text, original_word_count, levels_json, created_at
     FROM folds
     WHERE id = ?`,
  );

  const row = select.get(id) as FoldRow | undefined;
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    originalText: row.original_text,
    originalWordCount: row.original_word_count,
    levels: JSON.parse(row.levels_json) as CompressionLevel[],
    createdAt: row.created_at,
  };
}
