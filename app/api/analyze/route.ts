import { NextResponse } from "next/server";
import { analyzePublicTargetWithMeta } from "@/lib/analysis/analyzer";
import { createAnalysisError, toErrorPayload, toErrorStatus } from "@/lib/analysis/errors";
import { buildAnalyzeTargetMeta } from "@/lib/analysis/policy";
import type { AnalyzeTargetResponse } from "@/lib/analysis/types";
import { validateAnalyzeRepoRequest } from "@/lib/analysis/validators";

export const runtime = "nodejs";

const BASE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Vary: "Origin",
};

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

export async function POST(request: Request) {
  try {
    assertSameOriginBrowserRequest(request);

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      throw createAnalysisError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.");
    }
    const body = validateAnalyzeRepoRequest(rawBody);
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
    const payload = toErrorPayload(error);
    const status = toErrorStatus(error);
    const retryAfterSeconds =
      typeof payload.details?.retryAfterSeconds === "number"
        ? payload.details.retryAfterSeconds
        : null;

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
