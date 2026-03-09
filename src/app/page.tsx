"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ExtractResponse = {
  title: string | null;
  markdown: string;
  wordCount: number;
  error?: string;
};

type FoldResponse = {
  id: string;
  path: string;
  shareUrl: string;
  error?: string;
};

type Step = "input" | "preview" | "folding";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  async function handleExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Enter a website URL.");
      return;
    }

    setExtracting(true);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const body = (await response.json()) as ExtractResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to extract article.");
      }

      setTitle(body.title);
      setMarkdown(body.markdown);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract article.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleFold() {
    setError(null);
    setStep("folding");

    try {
      const response = await fetch("/api/folds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, markdown }),
      });

      const body = (await response.json()) as FoldResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create fold.");
      }

      router.push(body.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create fold.");
      setStep("preview");
    }
  }

  function handleBack() {
    setStep("input");
    setTitle(null);
    setMarkdown("");
    setError(null);
  }

  if (step === "input") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-serif text-5xl font-bold tracking-tight text-slate-900">
            Fold
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-base text-slate-500">
            Zoom in and out of any article to read it at different levels of
            detail.
          </p>

          <form onSubmit={handleExtract} className="mt-10">
            <div className="relative">
              <input
                id="article-url"
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste an article URL"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 pr-24 text-sm text-slate-900 shadow-sm outline-none ring-slate-400 transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-offset-1 autofill:shadow-[inset_0_0_0px_1000px_white] autofill:[-webkit-text-fill-color:#0f172a]"
              />
              <button
                type="submit"
                disabled={extracting}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {extracting ? (
                  <span className="fold-loader" aria-hidden />
                ) : (
                  "Extract"
                )}
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </div>
      </main>
    );
  }

  // Preview & folding states
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900">
          Fold
        </h1>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-slate-500 transition hover:text-slate-800"
        >
          Start over
        </button>
      </header>

      {title && (
        <h2 className="mt-6 text-lg font-semibold leading-snug text-slate-800">
          {title}
        </h2>
      )}

      <textarea
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        disabled={step === "folding"}
        className="mt-4 min-h-[60vh] w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
      />

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Edit the text above before folding if needed.
        </p>

        <button
          type="button"
          onClick={handleFold}
          disabled={step === "folding" || !markdown.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {step === "folding" ? (
            <>
              <span className="fold-loader" aria-hidden />
              Folding...
            </>
          ) : (
            "Fold"
          )}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </main>
  );
}
