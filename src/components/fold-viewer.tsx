"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { CompressionLevel } from "@/lib/types";

type FoldViewerProps = {
  levels: CompressionLevel[];
};

export default function FoldViewer({ levels }: FoldViewerProps) {
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
    <main className="relative mx-auto flex h-screen w-full max-w-6xl flex-col overflow-hidden px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fold</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyCurrentText}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
          >
            {copiedText ? "Text Copied" : "Copy Text"}
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
          >
            {copied ? "Copied" : "Copy Share Link"}
          </button>
          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-800"
          >
            New Fold
          </Link>
        </div>
      </header>

      <section className="relative mt-8 flex min-h-0 flex-1 flex-col md:pr-24">
        <div className="mx-auto flex min-h-[24rem] w-full max-w-3xl flex-1 flex-col rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm md:h-full md:min-h-0 md:p-8">
          <div className="mb-4 flex items-baseline justify-end gap-4">
            <p className="text-xs text-slate-500">{current.wordCount} words</p>
          </div>
          <article className="markdown-output min-h-0 flex-1 overflow-y-auto text-[15px] leading-7 text-slate-800">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {current.text}
            </ReactMarkdown>
          </article>
        </div>

        <aside className="pointer-events-auto mt-4 rounded-2xl border border-slate-300 bg-white/90 p-3 shadow-sm md:hidden">
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
          <p className="mt-2 text-center text-[11px] leading-tight text-slate-500">
            {currentSliderLabel}
          </p>
        </aside>

        <aside className="pointer-events-auto absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 rounded-2xl border border-slate-300 bg-white/90 px-3 py-4 shadow-sm md:flex">
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
          <p className="text-center text-[11px] leading-tight text-slate-500">
            {currentSliderLabel}
          </p>
        </aside>
      </section>
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
