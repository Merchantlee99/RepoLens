"use client";

import type { CompatResult, UserEnv } from "@/components/user-env";
import { userEnvIsEmpty } from "@/components/user-env";

// 실행 환경 탭 상단 대형 판정 섹션. "내 환경에서 돌릴 수 있나?"에 즉답.
// 4 상태:
//   1. envAnalyzable=false       → "이 레포는 환경 판정 불가" 중립
//   2. userEnv 비어 있음          → CTA "내 환경 설정하고 바로 판정받기"
//   3. 설정됨 + blocker 0/warning 0 → 초록 "바로 돌릴 수 있어요"
//   4. 설정됨 + warning만         → accent-warm "조정이 필요해요"
//   5. 설정됨 + blocker ≥ 1       → strong warm "지금 환경에선 바로 못 돌려요"
export function EnvCompatHero({
  userEnv,
  compat,
  envAnalyzable,
  onOpenSettings,
}: {
  userEnv: UserEnv;
  compat: CompatResult | null;
  envAnalyzable: boolean;
  onOpenSettings: () => void;
}) {
  if (!envAnalyzable) {
    return (
      <section className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-4">
        <p className="text-[12px] text-[var(--fg-muted)]">
          이 레포에서는 환경 판정에 쓸 신호가 부족해 내 환경과 비교할 수 없어요.
        </p>
      </section>
    );
  }

  const empty = userEnvIsEmpty(userEnv);

  if (empty || !compat) {
    return (
      <section className="rounded-lg border border-dashed border-[var(--accent)]/40 bg-[var(--surface)] px-4 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--fg-dim)]">
              내 환경 호환 판정
            </p>
            <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
              내 환경에서 이 레포 바로 돌릴 수 있을까요?
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">
              런타임 · RAM · GPU · Docker · 클라우드 계정 · 예산을 한 번 설정하면,
              레포가 요구하는 것과 맞는지 바로 판정해드려요.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--accent-fg)] hover:opacity-90"
          >
            내 환경 설정하기
            <span aria-hidden>→</span>
          </button>
        </div>
      </section>
    );
  }

  const { summary, headline, warnings } = compat;
  const blockers = summary.blockers;
  const hasBlocker = blockers > 0;
  const hasWarningOnly = !hasBlocker && warnings > 0;
  const allClear = !hasBlocker && !hasWarningOnly && summary.mismatched === 0;

  const tone = hasBlocker
    ? "blocker"
    : hasWarningOnly
      ? "warning"
      : allClear
        ? "match"
        : "neutral";

  const toneClass =
    tone === "blocker"
      ? "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/15"
      : tone === "warning"
        ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/8"
        : tone === "match"
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
          : "border-[var(--border)] bg-[var(--surface)]";

  const title = hasBlocker
    ? "지금 환경에선 바로 못 돌려요"
    : hasWarningOnly
      ? "조정이 필요해요"
      : allClear
        ? "내 환경에서 바로 돌릴 수 있어요"
        : "판정 결과를 확인하세요";

  const subline = headline ?? subtitleFallback(summary, warnings);

  // blocker/warning 항목만 골라 상단 강조 리스트 (최대 3개)
  const highlightItems = compat.items
    .filter(
      (i) =>
        i.status === "mismatch" &&
        (i.severity === "blocker" || i.severity === "warning")
    )
    .slice(0, 3);

  return (
    <section className={`rounded-lg border px-4 py-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--fg-dim)]">
            내 환경 호환 판정
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              aria-hidden
              className="text-[16px]"
              role="img"
              aria-label={
                tone === "blocker"
                  ? "차단"
                  : tone === "warning"
                    ? "경고"
                    : tone === "match"
                      ? "가능"
                      : "정보"
              }
            >
              {tone === "blocker"
                ? "🚫"
                : tone === "warning"
                  ? "⚠"
                  : tone === "match"
                    ? "✓"
                    : "·"}
            </span>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
              {title}
            </h3>
          </div>
          {subline ? (
            <p className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">{subline}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
        >
          설정 변경
        </button>
      </div>

      {/* blocker/warning 최대 3개 inline 강조 */}
      {highlightItems.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-2.5">
          {highlightItems.map((item) => (
            <li
              key={item.key}
              className="flex items-start gap-2 text-[12px] leading-5"
            >
              <span
                aria-hidden
                className={`mt-[2px] shrink-0 text-[12px] ${
                  item.severity === "blocker"
                    ? "text-[var(--accent-warm)]"
                    : "text-[var(--accent-warm)]/80"
                }`}
              >
                {item.severity === "blocker" ? "🚫" : "⚠"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-[var(--fg)]">{item.label}</span>
                {item.detail ? (
                  <>
                    <span className="mx-1.5 text-[var(--fg-dim)]">·</span>
                    <span className="text-[var(--fg-muted)]">{item.detail}</span>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] tabular-nums text-[var(--fg-dim)]">
        {blockers > 0 ? <span>🚫 차단 {blockers}</span> : null}
        {warnings > 0 ? <span>⚠ 경고 {warnings}</span> : null}
        <span>✓ 맞음 {summary.matched}</span>
        {summary.missing > 0 ? <span>? 미지정 {summary.missing}</span> : null}
      </div>
    </section>
  );
}

function subtitleFallback(
  summary: CompatResult["summary"],
  warnings: number
): string {
  if (summary.blockers > 0) {
    return `${summary.blockers}개 항목이 바로 실행을 막습니다.`;
  }
  if (warnings > 0) {
    return `${warnings}개 항목이 조정 필요 — 돌아가긴 하지만 부족하거나 비용이 듭니다.`;
  }
  if (summary.matched > 0 && summary.mismatched === 0) {
    return `${summary.matched}개 요구사항이 모두 내 환경과 맞아요.`;
  }
  return "판정 결과를 살펴보세요.";
}
