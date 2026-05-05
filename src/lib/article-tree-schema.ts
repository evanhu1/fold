import { z } from "zod";

export const ARTICLE_TREE_FORMAT = "article-tree/v1" as const;

export const articleTreeLLMSchema = z.object({
  rootClaim: z
    .string()
    .min(1)
    .describe(
      "A single quotable sentence that completely distills the article's main thesis. Must stand on its own as a takeaway, not a topic label or restatement of the title.",
    ),
  sections: z
    .array(
      z.object({
        id: z.string().min(1).describe("The id of the source section, reused verbatim."),
        claim: z
          .string()
          .min(1)
          .describe("A single sentence capturing the main claim, point, or role of the section."),
        summary: z
          .string()
          .min(1)
          .describe("One concise paragraph (2-4 sentences) summarizing only this section."),
      }),
    )
    .min(1),
});

export type ArticleTreeLLMOutput = z.infer<typeof articleTreeLLMSchema>;

export const articleTreeSectionSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  summary: z.string().min(1),
  sourceMarkdown: z.string().min(1),
  sourceWordCount: z.number().int().nonnegative(),
});

export const articleTreeSchema = z.object({
  format: z.literal(ARTICLE_TREE_FORMAT),
  cacheVersion: z.number().int().nonnegative().catch(0),
  rootClaim: z.string().min(1),
  sections: z.array(articleTreeSectionSchema).min(1),
});

export type ArticleTreeSection = z.infer<typeof articleTreeSectionSchema>;
export type ArticleTree = z.infer<typeof articleTreeSchema>;
