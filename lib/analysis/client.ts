import type {
  AnalysisResult,
  AnalyzeRepoErrorPayload,
  AnalyzeTargetMeta,
  AnalyzeTargetResponse,
  CloudService,
} from "@/lib/analysis/types";
import { validateGitHubTargetUrlInput } from "@/lib/analysis/validators";

const recentMeta = new Map<string, AnalyzeTargetMeta>();

/** 최근 응답의 meta(policy/delivery)를 UI가 조회할 수 있게 모듈 레벨에 보관.
 * 호출 키는 normalizeRepoUrlKey 기준 — 캐시 키와 동일하다. */
export function getRecentAnalyzeMeta(repoUrl: string): AnalyzeTargetMeta | null {
  return recentMeta.get(normalizeRepoUrlKey(repoUrl)) ?? null;
}

// 분석 요청 실패를 UI가 분기해서 렌더할 수 있도록 구조화해서 던지는 에러.
// 기존에는 plain string이었는데, rate-limit / tokenless / invalid-URL 같은
// 상태를 서로 다른 status panel로 표현해야 해서 code + details를 보존한다.
export class AnalyzeRequestError extends Error {
  code: string;
  retryable: boolean;
  details?: Record<string, string | number | boolean | null>;

  constructor(
    code: string,
    message: string,
    opts: {
      retryable?: boolean;
      details?: Record<string, string | number | boolean | null>;
    } = {}
  ) {
    super(message);
    this.name = "AnalyzeRequestError";
    this.code = code;
    this.retryable = opts.retryable ?? true;
    this.details = opts.details;
  }
}

export function isAnalyzeRequestError(value: unknown): value is AnalyzeRequestError {
  return value instanceof AnalyzeRequestError;
}

const ANALYSIS_CACHE_PREFIX = "repolens:analysis:";
const CLIENT_ANALYSIS_CACHE_VERSION = 8;
const inFlightRequests = new Map<string, Promise<AnalysisResult>>();
const recentResults = new Map<string, { value: AnalysisResult; expiresAt: number }>();
const RECENT_RESULT_TTL_MS = 10_000;

type CachedAnalysisEnvelope = {
  version: number;
  analysis: AnalysisResult;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackCloudService(label: string): CloudService {
  return {
    label,
    canonicalId: slugify(label),
    kind: "other",
  };
}

function fallbackCoverageTrustSummary(
  analysis: Extract<AnalysisResult, { kind: "repo" }>
) {
  const level = analysis.coverage.level;
  return {
    level,
    headline:
      level === "limited"
        ? "대표 경로 기준으로 구조를 정리했습니다."
        : level === "partial"
          ? "핵심 구조는 정리했고, 일부 코드는 보조 범위로 남았습니다."
          : "표시 범위의 구조를 사실 기반으로 정리했습니다.",
    detail: analysis.coverage.details[0] ?? null,
    reasons: [],
    omissions: [],
    basedOn: [],
    approximate: level === "limited" || !analysis.coverage.supportedStackDetected,
  } as const;
}

function normalizeRepoLearning(analysis: Extract<AnalysisResult, { kind: "repo" }>) {
  const defaultIdentity = {
    plainTitle: analysis.summary.projectType,
    projectKind: analysis.summary.projectType,
    consumptionMode: "unknown" as const,
    useCase: null,
    audience: null,
    outputType: null,
    coreStack: analysis.summary.stack.slice(0, 5),
    stackNarrative: null,
    stackHighlights: [],
    header: {
      subtitle: null,
      points: [],
    },
    startHere: {
      path: analysis.summary.recommendedStartFile ?? null,
      reason: analysis.summary.recommendedStartReason ?? null,
    },
    readOrder: [
      {
        label: "대표 파일 보기",
        path: analysis.summary.recommendedStartFile ?? null,
        reason:
          analysis.summary.recommendedStartReason ??
          "이 파일부터 보면 전체 구조를 이해하기 쉽습니다.",
      },
    ],
    trust: {
      source: "code" as const,
      note: null,
    },
  };
  const identitySource = analysis.learning.identity ?? defaultIdentity;
  const identity = {
    ...defaultIdentity,
    ...identitySource,
    consumptionMode: identitySource.consumptionMode ?? "unknown",
    stackNarrative: identitySource.stackNarrative ?? null,
    stackHighlights: (identitySource.stackHighlights ?? []).map((item) => ({
      name: item.name,
      role: item.role,
      examplePath: item.examplePath ?? null,
    })),
    header: {
      subtitle: identitySource.header?.subtitle ?? null,
      points: identitySource.header?.points ?? [],
    },
  };

  const readmeCore = analysis.learning.readmeCore ?? {
    summary: null,
    keyPoints: [],
    audience: null,
    quickstart: [],
    links: [],
    architectureNotes: [],
    source: "none" as const,
  };

  const stackGlossary = (analysis.learning.stackGlossary ?? []).map((item) => ({
    ...item,
    usedFor: item.usedFor ?? null,
    examplePaths: item.examplePaths ?? [],
  }));

  return {
    ...analysis.learning,
    identity,
    readmeCore,
    stackGlossary,
    environment: {
      ...analysis.learning.environment,
      runtimes: (analysis.learning.environment.runtimes ?? []).map((runtime) => ({
        ...runtime,
        minMajor: runtime.minMajor ?? null,
        maxMajor: runtime.maxMajor ?? null,
        range: runtime.range ?? "unknown",
      })),
      container: {
        ...analysis.learning.environment.container,
        composeServiceCount:
          analysis.learning.environment.container.composeServiceCount ??
          (analysis.learning.environment.container.composeServices?.length ?? 0),
        needsMultiContainer:
          analysis.learning.environment.container.needsMultiContainer ??
          ((analysis.learning.environment.container.composeServices?.length ?? 0) >= 2),
        dockerRole:
          analysis.learning.environment.container.dockerRole ??
          (analysis.learning.environment.container.hasDockerfile ||
          analysis.learning.environment.container.hasDockerCompose
            ? "optional-deploy"
            : "none"),
      },
      hardware: {
        ...analysis.learning.environment.hardware,
        minVramGb: analysis.learning.environment.hardware.minVramGb ?? null,
        cpuArch: analysis.learning.environment.hardware.cpuArch ?? "any",
        acceleratorPreference:
          analysis.learning.environment.hardware.acceleratorPreference ?? null,
      },
      cloud: {
        ...analysis.learning.environment.cloud,
        deployTargetRequired:
          analysis.learning.environment.cloud.deployTargetRequired ?? null,
        servicesRequired: analysis.learning.environment.cloud.servicesRequired ?? [],
        servicesOptional: analysis.learning.environment.cloud.servicesOptional ?? [],
        apiServicesRequired:
          analysis.learning.environment.cloud.apiServicesRequired ??
          analysis.learning.environment.cloud.servicesRequired ??
          [],
        apiServicesOptional:
          analysis.learning.environment.cloud.apiServicesOptional ??
          analysis.learning.environment.cloud.servicesOptional ??
          [],
        servicesRequiredDetails:
          analysis.learning.environment.cloud.servicesRequiredDetails ??
          (analysis.learning.environment.cloud.servicesRequired ?? []).map(fallbackCloudService),
        servicesOptionalDetails:
          analysis.learning.environment.cloud.servicesOptionalDetails ??
          (analysis.learning.environment.cloud.servicesOptional ?? []).map(fallbackCloudService),
      },
      runtimeMode: analysis.learning.environment.runtimeMode ?? "local-or-cloud",
      costEstimate: {
        tier: analysis.learning.environment.costEstimate?.tier ?? "free",
        monthlyUsdLow: analysis.learning.environment.costEstimate?.monthlyUsdLow ?? null,
        monthlyUsdHigh: analysis.learning.environment.costEstimate?.monthlyUsdHigh ?? null,
        drivers: analysis.learning.environment.costEstimate?.drivers ?? [],
      },
    },
  };
}

function normalizeAnalysisResult(analysis: AnalysisResult): AnalysisResult {
  if (analysis.kind !== "repo") {
    return analysis;
  }

  return {
    ...analysis,
    learning: normalizeRepoLearning(analysis),
    coverage: {
      ...analysis.coverage,
      trustSummary:
        analysis.coverage.trustSummary ?? fallbackCoverageTrustSummary(analysis),
    },
  };
}

function cacheKey(repoUrl: string) {
  return `${ANALYSIS_CACHE_PREFIX}${normalizeRepoUrlKey(repoUrl)}`;
}

function normalizeRepoUrlKey(repoUrl: string) {
  const trimmed = repoUrl.trim();

  try {
    return validateGitHubTargetUrlInput(trimmed).canonicalUrl;
  } catch {
    return trimmed;
  }
}

function getRecentResult(repoUrl: string) {
  const entry = recentResults.get(repoUrl);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    recentResults.delete(repoUrl);
    return null;
  }

  return entry.value;
}

function setRecentResult(repoUrl: string, value: AnalysisResult) {
  recentResults.set(repoUrl, {
    value,
    expiresAt: Date.now() + RECENT_RESULT_TTL_MS,
  });
}

function formatRateLimitReset(resetAt: string | number | boolean | null | undefined) {
  if (typeof resetAt !== "string" && typeof resetAt !== "number") {
    return null;
  }

  const epoch = Number(resetAt);

  if (!Number.isFinite(epoch)) {
    return null;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(epoch * 1000));
}

function formatAnalyzeError(payload: AnalyzeTargetResponse) {
  if (payload.ok) {
    return "분석 요청에 실패했습니다.";
  }

  if (payload.error.code !== "RATE_LIMITED") {
    return payload.error.message;
  }

  const resetAt = formatRateLimitReset(payload.error.details?.resetAt);
  const authenticated = payload.error.details?.authenticated === true;

  if (!authenticated && resetAt) {
    return `GitHub API rate limit에 도달했습니다. 현재 서버에 GITHUB_TOKEN이 없어 비인증 한도(시간당 60회)를 사용 중입니다. ${resetAt} 이후 다시 시도하거나 GITHUB_TOKEN을 설정해 주세요.`;
  }

  if (!authenticated) {
    return "GitHub API rate limit에 도달했습니다. 현재 서버에 GITHUB_TOKEN이 없어 비인증 한도(시간당 60회)를 사용 중입니다. 잠시 후 다시 시도하거나 GITHUB_TOKEN을 설정해 주세요.";
  }

  if (resetAt) {
    return `GitHub API rate limit에 도달했습니다. ${resetAt} 이후 다시 시도해 주세요.`;
  }

  return payload.error.message;
}

export async function requestTargetAnalysis(
  repoUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<AnalysisResult> {
  const requestKey = normalizeRepoUrlKey(repoUrl);
  const forceRefresh = options?.forceRefresh === true;
  const recent = forceRefresh ? null : getRecentResult(requestKey);

  if (recent) {
    return recent;
  }

  const existing = forceRefresh ? null : inFlightRequests.get(requestKey);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repoUrl, forceRefresh }),
    });

    const payload = (await response.json()) as AnalyzeTargetResponse;

    if (!response.ok || !payload.ok) {
      const errorPayload: AnalyzeRepoErrorPayload | null =
        !payload.ok ? payload.error : null;
      // Retry-After 헤더를 같이 붙여둔다. 429에서 details.retryAfterSeconds가
      // 없어도 헤더 값으로 countdown 카피를 보일 수 있도록.
      const retryAfterHeader =
        typeof response.headers?.get === "function"
          ? response.headers.get("Retry-After")
          : null;
      const details: Record<string, string | number | boolean | null> = {
        ...(errorPayload?.details ?? {}),
      };
      if (retryAfterHeader && !("retryAfterSeconds" in details)) {
        const n = Number(retryAfterHeader);
        if (Number.isFinite(n) && n >= 0) {
          details.retryAfterSeconds = n;
        }
      }
      if (!payload.ok && payload.meta?.policy?.githubAuthMode) {
        details.githubAuthMode = payload.meta.policy.githubAuthMode;
      }
      throw new AnalyzeRequestError(
        errorPayload?.code ?? "ANALYSIS_FAILED",
        formatAnalyzeError(payload),
        {
          retryable: errorPayload?.retryable ?? true,
          details,
        }
      );
    }

    const normalized = normalizeAnalysisResult(payload.data);
    setRecentResult(requestKey, normalized);
    if (payload.meta) {
      recentMeta.set(requestKey, payload.meta);
    }
    return normalized;
  })();

  inFlightRequests.set(requestKey, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(requestKey);
  }
}

export async function requestRepoAnalysis(repoUrl: string): Promise<AnalysisResult> {
  return requestTargetAnalysis(repoUrl);
}

export function loadCachedAnalysis(repoUrl: string): AnalysisResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = cacheKey(repoUrl);
  const raw = window.sessionStorage.getItem(storageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedAnalysisEnvelope | AnalysisResult;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "analysis" in parsed &&
      parsed.version === CLIENT_ANALYSIS_CACHE_VERSION
    ) {
      return normalizeAnalysisResult(parsed.analysis);
    }

    window.sessionStorage.removeItem(storageKey);
    return null;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function saveCachedAnalysis(repoUrl: string, analysis: AnalysisResult) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeAnalysisResult(analysis);
  const value = JSON.stringify({
    version: CLIENT_ANALYSIS_CACHE_VERSION,
    analysis: normalized,
  } satisfies CachedAnalysisEnvelope);
  window.sessionStorage.setItem(cacheKey(repoUrl), value);
  window.sessionStorage.setItem(
    cacheKey(normalized.kind === "repo" ? normalized.repo.url : normalized.owner.url),
    value
  );
}
