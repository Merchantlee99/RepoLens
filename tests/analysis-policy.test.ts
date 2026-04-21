import { afterEach, describe, expect, it } from "vitest";
import { buildAnalyzePolicyMeta, buildAnalyzeTargetMeta, detectGitHubAuthMode } from "@/lib/analysis/policy";

describe("analysis policy metadata", () => {
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it("marks tokenless mode with a public rate limit budget", () => {
    delete process.env.GITHUB_TOKEN;

    expect(detectGitHubAuthMode()).toBe("tokenless");
    expect(buildAnalyzePolicyMeta()).toEqual({
      githubAuthMode: "tokenless",
      serverCacheTtlMs: 600000,
      serverInFlightDedupe: true,
      tokenlessRateLimitPerHour: 60,
    });
  });

  it("marks authenticated mode without tokenless rate limit budget", () => {
    process.env.GITHUB_TOKEN = "test-token";

    expect(detectGitHubAuthMode()).toBe("token");
    expect(buildAnalyzePolicyMeta()).toEqual({
      githubAuthMode: "token",
      serverCacheTtlMs: 600000,
      serverInFlightDedupe: true,
      tokenlessRateLimitPerHour: null,
    });
  });

  it("builds target metadata with optional delivery details", () => {
    const meta = buildAnalyzeTargetMeta({
      source: "server-cache",
      scope: "repo-sha",
      forceRefresh: false,
    });

    expect(meta.delivery).toEqual({
      source: "server-cache",
      scope: "repo-sha",
      forceRefresh: false,
    });
    expect(meta.policy.serverInFlightDedupe).toBe(true);
  });
});
