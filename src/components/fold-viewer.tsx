"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { CompressionLevel } from "@/lib/types";

const DEMO_STORAGE_KEY = "fold-demo-seen";

type FoldViewerProps = {
  articleUrl?: string | null;
  articleTitle?: string | null;
  levels: CompressionLevel[];
};

export default function FoldViewer({ articleUrl, articleTitle, levels }: FoldViewerProps) {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [isDemoReady, setIsDemoReady] = useState(false);
  const searchParams = useSearchParams();
  const param = searchParams.get("level");
  const defaultIndex = levels.length > 1 ? levels.length - 1 : 0;
  const activeIndex = param
    ? levels.findIndex((level) => String(level.targetWords) === param)
    : defaultIndex;
  const baseIndex = activeIndex >= 0 ? activeIndex : defaultIndex;
  const safeActiveIndex = demoIndex !== null ? demoIndex : baseIndex;

  const setLevelInUrl = useCallback(
    (index: number) => {
      const url = new URL(window.location.href);
      const target = String(levels[index].targetWords);
      if (target === "full") {
        url.searchParams.delete("level");
      } else {
        url.searchParams.set("level", target);
      }
      window.history.replaceState(null, "", url.toString());
    },
    [levels],
  );

  // First-visit demo: animate to the deepest available zoom level and stop there.
  useEffect(() => {
    const targetIdx = levels.length - 1;
    if (targetIdx <= 0) {
      setIsDemoReady(true);
      return;
    }

    if (localStorage.getItem(DEMO_STORAGE_KEY)) {
      setIsDemoReady(true);
      return;
    }

    localStorage.setItem(DEMO_STORAGE_KEY, "1");
    setIsDemoReady(true);

    // Show overlay immediately, animate after delay
    setDemoIndex(0);

    const STEP_MS = 180;
    const PAUSE_MS = 800;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 1000; // delay before slider starts moving

    // Animate forward: 0 → targetIdx
    for (let i = 1; i <= targetIdx; i++) {
      timers.push(setTimeout(() => setDemoIndex(i), t));
      t += STEP_MS;
    }

    // Persist the deepest zoom level when the demo finishes.
    timers.push(setTimeout(() => setLevelInUrl(targetIdx), t + PAUSE_MS));
    timers.push(setTimeout(() => setDemoIndex(null), t + PAUSE_MS + 100));

    return () => timers.forEach(clearTimeout);
  }, [levels, setLevelInUrl]);

  const updateLevel = useCallback(
    (index: number) => {
      setDemoIndex(null); // cancel demo on user interaction
      setLevelInUrl(index);
    },
    [setLevelInUrl],
  );

  const current = levels[safeActiveIndex];
  const currentSliderLabel = formatSliderLabel(current.targetWords);

  async function copyShareLink() {
    try {
      const url = new URL(window.location.href);
      const target = String(current.targetWords);
      if (target === "full") {
        url.searchParams.delete("level");
      } else {
        url.searchParams.set("level", target);
      }
      await navigator.clipboard.writeText(url.toString());
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

  const isDemoing = demoIndex !== null;

  return (
    <main className={`relative mx-auto flex h-screen w-full max-w-4xl flex-col overflow-hidden px-6 py-8 transition-opacity md:px-10 ${isDemoReady ? "opacity-100" : "opacity-0"}`}>
      {/* Demo overlay */}
      {isDemoing && (
        <div className="fixed inset-0 z-40 bg-black/40 transition-opacity" />
      )}

      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex flex-col md:flex-row md:items-baseline md:gap-3">
          <Link
            href="/"
            className="shrink-0 font-serif text-4xl font-bold tracking-tight text-slate-900 transition hover:text-slate-600"
          >
            Fold
          </Link>
          <span className="hidden truncate text-sm text-slate-500 sm:block">
            Read hyper efficiently
          </span>
        </div>
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


      {/* Content area with slider */}
      <section className="relative mt-6 flex min-h-0 flex-1 gap-6">
        {/* Article card */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-6 py-3">
            {articleUrl && (
              <a
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-300 transition hover:text-slate-500"
                aria-label="Open original article"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            )}
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500">
              {articleTitle || `${currentSliderLabel}${current.targetWords !== "full" ? " words" : ""}`}
            </p>
            <p className="shrink-0 text-xs tabular-nums text-slate-400">
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
        <aside className={`hidden flex-col items-center justify-center md:flex ${isDemoing ? "relative z-50" : ""}`}>
          <div className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200 px-3 py-5 shadow-sm ${isDemoing ? "bg-white ring-2 ring-slate-900/10" : "bg-white/90"}`}>
            <div className="relative flex items-center justify-center">
              <SliderTicks
                count={levels.length}
                activeIndex={safeActiveIndex}
                orientation="vertical"
                className="pointer-events-none absolute inset-0"
              />
              <input
                className="vertical-slider relative z-10"
                type="range"
                min={0}
                max={levels.length - 1}
                step={1}
                value={safeActiveIndex}
                onChange={(event) => updateLevel(Number(event.target.value))}
                aria-label="Compression zoom slider"
              />
            </div>
            <p className="text-center text-[11px] font-medium leading-tight text-slate-400">
              {currentSliderLabel}
            </p>
          </div>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Zoom
          </p>
        </aside>
      </section>

      {/* Mobile horizontal slider */}
      <aside className={`mt-4 rounded-2xl border border-slate-200 p-3 shadow-sm md:hidden ${isDemoing ? "relative z-50 bg-white ring-2 ring-slate-900/10" : "bg-white/90"}`}>
        <input
          className="mobile-slider"
          type="range"
          min={0}
          max={levels.length - 1}
          step={1}
          value={safeActiveIndex}
          onChange={(event) => updateLevel(Number(event.target.value))}
          aria-label="Compression zoom slider"
        />
        <SliderTicks count={levels.length} activeIndex={safeActiveIndex} className="mt-2" />
        <p className="mt-2 text-center text-[11px] font-medium leading-tight text-slate-400">
          Zoom Scale: {currentSliderLabel}
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

function SliderTicks({
  count,
  activeIndex,
  className = "",
  orientation = "horizontal",
}: {
  count: number;
  activeIndex: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  const isVertical = orientation === "vertical";

  return (
    <div
      className={`${isVertical
        ? "flex h-full flex-col items-center justify-between py-2"
        : "flex w-full items-start justify-between px-1"
        } ${className}`.trim()}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        (() => {
          const visualIndex = isVertical ? count - 1 - index : index;

          return (
            <span
              key={visualIndex}
              className={`rounded-full ${isVertical ? "h-px w-5" : "h-2 w-px"
                } ${visualIndex === activeIndex ? "bg-slate-500" : "bg-slate-300"
                }`}
            />
          );
        })()
      ))}
    </div>
  );
}
