"use client";

import Link from "next/link";
import { useRef } from "react";
import { safeExternalHref } from "@/components/safe-href";
import { ThemeToggle } from "@/components/theme-toggle";
import type {
  OwnerAnalysis,
  OwnerRecommendationReason,
  OwnerRepositorySummary,
} from "@/lib/analysis/types";

// ─── Icons ──────────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M14 8a6 6 0 11-1.76-4.24M14 2v3.5h-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StarPin() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 .75 7.45 4.2l3.55.35-2.7 2.5.8 3.45L6 8.8 2.9 10.5l.8-3.45L1 4.55l3.55-.35L6 .75Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2M9 3h4v4M13 3L7 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Reason list (featured / beginner "왜 추천하는지") ──────────────────────

// The evidence source ("readme" vs "package_json" vs …) is a quiet trust
// signal — not a developer badge. We render it as a minimal dot + source
// label, never as a chip. When details are empty, fall back to the
// free-form single sentence (featuredReason/beginnerReason).
const SOURCE_LABEL: Partial<Record<OwnerRecommendationReason["source"], string>> = {
  readme: "README",
  package_json: "package.json",
  repo: "레포 메타",
  tree: "파일 트리",
  heuristic: "추정",
  workspace: "workspace",
};

function sourceLabelFor(source: OwnerRecommendationReason["source"]): string | null {
  return SOURCE_LABEL[source] ?? null;
}

function ReasonList({
  label,
  details,
  fallback,
}: {
  label: string;
  details: OwnerRecommendationReason[];
  fallback: string;
}) {
  const hasDetails = details.length > 0;
  if (!hasDetails && !fallback) return null;

  return (
    <div className="mt-2">
      <p className="text-[10px] font-medium text-[var(--fg-dim)]">{label}</p>
      {hasDetails ? (
        <ul className="mt-1 space-y-0.5">
          {details.slice(0, 4).map((reason) => {
            const src = sourceLabelFor(reason.source);
            return (
              <li
                key={reason.code}
                className="flex items-baseline gap-2 text-[11.5px] leading-5 text-[var(--fg-muted)]"
              >
                <span aria-hidden className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[var(--fg-dim)]" />
                <span className="min-w-0">
                  {reason.label}
                  {src ? (
                    <span className="ml-1.5 text-[10px] text-[var(--fg-dim)]">· {src}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-5 text-[var(--fg-muted)]">
          {fallback}
        </p>
      )}
    </div>
  );
}

// ─── Sampling signal (subtle trust hint) ────────────────────────────────────

// Coverage signals now flow through `summary.sampledRepoCount` and
// `summary.enrichedRepoCount`, rendered inside `<CoverageBar>`. The old
// per-card sampling.booleans aggregation was removed in favor of this
// top-level, at-a-glance visualization.

// ─── Hero ───────────────────────────────────────────────────────────────────

function OwnerHero({ analysis }: { analysis: OwnerAnalysis }) {
  const ownerLabel = analysis.owner.displayName || analysis.owner.login;
  const { summary } = analysis;
  const startingPoints = summary.recommendedStartingPoints.slice(0, 3);
  const sampleGap =
    summary.sampledRepoCount > 0 &&
    summary.sampledRepoCount < summary.publicRepoCount;

  // Owner는 repo와 달리 coverage.trustSummary 계약이 없어서, 샘플링 수치로
  // compact trust chip을 직접 합성한다. Hero 최상단 caption에 올려
  // "이 결과가 어디까지의 샘플 기반인지"를 먼저 읽게 한다.
  const trustLabel = (() => {
    if (summary.publicRepoCount <= 0) return null;
    const total = summary.publicRepoCount;
    const enriched = summary.enrichedRepoCount;
    const sampled = summary.sampledRepoCount;
    if (enriched === 0 && sampled === 0) return "메타 데이터만 사용";
    if (enriched === 0) return `${total}개 중 ${sampled}개 훑음`;
    return `${total}개 중 ${enriched}개 깊게 읽음`;
  })();

  return (
    <section className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-dim)]">
        <span className="rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-0.5">
          {summary.ownerTypeLabel}
        </span>
        <span>공개 레포 {summary.publicRepoCount}개</span>
        {trustLabel ? (
          <>
            <span aria-hidden>·</span>
            <span
              title="깊게 읽은 repo만 구조/스택/환경이 반영됐어요. 나머지는 메타 정보 기반."
              className="inline-flex items-center gap-1 rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface-strong)]/60 px-1.5 py-0.5 text-[10.5px] text-[var(--fg-dim)]"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-warm)]/70"
              />
              {trustLabel}
            </span>
          </>
        ) : null}
      </div>

      <h1 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--fg)]">
        {ownerLabel}
        {analysis.owner.displayName ? (
          <span className="ml-2 text-[13px] font-normal text-[var(--fg-dim)]">
            @{analysis.owner.login}
          </span>
        ) : null}
      </h1>

      <p className="mt-2 max-w-[880px] text-[13.5px] leading-6 text-[var(--fg)]/90">
        {summary.oneLiner}
      </p>

      {summary.keyThemes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-[var(--fg-dim)]">주요 테마</span>
          {summary.keyThemes.slice(0, 6).map((theme) => (
            <span
              key={theme}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]"
            >
              {theme}
            </span>
          ))}
        </div>
      ) : null}

      {summary.commonStacks.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-[var(--fg-dim)]">자주 쓰는 스택</span>
          {summary.commonStacks.slice(0, 8).map((stack) => (
            <span
              key={stack}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]"
            >
              {stack}
            </span>
          ))}
        </div>
      ) : null}

      {startingPoints.length > 0 ? (
        <div className="relative mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3 pl-4">
          <span
            aria-hidden
            className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[var(--accent)]"
          />
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--fg)]">
            <span className="text-[var(--accent)]">
              <StarPin />
            </span>
            여기부터 보세요
          </div>
          <ul className="mt-1.5 space-y-1">
            {startingPoints.map((point, index) => (
              <li
                key={`${index}-${point.slice(0, 16)}`}
                className="text-[12.5px] leading-6 text-[var(--fg)]/90"
              >
                · {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CoverageBar analysis={analysis} sampleGap={sampleGap} />
    </section>
  );
}

// ─── Coverage bar (규모 · 신뢰도) ──────────────────────────────────────────
// 초보자도 한 눈에 이해할 3단 지표:
// 1. 전체 공개 레포(total)
// 2. 그중 훑어본(sampled)
// 3. 그중 더 깊게 읽은(enriched, 대표 근거까지 추출)
// 값의 의미를 혼동하지 않게 서로 다른 시각 언어를 쓴다:
// · 전체 = 컨텍스트 (테두리 bar, 배경)
// · sampled = 가로 파 fill (중간 톤)
// · enriched = sampled 안 작은 accent bar + 명시 수치

function CoverageBar({
  analysis,
  sampleGap,
}: {
  analysis: OwnerAnalysis;
  sampleGap: boolean;
}) {
  const { summary } = analysis;
  const total = summary.publicRepoCount;
  const sampled = summary.sampledRepoCount;
  const enriched = summary.enrichedRepoCount;

  if (total <= 0) return null;

  const sampledPct = Math.min(100, Math.round((sampled / total) * 100));
  const enrichedPct = Math.min(100, Math.round((enriched / total) * 100));

  const hasAny = sampled > 0 || enriched > 0;

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium text-[var(--fg)]">
          {hasAny
            ? `공개 레포 ${total}개 중 ${sampled}개를 훑고${
                enriched > 0 ? `, ${enriched}개는 구조까지 깊게 읽었어요` : ""
              }.`
            : `공개 레포 ${total}개를 목록만 확인했어요.`}
        </p>
        {sampleGap ? (
          <span className="shrink-0 text-[10px] text-[var(--fg-dim)]">
            나머지는 repo 메타만 참고
          </span>
        ) : null}
      </div>

      {hasAny ? (
        <div className="mt-2 space-y-1">
          {/* Sampled layer: midtone fill across the total bar */}
          <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--fg-muted)]/40"
              style={{ width: `${sampledPct}%` }}
            />
            {/* Enriched layer: accent bar inside sampled portion */}
            {enriched > 0 ? (
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                style={{ width: `${enrichedPct}%` }}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[var(--fg-muted)]/40"
              />
              훑음 {sampled}
            </span>
            {enriched > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]"
                />
                깊게 읽음 {enriched}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full border border-[var(--border-strong)]"
              />
              전체 {total}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Featured — hero 1 + compact 3 ──────────────────────────────────────────

function HeroFeaturedCard({ repo }: { repo: OwnerRepositorySummary }) {
  const topics = repo.topics.slice(0, 4);
  return (
    <article className="flex flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--surface-strong)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10.5px] text-[var(--fg-dim)]">
            <span className="rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[var(--fg-muted)]">
              이 owner를 가장 잘 보여주는
            </span>
            <span>{repo.categoryLabel}</span>
          </div>
          <h3 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em] text-[var(--fg)]">
            {repo.name}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--fg-dim)]">
          <span>★ {repo.stars}</span>
          {repo.language ? <span>· {repo.language}</span> : null}
        </div>
      </div>

      {repo.description ? (
        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[var(--fg-muted)]">
          {repo.description}
        </p>
      ) : null}

      {repo.stackSignals.length > 0 || topics.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.stackSignals.slice(0, 4).map((stack) => (
            <span
              key={`stack-${stack}`}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] text-[var(--fg-muted)]"
            >
              {stack}
            </span>
          ))}
          {topics.slice(0, 2).map((topic) => (
            <span
              key={`topic-${topic}`}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] text-[var(--fg-dim)]"
            >
              #{topic}
            </span>
          ))}
        </div>
      ) : null}

      <ReasonList
        label="왜 대표 레포?"
        details={repo.featuredReasonDetails}
        fallback={repo.featuredReason}
      />

      <div className="mt-4 flex items-center gap-1.5">
        <Link
          href={`/analyzing?repoUrl=${encodeURIComponent(repo.url)}`}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent-fg)] hover:opacity-90"
        >
          이 레포 이해하기 →
        </Link>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
        >
          <ExternalIcon />
          GitHub
        </a>
        {/* homepage는 레포 소유자가 자유롭게 설정해서 javascript:/data: 같은
            스킴이 들어올 수 있으므로 safeExternalHref로 한 번 더 검증. */}
        {(() => {
          const homepage = safeExternalHref(repo.homepage ?? null);
          if (!homepage) return null;
          return (
            <a
              href={homepage}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              <ExternalIcon />
              사이트
            </a>
          );
        })()}
      </div>
    </article>
  );
}

function CompactFeaturedCard({ repo }: { repo: OwnerRepositorySummary }) {
  const reasons = repo.featuredReasonDetails.slice(0, 2);
  return (
    <article className="flex h-full flex-col rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-[var(--fg)]">
          {repo.name}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--fg-dim)]">
          ★ {repo.stars}
        </span>
      </div>
      <p className="mt-0.5 text-[10.5px] text-[var(--fg-dim)]">{repo.categoryLabel}</p>

      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-5 text-[var(--fg-muted)]">
        {repo.description || repo.featuredReason}
      </p>

      {reasons.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {reasons.map((reason) => (
            <li
              key={reason.code}
              className="truncate text-[10.5px] text-[var(--fg-dim)]"
            >
              · {reason.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-2">
        <Link
          href={`/analyzing?repoUrl=${encodeURIComponent(repo.url)}`}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--accent)] hover:opacity-80"
        >
          이해하기
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

function FeaturedSection({ repos }: { repos: OwnerRepositorySummary[] }) {
  if (repos.length === 0) return null;
  const [hero, ...rest] = repos;
  const secondary = rest.slice(0, 3);
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          대표 레포
        </h2>
        <span className="text-[10.5px] text-[var(--fg-dim)]">
          {repos.length}개 중 상위 {1 + secondary.length}개
        </span>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <HeroFeaturedCard repo={hero} />
        {secondary.length > 0 ? (
          <div className="grid gap-2">
            {secondary.map((repo) => (
              <CompactFeaturedCard key={repo.fullName} repo={repo} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ─── Beginner — why-centric row ─────────────────────────────────────────────

function BeginnerRow({ repo }: { repo: OwnerRepositorySummary }) {
  const reason =
    repo.beginnerReasonDetails[0]?.label ||
    repo.beginnerReason ||
    "가볍게 훑기 좋은 레포입니다.";

  return (
    <Link
      href={`/analyzing?repoUrl=${encodeURIComponent(repo.url)}`}
      className="flex items-start gap-3 px-3 py-2 hover:bg-[var(--surface-hover)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium text-[var(--fg)]">
            {repo.name}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--fg-dim)]">
            {repo.categoryLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-5 text-[var(--fg-muted)]">
          {reason}
        </p>
      </div>
      <span
        aria-hidden
        className="mt-1 shrink-0 text-[10.5px] text-[var(--fg-dim)]"
      >
        이해하기 →
      </span>
    </Link>
  );
}

function BeginnerSection({ repos }: { repos: OwnerRepositorySummary[] }) {
  if (repos.length === 0) return null;
  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[12.5px] font-semibold text-[var(--fg)]">
          입문용으로 가볍게
        </h2>
        <span className="text-[10.5px] text-[var(--fg-dim)]">{repos.length}개</span>
      </div>
      <ul className="mt-1.5 divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-[var(--surface)]">
        {repos.slice(0, 5).map((repo) => (
          <li key={repo.fullName}>
            <BeginnerRow repo={repo} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Meta (Latest / Categories / Limitations) ───────────────────────────────

function CategoryInline({
  categories,
}: {
  categories: OwnerAnalysis["portfolio"]["categories"];
}) {
  if (categories.length === 0) return null;
  return (
    <div>
      <p className="text-[10.5px] font-medium text-[var(--fg-dim)]">카테고리 분포</p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {categories.map((category) => (
          <li key={category.key} className="text-[11px] text-[var(--fg-muted)]">
            {category.label}
            <span className="ml-1 text-[var(--fg-dim)]">{category.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LatestInline({ repos }: { repos: OwnerRepositorySummary[] }) {
  if (repos.length === 0) return null;
  return (
    <div>
      <p className="text-[10.5px] font-medium text-[var(--fg-dim)]">최근 업데이트</p>
      <ul className="mt-1.5 space-y-0.5">
        {repos.slice(0, 5).map((repo) => (
          <li key={repo.fullName}>
            <Link
              href={`/analyzing?repoUrl=${encodeURIComponent(repo.url)}`}
              className="truncate text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline"
            >
              {repo.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoticesInline({
  limitations,
  warnings,
}: {
  limitations: OwnerAnalysis["limitations"];
  warnings: OwnerAnalysis["warnings"];
}) {
  if (limitations.length === 0 && warnings.length === 0) return null;
  return (
    <div>
      <p className="text-[10.5px] font-medium text-[var(--fg-dim)]">분석 범위</p>
      <ul className="mt-1.5 space-y-0.5">
        {limitations.map((notice) => (
          <li
            key={`lim-${notice.code}`}
            className="text-[11px] leading-5 text-[var(--fg-muted)]"
          >
            · {notice.message}
          </li>
        ))}
        {warnings.map((notice) => (
          <li
            key={`warn-${notice.code}`}
            className="text-[11px] leading-5 text-[var(--fg-muted)]"
          >
            · {notice.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Workspace ──────────────────────────────────────────────────────────────

export function OwnerWorkspace({ analysis }: { analysis: OwnerAnalysis }) {
  const ownerLabel = analysis.owner.displayName || analysis.owner.login;

  const hasMetaRow =
    analysis.portfolio.categories.length > 0 ||
    analysis.portfolio.latestRepos.length > 0 ||
    analysis.limitations.length > 0;

  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const noticeCount = analysis.limitations.length + analysis.warnings.length;
  const hasNotices = noticeCount > 0;

  function openDetailsAndScroll() {
    if (detailsRef.current) {
      detailsRef.current.open = true;
      detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1200px] flex-col px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        <div className="min-w-0">
          <a
            href={analysis.owner.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-left text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)] hover:text-[var(--accent)]"
            title="GitHub에서 열기"
          >
            {ownerLabel}
          </a>
          <p className="mt-0.5 truncate text-[12px] text-[var(--fg-muted)]">
            {analysis.summary.ownerTypeLabel} 포트폴리오
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/analyzing?repoUrl=${encodeURIComponent(analysis.owner.url)}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            title="다시 분석"
            aria-label="다시 분석"
          >
            <RefreshIcon />
            <span className="hidden sm:inline">다시 분석</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            title="새 레포"
            aria-label="새 레포"
          >
            <PlusIcon />
            <span className="hidden sm:inline">새 레포</span>
          </Link>
          <div className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
          <ThemeToggle />
        </div>
      </header>

      <OwnerHero analysis={analysis} />

      {hasNotices ? (
        <button
          type="button"
          onClick={openDetailsAndScroll}
          className="mt-3 flex items-center justify-between gap-3 self-start rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-left text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          aria-label="분석 범위 제한 자세히 보기"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--border-strong)] text-[9px] text-[var(--fg-dim)]"
            >
              i
            </span>
            <span>이번 분석은 일부 제한이 있어요</span>
            <span className="text-[var(--fg-dim)]">· {noticeCount}건</span>
          </span>
          <span aria-hidden className="text-[var(--fg-dim)]">자세히 →</span>
        </button>
      ) : null}

      <FeaturedSection repos={analysis.portfolio.featuredRepos} />

      <BeginnerSection repos={analysis.portfolio.beginnerRepos} />

      {hasMetaRow || analysis.warnings.length > 0 ? (
        <details
          ref={detailsRef}
          className="mt-5 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 [&>summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-2 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)]">
            <span>더 살펴보기 — 카테고리 분포 · 최근 업데이트 · 분석 범위</span>
            <span aria-hidden className="text-[10px] text-[var(--fg-dim)]">▾</span>
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <CategoryInline categories={analysis.portfolio.categories} />
            <LatestInline repos={analysis.portfolio.latestRepos} />
            <NoticesInline
              limitations={analysis.limitations}
              warnings={analysis.warnings}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
