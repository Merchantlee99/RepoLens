import { describe, expect, it } from "vitest";
import { createAnalysisError, toErrorPayload, toErrorStatus } from "@/lib/analysis/errors";

describe("analysis errors", () => {
  it("maps typed analysis errors to stable API payloads", () => {
    const error = createAnalysisError("RATE_LIMITED", "GitHub API rate limit에 도달했습니다.", {
      resetAt: "12345",
    });

    expect(toErrorPayload(error)).toEqual({
      code: "RATE_LIMITED",
      message: "GitHub API rate limit에 도달했습니다.",
      retryable: true,
      details: {
        resetAt: "12345",
      },
    });
    expect(toErrorStatus(error)).toBe(429);
  });

  it("falls back unknown errors to ANALYSIS_FAILED", () => {
    const payload = toErrorPayload(new Error("unexpected"));

    expect(payload.code).toBe("ANALYSIS_FAILED");
    expect(payload.retryable).toBe(true);
    expect(toErrorStatus(new Error("unexpected"))).toBe(500);
  });
});
