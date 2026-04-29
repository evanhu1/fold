import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FoldViewer from "@/components/fold-viewer";
import { getFoldById } from "@/lib/db";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const DEFAULT_DESCRIPTION = "Read this hyper efficiently with AI";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const fold = await getFoldById(id);

  if (!fold) {
    return {
      title: "Fold",
      description: DEFAULT_DESCRIPTION,
    };
  }

  const title = fold.articleTitle?.trim() || "Fold";

  return {
    title,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title,
      description: DEFAULT_DESCRIPTION,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description: DEFAULT_DESCRIPTION,
    },
  };
}

export default async function FoldPage({ params }: PageProps) {
  const { id } = await params;
  const fold = await getFoldById(id);

  if (!fold) {
    notFound();
  }

  return (
    <FoldViewer
      articleUrl={fold.articleUrl}
      articleTitle={fold.articleTitle}
      articleTree={fold.articleTree}
    />
  );
}
