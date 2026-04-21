import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot, type RepositorySnapshot } from "@/lib/analysis/analyzer";

function analyze(snapshot: RepositorySnapshot) {
  return analyzeRepositorySnapshot(snapshot).learning.environment;
}

describe("environment requirements detection", () => {
  it("detects a CPU-only local web app", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "cpu-only-web",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/cpu-only-web",
        description: "Local dashboard app.",
      },
      allPaths: ["README.md", "package.json", "app/page.tsx", "server/index.ts"],
      packageJsonText: JSON.stringify({
        name: "cpu-only-web",
        scripts: { dev: "next dev" },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
      }),
      readmeText: `# CPU Only Web\n\nRun locally with \`pnpm dev\` and open http://localhost:3000.\n`,
      selectedFileContents: {
        "server/index.ts": `app.listen(3000);`,
      },
      truncated: false,
    });

    expect(env.runtimeMode).toBe("local-only");
    expect(env.hardware.gpuRequired).toBe(false);
    expect(env.hardware.acceleratorPreference).toBeNull();
    expect(env.costEstimate?.tier).toBe("free");
  });

  it("detects an LLM app with API cost signals", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "llm-app",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/llm-app",
        description: "OpenAI powered app.",
      },
      allPaths: ["README.md", "package.json", ".env.example", "vercel.json", "app/api/chat/route.ts"],
      packageJsonText: JSON.stringify({
        name: "llm-app",
        homepage: "https://llm-app.vercel.app",
        dependencies: {
          next: "16.2.4",
          openai: "^4.0.0",
          ioredis: "^5.0.0",
        },
      }),
      readmeText: `# LLM App\n\nDeploy on Vercel.\n`,
      selectedFileContents: {
        ".env.example": `OPENAI_API_KEY=\nREDIS_URL=\n`,
        "vercel.json": `{"version":2}`,
        "app/api/chat/route.ts": `import OpenAI from "openai"; const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });`,
      },
      truncated: false,
    });

    expect(env.cloud.servicesRequiredDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "OpenAI", canonicalId: "openai", kind: "ai" }),
        expect.objectContaining({ label: "Redis", canonicalId: "redis", kind: "database" }),
      ])
    );
    expect(env.cloud.apiServicesRequired).toContain("OpenAI");
    expect(env.cloud.deployTargets).toContain("Vercel");
    expect(env.costEstimate?.tier).toBe("under_50");
    expect(env.costEstimate?.drivers).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "llm" })])
    );
  });

  it("detects GPU training requirements with VRAM and CUDA preference", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "gpu-trainer",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/gpu-trainer",
        description: "GPU training pipeline.",
      },
      allPaths: ["README.md", "pyproject.toml", "requirements.txt", "train.py"],
      readmeText: `# GPU Trainer\n\n- Requires CUDA 12 compatible GPU.\n- 24GB VRAM recommended for llama-8b fine-tuning.\n`,
      selectedFileContents: {
        "pyproject.toml": `[project]\nrequires-python = ">=3.11"\n`,
        "requirements.txt": `torch\nbitsandbytes\ntransformers\n`,
        "train.py": `model = AutoModel.from_pretrained("llama-8b", device_map="auto")\n`,
      },
      truncated: false,
    });

    expect(env.hardware.gpuRequired).toBe(true);
    expect(env.hardware.minVramGb).toBe(24);
    expect(env.hardware.cpuArch).toBe("x64");
    expect(env.hardware.acceleratorPreference).toBe("cuda");
    expect(env.costEstimate?.tier).toBe("under_200");
  });

  it("detects cloud-required AWS production infrastructure", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "aws-prod",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/aws-prod",
        description: "AWS production stack.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "terraform/aws/main.tf",
        "charts/app/values.yaml",
        ".github/workflows/deploy.yml",
        "serverless.yml",
        "src/handler.ts",
      ],
      packageJsonText: JSON.stringify({
        name: "aws-prod",
        dependencies: {
          "@aws-sdk/client-dynamodb": "^3.0.0",
        },
      }),
      readmeText: `# AWS Prod\n\nDeploy with Terraform and Helm.\n`,
      selectedFileContents: {
        "serverless.yml": `service: aws-prod\nprovider: aws\nfunctions:\n  api:\n    handler: src/handler.main\n`,
        ".github/workflows/deploy.yml": `uses: aws-actions/configure-aws-credentials@v4\n`,
        "src/handler.ts": `import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; export const main = async () => new DynamoDBClient({});`,
      },
      truncated: false,
    });

    expect(env.cloud.deployTargets).toEqual(
      expect.arrayContaining(["AWS", "Self-host"])
    );
    expect(env.cloud.deployTargetRequired).toBe("AWS");
    expect(env.runtimeMode).toBe("cloud-required");
    expect(env.costEstimate?.tier).toBe("prod");
  });

  it("detects a free-tier Vercel app without external services", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "vercel-free",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/vercel-free",
        description: "Static marketing site.",
      },
      allPaths: ["README.md", "package.json", "vercel.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "vercel-free",
        homepage: "https://vercel-free.vercel.app",
        dependencies: {
          next: "16.2.4",
        },
      }),
      readmeText: `# Vercel Free\n\nDeploy on Vercel.\n`,
      selectedFileContents: {
        "vercel.json": `{"cleanUrls":true}`,
      },
      truncated: false,
    });

    expect(env.cloud.deployTargets).toContain("Vercel");
    expect(env.cloud.deployTargetRequired).toBeNull();
    expect(env.cloud.apiServicesRequired).toEqual([]);
    expect(env.runtimeMode).toBe("local-or-cloud");
    expect(env.costEstimate?.tier).toBe("free");
  });

  it("adds vector db and object storage signals into service and cost summaries", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "rag-app",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/rag-app",
        description: "RAG app with vector search and object storage.",
      },
      allPaths: ["README.md", "package.json", ".env.example", "app/api/chat/route.ts"],
      packageJsonText: JSON.stringify({
        name: "rag-app",
        dependencies: {
          openai: "^4.0.0",
          "@pinecone-database/pinecone": "^3.0.0",
          "@aws-sdk/client-s3": "^3.0.0",
        },
      }),
      readmeText: `# RAG App\n\nUses Pinecone for retrieval and Amazon S3 for document storage.\n`,
      selectedFileContents: {
        ".env.example": `OPENAI_API_KEY=\nPINECONE_API_KEY=\nS3_BUCKET=\nAWS_REGION=ap-northeast-2\n`,
        "app/api/chat/route.ts": `import OpenAI from "openai"; export async function POST() { return new Response("ok"); }`,
      },
      truncated: false,
    });

    expect(env.cloud.servicesRequired).toEqual(
      expect.arrayContaining(["OpenAI", "Pinecone", "Amazon S3"])
    );
    expect(env.cloud.apiServicesRequired).toEqual(
      expect.arrayContaining(["OpenAI", "Pinecone", "Amazon S3"])
    );
    expect(env.costEstimate?.tier).toBe("under_200");
    expect(env.costEstimate?.drivers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "llm" }),
        expect.objectContaining({ kind: "saas", note: expect.stringContaining("벡터 DB") }),
        expect.objectContaining({ kind: "storage", note: expect.stringContaining("오브젝트 스토리지") }),
      ])
    );
  });

  it("detects a free-tier Vercel and Supabase app without hardware requirements", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "vercel-supabase-free",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/vercel-supabase-free",
        description: "Free-tier Vercel + Supabase app.",
      },
      allPaths: ["README.md", "package.json", "vercel.json", ".env.example", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "vercel-supabase-free",
        dependencies: {
          next: "16.2.4",
          "@supabase/supabase-js": "^2.0.0",
        },
      }),
      readmeText: `# Free Vercel Supabase\n\nDeploy on Vercel and connect Supabase.\n`,
      selectedFileContents: {
        "vercel.json": `{"version":2}`,
        ".env.example": `NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\n`,
      },
      truncated: false,
    });

    expect(env.cloud.deployTargets).toContain("Vercel");
    expect(env.cloud.deployTargetRequired).toBeNull();
    expect(env.cloud.servicesRequiredDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Supabase", canonicalId: "supabase" })])
    );
    expect(env.costEstimate?.tier).toBe("free");
    expect(env.hardware.gpuRequired).toBe(false);
    expect(env.hardware.minVramGb).toBeNull();
    expect(env.hardware.minRamGb).toBeNull();
    expect(env.hardware.recommendedRamGb).toBeNull();
  });

  it("labels dev-only docker setup as optional-dev instead of generic recommended", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "docker-dev-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/docker-dev-only",
        description: "A local app with dev docker helpers.",
      },
      allPaths: ["README.md", "package.json", "docker-compose.dev.yml", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "docker-dev-only",
        dependencies: {
          next: "16.2.4",
        },
      }),
      readmeText: "# Docker Dev Only\n\nRun locally with `pnpm dev`.\n",
      selectedFileContents: {
        "docker-compose.dev.yml": `services:\n  web:\n    image: node:20-alpine\n`,
      },
      truncated: false,
    });

    expect(env.container.hasDockerCompose).toBe(true);
    expect(env.container.dockerRole).toBe("optional-dev");
  });

  it("labels deploy-only docker setup as optional-deploy instead of generic recommended", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "docker-deploy-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/docker-deploy-only",
        description: "A deployed app with production docker assets.",
      },
      allPaths: ["README.md", "package.json", "Dockerfile.prod", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "docker-deploy-only",
        dependencies: {
          next: "16.2.4",
        },
      }),
      readmeText: "# Docker Deploy Only\n\nUse this Docker image for production deployment.\n",
      selectedFileContents: {
        "Dockerfile.prod": `FROM node:20-alpine\nEXPOSE 3000\n`,
      },
      truncated: false,
    });

    expect(env.container.hasDockerfile).toBe(true);
    expect(env.container.dockerRole).toBe("optional-deploy");
  });

  it("prefers focus workspace service signals over unrelated root monorepo dependencies", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "monorepo-focus-service-scope",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/monorepo-focus-service-scope",
        description: "Monorepo with a focused web app and unrelated root AI tooling.",
      },
      allPaths: [
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        ".env.example",
        "apps/web/package.json",
        "apps/web/app/page.tsx",
        "apps/web/lib/db.ts",
        "packages/agents/package.json",
      ],
      packageJsonText: JSON.stringify({
        name: "monorepo-focus-service-scope",
        private: true,
        workspaces: ["apps/*", "packages/*"],
        dependencies: {
          openai: "^4.0.0",
          turbo: "^2.0.0",
        },
      }),
      readmeText: `# Monorepo Focus Service Scope\n\nThe web app uses PostgreSQL. AI tooling lives in a separate package.\n`,
      selectedFileContents: {
        ".env.example": `DATABASE_URL=\nOPENAI_API_KEY=\n`,
        "apps/web/package.json": JSON.stringify({
          name: "@fixture/web",
          dependencies: {
            next: "16.2.4",
            react: "19.2.4",
            "react-dom": "19.2.4",
            pg: "^8.0.0",
          },
        }),
        "apps/web/app/page.tsx": `export default function Page() { return <div>web</div>; }`,
        "apps/web/lib/db.ts": `export const dbUrl = process.env.DATABASE_URL ?? "";`,
        "packages/agents/package.json": JSON.stringify({
          name: "@fixture/agents",
          dependencies: {
            openai: "^4.0.0",
          },
        }),
      },
      truncated: false,
    });

    expect(env.cloud.servicesRequired).toEqual(expect.arrayContaining(["PostgreSQL"]));
    expect(env.cloud.servicesRequired).not.toContain("OpenAI");
    expect(env.cloud.servicesOptional).toContain("OpenAI");
  });

  it("does not force Vercel as a required deploy target for app-hosted repos", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "vercel-hosted-app",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/vercel-hosted-app",
        description: "Next.js app deployed on Vercel.",
      },
      allPaths: ["README.md", "package.json", "vercel.json", "app/page.tsx"],
      packageJsonText: JSON.stringify({
        name: "vercel-hosted-app",
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
          "@vercel/blob": "^0.27.0",
        },
      }),
      readmeText: `# Vercel Hosted App\n\nDeploy on Vercel.\n`,
      selectedFileContents: {
        "vercel.json": `{"version":2}`,
        "app/page.tsx": `import { put } from "@vercel/blob"; export default function Page() { return <div>{Boolean(put)}</div>; }`,
      },
      truncated: false,
    });

    expect(env.cloud.deployTargets).toContain("Vercel");
    expect(env.cloud.deployTargetRequired).toBeNull();
    expect(env.runtimeMode).toBe("local-or-cloud");
  });

  it("treats CLI-only repositories as local-only runtime mode", () => {
    const env = analyze({
      repo: {
        owner: "fixture-owner",
        name: "cli-only",
        branch: "main",
        sha: "fixture-sha",
        url: "https://github.com/fixture-owner/cli-only",
        description: "Small local CLI tool.",
      },
      allPaths: ["README.md", "package.json", "bin/cli.js"],
      packageJsonText: JSON.stringify({
        name: "cli-only",
        bin: {
          cli: "./bin/cli.js",
        },
        dependencies: {
          commander: "^12.0.0",
        },
      }),
      readmeText: `# CLI Only\n\nRun with \`node ./bin/cli.js\`.\n`,
      selectedFileContents: {
        "bin/cli.js": `console.log("ok");`,
      },
      truncated: false,
    });

    expect(env.runtimeMode).toBe("local-only");
  });
});
