"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import type { ArticleTree } from "@/lib/types";

const collapsibleContentClass =
  "overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up";

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [sectionStages, setSectionStages] = useState<Record<string, SectionStage>>(
    {},
  );

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // clipboard unavailable, do nothing
    }
  }

  function handleRootChange(open: boolean) {
    setIsRootOpen(open);
    if (!open) {
      setSectionStages({});
    }
  }

  function handleClaimChange(sectionId: string, open: boolean) {
    setSectionStages((current) => ({ ...current, [sectionId]: open ? 1 : 0 }));
  }

  function handleSummaryChange(sectionId: string, open: boolean) {
    setSectionStages((current) => ({ ...current, [sectionId]: open ? 2 : 1 }));
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-white px-5 py-5 md:px-8 md:pt-16 md:pb-6">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            href="/"
            className="shrink-0 font-display text-xl font-bold tracking-tight text-slate-900 transition hover:text-slate-600"
          >
            Fold
          </Link>
          {articleTitle && <span className="shrink-0 text-sm text-slate-300">/</span>}
          {articleTitle && articleUrl ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 items-center gap-1 text-sm text-slate-500 transition hover:text-slate-800"
            >
              <span className="min-w-0 truncate">{articleTitle}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
            </a>
          ) : articleTitle ? (
            <span className="min-w-0 truncate text-sm text-slate-500">{articleTitle}</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={copyShareLink}
            aria-label={copied ? "Copied!" : "Share"}
            className="cursor-pointer text-slate-400 transition hover:text-slate-700"
          >
            <Share2 className={`h-4 w-4 transition-colors ${copied ? "text-slate-700" : ""}`} />
          </button>
        </div>
      </header>

      <article className="mt-0">
        <Collapsible.Root open={isRootOpen} onOpenChange={handleRootChange}>
          {/* Root claim */}
          <div className="relative -mx-2 my-4 md:my-5">
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="group flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl p-2 pr-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-50"
              >
                <p className="select-text font-serif text-xl font-normal leading-8 text-slate-900 transition group-hover:text-slate-700">
                  {articleTree.rootClaim}
                </p>
                <ChevronDown
                  className={
                    isRootOpen
                      ? "mt-1.5 rotate-180 text-slate-500"
                      : "mt-1.5 text-slate-400"
                  }
                />
              </button>
            </Collapsible.Trigger>
            <button
              type="button"
              onClick={() => copyText("root", articleTree.rootClaim)}
              aria-label={copiedId === "root" ? "Copied!" : "Copy claim"}
              className="absolute bottom-2 right-3 cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              {copiedId === "root" ? (
                <Check className="h-3.5 w-3.5 text-slate-700" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {!isRootOpen && (
            <p className="-mt-3 mb-4 pr-3 text-right text-[11px] italic text-slate-400">
              ↑ Click to expand
            </p>
          )}

          <Collapsible.Content className={collapsibleContentClass}>
            <div>
              {articleTree.sections.map((section, index) => {
                const stage = sectionStages[section.id] ?? 0;

                return (
                  <Collapsible.Root
                    key={section.id}
                    open={stage >= 1}
                    onOpenChange={(open) => handleClaimChange(section.id, open)}
                  >
                    {/* Claim row */}
                    <div className="group/row relative">
                      <Collapsible.Trigger asChild>
                        <button
                          type="button"
                          className="group flex w-full cursor-pointer items-start gap-2 rounded-xl py-3 pr-1 md:py-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-50"
                        >
                          <span className="w-4 shrink-0 pt-[3px] text-right text-[11px] tabular-nums text-slate-400 transition group-hover:text-slate-600">
                            {index + 1}
                          </span>
                          <p className="select-text flex-1 text-base leading-7 text-slate-800 transition group-hover:text-slate-900">
                            {section.claim}
                          </p>
                          <ChevronDown
                            className={
                              stage >= 1
                                ? "mt-1 rotate-180 text-slate-400"
                                : "mt-1 text-slate-400"
                            }
                          />
                        </button>
                      </Collapsible.Trigger>
                      <button
                        type="button"
                        onClick={() => copyText(section.id, section.claim)}
                        aria-label={copiedId === section.id ? "Copied!" : "Copy claim"}
                        className="absolute bottom-1 right-1 cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 md:opacity-0 md:group-hover/row:opacity-100 md:focus:opacity-100"
                      >
                        {copiedId === section.id ? (
                          <Check className="h-3.5 w-3.5 text-slate-700" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Summary + source */}
                    <Collapsible.Content className={collapsibleContentClass}>
                      <Collapsible.Root
                        open={stage === 2}
                        onOpenChange={(open) => handleSummaryChange(section.id, open)}
                      >
                        <div className="ml-4 border-l-2 border-slate-200 pl-3">
                          <Collapsible.Trigger asChild>
                            <button
                              type="button"
                              className="group/sum flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl pb-3 pr-1 md:pb-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-50"
                            >
                              <p className="select-text text-base leading-7 text-slate-600 transition group-hover/sum:text-slate-800">
                                {section.summary}
                              </p>
                              <ChevronDown
                                className={
                                  stage === 2
                                    ? "mt-1 shrink-0 rotate-180 text-slate-400"
                                    : "mt-1 shrink-0 text-slate-400"
                                }
                              />
                            </button>
                          </Collapsible.Trigger>

                          <Collapsible.Content className={collapsibleContentClass}>
                            <div className="ml-5 border-l-2 border-slate-200 pl-4 pb-4 md:pb-5">
                              <div className="markdown-output text-base leading-7 text-slate-700">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                  {section.sourceMarkdown}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </Collapsible.Content>
                        </div>
                      </Collapsible.Root>
                    </Collapsible.Content>
                  </Collapsible.Root>
                );
              })}
              <div className="mt-6 flex justify-center pb-2">
                <Link
                  href="/"
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                >
                  Fold something else
                </Link>
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </article>
    </main>
  );
}
