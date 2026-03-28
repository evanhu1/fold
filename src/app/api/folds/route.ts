import { NextRequest, NextResponse } from "next/server";
import { buildCompressionLevels, InputValidationError } from "@/lib/compress";
import { ArticleExtractionError, getArticle } from "@/lib/article";
import { saveFold } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      url?: string;
      title?: string;
      markdown?: string;
    };

    let markdown = payload.markdown?.trim() ?? "";
    let articleUrl = payload.url?.trim() || null;
    let title = payload.title?.trim() || null;

    if (!markdown && articleUrl) {
      const article = await getArticle(articleUrl);
      markdown = article.markdown;
      articleUrl = article.url;
      title = title ?? (article.title?.trim() || null);
    }

    const { normalizedText, levels } =
      await buildCompressionLevels(markdown);

    const fold = await saveFold({
      articleUrl,
      articleTitle: title,
      originalText: normalizedText,
      levels,
    });

    const path = `/${fold.id}`;
    const shareUrl = new URL(path, request.url).toString();

    return NextResponse.json(
      {
        id: fold.id,
        path,
        shareUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof ArticleExtractionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to create folded text.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
