"use client";

import type { EnvMatchReport } from "@/lib/analysis/env-match";
import type { CompatResult } from "@/components/user-env";

// 내 환경 기준 호환성 체크리스트. Backend `buildEnvMatchReport` 결과를 그대로
// 렌더한다 — severity 3단계(blocker/warning/info)로 시각 분리, blocker 있으면
// 카드 전체 톤을 warm으로 끌어올려 "지금 바로 못 돌린다"는 신호를 강하게.
export function EnvMatchBlock({
  compat,
  dense = false,
}: {
  compat: CompatResult;
  dense?: boolean;
}) {
  const { summary, headline, items, warnings } = compat;
  const hasBlocker = summary.blockers > 0;

  const fallback =
    summary.blockers === 0 &&
    summary.mismatched === 0 &&
    summary.missing === 0
      ? "내 환경에서 바로 돌릴 수 있어요."
      : summary.blockers > 0
        ? `${summary.blockers}개 blocker — 지금 환경에선 바로 안 돌아요.`
        : summary.mismatched > 0
          ? `${summary.mismatched}개 항목이 내 환경과 달라요.`
          : `${summary.missing}개 항목이 내 환경에 없음.`;
  const line = headline ?? fallback;

  return (
    <div
      className={`rounded-md border ${
        hasBlocker
          ? "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/10"
          : "border-[var(--border)] bg-[var(--surface-strong)]/30"
      } ${dense ? "px-2.5 py-1.5" : "px-2.5 py-2"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
          내 환경 호환
        </p>
        <span className="text-[10.5px] tabular-nums text-[var(--fg-dim)]">
          {summary.blockers > 0 ? `🚫 ${summary.blockers} · ` : ""}
          {warnings > 0 ? `⚠ ${warnings} · ` : ""}
          맞음 {summary.matched} · 빠짐 {summary.missing}
        </span>
      </div>
      {dense ? null : (
        <p
          className={`mt-0.5 text-[11.5px] leading-5 ${
            hasBlocker ? "font-medium text-[var(--fg)]" : "text-[var(--fg-muted)]"
          }`}
        >
          {line}
        </p>
      )}
      <ul className={`flex flex-wrap gap-1 ${dense ? "mt-1" : "mt-1.5"}`}>
        {items.map((item) => (
          <li key={item.key}>{renderChip(item)}</li>
        ))}
      </ul>
    </div>
  );
}

type ReportItem = EnvMatchReport["items"][number];

function renderChip(item: ReportItem) {
  const srStatus = chipSrText(item);
  return (
    <span
      title={item.detail ?? undefined}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${chipClass(item)}`}
    >
      <span aria-hidden>{chipIcon(item)}</span>
      <span className="sr-only">{srStatus}:</span>
      <span className="truncate">{item.label}</span>
    </span>
  );
}

function chipSrText(item: ReportItem): string {
  if (item.status === "match") return "맞음";
  if (item.status === "mismatch") {
    if (item.severity === "blocker") return "차단";
    if (item.severity === "warning") return "경고";
    return "다름";
  }
  return "미지정";
}

function chipIcon(item: ReportItem): string {
  if (item.status === "match") return "✓";
  if (item.status === "mismatch") {
    if (item.severity === "blocker") return "🚫";
    if (item.severity === "warning") return "⚠";
    return "≠";
  }
  // missing → dashed ? (중립 처리)
  return "?";
}

function chipClass(item: ReportItem): string {
  if (item.status === "match") {
    return "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]";
  }
  if (item.status === "mismatch") {
    if (item.severity === "blocker") {
      return "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/20 font-medium text-[var(--fg)]";
    }
    if (item.severity === "warning") {
      return "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]";
    }
    return "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]";
  }
  // missing / unknown → dashed gray (중립)
  return "border-dashed border-[var(--border)] text-[var(--fg-dim)]";
}
