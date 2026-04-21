import { describe, expect, it } from "vitest";
import { buildCompareDiff } from "@/lib/analysis/compare";
import {
  buildCompareDiagnostics,
  formatCompareDiagnostics,
} from "@/lib/analysis/compare-diagnostics";
import type { RepoAnalysis } from "@/lib/analysis/types";

function makeRepoAnalysis(args: {
  url: string;
  stack: string[];
  layers?: Partial<Record<"UI" | "Logic" | "API" | "DB" | "External", number>>;
  codeCount?: number;
  runtimes?: Array<{
    name: "node" | "python" | "go" | "rust" | "java" | "ruby" | "bun" | "deno";
    version: string | null;
  }>;
  docker?: boolean;
  servicesRequired?: string[];
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

describe("compare diagnostics", () => {
  it("summarizes compare diff counts, modes, and previews", () => {
    const a = makeRepoAnalysis({
      url: "https://github.com/acme/web-app",
      stack: ["Next.js", "React", "TypeScript"],
      layers: { UI: 5, Logic: 3, API: 2 },
      codeCount: 1,
      runtimes: [{ name: "node", version: ">=20" }],
      docker: true,
      servicesRequired: ["PostgreSQL", "Redis"],
      deployTargets: ["Vercel"],
    });
    const b = makeRepoAnalysis({
      url: "https://github.com/acme/worker",
      stack: ["TypeScript", "Python"],
      layers: { Logic: 4, DB: 2 },
      runtimes: [
        { name: "node", version: ">=18" },
        { name: "python", version: "3.11" },
      ],
      servicesRequired: ["Redis", "OpenAI"],
      deployTargets: ["Railway"],
    });

    const diagnostics = buildCompareDiagnostics(buildCompareDiff(a, b));

    expect(diagnostics.labels).toEqual({
      a: "acme/web-app",
      b: "acme/worker",
    });
    expect(diagnostics.counts.commonStack).toBe(1);
    expect(diagnostics.counts.onlyAStack).toBe(2);
    expect(diagnostics.counts.onlyBStack).toBe(1);
    expect(diagnostics.counts.sharedLayers).toBe(1);
    expect(diagnostics.counts.onlyALayers).toBe(3);
    expect(diagnostics.counts.onlyBLayers).toBe(1);
    expect(diagnostics.counts.runtimeDifferent).toBe(1);
    expect(diagnostics.counts.runtimeOnlyB).toBe(1);
    expect(diagnostics.counts.servicesCommon).toBe(1);
    expect(diagnostics.modes.docker).toBe("onlyA");
    expect(diagnostics.modes.deploy).toBe("different");
    expect(diagnostics.previews.sharedLayers).toEqual(["Logic"]);
    expect(diagnostics.previews.servicesCommon).toEqual(["Redis"]);
    expect(formatCompareDiagnostics(diagnostics)).toEqual(
      expect.arrayContaining([
        "compare acme/web-app ↔ acme/worker",
        "modes docker=onlyA deploy=different",
      ])
    );
  });

  it("treats overlapping deploy targets as shared", () => {
    const a = makeRepoAnalysis({
      url: "https://github.com/acme/a",
      stack: ["TypeScript"],
      deployTargets: ["Vercel", "Railway"],
    });
    const b = makeRepoAnalysis({
      url: "https://github.com/acme/b",
      stack: ["TypeScript"],
      deployTargets: ["Vercel"],
    });

    const diagnostics = buildCompareDiagnostics(buildCompareDiff(a, b));

    expect(diagnostics.modes.deploy).toBe("shared");
  });
});
