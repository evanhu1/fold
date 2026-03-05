# Repository Guidelines

## Project Structure & Module Organization
`src/app` holds the App Router pages and API routes, including `/`, `/fold/[id]`, and `api/folds`. Reusable UI lives in `src/components`, and shared logic lives in `src/lib`. Static files go in `public`. SQLite data is stored in `data/` and should be treated as generated local state.

## Build, Test, and Development Commands
Use `npm install` once, then `npm run dev` for local development. `npm run build` creates the production build, `npm run start` serves it, and `npm run lint` runs the project ESLint config. Run lint before opening a PR.

## Coding Style & Naming Conventions
Use strict TypeScript, keep functions small, and follow the existing formatting: 2-space indentation, double quotes, and trailing commas. Use `@/*` imports within `src`. Components should use PascalCase exports, while filenames stay kebab-case, for example `src/components/fold-viewer.tsx`.

## Testing Guidelines
There is no automated test suite yet. For now, use `npm run lint` and manually verify the main flow: submit text on `/`, confirm a fold is created, and check `/fold/{id}` renders correctly. If you add tests, place them near the feature as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
History is minimal, so use short imperative commit messages such as `Add fold copy button`. Keep PRs focused and include a brief summary, manual verification steps, and screenshots for UI changes when helpful.

## Security & Configuration Tips
Keep secrets in `.env.local` and update `.env.example` when config changes. Never commit API keys, local env files, or generated `data/*.db*` files.
