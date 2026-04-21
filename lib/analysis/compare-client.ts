import { isRepoAnalysis, type RepoAnalysis } from "@/lib/analysis/types";
import { loadCachedAnalysis, requestTargetAnalysis, saveCachedAnalysis } from "@/lib/analysis/client";
import {
  buildCompareWarnings,
  validateCompareRepoInput,
  type ValidatedCompareRepoTarget,
} from "@/lib/analysis/compare";

export type ValidatedCompareRepoPair = {
  inputs: {
    a: ValidatedCompareRepoTarget;
    b: ValidatedCompareRepoTarget;
  };
  warnings: string[];
};

export type CompareRepoSlotState = {
  repoUrl: string;
  analysis: RepoAnalysis | null;
  error: string | null;
};

export type CompareRepoPairState = {
  inputs: {
    a: ValidatedCompareRepoTarget;
    b: ValidatedCompareRepoTarget;
  };
  warnings: string[];
  slots: {
    a: CompareRepoSlotState;
    b: CompareRepoSlotState;
  };
};

const REPO_ONLY_COMPARE_ERROR = "비교 모드는 repo URL만 지원합니다.";

function toRepoSlotState(repoUrl: string, value: unknown): CompareRepoSlotState {
  if (!value) {
    return {
      repoUrl,
      analysis: null,
      error: null,
    };
  }

  if (!isRepoAnalysis(value as Parameters<typeof isRepoAnalysis>[0])) {
    return {
      repoUrl,
      analysis: null,
      error: REPO_ONLY_COMPARE_ERROR,
    };
  }

  return {
    repoUrl,
    analysis: value as RepoAnalysis,
    error: null,
  };
}

export function validateCompareRepoPair(aInput: string, bInput: string): ValidatedCompareRepoPair {
  const a = validateCompareRepoInput(aInput);
  const b = validateCompareRepoInput(bInput);

  return {
    inputs: { a, b },
    warnings: buildCompareWarnings(a.canonicalUrl, b.canonicalUrl),
  };
}

export function loadCachedCompareRepoPair(pair: ValidatedCompareRepoPair): CompareRepoPairState {
  return {
    inputs: pair.inputs,
    warnings: pair.warnings,
    slots: {
      a: toRepoSlotState(
        pair.inputs.a.canonicalUrl,
        loadCachedAnalysis(pair.inputs.a.canonicalUrl)
      ),
      b: toRepoSlotState(
        pair.inputs.b.canonicalUrl,
        loadCachedAnalysis(pair.inputs.b.canonicalUrl)
      ),
    },
  };
}

async function requestRepoSlot(
  input: ValidatedCompareRepoTarget,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<CompareRepoSlotState> {
  try {
    const analysis = await requestTargetAnalysis(input.canonicalUrl, options);

    if (!isRepoAnalysis(analysis)) {
      return {
        repoUrl: input.canonicalUrl,
        analysis: null,
        error: REPO_ONLY_COMPARE_ERROR,
      };
    }

    saveCachedAnalysis(input.canonicalUrl, analysis);
    return {
      repoUrl: input.canonicalUrl,
      analysis,
      error: null,
    };
  } catch (error) {
    return {
      repoUrl: input.canonicalUrl,
      analysis: null,
      error:
        error instanceof Error ? error.message : "레포 비교용 분석 결과를 불러오지 못했습니다.",
    };
  }
}

export async function requestCompareRepoPair(
  pair: ValidatedCompareRepoPair,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<CompareRepoPairState> {
  const [a, b] = await Promise.all([
    requestRepoSlot(pair.inputs.a, options),
    requestRepoSlot(pair.inputs.b, options),
  ]);

  return {
    inputs: pair.inputs,
    warnings: pair.warnings,
    slots: {
      a,
      b,
    },
  };
}
