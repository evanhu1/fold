"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_INPUT_WORDS, countWords } from "@/lib/text";

type CreateFoldResponse = {
  id: string;
  path: string;
  shareUrl: string;
};

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputWords = useMemo(() => countWords(input), [input]);
  const tooLong = inputWords > MAX_INPUT_WORDS;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError("Enter text to fold.");
      return;
    }

    if (tooLong) {
      setError(`Input exceeds ${MAX_INPUT_WORDS} words.`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/folds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: input }),
      });

      const body = (await response.json()) as CreateFoldResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create fold.");
      }

      setTimeout(() => router.push(body.path), 180);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create fold.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 md:px-10">
      <header className="mb-6">
        <h1 className="text-4xl font-semibold tracking-tight">Fold</h1>
        <p className="mt-2 text-sm text-slate-600">
          Paste up to {MAX_INPUT_WORDS.toLocaleString()} words. Fold will compress
          the text into fixed scales and create a shareable page.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste text here..."
          className="min-h-[62vh] w-full flex-1 resize-none rounded-3xl border border-slate-300 bg-white/85 px-5 py-4 text-sm leading-7 text-slate-900 outline-none ring-slate-500 transition focus:ring-2"
        />

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="submit"
            disabled={loading || tooLong}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {loading ? (
              <>
                <span className="fold-loader" aria-hidden />
                Folding Text...
              </>
            ) : (
              "Fold Text"
            )}
          </button>
          <span className={tooLong ? "text-red-700" : "text-slate-600"}>
            {inputWords} / {MAX_INPUT_WORDS} words
          </span>
          {error ? <span className="text-red-700">{error}</span> : null}
        </div>
      </form>
    </main>
  );
}
