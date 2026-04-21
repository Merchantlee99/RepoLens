"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AnalysisStatusPanel,
  classifyAnalyzeError,
  type AnalysisStatusPanelProps,
} from "@/components/analysis-status-panel";
import { OwnerWorkspace } from "@/components/owner-workspace";
import { ResultWorkspace } from "@/components/result-workspace";
import {
  AnalyzeRequestError,
  isAnalyzeRequestError,
  loadCachedAnalysis,
  requestRepoAnalysis,
  saveCachedAnalysis,
} from "@/lib/analysis/client";
import type { AnalysisResult } from "@/lib/analysis/types";

function subscribeToHydration() {
  return () => {};
}

// Mirror of analyzing-screen heuristic: 1 path segment = owner, ≥2 = repo.
function detectTargetKind(url: string): "repo" | "owner" {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? "repo" : "owner";
  } catch {
    return "repo";
  }
}

export function ResultScreen({ repoUrl }: { repoUrl: string }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const cachedAnalysis = useMemo(
    () => (hydrated ? loadCachedAnalysis(repoUrl) : null),
    [hydrated, repoUrl]
  );
  const [fetchedState, setFetchedState] = useState<{
    repoUrl: string;
    analysis: AnalysisResult;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    repoUrl: string;
    status: AnalysisStatusPanelProps;
  } | null>(null);
  const fetchedAnalysis =
    fetchedState?.repoUrl === repoUrl ? fetchedState.analysis : null;
  const analysis = fetchedAnalysis ?? cachedAnalysis;
  const errorStatus =
    errorState?.repoUrl === repoUrl ? errorState.status : null;
  const targetKind = detectTargetKind(repoUrl);

  useEffect(() => {
    if (!hydrated || analysis) {
      return;
    }

    let cancelled = false;

    requestRepoAnalysis(repoUrl)
      .then((nextAnalysis) => {
        if (cancelled) {
          return;
        }

        saveCachedAnalysis(repoUrl, nextAnalysis);
        setFetchedState({
          repoUrl,
          analysis: nextAnalysis,
        });
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
                : "분석 결과를 불러오지 못했습니다.",
              { retryable: true }
            );
        setErrorState({
          repoUrl,
          status: classifyAnalyzeError(typedError, targetKind),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [analysis, hydrated, repoUrl, targetKind]);

  const loadingTitle =
    targetKind === "owner"
      ? "포트폴리오 결과를 준비하는 중입니다."
      : "분석 결과를 준비하는 중입니다.";
  const loadingBody =
    targetKind === "owner"
      ? "캐시에 결과가 없으면 이 owner의 공개 레포를 다시 훑어 결과를 복원합니다."
      : "캐시에 결과가 없으면 같은 레포를 다시 분석해 결과 워크스페이스를 복원합니다.";
  const backLabel = targetKind === "owner" ? "다른 owner 입력" : "다른 레포 입력";

  if (errorStatus) {
    return (
      <AnalysisStatusPanel
        props={errorStatus}
        repoUrl={repoUrl}
        backLabel={backLabel}
      />
    );
  }

  if (!analysis) {
    return (
      <section className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-[11px] font-medium text-[var(--fg-dim)]">결과 복원 중</p>
          <h1 className="mt-1.5 text-[16px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
            {loadingTitle}
          </h1>
          <p className="mt-3 text-[12.5px] leading-6 text-[var(--fg-muted)]">
            {loadingBody}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="pt-6">
      {analysis.kind === "repo" ? (
        <ResultWorkspace analysis={analysis} />
      ) : (
        <OwnerWorkspace analysis={analysis} />
      )}
    </div>
  );
}
