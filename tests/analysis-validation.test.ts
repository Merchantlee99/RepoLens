import { describe, expect, it } from "vitest";
import { isAnalysisError } from "@/lib/analysis/errors";
import {
  validateAnalyzeRepoRequest,
  validateGitHubRepoUrlInput,
  validateGitHubTargetUrlInput,
} from "@/lib/analysis/validators";

describe("analysis validators", () => {
  it("normalizes a valid GitHub repository URL", () => {
    const result = validateGitHubRepoUrlInput("https://github.com/openai/openai-node.git?tab=readme");

    expect(result).toEqual({
      kind: "repo",
      owner: "openai",
      repo: "openai-node",
      canonicalUrl: "https://github.com/openai/openai-node",
    });
  });

  it("normalizes a valid GitHub owner URL", () => {
    const result = validateGitHubTargetUrlInput("https://github.com/vercel?tab=repositories");

    expect(result).toEqual({
      kind: "owner",
      owner: "vercel",
      canonicalUrl: "https://github.com/vercel",
    });
  });

  it("rejects unsupported hosts", () => {
    try {
      validateGitHubRepoUrlInput("https://gitlab.com/openai/openai-node");
      throw new Error("expected validator to throw");
    } catch (error) {
      expect(isAnalysisError(error)).toBe(true);
      expect(error && typeof error === "object" && "code" in error ? error.code : null).toBe(
        "UNSUPPORTED_HOST"
      );
    }
  });

  it("rejects malformed request bodies", () => {
    expect(() => validateAnalyzeRepoRequest(null)).toThrowError(/요청 형식/);
    expect(() => validateAnalyzeRepoRequest({ repoUrl: "" })).toThrowError(/GitHub 공개 레포 URL/);
  });
});
