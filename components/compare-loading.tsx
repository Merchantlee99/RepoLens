"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

// Skeleton that mirrors the eventual workspace frame so the result doesn't
// reflow when data lands. Width + section stack must match compare-workspace.
export function CompareLoading({
  aLabel,
  bLabel,
}: {
  aLabel: string;
  bLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[var(--fg-dim)]">
              <Link href="/" className="hover:underline">
                RepoLens
              </Link>
              <span>/</span>
              <span className="text-[var(--fg-muted)]">compare</span>
            </div>
            <h1 className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
              <span className="inline-flex items-center gap-1.5">
                <SideBadge label="A" />
                <span className="truncate opacity-90">{aLabel}</span>
              </span>
              <span aria-hidden className="text-[var(--fg-dim)]">↔</span>
              <span className="inline-flex items-center gap-1.5">
                <SideBadge label="B" />
                <span className="truncate opacity-90">{bLabel}</span>
              </span>
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--fg-dim)]">
              분석 중…
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] space-y-4 px-4 py-6 sm:px-6">
        {/* Summary strip (two Summary Cards) */}
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        {/* "한눈에 보기" 3줄 Insights */}
        <SkeletonSection rows={3} />
        {/* 스택 겹침 (3 columns) */}
        <SkeletonStackRow />
        {/* 구조 비교 */}
        <SkeletonSection rows={4} />
        {/* 환경 호환성 */}
        <SkeletonSection rows={3} />
        {/* 드릴다운 */}
        <SkeletonDrill />
      </main>
    </div>
  );
}

function SideBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]" />
        <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]" />
        <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]" />
      </div>
    </div>
  );
}

function SkeletonSection({ rows }: { rows: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="h-3.5 w-24 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-[var(--surface-strong)]/60" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-7 animate-pulse rounded bg-[var(--surface-strong)]/50"
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonStackRow() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="h-3.5 w-20 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-2 h-2.5 w-3/5 animate-pulse rounded bg-[var(--surface-strong)]/60" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/30 p-3"
          >
            <div className="h-3 w-10 animate-pulse rounded bg-[var(--surface-strong)]" />
            <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface-strong)]/60" />
            <div className="mt-2 flex gap-1">
              <div className="h-5 w-16 animate-pulse rounded bg-[var(--surface-strong)]/40" />
              <div className="h-5 w-12 animate-pulse rounded bg-[var(--surface-strong)]/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonDrill() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="h-3.5 w-28 animate-pulse rounded bg-[var(--surface-strong)]" />
      <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-[var(--surface-strong)]/60" />
      <div className="mt-3 flex gap-2">
        <div className="h-7 w-32 animate-pulse rounded-md bg-[var(--surface-strong)]/50" />
        <div className="h-7 w-32 animate-pulse rounded-md bg-[var(--surface-strong)]/50" />
      </div>
    </div>
  );
}
