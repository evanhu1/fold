import { countWords, MAX_INPUT_WORDS } from "@/lib/text";
import type { ArticleTree, ArticleTreeSection } from "@/lib/types";

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type JsonRecord = Record<string, unknown>;

type SourceSection = {
  id: string;
  sourceMarkdown: string;
  sourceWordCount: number;
};

export class InputValidationError extends Error {
  status = 400;
}

const SYSTEM_PROMPT =
  "You build hierarchical claim trees for hyper-efficient reading. Use only information present in the source text. Preserve caveats, uncertainty, numbers, and the article's actual argument. The root is a single central thesis sentence. Each child section is a single claim sentence plus a one-paragraph summary of only that section. Return strict JSON only. Do not wrap the JSON in markdown fences.";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  return stripMarkdownSyntax(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function slugify(index: number): string {
  return `section-${index + 1}`;
}

function splitIntoBlocks(sourceText: string): string[] {
  return sourceText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function blockStartsHeading(block: string): boolean {
  const firstLine = block.split("\n")[0]?.trim() ?? "";
  return /^#{1,6}\s+.+$/.test(firstLine);
}

function buildHeadingSections(blocks: string[]): string[] {
  const sections: string[] = [];
  let current: string[] = [];

  for (const block of blocks) {
    if (blockStartsHeading(block) && current.length > 0) {
      sections.push(current.join("\n\n"));
      current = [block];
      continue;
    }

    current.push(block);
  }

  if (current.length > 0) {
    sections.push(current.join("\n\n"));
  }

  return sections.filter(Boolean);
}

function getDesiredSectionCount(totalWords: number, blockCount: number): number {
  if (totalWords < 350) {
    return Math.min(1, blockCount);
  }

  if (totalWords < 900) {
    return Math.min(2, blockCount);
  }

  if (totalWords < 1800) {
    return Math.min(3, blockCount);
  }

  if (totalWords < 3200) {
    return Math.min(4, blockCount);
  }

  if (totalWords < 5000) {
    return Math.min(5, blockCount);
  }

  return Math.min(6, blockCount);
}

function chunkBlocksByWords(blocks: string[], desiredCount: number): string[] {
  if (desiredCount <= 1 || blocks.length <= 1) {
    return [blocks.join("\n\n")];
  }

  const totalWords = blocks.reduce((sum, block) => sum + countWords(block), 0);
  const targetWords = Math.max(1, Math.ceil(totalWords / desiredCount));
  const sections: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    current.push(block);
    currentWords += countWords(block);

    const remainingBlocks = blocks.length - index - 1;
    const remainingSections = desiredCount - sections.length - 1;
    const shouldBreak =
      sections.length < desiredCount - 1 &&
      currentWords >= targetWords &&
      remainingBlocks >= remainingSections;

    if (shouldBreak) {
      sections.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
  }

  if (current.length > 0) {
    sections.push(current.join("\n\n"));
  }

  return sections.filter(Boolean);
}

function buildSourceSections(sourceText: string): SourceSection[] {
  const blocks = splitIntoBlocks(sourceText);

  if (blocks.length === 0) {
    return [
      {
        id: "section-1",
        sourceMarkdown: sourceText.trim(),
        sourceWordCount: countWords(sourceText),
      },
    ];
  }

  const headingSections = buildHeadingSections(blocks);
  const rawSections =
    headingSections.length >= 2 && headingSections.length <= 8
      ? headingSections
      : chunkBlocksByWords(
          blocks,
          getDesiredSectionCount(countWords(sourceText), blocks.length),
        );

  return rawSections.map((section, index) => ({
    id: slugify(index),
    sourceMarkdown: section.trim(),
    sourceWordCount: countWords(section),
  }));
}

function buildArticleTreePrompt(sourceSections: SourceSection[]): string {
  return [
    "Build a thesis tree from the ordered source sections below.",
    "",
    "Return a JSON object with exactly this shape:",
    "{",
    '  "rootClaim": string,',
    '  "sections": [',
    "    {",
    '      "id": string,',
    '      "claim": string,',
    '      "summary": string',
    "    }",
    "  ]",
    "}",
    "",
    "Requirements:",
    "- `rootClaim` must be a single sentence that captures the article's central thesis or main takeaway.",
    "- Return exactly one section object for every provided section id, in the same order, reusing the same ids.",
    "- `claim` must be a single sentence that captures the main claim, point, or role of that section.",
    "- `summary` must be one concise paragraph of 2-4 sentences summarizing only that section.",
    "- Use only the facts from each section's source text.",
    "- Preserve caveats, uncertainty, chronology, and numbers.",
    "- Do not merge sections, reorder sections, or invent content.",
    "- Do not include any text outside the JSON object.",
    "",
    "<source_sections>",
    ...sourceSections.flatMap((section) => [
      `<section id="${section.id}">`,
      section.sourceMarkdown,
      "</section>",
      "",
    ]),
    "</source_sections>",
  ].join("\n");
}

function extractAnthropicText(data: AnthropicResponse): string {
  return (
    data.content
      ?.filter((piece) => piece.type === "text" && piece.text)
      .map((piece) => piece.text)
      .join("\n")
      .trim() ?? ""
  );
}

function extractGeminiText(data: GeminiResponse): string {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

async function requestOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return content;
}

async function requestAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const content = extractAnthropicText(data);
  if (!content) {
    throw new Error("Anthropic returned an empty response");
  }

  return content;
}

async function requestGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-pro-preview";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: SYSTEM_PROMPT,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const content = extractGeminiText(data);
  if (!content) {
    throw new Error("Gemini returned an empty response");
  }

  return content;
}

async function generateArticleTreeJson(sourceSections: SourceSection[]): Promise<string> {
  const prompt = buildArticleTreePrompt(sourceSections);
  const provider = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "gemini") {
    return requestGemini(prompt);
  }

  if (provider === "openai") {
    return requestOpenAI(prompt);
  }

  if (provider === "anthropic") {
    return requestAnthropic(prompt);
  }

  if (process.env.GEMINI_API_KEY) {
    return requestGemini(prompt);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return requestAnthropic(prompt);
  }

  if (process.env.OPENAI_API_KEY) {
    return requestOpenAI(prompt);
  }

  throw new Error(
    "No LLM API key configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.",
  );
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutOpen.replace(/\s*```$/, "").trim();
}

function extractJsonObject(text: string): string {
  const cleaned = stripJsonFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

function normalizeSummary(value: unknown): string {
  return normalizeString(value).replace(/\n{2,}/g, "\n").replace(/\s+/g, " ").trim();
}

export function coerceArticleTree(
  raw: unknown,
  sourceSections?: SourceSection[],
): ArticleTree | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as JsonRecord;
  const rootClaim = normalizeString(record.rootClaim);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];

  if (!rootClaim || rawSections.length === 0) {
    return null;
  }

  if (sourceSections) {
    const normalizedSections = sourceSections.map((sourceSection, index) => {
      const matchedRaw =
        rawSections.find((candidate) => {
          if (!candidate || typeof candidate !== "object") {
            return false;
          }

          return normalizeString((candidate as JsonRecord).id) === sourceSection.id;
        }) ?? rawSections[index];

      if (!matchedRaw || typeof matchedRaw !== "object") {
        return null;
      }

      const sectionRecord = matchedRaw as JsonRecord;
      const claim = normalizeString(sectionRecord.claim);
      const summary = normalizeSummary(sectionRecord.summary);

      if (!claim || !summary) {
        return null;
      }

      return {
        id: sourceSection.id,
        claim,
        summary,
        sourceMarkdown: sourceSection.sourceMarkdown,
        sourceWordCount: sourceSection.sourceWordCount,
      } satisfies ArticleTreeSection;
    });

    if (normalizedSections.some((section) => section === null)) {
      return null;
    }

    return {
      format: "article-tree/v1",
      rootClaim,
      sections: normalizedSections as ArticleTreeSection[],
    };
  }

  const normalizedSections = rawSections
    .map((rawSection) => {
      if (!rawSection || typeof rawSection !== "object") {
        return null;
      }

      const sectionRecord = rawSection as JsonRecord;
      const id = normalizeString(sectionRecord.id);
      const claim = normalizeString(sectionRecord.claim);
      const summary = normalizeSummary(sectionRecord.summary);
      const sourceMarkdown = normalizeString(sectionRecord.sourceMarkdown);
      const sourceWordCountValue = sectionRecord.sourceWordCount;
      const sourceWordCount =
        typeof sourceWordCountValue === "number" && Number.isFinite(sourceWordCountValue)
          ? sourceWordCountValue
          : countWords(sourceMarkdown);

      if (!id || !claim || !summary || !sourceMarkdown) {
        return null;
      }

      return {
        id,
        claim,
        summary,
        sourceMarkdown,
        sourceWordCount,
      } satisfies ArticleTreeSection;
    })
    .filter((section): section is ArticleTreeSection => section !== null);

  if (normalizedSections.length === 0) {
    return null;
  }

  return {
    format: "article-tree/v1",
    rootClaim,
    sections: normalizedSections,
  };
}

function parseArticleTreeJson(
  text: string,
  sourceSections: SourceSection[],
): ArticleTree | null {
  try {
    return coerceArticleTree(JSON.parse(extractJsonObject(text)), sourceSections);
  } catch {
    return null;
  }
}

function createClaim(text: string, fallback: string): string {
  return splitIntoSentences(text)[0] || fallback;
}

function createSummary(text: string): string {
  const sentences = splitIntoSentences(text).slice(0, 3);
  return sentences.join(" ").trim() || stripMarkdownSyntax(text);
}

function buildFallbackArticleTree(
  sourceText: string,
  sourceSections: SourceSection[],
): ArticleTree {
  const rootClaim =
    splitIntoSentences(sourceText)[0] ||
    "This article is organized into a set of related claims.";

  return {
    format: "article-tree/v1",
    rootClaim,
    sections: sourceSections.map((section, index) => ({
      id: section.id,
      claim: createClaim(section.sourceMarkdown, `Section ${index + 1}`),
      summary: createSummary(section.sourceMarkdown),
      sourceMarkdown: section.sourceMarkdown,
      sourceWordCount: section.sourceWordCount,
    })),
  };
}

export async function buildArticleTree(inputText: string): Promise<{
  normalizedText: string;
  articleTree: ArticleTree;
}> {
  const normalizedText = inputText.trim();
  if (!normalizedText) {
    throw new InputValidationError("Text is required.");
  }

  const inputWordCount = countWords(normalizedText);
  if (inputWordCount > MAX_INPUT_WORDS) {
    throw new InputValidationError(
      `Text exceeds the ${MAX_INPUT_WORDS}-word limit (${inputWordCount} words provided).`,
    );
  }

  const sourceSections = buildSourceSections(normalizedText);

  try {
    const rawTree = await generateArticleTreeJson(sourceSections);
    const articleTree = parseArticleTreeJson(rawTree, sourceSections);

    if (articleTree) {
      return { normalizedText, articleTree };
    }
  } catch {
    // Fall through to the local structural fallback below.
  }

  return {
    normalizedText,
    articleTree: buildFallbackArticleTree(normalizedText, sourceSections),
  };
}
