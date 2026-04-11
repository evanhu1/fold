# Fold

Fold is a Next.js App Router app that extracts article text from a URL, compresses it into fixed summary levels, and stores each result in Postgres so every fold has a shareable URL.

## Requirements

- Node.js 20+
- Anthropic, Gemini, or OpenAI API key

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Set environment variables:
   ```bash
   cp .env.example .env.local
   ```
3. Add your Neon database URL and API key in `.env.local`.
4. Run the app:
   ```bash
   pnpm dev
   ```

## Behavior

- Input: a URL to an article, essay, post, or other text-heavy page
- Input limit: 4,000 extracted words (enforced on the server after article extraction)
- Parallel compression levels are selected dynamically and always strictly smaller than the source word count
- Landing page: URL input and `Fold Article` action
- On submit: extracts the article body, creates a persisted fold, and redirects to `/fold/{id}`
- Shareable fold page: slider-based zoom from Full text to 1-word summary

## LLM Provider

- Default: Anthropic (`LLM_PROVIDER=anthropic`)
- Gemini: `LLM_PROVIDER=gemini` and optionally `GEMINI_MODEL=gemini-3.1-pro-preview`
- You can switch to OpenAI by setting `LLM_PROVIDER=openai`

## Persistence

- Database URL: `DATABASE_URL`
- Recommended Vercel storage integration: Neon
- Table: `folds`
