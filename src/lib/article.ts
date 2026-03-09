import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { countWords } from "@/lib/text";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

const REMOVE_TAGS = [
  "img", "figure", "figcaption", "picture", "video", "audio",
  "iframe", "svg", "canvas", "button", "input", "select",
  "textarea", "form", "nav", "footer", "aside", "script",
  "style", "noscript",
] as string[];

turndown.remove(REMOVE_TAGS as TurndownService.Filter);

function normalizeMarkdown(md: string): string {
  return md.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function isLikelyCtaText(text: string): boolean {
  return /^(share|subscribe|sign up|sign in|follow|open in app|download|join|read more|start reading|start writing|get the app|listen)$/i.test(
    text,
  );
}

function isPromotionalInterstitial(element: Element): boolean {
  if (!["DIV", "SECTION", "ASIDE", "P"].includes(element.tagName)) {
    return false;
  }

  if (
    element.querySelector(
      "h1, h2, h3, h4, h5, h6, pre, code, blockquote, ul, ol, table, img, figure, picture, video, audio, iframe",
    )
  ) {
    return false;
  }

  const text = normalizeText(element.textContent);
  if (!text || text.length > 280) {
    return false;
  }

  const links = Array.from(element.querySelectorAll("a"));
  if (links.length === 0 || links.length > 3) {
    return false;
  }

  const linkTexts = links.map((link) => normalizeText(link.textContent)).filter(Boolean);
  const hasCtaLink = linkTexts.some(isLikelyCtaText);

  if (!hasCtaLink) {
    return false;
  }

  const attrText = Array.from(element.attributes)
    .map((attribute) => `${attribute.name}=${attribute.value}`)
    .join(" ");
  const signalText = `${text} ${linkTexts.join(" ")} ${attrText}`;

  return /thanks for reading|this post is public|share this post|subscribe|sign up|sign in|follow|open in app|download our app|get the app|start reading|start writing|member.?only/i.test(
    signalText,
  );
}

function sanitizeArticleContent(html: string): string {
  const { document } = parseHTML(
    `<!doctype html><html><body>${html}</body></html>`,
  );

  Array.from(document.querySelectorAll("div, section, aside, p")).forEach(
    (element) => {
      if (isPromotionalInterstitial(element)) {
        element.remove();
      }
    },
  );

  return document.body.innerHTML;
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
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  if (!response.ok) {
    throw new ArticleExtractionError(
      `Failed to fetch the article (${response.status}).`,
      response.status,
    );
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  // Set base URL so Readability can resolve relative links
  let base = document.querySelector("base");
  if (!base) {
    base = document.createElement("base");
    document.head.appendChild(base);
  }
  base.setAttribute("href", parsedUrl.toString());

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new ArticleExtractionError(
      "Could not extract article text from that page.",
      422,
    );
  }

  const sanitizedContent = sanitizeArticleContent(article.content);
  const markdown = normalizeMarkdown(turndown.turndown(sanitizedContent));

  if (!markdown) {
    throw new ArticleExtractionError(
      "Could not extract article text from that page.",
      422,
    );
  }

  return {
    title: article.title,
    byline: article.byline,
    excerpt: article.excerpt,
    siteName: article.siteName,
    lang: article.lang,
    url: parsedUrl.toString(),
    markdown,
    wordCount: countWords(markdown),
  };
}
