import { GITHUB_FETCH_TIMEOUT_MS } from "@/lib/analysis/constants";
import { createAnalysisError } from "@/lib/analysis/errors";
import { detectGitHubAuthMode } from "@/lib/analysis/policy";
import { validateGitHubRepoUrlInput, validateGitHubTargetUrlInput } from "@/lib/analysis/validators";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

type GitHubRepository = {
  name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
};

type GitHubBranch = {
  name: string;
  commit: {
    sha: string;
  };
};

type GitHubTree = {
  truncated: boolean;
  tree: Array<{
    path: string;
    type: "blob" | "tree";
    size?: number;
  }>;
};

export type GitHubOwnerType = "organization" | "user";

export type GitHubOwnerProfile = {
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string | null;
  blog?: string | null;
  location?: string | null;
  public_repos: number;
  type: "Organization" | "User";
  description?: string | null;
  bio?: string | null;
};

export type GitHubOwnerRepository = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  archived: boolean;
  fork: boolean;
  topics?: string[];
};

export type GitHubRepoRef = {
  kind: "repo";
  owner: string;
  repo: string;
  url: string;
};

export type GitHubOwnerRef = {
  kind: "owner";
  owner: string;
  url: string;
};

export type GitHubTargetRef = GitHubRepoRef | GitHubOwnerRef;

function buildHeaders(accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_TOKEN;

  return {
    Accept: accept,
    "User-Agent": "RepoLens/0.1",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseRetryAfterSeconds(response: Response) {
  const retryAfterHeader = response.headers.get("retry-after");

  if (retryAfterHeader) {
    const parsed = Number(retryAfterHeader);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.ceil(parsed);
    }
  }

  const resetHeader = response.headers.get("x-ratelimit-reset");

  if (!resetHeader) {
    return null;
  }

  const resetAt = Number(resetHeader);

  if (!Number.isFinite(resetAt)) {
    return null;
  }

  return Math.max(0, Math.ceil(resetAt - Date.now() / 1000));
}

function buildRateLimitDetails(path: string, response: Response) {
  const authMode = detectGitHubAuthMode();
  return {
    path,
    resetAt: response.headers.get("x-ratelimit-reset"),
    retryAfterSeconds: parseRetryAfterSeconds(response),
    remaining: response.headers.get("x-ratelimit-remaining"),
    limit: response.headers.get("x-ratelimit-limit"),
    authenticated: authMode === "token",
    authMode,
    tokenlessRateLimitPerHour: authMode === "tokenless" ? 60 : null,
  };
}

async function fetchGitHub<T>(
  path: string,
  options?: {
    accept?: string;
    notFoundCode?: "REPO_NOT_FOUND" | "BRANCH_NOT_FOUND" | "FILE_NOT_FOUND";
    notFoundMessage?: string;
  }
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: buildHeaders(options?.accept),
      cache: "no-store",
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw createAnalysisError("GITHUB_FETCH_FAILED", "GitHub API 요청에 실패했습니다.", {
      path,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
    throw createAnalysisError(
      "RATE_LIMITED",
      "GitHub API rate limit에 도달했습니다. 잠시 후 다시 시도해 주세요.",
      buildRateLimitDetails(path, response)
    );
  }

  if (response.status === 404 && options?.notFoundCode) {
    throw createAnalysisError(
      options.notFoundCode,
      options.notFoundMessage ?? "요청한 GitHub 리소스를 찾지 못했습니다.",
      { path }
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw createAnalysisError("GITHUB_API_FAILED", "GitHub API 호출이 실패했습니다.", {
      path,
      status: response.status,
      detail: detail || response.statusText,
    });
  }

  return (await response.json()) as T;
}

export function parseGitHubRepoUrl(input: string): GitHubRepoRef {
  const validated = validateGitHubRepoUrlInput(input);

  return {
    kind: "repo",
    owner: validated.owner,
    repo: validated.repo,
    url: validated.canonicalUrl,
  };
}

export function parseGitHubTargetUrl(input: string): GitHubTargetRef {
  const validated = validateGitHubTargetUrlInput(input);

  if (validated.kind === "owner") {
    return {
      kind: "owner",
      owner: validated.owner,
      url: validated.canonicalUrl,
    };
  }

  return {
    kind: "repo",
    owner: validated.owner,
    repo: validated.repo,
    url: validated.canonicalUrl,
  };
}

export async function fetchRepository(owner: string, repo: string) {
  return fetchGitHub<GitHubRepository>(`/repos/${owner}/${repo}`, {
    notFoundCode: "REPO_NOT_FOUND",
    notFoundMessage: "GitHub 공개 레포를 찾지 못했습니다.",
  });
}

export async function fetchBranch(owner: string, repo: string, branch: string) {
  return fetchGitHub<GitHubBranch>(`/repos/${owner}/${repo}/branches/${branch}`, {
    notFoundCode: "BRANCH_NOT_FOUND",
    notFoundMessage: "기본 브랜치 정보를 찾지 못했습니다.",
  });
}

export async function fetchRecursiveTree(owner: string, repo: string, sha: string) {
  return fetchGitHub<GitHubTree>(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, {
    notFoundCode: "BRANCH_NOT_FOUND",
    notFoundMessage: "트리 정보를 읽을 수 있는 commit SHA를 찾지 못했습니다.",
  });
}

export async function fetchTextFile(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  return fetchTextResponse(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    "application/vnd.github.raw+json",
    {
      path,
    }
  );
}

export async function fetchReadmeText(
  owner: string,
  repo: string,
  ref: string
): Promise<string | null> {
  return fetchTextResponse(`/repos/${owner}/${repo}/readme?ref=${encodeURIComponent(ref)}`, "application/vnd.github.raw+json", {
    path: "README",
  });
}

async function fetchTextResponse(
  path: string,
  accept: string,
  context: {
    path: string;
  }
) {
  let response: Response;

  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: buildHeaders(accept),
      cache: "no-store",
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw createAnalysisError("GITHUB_FETCH_FAILED", "GitHub 파일 조회에 실패했습니다.", {
      path: context.path,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.status === 404) {
    return null;
  }

  if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
    throw createAnalysisError(
      "RATE_LIMITED",
      "GitHub API rate limit에 도달했습니다. 잠시 후 다시 시도해 주세요.",
      buildRateLimitDetails(context.path, response)
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw createAnalysisError("GITHUB_API_FAILED", "GitHub 파일 조회가 실패했습니다.", {
      path: context.path,
      status: response.status,
      detail: detail || response.statusText,
    });
  }

  return response.text();
}

function normalizeOwnerType(type: GitHubOwnerProfile["type"]): GitHubOwnerType {
  return type === "Organization" ? "organization" : "user";
}

export async function fetchOwnerProfile(owner: string): Promise<GitHubOwnerProfile & { ownerType: GitHubOwnerType }> {
  try {
    const org = await fetchGitHub<GitHubOwnerProfile>(`/orgs/${owner}`, {
      notFoundCode: "REPO_NOT_FOUND",
      notFoundMessage: "GitHub 공개 오가니제이션을 찾지 못했습니다.",
    });

    return {
      ...org,
      ownerType: normalizeOwnerType(org.type),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "REPO_NOT_FOUND"
    ) {
      const user = await fetchGitHub<GitHubOwnerProfile>(`/users/${owner}`, {
        notFoundCode: "REPO_NOT_FOUND",
        notFoundMessage: "GitHub 공개 사용자 또는 오가니제이션을 찾지 못했습니다.",
      });

      return {
        ...user,
        ownerType: normalizeOwnerType(user.type),
      };
    }

    throw error;
  }
}

export async function fetchOwnerRepositories(args: {
  owner: string;
  ownerType: GitHubOwnerType;
  maxRepos?: number;
}) {
  const maxRepos = args.maxRepos ?? 100;
  const repos: GitHubOwnerRepository[] = [];
  const basePath =
    args.ownerType === "organization" ? `/orgs/${args.owner}/repos` : `/users/${args.owner}/repos`;

  for (let page = 1; repos.length < maxRepos; page += 1) {
    const remaining = maxRepos - repos.length;
    const perPage = Math.min(100, remaining);
    const pageRepos = await fetchGitHub<GitHubOwnerRepository[]>(
      `${basePath}?type=public&sort=updated&per_page=${perPage}&page=${page}`
    );

    repos.push(...pageRepos);

    if (pageRepos.length < perPage) {
      break;
    }
  }

  return repos;
}
