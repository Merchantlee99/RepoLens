import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimitStoreForTests,
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_POLICY,
} from "@/lib/analysis/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStoreForTests();
  });

  it("allows the first N requests within the window", () => {
    const { max } = RATE_LIMIT_POLICY.general;
    for (let i = 0; i < max; i++) {
      const result = checkRateLimit("203.0.113.1", RATE_LIMIT_POLICY.general);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the (N+1)-th request with retry-after seconds", () => {
    const policy = RATE_LIMIT_POLICY.general;
    for (let i = 0; i < policy.max; i++) {
      checkRateLimit("203.0.113.2", policy);
    }
    const blocked = checkRateLimit("203.0.113.2", policy);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(
        Math.ceil(policy.windowMs / 1000)
      );
      expect(blocked.limit).toBe(policy.max);
    }
  });

  it("keeps buckets isolated per IP", () => {
    const policy = RATE_LIMIT_POLICY.general;
    for (let i = 0; i < policy.max; i++) {
      checkRateLimit("203.0.113.3", policy);
    }
    const blocked = checkRateLimit("203.0.113.3", policy);
    expect(blocked.allowed).toBe(false);

    const allowed = checkRateLimit("203.0.113.4", policy);
    expect(allowed.allowed).toBe(true);
  });

  it("keeps buckets isolated per bucket name", () => {
    // forceRefresh 버킷을 소모해도 general은 여전히 통과해야 한다.
    const ip = "203.0.113.5";
    for (let i = 0; i < RATE_LIMIT_POLICY.forceRefresh.max; i++) {
      checkRateLimit(ip, RATE_LIMIT_POLICY.forceRefresh);
    }
    const blockedFR = checkRateLimit(ip, RATE_LIMIT_POLICY.forceRefresh);
    expect(blockedFR.allowed).toBe(false);

    const general = checkRateLimit(ip, RATE_LIMIT_POLICY.general);
    expect(general.allowed).toBe(true);
  });

  it("applies a tighter policy to forceRefresh than general", () => {
    // 정책이 의도대로 더 타이트한지 — general.max > forceRefresh.max.
    expect(RATE_LIMIT_POLICY.forceRefresh.max).toBeLessThan(
      RATE_LIMIT_POLICY.general.max
    );
    expect(RATE_LIMIT_POLICY.forceRefresh.windowMs).toBeGreaterThanOrEqual(
      RATE_LIMIT_POLICY.general.windowMs
    );
  });
});

describe("extractClientIp", () => {
  it("prefers the first value of x-forwarded-for", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-forwarded-for": "198.51.100.7, 10.0.0.1",
      },
    });
    expect(extractClientIp(request)).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-real-ip": "198.51.100.8",
      },
    });
    expect(extractClientIp(request)).toBe("198.51.100.8");
  });

  it("returns 'unknown' when no client headers are present", () => {
    const request = new Request("http://localhost/");
    expect(extractClientIp(request)).toBe("unknown");
  });
});
