// 간단한 IP 기반 토큰버킷 스타일 슬라이딩 윈도우 rate limiter.
//
// 설계 목표
// - 1차 방어선. 정교한 분산 limit은 Upstash/KV로 올리면 되지만,
//   현재 트래픽 규모에선 in-memory만으로도 개별 IP의 bot 연타를 크게 줄여준다.
// - Vercel serverless 특성상 인스턴스마다 메모리가 분리된다. 같은 IP가 다른
//   function 인스턴스에 번갈아 떨어지면 정확한 글로벌 카운트는 아니지만,
//   bursting 억제에는 여전히 유효하다.
// - key prefix로 "general", "forceRefresh" 2개 버킷을 운용해
//   forceRefresh(캐시 우회) 요청을 더 타이트하게 막는다.
// - 메모리 누수를 막기 위해 만료된 버킷은 다음 접근 시 정리한다.
//
// Retry-After 계산
// - 초과 시 window의 남은 시간을 초 단위로 반환.
// - 이를 응답 헤더 Retry-After 와 error.details.retryAfterSeconds 양쪽에
//   같은 값으로 넣어 프론트 상태 패널이 분기 없이 소비할 수 있게 한다.

export type RateLimitBucketConfig = {
  /** 식별용 이름. "general" | "forceRefresh" 같은 값. */
  name: string;
  /** 윈도우 길이 (밀리초). */
  windowMs: number;
  /** 이 윈도우 안에서 허용되는 최대 요청 수. */
  max: number;
};

export type RateLimitCheckResult =
  | { allowed: true; remaining: number; bucket: string }
  | {
      allowed: false;
      bucket: string;
      retryAfterSeconds: number;
      limit: number;
      windowMs: number;
    };

type BucketState = {
  /** 윈도우 시작 타임스탬프. 이 시각 + windowMs 되면 카운트가 0으로 리셋. */
  startedAt: number;
  /** 이 윈도우 안 요청 카운트. */
  count: number;
};

// 프로세스 단위 store. Vercel serverless 함수 인스턴스 재사용 동안 유지된다.
const store = new Map<string, BucketState>();

// 너무 많은 unique IP가 쌓이면 메모리 누수 — 주기적으로 만료분 청소.
// 엄격한 LRU는 아니지만 윈도우 지난 것은 없애준다.
function gc(now: number) {
  // 매 요청마다 전체 순회는 부담이라 확률적으로만 돌린다.
  if (Math.random() > 0.02) return;
  for (const [key, state] of store.entries()) {
    // 윈도우 타입별 크게 잡고 60초 이상 방치된 항목 제거.
    if (now - state.startedAt > 120_000) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  ip: string,
  config: RateLimitBucketConfig
): RateLimitCheckResult {
  const now = Date.now();
  gc(now);

  const key = `${config.name}::${ip}`;
  const existing = store.get(key);
  if (!existing || now - existing.startedAt >= config.windowMs) {
    // 새 윈도우 시작.
    store.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: config.max - 1, bucket: config.name };
  }

  if (existing.count < config.max) {
    existing.count += 1;
    return {
      allowed: true,
      remaining: config.max - existing.count,
      bucket: config.name,
    };
  }

  const elapsed = now - existing.startedAt;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((config.windowMs - elapsed) / 1000)
  );
  return {
    allowed: false,
    bucket: config.name,
    retryAfterSeconds,
    limit: config.max,
    windowMs: config.windowMs,
  };
}

/** 테스트용 — 프로덕션 코드에서는 호출하지 않는다. */
export function __resetRateLimitStoreForTests() {
  store.clear();
}

/** 운영 정책. 한 곳에서 조정할 수 있게 상수로 모아둔다.
 *
 *  - general: IP당 60초에 6회 (=10초에 1회 평균, burst 6).
 *  - forceRefresh: IP당 10분에 2회. forceRefresh는 서버 캐시 우회라 비용 큼.
 *
 *  두 limiter는 AND 관계로 평가된다 — forceRefresh=true 요청은 general
 *  카운터도 같이 소모하므로, 연타하면 general에서도 먼저 막힌다. */
export const RATE_LIMIT_POLICY = {
  general: {
    name: "general",
    windowMs: 60_000,
    max: 6,
  },
  forceRefresh: {
    name: "forceRefresh",
    windowMs: 10 * 60_000,
    max: 2,
  },
} as const satisfies Record<string, RateLimitBucketConfig>;

/** Next.js Request에서 클라이언트 IP를 추출한다.
 *  Vercel/프록시 뒤에 있을 때는 x-forwarded-for 첫 번째 값을 쓴다. */
export function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  // Vercel 추가 헤더도 같이 본다.
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}
