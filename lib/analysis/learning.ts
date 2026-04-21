import { parsePackageJson, type PackageJsonShape } from "@/lib/analysis/heuristics";
import type { SemanticSignals } from "@/lib/analysis/semantics";
import type {
  AnalysisMode,
  CloudService,
  KeyFileInfo,
  RepoEnvRuntime,
  RepoEnvironmentGuide,
  RepoAnalysis,
  RepoIdentityGuide,
  RepoLearningGuide,
  RepoPreviewImage,
  RepoReadmeGuide,
  RepoReadmeLink,
  RepoStackGlossaryItem,
} from "@/lib/analysis/types";

type ReadmeSection = {
  heading: string;
  body: string;
};

type ReadmeLink = {
  label: string;
  url: string;
  heading: string;
};

type ScopedReadme = {
  path: string;
  text: string;
  scope: "focus" | "root";
};

type ReadmeSectionKind =
  | "intro"
  | "features"
  | "audience"
  | "quickstart"
  | "architecture"
  | "docs"
  | "misc";

const STACK_GLOSSARY: Record<
  string,
  { kind: RepoStackGlossaryItem["kind"]; description: string }
> = {
  "Next.js": {
    kind: "framework",
    description: "화면과 서버 요청을 한 프로젝트 안에서 같이 만들기 쉬운 웹 프레임워크입니다.",
  },
  React: {
    kind: "framework",
    description: "화면을 컴포넌트 단위로 나눠 만드는 UI 라이브러리입니다.",
  },
  TypeScript: {
    kind: "language",
    description: "자바스크립트에 타입 정보를 더해 코드 구조를 더 안전하게 읽게 해주는 언어입니다.",
  },
  JavaScript: {
    kind: "language",
    description: "웹과 Node.js에서 가장 널리 쓰이는 기본 프로그래밍 언어입니다.",
  },
  Python: {
    kind: "language",
    description: "자동화, 데이터 처리, 백엔드 작업에 자주 쓰이는 읽기 쉬운 언어입니다.",
  },
  "Tailwind CSS": {
    kind: "styling",
    description: "작은 스타일 클래스를 조합해서 화면 모양을 빠르게 만드는 CSS 도구입니다.",
  },
  Prisma: {
    kind: "database",
    description: "데이터베이스를 코드와 스키마 파일로 다루기 쉽게 해주는 ORM 도구입니다.",
  },
  Supabase: {
    kind: "database",
    description: "DB와 인증, 스토리지 같은 백엔드 기능을 한 번에 제공하는 서비스입니다.",
  },
  Firebase: {
    kind: "database",
    description: "실시간 데이터, 인증, 배포 같은 앱 백엔드 기능을 제공하는 플랫폼입니다.",
  },
  "Node.js": {
    kind: "runtime",
    description: "자바스크립트나 타입스크립트를 서버와 CLI에서도 실행하게 해주는 런타임입니다.",
  },
  Vite: {
    kind: "tool",
    description: "프론트엔드 개발 서버와 번들링을 빠르게 돌려주는 빌드 도구입니다.",
  },
  Vue: {
    kind: "framework",
    description: "컴포넌트 기반으로 화면을 만드는 프론트엔드 프레임워크입니다.",
  },
  Svelte: {
    kind: "framework",
    description: "빌드 시점에 화면 코드를 최적화해 가볍게 동작하게 만드는 프레임워크입니다.",
  },
  Astro: {
    kind: "framework",
    description: "정적 콘텐츠와 여러 UI 프레임워크를 함께 다루기 쉬운 웹 프레임워크입니다.",
  },
  Express: {
    kind: "tool",
    description: "Node.js에서 HTTP API 서버를 빠르게 만드는 대표적인 서버 프레임워크입니다.",
  },
  Fastify: {
    kind: "tool",
    description: "Node.js에서 빠른 성능을 목표로 API 서버를 만드는 프레임워크입니다.",
  },
  Hono: {
    kind: "tool",
    description: "엣지 환경과 서버 런타임에서 가볍게 API를 만드는 웹 프레임워크입니다.",
  },
  Drizzle: {
    kind: "database",
    description: "SQL 기반 데이터베이스를 타입 안전하게 다루기 위한 ORM 도구입니다.",
  },
  Mongoose: {
    kind: "database",
    description: "MongoDB 모델과 스키마를 코드로 관리하기 쉽게 해주는 ODM 도구입니다.",
  },
  Zustand: {
    kind: "tool",
    description: "React에서 화면 상태를 단순하게 저장하고 공유하기 위한 상태 관리 도구입니다.",
  },
  Redux: {
    kind: "tool",
    description: "여러 화면에서 쓰는 상태를 한 곳에서 예측 가능하게 관리하는 도구입니다.",
  },
  Zod: {
    kind: "tool",
    description: "입력 데이터 형태를 검사하고 타입과 연결하기 쉽게 해주는 검증 라이브러리입니다.",
  },
  tRPC: {
    kind: "tool",
    description: "프론트와 백엔드 사이의 API 타입을 직접 공유하게 해주는 RPC 도구입니다.",
  },
  OpenAI: {
    kind: "tool",
    description: "텍스트 생성, 요약, 분석 같은 AI 기능을 앱에 연결할 때 쓰는 SDK입니다.",
  },
  Stripe: {
    kind: "tool",
    description: "결제와 구독 처리를 앱에 연결할 때 많이 쓰는 결제 플랫폼 SDK입니다.",
  },
};

const GENERIC_REPO_IDENTITY_TOKENS = new Set([
  "app",
  "apps",
  "api",
  "client",
  "server",
  "web",
  "www",
  "site",
  "demo",
  "preview",
  "live",
  "docs",
  "doc",
  "guide",
  "guides",
  "tutorial",
  "tutorials",
  "example",
  "examples",
  "starter",
  "quickstart",
  "boilerplate",
  "template",
  "repo",
  "project",
  "platform",
  "tool",
  "tools",
  "sdk",
  "library",
  "lib",
  "core",
  "ui",
  "node",
  "next",
  "react",
  "vue",
  "svelte",
  "js",
  "ts",
  "cli",
  "kit",
]);

const PREVIEW_LABEL_PATTERN =
  /\b(live demo|live site|preview|demo|try it|try demo|project site|official site|website|visit site|visit app|open app|launch app|view app|showcase)\b/i;
const AUXILIARY_PREVIEW_LABEL_PATTERN = /\b(site|website|app)\b/i;
const PREVIEW_HEADING_PATTERN = /\b(demo|preview|showcase|screenshots?|gallery|website|live|app)\b/i;
const NEGATIVE_PREVIEW_LABEL_PATTERN =
  /\b(docs?|documentation|reference|guide|guides|tutorial|tutorials|blog|changelog|release notes?|learn|getting started|installation|install|setup|dashboard|console|settings|platform|create-next-app|font|security|policy|csp)\b/i;
const NEGATIVE_PREVIEW_HEADING_PATTERN =
  /\b(getting started|installation|install|setup|usage|development|contributing|requirements|prereq|environment|database|deploy(ment)?|hosting|auth|reference|docs?|guide|tutorial|resources?|links?|learn more|security|policy|csp)\b/i;
const README_QUICKSTART_HEADING_PATTERN =
  /\b(getting started|quick start|quickstart|installation|install|setup|usage|run|build|test|requirements?|environment)\b/i;
const README_FEATURE_HEADING_PATTERN =
  /\b(features?|highlights?|capabilities?|overview|why|what it does|what's included|benefits?)\b/i;
const README_AUDIENCE_HEADING_PATTERN =
  /\b(for who|who it's for|who is it for|use cases?|target audience|intended audience|who should use|best for)\b/i;
const README_ARCHITECTURE_HEADING_PATTERN =
  /\b(architecture|how it works|technical overview|system design|internals?|stack|deploy(?:ment)?|hosting|self-host(?:ing)?|infrastructure|database|data flow|services?|integrations?|platform)\b/i;
const README_DOCS_HEADING_PATTERN = /\b(docs?|documentation|guide|guides|reference|resources?|learn more)\b/i;
const README_ARCHITECTURE_SIGNAL_PATTERN =
  /\b(api|server|client|database|db|postgres|postgresql|mysql|sqlite|mongodb|mongo|redis|queue|worker|job|cron|auth|authentication|oauth|docker|deploy|deployment|vercel|railway|render|netlify|fly|gateway|prisma|supabase|firebase|openai|stripe|slack|sentry|cache|storage|webhook|background)\b/i;
const README_ARCHITECTURE_RELATION_PATTERN =
  /\b(uses?|is used(?:\s+for|\s+to)?|used in|powers?|runs?|stores?|persists?|writes?|reads?|calls?|sends?|fetches?|connects?(?:\s+to)?|talks?\s+to|integrates?(?:\s+with)?|backs?|serves?|handles?|manages?|executes?|routes?|separates?|deployed on|built on|backed by|via|through)\b/i;
const README_MARKETING_WORD_PATTERN =
  /\b(modern|powerful|lightweight|simple|easy to use|easy-to-use|production-ready|blazing fast|fully featured|feature-rich|robust|scalable)\b/gi;
const README_PROMOTIONAL_POINT_PATTERN =
  /\b(active community|enterprise-ready|enterprise ready|full control|hosted by us|get invited|cloud offering|fair-code license|report a bug|request a feature|get help|we(?:'re| are) hiring|hiring)\b/i;
const README_PROMOTIONAL_COUNT_PATTERN = /\b\d+\+\s+(integrations|templates)\b/i;
const README_INSTRUCTION_LINE_PATTERN =
  /^(clone|copy|install|run|start|check|create|navigate|open|set|export|add|use|launch|get)\b/i;
const README_WARNING_PATTERN = /(^|\s)\[!warning\]|use at your own risk|warning[:!]?/i;
const README_ADMONITION_PATTERN = /^\[![a-z]+\]/i;
const README_INTERNAL_PACKAGE_PATTERN = /\b(internal utility|not intended for public usage)\b/i;
const README_DOC_TUTORIAL_PATTERN =
  /\b(docs?|documentation|learn more|tutorial|guide|reference|changelog|release notes?|roadmap)\b/i;
const README_SETUP_DETAIL_PATTERN =
  /\b(api key|dashboard|sign up|select\b|click\b|create\b|configure\b|first,\s*run|run the development server|localhost|you can start editing the page|auto-updates as you edit the file|modifying app\/page\.tsx)\b/i;
const RUN_USAGE_PATTERN =
  /\b(pnpm|npm|yarn|bun|python|uv|cargo|go|docker(?:\s+compose|-compose)?)\s+(dev|start|serve|preview|run|up)\b/i;
const README_FRAMEWORK_BOILERPLATE_PATTERN =
  /\b(bootstrapped with create-next-app|created with create-next-app|generated by create-next-app|this is a next\.js project|this project was bootstrapped|this project uses next\/font to automatically optimize and load)\b/i;
const README_FRAMEWORK_ONLY_PATTERN =
  /^(built|powered)\s+with\s+(next\.js|react|vue|svelte|vite|tailwind css|typescript)\.?$/i;
const README_FILE_PATH_PATTERN =
  /(^|[\s(])[@a-z0-9_./-]+\.(?:tsx?|jsx?|py|go|rs|java|rb|php|sh|yaml|yml|json|mdx?)\b/i;
const README_GENERIC_NOISE_PATTERN =
  /\b(documentation|docs?|reference|configuration reference|learn more|check out|twitter\b|discord\b|api key|dashboard|license information|licensing|copyright)\b/i;

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dirname(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

function normalizePath(path: string) {
  const parts = path.split("/");
  const normalized: string[] = [];

  parts.forEach((part) => {
    if (!part || part === ".") {
      return;
    }

    if (part === "..") {
      normalized.pop();
      return;
    }

    normalized.push(part);
  });

  return normalized.join("/");
}

function hasDependency(pkg: PackageJsonShape | null | undefined, dep: string) {
  return Boolean(pkg?.dependencies?.[dep] || pkg?.devDependencies?.[dep]);
}

function hasDependencyAcrossPackages(
  rootPkg: PackageJsonShape | null | undefined,
  workspacePkg: PackageJsonShape | null | undefined,
  dep: string
) {
  return hasDependency(workspacePkg, dep) || hasDependency(rootPkg, dep);
}

function hasAnyDependencyAcrossPackages(
  rootPkg: PackageJsonShape | null | undefined,
  workspacePkg: PackageJsonShape | null | undefined,
  deps: string[]
) {
  return deps.some((dep) => hasDependencyAcrossPackages(rootPkg, workspacePkg, dep));
}

function detectPackageManager(paths: string[], pkg?: PackageJsonShape | null) {
  if (paths.includes("pnpm-lock.yaml") || paths.includes("pnpm-workspace.yaml")) return "pnpm";
  if (paths.includes("yarn.lock")) return "yarn";
  if (paths.includes("bun.lockb") || paths.includes("bun.lock")) return "bun";
  if (paths.includes("package-lock.json") || paths.includes("npm-shrinkwrap.json")) return "npm";
  if (paths.includes("requirements.txt")) return "pip";
  if (pkg) return "npm";
  return null;
}

function formatScriptCommand(manager: string | null, scriptName: string) {
  if (!manager) return null;
  if (manager === "pnpm") return `pnpm ${scriptName}`;
  if (manager === "yarn") return scriptName === "install" ? "yarn" : `yarn ${scriptName}`;
  if (manager === "bun") return scriptName === "install" ? "bun install" : `bun run ${scriptName}`;
  if (manager === "pip") return null;
  return scriptName === "install" ? "npm install" : `npm run ${scriptName}`;
}

function workspacePackageJsonText(selectedFileContents: Record<string, string> | undefined, focusRoot: string | null) {
  if (!focusRoot) return null;
  return selectedFileContents?.[`${focusRoot}/package.json`] ?? null;
}

function workspacePackageJson(
  selectedFileContents: Record<string, string> | undefined,
  focusRoot: string | null
) {
  const text = workspacePackageJsonText(selectedFileContents, focusRoot);
  return parsePackageJson(text);
}

function findScopedReadmes(args: {
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}) {
  const readmes: ScopedReadme[] = [];

  if (args.focusRoot) {
    const focusReadmePath = [`${args.focusRoot}/README.md`, `${args.focusRoot}/README.mdx`].find((path) =>
      typeof args.selectedFileContents?.[path] === "string"
    );
    if (focusReadmePath) {
      const text = args.selectedFileContents?.[focusReadmePath];
      if (typeof text === "string" && text.trim().length > 0) {
        readmes.push({
          path: focusReadmePath,
          text,
          scope: "focus",
        });
      }
    }
  }

  if (args.readmePath && args.readmeText && args.readmeText.trim().length > 0) {
    readmes.push({
      path: args.readmePath,
      text: args.readmeText,
      scope: "root",
    });
  }

  return readmes.filter(
    (readme, index, all) =>
      all.findIndex((candidate) => candidate.path === readme.path && candidate.scope === readme.scope) === index
  );
}

function canonicalCommand(command: string) {
  return command
    .replace(/^cd\s+[^&]+&&\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isScopedCommand(command: string) {
  return /(^cd\s+.+&&)|(\s(--filter|--workspace|--cwd|--dir|-C|--prefix)\s)|(\byarn\s+workspace\b)|(\bturbo\b)|(\bnx\b)|(\blerna\b)/i.test(
    command
  );
}

function usesWorkspaceRunner(scriptBody: string | null | undefined) {
  if (!scriptBody) return false;
  return /(\s(--filter|--workspace|--cwd|--dir|-C|--prefix)\s)|(\byarn\s+workspace\b)|(\bturbo\b)|(\bnx\b)|(\blerna\b)/i.test(
    scriptBody
  );
}

function preferredScriptCommand(args: {
  manager: string | null;
  scriptName: string;
  scriptBody: string | null | undefined;
  scopeRoot: string | null;
}) {
  if (args.scopeRoot) {
    const command = formatScriptCommand(args.manager, args.scriptName);
    return command ? scopeCommandToFocusRoot(command, args.scopeRoot) : null;
  }

  if (usesWorkspaceRunner(args.scriptBody)) {
    return args.scriptBody?.trim() ?? null;
  }

  return formatScriptCommand(args.manager, args.scriptName);
}

function scopeCommandToFocusRoot(command: string, focusRoot: string | null) {
  if (!focusRoot || isScopedCommand(command) || command.includes(focusRoot)) {
    return command;
  }

  return `cd ${focusRoot} && ${command}`;
}

function pushCommand(target: string[], command: string) {
  const normalized = command.trim();
  if (!normalized) return;

  const canonical = canonicalCommand(normalized);
  const existingIndex = target.findIndex((item) => canonicalCommand(item) === canonical);

  if (existingIndex === -1) {
    target.push(normalized);
    return;
  }

  if (isScopedCommand(normalized) && !isScopedCommand(target[existingIndex] ?? "")) {
    target[existingIndex] = normalized;
  }
}

type UsageCommandDetail = RepoLearningGuide["usage"]["details"][number];

function workspaceTargetFromCommand(command: string) {
  const filterMatch = command.match(/--filter\s+([^\s]+)/i);
  if (filterMatch?.[1]) return filterMatch[1];

  const workspaceMatch = command.match(/\byarn\s+workspace\s+([^\s]+)/i);
  if (workspaceMatch?.[1]) return workspaceMatch[1];

  const nxMatch = command.match(/\bnx\s+(?:run\s+)?(?:[^\s:]+:)?([^\s]+)/i);
  if (nxMatch?.[1]) return nxMatch[1];

  return null;
}

function explainUsageCommand(args: {
  command: string;
  kind: UsageCommandDetail["kind"];
  source: UsageCommandDetail["source"];
  scopeRoot: string | null;
  scriptBody?: string | null;
}) {
  const workspaceTarget = workspaceTargetFromCommand(args.scriptBody ?? args.command);
  const signal = `${args.scriptBody ?? ""}\n${args.command}`.toLowerCase();

  if (args.kind === "install") {
    return args.scopeRoot
      ? `${args.scopeRoot} 범위에서 필요한 의존성을 설치합니다.`
      : "프로젝트를 실행하기 전에 필요한 의존성을 설치합니다.";
  }

  if (args.kind === "run") {
    if (/\bdocker(?:\s+compose|-compose)\s+up\b/.test(signal)) {
      return "Docker Compose로 앱과 필요한 보조 서비스를 함께 실행합니다.";
    }
    if (/\bnext\s+dev\b/.test(signal)) {
      return args.scopeRoot
        ? `${args.scopeRoot} 범위의 Next.js 개발 서버를 실행합니다.`
        : "Next.js 개발 서버를 실행합니다.";
    }
    if (/\bvite\b.*\b(dev|preview)\b/.test(signal)) {
      return args.scopeRoot
        ? `${args.scopeRoot} 범위의 Vite 개발 서버를 실행합니다.`
        : "Vite 기반 프론트엔드 개발 서버를 실행합니다.";
    }
    if (/\buvicorn\b|\bgunicorn\b/.test(signal)) {
      return "Python 웹 서버를 실행합니다.";
    }
    if (/\bcargo\s+run\b/.test(signal)) {
      return "Rust 실행 파일을 로컬에서 실행합니다.";
    }
    if (/\bgo\s+run\b/.test(signal)) {
      return "Go 앱을 로컬에서 실행합니다.";
    }

    if (args.scopeRoot) {
      return `${args.scopeRoot} 범위의 개발 서버나 앱 실행 흐름을 시작합니다.`;
    }
    if (workspaceTarget) {
      return `${workspaceTarget} 워크스페이스를 루트 runner로 실행합니다.`;
    }
    return args.source === "readme"
      ? "README에 적힌 기본 실행 흐름입니다."
      : "프로젝트의 기본 실행 흐름입니다.";
  }

  if (args.kind === "build") {
    if (/\bdocker(?:\s+compose|-compose)\s+build\b/.test(signal)) {
      return "Docker 이미지를 빌드해 컨테이너 실행 준비를 합니다.";
    }
    if (/\bnext\s+build\b/.test(signal)) {
      return "Next.js 배포 결과물을 빌드합니다.";
    }

    if (args.scopeRoot) {
      return `${args.scopeRoot} 범위 결과물을 빌드합니다.`;
    }
    if (workspaceTarget) {
      return `${workspaceTarget} 워크스페이스 결과물을 루트 runner로 빌드합니다.`;
    }
    return "배포나 검증 전에 결과물을 빌드합니다.";
  }

  if (args.kind === "test") {
    if (/\b(playwright|cypress)\b/.test(signal)) {
      return "브라우저 기반 E2E 테스트를 실행합니다.";
    }
    if (/\b(vitest|jest|pytest)\b/.test(signal)) {
      return "프로젝트의 자동화 테스트를 실행합니다.";
    }

    if (args.scopeRoot) {
      return `${args.scopeRoot} 범위 테스트를 실행합니다.`;
    }
    if (workspaceTarget) {
      return `${workspaceTarget} 워크스페이스 테스트를 루트 runner로 실행합니다.`;
    }
    return "기본 테스트 명령입니다.";
  }

  return args.source === "readme"
    ? "README 예시 코드나 사용 예제입니다."
    : "코드 사용 예시나 참고 명령입니다.";
}

function pushUsageCommand(
  target: string[],
  details: UsageCommandDetail[],
  args: {
    kind: UsageCommandDetail["kind"];
    command: string;
    source: UsageCommandDetail["source"];
    scopeRoot: string | null;
    scriptBody?: string | null;
  }
) {
  pushCommand(target, args.command);

  const normalized = args.command.trim();
  if (!normalized) return;

  const canonical = canonicalCommand(normalized);
  const existingIndex = details.findIndex(
    (item) => item.kind === args.kind && canonicalCommand(item.command) === canonical
  );
  const detail: UsageCommandDetail = {
    kind: args.kind,
    command: normalized,
    source: args.source,
    scope: args.scopeRoot ? "focus" : "root",
    explanation: explainUsageCommand(args),
  };

  if (existingIndex === -1) {
    details.push(detail);
    return;
  }

  if (isScopedCommand(normalized) && !isScopedCommand(details[existingIndex]?.command ?? "")) {
    details[existingIndex] = detail;
  }
}

function inferInstallCommands(paths: string[], pkg?: PackageJsonShape | null) {
  const manager = detectPackageManager(paths, pkg);
  if (manager === "pip") {
    if (paths.includes("requirements.txt")) return ["pip install -r requirements.txt"];
    if (paths.includes("pyproject.toml")) return ["pip install -e ."];
  }
  const install = formatScriptCommand(manager, "install");
  return install ? [install] : [];
}

function splitReadmeSections(text: string | null | undefined): ReadmeSection[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const sections: ReadmeSection[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentHeading && currentLines.join("\n").trim().length === 0) {
      currentLines = [];
      return;
    }
    sections.push({ heading: currentHeading, body: currentLines.join("\n").trim() });
    currentLines = [];
  };

  lines.forEach((line) => {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      flush();
      currentHeading = match[1]!.trim().toLowerCase();
      return;
    }
    currentLines.push(line);
  });
  flush();

  return sections.filter((section) => section.heading || section.body);
}

function extractCodeBlocks(text: string) {
  const blocks: string[] = [];
  const pattern = /```[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]?.trim()) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function stripCodeBlocks(text: string) {
  return text.replace(/```[\s\S]*?```/g, " ");
}

function normalizeCommandLine(line: string) {
  return line.replace(/^[>$]\s*/, "").trim();
}

function extractCommandLines(block: string) {
  return block
    .split(/\r?\n/)
    .map((line) => normalizeCommandLine(line))
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("#") && !line.startsWith("//"));
}

function classifyReadmeCommand(line: string): "install" | "run" | "build" | "test" | "example" {
  const normalized = line.toLowerCase();

  if (/(^|\s)(pnpm|npm|yarn|bun|pip|uv)\s+(install|add|sync)\b/.test(normalized)) {
    return "install";
  }
  if (/\b(build|compile)\b/.test(normalized)) {
    return "build";
  }
  if (/\b(test|vitest|jest|pytest|playwright test|cypress run)\b/.test(normalized)) {
    return "test";
  }
  if (
    /\b(dev|start|serve|preview|next dev|vite|node\s+|python\s+|uv run|docker compose up|pnpm dev|npm run dev|yarn dev|bun run dev)\b/.test(
      normalized
    )
  ) {
    return "run";
  }
  return "example";
}

function buildUsageGuide(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}): RepoLearningGuide["usage"] {
  const focusPkg = workspacePackageJson(args.selectedFileContents, args.focusRoot);
  const manager = detectPackageManager(args.paths, focusPkg ?? args.pkg);
  const install: string[] = [];
  const run: string[] = [];
  const build: string[] = [];
  const test: string[] = [];
  const example: string[] = [];
  const details: UsageCommandDetail[] = [];
  let packageJsonUsed = install.length > 0;
  let readmeUsed = false;
  const focusScriptNames = new Set(Object.keys(focusPkg?.scripts ?? {}));

  inferInstallCommands(args.paths, focusPkg ?? args.pkg).forEach((command) => {
    pushUsageCommand(install, details, {
      kind: "install",
      command,
      source: "package_json",
      scopeRoot: null,
    });
  });
  packageJsonUsed = install.length > 0;

  const appendPackageScripts = (pkg: PackageJsonShape | null | undefined, scopeRoot: string | null) => {
    const scripts = pkg?.scripts ?? {};

    if (scripts.dev && (!focusScriptNames.has("dev") || scopeRoot)) {
      const command = preferredScriptCommand({
        manager,
        scriptName: "dev",
        scriptBody: scripts.dev,
        scopeRoot,
      });
      if (command) {
        pushUsageCommand(run, details, {
          kind: "run",
          command,
          source: "package_json",
          scopeRoot,
          scriptBody: scripts.dev,
        });
      }
      packageJsonUsed = true;
    }
    if (scripts.start && (!focusScriptNames.has("start") || scopeRoot)) {
      const command = preferredScriptCommand({
        manager,
        scriptName: "start",
        scriptBody: scripts.start,
        scopeRoot,
      });
      if (command) {
        pushUsageCommand(run, details, {
          kind: "run",
          command,
          source: "package_json",
          scopeRoot,
          scriptBody: scripts.start,
        });
      }
      packageJsonUsed = true;
    }
    if (scripts.build && (!focusScriptNames.has("build") || scopeRoot)) {
      const command = preferredScriptCommand({
        manager,
        scriptName: "build",
        scriptBody: scripts.build,
        scopeRoot,
      });
      if (command) {
        pushUsageCommand(build, details, {
          kind: "build",
          command,
          source: "package_json",
          scopeRoot,
          scriptBody: scripts.build,
        });
      }
      packageJsonUsed = true;
    }
    if (scripts.test && (!focusScriptNames.has("test") || scopeRoot)) {
      const command = preferredScriptCommand({
        manager,
        scriptName: "test",
        scriptBody: scripts.test,
        scopeRoot,
      });
      if (command) {
        pushUsageCommand(test, details, {
          kind: "test",
          command,
          source: "package_json",
          scopeRoot,
          scriptBody: scripts.test,
        });
      }
      packageJsonUsed = true;
    }
  };

  if (focusPkg && args.focusRoot) {
    appendPackageScripts(focusPkg, args.focusRoot);
  }
  appendPackageScripts(args.pkg, null);

  findScopedReadmes({
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  }).forEach((readme) => {
    splitReadmeSections(readme.text).forEach((section) => {
      const isRelevant =
        /(install|setup|get started|getting started|quick start|usage|develop|development|run|test|build|example)/i.test(
          section.heading
        ) ||
        section.heading === "";

      if (!isRelevant) {
        return;
      }

      extractCodeBlocks(section.body).forEach((block) => {
        const commands = extractCommandLines(block);
        if (commands.length === 0) {
          return;
        }

        readmeUsed = true;
        commands.forEach((command) => {
          const kind = classifyReadmeCommand(command);
          if (kind === "install") {
            pushUsageCommand(install, details, {
              kind,
              command,
              source: "readme",
              scopeRoot: readme.scope === "focus" ? args.focusRoot : null,
            });
          }
          if (kind === "run") {
            pushUsageCommand(run, details, {
              kind,
              command,
              source: "readme",
              scopeRoot: readme.scope === "focus" ? args.focusRoot : null,
            });
          }
          if (kind === "build") {
            pushUsageCommand(build, details, {
              kind,
              command,
              source: "readme",
              scopeRoot: readme.scope === "focus" ? args.focusRoot : null,
            });
          }
          if (kind === "test") {
            pushUsageCommand(test, details, {
              kind,
              command,
              source: "readme",
              scopeRoot: readme.scope === "focus" ? args.focusRoot : null,
            });
          }
          if (kind === "example") {
            pushUsageCommand(example, details, {
              kind,
              command,
              source: "readme",
              scopeRoot: readme.scope === "focus" ? args.focusRoot : null,
            });
          }
        });
      });
    });
  });

  const source = packageJsonUsed && readmeUsed ? "mixed" : packageJsonUsed ? "package_json" : readmeUsed ? "readme" : "none";

  return {
    install: install.slice(0, 3),
    run: run.slice(0, 4),
    build: build.slice(0, 3),
    test: test.slice(0, 3),
    example: example.slice(0, 4),
    source,
    details: details.slice(0, 12),
  };
}

function looksLikeImageUrl(url: string) {
  return /(\.png|\.jpe?g|\.gif|\.webp|\.avif|\.svg)(\?|#|$)/i.test(url) || /githubusercontent\.com\/.*\/assets\//i.test(url);
}

function isBadgeLike(args: { alt: string; url: string }) {
  const signal = `${args.alt} ${args.url}`.toLowerCase();
  return /(badge|shield|license|coverage|build|status|stars|forks|downloads|npm|version|logo|icon|avatar|sponsor|favicon|social|og-image|opengraph)/i.test(
    signal
  );
}

function previewImageKind(args: { alt: string; url: string }) {
  const signal = `${args.alt} ${args.url}`.toLowerCase();

  if (/(diagram|architecture|flow|erd|graph|sequence|mermaid)/i.test(signal)) {
    return "diagram" as const;
  }

  if (/(screen|screenshot|preview|demo|dashboard|result|landing|homepage|home page|ui|interface|app|page)/i.test(signal)) {
    return "ui" as const;
  }

  return "generic" as const;
}

function scorePreviewImage(args: { alt: string; url: string; scope: ScopedReadme["scope"] }) {
  const signal = `${args.alt} ${args.url}`.toLowerCase();
  const kind = previewImageKind(args);
  let score = 0;

  if (kind === "ui") score += 44;
  if (kind === "generic") score += 12;
  if (kind === "diagram") score -= 8;

  if (args.scope === "focus") score += 18;
  if (/\/(preview|screenshots?|demo|result|dashboard|app|landing|home)[^/]*\.(png|jpe?g|webp|avif|gif)$/i.test(args.url)) {
    score += 20;
  }
  if (/\/(docs|assets|images)\//i.test(args.url)) score -= 2;
  if (isBadgeLike(args)) score -= 80;
  if (/(logo|icon|avatar|badge|shield|sponsor|favicon|social|og-image|opengraph|banner)/i.test(signal)) score -= 48;
  if (/(workflow|pipeline|coverage|status)/i.test(signal)) score -= 32;

  return score;
}

type ScoredPreviewImage = RepoPreviewImage & {
  score: number;
};

function resolveReadmeUrl(args: {
  owner: string;
  repo: string;
  ref: string;
  readmePath: string;
  rawUrl: string;
}) {
  const raw = args.rawUrl.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  const relativePath = raw.startsWith("/")
    ? normalizePath(raw.slice(1))
    : normalizePath(`${dirname(args.readmePath)}/${raw}`);

  if (!relativePath) {
    return null;
  }

  return `https://raw.githubusercontent.com/${args.owner}/${args.repo}/${args.ref}/${relativePath}`;
}

function extractReadmeImages(args: {
  owner: string;
  repo: string;
  ref: string;
  readme: ScopedReadme;
}): ScoredPreviewImage[] {
  if (!args.readme.text || !args.readme.path) {
    return [];
  }

  const images: ScoredPreviewImage[] = [];
  const pushImage = (alt: string, rawUrl: string) => {
    const resolved = resolveReadmeUrl({
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
      readmePath: args.readme.path,
      rawUrl,
    });
    if (!resolved || !looksLikeImageUrl(resolved)) {
      return;
    }
    const score = scorePreviewImage({ alt, url: resolved, scope: args.readme.scope });
    if (score <= 0) {
      return;
    }

    const kind = previewImageKind({ alt, url: resolved });
    images.push({
      url: resolved,
      alt: alt.trim() || "README preview",
      source: "readme",
      kind,
      confidence: score >= 34 ? "high" : "medium",
      score,
    });
  };

  const markdownImagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownImagePattern.exec(args.readme.text)) !== null) {
    pushImage(markdownMatch[1] ?? "", markdownMatch[2] ?? "");
  }

  const htmlImagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>|<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlImagePattern.exec(args.readme.text)) !== null) {
    const url = htmlMatch[1] ?? htmlMatch[4] ?? "";
    const alt = htmlMatch[2] ?? htmlMatch[3] ?? "";
    pushImage(alt, url);
  }

  return unique(images.map((image) => JSON.stringify(image)))
    .map((value) => JSON.parse(value) as ScoredPreviewImage)
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, 4);
}

function extractReadmeLinks(readmeText?: string | null) {
  const links: ReadmeLink[] = [];
  if (!readmeText) return links;

  splitReadmeSections(readmeText).forEach((section) => {
    const body = stripCodeBlocks(section.body);
    const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let markdownMatch: RegExpExecArray | null;
    while ((markdownMatch = markdownLinkPattern.exec(body)) !== null) {
      links.push({
        label: markdownMatch[1] ?? "",
        url: markdownMatch[2] ?? "",
        heading: section.heading,
      });
    }

    const bareUrlPattern = /(?<!\()https?:\/\/[^\s)<>"']+/g;
    let bareMatch: RegExpExecArray | null;
    while ((bareMatch = bareUrlPattern.exec(body)) !== null) {
      links.push({
        label: "",
        url: (bareMatch[0] ?? "").replace(/[.,;:]+$/, ""),
        heading: section.heading,
      });
    }
  });

  return unique(links.map((link) => JSON.stringify(link))).map((value) => JSON.parse(value) as ReadmeLink);
}

function isLikelyDeployUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (
      hostname === "github.com" ||
      hostname.endsWith("github.com") ||
      hostname === "raw.githubusercontent.com" ||
      hostname.endsWith("npmjs.com") ||
      hostname === "img.shields.io" ||
      hostname === "shields.io" ||
      hostname === "coveralls.io" ||
      hostname === "codecov.io" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }
    if (looksLikeImageUrl(url)) {
      return false;
    }
    if (/(badge|shield|coverage|status|workflow|build|license)/i.test(pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function repoIdentityTokens(repo: RepoAnalysis["repo"]) {
  const combined = `${repo.owner} ${repo.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !GENERIC_REPO_IDENTITY_TOKENS.has(token));

  return unique(combined);
}

function repoMatchesUrl(repo: RepoAnalysis["repo"], url: string) {
  const parsed = new URL(url);
  const signal = slugify(`${parsed.hostname.toLowerCase()} ${parsed.pathname.toLowerCase()}`);
  const repoSlug = slugify(repo.name);
  const ownerSlug = slugify(repo.owner);

  if (repoSlug && signal.includes(repoSlug)) {
    return true;
  }

  const matches = repoIdentityTokens(repo).filter((token) => signal.includes(token));
  if (matches.length >= 2 || matches.some((token) => token.length >= 8)) {
    return true;
  }

  return Boolean(ownerSlug && signal.includes(ownerSlug) && matches.length >= 1);
}

function deployUrlBaseScore(args: {
  url: string;
  repo: RepoAnalysis["repo"];
}) {
  const parsed = new URL(args.url);
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  let score = 0;

  if (/(vercel\.app|netlify\.app|pages\.dev|web\.app|onrender\.com|fly\.dev|railway\.app|herokuapp\.com|github\.io)$/i.test(hostname)) {
    score += 36;
  }
  if (hostname.split(".").length <= 2) score += 6;
  if (/^(app|demo|preview|live|web)\./i.test(hostname) || /(^|[-.])(app|demo|preview|live)([-.]|$)/i.test(hostname)) {
    score += 16;
  }
  if (repoMatchesUrl(args.repo, args.url)) score += 18;
  if (pathname === "/" || pathname === "") score += 8;
  if (/^\/(app|dashboard|demo|preview|playground)(\/|$)/i.test(pathname)) score += 12;
  if (/^\/(docs|doc|documentation|api|reference)(\/|$)/i.test(pathname)) score -= 38;
  if (/^\/(guide|guides|tutorial|tutorials|blog|changelog)(\/|$)/i.test(pathname)) score -= 28;
  if (/^\/(button|new)(\/|$)/i.test(pathname)) score -= 42;
  if (/^\/(settings|account|accounts|organization|organizations|billing|login|signin|signup|console)(\/|$)/i.test(pathname)) {
    score -= 48;
  }
  if (/(storybook|playground)/i.test(hostname) || /^\/(storybook|playground)(\/|$)/i.test(pathname)) {
    score -= 10;
  }
  if (/^(docs|developer|developers|platform)\./i.test(hostname)) score -= 14;
  if (
    /^(nodejs\.org|nextjs\.org|vercel\.com|railway\.app|render\.com|portal\.azure\.com|platform\.openai\.com)$/i.test(
      hostname
    ) &&
    !repoMatchesUrl(args.repo, args.url)
  ) {
    score -= 52;
  }

  return score;
}

function scoreDeployLink(args: {
  link: ReadmeLink;
  repo: RepoAnalysis["repo"];
  scope: ScopedReadme["scope"] | "package_json";
}) {
  const link = args.link;
  if (!isLikelyDeployUrl(link.url)) return -1;
  const label = link.label.toLowerCase();
  const heading = link.heading.toLowerCase();
  const hostname = new URL(link.url).hostname.toLowerCase();
  let score = deployUrlBaseScore({
    url: link.url,
    repo: args.repo,
  });

  if (PREVIEW_LABEL_PATTERN.test(label)) score += 50;
  else if (AUXILIARY_PREVIEW_LABEL_PATTERN.test(label) && repoMatchesUrl(args.repo, link.url)) score += 14;
  if (/(storybook|playground|components?|ui kit)/i.test(label)) score += 12;
  if (PREVIEW_HEADING_PATTERN.test(heading)) score += 18;
  if (NEGATIVE_PREVIEW_LABEL_PATTERN.test(label)) score -= 40;
  if (NEGATIVE_PREVIEW_HEADING_PATTERN.test(heading)) score -= 32;
  if (/^docs\./i.test(hostname)) score -= 16;
  if (args.scope === "focus") score += 18;
  if (args.scope === "package_json" && !/(docs|documentation|reference|api)/i.test(link.url)) {
    score += 28;
  }

  return score;
}

function deployConfidenceFromCandidate(args: {
  score: number;
  source: "package_json" | "readme";
}): NonNullable<RepoLearningGuide["preview"]["deployConfidence"]> {
  if (args.source === "package_json") {
    return args.score >= 70 ? "high" : "medium";
  }

  return args.score >= 85 ? "high" : "medium";
}

function deployTargetsFromConfigEntries(entries: ScopedConfigText[]) {
  const targets = new Set<string>();

  entries.forEach((entry) => {
    const name = basename(entry.path).toLowerCase();
    if (name === "vercel.json") targets.add("Vercel");
    if (name === "render.yaml" || name === "render.yml") targets.add("Render");
    if (name === "fly.toml") targets.add("Fly.io");
    if (name === "railway.json") targets.add("Railway");
    if (name === "netlify.toml") targets.add("Netlify");
    if (name === "serverless.yml" || name === "serverless.yaml") targets.add("AWS");
    if (name === "template.yaml" || name === "template.yml") targets.add("AWS");
    if (name === "procfile") targets.add("Self-host");
  });

  return targets;
}

function deployProviderForUrl(url: string) {
  return deployTargetFromUrl(url);
}

function buildDeployRationale(args: {
  url: string;
  source: "package_json" | "readme";
  scope: ScopedReadme["scope"] | "package_json";
  repo: RepoAnalysis["repo"];
  label?: string;
  heading?: string;
  hasMatchingConfig?: boolean;
}) {
  const reasons: string[] = [];
  const parsed = new URL(args.url);
  const hostname = parsed.hostname.toLowerCase();

  if (args.source === "package_json") {
    reasons.push(
      args.scope === "focus"
        ? "focus workspace homepage에서 찾은 주소입니다."
        : "package.json homepage에서 찾은 주소입니다."
    );
  } else {
    reasons.push("README에서 공개 사용 주소로 소개된 링크입니다.");
  }

  if (args.hasMatchingConfig) {
    reasons.push("레포 안에 같은 배포 대상 설정 파일이 있습니다.");
  }

  if (repoMatchesUrl(args.repo, args.url)) {
    reasons.push("레포 이름이나 owner와 URL이 직접 연결됩니다.");
  }

  if (/(vercel\.app|netlify\.app|pages\.dev|web\.app|onrender\.com|fly\.dev|railway\.app|github\.io)$/i.test(hostname)) {
    reasons.push("실제 배포에 자주 쓰이는 호스팅 도메인입니다.");
  }

  if (args.label && PREVIEW_LABEL_PATTERN.test(args.label.toLowerCase())) {
    reasons.push("README에서 demo/preview 문맥으로 설명됩니다.");
  } else if (args.heading && PREVIEW_HEADING_PATTERN.test(args.heading.toLowerCase())) {
    reasons.push("README의 preview/showcase 섹션에서 발견됐습니다.");
  }

  return reasons.slice(0, 3);
}

function detectDeployUrl(args: {
  repo: RepoAnalysis["repo"];
  pkg?: PackageJsonShape | null;
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}) {
  const candidates: Array<{
    url: string;
    source: "package_json" | "readme";
    score: number;
    rationale: string[];
  }> = [];
  const focusPkg = workspacePackageJson(args.selectedFileContents, args.focusRoot);
  const deployConfigEntries = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: [
      "vercel.json",
      "render.yaml",
      "render.yml",
      "fly.toml",
      "railway.json",
      "netlify.toml",
      "serverless.yml",
      "serverless.yaml",
      "template.yml",
      "template.yaml",
      "Procfile",
    ],
  });
  const deployConfigTargets = deployTargetsFromConfigEntries(deployConfigEntries);

  const pushHomepage = (homepage: string | undefined, scope: "focus" | "package_json") => {
    if (!homepage || !isLikelyDeployUrl(homepage)) return;
    const provider = deployProviderForUrl(homepage);
    const configBoost = provider && deployConfigTargets.has(provider) ? 12 : 0;
    const score =
      scoreDeployLink({
        repo: args.repo,
        link: { label: scope === "focus" ? "focus app" : "homepage", url: homepage, heading: "" },
        scope,
      }) + configBoost;
    if (score >= 20) {
      candidates.push({
        url: homepage,
        source: "package_json",
        score,
        rationale: buildDeployRationale({
          url: homepage,
          source: "package_json",
          scope,
          repo: args.repo,
          hasMatchingConfig: Boolean(provider && deployConfigTargets.has(provider)),
        }),
      });
    }
  };

  pushHomepage(focusPkg?.homepage, "focus");
  pushHomepage(args.pkg?.homepage, "package_json");

  findScopedReadmes({
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  }).forEach((readme) => {
    extractReadmeLinks(readme.text).forEach((link) => {
      const provider = deployProviderForUrl(link.url);
      const configBoost = provider && deployConfigTargets.has(provider) ? 12 : 0;
      const score =
        scoreDeployLink({
          repo: args.repo,
          link,
          scope: readme.scope,
        }) + configBoost;
      if (score >= 20) {
        candidates.push({
          url: link.url,
          source: "readme",
          score,
          rationale: buildDeployRationale({
            url: link.url,
            source: "readme",
            scope: readme.scope,
            repo: args.repo,
            label: link.label,
            heading: link.heading,
            hasMatchingConfig: Boolean(provider && deployConfigTargets.has(provider)),
          }),
        });
      }
    });
  });

  const best = candidates.sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))[0];
  return best ?? null;
}

function buildPreviewGuide(args: {
  repo: RepoAnalysis["repo"];
  pkg?: PackageJsonShape | null;
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}): RepoLearningGuide["preview"] {
  const readmes = findScopedReadmes({
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });
  const imageMap = new Map<string, ScoredPreviewImage>();

  readmes
    .flatMap((readme) =>
      extractReadmeImages({
        owner: args.repo.owner,
        repo: args.repo.name,
        ref: args.repo.sha,
        readme,
      })
    )
    .forEach((image) => {
      const existing = imageMap.get(image.url);
      if (!existing || image.score > existing.score) {
        imageMap.set(image.url, image);
      }
    });

  const images = [...imageMap.values()]
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, 4)
    .map((image) => ({
      url: image.url,
      alt: image.alt,
      source: image.source,
      kind: image.kind,
      confidence: image.confidence,
    }));
  const deploy = detectDeployUrl({
    repo: args.repo,
    pkg: args.pkg,
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });

  if (images.length > 0) {
    return {
      mode: "readme_images",
      images,
      deployUrl: deploy?.url ?? null,
      source: deploy ? "mixed" : "readme",
      deployConfidence: deploy
        ? deployConfidenceFromCandidate({ score: deploy.score, source: deploy.source })
        : null,
      deployRationale: deploy?.rationale ?? [],
    };
  }

  if (deploy) {
    return {
      mode: "deploy_url",
      images: [],
      deployUrl: deploy.url,
      source: deploy.source,
      deployConfidence: deployConfidenceFromCandidate({
        score: deploy.score,
        source: deploy.source,
      }),
      deployRationale: deploy.rationale,
    };
  }

  return {
    mode: "none",
    images: [],
    deployUrl: null,
    source: "none",
    deployConfidence: null,
    deployRationale: [],
  };
}

type ScopedConfigText = {
  path: string;
  text: string;
  scope: "focus" | "root";
};

const RUNTIME_NAME_ORDER: RepoEnvRuntime["name"][] = [
  "node",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "bun",
  "deno",
];

const RUNTIME_SOURCE_PRIORITY: Record<RepoEnvRuntime["source"], number> = {
  package_json: 2,
  nvmrc: 4,
  node_version: 4,
  python_version: 4,
  pyproject: 4,
  requirements_txt: 2,
  setup_py: 3,
  setup_cfg: 3,
  environment_yml: 3,
  pipfile: 3,
  go_mod: 4,
  cargo_toml: 3,
  rust_toolchain: 4,
  deno_json: 3,
  dockerfile: 1,
  readme: 0,
};

const GPU_REQUIRED_LIBRARY_PATTERN =
  /\b(tensorflow-gpu|cuda|cupy|jax(?:\[cuda\])?|onnxruntime-gpu|pytorch-cuda|nvidia-cudnn|bitsandbytes)\b/i;
const GPU_CAPABLE_LIBRARY_PATTERN =
  /\b(torch|tensorflow|jax|transformers|diffusers|accelerate)\b/i;
const GPU_README_PATTERN = /\b(cuda|gpu|rtx|apple silicon|vram)\b/i;
const RAM_README_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s*(?:RAM|memory|메모리)/i;
const DISK_README_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s*(?:disk|storage|디스크)/i;
const VRAM_README_PATTERN = /(\d+(?:\.\d+)?)\s*GB\s*(?:VRAM|vram)/i;
const HARDWARE_SIGNAL_PATTERN = /\b(ram|memory|메모리|gpu|cuda|rtx|vram|apple silicon|cpu)\b/i;
const SERVICE_NOTE_CATEGORY_PATTERN = /\b(storage|database|cache|queue|cdn|analytics|artifact|state lives)\b/i;
const README_ENVIRONMENT_SCAN_MAX_CHARS = 10_000;
const ENVIRONMENT_EXAMPLE_FILE_NAMES = [
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
  ".env.defaults",
  ".env.local.example",
  ".env.development.example",
  ".env.production.example",
] as const;
const REQUIRED_EXTERNAL_SERVICE_CANDIDATES = new Set([
  "OpenAI",
  "Anthropic",
  "Stripe",
  "Supabase",
  "Firebase",
]);
const CORE_INFRA_SERVICE_CANDIDATES = new Set(["PostgreSQL", "MySQL", "MongoDB", "Redis"]);
const HARD_REQUIRED_DEPLOY_TARGET_CANDIDATES = new Set(["AWS", "GCP", "Azure"]);
const DEPLOY_TARGET_PRIORITY = [
  "Vercel",
  "Railway",
  "Fly.io",
  "Render",
  "Netlify",
  "GitHub Pages",
  "AWS",
  "GCP",
  "Azure",
  "Self-host",
  "Docker",
] as const;
const OPTIONAL_SERVICE_README_PATTERN =
  /\b(optional|optionally|선택|선택적|only if|if needed|if you need|when needed|may use|can use|can be used|fallback|instead of|required only for)\b/i;
const DOCKER_REQUIRED_COMMAND_PATTERN = /\b(docker compose up|docker-compose up|docker run)\b/i;
const NON_DOCKER_RUN_HINT_PATTERN =
  /\b(pnpm|npm|yarn|bun)\s+(dev|start|serve)\b|\buv run\b|\bpython(?:3)?\s+-m\b|\bpython(?:3)?\s+[\w./-]+|\bgo run\b|\bcargo run\b/i;
const DOCKER_OPTIONAL_DEV_PATH_PATTERN =
  /(^|\/)(docker-compose\.(dev|local|ci|test)\.(ya?ml)|compose\.(dev|local|ci|test)\.(ya?ml)|dockerfile\.(dev|local|ci|test)|.*\/(dev|ci|test)[/-].*docker)/i;
const DOCKER_OPTIONAL_DEPLOY_PATH_PATTERN =
  /(^|\/)(docker-compose\.(prod|release)\.(ya?ml)|compose\.(prod|release)\.(ya?ml)|dockerfile\.(prod|release)|.*\/(prod|release)[/-].*docker)/i;
const DOCKERFILE_LIKE_NAME_PATTERN =
  /^dockerfile(?:[._-](dev|local|ci|test|prod|release|production))?$/i;
const COMPOSE_LIKE_NAME_PATTERN =
  /^(docker-compose|compose)(?:[._-](dev|local|ci|test|prod|release|production))?\.(ya?ml)$/i;
const DOCKER_DEPLOY_LINE_PATTERN =
  /\b(deploy|deployment|release|production)\b.*\bdocker\b|\bdocker\b.*\b(deploy|deployment|release|production)\b/i;
const IMPORT_USAGE_PATTERN =
  /\bimport\s+.+\s+from\s+["'][^"']+["']|\brequire\(\s*["'][^"']+["']\s*\)/i;
const APP_SURFACE_PATH_PATTERN =
  /(^|\/)(app|pages|src\/app|src\/pages|server|api)(\/|$)|(^|\/)(next|astro|vite)\.config\.(ts|js|mjs|cjs)$/i;
const DEMO_SURFACE_ROOT_PATTERN =
  /(^|\/)(demo|demos|example|examples|playground|playgrounds|sandbox|showcase|preview|website|site|docs)(\/|$)/i;
const DEMO_RUNTIME_CONFIG_PATTERN =
  /(^|\/)(package\.json|(next|vite|astro|nuxt|svelte|remix)\.config\.(ts|js|mjs|cjs)|firebase\.json|vercel\.json)$/i;
const LIBRARY_ENTRY_PATH_PATTERN =
  /(^|\/)(src\/)?index\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|rb)$/i;
const DEPLOY_WORKFLOW_PATTERN = /^\.github\/workflows\/.+deploy.+\.ya?ml$/i;
const K8S_PATH_PATTERN = /(^|\/)(k8s|kubernetes|manifests?|helm|charts)(\/|$)/i;
const TERRAFORM_PATH_PATTERN = /(^|\/)terraform(\/|$)/i;
const AWS_TERRAFORM_PATH_PATTERN = /(^|\/)terraform\/aws(\/|$)/i;
const GCP_TERRAFORM_PATH_PATTERN = /(^|\/)terraform\/gcp(\/|$)|(^|\/)terraform\/google(\/|$)/i;
const AZURE_TERRAFORM_PATH_PATTERN = /(^|\/)terraform\/azure(\/|$)|(^|\/)terraform\/azurerm(\/|$)/i;
const AMD64_PLATFORM_PATTERN = /\b(?:linux\/amd64|platform\s*[:=]\s*linux\/amd64|--platform=linux\/amd64)\b/i;
const ARM64_PLATFORM_PATTERN = /\b(?:linux\/arm64|platform\s*[:=]\s*linux\/arm64|--platform=linux\/arm64)\b/i;
const CUDA_ACCELERATOR_PATTERN = /\b(device\s*=\s*["']cuda["']|torch\.cuda|cuda(?:\s+\d{1,2})?|nvidia|pytorch-cuda|onnxruntime-gpu|bitsandbytes)\b/i;
const MPS_ACCELERATOR_PATTERN = /\b(torch\.backends\.mps|device\s*=\s*["']mps["']|tensorflow-macos|apple silicon|mps)\b/i;
const ROCM_ACCELERATOR_PATTERN = /\b(rocm|hipblas|hipruntime|torch-rocm)\b/i;
const CPU_OK_PATTERN = /\b(works on cpu|no gpu required|device\s*=\s*["']cpu["']|cpu fallback)\b/i;
const LLM_COST_PATTERN = /\b(openai|anthropic|gpt-4|gpt-4o|claude|responses api)\b/i;
const STORAGE_COST_PATTERN = /\b(cloudflare r2|s3|gcs|google cloud storage|azure blob|upstash redis)\b/i;
const SAAS_COST_PATTERN = /\b(stripe|clerk|auth0|resend|sendgrid|sentry|pinecone|weaviate|qdrant)\b/i;
const VECTOR_DB_COST_PATTERN = /\b(pinecone|weaviate|qdrant|milvus|chroma(?:db)?|lancedb|pgvector|upstash vector)\b/i;
const OBJECT_STORAGE_COST_PATTERN =
  /\b(cloudflare r2|amazon s3|(^|[\s-])s3([\s-]|$)|gcs|google cloud storage|azure blob|minio)\b/i;
const PYTHON_IMPORT_USAGE_PATTERN = /\bfrom\s+[\w.]+\s+import\s+[\w*, ]+|\bimport\s+[\w.]+/i;
const LOCAL_RUNTIME_HINT_PATTERN =
  /\b(localhost|127\.0\.0\.1|pnpm dev|npm run dev|yarn dev|bun run dev|uvicorn|uv run|python -m|go run|cargo run|next dev|vite)\b/i;
const MODEL_VRAM_HINTS = [
  { pattern: /\b(llama[-\s]?(65b|70b)|mixtral(?:[-\s]?8x7b)?|qwen[-\s]?72b)\b/i, vram: 80 },
  { pattern: /\b(sd[-\s]?xl|stable diffusion xl|flux\.?1|flux[-\s]?dev)\b/i, vram: 12 },
  { pattern: /\b(llama[-\s]?(7b|8b)|mistral[-\s]?7b|qwen[-\s]?(7b|8b)|gemma[-\s]?(7b|9b))\b/i, vram: 16 },
] as const;

function textFromSelectedFile(
  selectedFileContents: Record<string, string> | undefined,
  path: string
) {
  const value = selectedFileContents?.[path];
  return typeof value === "string" ? value : null;
}

function collectScopedConfigTexts(args: {
  focusRoot: string | null;
  selectedFileContents?: Record<string, string>;
  names: string[];
  matchBasename?: (name: string) => boolean;
}) {
  const entries: ScopedConfigText[] = [];
  const selectedPaths = Object.keys(args.selectedFileContents ?? {});
  const directPaths = new Set<string>();
  const push = (path: string, scope: ScopedConfigText["scope"]) => {
    const text = textFromSelectedFile(args.selectedFileContents, path);
    if (!text || text.trim().length === 0) {
      return;
    }
    entries.push({ path, text, scope });
    directPaths.add(path);
  };

  const scorePath = (path: string) => {
    let score = 0;
    if (!path.includes("/")) score += 90;
    if (args.focusRoot && path.startsWith(`${args.focusRoot}/`)) score += 70;
    if (/^docker\//i.test(path)) score += 55;
    if (/^(deploy|infra|ops|containers?)\//i.test(path)) score += 35;
    if (/compose/i.test(path)) score += 14;
    if (/^\.github\//i.test(path)) score -= 20;
    if (/^\.devcontainer\//i.test(path)) score -= 28;
    score -= path.length / 10;
    return score;
  };

  if (args.focusRoot) {
    args.names.forEach((name) => push(`${args.focusRoot}/${name}`, "focus"));
  }
  args.names.forEach((name) => push(name, "root"));

  const nestedMatches = unique(
    selectedPaths.filter((path) => {
      const name = basename(path);
      return (args.names.includes(name) || args.matchBasename?.(name) === true) && !directPaths.has(path);
    })
  )
    .sort((left, right) => scorePath(right) - scorePath(left) || left.localeCompare(right))
    .slice(0, 8);

  nestedMatches.forEach((path) =>
    push(path, args.focusRoot && path.startsWith(`${args.focusRoot}/`) ? "focus" : "root")
  );

  return entries.filter(
    (entry, index, all) => all.findIndex((candidate) => candidate.path === entry.path) === index
  );
}

function scoreRepresentativeDockerEntry(
  entry: ScopedConfigText,
  repo: RepoAnalysis["repo"],
  focusRoot: string | null
) {
  const normalizedPath = entry.path.toLowerCase();
  const repoSlug = slugify(repo.name);
  let score = 0;

  if (entry.scope === "focus") score += 120;
  if (entry.path === "Dockerfile" || (focusRoot && entry.path === `${focusRoot}/Dockerfile`)) score += 150;
  if (/^docker\//i.test(entry.path)) score += 48;
  if (/^(deploy|infra|ops|containers?)\//i.test(entry.path)) score += 32;
  if (
    /(^|\/)(app|web|server|api|frontend|backend|worker|services?)\b/i.test(entry.path)
  ) {
    score += 36;
  }
  if (repoSlug && normalizedPath.includes(repoSlug)) score += 42;
  if (/^\s*EXPOSE\s+/im.test(entry.text)) score += 16;
  if (/^\s*(CMD|ENTRYPOINT)\s+/im.test(entry.text)) score += 16;
  if (/^\s*FROM\s+/im.test(entry.text)) score += 8;

  if (/^\.(devcontainer|github)\//i.test(entry.path)) score -= 90;
  if (/(^|\/)(base|runner|runners|distroless|builder|builders)\b/i.test(entry.path)) score -= 42;
  if (/(^|\/)(test|tests|testing|bench|benchmark|example|examples)\b/i.test(entry.path)) {
    score -= 32;
  }

  score -= entry.path.length / 14;
  return score;
}

function scoreRepresentativeComposeEntry(
  entry: ScopedConfigText,
  repo: RepoAnalysis["repo"],
  focusRoot: string | null
) {
  const normalizedPath = entry.path.toLowerCase();
  const repoSlug = slugify(repo.name);
  const services = parseComposeServices(entry.text).map((item) => item.toLowerCase());
  let score = 0;

  if (entry.scope === "focus") score += 120;
  if (
    entry.path === "docker-compose.yml" ||
    entry.path === "docker-compose.yaml" ||
    entry.path === "compose.yml" ||
    entry.path === "compose.yaml" ||
    (focusRoot &&
      [
        `${focusRoot}/docker-compose.yml`,
        `${focusRoot}/docker-compose.yaml`,
        `${focusRoot}/compose.yml`,
        `${focusRoot}/compose.yaml`,
      ].includes(entry.path))
  ) {
    score += 150;
  }
  if (/^docker\//i.test(entry.path)) score += 54;
  if (/^(deploy|infra|ops|containers?)\//i.test(entry.path)) score += 38;
  if (repoSlug && normalizedPath.includes(repoSlug)) score += 36;
  if (parseComposePorts(entry.text).length > 0) score += 12;
  if (services.some((service) => ["app", "web", "server", "api", repoSlug].includes(service))) {
    score += 18;
  }

  if (/^\.(devcontainer|github)\//i.test(entry.path)) score -= 96;
  if (/(^|\/)(test|tests|testing|bench|benchmark|example|examples)\b/i.test(entry.path)) {
    score -= 32;
  }

  score -= entry.path.length / 14;
  return score;
}

function pickRepresentativeConfigEntry(
  entries: ScopedConfigText[],
  scorer: (entry: ScopedConfigText) => number
) {
  const ranked = [...entries]
    .map((entry) => ({ entry, score: scorer(entry) }))
    .sort((left, right) => right.score - left.score || left.entry.path.localeCompare(right.entry.path));

  return ranked[0] ?? null;
}

function normalizeVersion(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "") ?? null;
  return normalized && normalized.length > 0 ? normalized : null;
}

function runtimeRangeFromVersion(version: string | null | undefined): Pick<
  RepoEnvRuntime,
  "minMajor" | "maxMajor" | "range"
> {
  const normalized = normalizeVersion(version);

  if (!normalized || !/\d/.test(normalized) || /nightly|canary|latest/i.test(normalized)) {
    return {
      minMajor: null,
      maxMajor: null,
      range: "unknown",
    };
  }

  const parseMajor = (value: string) => {
    const match = value.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };
  const parts = normalized
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const lower = parts.find((part) => /^(>=|>|~|\^)/.test(part));
  const upper = parts.find((part) => /^(<=|<)/.test(part));

  if (lower || upper) {
    let minMajor: number | null = null;
    let maxMajor: number | null = null;

    if (lower) {
      const lowerMajor = parseMajor(lower);
      minMajor = lowerMajor;
      if (/^[~^]/.test(lower)) {
        maxMajor = lowerMajor;
      }
    }

    if (upper) {
      const upperMajor = parseMajor(upper);
      if (upperMajor !== null) {
        if (/^<=/.test(upper)) {
          maxMajor = upperMajor;
        } else {
          const hasMinor = /\d+\.\d+/.test(upper);
          maxMajor = hasMinor ? upperMajor : Math.max(0, upperMajor - 1);
        }
      }
    }

    return {
      minMajor,
      maxMajor,
      range: lower && upper ? "between" : lower ? "gte" : "lte",
    };
  }

  const exactMajor = parseMajor(normalized);
  if (exactMajor === null) {
    return {
      minMajor: null,
      maxMajor: null,
      range: "unknown",
    };
  }

  return {
    minMajor: exactMajor,
    maxMajor: exactMajor,
    range: "exact",
  };
}

function serviceFromEnvKey(key: string): string | null {
  const normalized = key.toUpperCase();
  const unwrapped = normalized.replace(/^(NEXT_PUBLIC_|PUBLIC_|VITE_)/, "");

  if (
    /^OPENAI_/.test(unwrapped) ||
    unwrapped === "OPENAI_API_KEY" ||
    unwrapped === "CHATGPT_API_KEY"
  ) {
    return "OpenAI";
  }
  if (/^ANTHROPIC_/.test(unwrapped) || /^CLAUDE_/.test(unwrapped)) {
    return "Anthropic";
  }
  if (
    /^POSTGRES(?:QL)?_/.test(unwrapped) ||
    /^PG(HOST|DATABASE|USER|PASSWORD|PORT|URL)/.test(unwrapped) ||
    unwrapped === "DATABASE_URL"
  ) {
    return "PostgreSQL";
  }
  if (/^MYSQL_/.test(unwrapped)) {
    return "MySQL";
  }
  if (/^MONGO(DB)?_/.test(unwrapped)) {
    return "MongoDB";
  }
  if (/^REDIS_/.test(unwrapped) || /BULL_REDIS/.test(unwrapped)) {
    return "Redis";
  }
  if (/^UPSTASH_/.test(unwrapped)) {
    return "Upstash Redis";
  }
  if (/^SUPABASE_/.test(unwrapped)) {
    return "Supabase";
  }
  if (/^FIREBASE_/.test(unwrapped)) {
    return "Firebase";
  }
  if (/^STRIPE_/.test(unwrapped)) {
    return "Stripe";
  }
  if (/^CLERK_/.test(unwrapped)) {
    return "Clerk";
  }
  if (/^AUTH0_/.test(unwrapped)) {
    return "Auth0";
  }
  if (/^RESEND_/.test(unwrapped)) {
    return "Resend";
  }
  if (/^SENDGRID_/.test(unwrapped)) {
    return "SendGrid";
  }
  if (/^SENTRY_/.test(unwrapped)) {
    return "Sentry";
  }
  if (/^PINECONE_/.test(unwrapped)) {
    return "Pinecone";
  }
  if (/^WEAVIATE_/.test(unwrapped)) {
    return "Weaviate";
  }
  if (/^QDRANT_/.test(unwrapped)) {
    return "Qdrant";
  }
  if (/^MILVUS_/.test(unwrapped)) {
    return "Milvus";
  }
  if (/^CHROMA(DB)?_/.test(unwrapped)) {
    return "Chroma";
  }
  if (/^(AWS_S3_|S3_|BUCKET_)/.test(unwrapped)) {
    return "Amazon S3";
  }
  if (/^(GCS_|GOOGLE_CLOUD_STORAGE_)/.test(unwrapped)) {
    return "Google Cloud Storage";
  }
  if (/^(AZURE_BLOB_|AZURE_STORAGE_)/.test(unwrapped)) {
    return "Azure Blob Storage";
  }
  if (/^(R2_|CLOUDFLARE_R2_)/.test(normalized)) {
    return "Cloudflare R2";
  }
  if (/^MINIO_/.test(normalized)) {
    return "MinIO";
  }

  return null;
}

function canonicalCloudService(label: string): CloudService {
  const normalized = label.trim().toLowerCase();

  const from = (
    canonicalId: string,
    canonicalLabel: string,
    kind: CloudService["kind"]
  ): CloudService => ({
    label: canonicalLabel,
    canonicalId,
    kind,
  });

  if (/supabase postgres/.test(normalized)) {
    return from("postgres", "Supabase Postgres", "database");
  }
  if (/(^|[\s-])(postgres|postgresql|pg)([\s-]|$)/.test(normalized)) {
    return from("postgres", "PostgreSQL", "database");
  }
  if (/(^|[\s-])mysql([\s-]|$)/.test(normalized)) {
    return from("mysql", "MySQL", "database");
  }
  if (/(^|[\s-])(mongo|mongodb)([\s-]|$)/.test(normalized)) {
    return from("mongodb", "MongoDB", "database");
  }
  if (/upstash redis/.test(normalized)) {
    return from("redis", "Upstash Redis", "database");
  }
  if (/(^|[\s-])redis([\s-]|$)/.test(normalized)) {
    return from("redis", "Redis", "database");
  }
  if (/cloudflare r2|(^|[\s-])r2([\s-]|$)/.test(normalized)) {
    return from("cloudflare-r2", "Cloudflare R2", "infra");
  }
  if (/(^|[\s-])(amazon s3|aws s3|s3)([\s-]|$)/.test(normalized)) {
    return from("s3", "Amazon S3", "infra");
  }
  if (/(^|[\s-])(gcs|google cloud storage)([\s-]|$)/.test(normalized)) {
    return from("gcs", "Google Cloud Storage", "infra");
  }
  if (/(^|[\s-])(azure blob|azure storage blob)([\s-]|$)/.test(normalized)) {
    return from("azure-blob", "Azure Blob Storage", "infra");
  }
  if (/(^|[\s-])minio([\s-]|$)/.test(normalized)) {
    return from("minio", "MinIO", "infra");
  }
  if (/open-?ai|chatgpt-api/.test(normalized)) {
    return from("openai", "OpenAI", "ai");
  }
  if (/anthropic|claude/.test(normalized)) {
    return from("anthropic", "Anthropic", "ai");
  }
  if (/(^|[\s-])supabase([\s-]|$)/.test(normalized)) {
    return from("supabase", "Supabase", "database");
  }
  if (/(^|[\s-])firebase([\s-]|$)/.test(normalized)) {
    return from("firebase", "Firebase", "database");
  }
  if (/(^|[\s-])stripe([\s-]|$)/.test(normalized)) {
    return from("stripe", "Stripe", "payment");
  }
  if (/(^|[\s-])clerk([\s-]|$)/.test(normalized)) {
    return from("clerk", "Clerk", "auth");
  }
  if (/(^|[\s-])auth0([\s-]|$)/.test(normalized)) {
    return from("auth0", "Auth0", "auth");
  }
  if (/(^|[\s-])resend([\s-]|$)/.test(normalized)) {
    return from("resend", "Resend", "email");
  }
  if (/sendgrid/.test(normalized)) {
    return from("sendgrid", "SendGrid", "email");
  }
  if (/sentry/.test(normalized)) {
    return from("sentry", "Sentry", "infra");
  }
  if (/pinecone/.test(normalized)) {
    return from("pinecone", "Pinecone", "database");
  }
  if (/weaviate/.test(normalized)) {
    return from("weaviate", "Weaviate", "database");
  }
  if (/qdrant/.test(normalized)) {
    return from("qdrant", "Qdrant", "database");
  }
  if (/milvus/.test(normalized)) {
    return from("milvus", "Milvus", "database");
  }
  if (/chroma(?:db)?/.test(normalized)) {
    return from("chroma", "Chroma", "database");
  }

  return {
    label: label.trim(),
    canonicalId: slugify(label),
    kind: "other",
  };
}

function serviceNamesFromTextLine(line: string) {
  const detected = new Set<string>();
  const raw = line.trim();
  const envKey = raw.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1] ?? null;
  const envService = envKey ? serviceFromEnvKey(envKey) : null;
  if (envService) {
    detected.add(envService);
  }

  if (/cloudflare r2/i.test(raw)) detected.add("Cloudflare R2");
  if (/\b(amazon s3|aws s3)\b/i.test(raw) || /\bS3_BUCKET\b/.test(raw)) detected.add("Amazon S3");
  if (/\b(gcs|google cloud storage)\b/i.test(raw)) detected.add("Google Cloud Storage");
  if (/\bazure blob\b/i.test(raw)) detected.add("Azure Blob Storage");
  if (/\bminio\b/i.test(raw)) detected.add("MinIO");
  if (/upstash redis/i.test(raw)) detected.add("Upstash Redis");
  if (/\bpostgres(?:ql)?\b/i.test(raw) && !detected.has("PostgreSQL")) detected.add("PostgreSQL");
  if (/\bredis\b/i.test(raw) && !detected.has("Upstash Redis")) detected.add("Redis");
  if (/\bmysql\b/i.test(raw)) detected.add("MySQL");
  if (/\bmongo(?:db)?\b/i.test(raw)) detected.add("MongoDB");
  if (/\bopenai\b/i.test(raw) && !/\bopenai gym(?:nasium)?\b/i.test(raw)) detected.add("OpenAI");
  if (/\banthropic\b|\bclaude\b/i.test(raw)) detected.add("Anthropic");
  if (/\bstripe\b/i.test(raw)) detected.add("Stripe");
  if (/\bsupabase\b/i.test(raw)) detected.add("Supabase");
  if (/\bfirebase\b/i.test(raw)) detected.add("Firebase");
  if (/\bclerk\b/i.test(raw)) detected.add("Clerk");
  if (/\bauth0\b/i.test(raw)) detected.add("Auth0");
  if (/\bresend\b/i.test(raw)) detected.add("Resend");
  if (/sendgrid/i.test(raw)) detected.add("SendGrid");
  if (/\bsentry\b/i.test(raw)) detected.add("Sentry");
  if (/\bpinecone\b/i.test(raw)) detected.add("Pinecone");
  if (/\bweaviate\b/i.test(raw)) detected.add("Weaviate");
  if (/\bqdrant\b/i.test(raw)) detected.add("Qdrant");
  if (/\bmilvus\b/i.test(raw)) detected.add("Milvus");
  if (/\bchroma(?:db)?\b/i.test(raw)) detected.add("Chroma");

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function envServiceSignalsFromTexts(texts: string[]) {
  const required = new Set<string>();
  const optional = new Set<string>();

  texts.forEach((text) => {
    let pendingOptionalContext = false;

    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        pendingOptionalContext = false;
        return;
      }

      if (/^\s*[#;]/.test(rawLine)) {
        const cleaned = cleanupReadmeLine(rawLine);
        if (
          OPTIONAL_SERVICE_README_PATTERN.test(cleaned) ||
          /\b(integration|integrations|provider|providers|connector|connectors|plugin|plugins)\b/i.test(cleaned)
        ) {
          pendingOptionalContext = true;
        } else if (cleaned.length > 0) {
          pendingOptionalContext = false;
        }
        return;
      }

      const lineServices = serviceNamesFromTextLine(rawLine);
      if (lineServices.length === 0) {
        pendingOptionalContext = false;
        return;
      }

      const key = rawLine.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1] ?? "";
      const isOptionalLine =
        pendingOptionalContext ||
        OPTIONAL_SERVICE_README_PATTERN.test(rawLine) ||
        /\b(optional|fallback|only if|if needed)\b/i.test(rawLine) ||
        /^(ENABLE|USE|WITH|OPTIONAL)_/.test(key) ||
        /_(OPTIONAL|ENABLED)$/.test(key);

      lineServices.forEach((service) => {
        if (isOptionalLine) {
          optional.add(service);
          return;
        }
        required.add(service);
      });
    });
  });

  return {
    required: [...required].sort((left, right) => left.localeCompare(right)),
    optional: [...optional]
      .filter((service) => !required.has(service))
      .sort((left, right) => left.localeCompare(right)),
  };
}

function isApiFacingCloudService(service: CloudService) {
  if (["ai", "auth", "payment", "email"].includes(service.kind)) {
    return true;
  }

  if (
    [
      "cloudflare-r2",
      "s3",
      "gcs",
      "azure-blob",
      "minio",
      "pinecone",
      "weaviate",
      "qdrant",
      "milvus",
      "chroma",
      "supabase",
      "firebase",
    ].includes(service.canonicalId)
  ) {
    return true;
  }

  if (service.canonicalId === "redis" && /upstash/i.test(service.label)) {
    return true;
  }

  return false;
}

function canonicalizeCloudServices(labels: string[]): CloudService[] {
  const services = new Map<string, CloudService>();
  const specificityScore = (service: CloudService) => {
    let score = 0;
    if (/upstash|supabase|cloudflare|amazon|google|azure|minio/i.test(service.label)) score += 3;
    if (/pinecone|weaviate|qdrant|milvus|chroma/i.test(service.label)) score += 2;
    if (service.label.length > 10) score += 1;
    return score;
  };

  labels.forEach((label) => {
    const normalized = label.trim();
    if (!normalized) {
      return;
    }
    const service = canonicalCloudService(normalized);
    const existing = services.get(service.canonicalId);
    if (!existing || specificityScore(service) > specificityScore(existing)) {
      services.set(service.canonicalId, service);
    }
  });

  return [...services.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function addRuntime(
  target: Map<RepoEnvRuntime["name"], RepoEnvRuntime>,
  runtime: RepoEnvRuntime | null
) {
  if (!runtime) {
    return;
  }

  const existing = target.get(runtime.name);
  if (!existing) {
    target.set(runtime.name, runtime);
    return;
  }

  if (existing.version && runtime.version) {
    const existingRange = runtimeRangeFromVersion(existing.version);
    const candidateRange = runtimeRangeFromVersion(runtime.version);
    const existingIsBroadRange =
      existingRange.range === "gte" ||
      existingRange.range === "lte" ||
      existingRange.range === "between";
    const candidateIsExact = candidateRange.range === "exact";
    const existingIsKnown = existingRange.range !== "unknown";
    const candidateIsUnknown = candidateRange.range === "unknown";
    const sameMajorFloor =
      existingRange.minMajor !== null &&
      candidateRange.minMajor !== null &&
      existingRange.minMajor === candidateRange.minMajor;

    if (existingIsKnown && candidateIsUnknown) {
      return;
    }

    if (existingIsBroadRange && candidateIsExact && sameMajorFloor) {
      return;
    }
  }

  const candidatePriority = RUNTIME_SOURCE_PRIORITY[runtime.source];
  const existingPriority = RUNTIME_SOURCE_PRIORITY[existing.source];

  if (runtime.version && !existing.version) {
    target.set(runtime.name, runtime);
    return;
  }

  if (candidatePriority > existingPriority) {
    target.set(runtime.name, runtime);
  }
}

function dockerRuntimeFromBaseImage(baseImage: string | null): RepoEnvRuntime | null {
  if (!baseImage) {
    return null;
  }

  const normalized = baseImage.toLowerCase();
  const version = normalizeVersion(baseImage.match(/:(\d+(?:\.\d+){0,2})/)?.[1] ?? null);

  if (/(^|\/)node(?=[:@/-]|$)/.test(normalized)) {
    return { name: "node", version, source: "dockerfile" };
  }
  if (/(^|\/)python(?=[:@/-]|$)/.test(normalized)) {
    return { name: "python", version, source: "dockerfile" };
  }
  if (/(^|\/)(golang|go)(?=[:@/-]|$)/.test(normalized)) {
    return { name: "go", version, source: "dockerfile" };
  }
  if (/(^|\/)rust(?=[:@/-]|$)/.test(normalized)) {
    return { name: "rust", version, source: "dockerfile" };
  }
  if (/(^|\/)(openjdk|eclipse-temurin|java)(?=[:@/-]|$)/.test(normalized)) {
    return { name: "java", version, source: "dockerfile" };
  }
  if (/(^|\/)ruby(?=[:@/-]|$)/.test(normalized)) {
    return { name: "ruby", version, source: "dockerfile" };
  }
  if (/(^|\/)(oven\/bun|bun)(?=[:@/-]|$)/.test(normalized)) {
    return { name: "bun", version, source: "dockerfile" };
  }
  if (/(^|\/)(denoland\/deno|deno)(?=[:@/-]|$)/.test(normalized)) {
    return { name: "deno", version, source: "dockerfile" };
  }

  return null;
}

function firstDockerBaseImage(text: string | null) {
  if (!text) {
    return null;
  }

  const match = text.match(/^\s*FROM\s+([^\s]+).*$/im);
  return normalizeVersion(match?.[1] ?? null);
}

function parseDockerExposedPorts(text: string | null) {
  if (!text) {
    return [];
  }

  const ports = new Set<number>();
  const exposeMatch = text.match(/^\s*EXPOSE\s+(.+)$/im)?.[1] ?? "";
  exposeMatch
    .split(/\s+/)
    .map((token) => Number(token.replace(/\/tcp|\/udp/i, "").trim()))
    .filter((value) => Number.isFinite(value))
    .forEach((value) => ports.add(value));

  return [...ports].sort((left, right) => left - right);
}

function parseComposeServices(text: string | null) {
  if (!text) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const services = new Set<string>();
  let inServices = false;
  let serviceIndent: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    if (!inServices) {
      if (/^\s*services\s*:\s*$/.test(line)) {
        inServices = true;
      }
      continue;
    }

    if (line.trim().length === 0 || /^\s*#/.test(line)) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent === 0) {
      break;
    }

    const match = line.match(/^(\s+)([A-Za-z0-9_-]+)\s*:\s*$/);
    if (!match) {
      continue;
    }

    const currentIndent = match[1]?.length ?? 0;
    if (serviceIndent === null) {
      serviceIndent = currentIndent;
    }

    if (currentIndent === serviceIndent) {
      services.add(match[2] ?? "");
    }
  }

  return [...services].filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function parseComposePorts(text: string | null) {
  if (!text) {
    return [];
  }

  const ports = new Set<number>();
  const lines = text.split(/\r?\n/);

  lines.forEach((line) => {
    if (!/(ports\s*:|-\s*["']?\d)/i.test(line)) {
      return;
    }

    const quotedPort = line.match(/["']([^"']+)["']/)?.[1];
    const candidate = quotedPort ?? line;
    const numericSegments = candidate.match(/\d{2,5}/g) ?? [];
    const last = numericSegments.length > 0 ? Number(numericSegments[numericSegments.length - 1]) : NaN;
    if (Number.isFinite(last)) {
      ports.add(last);
    }
  });

  return [...ports].sort((left, right) => left - right);
}

function composeHasDependsOn(text: string | null) {
  if (!text) {
    return false;
  }

  return /^\s*depends_on\s*:/im.test(text);
}

function composeServiceCount(entries: ScopedConfigText[]) {
  return entries.reduce((max, entry) => Math.max(max, parseComposeServices(entry.text).length), 0);
}

function cleanupReadmeLine(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^\[![a-z]+\]\s*/i, "")
    .replace(/^>\s+/, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function readmeEnvironmentWindow(text: string) {
  return text.slice(0, README_ENVIRONMENT_SCAN_MAX_CHARS);
}

function readmeEnvironmentLines(readmes: ScopedReadme[]) {
  return readmes.flatMap((readme) =>
    readmeEnvironmentWindow(readme.text)
      .split(/\r?\n/)
      .map((line) => ({
        line: cleanupReadmeLine(line),
        scope: readme.scope,
      }))
      .filter((item) => item.line.length >= 4)
  );
}

function readmeHardwareLines(readmes: ScopedReadme[]) {
  const lines = readmeEnvironmentLines(readmes).filter(
    (item) => {
      const hasDiskRequirement = DISK_README_PATTERN.test(item.line);
      const hasHardwareSignal = HARDWARE_SIGNAL_PATTERN.test(item.line);
      const looksLikeServiceNote =
        SERVICE_NOTE_CATEGORY_PATTERN.test(item.line) && !hasDiskRequirement;
      return (
        (hasHardwareSignal || hasDiskRequirement) &&
        !looksLikeServiceNote &&
        !/(cloudflare r2|upstash redis|redis ttl|postgresql service|mongodb atlas)/i.test(item.line)
      );
    }
  );

  const scoreLine = (value: { line: string; scope: ScopedReadme["scope"] }) => {
    let score = 0;
    if (value.scope === "focus") score += 12;
    if (RAM_README_PATTERN.test(value.line)) score += 24;
    if (DISK_README_PATTERN.test(value.line)) score += 20;
    if (GPU_README_PATTERN.test(value.line)) score += 24;
    if (/\b(requires?|required|need|needs|minimum|min|at least|recommended|recommend|권장|최소|필수)\b/i.test(value.line)) {
      score += 14;
    }
    if (/\b(cuda|rtx|vram|apple silicon)\b/i.test(value.line)) score += 10;
    if (value.line.length > 180) score -= 10;
    if (/\b(install|setup|clone|npm|pnpm|yarn|pip|docker build)\b/i.test(value.line)) score -= 12;
    return score;
  };

  return unique(lines.map((item) => item.line))
    .map((line) => ({
      line,
      score: scoreLine(lines.find((item) => item.line === line) ?? { line, scope: "root" }),
    }))
    .sort((left, right) => right.score - left.score || left.line.length - right.line.length)
    .map((item) => item.line)
    .slice(0, 8);
}

function serviceNamesFromReadmeNotes(readmes: ScopedReadme[]) {
  const detected = new Set<string>();
  const qualifierPattern =
    /\b(requires?|required|needs?|depends on|using|uses?|backed by|powered by|connects? to|integrates? with|service|services|database|cache|queue|storage|provider|hosted on|runs on)\b/i;
  const docOnlyPattern =
    /\b(docs?|documentation|tutorial|guide|learn more|blog|paper|research|course|notebook|walkthrough)\b/i;
  const collectServices = (line: string) => {
    serviceNamesFromTextLine(line).forEach((service) => {
      if (
        service !== "OpenAI" ||
        SERVICE_NOTE_CATEGORY_PATTERN.test(line) ||
        /\b(openai api|api key|gpt|chatgpt|responses?|assistants?|models?)\b/i.test(line) ||
        qualifierPattern.test(line)
      ) {
        detected.add(service);
      }
    });
  };

  readmeEnvironmentLines(readmes).forEach(({ line }) => {
    const hasKnownServiceToken =
      /(cloudflare r2|upstash redis|postgres(?:ql)?|mysql|mongodb|redis|openai|anthropic|stripe|supabase|firebase|clerk|auth0|resend|sendgrid|sentry)/i.test(
        line
      );
    const isCategorizedServiceLine = SERVICE_NOTE_CATEGORY_PATTERN.test(line);
    const hasQualifier = qualifierPattern.test(line);
    const looksDocOnly = docOnlyPattern.test(line) && !isCategorizedServiceLine;

    if (
      !hasKnownServiceToken ||
      (!isCategorizedServiceLine && !hasQualifier) ||
      looksDocOnly ||
      OPTIONAL_SERVICE_README_PATTERN.test(line)
    ) {
      return;
    }

    collectServices(line);
  });

  return [...detected];
}

function preferredNumericRequirement(
  lines: string[],
  pattern: RegExp
): { min: number | null; recommended: number | null } {
  let min: number | null = null;
  let recommended: number | null = null;

  lines.forEach((line) => {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const matches = [...line.matchAll(globalPattern)];
    if (matches.length === 0) {
      return;
    }

    const values = matches
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return;
    }

    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    const hasRecommended = /\b(recommended|recommend|권장)\b/i.test(line);
    const hasMinimum = /\b(minimum|min|at least|least|최소)\b/i.test(line);

    if (hasMinimum) {
      min = min === null ? lowest : Math.min(min, lowest);
    }
    if (hasRecommended) {
      recommended = recommended === null ? highest : Math.max(recommended, highest);
    }

    if (hasMinimum || hasRecommended) {
      return;
    }

    if (values.length >= 2) {
      min = min === null ? lowest : Math.min(min, lowest);
      recommended = recommended === null ? highest : Math.max(recommended, highest);
      return;
    }

    if (min === null) {
      min = lowest;
    } else if (recommended === null && lowest >= min) {
      recommended = lowest;
    }
  });

  return { min, recommended };
}

function dependencySignalText(texts: Array<string | null | undefined>) {
  return texts.filter(Boolean).join("\n").toLowerCase();
}

function packageDependencySignal(pkg: PackageJsonShape | null | undefined) {
  return JSON.stringify({
    dependencies: pkg?.dependencies ?? {},
    devDependencies: pkg?.devDependencies ?? {},
    optionalDependencies: pkg?.optionalDependencies ?? {},
    peerDependencies: pkg?.peerDependencies ?? {},
  });
}

function packageDependencyGroups(pkg: PackageJsonShape | null | undefined) {
  return {
    runtime: Object.keys(pkg?.dependencies ?? {}),
    optional: Object.keys(pkg?.optionalDependencies ?? {}),
    peer: Object.keys(pkg?.peerDependencies ?? {}),
    dev: Object.keys(pkg?.devDependencies ?? {}),
  };
}

function serviceNamesFromDependencyNames(dependencyNames: string[]) {
  const dependencySet = new Set(dependencyNames.map((name) => name.toLowerCase()));
  const services = new Set<string>();

  if ([...dependencySet].some((name) => ["pg", "postgres", "@neondatabase/serverless"].includes(name))) {
    services.add("PostgreSQL");
  }
  if ([...dependencySet].some((name) => ["mysql", "mysql2"].includes(name))) {
    services.add("MySQL");
  }
  if ([...dependencySet].some((name) => ["mongodb", "mongoose"].includes(name))) {
    services.add("MongoDB");
  }
  if ([...dependencySet].some((name) => ["redis", "ioredis"].includes(name))) {
    services.add("Redis");
  }
  if ([...dependencySet].some((name) => name === "upstash-redis" || name.includes("upstash"))) {
    services.add("Upstash Redis");
  }
  if ([...dependencySet].some((name) => ["aws-sdk", "@aws-sdk/client-s3", "@aws-sdk/lib-storage", "boto3"].includes(name))) {
    services.add("Amazon S3");
  }
  if ([...dependencySet].some((name) => ["@google-cloud/storage", "gcsfs"].includes(name))) {
    services.add("Google Cloud Storage");
  }
  if (
    [...dependencySet].some((name) =>
      ["@azure/storage-blob", "azure-storage-blob", "azure-storage"].includes(name)
    )
  ) {
    services.add("Azure Blob Storage");
  }
  if ([...dependencySet].some((name) => ["minio", "s3fs"].includes(name))) {
    services.add("MinIO");
  }
  if ([...dependencySet].some((name) => ["wrangler", "@cloudflare/r2", "r2", "cloudflare-r2"].includes(name))) {
    services.add("Cloudflare R2");
  }
  if (dependencySet.has("openai")) {
    services.add("OpenAI");
  }
  if (dependencySet.has("@anthropic-ai/sdk")) {
    services.add("Anthropic");
  }
  if (dependencySet.has("stripe")) {
    services.add("Stripe");
  }
  if ([...dependencySet].some((name) => ["@supabase/supabase-js", "@supabase/ssr"].includes(name))) {
    services.add("Supabase");
  }
  if ([...dependencySet].some((name) => ["firebase", "firebase-admin"].includes(name))) {
    services.add("Firebase");
  }
  if ([...dependencySet].some((name) => ["@clerk/nextjs", "@clerk/clerk-js", "@clerk/backend"].includes(name))) {
    services.add("Clerk");
  }
  if ([...dependencySet].some((name) => ["auth0", "@auth0/auth0-spa-js", "@auth0/nextjs-auth0"].includes(name))) {
    services.add("Auth0");
  }
  if ([...dependencySet].some((name) => ["resend"].includes(name))) {
    services.add("Resend");
  }
  if ([...dependencySet].some((name) => ["@sendgrid/mail", "sendgrid"].includes(name))) {
    services.add("SendGrid");
  }
  if ([...dependencySet].some((name) => ["pinecone", "@pinecone-database/pinecone"].includes(name))) {
    services.add("Pinecone");
  }
  if ([...dependencySet].some((name) => ["weaviate-client", "weaviate-ts-client", "weaviate"].includes(name))) {
    services.add("Weaviate");
  }
  if ([...dependencySet].some((name) => ["@qdrant/js-client-rest", "@qdrant/openapi-typescript-fetch"].includes(name))) {
    services.add("Qdrant");
  }
  if ([...dependencySet].some((name) => ["@zilliz/milvus2-sdk-node", "pymilvus"].includes(name))) {
    services.add("Milvus");
  }
  if ([...dependencySet].some((name) => ["chromadb", "chromadb-client", "chroma-js"].includes(name))) {
    services.add("Chroma");
  }

  return [...services].sort((left, right) => left.localeCompare(right));
}

function serviceSignalsFromDependencies(pkg: PackageJsonShape | null | undefined) {
  const groups = packageDependencyGroups(pkg);
  const runtimeServices = serviceNamesFromDependencyNames(groups.runtime);
  const optionalServices = unique([
    ...serviceNamesFromDependencyNames(groups.optional),
    ...serviceNamesFromDependencyNames(groups.peer),
    ...serviceNamesFromDependencyNames(groups.dev),
  ]).filter((service) => !runtimeServices.includes(service));

  return {
    runtime: runtimeServices,
    optional: optionalServices,
  };
}

function serviceNamesFromComposeServices(services: string[]) {
  const detected = new Set<string>();

  services.forEach((service) => {
    const normalized = service.toLowerCase();
    if (/(^|[-_])(postgres|postgresql)([-_]|$)/.test(normalized)) detected.add("PostgreSQL");
    else if (/(^|[-_])upstash([-_]|$)/.test(normalized) && /redis/.test(normalized)) detected.add("Upstash Redis");
    else if (/(^|[-_])redis([-_]|$)/.test(normalized)) detected.add("Redis");
    else if (/(^|[-_])mysql([-_]|$)/.test(normalized)) detected.add("MySQL");
    else if (/(^|[-_])(mongo|mongodb)([-_]|$)/.test(normalized)) detected.add("MongoDB");
    else if (/(^|[-_])(minio)([-_]|$)/.test(normalized)) detected.add("MinIO");
    else if (/(^|[-_])(qdrant|weaviate|pinecone|milvus|chroma)([-_]|$)/.test(normalized)) {
      if (/qdrant/.test(normalized)) detected.add("Qdrant");
      if (/weaviate/.test(normalized)) detected.add("Weaviate");
      if (/pinecone/.test(normalized)) detected.add("Pinecone");
      if (/milvus/.test(normalized)) detected.add("Milvus");
      if (/chroma/.test(normalized)) detected.add("Chroma");
    }
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function serviceNamesFromComposeText(texts: string[]) {
  const signal = texts.join("\n").toLowerCase();
  const detected = new Set<string>();

  if (/\bpostgres(?:ql)?\b/.test(signal)) detected.add("PostgreSQL");
  if (/upstash redis/.test(signal)) detected.add("Upstash Redis");
  if (/\bredis\b/.test(signal) && !detected.has("Upstash Redis")) detected.add("Redis");
  if (/\bmysql\b/.test(signal)) detected.add("MySQL");
  if (/\bmongo(?:db)?\b/.test(signal)) detected.add("MongoDB");
  if (/cloudflare r2/.test(signal)) detected.add("Cloudflare R2");
  if (/\b(amazon s3|aws s3)\b/.test(signal)) detected.add("Amazon S3");
  if (/\b(gcs|google cloud storage)\b/.test(signal)) detected.add("Google Cloud Storage");
  if (/\bazure blob\b/.test(signal)) detected.add("Azure Blob Storage");
  if (/\bminio\b/.test(signal)) detected.add("MinIO");
  if (/\bpinecone\b/.test(signal)) detected.add("Pinecone");
  if (/\bweaviate\b/.test(signal)) detected.add("Weaviate");
  if (/\bqdrant\b/.test(signal)) detected.add("Qdrant");
  if (/\bmilvus\b/.test(signal)) detected.add("Milvus");
  if (/\bchroma(?:db)?\b/.test(signal)) detected.add("Chroma");

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function serviceNamesFromPaths(paths: string[]) {
  const detected = new Set<string>();

  paths.forEach((path) => {
    const normalized = path.toLowerCase();
    if (
      !/(^|\/)(docker|deploy|infra|ops|config|configs|db|database|migrations?|scaling)(\/|$)/.test(
        normalized
      )
    ) {
      return;
    }
    if (/(^|\/)(postgres|postgresql)([\/._-]|$)/.test(normalized)) detected.add("PostgreSQL");
    if (/(^|\/)redis([\/._-]|$)/.test(normalized)) detected.add("Redis");
    if (/(^|\/)upstash([\/._-]|$)/.test(normalized)) detected.add("Upstash Redis");
    if (/(^|\/)mysql([\/._-]|$)/.test(normalized)) detected.add("MySQL");
    if (/(^|\/)(mongo|mongodb)([\/._-]|$)/.test(normalized)) detected.add("MongoDB");
    if (/(^|\/)(r2|cloudflare-r2)([\/._-]|$)/.test(normalized)) detected.add("Cloudflare R2");
    if (/(^|\/)(s3|minio)([\/._-]|$)/.test(normalized)) detected.add("Amazon S3");
    if (/(^|\/)(pinecone|weaviate|qdrant|milvus|chroma)([\/._-]|$)/.test(normalized)) {
      if (/pinecone/.test(normalized)) detected.add("Pinecone");
      if (/weaviate/.test(normalized)) detected.add("Weaviate");
      if (/qdrant/.test(normalized)) detected.add("Qdrant");
      if (/milvus/.test(normalized)) detected.add("Milvus");
      if (/chroma/.test(normalized)) detected.add("Chroma");
    }
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function optionalServiceNamesFromReadmeNotes(readmes: ScopedReadme[]) {
  const detected = new Set<string>();
  const qualifierPattern =
    /\b(requires?|required|needs?|depends on|using|uses?|backed by|powered by|connects? to|integrates? with|service|services|database|cache|queue|storage|provider|hosted on|runs on)\b/i;
  const collectServices = (line: string) => {
    serviceNamesFromTextLine(line).forEach((service) => detected.add(service));
  };

  readmeEnvironmentLines(readmes).forEach(({ line }) => {
    if (!OPTIONAL_SERVICE_README_PATTERN.test(line) && !/\boptional\b/i.test(line)) {
      return;
    }
    if (
      !/(cloudflare r2|upstash redis|postgres(?:ql)?|mysql|mongodb|redis|openai|anthropic|stripe|supabase|firebase|clerk|auth0|resend|sendgrid|sentry)/i.test(
        line
      )
    ) {
      return;
    }
    if (!qualifierPattern.test(line) && !SERVICE_NOTE_CATEGORY_PATTERN.test(line)) {
      return;
    }
    collectServices(line);
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function optionalServiceNamesFromEnvUsages(selectedFileContents: Record<string, string> | undefined) {
  const detected = new Set<string>();

  Object.values(selectedFileContents ?? {}).forEach((text) => {
    const matches = text.matchAll(
      /(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)\s*(?:\?\?|\|\|)\s*(?:["'`].*?["'`]|[A-Z0-9_./:-]+)/g
    );

    for (const match of matches) {
      const service = serviceFromEnvKey(match[1] ?? "");
      if (service) {
        detected.add(service);
      }
    }
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function pythonVersionFromSetupPy(text: string) {
  return normalizeVersion(text.match(/python_requires\s*=\s*["']([^"']+)["']/i)?.[1] ?? null);
}

function pythonVersionFromSetupCfg(text: string) {
  return normalizeVersion(text.match(/^\s*python_requires\s*=\s*([^\n#]+)/im)?.[1] ?? null);
}

function pythonVersionFromEnvironmentYml(text: string) {
  const match = text.match(/^\s*-\s*python(?:\s*[=><!~]=?\s*|=)([0-9][^\s#]*)/im);
  return normalizeVersion(match?.[1] ?? null);
}

function isDirectEnvironmentConfigPath(path: string, focusRoot: string | null, basenames: string[]) {
  if (basenames.includes(path)) {
    return true;
  }

  return Boolean(
    focusRoot &&
      basenames.some((name) => path === `${focusRoot}/${name}`)
  );
}

function serviceNamesFromSchemaProviders(selectedFileContents: Record<string, string> | undefined) {
  const detected = new Set<string>();

  Object.entries(selectedFileContents ?? {}).forEach(([path, text]) => {
    if (!/schema\.prisma$/i.test(path)) {
      return;
    }

    const provider = text.match(/provider\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!provider) {
      return;
    }

    if (provider === "postgresql") detected.add("PostgreSQL");
    if (provider === "mysql") detected.add("MySQL");
    if (provider === "mongodb") detected.add("MongoDB");
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function serviceNamesFromSemanticSignals(semanticSignals: SemanticSignals) {
  const detected = new Set<string>();

  semanticSignals.externalServices.forEach((item) => {
    item.names.forEach((name) => detected.add(name));
  });

  semanticSignals.dbClients.forEach((item) => {
    item.names.forEach((name) => {
      if (name === "Supabase" || name === "Firebase") {
        detected.add(name);
      }
      if (name === "Mongoose") {
        detected.add("MongoDB");
      }
    });
  });

  return [...detected].sort((left, right) => left.localeCompare(right));
}

function deployTargetFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (/(^|\.)(vercel\.app|vercel\.com)$/.test(hostname)) return "Vercel";
    if (/(^|\.)(railway\.app)$/.test(hostname)) return "Railway";
    if (/(^|\.)(fly\.io|fly\.dev)$/.test(hostname)) return "Fly.io";
    if (/(^|\.)(render\.com|onrender\.com)$/.test(hostname)) return "Render";
    if (/(^|\.)(netlify\.app|netlify\.com)$/.test(hostname)) return "Netlify";
    if (/(^|\.)(github\.io)$/.test(hostname)) return "GitHub Pages";
    if (/(^|\.)(amazonaws\.com|awsapps\.com)$/.test(hostname)) return "AWS";
    if (/(^|\.)(run\.app|appspot\.com|cloudfunctions\.net)$/.test(hostname)) return "GCP";
    if (/(^|\.)(azurewebsites\.net|azurecontainerapps\.io)$/.test(hostname)) return "Azure";
  } catch {
    return null;
  }

  return null;
}

function deployTargetsFromReadmeMentions(readmes: ScopedReadme[]) {
  const targets = new Set<string>();

  readmeEnvironmentLines(readmes).forEach(({ line }) => {
    if (/\bvercel\b/i.test(line)) targets.add("Vercel");
    if (/\brailway\b/i.test(line)) targets.add("Railway");
    if (/\bfly(?:\.io)?\b/i.test(line)) targets.add("Fly.io");
    if (/\brender\b/i.test(line)) targets.add("Render");
    if (/\bnetlify\b/i.test(line)) targets.add("Netlify");
    if (/\bgithub pages\b/i.test(line)) targets.add("GitHub Pages");
    if (/\bdeploy\b/i.test(line) && /\bdocker\b/i.test(line)) targets.add("Docker");
  });

  return [...targets];
}

function detectDockerRole(args: {
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  dockerPaths: string[];
  composePaths: string[];
  readmes: ScopedReadme[];
}) {
  if (!args.hasDockerfile && !args.hasDockerCompose) {
    return "none" as const;
  }

  const allPaths = [...args.dockerPaths, ...args.composePaths];
  const dockerReadmeLines = readmeEnvironmentLines(args.readmes)
    .map((item) => item.line)
    .filter((line) => /\bdocker\b/i.test(line));
  const hasRequiredDockerCommand = dockerReadmeLines.some((line) =>
    DOCKER_REQUIRED_COMMAND_PATTERN.test(line)
  );
  const hasNonDockerRunHint = readmeEnvironmentLines(args.readmes).some(({ line }) =>
    NON_DOCKER_RUN_HINT_PATTERN.test(line)
  );
  const hasDeployDockerHint = dockerReadmeLines.some((line) => DOCKER_DEPLOY_LINE_PATTERN.test(line));
  const hasOptionalDevPath = allPaths.some((path) => DOCKER_OPTIONAL_DEV_PATH_PATTERN.test(path));
  const hasOptionalDeployPath = allPaths.some((path) => DOCKER_OPTIONAL_DEPLOY_PATH_PATTERN.test(path));

  if (hasRequiredDockerCommand && !hasNonDockerRunHint) {
    return "required" as const;
  }
  if (hasOptionalDeployPath || hasDeployDockerHint) {
    return "optional-deploy" as const;
  }
  if (hasOptionalDevPath) {
    return "optional-dev" as const;
  }
  if (args.hasDockerCompose) {
    return "recommended" as const;
  }
  return "optional" as const;
}

function sortDeployTargets(targets: Iterable<string>) {
  return [...new Set(targets)].sort((left, right) => {
    const leftIndex = DEPLOY_TARGET_PRIORITY.indexOf(left as (typeof DEPLOY_TARGET_PRIORITY)[number]);
    const rightIndex = DEPLOY_TARGET_PRIORITY.indexOf(right as (typeof DEPLOY_TARGET_PRIORITY)[number]);
    const normalizedLeft = leftIndex === -1 ? DEPLOY_TARGET_PRIORITY.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? DEPLOY_TARGET_PRIORITY.length : rightIndex;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

function runtimeDisplayVersion(name: RepoEnvRuntime["name"], version: string | null) {
  return version;
}

function gpuHintFromSignals(args: {
  readmeHardwareNotes: string[];
  dependencyTexts: string[];
  dockerText: string | null;
}) {
  const readmeHint =
    args.readmeHardwareNotes.find((line) => /\bcuda\s*12\b/i.test(line)) ??
    args.readmeHardwareNotes.find((line) => /\bapple silicon\b|\bmps\b/i.test(line)) ??
    args.readmeHardwareNotes.find((line) => /\bvram\b/i.test(line)) ??
    args.readmeHardwareNotes.find((line) => GPU_README_PATTERN.test(line)) ??
    null;

  if (readmeHint) {
    return readmeHint;
  }

  const signal = dependencySignalText([...args.dependencyTexts, args.dockerText]);
  const cudaVersion =
    signal.match(/\bcuda(?:[-_\s]?|=)(\d{1,2})(?:\.(\d+))?/i)?.[0] ??
    signal.match(/\bcu(11|12)\d?\b/i)?.[0] ??
    null;

  if (cudaVersion) {
    const normalized = cudaVersion
      .replace(/^cu/i, "CUDA ")
      .replace(/[_=-]+/g, " ")
      .trim();
    return `${normalized} 호환 GPU 권장`;
  }
  if (/\bapple silicon\b|\bmps\b/i.test(signal)) {
    return "Apple Silicon MPS 권장";
  }
  if (/\b(cuda|nvidia|pytorch-cuda|onnxruntime-gpu|tensorflow-gpu|cupy|jax\[cuda\])\b/i.test(signal)) {
    return "CUDA 지원 GPU 권장";
  }

  return null;
}

function preferredNumericValue(
  lines: string[],
  pattern: RegExp
) {
  let preferred: number | null = null;

  lines.forEach((line) => {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const values = [...line.matchAll(globalPattern)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return;
    }

    const highest = Math.max(...values);
    preferred = preferred === null ? highest : Math.max(preferred, highest);
  });

  return preferred;
}

function detectMinimumVramGb(args: {
  readmeHardwareNotes: string[];
  signalTexts: string[];
}) {
  const explicit = preferredNumericValue(args.readmeHardwareNotes, VRAM_README_PATTERN);
  if (explicit !== null) {
    return explicit;
  }

  const signal = dependencySignalText(args.signalTexts);
  let inferred: number | null = null;

  if (/\b(bitsandbytes|load_in_4bit|load_in_8bit|device_map\s*=\s*["']auto["'])\b/i.test(signal)) {
    inferred = 16;
  }

  MODEL_VRAM_HINTS.forEach(({ pattern, vram }) => {
    if (pattern.test(signal)) {
      inferred = inferred === null ? vram : Math.max(inferred, vram);
    }
  });

  return inferred;
}

function detectCpuArch(args: {
  signalTexts: string[];
  dockerTexts: string[];
}) {
  const signal = dependencySignalText([...args.signalTexts, ...args.dockerTexts]);

  if (MPS_ACCELERATOR_PATTERN.test(signal)) {
    return "apple-silicon-ok" as const;
  }
  if (ARM64_PLATFORM_PATTERN.test(signal)) {
    return "arm64" as const;
  }
  if (AMD64_PLATFORM_PATTERN.test(signal) || CUDA_ACCELERATOR_PATTERN.test(signal)) {
    return "x64" as const;
  }

  return "any" as const;
}

function detectAcceleratorPreference(args: {
  signalTexts: string[];
  gpuRequired: boolean;
}) {
  const signal = dependencySignalText(args.signalTexts);

  if (MPS_ACCELERATOR_PATTERN.test(signal)) {
    return "mps" as const;
  }
  if (ROCM_ACCELERATOR_PATTERN.test(signal)) {
    return "rocm" as const;
  }
  if (CUDA_ACCELERATOR_PATTERN.test(signal) && args.gpuRequired) {
    return "cuda" as const;
  }
  if (CPU_OK_PATTERN.test(signal)) {
    return "cpu-ok" as const;
  }

  return null;
}

function deployTargetsFromPathSignals(paths: string[]) {
  const targets = new Set<string>();

  paths.forEach((path) => {
    const normalized = path.toLowerCase();
    const name = basename(path).toLowerCase();

    if (name === "vercel.json") targets.add("Vercel");
    if (name === "render.yaml" || name === "render.yml") targets.add("Render");
    if (name === "fly.toml") targets.add("Fly.io");
    if (name === "railway.json") targets.add("Railway");
    if (name === "netlify.toml") targets.add("Netlify");
    if (name === "procfile") targets.add("Self-host");
    if (name === "serverless.yml" || name === "serverless.yaml") targets.add("AWS");
    if (name === "template.yml" || name === "template.yaml") targets.add("AWS");
    if (AWS_TERRAFORM_PATH_PATTERN.test(normalized)) targets.add("AWS");
    if (GCP_TERRAFORM_PATH_PATTERN.test(normalized)) targets.add("GCP");
    if (AZURE_TERRAFORM_PATH_PATTERN.test(normalized)) targets.add("Azure");
    if (K8S_PATH_PATTERN.test(normalized) || TERRAFORM_PATH_PATTERN.test(normalized)) targets.add("Self-host");
    if (DEPLOY_WORKFLOW_PATTERN.test(normalized)) targets.add("Self-host");
  });

  return [...targets];
}

function deployTargetsFromConfigContent(entries: ScopedConfigText[]) {
  const targets = new Set<string>();

  entries.forEach((entry) => {
    const name = basename(entry.path).toLowerCase();
    const text = entry.text.toLowerCase();

    if (name === "vercel.json") targets.add("Vercel");
    if (name === "render.yaml" || name === "render.yml") targets.add("Render");
    if (name === "fly.toml") targets.add("Fly.io");
    if (name === "railway.json") targets.add("Railway");
    if (name === "netlify.toml") targets.add("Netlify");
    if (name === "procfile") targets.add("Self-host");
    if (name === "serverless.yml" || name === "serverless.yaml") {
      if (/\bprovider\s*:\s*aws\b/.test(text) || /\bfunctions?\s*:/i.test(text)) targets.add("AWS");
      if (/\bprovider\s*:\s*google\b/.test(text)) targets.add("GCP");
      if (/\bprovider\s*:\s*azure\b/.test(text)) targets.add("Azure");
    }
    if ((name === "template.yml" || name === "template.yaml") && /aws::/i.test(text)) {
      targets.add("AWS");
    }
    if (/google-github-actions|gcloud|artifact registry|cloud run|app engine/i.test(text)) {
      targets.add("GCP");
    }
    if (/azure\/login|az login|azure functions|azurerm/i.test(text)) {
      targets.add("Azure");
    }
    if (/aws-actions\/configure-aws-credentials|aws cloudformation|aws lambda|dynamodb/i.test(text)) {
      targets.add("AWS");
    }
  });

  return [...targets];
}

function detectRequiredDeployTarget(args: {
  allPaths: string[];
  signalTexts: string[];
}) {
  const signal = dependencySignalText(args.signalTexts);
  const normalizedPaths = args.allPaths.map((path) => path.toLowerCase());
  const scores = new Map<string, number>();
  const addScore = (target: string, amount: number) => {
    scores.set(target, (scores.get(target) ?? 0) + amount);
  };

  if (normalizedPaths.some((path) => AWS_TERRAFORM_PATH_PATTERN.test(path) || /(^|\/)(sam|lambda)(\/|$)/i.test(path))) {
    addScore("AWS", 3);
  }
  if (/\b(aws lambda|aws::lambda|aws::dynamodb|aws-actions\/configure-aws-credentials|@aws-sdk\/|boto3\.client\(['"](dynamodb|s3|lambda)['"]\))\b/i.test(signal)) {
    addScore("AWS", 2);
  }
  if (/\b(dynamodb|lambda handler|handler\.|events?:\s*- http)\b/i.test(signal)) {
    addScore("AWS", 1);
  }

  if (normalizedPaths.some((path) => GCP_TERRAFORM_PATH_PATTERN.test(path) || /(^|\/)(cloudbuild|app\.ya?ml)(\/|$)/i.test(path))) {
    addScore("GCP", 3);
  }
  if (/\b(@google-cloud\/|google-github-actions|cloud run|app engine|artifact registry|gcloud)\b/i.test(signal)) {
    addScore("GCP", 2);
  }
  if (/\b(cloud run|app engine)\b/i.test(signal)) {
    addScore("GCP", 1);
  }

  if (normalizedPaths.some((path) => AZURE_TERRAFORM_PATH_PATTERN.test(path) || /(^|\/)(host\.json|function\.json)(\/|$)/i.test(path))) {
    addScore("Azure", 3);
  }
  if (/\b(@azure\/|azure functions|azurerm|azure\/login)\b/i.test(signal)) {
    addScore("Azure", 2);
  }
  if (/\b(azure functions|function app)\b/i.test(signal)) {
    addScore("Azure", 1);
  }

  if (normalizedPaths.some((path) => /(^|\/)vercel\.json$/i.test(path))) {
    addScore("Vercel", 2);
  }
  if (/\b(@vercel\/|edge-config|vercel blob|vercel kv|process\.env\.vercel)\b/i.test(signal)) {
    addScore("Vercel", 2);
  }
  if (/\bdeploy on vercel\b/i.test(signal)) {
    addScore("Vercel", 1);
  }

  if (normalizedPaths.some((path) => /(^|\/)railway\.json$/i.test(path))) {
    addScore("Railway", 2);
  }
  if (/\brailway\b/i.test(signal) && /\b(runtime|service|database)\b/i.test(signal)) {
    addScore("Railway", 1);
  }
  if (/\bdeploy on railway\b/i.test(signal)) {
    addScore("Railway", 1);
  }

  if (normalizedPaths.some((path) => /(^|\/)fly\.toml$/i.test(path))) {
    addScore("Fly.io", 2);
  }
  if (/\bfly(?:\.io)?\b/i.test(signal) && /\b(machine|volume|deploy)\b/i.test(signal)) {
    addScore("Fly.io", 1);
  }

  if (normalizedPaths.some((path) => /(^|\/)render\.(ya?ml)$/i.test(path))) {
    addScore("Render", 2);
  }
  if (/\brender\b/i.test(signal) && /\b(blueprint|service)\b/i.test(signal)) {
    addScore("Render", 1);
  }
  if (/\bdeploy on render\b/i.test(signal)) {
    addScore("Render", 1);
  }

  if (normalizedPaths.some((path) => /(^|\/)netlify\.toml$/i.test(path))) {
    addScore("Netlify", 2);
  }
  if (/\bnetlify\b/i.test(signal) && /\b(functions?|edge functions?)\b/i.test(signal)) {
    addScore("Netlify", 1);
  }
  if (/\bdeploy on netlify\b/i.test(signal)) {
    addScore("Netlify", 1);
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    return null;
  }

  if (!HARD_REQUIRED_DEPLOY_TARGET_CANDIDATES.has(top[0])) {
    return null;
  }

  if (top[1] < 4) {
    return null;
  }

  if (second && top[1] - second[1] < 2) {
    return null;
  }

  return top[0];
}

function detectRuntimeMode(args: {
  allPaths: string[];
  readmes: ScopedReadme[];
  signalTexts: string[];
  deployTargets: string[];
  deployTargetRequired: string | null;
}) {
  const normalizedPaths = args.allPaths.map((path) => path.toLowerCase());
  const signal = dependencySignalText(args.signalTexts);
  const hasCliSurface =
    normalizedPaths.some((path) => /(^|\/)(bin\/|cli(\.|\/)|commands?\/)/i.test(path)) ||
    /\b(bin|cli)\s*[:=]|\bcommand line\b/i.test(signal);

  if (
    args.deployTargetRequired ||
    normalizedPaths.some((path) => K8S_PATH_PATTERN.test(path) || TERRAFORM_PATH_PATTERN.test(path))
  ) {
    return "cloud-required" as const;
  }

  const hasLocalSignals =
    readmeEnvironmentLines(args.readmes).some(({ line }) => LOCAL_RUNTIME_HINT_PATTERN.test(line)) ||
    LOCAL_RUNTIME_HINT_PATTERN.test(signal);
  const hasCloudSignals =
    args.deployTargets.length > 0 ||
    normalizedPaths.some((path) => DEPLOY_WORKFLOW_PATTERN.test(path) || /(^|\/)(procfile|vercel\.json|render\.(ya?ml)|fly\.toml|netlify\.toml)$/i.test(path));

  if (hasLocalSignals && !hasCloudSignals) {
    return "local-only" as const;
  }

  if (hasCliSurface && !hasCloudSignals) {
    return "local-only" as const;
  }

  return "local-or-cloud" as const;
}

function costDriversFromSignals(args: {
  signalTexts: string[];
  requiredServices: CloudService[];
  optionalServices: CloudService[];
  hardware: {
    gpuRequired: boolean;
    minVramGb?: number | null;
  };
  deployTargets: string[];
  runtimeMode: "local-only" | "local-or-cloud" | "cloud-required";
}) {
  const signal = dependencySignalText(args.signalTexts);
  const drivers = new Map<string, { kind: "llm" | "gpu" | "saas" | "storage"; note: string }>();
  const push = (kind: "llm" | "gpu" | "saas" | "storage", note: string) => {
    const key = `${kind}:${note}`;
    if (!drivers.has(key)) {
      drivers.set(key, { kind, note });
    }
  };

  if (LLM_COST_PATTERN.test(signal) || args.requiredServices.some((service) => service.kind === "ai")) {
    push("llm", "LLM API 호출 비용이 들어갈 수 있습니다.");
  }
  if (args.hardware.gpuRequired || (args.hardware.minVramGb ?? 0) > 0) {
    push("gpu", "GPU 또는 VRAM 자원이 필요한 워크로드 신호가 있습니다.");
  }
  if (
    SAAS_COST_PATTERN.test(signal) ||
    [...args.requiredServices, ...args.optionalServices].some((service) =>
      ["auth", "payment", "email", "infra"].includes(service.kind)
    )
  ) {
    push("saas", "외부 SaaS 계정이나 유료 플랜이 필요할 수 있습니다.");
  }
  if (
    STORAGE_COST_PATTERN.test(signal) ||
    [...args.requiredServices, ...args.optionalServices].some((service) =>
      /cloudflare-r2|s3|gcs|blob|redis/.test(service.canonicalId)
    )
  ) {
    push("storage", "스토리지나 캐시 인프라 비용이 들어갈 수 있습니다.");
  }
  if (
    OBJECT_STORAGE_COST_PATTERN.test(signal) ||
    [...args.requiredServices, ...args.optionalServices].some((service) =>
      ["cloudflare-r2", "s3", "gcs", "azure-blob", "minio"].includes(service.canonicalId)
    )
  ) {
    push("storage", "오브젝트 스토리지 비용이 들어갈 수 있습니다.");
  }
  if (
    VECTOR_DB_COST_PATTERN.test(signal) ||
    [...args.requiredServices, ...args.optionalServices].some((service) =>
      ["pinecone", "weaviate", "qdrant", "milvus", "chroma"].includes(service.canonicalId)
    )
  ) {
    push("saas", "벡터 DB 또는 검색 인프라 비용이 들어갈 수 있습니다.");
  }
  if (args.runtimeMode === "cloud-required" || args.deployTargets.includes("Self-host")) {
    push("saas", "운영 인프라 또는 호스팅 비용이 발생할 수 있습니다.");
  }

  return [...drivers.values()];
}

function buildCostEstimate(args: {
  drivers: Array<{ kind: "llm" | "gpu" | "saas" | "storage"; note: string }>;
  runtimeMode: "local-only" | "local-or-cloud" | "cloud-required";
  deployTargets: string[];
}) {
  const hasGpu = args.drivers.some((driver) => driver.kind === "gpu");
  const hasLlm = args.drivers.some((driver) => driver.kind === "llm");
  const hasStorage = args.drivers.some((driver) => driver.kind === "storage");
  const hasSaas = args.drivers.some((driver) => driver.kind === "saas");
  const hasVectorInfra = args.drivers.some((driver) => /벡터 db|검색 인프라/i.test(driver.note));
  const prodSignals = args.runtimeMode === "cloud-required" || args.deployTargets.includes("Self-host");

  if (prodSignals) {
    return {
      tier: "prod" as const,
      monthlyUsdLow: 200,
      monthlyUsdHigh: null,
      drivers: args.drivers,
    };
  }
  if (hasGpu) {
    return {
      tier: "under_200" as const,
      monthlyUsdLow: 50,
      monthlyUsdHigh: 200,
      drivers: args.drivers,
    };
  }
  if (hasLlm && hasVectorInfra) {
    return {
      tier: "under_200" as const,
      monthlyUsdLow: 20,
      monthlyUsdHigh: 200,
      drivers: args.drivers,
    };
  }
  if (hasLlm) {
    return {
      tier: "under_50" as const,
      monthlyUsdLow: 10,
      monthlyUsdHigh: 50,
      drivers: args.drivers,
    };
  }
  if (hasStorage || hasSaas) {
    return {
      tier: "under_10" as const,
      monthlyUsdLow: 0,
      monthlyUsdHigh: 10,
      drivers: args.drivers,
    };
  }

  return {
    tier: "free" as const,
    monthlyUsdLow: 0,
    monthlyUsdHigh: 0,
    drivers: args.drivers,
  };
}

function buildEnvironmentGuide(args: {
  repo: RepoAnalysis["repo"];
  allPaths: string[];
  pkg?: PackageJsonShape | null;
  semanticSignals: SemanticSignals;
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}): RepoEnvironmentGuide {
  const runtimes = new Map<RepoEnvRuntime["name"], RepoEnvRuntime>();
  const focusPkg = workspacePackageJson(args.selectedFileContents, args.focusRoot);
  const hasNestedWorkspacePackages = args.allPaths.some((path) =>
    /(^|\/)(apps|packages|services|projects)\/[^/]+\/package\.json$/i.test(path)
  );
  const rootPkgText = JSON.stringify(args.pkg ?? {});
  const focusPkgText = workspacePackageJsonText(args.selectedFileContents, args.focusRoot);
  const readmes = findScopedReadmes({
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });
  const dockerEntries = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["Dockerfile"],
    matchBasename: (name) => DOCKERFILE_LIKE_NAME_PATTERN.test(name),
  });
  const composeEntries = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
    matchBasename: (name) => COMPOSE_LIKE_NAME_PATTERN.test(name),
  });
  const nodeVersionFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: [".nvmrc", ".node-version"],
  });
  const pythonVersionFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: [".python-version"],
  });
  const pyprojectFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["pyproject.toml"],
  });
  const pipfileFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["Pipfile"],
  });
  const requirementsFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["requirements.txt"],
  });
  const setupPyFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["setup.py"],
  });
  const setupCfgFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["setup.cfg"],
  });
  const environmentYmlFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["environment.yml", "environment.yaml"],
  });
  const goModFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["go.mod"],
  });
  const cargoFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["Cargo.toml"],
  });
  const rustToolchainFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["rust-toolchain.toml", "rust-toolchain"],
  });
  const denoFiles = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["deno.json", "deno.jsonc"],
  });
  const deployConfigEntries = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: ["vercel.json", "render.yaml", "render.yml", "fly.toml", "railway.json", "netlify.toml"],
  });
  const envExampleEntries = collectScopedConfigTexts({
    focusRoot: args.focusRoot,
    selectedFileContents: args.selectedFileContents,
    names: [...ENVIRONMENT_EXAMPLE_FILE_NAMES],
  });
  const representativeDocker = pickRepresentativeConfigEntry(dockerEntries, (entry) =>
    scoreRepresentativeDockerEntry(entry, args.repo, args.focusRoot)
  )?.entry ?? null;
  const representativeCompose = pickRepresentativeConfigEntry(composeEntries, (entry) =>
    scoreRepresentativeComposeEntry(entry, args.repo, args.focusRoot)
  );
  const selectedContentEntries = Object.entries(args.selectedFileContents ?? {});
  const selectedContentTexts = selectedContentEntries.map(([, text]) => text);
  const environmentSignalTexts = [
    args.readmeText ?? null,
    rootPkgText,
    focusPkgText,
    ...selectedContentTexts,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  [
    focusPkg
      ? {
          name: "node" as const,
          version: normalizeVersion(focusPkg.engines?.node ?? null),
          source: "package_json" as const,
        }
      : null,
    args.pkg
      ? {
          name: "node" as const,
          version: normalizeVersion(args.pkg.engines?.node ?? null),
          source: "package_json" as const,
        }
      : null,
    focusPkg?.engines?.bun
      ? {
          name: "bun" as const,
          version: normalizeVersion(focusPkg.engines?.bun ?? null),
          source: "package_json" as const,
        }
      : null,
    args.pkg?.engines?.bun
      ? {
          name: "bun" as const,
          version: normalizeVersion(args.pkg.engines?.bun ?? null),
          source: "package_json" as const,
        }
      : null,
  ].forEach((runtime) => addRuntime(runtimes, runtime));

  nodeVersionFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "node",
      version: normalizeVersion(entry.text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null),
      source: basename(entry.path) === ".node-version" ? "node_version" : "nvmrc",
    });
  });

  pyprojectFiles.forEach((entry) => {
    const version = normalizeVersion(entry.text.match(/requires-python\s*=\s*["']([^"']+)["']/i)?.[1] ?? null);
    addRuntime(runtimes, {
      name: "python",
      version,
      source: "pyproject",
    });
  });

  pythonVersionFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "python",
      version: normalizeVersion(entry.text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null),
      source: "python_version",
    });
  });

  pipfileFiles.forEach((entry) => {
    const version = normalizeVersion(
      entry.text.match(/python_(?:full_)?version\s*=\s*["']([^"']+)["']/i)?.[1] ?? null
    );
    addRuntime(runtimes, {
      name: "python",
      version,
      source: "pipfile",
    });
  });

  requirementsFiles.forEach(() => {
    addRuntime(runtimes, {
      name: "python",
      version: null,
      source: "requirements_txt",
    });
  });

  setupPyFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "python",
      version: pythonVersionFromSetupPy(entry.text),
      source: "setup_py",
    });
  });

  setupCfgFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "python",
      version: pythonVersionFromSetupCfg(entry.text),
      source: "setup_cfg",
    });
  });

  environmentYmlFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "python",
      version: pythonVersionFromEnvironmentYml(entry.text),
      source: "environment_yml",
    });
  });

  goModFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "go",
      version: normalizeVersion(entry.text.match(/^\s*go\s+([^\s]+)\s*$/im)?.[1] ?? null),
      source: "go_mod",
    });
  });

  cargoFiles.forEach((entry) => {
    addRuntime(runtimes, {
      name: "rust",
      version: normalizeVersion(entry.text.match(/rust-version\s*=\s*["']([^"']+)["']/i)?.[1] ?? null),
      source: "cargo_toml",
    });
  });

  rustToolchainFiles.forEach((entry) => {
    const version =
      normalizeVersion(entry.text.match(/channel\s*=\s*["']([^"']+)["']/i)?.[1] ?? null) ??
      normalizeVersion(entry.text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null);
    addRuntime(runtimes, {
      name: "rust",
      version,
      source: "rust_toolchain",
    });
  });

  denoFiles.forEach(() => {
    addRuntime(runtimes, {
      name: "deno",
      version: null,
      source: "deno_json",
    });
  });

  const baseImage = firstDockerBaseImage(representativeDocker?.text ?? null);
  addRuntime(runtimes, dockerRuntimeFromBaseImage(baseImage));

  const exposedPorts = unique([
    ...parseDockerExposedPorts(representativeDocker?.text ?? null),
    ...parseComposePorts(representativeCompose?.entry.text ?? null),
  ]).sort((left, right) => left - right);
  const composeServices = unique(parseComposeServices(representativeCompose?.entry.text ?? null));
  const composeServiceCountValue = composeServiceCount(composeEntries);
  const needsMultiContainer =
    composeServiceCountValue >= 2 &&
    (composeEntries.some((entry) => composeHasDependsOn(entry.text)) ||
      composeEntries.some((entry) => parseComposePorts(entry.text).length > 0));
  const container = {
    hasDockerfile:
      dockerEntries.length > 0 ||
      args.allPaths.some((path) => DOCKERFILE_LIKE_NAME_PATTERN.test(basename(path))),
    hasDockerCompose:
      composeEntries.length > 0 ||
      args.allPaths.some((path) => COMPOSE_LIKE_NAME_PATTERN.test(basename(path))),
    baseImage,
    exposedPorts,
    composeServices,
    composeServiceCount: composeServiceCountValue,
    needsMultiContainer,
    dockerRole: detectDockerRole({
      hasDockerfile:
        dockerEntries.length > 0 ||
        args.allPaths.some((path) => DOCKERFILE_LIKE_NAME_PATTERN.test(basename(path))),
      hasDockerCompose:
        composeEntries.length > 0 ||
        args.allPaths.some((path) => COMPOSE_LIKE_NAME_PATTERN.test(basename(path))),
      dockerPaths: dockerEntries.map((entry) => entry.path),
      composePaths: composeEntries.map((entry) => entry.path),
      readmes,
    }),
  };

  const readmeHardwareNotes = readmeHardwareLines(readmes);
  const readmeRequiredServices = serviceNamesFromReadmeNotes(readmes);
  const readmeDeployTargets = deployTargetsFromReadmeMentions(readmes);
  const ramRequirement = preferredNumericRequirement(readmeHardwareNotes, RAM_README_PATTERN);
  const diskRequirement = preferredNumericRequirement(readmeHardwareNotes, DISK_README_PATTERN);
  const gpuHint = gpuHintFromSignals({
    readmeHardwareNotes,
    dependencyTexts: [
      packageDependencySignal(args.pkg),
      packageDependencySignal(focusPkg),
      focusPkgText,
      rootPkgText,
      ...pyprojectFiles.map((entry) => entry.text),
      ...pipfileFiles.map((entry) => entry.text),
      ...requirementsFiles.map((entry) => entry.text),
      ...setupPyFiles.map((entry) => entry.text),
      ...setupCfgFiles.map((entry) => entry.text),
      ...environmentYmlFiles.map((entry) => entry.text),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    dockerText: representativeDocker?.text ?? null,
  });
  const minVramGb = detectMinimumVramGb({
    readmeHardwareNotes,
    signalTexts: environmentSignalTexts,
  });
  const packageDependencySignalText = dependencySignalText([
    packageDependencySignal(args.pkg),
    packageDependencySignal(focusPkg),
    focusPkgText,
    rootPkgText,
  ]);
  const dependencyFileSignalText = dependencySignalText([
    ...pyprojectFiles.map((entry) => entry.text),
    ...pipfileFiles.map((entry) => entry.text),
    ...requirementsFiles.map((entry) => entry.text),
    ...setupPyFiles.map((entry) => entry.text),
    ...setupCfgFiles.map((entry) => entry.text),
    ...environmentYmlFiles.map((entry) => entry.text),
  ]);
  const combinedGpuSignalText = dependencySignalText([
    packageDependencySignalText,
    dependencyFileSignalText,
    representativeDocker?.text ?? null,
    ...readmeHardwareNotes,
    ...selectedContentTexts,
  ]);
  const hasExplicitGpuDependency =
    GPU_REQUIRED_LIBRARY_PATTERN.test(packageDependencySignalText) ||
    GPU_REQUIRED_LIBRARY_PATTERN.test(dependencyFileSignalText);
  const hasGpuCapableDependency =
    GPU_CAPABLE_LIBRARY_PATTERN.test(packageDependencySignalText) ||
    GPU_CAPABLE_LIBRARY_PATTERN.test(dependencyFileSignalText);
  const gpuFromReadme = readmeHardwareNotes.some((line) => GPU_README_PATTERN.test(line));
  const gpuFromCodeSignals =
    CUDA_ACCELERATOR_PATTERN.test(combinedGpuSignalText) ||
    MPS_ACCELERATOR_PATTERN.test(combinedGpuSignalText) ||
    ROCM_ACCELERATOR_PATTERN.test(combinedGpuSignalText);
  const gpuFromDocker = /\b(cuda|nvidia)\b/i.test(representativeDocker?.text ?? "");
  const gpuRequired =
    hasExplicitGpuDependency ||
    gpuFromDocker ||
    minVramGb !== null ||
    (hasGpuCapableDependency &&
      (gpuFromReadme || gpuFromCodeSignals) &&
      !CPU_OK_PATTERN.test(combinedGpuSignalText));
  const hardwareSourceSet = new Set<RepoEnvironmentGuide["hardware"]["source"]>();
  if (readmeHardwareNotes.length > 0 || gpuHint) hardwareSourceSet.add("readme");
  if (hasExplicitGpuDependency || hasGpuCapableDependency) hardwareSourceSet.add("package_json");
  if (gpuFromDocker) hardwareSourceSet.add("dockerfile");

  const hardware: RepoEnvironmentGuide["hardware"] = {
    gpuRequired,
    gpuHint,
    minRamGb: ramRequirement.min,
    recommendedRamGb: ramRequirement.recommended,
    minDiskGb: diskRequirement.min,
    minVramGb,
    cpuArch: detectCpuArch({
      signalTexts: environmentSignalTexts,
      dockerTexts: dockerEntries.map((entry) => entry.text),
    }),
    acceleratorPreference: detectAcceleratorPreference({
      signalTexts: environmentSignalTexts,
      gpuRequired,
    }),
    notes: readmeHardwareNotes.slice(0, 3),
    source:
      hardwareSourceSet.size === 0
        ? "none"
        : hardwareSourceSet.size === 1
          ? [...hardwareSourceSet][0]!
          : "mixed",
  };

  const deployTargets = new Set<string>();
  const cloudSourceSet = new Set<RepoEnvironmentGuide["cloud"]["source"]>();
  const pushDeployTarget = (
    url: string | null | undefined,
    source: RepoEnvironmentGuide["cloud"]["source"]
  ) => {
    if (!url) {
      return;
    }
    const target = deployTargetFromUrl(url);
    if (!target) {
      return;
    }
    deployTargets.add(target);
    cloudSourceSet.add(source);
  };

  pushDeployTarget(focusPkg?.homepage, "package_json");
  pushDeployTarget(args.pkg?.homepage, "package_json");
  readmes.forEach((readme) => {
    extractReadmeLinks(readme.text).forEach((link) => {
      pushDeployTarget(link.url, "readme");
    });
  });
  readmeDeployTargets.forEach((target) => deployTargets.add(target));
  deployTargetsFromConfigEntries(deployConfigEntries).forEach((target) => deployTargets.add(target));
  deployTargetsFromPathSignals(args.allPaths).forEach((target) => deployTargets.add(target));
  deployTargetsFromConfigContent(deployConfigEntries).forEach((target) => deployTargets.add(target));
  if (readmeDeployTargets.length > 0) {
    cloudSourceSet.add("readme");
  }
  if (deployConfigEntries.length > 0) {
    cloudSourceSet.add("config_files");
  }

  const rootDependencySignals = serviceSignalsFromDependencies(args.pkg);
  const focusDependencySignals = serviceSignalsFromDependencies(focusPkg);
  const primaryDependencySignals =
    focusPkg || !hasNestedWorkspacePackages
      ? (focusPkg ? focusDependencySignals : rootDependencySignals)
      : { runtime: [], optional: [] };
  const ambientRootDependencyServices =
    focusPkg || !hasNestedWorkspacePackages
      ? []
      : unique([...rootDependencySignals.runtime, ...rootDependencySignals.optional]);
  const dependencyRuntimeServices = unique(primaryDependencySignals.runtime);
  const dependencyOptionalServices = unique([
    ...primaryDependencySignals.optional,
    ...ambientRootDependencyServices,
  ]).filter((service) => !dependencyRuntimeServices.includes(service));
  const dependencyServices = unique([...dependencyRuntimeServices, ...dependencyOptionalServices]);
  const optionalReadmeServices = optionalServiceNamesFromReadmeNotes(readmes);
  const optionalEnvUsageServices = optionalServiceNamesFromEnvUsages(args.selectedFileContents);
  const directComposeEntries = composeEntries.filter((entry) =>
    isDirectEnvironmentConfigPath(entry.path, args.focusRoot, [
      "docker-compose.yml",
      "docker-compose.yaml",
      "docker-compose.override.yml",
      "docker-compose.override.yaml",
      "compose.yml",
      "compose.yaml",
      "compose.override.yml",
      "compose.override.yaml",
    ])
  );
  const nestedComposeEntries = composeEntries.filter((entry) => !directComposeEntries.includes(entry));
  const representativeNestedCompose =
    representativeCompose &&
    nestedComposeEntries.includes(representativeCompose.entry) &&
    representativeCompose.score >= 60
      ? representativeCompose.entry
      : null;
  const composeServicesRequired = unique([
    ...serviceNamesFromComposeServices(
      unique(directComposeEntries.flatMap((entry) => parseComposeServices(entry.text)))
    ),
    ...serviceNamesFromComposeText(directComposeEntries.map((entry) => entry.text)),
    ...(representativeNestedCompose
      ? serviceNamesFromComposeServices(parseComposeServices(representativeNestedCompose.text))
      : []),
    ...(representativeNestedCompose ? serviceNamesFromComposeText([representativeNestedCompose.text]) : []),
  ]);
  const composeServicesOptional = unique([
    ...serviceNamesFromComposeServices(
      unique(
        nestedComposeEntries
          .filter((entry) => entry !== representativeNestedCompose)
          .flatMap((entry) => parseComposeServices(entry.text))
      )
    ),
    ...serviceNamesFromComposeText(
      nestedComposeEntries.filter((entry) => entry !== representativeNestedCompose).map((entry) => entry.text)
    ),
  ]);
  const directEnvEntries = envExampleEntries.filter((entry) =>
    isDirectEnvironmentConfigPath(entry.path, args.focusRoot, [...ENVIRONMENT_EXAMPLE_FILE_NAMES])
  );
  const nestedEnvEntries = envExampleEntries.filter((entry) => !directEnvEntries.includes(entry));
  const directEnvSignals = envServiceSignalsFromTexts(directEnvEntries.map((entry) => entry.text));
  const nestedEnvSignals = envServiceSignalsFromTexts(nestedEnvEntries.map((entry) => entry.text));
  const schemaServices = serviceNamesFromSchemaProviders(args.selectedFileContents);
  const semanticServices = serviceNamesFromSemanticSignals(args.semanticSignals);
  const scopedSemanticServices =
    hasNestedWorkspacePackages && !focusPkg ? [] : semanticServices;
  const pathServices = serviceNamesFromPaths(args.allPaths);
  const semanticRequiredCorroboration = new Set([
    ...dependencyRuntimeServices,
    ...schemaServices,
    ...composeServicesRequired,
    ...readmeRequiredServices,
    ...pathServices,
  ]);
  const semanticRequiredServices = scopedSemanticServices.filter(
    (service) =>
      REQUIRED_EXTERNAL_SERVICE_CANDIDATES.has(service) &&
      semanticRequiredCorroboration.has(service)
  );
  const semanticOptionalServices = scopedSemanticServices.filter(
    (service) => !semanticRequiredServices.includes(service)
  );
  const corroboratedDirectEnvServices = unique([
    ...schemaServices,
    ...composeServicesRequired,
    ...readmeRequiredServices,
    ...semanticRequiredServices,
    ...pathServices,
    ...dependencyRuntimeServices,
  ]);
  const envRequiredServiceSet = new Set(
    directEnvSignals.required.filter(
      (service) =>
        CORE_INFRA_SERVICE_CANDIDATES.has(service) ||
        corroboratedDirectEnvServices.includes(service)
    )
  );
  const envRequiredServices = [...envRequiredServiceSet].sort((left, right) => left.localeCompare(right));
  const envOptionalServices = unique([
    ...directEnvSignals.optional,
    ...directEnvSignals.required.filter((service) => !envRequiredServiceSet.has(service)),
    ...nestedEnvSignals.required,
    ...nestedEnvSignals.optional,
  ]);
  const optionalOverrideServices = unique([
    ...optionalReadmeServices,
    ...optionalEnvUsageServices,
  ]);
  const multiSignalRequiredServices = dependencyRuntimeServices.filter(
    (service) =>
      !optionalOverrideServices.includes(service) &&
      (pathServices.includes(service) ||
        readmeRequiredServices.includes(service) ||
        composeServicesOptional.includes(service) ||
        scopedSemanticServices.includes(service))
  );
  const strongRequiredServices = unique([
    ...schemaServices,
    ...composeServicesRequired,
    ...envRequiredServices,
    ...multiSignalRequiredServices,
  ]);
  const weakRequiredServices = unique([
    ...semanticRequiredServices,
    ...readmeRequiredServices,
  ]);
  const servicesRequired = unique([
    ...strongRequiredServices,
    ...weakRequiredServices.filter((service) => !optionalOverrideServices.includes(service)),
  ]);
  const servicesOptional = unique([
    ...dependencyRuntimeServices,
    ...dependencyOptionalServices,
    ...composeServicesOptional,
    ...envOptionalServices,
    ...semanticOptionalServices,
    ...pathServices,
    ...optionalOverrideServices,
    ...weakRequiredServices.filter((service) => optionalOverrideServices.includes(service)),
  ]).filter((service) => !servicesRequired.includes(service));
  if (dependencyServices.length > 0) {
    cloudSourceSet.add("package_json");
  }
  if (composeServicesRequired.length > 0 || composeServicesOptional.length > 0) {
    cloudSourceSet.add("config_files");
  }
  if (directEnvSignals.required.length > 0 || directEnvSignals.optional.length > 0 || envOptionalServices.length > 0) {
    cloudSourceSet.add("config_files");
  }
  if (readmeRequiredServices.length > 0 || optionalReadmeServices.length > 0) {
    cloudSourceSet.add("readme");
  }
  if (pathServices.length > 0) {
    cloudSourceSet.add("config_files");
  }
  if (optionalEnvUsageServices.length > 0) {
    cloudSourceSet.add("config_files");
  }

  const servicesRequiredDetails = canonicalizeCloudServices(servicesRequired);
  const servicesOptionalDetails = canonicalizeCloudServices(servicesOptional).filter(
    (service) =>
      !servicesRequiredDetails.some((required) => required.canonicalId === service.canonicalId)
  );
  const apiServicesRequiredDetails = servicesRequiredDetails.filter((service) => isApiFacingCloudService(service));
  const apiServicesOptionalDetails = servicesOptionalDetails.filter(
    (service) =>
      isApiFacingCloudService(service) &&
      !apiServicesRequiredDetails.some((required) => required.canonicalId === service.canonicalId)
  );
  const deployTargetRequired = detectRequiredDeployTarget({
    allPaths: args.allPaths,
    signalTexts: environmentSignalTexts,
  });

  const cloud: RepoEnvironmentGuide["cloud"] = {
    deployTargets: sortDeployTargets(deployTargets),
    deployTargetRequired,
    servicesRequired: servicesRequiredDetails.map((service) => service.label),
    servicesOptional: servicesOptionalDetails.map((service) => service.label),
    apiServicesRequired: apiServicesRequiredDetails.map((service) => service.label),
    apiServicesOptional: apiServicesOptionalDetails.map((service) => service.label),
    servicesRequiredDetails,
    servicesOptionalDetails,
    source:
      cloudSourceSet.size === 0
        ? "none"
        : cloudSourceSet.size === 1
          ? [...cloudSourceSet][0]!
          : "mixed",
  };

  const runtimeList = [...runtimes.values()]
    .sort(
      (left, right) =>
        RUNTIME_NAME_ORDER.indexOf(left.name) - RUNTIME_NAME_ORDER.indexOf(right.name) ||
        left.source.localeCompare(right.source)
    )
    .map((runtime) => {
      const normalizedRange = runtimeRangeFromVersion(runtime.version);
      return {
        ...runtime,
        version: runtimeDisplayVersion(runtime.name, runtime.version),
        minMajor: normalizedRange.minMajor,
        maxMajor: normalizedRange.maxMajor,
        range: normalizedRange.range,
      };
    });

  const confidenceSourceKinds = new Set<string>();
  runtimeList.forEach((runtime) => {
    if (runtime.source !== "readme") {
      confidenceSourceKinds.add(runtime.source);
    }
  });
  if (container.hasDockerfile) confidenceSourceKinds.add("dockerfile");
  if (container.hasDockerCompose) confidenceSourceKinds.add("config_files");
  if (hardware.source !== "none" && hardware.source !== "readme") confidenceSourceKinds.add(hardware.source);
  if (cloud.source !== "none" && cloud.source !== "readme") confidenceSourceKinds.add(cloud.source);
  const hasReadmeOnlySignal =
    confidenceSourceKinds.size === 0 &&
    (hardware.source === "readme" || cloud.source === "readme" || runtimeList.some((item) => item.source === "readme"));
  const hasAnyEnvironmentSignal =
    runtimeList.length > 0 ||
    container.hasDockerfile ||
    container.hasDockerCompose ||
    container.composeServiceCount > 0 ||
    hardware.gpuRequired ||
    hardware.gpuHint !== null ||
    hardware.minRamGb !== null ||
    hardware.recommendedRamGb !== null ||
    hardware.minDiskGb !== null ||
    hardware.minVramGb !== null ||
    hardware.notes.length > 0 ||
    cloud.deployTargets.length > 0 ||
    cloud.deployTargetRequired !== null ||
    cloud.servicesRequired.length > 0 ||
    cloud.servicesOptional.length > 0;
  const runtimeMode = detectRuntimeMode({
    allPaths: args.allPaths,
    readmes,
    signalTexts: environmentSignalTexts,
    deployTargets: cloud.deployTargets,
    deployTargetRequired,
  });
  const costEstimate = buildCostEstimate({
    drivers: costDriversFromSignals({
      signalTexts: environmentSignalTexts,
      requiredServices: servicesRequiredDetails,
      optionalServices: servicesOptionalDetails,
      hardware,
      deployTargets: cloud.deployTargets,
      runtimeMode,
    }),
    runtimeMode,
    deployTargets: cloud.deployTargets,
  });
  const confidence =
    !hasAnyEnvironmentSignal
      ? "low"
      : confidenceSourceKinds.size >= 2
      ? "high"
      : confidenceSourceKinds.size === 1
        ? "medium"
        : hasReadmeOnlySignal
          ? "low"
          : "medium";

  const runtimeSummary =
    runtimeList.length > 0
      ? runtimeList
          .slice(0, 2)
          .map((runtime) =>
            `${runtime.name === "node"
              ? "Node"
              : runtime.name === "python"
                ? "Python"
                : runtime.name === "go"
                  ? "Go"
                  : runtime.name === "rust"
                    ? "Rust"
                    : runtime.name === "java"
                      ? "Java"
                      : runtime.name === "ruby"
                        ? "Ruby"
                        : runtime.name === "bun"
                          ? "Bun"
                          : "Deno"}${runtime.version ? ` ${runtime.version}` : ""}`
          )
          .join(" + ")
      : null;
  const summaryParts = unique(
    [
      runtimeSummary,
      container.dockerRole === "required"
        ? "Docker 필요"
        : container.dockerRole === "recommended"
          ? "Docker 권장"
          : container.dockerRole === "optional"
            ? "Docker 선택"
            : null,
      hardware.gpuRequired ? "GPU 필요" : runtimeList.length > 0 || container.hasDockerfile ? "GPU 불필요" : null,
      runtimeMode === "cloud-required"
        ? "클라우드 전제"
        : runtimeMode === "local-only"
          ? "로컬 실행 중심"
          : null,
      cloud.deployTargets[0] ? `${cloud.deployTargets[0]} 배포 힌트` : null,
      !cloud.deployTargets[0] && cloud.servicesRequired.length > 0
        ? `${cloud.servicesRequired.slice(0, 2).join(" · ")} 필요`
        : null,
    ].filter((item): item is string => Boolean(item))
  );

  return {
    summary: summaryParts.join(" · "),
    runtimes: runtimeList,
    container,
    hardware,
    cloud,
    runtimeMode,
    costEstimate,
    confidence,
    confidenceNote:
      confidence === "low" && hasReadmeOnlySignal
        ? "README 본문에서 일부 추정했습니다."
        : null,
  };
}

function isStackConfigPath(path: string) {
  return (
    path === "package.json" ||
    path === "pnpm-workspace.yaml" ||
    path === "turbo.json" ||
    path === "nx.json" ||
    /(^|\/)(next|tailwind|vite)\.config\.(ts|js|mjs)$/i.test(path)
  );
}

function isLibraryPackageFocus(projectType: string, focusRoot: string | null) {
  return (
    Boolean(focusRoot) &&
    focusRoot!.startsWith("packages/") &&
    (projectType === "라이브러리 또는 SDK" || projectType === "컴포넌트 라이브러리 또는 디자인 시스템")
  );
}

function isNestedLibraryExamplePath(path: string, focusRoot: string) {
  if (!path.startsWith(`${focusRoot}/`)) {
    return false;
  }

  const relative = path.slice(focusRoot.length + 1);
  return /^(example|examples|demo|demos|playgrounds?|sandbox|showcase|preview|docs?|website|site)(\/|$)/i.test(
    relative
  );
}

function stackScopedPaths(paths: string[], focusRoot: string | null, projectType: string) {
  if (!focusRoot) return paths;

  const shouldRestrictLibraryScope = isLibraryPackageFocus(projectType, focusRoot);
  const scoped = paths.filter((path) => {
    if (!(path === focusRoot || path.startsWith(`${focusRoot}/`))) {
      return false;
    }

    if (shouldRestrictLibraryScope && isNestedLibraryExamplePath(path, focusRoot)) {
      return false;
    }

    return true;
  });
  const rootConfigs = shouldRestrictLibraryScope
    ? []
    : paths.filter((path) => !path.includes("/") && isStackConfigPath(path));
  return unique([...scoped, ...rootConfigs]);
}

function signalPathsInScope(paths: string[], focusRoot: string | null, projectType: string) {
  const scopedSet = new Set(stackScopedPaths(paths, focusRoot, projectType));
  return (items: string[]) => items.filter((path) => scopedSet.has(path));
}

function isCodePath(path: string) {
  return /\.(tsx?|jsx?|py|go|rs|java|rb|php|sh|mjs|cjs)$/i.test(path) && !/package\.json$/i.test(path);
}

function stackReasons(name: string, args: {
  projectType: string;
  paths: string[];
  keyFiles: KeyFileInfo[];
  focusRoot: string | null;
  pkg?: PackageJsonShape | null;
  workspacePkg?: PackageJsonShape | null;
  semanticSignals: SemanticSignals;
}) {
  const reasons: string[] = [];
  const scopedPaths = stackScopedPaths(args.paths, args.focusRoot, args.projectType);
  const uiKeyFiles = args.keyFiles.filter((item) => item.relatedLayers.includes("UI")).map((item) => item.path);

  if (name === "Next.js") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "next")) reasons.push("`next` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /(^|\/)next\.config\.(ts|js|mjs)$/i.test(path))) {
      reasons.push("`next.config.*` 설정 파일이 있습니다.");
    }
    if (scopedPaths.some((path) => /(^|\/)(app|pages)\/.+/.test(path))) {
      reasons.push("`app/` 또는 `pages/` 기반 라우트 구조가 보입니다.");
    }
  }

  if (name === "React") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "react")) reasons.push("`react` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /\.(tsx|jsx)$/i.test(path))) reasons.push("JSX/TSX 화면 파일이 있습니다.");
    if (reasons.length === 0 && uiKeyFiles.length > 0) reasons.push("대표 범위에 UI 레이어 파일이 있습니다.");
  }

  if (name === "TypeScript") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "typescript")) reasons.push("`typescript` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /\.(ts|tsx|mts|cts)$/i.test(path))) reasons.push("`.ts/.tsx` 파일이 있습니다.");
  }

  if (name === "JavaScript") {
    if (scopedPaths.some((path) => /\.(js|jsx|mjs|cjs)$/i.test(path))) reasons.push("`.js/.jsx` 파일이 있습니다.");
  }

  if (name === "Python") {
    if (scopedPaths.some((path) => /\.py$/i.test(path))) reasons.push("Python 스크립트가 있습니다.");
  }

  if (name === "Tailwind CSS") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "tailwindcss")) reasons.push("`tailwindcss` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /tailwind\.config\.(ts|js|mjs)$/i.test(path))) reasons.push("Tailwind 설정 파일이 있습니다.");
    if (reasons.length === 0 && uiKeyFiles.length > 0) reasons.push("대표 범위에 UI 레이어 파일이 있습니다.");
  }

  if (name === "Prisma") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "prisma")) reasons.push("`prisma` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /schema\.prisma$/i.test(path))) reasons.push("`schema.prisma`가 있습니다.");
  }

  if (name === "Supabase") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "@supabase/supabase-js")) reasons.push("`@supabase/supabase-js` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /supabase/i.test(path))) reasons.push("Supabase 관련 경로가 있습니다.");
  }

  if (name === "Firebase") {
    if (hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["firebase", "firebase-admin"])) reasons.push("Firebase 의존성이 있습니다.");
    if (scopedPaths.some((path) => /firebase/i.test(path))) reasons.push("Firebase 관련 경로가 있습니다.");
  }

  if (name === "Node.js") {
    if (args.semanticSignals.routeHandlers.length > 0 || args.semanticSignals.internalApiCalls.length > 0) {
      reasons.push("서버 요청 처리 또는 API 흐름이 감지됩니다.");
    }
    if (scopedPaths.some((path) => /(^|\/)(api|bin|cli\.|commands?\/)/i.test(path))) {
      reasons.push("API/CLI 실행 경로가 있습니다.");
    }
    if (reasons.length === 0) {
      reasons.push("패키지 실행 환경이 브라우저만이 아니라 서버/도구 쪽도 포함됩니다.");
    }
  }

  if (name === "Vite") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "vite")) reasons.push("`vite` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /(^|\/)vite\.config\.(ts|js|mjs)$/i.test(path))) {
      reasons.push("`vite.config.*` 설정 파일이 있습니다.");
    }
  }

  if (name === "Vue") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "vue")) reasons.push("`vue` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /\.vue$/i.test(path))) reasons.push("`.vue` 파일이 있습니다.");
    if (reasons.length === 0 && uiKeyFiles.length > 0) reasons.push("대표 범위에 UI 레이어 파일이 있습니다.");
  }

  if (name === "Svelte") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "svelte")) reasons.push("`svelte` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /\.svelte$/i.test(path))) reasons.push("`.svelte` 파일이 있습니다.");
    if (reasons.length === 0 && uiKeyFiles.length > 0) reasons.push("대표 범위에 UI 레이어 파일이 있습니다.");
  }

  if (name === "Astro") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "astro")) reasons.push("`astro` 의존성이 있습니다.");
    if (scopedPaths.some((path) => /\.astro$/i.test(path))) reasons.push("`.astro` 파일이 있습니다.");
    if (reasons.length === 0 && uiKeyFiles.length > 0) reasons.push("대표 범위에 UI 레이어 파일이 있습니다.");
  }

  if (name === "Express" && hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "express")) reasons.push("`express` 의존성이 있습니다.");
  if (name === "Fastify" && hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "fastify")) reasons.push("`fastify` 의존성이 있습니다.");
  if (name === "Hono" && hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "hono")) reasons.push("`hono` 의존성이 있습니다.");

  if (name === "Drizzle") {
    if (hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["drizzle-orm", "drizzle-kit"])) {
      reasons.push("Drizzle 관련 의존성이 있습니다.");
    }
  }

  if (name === "Mongoose") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "mongoose")) reasons.push("`mongoose` 의존성이 있습니다.");
  }

  if (name === "Zustand" && hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "zustand")) reasons.push("`zustand` 의존성이 있습니다.");
  if (name === "Redux" && hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["redux", "@reduxjs/toolkit"])) {
    reasons.push("Redux 관련 의존성이 있습니다.");
  }
  if (name === "Zod" && hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "zod")) reasons.push("`zod` 의존성이 있습니다.");
  if (name === "tRPC" && hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["@trpc/server", "@trpc/client", "@trpc/react-query"])) {
    reasons.push("tRPC 관련 의존성이 있습니다.");
  }

  if (name === "OpenAI") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "openai")) reasons.push("`openai` 의존성이 있습니다.");
    if (args.semanticSignals.externalServices.some((item) => item.names.includes("OpenAI"))) {
      reasons.push("대표 파일 본문에서 OpenAI SDK 사용이 감지됩니다.");
    }
  }

  if (name === "Stripe") {
    if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "stripe")) reasons.push("`stripe` 의존성이 있습니다.");
    if (args.semanticSignals.externalServices.some((item) => item.names.includes("Stripe"))) {
      reasons.push("대표 파일 본문에서 Stripe SDK 사용이 감지됩니다.");
    }
  }

  return unique(reasons).slice(0, 3);
}

function orderedStackPaths(args: { paths: string[]; keyFiles: KeyFileInfo[] }) {
  return unique([...args.keyFiles.map((item) => item.path), ...args.paths]);
}

function pickStackExamplePaths(paths: string[], predicate: (path: string) => boolean, max = 2) {
  return paths.filter(predicate).slice(0, max);
}

function stackExamplePaths(args: {
  name: string;
  projectType: string;
  paths: string[];
  keyFiles: KeyFileInfo[];
  focusRoot: string | null;
  semanticSignals: SemanticSignals;
}) {
  const scopedPaths = stackScopedPaths(args.paths, args.focusRoot, args.projectType);
  const orderedPaths = orderedStackPaths({ paths: scopedPaths, keyFiles: args.keyFiles });
  const filterSignalPaths = signalPathsInScope(args.paths, args.focusRoot, args.projectType);
  const uiKeyPaths = args.keyFiles
    .filter((item) => item.relatedLayers.includes("UI"))
    .map((item) => item.path);
  const dbSignalPaths = filterSignalPaths(
    args.semanticSignals.dbClients
    .filter((item) => item.names.includes(args.name))
    .map((item) => item.path)
  );
  const externalSignalPaths = filterSignalPaths(
    args.semanticSignals.externalServices
    .filter((item) => item.names.includes(args.name))
    .map((item) => item.path)
  ).filter(isCodePath);

  switch (args.name) {
    case "Next.js":
      return unique([
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)app\/.*(page|layout)\.(ts|tsx|js|jsx|mdx)$/i.test(path),
          1
        ),
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)(app\/api\/.*route|pages\/api\/.+)\.(ts|tsx|js|jsx)$/i.test(path),
          1
        ),
      ]).slice(0, 2);
    case "React":
      return unique([
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)(app\/.*\.(tsx|jsx|mdx)|pages\/.*\.(tsx|jsx|mdx)|components\/.*\.(tsx|jsx)|ui\/.*\.(tsx|jsx))$/i.test(path)
        ),
        ...uiKeyPaths,
      ]).slice(0, 2);
    case "TypeScript":
      return pickStackExamplePaths(
        orderedPaths,
        (path) => /\.(ts|tsx|mts|cts)$/i.test(path) && !/\.d\.ts$/i.test(path)
      );
    case "JavaScript":
      return pickStackExamplePaths(orderedPaths, (path) => /\.(js|jsx|mjs|cjs)$/i.test(path));
    case "Python":
      return pickStackExamplePaths(orderedPaths, (path) => /\.py$/i.test(path));
    case "Tailwind CSS":
      return unique([
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)tailwind\.config\.(ts|js|mjs)$/i.test(path),
          1
        ),
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)(app\/.*\.(tsx|jsx|mdx)|components\/.*\.(tsx|jsx)|ui\/.*\.(tsx|jsx))$/i.test(path),
          1
        ),
      ]).slice(0, 2);
    case "Prisma":
      return unique([
        ...pickStackExamplePaths(orderedPaths, (path) => /schema\.prisma$/i.test(path), 1),
        ...dbSignalPaths,
      ]).slice(0, 2);
    case "Supabase":
    case "Firebase":
      return unique([
        ...externalSignalPaths,
        ...dbSignalPaths,
        ...pickStackExamplePaths(orderedPaths, (path) => new RegExp(args.name, "i").test(path), 2),
      ]).slice(0, 2);
    case "Node.js":
      return unique([
        ...filterSignalPaths(args.semanticSignals.routeHandlers.map((item) => item.path)).filter(isCodePath),
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => isCodePath(path) && /(^|\/)(bin\/|cli|commands?\/|scripts?\/|server\/|api\/|src\/main\.)/i.test(path),
          2
        ),
      ]).slice(0, 2);
    case "Vite":
      return unique([
        ...pickStackExamplePaths(orderedPaths, (path) => /(^|\/)vite\.config\.(ts|js|mjs)$/i.test(path), 1),
        ...pickStackExamplePaths(orderedPaths, (path) => /(^|\/)src\/main\.(ts|tsx|js|jsx)$/i.test(path), 1),
      ]).slice(0, 2);
    case "Vue":
      return pickStackExamplePaths(orderedPaths, (path) => /\.vue$/i.test(path));
    case "Svelte":
      return pickStackExamplePaths(orderedPaths, (path) => /\.svelte$/i.test(path));
    case "Astro":
      return pickStackExamplePaths(orderedPaths, (path) => /\.astro$/i.test(path));
    case "Express":
    case "Fastify":
    case "Hono":
      return unique([
        ...filterSignalPaths(args.semanticSignals.routeHandlers.map((item) => item.path)).filter(isCodePath),
        ...pickStackExamplePaths(
          orderedPaths,
          (path) => /(^|\/)(server|api|routes?)\/.+\.(ts|tsx|js|jsx)$/i.test(path),
          2
        ),
      ]).slice(0, 2);
    case "Drizzle":
    case "Mongoose":
      return unique([
        ...dbSignalPaths,
        ...pickStackExamplePaths(orderedPaths, (path) => new RegExp(args.name, "i").test(path), 2),
      ]).slice(0, 2);
    case "Zustand":
    case "Redux":
    case "Zod":
      return pickStackExamplePaths(orderedPaths, (path) => new RegExp(args.name, "i").test(path), 2);
    case "tRPC":
      return pickStackExamplePaths(orderedPaths, (path) => /trpc/i.test(path), 2);
    case "OpenAI":
    case "Stripe":
      return externalSignalPaths.slice(0, 2);
    default:
      return [];
  }
}

function stackUsedFor(args: {
  name: string;
  projectType: string;
  paths: string[];
  keyFiles: KeyFileInfo[];
  semanticSignals: SemanticSignals;
}) {
  const hasUiFiles = args.keyFiles.some((item) => item.relatedLayers.includes("UI"));
  const hasApiFlow =
    args.semanticSignals.routeHandlers.length > 0 || args.semanticSignals.internalApiCalls.length > 0;
  const hasDbFlow = args.semanticSignals.dbClients.length > 0;

  switch (args.name) {
    case "Next.js":
      if (hasUiFiles && hasApiFlow) {
        return "이 레포에서 화면 라우팅과 API 요청 처리를 같은 프로젝트 안에서 함께 맡습니다.";
      }
      if (hasUiFiles) {
        return "이 레포의 화면 진입점과 페이지 라우팅을 맡습니다.";
      }
      if (hasApiFlow) {
        return "이 레포의 서버 요청 처리와 라우트 구성을 맡습니다.";
      }
      return "이 레포의 웹앱 구조와 라우팅의 기본 뼈대를 맡습니다.";
    case "React":
      return hasUiFiles
        ? "이 레포의 화면과 컴포넌트를 조립하는 데 쓰입니다."
        : "이 레포의 UI 컴포넌트를 구성하는 데 쓰입니다.";
    case "TypeScript":
      if (args.projectType === "라이브러리 또는 SDK") {
        return "이 레포의 공개 API와 내부 로직 타입을 맞춰 구조를 읽기 쉽게 합니다.";
      }
      return "이 레포의 화면과 서버 코드 타입을 맞춰 수정 지점을 덜 헷갈리게 합니다.";
    case "JavaScript":
      return "이 레포의 실행 코드와 스크립트 대부분을 구성하는 기본 언어입니다.";
    case "Python":
      if (/CLI 도구|라이브러리 또는 SDK/.test(args.projectType)) {
        return "이 레포의 스크립트나 라이브러리 로직을 실행하는 주 언어입니다.";
      }
      return "이 레포의 데이터 처리, 자동화, 백엔드 로직을 담당합니다.";
    case "Tailwind CSS":
      return "이 레포의 화면 스타일을 작은 클래스 조합으로 빠르게 만드는 데 쓰입니다.";
    case "Prisma":
      return hasDbFlow
        ? "이 레포의 데이터베이스 스키마와 조회/저장 흐름을 다루는 데 쓰입니다."
        : "이 레포의 데이터베이스 스키마를 코드와 함께 관리하는 데 쓰입니다.";
    case "Supabase":
      return "이 레포의 데이터, 인증, 저장소 같은 백엔드 기능에 연결됩니다.";
    case "Firebase":
      return "이 레포의 데이터나 인증 같은 백엔드 기능에 연결됩니다.";
    case "Node.js":
      if (args.projectType === "CLI 도구") {
        return "이 레포의 CLI 실행과 스크립트 동작을 받쳐 주는 런타임입니다.";
      }
      if (hasApiFlow) {
        return "이 레포의 API, 서버 작업, 개발 도구를 실행하는 런타임입니다.";
      }
      return "이 레포의 개발 도구와 실행 스크립트를 돌리는 런타임입니다.";
    case "Vite":
      return "이 레포의 프론트엔드 개발 서버와 번들 빌드를 빠르게 돌리는 데 쓰입니다.";
    case "Vue":
      return "이 레포의 화면 컴포넌트를 Vue 방식으로 구성하는 데 쓰입니다.";
    case "Svelte":
      return "이 레포의 화면을 가볍게 렌더링하는 프론트엔드 프레임워크로 쓰입니다.";
    case "Astro":
      return "이 레포의 콘텐츠 중심 화면과 정적 페이지 구성을 맡습니다.";
    case "Express":
    case "Fastify":
    case "Hono":
      return "이 레포의 HTTP 요청 처리와 API 라우팅을 맡습니다.";
    case "Drizzle":
    case "Mongoose":
      return "이 레포의 데이터 모델과 저장소 접근 로직을 담당합니다.";
    case "Zustand":
    case "Redux":
      return "이 레포에서 여러 화면이 공유하는 상태를 관리하는 데 쓰입니다.";
    case "Zod":
      return "이 레포의 입력 데이터와 API payload를 검사하는 데 쓰입니다.";
    case "tRPC":
      return "이 레포의 프론트와 백엔드 타입을 함께 맞추는 데 쓰입니다.";
    case "OpenAI":
      return "이 레포의 AI 응답 생성, 요약, 보조 기능 연결에 쓰입니다.";
    case "Stripe":
      return "이 레포의 결제나 구독 연동에 쓰입니다.";
    default:
      return null;
  }
}

function additionalGlossaryItems(args: {
  projectType: string;
  paths: string[];
  focusRoot: string | null;
  pkg?: PackageJsonShape | null;
  workspacePkg?: PackageJsonShape | null;
  semanticSignals: SemanticSignals;
}) {
  const items: string[] = [];
  const scopedPaths = stackScopedPaths(args.paths, args.focusRoot, args.projectType);

  if (
    hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "vite") ||
    scopedPaths.some((path) => /(^|\/)vite\.config\.(ts|js|mjs)$/i.test(path))
  ) {
    items.push("Vite");
  }
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "vue") || scopedPaths.some((path) => /\.vue$/i.test(path))) items.push("Vue");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "svelte") || scopedPaths.some((path) => /\.svelte$/i.test(path))) items.push("Svelte");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "astro") || scopedPaths.some((path) => /\.astro$/i.test(path))) items.push("Astro");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "express")) items.push("Express");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "fastify")) items.push("Fastify");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "hono")) items.push("Hono");
  if (hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["drizzle-orm", "drizzle-kit"])) items.push("Drizzle");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "mongoose")) items.push("Mongoose");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "zustand")) items.push("Zustand");
  if (hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["redux", "@reduxjs/toolkit"])) items.push("Redux");
  if (hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "zod")) items.push("Zod");
  if (hasAnyDependencyAcrossPackages(args.pkg, args.workspacePkg, ["@trpc/server", "@trpc/client", "@trpc/react-query"])) items.push("tRPC");
  if (
    hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "openai") ||
    args.semanticSignals.externalServices.some((item) => item.names.includes("OpenAI"))
  ) {
    items.push("OpenAI");
  }
  if (
    hasDependencyAcrossPackages(args.pkg, args.workspacePkg, "stripe") ||
    args.semanticSignals.externalServices.some((item) => item.names.includes("Stripe"))
  ) {
    items.push("Stripe");
  }

  return unique(items);
}

function buildStackGlossary(args: {
  projectType: string;
  stack: string[];
  paths: string[];
  focusRoot: string | null;
  keyFiles: KeyFileInfo[];
  pkg?: PackageJsonShape | null;
  workspacePkg?: PackageJsonShape | null;
  semanticSignals: SemanticSignals;
}) {
  return unique([...args.stack, ...additionalGlossaryItems(args)])
    .map<RepoStackGlossaryItem | null>((name) => {
      const glossary = STACK_GLOSSARY[name];
      if (!glossary) {
        return null;
      }

      return {
        name,
        kind: glossary.kind,
        description: glossary.description,
        reasons: stackReasons(name, args),
        usedFor: stackUsedFor({
          name,
          projectType: args.projectType,
          paths: args.paths,
          keyFiles: args.keyFiles,
          semanticSignals: args.semanticSignals,
        }),
        examplePaths: stackExamplePaths({
          name,
          projectType: args.projectType,
          paths: args.paths,
          keyFiles: args.keyFiles,
          focusRoot: args.focusRoot,
          semanticSignals: args.semanticSignals,
        }),
      };
    })
    .filter((item) => {
      if (!item) return false;
      if (!args.focusRoot) return true;
      return item.reasons.length > 0 || item.examplePaths.length > 0;
    })
    .filter((item): item is RepoStackGlossaryItem => Boolean(item))
    .slice(0, 8);
}

export function refineDisplayStack(args: {
  projectType: string;
  stack: string[];
  paths: string[];
  focusRoot: string | null;
  keyFiles: KeyFileInfo[];
  pkg?: PackageJsonShape | null;
  selectedFileContents?: Record<string, string>;
  semanticSignals: SemanticSignals;
}) {
  if (!args.focusRoot) {
    return unique(args.stack).slice(0, 5);
  }

  const workspacePkg = workspacePackageJson(args.selectedFileContents, args.focusRoot);
  const glossary = buildStackGlossary({
    projectType: args.projectType,
    stack: args.stack,
    paths: args.paths,
    focusRoot: args.focusRoot,
    keyFiles: args.keyFiles,
    pkg: args.pkg,
    workspacePkg,
    semanticSignals: args.semanticSignals,
  });
  const refined = glossary
    .filter(
      (item) =>
        item.kind !== "tool" ||
        ["Vite", "Express", "Fastify", "Hono", "Zustand", "Redux", "Zod", "tRPC"].includes(item.name)
    )
    .map((item, index) => ({
      name: item.name,
      priority: stackDisplayPriority(item, args.stack.includes(item.name)),
      index,
    }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .map((item) => item.name);

  return (refined.length > 0 ? refined : unique(args.stack)).slice(0, 5);
}

function buildStackSummary(args: {
  projectType: string;
  stack: string[];
  semanticSignals: SemanticSignals;
}) {
  const dataClients = unique(args.semanticSignals.dbClients.flatMap((item) => item.names));
  const externalServices = unique(args.semanticSignals.externalServices.flatMap((item) => item.names));
  const hasDb = dataClients.length > 0 || args.stack.some((item) => ["Prisma", "Supabase", "Firebase"].includes(item));
  const hasAi =
    externalServices.some((name) => ["OpenAI", "Anthropic"].includes(name)) ||
    args.stack.some((item) => ["OpenAI", "Anthropic"].includes(item));

  if (args.projectType === "풀스택 웹앱") {
    if (hasAi && hasDb) return "AI 기능과 데이터 저장이 함께 있는 풀스택 웹앱";
    if (hasAi) return "AI 기능이 들어간 풀스택 웹앱";
    if (hasDb) return "데이터 저장 구조가 있는 풀스택 웹앱";
    return "화면과 서버 처리가 함께 있는 풀스택 웹앱";
  }

  if (args.projectType === "프론트엔드 웹앱") {
    return hasAi ? "외부 AI/서비스 연동이 있는 프론트엔드 웹앱" : "화면 중심으로 만든 프론트엔드 웹앱";
  }

  if (args.projectType === "백엔드 API 서비스" || args.projectType === "API 서버") {
    if (hasDb) return "데이터 처리 중심의 API 서버";
    return "요청 처리 중심의 API 서버";
  }

  if (args.projectType === "CLI 도구") {
    return "터미널에서 실행하는 명령줄 도구";
  }

  if (args.projectType === "라이브러리 또는 SDK") {
    return hasAi ? "다른 프로젝트에서 가져다 쓰는 SDK/라이브러리" : "재사용을 위해 만든 라이브러리 또는 SDK";
  }

  if (args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
    return "재사용 UI 부품과 문서를 함께 가진 디자인 시스템 저장소";
  }

  if (args.projectType === "모노레포 웹 플랫폼") {
    if (hasAi) return "여러 앱과 공용 패키지를 함께 운영하는 AI 서비스 플랫폼";
    if (hasDb || externalServices.length > 0 || args.semanticSignals.routeHandlers.length > 0) {
      return "여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼";
    }
    return "여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼";
  }

  if (args.projectType === "학습용 예제 저장소") {
    return "예제 앱과 참고 코드를 함께 모아 둔 학습용 저장소";
  }

  return args.stack.length > 0 ? `${args.stack.slice(0, 2).join(" + ")} 기반 저장소` : null;
}

const STACK_HIGHLIGHT_KIND_PRIORITY: Record<RepoStackGlossaryItem["kind"], number> = {
  framework: 6,
  database: 5,
  tool: 4,
  runtime: 3,
  styling: 2,
  language: 1,
};

function stackDisplayBasePriority(item: RepoStackGlossaryItem) {
  switch (item.name) {
    case "Next.js":
      return 120;
    case "React":
    case "Vue":
    case "Svelte":
    case "Astro":
      return 112;
    case "TypeScript":
    case "Python":
      return 104;
    case "JavaScript":
      return 100;
    case "Tailwind CSS":
      return 98;
    case "Prisma":
    case "Drizzle":
    case "Mongoose":
    case "Supabase":
    case "Firebase":
      return 94;
    case "Node.js":
      return 88;
    case "Vite":
      return 82;
    case "Express":
    case "Fastify":
    case "Hono":
    case "tRPC":
      return 78;
    case "OpenAI":
    case "Stripe":
      return 74;
    case "Zustand":
    case "Redux":
    case "Zod":
      return 70;
    default:
      return STACK_HIGHLIGHT_KIND_PRIORITY[item.kind] * 10;
  }
}

function stackDisplayPriority(item: RepoStackGlossaryItem, isCore: boolean) {
  return stackDisplayBasePriority(item) + (isCore ? 6 : 0) + Math.min(item.examplePaths.length, 2);
}

function stackHighlightBasePriority(item: RepoStackGlossaryItem) {
  switch (item.name) {
    case "Next.js":
      return 120;
    case "React":
    case "Vue":
    case "Svelte":
    case "Astro":
      return 112;
    case "Prisma":
    case "Drizzle":
    case "Mongoose":
    case "Supabase":
    case "Firebase":
      return 102;
    case "OpenAI":
      return 96;
    case "Stripe":
    case "tRPC":
      return 90;
    case "Express":
    case "Fastify":
    case "Hono":
      return 86;
    case "TypeScript":
    case "Python":
      return 78;
    case "Tailwind CSS":
      return 74;
    case "JavaScript":
      return 72;
    case "Node.js":
      return 68;
    case "Vite":
      return 60;
    case "Zustand":
    case "Redux":
    case "Zod":
      return 56;
    default:
      return STACK_HIGHLIGHT_KIND_PRIORITY[item.kind] * 10;
  }
}

function stackHighlightPriority(item: RepoStackGlossaryItem, isCore: boolean) {
  return stackHighlightBasePriority(item) + (isCore ? 4 : 0) + Math.min(item.examplePaths.length, 2);
}

function stackHighlightRole(item: RepoStackGlossaryItem) {
  switch (item.name) {
    case "Next.js":
      return "화면 + 서버 요청";
    case "React":
    case "Vue":
    case "Svelte":
    case "Astro":
      return "화면 구성";
    case "TypeScript":
      return "타입 기반 구조";
    case "JavaScript":
      return "기본 실행 언어";
    case "Python":
      return "스크립트/백엔드 언어";
    case "Tailwind CSS":
      return "화면 스타일";
    case "Prisma":
    case "Drizzle":
    case "Mongoose":
      return "데이터 저장·조회";
    case "Supabase":
    case "Firebase":
      return "백엔드 서비스";
    case "Node.js":
      return "서버/스크립트 실행";
    case "Vite":
      return "개발 서버 + 빌드";
    case "Express":
    case "Fastify":
    case "Hono":
      return "API 처리";
    case "Zustand":
    case "Redux":
      return "상태 관리";
    case "Zod":
      return "입력 검증";
    case "tRPC":
      return "타입 공유 API";
    case "OpenAI":
      return "AI 기능 연결";
    case "Stripe":
      return "결제 연동";
    default:
      if (item.kind === "framework") return "핵심 프레임워크";
      if (item.kind === "database") return "데이터 계층";
      if (item.kind === "runtime") return "실행 환경";
      if (item.kind === "styling") return "스타일 계층";
      if (item.kind === "language") return "기본 언어";
      return "핵심 도구";
  }
}

function buildStackHighlights(
  glossary: RepoStackGlossaryItem[],
  coreStack: string[]
): RepoIdentityGuide["stackHighlights"] {
  const coreSet = new Set(coreStack);
  const ranked = glossary
    .map((item, index) => ({
      name: item.name,
      role: stackHighlightRole(item),
      examplePath: item.examplePaths[0] ?? null,
      priority: stackHighlightPriority(item, coreSet.has(item.name)),
      index,
      isCore: coreSet.has(item.name),
    }));

  return [
    ...ranked
      .filter((item) => item.isCore)
      .sort((left, right) => right.priority - left.priority || left.index - right.index)
      .slice(0, 3),
    ...ranked
      .filter((item) => !item.isCore)
      .sort((left, right) => right.priority - left.priority || left.index - right.index),
    ...ranked
      .filter((item) => item.isCore)
      .sort((left, right) => right.priority - left.priority || left.index - right.index)
      .slice(3),
  ]
    .slice(0, 4)
    .map(({ name, role, examplePath }) => ({
      name,
      role,
      examplePath,
    }));
}

function buildStackNarrative(highlights: RepoIdentityGuide["stackHighlights"]) {
  if (highlights.length === 0) return null;
  return `주요 기술은 ${highlights
    .slice(0, 3)
    .map((item) => `${item.name}(${item.role})`)
    .join(", ")}입니다.`;
}

function stripped(value: string): string {
  return value.toLowerCase().replace(/[\s·.,()/"'`:-]/g, "");
}

function containsHangul(value: string) {
  return /[가-힣]/.test(value);
}

function englishWordCount(value: string) {
  return value.match(/[A-Za-z][A-Za-z0-9+./-]*/g)?.length ?? 0;
}

function isEnglishHeavy(value: string | null | undefined) {
  if (!value) return false;
  const cleaned = cleanupNarrativeText(value);
  if (!cleaned) return false;
  return !containsHangul(cleaned) && englishWordCount(cleaned) >= 4;
}

function sentenceizeKoreanSubtitle(value: string | null | undefined) {
  const cleaned = cleanupNarrativeText(value);
  if (!cleaned) return "";
  if (!containsHangul(cleaned)) return cleaned;
  if (/[.!?]$/.test(cleaned)) return cleaned;
  if (/(입니다|합니다|됩니다|있습니다|보입니다|보면 됩니다|할 수 있습니다)$/.test(cleaned)) {
    return `${cleaned}.`;
  }
  return `${cleaned}입니다.`;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index += 1) {
    if (a[index] !== b[index]) return index;
  }
  return limit;
}

function suppressIfRedundant(candidate: string | null, reference: string | null) {
  if (!candidate) return null;
  if (!reference) return candidate;
  const a = stripped(candidate);
  const b = stripped(reference);
  if (a.length === 0 || b.length === 0) return candidate;
  const common = commonPrefixLength(a, b);
  const shortest = Math.min(a.length, b.length);
  if (shortest === 0) return candidate;
  return common / shortest >= 0.7 ? null : candidate;
}

function subtitleIntentBucket(text: string) {
  const cleaned = cleanupNarrativeText(text);
  if (!cleaned) return null;

  if (/(학습용 저장소|예제 앱과 참고 코드|튜토리얼|starter|examples?)/i.test(cleaned)) return "tutorial";
  if (/(라이브러리|SDK|패키지)/i.test(cleaned)) return "library";
  if (/(디자인 시스템|UI 부품|컴포넌트)/i.test(cleaned)) return "design_system";
  if (/(API 서버|요청을 받아 처리|HTTP API|응답)/i.test(cleaned)) return "api";
  if (/(터미널|명령줄 도구|명령을 실행)/i.test(cleaned)) return "cli";
  if (/(웹앱|웹 서비스|브라우저 화면|화면 중심)/i.test(cleaned)) return "webapp";
  if (/도구/.test(cleaned)) return "tool";
  return null;
}

function compressIdentitySubtitle(candidate: string | null) {
  const cleaned = sentenceizeKoreanSubtitle(candidate);
  if (!cleaned) return null;

  if (/공개 GitHub 레포를 구조와 설명 중심으로 빠르게 이해하게 돕는 도구입니다\./.test(cleaned)) {
    return "GitHub 레포 구조를 빠르게 파악하게 돕습니다.";
  }

  if (/브라우저 화면에서 자동화 흐름을 만들고 실행 상태를 관리하는 서비스입니다\./.test(cleaned)) {
    return "자동화 흐름을 만들고 실행 상태를 관리합니다.";
  }

  if (/브라우저 화면에서 기능을 실행하고 결과를 확인하는 웹앱입니다\./.test(cleaned)) {
    return "브라우저에서 기능을 실행하고 결과를 보는 웹앱입니다.";
  }

  return cleaned;
}

function subtitleConflictsWithIdentity(args: {
  candidate: string | null;
  plainTitle: string;
  projectType: string;
}) {
  const candidateBucket = subtitleIntentBucket(args.candidate ?? "");
  if (!candidateBucket) return false;

  if (
    args.projectType !== "학습용 예제 저장소" &&
    candidateBucket === "tutorial" &&
    /(라이브러리|SDK|디자인 시스템|API 서버|명령줄 도구|도구)/.test(args.plainTitle)
  ) {
    return true;
  }

  if (
    (args.projectType === "라이브러리 또는 SDK" ||
      args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템") &&
    (candidateBucket === "tutorial" || candidateBucket === "webapp")
  ) {
    return true;
  }

  if (
    (args.projectType === "백엔드 API 서비스" || args.projectType === "API 서버" || args.projectType === "CLI 도구") &&
    (candidateBucket === "tutorial" || candidateBucket === "webapp")
  ) {
    return true;
  }

  return false;
}

function translateReadmeSummaryToKorean(args: {
  summary: string | null;
  plainTitle: string;
  outputType: string | null;
  stackSummary: string | null;
}) {
  const summary = cleanupNarrativeText(args.summary ?? "");
  if (!summary) return null;
  if (containsHangul(summary)) return summary;

  const normalized = summary.toLowerCase();

  if (/(github (repo|repository|repositories)|repo analysis|repository analysis|understand github)/i.test(normalized)) {
    return "GitHub 레포 구조를 빠르게 파악하게 돕습니다.";
  }

  if (/(workflow|automation|integrations?)/i.test(normalized)) {
    return args.outputType === "브라우저에서 보는 화면"
      ? "자동화 흐름을 만들고 실행 상태를 관리합니다."
      : "자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다.";
  }

  if (/\b(schedule|scheduling|booking|calendar|availability|meeting)s?\b/i.test(normalized)) {
    return "일정과 예약을 관리하는 서비스입니다.";
  }

  if (/(diagram|visuali[sz](e|ation)|graph|canvas|flowchart|mind map|erd)/i.test(normalized)) {
    return "구조와 흐름을 그림으로 보여주는 도구입니다.";
  }

  if (/\b(repository browsing|browse repositories|repository browser|repo browser|repo browsing|search repositories|repository search)\b/i.test(normalized)) {
    return "레포를 찾고 살펴보는 화면 중심 웹앱입니다.";
  }

  if (/(tutorial|learn|learning|starter|example|examples)/i.test(normalized)) {
    return "예제 앱과 참고 코드를 따라 보며 구조를 익히는 학습용 저장소입니다.";
  }

  if (/(design system|component library|ui kit|storybook)/i.test(normalized)) {
    return "재사용 UI 부품과 문서를 함께 살펴보는 디자인 시스템입니다.";
  }

  if (/(sdk|library|api client)/i.test(normalized)) {
    return /ai|openai|anthropic|llm/i.test(normalized) || /AI/.test(args.plainTitle)
      ? "다른 프로젝트에 붙여 AI 기능을 호출할 때 쓰는 라이브러리입니다."
      : "다른 프로젝트에서 필요한 기능을 불러다 쓰는 라이브러리입니다.";
  }

  if (/(api|backend|server)/i.test(normalized) && /(request|response|endpoint|http|rest)/i.test(normalized)) {
    return "요청을 받아 처리하고 데이터를 돌려주는 서버 역할을 합니다.";
  }

  if (/(web app|browser app|frontend|dashboard|workspace|interface)/i.test(normalized)) {
    return "브라우저에서 기능을 실행하고 결과를 보는 웹앱입니다.";
  }

  if (args.stackSummary && /web app|service|platform|tool/i.test(normalized)) {
    return `${args.stackSummary} 구조를 먼저 보면 전체 흐름이 빨리 잡힙니다.`;
  }

  return null;
}

function buildFallbackIdentitySubtitle(args: {
  plainTitle: string;
  outputType: string | null;
  stackSummary: string | null;
}) {
  if (/GitHub 레포/.test(args.plainTitle)) {
    return "복잡한 레포 구조를 화면, 설명, 읽는 순서로 먼저 정리해 보여줍니다.";
  }
  if (/구조와 흐름을 그림으로/.test(args.plainTitle)) {
    return "복잡한 구조를 박스와 흐름 기준으로 시각적으로 풀어 보는 도구입니다.";
  }
  if (/자동화 흐름/.test(args.plainTitle)) {
    return "브라우저 화면에서 자동화 흐름을 만들고 실행 상태를 관리하는 형태입니다.";
  }
  if (/일정과 예약/.test(args.plainTitle)) {
    return "일정 선택, 예약 생성, 관리 흐름을 서비스 관점에서 따라가며 읽을 수 있습니다.";
  }
  if (/디자인 시스템|UI 부품/.test(args.plainTitle)) {
    return "컴포넌트와 문서를 함께 보며 재사용 규칙을 파악할 수 있습니다.";
  }
  if (/학습용 저장소/.test(args.plainTitle)) {
    return "예제 앱과 참고 코드를 따라 보며 구조를 익히는 저장소입니다.";
  }
  if (/레포를 찾고 살펴보는/.test(args.plainTitle)) {
    return "목록 화면과 상세 화면을 따라가며 탐색 흐름을 읽는 웹앱입니다.";
  }
  if (/데이터와 설정을 관리/.test(args.plainTitle)) {
    return "관리 화면과 설정 변경 흐름을 기준으로 구조를 파악하면 됩니다.";
  }
  if (/AI 도구/.test(args.plainTitle)) {
    return "대화 입력과 응답 흐름을 중심으로 읽으면 주요 구조가 빠르게 잡힙니다.";
  }
  if (/API 서버/.test(args.plainTitle)) {
    return "요청과 응답 흐름을 따라가면 구조를 빠르게 파악할 수 있습니다.";
  }
  if (/라이브러리|SDK/.test(args.plainTitle)) {
    return "다른 코드에서 어떤 기능을 가져다 쓰는지 중심으로 읽으면 됩니다.";
  }
  if (/웹 서비스|웹앱/.test(args.plainTitle)) {
    return "화면과 요청 흐름을 함께 보면 전체 구조가 빠르게 잡힙니다.";
  }
  if (args.stackSummary) {
    return `${args.stackSummary} 구조를 먼저 보면 전체 흐름이 빨리 잡힙니다.`;
  }
  if (args.outputType === "브라우저에서 보는 화면") {
    return "브라우저 화면을 기준으로 구조를 따라가면 이해가 빠릅니다.";
  }
  if (args.outputType === "HTTP API 응답") {
    return "요청이 들어오고 처리된 뒤 응답이 나가는 흐름을 먼저 보면 됩니다.";
  }
  if (args.outputType === "다른 코드에서 불러다 쓰는 패키지") {
    return "내 코드에서 어떤 기능을 가져다 쓰는지 중심으로 보면 됩니다.";
  }
  if (args.outputType === "터미널 명령") {
    return "명령을 실행했을 때 어떤 흐름이 이어지는지 중심으로 보면 됩니다.";
  }
  return null;
}

function buildFeatureIdentityPoint(feature: string) {
  const cleaned = cleanupNarrativeText(feature);

  if (cleaned === "페이지 기반 진입 구조") {
    return {
      text: "주요 화면에서 어떤 동작이 시작되는지 먼저 볼 수 있습니다.",
      priority: 95,
    };
  }
  if (cleaned === "서버 요청 처리") {
    return {
      text: "요청이 어디로 들어와 처리되는지 빠르게 찾을 수 있습니다.",
      priority: 90,
    };
  }
  if (cleaned === "데이터 저장/조회") {
    return {
      text: "데이터가 저장되고 읽히는 지점을 바로 확인할 수 있습니다.",
      priority: 88,
    };
  }
  if (cleaned === "외부 서비스 연동") {
    return {
      text: "외부 서비스가 연결되는 지점을 한 번에 찾을 수 있습니다.",
      priority: 86,
    };
  }
  if (cleaned === "공용 패키지 + 앱 분리 구조") {
    return {
      text: "앱 코드와 공용 패키지가 어떻게 나뉘는지 바로 파악할 수 있습니다.",
      priority: 92,
    };
  }
  if (cleaned === "운영 문서 중심 구조") {
    return {
      text: "운영 문서와 규칙 파일을 먼저 읽으며 구조를 파악할 수 있습니다.",
      priority: 84,
    };
  }
  if (cleaned === "README 중심 시작 구조") {
    return {
      text: "README에서 프로젝트 목적과 시작 단서를 먼저 확인할 수 있습니다.",
      priority: 83,
    };
  }
  if (cleaned === "설정 파일 중심 시작 구조") {
    return {
      text: "설정 파일과 실행 단서부터 확인하며 구조를 파악할 수 있습니다.",
      priority: 83,
    };
  }
  if (cleaned === "명령줄 실행 흐름") {
    return {
      text: "명령을 실행했을 때 이어지는 처리 흐름을 따라갈 수 있습니다.",
      priority: 82,
    };
  }
  if (cleaned === "자동화/검증 스크립트 포함") {
    return {
      text: "자동화 스크립트와 검증 흐름을 구분해 읽을 수 있습니다.",
      priority: 82,
    };
  }
  if (cleaned === "라이브러리 진입점") {
    return {
      text: "다른 코드가 이 기능을 어디서 불러오는지 바로 찾을 수 있습니다.",
      priority: 80,
    };
  }
  if (cleaned === "컴포넌트 패키지 중심 구조") {
    return {
      text: "재사용 컴포넌트가 어떤 패키지에 모여 있는지 먼저 볼 수 있습니다.",
      priority: 87,
    };
  }
  if (cleaned === "재사용 템플릿 포함") {
    return {
      text: "반복되는 템플릿과 기본값이 어디에 모여 있는지 볼 수 있습니다.",
      priority: 76,
    };
  }
  if (cleaned === "재사용 컴포넌트 구조") {
    return {
      text: "화면 조각이 어떻게 나뉘어 재사용되는지 파악할 수 있습니다.",
      priority: 72,
    };
  }
  if (cleaned === "문서/쇼케이스 앱 동반") {
    return {
      text: "문서 화면과 실제 컴포넌트 코드를 함께 비교해 볼 수 있습니다.",
      priority: 68,
    };
  }
  if (cleaned === "여러 예제 앱 포함") {
    return {
      text: "비슷한 예제 앱을 비교하며 구조 차이를 읽을 수 있습니다.",
      priority: 64,
    };
  }
  if (/^워크스페이스 \d+개 감지$/.test(cleaned)) {
    return {
      text: "여러 앱과 패키지 묶음이 어떻게 나뉘는지 먼저 파악할 수 있습니다.",
      priority: 58,
    };
  }
  if (/^pack root \d+개 감지$/.test(cleaned)) {
    return {
      text: "여러 패키지 묶음이 어떻게 정리됐는지 먼저 파악할 수 있습니다.",
      priority: 56,
    };
  }

  return null;
}

function buildContextualIdentityPoints(args: {
  plainTitle: string;
  outputType: string | null;
}) {
  const points: Array<{ text: string; priority: number }> = [];

  if (/GitHub 레포/.test(args.plainTitle)) {
    points.push({
      text: "대표 화면과 분석 흐름을 먼저 보면 이 도구가 레포를 어떻게 정리하는지 바로 파악할 수 있습니다.",
      priority: 66,
    });
  }
  if (/구조와 흐름을 그림으로/.test(args.plainTitle)) {
    points.push({
      text: "박스와 연결선을 기준으로 주요 흐름을 먼저 훑어볼 수 있습니다.",
      priority: 64,
    });
  }
  if (/학습용 저장소/.test(args.plainTitle)) {
    points.push({
      text: "예제와 정답 구조를 비교하며 차이를 빠르게 읽을 수 있습니다.",
      priority: 64,
    });
  }
  if (/디자인 시스템|UI 부품/.test(args.plainTitle)) {
    points.push({
      text: "컴포넌트 코드와 문서 화면이 어떻게 맞물리는지 함께 볼 수 있습니다.",
      priority: 64,
    });
  }
  if (/라이브러리|SDK/.test(args.plainTitle) || args.outputType === "다른 코드에서 불러다 쓰는 패키지") {
    points.push({
      text: "패키지 진입점에서 실제 구현 코드로 이어지는 흐름을 순서대로 볼 수 있습니다.",
      priority: 64,
    });
  }
  if (/API 서버/.test(args.plainTitle) || args.outputType === "HTTP API 응답") {
    points.push({
      text: "요청 파일과 처리 로직을 나눠서 보면 전체 동작을 빠르게 이해할 수 있습니다.",
      priority: 62,
    });
  }
  if (args.outputType === "터미널 명령") {
    points.push({
      text: "명령 실행 뒤 이어지는 단계와 설정 파일을 함께 확인할 수 있습니다.",
      priority: 62,
    });
  }
  if (args.outputType === "브라우저에서 보는 화면") {
    points.push({
      text: "대표 화면에서 관련 로직과 요청 흐름으로 이어서 읽을 수 있습니다.",
      priority: 52,
    });
  }

  return points;
}

function buildFallbackIdentityPoints(args: {
  plainTitle: string;
  outputType: string | null;
  keyFeatures: string[];
}) {
  const candidates = [
    ...args.keyFeatures
      .map((feature) => buildFeatureIdentityPoint(feature))
      .filter((item): item is { text: string; priority: number } => Boolean(item)),
    ...buildContextualIdentityPoints({
      plainTitle: args.plainTitle,
      outputType: args.outputType,
    }),
  ]
    .sort((left, right) => right.priority - left.priority || left.text.localeCompare(right.text))
    .map((item) => cleanupNarrativeText(item.text))
    .filter((item, index, all) => item.length >= 8 && all.indexOf(item) === index);

  if (candidates.length === 0) {
    if (args.outputType === "HTTP API 응답") {
      return [
        "요청이 들어오는 파일과 실제 처리 로직을 순서대로 확인할 수 있습니다.",
        "대표 엔드포인트부터 읽으면 전체 동작을 빠르게 파악할 수 있습니다.",
      ];
    }
    if (args.outputType === "다른 코드에서 불러다 쓰는 패키지") {
      return [
        "패키지 진입점에서 실제 구현 코드로 이어지는 흐름을 순서대로 볼 수 있습니다.",
        "어떤 기능을 외부 코드가 가져다 쓰는지 먼저 파악할 수 있습니다.",
      ];
    }
    if (args.outputType === "터미널 명령") {
      return [
        "명령 실행 뒤 이어지는 처리 단계를 순서대로 볼 수 있습니다.",
        "대표 스크립트와 설정 파일을 함께 읽으며 구조를 파악할 수 있습니다.",
      ];
    }
    return [
      "대표 파일부터 읽는 순서를 잡아 구조를 빠르게 훑을 수 있습니다.",
      "핵심 폴더와 연결 지점을 나눠 보면 전체 구성이 더 빨리 잡힙니다.",
    ];
  }

  return candidates;
}

function buildGuaranteedIdentityPoint(args: {
  plainTitle: string;
  projectType: string;
  outputType: string | null;
}) {
  if (args.outputType === "HTTP API 응답" || /API 서버/.test(args.plainTitle)) {
    return "대표 엔드포인트와 처리 로직을 따라가며 구조를 읽을 수 있습니다.";
  }

  if (args.outputType === "다른 코드에서 불러다 쓰는 패키지" || /라이브러리|SDK/.test(args.plainTitle)) {
    return "패키지 진입점과 핵심 구현 파일을 따라가며 구조를 읽을 수 있습니다.";
  }

  if (args.outputType === "터미널 명령") {
    return "명령 실행 흐름과 관련 설정 파일을 함께 읽을 수 있습니다.";
  }

  if (
    args.outputType === "브라우저에서 보는 화면" ||
    args.projectType === "풀스택 웹앱" ||
    args.projectType === "프론트엔드 웹앱" ||
    args.projectType === "모노레포 웹 플랫폼"
  ) {
    return "대표 화면과 연결된 로직을 따라가며 구조를 읽을 수 있습니다.";
  }

  if (args.projectType === "학습용 예제 저장소") {
    return "대표 예제와 핵심 파일 순서를 따라가며 구조를 읽을 수 있습니다.";
  }

  return "대표 파일과 연결 지점을 따라가며 구조를 읽을 수 있습니다.";
}

function stripReadmePointLead(text: string) {
  return cleanupNarrativeText(text)
    .replace(/^[^A-Za-z0-9가-힣]+/, "")
    .replace(/^[A-Z][A-Za-z0-9 +/&-]{2,28}:\s*/, "")
    .trim();
}

function translateReadmePointToKorean(args: {
  point: string;
  plainTitle: string;
  outputType: string | null;
  stackSummary: string | null;
}) {
  const cleaned = stripReadmePointLead(args.point);
  if (!cleaned) return null;
  if (!isEnglishHeavy(cleaned)) return sentenceizeKoreanSubtitle(cleaned);

  const normalized = cleaned.toLowerCase();

  if (
    /(explain|understand).*(project|repo|repository).*(structure|architecture).*(plain language|simple|beginner)/i.test(
      normalized
    )
  ) {
    return "프로젝트 구조를 쉬운 말로 설명해 보여줍니다.";
  }

  if (
    /(highlight|show).*(key files?|important files?).*(reading order|read first|where to start)/i.test(
      normalized
    )
  ) {
    return "핵심 파일과 읽는 순서를 먼저 짚어 줍니다.";
  }

  if (
    /(show|preview|see).*(preview|screen|ui).*(before|ahead of).*(code|diving into the code)/i.test(
      normalized
    )
  ) {
    return "코드를 보기 전에 화면과 결과를 먼저 확인할 수 있습니다.";
  }

  if (
    /(show|see|view).*(repo|repository).*(layers?|layered).*(instead of).*(raw files?|file tree)/i.test(
      normalized
    )
  ) {
    return "파일 나열 대신 레이어 구조로 정리해 보여줍니다.";
  }

  if (
    /(highlight|show).*(first files?|files?).*(read).*(before editing|before you edit|before making changes)/i.test(
      normalized
    )
  ) {
    return "수정 전에 먼저 볼 파일을 바로 찾을 수 있습니다.";
  }

  if (
    /(convert|turn).*(github|repo|repository).*(system design|architecture|diagram|erd|flowchart|graph)/i.test(
      normalized
    )
  ) {
    return "GitHub 레포 구조를 아키텍처 다이어그램으로 바로 바꿔 볼 수 있습니다.";
  }

  if (
    /(copy|download|export).*(mermaid|png|diagram)|(mermaid|png).*(copy|download|export)/i.test(
      normalized
    )
  ) {
    return "생성된 다이어그램을 Mermaid 코드나 PNG로 내보낼 수 있습니다.";
  }

  if (
    /(show|see|check).*(availability|available times?).*(booking|schedule)|booking.*availability/i.test(
      normalized
    )
  ) {
    return "예약 전에 가능한 시간을 먼저 확인할 수 있습니다.";
  }

  if (
    /(community[- ]driven|community driven).*(open[- ]source|open source).*(scheduling|booking|calendar)/i.test(
      normalized
    )
  ) {
    return "커뮤니티 중심으로 운영되는 오픈소스 일정 관리 플랫폼입니다.";
  }

  if (/(open[- ]source|open source).*(scheduling|booking|calendar)/i.test(normalized)) {
    return "오픈소스로 운영되는 일정 관리 플랫폼입니다.";
  }

  const translatedSummary = translateReadmeSummaryToKorean({
    summary: cleaned,
    plainTitle: args.plainTitle,
    outputType: args.outputType,
    stackSummary: args.stackSummary,
  });

  if (translatedSummary) {
    return sentenceizeKoreanSubtitle(translatedSummary);
  }

  return null;
}

function buildIdentityHeader(args: {
  plainTitle: string;
  projectType: string;
  useCase: string | null;
  outputType: string | null;
  stackSummary: string | null;
  readmeCore: RepoReadmeGuide;
  keyFeatures: string[];
}): RepoIdentityGuide["header"] {
  const koreanReadmeSubtitle = translateReadmeSummaryToKorean({
    summary: args.readmeCore.summary,
    plainTitle: args.plainTitle,
    outputType: args.outputType,
    stackSummary: args.stackSummary,
  });
  const normalizedUseCase = cleanupNarrativeText(args.useCase ?? "");
  const fallbackSubtitle = buildFallbackIdentitySubtitle({
    plainTitle: args.plainTitle,
    outputType: args.outputType,
    stackSummary: args.stackSummary,
  });
  const subtitleCandidates = [
    koreanReadmeSubtitle,
    !isEnglishHeavy(normalizedUseCase) ? normalizedUseCase : null,
    fallbackSubtitle,
    !isEnglishHeavy(args.stackSummary) ? sentenceizeKoreanSubtitle(args.stackSummary ?? "") : null,
    sentenceizeKoreanSubtitle(args.outputType ?? ""),
  ]
    .map((item) => compressIdentitySubtitle(item ?? ""))
    .filter((item): item is string => Boolean(item))
    .filter((item) => !subtitleConflictsWithIdentity({
      candidate: item,
      plainTitle: args.plainTitle,
      projectType: args.projectType,
    }))
    .filter((item) => item.length > 0 && /[가-힣]/.test(item) && !isEnglishHeavy(item));
  const subtitle =
    subtitleCandidates.find((candidate) => suppressIfRedundant(candidate, args.plainTitle) !== null) ?? null;

  const readmePointCandidates = args.readmeCore.keyPoints.filter((item) => {
    const cleaned = cleanupNarrativeText(item);
    if (cleaned.length > 120) return false;
    if (
      /\b(active community|enterprise-ready|enterprise ready|powerful|feature-rich|scalable|modern|ready-to-use|templates?|integrations?)\b/i.test(
        cleaned
      )
    ) {
      return false;
    }
    return true;
  });
  const normalizedReadmePointCandidates = readmePointCandidates
    .map((item) =>
      translateReadmePointToKorean({
        point: item,
        plainTitle: args.plainTitle,
        outputType: args.outputType,
        stackSummary: args.stackSummary,
      })
    )
    .filter((item): item is string => Boolean(item));
  const fallbackPointCandidates = buildFallbackIdentityPoints({
    plainTitle: args.plainTitle,
    outputType: args.outputType,
    keyFeatures: args.keyFeatures,
  });
  const pointCandidates = [...normalizedReadmePointCandidates, ...fallbackPointCandidates];
  const references = [args.plainTitle, subtitle].filter((item): item is string => Boolean(item));
  const points: string[] = [];

  pointCandidates.forEach((candidate) => {
    const cleaned = cleanupNarrativeText(candidate);
    if (cleaned.length < 8) return;
    if (references.some((reference) => suppressIfRedundant(cleaned, reference) === null)) return;
    if (points.some((existing) => suppressIfRedundant(cleaned, existing) === null)) return;
    points.push(cleaned);
  });

  if (points.length === 0) {
    points.push(
      buildGuaranteedIdentityPoint({
        plainTitle: args.plainTitle,
        projectType: args.projectType,
        outputType: args.outputType,
      })
    );
  }

  return {
    subtitle,
    points: points.slice(0, 2),
  };
}

function stripMarkdownNarrative(text: string) {
  return text
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupNarrativeText(text: string | null | undefined) {
  if (!text) return "";
  return cleanupReadmeLine(stripMarkdownNarrative(text))
    .replace(README_MARKETING_WORD_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeNarrativeSentence(text: string) {
  if (text.length < 12) return false;
  if (text.length <= 40 && PREVIEW_LABEL_PATTERN.test(text)) return false;
  if (/^(installation|getting started|usage|license|contributing|requirements?)$/i.test(text)) return false;
  if (/```/.test(text) || looksLikeCommandLine(text)) return false;
  if (README_WARNING_PATTERN.test(text)) return false;
  if (README_INSTRUCTION_LINE_PATTERN.test(text)) return false;
  if (README_ADMONITION_PATTERN.test(text)) return false;
  if (README_INTERNAL_PACKAGE_PATTERN.test(text)) return false;
  if (looksLikePackageLabelOnly(text)) return false;
  return true;
}

function looksLikeReadmeBoilerplateSentence(text: string) {
  const cleaned = cleanupNarrativeText(text);
  if (!cleaned) return false;
  return (
    README_FRAMEWORK_BOILERPLATE_PATTERN.test(cleaned) ||
    README_FRAMEWORK_ONLY_PATTERN.test(cleaned)
  );
}

function narrativeSentences(text: string) {
  const cleaned = cleanupNarrativeText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function meaningfulReadmeSentence(text: string) {
  return (
    narrativeSentences(text).find(
      (sentence) =>
        looksLikeNarrativeSentence(sentence) &&
        !looksLikeReadmeNoise(sentence) &&
        !looksLikeReadmeBoilerplateSentence(sentence)
    ) ?? ""
  );
}

function firstSentence(text: string) {
  const cleaned = cleanupNarrativeText(text);
  if (!cleaned) return "";
  return cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() ?? cleaned;
}

function readmeLeadParagraph(text: string) {
  const introWindow = stripCodeBlocks(text).split(/\n(?=##\s+)/)[0] ?? stripCodeBlocks(text);
  const paragraphs = introWindow
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split(/\r?\n/)
        .filter((line) => !/^#{1,6}\s+/.test(line.trim()))
        .join(" ")
    )
    .filter((paragraph) => {
      const trimmed = paragraph.trim();
      return trimmed.length > 0 && !/^>/.test(trimmed) && !README_ADMONITION_PATTERN.test(trimmed);
    })
    .map((paragraph) => meaningfulReadmeSentence(paragraph))
    .filter(Boolean);

  return paragraphs.find((paragraph) => looksLikeNarrativeSentence(paragraph)) ?? "";
}

function readmeIntroText(readmes: ScopedReadme[]) {
  for (const readme of readmes) {
    const leadParagraph = readmeLeadParagraph(readme.text);
    if (leadParagraph) {
      return leadParagraph;
    }

    const sections = splitReadmeSections(readme.text);
    for (const section of sections) {
      const kind = classifyReadmeSection(section);
      if (kind === "quickstart" || kind === "docs" || kind === "architecture") {
        continue;
      }
      const paragraphs = section.body
        .split(/\n\s*\n/)
        .filter((paragraph) => {
          const trimmed = paragraph.trim();
          return trimmed.length > 0 && !/^>/.test(trimmed) && !README_ADMONITION_PATTERN.test(trimmed);
        })
        .map((paragraph) => meaningfulReadmeSentence(paragraph))
        .filter(Boolean);

      const intro = paragraphs.find((paragraph) => looksLikeNarrativeSentence(paragraph));
      if (intro) {
        return intro;
      }
    }
  }

  return "";
}

function classifyReadmeSection(section: ReadmeSection): ReadmeSectionKind {
  const heading = section.heading.trim();
  const body = stripCodeBlocks(section.body);

  if (!heading) {
    if (README_ARCHITECTURE_SIGNAL_PATTERN.test(body) && body.length < 220) {
      return "architecture";
    }
    return "intro";
  }
  if (README_QUICKSTART_HEADING_PATTERN.test(heading)) return "quickstart";
  if (README_ARCHITECTURE_HEADING_PATTERN.test(heading)) return "architecture";
  if (README_FEATURE_HEADING_PATTERN.test(heading)) return "features";
  if (README_AUDIENCE_HEADING_PATTERN.test(heading)) return "audience";
  if (README_DOCS_HEADING_PATTERN.test(heading)) return "docs";
  return "misc";
}

function readmeSectionText(section: ReadmeSection) {
  return stripCodeBlocks(section.body);
}

function looksLikeCommandLine(text: string) {
  return (
    /(^|\s)(pnpm|npm|yarn|bun|pip|uv|docker|cargo|go)\b/i.test(text) ||
    /(^|\s)(node|python)\s+[-\w./]/i.test(text)
  );
}

function looksLikeLinkOnlyLine(text: string) {
  return /^\[?[^\]]*\]?\(https?:\/\/[^)]+\)$/.test(text) || /^https?:\/\/\S+$/.test(text);
}

function looksLikeReadmeNoise(text: string) {
  return (
    README_WARNING_PATTERN.test(text) ||
    README_ADMONITION_PATTERN.test(text) ||
    README_INSTRUCTION_LINE_PATTERN.test(text) ||
    README_SETUP_DETAIL_PATTERN.test(text) ||
    README_INTERNAL_PACKAGE_PATTERN.test(text) ||
    README_PROMOTIONAL_POINT_PATTERN.test(text) ||
    README_PROMOTIONAL_COUNT_PATTERN.test(text) ||
    (README_GENERIC_NOISE_PATTERN.test(text) && !README_ARCHITECTURE_SIGNAL_PATTERN.test(text))
  );
}

function readmeCandidateLines(section: ReadmeSection) {
  return readmeSectionText(section)
    .split(/\r?\n/)
    .map((line) => cleanupNarrativeText(line))
    .filter((line) => line.length >= 10)
    .filter((line) => !looksLikeCommandLine(line))
    .filter((line) => !looksLikeLinkOnlyLine(line));
}

function extractReadmeAudience(readmes: ScopedReadme[], projectType: string) {
  const audienceTexts: string[] = [];

  for (const readme of readmes) {
    const leadParagraph = readmeLeadParagraph(readme.text);
    if (leadParagraph) {
      audienceTexts.push(leadParagraph);
    }

    const sections = splitReadmeSections(readme.text);
    for (const section of sections) {
      const kind = classifyReadmeSection(section);
      if (kind === "audience" || kind === "intro" || kind === "features" || kind === "misc") {
        audienceTexts.push(...readmeCandidateLines(section).slice(0, 4));
      }
    }
  }

  return (
    audienceFromText(audienceTexts.join(" "), projectType) ??
    audienceFromText(readmes.map((readme) => stripCodeBlocks(readme.text)).join(" "), projectType)
  );
}

function audienceFromText(text: string, projectType: string): string | null {
  const normalized = text.toLowerCase();

  if (/(design system|component library|ui kit|storybook)/i.test(normalized)) {
    return "프론트엔드 팀";
  }
  if (/(sdk|library|api client|developers?|engineers?)/i.test(normalized)) {
    return "개발자";
  }
  if (/(workflow|automation|ops|operations|integrations?)/i.test(normalized)) {
    return "자동화가 필요한 팀";
  }
  if (/(teams?|product|workspace|collaboration)/i.test(normalized)) {
    return "제품 팀";
  }
  if (/(tutorial|learn|learning|beginner|starter|example|examples)/i.test(normalized)) {
    return "학습자";
  }

  if (projectType === "학습용 예제 저장소") return "학습자";
  if (projectType === "컴포넌트 라이브러리 또는 디자인 시스템") return "프론트엔드 팀";
  if (projectType === "라이브러리 또는 SDK") return "개발자";

  return null;
}

function outputTypeFromProjectType(projectType: string, previewMode: RepoLearningGuide["preview"]["mode"]) {
  if (projectType === "풀스택 웹앱" || projectType === "프론트엔드 웹앱") {
    return "브라우저에서 보는 화면";
  }
  if (projectType === "모노레포 웹 플랫폼") {
    return "여러 앱과 패키지";
  }
  if (projectType === "백엔드 API 서비스" || projectType === "API 서버") {
    return "HTTP API 응답";
  }
  if (projectType === "CLI 도구") {
    return "터미널 명령";
  }
  if (projectType === "라이브러리 또는 SDK") {
    return "다른 코드에서 불러다 쓰는 패키지";
  }
  if (projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
    return "재사용 UI 컴포넌트와 문서";
  }
  if (projectType === "학습용 예제 저장소") {
    return "예제 앱과 참고 코드";
  }
  if (previewMode !== "none") {
    return "브라우저에서 보는 화면";
  }
  return null;
}

function plainTitleFromSignals(args: {
  repoName: string;
  projectType: string;
  semanticSignals: SemanticSignals;
  stackSummary: string | null;
  repoDescription: string | null;
  readmeIntro: string;
  useCase: string | null;
  focusRoot: string | null;
}) {
  const repoName = args.repoName.replace(/[-_./]+/g, " ");
  const combined = `${repoName} ${args.repoDescription ?? ""} ${args.readmeIntro} ${args.useCase ?? ""}`.toLowerCase();
  const hasDb =
    args.semanticSignals.dbClients.length > 0 ||
    /\b(postgres|postgresql|mysql|sqlite|mongo|database|db|prisma|supabase|firebase)\b/i.test(
      combined
    );
  const hasAi =
    args.semanticSignals.externalServices.some((item) =>
      item.names.some((name) => ["OpenAI", "Anthropic"].includes(name))
    ) || /\b(ai|openai|anthropic|llm)\b/i.test(combined);

  if (/(github repo|github repositories|github repository|repo analysis|repository analysis|understand github)/i.test(combined)) {
    return "GitHub 레포를 이해하기 쉽게 보여주는 도구";
  }
  if (/(workflow|automation|integrations?|automate)/i.test(combined)) {
    return "자동화 흐름을 만들고 실행하는 서비스";
  }
  if (/(diagram|visuali[sz](e|ation)|graph|canvas|flowchart|mind map|erd)/i.test(combined)) {
    return "구조와 흐름을 그림으로 보여주는 도구";
  }
  if (/\b(schedule|scheduling|booking|calendar|availability|meeting)s?\b/i.test(combined)) {
    return "일정과 예약을 관리하는 서비스";
  }
  if (/\b(repository browsing|browse repositories|repository browser|repo browser|repo browsing|search repositories|repository search)\b/i.test(combined)) {
    return args.projectType === "프론트엔드 웹앱"
      ? "레포를 찾고 살펴보는 화면 중심 웹앱"
      : "레포를 찾고 살펴보는 웹 서비스";
  }
  if (/\b(dashboard|admin(?: panel| app)?|console|backoffice|control panel)\b/i.test(combined)) {
    return "데이터와 설정을 관리하는 웹 서비스";
  }
  if (/\b(chat|assistant|copilot|agent)\b/i.test(combined) && hasAi) {
    return "대화로 작업을 돕는 AI 도구";
  }
  if (args.projectType === "학습용 예제 저장소") {
    return "예제와 튜토리얼을 모아 둔 학습용 저장소";
  }
  if (
    args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템" ||
    /(design system|component library|ui kit|component primitives|ui components?)/i.test(combined)
  ) {
    return "재사용 UI 컴포넌트를 모아 둔 디자인 시스템";
  }
  if (
    args.projectType === "모노레포 웹 플랫폼" &&
    args.focusRoot?.startsWith("packages/") &&
    args.stackSummary
  ) {
    return args.stackSummary;
  }
  if (/(web app|frontend app|browser app|next\.js app)/i.test(combined)) {
    return "브라우저에서 사용하는 화면 중심 웹앱";
  }
  if (/(sdk|api client)/i.test(combined)) {
    return hasAi ? "다른 코드에서 불러다 쓰는 AI SDK" : "다른 코드에서 불러다 쓰는 SDK";
  }

  if (args.projectType === "풀스택 웹앱") {
    if (hasAi && hasDb) return "AI와 데이터 저장이 함께 있는 웹 서비스";
    if (hasAi) return "AI 기능이 들어간 웹 서비스";
    if (hasDb) return "데이터 저장 구조가 있는 웹 서비스";
    return "브라우저에서 사용하는 웹 서비스";
  }
  if (args.projectType === "프론트엔드 웹앱") {
    return "브라우저에서 사용하는 화면 중심 웹앱";
  }
  if (args.projectType === "백엔드 API 서비스" || args.projectType === "API 서버") {
    return hasDb ? "데이터를 다루는 API 서버" : "요청을 처리하는 API 서버";
  }
  if (args.projectType === "CLI 도구") {
    return "터미널에서 쓰는 명령줄 도구";
  }
  if (args.projectType === "라이브러리 또는 SDK") {
    return hasAi ? "다른 코드에서 불러다 쓰는 AI 라이브러리" : "다른 코드에서 불러다 쓰는 라이브러리";
  }
  if (args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
    return "재사용 UI 부품을 모아 둔 저장소";
  }
  if (args.projectType === "모노레포 웹 플랫폼") {
    return "여러 앱과 공용 패키지를 함께 가진 모노레포 플랫폼";
  }
  if (args.projectType === "학습용 예제 저장소") {
    return "예제와 튜토리얼을 모아 둔 학습용 저장소";
  }
  if (args.stackSummary) {
    return args.stackSummary;
  }
  return `${args.projectType} 저장소`;
}

function normalizeUseCase(text: string | null | undefined) {
  const sentence = firstSentence(text ?? "");
  if (!looksLikeNarrativeSentence(sentence)) return null;
  return sentence
    .replace(/^this\s+(project|repository|repo|library|tool|app)\s+(is|provides|contains)\s+/i, "")
    .replace(/^a\s+/i, "")
    .replace(/^an\s+/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

function buildUseCase(args: {
  repoDescription: string | null;
  readmeIntro: string;
  keyFeatures: string[];
  outputType: string | null;
}) {
  const descriptionUseCase = normalizeUseCase(args.repoDescription);
  if (descriptionUseCase) return descriptionUseCase;

  const readmeUseCase = normalizeUseCase(args.readmeIntro);
  if (readmeUseCase) return readmeUseCase;

  const feature = args.keyFeatures.find((item) => cleanupNarrativeText(item).length >= 8);
  if (feature) {
    return cleanupNarrativeText(feature);
  }

  if (args.outputType === "브라우저에서 보는 화면") {
    return "브라우저에서 기능을 실행하고 결과를 확인하는 형태입니다.";
  }
  if (args.outputType === "다른 코드에서 불러다 쓰는 패키지") {
    return "다른 프로젝트 코드 안에서 불러다 쓰는 용도입니다.";
  }
  if (args.outputType === "HTTP API 응답") {
    return "요청을 받아 데이터를 돌려주는 서버 역할을 합니다.";
  }
  if (args.outputType === "터미널 명령") {
    return "터미널에서 명령을 실행해 결과를 확인하는 도구입니다.";
  }

  return null;
}

function readStepLabel(path: string | null, keyFile: KeyFileInfo | undefined) {
  if (!path) return "먼저 보기";
  if (/README\.mdx?$/i.test(path)) return "프로젝트 설명 보기";

  const layers = keyFile?.relatedLayers ?? [];
  if (layers.includes("UI")) return "첫 화면 보기";
  if (layers.includes("Logic")) return "핵심 로직 보기";
  if (layers.includes("API")) return "요청 처리 보기";
  if (layers.includes("DB")) return "데이터 연결 보기";
  if (layers.includes("External")) return "외부 서비스 보기";

  return "대표 파일 보기";
}

function readStepReason(path: string | null, keyFile: KeyFileInfo | undefined, fallbackReason: string | null) {
  if (fallbackReason) return cleanupNarrativeText(fallbackReason);
  if (!path) return "이 단계부터 보면 전체 구조를 덜 헷갈리게 잡을 수 있습니다.";
  if (/README\.mdx?$/i.test(path)) return "README에 프로젝트 목적과 실행 방법이 먼저 정리되어 있습니다.";
  if (keyFile?.whyImportant) return cleanupNarrativeText(keyFile.whyImportant);
  if (keyFile?.role) return `${cleanupNarrativeText(keyFile.role)} 역할을 먼저 보면 흐름이 빨리 잡힙니다.`;
  return "이 파일이 전체 구조를 이해하는 시작점입니다.";
}

function buildReadOrder(args: {
  readmes: ScopedReadme[];
  keyFiles: KeyFileInfo[];
  recommendedStartFile: string | null;
  recommendedStartReason: string | null;
}) {
  const steps: RepoIdentityGuide["readOrder"] = [];
  const seen = new Set<string>();
  const keyFileByPath = new Map(args.keyFiles.map((item) => [item.path, item]));

  const pushStep = (path: string | null, reason: string | null, fallbackKey = "__none__") => {
    const key = path ?? fallbackKey;
    if (seen.has(key)) return;
    seen.add(key);
    const keyFile = path ? keyFileByPath.get(path) : undefined;
    steps.push({
      label: readStepLabel(path, keyFile),
      path,
      reason: readStepReason(path, keyFile, reason),
    });
  };

  const primaryReadme = args.readmes[0]?.path ?? null;
  if (primaryReadme) {
    pushStep(primaryReadme, "README에 프로젝트 목적과 실행 방법이 먼저 정리되어 있습니다.");
  }

  const startPath = args.recommendedStartFile ?? args.keyFiles[0]?.path ?? null;
  if (startPath) {
    pushStep(startPath, args.recommendedStartReason);
  }

  const startLayers = new Set(keyFileByPath.get(startPath ?? "")?.relatedLayers ?? []);
  const followUp =
    args.keyFiles.find(
      (item) =>
        !seen.has(item.path) &&
        item.relatedLayers.some((layer) => !startLayers.has(layer))
    ) ?? args.keyFiles.find((item) => !seen.has(item.path));

  if (followUp) {
    pushStep(followUp.path, followUp.whyImportant);
  }

  if (steps.length < 3) {
    pushStep(null, "레이어와 주요 파일 관계를 함께 보면 전체 흐름이 빠르게 잡힙니다.");
  }

  return steps.slice(0, 3);
}

function preferredIdentityStart(args: {
  projectType: string;
  keyFiles: KeyFileInfo[];
  recommendedStartFile: string | null;
  recommendedStartReason: string | null;
}) {
  const preferredWebProject =
    args.projectType === "풀스택 웹앱" ||
    args.projectType === "프론트엔드 웹앱" ||
    args.projectType === "모노레포 웹 플랫폼" ||
    (/README\.mdx?$/i.test(args.recommendedStartFile ?? "") &&
      args.projectType !== "CLI 도구" &&
      args.projectType !== "라이브러리 또는 SDK" &&
      args.projectType !== "백엔드 API 서비스" &&
      args.projectType !== "API 서버");

  if (preferredWebProject) {
    const uiCandidate = args.keyFiles.find(
      (item) => item.relatedLayers.includes("UI") && !/README\.mdx?$/i.test(item.path)
    );
    if (uiCandidate) {
      return {
        path: uiCandidate.path,
        reason: cleanupNarrativeText(uiCandidate.whyImportant) || args.recommendedStartReason,
      };
    }
  }

  return {
    path: args.recommendedStartFile ?? args.keyFiles[0]?.path ?? null,
    reason:
      cleanupNarrativeText(args.recommendedStartReason) ||
      cleanupNarrativeText(args.keyFiles[0]?.whyImportant ?? "") ||
      null,
  };
}

function detectConsumptionMode(args: {
  projectType: string;
  outputType: string | null;
  allPaths: string[];
  pkg?: PackageJsonShape | null;
  workspacePkg?: PackageJsonShape | null;
  readmes: ScopedReadme[];
}) {
  const rootManifestImportSignals = Boolean(
    args.pkg?.exports || args.pkg?.main || args.pkg?.module || args.pkg?.types
  );
  const focusedManifestImportSignals = Boolean(
    args.workspacePkg?.exports ||
      args.workspacePkg?.main ||
      args.workspacePkg?.module ||
      args.workspacePkg?.types
  );
  const appLikeProjectType =
    args.projectType === "풀스택 웹앱" ||
    args.projectType === "프론트엔드 웹앱" ||
    args.projectType === "모노레포 웹 플랫폼" ||
    args.projectType === "백엔드 API 서비스" ||
    args.projectType === "API 서버" ||
    args.projectType === "학습용 예제 저장소";
  const hasDemoAppSurface = args.allPaths.some(
    (path) =>
      DEMO_SURFACE_ROOT_PATTERN.test(path) &&
      (APP_SURFACE_PATH_PATTERN.test(path) || DEMO_RUNTIME_CONFIG_PATTERN.test(path))
  );
  const fileImportSignals =
    args.allPaths.some((path) => LIBRARY_ENTRY_PATH_PATTERN.test(path)) ||
    args.allPaths.some((path) => /(^|\/)__init__\.py$/i.test(path));
  const readmeImportSignals = args.readmes.some(
    (readme) => IMPORT_USAGE_PATTERN.test(readme.text) || PYTHON_IMPORT_USAGE_PATTERN.test(readme.text)
  );
  const importSignals = appLikeProjectType
    ? readmeImportSignals || focusedManifestImportSignals
    : rootManifestImportSignals || focusedManifestImportSignals || fileImportSignals || readmeImportSignals;
  const userFacingCliSurface =
    args.projectType === "CLI 도구" ||
    Boolean(args.pkg?.bin || args.workspacePkg?.bin) ||
    args.allPaths.some((path) => /(^|\/)(bin\/|cli(\.|\/)|commands?\/)/i.test(path)) ||
    args.readmes.some((readme) => /\b(cli|command line|terminal)\b/i.test(readme.text));
  const runSignals =
    args.projectType === "풀스택 웹앱" ||
    args.projectType === "프론트엔드 웹앱" ||
    args.projectType === "모노레포 웹 플랫폼" ||
    args.projectType === "백엔드 API 서비스" ||
    args.projectType === "API 서버" ||
    args.projectType === "CLI 도구" ||
    args.projectType === "학습용 예제 저장소" ||
    args.allPaths.some((path) => APP_SURFACE_PATH_PATTERN.test(path)) ||
    args.readmes.some((readme) => RUN_USAGE_PATTERN.test(readme.text)) ||
    args.outputType === "브라우저에서 보는 화면" ||
    args.outputType === "여러 앱과 패키지" ||
    args.outputType === "HTTP API 응답" ||
    args.outputType === "터미널 명령" ||
    args.outputType === "예제 앱과 참고 코드";

  if (
    args.projectType === "라이브러리 또는 SDK" ||
    args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템"
  ) {
    if (importSignals && (userFacingCliSurface || hasDemoAppSurface)) {
      return "hybrid" as const;
    }
    return "import-as-library" as const;
  }

  if (importSignals && runSignals) {
    return "hybrid" as const;
  }
  if (runSignals) {
    return "run-as-app" as const;
  }
  if (importSignals) {
    return "import-as-library" as const;
  }
  return "unknown" as const;
}

function classifyReadmeLinkKind(link: ReadmeLink): RepoReadmeLink["kind"] {
  const signal = `${link.label} ${link.heading} ${link.url}`.toLowerCase();
  if (PREVIEW_LABEL_PATTERN.test(signal) || PREVIEW_HEADING_PATTERN.test(signal)) {
    return "demo";
  }
  if (/docs?|documentation|guide|reference/i.test(signal)) {
    return "docs";
  }
  if (isLikelyDeployUrl(link.url)) {
    return "deploy";
  }
  return "reference";
}

function normalizeReadmePoint(text: string) {
  return cleanupNarrativeText(text)
    .replace(/^[Ff]eatures?:\s*/, "")
    .replace(/^[Hh]ighlights?:\s*/, "")
    .replace(/^[Oo]verview:\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePackageLabelOnly(text: string) {
  return /^@?[\w./-]+$/.test(text);
}

function architectureSignalCount(text: string) {
  const matches = text.match(new RegExp(README_ARCHITECTURE_SIGNAL_PATTERN.source, "gi")) ?? [];
  return unique(matches.map((item) => item.toLowerCase())).length;
}

function looksLikeFilePathMention(text: string) {
  const matches = text.match(new RegExp(README_FILE_PATH_PATTERN.source, "gi")) ?? [];
  return matches.some((item) => {
    const token = item.trim().replace(/^[(/]+/, "").toLowerCase();
    return token !== "next.js" && token !== "node.js";
  });
}

function looksLikeArchitectureNarrative(text: string) {
  if (!README_ARCHITECTURE_SIGNAL_PATTERN.test(text)) return false;
  if (looksLikeReadmeNoise(text)) return false;
  if (looksLikeCommandLine(text) || looksLikeLinkOnlyLine(text)) return false;
  if (README_DOC_TUTORIAL_PATTERN.test(text)) return false;
  if (README_SETUP_DETAIL_PATTERN.test(text)) return false;
  if (looksLikeFilePathMention(text)) return false;
  if (/\{[^}]+\}/.test(text)) return false;
  return README_ARCHITECTURE_RELATION_PATTERN.test(text) || architectureSignalCount(text) >= 2;
}

function scoreReadmeKeyPoint(args: {
  line: string;
  kind: ReadmeSectionKind;
  scope: ScopedReadme["scope"];
  isBullet: boolean;
}) {
  let score = 0;
  if (args.scope === "focus") score += 14;
  if (args.kind === "features") score += 30;
  if (args.kind === "intro") score += 18;
  if (args.kind === "audience") score += 10;
  if (args.isBullet) score += 12;
  if (README_ARCHITECTURE_SIGNAL_PATTERN.test(args.line)) score -= 8;
  if (README_QUICKSTART_HEADING_PATTERN.test(args.line)) score -= 30;
  if (looksLikeCommandLine(args.line)) score -= 40;
  if (args.line.length > 180) score -= 10;
  if (args.line.length >= 30 && args.line.length <= 140) score += 8;
  return score;
}

function extractReadmeKeyPoints(readmes: ScopedReadme[]) {
  const candidates: Array<{ line: string; score: number }> = [];

  for (const readme of readmes) {
    const sections = splitReadmeSections(readme.text);
    for (const section of sections) {
      const kind = classifyReadmeSection(section);
      if (kind === "quickstart" || kind === "docs" || kind === "architecture") continue;

      const body = readmeSectionText(section);
      const rawLines = body.split(/\r?\n/);
      const bulletLines = rawLines
        .filter((line) => /^[-*+]\s+|^\d+\.\s+/.test(line.trim()))
        .map((line) => normalizeReadmePoint(line))
        .filter((line) => line.length >= 12)
        .filter((line) => !looksLikeCommandLine(line))
        .filter((line) => !looksLikeLinkOnlyLine(line))
        .filter((line) => !README_SETUP_DETAIL_PATTERN.test(line))
        .filter((line) => !looksLikeFilePathMention(line));

      bulletLines.forEach((line) => {
        if (kind !== "features" && kind !== "audience" && kind !== "intro") return;
        if (looksLikePackageLabelOnly(line)) return;
        if (looksLikeReadmeNoise(line)) return;
        candidates.push({
          line,
          score: scoreReadmeKeyPoint({
            line,
            kind,
            scope: readme.scope,
            isBullet: true,
          }),
        });
      });

      if (kind === "intro" || kind === "features") {
        const sentences = body
          .split(/\n\s*\n/)
          .map((paragraph) => normalizeReadmePoint(meaningfulReadmeSentence(paragraph)))
          .filter((line) => line.length >= 12)
          .filter((line) => looksLikeNarrativeSentence(line))
          .filter((line) => !looksLikeReadmeNoise(line))
          .filter((line) => !looksLikeReadmeBoilerplateSentence(line))
          .filter((line) => !looksLikePackageLabelOnly(line))
          .filter((line) => !README_SETUP_DETAIL_PATTERN.test(line))
          .filter((line) => !README_ARCHITECTURE_SIGNAL_PATTERN.test(line));

        sentences.forEach((line) => {
          candidates.push({
            line,
            score: scoreReadmeKeyPoint({
              line,
              kind,
              scope: readme.scope,
              isBullet: false,
            }),
          });
        });
      }
    }
  }

  return unique(candidates.map((item) => item.line))
    .map((line) => ({
      line,
      score: Math.max(...candidates.filter((item) => item.line === line).map((item) => item.score)),
    }))
    .sort((left, right) => right.score - left.score || left.line.length - right.line.length)
    .map((item) => item.line)
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

function scoreArchitectureNote(args: {
  line: string;
  kind: ReadmeSectionKind;
  scope: ScopedReadme["scope"];
}) {
  let score = 0;
  if (args.scope === "focus") score += 14;
  if (args.kind === "architecture") score += 32;
  if (args.kind === "intro") score += 8;
  if (README_ARCHITECTURE_SIGNAL_PATTERN.test(args.line)) score += 18;
  if (looksLikeCommandLine(args.line)) score -= 50;
  if (looksLikeLinkOnlyLine(args.line)) score -= 50;
  if (args.line.length > 220) score -= 8;
  return score;
}

function extractArchitectureNotes(readmes: ScopedReadme[]) {
  const candidates: Array<{ line: string; score: number }> = [];
  let architectureSectionCandidateCount = 0;

  for (const readme of readmes) {
    const sections = splitReadmeSections(readme.text);
    for (const section of sections) {
      const kind = classifyReadmeSection(section);
      if (kind !== "architecture" && kind !== "intro") continue;

      const lines = readmeCandidateLines(section)
        .map((line) => normalizeReadmePoint(line))
        .filter((line) => line.length >= 12)
        .filter((line) => looksLikeArchitectureNarrative(line));

      if (kind === "architecture") {
        architectureSectionCandidateCount += lines.length;
      }

      lines.forEach((line) => {
        candidates.push({
          line,
          score: scoreArchitectureNote({
            line,
            kind,
            scope: readme.scope,
          }),
        });
      });
    }
  }

  return unique(candidates.map((item) => item.line))
    .map((line) => ({
      line,
      score: Math.max(...candidates.filter((item) => item.line === line).map((item) => item.score)),
    }))
    .sort((left, right) => right.score - left.score || left.line.length - right.line.length)
    .filter((item) => architectureSectionCandidateCount === 0 || item.score >= 32)
    .map((item) => item.line)
    .slice(0, 3);
}

function buildReadmeCoreGuide(args: {
  readmes: ScopedReadme[];
  projectType: string;
  usage: RepoLearningGuide["usage"];
}): RepoReadmeGuide {
  const intro = readmeIntroText(args.readmes) || null;
  const linkCandidates = args.readmes.flatMap((readme) => extractReadmeLinks(readme.text));
  const links = linkCandidates
    .filter((link) => /^https?:\/\//i.test(link.url))
    .filter((link) => {
      try {
        const hostname = new URL(link.url).hostname.toLowerCase();
        return hostname !== "github.com" && !hostname.endsWith(".github.com") && hostname !== "raw.githubusercontent.com";
      } catch {
        return false;
      }
    })
    .map((link) => ({
      label: cleanupNarrativeText(link.label) || new URL(link.url).hostname.replace(/^www\./, ""),
      url: link.url,
      kind: classifyReadmeLinkKind(link),
    }))
    .slice(0, 4);

  const quickstart = [
    ...args.usage.install.filter((item) => item.length > 0).slice(0, 1),
    ...args.usage.run.filter((item) => item.length > 0).slice(0, 1),
  ].slice(0, 3);
  const keyPoints = extractReadmeKeyPoints(args.readmes);
  const audience = extractReadmeAudience(args.readmes, args.projectType);
  const architectureNotes = extractArchitectureNotes(args.readmes);
  const hasReadmeSignals =
    args.readmes.length > 0 &&
    (Boolean(intro) ||
      keyPoints.length > 0 ||
      quickstart.length > 0 ||
      links.length > 0 ||
      architectureNotes.length > 0);

  return {
    summary: intro,
    keyPoints,
    audience,
    quickstart,
    links,
    architectureNotes,
    source: !hasReadmeSignals ? "none" : quickstart.length > 0 ? "mixed" : "readme",
  };
}

function buildIdentityGuide(args: {
  analysisMode: AnalysisMode;
  repo: RepoAnalysis["repo"];
  allPaths: string[];
  pkg?: PackageJsonShape | null;
  workspacePkg?: PackageJsonShape | null;
  projectType: string;
  stack: string[];
  stackSummary: string | null;
  stackHighlights: RepoIdentityGuide["stackHighlights"];
  readmeCore: RepoReadmeGuide;
  keyFeatures: string[];
  semanticSignals: SemanticSignals;
  keyFiles: KeyFileInfo[];
  recommendedStartFile: string | null;
  recommendedStartReason: string | null;
  readmes: ScopedReadme[];
  focusRoot: string | null;
  previewMode: RepoLearningGuide["preview"]["mode"];
}): RepoIdentityGuide {
  const readmeIntro = readmeIntroText(args.readmes);
  const audience = audienceFromText(`${args.repo.description ?? ""}\n${readmeIntro}`, args.projectType);
  const outputType = outputTypeFromProjectType(args.projectType, args.previewMode);
  const useCase = buildUseCase({
    repoDescription: args.repo.description,
    readmeIntro,
    keyFeatures: args.keyFeatures,
    outputType,
  });
  const hasReadme = args.readmes.length > 0;
  const hasCodeSignals = args.stack.length > 0 || args.keyFiles.length > 0;
  const trustSource = hasReadme && hasCodeSignals ? "mixed" : hasCodeSignals ? "code" : hasReadme ? "readme" : "inferred";
  const trustNote =
    args.analysisMode === "limited"
      ? "핵심 코드와 설정 파일 기준으로 먼저 요약했습니다."
      : trustSource === "inferred"
        ? "명확한 설명 신호가 적어 일부는 추정으로 정리했습니다."
        : null;
  const start = preferredIdentityStart({
    projectType: args.projectType,
    keyFiles: args.keyFiles,
    recommendedStartFile: args.recommendedStartFile,
    recommendedStartReason: args.recommendedStartReason,
  });
  const plainTitle = plainTitleFromSignals({
    repoName: args.repo.name,
    projectType: args.projectType,
    semanticSignals: args.semanticSignals,
    stackSummary: args.stackSummary,
    repoDescription: args.repo.description,
    readmeIntro,
    useCase,
    focusRoot: args.focusRoot,
  });

  return {
    plainTitle,
    projectKind: args.projectType,
    consumptionMode: detectConsumptionMode({
      projectType: args.projectType,
      outputType,
      allPaths: args.allPaths,
      pkg: args.pkg,
      workspacePkg: args.workspacePkg,
      readmes: args.readmes,
    }),
    useCase,
    audience,
    outputType,
    coreStack: unique(args.stack).slice(0, 5),
    stackNarrative: buildStackNarrative(args.stackHighlights),
    stackHighlights: args.stackHighlights,
    header: buildIdentityHeader({
      plainTitle,
      projectType: args.projectType,
      useCase,
      outputType,
      stackSummary: args.stackSummary,
      readmeCore: args.readmeCore,
      keyFeatures: args.keyFeatures,
    }),
    startHere: start,
    readOrder: buildReadOrder({
      readmes: args.readmes,
      keyFiles: args.keyFiles,
      recommendedStartFile: start.path,
      recommendedStartReason: start.reason,
    }),
    trust: {
      source: trustSource,
      note: trustNote,
    },
  };
}

export function buildLearningGuide(args: {
  analysisMode: AnalysisMode;
  repo: RepoAnalysis["repo"];
  allPaths: string[];
  paths: string[];
  pkg?: PackageJsonShape | null;
  projectType: string;
  stack: string[];
  keyFeatures: string[];
  keyFiles: KeyFileInfo[];
  recommendedStartFile: string | null;
  recommendedStartReason: string | null;
  semanticSignals: SemanticSignals;
  focusRoot: string | null;
  readmePath: string | null;
  readmeText?: string | null;
  selectedFileContents?: Record<string, string>;
}): RepoLearningGuide {
  const readmes = findScopedReadmes({
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });
  const usage = buildUsageGuide({
    paths: args.paths,
    pkg: args.pkg,
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });
  const preview = buildPreviewGuide({
    repo: args.repo,
    pkg: args.pkg,
    focusRoot: args.focusRoot,
    readmePath: args.readmePath,
    readmeText: args.readmeText,
    selectedFileContents: args.selectedFileContents,
  });
  const stackSummary = buildStackSummary({
    projectType: args.projectType,
    stack: args.stack,
    semanticSignals: args.semanticSignals,
  });
  const workspacePkg = workspacePackageJson(args.selectedFileContents, args.focusRoot);
  const stackGlossary = buildStackGlossary({
    projectType: args.projectType,
    stack: args.stack,
    paths: args.paths,
    focusRoot: args.focusRoot,
    keyFiles: args.keyFiles,
    pkg: args.pkg,
    workspacePkg,
    semanticSignals: args.semanticSignals,
  });
  const stackHighlights = buildStackHighlights(stackGlossary, args.stack);
  const readmeCore = buildReadmeCoreGuide({
    readmes,
    projectType: args.projectType,
    usage,
  });

  return {
    identity: buildIdentityGuide({
      analysisMode: args.analysisMode,
      repo: args.repo,
      allPaths: args.allPaths,
      pkg: args.pkg,
      workspacePkg,
      projectType: args.projectType,
      stack: args.stack,
      stackSummary,
      stackHighlights,
      readmeCore,
      keyFeatures: args.keyFeatures,
      semanticSignals: args.semanticSignals,
      keyFiles: args.keyFiles,
      recommendedStartFile: args.recommendedStartFile,
      recommendedStartReason: args.recommendedStartReason,
      readmes,
      focusRoot: args.focusRoot,
      previewMode: preview.mode,
    }),
    readmeCore,
    stackSummary,
    stackGlossary,
    usage,
    preview,
    environment: buildEnvironmentGuide({
      repo: args.repo,
      allPaths: args.allPaths,
      pkg: args.pkg,
      semanticSignals: args.semanticSignals,
      focusRoot: args.focusRoot,
      readmePath: args.readmePath,
      readmeText: args.readmeText,
      selectedFileContents: args.selectedFileContents,
    }),
  };
}
