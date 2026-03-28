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
type InputAction = "extract" | "fold" | null;

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputAction, setInputAction] = useState<InputAction>(null);

  async function createFold(payload: {
    url?: string;
    title?: string | null;
    markdown?: string;
  }) {
    const response = await fetch("/api/folds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as FoldResponse;

    if (!response.ok) {
      throw new Error(body.error ?? "Failed to create fold.");
    }

    router.push(body.path);
  }

  async function handleExtract() {
    setError(null);

    if (!url.trim()) {
      setError("Enter a website URL.");
      return;
    }

    setInputAction("extract");

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
      setInputAction(null);
    }
  }

  async function handleDirectFold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Enter a website URL.");
      return;
    }

    setInputAction("fold");

    try {
      await createFold({ url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create fold.");
      setInputAction(null);
    }
  }

  async function handleFold() {
    setError(null);
    setStep("folding");

    try {
      await createFold({ url, title, markdown });
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
          <p className="mt-2 text-sm text-slate-400">
            read text at different levels of detail
          </p>

          <form onSubmit={handleDirectFold} className="mt-10">
            <div>
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
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-400 transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-offset-1 autofill:shadow-[inset_0_0_0px_1000px_white] autofill:[-webkit-text-fill-color:#0f172a]"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="submit"
                disabled={inputAction !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {inputAction === "fold" ? (
                  <>
                    <span className="fold-loader" aria-hidden />
                    Folding...
                  </>
                ) : (
                  "Fold"
                )}
              </button>
              <button
                type="button"
                onClick={handleExtract}
                disabled={inputAction !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {inputAction === "extract" ? (
                  <>
                    <span className="fold-loader" aria-hidden />
                    Extracting...
                  </>
                ) : (
                  "Extract text"
                )}
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>

          <button
            type="button"
            onClick={() => setStep("preview")}
            className="mt-5 text-sm text-slate-400 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-600 hover:decoration-slate-400"
          >
            Use custom text
          </button>
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
        placeholder="Paste or type your text here..."
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
