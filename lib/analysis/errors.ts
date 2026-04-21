import type { AnalyzeRepoErrorPayload } from "@/lib/analysis/types";

export type AnalysisErrorCode =
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "INVALID_URL"
  | "UNSUPPORTED_HOST"
  | "INVALID_REPO_PATH"
  | "REPO_NOT_FOUND"
  | "BRANCH_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "RATE_LIMITED"
  | "GITHUB_API_FAILED"
  | "GITHUB_FETCH_FAILED"
  | "TREE_TRUNCATED"
  | "NO_ANALYZABLE_FILES"
  | "ANALYSIS_FAILED";

const ERROR_STATUS: Record<AnalysisErrorCode, number> = {
  FORBIDDEN: 403,
  INVALID_REQUEST: 400,
  INVALID_URL: 400,
  UNSUPPORTED_HOST: 400,
  INVALID_REPO_PATH: 400,
  REPO_NOT_FOUND: 404,
  BRANCH_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  GITHUB_API_FAILED: 502,
  GITHUB_FETCH_FAILED: 502,
  TREE_TRUNCATED: 422,
  NO_ANALYZABLE_FILES: 422,
  ANALYSIS_FAILED: 500,
};

const ERROR_RETRYABLE: Record<AnalysisErrorCode, boolean> = {
  FORBIDDEN: false,
  INVALID_REQUEST: false,
  INVALID_URL: false,
  UNSUPPORTED_HOST: false,
  INVALID_REPO_PATH: false,
  REPO_NOT_FOUND: false,
  BRANCH_NOT_FOUND: false,
  FILE_NOT_FOUND: false,
  RATE_LIMITED: true,
  GITHUB_API_FAILED: true,
  GITHUB_FETCH_FAILED: true,
  TREE_TRUNCATED: false,
  NO_ANALYZABLE_FILES: false,
  ANALYSIS_FAILED: true,
};

export class AnalysisError extends Error {
  code: AnalysisErrorCode;
  status: number;
  retryable: boolean;
  details?: Record<string, string | number | boolean | null>;

  constructor(
    code: AnalysisErrorCode,
    message: string,
    details?: Record<string, string | number | boolean | null>
  ) {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.retryable = ERROR_RETRYABLE[code];
    this.details = details;
  }
}

export function createAnalysisError(
  code: AnalysisErrorCode,
  message: string,
  details?: Record<string, string | number | boolean | null>
) {
  return new AnalysisError(code, message, details);
}

export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

export function toErrorPayload(error: unknown): AnalyzeRepoErrorPayload {
  if (isAnalysisError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "ANALYSIS_FAILED",
      message: error.message,
      retryable: true,
    };
  }

  return {
    code: "ANALYSIS_FAILED",
    message: "레포 분석 중 알 수 없는 오류가 발생했습니다.",
    retryable: true,
  };
}

export function toErrorStatus(error: unknown) {
  if (isAnalysisError(error)) {
    return error.status;
  }

  return 500;
}
