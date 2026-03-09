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
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          Fold
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-base text-slate-500">
          Zoom in and out of any article to read it at different levels of detail.
        </p>

        <form onSubmit={handleSubmit} className="mt-10">
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 pr-24 text-sm text-slate-900 shadow-sm outline-none ring-slate-400 transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-offset-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? (
                <>
                  <span className="fold-loader" aria-hidden />
                </>
              ) : (
                "Fold"
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </form>
      </div>
    </main>
  );
}
