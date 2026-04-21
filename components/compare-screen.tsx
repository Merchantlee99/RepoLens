"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CompareLanding } from "@/components/compare-landing";
import { CompareLoading } from "@/components/compare-loading";
import { CompareWorkspace } from "@/components/compare-workspace";
import {
  buildCompareDiagnostics,
  buildCompareDiff,
  formatCompareDiagnostics,
  loadCachedCompareRepoPair,
  requestCompareRepoPair,
  validateCompareRepoInput,
  type CompareRepoPairState,
  type CompareRepoSlotState,
  type ValidatedCompareRepoTarget,
} from "@/components/compare-view-model";

type SlotValidation = {
  target: ValidatedCompareRepoTarget | null;
  error: string | null;
  rawInput: string;
};

function subscribeToHydration() {
  return () => {};
}

function validateSlot(input: string): SlotValidation {
  const rawInput = input.trim();
  try {
    return {
      target: validateCompareRepoInput(rawInput),
      error: null,
      rawInput,
    };
  } catch (error) {
    return {
      target: null,
      error:
        error instanceof Error
          ? error.message
          : "올바른 레포 URL이 아닙니다.",
      rawInput,
    };
  }
}

function fallbackTarget(slot: SlotValidation): ValidatedCompareRepoTarget {
  if (slot.target) return slot.target;
  return {
    owner: "",
    repo: "",
    canonicalUrl: slot.rawInput,
    label: slot.rawInput || "—",
  };
}

function slotStateFromValidation(slot: SlotValidation): CompareRepoSlotState {
  return {
    repoUrl: slot.target?.canonicalUrl ?? slot.rawInput,
    analysis: null,
    error: slot.error,
  };
}

export function CompareScreen({ a, b }: { a: string; b: string }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  const validation = useMemo(() => {
    if (!a || !b) return null;
    const slotA = validateSlot(a);
    const slotB = validateSlot(b);
    return {
      a: slotA,
      b: slotB,
      bothValid: Boolean(slotA.target && slotB.target),
    };
  }, [a, b]);

  // `refreshNonce` triggers a re-fetch without cache invalidation (used for
  // plain retries). `forceRefresh` additionally bypasses the local cache and
  // re-calls the API — used by "다시 분석".
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  const cachedPair = useMemo(() => {
    if (!hydrated || !validation?.bothValid || forceRefresh) return null;
    const pair = loadCachedCompareRepoPair({
      inputs: {
        a: validation.a.target!,
        b: validation.b.target!,
      },
      warnings: [],
    });
    const bothCached =
      pair.slots.a.analysis !== null && pair.slots.b.analysis !== null;
    return bothCached ? pair : null;
  }, [hydrated, validation, forceRefresh]);

  const [fetchedPair, setFetchedPair] = useState<CompareRepoPairState | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!hydrated || !validation || !validation.bothValid) {
      return;
    }
    // Cache satisfied; no fetch necessary.
    if (cachedPair && !forceRefresh) {
      return;
    }

    const aTarget = validation.a.target!;
    const bTarget = validation.b.target!;
    const currentForceRefresh = forceRefresh;
    const requestId = ++requestIdRef.current;

    requestCompareRepoPair(
      { inputs: { a: aTarget, b: bTarget }, warnings: [] },
      { forceRefresh: currentForceRefresh }
    )
      .then((next) => {
        if (requestIdRef.current !== requestId) return;
        setFetchedPair(next);
        setForceRefresh(false);

        if (
          next.slots.a.analysis &&
          next.slots.b.analysis &&
          typeof window !== "undefined" &&
          process.env.NODE_ENV !== "production"
        ) {
          const diff = buildCompareDiff(
            next.slots.a.analysis,
            next.slots.b.analysis
          );
          const diagnostics = buildCompareDiagnostics(diff);
          formatCompareDiagnostics(diagnostics).forEach((line) => {
            console.info(`[compare] ${line}`);
          });
        }
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setFetchedPair({
          inputs: { a: aTarget, b: bTarget },
          warnings: [],
          slots: {
            a: {
              repoUrl: aTarget.canonicalUrl,
              analysis: null,
              error: "비교 분석 요청에 실패했습니다.",
            },
            b: {
              repoUrl: bTarget.canonicalUrl,
              analysis: null,
              error: "비교 분석 요청에 실패했습니다.",
            },
          },
        });
        setForceRefresh(false);
      });
  }, [hydrated, validation, cachedPair, forceRefresh, refreshNonce]);

  if (!a || !b) {
    return <CompareLanding initialA={a} initialB={b} />;
  }

  if (!validation) {
    return <CompareLanding initialA={a} initialB={b} />;
  }

  const { a: slotA, b: slotB, bothValid } = validation;

  if (!bothValid) {
    const seededPair: CompareRepoPairState = {
      inputs: {
        a: fallbackTarget(slotA),
        b: fallbackTarget(slotB),
      },
      warnings: [],
      slots: {
        a: slotStateFromValidation(slotA),
        b: slotStateFromValidation(slotB),
      },
    };

    return (
      <CompareWorkspace
        pairState={seededPair}
        diff={null}
        fetching={false}
        blockedMessage="다른 레포 URL을 먼저 고쳐주세요."
        onRefresh={() => {
          setForceRefresh(true);
          setRefreshNonce((n) => n + 1);
        }}
        onRetryA={() => setRefreshNonce((n) => n + 1)}
        onRetryB={() => setRefreshNonce((n) => n + 1)}
      />
    );
  }

  const activePair = fetchedPair ?? cachedPair;

  if (!activePair) {
    return (
      <CompareLoading
        aLabel={slotA.target!.label}
        bLabel={slotB.target!.label}
      />
    );
  }

  const diff =
    activePair.slots.a.analysis && activePair.slots.b.analysis
      ? buildCompareDiff(
          activePair.slots.a.analysis,
          activePair.slots.b.analysis
        )
      : null;

  return (
    <CompareWorkspace
      pairState={activePair}
      diff={diff}
      fetching={forceRefresh}
      onRefresh={() => {
        setForceRefresh(true);
        setRefreshNonce((n) => n + 1);
      }}
      onRetryA={() => setRefreshNonce((n) => n + 1)}
      onRetryB={() => setRefreshNonce((n) => n + 1)}
    />
  );
}
