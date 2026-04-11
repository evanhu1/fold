export type ArticleTreeSection = {
  id: string;
  claim: string;
  summary: string;
  sourceMarkdown: string;
  sourceWordCount: number;
};

export type ArticleTree = {
  format: "article-tree/v1";
  rootClaim: string;
  sections: ArticleTreeSection[];
};

export type FoldRecord = {
  id: string;
  articleUrl: string | null;
  articleTitle: string | null;
  originalText: string;
  articleTree: ArticleTree;
  createdAt: string;
};
