"use client";

import Link from "next/link";
import type { AnalyzeRequestError } from "@/lib/analysis/client";

// 분석 요청이 실패했을 때 보여주는 상태 패널.
//
// 북극성 원칙:
// - "에러"가 아니라 "현재 분석 상태"로 느껴지게.
// - 사용자 행동은 최소화, 메시지는 짧게.
//
// 분기:
//   rate-limited + tokenless  — 서버에 GITHUB_TOKEN이 없어서 비인증 한도.
//   rate-limited + authenticated — 토큰은 있으나 한도 소진.
//   invalid-url / unsupported-host / invalid-repo-path — 사용자 입력 문제.
//   repo-not-found / branch-not-found — 레포 자체 이슈.
//   no-analyzable-files / tree-truncated — 분석 가능한 코드가 없거나 큰 레포.
//   github-api / fetch-failed / generic — 일시적 서버 측.
export type AnalysisStatusKind =
  | "rate-limited-tokenless"
  | "rate-limited-authed"
  | "invalid-input"
  | "repo-not-found"
  | "no-analyzable-files"
  | "tree-truncated"
  | "server-temporary"
  | "generic";

export type AnalysisStatusPanelProps = {
  kind: AnalysisStatusKind;
  title: string;
  body: string;
  hint?: string | null;
  resetAt?: string | null;
  repoUrl: string;
  backHref?: string;
  backLabel?: string;
  retryable: boolean;
};

export function classifyAnalyzeError(
  error: AnalyzeRequestError,
  fallbackKind: "repo" | "owner" = "repo"
): AnalysisStatusPanelProps {
  const code = error.code;
  const details = error.details ?? {};
  // authenticated는 두 곳에서 올 수 있다:
  //  - 기존 GitHub 응답 기반 details.authenticated === true
  //  - meta.policy.githubAuthMode === "token" (client에서 details에 주입)
  const authModeIsToken = details.githubAuthMode === "token";
  const authenticated = details.authenticated === true || authModeIsToken;
  const resetAtRaw = details.resetAt;
  const resetAt =
    typeof resetAtRaw === "string" || typeof resetAtRaw === "number"
      ? formatResetAt(resetAtRaw)
      : null;
  const retryAfterSeconds =
    typeof details.retryAfterSeconds === "number" && details.retryAfterSeconds >= 0
      ? details.retryAfterSeconds
      : null;
  const shortCountdown = formatShortCountdown(retryAfterSeconds);

  if (code === "RATE_LIMITED") {
    // 짧은 countdown이 있으면 그걸 우선, 아니면 resetAt, 아니면 일반 안내.
    const whenHint =
      shortCountdown ??
      (resetAt ? `${resetAt} 이후 자동으로 풀려요.` : "잠시 후 다시 시도하면 풀립니다.");

    if (!authenticated) {
      return {
        kind: "rate-limited-tokenless",
        title: "잠시 한도에 닿았어요",
        body: "GitHub 무료 한도(시간당 60회)로 요청하고 있어서 일시적으로 막혔습니다.",
        hint: whenHint,
        resetAt,
        repoUrl: "",
        retryable: true,
      };
    }
    return {
      kind: "rate-limited-authed",
      title: "GitHub 한도 초과",
      body: "이 서버가 사용 중인 GitHub 토큰의 요청 한도가 소진됐습니다.",
      hint: whenHint,
      resetAt,
      repoUrl: "",
      retryable: true,
    };
  }
  if (code === "INVALID_URL" || code === "UNSUPPORTED_HOST" || code === "INVALID_REPO_PATH") {
    return {
      kind: "invalid-input",
      title: "이 주소는 지원되지 않아요",
      body: error.message,
      hint: "예: https://github.com/owner/repo",
      repoUrl: "",
      retryable: false,
    };
  }
  if (code === "REPO_NOT_FOUND" || code === "BRANCH_NOT_FOUND" || code === "FILE_NOT_FOUND") {
    return {
      kind: "repo-not-found",
      title: fallbackKind === "owner" ? "이 owner를 찾지 못했어요" : "이 레포를 찾지 못했어요",
      body: error.message,
      hint: "주소가 맞는지, 비공개 레포가 아닌지 확인해 주세요.",
      repoUrl: "",
      retryable: false,
    };
  }
  if (code === "NO_ANALYZABLE_FILES") {
    return {
      kind: "no-analyzable-files",
      title: "분석할 코드를 찾지 못했어요",
      body: "지원되는 언어/구성 파일 신호가 부족합니다.",
      hint: "README와 매니페스트가 비어 있거나, 우리가 지원하지 않는 스택일 수 있습니다.",
      repoUrl: "",
      retryable: false,
    };
  }
  if (code === "TREE_TRUNCATED") {
    return {
      kind: "tree-truncated",
      title: "레포가 너무 커서 일부만 받았어요",
      body: "GitHub이 트리를 중간에 끊어서 응답했습니다.",
      hint: "다시 시도하면 다른 샘플이 포함될 수 있어요.",
      repoUrl: "",
      retryable: true,
    };
  }
  if (code === "GITHUB_API_FAILED" || code === "GITHUB_FETCH_FAILED") {
    return {
      kind: "server-temporary",
      title: "GitHub 응답이 흔들려요",
      body: "GitHub 쪽 응답이 일시적으로 실패했습니다.",
      hint: "잠시 뒤 다시 시도하면 보통 풀립니다.",
      repoUrl: "",
      retryable: true,
    };
  }
  return {
    kind: "generic",
    title: fallbackKind === "owner" ? "포트폴리오를 불러오지 못했어요" : "결과를 불러오지 못했어요",
    body: error.message,
    hint: null,
    repoUrl: "",
    retryable: error.retryable,
  };
}

// 60초 이내는 "N초 후", 60분 이내는 "N분 후", 그 이상이면 null을 돌려
// 호출부가 resetAt으로 fallback하도록. 초보자에게 "정확한 시각"보다
// "곧" 감각을 먼저 주는 목적.
function formatShortCountdown(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return "지금 다시 시도하면 풀려요.";
  if (seconds < 60) return `약 ${Math.ceil(seconds)}초 후 다시 가능해져요.`;
  if (seconds < 3600) {
    const mins = Math.ceil(seconds / 60);
    return `약 ${mins}분 후 자동으로 풀려요.`;
  }
  return null;
}

function formatResetAt(value: string | number): string | null {
  const epoch = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(epoch)) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(epoch * 1000));
}

export function AnalysisStatusPanel({
  props,
  repoUrl,
  backHref,
  backLabel,
  onRetry,
}: {
  props: AnalysisStatusPanelProps;
  repoUrl: string;
  backHref?: string;
  backLabel?: string;
  /** 같은 라우트 안에서 재시도할 때 사용. 없으면 /analyzing으로 Link 이동. */
  onRetry?: () => void;
}) {
  const captionLabel =
    props.kind === "rate-limited-tokenless" || props.kind === "rate-limited-authed"
      ? "분석 지연"
      : props.kind === "invalid-input" || props.kind === "repo-not-found"
        ? "입력 확인"
        : props.kind === "no-analyzable-files"
          ? "분석 신호 부족"
          : props.kind === "tree-truncated" || props.kind === "server-temporary"
            ? "잠시 후 다시"
            : "분석 오류";

  const tone =
    props.kind === "invalid-input" || props.kind === "repo-not-found"
      ? "input"
      : props.kind === "no-analyzable-files"
        ? "neutral"
        : "guard";

  const toneClass =
    tone === "input"
      ? "border-[var(--border)]"
      : tone === "neutral"
        ? "border-[var(--border)]"
        : "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/5";

  return (
    <section className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-6 lg:px-8">
      <div className={`rounded-lg border ${toneClass} bg-[var(--surface)] p-5`}>
        <p className="text-[11px] font-medium text-[var(--fg-dim)]">{captionLabel}</p>
        <h1 className="mt-1.5 text-[16px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          {props.title}
        </h1>
        <p className="mt-2 break-words text-[12.5px] leading-6 text-[var(--fg-muted)]">
          {props.body}
        </p>
        {props.hint ? (
          <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-dim)]">{props.hint}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {props.retryable && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] hover:opacity-90"
            >
              다시 시도
            </button>
          ) : props.retryable && repoUrl ? (
            <Link
              href={`/analyzing?repoUrl=${encodeURIComponent(repoUrl)}`}
              className="inline-flex items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] hover:opacity-90"
            >
              다시 시도
            </Link>
          ) : null}
          <Link
            href={backHref ?? "/"}
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            {backLabel ?? "다른 주소 입력"}
          </Link>
        </div>
      </div>
    </section>
  );
}
