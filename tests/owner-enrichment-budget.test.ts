import { afterEach, describe, expect, it } from "vitest";
import { resolveOwnerEnrichmentRepoLimit, selectOwnerEnrichmentCandidates } from "@/lib/analysis/analyzer";
import type { GitHubOwnerRepository } from "@/lib/analysis/github";

const originalToken = process.env.GITHUB_TOKEN;

function buildRepo(index: number): GitHubOwnerRepository {
  return {
    name: `repo-${index}`,
    full_name: `owner/repo-${index}`,
    html_url: `https://github.com/owner/repo-${index}`,
    description: `Repository ${index}`,
    default_branch: "main",
    homepage: index % 2 === 0 ? `https://repo-${index}.example.com` : null,
    language: "TypeScript",
    stargazers_count: 1000 - index * 10,
    forks_count: 100 - index,
    updated_at: new Date(Date.now() - index * 60_000).toISOString(),
    archived: false,
    fork: false,
    topics: index % 2 === 0 ? ["react", "tooling"] : ["example", "starter"],
  };
}

function buildCustomRepo(
  fullName: string,
  overrides: Partial<GitHubOwnerRepository> = {}
): GitHubOwnerRepository {
  const [, repoName] = fullName.split("/");
  return {
    name: repoName,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: null,
    default_branch: "main",
    homepage: null,
    language: "TypeScript",
    stargazers_count: 0,
    forks_count: 0,
    updated_at: new Date().toISOString(),
    archived: false,
    fork: false,
    topics: [],
    ...overrides,
  };
}

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.GITHUB_TOKEN;
    return;
  }

  process.env.GITHUB_TOKEN = originalToken;
});

describe("owner enrichment budget", () => {
  it("uses a smaller enrichment budget without a GitHub token", () => {
    delete process.env.GITHUB_TOKEN;
    const repositories = Array.from({ length: 10 }, (_, index) => buildRepo(index));

    expect(resolveOwnerEnrichmentRepoLimit()).toBe(3);
    expect(selectOwnerEnrichmentCandidates(repositories)).toHaveLength(3);
  });

  it("uses a larger enrichment budget when a GitHub token is present", () => {
    process.env.GITHUB_TOKEN = "fixture-token";
    const repositories = Array.from({ length: 12 }, (_, index) => buildRepo(index));

    expect(resolveOwnerEnrichmentRepoLimit()).toBe(8);
    expect(selectOwnerEnrichmentCandidates(repositories)).toHaveLength(8);
  });

  it("prioritizes current official sdk candidates over stale star-heavy release snapshots", () => {
    delete process.env.GITHUB_TOKEN;
    const fiveYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 5).toISOString();
    const repositories = [
      buildCustomRepo("openai/gpt-2", {
        description: "Older research release",
        language: "Python",
        stargazers_count: 32000,
        forks_count: 8000,
        updated_at: fiveYearsAgo,
        topics: ["research"],
      }),
      buildCustomRepo("openai/openai-node", {
        description: "Official TypeScript/JavaScript SDK for the OpenAI API",
        homepage: "https://platform.openai.com",
        language: "TypeScript",
        stargazers_count: 9000,
        forks_count: 1000,
        topics: ["sdk", "api", "typescript"],
      }),
      buildCustomRepo("openai/openai-cookbook", {
        description: "Examples and guides for building with the OpenAI API",
        homepage: "https://platform.openai.com/docs",
        language: "Jupyter Notebook",
        stargazers_count: 65000,
        forks_count: 9000,
        topics: ["example", "guide", "openai"],
      }),
      buildCustomRepo("openai/random-utils", {
        description: "Internal utility scripts",
        language: "Shell",
        stargazers_count: 20,
        forks_count: 2,
      }),
    ];

    const selected = selectOwnerEnrichmentCandidates(repositories).map((repo) => repo.full_name);

    expect(selected).toHaveLength(3);
    expect(selected[0]).toBe("openai/openai-cookbook");
    expect(selected).toContain("openai/openai-node");
  });

  it("never selects archived repos even when they have strong metadata", () => {
    delete process.env.GITHUB_TOKEN;
    const repositories = [
      buildCustomRepo("owner/archived-sdk", {
        description: "Official SDK",
        homepage: "https://sdk.example.com",
        stargazers_count: 5000,
        forks_count: 400,
        archived: true,
        topics: ["sdk", "api"],
      }),
      buildCustomRepo("owner/live-sdk", {
        description: "Official SDK",
        homepage: "https://sdk.example.com",
        stargazers_count: 1200,
        forks_count: 120,
        topics: ["sdk", "api"],
      }),
      buildCustomRepo("owner/starter", {
        description: "Starter example",
        stargazers_count: 300,
        forks_count: 20,
        topics: ["example", "starter"],
      }),
      buildCustomRepo("owner/docs", {
        description: "Guide and docs",
        stargazers_count: 200,
        forks_count: 15,
        topics: ["docs", "guide"],
      }),
    ];

    const selected = selectOwnerEnrichmentCandidates(repositories).map((repo) => repo.full_name);

    expect(selected).not.toContain("owner/archived-sdk");
    expect(selected[0]).toBe("owner/live-sdk");
  });
});
