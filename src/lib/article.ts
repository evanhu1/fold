import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { countWords } from "@/lib/text";

function normalizeArticleText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export class ArticleExtractionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function getArticle(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ArticleExtractionError("Enter a valid website URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ArticleExtractionError("URL must start with http:// or https://.");
  }

  const response = await fetch(parsedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FoldBot/1.0; +https://fold.local/article-fetcher)",
    },
  });

  if (!response.ok) {
    throw new ArticleExtractionError(
      `Failed to fetch the article (${response.status}).`,
      response.status,
    );
  }

  const html = await response.text();
  const doc = new JSDOM(html, {
    url: parsedUrl.toString(),
  });
  const reader = new Readability(doc.window.document);
  const article = reader.parse();

  if (!article?.textContent) {
    throw new ArticleExtractionError(
      "Could not extract article text from that page.",
      422,
    );
  }

  const text = normalizeArticleText(article.textContent);

  if (!text) {
    throw new ArticleExtractionError(
      "Could not extract article text from that page.",
      422,
    );
  }

  return {
    ...article,
    url: parsedUrl.toString(),
    textContent: text,
    wordCount: countWords(text),
  };
}
