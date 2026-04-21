import { describe, expect, it } from "vitest";
import {
  applyRateLimitObservation,
  DEFAULT_RATE_LIMIT_CANDIDATE_ID,
} from "@/scripts/regression-candidate-utils.mjs";

function candidateFile() {
  return {
    version: 1,
    updatedAt: "2026-04-21",
    policy: {
      selectionRule: "test",
      promotionChecklist: ["a"],
      probeProtocol: ["b"],
    },
    candidates: [
      {
        id: DEFAULT_RATE_LIMIT_CANDIDATE_ID,
        title: "Observe rate limit",
        targetKind: "rate-limit",
        status: "observing",
        priority: "low",
        probeMode: "observe-live-429",
        selectionHint: "watch",
        expectationFocus: ["error.details.retryAfterSeconds"],
        notes: "waiting",
        observed: {
          lastObservedAt: "2026-04-21T00:00:00.000Z",
          retryAfterSeconds: 289,
          authMode: "token",
        },
      },
    ],
  };
}

describe("regression candidate utilities", () => {
  it("keeps the rate-limit candidate in observing status below the long-countdown threshold", () => {
    const data = candidateFile();
    const summary = applyRateLimitObservation(data, {
      candidateId: DEFAULT_RATE_LIMIT_CANDIDATE_ID,
      repoUrl: "https://github.com/vercel/next-learn",
      retryAfterSeconds: 900,
      authMode: "token",
      observedAt: "2026-04-21T12:00:00.000Z",
      thresholdSeconds: 3600,
    });

    expect(summary.status).toBe("observing");
    expect(data.updatedAt).toBe("2026-04-21");
    expect(data.candidates[0]?.status).toBe("observing");
    expect(data.candidates[0]?.observed).toEqual({
      lastObservedAt: "2026-04-21T12:00:00.000Z",
      retryAfterSeconds: 900,
      authMode: "token",
    });
    expect(data.candidates[0]?.notes).toContain(">=3600s");
  });

  it("moves the rate-limit candidate to ready-for-regression at or above the threshold", () => {
    const data = candidateFile();
    const summary = applyRateLimitObservation(data, {
      candidateId: DEFAULT_RATE_LIMIT_CANDIDATE_ID,
      repoUrl: "https://github.com/vercel/next-learn",
      retryAfterSeconds: 5400,
      authMode: "tokenless",
      observedAt: "2026-04-21T13:00:00.000Z",
      thresholdSeconds: 3600,
    });

    const candidate = data.candidates[0] as {
      status: string;
      repoUrl?: string;
      notes: string;
    };

    expect(summary.status).toBe("ready-for-regression");
    expect(candidate.status).toBe("ready-for-regression");
    expect(candidate.repoUrl).toBe("https://github.com/vercel/next-learn");
    expect(candidate.notes).toContain("ready to promote");
  });
});
