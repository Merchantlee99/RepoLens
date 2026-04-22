import { NextResponse } from "next/server";
import { analyzePublicTargetWithMeta } from "@/lib/analysis/analyzer";
import { createAnalysisError, toErrorPayload, toErrorStatus } from "@/lib/analysis/errors";
import { buildAnalyzeTargetMeta } from "@/lib/analysis/policy";
import {
  checkRateLimit,
  extractClientIp,
  RATE_LIMIT_POLICY,
} from "@/lib/analysis/rate-limit";
import type { AnalyzeRepoErrorPayload, AnalyzeTargetResponse } from "@/lib/analysis/types";
import { validateAnalyzeRepoRequest } from "@/lib/analysis/validators";

export const runtime = "nodejs";

const BASE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Origin",
};

// 본문 크기 상한. 실제 유효한 요청은 repoUrl 하나라 수백 byte 수준.
// 큰 JSON body 반복 파싱을 막아 저비용 DoS 표면을 줄인다.
const MAX_REQUEST_BODY_BYTES = 4 * 1024; // 4 KiB
// repoUrl 자체의 최대 길이. GitHub URL은 현실적으로 400자를 넘지 않는다.
const MAX_REPO_URL_CHARS = 512;

// 프론트/상태 패널이 소비하는 안전 필드만 클라이언트로 내려보낸다.
// GitHub 내부 path, upstream status, 기타 운영 힌트는 서버 로그에만 남기고
// 사용자 응답에는 포함하지 않는다.
const PUBLIC_DETAIL_FIELDS: ReadonlyArray<string> = [
  "retryAfterSeconds",
  "resetAt",
  "authenticated",
  "githubAuthMode",
];

function assertSameOriginBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin) {
    if (fetchSite === "cross-site") {
      throw createAnalysisError(
        "FORBIDDEN",
        "다른 사이트에서는 분석 API를 직접 호출할 수 없습니다."
      );
    }
    return;
  }

  let requestOrigin: string;
  let parsedOrigin: string;

  try {
    requestOrigin = new URL(request.url).origin;
    parsedOrigin = new URL(origin).origin;
  } catch {
    throw createAnalysisError("FORBIDDEN", "요청 출처를 확인할 수 없습니다.");
  }

  if (parsedOrigin !== requestOrigin) {
    throw createAnalysisError("FORBIDDEN", "다른 사이트에서는 분석 API를 직접 호출할 수 없습니다.");
  }
}

function assertRequestBodySize(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > MAX_REQUEST_BODY_BYTES) {
      throw createAnalysisError(
        "INVALID_REQUEST",
        "요청 본문이 너무 큽니다."
      );
    }
  }
}

function assertRepoUrlLength(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return;
  const url = (raw as { repoUrl?: unknown }).repoUrl;
  if (typeof url === "string" && url.length > MAX_REPO_URL_CHARS) {
    throw createAnalysisError(
      "INVALID_URL",
      "레포 URL이 너무 깁니다."
    );
  }
}

// 운영 중 외부에 내려갈 에러 payload를 축약한다.
// - details는 프론트 상태 패널이 소비하는 안전 필드만 whitelist로 남긴다.
// - 에러 message는 Analysis계층이 만든 카피를 그대로 쓴다(이미 사용자용 한국어 copy).
// - 예기치 않은 Error(스택/내부 경로 힌트 포함 가능)는 generic 메시지로 치환.
function sanitizeErrorPayload(
  error: unknown,
  payload: AnalyzeRepoErrorPayload
): AnalyzeRepoErrorPayload {
  const details = payload.details;
  let publicDetails: Record<string, string | number | boolean | null> | undefined;
  if (details) {
    const filtered: Record<string, string | number | boolean | null> = {};
    for (const key of PUBLIC_DETAIL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(details, key)) {
        filtered[key] = details[key];
      }
    }
    if (Object.keys(filtered).length > 0) publicDetails = filtered;
  }

  const isKnownAnalysisError =
    payload.code !== "ANALYSIS_FAILED" || !(error instanceof Error);

  return {
    code: payload.code,
    message: isKnownAnalysisError
      ? payload.message
      : "분석 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    retryable: payload.retryable,
    ...(publicDetails ? { details: publicDetails } : {}),
  };
}

function rateLimitError(
  bucket: "general" | "forceRefresh",
  retryAfterSeconds: number
) {
  return createAnalysisError(
    "RATE_LIMITED",
    bucket === "forceRefresh"
      ? "강제 새로고침은 일정 시간당 2회까지만 가능합니다."
      : "분석 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    { retryAfterSeconds, authenticated: true }
  );
}

export async function POST(request: Request) {
  try {
    assertSameOriginBrowserRequest(request);
    assertRequestBodySize(request);

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      throw createAnalysisError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.");
    }
    assertRepoUrlLength(rawBody);
    const body = validateAnalyzeRepoRequest(rawBody);

    // Rate limit.
    // forceRefresh=true는 더 타이트한 2번째 버킷을 함께 소모한다. forceRefresh는
    // 서버 캐시를 우회해 실제 GitHub fetch를 강제하므로 남용 비용이 크다.
    const ip = extractClientIp(request);
    const general = checkRateLimit(ip, RATE_LIMIT_POLICY.general);
    if (!general.allowed) {
      throw rateLimitError("general", general.retryAfterSeconds);
    }
    if (body.forceRefresh === true) {
      const forceRefresh = checkRateLimit(ip, RATE_LIMIT_POLICY.forceRefresh);
      if (!forceRefresh.allowed) {
        throw rateLimitError("forceRefresh", forceRefresh.retryAfterSeconds);
      }
    }

    const result = await analyzePublicTargetWithMeta(body.repoUrl, {
      forceRefresh: body.forceRefresh === true,
    });

    return NextResponse.json<AnalyzeTargetResponse>({
      ok: true,
      data: result.analysis,
      meta: result.meta,
    }, {
      headers: BASE_RESPONSE_HEADERS,
    });
  } catch (error) {
    const rawPayload = toErrorPayload(error);
    const payload = sanitizeErrorPayload(error, rawPayload);
    const status = toErrorStatus(error);
    const retryAfterSeconds =
      typeof payload.details?.retryAfterSeconds === "number"
        ? payload.details.retryAfterSeconds
        : null;

    // 서버 로그에는 원본 에러 + 원본 details를 그대로 남겨 운영 관찰이 가능하게 한다.
    // 외부로 응답할 때만 `sanitizeErrorPayload`로 축약.
    if (status >= 500 || !payload.retryable) {
      console.warn("[analyze] error", {
        code: rawPayload.code,
        status,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json<AnalyzeTargetResponse>(
      {
        ok: false,
        error: payload,
        meta: buildAnalyzeTargetMeta(),
      },
      {
        status,
        headers: {
          ...BASE_RESPONSE_HEADERS,
          ...(status === 429 && retryAfterSeconds !== null
            ? {
                "Retry-After": String(retryAfterSeconds),
              }
            : {}),
        },
      }
    );
  }
}
