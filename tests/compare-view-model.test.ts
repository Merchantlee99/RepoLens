import { describe, expect, it } from "vitest";
import {
  buildCompareDiff,
  buildCompareWarnings,
  validateCompareRepoInput,
} from "@/components/compare-view-model";
import type { RepoAnalysis } from "@/lib/analysis/types";

function makeRepoAnalysis(args: {
  url: string;
  stack: string[];
  layers?: Partial<Record<"UI" | "Logic" | "API" | "DB" | "External", number>>;
  codeCount?: number;
  runtimes?: Array<{ name: "node" | "python" | "go" | "rust" | "java" | "ruby" | "bun" | "deno"; version: string | null }>;
  docker?: boolean;
  dockerRole?: "required" | "optional-dev" | "optional-deploy" | "none";
  servicesRequired?: string[];
  servicesRequiredDetails?: Array<{
    label: string;
    canonicalId: string;
    kind: "ai" | "database" | "auth" | "payment" | "email" | "infra" | "queue" | "other";
  }>;
  deployTargets?: string[];
}): RepoAnalysis {
  const url = new URL(args.url);
  const [, owner, name] = url.pathname.split("/");
  const layerCounts = args.layers ?? {};

  return {
    schemaVersion: "mvp-v3",
    kind: "repo",
    analysisMode: "full",
    repo: {
      owner,
      name,
      branch: "main",
      sha: "fixture-sha",
      url: args.url,
      description: null,
    },
    stats: {
      sourceFileCount: 0,
      filteredFileCount: 0,
      fileCount: 0,
      directoryCount: 0,
      truncated: false,
      routeCount: 0,
      apiEndpointCount: 0,
    },
    summary: {
      oneLiner: `${owner}/${name}`,
      projectType: "웹 앱",
      stack: args.stack,
      difficulty: "medium",
      keyFeatures: [],
      analysisScopeLabel: "테스트",
    },
    topology: {
      kind: "single",
      workspaceRoots: [],
      workspaceGroups: [],
      focusRoot: null,
      manifestFiles: [],
    },
    facts: [],
    inferences: [],
    limitations: [],
    warnings: [],
    layers: (Object.entries(layerCounts) as Array<[keyof typeof layerCounts, number]>)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([name, count]) => ({
        name,
        description: `${name} layer`,
        files: [],
        fileCount: count ?? 0,
        evidence: [],
      })),
    keyFiles: [],
    editGuides: [],
    learning: {
      identity: {
        plainTitle: "테스트용 저장소",
        projectKind: "웹 앱",
        useCase: null,
        audience: null,
        outputType: null,
        coreStack: args.stack.slice(0, 5),
        stackNarrative: null,
        stackHighlights: [],
        header: { subtitle: null, points: [] },
        startHere: {
          path: null,
          reason: null,
        },
        readOrder: [],
        trust: {
          source: "code",
          note: null,
        },
      },
      readmeCore: {
        summary: null,
        keyPoints: [],
        audience: null,
        quickstart: [],
        links: [],
        architectureNotes: [],
        source: "none",
      },
      stackSummary: null,
      stackGlossary: [],
      usage: {
        install: [],
        run: [],
        build: [],
        test: [],
        example: [],
        source: "none",
        details: [],
      },
      preview: {
        mode: "none",
        images: [],
        deployUrl: null,
        source: "none",
        deployConfidence: null,
        deployRationale: [],
      },
      environment: {
        summary: "",
        runtimes: (args.runtimes ?? []).map((runtime) => ({
          ...runtime,
          source: runtime.name === "python" ? "requirements_txt" : "package_json",
        })),
        container: {
          hasDockerfile: args.docker ?? false,
          hasDockerCompose: false,
          baseImage: null,
          exposedPorts: [],
          composeServices: [],
          dockerRole: args.dockerRole ?? ((args.docker ?? false) ? "required" : "none"),
        },
        hardware: {
          gpuRequired: false,
          gpuHint: null,
          minRamGb: null,
          recommendedRamGb: null,
          minDiskGb: null,
          notes: [],
          source: "none",
        },
        cloud: {
          deployTargets: args.deployTargets ?? [],
          servicesRequired: args.servicesRequired ?? [],
          servicesOptional: [],
          servicesRequiredDetails: args.servicesRequiredDetails ?? [],
          servicesOptionalDetails: [],
          source: "none",
        },
        confidence: "low",
        confidenceNote: null,
      },
    },
    coverage: {
      level: "ok",
      chipLabel: null,
      summary: "",
      details: [],
      trustSummary: {
        level: "ok",
        headline: "표시 범위의 구조를 사실 기반으로 정리했습니다.",
        detail: null,
        reasons: [],
        omissions: [],
        basedOn: [],
        approximate: false,
      },
      supportedStackDetected: true,
      supportGapMessage: null,
      codeLikeFileCount: 0,
      classifiedCodeFileCount: 0,
      unclassifiedCodeFileCount: args.codeCount ?? 0,
      unclassifiedCodeSamples: [],
      unclassifiedReasonSummary: null,
      unclassifiedReasonGroups: [],
      unclassifiedSemanticSummary: null,
      unclassifiedSemanticGroups: [],
      unclassifiedContentCoverage: null,
    },
  };
}

describe("compare view model", () => {
  it("validates compare inputs as repo-only targets", () => {
    expect(validateCompareRepoInput("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
      canonicalUrl: "https://github.com/vercel/next.js",
      label: "vercel/next.js",
    });
    expect(() => validateCompareRepoInput("https://github.com/vercel")).toThrow(
      "비교 모드는 repo URL만 지원합니다."
    );
  });

  it("emits a warning when both compare URLs are the same", () => {
    expect(
      buildCompareWarnings(
        "https://github.com/vercel/next.js",
        "https://github.com/vercel/next.js"
      )
    ).toEqual(["두 레포를 동일하게 입력했어요."]);
  });

  it("builds stack, layer, runtime, service, and code fallback diffs", () => {
    const a = makeRepoAnalysis({
      url: "https://github.com/acme/web-app",
      stack: ["Next.js", "React", "TypeScript", "Tailwind"],
      layers: {
        UI: 10,
        Logic: 6,
        API: 3,
      },
      codeCount: 2,
      runtimes: [
        { name: "node", version: ">=20" },
        { name: "python", version: null },
      ],
      docker: true,
      servicesRequired: ["PostgreSQL", "Redis"],
      deployTargets: ["Vercel"],
    });
    const b = makeRepoAnalysis({
      url: "https://github.com/acme/worker",
      stack: ["TypeScript", "Python", "Redis"],
      layers: {
        Logic: 8,
        DB: 2,
        External: 4,
      },
      runtimes: [
        { name: "node", version: ">=18" },
        { name: "python", version: "3.11" },
      ],
      servicesRequired: ["Redis", "OpenAI"],
      deployTargets: ["Railway"],
    });

    const diff = buildCompareDiff(a, b);

    expect(diff.stack).toEqual({
      common: ["TypeScript"],
      onlyA: ["Next.js", "React", "Tailwind"],
      onlyB: ["Python", "Redis"],
    });
    expect(diff.layers.rows).toEqual([
      { layer: "UI", aCount: 10, bCount: 0, shared: false },
      { layer: "Logic", aCount: 6, bCount: 8, shared: true },
      { layer: "API", aCount: 3, bCount: 0, shared: false },
      { layer: "DB", aCount: 0, bCount: 2, shared: false },
      { layer: "External", aCount: 0, bCount: 4, shared: false },
      { layer: "Code", aCount: 2, bCount: 0, shared: false },
    ]);
    expect(diff.env.runtimes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "node",
          aVersion: ">=20",
          bVersion: ">=18",
          match: "different",
        }),
        expect.objectContaining({
          name: "python",
          aVersion: null,
          bVersion: "3.11",
          match: "both",
        }),
      ])
    );
    expect(diff.env.dockerA).toBe(true);
    expect(diff.env.dockerB).toBe(false);
    expect(diff.env.dockerRoleA).toBe("required");
    expect(diff.env.dockerRoleB).toBe("none");
    expect(diff.env.servicesCommon).toEqual(["Redis"]);
    expect(diff.env.servicesOnlyA).toEqual(["PostgreSQL"]);
    expect(diff.env.servicesOnlyB).toEqual(["OpenAI"]);
    expect(diff.env.deployA).toEqual(["Vercel"]);
    expect(diff.env.deployB).toEqual(["Railway"]);
  });

  it("matches canonical services even when display labels differ", () => {
    const a = makeRepoAnalysis({
      url: "https://github.com/acme/a",
      stack: ["TypeScript"],
      servicesRequired: ["Upstash Redis", "OpenAI"],
      servicesRequiredDetails: [
        { label: "Upstash Redis", canonicalId: "redis", kind: "database" },
        { label: "OpenAI", canonicalId: "openai", kind: "ai" },
      ],
    });
    const b = makeRepoAnalysis({
      url: "https://github.com/acme/b",
      stack: ["TypeScript"],
      servicesRequired: ["Redis"],
      servicesRequiredDetails: [{ label: "Redis", canonicalId: "redis", kind: "database" }],
    });

    const diff = buildCompareDiff(a, b);

    expect(diff.env.servicesCommon).toEqual(["Upstash Redis"]);
    expect(diff.env.servicesOnlyA).toEqual(["OpenAI"]);
    expect(diff.env.servicesOnlyB).toEqual([]);
  });

  it("keeps warnings empty when compare targets differ", () => {
    const a = makeRepoAnalysis({
      url: "https://github.com/acme/a",
      stack: ["TypeScript"],
    });
    const b = makeRepoAnalysis({
      url: "https://github.com/acme/b",
      stack: ["TypeScript"],
    });

    expect(buildCompareDiff(a, b).warnings).toEqual([]);
  });
});
