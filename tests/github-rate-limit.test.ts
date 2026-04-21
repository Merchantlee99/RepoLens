import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRepository, fetchTextFile } from "@/lib/analysis/github";

describe("github rate limit details", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      // @ts-expect-error cleanup for node test env
      delete globalThis.fetch;
    }
  });

  it("includes retryAfterSeconds for repository fetch failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: {
          "retry-after": "45",
          "x-ratelimit-reset": "9999999999",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-limit": "60",
        },
      })
    ) as typeof fetch;

    await expect(fetchRepository("vercel", "next.js")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      details: {
        path: "/repos/vercel/next.js",
        retryAfterSeconds: 45,
        authenticated: false,
        authMode: "tokenless",
        tokenlessRateLimitPerHour: 60,
      },
    });
  });

  it("derives retryAfterSeconds from rate limit reset when retry-after is absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T00:00:00Z"));
    const resetAtSeconds = Math.floor(Date.now() / 1000) + 12;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: {
          "x-ratelimit-reset": String(resetAtSeconds),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-limit": "60",
        },
      })
    ) as typeof fetch;

    await expect(fetchTextFile("openai", "openai-node", "README.md", "main")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      details: {
        path: "README.md",
        retryAfterSeconds: 12,
      },
    });
  });
});
