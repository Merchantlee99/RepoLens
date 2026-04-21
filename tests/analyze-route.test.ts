import { beforeEach, describe, expect, it, vi } from "vitest";

const analyzePublicTargetWithMeta = vi.fn();
const validateAnalyzeRepoRequest = vi.fn();
const createAnalysisError = vi.fn();
const toErrorPayload = vi.fn();
const toErrorStatus = vi.fn();
const buildAnalyzeTargetMeta = vi.fn();

vi.mock("@/lib/analysis/analyzer", () => ({
  analyzePublicTargetWithMeta,
}));

vi.mock("@/lib/analysis/validators", () => ({
  validateAnalyzeRepoRequest,
}));

vi.mock("@/lib/analysis/errors", () => ({
  createAnalysisError,
  toErrorPayload,
  toErrorStatus,
}));

vi.mock("@/lib/analysis/policy", () => ({
  buildAnalyzeTargetMeta,
}));

describe("analyze route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns analysis data with delivery meta on success", async () => {
    validateAnalyzeRepoRequest.mockReturnValue({
      repoUrl: "https://github.com/vercel/next-learn",
      forceRefresh: false,
    });
    analyzePublicTargetWithMeta.mockResolvedValue({
      analysis: {
        kind: "owner",
        schemaVersion: "mvp-v3",
        owner: {
          login: "vercel",
          url: "https://github.com/vercel",
          avatarUrl: null,
          profileType: "organization",
          displayName: "Vercel",
          description: null,
          blog: null,
          location: null,
        },
        summary: {
          oneLiner: "owner summary",
          ownerTypeLabel: "오가니제이션",
          publicRepoCount: 1,
          sampledRepoCount: 1,
          enrichedRepoCount: 1,
          commonStacks: [],
          commonLanguages: [],
          keyThemes: [],
          recommendedStartingPoints: [],
        },
        portfolio: {
          featuredRepos: [],
          beginnerRepos: [],
          latestRepos: [],
          categories: [],
        },
        facts: [],
        warnings: [],
        limitations: [],
      },
      meta: {
        policy: {
          githubAuthMode: "tokenless",
          serverCacheTtlMs: 600000,
          serverInFlightDedupe: true,
          tokenlessRateLimitPerHour: 60,
        },
        delivery: {
          source: "server-cache",
          scope: "owner-signature",
          forceRefresh: false,
        },
      },
    });

    const { POST } = await import("@/app/api/analyze/route");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ repoUrl: "https://github.com/vercel" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({ kind: "owner" }),
      meta: {
        policy: {
          githubAuthMode: "tokenless",
          serverCacheTtlMs: 600000,
          serverInFlightDedupe: true,
          tokenlessRateLimitPerHour: 60,
        },
        delivery: {
          source: "server-cache",
          scope: "owner-signature",
          forceRefresh: false,
        },
      },
    });
  });

  it("returns policy meta on failure", async () => {
    const error = new Error("boom");
    validateAnalyzeRepoRequest.mockReturnValue({
      repoUrl: "https://github.com/vercel/next-learn",
      forceRefresh: false,
    });
    analyzePublicTargetWithMeta.mockRejectedValue(error);
    toErrorPayload.mockReturnValue({
      code: "RATE_LIMITED",
      message: "GitHub API rate limit에 도달했습니다.",
      retryable: true,
      details: {
        retryAfterSeconds: 45,
        authenticated: false,
      },
    });
    toErrorStatus.mockReturnValue(429);
    buildAnalyzeTargetMeta.mockReturnValue({
      policy: {
        githubAuthMode: "tokenless",
        serverCacheTtlMs: 600000,
        serverInFlightDedupe: true,
        tokenlessRateLimitPerHour: 60,
      },
    });

    const { POST } = await import("@/app/api/analyze/route");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ repoUrl: "https://github.com/vercel/next-learn" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("Retry-After")).toBe("45");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "GitHub API rate limit에 도달했습니다.",
        retryable: true,
        details: {
          retryAfterSeconds: 45,
          authenticated: false,
        },
      },
      meta: {
        policy: {
          githubAuthMode: "tokenless",
          serverCacheTtlMs: 600000,
          serverInFlightDedupe: true,
          tokenlessRateLimitPerHour: 60,
        },
      },
    });
  });

  it("preserves long retry-after values without clamping", async () => {
    const error = new Error("boom");
    validateAnalyzeRepoRequest.mockReturnValue({
      repoUrl: "https://github.com/vercel/next-learn",
      forceRefresh: false,
    });
    analyzePublicTargetWithMeta.mockRejectedValue(error);
    toErrorPayload.mockReturnValue({
      code: "RATE_LIMITED",
      message: "GitHub API rate limit에 도달했습니다.",
      retryable: true,
      details: {
        retryAfterSeconds: 5400,
        authenticated: false,
      },
    });
    toErrorStatus.mockReturnValue(429);
    buildAnalyzeTargetMeta.mockReturnValue({
      policy: {
        githubAuthMode: "tokenless",
        serverCacheTtlMs: 600000,
        serverInFlightDedupe: true,
        tokenlessRateLimitPerHour: 60,
      },
    });

    const { POST } = await import("@/app/api/analyze/route");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ repoUrl: "https://github.com/vercel/next-learn" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("Retry-After")).toBe("5400");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "GitHub API rate limit에 도달했습니다.",
        retryable: true,
        details: {
          retryAfterSeconds: 5400,
          authenticated: false,
        },
      },
      meta: {
        policy: {
          githubAuthMode: "tokenless",
          serverCacheTtlMs: 600000,
          serverInFlightDedupe: true,
          tokenlessRateLimitPerHour: 60,
        },
      },
    });
  });

  it("rejects cross-origin browser requests before analysis starts", async () => {
    const forbiddenError = new Error("forbidden");
    createAnalysisError.mockReturnValue(forbiddenError);
    toErrorPayload.mockReturnValue({
      code: "FORBIDDEN",
      message: "다른 사이트에서는 분석 API를 직접 호출할 수 없습니다.",
      retryable: false,
    });
    toErrorStatus.mockReturnValue(403);
    buildAnalyzeTargetMeta.mockReturnValue({
      policy: {
        githubAuthMode: "tokenless",
        serverCacheTtlMs: 600000,
        serverInFlightDedupe: true,
        tokenlessRateLimitPerHour: 60,
      },
    });

    const { POST } = await import("@/app/api/analyze/route");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ repoUrl: "https://github.com/vercel/next-learn" }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
        },
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(validateAnalyzeRepoRequest).not.toHaveBeenCalled();
    expect(analyzePublicTargetWithMeta).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "다른 사이트에서는 분석 API를 직접 호출할 수 없습니다.",
        retryable: false,
      },
      meta: {
        policy: {
          githubAuthMode: "tokenless",
          serverCacheTtlMs: 600000,
          serverInFlightDedupe: true,
          tokenlessRateLimitPerHour: 60,
        },
      },
    });
  });
});
