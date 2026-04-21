import type { AnalysisMode } from "@/lib/analysis/types";

export const ANALYSIS_SCHEMA_VERSION = "mvp-v3" as const;
export const ANALYSIS_HEURISTIC_VERSION = "2026-04-21-compare-env-v1" as const;

export const ANALYSIS_LIMITS = {
  maxSourceFilesBeforeLimited: 4000,
  maxFilteredFilesBeforeLimited: 1200,
  maxPrunedFilesInLimitedMode: 260,
  maxFocusRootFilesInLimitedMode: 140,
  maxGlobalConfigFilesInLimitedMode: 24,
  maxReadmeFilesInLimitedMode: 4,
  maxManifestFilesInLimitedMode: 8,
  maxRepresentativeContentFilesInFullMode: 12,
  maxRepresentativeContentFilesInLimitedMode: 6,
  maxRepresentativeRootConfigFiles: 6,
  maxRepresentativeFocusFiles: 8,
  maxRepresentativeContentFileBytes: 64000,
} as const;

export const SUPPORTED_STACK_MARKERS = ["Next.js", "React", "Vue", "Node.js"] as const;

export const ANALYSIS_MODE_LABEL: Record<AnalysisMode, string> = {
  full: "전체 분석",
  limited: "제한 분석",
};

export const ANALYSIS_CACHE_TTL_MS = 1000 * 60 * 10;
export const GITHUB_FETCH_TIMEOUT_MS = 1000 * 20;
