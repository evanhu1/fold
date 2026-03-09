"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CreateFoldResponse = {
  id: string;
  path: string;
  shareUrl: string;
};

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Enter a website URL.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/folds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
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
          Zoom in and out of text to see it at different levels of compression.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col">
          <label
            htmlFor="article-url"
            className="mb-3 text-sm font-medium text-slate-700"
          >
            Enter a URL
          </label>
          <input
            id="article-url"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/article"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-slate-500 transition focus:ring-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {loading ? (
              <>
                <span className="fold-loader" aria-hidden />
                Extracting Text...
              </>
            ) : (
              "Fold Article"
            )}
          </button>
          {error ? <span className="text-red-700">{error}</span> : null}
        </div>
      </form>
    </main>
  );
}
