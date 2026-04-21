import { describe, expect, it } from "vitest";
import {
  buildAnalysisStatusView,
  buildCanvasLayoutPreset,
  buildResultSidebarSections,
} from "@/components/result-workspace-model";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";
import { buildArchitectureModel } from "@/lib/analysis/graph";
import {
  fullstackAppFixture,
  limitedLargeRepoFixture,
} from "@/tests/fixtures/analyzer-fixtures";

const dbOnlyWithGapFixture: RepositorySnapshot = {
  repo: {
    owner: "fixture-owner",
    name: "repo-db-gap",
    branch: "main",
    sha: "fixture-sha",
    url: "https://github.com/fixture-owner/repo-db-gap",
    description: "Database-heavy repository with one custom script.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "prisma/schema.prisma",
    "db/client.ts",
    "scripts/reindex.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-db-gap",
    dependencies: {
      prisma: "5.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo DB Gap\n\nDatabase scripts and schema.",
  truncated: false,
};

const multiGapFixture: RepositorySnapshot = {
  repo: {
    owner: "fixture-owner",
    name: "repo-multi-gap",
    branch: "main",
    sha: "fixture-sha",
    url: "https://github.com/fixture-owner/repo-multi-gap",
    description: "Repository with several unclassified code paths.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "prisma/schema.prisma",
    "db/client.ts",
    "scripts/reindex.ts",
    "scripts/seed.ts",
    "src/cli.ts",
    "worker.ts",
    "jobs/reconcile.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-multi-gap",
    dependencies: {
      prisma: "5.0.0",
      openai: "^4.0.0",
      commander: "^12.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
    bin: {
      repolens: "./src/cli.ts",
    },
  }),
  readmeText: "# Repo Multi Gap\n\nRepository with several unclassified code paths.",
  selectedFileContents: {
    "scripts/reindex.ts": `
      import { prisma } from "@/db/client";
      export async function run() {
        await prisma.repo.findMany();
        await fetch("/api/reindex");
      }
    `,
    "scripts/seed.ts": `
      import { prisma } from "@/db/client";
      export async function seed() {
        await prisma.repo.create({ data: {} });
      }
    `,
    "src/cli.ts": `
      import { Command } from "commander";
      const program = new Command();
      program.name("repo-multi-gap");
      console.log(process.argv);
    `,
    "worker.ts": `
      import OpenAI from "openai";
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      export async function work() {
        return client.responses.create({ model: "gpt-5.4-mini", input: "hi" });
      }
    `,
    "jobs/reconcile.ts": `
      export async function reconcile() {
        await fetch("/api/reconcile");
      }
    `,
  },
  truncated: false,
};

const serviceHopGapFixture: RepositorySnapshot = {
  repo: {
    owner: "fixture-owner",
    name: "repo-service-hop-gap",
    branch: "main",
    sha: "fixture-sha",
    url: "https://github.com/fixture-owner/repo-service-hop-gap",
    description: "Repository with unclassified orchestration code importing a service layer.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "jobs/reconcile.ts",
    "src/services/reconcile-service.ts",
    "db/client.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-service-hop-gap",
    dependencies: {
      prisma: "5.0.0",
      openai: "^4.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo Service Hop Gap\n\nUnclassified orchestration code importing a service layer.",
  selectedFileContents: {
    "jobs/reconcile.ts": `
      import { reconcileRepo } from "@/services/reconcile-service";
      export async function runJob() {
        return reconcileRepo();
      }
    `,
    "src/services/reconcile-service.ts": `
      import { prisma } from "@/db/client";
      import OpenAI from "openai";

      export async function reconcileRepo() {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        await prisma.repo.findMany();
        return client.responses.create({ model: "gpt-5.4-mini", input: "summarize" });
      }
    `,
    "db/client.ts": `
      import { PrismaClient } from "@prisma/client";
      export const prisma = new PrismaClient();
    `,
  },
  truncated: false,
};

describe("result workspace model", () => {
  it("stays quiet for fully classified supported repos", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const status = buildAnalysisStatusView(analysis);

    expect(status.level).toBe("ok");
    expect(status.chipLabel).toBeNull();
  });

  it("surfaces partial status and a Code fallback when some code stays unclassified", () => {
    const analysis = analyzeRepositorySnapshot(dbOnlyWithGapFixture);
    const model = buildArchitectureModel(analysis);
    const status = buildAnalysisStatusView(analysis);
    const sections = buildResultSidebarSections({
      analysis,
      model,
      viewMode: "canvas",
      activeFocus: "all",
    });

    expect(analysis.warnings.map((item) => item.code)).toContain("LAYER_CLASSIFICATION_GAP");
    expect(status.level).toBe("partial");
    expect(status.unclassifiedCodeFileCount).toBe(1);
    expect(status.unclassifiedCodeSamples).toEqual(["scripts/reindex.ts"]);

    const layersSection = sections.find((section) => section.id === "layers");
    expect(layersSection?.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["DB", "Code"])
    );
    expect(buildCanvasLayoutPreset({ analysis, model })).toBe("split");
  });

  it("marks limited analyses explicitly", () => {
    const analysis = analyzeRepositorySnapshot(limitedLargeRepoFixture);
    const status = buildAnalysisStatusView(analysis);

    expect(status.level).toBe("limited");
    expect(status.chipLabel).toBe("제한 분석");
  });

  it("keeps a broader preview and reason summary for unclassified code", () => {
    const analysis = analyzeRepositorySnapshot(multiGapFixture);
    const status = buildAnalysisStatusView(analysis);

    expect(status.unclassifiedCodeFileCount).toBeGreaterThanOrEqual(4);
    expect(status.unclassifiedCodeSamples).toEqual(
      expect.arrayContaining([
        "scripts/reindex.ts",
        "scripts/seed.ts",
        "worker.ts",
        "jobs/reconcile.ts",
      ])
    );
    expect(status.unclassifiedCodeReasonSummary).toContain("스크립트/도구 코드 2개");
    expect(status.unclassifiedCodeReasonSummary).toContain("백그라운드 작업 코드 1개");
    expect(status.unclassifiedCodeSemanticSummary).toContain("DB 사용 신호 2개");
    expect(status.unclassifiedCodeSemanticSummary).toContain("내부 API 호출 신호 2개");
    expect(status.unclassifiedCodeSemanticSummary).toContain("외부 SDK 사용 신호 1개");
    expect(status.unclassifiedCodeContentCoverage).toMatch(/^\d\/\d$/);
  });

  it("surfaces second-order service-hop hints for unclassified code", () => {
    const analysis = analyzeRepositorySnapshot(serviceHopGapFixture);
    const status = buildAnalysisStatusView(analysis);

    expect(status.unclassifiedCodeFileCount).toBe(1);
    expect(status.unclassifiedCodeSamples).toEqual(["jobs/reconcile.ts"]);
    expect(status.unclassifiedCodeSemanticSummary).toContain("간접 DB 사용 신호 1개");
    expect(status.unclassifiedCodeSemanticSummary).toContain("간접 외부 SDK 사용 신호 1개");
    expect(status.unclassifiedCodeContentCoverage).toBe("1/1");
  });
});
