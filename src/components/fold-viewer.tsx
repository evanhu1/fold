"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Moon, Share2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ArticleTree } from "@/lib/types";

type FoldViewerProps = {
  articleUrl?: string | null;
  articleTitle?: string | null;
  articleTree: ArticleTree;
};

type SectionStage = 0 | 1 | 2;

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${className ?? ""}`}
    >
      <path
        fillRule="evenodd"
        d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function FoldViewer({
  articleUrl,
  articleTitle,
  articleTree,
}: FoldViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [sectionStages, setSectionStages] = useState<Record<string, SectionStage>>(
    {},
  );
  const { resolvedTheme, setTheme } = useTheme();

  function toggleRoot() {
    setIsRootOpen((current) => {
      if (current) {
        setSectionStages({});
      }
      return !current;
    });
  }

  function toggleClaim(sectionId: string) {
    setSectionStages((current) => {
      const stage = current[sectionId] ?? 0;
      return { ...current, [sectionId]: stage === 0 ? 1 : 0 };
    });
  }

  function toggleSummary(sectionId: string) {
    setSectionStages((current) => {
      const stage = current[sectionId] ?? 1;
      return { ...current, [sectionId]: stage === 2 ? 1 : 2 };
    });
  }

  async function copyShareLink() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: articleTitle ?? "Fold" });
      } catch {
        // user dismissed, do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-5 md:px-8 md:py-6">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            href="/"
            className="shrink-0 font-serif text-xl font-bold tracking-tight text-slate-900 transition hover:text-slate-600 dark:text-slate-100 dark:hover:text-slate-400"
          >
            Fold
          </Link>
          {articleTitle && (
            <span className="shrink-0 text-sm text-slate-300 dark:text-slate-600">/</span>
          )}
          {articleTitle && articleUrl ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-xs text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {articleTitle}
            </a>
          ) : articleTitle ? (
            <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
              {articleTitle}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="cursor-pointer text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            aria-label={copied ? "Copied!" : "Share"}
            className="cursor-pointer text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <Share2 className={`h-4 w-4 transition-colors ${copied ? "text-slate-700 dark:text-slate-300" : ""}`} />
          </button>
        </div>
      </header>

      <article className="mt-0">
        {/* Root claim */}
        <button
          type="button"
          onClick={toggleRoot}
          className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-start justify-between gap-4 rounded-xl px-2 py-4 my-2 text-left transition-colors hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-800"
        >
          <p className="select-text font-serif font-normal text-[1.1rem] leading-relaxed text-slate-900 transition group-hover:text-slate-700 dark:text-slate-100 dark:group-hover:text-slate-300">
            {articleTree.rootClaim}
          </p>
          <ChevronDown
            className={
              isRootOpen
                ? "mt-1.5 rotate-180 text-slate-500 dark:text-slate-400"
                : "mt-1.5 text-slate-400 dark:text-slate-600"
            }
          />
        </button>

        {/* Sections */}
        {isRootOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800">
            {articleTree.sections.map((section, index) => {
              const stage = sectionStages[section.id] ?? 0;

              return (
                <div
                  key={section.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                >
                  {/* Claim row */}
                  <button
                    type="button"
                    onClick={() => toggleClaim(section.id)}
                    className="group flex w-full cursor-pointer items-start gap-2 rounded-xl py-4 text-left transition-colors hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                  >
                    <span className="w-4 shrink-0 pt-[3px] text-right text-[11px] tabular-nums text-slate-400 transition group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-400">
                      {index + 1}
                    </span>
                    <p className="select-text flex-1 text-sm leading-6 text-slate-800 transition group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-100">
                      {section.claim}
                    </p>
                    <ChevronDown
                      className={
                        stage >= 1
                          ? "mt-1 rotate-180 text-slate-400 dark:text-slate-500"
                          : "mt-1 text-slate-400 dark:text-slate-600"
                      }
                    />
                  </button>

                  {/* Summary + source */}
                  {stage >= 1 && (
                    <div className="ml-4 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => toggleSummary(section.id)}
                        className="group/sum flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl pb-4 text-left transition-colors hover:bg-slate-100 active:bg-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-800"
                      >
                        <p className="select-text text-sm leading-6 text-slate-600 transition group-hover/sum:text-slate-800 dark:text-slate-400 dark:group-hover/sum:text-slate-200">
                          {section.summary}
                        </p>
                        <ChevronDown
                          className={
                            stage === 2
                              ? "mt-1 shrink-0 rotate-180 text-slate-400 dark:text-slate-500"
                              : "mt-1 shrink-0 text-slate-400 dark:text-slate-600"
                          }
                        />
                      </button>

                      {stage === 2 && (
                        <div className="ml-5 border-l-2 border-slate-200 pl-4 pb-5 dark:border-slate-700">
                          <div className="markdown-output text-sm leading-6 text-slate-600 dark:text-slate-400">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                              {section.sourceMarkdown}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </article>
    </main>
  );
}
