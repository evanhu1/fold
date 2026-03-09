export type CompressionLevel = {
  label: string;
  targetWords: number | "full";
  text: string;
  wordCount: number;
  source: "original" | "llm";
};

export type FoldRecord = {
  id: string;
  articleTitle: string | null;
  originalText: string;
  originalWordCount: number;
  levels: CompressionLevel[];
  createdAt: string;
};
