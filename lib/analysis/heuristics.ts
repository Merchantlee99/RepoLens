import type {
  Difficulty,
  EditGuideInfo,
  KeyFileInfo,
  LayerName,
  RepoLayer,
  RepoTopology,
} from "@/lib/analysis/types";

export type PackageJsonShape = {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin?: string | Record<string, string>;
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  keywords?: string[];
  workspaces?: string[] | { packages?: string[] };
  homepage?: string;
};

type AnalysisSignals = {
  routeFiles: string[];
  layoutFiles: string[];
  componentFiles: string[];
  apiFiles: string[];
  middlewareFiles: string[];
  logicFiles: string[];
  dbFiles: string[];
  externalFiles: string[];
  cliFiles: string[];
  libraryEntryFiles: string[];
  configFiles: string[];
  readmeFiles: string[];
};

export type BuildLayersOptions = {
  focusRoot?: string | null;
  scopeToFocusRoot?: boolean;
  projectType?: string | null;
};

export type LayerCoverageSummary = {
  buckets: Record<LayerName, string[]>;
  bucketConfidence: Record<LayerName, "high" | "medium" | "low">;
  scopedPaths: string[];
  codeLikePaths: string[];
  classifiedPaths: string[];
  uncoveredPaths: string[];
  uncoveredReasons: Array<{
    key: string;
    label: string;
    count: number;
    samples: string[];
  }>;
};

const LAYER_ORDER: LayerName[] = ["UI", "Logic", "API", "DB", "External"];

const ANALYSIS_INCLUDE_FILE =
  /(^|\/)(README\.(md|mdx)|package\.json|tsconfig\.json|next\.config\.(ts|js|mjs)|tailwind\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|eslint\.config\.(js|mjs)|firebase\.json|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json|prisma\/schema\.prisma)$/i;
const ANALYSIS_INCLUDE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|py|json|md|mdx|css|scss|prisma|sql|yml|yaml)$/i;
const ANALYSIS_EXCLUDE_SEGMENTS =
  /(^|\/)(node_modules|dist|build|coverage|out|\.next|\.turbo|vendor|tmp|temp|__tests__|tests|test|test-utils?|fixtures|stories|storybook|cypress|playwright|e2e|public|assets?|images?|docs\/generated)(\/|$)/i;
const ANALYSIS_EXCLUDE_FILES =
  /\.(png|jpg|jpeg|gif|webp|avif|ico|svg|mp4|mp3|wav|woff|woff2|ttf|otf|zip|gz|pdf|map|snap)$/i;
const ANALYSIS_EXCLUDE_CODE_FILES =
  /(^|\/)[^/]+\.(test|spec|stories|story)\.(ts|tsx|js|jsx|mjs|cjs|mdx)$/i;

const APP_PAGE_PATTERN = /(^|\/)app\/(?!api\/).+\/page\.(ts|tsx|js|jsx|mdx)$|(^|\/)app\/page\.(ts|tsx|js|jsx|mdx)$/;
const APP_LAYOUT_PATTERN = /(^|\/)app\/(?!api\/).+\/layout\.(ts|tsx|js|jsx|mdx)$|(^|\/)app\/layout\.(ts|tsx|js|jsx|mdx)$/;
const APP_SUPPORT_PATTERN =
  /(^|\/)app\/(?!api\/).+\/(loading|error|not-found|default|template)\.(ts|tsx|js|jsx|mdx)$|(^|\/)app\/(loading|error|not-found|default|template)\.(ts|tsx|js|jsx|mdx)$/;
const PAGES_ROUTE_PATTERN = /(^|\/)pages\/(?!api\/).+\.(ts|tsx|js|jsx|mdx)$|(^|\/)pages\/(index|_app|_document)\.(ts|tsx|js|jsx|mdx)$/;
const COMPONENT_PATTERN = /(^|\/)(components|ui)\/.+\.(ts|tsx|js|jsx|mdx)$/;
const SPA_ENTRY_PATTERN = /^(src\/)?(main|App)\.(tsx|jsx)$/i;
const API_PATTERN = /(^|\/)app\/.+\/route\.(ts|tsx|js|jsx)$|(^|\/)app\/route\.(ts|tsx|js|jsx)$|(^|\/)pages\/api\/.+\.(ts|tsx|js|jsx)$|(^|\/)pages\/api\.(ts|tsx|js|jsx)$|(^|\/)api\/.+\.(ts|tsx|js|jsx)$/;
const MIDDLEWARE_PATTERN = /(^|\/)middleware\.(ts|tsx|js|jsx)$/;
const LOGIC_PATTERN = /(^|\/)(lib|utils|hooks|services|stores?|actions|core|features)\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const PYTHON_LIBRARY_LOGIC_PATTERN = /(^|\/)src\/[^/]+\/.+\.py$/i;
const ROOT_SUPPORT_LOGIC_PATTERN =
  /(^|\/)(src\/)?(errors?|legacy|internal|webhooks?|constants?|experimental|keyboard|mouse|components\.(client|server))\.(ts|tsx|js|jsx|mjs|cjs)$|(^|\/)(src\/)?(server|mfa|client-boundary|app-router|runtime|platform[_-][a-z0-9_-]+)\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const SUPPORT_LOGIC_PATTERN =
  /(^|\/)(src\/)?app\/(init|router|polyfills)\.(ts|tsx|js|jsx|mjs|cjs)$|(^|\/)(src\/)?app\/(types|constants|plugins|workers|dev|event-bus)\/.+\.(ts|tsx|js|jsx|mjs|cjs|d\.ts)$|(^|\/)(src\/)?types\/.+\.(ts|tsx|js|jsx|mjs|cjs|d\.ts)$|(^|\/)(src\/)?(internal|experiments?)\/.+\.(ts|tsx|js|jsx|mjs|cjs|d\.ts)$|(^|\/)(Interface|interface|types?)\.(ts|tsx|d\.ts)$|(^|\/)shims?[-\w]*\.d\.ts$/i;
const DB_PATTERN =
  /(^|\/)(db|database|models?|model|prisma|drizzle|typeorm|sequelize|knex|supabase|firebase|mongoose|mongo|postgres|postgresql|mysql|sqlite)(\/.+|\.(ts|tsx|js|jsx|mjs|cjs|py|prisma|sql))$|(^|\/)(schema\.(prisma|sql)|migrations?\/.+\.(sql|prisma)|knexfile\.(ts|tsx|js|jsx|mjs|cjs)|prisma\.(ts|tsx|js|jsx|mjs|cjs)|drizzle\.(ts|tsx|js|jsx|mjs|cjs)|typeorm\.(ts|tsx|js|jsx|mjs|cjs)|sequelize\.(ts|tsx|js|jsx|mjs|cjs)|mongoose\.(ts|tsx|js|jsx|mjs|cjs))$/i;
const PYTHON_NON_DB_MODEL_PATTERN =
  /(^|\/)(types?|resources?|schemas?)\/models?\.py$|(^|\/)(cli\/_api|_api)\/models?\.py$/i;
const EXTERNAL_PATTERN = /(^|\/)(integrations?|vendors?|clients?)\/.+|(stripe|openai|slack|github|resend|clerk|auth0|sentry|vercel|anthropic)\.(ts|tsx|js|jsx)$/i;
const CLI_FILE_PATTERN = /(^|\/)(bin\/.*|cli\.(ts|js|mjs|cjs)|commands?\/.+|src\/cli\/.+|src\/commands?\/.+)/;
const LIBRARY_ENTRY_PATTERN = /(^|\/)(src\/)?index\.(ts|tsx|js|jsx|mjs|cjs)$|(^|\/)(src\/)?main\.(ts|js|mjs|cjs)$/;
const PYTHON_LIBRARY_ENTRY_PATTERN =
  /(^|\/)src\/[^/]+\/__init__\.py$|(^|\/)src\/[^/]+\/(_?client|_base_client|client)\.py$/i;
const OPERATION_DOC_PATTERN =
  /(^|\/)(AGENTS|CLAUDE|ETHOS|Prompt|Plan|Implement|Documentation|Subagent-Manifest|Automation-Intent|Design-Options|Review)\.md$/i;
const TOOLING_SCRIPT_PATTERN =
  /(^|\/)(scripts\/harness\/.+\.(py|ts|tsx|js|jsx|mjs|cjs)|\.(codex|claude)\/hooks\/.+\.(py|ts|tsx|js|jsx|mjs|cjs))$/i;
const TEMPLATE_FILE_PATTERN = /(^|\/)templates\/.+\.(md|mdx|json|ya?ml|py|ts|tsx|js|jsx|mjs|cjs)$/i;
const CONFIG_PATTERN =
  /(^|\/)(next\.config\.(ts|js|mjs)|tailwind\.config\.(ts|js|mjs)|tsconfig\.json|eslint\.config\.(js|mjs)|vite\.config\.(ts|js|mjs)|vitest\.config\.(ts|js|mjs|cjs)|jest\.config\.(ts|js|mjs|cjs)|playwright\.config\.(ts|js|mjs|cjs)|tsup\.config\.(ts|js|mjs|cjs)|firebase\.json|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json)$/;
const MONOREPO_MANIFEST_PATTERN =
  /(^|\/)(pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json)$/i;
const README_PATTERN = /(^|\/)README\.(md|mdx)$/i;
const CODE_LIKE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|scala|sql|prisma)$/i;
const TUTORIAL_TEXT_PATTERN =
  /(^|[\s(])(tutorial|course|workshop|starter|lesson|boilerplate|learning)(?=$|[\s).,:;-])|(^|[\s(])example(?:s)?(?=$|[\s).,:;-])/i;
const STRONG_LIBRARY_TEXT_PATTERN =
  /(component library|ui component|design system|ui kit|component primitives|primitives|unstyled|accessible components|sdk|client library|react component|typescript sdk|open-source ui)/i;
const STRONG_COMPONENT_LIBRARY_TEXT_PATTERN =
  /(component library|ui component|design system|ui kit|component primitives|primitives|unstyled|accessible components|react component|open-source ui|material design)/i;
const CLI_TEXT_PATTERN = /\b(command line|cli|terminal tool|console tool)\b/i;
const LIBRARY_USAGE_PATTERN =
  /\bimport\s+.+\s+from\s+["'][^"']+["']|\brequire\(\s*["'][^"']+["']\s*\)|\bfrom\s+[\w.]+\s+import\s+[\w*, ]+/i;
const WORKSPACE_SEGMENT_PATTERN =
  /^(apps|packages|services|workers|tooling|tools|playgrounds|sites|docs)\/[^/]+(?:\/[^/]+)*$/i;
const GENERIC_REPRESENTATIVE_NAME_PATTERN =
  /^(index|main|app|utils?|helpers?|constants?|types?|config)$/i;
const ROLE_HINT_NAME_PATTERN =
  /(page|layout|route|middleware|schema|model|migration|seed|client|provider|adapter|controller|service|store|action|query|mutation|repository|gateway|hook|form|panel|button|card|dialog|header|footer|hero|openai|stripe|github|slack|firebase|supabase|worker|job|queue|cron)/i;

const NODE_SERVER_DEPS = ["express", "fastify", "koa", "hono", "nestjs"];
const CLI_DEPS = ["commander", "yargs", "cac", "oclif", "zx"];
const EXTERNAL_DEPS = [
  "openai",
  "stripe",
  "@supabase/supabase-js",
  "firebase",
  "firebase-admin",
  "@slack/web-api",
  "@anthropic-ai/sdk",
];

const LAYER_DESCRIPTIONS: Record<LayerName, string> = {
  UI: "사용자가 보는 화면, 페이지, 재사용 컴포넌트를 담당하는 레이어입니다.",
  Logic: "여러 화면이나 서버 처리에서 공통으로 쓰는 로직과 유틸리티를 담는 레이어입니다.",
  API: "요청을 받아 처리하는 서버 진입점, middleware, API route를 담는 레이어입니다.",
  DB: "DB 연결, 스키마, ORM, 데이터 모델과 가까운 레이어입니다.",
  External: "외부 API, SDK, 서드파티 서비스 연결 지점을 담는 레이어입니다.",
};

const REPRESENTATIVE_BUCKET_ORDER: Record<LayerName, string[]> = {
  UI: ["route", "layout", "component", "support", "other"],
  Logic: ["service", "hook", "state", "action", "feature", "core", "other"],
  API: ["route", "middleware", "handler", "other"],
  DB: ["schema", "client", "migration", "seed", "other"],
  External: ["provider", "auth", "storage", "webhook", "other"],
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function uncoveredReasonForPath(path: string) {
  if (TOOLING_SCRIPT_PATTERN.test(path) || /^scripts\//i.test(path)) {
    return { key: "tooling", label: "스크립트/도구 코드" };
  }

  if (CLI_FILE_PATTERN.test(path)) {
    return { key: "cli", label: "CLI/명령 코드" };
  }

  if (isLibraryEntryPath(path)) {
    return { key: "entry", label: "엔트리/라이브러리 코드" };
  }

  if (/^(workers?|jobs?|queues?|cron|tasks?)\//i.test(path)) {
    return { key: "background", label: "백그라운드 작업 코드" };
  }

  if (/^src\/[^/]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)$/i.test(path)) {
    return { key: "src-root", label: "루트 소스 코드" };
  }

  if (/^[^/]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)$/i.test(path)) {
    return { key: "root-file", label: "루트 파일 코드" };
  }

  return { key: "other", label: "기타 공용 코드" };
}

function summarizeUncoveredReasons(paths: string[]) {
  const grouped = new Map<string, { key: string; label: string; count: number; samples: string[] }>();

  paths.forEach((path) => {
    const reason = uncoveredReasonForPath(path);
    const current = grouped.get(reason.key) ?? {
      key: reason.key,
      label: reason.label,
      count: 0,
      samples: [],
    };
    current.count += 1;
    if (current.samples.length < 3) {
      current.samples.push(path);
    }
    grouped.set(reason.key, current);
  });

  return [...grouped.values()].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label)
  );
}

function isCodeLikePath(path: string) {
  if (README_PATTERN.test(path)) {
    return false;
  }

  if (/\.d\.ts$/i.test(path)) {
    return false;
  }

  if (
    path === "package.json" ||
    path.endsWith("/package.json") ||
    CONFIG_PATTERN.test(path) ||
    MONOREPO_MANIFEST_PATTERN.test(path)
  ) {
    return false;
  }

  return CODE_LIKE_PATTERN.test(path) || TOOLING_SCRIPT_PATTERN.test(path);
}

function shortList(paths: string[], limit = 5) {
  return [...paths]
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, limit);
}

function dependencyMap(pkg?: PackageJsonShape | null) {
  return {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
    ...(pkg?.optionalDependencies ?? {}),
    ...(pkg?.peerDependencies ?? {}),
  };
}

function hasDependency(pkg: PackageJsonShape | null | undefined, name: string) {
  return Boolean(dependencyMap(pkg)[name]);
}

function hasAnyDependency(pkg: PackageJsonShape | null | undefined, names: string[]) {
  return names.some((name) => hasDependency(pkg, name));
}

function textSignal(...chunks: Array<string | null | undefined>) {
  return chunks.filter(Boolean).join(" ").toLowerCase();
}

function extractRouteRoot(path: string) {
  const segments = path.split("/");
  const appIndex = segments.findIndex((segment) => segment === "app" || segment === "pages");

  if (appIndex === -1) {
    return null;
  }

  return segments.slice(0, appIndex).join("/");
}

function dirname(path: string) {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

function normalizedRepresentativeName(path: string) {
  return basename(path).replace(/(\.[^.]+){1,2}$/i, "").toLowerCase();
}

function isGenericRepresentativeName(path: string) {
  return GENERIC_REPRESENTATIVE_NAME_PATTERN.test(normalizedRepresentativeName(path));
}

function hasRepresentativeRoleHint(path: string) {
  return ROLE_HINT_NAME_PATTERN.test(normalizedRepresentativeName(path));
}

function isLibraryEntryPath(path: string) {
  return LIBRARY_ENTRY_PATTERN.test(path) || PYTHON_LIBRARY_ENTRY_PATTERN.test(path);
}

function isLogicPath(path: string) {
  return (
    LOGIC_PATTERN.test(path) ||
    ROOT_SUPPORT_LOGIC_PATTERN.test(path) ||
    SUPPORT_LOGIC_PATTERN.test(path) ||
    TOOLING_SCRIPT_PATTERN.test(path) ||
    PYTHON_LIBRARY_LOGIC_PATTERN.test(path)
  );
}

function isDbPath(path: string) {
  return DB_PATTERN.test(path) && !PYTHON_NON_DB_MODEL_PATTERN.test(path);
}

function isWeakRepresentativeName(path: string) {
  return /^(utils?|helpers?|common|shared|types?|constants?|config|core|feature)$/i.test(
    normalizedRepresentativeName(path)
  );
}

function logicRepresentativeTieBreaker(path: string) {
  let score = 0;

  if (/(^|\/)services?\//i.test(path)) score += 20;
  if (/(^|\/)(actions?|store|hooks|repositories?|queries?|mutations?|workers?|jobs?)\//i.test(path)) {
    score += 16;
  }
  if (/(^|\/)features\//i.test(path)) score += 10;
  if (/(^|\/)core\//i.test(path)) score += 6;
  if (/(^|\/)(lib|utils)\//i.test(path)) score += 4;

  if (
    /(service|repository|repo|workflow|orchestrator|engine|processor|manager|store|action|hook|query|mutation|worker|job|queue)/i.test(
      normalizedRepresentativeName(path)
    )
  ) {
    score += 14;
  }

  if (isWeakRepresentativeName(path)) {
    score -= 16;
  }

  return score;
}

function externalRepresentativeTieBreaker(path: string) {
  let score = 0;

  if (/(openai|anthropic|langchain|pinecone|weaviate|supabase|firebase|clerk|auth0|stripe|resend)/i.test(path)) {
    score += 18;
  }
  if (/(slack|twilio|mailgun|sendgrid|redis|postgres|mongodb|s3|r2|blob)/i.test(path)) {
    score += 12;
  }
  if (/(github|sentry|vercel)/i.test(path)) {
    score += 6;
  }

  return score;
}

function rootSegment(path: string) {
  return path.split("/")[0] ?? "";
}

function hasWorkspaceField(pkg?: PackageJsonShape | null) {
  if (!pkg?.workspaces) {
    return false;
  }

  if (Array.isArray(pkg.workspaces)) {
    return pkg.workspaces.length > 0;
  }

  return Array.isArray(pkg.workspaces.packages) && pkg.workspaces.packages.length > 0;
}

function isWorkspaceStyleRoot(root: string) {
  return WORKSPACE_SEGMENT_PATTERN.test(root);
}

function workspaceLeaf(root: string) {
  return root.split("/").pop() ?? root;
}

function packageNameLeaf(packageName?: string | null) {
  if (!packageName) return null;
  return packageName.startsWith("@") ? packageName.split("/").slice(1).join("/") : packageName;
}

function normalizeRepoNameLeaf(repoName?: string | null) {
  if (!repoName) return null;
  return repoName.trim().replace(/\.git$/i, "").replace(/-repo$/i, "").toLowerCase();
}

function collectNestedPackageRoots(paths: string[]) {
  return unique(
    paths
      .filter((path) => path !== "package.json" && path.endsWith("/package.json"))
      .map((path) => dirname(path))
      .filter(Boolean)
  );
}

function collectSignals(paths: string[], pkg?: PackageJsonShape | null): AnalysisSignals {
  const routeFiles = paths.filter(
    (path) => APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)
  );
  const layoutFiles = paths.filter((path) => APP_LAYOUT_PATTERN.test(path));
  const componentFiles = paths.filter((path) => COMPONENT_PATTERN.test(path) || SPA_ENTRY_PATTERN.test(path));
  const apiFiles = paths.filter((path) => API_PATTERN.test(path));
  const middlewareFiles = paths.filter((path) => MIDDLEWARE_PATTERN.test(path));
  const logicFiles = paths.filter(
    (path) =>
      isLogicPath(path) ||
      TOOLING_SCRIPT_PATTERN.test(path)
  );
  const dbFiles = paths.filter((path) => isDbPath(path));
  const externalFiles = paths.filter((path) => EXTERNAL_PATTERN.test(path));
  const cliFiles = paths.filter((path) => CLI_FILE_PATTERN.test(path));
  const libraryEntryFiles = paths.filter((path) => isLibraryEntryPath(path));
  const configFiles = paths.filter((path) => CONFIG_PATTERN.test(path));
  const readmeFiles = paths.filter((path) => README_PATTERN.test(path));

  if (pkg?.bin && cliFiles.length === 0) {
    cliFiles.push("package.json#bin");
  }

  if ((pkg?.main || pkg?.module || pkg?.exports) && libraryEntryFiles.length === 0) {
    libraryEntryFiles.push("package.json#entry");
  }

  return {
    routeFiles: unique(routeFiles),
    layoutFiles: unique(layoutFiles),
    componentFiles: unique(componentFiles),
    apiFiles: unique(apiFiles),
    middlewareFiles: unique(middlewareFiles),
    logicFiles: unique(logicFiles),
    dbFiles: unique(dbFiles),
    externalFiles: unique(externalFiles),
    cliFiles: unique(cliFiles),
    libraryEntryFiles: unique(libraryEntryFiles),
    configFiles: unique(configFiles),
    readmeFiles: unique(readmeFiles),
  };
}

function collectRouteRoots(paths: string[]) {
  return unique(
    paths
      .map((path) => extractRouteRoot(path))
      .filter((root): root is string => root !== null)
  );
}

function hasRootApp(routeRoots: string[]) {
  return routeRoots.some((root) => root === "" || root === "src");
}

function collectWorkspaceRoots(paths: string[]) {
  const packageRoots = collectNestedPackageRoots(paths);
  const routeRoots = collectRouteRoots(paths).filter((root) => root && root !== "src");

  return unique(
    [
      ...packageRoots.filter((root) => isWorkspaceStyleRoot(root)),
      ...routeRoots.filter((root) => isWorkspaceStyleRoot(root)),
    ].sort((a, b) => a.localeCompare(b))
  );
}

function collectWorkspaceGroups(workspaceRoots: string[]) {
  const groups = new Map<string, string[]>();

  for (const root of workspaceRoots) {
    const group = root.split("/")[0] ?? "workspace";
    const current = groups.get(group) ?? [];
    current.push(root);
    groups.set(group, current);
  }

  return [...groups.entries()]
    .map(([name, roots]) => ({
      name,
      roots: roots.sort((a, b) => a.localeCompare(b)),
      count: roots.length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function workspacePaths(paths: string[], root: string) {
  return paths.filter((path) => path.startsWith(`${root}/`) || path === `${root}/package.json`);
}

function collectLibraryWorkspaceRoots(paths: string[]) {
  const workspaceRoots = collectWorkspaceRoots(paths);

  return workspaceRoots.filter((root) => {
    if (!/^(packages|tooling|tools)\//.test(root)) {
      return false;
    }

    if (isExampleStyleRoot(root) || isSupportWorkspaceRoot(root)) {
      return false;
    }

    const scoped = workspacePaths(paths, root);
    const hasPackageManifest = scoped.some((path) => path === `${root}/package.json`);
    const hasLibraryEntry = scoped.some((path) => isLibraryEntryPath(path));
    const hasLibraryLogic = scoped.some(
      (path) =>
        isLogicPath(path) ||
        COMPONENT_PATTERN.test(path) ||
        path.endsWith("/src/index.ts") ||
        path.endsWith("/src/index.tsx")
    );
    const hasSourceLikeFiles = scoped.some(
      (path) =>
        /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx)$/.test(path) &&
        !README_PATTERN.test(path) &&
        !path.endsWith("/package.json")
    );

    return hasPackageManifest && (hasLibraryEntry || hasLibraryLogic || hasSourceLikeFiles);
  });
}

function collectComponentLibraryWorkspaceRoots(paths: string[]) {
  return collectLibraryWorkspaceRoots(paths).filter((root) => {
    const leaf = workspaceLeaf(root);
    const scoped = workspacePaths(paths, root);
    const segments = root.split("/");
    const hasComponentHint = segments.some((segment) =>
      /^(ui|react|vue|material|system|primitives?|headless|radix|shadcn|kit|components?|icons?|tokens?|themes?)$/i.test(
        segment
      )
    );

    return (
      hasComponentHint ||
      /^(ui|react|vue|material|system|primitives?|headless|radix|shadcn|kit|components?|icons?)$/i.test(leaf) ||
      scoped.some((path) => /\.(tsx|jsx)$/.test(path)) ||
      scoped.some((path) => /(^|\/)(components?|icons?|styles?)\//i.test(path))
    );
  });
}

function collectSupportWorkspaceRoots(paths: string[]) {
  return collectWorkspaceRoots(paths).filter(
    (root) =>
      /^(apps|sites|docs|playgrounds)\//.test(root) &&
      (isSupportWorkspaceRoot(root) || isExampleStyleRoot(root) || isVersionedWorkspaceRoot(root))
  );
}

function hasParentWorkspaceRoot(root: string, workspaceRoots: string[]) {
  const segments = root.split("/");

  for (let index = segments.length - 1; index > 1; index -= 1) {
    const parent = segments.slice(0, index).join("/");
    if (workspaceRoots.includes(parent)) {
      return true;
    }
  }

  return false;
}

function extractReadmeWorkspacePackageHints(readmeText?: string | null) {
  if (!readmeText) {
    return [];
  }

  const installPattern =
    /(?:^|\s)(?:npm\s+install|pnpm\s+add|yarn\s+add|bun\s+add)\s+((?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)(?:\s+(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+))*)/gim;
  const hints: string[] = [];

  for (const match of readmeText.matchAll(installPattern)) {
    const packages = (match[1] ?? "")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const packageName of packages) {
      const leaf = packageName.startsWith("@")
        ? packageName.split("/").slice(1).join("/")
        : packageName;
      if (leaf) {
        hints.push(leaf.toLowerCase());
      }
    }
  }

  return unique(hints);
}

function extractReadmeWorkspaceRootHints(readmeText?: string | null) {
  if (!readmeText) {
    return [];
  }

  const rootPattern =
    /(?:^|[\s(])\.?((?:packages|apps|sites|services|tools|tooling)\/[a-z0-9._-]+(?:\/[a-z0-9._-]+)?)(?:\/README\.(?:md|mdx))/gim;
  const hints: string[] = [];

  for (const match of readmeText.matchAll(rootPattern)) {
    const root = match[1]?.replace(/^\.\//, "").trim();
    if (root) {
      hints.push(root);
    }
  }

  return unique(hints);
}

function scoreLibraryWorkspaceRoot(
  root: string,
  paths: string[],
  workspaceRoots = collectWorkspaceRoots(paths),
  options?: { readmeText?: string | null; repoName?: string | null },
  pkg?: PackageJsonShape | null
) {
  const scoped = workspacePaths(paths, root);
  const depth = root.split("/").length;
  const leaf = workspaceLeaf(root);
  const hasParentRoot = hasParentWorkspaceRoot(root, workspaceRoots);
  const readmePackageHints = extractReadmeWorkspacePackageHints(options?.readmeText);
  const readmeWorkspaceRootHints = extractReadmeWorkspaceRootHints(options?.readmeText);
  const readmeHintIndex = readmePackageHints.indexOf(leaf.toLowerCase());
  const readmeRootHintIndex = readmeWorkspaceRootHints.indexOf(root);
  const rootPackageLeaf = packageNameLeaf(pkg?.name)?.toLowerCase() ?? null;
  const repoNameLeaf = normalizeRepoNameLeaf(options?.repoName);

  let score = Math.min(scoped.length, 24) * 4 - depth * 6;

  if (scoped.length > 60) score += 24;
  if (scoped.length > 160) score += 12;

  if (root.startsWith("packages/")) score += 48;
  if (depth === 2) score += 24;
  if (depth >= 3) score -= 18;
  if (hasParentRoot) score -= 42;
  if (/(^|\/)(sdk|core|client|server|react|node|js|ts|ui|material|system|primitives?|headless|shadcn|kit)$/i.test(root)) {
    score += 18;
  }
  if (scoped.some((path) => path === `${root}/package.json`)) score += 32;
  if (scoped.some((path) => isLibraryEntryPath(path))) score += 42;
  if (scoped.some((path) => isLogicPath(path))) score += 20;
  if (scoped.some((path) => COMPONENT_PATTERN.test(path))) score += 8;
  if (scoped.some((path) => README_PATTERN.test(path))) score += 6;
  if (depth === 2 && readmeHintIndex !== -1) {
    score += 52 - Math.min(readmeHintIndex, 4) * 8;
  }
  if (readmeRootHintIndex !== -1) {
    score += 96 - Math.min(readmeRootHintIndex, 4) * 12;
  }
  if (depth === 2 && rootPackageLeaf === leaf.toLowerCase()) {
    score += 132;
  }
  if (depth === 2 && repoNameLeaf === leaf.toLowerCase()) {
    score += 112;
  }
  if (/^(core|react|sdk|ui|material|system|primitives?|headless|shadcn)$/i.test(leaf)) {
    score += 20;
  }
  if (/(nextjs|react-router|nuxt|astro|express|fastify|hono|expo|vue)/i.test(leaf)) {
    score += 18;
  }
  if (/(codemod|envinfo|tracker|types?|icons?|private|benchmark|bench|test|tests?|storybook|playground|playgrounds|utils?|docs?)/i.test(leaf)) {
    score -= 40;
  }

  return score;
}

function componentLibraryDominates(args: { componentLibraryRoots: string[]; primaryAppRoots: string[]; text: string }) {
  if (args.componentLibraryRoots.length === 0) {
    return false;
  }

  if (args.primaryAppRoots.length === 0) {
    return isStrongComponentLibraryText(args.text) || args.componentLibraryRoots.length >= 3;
  }

  return (
    isStrongComponentLibraryText(args.text) &&
    (args.componentLibraryRoots.length >= Math.max(3, args.primaryAppRoots.length * 2) ||
      (args.primaryAppRoots.length <= 1 && args.componentLibraryRoots.length >= 2))
  );
}

function shouldPreferComponentLibraryFocus(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options?: { readmeText?: string | null; repoName?: string | null }
) {
  if (!isMonorepoProject(paths, pkg)) {
    return false;
  }

  const text = textSignal(pkg?.description, options?.readmeText, pkg?.keywords?.join(" "));
  const hasExplicitSdkText = /\bsdks?\b|typescript sdks?|client libraries?|client library/.test(text);
  const primaryAppRoots = collectWorkspaceRoots(paths).filter((root) => isPrimaryAppWorkspaceRoot(root, paths));
  const componentLibraryRoots = collectComponentLibraryWorkspaceRoots(paths);
  const supportRoots = collectSupportWorkspaceRoots(paths);
  const dominantComponentRoots = componentLibraryDominates({
    componentLibraryRoots,
    primaryAppRoots,
    text,
  });

  return (
    componentLibraryRoots.length > 0 &&
    (primaryAppRoots.length === 0 || dominantComponentRoots) &&
    (!hasExplicitSdkText || isStrongComponentLibraryText(text)) &&
    (isStrongComponentLibraryText(text) || supportRoots.length > 0 || dominantComponentRoots)
  );
}

function shouldPreferLibraryWorkspaceFocus(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options?: { readmeText?: string | null; repoName?: string | null }
) {
  if (!isMonorepoProject(paths, pkg)) {
    return false;
  }

  const text = textSignal(pkg?.description, options?.readmeText, pkg?.keywords?.join(" "));
  const blockingAppRoots = collectWorkspaceRoots(paths).filter((root) =>
    isPrimaryAppWorkspaceRoot(root, paths)
  );
  const libraryWorkspaceRoots = collectLibraryWorkspaceRoots(paths);
  const routeRoots = collectRouteRoots(paths).filter((root) => root);
  const nonSupportRouteRoots = routeRoots.filter(
    (root) => !isSupportWorkspaceRoot(root) && !isExampleStyleRoot(root) && !isVersionedWorkspaceRoot(root)
  );
  const readmeWorkspaceRootHints = extractReadmeWorkspaceRootHints(options?.readmeText);
  const repoNameLeaf = normalizeRepoNameLeaf(options?.repoName);
  const hasDirectLibraryRootHint = libraryWorkspaceRoots.some((root) => readmeWorkspaceRootHints.includes(root));
  const hasRepoNamedLibraryRoot = repoNameLeaf
    ? libraryWorkspaceRoots.some((root) => workspaceLeaf(root).toLowerCase() === repoNameLeaf)
    : false;
  const hasLibraryRootHint = hasDirectLibraryRootHint || hasRepoNamedLibraryRoot;

  return (
    libraryWorkspaceRoots.length > 0 &&
    ((blockingAppRoots.length === 0 && (nonSupportRouteRoots.length === 0 || hasLibraryRootHint)) ||
      ((isStrongLibraryText(text) || hasLibraryRootHint) &&
        libraryWorkspaceRoots.length >= Math.max(1, blockingAppRoots.length)))
  );
}

function shouldPreferComponentLibraryProjectType(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  stack: string[];
  repositoryDescription?: string | null;
  readmeText?: string | null;
}) {
  const text = textSignal(
    args.pkg?.description,
    args.repositoryDescription,
    args.readmeText,
    args.pkg?.keywords?.join(" ")
  );
  const primaryAppRoots = collectWorkspaceRoots(args.paths).filter((root) =>
    isPrimaryAppWorkspaceRoot(root, args.paths)
  );
  const componentLibraryRoots = collectComponentLibraryWorkspaceRoots(args.paths);
  const supportRoots = collectSupportWorkspaceRoots(args.paths);
  const hasExplicitSdkText = /\bsdks?\b|typescript sdks?|client libraries?|client library/.test(text);
  const hasReactComponentSignal =
    args.stack.includes("React") ||
    hasDependency(args.pkg, "react") ||
    args.paths.some((path) => /\.(tsx|jsx)$/.test(path));
  const dominantComponentRoots = componentLibraryDominates({
    componentLibraryRoots,
    primaryAppRoots,
    text,
  });

  return (
    componentLibraryRoots.length > 0 &&
    (primaryAppRoots.length === 0 || dominantComponentRoots) &&
    hasReactComponentSignal &&
    (!hasExplicitSdkText || isStrongComponentLibraryText(text)) &&
    (isStrongComponentLibraryText(text) || supportRoots.length > 0 || dominantComponentRoots)
  );
}

function shouldPreferLibraryProjectType(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  repositoryDescription?: string | null;
  readmeText?: string | null;
}) {
  if (!isMonorepoProject(args.paths, args.pkg)) {
    return false;
  }

  const text = textSignal(
    args.pkg?.description,
    args.repositoryDescription,
    args.readmeText,
    args.pkg?.keywords?.join(" ")
  );
  const blockingAppRoots = collectWorkspaceRoots(args.paths).filter((root) =>
    isPrimaryAppWorkspaceRoot(root, args.paths)
  );
  const libraryWorkspaceRoots = collectLibraryWorkspaceRoots(args.paths);
  const routeRoots = collectRouteRoots(args.paths).filter((root) => root);
  const nonSupportRouteRoots = routeRoots.filter(
    (root) => !isSupportWorkspaceRoot(root) && !isExampleStyleRoot(root) && !isVersionedWorkspaceRoot(root)
  );
  const strongLibraryText = isStrongLibraryText(text);

  return (
    libraryWorkspaceRoots.length > 0 &&
    ((blockingAppRoots.length === 0 &&
      (nonSupportRouteRoots.length === 0 || /(sdk|library|package|client|typescript)/i.test(text))) ||
      (strongLibraryText && libraryWorkspaceRoots.length >= blockingAppRoots.length))
  );
}

function shouldPreferLibraryOverCliProjectType(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  repositoryDescription?: string | null;
  readmeText?: string | null;
}) {
  const text = textSignal(
    args.pkg?.description,
    args.repositoryDescription,
    args.readmeText,
    args.pkg?.keywords?.join(" ")
  );
  const hasExplicitLibraryText =
    isStrongLibraryText(text) ||
    /\b(official .*sdk|sdk|client library|client libraries|python library|typescript sdk|javascript sdk|api client|package for)\b/i.test(
      text
    );
  const hasImportUsageSignal =
    LIBRARY_USAGE_PATTERN.test(args.readmeText ?? "") ||
    Boolean(args.pkg?.main || args.pkg?.module || args.pkg?.exports || args.pkg?.types) ||
    args.paths.some((path) => isLibraryEntryPath(path));
  const hasCliText = CLI_TEXT_PATTERN.test(text);
  const hasCliPackageSignal = Boolean(args.pkg?.bin) || hasAnyDependency(args.pkg, CLI_DEPS);
  const hasCliFiles = args.paths.some((path) => CLI_FILE_PATTERN.test(path));
  const hasAnyCliSignal = hasCliText || hasCliPackageSignal || hasCliFiles;

  let score = 0;
  if (hasExplicitLibraryText) score += 3;
  if (hasImportUsageSignal) score += 3;
  if (Boolean(args.pkg?.exports || args.pkg?.main || args.pkg?.module || args.pkg?.types)) score += 2;
  if (args.paths.some((path) => /(^|\/)__init__\.py$/i.test(path))) score += 1;
  if (hasCliFiles) score -= 1;
  if (hasCliPackageSignal) score -= 2;
  if (hasCliText) score -= 2;

  return hasAnyCliSignal && score >= 2 && (hasExplicitLibraryText || hasImportUsageSignal);
}

function isMonorepoProject(paths: string[], pkg?: PackageJsonShape | null) {
  const workspaceRoots = collectWorkspaceRoots(paths);
  const manifestCount = paths.filter((path) => MONOREPO_MANIFEST_PATTERN.test(path)).length;
  const groupCount = unique(workspaceRoots.map((root) => root.split("/")[0])).length;

  return (
    hasWorkspaceField(pkg) ||
    manifestCount > 0 ||
    workspaceRoots.length >= 3 ||
    (workspaceRoots.length >= 2 && groupCount >= 2)
  );
}

function isExampleCollection(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  repositoryDescription?: string | null;
  readmeText?: string | null;
}) {
  const routeRoots = collectRouteRoots(args.paths);
  const text = textSignal(
    args.pkg?.description,
    args.repositoryDescription,
    args.readmeText,
    args.pkg?.keywords?.join(" ")
  );
  const topLevelRoots = unique(
    routeRoots
      .filter((root) => root && root !== "src")
      .map((root) => root.split("/")[0])
  );
  const tutorialText = TUTORIAL_TEXT_PATTERN.test(text);
  const namedExampleRoots = routeRoots.filter((root) =>
    /(example|examples|starter|tutorial|learn|course|demo|final|lesson|step|solution|reference|complete)/i.test(
      root
    )
  );

  return (
    (!hasRootApp(routeRoots) &&
      routeRoots.length >= 3 &&
      topLevelRoots.length >= 2 &&
      (tutorialText || namedExampleRoots.length >= 1)) ||
    (tutorialText && routeRoots.length >= 2) ||
    namedExampleRoots.length >= 2
  );
}

function isExampleStyleRoot(root: string) {
  return /(^|\/)(example|examples|starter|tutorial|learn|course|demo|lesson|step|playground|playgrounds|sandbox|showcase|preview)(\/|$)/i.test(
    root
  );
}

function isSupportWorkspaceRoot(root: string) {
  return /(^|\/)(docs|storybook|playground|playgrounds|sandbox|showcase|preview|test|tests|testing|ssr-testing|bench|benchmark)(\/|$)/i.test(
    root
  );
}

function isVersionedWorkspaceRoot(root: string) {
  return /(^|\/)v\d+$/i.test(root);
}

function isSupportOrDemoPath(path: string) {
  return /(^|\/)(docs|website|site|demo|demos|example|examples|playground|playgrounds|sandbox|showcase|preview|storybook)(\/|$)/i.test(
    path
  );
}

function supportOnlyUiSurface(signals: ReturnType<typeof collectSignals>) {
  const uiPaths = unique([
    ...signals.routeFiles,
    ...signals.layoutFiles,
    ...signals.componentFiles,
  ]);

  return uiPaths.length > 0 && uiPaths.every((path) => isSupportOrDemoPath(path));
}

function isStrongLibraryText(text: string) {
  return STRONG_LIBRARY_TEXT_PATTERN.test(text);
}

function isStrongComponentLibraryText(text: string) {
  return STRONG_COMPONENT_LIBRARY_TEXT_PATTERN.test(text);
}

function isLibraryLikeProjectType(projectType?: string) {
  return (
    projectType === "라이브러리 또는 SDK" ||
    projectType === "컴포넌트 라이브러리 또는 디자인 시스템"
  );
}

function isPrimaryAppWorkspaceRoot(root: string, paths?: string[]) {
  const matchesRootName =
    /^(apps|sites|services)\//.test(root) ||
    (/^packages\//.test(root) &&
      /(^|\/)(app|web|www|site|dashboard|frontend|editor|studio|portal|admin|console|builder)([-/]|$)/i.test(
        root
      ));

  if (!matchesRootName || isExampleStyleRoot(root) || isSupportWorkspaceRoot(root) || isVersionedWorkspaceRoot(root)) {
    return false;
  }

  if (!paths || !/^packages\//.test(root)) {
    return true;
  }

  const scoped = workspacePaths(paths, root);
  return scoped.some(
    (path) =>
      APP_PAGE_PATTERN.test(path) ||
      APP_LAYOUT_PATTERN.test(path) ||
      PAGES_ROUTE_PATTERN.test(path) ||
      COMPONENT_PATTERN.test(path) ||
      API_PATTERN.test(path) ||
      MIDDLEWARE_PATTERN.test(path)
  );
}

function shouldPreferMonorepoProjectType(paths: string[], pkg?: PackageJsonShape | null) {
  if (!isMonorepoProject(paths, pkg)) {
    return false;
  }

  const workspaceRoots = collectWorkspaceRoots(paths);
  const componentLibraryRoots = collectComponentLibraryWorkspaceRoots(paths);
  const focusRoot = pickMonorepoFocusRoot(paths, pkg);
  const routeRoots = collectRouteRoots(paths);
  const primaryAppRoots = workspaceRoots.filter((root) => isPrimaryAppWorkspaceRoot(root, paths));
  const sharedPackageRoots = workspaceRoots.filter(
    (root) =>
      /^(packages|services)\//.test(root) &&
      !isPrimaryAppWorkspaceRoot(root, paths) &&
      !isExampleStyleRoot(root) &&
      !isSupportWorkspaceRoot(root)
  );
  const nonExampleRouteRoots = routeRoots.filter(
    (root) => root && !isExampleStyleRoot(root) && !isSupportWorkspaceRoot(root)
  );
  const focusLooksPrimaryApp =
    Boolean(focusRoot) &&
    isPrimaryAppWorkspaceRoot(focusRoot ?? "", paths);

  if (
    componentLibraryRoots.length > 0 &&
    primaryAppRoots.length > 0 &&
    componentLibraryRoots.length >= Math.max(3, primaryAppRoots.length * 2)
  ) {
    return false;
  }

  return (
    (focusLooksPrimaryApp && sharedPackageRoots.length > 0) ||
    (primaryAppRoots.length > 0 && sharedPackageRoots.length > 0) ||
    (primaryAppRoots.length >= 2 && nonExampleRouteRoots.length >= 2)
  );
}

function scoreRepresentativeRoot(root: string, routeRoots: string[]) {
  const occurrences = routeRoots.filter((candidate) => candidate === root).length;
  const depth = root ? root.split("/").length : 0;

  let score = occurrences * 20 - depth * 4;

  if (root === "" || root === "src") score += 120;
  if (/(final|solution|complete|reference|official)/i.test(root)) score += 42;
  if (/(example|examples|demo|showcase)/i.test(root)) score += 12;
  if (/(starter|template|boilerplate|scaffold)/i.test(root)) score -= 18;
  if (/(basics|basic|intro|lesson|step)/i.test(root)) score -= 6;
  if (/(^|\/)(web|app|dashboard|site|admin)$/i.test(root)) score += 24;
  if (/(^|\/)(docs|storybook|playground)$/i.test(root)) score -= 18;
  if (/(^|\/)(showcase|preview|testing|ssr-testing)$/i.test(root)) score -= 18;
  if (/(^|\/)v\d+$/i.test(root)) score -= 20;

  return score;
}

function pickRepresentativeRoot(paths: string[]) {
  const routeRoots = collectRouteRoots(paths);

  if (routeRoots.length === 0) {
    return null;
  }

  return [...routeRoots].sort(
    (a, b) =>
      scoreRepresentativeRoot(b, routeRoots) - scoreRepresentativeRoot(a, routeRoots) ||
      a.localeCompare(b)
  )[0];
}

function scoreWorkspaceRoot(root: string, routeRoots: string[]) {
  const routeCoverage = routeRoots.filter(
    (candidate) => candidate === root || candidate.startsWith(`${root}/`)
  ).length;
  const depth = root.split("/").length;

  let score = routeCoverage * 24 - depth * 6;

  if (root.startsWith("apps/")) score += 56;
  if (root.startsWith("sites/")) score += 38;
  if (root.startsWith("services/")) score += 32;
  if (root.startsWith("packages/")) score -= 10;
  if (root.startsWith("docs/")) score -= 32;
  if (/(^|\/)(web|app|dashboard|admin|site)$/i.test(root)) score += 36;
  if (/(^|\/)(www|studio|console|portal)$/i.test(root)) score += 42;
  if (/(^|\/)(solution|complete|reference|official)$/i.test(root)) score += 44;
  if (/(^|\/)(api|backend)$/i.test(root)) score += 8;
  if (/(^|\/)(docs|storybook|playground|sandbox)$/i.test(root)) score -= 34;
  if (/(^|\/)(playgrounds|showcase|preview|testing|ssr-testing)$/i.test(root)) score -= 30;
  if (/(^|\/)(ui-library|design-system|patterns|components)$/i.test(root)) score -= 52;
  if (/(^|\/)(learn|academy|guides?)$/i.test(root)) score -= 26;
  if (/(^|\/)(demo|examples?|starter|template|boilerplate)$/i.test(root)) score -= 48;
  if (/(^|\/)(test|tests|bench|benchmark)$/i.test(root)) score -= 18;
  if (/(^|\/)v\d+$/i.test(root)) score -= 28;

  return score;
}

function pickMonorepoFocusRoot(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options?: { readmeText?: string | null; repoName?: string | null }
) {
  const workspaceRoots = collectWorkspaceRoots(paths);
  const routeRoots = collectRouteRoots(paths);

  if (workspaceRoots.length === 0) {
    return pickRepresentativeRoot(paths);
  }

  if (shouldPreferComponentLibraryFocus(paths, pkg, options)) {
    const componentLibraryRoots = collectComponentLibraryWorkspaceRoots(paths);
    const workspaceRoots = collectWorkspaceRoots(paths);

    return [...componentLibraryRoots].sort(
      (a, b) =>
        scoreLibraryWorkspaceRoot(b, paths, workspaceRoots, options, pkg) -
          scoreLibraryWorkspaceRoot(a, paths, workspaceRoots, options, pkg) ||
        a.localeCompare(b)
    )[0];
  }

  if (shouldPreferLibraryWorkspaceFocus(paths, pkg, options)) {
    const libraryWorkspaceRoots = collectLibraryWorkspaceRoots(paths);
    const workspaceRoots = collectWorkspaceRoots(paths);

    return [...libraryWorkspaceRoots].sort(
      (a, b) =>
        scoreLibraryWorkspaceRoot(b, paths, workspaceRoots, options, pkg) -
          scoreLibraryWorkspaceRoot(a, paths, workspaceRoots, options, pkg) ||
        a.localeCompare(b)
    )[0];
  }

  const preferredRoots = workspaceRoots.filter((root) => isPrimaryAppWorkspaceRoot(root, paths));
  const candidateRoots = preferredRoots.length > 0 ? preferredRoots : workspaceRoots;

  return [...candidateRoots].sort(
    (a, b) =>
      scoreWorkspaceRoot(b, routeRoots) - scoreWorkspaceRoot(a, routeRoots) ||
      a.localeCompare(b)
  )[0];
}

export function layersForPath(path: string): LayerName[] {
  const layers: LayerName[] = [];

  if (
    APP_PAGE_PATTERN.test(path) ||
    APP_SUPPORT_PATTERN.test(path) ||
    APP_LAYOUT_PATTERN.test(path) ||
    PAGES_ROUTE_PATTERN.test(path) ||
    COMPONENT_PATTERN.test(path) ||
    SPA_ENTRY_PATTERN.test(path)
  ) {
    layers.push("UI");
  }
  if (API_PATTERN.test(path) || MIDDLEWARE_PATTERN.test(path)) {
    layers.push("API");
  }
  if (isDbPath(path)) {
    layers.push("DB");
  }
  if (EXTERNAL_PATTERN.test(path)) {
    layers.push("External");
  }
  if (
    isLogicPath(path) ||
    TOOLING_SCRIPT_PATTERN.test(path) ||
    CLI_FILE_PATTERN.test(path) ||
    isLibraryEntryPath(path)
  ) {
    layers.push("Logic");
  }

  return unique(layers);
}

export function scoreLayerRepresentativePath(
  path: string,
  layerName: LayerName,
  focusRoot?: string | null
) {
  let score = 0;

  if (focusRoot !== undefined && focusRoot !== null) {
    if (focusRoot === "" && !path.includes("/")) {
      score += 24;
    } else if (focusRoot && path.startsWith(`${focusRoot}/`)) {
      score += 28;
    } else {
      score -= 8;
    }
  }

  if (!isGenericRepresentativeName(path)) {
    score += 8;
  }

  if (hasRepresentativeRoleHint(path)) {
    score += 12;
  }

  if (path.split("/").length <= 3) {
    score += 4;
  }

  switch (layerName) {
    case "UI":
      if (APP_PAGE_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)) score += 140;
      if (APP_SUPPORT_PATTERN.test(path)) score += 112;
      if (APP_LAYOUT_PATTERN.test(path)) score += 126;
      if (COMPONENT_PATTERN.test(path)) score += 104;
      if (SPA_ENTRY_PATTERN.test(path)) score += 104;
      if (/\.(tsx|jsx|mdx)$/i.test(path)) score += 18;
      break;
    case "API":
      if (API_PATTERN.test(path)) score += 140;
      if (MIDDLEWARE_PATTERN.test(path)) score += 124;
      if (/(handler|controller|endpoint)/i.test(normalizedRepresentativeName(path))) score += 18;
      break;
    case "DB":
      if (/schema\.prisma$/i.test(path) || /(^|\/)migrations?\//i.test(path)) score += 144;
      if (isDbPath(path)) score += 116;
      if (/(schema|model|client|migration|seed|drizzle|prisma)/i.test(normalizedRepresentativeName(path))) {
        score += 26;
      }
      break;
    case "External":
      if (EXTERNAL_PATTERN.test(path)) score += 132;
      score += externalRepresentativeTieBreaker(path);
      break;
    case "Logic":
      if (TOOLING_SCRIPT_PATTERN.test(path)) score += 132;
      if (CLI_FILE_PATTERN.test(path)) score += 120;
      if (/(^|\/)(hooks|services|store|actions|core|features)\//i.test(path)) score += 116;
      if (ROOT_SUPPORT_LOGIC_PATTERN.test(path)) score += 104;
      if (SUPPORT_LOGIC_PATTERN.test(path)) score += 96;
      if (isLogicPath(path)) score += 92;
      if (isLibraryEntryPath(path)) score += 48;
      score += logicRepresentativeTieBreaker(path);
      if (isGenericRepresentativeName(path)) score -= 42;
      if (isLibraryEntryPath(path) && isGenericRepresentativeName(path)) score -= 22;
      if (/^src\/[^/]+\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path)) score -= 12;
      break;
  }

  return score;
}

export function representativePathBucket(path: string, layerName: LayerName) {
  const normalizedName = normalizedRepresentativeName(path);

  switch (layerName) {
    case "UI":
      if (APP_PAGE_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path) || SPA_ENTRY_PATTERN.test(path)) {
        return "route";
      }
      if (APP_LAYOUT_PATTERN.test(path)) {
        return "layout";
      }
      if (APP_SUPPORT_PATTERN.test(path)) {
        return "support";
      }
      if (COMPONENT_PATTERN.test(path)) {
        return "component";
      }
      return "other";
    case "API":
      if (MIDDLEWARE_PATTERN.test(path)) return "middleware";
      if (
        /(^|\/)(controllers?|handlers?)\//i.test(path) ||
        /(handler|controller|endpoint)/i.test(normalizedName)
      ) {
        return "handler";
      }
      if (API_PATTERN.test(path)) return "route";
      return "other";
    case "DB":
      if (/schema\.prisma$/i.test(path) || /\bschema\b/i.test(normalizedName)) return "schema";
      if (/(^|\/)migrations?\//i.test(path) || /\bmigration\b/i.test(normalizedName)) return "migration";
      if (/\b(seed|seeder)\b/i.test(normalizedName)) return "seed";
      if (/\b(client|db|database|query|model)\b/i.test(normalizedName)) return "client";
      return "other";
    case "External":
      if (/\b(auth|oauth|session|token)\b/i.test(normalizedName)) return "auth";
      if (/\b(storage|upload|bucket|blob|s3|r2)\b/i.test(normalizedName)) return "storage";
      if (/\b(webhook|events?)\b/i.test(normalizedName)) return "webhook";
      if (EXTERNAL_PATTERN.test(path)) return "provider";
      return "other";
    case "Logic":
      if (/(^|\/)hooks?\//i.test(path) || /\buse[A-Z]/.test(path)) return "hook";
      if (/(^|\/)services?\//i.test(path) || /\b(service|repository|repo)\b/i.test(normalizedName)) {
        return "service";
      }
      if (/(^|\/)(stores?|state)\//i.test(path) || /\b(store|state)\b/i.test(normalizedName)) {
        return "state";
      }
      if (/(^|\/)(actions?|commands?)\//i.test(path) || /\b(action|command)\b/i.test(normalizedName)) {
        return "action";
      }
      if (/(^|\/)(features?|domains?)\//i.test(path) || /\b(feature|domain)\b/i.test(normalizedName)) {
        return "feature";
      }
      if (/(^|\/)(core|internals?)\//i.test(path) || /\b(core|engine)\b/i.test(normalizedName)) {
        return "core";
      }
      return "other";
  }
}

export function pickLayerRepresentativePaths(
  paths: string[],
  layerName: LayerName,
  focusRoot?: string | null,
  limit = 3,
  excludedBuckets: string[] = []
) {
  const ranked = rankLayerRepresentativePaths(paths, layerName, focusRoot);
  const selected: string[] = [];
  const bestByBucket = new Map<string, string>();
  const bucketOrder = REPRESENTATIVE_BUCKET_ORDER[layerName];
  const excludedBucketSet = new Set(excludedBuckets);

  for (const path of ranked) {
    const bucket = representativePathBucket(path, layerName);
    if (!bestByBucket.has(bucket)) {
      bestByBucket.set(bucket, path);
    }
  }

  for (const bucket of bucketOrder) {
    if (excludedBucketSet.has(bucket)) continue;
    const path = bestByBucket.get(bucket);
    if (!path) continue;
    selected.push(path);
    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const path of ranked) {
    if (selected.includes(path)) continue;
    selected.push(path);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function rankLayerRepresentativePaths(
  paths: string[],
  layerName: LayerName,
  focusRoot?: string | null
) {
  return [...unique(paths)].sort(
    (left, right) =>
      scoreLayerRepresentativePath(right, layerName, focusRoot) -
        scoreLayerRepresentativePath(left, layerName, focusRoot) ||
      (layerName === "Logic"
        ? logicRepresentativeTieBreaker(right) - logicRepresentativeTieBreaker(left)
        : 0) ||
      left.length - right.length ||
      left.localeCompare(right)
  );
}

export function representativeLayerConfidence(
  paths: string[],
  layerName: LayerName,
  focusRoot?: string | null
): "high" | "medium" | "low" {
  const scores = paths.map((path) => scoreLayerRepresentativePath(path, layerName, focusRoot));
  const strongCount = scores.filter((score) => score >= 120).length;
  const mediumCount = scores.filter((score) => score >= 84).length;
  const nonGenericCount = paths.filter((path) => !isGenericRepresentativeName(path)).length;

  if (layerName === "Logic") {
    if (strongCount >= 1) return "high";
    if ((mediumCount >= 1 && nonGenericCount >= 1) || paths.length >= 4) return "medium";
    return "low";
  }

  if (strongCount >= 1) return "high";
  if (mediumCount >= 1) return "medium";
  return "low";
}

function scopedPaths(paths: string[], root: string | null) {
  if (root === null) {
    return [];
  }

  if (root === "") {
    return paths.filter((path) => {
      const workspaceCandidate = path.split("/").slice(0, 2).join("/");
      return !isWorkspaceStyleRoot(workspaceCandidate);
    });
  }

  return paths.filter((path) => path.startsWith(`${root}/`) || extractRouteRoot(path) === root);
}

function shouldExcludeFocusedLibrarySupportPath(path: string, options: BuildLayersOptions) {
  if (
    !options.focusRoot ||
    !options.scopeToFocusRoot ||
    (options.projectType !== "라이브러리 또는 SDK" &&
      options.projectType !== "컴포넌트 라이브러리 또는 디자인 시스템")
  ) {
    return false;
  }

  if (!path.startsWith(`${options.focusRoot}/`)) {
    return false;
  }

  const relative = path.slice(options.focusRoot.length + 1);
  return /^(demo|demos|example|examples|playground|playgrounds|sandbox|website|docs)\//i.test(relative);
}

export function buildTopology(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options?: { readmeText?: string | null; repoName?: string | null }
): RepoTopology {
  const workspaceRoots = collectWorkspaceRoots(paths);
  const workspaceGroups = collectWorkspaceGroups(workspaceRoots);
  const kind = isMonorepoProject(paths, pkg) ? "monorepo" : "single";
  const preferredRoot =
    kind === "monorepo" ? pickMonorepoFocusRoot(paths, pkg, options) : pickRepresentativeRoot(paths);
  const toolingFocusRoot =
    kind === "single" && preferredRoot === null ? pickToolingFocusRoot(paths) : null;
  const focusRoot =
    preferredRoot && preferredRoot !== "src"
      ? preferredRoot
      : toolingFocusRoot ?? workspaceRoots[0] ?? (preferredRoot === "src" ? "src" : null);
  const manifestFiles = shortList(
    unique(
      [
        ...paths.filter((path) => path === "package.json" || MONOREPO_MANIFEST_PATTERN.test(path)),
        ...collectNestedPackageRoots(paths)
          .filter((root) => isWorkspaceStyleRoot(root))
          .map((root) => `${root}/package.json`),
      ]
    ),
    kind === "monorepo" ? 8 : 3
  );

  return {
    kind,
    workspaceRoots,
    workspaceGroups,
    focusRoot,
    manifestFiles,
  };
}

export function parsePackageJson(text: string | null) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch {
    return null;
  }
}

export function filterAnalyzablePaths(paths: string[]) {
  return unique(
    paths.filter((path) => {
      if (
        ANALYSIS_EXCLUDE_SEGMENTS.test(path) ||
        ANALYSIS_EXCLUDE_FILES.test(path) ||
        ANALYSIS_EXCLUDE_CODE_FILES.test(path)
      ) {
        return false;
      }

      return ANALYSIS_INCLUDE_FILE.test(path) || ANALYSIS_INCLUDE_EXTENSIONS.test(path);
    })
  );
}

export function detectStack(paths: string[], pkg?: PackageJsonShape | null) {
  const signals = collectSignals(paths, pkg);
  const stack: string[] = [];
  const hasTsFiles = paths.some((path) => /\.(ts|tsx|mts|cts)$/.test(path));
  const hasJsFiles = paths.some((path) => /\.(js|jsx|mjs|cjs)$/.test(path));
  const hasVueFiles = paths.some((path) => /\.vue$/i.test(path));
  const hasPythonFiles = paths.some((path) => /\.py$/i.test(path));
  const hasNextMarkers =
    hasDependency(pkg, "next") ||
    paths.some((path) => /(^|\/)next\.config\.(ts|js|mjs)$/.test(path)) ||
    signals.routeFiles.some((path) => path.includes("/app/") || path.startsWith("app/") || path.includes("/pages/") || path.startsWith("pages/"));
  const hasReactMarkers =
    hasDependency(pkg, "react") ||
    signals.componentFiles.length > 0 ||
    signals.routeFiles.some((path) => /\.(tsx|jsx)$/.test(path));
  const hasVueMarkers = hasDependency(pkg, "vue") || hasVueFiles;

  if (hasNextMarkers) stack.push("Next.js");
  if (hasReactMarkers) stack.push("React");
  if (hasVueMarkers) stack.push("Vue");
  if (hasTsFiles || hasDependency(pkg, "typescript")) stack.push("TypeScript");
  if (!hasTsFiles && hasJsFiles) stack.push("JavaScript");
  if (hasPythonFiles) stack.push("Python");
  if (hasDependency(pkg, "tailwindcss") || paths.some((path) => /tailwind\.config\.(ts|js|mjs)$/.test(path))) {
    stack.push("Tailwind CSS");
  }
  if (hasDependency(pkg, "@supabase/supabase-js") || signals.dbFiles.some((path) => /supabase/i.test(path))) {
    stack.push("Supabase");
  }
  if (
    hasDependency(pkg, "firebase") ||
    hasDependency(pkg, "firebase-admin") ||
    signals.dbFiles.some((path) => /firebase/i.test(path))
  ) {
    stack.push("Firebase");
  }
  if (hasDependency(pkg, "prisma") || signals.dbFiles.some((path) => /prisma/i.test(path))) {
    stack.push("Prisma");
  }
  if (
    hasAnyDependency(pkg, NODE_SERVER_DEPS) ||
    signals.apiFiles.length > 0 ||
    signals.cliFiles.length > 0 ||
    (pkg && !hasNextMarkers && !hasReactMarkers)
  ) {
    stack.push("Node.js");
  }

  if (stack.length === 0) {
    stack.push("JavaScript / TypeScript");
  }

  return unique(stack);
}

export function summarizeLayerCoverage(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options: BuildLayersOptions = {}
): LayerCoverageSummary {
  const scopedLayerPaths =
    options.scopeToFocusRoot && options.focusRoot
      ? scopedPaths(paths, options.focusRoot)
      : [];
  const baseLayerPaths = scopedLayerPaths.length > 0 ? scopedLayerPaths : paths;
  const layerPaths = baseLayerPaths.filter((path) => !shouldExcludeFocusedLibrarySupportPath(path, options));
  const signals = collectSignals(layerPaths, pkg);
  const uiBucket = unique([
    ...signals.routeFiles,
    ...signals.layoutFiles,
    ...signals.componentFiles,
  ]);
  const apiBucket = unique(
    [...signals.apiFiles, ...signals.middlewareFiles].filter(
      (path) => !uiBucket.includes(path)
    )
  );
  const dbBucket = unique(
    signals.dbFiles.filter(
      (path) => !uiBucket.includes(path) && !apiBucket.includes(path)
    )
  );
  const externalBucket = unique(
    signals.externalFiles.filter(
      (path) =>
        !uiBucket.includes(path) &&
        !apiBucket.includes(path) &&
        !dbBucket.includes(path)
    )
  );
  const logicBucket = unique(
    [...signals.logicFiles, ...signals.cliFiles, ...signals.libraryEntryFiles].filter(
      (path) =>
        !uiBucket.includes(path) &&
        !apiBucket.includes(path) &&
        !dbBucket.includes(path) &&
        !externalBucket.includes(path)
    )
  );
  const rawBuckets: Record<LayerName, string[]> = {
    UI: uiBucket,
    Logic: logicBucket,
    API: apiBucket,
    DB: dbBucket,
    External: externalBucket,
  };
  const bucketConfidence = LAYER_ORDER.reduce(
    (result, layer) => {
      result[layer] = representativeLayerConfidence(rawBuckets[layer], layer, options.focusRoot);
      return result;
    },
    {} as Record<LayerName, "high" | "medium" | "low">
  );
  const buckets = LAYER_ORDER.reduce(
    (result, layer) => {
      result[layer] = bucketConfidence[layer] === "low" ? [] : rawBuckets[layer];
      return result;
    },
    {} as Record<LayerName, string[]>
  );
  const classifiedPaths = unique(Object.values(buckets).flat());
  const codeLikePaths = unique(layerPaths.filter((path) => isCodeLikePath(path)));
  const uncoveredPaths = codeLikePaths.filter((path) => !classifiedPaths.includes(path));
  const uncoveredReasons = summarizeUncoveredReasons(uncoveredPaths);

  return {
    buckets,
    bucketConfidence,
    scopedPaths: layerPaths,
    codeLikePaths,
    classifiedPaths,
    uncoveredPaths,
    uncoveredReasons,
  };
}

export function buildLayers(
  paths: string[],
  pkg?: PackageJsonShape | null,
  options: BuildLayersOptions = {}
): RepoLayer[] {
  const coverage = summarizeLayerCoverage(paths, pkg, options);
  const scopedLayerPaths = coverage.scopedPaths.length < paths.length ? coverage.scopedPaths : [];

  return LAYER_ORDER.filter((layer) => coverage.buckets[layer].length > 0).map((layer) => {
    const representativePaths = pickLayerRepresentativePaths(
      coverage.buckets[layer],
      layer,
      options.focusRoot,
      6
    );

    return {
      name: layer,
      description: LAYER_DESCRIPTIONS[layer],
      fileCount: coverage.buckets[layer].length,
      files: representativePaths,
      evidence: [
        ...(scopedLayerPaths.length > 0 && options.focusRoot
          ? [`대표 범위: ${options.focusRoot}`]
          : []),
        `감지 파일 수: ${coverage.buckets[layer].length}`,
        `대표 경로: ${representativePaths.slice(0, 3).join(", ")}`,
      ],
    };
  });
}

export function detectProjectType(args: {
  paths: string[];
  pkg?: PackageJsonShape | null;
  layers: RepoLayer[];
  stack: string[];
  repositoryDescription?: string | null;
  readmeText?: string | null;
}) {
  const signals = collectSignals(args.paths, args.pkg);
  const layerSet = new Set(args.layers.map((layer) => layer.name));
  const text = textSignal(
    args.pkg?.description,
    args.repositoryDescription,
    args.readmeText,
    args.pkg?.keywords?.join(" ")
  );
  const hasCliSignal =
    signals.cliFiles.length > 0 ||
    hasAnyDependency(args.pkg, CLI_DEPS) ||
    CLI_TEXT_PATTERN.test(text);
  const hasLibrarySignal =
    signals.libraryEntryFiles.length > 0 ||
    Boolean(args.pkg?.main || args.pkg?.module || args.pkg?.exports || args.pkg?.types) ||
    text.includes("sdk") ||
    text.includes("library") ||
    text.includes("package");
  const hasUi = layerSet.has("UI") && (signals.routeFiles.length > 0 || signals.componentFiles.length > 0);
  const hasApi = layerSet.has("API") && signals.apiFiles.length + signals.middlewareFiles.length > 0;
  const hasDb = layerSet.has("DB");
  const hasExternal = layerSet.has("External");
  const isMonorepo = isMonorepoProject(args.paths, args.pkg);
  const preferMonorepoProjectType = shouldPreferMonorepoProjectType(args.paths, args.pkg);
  const preferComponentLibraryProjectType = shouldPreferComponentLibraryProjectType({
    paths: args.paths,
    pkg: args.pkg,
    stack: args.stack,
    repositoryDescription: args.repositoryDescription,
    readmeText: args.readmeText,
  });
  const preferLibraryProjectType = shouldPreferLibraryProjectType({
    paths: args.paths,
    pkg: args.pkg,
    repositoryDescription: args.repositoryDescription,
    readmeText: args.readmeText,
  });
  const preferLibraryOverCliProjectType = shouldPreferLibraryOverCliProjectType({
    paths: args.paths,
    pkg: args.pkg,
    repositoryDescription: args.repositoryDescription,
    readmeText: args.readmeText,
  });

  if (
    isExampleCollection({
      paths: args.paths,
      pkg: args.pkg,
      repositoryDescription: args.repositoryDescription,
      readmeText: args.readmeText,
    }) &&
    !preferMonorepoProjectType &&
    !((preferComponentLibraryProjectType || preferLibraryProjectType) && hasLibrarySignal)
  ) {
    return "학습용 예제 저장소";
  }

  if (preferComponentLibraryProjectType && hasLibrarySignal) {
    return "컴포넌트 라이브러리 또는 디자인 시스템";
  }

  if (preferMonorepoProjectType) {
    return "모노레포 웹 플랫폼";
  }

  if (preferLibraryOverCliProjectType) {
    return "라이브러리 또는 SDK";
  }

  if (hasLibrarySignal && supportOnlyUiSurface(signals) && !hasApi && !hasDb) {
    return "라이브러리 또는 SDK";
  }

  if (preferLibraryProjectType && hasLibrarySignal) {
    return "라이브러리 또는 SDK";
  }

  if (hasCliSignal && !hasUi && !preferLibraryOverCliProjectType) {
    return "CLI 도구";
  }

  if (isMonorepo && hasUi && (hasApi || hasDb || hasExternal)) {
    return "모노레포 웹 플랫폼";
  }

  if (isMonorepo) {
    return "모노레포 저장소";
  }

  if (hasUi && (hasApi || hasDb)) {
    return "풀스택 웹앱";
  }

  if (hasUi) {
    return "프론트엔드 웹앱";
  }

  if (hasApi && hasDb) {
    return "백엔드 API 서비스";
  }

  if (hasApi) {
    return "API 서버";
  }

  if (hasLibrarySignal && !hasUi) {
    return "라이브러리 또는 SDK";
  }

  if (args.stack.includes("Node.js")) {
    return "Node.js 프로젝트";
  }

  return "라이브러리 또는 개발 도구";
}

export function estimateDifficulty(
  fileCount: number,
  stackCount: number,
  layers: RepoLayer[],
  truncated: boolean
): Difficulty {
  let score = 0;

  if (fileCount > 40) score += 1;
  if (fileCount > 140) score += 1;
  if (stackCount > 3) score += 1;
  if (layers.some((layer) => layer.name === "API")) score += 1;
  if (layers.some((layer) => layer.name === "DB")) score += 1;
  if (layers.some((layer) => layer.name === "External")) score += 1;
  if (truncated) score += 1;

  if (score >= 5) return "hard";
  if (score >= 3) return "medium";
  return "easy";
}

export function buildKeyFeatures(
  paths: string[],
  stack: string[],
  layers: RepoLayer[],
  pkg?: PackageJsonShape | null,
  projectType?: string,
  options?: {
    signalPaths?: string[];
  }
) {
  const signals = collectSignals(options?.signalPaths ?? paths, pkg);
  const featureRouteFiles = signals.routeFiles.filter((path) => {
    if (/(^|\/)(__tests__|tests?|fixtures?|storybook|stories|playgrounds?|sandbox|benchmarks?)(\/|$)/i.test(path)) {
      return false;
    }
    if (/\.(test|spec|stories)\.(ts|tsx|js|jsx|mdx)$/i.test(path)) {
      return false;
    }
    if (isLibraryLikeProjectType(projectType) && /(^|\/)src\/(pages|app)(\/|$)/i.test(path)) {
      return false;
    }
    return true;
  });
  const featureComponentFiles = signals.componentFiles.filter((path) => {
    if (/(^|\/)(__tests__|tests?|fixtures?|storybook|stories|playgrounds?|sandbox|benchmarks?)(\/|$)/i.test(path)) {
      return false;
    }
    if (/\.(test|spec|stories)\.(ts|tsx|js|jsx|mdx)$/i.test(path)) {
      return false;
    }
    return true;
  });
  const features: string[] = [];
  const layerSet = new Set(layers.map((layer) => layer.name));
  const workspaceRoots = collectWorkspaceRoots(paths);

  if (projectType === "학습용 예제 저장소") {
    features.push("여러 예제 앱 포함");
  }
  if (projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
    features.push("컴포넌트 패키지 중심 구조");
    if (collectSupportWorkspaceRoots(paths).length > 0) {
      features.push("문서/쇼케이스 앱 동반");
    }
  }
  if (projectType === "라이브러리 또는 개발 도구") {
    const toolingRoots = collectToolingRoots(paths);

    if (toolingRoots.length >= 2) {
      features.push(`pack root ${toolingRoots.length}개 감지`);
    }
    if (paths.some((path) => OPERATION_DOC_PATTERN.test(path))) {
      features.push("운영 문서 중심 구조");
    }
    if (paths.some((path) => TOOLING_SCRIPT_PATTERN.test(path))) {
      features.push("자동화/검증 스크립트 포함");
    }
    if (paths.some((path) => TEMPLATE_FILE_PATTERN.test(path))) {
      features.push("재사용 템플릿 포함");
    }
  }
  if (projectType === "모노레포 웹 플랫폼" || projectType === "모노레포 저장소") {
    features.push(`워크스페이스 ${workspaceRoots.length}개 감지`);
    features.push("공용 패키지 + 앱 분리 구조");
  }
  if (featureRouteFiles.length > 0) features.push("페이지 기반 진입 구조");
  if (featureComponentFiles.length > 0) features.push("재사용 컴포넌트 구조");
  if (signals.apiFiles.length > 0) features.push("서버 요청 처리");
  if (layerSet.has("DB")) features.push("데이터 저장/조회");
  if (layerSet.has("External") || hasAnyDependency(pkg, EXTERNAL_DEPS)) {
    features.push("외부 서비스 연동");
  }
  if (signals.cliFiles.length > 0) features.push("명령줄 실행 흐름");
  if (signals.libraryEntryFiles.length > 0) features.push("라이브러리 진입점");
  if (stack.includes("Tailwind CSS")) features.push("유틸리티 기반 스타일링");

  if (features.length === 0) {
    const hasReadme = paths.some((path) => README_PATTERN.test(path));
    const hasManifest = paths.some((path) =>
      /(^|\/)(package\.json|pnpm-workspace\.yaml|turbo\.json|lerna\.json|pyproject\.toml|go\.mod|cargo\.toml)$/i.test(
        path
      )
    );

    if (hasReadme) {
      features.push("README 중심 시작 구조");
    } else if (hasManifest) {
      features.push("설정 파일 중심 시작 구조");
    }
  }

  return unique(features).slice(0, 5);
}

function describeKeyFile(
  path: string
): Pick<KeyFileInfo, "role" | "whyImportant" | "evidence" | "relatedLayers"> {
  if (APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)) {
    return {
      role: "주요 화면 또는 라우트 진입점",
      whyImportant: "사용자 흐름이 시작되거나 전환되는 지점이라 전체 구조를 이해하는 출발점으로 적합합니다.",
      evidence: ["route/page 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["UI"],
    };
  }

  if (APP_LAYOUT_PATTERN.test(path)) {
    return {
      role: "전역 레이아웃",
      whyImportant: "공통 레이아웃과 전역 UI 뼈대를 함께 파악할 수 있습니다.",
      evidence: ["layout 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["UI"],
    };
  }

  if (API_PATTERN.test(path) || MIDDLEWARE_PATTERN.test(path)) {
    return {
      role: "서버 진입점",
      whyImportant: "요청이 서버에서 어디로 들어와 처리되는지 이해하는 데 가장 직접적인 파일입니다.",
      evidence: ["API 또는 middleware 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["API"],
    };
  }

  if (isDbPath(path)) {
    return {
      role: "데이터 계층 핵심 파일",
      whyImportant: "DB 연결, 스키마, ORM 지점을 보여주기 때문에 데이터 구조를 빠르게 파악할 수 있습니다.",
      evidence: ["DB 관련 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["DB"],
    };
  }

  if (EXTERNAL_PATTERN.test(path)) {
    return {
      role: "외부 서비스 연동 파일",
      whyImportant: "외부 API나 SDK와 연결되는 지점이라 실제 데이터가 어디서 들어오는지 추적할 때 중요합니다.",
      evidence: ["external/integration 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["External"],
    };
  }

  if (COMPONENT_PATTERN.test(path)) {
    return {
      role: "재사용 UI 컴포넌트",
      whyImportant: "여러 화면에서 반복되는 UI가 모이는 위치라 화면 변경 범위를 파악하기 쉽습니다.",
      evidence: ["component/ui 경로 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["UI"],
    };
  }

  if (isLogicPath(path)) {
    return {
      role: "핵심 로직 파일",
      whyImportant: "화면이나 API 뒤에서 실제 동작을 처리하는 공통 로직이 모일 가능성이 높습니다.",
      evidence: ["lib/utils/services 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["Logic"],
    };
  }

  if (path === "package.json") {
    return {
      role: "프로젝트 설정 중심 파일",
      whyImportant: "사용 중인 프레임워크, 라이브러리, 실행 명령을 가장 빠르게 확인할 수 있습니다.",
      evidence: ["루트 설정 파일", "의존성과 스크립트 정보 포함"],
      relatedLayers: [],
    };
  }

  if (path.endsWith("/package.json")) {
    return {
      role: "워크스페이스 설정 파일",
      whyImportant: "특정 앱이나 패키지가 어떤 의존성과 실행 명령을 쓰는지 빠르게 확인할 수 있습니다.",
      evidence: ["workspace package manifest", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  if (MONOREPO_MANIFEST_PATTERN.test(path)) {
    return {
      role: "모노레포 운영 설정 파일",
      whyImportant: "워크스페이스 분리 방식과 빌드 범위를 설명하기 때문에 여러 앱이 섞인 저장소를 이해할 때 먼저 확인할 가치가 큽니다.",
      evidence: ["workspace / task runner 설정 파일", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  if (OPERATION_DOC_PATTERN.test(path)) {
    return {
      role: "운영 규칙 문서",
      whyImportant: "이 저장소를 어떻게 읽고, 수정하고, 운영해야 하는지 규칙과 작업 흐름을 직접 설명하는 문서입니다.",
      evidence: ["운영 문서 패턴과 일치", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  if (TOOLING_SCRIPT_PATTERN.test(path)) {
    return {
      role: "자동화/검증 스크립트",
      whyImportant: "반복 작업, 검증, 초기화 흐름이 실제로 어떻게 자동화되는지 확인할 수 있는 파일입니다.",
      evidence: ["tooling script 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["Logic"],
    };
  }

  if (TEMPLATE_FILE_PATTERN.test(path)) {
    return {
      role: "재사용 템플릿 파일",
      whyImportant: "새 프로젝트를 만들 때 복사하거나 주입하는 기본 문서와 설정 형태를 직접 보여줍니다.",
      evidence: ["template 경로 패턴과 일치", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  if (README_PATTERN.test(path)) {
    return {
      role: "프로젝트 개요 문서",
      whyImportant: "프로젝트 목적과 사용 방법을 작성자가 어떻게 설명했는지 확인할 수 있습니다.",
      evidence: ["README 문서", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  if (CLI_FILE_PATTERN.test(path)) {
    return {
      role: "CLI 실행 진입점",
      whyImportant: "명령줄 기반 프로젝트라면 실제 실행이 시작되는 위치를 빠르게 볼 수 있습니다.",
      evidence: ["CLI 경로 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["Logic"],
    };
  }

  if (isLibraryEntryPath(path)) {
    return {
      role: "라이브러리 공개 진입점",
      whyImportant: "외부에서 이 패키지를 사용할 때 가장 먼저 연결되는 엔트리일 가능성이 높습니다.",
      evidence: ["index/main 엔트리 패턴과 일치", `경로: ${path}`],
      relatedLayers: ["Logic"],
    };
  }

  if (CONFIG_PATTERN.test(path)) {
    return {
      role: "전역 설정 파일",
      whyImportant: "빌드, 라우팅, 스타일링, 타입 설정처럼 프로젝트 공통 규칙을 빠르게 확인할 수 있습니다.",
      evidence: ["config 패턴과 일치", `경로: ${path}`],
      relatedLayers: [],
    };
  }

  return {
    role: "핵심 구조 파일",
    whyImportant: "프로젝트의 중심 경로에 위치해 있어 전체 구조를 읽는 기준점으로 적합합니다.",
    evidence: ["우선순위 규칙에 따라 선정", `경로: ${path}`],
    relatedLayers: layersForPath(path),
  };
}

function scoreKeyFile(
  path: string,
  preferredRoot: string | null,
  projectType?: string
) {
  let score = 0;

  if (path === "package.json") score += 120;
  if (README_PATTERN.test(path)) score += 114;
  if (OPERATION_DOC_PATTERN.test(path)) score += 104;
  if (APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)) score += 108;
  if (APP_LAYOUT_PATTERN.test(path)) score += 104;
  if (API_PATTERN.test(path)) score += 100;
  if (MIDDLEWARE_PATTERN.test(path)) score += 96;
  if (isDbPath(path)) score += 92;
  if (TOOLING_SCRIPT_PATTERN.test(path)) score += 90;
  if (isLibraryEntryPath(path)) score += 88;
  if (TEMPLATE_FILE_PATTERN.test(path)) score += 82;
  if (CLI_FILE_PATTERN.test(path)) score += 84;
  if (CONFIG_PATTERN.test(path)) score += 74;
  if (COMPONENT_PATTERN.test(path)) score += 64;
  if (isLogicPath(path)) score += 56;
  if (path.split("/").length <= 2) score += 10;
  if (/\.(ts|tsx|js|jsx|md|mdx|prisma|json)$/.test(path)) score += 4;
  if (!isGenericRepresentativeName(path)) score += 6;
  if (hasRepresentativeRoleHint(path)) score += 10;
  if (isGenericRepresentativeName(path)) score -= 28;

  if (preferredRoot !== null) {
    if (preferredRoot === "" && !path.includes("/")) {
      score += 30;
    } else if (preferredRoot && path.startsWith(`${preferredRoot}/`)) {
      score += 34;
    }
  }

  if (projectType === "풀스택 웹앱" || projectType === "프론트엔드 웹앱") {
    if (APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)) score += 50;
    if (APP_LAYOUT_PATTERN.test(path)) score += 18;
    if (API_PATTERN.test(path)) score += 8;
    if (path === "package.json") score -= 24;
    if (README_PATTERN.test(path)) score -= 30;
  }

  if (projectType === "CLI 도구") {
    if (path === "package.json") score += 14;
    if (CLI_FILE_PATTERN.test(path)) score += 18;
    if (README_PATTERN.test(path)) score -= 12;
  }

  if (isLibraryLikeProjectType(projectType)) {
    if (isLibraryEntryPath(path)) score += 18;
    if (path === "package.json") score -= 8;
    if (isLibraryEntryPath(path) && isGenericRepresentativeName(path)) score -= 18;
  }

  if (projectType === "라이브러리 또는 개발 도구") {
    if (path === "README.md") score += 18;
    if (README_PATTERN.test(path) && path !== "README.md") score -= 96;
    if (OPERATION_DOC_PATTERN.test(path)) score += 16;
    if (TOOLING_SCRIPT_PATTERN.test(path)) score += 18;
    if (TEMPLATE_FILE_PATTERN.test(path)) score += 14;
  }

  if (projectType === "모노레포 웹 플랫폼" || projectType === "모노레포 저장소") {
    if (MONOREPO_MANIFEST_PATTERN.test(path)) score += 20;
    if (path.endsWith("/package.json") && path !== "package.json") score += 16;
    if (path.startsWith("packages/")) score += 10;
    if (path.startsWith("apps/")) score += 14;
  }

  if (path === "tsconfig.json") {
    score -= 12;
  }

  return score;
}

function buildExampleRepoKeyFiles(paths: string[], preferredRoot: string | null) {
  const scoped = preferredRoot !== null ? scopedPaths(paths, preferredRoot) : [];
  const scopedManifest =
    preferredRoot !== null
      ? shortList(paths.filter((path) => path === `${preferredRoot}/package.json`), 1)
      : [];
  const scopedConfig = shortList(scoped.filter((path) => CONFIG_PATTERN.test(path)), 2);
  const rootConfig = shortList(
    paths.filter(
      (path) =>
        path === "package.json" ||
        (!path.includes("/") && CONFIG_PATTERN.test(path))
    ),
    2
  );
  const curated = unique([
    ...paths.filter((path) => /^README\.(md|mdx)$/i.test(path)),
    ...rootConfig,
    ...scopedManifest,
    ...shortList(
      scoped.filter((path) => APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)),
      2
    ),
    ...shortList(scoped.filter((path) => APP_LAYOUT_PATTERN.test(path)), 1),
    ...shortList(scoped.filter((path) => API_PATTERN.test(path)), 1),
    ...shortList(scoped.filter((path) => COMPONENT_PATTERN.test(path)), 1),
    ...scopedConfig,
  ]).slice(0, 8);

  return curated;
}

function buildWebAppKeyFiles(paths: string[], preferredRoot: string | null) {
  const scoped = preferredRoot !== null ? scopedPaths(paths, preferredRoot) : [];
  const scopedRoutes = shortList(
    scoped.filter((path) => APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)),
    2
  );
  const scopedLayouts = shortList(scoped.filter((path) => APP_LAYOUT_PATTERN.test(path)), 1);
  const scopedComponents = shortList(scoped.filter((path) => COMPONENT_PATTERN.test(path)), 1);
  const scopedApi = shortList(scoped.filter((path) => API_PATTERN.test(path)), 1);
  const scopedDb = shortList(scoped.filter((path) => isDbPath(path)), 1);
  const scopedLogic = shortList(scoped.filter((path) => isLogicPath(path)), 1);
  const rootConfig = shortList(paths.filter((path) => path === "package.json" || CONFIG_PATTERN.test(path)), 2);

  return unique([
    ...scopedRoutes,
    ...scopedLayouts,
    ...scopedComponents,
    ...scopedApi,
    ...scopedDb,
    ...scopedLogic,
    ...rootConfig,
    ...paths.filter((path) => README_PATTERN.test(path)),
  ]).slice(0, 8);
}

function buildApiRepoKeyFiles(paths: string[], preferredRoot: string | null) {
  const scoped = preferredRoot !== null ? scopedPaths(paths, preferredRoot) : [];
  const scopedApi = shortList(scoped.filter((path) => API_PATTERN.test(path)), 2);
  const scopedLogic = shortList(scoped.filter((path) => isLogicPath(path)), 2);
  const scopedDb = shortList(scoped.filter((path) => isDbPath(path)), 1);
  const scopedExternal = shortList(scoped.filter((path) => EXTERNAL_PATTERN.test(path)), 1);

  return unique([
    ...scopedApi,
    ...scopedLogic,
    ...scopedDb,
    ...scopedExternal,
    ...paths.filter((path) => path === "package.json"),
    ...paths.filter((path) => README_PATTERN.test(path)),
  ]).slice(0, 8);
}

function buildCliRepoKeyFiles(paths: string[]) {
  return unique([
    ...paths.filter((path) => path === "package.json"),
    ...shortList(paths.filter((path) => CLI_FILE_PATTERN.test(path)), 2),
    ...shortList(paths.filter((path) => isLogicPath(path)), 2),
    ...shortList(paths.filter((path) => EXTERNAL_PATTERN.test(path)), 1),
    ...paths.filter((path) => README_PATTERN.test(path)),
  ]).slice(0, 8);
}

function collectToolingRoots(paths: string[]) {
  return unique(
    paths
      .filter((path) => path.includes("/"))
      .map((path) => rootSegment(path))
      .filter((root) => root && !root.startsWith("."))
      .filter((root) => {
        const scoped = paths.filter((path) => path.startsWith(`${root}/`));

        return scoped.some(
          (path) =>
            path === `${root}/README.md` ||
            OPERATION_DOC_PATTERN.test(path) ||
            TOOLING_SCRIPT_PATTERN.test(path) ||
            TEMPLATE_FILE_PATTERN.test(path)
        );
      })
  );
}

function toolingRootOperationDocs(root: string, paths: string[]) {
  return paths.filter(
    (path) => dirname(path) === root && OPERATION_DOC_PATTERN.test(path)
  );
}

function toolingRootScripts(root: string, paths: string[]) {
  return paths.filter(
    (path) =>
      path.startsWith(`${root}/scripts/harness/`) ||
      path.startsWith(`${root}/.codex/hooks/`) ||
      path.startsWith(`${root}/.claude/hooks/`)
  );
}

function toolingRootTemplates(root: string, paths: string[]) {
  return paths.filter((path) => path.startsWith(`${root}/templates/`));
}

function toolingRootRuntimeFiles(root: string, paths: string[]) {
  return paths.filter(
    (path) =>
      path === `${root}/.codex/runtime.json` ||
      path.startsWith(`${root}/.codex/manifests/`) ||
      path.startsWith(`${root}/.claude/manifests/`) ||
      path.startsWith(`${root}/.claude/agents/`)
  );
}

function scoreToolingRoot(root: string, paths: string[]) {
  const scoped = paths.filter((path) => path.startsWith(`${root}/`));
  const operationDocs = toolingRootOperationDocs(root, paths);
  const scripts = toolingRootScripts(root, paths);
  const templates = toolingRootTemplates(root, paths);
  const runtimeFiles = toolingRootRuntimeFiles(root, paths);
  let score = Math.min(scoped.length, 24);

  if (scoped.some((path) => path === `${root}/README.md`)) score += 28;
  if (operationDocs.length > 0) score += Math.min(operationDocs.length, 6) * 5;
  if (scripts.length > 0) score += Math.min(scripts.length, 6) * 4;
  if (templates.length > 0) score += Math.min(templates.length, 6) * 4;
  if (runtimeFiles.length > 0) score += Math.min(runtimeFiles.length, 6) * 3;

  return score;
}

function rankToolingRoots(paths: string[]) {
  return [...collectToolingRoots(paths)].sort(
    (a, b) => scoreToolingRoot(b, paths) - scoreToolingRoot(a, paths) || a.localeCompare(b)
  );
}

function pickToolingFocusRoot(paths: string[]) {
  const ranked = rankToolingRoots(paths);

  if (ranked.length === 0) {
    return null;
  }

  if (ranked.length === 1) {
    return ranked[0];
  }

  const [lead, second] = ranked;
  const scoreGap = scoreToolingRoot(lead, paths) - scoreToolingRoot(second, paths);
  const docGap =
    toolingRootOperationDocs(lead, paths).length -
    toolingRootOperationDocs(second, paths).length;

  return scoreGap >= 12 || docGap >= 3 ? lead : null;
}

function buildToolingRepoKeyFiles(paths: string[], preferredRoot: string | null) {
  const rankedRoots = rankToolingRoots(paths);
  const toolingRoots = unique(
    [
      ...(preferredRoot && rankedRoots.includes(preferredRoot) ? [preferredRoot] : []),
      ...rankedRoots,
    ]
  ).slice(0, 2);
  const rootDocs = shortList(paths.filter((path) => path === "README.md"), 1);
  const rootConfig = shortList(
    paths.filter(
      (path) => path === "package.json" || CONFIG_PATTERN.test(path) || MONOREPO_MANIFEST_PATTERN.test(path)
    ),
    2
  );
  const rootOperations = shortList(
    paths.filter((path) => !path.includes("/") && OPERATION_DOC_PATTERN.test(path)),
    3
  );
  const rootScripts = shortList(
    paths.filter((path) => !path.includes("/") && TOOLING_SCRIPT_PATTERN.test(path)),
    1
  );
  const balancedRoots = preferredRoot === null && toolingRoots.length > 1;
  const scopedFiles = toolingRoots.flatMap((root, index) => {
    const scoped = paths.filter((path) => path.startsWith(`${root}/`));
    const includeRootReadme = index === 0 || balancedRoots;

    return unique([
      ...(includeRootReadme
        ? shortList(scoped.filter((path) => path === `${root}/README.md`), 1)
        : []),
      ...shortList(scoped.filter((path) => OPERATION_DOC_PATTERN.test(path)), 2),
      ...shortList(scoped.filter((path) => TOOLING_SCRIPT_PATTERN.test(path)), 1),
      ...shortList(scoped.filter((path) => TEMPLATE_FILE_PATTERN.test(path)), 1),
    ]);
  });

  return unique([
    ...rootDocs,
    ...rootConfig,
    ...rootOperations,
    ...scopedFiles,
    ...rootScripts,
    ...shortList(paths.filter((path) => TOOLING_SCRIPT_PATTERN.test(path)), 2),
    ...shortList(paths.filter((path) => TEMPLATE_FILE_PATTERN.test(path)), 1),
  ]).slice(0, 8);
}

function buildLibraryRepoKeyFiles(paths: string[], preferredRoot: string | null) {
  const scoped = preferredRoot !== null ? scopedPaths(paths, preferredRoot) : [];
  const scopedLibraryEntry = shortList(scoped.filter((path) => isLibraryEntryPath(path)), 2);
  const scopedLogic = shortList(scoped.filter((path) => isLogicPath(path)), 2);
  const scopedExternal = shortList(scoped.filter((path) => EXTERNAL_PATTERN.test(path)), 1);
  const scopedReadme =
    preferredRoot !== null
      ? shortList(paths.filter((path) => README_PATTERN.test(path) && dirname(path) === preferredRoot), 1)
      : [];
  const scopedManifest =
    preferredRoot !== null
      ? shortList(paths.filter((path) => path === `${preferredRoot}/package.json`), 1)
      : [];
  const fallbackLibraryEntry = shortList(paths.filter((path) => isLibraryEntryPath(path)), 2);
  const fallbackLogic = shortList(paths.filter((path) => isLogicPath(path)), 2);
  const peerPackageManifests =
    preferredRoot === null
      ? shortList(
          paths.filter(
            (path) =>
              path.endsWith("/package.json") &&
              path.startsWith("packages/") &&
              (!preferredRoot || !path.startsWith(`${preferredRoot}/`))
          ),
          2
        )
      : [];

  return unique([
    ...paths.filter((path) => /^README\.(md|mdx)$/i.test(path)),
    ...(scopedLibraryEntry.length > 0 ? scopedLibraryEntry : fallbackLibraryEntry),
    ...scopedManifest,
    ...paths.filter((path) => path === "package.json"),
    ...shortList(paths.filter((path) => MONOREPO_MANIFEST_PATTERN.test(path)), 2),
    ...(scopedLogic.length > 0 ? scopedLogic : fallbackLogic),
    ...scopedExternal,
    ...peerPackageManifests,
    ...scopedReadme,
    ...shortList(paths.filter((path) => CONFIG_PATTERN.test(path)), 1),
  ]).slice(0, 8);
}

function buildMonorepoKeyFiles(paths: string[], preferredRoot: string | null) {
  const scoped = preferredRoot !== null ? scopedPaths(paths, preferredRoot) : [];
  const workspaceRoots = collectWorkspaceRoots(paths);
  const sharedPackageRoot =
    workspaceRoots.find((root) => root.startsWith("packages/")) ??
    workspaceRoots.find((root) => root.startsWith("services/")) ??
    null;
  const sharedFiles = sharedPackageRoot
    ? shortList(
        paths.filter(
          (path) =>
            path.startsWith(`${sharedPackageRoot}/`) &&
            (isLibraryEntryPath(path) ||
              isLogicPath(path) ||
              isLogicPath(path) ||
              COMPONENT_PATTERN.test(path) ||
              path.endsWith("/package.json"))
        ),
        2
      )
    : [];

  return unique([
    ...paths.filter((path) => /^README\.(md|mdx)$/i.test(path)),
    ...paths.filter((path) => path === "package.json"),
    ...shortList(paths.filter((path) => MONOREPO_MANIFEST_PATTERN.test(path)), 2),
    ...shortList(scoped.filter((path) => path.endsWith("/package.json")), 1),
    ...shortList(
      scoped.filter((path) => APP_PAGE_PATTERN.test(path) || APP_SUPPORT_PATTERN.test(path) || PAGES_ROUTE_PATTERN.test(path)),
      2
    ),
    ...shortList(scoped.filter((path) => APP_LAYOUT_PATTERN.test(path)), 1),
    ...shortList(scoped.filter((path) => API_PATTERN.test(path)), 1),
    ...sharedFiles,
  ]).slice(0, 8);
}

export function buildKeyFiles(
  paths: string[],
  pkg?: PackageJsonShape | null,
  projectType?: string,
  preferredRoot?: string | null
): KeyFileInfo[] {
  const focusRoot = preferredRoot ?? pickRepresentativeRoot(paths);
  const examplePaths =
    projectType === "학습용 예제 저장소"
      ? buildExampleRepoKeyFiles(paths, focusRoot)
      : [];
  const monorepoPaths =
    projectType === "모노레포 웹 플랫폼" || projectType === "모노레포 저장소"
      ? buildMonorepoKeyFiles(paths, focusRoot)
      : [];
  const webAppPaths =
    projectType === "풀스택 웹앱" || projectType === "프론트엔드 웹앱"
      ? buildWebAppKeyFiles(paths, focusRoot)
      : [];
  const apiRepoPaths =
    projectType === "API 서버" || projectType === "백엔드 API 서비스"
      ? buildApiRepoKeyFiles(paths, focusRoot)
      : [];
  const cliPaths = projectType === "CLI 도구" ? buildCliRepoKeyFiles(paths) : [];
  const libraryPaths = isLibraryLikeProjectType(projectType)
    ? buildLibraryRepoKeyFiles(paths, focusRoot)
    : [];
  const toolingPaths =
    projectType === "라이브러리 또는 개발 도구"
      ? buildToolingRepoKeyFiles(paths, focusRoot)
      : [];

  if (projectType === "학습용 예제 저장소" && examplePaths.length > 0) {
    return examplePaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if (
    (projectType === "모노레포 웹 플랫폼" || projectType === "모노레포 저장소") &&
    monorepoPaths.length > 0
  ) {
    return monorepoPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if ((projectType === "풀스택 웹앱" || projectType === "프론트엔드 웹앱") && webAppPaths.length > 0) {
    return webAppPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if ((projectType === "API 서버" || projectType === "백엔드 API 서비스") && apiRepoPaths.length > 0) {
    return apiRepoPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if (projectType === "CLI 도구" && cliPaths.length > 0) {
    return cliPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if (isLibraryLikeProjectType(projectType) && libraryPaths.length > 0) {
    return libraryPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  if (projectType === "라이브러리 또는 개발 도구" && toolingPaths.length > 0) {
    return toolingPaths.slice(0, 8).map((path, index) => {
      const description = describeKeyFile(path);

      return {
        path,
        readOrder: index + 1,
        role: description.role,
        whyImportant: description.whyImportant,
        evidence: description.evidence,
        relatedLayers: description.relatedLayers,
      };
    });
  }

  const candidatePaths = paths;

  const candidates = unique(candidatePaths)
    .map((path) => ({
      path,
      score: scoreKeyFile(path, focusRoot, projectType),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 8);

  const fallback =
    candidates.length > 0
      ? candidates
      : paths.slice(0, 5).map((path) => ({ path, score: 1 }));

  return fallback.map(({ path }, index) => {
    const description = describeKeyFile(path);

    return {
      path,
      readOrder: index + 1,
      role: description.role,
      whyImportant: description.whyImportant,
      evidence: description.evidence,
      relatedLayers: description.relatedLayers,
    };
  });
}

export function buildEditGuides(
  paths: string[],
  pkg?: PackageJsonShape | null,
  projectType?: string,
  preferredRoot?: string | null
): EditGuideInfo[] {
  const signals = collectSignals(paths, pkg);
  const focusRoot = preferredRoot ?? pickRepresentativeRoot(paths);
  const scoped = focusRoot !== null ? scopedPaths(paths, focusRoot) : [];
  const scopedUi = shortList(
    unique(
      scoped.filter(
        (path) =>
          APP_PAGE_PATTERN.test(path) ||
          APP_SUPPORT_PATTERN.test(path) ||
          APP_LAYOUT_PATTERN.test(path) ||
          COMPONENT_PATTERN.test(path)
      )
    ),
    4
  );
  const uiFiles = shortList(
    unique([...signals.routeFiles, ...signals.layoutFiles, ...signals.componentFiles]),
    4
  );
  const apiFiles = shortList(unique([...signals.apiFiles, ...signals.middlewareFiles]), 4);
  const scopedApiFiles = shortList(scoped.filter((path) => API_PATTERN.test(path)), 4);
  const scopedDbFiles = shortList(scoped.filter((path) => isDbPath(path)), 4);
  const scopedLogicFiles = shortList(scoped.filter((path) => isLogicPath(path)), 4);
  const scopedExternalFiles = shortList(scoped.filter((path) => EXTERNAL_PATTERN.test(path)), 4);
  const scopedLibraryEntryFiles = shortList(scoped.filter((path) => isLibraryEntryPath(path)), 4);
  const scopedOperationDocs = shortList(scoped.filter((path) => OPERATION_DOC_PATTERN.test(path)), 4);
  const scopedToolingScripts = shortList(scoped.filter((path) => TOOLING_SCRIPT_PATTERN.test(path)), 4);
  const scopedTemplateFiles = shortList(scoped.filter((path) => TEMPLATE_FILE_PATTERN.test(path)), 4);
  const dbFiles = shortList(signals.dbFiles, 4);
  const logicFiles = shortList(signals.logicFiles, 4);
  const externalFiles = shortList(signals.externalFiles, 4);
  const cliFiles = shortList(signals.cliFiles, 4);
  const operationDocs = shortList(paths.filter((path) => OPERATION_DOC_PATTERN.test(path)), 4);
  const toolingScripts = shortList(paths.filter((path) => TOOLING_SCRIPT_PATTERN.test(path)), 4);
  const templateFiles = shortList(paths.filter((path) => TEMPLATE_FILE_PATTERN.test(path)), 4);
  const configFiles = shortList(unique([...signals.configFiles, ...signals.readmeFiles, ...paths.filter((path) => path === "package.json")]), 3);
  const hasUi = uiFiles.length > 0;
  const hasCli = (cliFiles.length > 0 || projectType === "CLI 도구") && !hasUi;
  const preferredUiFiles = scopedUi.length > 0 ? scopedUi : uiFiles;
  const preferredApiFiles = scopedApiFiles.length > 0 ? scopedApiFiles : apiFiles;
  const preferredDbFiles = scopedDbFiles.length > 0 ? scopedDbFiles : dbFiles;
  const preferredLogicFiles = scopedLogicFiles.length > 0 ? scopedLogicFiles : logicFiles;
  const preferredExternalFiles =
    scopedExternalFiles.length > 0 ? scopedExternalFiles : externalFiles;
  const preferredLibraryEntryFiles =
    scopedLibraryEntryFiles.length > 0
      ? scopedLibraryEntryFiles
      : shortList(signals.libraryEntryFiles, 4);
  const preferredOperationDocs =
    scopedOperationDocs.length > 0 ? scopedOperationDocs : operationDocs;
  const preferredToolingScripts =
    scopedToolingScripts.length > 0 ? scopedToolingScripts : toolingScripts;
  const preferredTemplateFiles =
    scopedTemplateFiles.length > 0 ? scopedTemplateFiles : templateFiles;
  const supportRoots = collectSupportWorkspaceRoots(paths);
  const supportUiFiles = shortList(
    unique(
      supportRoots.flatMap((root) =>
        paths.filter(
          (path) =>
            path.startsWith(`${root}/`) &&
            (APP_PAGE_PATTERN.test(path) ||
              APP_SUPPORT_PATTERN.test(path) ||
              APP_LAYOUT_PATTERN.test(path) ||
              COMPONENT_PATTERN.test(path))
        )
      )
    ),
    4
  );

  if (projectType === "학습용 예제 저장소") {
    return [
      {
        intent: "대표 예제부터 읽기",
        files: shortList(unique([...configFiles, ...scopedUi]), 4),
        reason: "예제 저장소는 먼저 README와 대표 예제 루트를 확인해야 전체 구성을 덜 헤매고 읽을 수 있습니다.",
        evidence: [focusRoot ? `대표 예제 루트: ${focusRoot}` : "README / config 파일 우선"],
        relatedLayers: [],
      },
      {
        intent: "대표 화면 예제 수정",
        files: preferredUiFiles,
        reason: "대표 예제 루트 안의 페이지와 컴포넌트부터 보면 실제 UI를 가장 빨리 바꿀 수 있습니다.",
        evidence: [focusRoot ? `대표 예제 루트 기준 경로 선택` : "UI 경로 fallback 사용"],
        relatedLayers: ["UI"],
      },
      {
        intent: "대표 API 예제 수정",
        files: preferredApiFiles,
        reason: "예제 저장소에서도 API 수정은 대표 예제 루트 안의 route 파일부터 보는 편이 안전합니다.",
        evidence: [focusRoot ? `대표 예제 루트 기준 API 선택` : "전체 API 경로 fallback 사용"],
        relatedLayers: ["API"],
      },
      {
        intent: "공통 설정 수정",
        files: configFiles,
        reason: "여러 예제가 섞인 저장소는 package.json, README, config 파일이 공통 규칙을 먼저 설명합니다.",
        evidence: ["config / README 파일 우선"],
        relatedLayers: [],
      },
    ];
  }

  if (projectType === "모노레포 웹 플랫폼" || projectType === "모노레포 저장소") {
    return [
      {
        intent: "루트 설정 먼저 읽기",
        files: configFiles,
        reason: "모노레포는 루트 package.json과 workspace 설정 파일이 앱 경계와 실행 방식을 먼저 설명합니다.",
        evidence: ["root config / workspace manifest 우선"],
        relatedLayers: [],
      },
      {
        intent: "대표 앱 UI 수정",
        files: preferredUiFiles,
        reason: "대표 앱 루트를 먼저 고정해야 여러 앱이 섞인 저장소에서도 수정 범위를 헷갈리지 않습니다.",
        evidence: [focusRoot ? `대표 앱 루트: ${focusRoot}` : "대표 앱 루트를 찾지 못해 전체 UI 후보 사용"],
        relatedLayers: ["UI"],
      },
      {
        intent: "대표 앱 API 수정",
        files: preferredApiFiles,
        reason: "모노레포의 API 수정도 우선 대표 앱 안의 route 파일부터 보는 편이 안전합니다.",
        evidence: [focusRoot ? `대표 앱 루트 기준 API 선택` : "전체 API 경로 fallback 사용"],
        relatedLayers: ["API"],
      },
      {
        intent: "공용 패키지 수정",
        files: shortList(
          unique(
            paths.filter(
              (path) =>
                path.startsWith("packages/") &&
                (isLibraryEntryPath(path) ||
                  isLogicPath(path) ||
                  COMPONENT_PATTERN.test(path) ||
                  path.endsWith("/package.json"))
            )
          ),
          4
        ),
        reason: "여러 앱이 공통으로 쓰는 로직이나 UI는 보통 packages 아래에 모이므로 여기부터 보면 영향 범위를 예측하기 쉽습니다.",
        evidence: ["packages/* 경로 우선 적용"],
        relatedLayers: ["Logic", "UI"],
      },
    ];
  }

  if (hasCli) {
    return [
      {
        intent: "CLI 실행 흐름 수정",
        files: cliFiles,
        reason: "명령줄 기반 프로젝트라면 CLI 진입 파일부터 봐야 실제 동작을 바꿀 수 있습니다.",
        evidence: ["CLI 파일 패턴 우선 적용"],
        relatedLayers: ["Logic"],
      },
      {
        intent: "핵심 로직 수정",
        files: preferredLogicFiles,
        reason: "공통 로직 파일이 실제 기능 처리 흐름을 담고 있을 가능성이 높습니다.",
        evidence: ["logic 경로 우선 적용"],
        relatedLayers: ["Logic"],
      },
      {
        intent: "외부 서비스 호출 수정",
        files: shortList(unique([...preferredExternalFiles, ...preferredLogicFiles]), 4),
        reason: "외부 SDK 또는 API 호출은 integration/client 파일이나 핵심 로직 파일에 모이는 경우가 많습니다.",
        evidence: ["external 경로와 logic 경로 결합"],
        relatedLayers: ["External", "Logic"],
      },
      {
        intent: "설정 또는 실행 방법 수정",
        files: configFiles,
        reason: "실행 명령과 설정값은 package.json, README, config 파일에서 먼저 확인하는 것이 가장 빠릅니다.",
        evidence: ["config / README 파일 우선"],
        relatedLayers: [],
      },
    ];
  }

  if (isLibraryLikeProjectType(projectType)) {
    return [
      {
        intent: "공개 API 수정",
        files: shortList(unique([...preferredLibraryEntryFiles, ...preferredLogicFiles]), 4),
        reason: "라이브러리는 index/main 같은 공개 엔트리와 핵심 로직 파일을 같이 봐야 인터페이스 변경 지점을 찾기 쉽습니다.",
        evidence: ["library entry 우선 적용"],
        relatedLayers: ["Logic"],
      },
      {
        intent: "핵심 로직 수정",
        files: preferredLogicFiles,
        reason: "기능 동작은 보통 lib, utils, services 같은 파일에 모여 있습니다.",
        evidence: ["logic 경로 우선 적용"],
        relatedLayers: ["Logic"],
      },
      ...(projectType === "컴포넌트 라이브러리 또는 디자인 시스템" && supportUiFiles.length > 0
        ? [
            {
              intent: "문서/쇼케이스 앱 수정",
              files: supportUiFiles,
              reason: "이 유형의 저장소는 대표 패키지 외에 문서나 쇼케이스 앱이 함께 있어 데모 화면 수정 경로를 따로 보는 편이 이해하기 쉽습니다.",
              evidence: [supportRoots[0] ? `support app root: ${supportRoots[0]}` : "support app 경로 탐지"],
              relatedLayers: ["UI"] as LayerName[],
            },
          ]
        : []),
      {
        intent: "외부 연동 수정",
        files: shortList(unique([...preferredExternalFiles, ...preferredLogicFiles]), 4),
        reason: "외부 SDK와 연결된 로직은 integration/client 계열 파일이나 핵심 로직 파일에 나타납니다.",
        evidence: ["external 경로와 logic 경로 결합"],
        relatedLayers: ["External", "Logic"],
      },
      {
        intent: "설정 및 배포 수정",
        files: configFiles,
        reason: "package.json과 config 파일이 빌드, 배포, 패키징 방식을 결정합니다.",
        evidence: ["config / README 파일 우선"],
        relatedLayers: [],
      },
    ];
  }

  if (projectType === "라이브러리 또는 개발 도구") {
    const toolingRoots = rankToolingRoots(paths).slice(0, 2);
    const focusEvidence = focusRoot
      ? `대표 tooling root: ${focusRoot}`
      : toolingRoots.length > 1
        ? `주요 tooling roots: ${toolingRoots.join(", ")}`
        : "운영 문서 경로 우선";

    return [
      {
        intent: "운영 규칙 문서 수정",
        files: shortList(unique([...configFiles, ...preferredOperationDocs]), 4),
        reason: "이 유형의 저장소는 README와 운영 문서가 전체 사용법과 작업 규칙을 직접 설명하므로 여기부터 수정해야 영향 범위를 파악하기 쉽습니다.",
        evidence: [focusEvidence],
        relatedLayers: [],
      },
      {
        intent: "자동화/검증 스크립트 수정",
        files: shortList(unique([...preferredToolingScripts, ...preferredLogicFiles]), 4),
        reason: "실제 동작 방식은 scripts/harness나 hook 파일에 모이는 경우가 많아 자동화 흐름 변경은 이 경로부터 보는 편이 정확합니다.",
        evidence: ["tooling script 경로 우선 적용"],
        relatedLayers: ["Logic"],
      },
      {
        intent: "템플릿 기본값 수정",
        files: shortList(unique([...preferredTemplateFiles, ...preferredOperationDocs]), 4),
        reason: "새 프로젝트 출발점을 바꾸려면 templates와 그에 대응하는 운영 문서를 같이 봐야 템플릿 의미와 결과가 어긋나지 않습니다.",
        evidence: ["template 경로와 운영 문서 경로 결합"],
        relatedLayers: [],
      },
      {
        intent: "배포/운영 설정 수정",
        files: shortList(unique([...configFiles, ...preferredOperationDocs]), 4),
        reason: "루트 설정과 pack 문서를 함께 봐야 실행 방식, 버전 관리, 배포 규칙 같은 운영 전제를 안전하게 바꿀 수 있습니다.",
        evidence: ["config / README 파일 우선"],
        relatedLayers: [],
      },
    ];
  }

  const guides: EditGuideInfo[] = [
    {
      intent: "화면 문구 수정",
      files: preferredUiFiles,
      reason: hasUi
        ? "페이지와 컴포넌트 파일부터 보면 화면에 직접 노출되는 문구를 가장 빨리 찾을 수 있습니다."
        : "명확한 UI 진입점을 찾지 못했습니다. 이 레포는 화면 중심 프로젝트가 아닐 수 있습니다.",
      evidence: ["UI 경로 우선 적용"],
      relatedLayers: ["UI"],
    },
    {
      intent: "UI 구조 수정",
      files: shortList(unique([...signals.layoutFiles, ...preferredUiFiles]), 4),
      reason: hasUi
        ? "레이아웃과 주요 페이지 파일이 화면 배치와 구조를 가장 크게 좌우합니다."
        : "명확한 UI 레이어를 찾지 못해 관련 후보가 제한적입니다.",
      evidence: ["layout / route / component 패턴 결합"],
      relatedLayers: ["UI"],
    },
    {
      intent: "API 응답 수정",
      files: preferredApiFiles.length > 0 ? preferredApiFiles : preferredLogicFiles,
      reason: preferredApiFiles.length > 0
        ? "API route 또는 middleware가 요청 처리와 응답 구조를 직접 담당합니다."
        : "명확한 API route를 찾지 못해 핵심 로직 파일을 대체 시작점으로 제안합니다.",
      evidence: [preferredApiFiles.length > 0 ? "API 경로 탐지 결과 사용" : "logic 경로 fallback 사용"],
      relatedLayers: preferredApiFiles.length > 0 ? ["API"] : ["Logic"],
    },
    {
      intent: "DB 관련 수정",
      files: preferredDbFiles.length > 0 ? preferredDbFiles : preferredLogicFiles,
      reason: preferredDbFiles.length > 0
        ? "DB, Prisma, Supabase, Firebase 관련 파일이 데이터 저장/조회 연결 지점입니다."
        : "명확한 DB 연결 파일을 찾지 못해 핵심 로직 파일을 대체 후보로 제안합니다.",
      evidence: [preferredDbFiles.length > 0 ? "DB 경로 탐지 결과 사용" : "logic 경로 fallback 사용"],
      relatedLayers: preferredDbFiles.length > 0 ? ["DB"] : ["Logic"],
    },
  ];

  if (preferredExternalFiles.length > 0) {
    guides.splice(3, 0, {
      intent: "외부 연동 수정",
      files: shortList(unique([...preferredExternalFiles, ...preferredLogicFiles]), 4),
      reason: "외부 서비스 호출과 SDK 초기화는 integration/client 파일이나 인접 로직 파일에서 시작되는 경우가 많습니다.",
      evidence: [focusRoot ? `대표 루트 기준 외부 연동 후보 사용` : "external 경로 탐지 결과 사용"],
      relatedLayers: ["External", "Logic"],
    });
  }

  return guides;
}

export function buildOneLiner(args: {
  projectType: string;
  description: string | null;
  stack: string[];
  routeCount: number;
  apiCount: number;
  truncated: boolean;
  semanticAddon?: string | null;
  plainTitle?: string | null;
  identitySubtitle?: string | null;
}) {
  const addon = args.semanticAddon?.trim() ?? null;
  const semanticNameTokens = [
    "Prisma",
    "Supabase",
    "Firebase",
    "Drizzle",
    "Mongoose",
    "Sequelize",
    "TypeORM",
    "Knex",
    "OpenAI",
    "Anthropic",
    "Stripe",
    "Clerk",
    "GitHub",
    "Slack",
    "Resend",
    "Sentry",
  ];
  const normalize = (value: string | null | undefined) => value?.trim().replace(/\s+/g, " ") ?? "";
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const containsHangul = (value: string) => /[가-힣]/.test(value);
  const englishWordCount = (value: string) => value.match(/[A-Za-z][A-Za-z0-9+./-]*/g)?.length ?? 0;
  const isEnglishHeavy = (value: string) => !containsHangul(value) && englishWordCount(value) >= 4;
  const isStructuralGuidanceSentence = (value: string) =>
    /(구조를 먼저 보면|구조를 정리했습니다|전체 흐름이 빨리 잡힙니다|중심으로 보면 됩니다|중심으로 읽으면 됩니다)/.test(
      value
    );
  const sentenceize = (value: string | null | undefined) => {
    const cleaned = normalize(value);
    if (!cleaned) return null;
    if (/[.!?]$/.test(cleaned)) return cleaned;
    if (/(입니다|합니다|됩니다|있습니다|보입니다|좋습니다|빠릅니다|잡힙니다|풀립니다)$/.test(cleaned)) {
      return `${cleaned}.`;
    }
    return containsHangul(cleaned) ? `${cleaned}입니다.` : cleaned;
  };
  const compactAddonForMergedSentence = (value: string | null) => {
    const cleaned = normalize(value);
    if (!cleaned) return null;

    const apiFlowMatch = cleaned.match(
      /^대표 코드 기준,\s*.+?에서\s+(.+?) 요청을 보내고 이 API 흐름에서\s+(.+?)이 확인됩니다\.$/
    );
    if (apiFlowMatch) {
      return `대표 코드에서는 ${apiFlowMatch[1]} 요청 뒤 ${apiFlowMatch[2]}이 확인됩니다.`;
    }

    const apiOnlyMatch = cleaned.match(/^대표 코드 기준,\s*.+?에서\s+(.+?) 요청으로 서버 처리 흐름이 이어집니다\.$/);
    if (apiOnlyMatch) {
      return `대표 코드에서는 ${apiOnlyMatch[1]} 요청 뒤 서버 처리 흐름이 이어집니다.`;
    }

    const logicMatch = cleaned.match(/^대표 코드 기준,\s*.+?에서\s+(.+?) 로직을 직접 사용합니다\.$/);
    if (logicMatch) {
      return `대표 코드에서는 ${logicMatch[1]} 로직을 직접 사용합니다.`;
    }

    if (/^대표 코드 기준,\s*/.test(cleaned)) {
      return cleaned.replace(/^대표 코드 기준,\s*/, "대표 코드에서는 ");
    }

    return cleaned;
  };
  const extractSemanticNames = (value: string | null) => {
    const cleaned = normalize(value);
    if (!cleaned) return [];

    return semanticNameTokens.filter((token) => new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(cleaned));
  };
  const shouldSuppressSemanticAddon = (firstSentence: string | null, value: string | null) => {
    const cleanedFirstSentence = normalize(firstSentence);
    const cleanedAddon = normalize(value);

    if (!cleanedFirstSentence || !cleanedAddon) {
      return false;
    }

    if (/요청|흐름|route|api\/|app\/|pages\//i.test(cleanedAddon)) {
      return false;
    }

    const addonNames = extractSemanticNames(cleanedAddon);

    if (addonNames.length === 0) {
      return false;
    }

    return addonNames.every((token) =>
      new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(cleanedFirstSentence)
    );
  };
  const mergeContextAndAddon = (context: string | null, value: string | null) => {
    if (!context || !value) {
      return null;
    }

    if (!/기준으로 구조를 정리했습니다\.$/.test(context)) {
      return null;
    }

    const compactAddon = compactAddonForMergedSentence(value);
    if (!compactAddon) {
      return null;
    }

    return `${context.replace(/정리했습니다\.$/, "정리했고,")} ${compactAddon}`.trim();
  };
  const firstSentence = (() => {
    const subtitle = sentenceize(args.identitySubtitle);
    const plainTitle = sentenceize(args.plainTitle);
    if (subtitle && !isEnglishHeavy(subtitle)) {
      if (!isStructuralGuidanceSentence(subtitle) || !plainTitle || isEnglishHeavy(plainTitle)) {
        return subtitle;
      }
    }

    if (plainTitle && !isEnglishHeavy(plainTitle)) return plainTitle;

    const described = normalize(args.description);
    if (described && !isEnglishHeavy(described)) {
      return sentenceize(described);
    }

    if (args.projectType === "학습용 예제 저장소") {
      return "예제 앱과 참고 코드를 함께 따라 보며 구조를 익히는 학습용 저장소입니다.";
    }
    if (args.projectType === "풀스택 웹앱") {
      return "브라우저 화면과 서버 요청이 함께 있는 웹 서비스입니다.";
    }
    if (args.projectType === "모노레포 웹 플랫폼") {
      return "여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼입니다.";
    }
    if (args.projectType === "모노레포 저장소") {
      return "여러 워크스페이스를 한 저장소에서 함께 관리하는 모노레포입니다.";
    }
    if (args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
      return "재사용 UI 컴포넌트와 문서를 함께 제공하는 디자인 시스템 저장소입니다.";
    }
    if (args.projectType === "프론트엔드 웹앱") {
      return "브라우저 화면 중심으로 기능을 제공하는 웹앱입니다.";
    }
    if (args.projectType === "API 서버" || args.projectType === "백엔드 API 서비스") {
      return "요청을 받아 처리하고 응답을 돌려주는 서버 프로젝트입니다.";
    }
    if (args.projectType === "CLI 도구") {
      return "터미널에서 명령으로 실행하는 도구입니다.";
    }
    if (args.projectType === "라이브러리 또는 SDK") {
      return "다른 코드에서 가져다 쓰는 라이브러리 또는 SDK입니다.";
    }
    if (args.projectType === "라이브러리 또는 개발 도구") {
      return "개발 작업을 돕는 운영 도구와 스크립트를 함께 가진 저장소입니다.";
    }

    return sentenceize(`${args.stack.slice(0, 2).join(" + ")} 기반 ${args.projectType}`);
  })();
  const effectiveAddon = shouldSuppressSemanticAddon(firstSentence, addon) ? null : addon;

  const contextSentence = (() => {
    if (args.projectType === "학습용 예제 저장소") {
      return "README와 대표 예제 루트부터 보면 전체 흐름이 가장 덜 헷갈립니다.";
    }
    if (args.projectType === "풀스택 웹앱") {
      return `화면 ${args.routeCount}개와 API ${args.apiCount}개 흐름을 기준으로 구조를 정리했습니다.`;
    }
    if (args.projectType === "모노레포 웹 플랫폼") {
      return "루트 설정과 대표 앱 루트를 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "모노레포 저장소") {
      return "루트 설정과 대표 워크스페이스를 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템") {
      return "대표 패키지 엔트리와 문서를 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "프론트엔드 웹앱") {
      return "대표 페이지와 주요 컴포넌트를 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "API 서버" || args.projectType === "백엔드 API 서비스") {
      return args.apiCount > 0
        ? `API ${args.apiCount}개 흐름을 기준으로 구조를 정리했습니다.`
        : "API 진입점과 공통 로직을 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "CLI 도구") {
      return "CLI 진입점과 핵심 로직을 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "라이브러리 또는 SDK") {
      return "공개 엔트리와 핵심 로직을 기준으로 구조를 정리했습니다.";
    }
    if (args.projectType === "라이브러리 또는 개발 도구") {
      return "README와 핵심 운영 문서를 기준으로 구조를 정리했습니다.";
    }
    return null;
  })();

  const supportSentence =
    args.truncated && !effectiveAddon ? "현재 결과는 주요 코드 기준 요약입니다." : null;
  const mergedContextSentence = mergeContextAndAddon(contextSentence, effectiveAddon);

  const parts = (mergedContextSentence
    ? [firstSentence, mergedContextSentence, supportSentence]
    : [firstSentence, contextSentence, effectiveAddon, supportSentence]
  ).filter((value, index, all): value is string => {
    if (!value) return false;
    return all.findIndex((candidate) => candidate === value) === index;
  });

  return parts.slice(0, 3).join(" ");
}

export function collectCounts(paths: string[], pkg?: PackageJsonShape | null) {
  const signals = collectSignals(paths, pkg);

  return {
    routeCount: signals.routeFiles.length,
    apiEndpointCount: signals.apiFiles.length + signals.middlewareFiles.length,
  };
}
