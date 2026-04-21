"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CompareEnvDiff } from "@/components/compare-env-diff";
import { CompareEnvDrawer } from "@/components/compare-env-drawer";
import { CompareErrorCard } from "@/components/compare-error-card";
import { CompareLayersDiff } from "@/components/compare-layers-diff";
import { CompareStackDiff } from "@/components/compare-stack-diff";
import { EnvMatchBlock } from "@/components/env-match-block";
import { ThemeToggle } from "@/components/theme-toggle";
import { buildTrustSummary } from "@/components/trust-summary";
import type {
  CompareDiff,
  CompareRepoPairState,
  CompareRepoSlotState,
  ValidatedCompareRepoTarget,
} from "@/components/compare-view-model";
import {
  budgetTierLabel,
  collectCloudServiceLabels,
  collectDeployTargets,
  describeDockerNeed,
  matchRepoToEnv,
  normalizeDockerRole,
  presetApplyById,
  serviceKindIcon,
  serviceKindLabel,
  splitServices,
  useUserEnv,
  userEnvIsEmpty,
  type CompatResult,
} from "@/components/user-env";
import type { RepoAnalysis } from "@/lib/analysis/types";

// "내 레포 지정" 상태. null = 중립 비교, "a"/"b" = 그 쪽이 내 레포이고
// 반대쪽은 참고 대상. Insights/Stack/Env 카피가 이 값에 따라 방향성을 가짐.
export type MineSide = "a" | "b" | null;

export function CompareWorkspace({
  pairState,
  diff,
  fetching,
  blockedMessage,
  onRefresh,
  onRetryA,
  onRetryB,
}: {
  pairState: CompareRepoPairState;
  diff: CompareDiff | null;
  fetching: boolean;
  /** When non-null, idle slots render this message instead of a skeleton.
   * Used when one side failed validation, so the valid side doesn't appear
   * to be loading forever. */
  blockedMessage?: string | null;
  onRefresh: () => void;
  onRetryA: () => void;
  onRetryB: () => void;
}) {
  const [mine, setMine] = useState<MineSide>(null);
  const toggleMine = (side: "a" | "b") =>
    setMine((prev) => (prev === side ? null : side));
  const [userEnv, setUserEnv, resetUserEnv] = useUserEnv();
  const [envOpen, setEnvOpen] = useState(false);
  const envActive = !userEnvIsEmpty(userEnv);

  // `?env=<preset-id>` 딥링크 — 초기 한 번 apply 후 URL 정리.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const envPresetParam = searchParams.get("env");
  useEffect(() => {
    if (!envPresetParam) return;
    const apply = presetApplyById(envPresetParam);
    if (apply) setUserEnv(apply);
    const params = new URLSearchParams(searchParams);
    params.delete("env");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envPresetParam]);
  const { inputs, slots, warnings } = pairState;
  const aLabel = slotLabel(slots.a, inputs.a);
  const bLabel = slotLabel(slots.b, inputs.b);
  const compatA = slots.a.analysis && envActive ? matchRepoToEnv(slots.a.analysis, userEnv) : null;
  const compatB = slots.b.analysis && envActive ? matchRepoToEnv(slots.b.analysis, userEnv) : null;

  const sameUrl =
    inputs.a.canonicalUrl !== "" &&
    inputs.a.canonicalUrl === inputs.b.canonicalUrl;

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
              <HeaderSlot label="A" text={aLabel} analysis={slots.a.analysis} />
              <span aria-hidden className="text-[var(--fg-dim)]">
                ↔
              </span>
              <HeaderSlot label="B" text={bLabel} analysis={slots.b.analysis} />
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEnvOpen(true)}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[12px] font-medium ${
                envActive
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/15"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              }`}
              title="내 환경 설정 — 레포가 내 환경에서 돌아가는지 판정합니다"
            >
              {envActive ? "✓ 내 환경" : "내 환경 설정"}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={fetching}
              className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fetching ? "분석 중…" : "다시 분석"}
            </button>
            <Link
              href="/compare"
              className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              새 비교
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <CompareEnvDrawer
        open={envOpen}
        env={userEnv}
        onClose={() => setEnvOpen(false)}
        onChange={(next) => setUserEnv(next)}
        onReset={() => resetUserEnv()}
        extraServices={collectCloudServiceLabels([slots.a.analysis, slots.b.analysis])}
        extraDeployTargets={collectDeployTargets([slots.a.analysis, slots.b.analysis])}
      />

      <main className="mx-auto w-full max-w-[1080px] space-y-4 px-4 py-6 sm:px-6">
        {sameUrl ? (
          <Banner>두 레포를 동일하게 입력했어요. 같은 레포끼리 비교합니다.</Banner>
        ) : null}

        {(warnings ?? [])
          .concat(diff?.warnings ?? [])
          .filter((msg, idx, arr) => arr.indexOf(msg) === idx)
          .filter(
            (msg) =>
              !sameUrl || msg !== "두 레포를 동일하게 입력했어요."
          )
          .map((msg) => (
            <Banner key={msg}>{msg}</Banner>
          ))}

        {/* 위계 — 북극성 "두 레포를 나란히 이해하는 화면":
              1) Insights 3줄: 스케일/스택/환경 차이를 한눈에
              2) Summary Cards A·B: 각 레포 정체성 상세
              3) Diff 섹션들: stack → layers → env 순으로 깊이를 더함
              4) DrillDown: 단일 분석으로 넘어가는 CTA
            Insights가 Cards보다 먼저 오는 이유 — "비교 요점"을 먼저 잡고,
            그 뒤에 각 레포를 펼쳐 보는 흐름이 이해 속도가 빠름. */}
        {diff ? (
          <CompareInsights
            diff={diff}
            aLabel={aLabel}
            bLabel={bLabel}
            mine={mine}
            compatA={compatA}
            compatB={compatB}
            consumptionA={slots.a.analysis?.learning?.identity?.consumptionMode ?? null}
            consumptionB={slots.b.analysis?.learning?.identity?.consumptionMode ?? null}
          />
        ) : null}

        <SummaryStrip
          slots={slots}
          onRetryA={onRetryA}
          onRetryB={onRetryB}
          blockedMessage={blockedMessage ?? null}
          mine={mine}
          onToggleMine={toggleMine}
          compatA={compatA}
          compatB={compatB}
        />

        {diff ? (
          <>
            <CompareStackDiff
              common={diff.stack.common}
              onlyA={diff.stack.onlyA}
              onlyB={diff.stack.onlyB}
              aLabel={aLabel}
              bLabel={bLabel}
            />
            <CompareLayersDiff rows={diff.layers.rows} aLabel={aLabel} bLabel={bLabel} />
            <CompareEnvDiff env={diff.env} aLabel={aLabel} bLabel={bLabel} />
            <DrillDown
              aUrl={slots.a.analysis ? inputs.a.canonicalUrl : null}
              bUrl={slots.b.analysis ? inputs.b.canonicalUrl : null}
              aLabel={aLabel}
              bLabel={bLabel}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function slotLabel(
  slot: CompareRepoSlotState,
  input: ValidatedCompareRepoTarget
): string {
  if (slot.analysis) {
    return `${slot.analysis.repo.owner}/${slot.analysis.repo.name}`;
  }
  if (input.label) return input.label;
  if (input.canonicalUrl) {
    try {
      const url = new URL(input.canonicalUrl);
      const path = url.pathname.replace(/^\/+|\/+$/g, "");
      if (path) return path;
    } catch {
      /* noop */
    }
    return input.canonicalUrl;
  }
  return "—";
}

function HeaderSlot({
  label,
  text,
  analysis,
}: {
  label: "A" | "B";
  text: string;
  analysis: RepoAnalysis | null;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="inline-flex items-center rounded-sm bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
        {label}
      </span>
      <span className="truncate" title={text}>
        {analysis
          ? `${analysis.repo.owner}/${analysis.repo.name}`
          : text}
      </span>
    </span>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--accent-warm)]/50 bg-[var(--accent-warm)]/10 px-3 py-2 text-[12px] text-[var(--fg)]">
      {children}
    </div>
  );
}

function SummaryStrip({
  slots,
  onRetryA,
  onRetryB,
  blockedMessage,
  mine,
  onToggleMine,
  compatA,
  compatB,
}: {
  slots: CompareRepoPairState["slots"];
  onRetryA: () => void;
  onRetryB: () => void;
  blockedMessage: string | null;
  mine: MineSide;
  onToggleMine: (side: "a" | "b") => void;
  compatA: CompatResult | null;
  compatB: CompatResult | null;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <SummaryCard
        side="A"
        slot={slots.a}
        onRetry={onRetryA}
        blockedMessage={blockedMessage}
        mine={mine}
        onToggleMine={onToggleMine}
        compat={compatA}
      />
      <SummaryCard
        side="B"
        slot={slots.b}
        onRetry={onRetryB}
        blockedMessage={blockedMessage}
        mine={mine}
        onToggleMine={onToggleMine}
        compat={compatB}
      />
    </section>
  );
}

function SummaryCard({
  side,
  slot,
  onRetry,
  blockedMessage,
  mine,
  onToggleMine,
  compat,
}: {
  side: "A" | "B";
  slot: CompareRepoSlotState;
  onRetry: () => void;
  blockedMessage: string | null;
  mine: MineSide;
  onToggleMine: (side: "a" | "b") => void;
  compat: CompatResult | null;
}) {
  const sideLower = side.toLowerCase() as "a" | "b";
  const isMine = mine === sideLower;
  const isReference = mine !== null && !isMine;
  if (slot.error) {
    return (
      <CompareErrorCard
        side={side}
        message={slot.error}
        canonicalUrl={slot.repoUrl || null}
        onRetry={onRetry}
      />
    );
  }

  if (!slot.analysis) {
    if (blockedMessage) {
      return (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-1.5">
            <SideBadge label={side} />
            <span className="text-[11px] text-[var(--fg-dim)]">레포 · 대기</span>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[var(--fg-muted)]">
            {blockedMessage}
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-1.5">
          <SideBadge label={side} />
          <span className="text-[11px] text-[var(--fg-dim)]">레포</span>
        </div>
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--surface-strong)]" />
        <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[var(--surface-strong)]/70" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]/60" />
          <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]/60" />
          <div className="h-6 animate-pulse rounded bg-[var(--surface-strong)]/60" />
        </div>
      </div>
    );
  }

  const analysis = slot.analysis;
  const roleLabel = isMine ? "내 레포" : isReference ? "참고 대상" : null;
  const roleBadgeClass = isMine
    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
    : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";
  const cardClass = isMine
    ? "rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] p-4"
    : "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4";
  return (
    <div className={cardClass}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SideBadge label={side} />
          {roleLabel ? (
            <span
              className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClass}`}
            >
              {roleLabel}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleMine(sideLower)}
            className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium ${
              isMine
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/15"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-dim)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg-muted)]"
            }`}
            title={isMine ? "내 레포 지정 해제" : "이 레포를 내 레포로 지정"}
          >
            {isMine ? "✓ 내 레포" : "내 레포로"}
          </button>
          <a
            href={analysis.repo.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10.5px] text-[var(--fg-dim)] hover:underline"
          >
            GitHub ↗
          </a>
        </div>
      </div>
      <p className="mt-1 truncate text-[13px] font-semibold text-[var(--fg)]">
        {analysis.repo.owner}/{analysis.repo.name}
      </p>
      {/* 초보자에게 가장 짧고 친절한 한 줄은 identity.plainTitle. oneLiner는
          백엔드 메타 문장("공개 엔드포인트 …를 기준으로")이 섞여 있어 보조로만. */}
      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--fg-muted)]">
        {analysis.learning?.identity?.plainTitle?.trim() || analysis.summary.oneLiner}
      </p>
      <CompareSlotTrustNote analysis={analysis} />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="프로젝트" value={analysis.summary.projectType} />
        <Stat label="난이도" value={difficultyLabel(analysis.summary.difficulty)} />
        <Stat
          label="파일"
          value={`${analysis.stats.sourceFileCount.toLocaleString()}개`}
        />
      </dl>

      <NeedsBlock analysis={analysis} emphasize={isReference} />
      {compat && compat.items.length > 0 ? (
        <div className="mt-3">
          <EnvMatchBlock compat={compat} />
        </div>
      ) : null}
    </div>
  );
}

// 각 repo slot에 붙는 compact trust micro-note.
// partial/limited일 때만 렌더되어, 사용자가 "이 비교의 한쪽이 대표 경로
// 기준 요약임"을 먼저 인지하게 한다. Result의 TrustSummaryBanner를 두 줄로
// 압축한 버전 — 양쪽 카드가 좁은 grid 안에 공존해야 해서 한 줄 chip + tooltip.
function CompareSlotTrustNote({ analysis }: { analysis: RepoAnalysis }) {
  const summary = buildTrustSummary(analysis);
  if (!summary.shouldRender) return null;
  const reasonLine = summary.reasons.map((r) => r.label).join(" · ");
  const tooltip = [summary.headline, reasonLine].filter(Boolean).join("\n");
  return (
    <p
      title={tooltip}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface-strong)]/40 px-1.5 py-0.5 text-[10.5px] text-[var(--fg-dim)]"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-warm)]/80"
      />
      {summary.chipLabel ?? "부분 분석"} · {summary.headline || reasonLine || "대표 경로 기준 요약"}
    </p>
  );
}

// 이 레포를 혼자 쓰려면 필요한 것 — 실행 환경 기반 체크리스트.
// `isReference`일 때 제목이 consumptionMode에 따라 갈린다:
//   import-as-library → "설치하려면 필요한 것"
//   run-as-app        → "가져오려면 필요한 것"
//   hybrid/unknown    → "쓰려면 필요한 것"
function NeedsBlock({
  analysis,
  emphasize,
}: {
  analysis: RepoAnalysis;
  emphasize: boolean;
}) {
  const env = analysis.learning?.environment;
  if (!env) return null;
  const runtime = env.runtimes[0];

  // Docker 필요 정도 — required / recommended / optional / none 4-상태.
  const legacyNeedsDocker = Boolean(
    env.container?.hasDockerfile || env.container?.hasDockerCompose
  );
  const effectiveRole = normalizeDockerRole(
    env.container?.dockerRole,
    legacyNeedsDocker
  );
  const dockerDesc = describeDockerNeed(
    effectiveRole,
    env.container?.needsMultiContainer,
    env.container?.composeServiceCount
  );

  // Services: api(계정 필요) vs infra(core) 분리. required만 primary 칩으로.
  const split = splitServices(env.cloud);

  // 하드웨어
  const ramNeeds =
    env.hardware?.recommendedRamGb ?? env.hardware?.minRamGb ?? null;
  const vramNeeds = env.hardware?.minVramGb ?? null;
  const gpuHint = env.hardware?.gpuRequired
    ? env.hardware.gpuHint?.trim() || null
    : null;

  // 예산 + drivers (tooltip 요약 상위 2개)
  const cost = env.costEstimate;
  const budgetTier = cost?.tier ?? null;
  const budgetChip = budgetTier ? `월 비용 ${budgetTierLabel(budgetTier)}` : null;
  const driverNotes = (cost?.drivers ?? [])
    .slice(0, 2)
    .map((d) => d.note)
    .filter(Boolean);
  const budgetTooltip = driverNotes.length > 0
    ? `근거: ${driverNotes.join(" · ")}`
    : "예상 월 비용 tier (보수적 범위)";

  // 배포 타깃
  const deployRequired = env.cloud?.deployTargetRequired ?? null;

  // 실행 성향(cloud-required)
  const runtimeMode = env.runtimeMode;

  const primaryItems: string[] = [];
  if (runtime) {
    const label = RUNTIME_LABEL[runtime.name] ?? runtime.name;
    const ver = runtime.version ? ` ${runtime.version}` : "";
    primaryItems.push(`${label}${ver}`);
  }
  if (ramNeeds != null) primaryItems.push(`RAM ${ramNeeds} GB`);
  if (vramNeeds != null) primaryItems.push(`VRAM ${vramNeeds} GB`);
  if (deployRequired) primaryItems.push(`${deployRequired} 배포`);
  if (runtimeMode === "cloud-required") primaryItems.push("클라우드 실행");

  const hasAnything =
    primaryItems.length > 0 ||
    split.apiRequired.length > 0 ||
    split.infraRequired.length > 0 ||
    split.apiOptional.length > 0 ||
    split.infraOptional.length > 0 ||
    !!dockerDesc ||
    !!gpuHint ||
    !!budgetChip ||
    env.hardware?.gpuRequired;
  if (!hasAnything) return null;

  // consumptionMode — 참고 대상일 때만 제목 분기.
  const consumption = analysis.learning?.identity?.consumptionMode;
  const heading = emphasize
    ? consumption === "import-as-library"
      ? "설치하려면 필요한 것"
      : consumption === "run-as-app"
        ? "가져오려면 필요한 것"
        : consumption === "hybrid"
          ? "설치하거나 가져오려면"
          : "쓰려면 필요한 것"
    : "쓰려면 필요한 것";

  return (
    <div
      className={`mt-3 rounded-md border px-2.5 py-2 ${
        emphasize
          ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/8"
          : "border-dashed border-[var(--border)] bg-[var(--surface-strong)]/40"
      }`}
    >
      <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {heading}
      </p>

      {/* 1. core (런타임 · 하드웨어 · 배포 · docker required) */}
      {primaryItems.length > 0 || (dockerDesc && effectiveRole === "required") || gpuHint || env.hardware?.gpuRequired ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {primaryItems.map((item) => (
            <li
              key={item}
              className="inline-flex items-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              {item}
            </li>
          ))}
          {dockerDesc && effectiveRole === "required" ? (
            <li
              title={dockerDesc.long}
              className="inline-flex items-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              {dockerDesc.short}
            </li>
          ) : null}
          {gpuHint ? (
            <li
              title={`GPU 권장 (${gpuHint})`}
              className="inline-flex items-center gap-1 rounded-sm border border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              <span aria-hidden>GPU</span>
              <span className="truncate">{gpuHint}</span>
            </li>
          ) : env.hardware?.gpuRequired ? (
            <li
              title="GPU 권장"
              className="inline-flex items-center rounded-sm border border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              GPU 권장
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* 2. API 계정 필요 — 키 발급이 필요한 SaaS */}
      {split.apiRequired.length > 0 ? (
        <ServiceGroup
          title="필요한 API 키"
          services={split.apiRequired}
          variant="api-required"
        />
      ) : null}

      {/* 3. Core infra 필요 — DB/Queue 등 */}
      {split.infraRequired.length > 0 ? (
        <ServiceGroup
          title="필요한 인프라"
          services={split.infraRequired}
          variant="infra-required"
        />
      ) : null}

      {/* 4. 선택 사항 */}
      {split.apiOptional.length > 0 || split.infraOptional.length > 0 ? (
        <ServiceGroup
          title="있으면 좋음 (선택)"
          services={[...split.apiOptional, ...split.infraOptional]}
          variant="optional"
        />
      ) : null}

      {/* 5. Docker recommended/optional 및 budget */}
      {(dockerDesc && effectiveRole !== "required") || budgetChip ? (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {dockerDesc && effectiveRole !== "required" ? (
            <li
              title={dockerDesc.long}
              className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]"
            >
              {dockerDesc.short}
            </li>
          ) : null}
          {budgetChip ? (
            <li
              title={budgetTooltip}
              className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]"
            >
              {budgetChip}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

// kind 아이콘을 앞에 붙인 서비스 칩 그룹. variant에 따라 톤 분기.
function ServiceGroup({
  title,
  services,
  variant,
}: {
  title: string;
  services: Array<{ label: string; canonicalId: string; kind: "ai" | "database" | "auth" | "payment" | "email" | "infra" | "queue" | "other" }>;
  variant: "api-required" | "infra-required" | "optional";
}) {
  const chipClass =
    variant === "api-required"
      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--fg)]"
      : variant === "infra-required"
        ? "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]"
        : "border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)]";
  return (
    <div className="mt-1.5">
      <p className="text-[10px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {title}
      </p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {services.map((svc) => (
          <li
            key={`${svc.canonicalId}-${svc.label}`}
            title={`${serviceKindLabel(svc.kind)} · ${svc.label}`}
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${chipClass}`}
          >
            <span aria-hidden>{serviceKindIcon(svc.kind)}</span>
            <span className="truncate">{svc.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RUNTIME_LABEL: Record<string, string> = {
  node: "Node.js",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  bun: "Bun",
  deno: "Deno",
};

function SideBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[11.5px] text-[var(--fg)]">{value}</dd>
    </div>
  );
}

function difficultyLabel(difficulty: RepoAnalysis["summary"]["difficulty"]) {
  if (difficulty === "easy") return "쉬움";
  if (difficulty === "medium") return "보통";
  return "어려움";
}

// Compare 결과의 "한눈에 읽히는 요점" 스트립. 3줄 핵심 인사이트:
//   1) 두 레포의 규모 차이 (파일 수)
//   2) 스택 겹침 정도 (공통 n / A만 n / B만 n)
//   3) 실행 환경 호환성 (런타임 일치/불일치, Docker, 배포)
//
// 스펙상 "사실만"인 Phase 1이라 추천/판단은 하지 않지만, 자연어 한 줄로
// 요약해 초보자가 모든 섹션을 스크롤하지 않아도 "이 둘이 얼마나 다른가"를
// 3초 안에 잡게 한다. identity Diff 섹션을 이 스트립으로 흡수.
function CompareInsights({
  diff,
  aLabel,
  bLabel,
  mine,
  compatA,
  compatB,
  consumptionA,
  consumptionB,
}: {
  diff: CompareDiff;
  aLabel: string;
  bLabel: string;
  mine: MineSide;
  compatA: CompatResult | null;
  compatB: CompatResult | null;
  consumptionA: "import-as-library" | "run-as-app" | "hybrid" | "unknown" | null;
  consumptionB: "import-as-library" | "run-as-app" | "hybrid" | "unknown" | null;
}) {
  // 내 레포 지정 시 mineLabel/refLabel + "가져오려면/내 레포에는" 카피로 전환.
  const mineLabel = mine === "a" ? aLabel : mine === "b" ? bLabel : null;
  const refLabel = mine === "a" ? bLabel : mine === "b" ? aLabel : null;
  // 참고 대상의 consumptionMode — "가져오려면/설치하려면/쓰려면" 동사 선택.
  const refConsumption = mine === "a" ? consumptionB : mine === "b" ? consumptionA : null;
  const verb = verbForConsumption(refConsumption);
  const aFiles = diff.repos.a.stats.sourceFileCount;
  const bFiles = diff.repos.b.stats.sourceFileCount;
  const scaleLine =
    mineLabel && refLabel
      ? buildScaleLineDirectional(
          mine === "a" ? aFiles : bFiles,
          mine === "a" ? bFiles : aFiles,
          mineLabel,
          refLabel
        )
      : buildScaleLine(aFiles, bFiles, aLabel, bLabel);

  const commonCount = diff.stack.common.length;
  const onlyACount = diff.stack.onlyA.length;
  const onlyBCount = diff.stack.onlyB.length;
  const totalStackSignals = commonCount + onlyACount + onlyBCount;
  const onlyRef = mine === "a" ? onlyBCount : mine === "b" ? onlyACount : 0;
  const onlyMine = mine === "a" ? onlyACount : mine === "b" ? onlyBCount : 0;
  const stackLine =
    totalStackSignals === 0
      ? "기술 스택 정보가 아직 정리되지 않았어요."
      : mine && onlyRef > 0 && onlyMine === 0
        ? `${refLabel}에만 있는 기술 ${onlyRef}개 — 내 레포에 ${verb.noun}려면 이 기술들을 검토해야 해요.`
        : mine && onlyRef > 0
          ? `${refLabel}에만 있는 기술 ${onlyRef}개 (내 레포엔 없음) · 공통 ${commonCount}개.`
          : mine && onlyRef === 0
            ? `${refLabel}이(가) 쓰는 기술은 모두 내 레포에도 있어요 (공통 ${commonCount}개).`
            : commonCount > 0 && onlyACount === 0 && onlyBCount === 0
              ? `기술 스택 ${commonCount}개가 완전히 겹칩니다.`
              : commonCount === 0
                ? `공통 기술 없이 ${aLabel}에 ${onlyACount}개, ${bLabel}에 ${onlyBCount}개로 서로 다른 스택이에요.`
                : `${commonCount}개 공통 · ${aLabel}에만 ${onlyACount}개 · ${bLabel}에만 ${onlyBCount}개.`;

  const runtimeDiff = diff.env.runtimes.filter((r) => r.match === "different").length;
  const runtimeOnly =
    diff.env.runtimes.filter((r) => r.match === "onlyA" || r.match === "onlyB").length;
  const dockerDelta = diff.env.dockerA !== diff.env.dockerB;
  const envLine =
    runtimeDiff === 0 && runtimeOnly === 0 && !dockerDelta
      ? mine
        ? "실행 환경이 내 레포와 맞아요 — 바로 적용해 볼 수 있어요."
        : "실행 환경은 서로 호환돼요."
      : runtimeDiff > 0
        ? mine
          ? `런타임 버전이 달라요 — 내 레포 환경을 ${runtimeDiff}개 맞춰야 할 수 있어요.`
          : `런타임 버전이 달라요 (${runtimeDiff}개 버전 차이).`
        : runtimeOnly > 0
          ? mine
            ? `내 레포에 없는 런타임이 ${runtimeOnly}개 있어요.`
            : `한쪽에만 필요한 런타임이 ${runtimeOnly}개 있어요.`
          : mine
            ? `컨테이너 · 배포 설정이 달라서 내 레포에 바로 ${verb.bareStem}기는 조정이 필요해요.`
            : "컨테이너 · 배포 설정이 달라요.";

  const headerTitle = mine ? "내 레포 기준 비교" : "한눈에 보기";
  const headerSub = mine
    ? `${refLabel}을(를) 내 레포(${mineLabel})로 ${verb.gerund} 때 체크할 포인트 3줄.`
    : "두 레포의 차이를 세 줄로 요약했어요.";

  return (
    <section
      className={`rounded-lg border p-5 ${
        mine
          ? "border-[var(--accent)]/30 bg-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <header className="mb-3">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          {headerTitle}
        </h2>
        <p className="mt-1 text-[11.5px] text-[var(--fg-dim)]">{headerSub}</p>
      </header>
      <ul className="space-y-1.5">
        {[scaleLine, stackLine, envLine, buildCompatLine(compatA, compatB, aLabel, bLabel, mine, verb)]
          .filter((line): line is string => Boolean(line))
          .map((line, i) => (
            <li
              key={i}
              className="flex gap-2 text-[12.5px] leading-5 text-[var(--fg)]"
            >
              <span
                aria-hidden
                className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]/70"
              />
              <span>{line}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

// 참고 대상의 consumptionMode에 맞춰 "가져오려면 / 설치하려면 / 쓰려면" 동사
// 3종을 반환. mine 없거나 ref mode 모르면 중립 "쓰" 사용.
function verbForConsumption(
  mode: "import-as-library" | "run-as-app" | "hybrid" | "unknown" | null
): { noun: string; gerund: string; bareStem: string } {
  if (mode === "import-as-library") {
    return { noun: "설치하", gerund: "설치해 쓸", bareStem: "설치하" };
  }
  if (mode === "run-as-app") {
    return { noun: "가져오", gerund: "가져올", bareStem: "가져오" };
  }
  // hybrid / unknown / null — 중립
  return { noun: "쓰", gerund: "쓸", bareStem: "쓰" };
}

// "내 환경 설정"이 켜졌을 때만 추가되는 네 번째 bullet.
// mine 지정이 있으면 참고 대상 중심으로 읽게 카피 재구성.
function buildCompatLine(
  compatA: CompatResult | null,
  compatB: CompatResult | null,
  aLabel: string,
  bLabel: string,
  mine: MineSide,
  verb: { noun: string; gerund: string; bareStem: string }
): string | null {
  if (!compatA && !compatB) return null;
  const summarize = (c: CompatResult | null): string => {
    if (!c || c.items.length === 0) return "판정할 항목 없음";
    if (c.summary.mismatched === 0 && c.summary.missing === 0) return "바로 돌아감";
    if (c.summary.blockers > 0) return `${c.summary.blockers}개 blocker`;
    if (c.summary.mismatched > 0) return `${c.summary.mismatched}개 다름`;
    return `${c.summary.missing}개 빠짐`;
  };

  // mine이 지정되면 참고 대상만 강조 — 내 레포는 호환성이 자명하다는 전제.
  if (mine) {
    const refLabel = mine === "a" ? bLabel : aLabel;
    const refCompat = mine === "a" ? compatB : compatA;
    if (!refCompat || refCompat.items.length === 0) {
      return `${refLabel}은(는) 내 환경 판정 항목이 없어요.`;
    }
    if (refCompat.summary.blockers > 0) {
      return `${refLabel}을(를) ${verb.bareStem}기 전에 ${refCompat.summary.blockers}개 blocker를 먼저 해결해야 해요.`;
    }
    if (refCompat.summary.mismatched === 0 && refCompat.summary.missing === 0) {
      return `${refLabel}은(는) 내 환경에서 바로 ${verb.bareStem}어 볼 수 있어요.`;
    }
    return `${refLabel}을(를) ${verb.bareStem}려면 ${summarize(refCompat)}.`;
  }

  return `내 환경 기준 — ${aLabel}: ${summarize(compatA)} · ${bLabel}: ${summarize(compatB)}.`;
}

// 내 레포 기준 방향성을 가진 규모 비교. refCount가 커/작으면 "가져올 때"
// 관점으로 카피 전환.
function buildScaleLineDirectional(
  mineCount: number,
  refCount: number,
  mineLabel: string,
  refLabel: string
): string {
  if (mineCount === 0 && refCount === 0) return "분석된 파일이 없어요.";
  if (mineCount === 0) return `${refLabel}은(는) ${refCount.toLocaleString()}개 파일, 내 레포는 비어 있어요.`;
  if (refCount === 0) return `${refLabel}은(는) 비어 있고, 내 레포에는 ${mineCount.toLocaleString()}개 파일이 있어요.`;
  const ratio = refCount >= mineCount ? refCount / mineCount : mineCount / refCount;
  if (ratio >= 5) {
    return refCount >= mineCount
      ? `${refLabel}이(가) 내 레포보다 ${Math.round(ratio)}배 큰 저장소예요 (${refCount.toLocaleString()}개 vs ${mineCount.toLocaleString()}개) — 전체를 그대로 가져오긴 무거워요.`
      : `내 레포가 ${refLabel}보다 ${Math.round(ratio)}배 커요 — 부분만 참고해 가져오는 게 자연스러워요.`;
  }
  if (ratio >= 1.5) {
    return `규모 차이가 있어요 — 내 레포 ${mineCount.toLocaleString()}개 vs ${refLabel} ${refCount.toLocaleString()}개.`;
  }
  return `비슷한 규모 — 내 레포와 ${refLabel} 모두 ${Math.min(mineCount, refCount).toLocaleString()}~${Math.max(mineCount, refCount).toLocaleString()}개 파일 수준.`;
}

function buildScaleLine(
  a: number,
  b: number,
  aLabel: string,
  bLabel: string
): string {
  if (a === 0 && b === 0) return "분석된 파일이 없어요.";
  if (a === 0) return `${bLabel}은(는) ${b.toLocaleString()}개 파일, ${aLabel}은 비어 있어요.`;
  if (b === 0) return `${aLabel}은(는) ${a.toLocaleString()}개 파일, ${bLabel}은 비어 있어요.`;
  const bigger = a >= b ? aLabel : bLabel;
  const smaller = a >= b ? bLabel : aLabel;
  const bigCount = Math.max(a, b);
  const smallCount = Math.min(a, b);
  const ratio = bigCount / smallCount;
  if (ratio >= 5) {
    return `${bigger}이(가) ${smaller}보다 ${Math.round(ratio)}배 큰 저장소예요 (파일 ${bigCount.toLocaleString()}개 vs ${smallCount.toLocaleString()}개).`;
  }
  if (ratio >= 1.5) {
    return `규모가 다릅니다 — ${bigger} ${bigCount.toLocaleString()}개 vs ${smaller} ${smallCount.toLocaleString()}개.`;
  }
  return `비슷한 규모 — 두 레포 모두 ${smallCount.toLocaleString()}~${bigCount.toLocaleString()}개 파일 수준.`;
}

function DrillDown({
  aUrl,
  bUrl,
  aLabel,
  bLabel,
}: {
  aUrl: string | null;
  bUrl: string | null;
  aLabel: string;
  bLabel: string;
}) {
  if (!aUrl && !bUrl) return null;
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
        단일 레포로 들어가기
      </h2>
      <p className="mt-1 text-[11.5px] text-[var(--fg-dim)]">
        구조 · 시작 파일 · 편집 가이드 같은 상세는 단일 분석 화면에서 확인할 수 있습니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {aUrl ? (
          <Link
            href={`/result?repoUrl=${encodeURIComponent(aUrl)}`}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            {aLabel} 열기 →
          </Link>
        ) : null}
        {bUrl ? (
          <Link
            href={`/result?repoUrl=${encodeURIComponent(bUrl)}`}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            {bLabel} 열기 →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
