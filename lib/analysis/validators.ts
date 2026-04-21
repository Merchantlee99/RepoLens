import { createAnalysisError } from "@/lib/analysis/errors";
import type { AnalyzeTargetRequest } from "@/lib/analysis/types";

export type ValidatedRepoInput = {
  kind: "repo";
  owner: string;
  repo: string;
  canonicalUrl: string;
};

export type ValidatedOwnerInput = {
  kind: "owner";
  owner: string;
  canonicalUrl: string;
};

export type ValidatedGitHubTargetInput = ValidatedRepoInput | ValidatedOwnerInput;

function normalizeGitHubHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function validateGitHubTargetUrlInput(input: string): ValidatedGitHubTargetInput {
  const raw = input.trim();

  if (!raw) {
    throw createAnalysisError("INVALID_URL", "GitHub 공개 레포 URL을 입력해 주세요.");
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw createAnalysisError("INVALID_URL", "올바른 GitHub 레포 URL을 입력해 주세요.", {
      value: raw,
    });
  }

  const hostname = normalizeGitHubHostname(url.hostname);

  if (hostname !== "github.com") {
    throw createAnalysisError("UNSUPPORTED_HOST", "현재는 github.com 공개 레포만 지원합니다.", {
      hostname,
    });
  }

  const segments = url.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) {
    throw createAnalysisError(
      "INVALID_REPO_PATH",
      "GitHub 공개 owner 또는 레포 URL 형식이 필요합니다.",
      {
        pathname: url.pathname,
      }
    );
  }

  const owner = segments[0]?.trim();
  const repo = segments[1]?.replace(/\.git$/i, "").trim();

  if (!owner) {
    throw createAnalysisError("INVALID_REPO_PATH", "GitHub owner 또는 레포 URL을 다시 확인해 주세요.", {
      pathname: url.pathname,
    });
  }

  if (!repo) {
    return {
      kind: "owner",
      owner,
      canonicalUrl: `https://github.com/${owner}`,
    };
  }

  return {
    kind: "repo",
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function validateGitHubRepoUrlInput(input: string): ValidatedRepoInput {
  const validated = validateGitHubTargetUrlInput(input);

  if (validated.kind !== "repo") {
    throw createAnalysisError("INVALID_REPO_PATH", "owner/repo 형식의 GitHub URL이 필요합니다.", {
      pathname: validated.canonicalUrl,
    });
  }

  return validated;
}

export function validateAnalyzeRepoRequest(input: unknown): AnalyzeTargetRequest {
  if (!input || typeof input !== "object") {
    throw createAnalysisError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.");
  }

  const body = input as Partial<AnalyzeTargetRequest>;
  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";
  const forceRefresh = body.forceRefresh === true;

  if (!repoUrl) {
    throw createAnalysisError("INVALID_REQUEST", "GitHub 공개 레포 URL을 입력해 주세요.");
  }

  validateGitHubTargetUrlInput(repoUrl);

  return { repoUrl, forceRefresh };
}
