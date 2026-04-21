import {
  ANALYSIS_CACHE_TTL_MS,
  ANALYSIS_HEURISTIC_VERSION,
  ANALYSIS_SCHEMA_VERSION,
} from "@/lib/analysis/constants";
import type { AnalysisResult } from "@/lib/analysis/types";

const analysisCache = new Map<string, { expiresAt: number; value: AnalysisResult }>();
const inFlight = new Map<string, Promise<AnalysisResult>>();

function isExpired(expiresAt: number) {
  return expiresAt <= Date.now();
}

export function buildShaCacheKey(owner: string, repo: string, sha: string) {
  return `${ANALYSIS_SCHEMA_VERSION}:${ANALYSIS_HEURISTIC_VERSION}:${owner}/${repo}@${sha}`;
}

export function buildOwnerCacheKey(owner: string, signature: string) {
  return `${ANALYSIS_SCHEMA_VERSION}:${ANALYSIS_HEURISTIC_VERSION}:owner:${owner}@${signature}`;
}

export function getCachedAnalysis(cacheKey: string): AnalysisResult | null {
  const entry = analysisCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (isExpired(entry.expiresAt)) {
    analysisCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

export function setCachedAnalysis(cacheKey: string, value: AnalysisResult) {
  analysisCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
  });
}

export function getInFlightAnalysis(cacheKey: string) {
  return inFlight.get(cacheKey) ?? null;
}

export function setInFlightAnalysis(cacheKey: string, promise: Promise<AnalysisResult>) {
  inFlight.set(cacheKey, promise);
}

export function clearInFlightAnalysis(cacheKey: string) {
  inFlight.delete(cacheKey);
}
