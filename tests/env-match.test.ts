import { describe, expect, it } from "vitest";
import { buildEnvMatchReport } from "@/lib/analysis/env-match";
import type { RepoEnvRequirements } from "@/lib/analysis/types";

function requirements(overrides: Partial<RepoEnvRequirements>): RepoEnvRequirements {
  return {
    summary: "",
    runtimes: [],
    container: {
      hasDockerfile: false,
      hasDockerCompose: false,
      baseImage: null,
      exposedPorts: [],
      composeServices: [],
      composeServiceCount: 0,
      needsMultiContainer: false,
      dockerRole: "none",
    },
    hardware: {
      gpuRequired: false,
      gpuHint: null,
      minRamGb: null,
      recommendedRamGb: null,
      minDiskGb: null,
      minVramGb: null,
      cpuArch: "any",
      acceleratorPreference: null,
      notes: [],
      source: "none",
    },
    cloud: {
      deployTargets: [],
      deployTargetRequired: null,
      servicesRequired: [],
      servicesOptional: [],
      apiServicesRequired: [],
      apiServicesOptional: [],
      servicesRequiredDetails: [],
      servicesOptionalDetails: [],
      source: "none",
    },
    runtimeMode: "local-or-cloud",
    costEstimate: {
      tier: "free",
      monthlyUsdLow: 0,
      monthlyUsdHigh: 0,
      drivers: [],
    },
    confidence: "high",
    confidenceNote: null,
    ...overrides,
  };
}

describe("env match report", () => {
  it("marks GPU/VRAM and required deploy target as blockers", () => {
    const report = buildEnvMatchReport(
      requirements({
        hardware: {
          gpuRequired: true,
          gpuHint: "CUDA 12+",
          minRamGb: null,
          recommendedRamGb: null,
          minDiskGb: null,
          minVramGb: 24,
          cpuArch: "x64",
          acceleratorPreference: "cuda",
          notes: [],
          source: "package_json",
        },
        cloud: {
          deployTargets: ["AWS"],
          deployTargetRequired: "AWS",
          servicesRequired: [],
          servicesOptional: [],
          apiServicesRequired: [],
          apiServicesOptional: [],
          servicesRequiredDetails: [],
          servicesOptionalDetails: [],
          source: "config_files",
        },
        runtimeMode: "cloud-required",
      }),
      {
        hasGpu: false,
        vramGb: 8,
        cpuArch: "arm64",
        deployTargets: ["Vercel"],
        runtimeMode: "local-only",
      }
    );

    expect(report.summary.blockers).toBeGreaterThanOrEqual(2);
    expect(report.headline).toContain("GPU");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "hw:gpu",
          status: "mismatch",
          severity: "blocker",
        }),
        expect.objectContaining({
          key: "cloud:deploy:aws",
          status: "mismatch",
          severity: "blocker",
        }),
      ])
    );
  });

  it("downgrades RAM recommendation, Docker, budget, and service gaps to warnings", () => {
    const report = buildEnvMatchReport(
      requirements({
        container: {
          hasDockerfile: true,
          hasDockerCompose: false,
          baseImage: "node:20-alpine",
          exposedPorts: [3000],
          composeServices: [],
          composeServiceCount: 0,
          needsMultiContainer: false,
          dockerRole: "recommended",
        },
        hardware: {
          gpuRequired: false,
          gpuHint: null,
          minRamGb: 8,
          recommendedRamGb: 16,
          minDiskGb: 20,
          minVramGb: null,
          cpuArch: "any",
          acceleratorPreference: null,
          notes: [],
          source: "readme",
        },
        cloud: {
          deployTargets: ["Vercel"],
          deployTargetRequired: null,
          servicesRequired: ["OpenAI"],
          servicesOptional: [],
          apiServicesRequired: ["OpenAI"],
          apiServicesOptional: [],
          servicesRequiredDetails: [{ label: "OpenAI", canonicalId: "openai", kind: "ai" }],
          servicesOptionalDetails: [],
          source: "mixed",
        },
        costEstimate: {
          tier: "under_50",
          monthlyUsdLow: 10,
          monthlyUsdHigh: 50,
          drivers: [{ kind: "llm", note: "LLM API 호출 비용이 들어갈 수 있습니다." }],
        },
      }),
      {
        ramGb: 12,
        diskGb: 100,
        hasDocker: false,
        services: [],
        budgetTier: "under_10",
      }
    );

    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "hw:ram", status: "mismatch", severity: "warning" }),
        expect.objectContaining({ key: "docker", status: "mismatch", severity: "warning" }),
        expect.objectContaining({ key: "svc:openai", status: "missing", severity: "info" }),
        expect.objectContaining({ key: "budget", status: "mismatch", severity: "warning" }),
      ])
    );
  });

  it("matches canonical services and runtime ranges when user environment fits", () => {
    const report = buildEnvMatchReport(
      requirements({
        runtimes: [
          {
            name: "python",
            version: ">=3.11",
            minMajor: 3,
            maxMajor: null,
            range: "gte",
            source: "pyproject",
          },
        ],
        cloud: {
          deployTargets: [],
          deployTargetRequired: null,
          servicesRequired: ["Upstash Redis"],
          servicesOptional: [],
          apiServicesRequired: ["Upstash Redis"],
          apiServicesOptional: [],
          servicesRequiredDetails: [
            { label: "Upstash Redis", canonicalId: "redis", kind: "database" },
          ],
          servicesOptionalDetails: [],
          source: "mixed",
        },
      }),
      {
        python: "3.11.7",
        services: ["Redis"],
      }
    );

    expect(report.summary.mismatched).toBe(0);
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "runtime:python", status: "match" }),
        expect.objectContaining({ key: "svc:redis", status: "match" }),
      ])
    );
  });

  it("rejects minor versions below a semver lower bound and matches fallback storage aliases", () => {
    const report = buildEnvMatchReport(
      requirements({
        runtimes: [
          {
            name: "python",
            version: ">=3.14,<3.19",
            minMajor: 3,
            maxMajor: 3,
            range: "between",
            source: "pyproject",
          },
        ],
        cloud: {
          deployTargets: [],
          deployTargetRequired: null,
          servicesRequired: ["Amazon S3", "Pinecone"],
          servicesOptional: [],
          apiServicesRequired: ["Amazon S3", "Pinecone"],
          apiServicesOptional: [],
          servicesRequiredDetails: [],
          servicesOptionalDetails: [],
          source: "mixed",
        },
      }),
      {
        python: "3.11.9",
        services: ["S3", "pinecone"],
      }
    );

    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "runtime:python",
          status: "mismatch",
          severity: "blocker",
        }),
        expect.objectContaining({ key: "svc:s3", status: "match" }),
        expect.objectContaining({ key: "svc:pinecone", status: "match" }),
      ])
    );
  });
});
