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

Optionally override the model with `GEMINI_MODEL` (defaults to `gemini-3-flash-preview`).

## How it works

- `POST /api/extract` pulls a URL, runs Readability, and returns the article as markdown.
- `POST /api/folds` accepts either a URL or pasted markdown, runs the pipeline below, and stores the result. Cached folds are keyed by URL and `CACHE_VERSION` — bump the constant to invalidate.
- `/[id]` renders the tree. Clicking the root claim reveals section claims; clicking a claim reveals its summary; clicking a summary reveals the original source markdown for that section.
- Source articles are capped at 50,000 words.

## Pipeline: source → article tree

Each fold goes through a deterministic chunker, a single LLM call, and a re-merge step. The LLM never decides the section boundaries — it only writes the prose that hangs off them.

**1. URL → markdown.** If the request has a URL, `src/lib/article.ts` fetches the page with a desktop UA, runs Mozilla Readability, strips promotional/CTA interstitials (Substack-style "Subscribe" / "Open in app" boxes), and converts the surviving HTML to markdown via Turndown. Pasted markdown skips this step.

**2. Sectioning (no LLM).** `buildSourceSections` in `src/lib/article-tree.ts` splits the markdown into 1–6 ordered sections:

1. Block-split on blank lines. Each "block" is a paragraph, list, blockquote, code block, or heading line.
2. **Heading-led path (preferred):** if the article has between 2 and 8 ATX-heading-led groups (`#`, `##`, …), those groups become the sections directly — human-authored boundaries win.
3. **Word-balanced fallback:** otherwise, pick a target count from the word total (`<250→1`, `<500→2`, `<1000→3`, `<2000→4`, `<4000→5`, else `6`) and walk blocks left-to-right, closing a section once it hits roughly `totalWords / N` and there are still enough blocks left to fill the remaining sections. Blocks are never split mid-paragraph.
4. Each section gets a stable `id` (`section-1`, `section-2`, …) and is stamped with its `sourceMarkdown` and `sourceWordCount`.

**3. LLM call.** `generateArticleTreeFromLLM` builds a single prompt that contains:

- The system prompt (`SYSTEM_PROMPT`) instructing the model to build a claim tree using only source content, preserving caveats / numbers, with a quotable thesis sentence at the root.
- A user prompt listing the requirements (one quotable `rootClaim`, one section object per provided id in the same order, single-sentence `claim`, 2–4 sentence `summary`, no merging or invention).
- Every source section's full markdown, wrapped in `<section id="section-N">…</section>` inside `<source_sections>`.

The call goes through the Vercel AI SDK's `generateObject(...)` bound to `articleTreeLLMSchema` (`src/lib/article-tree-schema.ts`), which forces Gemini to emit valid JSON matching:

```ts
{ rootClaim: string; sections: { id: string; claim: string; summary: string }[] }
```

**4. Merge with source.** `mergeWithSourceSections` walks the deterministic source sections in order. For each one it looks up the matching LLM section by `id` (with a positional fallback if the model renamed an id) and re-attaches the original `sourceMarkdown` and `sourceWordCount`. The persisted source text is byte-identical to what we sent in step 2 — the LLM only contributes `claim`, `summary`, and `rootClaim` strings. If the LLM returned fewer sections than the chunker produced, we throw `ArticleTreeGenerationError` (502) instead of fabricating a fallback.

**5. Stamp + persist.** The result is wrapped with `format: "article-tree/v1"` and the current `CACHE_VERSION`, validated against `articleTreeSchema`, and inserted into Postgres. Subsequent requests for the same URL re-use that row only if its stored `cacheVersion` matches the current constant; old fold IDs continue to resolve via `/[id]` regardless.

## Layout

- `src/app` — routes (`/`, `/[id]`, `api/folds`, `api/extract`)
- `src/components/fold-viewer.tsx` — the expandable tree UI
- `src/lib/article.ts` — URL extraction
- `src/lib/article-tree.ts` — sectioning, LLM call, merge with source sections
- `src/lib/article-tree-schema.ts` — Zod schemas (LLM output + persisted form)
- `src/lib/db.ts` — Postgres persistence
- `src/lib/types.ts`, `src/lib/text.ts` — shared types and word utilities
