import { notFound } from "next/navigation";
import FoldViewer from "@/components/fold-viewer";
import { getFoldById } from "@/lib/db";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FoldPage({ params }: PageProps) {
  const { id } = await params;
  const fold = await getFoldById(id);

  if (!fold) {
    notFound();
  }

  return <FoldViewer articleTitle={fold.articleTitle} levels={fold.levels} />;
}
