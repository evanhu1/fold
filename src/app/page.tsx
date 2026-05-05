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
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-slate-900">
            Fold
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Read hyper efficiently with AI
          </p>

          <form onSubmit={handleDirectFold} className="mt-4">
            <div className="flex items-stretch gap-2">
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
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-400 transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-offset-1 autofill:shadow-[inset_0_0_0px_1000px_white] autofill:[-webkit-text-fill-color:#0f172a]"
              />
              <button
                type="submit"
                disabled={inputAction !== null}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
            </div>

            <div className="mt-3 flex flex-row justify-center gap-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={inputAction !== null}
                className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 text-sm text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                {inputAction === "extract" ? (
                  <>
                    <span className="fold-loader" aria-hidden />
                    Extracting...
                  </>
                ) : (
                  "Extract text from URL"
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep("preview")}
                disabled={inputAction !== null}
                className="inline-flex items-center justify-center px-2 py-2.5 text-sm text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Use custom text
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </div>

        <footer className="absolute bottom-6 flex flex-col items-center gap-2 text-xs text-slate-400">
          <a
            href="https://github.com/evanhu1/fold"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-slate-400 transition hover:text-slate-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.1-3.13.68-3.79-1.34-3.79-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.99 0 0 .94-.3 3.09 1.16.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.15-1.46 3.09-1.16 3.09-1.16.61 1.56.23 2.7.11 2.99.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.29-5.15 5.56.4.35.76 1.03.76 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.2.65.78.54 4.46-1.49 7.68-5.7 7.68-10.67C23.25 5.48 18.27.5 12 .5z"
              />
            </svg>
          </a>
          <p>
            Made by{" "}
            <a
              href="https://evan.hu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline"
            >
              Evan
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // Preview & folding states
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
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
