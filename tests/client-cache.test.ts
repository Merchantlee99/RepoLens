import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCachedAnalysis, saveCachedAnalysis } from "@/lib/analysis/client";
import type { RepoAnalysis } from "@/lib/analysis/types";

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function sampleAnalysis(): RepoAnalysis {
  return {
    schemaVersion: "mvp-v3",
    kind: "repo",
    analysisMode: "full",
    repo: {
      owner: "fixture-owner",
      name: "fixture-repo",
      branch: "main",
      sha: "fixture-sha",
      url: "https://github.com/fixture-owner/fixture-repo",
      description: null,
    },
    stats: {
      sourceFileCount: 1,
      filteredFileCount: 1,
      fileCount: 1,
      directoryCount: 1,
      truncated: false,
      routeCount: 0,
      apiEndpointCount: 0,
    },
    summary: {
      oneLiner: "fixture analysis",
      projectType: "라이브러리 또는 개발 도구",
      stack: ["TypeScript"],
      difficulty: "easy",
      keyFeatures: ["운영 문서 중심 구조"],
      recommendedStartFile: "README.md",
      recommendedStartReason: "README 문서",
      analysisScopeLabel: "코드/설정 파일 1개 기준 분석",
    },
    topology: {
      kind: "single",
      workspaceRoots: [],
      workspaceGroups: [],
      focusRoot: "vb-pack-codex-harness",
      manifestFiles: [],
    },
    facts: [],
    inferences: [],
    limitations: [],
    warnings: [],
    layers: [],
    keyFiles: [],
    editGuides: [],
    learning: {
      identity: {
        plainTitle: "운영 문서 중심 TypeScript 저장소",
        projectKind: "라이브러리 또는 개발 도구",
        consumptionMode: "unknown",
        useCase: null,
        audience: "개발자",
        outputType: "다른 코드에서 불러다 쓰는 패키지",
        coreStack: ["TypeScript"],
        stackNarrative: "주요 기술은 TypeScript(타입 기반 구조)입니다.",
        stackHighlights: [
          {
            name: "TypeScript",
            role: "타입 기반 구조",
            examplePath: "vb-pack-codex-harness/scripts/harness/bootstrap.py",
          },
        ],
        header: { subtitle: null, points: [] },
        startHere: {
          path: "README.md",
          reason: "README 문서",
        },
        readOrder: [
          {
            label: "프로젝트 설명 보기",
            path: "README.md",
            reason: "README에 프로젝트 목적과 실행 방법이 먼저 정리되어 있습니다.",
          },
        ],
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
      stackSummary: "TypeScript 기반 저장소",
      stackGlossary: [],
      usage: {
        install: ["npm install"],
        run: [],
        build: [],
        test: [],
        example: [],
        source: "package_json",
        details: [
          {
            kind: "install",
            command: "npm install",
            source: "package_json",
            scope: "root",
            explanation: "프로젝트를 실행하기 전에 필요한 의존성을 설치합니다.",
          },
        ],
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
          monthlyUsdLow: null,
          monthlyUsdHigh: null,
          drivers: [],
        },
        confidence: "low",
        confidenceNote: null,
      },
    },
    coverage: {
      level: "ok",
      chipLabel: null,
      summary: "대표 범위의 코드 구조를 의미 레이어 기준으로 정리했습니다.",
      details: [],
      trustSummary: {
        level: "ok",
        headline: "표시 범위의 구조를 사실 기반으로 정리했습니다.",
        detail: null,
        reasons: [],
        omissions: [],
        basedOn: [],
        approximate: true,
      },
      supportedStackDetected: false,
      supportGapMessage: "이 레포는 MVP 우선 지원 스택 바깥에 있어 일부 설명 정확도가 낮을 수 있습니다.",
      codeLikeFileCount: 0,
      classifiedCodeFileCount: 0,
      unclassifiedCodeFileCount: 0,
      unclassifiedCodeSamples: [],
      unclassifiedReasonSummary: null,
      unclassifiedReasonGroups: [],
      unclassifiedSemanticSummary: null,
      unclassifiedSemanticGroups: [],
      unclassifiedContentCoverage: null,
    },
  };
}

describe("analysis client cache", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const sessionStorage = createStorage();
    globalThis.window = { sessionStorage } as Window & typeof globalThis;
  });

  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
      return;
    }

    // @ts-expect-error cleanup for node test environment
    delete globalThis.window;
  });

  it("loads versioned cached analysis", () => {
    const analysis = sampleAnalysis();

    saveCachedAnalysis(analysis.repo.url, analysis);

    expect(loadCachedAnalysis(analysis.repo.url)).toEqual(analysis);
  });

  it("invalidates legacy unversioned cache entries", () => {
    const analysis = sampleAnalysis();
    const storageKey = "repolens:analysis:https://github.com/fixture-owner/fixture-repo";

    globalThis.window.sessionStorage.setItem(storageKey, JSON.stringify(analysis));

    expect(loadCachedAnalysis(analysis.repo.url)).toBeNull();
    expect(globalThis.window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  it("normalizes cached repo analysis when optional cloud services are missing", () => {
    const analysis = sampleAnalysis();
    const storageKey = "repolens:analysis:https://github.com/fixture-owner/fixture-repo";
    const legacyEnvelope = {
      version: 8,
      analysis: {
        ...analysis,
        learning: {
          stackSummary: analysis.learning.stackSummary,
          stackGlossary: analysis.learning.stackGlossary,
          usage: analysis.learning.usage,
          preview: analysis.learning.preview,
          environment: {
            ...analysis.learning.environment,
            cloud: {
              deployTargets: [],
              servicesRequired: ["OpenAI"],
              source: "readme" as const,
            },
          },
        },
      },
    };

    globalThis.window.sessionStorage.setItem(storageKey, JSON.stringify(legacyEnvelope));

    const restored = loadCachedAnalysis(analysis.repo.url);

    expect(restored?.kind).toBe("repo");
    if (!restored || restored.kind !== "repo") {
      throw new Error("expected repo analysis");
    }

    expect(restored).toMatchObject({
      ...analysis,
      learning: {
        environment: {
          cloud: {
            deployTargets: [],
            servicesRequired: ["OpenAI"],
            servicesOptional: [],
            source: "readme",
          },
        },
        readmeCore: {
          source: "none",
        },
      },
    });
    expect(restored.learning.identity.plainTitle).toBe("라이브러리 또는 개발 도구");
    expect(restored.learning.identity.projectKind).toBe("라이브러리 또는 개발 도구");
    expect(restored.learning.identity.stackNarrative).toBeNull();
    expect(restored.learning.identity.stackHighlights).toEqual([]);
    expect(restored.learning.identity.header).toEqual({
      subtitle: null,
      points: [],
    });
  });

  it("normalizes cached stack glossary items when repo-specific usage fields are missing", () => {
    const analysis = sampleAnalysis();
    const storageKey = "repolens:analysis:https://github.com/fixture-owner/fixture-repo";
    const legacyEnvelope = {
      version: 8,
      analysis: {
        ...analysis,
        learning: {
          ...analysis.learning,
          stackGlossary: [
            {
              name: "TypeScript",
              kind: "language" as const,
              description: "타입 정보를 더해 구조를 읽기 쉽게 해주는 언어입니다.",
              reasons: ["`.ts/.tsx` 파일이 있습니다."],
            },
          ],
        },
      },
    };

    globalThis.window.sessionStorage.setItem(storageKey, JSON.stringify(legacyEnvelope));

    const restored = loadCachedAnalysis(analysis.repo.url);

    expect(restored?.kind).toBe("repo");
    if (!restored || restored.kind !== "repo") {
      throw new Error("expected repo analysis");
    }

    expect(restored.learning.stackGlossary).toEqual([
      {
        name: "TypeScript",
        kind: "language",
        description: "타입 정보를 더해 구조를 읽기 쉽게 해주는 언어입니다.",
        reasons: ["`.ts/.tsx` 파일이 있습니다."],
        usedFor: null,
        examplePaths: [],
      },
    ]);
  });
});
