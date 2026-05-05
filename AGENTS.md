# Repository Guidelines

## Project Structure
`src/app` holds App Router pages and API routes: `/` (URL or markdown input), `/[id]` (fold viewer), `api/folds` (create + fetch), `api/extract` (URL → markdown via Readability). Reusable UI lives in `src/components` (`fold-viewer.tsx` renders the expandable claim tree). Shared logic lives in `src/lib`: `article.ts` (URL extraction), `article-tree.ts` (sectioning, LLM calls, parsing, fallback), `db.ts` (Postgres), `types.ts`, `text.ts`. Static files go in `public`.

## Commands
Use `pnpm install` once, then `pnpm dev` for local development. `pnpm build` creates the production build, `pnpm start` serves it, and `pnpm lint` runs the project ESLint config. Run lint before opening a PR.

## Coding Style
Strict TypeScript, small functions, 2-space indentation, double quotes, trailing commas. Use `@/*` imports within `src`. Components use PascalCase exports; filenames stay kebab-case (e.g. `src/components/fold-viewer.tsx`).

## Testing
No automated test suite yet. Use `pnpm lint` and manually verify the main flow: paste a URL on `/`, confirm a fold is created, and check `/{id}` renders the claim tree (root claim → section claims → summaries → source markdown) and that each level expands and collapses correctly. If you add tests, place them near the feature as `*.test.ts` or `*.test.tsx`.

## Commits & PRs
History is minimal — use short imperative commit messages such as `Add fold copy button`. Keep PRs focused and include a brief summary, manual verification steps, and screenshots for UI changes when helpful.

## Configuration
Postgres connection comes from `DATABASE_URL` (Neon locally and on Vercel via the Neon integration). LLM calls go through Google Gemini via the Vercel AI SDK; set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`. Keep secrets in `.env.local` and update `.env.example` when config changes. Never commit API keys or local env files.
