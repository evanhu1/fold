import { NextRequest, NextResponse } from "next/server";
import { buildCompressionLevels, InputValidationError } from "@/lib/compress";
import { saveFold } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { text?: string };
    const inputText = payload.text ?? "";

    const { normalizedText, inputWordCount, levels } = await buildCompressionLevels(
      inputText,
    );

    const fold = saveFold({
      originalText: normalizedText,
      originalWordCount: inputWordCount,
      levels,
    });

    const path = `/fold/${fold.id}`;
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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to create folded text.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
