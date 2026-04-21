import { describe, expect, it } from "vitest";
import { ANALYSIS_HEURISTIC_VERSION, ANALYSIS_SCHEMA_VERSION } from "@/lib/analysis/constants";
import { buildShaCacheKey } from "@/lib/analysis/cache";

describe("analysis cache keys", () => {
  it("includes the heuristic version so stale results do not survive analyzer changes", () => {
    expect(buildShaCacheKey("vercel", "next-learn", "abc123")).toBe(
      `${ANALYSIS_SCHEMA_VERSION}:${ANALYSIS_HEURISTIC_VERSION}:vercel/next-learn@abc123`
    );
  });
});
