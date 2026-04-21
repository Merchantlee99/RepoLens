import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";
import { buildArchitectureModel } from "@/lib/analysis/graph";
import {
  CODE_FALLBACK_ID,
  buildAnalysisStatusChip,
  buildAnalysisStatusView,
  buildCodeFallbackInspectorView,
  buildFallbackFileInspectorView,
  buildInspectorView,
  buildLeftPanelSections,
  buildLayerTechHints,
  buildResultIntroView,
  buildResultSummaryView,
  buildStartFileAnchor,
  buildVisibleFileRows,
} from "@/components/result-view-model";
import {
  fullstackAppFixture,
  monorepoPlatformFixture,
} from "@/tests/fixtures/analyzer-fixtures";
import type { LayerName } from "@/lib/analysis/types";

describe("result view model", () => {
  it("builds a compact summary strip from analysis output", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const summary = buildResultSummaryView(analysis);
    const intro = buildResultIntroView(analysis);

    expect(summary.summary).toBe(analysis.summary.oneLiner);
    expect(summary.stackChips).toEqual(expect.arrayContaining(["Next.js", "React", "Tailwind"]));
    expect(summary.scaleLine).toMatch(/^파일 \d+개/);
    expect(summary.scaleLine).not.toContain("핵심 포인트:");
    expect(summary.scaleLine).not.toContain("레이어");
    expect(intro.summary).toBe(summary.summary);
    expect(intro.scaleItems).toEqual(expect.arrayContaining([expect.stringMatching(/^파일 \d+개$/)]));
  });

  it("marks the intro start anchor as already shown when the canvas row already renders it", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const model = buildArchitectureModel(analysis);
    const visiblePathsByLayer = new Map<LayerName, Set<string>>();

    model.layerCards.forEach((layer) => {
      const rows = buildVisibleFileRows({
        paths: layer.keyFiles.map((file) => file.path),
        layerName: layer.layerName,
        analysis,
        model,
        limit: 3,
      });
      visiblePathsByLayer.set(layer.layerName, new Set(rows.map((row) => row.path)));
    });

    const anchor = buildStartFileAnchor(analysis, model, visiblePathsByLayer);

    expect(anchor?.shownInBox).toBe(true);
  });

  it("derives conservative layer tech hints from stack and semantic facts", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-layer-hints",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-layer-hints",
        description: null,
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/api/analyze/route.ts",
        "db/client.ts",
        "integrations/openai.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "semantic-layer-hints",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          tailwindcss: "4.2.2",
          "@prisma/client": "^5.0.0",
          openai: "^4.0.0",
        },
      }),
      readmeText: "# Semantic Layer Hints",
      selectedFileContents: {
        "app/page.tsx": `export default async function Page() { await fetch("/api/analyze"); return null; }`,
        "app/api/analyze/route.ts": `import OpenAI from "openai"; import { prisma } from "@/db/client"; export async function POST() { await prisma.repo.findMany(); return Response.json({ ok: true }); }`,
        "db/client.ts": `import { PrismaClient } from "@prisma/client"; export const prisma = new PrismaClient();`,
        "integrations/openai.ts": `import OpenAI from "openai"; export const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(buildLayerTechHints(analysis, "UI")).toEqual(["React", "Next.js"]);
    expect(buildLayerTechHints(analysis, "API")).toEqual(["Route Handlers", "Next.js"]);
    expect(buildLayerTechHints(analysis, "DB")).toEqual(["Prisma"]);
    expect(buildLayerTechHints(analysis, "External")).toEqual(["OpenAI"]);
  });

  it("rewrites file inspector to a learning-first narrative", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const model = buildArchitectureModel(analysis);
    const inspector = model.inspectables["file:app/page.tsx"];

    if (!inspector) {
      throw new Error("expected file inspector for app/page.tsx");
    }

    const view = buildInspectorView({ inspector, analysis, model });

    expect(view.kind).toBe("file");
    expect(view.narrative.map((section) => section.label)).toEqual([
      "이 파일은 무엇인가요?",
      "왜 중요한가요?",
      "어디에서 쓰이나요?",
    ]);
    expect(view.editGuides.length).toBeGreaterThan(0);
  });

  it("keeps file usage copy short and moves related files into rows", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "inspector-usage",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/inspector-usage",
        description: null,
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/layout.tsx",
        "app/page.tsx",
        "app/api/analyze/route.ts",
        "components/result-panel.tsx",
      ],
      packageJsonText: JSON.stringify({
        name: "inspector-usage",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: "# Inspector Usage",
      selectedFileContents: {
        "app/layout.tsx": `export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }`,
        "app/page.tsx": `import { ResultPanel } from "@/components/result-panel"; export default async function Page() { await fetch("/api/analyze"); return <ResultPanel />; }`,
        "app/api/analyze/route.ts": `export async function POST() { return Response.json({ ok: true }); }`,
        "components/result-panel.tsx": `export function ResultPanel() { return <div>result</div>; }`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const model = buildArchitectureModel(analysis);
    const pageInspector = model.inspectables["file:app/page.tsx"];
    const routeInspector = model.inspectables["file:app/api/analyze/route.ts"];

    if (!pageInspector || !routeInspector) {
      throw new Error("expected file inspectors for page and route");
    }

    const pageView = buildInspectorView({ inspector: pageInspector, analysis, model });
    const routeView = buildInspectorView({ inspector: routeInspector, analysis, model });

    expect(pageView.narrative[2]?.body).toBe("이 파일에서 analyze 요청이 나갑니다.");
    expect(pageView.files.length).toBeGreaterThan(0);
    expect(pageView.files.some((row) => row.path === "app/page.tsx")).toBe(false);
    expect(routeView.narrative[2]?.body).toContain("경로에서 이 파일로 들어옵니다.");
  });

  it("builds left-panel sections and hides empty scope/status sections", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const model = buildArchitectureModel(analysis);
    const sections = buildLeftPanelSections({
      analysis,
      model,
      viewMode: "canvas",
      activeFocus: "all",
      selectedId: null,
    });

    // 보기 탭 구성은 "정체성 → 구조 → README → 실행 환경" 순서. 관계도는
     // 구조 보기 탭 안쪽 sub-toggle로 이동했으므로 panel 엔트리가 아니다.
    expect(sections.map((section) => section.id)).toEqual(["view", "layer"]);
    const viewLabels = sections
      .find((section) => section.id === "view")
      ?.items.map((item) => item.label) ?? [];
    expect(viewLabels[0]).toBe("먼저 이해하기");
    expect(viewLabels).toContain("구조 보기");
    expect(viewLabels).not.toContain("관계도");
    expect(viewLabels).not.toContain("레이어 지도");
    expect(sections.find((section) => section.id === "layer")?.items.map((item) => item.label)).toContain("전체");
  });

  it("keeps the learning view visible when only environment signals exist", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "docker-only-learning",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/docker-only-learning",
        description: "A repository that only exposes runtime environment hints.",
      },
      allPaths: ["README.md", "Dockerfile"],
      readmeText: "# Docker Only Learning\n",
      selectedFileContents: {
        Dockerfile: `
          FROM node:20-alpine
          EXPOSE 3000
        `,
      },
      truncated: false,
    });
    const model = buildArchitectureModel(analysis);
    const sections = buildLeftPanelSections({
      analysis,
      model,
      viewMode: "canvas",
      activeFocus: "all",
      selectedId: null,
    });

    expect(sections.find((section) => section.id === "view")?.items.map((item) => item.label)).toContain(
      "먼저 이해하기"
    );
    expect(analysis.learning.environment.container.hasDockerfile).toBe(true);
  });

  it("shows scope section for monorepos and exposes a status chip for limited analyses", () => {
    const analysis = analyzeRepositorySnapshot(monorepoPlatformFixture);
    const model = buildArchitectureModel(analysis);
    const sections = buildLeftPanelSections({
      analysis,
      model,
      viewMode: "diagram",
      activeFocus: "UI",
      selectedId: null,
    });

    expect(sections.map((section) => section.id)).toContain("scope");

    const limitedAnalysis = analyzeRepositorySnapshot({
      ...fullstackAppFixture,
      truncated: true,
    });
    const chip = buildAnalysisStatusChip(limitedAnalysis);
    const statusView = buildAnalysisStatusView(limitedAnalysis);

    expect(chip?.label).toBe("제한 분석");
    expect(chip?.count).toBeGreaterThan(0);
    expect(statusView.title).toBe("분석 상태");
    expect(statusView.evidence.length).toBeGreaterThan(0);
  });

  it("shows only detected layers and adds Code fallback for unclassified code", () => {
    const snapshot: RepositorySnapshot = {
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

    const analysis = analyzeRepositorySnapshot(snapshot);
    const model = buildArchitectureModel(analysis);
    const sections = buildLeftPanelSections({
      analysis,
      model,
      viewMode: "canvas",
      activeFocus: "all",
      selectedId: "status:analysis",
    });

    const layerLabels = sections.find((section) => section.id === "layer")?.items.map((item) => item.label);
    const statusLabels = sections.find((section) => section.id === "status")?.items.map((item) => item.label);
    const codeItem = sections
      .find((section) => section.id === "layer")
      ?.items.find((item) => item.label === "미분류 코드");
    const chip = buildAnalysisStatusChip(analysis);
    const codeView = buildCodeFallbackInspectorView(analysis, model);
    const fallbackFileView = buildFallbackFileInspectorView({
      path: "scripts/reindex.ts",
      analysis,
      model,
    });

    expect(layerLabels).toEqual(["전체", "데이터", "미분류 코드"]);
    expect(statusLabels).toEqual(["부분 분석"]);
    expect(codeItem?.targetId).toBe(CODE_FALLBACK_ID);
    expect(chip?.label).toBe("부분 분석");
    expect(codeView.title).toBe("미분류 코드 (Code)");
    expect(codeView.files[0]?.targetId).toMatch(/^file(?::|-fallback:)/);
    expect(codeView.narrative[1]?.body).toContain("fallback");
    expect(fallbackFileView.kind).toBe("file");
    expect(fallbackFileView.breadcrumb?.targetId).toBe(CODE_FALLBACK_ID);
    expect(fallbackFileView.narrative[0]?.body).toContain("분류되지 않은 코드");
  });

  it("uses the broader unclassified preview inside the Code fallback inspector", () => {
    const snapshot: RepositorySnapshot = {
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

    const analysis = analyzeRepositorySnapshot(snapshot);
    const model = buildArchitectureModel(analysis);
    const codeView = buildCodeFallbackInspectorView(analysis, model);

    expect(codeView.files.length).toBeGreaterThanOrEqual(4);
    expect(codeView.files.map((row) => row.path)).toEqual(
      expect.arrayContaining([
        "scripts/reindex.ts",
        "scripts/seed.ts",
        "worker.ts",
        "jobs/reconcile.ts",
      ])
    );
    expect(codeView.evidence.join(" ")).toContain("스크립트/도구 코드 2개");
    expect(codeView.evidence.join(" ")).toContain("백그라운드 작업 코드 1개");
    expect(codeView.evidence.join(" ")).toContain("DB 사용 신호 2개");
    expect(codeView.evidence.join(" ")).toContain("내부 API 호출 신호 2개");
  });
});
