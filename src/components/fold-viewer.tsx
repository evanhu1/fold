"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { CompressionLevel } from "@/lib/types";

type FoldViewerProps = {
  articleTitle?: string | null;
  levels: CompressionLevel[];
};

export default function FoldViewer({ articleTitle, levels }: FoldViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const current = levels[activeIndex];
  const currentSliderLabel = formatSliderLabel(current.targetWords);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyCurrentText() {
    try {
      await navigator.clipboard.writeText(current.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      setCopiedText(false);
    }
  }

  return (
    <main className="relative mx-auto flex h-screen w-full max-w-4xl flex-col overflow-hidden px-6 py-8 md:px-10">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-slate-900 transition hover:text-slate-600"
        >
          Fold
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyCurrentText}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            {copiedText ? "Copied" : "Copy Text"}
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      </header>

      {/* Article title */}
      {articleTitle && (
        <h2 className="mt-5 text-lg font-semibold leading-snug text-slate-800">
          {articleTitle}
        </h2>
      )}

      {/* Content area with slider */}
      <section className="relative mt-6 flex min-h-0 flex-1 gap-6">
        {/* Article card */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
            <p className="text-xs font-medium text-slate-400">
              {currentSliderLabel} {current.targetWords !== "full" && "words"}
            </p>
            <p className="text-xs tabular-nums text-slate-400">
              {current.wordCount} words
            </p>
          </div>
          <article className="markdown-output min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[15px] leading-7 text-slate-700">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {current.text}
            </ReactMarkdown>
          </article>
        </div>

        {/* Desktop vertical slider */}
        <aside className="hidden flex-col items-center justify-center md:flex">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-5 shadow-sm">
            <input
              className="vertical-slider"
              type="range"
              min={0}
              max={levels.length - 1}
              step={1}
              value={activeIndex}
              onChange={(event) => setActiveIndex(Number(event.target.value))}
              aria-label="Compression zoom slider"
            />
            <p className="text-center text-[11px] font-medium leading-tight text-slate-400">
              {currentSliderLabel}
            </p>
          </div>
        </aside>
      </section>

      {/* Mobile horizontal slider */}
      <aside className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm md:hidden">
        <input
          className="mobile-slider"
          type="range"
          min={0}
          max={levels.length - 1}
          step={1}
          value={activeIndex}
          onChange={(event) => setActiveIndex(Number(event.target.value))}
          aria-label="Compression zoom slider"
        />
        <p className="mt-2 text-center text-[11px] font-medium leading-tight text-slate-400">
          {currentSliderLabel}
        </p>
      </aside>
    </main>
  );
}

function formatSliderLabel(target: CompressionLevel["targetWords"]): string {
  if (target === "full") {
    return "Full";
  }
  if (target >= 1000) {
    const short = target % 1000 === 0 ? `${target / 1000}` : (target / 1000).toFixed(1);
    return `${short}k`;
  }
  return `${target}`;
}
