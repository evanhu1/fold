# Fold

Paste a URL or article text, get a hierarchical claim tree you can progressively expand: a single-sentence thesis at the top, one-sentence claims for each section underneath, a short summary behind each claim, and the original source paragraphs at the bottom.

Each fold is generated once, persisted in Postgres, and lives at a stable shareable URL.

## Stack

- Next.js 16 (App Router) + React 19
- Postgres via Neon (`@neondatabase/serverless`)
- Mozilla Readability + linkedom + Turndown for URL → markdown extraction
- Google Gemini via the Vercel AI SDK for tree generation (Zod-bound structured output)

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL and GEMINI_API_KEY
pnpm dev
```

Optionally override the model with `GEMINI_MODEL` (defaults to `gemini-3.1-flash-lite-preview`).

## How it works

- `POST /api/extract` pulls a URL, runs Readability, and returns the article as markdown.
- `POST /api/folds` accepts either a URL or pasted markdown. It chunks the source by headings (or by word count if there are no headings), asks Gemini for a `rootClaim` plus one `claim` + `summary` per section against a Zod schema, and stores the result. Cached folds are keyed by URL and `CACHE_VERSION` — bump the constant to invalidate.
- `/[id]` renders the tree. Clicking the root claim reveals section claims; clicking a claim reveals its summary; clicking a summary reveals the original source markdown for that section.
- Source articles are capped at 50,000 words.

## Layout

- `src/app` — routes (`/`, `/[id]`, `api/folds`, `api/extract`)
- `src/components/fold-viewer.tsx` — the expandable tree UI
- `src/lib/article.ts` — URL extraction
- `src/lib/article-tree.ts` — sectioning, LLM call, merge with source sections
- `src/lib/article-tree-schema.ts` — Zod schemas (LLM output + persisted form)
- `src/lib/db.ts` — Postgres persistence
- `src/lib/types.ts`, `src/lib/text.ts` — shared types and word utilities
