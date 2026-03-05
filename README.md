# Fold

Fold is a Next.js tool that compresses text into fixed summary levels and stores each result in SQLite so every fold has a shareable URL.

## Requirements

- Node.js 20+
- Anthropic API key (default) or OpenAI API key

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set environment variables:
   ```bash
   cp .env.example .env.local
   ```
3. Add your API key in `.env.local`.
4. Run the app:
   ```bash
   npm run dev
   ```

## Behavior

- Input limit: 4,000 words (enforced on client and server)
- Parallel compression levels are selected dynamically and always strictly smaller than the source word count
- Landing page: large input area and `Fold Text` action
- On submit: creates a persisted fold and redirects to `/fold/{id}`
- Shareable fold page: slider-based zoom from Full text to 1-word summary

## LLM Provider

- Default: Anthropic (`LLM_PROVIDER=anthropic`)
- You can switch to OpenAI by setting `LLM_PROVIDER=openai`

## Persistence

- SQLite file: `data/fold.db`
- Table: `folds`
