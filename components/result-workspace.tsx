"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArchitectureCanvas } from "@/components/architecture-canvas";
import { CompareEnvDrawer } from "@/components/compare-env-drawer";
import { InspectorOverlay } from "@/components/inspector-overlay";
import { LeftPanel } from "@/components/left-panel";
import { RepoDiagramView } from "@/components/repo-diagram-view";
import { ResultEnvironmentTab } from "@/components/result-environment-tab";
import { ResultIdentityBar } from "@/components/result-identity-bar";
import { ResultLearningPanel } from "@/components/result-learning-panel";
import { ResultReadmeCoreTab } from "@/components/result-readme-core-tab";
import { ThemeToggle } from "@/components/theme-toggle";
import { buildTrustSummary } from "@/components/trust-summary";
import { TrustSummaryBanner } from "@/components/trust-summary-chip";
import {
  collectCloudServiceLabels,
  collectDeployTargets,
  matchRepoToEnv,
  presetApplyById,
  useUserEnv,
  userEnvIsEmpty,
} from "@/components/user-env";
import { getRecentAnalyzeMeta } from "@/lib/analysis/client";
import {
  buildArchitectureModel,
  type FocusRailKey,
} from "@/lib/analysis/graph";
import type { RepoAnalysis } from "@/lib/analysis/types";
import {
  ANALYSIS_STATUS_ID,
  CODE_FALLBACK_ID,
  buildAnalysisStatusView,
  buildCodeFallbackInspectorView,
  buildFallbackFileInspectorView,
  buildInspectorView,
  buildLeftPanelSections,
  buildResultIdentityBarView,
  fallbackFilePathFromTargetId,
  isFallbackFileTargetId,
  learningHasContent,
  type LeftPanelItem,
  type ResultViewMode,
} from "@/components/result-view-model";

// Sub-toggle inside 구조 보기 — canvas(레이어 지도) ↔ diagram(관계도).
// 2순위 View이므로 별도 패널 엔트리 대신 콘텐츠 안쪽 우상단 pill로 둔다.
function StructureSubToggle({
  viewMode,
  onChange,
}: {
  viewMode: ResultViewMode;
  onChange: (mode: ResultViewMode) => void;
}) {
  const isCanvas = viewMode === "canvas";
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex md:left-3">
      <div className="pointer-events-auto inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] text-[11px]">
        <button
          type="button"
          onClick={() => onChange("canvas")}
          aria-pressed={isCanvas}
          className={`px-2.5 py-1 ${
            isCanvas
              ? "bg-[var(--surface-hover)] text-[var(--fg)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          }`}
        >
          레이어 지도
        </button>
        <span aria-hidden className="w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => onChange("diagram")}
          aria-pressed={!isCanvas}
          className={`px-2.5 py-1 ${
            !isCanvas
              ? "bg-[var(--surface-hover)] text-[var(--fg)]"
              : "text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          }`}
        >
          관계도
        </button>
      </div>
    </div>
  );
}

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

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11 3.5a2 2 0 110 4 2 2 0 010-4zM5 6a2 2 0 110 4 2 2 0 010-4zm6 2.5a2 2 0 110 4 2 2 0 010-4zM6.5 7.2l3 1.6M9.5 7.2l-3 1.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// "공유"는 사용자가 현재 URL(탭 상태 포함)을 클립보드로 복사하게 해주는
// 작은 유틸. 링크를 그대로 공유하면 동료가 같은 탭 상태로 열 수 있다.
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const label = copied ? "복사됨" : "공유";
  return (
    <button
      type="button"
      onClick={async () => {
        if (typeof window === "undefined") return;
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard API 없거나 거부 — silent ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
      title="이 페이지 URL 복사"
      aria-label="페이지 URL 복사"
    >
      <ShareIcon />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// 응답 배송 신호(delivery source / tokenless) 미세 pill.
//
// 가치:
//   - server-cache / shared-inflight일 때 "캐시된 결과"임을 조용히 알려준다.
//   - tokenless + fresh는 굳이 노출하지 않는다 (rate-limit 상태일 때만 패널로 분리).
//
// 톤:
//   - 색 없는 fg-dim text + border, 10.5px. Linear 가이드 톤의 가장 약한 레이어.
function DeliverySourcePill({
  meta,
}: {
  meta: import("@/lib/analysis/types").AnalyzeTargetMeta | null;
}) {
  const source = meta?.delivery?.source;
  if (!source || source === "fresh") return null;
  const label = source === "server-cache" ? "캐시된 결과" : "진행 중 요청에 합류";
  const tooltip =
    source === "server-cache"
      ? "서버 쪽 캐시에서 즉시 응답받은 결과예요. 다시 분석하면 새로 돌립니다."
      : "같은 요청이 이미 돌고 있어서 같은 결과를 공유했어요.";
  return (
    <span
      title={tooltip}
      className="hidden shrink-0 items-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--fg-dim)] sm:inline-flex"
    >
      {label}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const VALID_VIEW_MODES: Record<ResultViewMode, true> = {
  learning: true,
  readme: true,
  canvas: true,
  diagram: true,
  environment: true,
};

function coerceViewMode(raw: string | null | undefined): ResultViewMode | null {
  if (!raw) return null;
  return raw in VALID_VIEW_MODES ? (raw as ResultViewMode) : null;
}

export function ResultWorkspace({ analysis }: { analysis: RepoAnalysis }) {
  const model = useMemo(() => buildArchitectureModel(analysis), [analysis]);
  const identityBarView = useMemo(() => buildResultIdentityBarView(analysis), [analysis]);
  const trustSummary = useMemo(() => buildTrustSummary(analysis), [analysis]);
  const analyzeMeta = useMemo(() => getRecentAnalyzeMeta(analysis.repo.url), [analysis.repo.url]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [userEnv, setUserEnv, resetUserEnv] = useUserEnv();
  const [envOpen, setEnvOpen] = useState(false);

  // 딥링크 `?env=<preset-id>` 진입 시 한 번 적용 후 URL에서 제거.
  const envPresetParam = searchParams.get("env");
  useEffect(() => {
    if (!envPresetParam) return;
    const apply = presetApplyById(envPresetParam);
    if (apply) {
      setUserEnv(apply);
    }
    const params = new URLSearchParams(searchParams);
    params.delete("env");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envPresetParam]);
  const envActive = !userEnvIsEmpty(userEnv);
  // 환경 데이터가 완전히 비어 있으면 드로어 자체가 무의미 — 비활성 처리.
  const envAnalyzable = Boolean(
    analysis.learning?.environment &&
      (analysis.learning.environment.runtimes.length > 0 ||
        analysis.learning.environment.container?.hasDockerfile ||
        analysis.learning.environment.container?.hasDockerCompose ||
        analysis.learning.environment.hardware?.gpuRequired ||
        analysis.learning.environment.hardware?.minRamGb != null ||
        (analysis.learning.environment.cloud?.servicesRequired?.length ?? 0) > 0 ||
        (analysis.learning.environment.cloud?.deployTargets?.length ?? 0) > 0 ||
        !!analysis.learning.environment.costEstimate)
  );
  const compat = useMemo(
    () => (envActive && envAnalyzable ? matchRepoToEnv(analysis, userEnv) : null),
    [analysis, userEnv, envActive, envAnalyzable]
  );

  const [activeFocus, setActiveFocus] = useState<FocusRailKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // `?tab=xxx` 딥링크로 들어오면 그 뷰를 초기값으로. 없으면 기본(learning).
  const initialViewMode =
    coerceViewMode(searchParams.get("tab")) ??
    (learningHasContent(analysis) ? "learning" : "canvas");
  const [viewMode, setViewMode] = useState<ResultViewMode>(initialViewMode);

  // viewMode 바뀔 때 URL에 ?tab=... 반영 — 링크 공유 시 같은 탭이 열리도록.
  // 기본 탭이면 파라미터 제거해 URL을 깨끗하게 유지.
  useEffect(() => {
    const defaultMode: ResultViewMode = learningHasContent(analysis)
      ? "learning"
      : "canvas";
    const current = searchParams.get("tab");
    const next = viewMode === defaultMode ? null : viewMode;
    if (current === next) return;
    if (current === null && next === null) return;
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("tab", next);
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [viewMode, analysis, router, pathname, searchParams]);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // 좌측 "실행 환경" 옆에 달릴 호환 상태 닷. blocker > warning > match 우선.
  const envCompatStatus = useMemo<
    { dot: "blocker" | "warning" | "match"; hint: string } | null
  >(() => {
    if (!compat || compat.items.length === 0) return null;
    if (compat.summary.blockers > 0) {
      return {
        dot: "blocker",
        hint: `${compat.summary.blockers}개 blocker — 지금 환경에선 바로 못 돌려요`,
      };
    }
    if (compat.warnings > 0) {
      return {
        dot: "warning",
        hint: `${compat.warnings}개 경고 — 조정이 필요해요`,
      };
    }
    if (compat.summary.mismatched === 0 && compat.summary.matched > 0) {
      return { dot: "match", hint: "내 환경에서 바로 돌릴 수 있어요" };
    }
    return null;
  }, [compat]);

  const leftPanelSections = useMemo(
    () =>
      buildLeftPanelSections({
        analysis,
        model,
        viewMode,
        activeFocus,
        selectedId,
        envCompatStatus,
      }),
    [analysis, model, viewMode, activeFocus, selectedId, envCompatStatus]
  );

  const inspectorBase =
    selectedId &&
    selectedId !== ANALYSIS_STATUS_ID &&
    selectedId !== CODE_FALLBACK_ID &&
    !isFallbackFileTargetId(selectedId) &&
    model.inspectables[selectedId]
      ? model.inspectables[selectedId]
      : null;

  const pseudoInspectorView = useMemo(
    () => {
      if (selectedId === ANALYSIS_STATUS_ID) {
        return buildAnalysisStatusView(analysis);
      }
      if (selectedId === CODE_FALLBACK_ID) {
        return buildCodeFallbackInspectorView(analysis, model);
      }
      if (isFallbackFileTargetId(selectedId)) {
        return buildFallbackFileInspectorView({
          path: fallbackFilePathFromTargetId(selectedId),
          analysis,
          model,
        });
      }
      return null;
    },
    [analysis, model, selectedId]
  );

  const inspectorView = useMemo(
    () =>
      pseudoInspectorView ??
      (inspectorBase
        ? buildInspectorView({ inspector: inspectorBase, analysis, model })
        : null),
    [pseudoInspectorView, inspectorBase, analysis, model]
  );

  function handleSelectNode(id: string, focusHint?: FocusRailKey) {
    setSelectedId(id);
    if (focusHint) {
      setActiveFocus(focusHint);
    }
  }

  function handlePanelSelect(item: LeftPanelItem) {
    if (item.viewMode) {
      setViewMode(item.viewMode);
    }
    if (item.focusKey) {
      setActiveFocus(item.focusKey);
    } else if (item.targetId === CODE_FALLBACK_ID) {
      setActiveFocus("all");
    }
    if (item.targetId) {
      setSelectedId(item.targetId);
    }
    setMobilePanelOpen(false);
  }

  function openOverview() {
    setSelectedId(model.overview.id);
    setActiveFocus("all");
  }

  // Both IdentityBar 시작 파일 chip과 "먼저 이해하기" 탭의 readOrder 클릭에서
  // 공유되는 동작. inspectable이면 file:…로 열고, 아니면 파일 fallback view로.
  function openFileInInspector(path: string) {
    const targetId = `file:${path}`;
    if (model.inspectables[targetId]) {
      setSelectedId(targetId);
    } else {
      setSelectedId(`file-fallback:${path}`);
    }
  }

  return (
    <section className="mx-auto flex h-[calc(100vh-2.5rem)] min-h-[640px] w-full max-w-[1500px] flex-col px-4 pb-5 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={openOverview}
            className="truncate text-left text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)] hover:text-[var(--accent)]"
            title="개요 열기"
          >
            {analysis.repo.owner}/{analysis.repo.name}
          </button>
          <DeliverySourcePill meta={analyzeMeta} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ShareButton />
          <Link
            href={`/analyzing?repoUrl=${encodeURIComponent(analysis.repo.url)}`}
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

      <ResultIdentityBar
        view={identityBarView}
        repoOwner={analysis.repo.owner}
        repoName={analysis.repo.name}
        onStartFileClick={
          identityBarView.startFile
            ? () => openFileInInspector(identityBarView.startFile!.path)
            : undefined
        }
        onStatusClick={() => setSelectedId(ANALYSIS_STATUS_ID)}
        onHighlightClick={(path) => openFileInInspector(path)}
      />

      {/* Compact trust strip — partial/limited일 때만 Identity Bar 바로 아래에.
          캔버스 폭을 밀지 않도록 행 높이를 낮게 유지. "자세히"는 IdentityBar의
          TrustChip과 같은 ANALYSIS_STATUS inspector로 연결해 경로 하나로 수렴. */}
      {trustSummary.shouldRender ? (
        <div className="mt-2">
          <TrustSummaryBanner
            summary={trustSummary}
            onDetails={() => setSelectedId(ANALYSIS_STATUS_ID)}
          />
        </div>
      ) : null}

      <CompareEnvDrawer
        open={envOpen}
        env={userEnv}
        onClose={() => setEnvOpen(false)}
        onChange={(next) => setUserEnv(next)}
        onReset={() => resetUserEnv()}
        extraServices={collectCloudServiceLabels([analysis])}
        extraDeployTargets={collectDeployTargets([analysis])}
      />

      {/* 환경 호환성은 두 경로로 이미 노출된다:
            - 좌측 패널 "실행 환경" 항목의 dot (blocker/warning/match)
            - Environment 탭 진입 시 EnvCompatHero + 항목별 블록
          워크스페이스 상단의 dense 스트립은 위 두 경로와 중복돼 Identity Bar
          아래를 눌렀기 때문에 제거. 요약을 빨리 보고 싶으면 좌측 패널 dot의
          hover hint, 자세히 보려면 Environment 탭으로 이동한다. */}

      <div className="mt-3 flex items-center justify-between gap-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
        >
          패널 열기
        </button>
      </div>

      <div className="relative mt-3 flex min-h-0 flex-1 gap-3">
        <LeftPanel
          sections={leftPanelSections}
          onSelect={handlePanelSelect}
          className="hidden md:block md:max-h-full md:w-[132px] md:shrink-0 md:overflow-y-auto lg:w-[140px]"
        />

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {viewMode === "learning" ? (
            <ResultLearningPanel
              analysis={analysis}
              onGoEnvironment={() => setViewMode("environment")}
              onStartFileClick={openFileInInspector}
            />
          ) : viewMode === "readme" ? (
            <ResultReadmeCoreTab analysis={analysis} />
          ) : viewMode === "environment" ? (
            <ResultEnvironmentTab
              analysis={analysis}
              userEnv={userEnv}
              compat={compat}
              envAnalyzable={envAnalyzable}
              onOpenEnvSettings={() => setEnvOpen(true)}
            />
          ) : viewMode === "canvas" || viewMode === "diagram" ? (
            <div className="relative h-full w-full">
              <StructureSubToggle
                viewMode={viewMode}
                onChange={(next) => setViewMode(next)}
              />
              {viewMode === "canvas" ? (
                <ArchitectureCanvas
                  model={model}
                  analysis={analysis}
                  activeFocus={activeFocus}
                  selectedId={selectedId}
                  onSelectNode={handleSelectNode}
                />
              ) : (
                <RepoDiagramView
                  model={model}
                  analysis={analysis}
                  activeFocus={activeFocus}
                  selectedId={selectedId}
                  onSelectNode={handleSelectNode}
                />
              )}
            </div>
          ) : null}

          {inspectorView ? (
            <InspectorOverlay
              view={inspectorView}
              onClose={() => setSelectedId(null)}
              onNavigate={(targetId) => {
                if (targetId.startsWith("focus:")) {
                  const layerName = targetId.slice("focus:".length) as FocusRailKey;
                  setViewMode("canvas");
                  setActiveFocus(layerName);
                  setSelectedId(null);
                  return;
                }
                setSelectedId(targetId);
              }}
            />
          ) : null}
        </div>
      </div>

      {mobilePanelOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="패널 닫기"
            onClick={() => setMobilePanelOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border)]" aria-hidden />
            <LeftPanel sections={leftPanelSections} onSelect={handlePanelSelect} className="max-h-[60vh] overflow-y-auto" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
