"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AnalysisStatusPanel,
  classifyAnalyzeError,
  type AnalysisStatusPanelProps,
} from "@/components/analysis-status-panel";
import { ResultSkeleton } from "@/components/result-skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AnalyzeRequestError,
  isAnalyzeRequestError,
  loadCachedAnalysis,
  requestRepoAnalysis,
  saveCachedAnalysis,
} from "@/lib/analysis/client";

// 순환 라벨 — 실제 분석 단계와 1:1 대응은 아니지만, 흐름을 감지한 카피로
// "무엇을 보는 중인지" 상상 가능하게 한다. 교체 주기를 짧게 하면 오히려
// "뭐가 loop만 돌고 있네" 인상이라 2.4s로 늘렸음.
const REPO_STATUS_STEPS = [
  "프로젝트 종류 파악 중",
  "README · 코드 요약 정리 중",
  "기술 스택 · 레이어 정리 중",
];

const OWNER_STATUS_STEPS = [
  "공개 레포 살펴보는 중",
  "대표 레포 추려내는 중",
  "포트폴리오 정리 중",
];

// 분석이 길어질 때(큰 레포) 사용자에게 정직한 안내를 주는 threshold.
const LONG_WAIT_MS = 8000;

// Path-based URL kind heuristic. Exactly 1 path segment = owner profile;
// 2+ segments = repo. Matches the backend validator behavior.
function detectTargetKind(url: string): "repo" | "owner" {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? "repo" : "owner";
  } catch {
    return "repo";
  }
}

function subscribeToHydration() {
  return () => {};
}

function formatRepoLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parsed.host}/${parts[0]}/${parts[1]}`;
    }
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function resultHrefForAnalysis(repoUrl: string, analysis?: { kind: "repo"; repo: { url: string; sha: string } } | { kind: "owner"; owner: { url: string } } | null) {
  if (!analysis) {
    return `/result?repoUrl=${encodeURIComponent(repoUrl)}`;
  }

  if (analysis.kind === "repo") {
    return `/result?repoUrl=${encodeURIComponent(analysis.repo.url)}&sha=${analysis.repo.sha}`;
  }

  return `/result?repoUrl=${encodeURIComponent(analysis.owner.url)}`;
}

export function AnalyzingScreen({ repoUrl }: { repoUrl: string }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const cachedAnalysis = useMemo(
    () => (hydrated ? loadCachedAnalysis(repoUrl) : null),
    [hydrated, repoUrl]
  );
  const [activeStep, setActiveStep] = useState(0);
  const [errorPanel, setErrorPanel] = useState<AnalysisStatusPanelProps | null>(null);
  const [runId, setRunId] = useState(0);
  const [longWait, setLongWait] = useState(false);
  const targetKind = detectTargetKind(repoUrl);
  const statusSteps = targetKind === "owner" ? OWNER_STATUS_STEPS : REPO_STATUS_STEPS;
  const mainStatus =
    targetKind === "owner"
      ? "포트폴리오를 훑어보는 중이에요."
      : "README보다 먼저 읽을 화면을 준비하는 중이에요.";

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (cachedAnalysis) {
      router.replace(resultHrefForAnalysis(repoUrl, cachedAnalysis));
      return;
    }

    let cancelled = false;
    // longWait 리셋은 실제 딜레이 이후에만 값이 바뀌도록 — 초기 false는
    // useState default로 충분하다. 재시도(runId 증가) 시에는 onRetry에서 이미
    // setLongWait(false) 호출.
    const stepTimer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % statusSteps.length);
    }, 2400);
    const longWaitTimer = window.setTimeout(() => {
      if (!cancelled) setLongWait(true);
    }, LONG_WAIT_MS);

    requestRepoAnalysis(repoUrl)
      .then((analysis) => {
        if (cancelled) {
          return;
        }

        saveCachedAnalysis(repoUrl, analysis);
        router.replace(resultHrefForAnalysis(repoUrl, analysis));
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        const typedError: AnalyzeRequestError = isAnalyzeRequestError(requestError)
          ? requestError
          : new AnalyzeRequestError(
              "ANALYSIS_FAILED",
              requestError instanceof Error
                ? requestError.message
                : "분석하는 중에 알 수 없는 문제가 생겼어요.",
              { retryable: true }
            );
        setErrorPanel(classifyAnalyzeError(typedError, targetKind));
      });

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
      window.clearTimeout(longWaitTimer);
    };
  }, [cachedAnalysis, hydrated, repoUrl, router, runId, statusSteps.length, targetKind]);

  if (errorPanel) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)]">
        <header className="flex items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)] hover:text-[var(--accent)]"
          >
            RepoLens
          </Link>
          <ThemeToggle />
        </header>
        <AnalysisStatusPanel
          props={errorPanel}
          repoUrl={repoUrl}
          backLabel={targetKind === "owner" ? "다른 owner 입력" : "다른 주소 입력"}
          onRetry={() => {
            setErrorPanel(null);
            setActiveStep(0);
            setLongWait(false);
            setRunId((current) => current + 1);
          }}
        />
      </div>
    );
  }

  const repoLabel = formatRepoLabel(repoUrl);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)] hover:text-[var(--accent)]"
        >
          RepoLens
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-6">
        <div className="w-full max-w-[1040px]">
          <div className="text-center">
            <p className="text-[15px] text-[var(--fg)]">{mainStatus}</p>
            <p className="mt-1.5 break-all font-mono text-[12.5px] text-[var(--fg-muted)]">
              {repoLabel}
            </p>
          </div>

          <ul
            className="mx-auto mt-4 w-fit space-y-1.5"
            aria-live="polite"
          >
            {statusSteps.map((step, index) => {
              const isActive = index === activeStep;
              return (
                <li
                  key={step}
                  className={`flex items-center gap-2.5 text-[12.5px] transition-colors ${
                    isActive ? "text-[var(--fg)]" : "text-[var(--fg-dim)]"
                  }`}
                >
                  <StatusDot active={isActive} />
                  <span>{step}</span>
                </li>
              );
            })}
          </ul>

          {longWait ? (
            <p className="mx-auto mt-2 max-w-[480px] text-center text-[11.5px] text-[var(--fg-dim)]">
              큰 레포이거나 GitHub 무료 한도(시간당 60회)를 쓰는 경우 조금 더 걸릴 수 있어요. 조금만 기다려주세요.
            </p>
          ) : null}

          <div className="mt-6">
            <ResultSkeleton />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="relative inline-flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full border border-[var(--border-strong)]"
    />
  );
}
