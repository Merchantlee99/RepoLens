"use client";

import { StackBadge } from "@/components/stack-badge";
import type {
  ResultIdentityBarHighlight,
  ResultIdentityBarView,
} from "@/components/result-view-model";

// Identity Bar — Result 화면의 "이 레포가 뭐냐"가 여기서 끝난다.
//
// 위계(backend 계약 기준 고정):
//   1) caption      — repo · projectKind · trust (최소 메타)
//   2) plainTitle   — 헤드라인 (title)
//   3) subtitle     — backend one-liner 그대로. 없으면 stackNarrative fallback
//   4) points       — 핵심 포인트 최대 2개
//   5) badges       — highlights를 badge + 이름만 (role/path는 tooltip)
//   6) trust.note   — 제약 조건이 있을 때만
//
// 원칙:
//   - subtitle과 stackNarrative는 상호 배타 — 동시에 보여주지 않음.
//   - points는 최대 2개. README 복붙처럼 보이지 않도록.
//   - highlights chip은 name + badge 한 줄. role은 tooltip, path는 inspector.
export function ResultIdentityBar({
  view,
  repoOwner,
  repoName,
  onStartFileClick,
  onStatusClick,
  onHighlightClick,
}: {
  view: ResultIdentityBarView;
  repoOwner: string;
  repoName: string;
  onStartFileClick?: () => void;
  onStatusClick?: () => void;
  onHighlightClick?: (examplePath: string) => void;
}) {
  const secondaryLine = view.subtitle ?? view.stackNarrativeFallback;
  const hasHighlights = view.highlights.length > 0;
  const hasCoreFallback = !hasHighlights && view.coreStackChips.length > 0;

  return (
    <section className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* 1) caption */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--fg-dim)]">
          <span className="truncate font-mono" title={`${repoOwner}/${repoName}`}>
            {repoOwner}/{repoName}
          </span>
          {view.projectKind ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate text-[var(--fg-muted)]" title={view.projectKind}>
                {view.projectKind}
              </span>
            </>
          ) : null}
          {view.scopeLabel ? (
            <>
              <span aria-hidden>·</span>
              <span
                className="truncate text-[var(--fg-dim)]"
                title={view.scopeLabel}
              >
                {view.scopeLabel}
              </span>
            </>
          ) : null}
          <ConsumptionModeBadge mode={view.consumptionMode} />
          <TrustChip trust={view.trust} onClick={onStatusClick} />
        </div>

        {/* 2) plainTitle + start file pill */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            <p
              className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[var(--fg)]"
              title={view.plainTitle}
            >
              {view.plainTitle}
            </p>
            {/* 3) subtitle (or stackNarrative fallback) */}
            {secondaryLine ? (
              <p
                className="mt-0.5 text-[12.5px] leading-5 text-[var(--fg-muted)]"
                title={secondaryLine}
              >
                {secondaryLine}
              </p>
            ) : null}
          </div>
          {view.startFile ? (
            <StartFileChip
              path={view.startFile.path}
              display={view.startFile.display}
              reason={view.startFile.reason}
              onClick={onStartFileClick}
            />
          ) : null}
        </div>

        {/* 4) points (max 2) — inline bullet list */}
        {view.points.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {view.points.map((point) => (
              <li
                key={point}
                className="flex gap-2 text-[12px] leading-5 text-[var(--fg)]"
              >
                <span
                  aria-hidden
                  className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]/70"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 5) highlights — badge + name only, role/path in tooltip */}
        {hasHighlights ? (
          <ul className="flex flex-wrap gap-1.5">
            {view.highlights.map((h) => (
              <HighlightChip key={h.name} highlight={h} onClick={onHighlightClick} />
            ))}
          </ul>
        ) : hasCoreFallback ? (
          <ul className="flex flex-wrap gap-1.5">
            {view.coreStackChips.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-1 text-[11.5px] text-[var(--fg)]"
              >
                <StackBadge name={name} />
                <span className="truncate">{name}</span>
              </li>
            ))}
            {view.coreStackOverflow > 0 ? (
              <li className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] px-1.5 py-1 text-[11px] text-[var(--fg-dim)]">
                +{view.coreStackOverflow}
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* 6) trust note (optional, small) */}
        {view.trust.note ? (
          <p className="text-[11px] leading-5 text-[var(--fg-dim)]" title={view.trust.note}>
            {view.trust.note}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// consumptionMode 배지 — "라이브러리" / "앱" / "혼합" 한눈에 구분.
// unknown/null일 때는 렌더하지 않아 노이즈를 줄인다.
function ConsumptionModeBadge({
  mode,
}: {
  mode: ResultIdentityBarView["consumptionMode"];
}) {
  if (!mode || mode === "unknown") return null;
  const config =
    mode === "import-as-library"
      ? { label: "라이브러리", tooltip: "설치해서 쓰는 타입 — import/require로 불러다 사용합니다." }
      : mode === "run-as-app"
        ? { label: "앱", tooltip: "직접 실행해서 쓰는 타입 — clone 후 run/start로 띄웁니다." }
        : { label: "혼합", tooltip: "라이브러리 + 앱이 섞여 있어요 — 설치해 쓸 수도, 실행해 쓸 수도 있습니다." };
  return (
    <>
      <span aria-hidden>·</span>
      <span
        title={config.tooltip}
        className="inline-flex shrink-0 items-center rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
      >
        {config.label}
      </span>
    </>
  );
}

function HighlightChip({
  highlight,
  onClick,
}: {
  highlight: ResultIdentityBarHighlight;
  onClick?: (examplePath: string) => void;
}) {
  const tooltip = highlight.examplePath
    ? `${highlight.name} — ${highlight.role}\n${highlight.examplePath}`
    : `${highlight.name} — ${highlight.role}`;
  const clickable = Boolean(onClick && highlight.examplePath);
  const inner = (
    <>
      <StackBadge name={highlight.name} />
      <span className="truncate text-[11.5px] font-medium text-[var(--fg)]">
        {highlight.name}
      </span>
    </>
  );
  if (clickable) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onClick!(highlight.examplePath as string)}
          title={tooltip}
          className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-1 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
        >
          {inner}
        </button>
      </li>
    );
  }
  return (
    <li
      title={tooltip}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-1"
    >
      {inner}
    </li>
  );
}

function TrustChip({
  trust,
  onClick,
}: {
  trust: ResultIdentityBarView["trust"];
  onClick?: () => void;
}) {
  const coverageSuffix = trust.coverageLabel ? ` · ${trust.coverageLabel}` : "";
  const warn = trust.coverageLevel !== "ok";
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium";
  const tone = warn
    ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]"
    : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";
  // 초보자 친화 tooltip: 그냥 "부분 분석"만 보여주지 말고 뭐가 부족한지 설명.
  // trust.note가 있으면 그대로, 없으면 coverage level에 맞춘 기본 설명.
  const defaultTooltip =
    trust.coverageLevel === "partial"
      ? "큰 레포라 주요 코드만 표본으로 보고 정리했어요. 전체 파일이 다 반영된 건 아닙니다."
      : trust.coverageLevel === "limited"
        ? "분석할 수 있는 신호가 적어 일부만 요약했어요. 참고용으로 봐주세요."
        : "코드와 README 신호를 합쳐 정리한 결과예요.";
  const tooltip = trust.note?.trim() || defaultTooltip;
  const content = (
    <span className={`${base} ${tone}`} title={tooltip}>
      <Dot warn={warn} />
      {trust.label}
      {coverageSuffix}
    </span>
  );
  if (!onClick) return content;
  return (
    <button
      type="button"
      onClick={onClick}
      title="분석 상태 자세히 보기"
      className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)]"
    >
      {content}
    </button>
  );
}

function Dot({ warn }: { warn: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        warn ? "bg-[var(--accent-warm)]" : "bg-[var(--accent)]"
      }`}
    />
  );
}

function StartFileChip({
  path,
  display,
  reason,
  onClick,
}: {
  path: string;
  display: string;
  reason: string | null;
  onClick?: () => void;
}) {
  const title = reason ? `${path}\n\n${reason}` : path;
  const inner = (
    <>
      <span className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        시작
      </span>
      <span className="truncate font-mono text-[11.5px] text-[var(--fg)]">{display}</span>
    </>
  );

  if (!onClick) {
    return (
      <div
        title={title}
        className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1.5"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
    >
      {inner}
      <span aria-hidden className="text-[10.5px] text-[var(--fg-dim)]">→</span>
    </button>
  );
}
