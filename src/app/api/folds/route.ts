import { NextRequest, NextResponse } from "next/server";
import { buildCompressionLevels, InputValidationError } from "@/lib/compress";
import { saveFold } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      url?: string;
      title?: string;
      markdown?: string;
    };

    const markdown = payload.markdown ?? "";
    const articleUrl = payload.url?.trim() || null;
    const title = payload.title?.trim() || null;

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

    const message =
      error instanceof Error ? error.message : "Failed to create folded text.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
