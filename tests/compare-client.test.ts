import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCachedCompareRepoPair,
  requestCompareRepoPair,
  validateCompareRepoPair,
} from "@/lib/analysis/compare-client";
import { saveCachedAnalysis } from "@/lib/analysis/client";
import type { OwnerAnalysis, RepoAnalysis } from "@/lib/analysis/types";

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

function sampleRepoAnalysis(url: string): RepoAnalysis {
  const parsed = new URL(url);
  const [, owner, name] = parsed.pathname.split("/");

  return {
    schemaVersion: "mvp-v3",
    kind: "repo",
    analysisMode: "full",
    repo: {
      owner,
      name,
      branch: "main",
      sha: "fixture-sha",
      url,
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
      stack: ["TypeScript"],
      difficulty: "easy",
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
    layers: [],
    keyFiles: [],
    editGuides: [],
    learning: {
      identity: {
        plainTitle: "테스트용 저장소",
        projectKind: "웹 앱",
        useCase: null,
        audience: null,
        outputType: null,
        coreStack: ["TypeScript"],
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
        runtimes: [],
        container: {
          hasDockerfile: false,
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
          deployTargets: [],
          servicesRequired: [],
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

function sampleOwnerAnalysis(url: string): OwnerAnalysis {
  const parsed = new URL(url);
  const [, login] = parsed.pathname.split("/");

  return {
    schemaVersion: "mvp-v3",
    kind: "owner",
    owner: {
      login,
      url,
      avatarUrl: null,
      profileType: "organization",
      displayName: null,
      description: null,
      blog: null,
      location: null,
    },
    summary: {
      oneLiner: login,
      ownerTypeLabel: "오가니제이션",
      publicRepoCount: 0,
      sampledRepoCount: 0,
      enrichedRepoCount: 0,
      commonStacks: [],
      commonLanguages: [],
      keyThemes: [],
      recommendedStartingPoints: [],
    },
    portfolio: {
      featuredRepos: [],
      beginnerRepos: [],
      latestRepos: [],
      categories: [],
    },
    facts: [],
    warnings: [],
    limitations: [],
  };
}

describe("compare client", () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const sessionStorage = createStorage();
    globalThis.window = { sessionStorage } as Window & typeof globalThis;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      // @ts-expect-error cleanup for node test env
      delete globalThis.fetch;
    }

    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error cleanup for node test env
      delete globalThis.window;
    }
  });

  it("validates a compare pair and preserves same-url warnings", () => {
    expect(
      validateCompareRepoPair(
        "https://github.com/vercel/next.js",
        "https://github.com/vercel/next.js"
      )
    ).toEqual({
      inputs: {
        a: {
          owner: "vercel",
          repo: "next.js",
          canonicalUrl: "https://github.com/vercel/next.js",
          label: "vercel/next.js",
        },
        b: {
          owner: "vercel",
          repo: "next.js",
          canonicalUrl: "https://github.com/vercel/next.js",
          label: "vercel/next.js",
        },
      },
      warnings: ["두 레포를 동일하게 입력했어요."],
    });
  });

  it("loads cached repo analyses for both compare slots", () => {
    const pair = validateCompareRepoPair(
      "https://github.com/vercel/next.js",
      "https://github.com/vercel/turbo"
    );
    const a = sampleRepoAnalysis(pair.inputs.a.canonicalUrl);
    const b = sampleRepoAnalysis(pair.inputs.b.canonicalUrl);

    saveCachedAnalysis(pair.inputs.a.canonicalUrl, a);
    saveCachedAnalysis(pair.inputs.b.canonicalUrl, b);

    const cached = loadCachedCompareRepoPair(pair);

    expect(cached.slots.a.analysis?.repo.url).toBe(pair.inputs.a.canonicalUrl);
    expect(cached.slots.b.analysis?.repo.url).toBe(pair.inputs.b.canonicalUrl);
    expect(cached.slots.a.error).toBeNull();
    expect(cached.slots.b.error).toBeNull();
  });

  it("handles partial compare fetch failures per slot", async () => {
    const pair = validateCompareRepoPair(
      "https://github.com/vercel/next.js",
      "https://github.com/vercel/turbo"
    );
    const a = sampleRepoAnalysis(pair.inputs.a.canonicalUrl);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: a }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "rate limited",
            retryable: true,
            details: { authenticated: true },
          },
        }),
      });

    const result = await requestCompareRepoPair(pair, { forceRefresh: true });

    expect(result.slots.a.analysis?.repo.url).toBe(pair.inputs.a.canonicalUrl);
    expect(result.slots.a.error).toBeNull();
    expect(result.slots.b.analysis).toBeNull();
    expect(result.slots.b.error).toBe("rate limited");
  });

  it("rejects non-repo analysis payloads inside compare fetches", async () => {
    const pair = validateCompareRepoPair(
      "https://github.com/vercel/next.js",
      "https://github.com/vercel/turbo"
    );
    const ownerAnalysis = sampleOwnerAnalysis("https://github.com/vercel");
    const repoAnalysis = sampleRepoAnalysis(pair.inputs.b.canonicalUrl);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: ownerAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: repoAnalysis }),
      });

    const result = await requestCompareRepoPair(pair, { forceRefresh: true });

    expect(result.slots.a.analysis).toBeNull();
    expect(result.slots.a.error).toBe("비교 모드는 repo URL만 지원합니다.");
    expect(result.slots.b.analysis?.repo.url).toBe(pair.inputs.b.canonicalUrl);
  });
});
