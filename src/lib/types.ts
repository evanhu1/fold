export type CompressionLevel = {
  label: string;
  targetWords: number | "full";
  text: string;
  wordCount: number;
  source: "original" | "llm";
};

export type FoldRecord = {
  id: string;
  articleUrl: string | null;
  articleTitle: string | null;
  originalText: string;
  levels: CompressionLevel[];
  createdAt: string;
};
