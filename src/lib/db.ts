import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import type { CompressionLevel, FoldRecord } from "@/lib/types";

type FoldRow = {
  id: string;
  original_text: string;
  original_word_count: number;
  levels_json: string;
  created_at: string;
};

declare global {
  var __foldDbPool__: Pool | undefined;
  var __foldDbReady__: Promise<void> | undefined;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

function getPool(): Pool {
  if (global.__foldDbPool__) {
    return global.__foldDbPool__;
  }

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
  });

  global.__foldDbPool__ = pool;
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (global.__foldDbReady__) {
    return global.__foldDbReady__;
  }

  const pool = getPool();

  global.__foldDbReady__ = pool
    .query(`
      CREATE TABLE IF NOT EXISTS folds (
        id TEXT PRIMARY KEY,
        original_text TEXT NOT NULL,
        original_word_count INTEGER NOT NULL,
        levels_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
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
  originalText: string;
  originalWordCount: number;
  levels: CompressionLevel[];
}): Promise<FoldRecord> {
  await ensureSchema();

  const pool = getPool();
  const id = createFoldId();
  const createdAt = new Date().toISOString();

  await pool.query(
    `INSERT INTO folds (id, original_text, original_word_count, levels_json, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
    [
      id,
      input.originalText,
      input.originalWordCount,
      JSON.stringify(input.levels),
      createdAt,
    ],
  );

  return {
    id,
    originalText: input.originalText,
    originalWordCount: input.originalWordCount,
    levels: input.levels,
    createdAt,
  };
}

export async function getFoldById(id: string): Promise<FoldRecord | null> {
  await ensureSchema();

  const pool = getPool();
  const result = await pool.query<FoldRow>(
    `SELECT id, original_text, original_word_count, levels_json::text, created_at
     FROM folds
     WHERE id = $1`,
    [id],
  );

  const row = result.rows[0];
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
