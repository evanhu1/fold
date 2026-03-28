import { createHash } from "node:crypto";
import {
  MAX_INPUT_WORDS,
  countWords,
  selectCompressionTargets,
} from "@/lib/text";
import type { CompressionLevel } from "@/lib/types";

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
  stop_reason?: string | null;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
};

type AnthropicTextBlock = {
  type: "text";
  text: string;
  cache_control?: {
    type: "ephemeral";
  };
};

export class InputValidationError extends Error {
  status = 400;
}

const SHARED_SYSTEM_PROMPT =
  "You write progressive disclosure summaries of the same source text. You will be given a target word count and sometimes a previous shorter version. Your output MUST be close to the target word count — aim for 90-100% of the target. If the target is 2500 words, output around 2250-2500 words. Do not drastically undershoot. Preserve markdown formatting (headings, lists, bold, italics, links, paragraphs). Keep core facts and meaning. End cleanly with a complete thought. Do not add any title or heading. Return only the body text.";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const anthropicWarmups = new Map<string, Promise<void>>();

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

function buildCanonicalSourcePrefix(text: string): string {
  return `<source_text>\n${text}\n</source_text>`;
}

function buildAnthropicSystemBlocks(
  canonicalSourceText: string,
): AnthropicTextBlock[] {
  return [
    {
      type: "text",
      text: SHARED_SYSTEM_PROMPT,
    },
    {
      type: "text",
      text:
        "Use the cached source text below as the only source material. Preserve markdown structure and line breaks when they carry meaning.",
    },
    {
      type: "text",
      text: canonicalSourceText,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserPrompt({
  targetWords,
  sourceText,
  previousVersion,
  includeSourceText = true,
}: {
  targetWords: number;
  sourceText?: string;
  previousVersion?: string;
  includeSourceText?: boolean;
}): string {
  const goal = previousVersion
    ? `Expand the previous version to approximately ${targetWords} words.`
    : `Write the shortest useful version of the source text in approximately ${targetWords} words.`;

  const requirements = previousVersion
    ? [
        "Preserve all facts, claims, and framing already present in the previous version.",
        "Keep the same structure and order when possible.",
        "Reuse wording from the previous version unless changing it improves clarity or flow.",
        "Add only the next most important missing details from the source text.",
        "Do not remove earlier information or contradict it.",
      ]
    : [
        "Capture only the highest-priority ideas and facts needed to understand the text.",
        "Favor clarity and density over completeness.",
      ];

  const sections = [
    goal,
    "",
    "Requirements:",
    ...requirements.map((requirement) => `- ${requirement}`),
  ];

  if (previousVersion) {
    sections.push(
      "",
      "<previous_version>",
      previousVersion,
      "</previous_version>",
    );
  }

  if (includeSourceText && sourceText) {
    sections.push(
      "",
      "<source_text>",
      sourceText,
      "</source_text>",
    );
  }

  return sections.join("\n");
}

function buildAnthropicWarmupKey(
  model: string,
  canonicalSourceText: string,
): string {
  return createHash("sha256")
    .update(model)
    .update("\n")
    .update(canonicalSourceText)
    .digest("hex");
}

function shouldUseAnthropic(): boolean {
  const provider = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "anthropic") {
    return true;
  }

  if (provider === "openai") {
    return false;
  }

  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function requestAnthropicCompression(
  apiKey: string,
  model: string,
  canonicalSourceText: string,
  userPrompt: string,
): Promise<AnthropicResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      system: buildAnthropicSystemBlocks(canonicalSourceText),
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as AnthropicResponse;
}

async function compressWithOpenAI(
  sourceText: string,
  targetWords: number,
  previousVersion?: string,
): Promise<string> {
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: SHARED_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildUserPrompt({
            targetWords,
            sourceText,
            previousVersion,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM returned an empty response");
  }

  return content;
}

async function compressWithAnthropic(
  canonicalSourceText: string,
  targetWords: number,
  previousVersion?: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const data = await requestAnthropicCompression(
      apiKey,
      model,
      canonicalSourceText,
      buildUserPrompt({
        targetWords,
        previousVersion,
        includeSourceText: false,
      }),
    );
    const content = extractAnthropicText(data);

    if (content) {
      return content;
    }

    break;
  }

  throw new Error("Anthropic returned an empty response");
}

async function compressWithGemini(
  sourceText: string,
  targetWords: number,
  previousVersion?: string,
): Promise<string> {
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
            text: SHARED_SYSTEM_PROMPT,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildUserPrompt({
                targetWords,
                sourceText,
                previousVersion,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
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

async function warmAnthropicPrefix(canonicalSourceText: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const warmupKey = buildAnthropicWarmupKey(model, canonicalSourceText);
  const existingWarmup = anthropicWarmups.get(warmupKey);
  if (existingWarmup) {
    await existingWarmup;
    return;
  }

  const warmupPromise = (async () => {
    const data = await requestAnthropicCompression(
      apiKey,
      model,
      canonicalSourceText,
      "Reply with READY.",
    );

    if (!extractAnthropicText(data)) {
      throw new Error("Anthropic warmup returned an empty response");
    }
  })();

  anthropicWarmups.set(warmupKey, warmupPromise);

  try {
    await warmupPromise;
  } finally {
    anthropicWarmups.delete(warmupKey);
  }
}

async function compressWithLLM(
  sourceText: string,
  targetWords: number,
  previousVersion?: string,
  canonicalSourceText?: string,
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "anthropic") {
    return compressWithAnthropic(
      canonicalSourceText ?? buildCanonicalSourcePrefix(sourceText),
      targetWords,
      previousVersion,
    );
  }

  if (provider === "gemini") {
    return compressWithGemini(sourceText, targetWords, previousVersion);
  }

  if (provider === "openai") {
    return compressWithOpenAI(sourceText, targetWords, previousVersion);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return compressWithAnthropic(
      canonicalSourceText ?? buildCanonicalSourcePrefix(sourceText),
      targetWords,
      previousVersion,
    );
  }

  if (process.env.OPENAI_API_KEY) {
    return compressWithOpenAI(sourceText, targetWords, previousVersion);
  }

  if (process.env.GEMINI_API_KEY) {
    return compressWithGemini(sourceText, targetWords, previousVersion);
  }

  throw new Error(
    "No LLM API key configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.",
  );
}

export async function buildCompressionLevels(inputText: string): Promise<{
  normalizedText: string;
  levels: CompressionLevel[];
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

  const targets = selectCompressionTargets(inputWordCount);
  const canonicalSourceText = buildCanonicalSourcePrefix(normalizedText);

  if (shouldUseAnthropic() && targets.length > 1) {
    await warmAnthropicPrefix(canonicalSourceText);
  }

  // Generate the ladder from smallest to largest so each version expands
  // the previous one while keeping the full source text in scope.
  const compressions: Array<{
    target: number;
    text: string;
    source: "llm";
  }> = [];
  let previousVersion: string | undefined;

  for (const target of [...targets].reverse()) {
    const compressed = await compressWithLLM(
      normalizedText,
      target,
      previousVersion,
      canonicalSourceText,
    );

    compressions.push({
      target,
      text: compressed,
      source: "llm",
    });

    previousVersion = compressed;
  }

  const levels: CompressionLevel[] = [
    {
      label: `Full (${inputWordCount} words)`,
      targetWords: "full",
      text: normalizedText,
      wordCount: inputWordCount,
      source: "original",
    },
    ...compressions.reverse().map((entry) => ({
      label: `${entry.target} words`,
      targetWords: entry.target,
      text: entry.text,
      wordCount: countWords(entry.text),
      source: entry.source,
    })),
  ];

  return { normalizedText, levels };
}
