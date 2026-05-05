# Fold

Paste a URL, get a slider that zooms an article from full text down to a single word.

Each zoom level is a separately generated summary, computed in parallel and cached in Postgres. Every fold has a stable shareable URL.

## Stack

- Next.js 16 (App Router) + React 19
- Postgres via Neon (`@neondatabase/serverless`)
- Mozilla Readability + linkedom for article extraction
- Anthropic / Gemini / OpenAI for summarization

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL and an LLM key
pnpm dev
```

Pick a provider with `LLM_PROVIDER` (`anthropic` | `gemini` | `openai`).

## How it works

- `POST /api/folds` extracts the article body, picks a set of summary levels strictly smaller than the source word count, generates them in parallel, and persists the result.
- `/[id]` renders a slider that interpolates between those levels, from full text to a one-word distillation.
- Source articles are capped at 4,000 extracted words.

## Layout

- `src/app` — routes (`/`, `/[id]`, `api/folds`, `api/extract`)
- `src/components/fold-viewer.tsx` — the slider UI
- `src/lib` — extraction, summarization, db, types
