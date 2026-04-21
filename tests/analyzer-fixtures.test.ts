import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";
import {
  cliToolFixture,
  designSystemPlatformFixture,
  docsHeavyMonorepoFixture,
  exampleCollectionFixture,
  fullstackAppFixture,
  learningGuideFixture,
  libraryDocsMonorepoFixture,
  libraryPlaygroundMonorepoFixture,
  libraryPackageFixture,
  limitedLargeRepoFixture,
  monorepoPlatformFixture,
  monorepoRepresentativeFixture,
  monorepoSolutionFocusFixture,
  multiSurfaceProductFixture,
  nestedPackageLibraryMonorepoFixture,
  nodeApiFixture,
  packageVsAppFocusFixture,
  readmeDocsNoiseFixture,
  readmeNarrativeFilteringFixture,
  readmeOfficialSiteFixture,
  reactSpaFixture,
  solutionExampleCollectionFixture,
  servicePlatformMonorepoFixture,
  studioVsUiLibraryFixture,
  supabaseAppFixture,
  toolingHarnessFixture,
  workspaceLearningGuideFixture,
  workspaceRunnerUsageFixture,
} from "@/tests/fixtures/analyzer-fixtures";

describe("analyzeRepositorySnapshot fixtures", () => {
  it("classifies a CLI repository and surfaces CLI-specific edit guidance", () => {
    const analysis = analyzeRepositorySnapshot(cliToolFixture);

    expect(analysis.summary.projectType).toBe("CLI 도구");
    expect(analysis.summary.stack).toContain("Node.js");
    expect(analysis.stats.routeCount).toBe(0);
    expect(analysis.keyFiles[0]?.path).toBe("package.json");
    expect(analysis.editGuides[0]?.intent).toBe("CLI 실행 흐름 수정");
  });

  it("classifies a fullstack app and prefers the page entry as the reading start", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);

    expect(analysis.summary.projectType).toBe("풀스택 웹앱");
    expect(analysis.summary.stack).toContain("Next.js");
    expect(analysis.summary.stack).toContain("React");
    expect(analysis.stats.routeCount).toBeGreaterThan(0);
    expect(analysis.stats.apiEndpointCount).toBeGreaterThan(0);
    expect(analysis.summary.recommendedStartFile).toBe("app/page.tsx");
    expect(analysis.keyFiles.slice(0, 4).map((file) => file.path)).toEqual([
      "app/page.tsx",
      "app/layout.tsx",
      "components/repo-form.tsx",
      "app/api/analyze/route.ts",
    ]);
    expect(analysis.editGuides.map((guide) => guide.intent)).toEqual(
      expect.arrayContaining(["화면 문구 수정", "UI 구조 수정", "API 응답 수정", "DB 관련 수정"])
    );
    expect(analysis.layers.map((layer) => layer.name)).toEqual(
      expect.arrayContaining(["UI", "Logic", "API", "DB"])
    );
  });

  it("extracts beginner learning data for stack explanation, usage, and preview", () => {
    const analysis = analyzeRepositorySnapshot(learningGuideFixture);

    expect(analysis.learning.identity.plainTitle).toBe("GitHub 레포를 이해하기 쉽게 보여주는 도구");
    expect(analysis.learning.identity.projectKind).toBe("풀스택 웹앱");
    expect(analysis.learning.identity.outputType).toBe("브라우저에서 보는 화면");
    expect(analysis.summary.oneLiner).toContain("GitHub 레포 구조를 빠르게 파악하게 돕습니다.");
    expect(analysis.summary.oneLiner).not.toContain("A web app");
    expect(analysis.learning.identity.coreStack).toEqual([
      "Next.js",
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Prisma",
    ]);
    expect(analysis.learning.identity.stackNarrative).toBe(
      "주요 기술은 Next.js(화면 + 서버 요청), React(화면 구성), Prisma(데이터 저장·조회)입니다."
    );
    expect(analysis.learning.identity.header.subtitle).toBe("GitHub 레포 구조를 빠르게 파악하게 돕습니다.");
    expect(analysis.learning.identity.header.points).toEqual([
      "프로젝트 구조를 쉬운 말로 설명해 보여줍니다.",
      "코드를 보기 전에 화면과 결과를 먼저 확인할 수 있습니다.",
    ]);
    expect(analysis.learning.identity.stackHighlights).toEqual([
      {
        name: "Next.js",
        role: "화면 + 서버 요청",
        examplePath: "app/page.tsx",
      },
      {
        name: "React",
        role: "화면 구성",
        examplePath: "app/page.tsx",
      },
      {
        name: "Prisma",
        role: "데이터 저장·조회",
        examplePath: "db/schema.prisma",
      },
      {
        name: "OpenAI",
        role: "AI 기능 연결",
        examplePath: "app/api/analyze/route.ts",
      },
    ]);
    expect(analysis.learning.identity.startHere.path).toBe("app/page.tsx");
    expect(analysis.learning.identity.startHere.reason).toBeTruthy();
    expect(analysis.learning.identity.readOrder).toHaveLength(3);
    expect(analysis.learning.identity.readOrder[0]).toEqual(
      expect.objectContaining({
        label: "프로젝트 설명 보기",
        path: "README.md",
      })
    );
    expect(analysis.learning.identity.trust.source).toBe("mixed");
    expect(analysis.learning.stackSummary).toBe("AI 기능과 데이터 저장이 함께 있는 풀스택 웹앱");
    expect(
      analysis.learning.stackGlossary.map((item) => item.name)
    ).toEqual(expect.arrayContaining(["Next.js", "React", "Prisma", "Tailwind CSS", "OpenAI"]));
    expect(
      analysis.learning.stackGlossary.find((item) => item.name === "Next.js")?.reasons
    ).toEqual(expect.arrayContaining(["`next` 의존성이 있습니다."]));
    expect(analysis.learning.stackGlossary.find((item) => item.name === "Next.js")?.usedFor).toBe(
      "이 레포에서 화면 라우팅과 API 요청 처리를 같은 프로젝트 안에서 함께 맡습니다."
    );
    expect(
      analysis.learning.stackGlossary.find((item) => item.name === "Next.js")?.examplePaths
    ).toEqual(expect.arrayContaining(["app/page.tsx", "app/api/analyze/route.ts"]));
    expect(analysis.learning.stackGlossary.find((item) => item.name === "Prisma")?.usedFor).toBe(
      "이 레포의 데이터베이스 스키마와 조회/저장 흐름을 다루는 데 쓰입니다."
    );
    expect(
      analysis.learning.stackGlossary.find((item) => item.name === "Prisma")?.examplePaths
    ).toContain("db/schema.prisma");
    expect(analysis.learning.stackGlossary.find((item) => item.name === "OpenAI")?.usedFor).toBe(
      "이 레포의 AI 응답 생성, 요약, 보조 기능 연결에 쓰입니다."
    );
    expect(
      analysis.learning.stackGlossary.find((item) => item.name === "OpenAI")?.examplePaths
    ).toContain("app/api/analyze/route.ts");
    expect(analysis.learning.usage.source).toBe("mixed");
    expect(analysis.learning.usage.install).toContain("pnpm install");
    expect(analysis.learning.usage.run).toContain("pnpm dev");
    expect(analysis.learning.usage.build).toContain("pnpm build");
    expect(analysis.learning.usage.test).toContain("pnpm test");
    expect(analysis.learning.usage.example).toContain(
      'import { analyzeRepo } from "@/lib/analyze";'
    );
    expect(
      analysis.learning.usage.details.find((item) => item.command === "pnpm dev")?.explanation
    ).toBe("Next.js 개발 서버를 실행합니다.");
    expect(analysis.learning.preview.mode).toBe("readme_images");
    expect(analysis.learning.preview.deployUrl).toBe("https://repo-learning-guide.vercel.app");
    expect(analysis.learning.preview.deployConfidence).toBe("high");
    expect(analysis.learning.preview.deployRationale[0]).toContain("homepage");
    expect(analysis.learning.preview.images[0]?.url).toBe(
      "https://raw.githubusercontent.com/fixture-owner/repo-learning-guide/fixture-sha/public/preview.png"
    );
    expect(analysis.learning.preview.images[0]?.kind).toBe("ui");
    expect(analysis.learning.preview.images[0]?.confidence).toBe("high");
    expect(analysis.learning.readmeCore.summary).toBe(
      "Understand a public GitHub repo with structure, explanation, and preview."
    );
    expect(analysis.learning.readmeCore.audience).toBe("개발자");
    expect(analysis.learning.readmeCore.keyPoints).toHaveLength(3);
    expect(analysis.learning.readmeCore.keyPoints).toEqual(
      expect.arrayContaining([
        "Explain the project structure in plain language.",
        "Highlight key files and reading order for the repo.",
        "Show a preview screen before diving into the code.",
      ])
    );
    expect(analysis.learning.readmeCore.quickstart).toEqual(["pnpm install", "pnpm dev"]);
    expect(analysis.learning.readmeCore.links).toEqual([
      {
        label: "Live demo",
        url: "https://repo-learning-guide.vercel.app",
        kind: "demo",
      },
    ]);
    expect(analysis.learning.readmeCore.architectureNotes).toHaveLength(2);
    expect(analysis.learning.readmeCore.architectureNotes).toEqual(
      expect.arrayContaining([
        "Next.js pages call an API route that stores analysis results in PostgreSQL via Prisma.",
        "OpenAI is used only for explanation text, while fact extraction stays rule-based.",
      ])
    );
    expect(analysis.learning.environment.summary).toContain("Node");
    expect(analysis.learning.environment.runtimes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "node",
          version: ">=20",
          minMajor: 20,
          maxMajor: null,
          range: "gte",
        }),
      ])
    );
    expect(analysis.learning.environment.container.hasDockerfile).toBe(true);
    expect(analysis.learning.environment.container.hasDockerCompose).toBe(true);
    expect(analysis.learning.environment.container.baseImage).toBe("node:20-alpine");
    expect(analysis.learning.environment.container.exposedPorts).toEqual([3000, 5432, 6379]);
    expect(analysis.learning.environment.container.composeServices).toEqual(["app", "db", "redis"]);
    expect(analysis.learning.environment.container.dockerRole).toBe("recommended");
    expect(analysis.learning.environment.hardware.gpuRequired).toBe(false);
    expect(analysis.learning.environment.hardware.recommendedRamGb).toBe(8);
    expect(analysis.learning.environment.hardware.notes[0]).toContain("8GB RAM");
    expect(analysis.learning.environment.cloud.deployTargets).toContain("Vercel");
    expect(analysis.learning.environment.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["OpenAI", "PostgreSQL", "Redis"])
    );
    expect(analysis.learning.environment.cloud.servicesRequiredDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "OpenAI",
          canonicalId: "openai",
          kind: "ai",
        }),
        expect.objectContaining({
          label: "PostgreSQL",
          canonicalId: "postgres",
          kind: "database",
        }),
      ])
    );
    expect(analysis.learning.environment.cloud.servicesOptional).toEqual([]);
    expect(analysis.learning.environment.confidence).toBe("high");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
  });

  it("demotes dependency-only service hints into optional services", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "optional-services-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/optional-services-only",
        description: "A repo with SDK dependencies but no direct service setup.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts"],
      packageJsonText: JSON.stringify({
        name: "optional-services-only",
        dependencies: {
          openai: "^4.0.0",
          ioredis: "^5.0.0",
        },
      }),
      readmeText: "# Optional Services Only\n",
      selectedFileContents: {
        "src/index.ts": `export function noop() { return "ok"; }`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).toEqual([]);
    expect(analysis.learning.environment.cloud.servicesOptional).toEqual(
      expect.arrayContaining(["OpenAI", "Redis"])
    );
  });

  it("keeps optional env integrations out of required service lists for large app-style repos", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "large-app-optional-integrations",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/large-app-optional-integrations",
        description: "Workflow platform with optional AI and search integrations.",
      },
      allPaths: [
        "README.md",
        "package.json",
        ".env.example",
        "docker-compose.yml",
        "app/page.tsx",
        "lib/db.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "large-app-optional-integrations",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          pg: "^8.0.0",
          ioredis: "^5.0.0",
          openai: "^4.0.0",
          "@pinecone-database/pinecone": "^3.0.0",
          "@aws-sdk/client-s3": "^3.0.0",
          "@sentry/nextjs": "^9.0.0",
        },
      }),
      readmeText: `
# Large App

Core runtime needs Postgres and Redis.
Optional integrations include OpenAI, Pinecone, and Sentry.
      `,
      selectedFileContents: {
        ".env.example": `DATABASE_URL=\nREDIS_URL=\n# Optional integrations\nOPENAI_API_KEY=\nPINECONE_API_KEY=\nSENTRY_DSN=\nS3_BUCKET=\n`,
        "docker-compose.yml": `services:\n  db:\n    image: postgres:16\n  redis:\n    image: redis:7\n`,
        "app/page.tsx": `export default function Page() { return <div>platform</div>; }`,
        "lib/db.ts": `export const db = process.env.DATABASE_URL ?? "";`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["PostgreSQL", "Redis"])
    );
    expect(analysis.learning.environment.cloud.servicesRequired).not.toContain("OpenAI");
    expect(analysis.learning.environment.cloud.servicesOptional).toEqual(
      expect.arrayContaining(["OpenAI", "Pinecone", "Amazon S3", "Sentry"])
    );
    expect(analysis.learning.environment.cloud.apiServicesRequired).toEqual([]);
    expect(analysis.learning.environment.cloud.apiServicesOptional).toEqual(
      expect.arrayContaining(["OpenAI", "Pinecone", "Amazon S3"])
    );
  });

  it("promotes core infra services to required when dependency and infra-path signals overlap", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "large-app-infra-signals",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/large-app-infra-signals",
        description: "A platform app with dedicated infra folders.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "deploy/postgres/init.sql",
        "infra/redis/values.yaml",
      ],
      packageJsonText: JSON.stringify({
        name: "large-app-infra-signals",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          pg: "^8.0.0",
          ioredis: "^5.0.0",
        },
      }),
      readmeText: "# Large App Infra\n",
      selectedFileContents: {
        "app/page.tsx": `export default function Page() { return <div>platform</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["PostgreSQL", "Redis"])
    );
    expect(analysis.learning.environment.cloud.servicesOptional).not.toEqual(
      expect.arrayContaining(["PostgreSQL", "Redis"])
    );
  });

  it("keeps semantic observability integrations optional without explicit config hints", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "semantic-optional-service",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-optional-service",
        description: "A repo that imports sentry but does not require it for boot.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "semantic-optional-service",
        dependencies: {
          "@sentry/nextjs": "^9.0.0",
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: "# Semantic Optional Service\n",
      selectedFileContents: {
        "app/page.tsx": `
          import * as Sentry from "@sentry/nextjs";
          export default function Page() { return <div>{Boolean(Sentry)}</div>; }
        `,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).toEqual([]);
    expect(analysis.learning.environment.cloud.servicesOptional).toContain("Sentry");
  });

  it("extracts Python ML environment hints including GPU and README-based memory notes", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "python-ml-env",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/python-ml-env",
        description: "GPU-accelerated inference service.",
      },
      allPaths: [
        "README.md",
        "pyproject.toml",
        ".python-version",
        "requirements.txt",
        "Dockerfile",
        "src/server.py",
      ],
      readmeText: `# Python ML Env

- Requires CUDA 12 compatible GPU for local inference.
- 16GB RAM recommended for model loading.
- Minimum 10GB disk for weights cache.
`,
      selectedFileContents: {
        ".python-version": "3.11\n",
        "pyproject.toml": `
          [project]
          requires-python = ">=3.11"
        `,
        "requirements.txt": `
          torch
          transformers
          accelerate
        `,
        Dockerfile: `
          FROM python:3.11-slim
          EXPOSE 8000
        `,
        "src/server.py": `print("ok")`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.runtimes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "python",
          version: ">=3.11",
        }),
      ])
    );
    expect(analysis.learning.environment.container.baseImage).toBe("python:3.11-slim");
    expect(analysis.learning.environment.container.exposedPorts).toEqual([8000]);
    expect(analysis.learning.environment.hardware.gpuRequired).toBe(true);
    expect(analysis.learning.environment.hardware.gpuHint).toContain("CUDA 12");
    expect(analysis.learning.environment.hardware.recommendedRamGb).toBe(16);
    expect(analysis.learning.environment.hardware.minDiskGb).toBe(10);
    expect(analysis.learning.environment.confidence).toBe("high");
  });

  it("detects Python runtime from requirements-only repositories", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "python-requirements-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/python-requirements-only",
        description: "A Python example repo driven only by requirements.txt.",
      },
      allPaths: ["README.md", "requirements.txt", "train.py"],
      readmeText: "# Python Requirements Only",
      selectedFileContents: {
        "requirements.txt": `
          torch
          torchvision
          numpy
        `,
        "train.py": `print("train")`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.runtimes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "python",
          version: null,
          source: "requirements_txt",
        }),
      ])
    );
    expect(analysis.learning.environment.hardware.gpuRequired).toBe(false);
    expect(analysis.learning.environment.hardware.acceleratorPreference).toBeNull();
  });

  it("parses Python version from conda environment files", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "python-conda-env",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/python-conda-env",
        description: "A Python repo defined by conda environment.yml.",
      },
      allPaths: ["README.md", "environment.yml", "src/main.py"],
      readmeText: "# Python Conda Env",
      selectedFileContents: {
        "environment.yml": `
          name: sample
          dependencies:
            - python=3.11
            - pytorch
        `,
        "src/main.py": `print("ok")`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.runtimes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "python",
          version: "3.11",
          source: "environment_yml",
        }),
      ])
    );
  });

  it("promotes representative nested compose and env signals for monorepo required services", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "repo-monorepo-runtime",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-monorepo-runtime",
        description: "A monorepo with runtime config living under docker/.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        ".env.example",
        "apps/web/package.json",
        "apps/web/app/page.tsx",
        "docker/compose.yaml",
        "docker/images/base/Dockerfile",
        "docker/images/repo-monorepo-runtime/Dockerfile",
        ".devcontainer/Dockerfile",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-monorepo-runtime",
        private: true,
        workspaces: ["apps/*"],
      }),
      readmeText: "# Repo Monorepo Runtime",
      selectedFileContents: {
        ".env.example": `
          DB_TYPE=postgresdb
          QUEUE_BULL_REDIS_HOST=redis
        `,
        "apps/web/package.json": JSON.stringify({
          name: "@repo/web",
          dependencies: {
            next: "16.2.4",
            react: "19.2.4",
            "react-dom": "19.2.4",
          },
        }),
        "apps/web/app/page.tsx": `export default function Page() { return <main>ok</main>; }`,
        "docker/compose.yaml": `
          services:
            app:
              build: .
              ports:
                - "3000:3000"
            postgres:
              image: postgres:16
            redis:
              image: redis:7
        `,
        "docker/images/base/Dockerfile": `
          FROM ubuntu:24.04
        `,
        "docker/images/repo-monorepo-runtime/Dockerfile": `
          FROM node:20-alpine
          WORKDIR /app
          EXPOSE 3000
          CMD ["pnpm", "dev"]
        `,
        ".devcontainer/Dockerfile": `
          FROM mcr.microsoft.com/devcontainers/typescript-node:20
        `,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.container.baseImage).toBe("node:20-alpine");
    expect(analysis.learning.environment.container.exposedPorts).toEqual([3000]);
    expect(analysis.learning.environment.container.composeServices).toEqual(["app", "postgres", "redis"]);
    expect(analysis.learning.environment.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["PostgreSQL", "Redis"])
    );
  });

  it("routes README storage notes into required services instead of hardware notes", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "readme-service-routing",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/readme-service-routing",
        description: "A repo that documents external state providers in README.",
      },
      allPaths: ["README.md", "package.json", ".env.example"],
      packageJsonText: JSON.stringify({
        name: "readme-service-routing",
        dependencies: {
          openai: "^4.0.0",
        },
      }),
      readmeText: `# Readme Service Routing

- **Storage**: Cloudflare R2 (artifacts) + Upstash Redis (quota and failures)
- **AI**: OpenAI
- 8GB RAM recommended for local indexing.
- **Deployment**: Vercel frontend + Railway backend
`,
      selectedFileContents: {
        ".env.example": `
          OPENAI_API_KEY=
        `,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.hardware.notes).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Cloudflare R2")])
    );
    expect(analysis.learning.environment.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["Cloudflare R2", "Upstash Redis", "OpenAI"])
    );
    expect(analysis.learning.environment.cloud.servicesRequiredDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Cloudflare R2",
          canonicalId: "cloudflare-r2",
          kind: "infra",
        }),
        expect.objectContaining({
          label: "Upstash Redis",
          canonicalId: "redis",
          kind: "database",
        }),
      ])
    );
    expect(analysis.learning.environment.cloud.deployTargets).toEqual(
      expect.arrayContaining(["Vercel", "Railway"])
    );
  });

  it("detects deploy targets from README deployment copy without explicit config files", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "docker-deploy-readme",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/docker-deploy-readme",
        description: "A repo whose README says to deploy with Docker.",
      },
      allPaths: ["README.md", "package.json"],
      packageJsonText: JSON.stringify({
        name: "docker-deploy-readme",
      }),
      readmeText: `# Docker Deploy README

Or deploy with Docker:

\`\`\`bash
docker run -p 5678:5678 app
\`\`\`
`,
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.deployTargets).toContain("Docker");
  });

  it("does not treat OpenAI Gym mentions as a required OpenAI service", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "openai-gym-example",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/openai-gym-example",
        description: "Classic reinforcement learning examples.",
      },
      allPaths: ["README.md", "requirements.txt", "train.py"],
      readmeText: `# OpenAI Gym Example

This repository contains training examples for OpenAI Gym environments.
See the Gym docs for setup details.
`,
      selectedFileContents: {
        "requirements.txt": `
          gym
          torch
        `,
        "train.py": `print("train")`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).not.toContain("OpenAI");
  });

  it("ignores docs-only vendor mentions when inferring required services", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "docs-vendor-mentions",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/docs-vendor-mentions",
        description: "A docs-heavy repo with provider references.",
      },
      allPaths: ["README.md", "package.json"],
      packageJsonText: JSON.stringify({
        name: "docs-vendor-mentions",
      }),
      readmeText: `# Docs Vendor Mentions

Read the OpenAI API docs before continuing.
The Redis tutorial is linked below for background reading.
`,
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequired).toEqual([]);
  });

  it("ranks README hardware notes toward concrete GPU and RAM requirements", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "repo-hardware-notes",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-hardware-notes",
        description: "A repo with mixed-quality hardware documentation.",
      },
      allPaths: ["README.md", "pyproject.toml", "src/main.py"],
      readmeText: `# Repo Hardware Notes

- Runs great on Apple Silicon laptops.
- Requires CUDA 12 compatible GPU for local inference.
- Minimum 8GB RAM for basic indexing, 16GB RAM recommended for larger projects.
- Install with pnpm install before running anything.
`,
      selectedFileContents: {
        "pyproject.toml": `
          [project]
          requires-python = ">=3.11"
        `,
        "src/main.py": `print("ok")`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.hardware.gpuHint).toContain("CUDA 12");
    expect(analysis.learning.environment.hardware.minRamGb).toBe(8);
    expect(analysis.learning.environment.hardware.recommendedRamGb).toBe(16);
    expect(analysis.learning.environment.hardware.notes[0]).toContain("CUDA 12");
    expect(analysis.learning.environment.hardware.notes[1]).toContain("8GB RAM");
  });

  it("adds deploy-config rationale and deterministic usage explanations", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "repo-config-preview",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-config-preview",
        description: "A repo with explicit deploy config and script explanations.",
      },
      allPaths: ["README.md", "package.json", "vercel.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-config-preview",
        homepage: "https://repo-config-preview.vercel.app",
        scripts: {
          dev: "docker compose up --build",
          build: "next build",
          test: "vitest run",
        },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        devDependencies: {
          vitest: "^4.1.4",
        },
      }),
      readmeText: "# Repo Config Preview",
      selectedFileContents: {
        "vercel.json": `{"version":2}`,
        "app/page.tsx": `export default function Page() { return <div>preview</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.learning.preview.deployUrl).toBe("https://repo-config-preview.vercel.app");
    expect(analysis.learning.preview.deployConfidence).toBe("high");
    expect(analysis.learning.preview.deployRationale).toEqual(
      expect.arrayContaining(["레포 안에 같은 배포 대상 설정 파일이 있습니다."])
    );
    expect(
      analysis.learning.usage.details.find((item) => item.command === "npm run dev")
        ?.explanation
    ).toBe("Docker Compose로 앱과 필요한 보조 서비스를 함께 실행합니다.");
    expect(
      analysis.learning.usage.details.find((item) => item.command === "npm run build")?.explanation
    ).toBe("Next.js 배포 결과물을 빌드합니다.");
  });

  it("prefers focus workspace scripts and preview signals over root monorepo docs noise", () => {
    const analysis = analyzeRepositorySnapshot(workspaceLearningGuideFixture);

    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.learning.identity.plainTitle).toBe("브라우저에서 사용하는 화면 중심 웹앱");
    expect(analysis.learning.identity.startHere.path).toBe("apps/web/app/page.tsx");
    expect(analysis.learning.identity.readOrder[0]?.path).toBe("apps/web/README.md");
    expect(analysis.learning.identity.trust.source).toBe("mixed");
    expect(analysis.learning.usage.source).toBe("mixed");
    expect(analysis.learning.usage.install).toContain("pnpm install");
    expect(analysis.learning.usage.run[0]).toBe("cd apps/web && pnpm dev");
    expect(analysis.learning.usage.build[0]).toBe("cd apps/web && pnpm build");
    expect(analysis.learning.usage.test[0]).toBe("cd apps/web && pnpm test");
    expect(
      analysis.learning.usage.details.find((item) => item.command === "cd apps/web && pnpm dev")
        ?.explanation
    ).toContain("apps/web");
    expect(analysis.learning.preview.mode).toBe("readme_images");
    expect(analysis.learning.preview.deployUrl).toBe(
      "https://repo-workspace-learning-guide.vercel.app"
    );
    expect(analysis.learning.preview.deployConfidence).toBe("high");
    expect(analysis.learning.preview.images[0]?.url).toBe(
      "https://raw.githubusercontent.com/fixture-owner/repo-workspace-learning-guide/fixture-sha/apps/web/public/result-screen.png"
    );
    expect(analysis.learning.preview.images[0]?.kind).toBe("ui");
    expect(analysis.learning.readmeCore.links[0]).toEqual({
      label: "Live demo",
      url: "https://repo-workspace-learning-guide.vercel.app",
      kind: "demo",
    });
  });

  it("uses explicit root workspace runner scripts and prefers canonical app homepage over storybook/docs links", () => {
    const analysis = analyzeRepositorySnapshot(workspaceRunnerUsageFixture);

    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.learning.usage.source).toBe("package_json");
    expect(analysis.learning.usage.install).toContain("pnpm install");
    expect(analysis.learning.usage.run).toEqual(["turbo run dev --filter web"]);
    expect(analysis.learning.usage.build).toEqual(["pnpm --filter @repo/web build"]);
    expect(analysis.learning.usage.test).toEqual(["nx test web"]);
    expect(
      analysis.learning.usage.details.find((item) => item.command === "turbo run dev --filter web")
        ?.explanation
    ).toContain("web");
    expect(analysis.learning.preview.mode).toBe("deploy_url");
    expect(analysis.learning.preview.deployUrl).toBe("https://app.repo-workspace-runner.dev");
    expect(analysis.learning.preview.deployConfidence).toBe("high");
  });

  it("prefers an official readme website over docs and hosting blog links", () => {
    const analysis = analyzeRepositorySnapshot(readmeOfficialSiteFixture);

    expect(analysis.learning.preview.mode).toBe("deploy_url");
    expect(analysis.learning.preview.deployUrl).toBe("https://repo-official-site.dev");
    expect(analysis.learning.preview.deployConfidence).toBe("medium");
    expect(analysis.learning.readmeCore.links).toEqual(
      expect.arrayContaining([
        {
          label: "Official site",
          url: "https://repo-official-site.dev",
          kind: "demo",
        },
        {
          label: "Documentation",
          url: "https://docs.repo-official-site.dev",
          kind: "docs",
        },
      ])
    );
  });

  it("does not treat framework docs, dashboards, or localhost links as a deploy preview", () => {
    const analysis = analyzeRepositorySnapshot(readmeDocsNoiseFixture);

    expect(analysis.learning.preview.mode).toBe("none");
    expect(analysis.learning.preview.deployUrl).toBeNull();
    expect(analysis.learning.preview.images).toEqual([]);
    expect(analysis.learning.preview.deployConfidence).toBeNull();
    expect(analysis.learning.preview.deployRationale).toEqual([]);
  });

  it("does not treat badge or coverage asset urls as deploy previews", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-badge-preview-noise",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-badge-preview-noise",
        description: "Library repo with badges but no live deploy.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts"],
      packageJsonText: JSON.stringify({
        name: "repo-badge-preview-noise",
        homepage: "https://coveralls.io/repos/github/fixture-owner/repo-badge-preview-noise/badge.svg?branch=main",
        main: "./src/index.ts",
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: `# Badge Preview Noise

[coverage](https://coveralls.io/repos/github/fixture-owner/repo-badge-preview-noise/badge.svg?branch=main)
[status](https://img.shields.io/badge/build-passing-brightgreen.svg)
`,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.preview.mode).toBe("none");
    expect(analysis.learning.preview.deployUrl).toBeNull();
    expect(analysis.learning.preview.deployConfidence).toBeNull();
  });

  it("filters README setup/docs noise out of summary, key points, and architecture notes", () => {
    const analysis = analyzeRepositorySnapshot(readmeNarrativeFilteringFixture);

    expect(analysis.learning.readmeCore.summary).toBe(
      "A browser app that explains repository structure with beginner-friendly steps."
    );
    expect(analysis.learning.readmeCore.keyPoints).toEqual([
      "Show the repo as layers instead of raw files.",
      "Highlight the first files to read before editing.",
    ]);
    expect(analysis.learning.identity.header.points).toEqual([
      "파일 나열 대신 레이어 구조로 정리해 보여줍니다.",
      "수정 전에 먼저 볼 파일을 바로 찾을 수 있습니다.",
    ]);
    expect(analysis.learning.readmeCore.quickstart).toEqual(["npm install", "npm run dev"]);
    expect(analysis.learning.readmeCore.links).toEqual([
      {
        label: "Documentation",
        url: "https://docs.repo-readme-filter.dev",
        kind: "docs",
      },
    ]);
    expect(analysis.learning.readmeCore.architectureNotes).toEqual([
      "Frontend pages call an API route that stores snapshots in PostgreSQL.",
      "Worker jobs use Redis to refresh repository metadata in the background.",
    ]);
    expect(analysis.learning.identity.header.subtitle).toBe("브라우저에서 기능을 실행하고 결과를 보는 웹앱입니다.");
  });

  it("surfaces structured coverage state for partial and limited analyses", () => {
    const partialAnalysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "repo-partial-coverage",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-partial-coverage",
        description: "A DB-focused repo with one uncovered script.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "db/schema.prisma",
        "db/client.ts",
        "scripts/reindex.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-partial-coverage",
        dependencies: {
          prisma: "^5.0.0",
        },
      }),
      readmeText: "# Partial Coverage\n",
      selectedFileContents: {
        "scripts/reindex.ts": `
          import { prisma } from "../db/client";

          export async function reindex() {
            await prisma.post.findMany();
          }
        `,
      },
      truncated: false,
    });
    const limitedAnalysis = analyzeRepositorySnapshot(limitedLargeRepoFixture);

    expect(partialAnalysis.coverage.level).toBe("partial");
    expect(partialAnalysis.coverage.chipLabel).toBe("부분 분석");
    expect(partialAnalysis.coverage.unclassifiedCodeFileCount).toBe(1);
    expect(partialAnalysis.coverage.unclassifiedCodeSamples).toEqual(["scripts/reindex.ts"]);
    expect(partialAnalysis.coverage.unclassifiedReasonGroups[0]?.key).toBe("tooling");
    expect(partialAnalysis.coverage.unclassifiedSemanticSummary).toContain("DB 사용 신호 1개");
    expect(partialAnalysis.coverage.trustSummary.headline).toContain("핵심 구조");
    expect(partialAnalysis.coverage.trustSummary.omissions).toEqual(
      expect.arrayContaining(["스크립트/도구 코드 일부"])
    );
    expect(partialAnalysis.coverage.trustSummary.basedOn).toContain("미분류 코드 샘플");
    expect(partialAnalysis.coverage.trustSummary.approximate).toBe(false);

    expect(limitedAnalysis.coverage.level).toBe("limited");
    expect(limitedAnalysis.coverage.chipLabel).toBe("제한 분석");
    expect(limitedAnalysis.coverage.summary).toContain("대표 경로 중심");
    expect(limitedAnalysis.coverage.trustSummary.headline).toBe("대표 경로 기준으로 구조를 정리했습니다.");
    expect(limitedAnalysis.coverage.trustSummary.detail).toContain("대표 범위");
    expect(limitedAnalysis.coverage.trustSummary.reasons).toEqual(
      expect.arrayContaining(["대형 저장소라 핵심 경로를 먼저 분석했습니다"])
    );
    expect(limitedAnalysis.coverage.trustSummary.approximate).toBe(true);
  });

  it("prioritizes the three most user-useful trust reasons when many notices exist", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-many-notices",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-many-notices",
        description: "Large unsupported repo with partial parsing and unclassified scripts.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "scripts/reindex.py",
        "scripts/file-0.py",
        "scripts/file-1.py",
        "scripts/file-2.py",
      ],
      packageJsonText: '{"name":"repo-many-notices",',
      readmeText: "# Many Notices\n",
      selectedFileContents: {
        "scripts/reindex.py": "print('reindex')\n",
      },
      truncated: true,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.analysisMode).toBe("limited");
    expect(analysis.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "SUPPORTED_STACK_GAP",
        "PACKAGE_JSON_PARSE_SKIPPED",
        "LAYER_CLASSIFICATION_GAP",
      ])
    );
    expect(analysis.limitations.map((item) => item.code)).toEqual(
      expect.arrayContaining(["LIMITED_ANALYSIS_MODE", "TREE_TRUNCATED"])
    );
    expect(analysis.coverage.trustSummary.reasons).toEqual([
      "대형 저장소라 핵심 경로를 먼저 분석했습니다",
      "우선 지원 스택 밖이라 일부 의미 해석 정확도가 낮을 수 있습니다",
      "일부 코드는 아직 의미 레이어로 자동 분류되지 않았습니다",
    ]);
  });

  it("treats tutorial-style multi-app repositories as example collections", () => {
    const analysis = analyzeRepositorySnapshot(exampleCollectionFixture);

    expect(analysis.summary.projectType).toBe("학습용 예제 저장소");
    expect(analysis.learning.identity.plainTitle).toBe("예제와 튜토리얼을 모아 둔 학습용 저장소");
    expect(analysis.topology.focusRoot).toBe("dashboard/final-example");
    expect(analysis.keyFiles[0]?.path).toBe("README.md");
    expect(analysis.summary.recommendedStartFile).toBe("README.md");
    expect(analysis.editGuides[0]?.intent).toBe("대표 예제부터 읽기");
    expect(analysis.summary.keyFeatures).toContain("여러 예제 앱 포함");
    expect(analysis.summary.oneLiner).toContain("학습용 저장소입니다.");
    expect(analysis.learning.identity.header.subtitle).toBe(
      "예제 앱과 참고 코드를 따라 보며 구조를 익히는 학습용 저장소입니다."
    );
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["dashboard/final-example/app/page.tsx", "dashboard/final-example/app/layout.tsx"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("basics/api-routes-starter/pages/api/hello.js");
  });

  it("prefers solution examples over starter examples and keeps key files scoped to the chosen example", () => {
    const analysis = analyzeRepositorySnapshot(solutionExampleCollectionFixture);

    expect(analysis.summary.projectType).toBe("학습용 예제 저장소");
    expect(analysis.topology.focusRoot).toBe("workshop/solution");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "workshop/solution/app/page.tsx",
        "workshop/solution/app/layout.tsx",
        "workshop/solution/tsconfig.json",
      ])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("workshop/starter/tsconfig.json");
  });

  it("detects monorepo platforms and surfaces workspace-aware guidance", () => {
    const analysis = analyzeRepositorySnapshot(monorepoPlatformFixture);

    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.topology.kind).toBe("monorepo");
    expect(analysis.topology.workspaceRoots).toEqual(
      expect.arrayContaining(["apps/web", "apps/docs", "packages/ui"])
    );
    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.summary.recommendedStartFile).toBe("apps/web/app/page.tsx");
    expect(analysis.editGuides[0]?.intent).toBe("루트 설정 먼저 읽기");
    expect(analysis.summary.keyFeatures).toContain("공용 패키지 + 앱 분리 구조");
  });

  it("keeps package-based service monorepos in the platform bucket", () => {
    const analysis = analyzeRepositorySnapshot(servicePlatformMonorepoFixture);

    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.topology.kind).toBe("monorepo");
    expect(analysis.topology.focusRoot).toBe("packages/frontend/editor-ui");
    expect(analysis.learning.identity.plainTitle).toBe("자동화 흐름을 만들고 실행하는 서비스");
    expect(analysis.learning.identity.header.subtitle).toBe(
      "자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다."
    );
    expect(analysis.learning.stackSummary).toBe("여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼");
    expect(analysis.summary.oneLiner).toContain("자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다.");
  });

  it("prefers the primary app workspace over docs and nested examples in monorepos", () => {
    const analysis = analyzeRepositorySnapshot(monorepoRepresentativeFixture);

    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.topology.kind).toBe("monorepo");
    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["apps/web/app/page.tsx", "apps/web/app/api/search/route.ts"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain(
      "examples/with-berry/apps/web/app/page.tsx"
    );
  });

  it("prefers app workspaces over package workspaces when both expose route-like files", () => {
    const analysis = analyzeRepositorySnapshot(packageVsAppFocusFixture);

    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
  });

  it("prefers product studio apps over internal ui-library apps", () => {
    const analysis = analyzeRepositorySnapshot(studioVsUiLibraryFixture);

    expect(analysis.topology.focusRoot).toBe("apps/studio");
    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
  });

  it("keeps the product app as focus even when docs owns more routes", () => {
    const analysis = analyzeRepositorySnapshot(docsHeavyMonorepoFixture);

    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["apps/web/app/page.tsx", "apps/web/app/api/search/route.ts"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain(
      "apps/docs/app/guides/getting-started/page.tsx"
    );
  });

  it("prefers solution workspaces over starter workspaces in monorepo tutorials", () => {
    const analysis = analyzeRepositorySnapshot(monorepoSolutionFocusFixture);

    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.topology.focusRoot).toBe("apps/solution");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["apps/solution/package.json", "apps/solution/app/page.tsx"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("apps/starter/app/page.tsx");
  });

  it("classifies React SPA repositories as frontend apps", () => {
    const analysis = analyzeRepositorySnapshot(reactSpaFixture);

    expect(analysis.summary.projectType).toBe("프론트엔드 웹앱");
    expect(analysis.learning.identity.plainTitle).toBe("레포를 찾고 살펴보는 화면 중심 웹앱");
    expect(analysis.summary.stack).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(analysis.layers.map((layer) => layer.name)).toContain("UI");
  });

  it("treats minimal Vite SPA entry files as UI surfaces instead of library entries", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "repo-minimal-vite-spa",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-minimal-vite-spa",
        description: "A minimal React SPA.",
      },
      allPaths: ["README.md", "package.json", "vite.config.ts", "src/main.tsx", "src/App.tsx"],
      packageJsonText: JSON.stringify({
        name: "repo-minimal-vite-spa",
        description: "A minimal React SPA.",
        dependencies: {
          react: "19.2.4",
          "react-dom": "19.2.4",
          vite: "6.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Minimal Vite SPA\n\nRun with `pnpm dev`.\n",
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("프론트엔드 웹앱");
    expect(analysis.layers.map((layer) => layer.name)).toContain("UI");
    expect(analysis.summary.projectType).not.toBe("라이브러리 또는 SDK");
  });

  it("classifies app router support files and nested route handlers without layer-gap noise", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-app-router-support",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-app-router-support",
        description: "A Next.js app with app router support files.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/dashboard/loading.tsx",
        "app/dashboard/error.tsx",
        "app/dashboard/not-found.tsx",
        "app/query/route.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-app-router-support",
        dependencies: {
          next: "^16.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
      }),
      readmeText: "# App Router Support\n\nA Next.js app with app router support files.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.layers.map((layer) => layer.name)).toEqual(expect.arrayContaining(["UI", "API"]));
    expect(analysis.warnings.map((notice) => notice.code)).not.toContain("LAYER_CLASSIFICATION_GAP");
  });

  it("does not treat multi-surface product repos as example collections", () => {
    const analysis = analyzeRepositorySnapshot(multiSurfaceProductFixture);

    expect(analysis.summary.projectType).toBe("풀스택 웹앱");
    expect(analysis.learning.stackSummary).toBe("화면과 서버 처리가 함께 있는 풀스택 웹앱");
    expect(analysis.summary.oneLiner).toContain("GitHub 레포 구조를 빠르게 파악하게 돕습니다.");
    expect(analysis.summary.oneLiner).not.toContain("A GitHub repository visualization product");
    expect(analysis.summary.projectType).not.toBe("학습용 예제 저장소");
  });

  it("classifies Node API repositories as backend services", () => {
    const analysis = analyzeRepositorySnapshot(nodeApiFixture);

    expect(analysis.summary.projectType).toBe("백엔드 API 서비스");
    expect(analysis.summary.stack).toContain("Node.js");
    expect(analysis.stats.apiEndpointCount).toBeGreaterThan(0);
    expect(analysis.editGuides.some((guide) => guide.intent === "DB 관련 수정")).toBe(true);
  });

  it("classifies package-style repositories as libraries or SDKs", () => {
    const analysis = analyzeRepositorySnapshot(libraryPackageFixture);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.summary.recommendedStartFile).toBe("README.md");
    expect(analysis.editGuides[0]?.intent).toBe("공개 API 수정");
  });

  it("does not let tutorial README wording override sdk identity copy", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-sdk-examples",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-sdk-examples",
        description: "AI SDK with example scripts for Node.js applications.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/client.ts", "examples/chat.js"],
      packageJsonText: JSON.stringify({
        name: "@fixture/ai-sdk",
        description: "AI SDK with example scripts for Node.js applications.",
        main: "dist/index.js",
        types: "dist/index.d.ts",
      }),
      readmeText: "# SDK Examples\n\nExamples are organized by API, with each folder dedicated to a specific API.",
      selectedFileContents: {
        "src/index.ts": `export * from "./client";`,
        "src/client.ts": `export function createClient() { return {}; }`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.learning.identity.plainTitle).toContain("다른 코드에서 불러다 쓰는 AI");
    expect(analysis.learning.identity.header.subtitle).not.toContain("학습용 저장소");
    expect(analysis.summary.oneLiner).toContain("다른 코드에서 불러다 쓰는 AI");
    expect(analysis.summary.oneLiner).not.toContain("학습용 저장소");
  });

  it("keeps sdk-first classification when a library repo also exposes a cli surface", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "openai",
        name: "openai-python-like",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/openai/openai-python-like",
        description: "Official Python library and CLI for the OpenAI API.",
      },
      allPaths: [
        "README.md",
        "pyproject.toml",
        "src/openai/__init__.py",
        "src/openai/_client.py",
        "src/openai/cli/_api/chat.py",
        "examples/responses.py",
      ],
      readmeText: `
# OpenAI Python Like

Official Python library and CLI for the OpenAI API.

\`\`\`py
from openai import OpenAI
client = OpenAI()
\`\`\`

You can also use the CLI for quick testing.
      `,
      selectedFileContents: {
        "pyproject.toml": `[project]\nname = "openai-python-like"\nrequires-python = ">=3.11"\n`,
        "src/openai/__init__.py": `from ._client import OpenAI\n`,
        "src/openai/_client.py": `class OpenAI: ...\n`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
    expect(analysis.summary.oneLiner).toContain("다른 코드에서");
  });

  it("keeps official sdk repos library-first even when bin and __main__ entrypoints exist", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "openai",
        name: "openai-python",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/openai/openai-python",
        description: "The official Python library for the OpenAI API",
      },
      allPaths: [
        "README.md",
        "pyproject.toml",
        "bin/check-release-environment",
        "examples/demo.py",
        "src/openai/__init__.py",
        "src/openai/__main__.py",
        "src/openai/_client.py",
        "src/openai/cli/__init__.py",
        "src/openai/cli/_api/__init__.py",
        "src/openai/cli/_api/models.py",
        "src/openai/resources/models.py",
        "src/openai/types/model.py",
      ],
      readmeText: `
# OpenAI Python API library

The OpenAI Python library provides convenient access to the OpenAI REST API from any Python 3.9+ application.

\`\`\`python
from openai import OpenAI

client = OpenAI()
\`\`\`
      `,
      selectedFileContents: {
        "pyproject.toml": `[project]\nname = "openai"\nrequires-python = ">=3.9"\n`,
        "src/openai/__init__.py": `from ._client import OpenAI\n`,
        "src/openai/__main__.py": `print("cli")\n`,
        "src/openai/_client.py": `class OpenAI: ...\n`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
    expect(analysis.layers.map((layer) => layer.name)).toContain("Logic");
    expect(analysis.layers.map((layer) => layer.name)).not.toContain("DB");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["README.md", "src/openai/__init__.py", "src/openai/_client.py"])
    );
  });

  it("keeps single-package sdk repos library-first when ui exists only in a demo website", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "single-package-sdk-demo-site",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/single-package-sdk-demo-site",
        description: "JavaScript SDK with a demo website.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "src/index.ts",
        "src/client.ts",
        "website/package.json",
        "website/app/page.tsx",
        "website/next.config.js",
      ],
      packageJsonText: JSON.stringify({
        name: "@fixture/sdk-demo-site",
        description: "JavaScript SDK with a demo website.",
        main: "dist/index.js",
        exports: {
          ".": "./dist/index.js",
        },
        types: "dist/index.d.ts",
      }),
      readmeText: `
# SDK Demo Site

JavaScript SDK with a demo website.

\`\`\`ts
import { createClient } from "@fixture/sdk-demo-site";
\`\`\`
      `,
      selectedFileContents: {
        "src/index.ts": `export { createClient } from "./client";`,
        "src/client.ts": `export function createClient() { return {}; }`,
        "website/package.json": JSON.stringify({
          name: "website",
          dependencies: {
            next: "16.2.4",
            react: "19.2.4",
            "react-dom": "19.2.4",
          },
        }),
        "website/app/page.tsx": `export default function Page() { return <div>demo</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
    expect(analysis.summary.oneLiner).toContain("라이브러리");
  });

  it("keeps a UI entry ahead of package.json even when package dependencies carry semantic signals", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-start-anchor-web",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-start-anchor-web",
        description: "Web app that explains repository structure.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "src/app/page.tsx",
        "src/app/layout.tsx",
        "src/app/api/analyze/route.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-start-anchor-web",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          openai: "^4.0.0",
        },
      }),
      readmeText: "# Start Anchor Web\n\nAnalyze and explain repository structure.",
      selectedFileContents: {
        "package.json": JSON.stringify({
          dependencies: {
            next: "16.2.4",
            react: "19.2.4",
            "react-dom": "19.2.4",
            openai: "^4.0.0",
          },
        }),
        "src/app/page.tsx": `export default function Page() { return <main>home</main>; }`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.keyFiles[0]?.path).toBe("src/app/page.tsx");
    expect(analysis.summary.recommendedStartFile).toBe("src/app/page.tsx");
    expect(analysis.summary.recommendedStartReason).toContain("사용자 흐름");
  });

  it("marks package libraries without demos as import-as-library", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "pure-library",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/pure-library",
        description: "Typed client library for internal APIs.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/client.ts"],
      packageJsonText: JSON.stringify({
        name: "@fixture/pure-library",
        main: "dist/index.js",
        exports: {
          ".": "./dist/index.js",
        },
      }),
      readmeText: `# Pure Library\n\n\`\`\`ts\nimport { createClient } from "@fixture/pure-library";\n\`\`\`\n`,
      selectedFileContents: {
        "src/index.ts": `export * from "./client";`,
      },
      truncated: false,
    });

    expect(analysis.learning.identity.consumptionMode).toBe("import-as-library");
  });

  it("marks application repos as run-as-app", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "run-app",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/run-app",
        description: "A Next.js application.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "run-app",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: "# Run App\n\npnpm dev\n",
      selectedFileContents: {
        "app/page.tsx": `export default function Page() { return <div>app</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("프론트엔드 웹앱");
    expect(analysis.learning.identity.consumptionMode).toBe("run-as-app");
  });

  it("keeps exported app repos as run-as-app when exports are only incidental metadata", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "run-app-with-exports",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/run-app-with-exports",
        description: "A Next.js product application with an internal export map.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx", "app/layout.tsx", "src/schema.ts"],
      packageJsonText: JSON.stringify({
        name: "run-app-with-exports",
        exports: {
          "./schema": "./src/schema.ts",
        },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: "# Run App With Exports\n\npnpm dev\n",
      selectedFileContents: {
        "app/page.tsx": `export default function Page() { return <div>app</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("프론트엔드 웹앱");
    expect(analysis.learning.identity.consumptionMode).toBe("run-as-app");
  });

  it("upgrades exported app repos to hybrid when the README explicitly documents import usage", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "run-app-with-import-api",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/run-app-with-import-api",
        description: "A Next.js product application with a documented client import surface.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx", "app/layout.tsx", "src/schema.ts"],
      packageJsonText: JSON.stringify({
        name: "run-app-with-import-api",
        exports: {
          "./schema": "./src/schema.ts",
        },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# Run App With Import API\n\nUse the hosted app, or import the client helper:\n\n\`\`\`ts\nimport { createClient } from "run-app-with-import-api";\n\`\`\`\n`,
      selectedFileContents: {
        "app/page.tsx": `export default function Page() { return <div>app</div>; }`,
      },
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("프론트엔드 웹앱");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
  });

  it("keeps ambiguous roots as unknown consumption mode", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "unknown-consumption",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/unknown-consumption",
        description: "Repository metadata and docs only.",
      },
      allPaths: ["README.md", "package.json", "config/project.json"],
      packageJsonText: JSON.stringify({
        name: "unknown-consumption",
      }),
      readmeText: "# Unknown Consumption\n\nRepository metadata only.\n",
      selectedFileContents: {
        "config/project.json": `{"name":"unknown"}`,
      },
      truncated: false,
    });

    expect(analysis.learning.identity.consumptionMode).toBe("unknown");
  });

  it("keeps app-focused monorepos as run-as-app even when the root manifest exports tooling helpers", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "monorepo-app-with-exports",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/monorepo-app-with-exports",
        description: "A product monorepo with one main app and shared packages.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "apps/web/package.json",
        "apps/web/app/page.tsx",
        "apps/web/app/layout.tsx",
        "packages/shared/package.json",
        "packages/shared/src/index.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "monorepo-app-with-exports",
        private: true,
        workspaces: ["apps/*", "packages/*"],
        exports: {
          "./config": "./config/index.ts",
        },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: "# Monorepo App With Exports\n\npnpm dev\n",
      selectedFileContents: {
        "apps/web/app/page.tsx": `export default function Page() { return <main>web</main>; }`,
      },
      truncated: false,
    });

    expect(analysis.summary.projectType).toBe("모노레포 웹 플랫폼");
    expect(analysis.topology.focusRoot).toBe("apps/web");
    expect(analysis.learning.identity.consumptionMode).toBe("run-as-app");
  });

  it("normalizes canonical service ids and prefers specific provider labels", () => {
    const analysis = analyzeRepositorySnapshot({
      repo: {
        owner: "fixture-owner",
        name: "canonical-services",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/canonical-services",
        description: "Canonical service dependency coverage fixture.",
      },
      allPaths: ["README.md", "package.json", ".env.example", "src/index.ts"],
      packageJsonText: JSON.stringify({
        name: "canonical-services",
        dependencies: {
          "@upstash/redis": "^1.0.0",
          redis: "^5.0.0",
          openai: "^4.0.0",
          "@anthropic-ai/sdk": "^1.0.0",
          "@supabase/supabase-js": "^2.0.0",
          stripe: "^17.0.0",
          "@clerk/nextjs": "^5.0.0",
          pg: "^8.0.0",
        },
      }),
      readmeText: "# Canonical Services\n",
      selectedFileContents: {
        ".env.example": `OPENAI_API_KEY=\nANTHROPIC_API_KEY=\nSUPABASE_URL=\nSTRIPE_SECRET_KEY=\nCLERK_SECRET_KEY=\nPGHOST=\nUPSTASH_REDIS_REST_URL=\n`,
        "src/index.ts": `export const ready = true;`,
      },
      truncated: false,
    });

    expect(analysis.learning.environment.cloud.servicesRequiredDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Upstash Redis", canonicalId: "redis", kind: "database" }),
        expect.objectContaining({ label: "OpenAI", canonicalId: "openai", kind: "ai" }),
        expect.objectContaining({ label: "Anthropic", canonicalId: "anthropic", kind: "ai" }),
        expect.objectContaining({ label: "Supabase", canonicalId: "supabase", kind: "database" }),
        expect.objectContaining({ label: "Stripe", canonicalId: "stripe", kind: "payment" }),
        expect.objectContaining({ label: "Clerk", canonicalId: "clerk", kind: "auth" }),
        expect.objectContaining({ label: "PostgreSQL", canonicalId: "postgres", kind: "database" }),
      ])
    );
  });

  it("suppresses layer-gap warnings when library coverage only misses generic common files", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-library-benign-gap",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-library-benign-gap",
        description: "A small SDK package.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/errors.ts", "src/types.ts"],
      packageJsonText: JSON.stringify({
        name: "@fixture/sdk",
        description: "A small SDK package.",
        main: "dist/index.js",
        types: "dist/index.d.ts",
      }),
      readmeText: "# Fixture SDK\n\nA small SDK package.",
      selectedFileContents: {
        "src/index.ts": `export * from "./types";`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.warnings.map((notice) => notice.code)).not.toContain("LAYER_CLASSIFICATION_GAP");
    expect(analysis.coverage.unclassifiedCodeFileCount).toBe(0);
    expect(analysis.coverage.summary).not.toContain("Code 범위");
  });

  it("treats docs-backed SDK monorepos as libraries and focuses the main package", () => {
    const analysis = analyzeRepositorySnapshot(libraryDocsMonorepoFixture);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.kind).toBe("monorepo");
    expect(analysis.topology.focusRoot).toBe("packages/sdk");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["packages/sdk/src/index.ts", "packages/sdk/package.json"])
    );
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("apps/docs/app/page.tsx");
    expect(analysis.editGuides[0]?.intent).toBe("공개 API 수정");
  });

  it("uses focus workspace stack instead of sibling docs app stack for monorepo summaries", () => {
    const analysis = analyzeRepositorySnapshot({
      ...libraryDocsMonorepoFixture,
      selectedFileContents: {
        "packages/sdk/package.json": JSON.stringify({
          name: "@repo/sdk",
          dependencies: {
            openai: "^4.0.0",
          },
          devDependencies: {
            typescript: "^5.0.0",
          },
        }),
        "packages/sdk/src/index.ts": `export * from "./client";`,
        "packages/sdk/src/client.ts": `import OpenAI from "openai"; export const client = new OpenAI();`,
      },
    });

    expect(analysis.topology.focusRoot).toBe("packages/sdk");
    expect(analysis.summary.stack).toEqual(["TypeScript", "Node.js"]);
    expect(analysis.summary.stack).not.toContain("Next.js");
    expect(analysis.summary.stack).not.toContain("React");
    expect(analysis.learning.identity.coreStack).toEqual(["TypeScript", "Node.js"]);
    expect(analysis.learning.identity.stackNarrative).toBe(
      "주요 기술은 TypeScript(타입 기반 구조), Node.js(서버/스크립트 실행), OpenAI(AI 기능 연결)입니다."
    );
    expect(analysis.learning.identity.stackHighlights.map((item) => item.name)).toEqual([
      "TypeScript",
      "Node.js",
      "OpenAI",
    ]);
    expect(analysis.learning.stackGlossary.map((item) => item.name)).toEqual(
      expect.arrayContaining(["TypeScript", "Node.js", "OpenAI"])
    );
    expect(analysis.learning.stackGlossary.map((item) => item.name)).not.toEqual(
      expect.arrayContaining(["Next.js", "React"])
    );
  });

  it("prefers package workspaces over playground apps for component libraries", () => {
    const analysis = analyzeRepositorySnapshot(libraryPlaygroundMonorepoFixture);

    expect(analysis.summary.projectType).toBe("컴포넌트 라이브러리 또는 디자인 시스템");
    expect(analysis.topology.focusRoot?.startsWith("packages/")).toBe(true);
    expect(analysis.keyFiles.some((file) => file.path === `${analysis.topology.focusRoot}/package.json`)).toBe(true);
    expect(
      analysis.keyFiles.some(
        (file) =>
          file.path === `${analysis.topology.focusRoot}/src/index.ts` ||
          file.path === `${analysis.topology.focusRoot}/src/index.tsx`
      )
    ).toBe(true);
    expect(analysis.editGuides[0]?.files[0]?.startsWith("packages/")).toBe(true);
  });

  it("detects nested package workspaces as library roots instead of support apps", () => {
    const analysis = analyzeRepositorySnapshot(nestedPackageLibraryMonorepoFixture);

    expect(analysis.summary.projectType).toBe("컴포넌트 라이브러리 또는 디자인 시스템");
    expect(analysis.topology.workspaceRoots).toEqual(
      expect.arrayContaining(["packages/react/dialog", "packages/react/tooltip", "packages/core/primitive"])
    );
    expect(analysis.topology.focusRoot?.startsWith("packages/")).toBe(true);
    expect(analysis.topology.focusRoot).not.toBe("apps/ssr-testing");
    expect(analysis.keyFiles.some((file) => file.path === `${analysis.topology.focusRoot}/package.json`)).toBe(true);
  });

  it("prefers component-library package roots over a single website app", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-radix-like",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-radix-like",
        description: "Accessible component primitives with a docs website.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "apps/website/package.json",
        "apps/website/app/page.tsx",
        "packages/react/package.json",
        "packages/react/src/index.ts",
        "packages/react/src/dialog.tsx",
        "packages/primitives/package.json",
        "packages/primitives/src/index.ts",
        "packages/primitives/src/focus-scope.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-radix-like",
        description: "Accessible component primitives with a docs website.",
        workspaces: ["apps/*", "packages/*"],
        keywords: ["component library", "primitives", "design system"],
        dependencies: {
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Radix-like\n\nAccessible component primitives and a docs website.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("컴포넌트 라이브러리 또는 디자인 시스템");
    expect(analysis.topology.focusRoot?.startsWith("packages/")).toBe(true);
    expect(analysis.topology.focusRoot).not.toBe("apps/website");
  });

  it("treats versioned showcase apps plus core package as a design system repo", () => {
    const analysis = analyzeRepositorySnapshot(designSystemPlatformFixture);

    expect(analysis.summary.projectType).toBe("컴포넌트 라이브러리 또는 디자인 시스템");
    expect(analysis.topology.focusRoot).toBe("packages/shadcn");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["packages/shadcn/package.json", "packages/shadcn/src/index.ts"])
    );
    expect(analysis.editGuides.map((guide) => guide.intent)).toEqual(
      expect.arrayContaining(["공개 API 수정", "문서/쇼케이스 앱 수정"])
    );
  });

  it("keeps component-library CLI migrations and registry schema out of DB signals", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-shadcn-like",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-shadcn-like",
        description: "CLI for adding accessible UI components to your project.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/shadcn/package.json",
        "packages/shadcn/src/index.ts",
        "packages/shadcn/src/commands/add.ts",
        "packages/shadcn/src/mcp/index.ts",
        "packages/shadcn/src/migrations/migrate-icons.ts",
        "packages/shadcn/src/registry/schema.ts",
        "packages/shadcn/src/registry/index.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-shadcn-like",
        private: true,
        description: "CLI for adding accessible UI components to your project.",
        workspaces: ["packages/*"],
        keywords: ["component library", "cli", "design system"],
        dependencies: {
          commander: "^12.0.0",
          zod: "^3.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Shadcn-like\n\nA component library CLI for adding reusable UI components.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.layers.map((layer) => layer.name)).not.toContain("DB");
    expect(analysis.summary.keyFeatures).not.toContain("데이터 저장/조회");
    expect(analysis.warnings.map((notice) => notice.code)).not.toContain("LAYER_CLASSIFICATION_GAP");
    expect(analysis.coverage.summary).toContain("Code 범위");
  });

  it("treats Vue component libraries as supported analysis targets", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-vue-ui",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-vue-ui",
        description: "Accessible component library for Vue apps.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/components/dialog.ts"],
      packageJsonText: JSON.stringify({
        name: "repo-vue-ui",
        description: "Accessible component library for Vue apps.",
        keywords: ["component library", "vue", "design system"],
        dependencies: {
          vue: "^3.5.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Vue UI\n\nAccessible Vue component library for web apps.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.stack).toContain("Vue");
    expect(analysis.warnings.map((notice) => notice.code)).not.toContain("SUPPORTED_STACK_GAP");
  });

  it("prefers design-system plain titles over generic web-app wording", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-radix-wording",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-radix-wording",
        description: "An open-source UI component library for building web apps.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/dialog.ts"],
      packageJsonText: JSON.stringify({
        name: "repo-radix-wording",
        description: "An open-source UI component library for building web apps.",
        keywords: ["component library", "primitives", "design system"],
        dependencies: {
          react: "^19.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText:
        "# Radix wording\n\nAn open-source UI component library for building high-quality, accessible design systems and web apps.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.identity.plainTitle).toBe("재사용 UI 컴포넌트를 모아 둔 디자인 시스템");
  });

  it("suppresses benign limited-mode gaps when a frontend workspace is otherwise well classified", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-frontend-workspace",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-frontend-workspace",
        description: "A frontend workspace inside a larger monorepo.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/frontend/editor-ui/package.json",
        "packages/frontend/editor-ui/src/components/editor-shell.ts",
        "packages/frontend/editor-ui/src/components/node-panel.ts",
        "packages/frontend/editor-ui/src/components/top-bar.ts",
        "packages/frontend/editor-ui/src/components/sidebar.ts",
        "packages/frontend/editor-ui/src/components/execution-badge.ts",
        "packages/frontend/editor-ui/src/ui/button.ts",
        "packages/frontend/editor-ui/src/ui/modal.ts",
        "packages/frontend/editor-ui/src/ui/tooltip.ts",
        "packages/frontend/editor-ui/src/features/workflows/useWorkflowState.ts",
        "packages/frontend/editor-ui/src/features/history/useHistoryFilters.ts",
        "packages/frontend/editor-ui/src/features/editor/useCanvasState.ts",
        "packages/frontend/editor-ui/src/features/nodes/useNodeSearch.ts",
        "packages/frontend/editor-ui/src/features/variables/useVariablesState.ts",
        "packages/frontend/editor-ui/src/app/api/favorites.ts",
        "packages/frontend/editor-ui/src/app/api/workflows.ts",
        "packages/frontend/editor-ui/src/app/api/tags.ts",
        "packages/frontend/editor-ui/src/app/models/history.ts",
        "packages/frontend/editor-ui/src/app/workers/data/db.ts",
        "packages/frontend/editor-ui/src/app/plugins/sentry.ts",
        "packages/frontend/editor-ui/src/app/plugins/telemetry.ts",
        "packages/frontend/editor-ui/src/app/stores/ui.store.ts",
        "packages/frontend/editor-ui/src/app/stores/ui.utils.ts",
        "packages/frontend/editor-ui/src/app/event-bus/node-view.ts",
        "packages/frontend/editor-ui/src/app/utils/time.ts",
        "packages/frontend/editor-ui/src/app/utils/workflowUtils.ts",
        "packages/frontend/editor-ui/src/app/utils/drag.ts",
        "packages/frontend/editor-ui/src/app/utils/layout.ts",
        "packages/frontend/editor-ui/src/app/store/workflows.ts",
        "packages/frontend/editor-ui/src/app/store/selection.ts",
        "packages/frontend/editor-ui/src/app/services/execution.ts",
        "packages/frontend/editor-ui/src/app/services/history.ts",
        "packages/frontend/editor-ui/src/main.ts",
        "packages/frontend/editor-ui/src/app/init.ts",
        "packages/frontend/editor-ui/src/app/router.ts",
        "packages/frontend/editor-ui/src/app/polyfills.ts",
        "packages/frontend/editor-ui/src/app/types/rbac.ts",
        "packages/frontend/editor-ui/src/shims-global.d.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-frontend-workspace",
        private: true,
        workspaces: ["packages/*", "packages/*/*"],
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Frontend Workspace\n\nA Vue-based frontend workspace in a monorepo.",
      truncated: true,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/init.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/router.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/main.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/plugins/sentry.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/plugins/telemetry.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/stores/ui.store.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/app/event-bus/node-view.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/frontend/editor-ui/src/shims-global.d.ts"
    );
    expect(analysis.warnings.map((notice) => notice.code)).not.toContain("LAYER_CLASSIFICATION_GAP");
  });

  it("classifies library internal support files as logic instead of residue", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-vue-headless-ui",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-vue-headless-ui",
        description: "Accessible component library for Vue apps.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/@headlessui-vue/package.json",
        "packages/@headlessui-vue/src/index.ts",
        "packages/@headlessui-vue/src/keyboard.ts",
        "packages/@headlessui-vue/src/mouse.ts",
        "packages/@headlessui-vue/src/internal/dom-containers.ts",
        "packages/@headlessui-vue/src/internal/focus-sentinel.ts",
        "packages/@headlessui-vue/src/internal/hidden.ts",
        "packages/@headlessui-vue/src/internal/open-closed.ts",
        "packages/@headlessui-vue/src/internal/portal-force-root.ts",
        "packages/@headlessui-vue/src/internal/stack-context.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-vue-headless-ui",
        private: true,
        workspaces: ["packages/*"],
      }),
      selectedFileContents: {
        "packages/@headlessui-vue/package.json": JSON.stringify({
          name: "@repo/headlessui-vue",
          version: "1.0.0",
          peerDependencies: {
            vue: "^3.0.0",
          },
        }),
      },
      readmeText: "# Vue UI\n\nAccessible component library for Vue apps.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.topology.focusRoot).toBe("packages/@headlessui-vue");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/@headlessui-vue/src/index.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/@headlessui-vue/src/keyboard.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/@headlessui-vue/src/mouse.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/@headlessui-vue/src/internal/dom-containers.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/@headlessui-vue/src/internal/open-closed.ts"
    );
    expect(analysis.layers.map((layer) => layer.name)).toContain("Logic");
  });

  it("surfaces operating docs, scripts, and templates for tooling harness repositories", () => {
    const analysis = analyzeRepositorySnapshot(toolingHarnessFixture);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 개발 도구");
    expect(analysis.summary.stack).toContain("Python");
    expect(analysis.topology.focusRoot).toBe("vb-pack-codex-harness");
    expect(analysis.summary.keyFeatures).toEqual(
      expect.arrayContaining([
        "pack root 2개 감지",
        "운영 문서 중심 구조",
        "자동화/검증 스크립트 포함",
        "재사용 템플릿 포함",
      ])
    );
    expect(analysis.layers.map((layer) => layer.name)).toContain("Logic");
    expect(analysis.keyFiles[0]?.path).toBe("README.md");
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "vb-pack-codex-harness/README.md",
        "vb-pack-codex-harness/AGENTS.md",
        "vb-pack-codex-harness/scripts/harness/bootstrap.py",
      ])
    );
    expect(
      analysis.keyFiles.some((file) => file.path.startsWith("vb-pack-codex-harness/templates/"))
    ).toBe(true);
    expect(analysis.keyFiles.filter((file) => /README\.md$/i.test(file.path)).length).toBeLessThanOrEqual(2);
    expect(analysis.editGuides.map((guide) => guide.intent)).toEqual(
      expect.arrayContaining(["운영 규칙 문서 수정", "자동화/검증 스크립트 수정", "템플릿 기본값 수정"])
    );
    expect(analysis.editGuides[0]?.files.some((file) => file.startsWith("vb-pack-codex-harness/"))).toBe(true);
  });

  it("detects Supabase-backed apps as fullstack projects with DB signals", () => {
    const analysis = analyzeRepositorySnapshot(supabaseAppFixture);

    expect(analysis.summary.projectType).toBe("풀스택 웹앱");
    expect(analysis.summary.stack).toContain("Supabase");
    expect(analysis.layers.map((layer) => layer.name)).toContain("DB");
  });

  it("keeps nested example apps out of library stack summaries", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "supabase",
        name: "supabase-js",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/supabase/supabase-js",
        description: "JavaScript client library for Supabase.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/core/supabase-js/package.json",
        "packages/core/supabase-js/src/index.ts",
        "packages/core/supabase-js/src/client.ts",
        "packages/core/supabase-js/example/react/package.json",
        "packages/core/supabase-js/example/react/app/page.tsx",
        "packages/core/supabase-js/example/react/next.config.js",
        "tailwind.config.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "supabase-js-workspace",
        description: "JavaScript client library for Supabase.",
        workspaces: ["packages/core/*"],
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          tailwindcss: "^4.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Supabase JS\n\nJavaScript client library for Supabase.",
      selectedFileContents: {
        "packages/core/supabase-js/package.json": JSON.stringify({
          name: "@supabase/supabase-js",
          description: "JavaScript client library for Supabase.",
          main: "dist/index.js",
          types: "dist/index.d.ts",
          dependencies: {
            "@supabase/supabase-js": "^2.0.0",
          },
        }),
        "packages/core/supabase-js/src/index.ts": `export { createClient } from "./client";`,
        "packages/core/supabase-js/src/client.ts": `
          import { createClient } from "@supabase/supabase-js";
          export const client = createClient("https://example.supabase.co", "public-anon-key");
        `,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.focusRoot).toBe("packages/core/supabase-js");
    expect(analysis.summary.stack).toContain("Supabase");
    expect(analysis.summary.stack).not.toContain("Next.js");
    expect(analysis.summary.stack).not.toContain("React");
    expect(analysis.summary.stack).not.toContain("Tailwind CSS");
    expect(analysis.summary.keyFeatures).not.toContain("페이지 기반 진입 구조");
    expect(analysis.summary.keyFeatures).not.toContain("재사용 컴포넌트 구조");
  });

  it("prefers sdk classification over example classification when package demos are bundled", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-firebase-like-sdk",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-firebase-like-sdk",
        description: "JavaScript SDK monorepo with bundled demo apps.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/auth/package.json",
        "packages/auth/src/index.ts",
        "packages/auth/src/api/index.ts",
        "packages/auth/src/mfa/mfa_info.ts",
        "packages/auth/src/mfa/mfa_user.ts",
        "packages/auth/src/platform_browser/load_js.ts",
        "packages/auth/src/platform_browser/util/popup.ts",
        "packages/auth/demo/firebase.json",
        "packages/auth/demo/functions/index.ts",
        "packages/firestore/package.json",
        "packages/firestore/src/index.ts",
        "packages/firestore/demo/app/page.tsx",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-firebase-like-sdk",
        description: "JavaScript SDK monorepo with bundled demo apps.",
        workspaces: ["packages/*", "packages/*/demo"],
        keywords: ["sdk", "client", "typescript"],
        dependencies: {
          firebase: "^11.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Firebase-like SDK\n\nJavaScript SDK monorepo with bundled demo apps.",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.focusRoot?.startsWith("packages/")).toBe(true);
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
    expect(analysis.summary.keyFeatures).not.toContain("여러 예제 앱 포함");
    expect(analysis.coverage.unclassifiedCodeFileCount).toBe(0);
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/auth/src/mfa/mfa_info.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/auth/src/platform_browser/load_js.ts"
    );
  });

  it("prefers README install-target sdk packages over internal ui packages", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "repo-clerk-like-sdk",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/repo-clerk-like-sdk",
        description: "Official JavaScript SDKs for multiple frameworks.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/ui/package.json",
        "packages/ui/src/index.ts",
        "packages/ui/src/components/sign-in.tsx",
        "packages/ui/src/components/user-button.tsx",
        "packages/nextjs/package.json",
        "packages/nextjs/tsup.config.ts",
        "packages/nextjs/src/index.ts",
        "packages/nextjs/src/errors.ts",
        "packages/nextjs/src/legacy.ts",
        "packages/nextjs/src/internal.ts",
        "packages/nextjs/src/webhooks.ts",
        "packages/nextjs/src/constants.ts",
        "packages/nextjs/src/experimental.ts",
        "packages/nextjs/src/server/index.ts",
        "packages/nextjs/src/server/proxy.ts",
        "packages/nextjs/src/client-boundary/hooks.ts",
        "packages/nextjs/src/client-boundary/uiComponents.tsx",
        "packages/nextjs/src/app-router/server-actions.ts",
        "packages/nextjs/src/runtime/node/safe-node-apis.js",
        "packages/nextjs/src/components.client.ts",
        "packages/nextjs/src/client/index.ts",
        "packages/nextjs/src/pages/ClerkProvider.tsx",
        "packages/nextjs/src/pages/__tests__/index.test.tsx",
        "packages/react/package.json",
        "packages/react/src/index.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "repo-clerk-like-sdk",
        private: true,
        workspaces: ["packages/*"],
        keywords: ["sdk", "authentication", "javascript"],
        dependencies: {
          react: "^19.0.0",
          next: "^16.0.0",
        },
      }),
      readmeText: `
# Clerk-like SDKs

Official JavaScript SDKs for multiple frameworks.

\`\`\`sh
npm install @clerk/nextjs
\`\`\`
      `,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.focusRoot).toBe("packages/nextjs");
    expect(analysis.summary.keyFeatures).not.toContain("페이지 기반 진입 구조");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/nextjs/src/errors.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/nextjs/src/server/proxy.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/nextjs/src/client-boundary/hooks.ts"
    );
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain("packages/nextjs/tsup.config.ts");
    expect(analysis.coverage.unclassifiedCodeSamples).not.toContain(
      "packages/nextjs/src/components.client.ts"
    );
    expect(analysis.keyFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(["packages/nextjs/package.json", "packages/nextjs/src/index.ts"])
    );
  });

  it("prefers repo-name and install-target sdk packages over sibling tooling packages", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "ai",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/ai",
        description: "AI SDK with examples and internal tooling.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/ai/package.json",
        "packages/ai/src/index.ts",
        "packages/ai/src/core/generate.ts",
        "packages/ai/examples/basic/package.json",
        "packages/ai/examples/basic/app/page.tsx",
        "packages/devtools/package.json",
        "packages/devtools/src/index.ts",
        "packages/devtools/src/inspector.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "ai",
        private: true,
        workspaces: ["packages/*"],
        dependencies: {
          react: "^19.0.0",
        },
      }),
      readmeText: `
# AI SDK

\`\`\`sh
npm install ai
\`\`\`
      `,
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.focusRoot).toBe("packages/ai");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
  });

  it("follows root readme redirects when a monorepo sdk points beginners to a package workspace", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "ai",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/ai",
        description: "AI SDK monorepo with docs moved into the publishable package.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "packages/ai/package.json",
        "packages/ai/README.md",
        "packages/ai/src/index.ts",
        "packages/devtools/package.json",
        "packages/devtools/src/index.ts",
        "packages/devtools/bin/cli.js",
      ],
      packageJsonText: JSON.stringify({
        name: "ai-repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      readmeText: "packages/ai/README.md",
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.topology.focusRoot).toBe("packages/ai");
    expect(analysis.learning.identity.consumptionMode).toBe("hybrid");
  });

  it("treats GitHub Pages as preview hosting rather than semantic integration", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "pages-site",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/pages-site",
        description: "Static site for project docs.",
      },
      allPaths: ["README.md", "package.json", "src/main.ts"],
      packageJsonText: JSON.stringify({
        name: "pages-site",
        description: "Static site for project docs.",
        homepage: "https://fixture-owner.github.io/pages-site",
      }),
      readmeText:
        "# Pages Site\n\n[Live site](https://fixture-owner.github.io/pages-site)\n\nHosted on GitHub Pages.",
      selectedFileContents: {
        "src/main.ts": `console.log("docs site");`,
      },
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.learning.preview.deployUrl).toBe("https://fixture-owner.github.io/pages-site");
    expect(analysis.summary.oneLiner ?? "").not.toContain("GitHub");
    expect(analysis.summary.keyFeatures.join(" ")).not.toContain("GitHub");
  });

  it("switches large repositories into limited analysis mode", () => {
    const analysis = analyzeRepositorySnapshot(limitedLargeRepoFixture);

    expect(analysis.analysisMode).toBe("limited");
    expect(analysis.limitations.map((item) => item.code)).toEqual(
      expect.arrayContaining(["LIMITED_ANALYSIS_MODE", "TREE_TRUNCATED"])
    );
    expect(analysis.stats.sourceFileCount).toBeGreaterThan(analysis.stats.fileCount);
    expect(analysis.keyFiles.map((file) => file.path)).not.toContain("packages/generated/file-0.ts");
    expect(analysis.summary.recommendedStartFile).toBe("apps/web/app/page.tsx");
  });
});
