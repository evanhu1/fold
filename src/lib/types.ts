import type { ArticleTree } from "@/lib/article-tree-schema";

export type { ArticleTree, ArticleTreeSection } from "@/lib/article-tree-schema";

export type FoldRecord = {
  id: string;
  articleUrl: string | null;
  articleTitle: string | null;
  originalText: string;
  articleTree: ArticleTree;
  createdAt: string;
};
