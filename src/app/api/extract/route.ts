import { NextRequest, NextResponse } from "next/server";
import { ArticleExtractionError, getArticle } from "@/lib/article";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { url?: string };
    const article = await getArticle(payload.url ?? "");

    return NextResponse.json({
      title: article.title?.trim() || null,
      markdown: article.markdown,
      wordCount: article.wordCount,
    });
  } catch (error) {
    if (error instanceof ArticleExtractionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to extract article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
