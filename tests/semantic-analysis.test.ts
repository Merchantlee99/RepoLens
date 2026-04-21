import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";

describe("semantic representative-content analysis", () => {
  it("uses representative file contents to enrich summary, facts, inferences, and key file explanations", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-fullstack",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-fullstack",
        description: null,
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/layout.tsx",
        "app/api/analyze/route.ts",
        "components/repo-form.tsx",
        "hooks/useDiagram.ts",
        "lib/repo-service.ts",
        "lib/openai-client.ts",
        "lib/github.ts",
        "db/client.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "semantic-fullstack",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          openai: "^4.0.0",
          "@prisma/client": "^5.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Semantic Fullstack\n\nAnalyze repos with a web UI.",
      selectedFileContents: {
        "app/page.tsx": `
          import { useDiagram } from "@/hooks/useDiagram";

          export default function Page() {
            async function onSubmit() {
              useDiagram();
              const response = await fetch("/api/analyze", { method: "POST" });
              return response.json();
            }
            return <button onClick={onSubmit}>Analyze</button>;
          }
        `,
        "app/api/analyze/route.ts": `
          import { buildRepoDiagram } from "@/lib/repo-service";

          export async function POST() {
            const result = await buildRepoDiagram();
            return Response.json(result);
          }
        `,
        "hooks/useDiagram.ts": `
          export function useDiagram() {
            return "diagram";
          }
        `,
        "lib/repo-service.ts": `
          import { prisma } from "@/db/client";
          import { runOpenAi } from "@/lib/openai-client";

          export async function buildRepoDiagram() {
            await prisma.repo.upsert({ where: { id: "1" }, create: {}, update: {} });
            return runOpenAi();
          }
        `,
        "lib/openai-client.ts": `
          import OpenAI from "openai";

          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          export async function runOpenAi() {
            return client.responses.create({ model: "gpt-5.4-mini", input: "hello" });
          }
        `,
        "db/client.ts": `
          import { PrismaClient } from "@prisma/client";
          export const prisma = new PrismaClient();
        `,
      },
      representativePaths: [
        "app/page.tsx",
        "app/api/analyze/route.ts",
        "hooks/useDiagram.ts",
        "lib/repo-service.ts",
        "lib/openai-client.ts",
        "db/client.ts",
      ],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);
    const pageFile = analysis.keyFiles.find((file) => file.path === "app/page.tsx");
    const apiFile = analysis.keyFiles.find((file) => file.path === "app/api/analyze/route.ts");
    const dbFile = analysis.keyFiles.find((file) => file.path === "db/client.ts");
    const logicFile = analysis.keyFiles.find((file) => file.path === "hooks/useDiagram.ts");
    const firstGuide = analysis.editGuides[0];
    const apiGuide = analysis.editGuides.find((guide) => guide.intent === "API 응답 수정");

    expect(analysis.summary.oneLiner).toContain("대표 코드에서는");
    expect(analysis.summary.oneLiner).toContain("/api/analyze");
    expect(analysis.summary.oneLiner).toContain("OpenAI");
    expect(analysis.summary.oneLiner).toContain("Prisma 연결과 OpenAI 연동");

    expect(analysis.summary.keyFeatures).toEqual(
      expect.arrayContaining(["Prisma 연결 확인", "OpenAI 연동 확인", "서버 요청 처리"])
    );
    expect(analysis.summary.keyFeatures).not.toContain("대표 API 흐름 감지");
    expect(analysis.summary.keyFeatures).not.toContain("데이터 저장/조회");
    expect(analysis.summary.keyFeatures).not.toContain("외부 서비스 연동");

    expect(pageFile?.whyImportant).toContain("/api/analyze");
    expect(pageFile?.evidence).toEqual(expect.arrayContaining(["내부 API 호출: /api/analyze"]));
    expect(pageFile?.whyImportant).toContain("useDiagram.ts");
    expect(pageFile?.evidence).toEqual(expect.arrayContaining(["내부 로직 import: hooks/useDiagram.ts"]));

    expect(apiFile?.role).toBe("POST 요청 처리 진입점");
    expect(apiFile?.whyImportant).toContain("POST");
    expect(apiFile?.whyImportant).toContain("OpenAI");
    expect(apiFile?.whyImportant).toContain("Prisma");
    expect(apiFile?.whyImportant).toContain("repo-service.ts");
    expect(apiFile?.evidence).toEqual(
      expect.arrayContaining([
        "연결 로직: lib/repo-service.ts",
        "연결 후 연동: Prisma, OpenAI",
      ])
    );

    expect(dbFile?.role).toBe("Prisma 연결 파일");
    expect(dbFile?.whyImportant).toContain("Prisma");
    expect(logicFile?.role).toBe("화면 연결 로직 파일");
    expect(logicFile?.whyImportant).toContain("app/page.tsx");
    expect(pageFile?.readOrder).toBe(1);
    expect(logicFile?.readOrder).toBeLessThan(apiFile?.readOrder ?? Number.POSITIVE_INFINITY);
    expect(firstGuide?.intent).toBe("화면 문구 수정");
    expect(firstGuide?.files[0]).toBe("app/page.tsx");
    expect(firstGuide?.reason).toContain("대표 화면 흐름의 시작점");
    expect(firstGuide?.evidence[0]).toBe("대표 흐름 우선 파일: app/page.tsx");
    expect(apiGuide?.files[0]).toBe("app/api/analyze/route.ts");
    expect(apiGuide?.reason).toContain("대표 요청 흐름과 직접 연결");

    expect(analysis.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "representative_api_calls",
          value: "/api/analyze",
        }),
        expect.objectContaining({
          id: "data_clients",
          value: "Prisma",
        }),
        expect.objectContaining({
          id: "external_services",
          value: "OpenAI",
        }),
        expect.objectContaining({
          id: "representative_import_links",
          value: expect.stringContaining("app/page.tsx -> hooks/useDiagram.ts"),
        }),
      ])
    );

    expect(analysis.inferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "primary_flow",
          conclusion: "app/page.tsx -> /api/analyze -> analyze/route.ts",
        }),
        expect.objectContaining({
          id: "integration_surface",
          conclusion: "데이터 연결: Prisma / 외부 연동: OpenAI",
        }),
        expect.objectContaining({
          id: "ui_logic_flow",
          conclusion: "app/page.tsx -> hooks/useDiagram.ts",
        }),
        expect.objectContaining({
          id: "api_logic_flow",
          conclusion: "analyze/route.ts -> lib/repo-service.ts",
        }),
        expect.objectContaining({
          id: "api_logic_integration_flow",
          conclusion: "analyze/route.ts -> lib/repo-service.ts -> Prisma, OpenAI",
        }),
      ])
    );
    expect(analysis.summary.keyFeatures).toEqual(
      expect.arrayContaining(["Prisma 연결 확인", "OpenAI 연동 확인", "서버 요청 처리"])
    );
    expect(analysis.summary.keyFeatures).not.toContain("대표 API 흐름 감지");
    expect(analysis.summary.keyFeatures).not.toContain("데이터 저장/조회");
    expect(analysis.summary.keyFeatures).not.toContain("외부 서비스 연동");
    expect(analysis.summary.keyFeatures).not.toEqual(
      expect.arrayContaining(["화면-로직 연결 확인", "API 내부 로직 연결 확인"])
    );
  });

  it("prefers product-facing external signals over observability-only names in one-liner addons", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-external-priority",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-external-priority",
        description: "A scheduling dashboard web app.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
      ],
      packageJsonText: JSON.stringify({
        name: "semantic-external-priority",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          stripe: "^17.0.0",
          "@sentry/nextjs": "^9.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# External Priority\n\nScheduling dashboard.",
      selectedFileContents: {
        "app/page.tsx": `
          import * as Sentry from "@sentry/nextjs";
          import Stripe from "stripe";

          const stripe = new Stripe("sk_test", { apiVersion: "2025-03-31.basil" });

          export default function Page() {
            Sentry.captureMessage("page-opened");
            return <div>{Boolean(stripe)}</div>;
          }
        `,
      },
      representativePaths: ["app/page.tsx"],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.oneLiner).toContain("Stripe");
    expect(analysis.summary.oneLiner).not.toContain("Sentry");
    expect(analysis.summary.oneLiner).toContain("Stripe 연동");
    expect(analysis.summary.keyFeatures).toContain("Stripe 연동 확인");
    expect(analysis.summary.keyFeatures).not.toContain("Sentry 연동 확인");
  });

  it("drops observability-only names from one-liner addons when stronger DB signals exist", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-db-over-observability",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-db-over-observability",
        description: "A workflow service.",
      },
      allPaths: ["README.md", "package.json", "lib/service.ts"],
      packageJsonText: JSON.stringify({
        name: "semantic-db-over-observability",
        dependencies: {
          "@sentry/node": "^9.0.0",
          typeorm: "^0.3.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# DB over Observability\n\nWorkflow service.",
      selectedFileContents: {
        "lib/service.ts": `
          import * as Sentry from "@sentry/node";
          import { DataSource } from "typeorm";

          const db = new DataSource({ type: "sqlite", database: ":memory:" });

          export async function run() {
            Sentry.captureMessage("started");
            return db.initialize();
          }
        `,
      },
      representativePaths: ["lib/service.ts"],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.oneLiner).toContain("TypeORM");
    expect(analysis.summary.oneLiner).not.toContain("Sentry");
    expect(analysis.summary.oneLiner).toContain("TypeORM 연결");
    expect(analysis.summary.keyFeatures).toContain("TypeORM 연결 확인");
    expect(analysis.summary.keyFeatures).not.toContain("Sentry 연동 확인");
  });

  it("promotes only flow-linked integrations to top-level key features when side integrations exist", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-flow-linked-surface",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-flow-linked-surface",
        description: "A repo search web app.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/api/search/route.ts",
        "lib/search-service.ts",
        "db/client.ts",
        "integrations/openai.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "semantic-flow-linked-surface",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          openai: "^4.0.0",
          "@prisma/client": "^5.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Semantic Flow Linked Surface\n\nSearch repos with a web app.",
      selectedFileContents: {
        "app/page.tsx": `
          export default function Page() {
            async function onSearch() {
              const response = await fetch("/api/search", { method: "POST" });
              return response.json();
            }
            return <button onClick={onSearch}>Search</button>;
          }
        `,
        "app/api/search/route.ts": `
          import { searchRepos } from "@/lib/search-service";

          export async function POST() {
            return Response.json(await searchRepos());
          }
        `,
        "lib/search-service.ts": `
          import { prisma } from "@/db/client";

          export async function searchRepos() {
            return prisma.repo.findMany();
          }
        `,
        "db/client.ts": `
          import { PrismaClient } from "@prisma/client";
          export const prisma = new PrismaClient();
        `,
        "integrations/openai.ts": `
          import OpenAI from "openai";

          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          export async function explainSearch() {
            return client.responses.create({ model: "gpt-5.4-mini", input: "explain" });
          }
        `,
      },
      representativePaths: [
        "app/page.tsx",
        "app/api/search/route.ts",
        "lib/search-service.ts",
        "db/client.ts",
        "integrations/openai.ts",
      ],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.oneLiner).toContain("Prisma 연결");
    expect(analysis.summary.oneLiner).not.toContain("OpenAI 연동");
    expect(analysis.summary.keyFeatures).toContain("Prisma 연결 확인");
    expect(analysis.summary.keyFeatures).not.toContain("OpenAI 연동 확인");
    expect(analysis.facts.find((fact) => fact.id === "external_services")?.value).toContain("OpenAI");
  });

  it("does not promote borderline external integrations without a representative request flow", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "fixture-owner",
        name: "semantic-conditional-external-no-flow",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/semantic-conditional-external-no-flow",
        description: "A utility package for notifications and repository sync.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/notify.ts", "src/github.ts"],
      packageJsonText: JSON.stringify({
        name: "semantic-conditional-external-no-flow",
        dependencies: {
          "@slack/web-api": "^7.0.0",
          octokit: "^4.0.0",
          resend: "^4.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
        },
      }),
      readmeText: "# Conditional External\n\nNotification helpers for repository sync.",
      selectedFileContents: {
        "src/index.ts": `
          export * from "./notify";
          export * from "./github";
        `,
        "src/notify.ts": `
          import { WebClient } from "@slack/web-api";
          import { Resend } from "resend";

          const slack = new WebClient(process.env.SLACK_TOKEN);
          const resend = new Resend(process.env.RESEND_API_KEY);

          export async function notify() {
            await slack.chat.postMessage({ channel: "ops", text: "ok" });
            return resend.emails.send({ from: "hello@example.com", to: "ops@example.com", subject: "ok" });
          }
        `,
        "src/github.ts": `
          import { Octokit } from "octokit";

          const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

          export async function syncRepo() {
            return octokit.rest.repos.get({ owner: "openai", repo: "openai-node" });
          }
        `,
      },
      representativePaths: ["src/index.ts", "src/notify.ts", "src/github.ts"],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.facts.find((fact) => fact.id === "external_services")?.value).toContain("GitHub");
    expect(analysis.facts.find((fact) => fact.id === "external_services")?.value).toContain("Slack");
    expect(analysis.facts.find((fact) => fact.id === "external_services")?.value).toContain("Resend");
    expect(analysis.summary.oneLiner).not.toContain("GitHub 연동");
    expect(analysis.summary.oneLiner).not.toContain("Slack 연동");
    expect(analysis.summary.oneLiner).not.toContain("Resend 연동");
    expect(analysis.summary.keyFeatures).not.toContain("GitHub 연동 확인");
    expect(analysis.summary.keyFeatures).not.toContain("Slack 연동 확인");
    expect(analysis.summary.keyFeatures).not.toContain("Resend 연동 확인");
  });

  it("suppresses self-branded database promotion for library repositories", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "supabase",
        name: "supabase-js",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/supabase/supabase-js",
        description: "JavaScript SDK for Supabase.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/browser.ts"],
      packageJsonText: JSON.stringify({
        name: "@supabase/supabase-js",
        description: "JavaScript SDK for Supabase.",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        dependencies: {
          "@supabase/supabase-js": "^2.0.0",
        },
      }),
      readmeText: "# Supabase JS\n\nJavaScript SDK for Supabase projects.",
      selectedFileContents: {
        "src/index.ts": `export { createClient } from "./browser";`,
        "src/browser.ts": `
          import { createClient } from "@supabase/supabase-js";

          export const client = createClient("https://example.supabase.co", "public-anon-key");
        `,
      },
      representativePaths: ["src/index.ts", "src/browser.ts"],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.summary.keyFeatures).not.toContain("Supabase 연결 확인");
    expect(analysis.summary.keyFeatures).not.toContain("데이터 저장/조회");
    expect(analysis.summary.keyFeatures).not.toContain("외부 서비스 연동");
    expect(analysis.summary.oneLiner ?? "").not.toContain("Supabase 연결");
    expect(analysis.facts.find((fact) => fact.id === "data_clients")?.value).toContain("Supabase");
  });

  it("suppresses self-branded external promotion for SDK repositories", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "clerk",
        name: "javascript",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/clerk/javascript",
        description: "Authentication SDK for JavaScript applications.",
      },
      allPaths: ["README.md", "package.json", "src/index.ts", "src/client.ts"],
      packageJsonText: JSON.stringify({
        name: "@clerk/javascript",
        description: "Authentication SDK for JavaScript applications.",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        dependencies: {
          "@clerk/nextjs": "^1.0.0",
        },
      }),
      readmeText: "# Clerk JavaScript\n\nAuthentication SDK for JavaScript applications.",
      selectedFileContents: {
        "src/index.ts": `export * from "./client";`,
        "src/client.ts": `
          import { auth } from "@clerk/nextjs/server";

          export function currentUserId() {
            return auth().userId;
          }
        `,
      },
      representativePaths: ["src/index.ts", "src/client.ts"],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.summary.keyFeatures).not.toContain("Clerk 연동 확인");
    expect(analysis.summary.keyFeatures).not.toContain("외부 서비스 연동");
    expect(analysis.summary.oneLiner ?? "").not.toContain("Clerk 연동");
    expect(analysis.facts.find((fact) => fact.id === "external_services")?.value).toContain("Clerk");
  });

  it("suppresses generic external promotion for component-library repositories", () => {
    const snapshot: RepositorySnapshot = {
      repo: {
        owner: "tailwindlabs",
        name: "tailwindcss",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/tailwindlabs/tailwindcss",
        description: "A utility-first CSS framework package.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "packages/tailwindcss/package.json",
        "packages/tailwindcss/src/index.ts",
        "packages/tailwindcss/src/utils/escape.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "tailwindcss-workspace",
        workspaces: ["packages/*"],
      }),
      readmeText: "# Tailwind CSS\n\nA utility-first CSS framework package.",
      selectedFileContents: {
        "packages/tailwindcss/package.json": JSON.stringify({
          name: "tailwindcss",
          description: "A utility-first CSS framework package.",
          dependencies: {
            "@parcel/watcher": "^2.0.0",
          },
        }),
        "packages/tailwindcss/src/index.ts": `export { compile } from "./compile";`,
        "packages/tailwindcss/src/utils/escape.ts": `export function escape(value: string) { return value; }`,
      },
      representativePaths: [
        "packages/tailwindcss/package.json",
        "packages/tailwindcss/src/index.ts",
        "packages/tailwindcss/src/utils/escape.ts",
      ],
      truncated: false,
    };

    const analysis = analyzeRepositorySnapshot(snapshot);

    expect(analysis.summary.projectType).toBe("라이브러리 또는 SDK");
    expect(analysis.summary.keyFeatures).toContain("라이브러리 진입점");
    expect(analysis.summary.keyFeatures).not.toContain("외부 서비스 연동");
  });
});
