import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";
import { buildArchitectureModel } from "@/lib/analysis/graph";
import { buildOneLiner, filterAnalyzablePaths } from "@/lib/analysis/heuristics";
import {
  fullstackAppFixture,
  monorepoPlatformFixture,
  readmeDocsNoiseFixture,
  toolingHarnessFixture,
} from "@/tests/fixtures/analyzer-fixtures";

describe("analysis quality guards", () => {
  it("filters out test, spec, and story files from analyzable paths", () => {
    const filtered = filterAnalyzablePaths([
      "src/index.ts",
      "src/Button.tsx",
      "src/Button.test.tsx",
      "src/Button.spec.ts",
      "src/Button.stories.tsx",
      "src/Button.story.tsx",
      "README.md",
    ]);

    expect(filtered).toEqual(["src/index.ts", "src/Button.tsx", "README.md"]);
  });

  it("keeps focused library key files inside the representative package", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-library-focus",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-library-focus",
        description: "Accessible component library with a docs site and shared infrastructure packages.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/ui/README.md",
        "packages/ui/package.json",
        "packages/ui/src/index.ts",
        "packages/ui/src/components/Button.tsx",
        "packages/ui/src/components/Button.test.tsx",
        "packages/ui/src/utils/index.ts",
        "packages/db/package.json",
        "apps/docs/package.json",
        "apps/docs/app/page.tsx",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-library-focus",
        description: "Accessible component library with a docs site and shared infrastructure packages.",
        workspaces: ["apps/*", "packages/*"],
        dependencies: {
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText:
        "# Library Focus\n\nAccessible component library with docs app and extra infrastructure packages.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.topology.focusRoot).toBe("packages/ui");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["packages/ui/package.json", "packages/ui/src/index.ts"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("packages/db/package.json");
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain(
      "packages/ui/src/components/Button.test.tsx"
    );
    expect(analysis.layers.flatMap((layer) => layer.files)).not.toContain("apps/docs/app/page.tsx");
    expect(analysis.layers.flatMap((layer) => layer.files)).not.toContain("packages/db/package.json");
    expect(analysis.layers.flatMap((layer) => layer.evidence)).toContain("대표 범위: packages/ui");
  });

  it("scopes displayed monorepo layers to the selected focus workspace", () => {
    const analysis = analyzeRepositorySnapshot(monorepoPlatformFixture);
    const displayedPaths = analysis.layers.flatMap((layer) => layer.files);

    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(displayedPaths).toEqual(
      expect.arrayContaining([
        "apps/web/app/page.tsx",
        "apps/web/app/layout.tsx",
        "apps/web/app/api/analyze/route.ts",
      ])
    );
    expect(displayedPaths.some((path) => path.startsWith("apps/docs/"))).toBe(false);
    expect(displayedPaths.some((path) => path.startsWith("packages/ui/"))).toBe(false);
    expect(analysis.layers.every((layer) => layer.evidence.includes("대표 범위: apps/web"))).toBe(true);
  });

  it("adds contextual titles and UI-friendly metadata to graph layer files", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const model = buildArchitectureModel(analysis);
    const uiLayer = model.layerCards.find((layer) => layer.layerName === "UI");

    expect(uiLayer?.keyFiles.map((file) => file.title)).toEqual(
      expect.arrayContaining(["app/page.tsx", "app/layout.tsx", "repo-form.tsx"])
    );

    const startFile = uiLayer?.keyFiles.find((file) => file.path === "app/page.tsx");

    expect(startFile?.isStartFile).toBe(true);
    expect(startFile?.role).toBe("주요 화면 또는 라우트 진입점");
    expect(startFile?.isFallback).toBe(false);
    expect(startFile?.githubUrl).toBe(
      "https://github.com/fixture-owner/repo-app/blob/main/app/page.tsx"
    );
  });

  it("diversifies route-heavy UI representatives toward layout and component surfaces", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-ui-diversity",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-ui-diversity",
        description: "A route-heavy product app with several screens and shared UI shells.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/layout.tsx",
        "app/page.tsx",
        "app/browse/page.tsx",
        "app/settings/page.tsx",
        "components/loading.tsx",
        "components/App.tsx",
        "components/hero.tsx",
        "components/repo-form.tsx",
        "app/api/analyze/route.ts",
        "lib/parser.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-ui-diversity",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# UI Diversity\n\nRoute-heavy app with shared layout and reusable components.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const uiLayer = analysis.layers.find((layer) => layer.name === "UI");
    const model = buildArchitectureModel(analysis);
    const uiCard = model.layerCards.find((layer) => layer.layerName === "UI");

    expect(uiLayer?.files.slice(0, 3)).toEqual([
      "app/page.tsx",
      "app/layout.tsx",
      "components/hero.tsx",
    ]);
    expect(uiCard?.keyFiles.map((file) => file.path)).toEqual([
      "app/page.tsx",
      "app/layout.tsx",
      "components/hero.tsx",
    ]);
    expect(uiCard?.keyFiles.map((file) => file.path)).not.toEqual(
      expect.arrayContaining(["app/browse/page.tsx", "app/settings/page.tsx"])
    );
  });

  it("keeps header points beginner-facing instead of copying summary key features", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);

    expect(analysis.learning.identity.header.points).toEqual([
      "주요 화면에서 어떤 동작이 시작되는지 먼저 볼 수 있습니다.",
      "요청이 어디로 들어와 처리되는지 빠르게 찾을 수 있습니다.",
    ]);
    expect(analysis.summary.keyFeatures).toEqual(
      expect.arrayContaining(["페이지 기반 진입 구조", "서버 요청 처리"])
    );
    expect(
      analysis.learning.identity.header.points.some((point) => analysis.summary.keyFeatures.includes(point))
    ).toBe(false);
  });

  it("uses repository-shape guidance for tooling repos when README points are absent", () => {
    const analysis = analyzeRepositorySnapshot(toolingHarnessFixture);

    expect(analysis.learning.identity.header.points).toEqual([
      "운영 문서와 규칙 파일을 먼저 읽으며 구조를 파악할 수 있습니다.",
      "자동화 스크립트와 검증 흐름을 구분해 읽을 수 있습니다.",
    ]);
    expect(analysis.summary.keyFeatures).toEqual(
      expect.arrayContaining(["운영 문서 중심 구조", "자동화/검증 스크립트 포함"])
    );
  });

  it("rewrites safe english README product bullets into Korean header points", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-scheduling-platform",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-scheduling-platform",
        description: "Open-source scheduling platform for teams.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-scheduling-platform",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# Scheduling Platform

## Highlights

- The community-driven, open-source scheduling platform.
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.keyPoints).toEqual([
      "The community-driven, open-source scheduling platform.",
    ]);
    expect(analysis.learning.identity.header.points).toEqual([
      "커뮤니티 중심으로 운영되는 오픈소스 일정 관리 플랫폼입니다.",
      "주요 화면에서 어떤 동작이 시작되는지 먼저 볼 수 있습니다.",
    ]);
  });

  it("filters promotional README bullets out of readmeCore key points", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-readme-promo-noise",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-readme-promo-noise",
        description: "Beginner-facing repo reader.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-readme-promo-noise",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# Promo Noise

## Highlights

- Active Community: 400+ integrations and 900+ ready-to-use templates
- Enterprise-Ready: Advanced permissions and SSO
- Full Control: Self-host or use our cloud offering
- Show the repo as layers instead of raw files.
- Highlight the first files to read before editing.
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.keyPoints).toEqual([
      "Show the repo as layers instead of raw files.",
      "Highlight the first files to read before editing.",
    ]);
    expect(analysis.learning.identity.header.points).toEqual([
      "파일 나열 대신 레이어 구조로 정리해 보여줍니다.",
      "수정 전에 먼저 볼 파일을 바로 찾을 수 있습니다.",
    ]);
  });

  it("drops framework boilerplate README intros from readmeCore summary", () => {
    const analysis = analyzeRepositorySnapshot(readmeDocsNoiseFixture);

    expect(analysis.learning.readmeCore.summary).toBeNull();
    expect(analysis.learning.readmeCore.keyPoints).toEqual([]);
  });

  it("does not use setup instructions as the readmeCore summary", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-summary-setup-noise",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-summary-setup-noise",
        description: "Repo summary setup noise fixture.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-summary-setup-noise",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# Summary Setup Noise

## Getting Started

First, run the development server:

\`\`\`bash
pnpm dev
\`\`\`

## Overview

This app lets you inspect repository structure in a browser.
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.summary).toBe(
      "This app lets you inspect repository structure in a browser."
    );
  });

  it("guarantees at least one beginner-facing header point for low-signal repos", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-low-signal",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-low-signal",
        description: null,
      },
      allPaths: ["README.md", "package.json"],
      packageJsonText: JSON.stringify({
        name: "repo-low-signal",
      }),
      readmeText: "# Repo Low Signal\n",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.keyFeatures).toEqual(["README 중심 시작 구조"]);
    expect(analysis.learning.readmeCore.keyPoints).toEqual([]);
    expect(analysis.learning.identity.header.points.length).toBeGreaterThanOrEqual(1);
    expect(analysis.learning.identity.header.points[0]?.length).toBeGreaterThanOrEqual(8);
  });

  it("adds a manifest-based fallback key feature when no README-backed feature exists", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-manifest-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-manifest-only",
        description: null,
      },
      allPaths: ["package.json"],
      packageJsonText: JSON.stringify({
        name: "repo-manifest-only",
      }),
      readmeText: null,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.keyFeatures).toEqual(["설정 파일 중심 시작 구조"]);
    expect(analysis.learning.identity.header.points).toEqual([
      "설정 파일과 실행 단서부터 확인하며 구조를 파악할 수 있습니다.",
    ]);
  });

  it("caps trustSummary reasons at three backend-selected items even when more notices exist", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-many-notices",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-many-notices",
        description: "Large unsupported repo with partial parsing.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "scripts/reindex.py",
        "scripts/train.py",
        "scripts/file-0.py",
        "scripts/file-1.py",
        "scripts/file-2.py",
        "scripts/file-3.py",
        "scripts/file-4.py",
      ],
      packageJsonText: '{"name":"repo-many-notices",',
      readmeText: "# Many Notices\n",
      truncated: true,
      selectedFileContents: {
        "scripts/reindex.py": "print('reindex')\n",
      },
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.analysisMode).toBe("limited");
    expect(analysis.coverage.trustSummary.reasons.length).toBeLessThanOrEqual(3);
    expect(analysis.coverage.trustSummary.reasons).toEqual(
      expect.arrayContaining([
        "대형 저장소라 핵심 경로를 먼저 분석했습니다",
        "우선 지원 스택 밖이라 일부 의미 해석 정확도가 낮을 수 있습니다",
      ])
    );
    expect(analysis.coverage.trustSummary.reasons).not.toContain(
      "GitHub 트리 응답이 축약돼 일부 파일은 범위 밖일 수 있습니다"
    );
  });

  it("drops framework default edit instructions from readmeCore summary", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-next-default-readme",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-next-default-readme",
        description: "Next.js default readme fixture.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-next-default-readme",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# Next Default README

This is a Next.js project bootstrapped with create-next-app.

You can start editing the page by modifying app/page.tsx.

This project uses next/font to automatically optimize and load Geist.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the Vercel Platform.
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.summary).toBeNull();
  });

  it("drops license-only boilerplate from readmeCore summary", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-license-noise",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-license-noise",
        description: "License-heavy readme fixture.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-license-noise",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# License Noise

You can find the license information here.

## Overview

This app helps teams inspect workflow structure in the browser.
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.summary).toBe(
      "This app helps teams inspect workflow structure in the browser."
    );
  });

  it("keeps runtime prose sentences instead of treating them as shell commands", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-runtime-prose",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-runtime-prose",
        description: "Runtime prose fixture.",
      },
      allPaths: ["README.md", "package.json", "index.js"],
      packageJsonText: JSON.stringify({
        name: "repo-runtime-prose",
        dependencies: {
          openai: "^4.0.0",
        },
      }),
      readmeText: `# Runtime Prose

This repository provides a collection of examples demonstrating how to use the OpenAI APIs with the Node.js SDK.

The examples are organized by API, with each folder dedicated to a specific API:
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.readmeCore.summary).toBe(
      "This repository provides a collection of examples demonstrating how to use the OpenAI APIs with the Node.js SDK."
    );
  });

  it("demotes weak entry-only logic buckets into Code fallback", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-weak-logic",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-weak-logic",
        description: "Tiny package with only a generic entry file.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts"],
      packageJsonText: JSON.stringify({
        name: "repo-weak-logic",
        main: "./src/index.ts",
        types: "./src/index.ts",
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Weak Logic\n\nTiny package with only a generic entry file.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.layers.map((layer) => layer.name)).not.toContain("Logic");
    expect(analysis.warnings.map((item) => item.code)).toContain("LAYER_CLASSIFICATION_GAP");
    expect(analysis.facts.find((fact) => fact.id === "unclassified_code_reasons")?.value).toContain(
      "엔트리/라이브러리 코드 1개"
    );
  });

  it("prefers role-revealing logic files over generic entries in diagram input", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-logic-priority",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-logic-priority",
        description: "Package with both public entry and internal services.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "src/index.ts",
        "src/lib/utils.ts",
        "src/services/repo-service.ts",
        "src/hooks/useDiagram.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-logic-priority",
        main: "./src/index.ts",
        dependencies: {
          react: "19.2.4",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Logic Priority\n\nPackage with both public entry and internal services.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const model = buildArchitectureModel(analysis);
    const logicLayer = model.layerCards.find((layer) => layer.layerName === "Logic");

    expect(logicLayer?.confidence).toBe("high");
    expect(logicLayer?.keyFiles[0]?.path).toBe("src/services/repo-service.ts");
    expect(logicLayer?.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["src/hooks/useDiagram.ts"])
    );
    expect(logicLayer?.keyFiles.map((file) => file.path)).not.toContain("src/index.ts");
    expect(logicLayer?.keyFiles[0]?.priority).toBeGreaterThan(logicLayer?.keyFiles[2]?.priority ?? 0);
  });

  it("breaks close logic ties toward service-oriented paths over generic core buckets", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-logic-tiebreak",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-logic-tiebreak",
        description: "Package with multiple logic candidates of similar weight.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "src/core/repo.ts",
        "src/services/repo.ts",
        "src/features/repo.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-logic-tiebreak",
        dependencies: {
          react: "19.2.4",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Logic Tiebreak\n\nPackage with multiple logic candidates of similar weight.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const model = buildArchitectureModel(analysis);
    const logicLayer = model.layerCards.find((layer) => layer.layerName === "Logic");

    expect(logicLayer?.keyFiles[0]?.path).toBe("src/services/repo.ts");
    expect(logicLayer?.keyFiles[1]?.path).toBe("src/features/repo.ts");
    expect(logicLayer?.keyFiles[2]?.path).toBe("src/core/repo.ts");
  });

  it("diversifies API representatives toward route, middleware, and controller surfaces", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-api-diversity",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-api-diversity",
        description: "API-heavy app with routes, middleware, and server handlers.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/api/analyze/route.ts",
        "app/api/preview/route.ts",
        "middleware.ts",
        "api/controllers/repo-controller.ts",
        "lib/repo-service.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-api-diversity",
        dependencies: {
          next: "16.2.4",
        },
      }),
      readmeText: "# API Diversity\n\nAPI-heavy app with routes, middleware, and server handlers.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const apiLayer = analysis.layers.find((layer) => layer.name === "API");
    const model = buildArchitectureModel(analysis);
    const apiCard = model.layerCards.find((layer) => layer.layerName === "API");

    expect(apiLayer?.files.slice(0, 3)).toEqual([
      "app/api/analyze/route.ts",
      "middleware.ts",
      "api/controllers/repo-controller.ts",
    ]);
    expect(apiCard?.keyFiles.map((file) => file.path)).toEqual([
      "app/api/analyze/route.ts",
      "middleware.ts",
      "api/controllers/repo-controller.ts",
    ]);
    expect(apiCard?.keyFiles.map((file) => file.path)).not.toContain("app/api/preview/route.ts");
  });

  it("diversifies DB representatives toward schema, client, and migration surfaces", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-db-diversity",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-db-diversity",
        description: "App with schema, migrations, and database access helpers.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "prisma/schema.prisma",
        "db/client.ts",
        "migrations/001_init.sql",
        "db/seeds.ts",
        "lib/repo-service.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-db-diversity",
        dependencies: {
          next: "16.2.4",
          prisma: "^6.0.0",
        },
      }),
      readmeText: "# DB Diversity\n\nApp with schema, migrations, and database access helpers.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const dbLayer = analysis.layers.find((layer) => layer.name === "DB");
    const model = buildArchitectureModel(analysis);
    const dbCard = model.layerCards.find((layer) => layer.layerName === "DB");

    expect(dbLayer?.files.slice(0, 3)).toEqual([
      "prisma/schema.prisma",
      "db/client.ts",
      "migrations/001_init.sql",
    ]);
    expect(dbCard?.keyFiles.map((file) => file.path)).toEqual([
      "prisma/schema.prisma",
      "db/client.ts",
      "migrations/001_init.sql",
    ]);
    expect(dbCard?.keyFiles.map((file) => file.path)).not.toContain("db/seeds.ts");
  });

  it("diversifies external representatives toward provider, auth, and storage surfaces", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-external-diversity",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-external-diversity",
        description: "App with multiple third-party integrations and auth layers.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "integrations/openai.ts",
        "integrations/github.ts",
        "integrations/auth/session.ts",
        "integrations/storage/r2.ts",
        "integrations/webhooks/stripe-webhook.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-external-diversity",
        dependencies: {
          openai: "^4.0.0",
          "@clerk/nextjs": "^5.0.0",
        },
      }),
      readmeText: "# External Diversity\n\nApp with multiple third-party integrations and auth layers.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const externalLayer = analysis.layers.find((layer) => layer.name === "External");
    const model = buildArchitectureModel(analysis);
    const externalCard = model.layerCards.find((layer) => layer.layerName === "External");

    expect(externalLayer?.files.slice(0, 3)).toEqual([
      "integrations/openai.ts",
      "integrations/auth/session.ts",
      "integrations/storage/r2.ts",
    ]);
    expect(externalCard?.keyFiles.map((file) => file.path)).toEqual([
      "integrations/openai.ts",
      "integrations/auth/session.ts",
      "integrations/storage/r2.ts",
    ]);
    expect(externalCard?.keyFiles.map((file) => file.path)).not.toContain(
      "integrations/github.ts"
    );
  });

  it("keeps beginner-facing one-liners compact when limited analysis and semantic hints both exist", () => {
    const oneLiner = buildOneLiner({
      projectType: "모노레포 웹 플랫폼",
      description: "Fair-code workflow automation platform with native AI capabilities.",
      stack: ["TypeScript", "Vue", "Node.js"],
      routeCount: 0,
      apiCount: 0,
      truncated: true,
      plainTitle: "자동화 흐름을 만들고 실행하는 서비스",
      identitySubtitle: "자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다.",
      semanticAddon: "대표 코드 기준, Sentry 연동이 확인됩니다.",
    });

    expect(oneLiner).toBe(
      "자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다. 루트 설정과 대표 앱 루트를 기준으로 구조를 정리했고, 대표 코드에서는 Sentry 연동이 확인됩니다."
    );
    expect(oneLiner).not.toContain("현재 결과는 주요 코드 기준 요약입니다.");
    expect(oneLiner.split(/(?<=[.!?])\s+/)).toHaveLength(2);
  });

  it("prefers a specific plain title over generic structural subtitle copy", () => {
    const oneLiner = buildOneLiner({
      projectType: "모노레포 웹 플랫폼",
      description: "Open scheduling infrastructure for everyone.",
      stack: ["TypeScript", "React"],
      routeCount: 0,
      apiCount: 0,
      truncated: false,
      plainTitle: "일정과 예약을 관리하는 서비스",
      identitySubtitle: "여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼 구조를 먼저 보면 전체 흐름이 빨리 잡힙니다.",
      semanticAddon: "대표 코드 기준, Stripe 연동이 확인됩니다.",
    });

    expect(oneLiner).toBe(
      "일정과 예약을 관리하는 서비스입니다. 루트 설정과 대표 앱 루트를 기준으로 구조를 정리했고, 대표 코드에서는 Stripe 연동이 확인됩니다."
    );
  });

  it("suppresses redundant plain semantic addons when the first sentence already states the same service", () => {
    const oneLiner = buildOneLiner({
      projectType: "풀스택 웹앱",
      description: "OpenAI-powered repo explanation app.",
      stack: ["Next.js", "React"],
      routeCount: 2,
      apiCount: 1,
      truncated: false,
      plainTitle: "OpenAI로 레포 설명을 돕는 서비스",
      identitySubtitle: "OpenAI로 공개 GitHub 레포를 이해하기 쉽게 설명하는 서비스입니다.",
      semanticAddon: "대표 코드 기준, OpenAI 연동이 확인됩니다.",
    });

    expect(oneLiner).toBe(
      "OpenAI로 공개 GitHub 레포를 이해하기 쉽게 설명하는 서비스입니다. 화면 2개와 API 1개 흐름을 기준으로 구조를 정리했습니다."
    );
  });

  it("keeps semantic addons when they add flow context beyond a repeated service name", () => {
    const oneLiner = buildOneLiner({
      projectType: "풀스택 웹앱",
      description: "OpenAI-powered repo explanation app.",
      stack: ["Next.js", "React"],
      routeCount: 2,
      apiCount: 1,
      truncated: false,
      plainTitle: "OpenAI로 레포 설명을 돕는 서비스",
      identitySubtitle: "OpenAI로 공개 GitHub 레포를 이해하기 쉽게 설명하는 서비스입니다.",
      semanticAddon:
        "대표 코드 기준, app/page.tsx에서 /api/analyze 요청을 보내고 이 API 흐름에서 OpenAI 연동이 확인됩니다.",
    });

    expect(oneLiner).toBe(
      "OpenAI로 공개 GitHub 레포를 이해하기 쉽게 설명하는 서비스입니다. 화면 2개와 API 1개 흐름을 기준으로 구조를 정리했고, 대표 코드에서는 /api/analyze 요청 뒤 OpenAI 연동이 확인됩니다."
    );
  });
});
