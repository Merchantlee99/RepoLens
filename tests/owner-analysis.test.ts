import { describe, expect, it } from "vitest";
import { analyzeOwnerSnapshot } from "@/lib/analysis/owner";

describe("owner analysis", () => {
  it("builds an owner-level portfolio summary with featured and beginner repos", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "acme",
        url: "https://github.com/acme",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Acme",
        description: "Developer tools and product apps",
        blog: null,
        location: null,
        publicRepoCount: 4,
      },
      repositories: [
        {
          name: "acme-app",
          fullName: "acme/acme-app",
          url: "https://github.com/acme/acme-app",
          description: "Main customer product app",
          homepage: "https://app.acme.dev",
          language: "TypeScript",
          topics: ["nextjs", "react", "product"],
          stars: 2400,
          forks: 180,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
        {
          name: "acme-ui",
          fullName: "acme/acme-ui",
          url: "https://github.com/acme/acme-ui",
          description: "Component library and design system",
          homepage: null,
          language: "TypeScript",
          topics: ["react", "design-system", "ui"],
          stars: 1800,
          forks: 90,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
        {
          name: "acme-starter",
          fullName: "acme/acme-starter",
          url: "https://github.com/acme/acme-starter",
          description: "Starter example for learning the stack",
          homepage: null,
          language: "TypeScript",
          topics: ["example", "starter", "nextjs", "react"],
          stars: 320,
          forks: 45,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
        {
          name: "acme-cli",
          fullName: "acme/acme-cli",
          url: "https://github.com/acme/acme-cli",
          description: "CLI tool for syncing project config",
          homepage: null,
          language: "TypeScript",
          topics: ["cli", "tooling", "nodejs"],
          stars: 640,
          forks: 20,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
      ],
    });

    expect(analysis.kind).toBe("owner");
    expect(analysis.summary.publicRepoCount).toBe(4);
    expect(analysis.summary.enrichedRepoCount).toBe(4);
    expect(analysis.summary.commonStacks).toEqual(
      expect.arrayContaining(["Next.js", "React", "TypeScript"])
    );
    expect(analysis.portfolio.featuredRepos[0]?.fullName).toBe("acme/acme-app");
    expect(analysis.portfolio.featuredRepos[0]?.featuredReasonDetails[0]?.code).toBeDefined();
    expect(analysis.portfolio.beginnerRepos.map((repo) => repo.fullName)).toContain(
      "acme/acme-starter"
    );
    expect(
      analysis.portfolio.beginnerRepos.find((repo) => repo.fullName === "acme/acme-starter")
        ?.beginnerReasonDetails[0]?.code
    ).toBe("beginner_example");
    expect(analysis.portfolio.categories.map((category) => category.label)).toEqual(
      expect.arrayContaining(["제품/앱", "라이브러리", "예제/학습", "도구/SDK"])
    );
  });

  it("uses shallow readme and package signals to improve owner repo categorization", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "signals",
        url: "https://github.com/signals",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Signals",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "starter-kit",
          fullName: "signals/starter-kit",
          url: "https://github.com/signals/starter-kit",
          description: null,
          homepage: null,
          language: "TypeScript",
          topics: [],
          stars: 140,
          forks: 18,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# Starter Kit\n\nA quickstart example for building a Next.js + React app with Tailwind CSS.",
          packageJsonText: JSON.stringify({
            name: "@signals/starter-kit",
            description: "Starter example",
            dependencies: {
              next: "15.0.0",
              react: "19.0.0",
              tailwindcss: "4.0.0",
            },
          }),
        },
        {
          name: "sdk-core",
          fullName: "signals/sdk-core",
          url: "https://github.com/signals/sdk-core",
          description: null,
          homepage: null,
          language: "TypeScript",
          topics: [],
          stars: 620,
          forks: 44,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# SDK Core\n\nTypeScript SDK for calling the Signals API from web apps.",
          packageJsonText: JSON.stringify({
            name: "@signals/sdk-core",
            description: "TypeScript SDK",
            keywords: ["sdk", "api", "typescript"],
          }),
        },
      ],
    });

    const starter = analysis.portfolio.beginnerRepos.find((repo) => repo.fullName === "signals/starter-kit");
    const sdk = analysis.portfolio.featuredRepos.find((repo) => repo.fullName === "signals/sdk-core");

    expect(starter?.category).toBe("example");
    expect(starter?.stackSignals).toEqual(
      expect.arrayContaining(["Next.js", "React", "Tailwind CSS"])
    );
    expect(starter?.sampling.readmeSampled).toBe(true);
    expect(starter?.sampling.packageJsonSampled).toBe(true);
    expect(starter?.beginnerReasonDetails.map((reason) => reason.code)).toContain("beginner_example");
    expect(sdk?.category).toBe("tooling");
    expect(sdk?.featuredReasonDetails.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["high_stars", "tooling_entry"])
    );
    expect(analysis.summary.keyThemes).toEqual(
      expect.arrayContaining(["예제/학습", "개발 도구"])
    );
  });

  it("adds a limitation when only a sampled subset of public repos was analyzed", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "big-org",
        url: "https://github.com/big-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Big Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 240,
      },
      repositories: [
        {
          name: "platform",
          fullName: "big-org/platform",
          url: "https://github.com/big-org/platform",
          description: "Platform app",
          homepage: "https://platform.big-org.dev",
          language: "TypeScript",
          topics: ["nextjs", "react"],
          stars: 1200,
          forks: 80,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
      ],
      sampledRepoCount: 100,
      enrichedRepoCount: 3,
    });

    expect(analysis.limitations[0]?.code).toBe("OWNER_REPO_SAMPLE_LIMIT");
    expect(analysis.summary.enrichedRepoCount).toBe(3);
  });

  it("does not emit sparse metadata warning for owners without public repos", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "empty-user",
        url: "https://github.com/empty-user",
        avatarUrl: null,
        profileType: "user",
        displayName: "Empty User",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 0,
      },
      repositories: [],
      sampledRepoCount: 0,
    });

    expect(analysis.warnings.map((warning) => warning.code)).toEqual([
      "OWNER_WITHOUT_PUBLIC_REPOS",
    ]);
  });

  it("builds owner environment snapshots from sampled repo signals", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "env-org",
        url: "https://github.com/env-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Env Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 1,
      },
      repositories: [
        {
          name: "platform",
          fullName: "env-org/platform",
          url: "https://github.com/env-org/platform",
          description: "AI product platform",
          homepage: "https://env-org.vercel.app",
          language: "TypeScript",
          topics: ["nextjs", "openai"],
          stars: 120,
          forks: 14,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText:
            "# Platform\n\nDeploy on Vercel or Railway.\nRequires CUDA 12 compatible GPU for local inference.\nUses Cloudflare R2 for assets.",
          packageJsonText: JSON.stringify({
            engines: { node: ">=20" },
            dependencies: { openai: "^4.0.0", pg: "^8.0.0", redis: "^4.0.0" },
          }),
          pythonManifestPath: "pyproject.toml",
          pythonManifestText: '[project]\nrequires-python = ">=3.11"',
          dockerfileText: "FROM node:20-alpine\nEXPOSE 3000",
          composePath: "docker-compose.yml",
          composeText: "services:\n  db:\n    image: postgres:16\n  cache:\n    image: redis:7",
          deployConfigPaths: ["vercel.json", "railway.json"],
        },
      ],
    });

    const repo = analysis.portfolio.featuredRepos[0];

    expect(repo?.environment.runtimeLabel).toContain("Node 20+");
    expect(repo?.environment.runtimeLabel).toContain("Python 3.11+");
    expect(repo?.environment.needsDocker).toBe(true);
    expect(repo?.environment.gpuRequired).toBe(true);
    expect(repo?.environment.gpuHint).toContain("CUDA 12 compatible GPU");
    expect(repo?.environment.servicesRequired).toEqual(
      expect.arrayContaining(["OpenAI", "PostgreSQL", "Redis", "Cloudflare R2"])
    );
    expect(repo?.environment.deployTargets).toEqual(
      expect.arrayContaining(["Vercel", "Railway"])
    );
    expect(repo?.environment.pillSummary).toContain("Docker");
    expect(repo?.environment.confidence).toBe("high");
  });

  it("prefers official current SDK-style repos over stale high-star research snapshots", () => {
    const now = new Date().toISOString();
    const fiveYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 5).toISOString();
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "openai",
        url: "https://github.com/openai",
        avatarUrl: null,
        profileType: "organization",
        displayName: "OpenAI",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "gpt-2",
          fullName: "openai/gpt-2",
          url: "https://github.com/openai/gpt-2",
          description: "Older research release",
          homepage: null,
          language: "Python",
          topics: ["research"],
          stars: 32000,
          forks: 8000,
          updatedAt: fiveYearsAgo,
          archived: false,
          fork: false,
          readmeText: "# GPT-2\n\nLegacy research repository.",
        },
        {
          name: "openai-node",
          fullName: "openai/openai-node",
          url: "https://github.com/openai/openai-node",
          description: "Official TypeScript/JavaScript SDK for the OpenAI API.",
          homepage: "https://platform.openai.com",
          language: "TypeScript",
          topics: ["sdk", "api", "typescript"],
          stars: 9000,
          forks: 1000,
          updatedAt: now,
          archived: false,
          fork: false,
          readmeText: "# OpenAI Node\n\nOfficial SDK for the OpenAI API.",
          packageJsonText: JSON.stringify({
            name: "@openai/sdk",
            description: "Official SDK",
            keywords: ["sdk", "api"],
          }),
        },
      ],
    });

    expect(analysis.portfolio.featuredRepos[0]?.fullName).toBe("openai/openai-node");
  });

  it("keeps shallow owner environment snapshots low-confidence", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "shallow",
        url: "https://github.com/shallow",
        avatarUrl: null,
        profileType: "user",
        displayName: null,
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 1,
      },
      repositories: [
        {
          name: "notes",
          fullName: "shallow/notes",
          url: "https://github.com/shallow/notes",
          description: null,
          homepage: null,
          language: "Python",
          topics: [],
          stars: 2,
          forks: 0,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
      ],
    });

    const repo = analysis.portfolio.latestRepos[0];

    expect(repo?.environment.runtimeLabel).toBe("Python");
    expect(repo?.environment.confidence).toBe("low");
    expect(repo?.environment.pillSummary).toBe("Python");
  });

  it("prefers lower-setup repos in beginner recommendations when environment barriers are high", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "starter-org",
        url: "https://github.com/starter-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Starter Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "heavy-ai-example",
          fullName: "starter-org/heavy-ai-example",
          url: "https://github.com/starter-org/heavy-ai-example",
          description: null,
          homepage: null,
          language: "Python",
          topics: ["example", "starter", "ai"],
          stars: 480,
          forks: 40,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText:
            "# Heavy AI Example\n\nExample project.\nRequires CUDA 12 compatible GPU for local inference.",
          packageJsonText: JSON.stringify({
            dependencies: {
              openai: "^4.0.0",
              redis: "^4.0.0",
              pg: "^8.0.0",
            },
          }),
          pythonManifestPath: "pyproject.toml",
          pythonManifestText: '[project]\nrequires-python = ">=3.11"',
          dockerfileText: "FROM python:3.11\nEXPOSE 8000",
          composePath: "docker-compose.yml",
          composeText: "services:\n  db:\n    image: postgres:16\n  cache:\n    image: redis:7",
        },
        {
          name: "starter-lite",
          fullName: "starter-org/starter-lite",
          url: "https://github.com/starter-org/starter-lite",
          description: null,
          homepage: "https://starter-lite.dev",
          language: "TypeScript",
          topics: ["example", "starter", "nextjs", "react"],
          stars: 120,
          forks: 8,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# Starter Lite\n\nQuickstart example for building a Next.js app.",
          packageJsonText: JSON.stringify({
            dependencies: {
              next: "16.2.4",
              react: "19.2.4",
              "react-dom": "19.2.4",
            },
          }),
        },
      ],
    });

    expect(analysis.portfolio.beginnerRepos[0]?.fullName).toBe("starter-org/starter-lite");
    expect(
      analysis.portfolio.beginnerRepos[0]?.beginnerReasonDetails.map((reason) => reason.code)
    ).toContain("light_setup");
    expect(
      analysis.portfolio.beginnerRepos.find((repo) => repo.fullName === "starter-org/heavy-ai-example")
        ?.environment.gpuRequired
    ).toBe(true);
  });

  it("keeps official SDKs featured while runnable demos stay in beginner recommendations", () => {
    const now = new Date().toISOString();
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "mixed-org",
        url: "https://github.com/mixed-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Mixed Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 3,
      },
      repositories: [
        {
          name: "mixed-sdk",
          fullName: "mixed-org/mixed-sdk",
          url: "https://github.com/mixed-org/mixed-sdk",
          description: "Official TypeScript SDK for the Mixed API.",
          homepage: "https://docs.mixed.dev",
          language: "TypeScript",
          topics: ["sdk", "api", "typescript"],
          stars: 1800,
          forks: 120,
          updatedAt: now,
          archived: false,
          fork: false,
          readmeText: "# Mixed SDK\n\nOfficial SDK for building against the Mixed API.",
          packageJsonText: JSON.stringify({
            name: "@mixed/sdk",
            description: "Official TypeScript SDK",
            keywords: ["sdk", "api", "typescript"],
            exports: {
              ".": "./dist/index.js",
            },
          }),
        },
        {
          name: "mixed-demo",
          fullName: "mixed-org/mixed-demo",
          url: "https://github.com/mixed-org/mixed-demo",
          description: "Starter example app for learning the Mixed stack.",
          homepage: "https://demo.mixed.dev",
          language: "TypeScript",
          topics: ["example", "starter", "nextjs", "react"],
          stars: 220,
          forks: 24,
          updatedAt: now,
          archived: false,
          fork: false,
          readmeText: "# Mixed Demo\n\nStarter example for a Next.js app that uses the Mixed SDK.",
          packageJsonText: JSON.stringify({
            name: "mixed-demo",
            dependencies: {
              next: "16.2.4",
              react: "19.2.4",
              "react-dom": "19.2.4",
              "@mixed/sdk": "^1.0.0",
            },
          }),
        },
        {
          name: "mixed-infra",
          fullName: "mixed-org/mixed-infra",
          url: "https://github.com/mixed-org/mixed-infra",
          description: "Terraform and Helm deployment manifests for the Mixed platform.",
          homepage: null,
          language: "HCL",
          topics: ["terraform", "helm", "infra"],
          stars: 90,
          forks: 18,
          updatedAt: now,
          archived: false,
          fork: false,
          readmeText: "# Mixed Infra\n\nInfrastructure repo for production deployment.",
        },
      ],
    });

    expect(analysis.portfolio.featuredRepos[0]?.fullName).toBe("mixed-org/mixed-sdk");
    expect(analysis.portfolio.beginnerRepos.map((repo) => repo.fullName)).toContain(
      "mixed-org/mixed-demo"
    );
    expect(
      analysis.portfolio.beginnerRepos.find((repo) => repo.fullName === "mixed-org/mixed-demo")?.category
    ).toBe("example");
    expect(analysis.summary.recommendedStartingPoints).toContain("mixed-org/mixed-demo");
  });

  it("emits sparse metadata warning only when featured repos lack sampled signals", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "sparse-org",
        url: "https://github.com/sparse-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Sparse Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "core-lib",
          fullName: "sparse-org/core-lib",
          url: "https://github.com/sparse-org/core-lib",
          description: null,
          homepage: null,
          language: "TypeScript",
          topics: [],
          stars: 1200,
          forks: 90,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
        {
          name: "helper-tool",
          fullName: "sparse-org/helper-tool",
          url: "https://github.com/sparse-org/helper-tool",
          description: null,
          homepage: null,
          language: "TypeScript",
          topics: [],
          stars: 900,
          forks: 40,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
      ],
    });

    expect(analysis.warnings.map((warning) => warning.code)).toContain(
      "OWNER_REPO_METADATA_SPARSE"
    );
  });

  it("does not emit sparse metadata warning when at least one featured repo has sampled metadata", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "mixed-signals",
        url: "https://github.com/mixed-signals",
        avatarUrl: null,
        profileType: "organization",
        displayName: "Mixed Signals",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "core-lib",
          fullName: "mixed-signals/core-lib",
          url: "https://github.com/mixed-signals/core-lib",
          description: "Official SDK for the Mixed Signals API.",
          homepage: "https://docs.mixed-signals.dev",
          language: "TypeScript",
          topics: ["sdk", "api"],
          stars: 1500,
          forks: 120,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# Core Lib\n\nOfficial SDK for the Mixed Signals API.",
          packageJsonText: JSON.stringify({
            name: "@mixed-signals/sdk",
            description: "Official SDK",
            keywords: ["sdk", "api"],
          }),
        },
        {
          name: "helper-tool",
          fullName: "mixed-signals/helper-tool",
          url: "https://github.com/mixed-signals/helper-tool",
          description: null,
          homepage: null,
          language: "TypeScript",
          topics: [],
          stars: 900,
          forks: 40,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
        },
      ],
    });

    expect(analysis.warnings.map((warning) => warning.code)).not.toContain(
      "OWNER_REPO_METADATA_SPARSE"
    );
  });

  it("filters raw stack and service topic tokens out of owner key themes", () => {
    const analysis = analyzeOwnerSnapshot({
      profile: {
        login: "db-org",
        url: "https://github.com/db-org",
        avatarUrl: null,
        profileType: "organization",
        displayName: "DB Org",
        description: null,
        blog: null,
        location: null,
        publicRepoCount: 2,
      },
      repositories: [
        {
          name: "platform",
          fullName: "db-org/platform",
          url: "https://github.com/db-org/platform",
          description: "Managed database platform.",
          homepage: "https://platform.db-org.dev",
          language: "TypeScript",
          topics: ["postgres", "postgresql", "supabase", "platform"],
          stars: 1200,
          forks: 90,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# Platform\n\nManaged database platform with docs and hosted services.",
          packageJsonText: JSON.stringify({
            name: "@db-org/platform",
            dependencies: {
              "@supabase/supabase-js": "^2.0.0",
              pg: "^8.0.0",
            },
          }),
        },
        {
          name: "docs",
          fullName: "db-org/docs",
          url: "https://github.com/db-org/docs",
          description: "Documentation site for the platform.",
          homepage: "https://docs.db-org.dev",
          language: "TypeScript",
          topics: ["postgres", "documentation"],
          stars: 400,
          forks: 30,
          updatedAt: new Date().toISOString(),
          archived: false,
          fork: false,
          readmeText: "# Docs\n\nDocumentation and guides for the managed database platform.",
        },
      ],
    });

    expect(analysis.summary.keyThemes).toContain("데이터");
    expect(analysis.summary.keyThemes).not.toContain("database");
    expect(analysis.summary.keyThemes).not.toContain("postgres");
    expect(analysis.summary.keyThemes).not.toContain("postgresql");
    expect(analysis.summary.keyThemes).not.toContain("supabase");
  });
});
