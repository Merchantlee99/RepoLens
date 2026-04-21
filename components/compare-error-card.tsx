"use client";

import Link from "next/link";

// Per-slot error card. Used both when the URL fails validation (owner URL,
// malformed) and when the analysis request itself fails. Keeps the action set
// consistent: retry the fetch, or drop into single-repo flow if the URL was
// valid enough to canonicalize.
export function CompareErrorCard({
  side,
  message,
  canonicalUrl,
  onRetry,
}: {
  side: "A" | "B";
  message: string;
  canonicalUrl: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--accent-warm)]/50 bg-[var(--surface)] p-4">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-sm bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
          {side}
        </span>
        <span className="text-[11px] text-[var(--fg-dim)]">레포 · 오류</span>
      </div>
      <p className="mt-2 break-words text-[12px] leading-5 text-[var(--fg)]">
        {message}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
        >
          재시도
        </button>
        {canonicalUrl ? (
          <Link
            href={`/result?repoUrl=${encodeURIComponent(canonicalUrl)}`}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            단일 분석으로 열기
          </Link>
        ) : (
          <Link
            href="/compare"
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            URL 다시 입력
          </Link>
        )}
      </div>
    </div>
  );
}
