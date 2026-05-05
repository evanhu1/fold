import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { countWords, MAX_INPUT_WORDS } from "@/lib/text";
import {
  ARTICLE_TREE_FORMAT,
  articleTreeLLMSchema,
  articleTreeSchema,
  type ArticleTree,
  type ArticleTreeLLMOutput,
  type ArticleTreeSection,
} from "@/lib/article-tree-schema";

type SourceSection = {
  id: string;
  sourceMarkdown: string;
  sourceWordCount: number;
};

export class InputValidationError extends Error {
  status = 400;
}

export class ArticleTreeGenerationError extends Error {
  status = 502;
}

export const CACHE_VERSION = 4;

const SYSTEM_PROMPT =
  "You build hierarchical claim trees for hyper-efficient reading. Use only information present in the source text. Preserve caveats, uncertainty, numbers, and the article's actual argument. The root is a single quotable sentence that completely distills the article's main thesis — it must stand on its own as a takeaway, not a topic label. Each child section is a single claim sentence plus a one-paragraph summary of only that section.";

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
  if (totalWords < 250) {
    return Math.min(1, blockCount);
  }

  if (totalWords < 500) {
    return Math.min(2, blockCount);
  }

  if (totalWords < 1000) {
    return Math.min(3, blockCount);
  }

  if (totalWords < 2000) {
    return Math.min(4, blockCount);
  }

  if (totalWords < 4000) {
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
    "Requirements:",
    "- `rootClaim` must be a single, quotable sentence that delivers a complete distillation of the article's main thesis. It should read like a standalone takeaway someone could quote — not a topic label, generic summary, or restatement of the title.",
    "- Return exactly one section object for every provided section id, in the same order, reusing the same ids.",
    "- `claim` must be a single sentence that captures the main claim, point, or role of that section.",
    "- `summary` must be one concise paragraph of 2-4 sentences summarizing only that section.",
    "- Use only the facts from each section's source text.",
    "- Preserve caveats, uncertainty, chronology, and numbers.",
    "- Do not merge sections, reorder sections, or invent content.",
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

async function generateArticleTreeFromLLM(
  sourceSections: SourceSection[],
): Promise<ArticleTreeLLMOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const { object } = await generateObject({
    model: google(process.env.GEMINI_MODEL ?? "gemini-3-flash-preview"),
    schema: articleTreeLLMSchema,
    system: SYSTEM_PROMPT,
    prompt: buildArticleTreePrompt(sourceSections),
    temperature: 0.1,
  });

  return object;
}

function normalizeSummary(value: string): string {
  return value.replace(/\n{2,}/g, "\n").replace(/\s+/g, " ").trim();
}

function mergeWithSourceSections(
  llmOutput: ArticleTreeLLMOutput,
  sourceSections: SourceSection[],
): ArticleTreeSection[] | null {
  const merged: ArticleTreeSection[] = [];

  for (const [index, sourceSection] of sourceSections.entries()) {
    const matched =
      llmOutput.sections.find((section) => section.id === sourceSection.id) ??
      llmOutput.sections[index];

    if (!matched) {
      return null;
    }

    merged.push({
      id: sourceSection.id,
      claim: matched.claim.trim(),
      summary: normalizeSummary(matched.summary),
      sourceMarkdown: sourceSection.sourceMarkdown,
      sourceWordCount: sourceSection.sourceWordCount,
    });
  }

  return merged;
}

export function coerceArticleTree(raw: unknown): ArticleTree | null {
  const result = articleTreeSchema.safeParse(raw);
  return result.success ? result.data : null;
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

  let llmOutput: ArticleTreeLLMOutput;
  try {
    llmOutput = await generateArticleTreeFromLLM(sourceSections);
  } catch (error) {
    console.error("[article-tree] LLM generation failed", error);
    throw new ArticleTreeGenerationError(
      "We couldn't summarize this article right now. Please try again in a moment.",
    );
  }

  const sections = mergeWithSourceSections(llmOutput, sourceSections);
  if (!sections) {
    throw new ArticleTreeGenerationError(
      "We couldn't summarize this article right now. Please try again in a moment.",
    );
  }

  return {
    normalizedText,
    articleTree: {
      format: ARTICLE_TREE_FORMAT,
      cacheVersion: CACHE_VERSION,
      rootClaim: llmOutput.rootClaim.trim(),
      sections,
    },
  };
}
