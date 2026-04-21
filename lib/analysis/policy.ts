import { ANALYSIS_CACHE_TTL_MS } from "@/lib/analysis/constants";
import type { AnalyzeDeliveryMeta, AnalyzePolicyMeta, AnalyzeTargetMeta, GitHubAuthMode } from "@/lib/analysis/types";

const TOKENLESS_RATE_LIMIT_PER_HOUR = 60;

export function detectGitHubAuthMode(): GitHubAuthMode {
  return process.env.GITHUB_TOKEN ? "token" : "tokenless";
}

export function buildAnalyzePolicyMeta(): AnalyzePolicyMeta {
  const authMode = detectGitHubAuthMode();

  return {
    githubAuthMode: authMode,
    serverCacheTtlMs: ANALYSIS_CACHE_TTL_MS,
    serverInFlightDedupe: true,
    tokenlessRateLimitPerHour: authMode === "tokenless" ? TOKENLESS_RATE_LIMIT_PER_HOUR : null,
  };
}

export function buildAnalyzeTargetMeta(delivery?: AnalyzeDeliveryMeta): AnalyzeTargetMeta {
  return {
    policy: buildAnalyzePolicyMeta(),
    ...(delivery ? { delivery } : {}),
  };
}
