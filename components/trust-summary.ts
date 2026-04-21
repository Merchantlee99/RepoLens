"use client";

// 분석 신뢰도(Trust) compact summary.
//
// 북극성 — "결과가 불완전해도 왜 그런지 이해한다". partial/limited를
// "망가진 결과"가 아닌 "대표 경로 기준 요약"으로 읽게 만든다.
//
// Backend contract:
//   `analysis.coverage.trustSummary`는 이제 항상 채워진다
//   (client.ts의 `fallbackCoverageTrustSummary` 보강 포함).
//   여기서는 그 compact 계약을 중심으로 UI에 맞는 view model을 만든다.
//   추가로 coverage/warnings에서 초보자에게 의미 있는 reason 코드를
//   덧붙여 "왜 제한인지"를 한두 줄로 설명한다.

import type { RepoAnalysis, RepoCoverageTrustSummary } from "@/lib/analysis/types";

export type TrustTone = "ok" | "partial" | "limited";

export type TrustReasonCode =
  | "sampled-core"
  | "classification-gap"
  | "rate-limited"
  | "readme-light"
  | "unsupported-stack"
  | "backend"
  | "other";

export type TrustReason = {
  code: TrustReasonCode;
  label: string;
  detail?: string;
};

export type TrustSummary = {
  tone: TrustTone;
  /** 짧은 chip label — "부분 분석" / "제한 분석" / null */
  chipLabel: string | null;
  /** 한 줄 설명 — "대표 경로 기준 요약입니다" 같은 가이드 문장 */
  headline: string | null;
  /** 짧은 부연. backend contract의 detail 또는 coverage summary */
  detail: string | null;
  /** 왜 partial/limited인가를 요약한 최대 3개의 이유. tone="ok"면 빈 배열 */
  reasons: TrustReason[];
  /** backend가 내려주는 "무엇은 빠졌는지"(omissions) — tooltip/banner에 노출 */
  omissions: string[];
  /** backend가 내려주는 "무엇을 근거로 정리했는지"(basedOn) */
  basedOn: string[];
  /** 근사치 추정인지 여부. banner에서 약한 표현을 쓰게 하는 힌트 */
  approximate: boolean;
  /** 미분류 코드 파일 수 */
  unclassifiedCodeFileCount: number;
  /** 분석 모드 (full/limited). 내부 판단용 */
  analysisMode: "full" | "limited";
  /** trust 자체를 화면에 노출해야 하는가. ok이면 false */
  shouldRender: boolean;
};

export function buildTrustSummary(analysis: RepoAnalysis): TrustSummary {
  const coverage = analysis.coverage;
  const backend: RepoCoverageTrustSummary = coverage.trustSummary;
  const mode = analysis.analysisMode;
  const warnings = analysis.warnings ?? [];
  const limitations = analysis.limitations ?? [];

  const tone: TrustTone = backend.level;

  const chipLabel =
    tone === "ok" ? null : coverage.chipLabel?.trim() || defaultChipLabel(tone);

  // Reasons — backend가 이미 이유를 문장으로 내려주면 그걸 우선.
  // 없으면 coverage/warnings로 합성.
  const reasons: TrustReason[] = [];

  if (backend.reasons.length > 0) {
    for (const label of backend.reasons.slice(0, 3)) {
      reasons.push({ code: "backend", label });
    }
  } else {
    if (mode === "limited") {
      reasons.push({
        code: "sampled-core",
        label: "핵심 코드/설정 파일만 샘플링",
        detail: coverage.supportGapMessage ?? undefined,
      });
    }
    if ((coverage.unclassifiedCodeFileCount ?? 0) > 0) {
      reasons.push({
        code: "classification-gap",
        label: `의미 레이어 바깥 코드 ${coverage.unclassifiedCodeFileCount}개`,
        detail: coverage.unclassifiedReasonSummary ?? undefined,
      });
    }
    for (const w of warnings) {
      if (!w?.code) continue;
      if (/rate[-_]?limit/i.test(w.code)) {
        reasons.push({ code: "rate-limited", label: w.message });
        break;
      }
    }
    for (const l of limitations) {
      if (!l?.code) continue;
      if (/readme/i.test(l.code)) {
        reasons.push({ code: "readme-light", label: l.message });
        break;
      }
      if (/unsupported/i.test(l.code)) {
        reasons.push({ code: "unsupported-stack", label: l.message });
        break;
      }
    }
  }

  const topReasons = reasons.slice(0, 3);

  const headline = tone === "ok" ? null : backend.headline || buildHeadlineFallback(tone, topReasons);

  return {
    tone,
    chipLabel,
    headline,
    detail: backend.detail ?? coverage.details[0] ?? null,
    reasons: topReasons,
    omissions: (backend.omissions ?? []).slice(0, 3),
    basedOn: (backend.basedOn ?? []).slice(0, 3),
    approximate: backend.approximate,
    unclassifiedCodeFileCount: coverage.unclassifiedCodeFileCount ?? 0,
    analysisMode: mode,
    shouldRender: tone !== "ok",
  };
}

function defaultChipLabel(tone: Exclude<TrustTone, "ok">): string {
  return tone === "partial" ? "부분 분석" : "제한 분석";
}

function buildHeadlineFallback(
  tone: Exclude<TrustTone, "ok">,
  reasons: TrustReason[]
): string {
  if (tone === "limited") {
    return "대표 경로 기준 요약이에요. 전체 코드가 다 반영된 건 아닙니다.";
  }
  if (reasons.some((r) => r.code === "classification-gap")) {
    return "표준 레이어 바깥 코드가 있어 일부는 Code로 묶었어요.";
  }
  return "주요 신호 기준 요약이에요. 참고용으로 봐주세요.";
}
