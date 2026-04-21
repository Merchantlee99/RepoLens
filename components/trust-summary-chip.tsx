"use client";

import type { TrustSummary } from "@/components/trust-summary";

// 신뢰도 가드레일 UI. partial/limited일 때만 렌더된다.
// 북극성 — "가벼운 가드레일, 무거운 경고 패널 금지".
// Identity Bar caption 오른쪽에 들어가는 compact chip 버전과, 탭/섹션 상단
// 좌측에 얇게 붙는 banner 버전을 같이 제공한다.

export function TrustSummaryChip({
  summary,
  onClick,
}: {
  summary: TrustSummary;
  onClick?: () => void;
}) {
  if (!summary.shouldRender) return null;

  const tone = summary.tone;
  const warn = tone !== "ok";
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium";
  const toneClass = warn
    ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]"
    : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";

  // 툴팁 텍스트 조립 — chip hover 시 이유 요약이 보이게
  const tooltipParts: string[] = [];
  if (summary.headline) tooltipParts.push(summary.headline);
  summary.reasons.forEach((r) => {
    tooltipParts.push(`· ${r.label}`);
  });
  const tooltip = tooltipParts.join("\n");

  const body = (
    <span className={`${base} ${toneClass}`} title={tooltip}>
      <Dot warn={warn} />
      {summary.chipLabel}
    </span>
  );

  if (!onClick) return body;
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      aria-label={summary.chipLabel ? `${summary.chipLabel} 이유 보기` : undefined}
    >
      {body}
    </button>
  );
}

// 탭/섹션 상단에서 "얼마나 믿어도 돼요?"를 한 줄로 알려주는 slim strip.
//
// 디자인 결정:
//  - 이전엔 headline + 근거/제한/빠진것 3축 dl로 렌더했는데, Identity Bar
//    바로 아래 세로 공간을 크게 먹어 Canvas/Learning 본문이 밀렸다.
//  - 상세(근거/제한/빠진것)는 "자세히" 버튼 → ANALYSIS_STATUS inspector에
//    이미 있으므로, 여기서는 한 줄 요약만 남긴다.
//  - approximate=true이면 작게 "근사" 태그를 붙여 표현을 조심스럽게.
//
// 구성(좌 → 우):
//   [dot] chipLabel · headline(truncate) · 근사? · 자세히
export function TrustSummaryBanner({
  summary,
  onDetails,
}: {
  summary: TrustSummary;
  /** "자세히" 클릭 시 상세 상태 inspector를 열 수 있게 하는 callback.
   * identity bar의 TrustChip과 같은 타깃을 열어 경로를 하나로 통일한다. */
  onDetails?: () => void;
}) {
  if (!summary.shouldRender) return null;
  const line = summary.headline || summary.detail || "대표 경로 기준 요약입니다.";
  return (
    <section className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-strong)]/40 px-2.5 py-1.5">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-warm)]/80"
      />
      {summary.chipLabel ? (
        <span className="shrink-0 text-[10.5px] font-medium text-[var(--fg-muted)]">
          {summary.chipLabel}
        </span>
      ) : null}
      <span className="h-3 w-px shrink-0 bg-[var(--border)]" aria-hidden />
      <p
        className="min-w-0 flex-1 truncate text-[11.5px] leading-5 text-[var(--fg)]"
        title={line}
      >
        {line}
      </p>
      {summary.approximate ? (
        <span
          title="대표 경로 기준 근사치입니다. 정확 수치가 아닌 요약으로 봐 주세요."
          className="shrink-0 text-[10.5px] text-[var(--fg-dim)]"
        >
          근사
        </span>
      ) : null}
      {onDetails ? (
        <button
          type="button"
          onClick={onDetails}
          className="shrink-0 rounded text-[10.5px] text-[var(--fg-dim)] underline decoration-dotted underline-offset-2 hover:text-[var(--fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        >
          자세히
        </button>
      ) : null}
    </section>
  );
}

function Dot({ warn }: { warn: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
        warn ? "bg-[var(--accent-warm)]" : "bg-[var(--accent)]"
      }`}
    />
  );
}
