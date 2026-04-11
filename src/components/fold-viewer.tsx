"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { ArticleTree } from "@/lib/types";

type FoldViewerProps = {
  articleUrl?: string | null;
  articleTitle?: string | null;
  articleTree: ArticleTree;
};

type SectionStage = 0 | 1 | 2;

export default function FoldViewer({
  articleUrl,
  articleTitle,
  articleTree,
}: FoldViewerProps) {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [sectionStages, setSectionStages] = useState<Record<string, SectionStage>>(
    {},
  );

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

      return {
        ...current,
        [sectionId]: stage === 0 ? 1 : 0,
      };
    });
  }

  function toggleSummary(sectionId: string) {
    setSectionStages((current) => {
      const stage = current[sectionId] ?? 1;

      return {
        ...current,
        [sectionId]: stage === 2 ? 1 : 2,
      };
    });
  }

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
      await navigator.clipboard.writeText(
        buildVisibleTreeCopy(articleTitle, articleTree, isRootOpen, sectionStages),
      );
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      setCopiedText(false);
    }
  }

  return (
    <main className="fixed inset-0 mx-auto flex h-dvh w-full max-w-4xl flex-col overflow-hidden box-border px-3 py-3 transition-opacity sm:px-4 md:px-5 md:py-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-col md:flex-row md:items-baseline md:gap-2">
          <Link
            href="/"
            className="shrink-0 font-serif text-3xl font-bold tracking-tight text-slate-900 transition hover:text-slate-600 md:text-[2rem]"
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

      <section className="relative mt-3 flex min-h-0 flex-1 gap-3 md:mt-4 md:gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
          <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-4 py-2.5 md:px-5">
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
              {articleTitle || "Fold"}
            </p>
            <p className="shrink-0 text-xs tabular-nums text-slate-400">
              {articleTree.sections.length} sections
            </p>
          </div>

          <article className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[15px] leading-7 text-slate-700 md:px-5">
            <div className="space-y-3">
              <button
                type="button"
                onClick={toggleRoot}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-medium leading-7 text-slate-900">
                    {articleTree.rootClaim}
                  </p>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {isRootOpen ? "Hide" : "Open"}
                  </span>
                </div>
              </button>

              {isRootOpen && (
                <div className="space-y-3">
                  {articleTree.sections.map((section, index) => {
                    const stage = sectionStages[section.id] ?? 0;

                    return (
                      <div key={section.id} className="space-y-2 pl-4">
                        <button
                          type="button"
                          onClick={() => toggleClaim(section.id)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                                {index + 1}
                              </span>
                              <p className="text-sm leading-6 text-slate-800">
                                {section.claim}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                              {stage === 0 ? "Open" : "Close"}
                            </span>
                          </div>
                        </button>

                        {stage >= 1 && (
                          <div className="space-y-2 pl-4">
                            <button
                              type="button"
                              onClick={() => toggleSummary(section.id)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm leading-6 text-slate-700">
                                  {section.summary}
                                </p>
                                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                  {stage === 2 ? "Hide" : "Text"}
                                </span>
                              </div>
                            </button>

                            {stage === 2 && (
                              <div className="markdown-output rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                  {section.sourceMarkdown}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function buildVisibleTreeCopy(
  title: string | null | undefined,
  articleTree: ArticleTree,
  isRootOpen: boolean,
  sectionStages: Record<string, SectionStage>,
): string {
  const lines = [title || "Fold", "", articleTree.rootClaim];

  if (!isRootOpen) {
    return lines.join("\n");
  }

  for (const [index, section] of articleTree.sections.entries()) {
    const stage = sectionStages[section.id] ?? 0;

    lines.push("", `${index + 1}. ${section.claim}`);

    if (stage >= 1) {
      lines.push(section.summary);
    }

    if (stage === 2) {
      lines.push("", section.sourceMarkdown);
    }
  }

  return lines.join("\n");
}
