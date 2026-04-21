import type { RepositorySnapshot } from "@/lib/analysis/analyzer";

const baseRepo = {
  owner: "fixture-owner",
  branch: "main",
  sha: "fixture-sha",
  url: "https://github.com/fixture-owner/fixture-repo",
  description: null,
} as const;

export const cliToolFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-cli",
    description: "CLI for understanding GitHub repositories.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "src/cli.ts",
    "src/commands/analyze.ts",
    "src/lib/github.ts",
    "src/lib/format.ts",
    "src/utils/output.ts",
    "assets/logo.svg",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-cli",
    description: "CLI for understanding GitHub repositories.",
    bin: {
      repolens: "src/cli.ts",
    },
    dependencies: {
      commander: "^12.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo CLI\n\nA command line tool for GitHub repository analysis.",
  truncated: false,
};

export const fullstackAppFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-app",
    description: "A web app that explains GitHub repositories.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "next.config.ts",
    "tsconfig.json",
    "app/layout.tsx",
    "app/page.tsx",
    "app/api/analyze/route.ts",
    "components/repo-form.tsx",
    "components/result-panel.tsx",
    "lib/github.ts",
    "lib/parser.ts",
    "db/schema.prisma",
    "public/logo.svg",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-app",
    description: "A web app that explains GitHub repositories.",
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      tailwindcss: "4.2.2",
      prisma: "5.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo App\n\nAnalyze a repo and show architecture, key files, and edit guide.",
  truncated: false,
};

export const learningGuideFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-learning-guide",
    description: "A web app that explains GitHub repositories with a guided preview.",
  },
  allPaths: [
    "README.md",
    "package.json",
    ".nvmrc",
    "Dockerfile",
    "compose.yaml",
    "vercel.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "app/layout.tsx",
    "app/page.tsx",
    "app/api/analyze/route.ts",
    "components/repo-form.tsx",
    "lib/github.ts",
    "db/schema.prisma",
    "public/preview.png",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-learning-guide",
    description: "A web app that explains GitHub repositories with a guided preview.",
    homepage: "https://repo-learning-guide.vercel.app",
    engines: {
      node: ">=20",
    },
    scripts: {
      dev: "next dev",
      build: "next build",
      test: "vitest run",
      start: "next start",
    },
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      tailwindcss: "4.2.2",
      prisma: "5.0.0",
      openai: "^4.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
      vitest: "^4.1.4",
    },
  }),
  readmeText: `# Repo Learning Guide

Understand a public GitHub repo with structure, explanation, and preview.
Built for developers who want to understand a repo quickly.

[Live demo](https://repo-learning-guide.vercel.app)

![Main result screen](public/preview.png)

## Features

- Explain the project structure in plain language.
- Highlight key files and reading order for the repo.
- Show a preview screen before diving into the code.

## Architecture

- Next.js pages call an API route that stores analysis results in PostgreSQL via Prisma.
- OpenAI is used only for explanation text, while fact extraction stays rule-based.

## Getting Started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Usage

\`\`\`bash
pnpm test
pnpm build
\`\`\`

\`\`\`ts
import { analyzeRepo } from "@/lib/analyze";

await analyzeRepo("https://github.com/vercel/next-learn");
\`\`\`

## Requirements

- 8GB RAM recommended for local indexing.
`,
  selectedFileContents: {
    ".nvmrc": "20\n",
    Dockerfile: `
      FROM node:20-alpine
      WORKDIR /app
      EXPOSE 3000
    `,
    "compose.yaml": `
      services:
        app:
          build: .
          ports:
            - "3000:3000"
        db:
          image: postgres:16
          ports:
            - "5432:5432"
        redis:
          image: redis:7
          ports:
            - "6379:6379"
    `,
    "vercel.json": `{"version":2}`,
    "app/api/analyze/route.ts": `
      import OpenAI from "openai";
      import { prisma } from "@/db/client";

      export async function POST() {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        await prisma.repo.findMany();
        return Response.json({ ok: true, client });
      }
    `,
    "db/schema.prisma": `
      datasource db {
        provider = "postgresql"
        url = env("DATABASE_URL")
      }
    `,
  },
  truncated: false,
};

export const workspaceLearningGuideFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-workspace-learning-guide",
    description: "A monorepo with a focused web app preview and usage flow.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "apps/web/README.md",
    "apps/web/package.json",
    "apps/web/app/page.tsx",
    "apps/web/app/layout.tsx",
    "apps/web/public/result-screen.png",
    "packages/ui/package.json",
    "packages/ui/src/button.tsx",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-workspace-learning-guide",
    private: true,
    homepage: "https://docs.repo-workspace-learning-guide.dev",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: `# Repo Workspace Learning Guide

![Logo](docs/logo.png)

[Documentation](https://docs.repo-workspace-learning-guide.dev)
`,
  selectedFileContents: {
    "apps/web/package.json": JSON.stringify({
      name: "@repo/web",
      homepage: "https://repo-workspace-learning-guide.vercel.app",
      scripts: {
        dev: "next dev",
        build: "next build",
        test: "vitest run",
      },
      dependencies: {
        next: "16.2.4",
        react: "19.2.4",
        "react-dom": "19.2.4",
        tailwindcss: "4.2.2",
      },
      devDependencies: {
        vitest: "^4.1.4",
      },
    }),
    "apps/web/README.md": `# Web App

[Live demo](https://repo-workspace-learning-guide.vercel.app)

![Result screen](public/result-screen.png)

## Getting Started

\`\`\`bash
pnpm dev
\`\`\`

## Build

\`\`\`bash
pnpm build
pnpm test
\`\`\`
`,
  },
  truncated: false,
};

export const workspaceRunnerUsageFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-workspace-runner-guide",
    description: "A monorepo that runs the main app through root workspace scripts.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "apps/web/package.json",
    "apps/web/app/page.tsx",
    "apps/web/app/layout.tsx",
    "packages/ui/package.json",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-workspace-runner-guide",
    private: true,
    homepage: "https://app.repo-workspace-runner.dev",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      dev: "turbo run dev --filter web",
      build: "pnpm --filter @repo/web build",
      test: "nx test web",
    },
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: `# Repo Workspace Runner Guide

[Preview](https://storybook.repo-workspace-runner.dev)
[Documentation](https://docs.repo-workspace-runner.dev)
  `,
  truncated: false,
};

export const readmeOfficialSiteFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-official-site",
    description: "A public project with an official website plus docs and setup links.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-official-site",
    dependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: `# Repo Official Site

[Official site](https://repo-official-site.dev)

## Documentation

[Documentation](https://docs.repo-official-site.dev)

## Deployment

[Railway](https://railway.app)
[Vercel](https://vercel.com/)
[Detailed blog post](https://blog.hosting.dev/p/repo-official-site)
`,
  truncated: false,
};

export const readmeDocsNoiseFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-chat-sdk-template",
    description: "A starter-style Next.js chat SDK example with framework docs noise.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "app/page.tsx",
    "app/layout.tsx",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-chat-sdk-template",
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
  }),
  readmeText: `# Repo Chat SDK Template

Built with Next.js.

## Getting Started

[Node.js](https://nodejs.org/)
[OpenAI dashboard](https://platform.openai.com/settings/organization/api-keys)
http://localhost:3000

## Learn More

[\`create-next-app\`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
[Next.js Documentation](https://nextjs.org/docs)
[Learn Next.js](https://nextjs.org/learn)
[Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
  `,
  truncated: false,
};

export const readmeNarrativeFilteringFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-readme-narrative-filter",
    description: "A repo used to verify README narrative filtering.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "app/page.tsx",
    "app/api/analyze/route.ts",
    "db/schema.prisma",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-readme-narrative-filter",
    scripts: {
      dev: "next dev",
    },
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      prisma: "^5.0.0",
      redis: "^5.0.0",
    },
  }),
  readmeText: `# Repo README Narrative Filter

[!TIP]
> For enterprise hosting, use the hosted product instead.

A browser app that explains repository structure with beginner-friendly steps.

## Overview

- Show the repo as layers instead of raw files.
- Highlight the first files to read before editing.

## Getting Started

- Sign up on the dashboard
- Create an API key

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Learn More

[Documentation](https://docs.repo-readme-filter.dev)

## Architecture Overview

- Frontend pages call an API route that stores snapshots in PostgreSQL.
- Worker jobs use Redis to refresh repository metadata in the background.
- Next.js Documentation explains the router.
- api/server.ts
`,
  truncated: false,
};

export const exampleCollectionFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-learn",
    description: "Tutorial repository with multiple Next.js examples.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "tsconfig.json",
    "dashboard/final-example/app/page.tsx",
    "dashboard/final-example/app/layout.tsx",
    "dashboard/final-example/app/api/metrics/route.ts",
    "dashboard/final-example/components/nav.tsx",
    "basics/api-routes-starter/pages/index.js",
    "basics/api-routes-starter/pages/api/hello.js",
    "seo/layout-shift/pages/index.js",
    "seo/layout-shift/components/header.jsx",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-learn",
    description: "Learn Next.js with multiple tutorial apps.",
    keywords: ["tutorial", "starter", "example"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      tailwindcss: "4.2.2",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Next Learn Examples\n\nThis tutorial repository contains multiple examples and starter apps.",
  truncated: false,
};

export const monorepoPlatformFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-monorepo",
    description: "A monorepo with multiple apps and shared packages.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "apps/web/package.json",
    "apps/web/app/layout.tsx",
    "apps/web/app/page.tsx",
    "apps/web/app/api/analyze/route.ts",
    "apps/web/components/hero.tsx",
    "apps/docs/package.json",
    "apps/docs/app/page.tsx",
    "packages/ui/package.json",
    "packages/ui/src/index.ts",
    "packages/ui/src/button.tsx",
    "packages/config/package.json",
    "packages/config/eslint/base.js",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-monorepo",
    description: "A monorepo with multiple apps and shared packages.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Repo Monorepo\n\nThis repository contains a web app, docs app, and shared UI packages.",
  truncated: false,
};

export const servicePlatformMonorepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-service-platform-monorepo",
    description: "A workflow automation platform monorepo with a visual editor and shared runtime packages.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "packages/frontend/editor-ui/package.json",
    "packages/frontend/editor-ui/app/layout.tsx",
    "packages/frontend/editor-ui/app/page.tsx",
    "packages/frontend/editor-ui/app/api/workflows/route.ts",
    "packages/frontend/editor-ui/components/editor-shell.tsx",
    "packages/core/package.json",
    "packages/core/src/index.ts",
    "packages/core/src/workflow-runner.ts",
    "packages/db/package.json",
    "packages/db/src/index.ts",
    "packages/db/src/schema.ts",
    "packages/nodes-base/package.json",
    "packages/nodes-base/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-service-platform-monorepo",
    description: "A workflow automation platform monorepo with a visual editor and shared runtime packages.",
    workspaces: ["packages/*", "packages/frontend/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Service Platform Monorepo\n\nBuild automation workflows in a visual editor and run them through shared runtime packages.",
  truncated: false,
};

export const monorepoRepresentativeFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-monorepo-focus",
    description: "A monorepo with a primary web app plus docs and example sandboxes.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "apps/web/package.json",
    "apps/web/app/layout.tsx",
    "apps/web/app/page.tsx",
    "apps/web/app/api/search/route.ts",
    "apps/docs/package.json",
    "apps/docs/app/page.tsx",
    "examples/with-berry/apps/web/app/page.tsx",
    "examples/with-berry/apps/web/app/layout.tsx",
    "playgrounds/storybook/app/page.tsx",
    "packages/ui/package.json",
    "packages/ui/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-monorepo-focus",
    description: "A monorepo with a primary web app plus docs and example sandboxes.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
  }),
  readmeText:
    "# Repo Monorepo Focus\n\nPrimary product lives in apps/web. docs and examples are secondary.",
  truncated: false,
};


export const reactSpaFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-react-spa",
    description: "A React single-page app for browsing repositories.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "vite.config.ts",
    "src/main.tsx",
    "src/App.tsx",
    "components/header.tsx",
    "components/sidebar.tsx",
    "lib/api.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-react-spa",
    description: "A React single-page app for browsing repositories.",
    dependencies: {
      react: "19.2.4",
      "react-dom": "19.2.4",
      vite: "6.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# React SPA\n\nFrontend app for repository browsing.",
  truncated: false,
};

export const multiSurfaceProductFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-multi-surface-product",
    description: "A GitHub repository visualization product with dashboard, web app, and marketing surfaces.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "next.config.ts",
    "web/app/layout.tsx",
    "web/app/page.tsx",
    "web/app/api/diagram/route.ts",
    "dashboard/app/layout.tsx",
    "dashboard/app/page.tsx",
    "dashboard/components/sidebar.tsx",
    "marketing/pages/index.tsx",
    "lib/github.ts",
    "lib/diagram.ts",
    "integrations/openai.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-multi-surface-product",
    description: "A GitHub repository visualization product with dashboard, web app, and marketing surfaces.",
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      openai: "^4.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Multi Surface Product\n\nInteractive product that turns GitHub repositories into architecture diagrams and shareable canvases.",
  truncated: false,
};

export const nodeApiFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-node-api",
    description: "An API service that indexes repositories.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "api/repos.ts",
    "api/health.ts",
    "lib/indexer.ts",
    "lib/github.ts",
    "db/client.ts",
    "db/schema.sql",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-node-api",
    description: "An API service that indexes repositories.",
    dependencies: {
      express: "^5.0.0",
      pg: "^8.0.0",
    },
  }),
  readmeText: "# Node API\n\nREST API for repository indexing.",
  truncated: false,
};

export const libraryPackageFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-sdk",
    description: "A TypeScript SDK for repository analysis.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "src/index.ts",
    "src/client.ts",
    "src/types.ts",
    "src/utils/request.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-sdk",
    description: "A TypeScript SDK for repository analysis.",
    main: "dist/index.js",
    module: "dist/index.mjs",
    types: "dist/index.d.ts",
    dependencies: {
      zod: "^3.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo SDK\n\nSDK for consuming repository analysis results.",
  truncated: false,
};

export const supabaseAppFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-supabase-app",
    description: "A Next.js app with Supabase-backed repository notes.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "next.config.ts",
    "app/layout.tsx",
    "app/page.tsx",
    "app/api/notes/route.ts",
    "components/note-list.tsx",
    "lib/supabase.ts",
    "supabase/functions/index.ts",
    "supabase/migrations/001_init.sql",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-supabase-app",
    description: "A Next.js app with Supabase-backed repository notes.",
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      "@supabase/supabase-js": "^2.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Supabase App\n\nNext.js app with repository notes stored in Supabase.",
  truncated: false,
};

export const limitedLargeRepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-large",
    description: "A large repository that should switch into limited analysis mode.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/web/app/layout.tsx",
    "apps/web/app/page.tsx",
    "apps/web/app/api/search/route.ts",
    "apps/web/components/search-panel.tsx",
    "apps/web/lib/api.ts",
    "packages/ui/src/index.ts",
    "packages/ui/src/button.tsx",
    "packages/generated/file-0.ts",
    "packages/generated/file-1.ts",
    "packages/generated/file-2.ts",
    "packages/generated/file-3.ts",
    "packages/generated/file-4.ts",
    "packages/generated/file-5.ts",
    "packages/generated/file-6.ts",
    "packages/generated/file-7.ts",
    "packages/generated/file-8.ts",
    "packages/generated/file-9.ts",
    "packages/generated/file-10.ts",
    "packages/generated/file-11.ts",
    "packages/generated/file-12.ts",
    "packages/generated/file-13.ts",
    "packages/generated/file-14.ts",
    "packages/generated/file-15.ts",
    "packages/generated/file-16.ts",
    "packages/generated/file-17.ts",
    "packages/generated/file-18.ts",
    "packages/generated/file-19.ts",
    "packages/generated/file-20.ts",
    "packages/generated/file-21.ts",
    "packages/generated/file-22.ts",
    "packages/generated/file-23.ts",
    "packages/generated/file-24.ts",
    "packages/generated/file-25.ts",
    "packages/generated/file-26.ts",
    "packages/generated/file-27.ts",
    "packages/generated/file-28.ts",
    "packages/generated/file-29.ts",
    "packages/generated/file-30.ts",
    "packages/generated/file-31.ts",
    "packages/generated/file-32.ts",
    "packages/generated/file-33.ts",
    "packages/generated/file-34.ts",
    "packages/generated/file-35.ts",
    "packages/generated/file-36.ts",
    "packages/generated/file-37.ts",
    "packages/generated/file-38.ts",
    "packages/generated/file-39.ts",
    "packages/generated/file-40.ts",
    "packages/generated/file-41.ts",
    "packages/generated/file-42.ts",
    "packages/generated/file-43.ts",
    "packages/generated/file-44.ts",
    "packages/generated/file-45.ts",
    "packages/generated/file-46.ts",
    "packages/generated/file-47.ts",
    "packages/generated/file-48.ts",
    "packages/generated/file-49.ts",
    "packages/generated/file-50.ts",
    "packages/generated/file-51.ts",
    "packages/generated/file-52.ts",
    "packages/generated/file-53.ts",
    "packages/generated/file-54.ts",
    "packages/generated/file-55.ts",
    "packages/generated/file-56.ts",
    "packages/generated/file-57.ts",
    "packages/generated/file-58.ts",
    "packages/generated/file-59.ts",
    "packages/generated/file-60.ts",
    "packages/generated/file-61.ts",
    "packages/generated/file-62.ts",
    "packages/generated/file-63.ts",
    "packages/generated/file-64.ts",
    "packages/generated/file-65.ts",
    "packages/generated/file-66.ts",
    "packages/generated/file-67.ts",
    "packages/generated/file-68.ts",
    "packages/generated/file-69.ts",
    "packages/generated/file-70.ts",
    "packages/generated/file-71.ts",
    "packages/generated/file-72.ts",
    "packages/generated/file-73.ts",
    "packages/generated/file-74.ts",
    "packages/generated/file-75.ts",
    "packages/generated/file-76.ts",
    "packages/generated/file-77.ts",
    "packages/generated/file-78.ts",
    "packages/generated/file-79.ts",
    "packages/generated/file-80.ts",
    "packages/generated/file-81.ts",
    "packages/generated/file-82.ts",
    "packages/generated/file-83.ts",
    "packages/generated/file-84.ts",
    "packages/generated/file-85.ts",
    "packages/generated/file-86.ts",
    "packages/generated/file-87.ts",
    "packages/generated/file-88.ts",
    "packages/generated/file-89.ts",
    "packages/generated/file-90.ts",
    "packages/generated/file-91.ts",
    "packages/generated/file-92.ts",
    "packages/generated/file-93.ts",
    "packages/generated/file-94.ts",
    "packages/generated/file-95.ts",
    "packages/generated/file-96.ts",
    "packages/generated/file-97.ts",
    "packages/generated/file-98.ts",
    "packages/generated/file-99.ts",
    "packages/generated/file-100.ts",
    "packages/generated/file-101.ts",
    "packages/generated/file-102.ts",
    "packages/generated/file-103.ts",
    "packages/generated/file-104.ts",
    "packages/generated/file-105.ts",
    "packages/generated/file-106.ts",
    "packages/generated/file-107.ts",
    "packages/generated/file-108.ts",
    "packages/generated/file-109.ts",
    "packages/generated/file-110.ts",
    "packages/generated/file-111.ts",
    "packages/generated/file-112.ts",
    "packages/generated/file-113.ts",
    "packages/generated/file-114.ts",
    "packages/generated/file-115.ts",
    "packages/generated/file-116.ts",
    "packages/generated/file-117.ts",
    "packages/generated/file-118.ts",
    "packages/generated/file-119.ts",
    "packages/generated/file-120.ts",
    "packages/generated/file-121.ts",
    "packages/generated/file-122.ts",
    "packages/generated/file-123.ts",
    "packages/generated/file-124.ts",
    "packages/generated/file-125.ts",
    "packages/generated/file-126.ts",
    "packages/generated/file-127.ts",
    "packages/generated/file-128.ts",
    "packages/generated/file-129.ts",
    "packages/generated/file-130.ts",
    "packages/generated/file-131.ts",
    "packages/generated/file-132.ts",
    "packages/generated/file-133.ts",
    "packages/generated/file-134.ts",
    "packages/generated/file-135.ts",
    "packages/generated/file-136.ts",
    "packages/generated/file-137.ts",
    "packages/generated/file-138.ts",
    "packages/generated/file-139.ts",
    "packages/generated/file-140.ts",
    "packages/generated/file-141.ts",
    "packages/generated/file-142.ts",
    "packages/generated/file-143.ts",
    "packages/generated/file-144.ts",
    "packages/generated/file-145.ts",
    "packages/generated/file-146.ts",
    "packages/generated/file-147.ts",
    "packages/generated/file-148.ts",
    "packages/generated/file-149.ts",
    "packages/generated/file-150.ts",
    "packages/generated/file-151.ts",
    "packages/generated/file-152.ts",
    "packages/generated/file-153.ts",
    "packages/generated/file-154.ts",
    "packages/generated/file-155.ts",
    "packages/generated/file-156.ts",
    "packages/generated/file-157.ts",
    "packages/generated/file-158.ts",
    "packages/generated/file-159.ts"
  ],
  sourceFileCount: 6200,
  packageJsonText: JSON.stringify({
    name: "repo-large",
    description: "A large repository that should switch into limited analysis mode.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
  }),
  readmeText: "# Large Repo\n\nLarge workspace repository.",
  truncated: true,
};


export const packageVsAppFocusFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-package-vs-app",
    description: "A monorepo with both web app and app-store package routes.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/web/package.json",
    "apps/web/app/page.tsx",
    "apps/web/app/layout.tsx",
    "apps/web/app/api/search/route.ts",
    "packages/app-store/package.json",
    "packages/app-store/paypal/pages/setup.tsx",
    "packages/app-store/stripe/pages/install.tsx",
    "packages/app-store/api/index.ts",
    "packages/ui/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-package-vs-app",
    description: "A monorepo with both web app and app-store package routes.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
  }),
  readmeText: "# Package vs App\n\nThe main product lives in apps/web.",
  truncated: false,
};

export const studioVsUiLibraryFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-studio-vs-ui-library",
    description: "A monorepo with product studio and internal ui-library apps.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/studio/package.json",
    "apps/studio/app/page.tsx",
    "apps/studio/app/layout.tsx",
    "apps/studio/app/api/projects/route.ts",
    "apps/www/package.json",
    "apps/www/app/page.tsx",
    "apps/ui-library/package.json",
    "apps/ui-library/app/page.tsx",
    "apps/ui-library/app/docs/page.tsx",
    "apps/ui-library/app/components/page.tsx",
    "packages/ui/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-studio-vs-ui-library",
    description: "A monorepo with product studio and internal ui-library apps.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
  }),
  readmeText: "# Studio vs UI Library\n\nPrimary product lives in apps/studio.",
  truncated: false,
};

export const docsHeavyMonorepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-docs-heavy-monorepo",
    description: "A product monorepo where docs has more routes than the main app.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "apps/web/package.json",
    "apps/web/app/layout.tsx",
    "apps/web/app/page.tsx",
    "apps/web/app/api/search/route.ts",
    "apps/web/components/search-shell.tsx",
    "apps/docs/package.json",
    "apps/docs/app/page.tsx",
    "apps/docs/app/guides/getting-started/page.tsx",
    "apps/docs/app/guides/advanced/page.tsx",
    "apps/docs/app/reference/page.tsx",
    "apps/docs/app/components/page.tsx",
    "packages/ui/package.json",
    "packages/ui/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-docs-heavy-monorepo",
    description: "A product monorepo where docs has more routes than the main app.",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
  }),
  readmeText: "# Docs Heavy Monorepo\n\nMain product lives in apps/web even though docs has more pages.",
  truncated: false,
};

export const libraryDocsMonorepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-sdk-monorepo",
    description: "A TypeScript SDK monorepo with React bindings and docs site.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/docs/package.json",
    "apps/docs/app/page.tsx",
    "apps/docs/app/getting-started/page.tsx",
    "packages/sdk/package.json",
    "packages/sdk/src/index.ts",
    "packages/sdk/src/client.ts",
    "packages/sdk/src/utils/request.ts",
    "packages/react/package.json",
    "packages/react/src/index.tsx",
    "packages/react/src/provider.tsx",
    "packages/core/package.json",
    "packages/core/src/index.ts",
    "packages/core/src/http.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-sdk-monorepo",
    description: "A TypeScript SDK monorepo with React bindings and docs site.",
    workspaces: ["apps/*", "packages/*"],
    keywords: ["sdk", "typescript", "client"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Repo SDK Monorepo\n\nTypeScript SDK packages with docs site and React bindings.",
  truncated: false,
};

export const libraryPlaygroundMonorepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-headless-playground",
    description: "An accessible UI component library with React playground apps.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "playgrounds/react/package.json",
    "playgrounds/react/app/page.tsx",
    "playgrounds/react/app/components/page.tsx",
    "playgrounds/vue/package.json",
    "playgrounds/vue/pages/index.tsx",
    "packages/ui/package.json",
    "packages/ui/src/index.ts",
    "packages/ui/src/tabs.tsx",
    "packages/react/package.json",
    "packages/react/src/index.tsx",
    "packages/react/src/provider.tsx",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-headless-playground",
    description: "An accessible UI component library with React playground apps.",
    workspaces: ["packages/*", "playgrounds/*"],
    dependencies: {
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText: "# Headless Playground\n\nOpen-source UI component library with playground apps.",
  truncated: false,
};

export const nestedPackageLibraryMonorepoFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-nested-library",
    description: "A primitives library monorepo with nested package workspaces and a support app.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/ssr-testing/package.json",
    "apps/ssr-testing/app/page.tsx",
    "packages/react/dialog/package.json",
    "packages/react/dialog/src/index.tsx",
    "packages/react/dialog/src/dialog.tsx",
    "packages/react/tooltip/package.json",
    "packages/react/tooltip/src/index.tsx",
    "packages/core/primitive/package.json",
    "packages/core/primitive/src/index.ts",
    "packages/core/primitive/src/assert.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-nested-library",
    description: "A primitives library monorepo with nested package workspaces and a support app.",
    workspaces: ["apps/*", "packages/*/*"],
    keywords: ["primitives", "component library"],
    dependencies: {
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Nested Library Monorepo\n\nPrimary public packages live under packages/react and packages/core.",
  truncated: false,
};

export const designSystemPlatformFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-design-system-platform",
    description: "A set of accessible UI components with a versioned showcase app and code distribution package.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "apps/v4/package.json",
    "apps/v4/app/layout.tsx",
    "apps/v4/app/(app)/(root)/page.tsx",
    "apps/v4/app/(app)/blocks/page.tsx",
    "apps/v4/app/api/search/route.ts",
    "packages/shadcn/README.md",
    "packages/shadcn/package.json",
    "packages/shadcn/src/index.ts",
    "packages/shadcn/src/commands/add.ts",
    "packages/shadcn/src/registry/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-design-system-platform",
    description:
      "A set of accessible UI components with a versioned showcase app and code distribution package.",
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
    "# Design System Platform\n\nAccessible UI components with a versioned showcase app and code distribution package.",
  truncated: false,
};

export const toolingHarnessFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-tooling-harness",
    description: "Reusable coding harness packs for long-running agent workflows.",
  },
  allPaths: [
    "README.md",
    "vb-pack-codex-harness/README.md",
    "vb-pack-codex-harness/AGENTS.md",
    "vb-pack-codex-harness/Prompt.md",
    "vb-pack-codex-harness/Plan.md",
    "vb-pack-codex-harness/Documentation.md",
    "vb-pack-codex-harness/scripts/harness/bootstrap.py",
    "vb-pack-codex-harness/scripts/harness/review_gate.py",
    "vb-pack-codex-harness/templates/Prompt.md",
    "vb-pack-codex-harness/templates/Plan.md",
    "vb-pack-codex-harness/.codex/hooks/session_start.py",
    "vb-pack-claude-harness/README.md",
    "vb-pack-claude-harness/AGENTS.md",
    "vb-pack-claude-harness/CLAUDE.md",
    "vb-pack-claude-harness/scripts/harness/bootstrap.py",
    "vb-pack-claude-harness/templates/Prompt.md",
  ],
  packageJsonText: null,
  readmeText:
    "# Vibebuilder Packs\n\nReusable harness packs with operating docs, automation scripts, and starter templates.",
  truncated: false,
};

export const solutionExampleCollectionFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-solution-example",
    description: "Workshop repo with starter and solution examples for the same app.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "tsconfig.json",
    "workshop/starter/app/page.tsx",
    "workshop/starter/app/layout.tsx",
    "workshop/starter/app/api/hello/route.ts",
    "workshop/starter/tsconfig.json",
    "workshop/solution/app/page.tsx",
    "workshop/solution/app/layout.tsx",
    "workshop/solution/app/api/hello/route.ts",
    "workshop/solution/components/header.tsx",
    "workshop/solution/tsconfig.json",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-solution-example",
    description: "Workshop repo with starter and solution examples for the same app.",
    keywords: ["tutorial", "starter", "solution", "example"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Solution Example Repo\n\nStart with the starter app, then compare with the solution app.",
  truncated: false,
};

export const monorepoSolutionFocusFixture: RepositorySnapshot = {
  repo: {
    ...baseRepo,
    name: "repo-monorepo-solution-focus",
    description: "A monorepo tutorial with starter and solution apps plus shared packages.",
  },
  allPaths: [
    "README.md",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "apps/starter/package.json",
    "apps/starter/app/layout.tsx",
    "apps/starter/app/page.tsx",
    "apps/starter/app/api/preview/route.ts",
    "apps/solution/package.json",
    "apps/solution/app/layout.tsx",
    "apps/solution/app/page.tsx",
    "apps/solution/app/api/search/route.ts",
    "apps/docs/package.json",
    "apps/docs/app/page.tsx",
    "packages/ui/package.json",
    "packages/ui/src/index.ts",
  ],
  packageJsonText: JSON.stringify({
    name: "repo-monorepo-solution-focus",
    description: "A monorepo tutorial with starter and solution apps plus shared packages.",
    workspaces: ["apps/*", "packages/*"],
    keywords: ["tutorial", "starter", "solution"],
    dependencies: {
      next: "16.2.4",
      react: "19.2.4",
      "react-dom": "19.2.4",
      turbo: "^2.0.0",
    },
    devDependencies: {
      typescript: "^5.0.0",
    },
  }),
  readmeText:
    "# Monorepo Solution Focus\n\nThe solution app under apps/solution is the main reference implementation.",
  truncated: false,
};
