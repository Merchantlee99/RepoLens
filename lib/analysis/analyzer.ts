import { ANALYSIS_LIMITS, ANALYSIS_MODE_LABEL, ANALYSIS_SCHEMA_VERSION, SUPPORTED_STACK_MARKERS } from "@/lib/analysis/constants";
import { buildOwnerCacheKey, buildShaCacheKey, clearInFlightAnalysis, getCachedAnalysis, getInFlightAnalysis, setCachedAnalysis, setInFlightAnalysis } from "@/lib/analysis/cache";
import { createAnalysisError } from "@/lib/analysis/errors";
import {
  fetchBranch,
  fetchOwnerProfile,
  fetchOwnerRepositories,
  fetchReadmeText,
  fetchRecursiveTree,
  fetchRepository,
  fetchTextFile,
  parseGitHubTargetUrl,
  parseGitHubRepoUrl,
} from "@/lib/analysis/github";
import {
  buildTopology,
  buildEditGuides,
  buildKeyFeatures,
  buildKeyFiles,
  buildLayers,
  buildOneLiner,
  collectCounts,
  detectProjectType,
  detectStack,
  estimateDifficulty,
  filterAnalyzablePaths,
  parsePackageJson,
  summarizeLayerCoverage,
} from "@/lib/analysis/heuristics";
import { createAnalysisLogger } from "@/lib/analysis/logger";
import { buildAnalyzeTargetMeta } from "@/lib/analysis/policy";
import {
  applySemanticHintsToEditGuides,
  applySemanticHintsToKeyFiles,
  extractSemanticSignals,
  mergeSemanticKeyFeatures,
  summarizeUnclassifiedCodeSemantics,
  type SemanticSignals,
} from "@/lib/analysis/semantics";
import { buildLearningGuide, refineDisplayStack } from "@/lib/analysis/learning";
import { analyzeOwnerSnapshot } from "@/lib/analysis/owner";
import type {
  AnalysisResult,
  AnalysisEvidence,
  AnalysisFact,
  AnalysisInference,
  AnalysisMode,
  AnalysisNotice,
  AnalyzeTargetMeta,
  OwnerAnalysis,
  RepoAnalysis,
} from "@/lib/analysis/types";

export type RepositorySnapshot = {
  repo: RepoAnalysis["repo"];
  allPaths: string[];
  packageJsonText?: string | null;
  readmeText?: string | null;
  representativePaths?: string[];
  selectedFileContents?: Record<string, string>;
  truncated: boolean;
  sourceFileCount?: number;
};

type AnalysisWithMeta<T extends AnalysisResult> = {
  analysis: T;
  meta: AnalyzeTargetMeta;
};

const ROOT_SIGNAL_PATTERN =
  /(^|\/)(README\.(md|mdx)|package\.json|tsconfig\.json|next\.config\.(ts|js|mjs)|tailwind\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|eslint\.config\.(js|mjs)|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json|firebase\.json|prisma\/schema\.prisma)$/i;
const HIGH_PRIORITY_FLOW_PATTERN =
  /(^|\/)(app\/.*page\.(ts|tsx|js|jsx|mdx)|pages\/.*\.(ts|tsx|js|jsx|mdx)|app\/.*layout\.(ts|tsx|js|jsx|mdx)|app\/api\/.*route\.(ts|tsx|js|jsx)|pages\/api\/.*\.(ts|tsx|js|jsx)|components\/.*\.(ts|tsx|js|jsx)|ui\/.*\.(ts|tsx|js|jsx))$/;
const LIBRARY_PRIORITY_PATTERN =
  /(^|\/)(src\/index\.(ts|tsx|js|jsx|mjs|cjs)|src\/main\.(ts|tsx|js|jsx|mjs|cjs)|index\.(ts|tsx|js|jsx|mjs|cjs)|main\.(ts|tsx|js|jsx|mjs|cjs)|services\/.*\.(ts|tsx|js|jsx)|packages\/[^/]+(?:\/[^/]+)?\/src\/.*\.(ts|tsx|js|jsx)|packages\/[^/]+(?:\/[^/]+)?\/package\.json|packages\/[^/]+(?:\/[^/]+)?\/README\.(md|mdx))$/;
const LIMITED_DB_PRIORITY_PATTERN =
  /(^|\/)(db|database|prisma|supabase|firebase|migrations?)\/.+|(^|\/)(schema|client)\.(ts|tsx|js|jsx|prisma|sql)$/i;
const LIMITED_EXTERNAL_PRIORITY_PATTERN =
  /(^|\/)(integrations?|clients?|vendors?)\/.+|(openai|stripe|slack|github|resend|clerk|sentry|anthropic)\.(ts|tsx|js|jsx)$/i;
const LOW_VALUE_LIBRARY_BUILD_PATTERN =
  /(^|\/)packages\/[^/]+(?:\/[^/]+)?\/(lib|dist|esm|cjs)\/.+\.(js|jsx|mjs|cjs|ts|tsx)$/i;
const LOW_SIGNAL_LIMITED_PATTERN =
  /(^|\/)(docs|storybook|playgrounds?|sandbox|generated|fixtures|mocks?|bench|benchmark|demo|examples?|starter|templates?|showcase|preview|tests?|testing)(\/|$)/i;
const REPRESENTATIVE_LOGIC_PATTERN =
  /(^|\/)(lib|utils|hooks|services|store|actions|core|features)\/.+\.(ts|tsx|js|jsx|mjs|cjs|py)$/;
const REPRESENTATIVE_OPERATION_DOC_PATTERN =
  /(^|\/)(AGENTS|CLAUDE|ETHOS|Prompt|Plan|Implement|Documentation|Subagent-Manifest|Automation-Intent|Design-Options|Review)\.md$/i;
const SINGLE_REPO_SUPPORT_FOCUS_ROOT_PATTERN =
  /^(docs|website|site|demo|demos|example|examples|playground|playgrounds|sandbox|showcase|preview|storybook|ecosystem-tests)(\/|$)/i;
const SINGLE_REPO_LIBRARY_ENTRY_PATTERN =
  /^src\/index\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb)$/i;

function workspacePackageJsonText(selectedFileContents: Record<string, string> | undefined, focusRoot: string | null) {
  if (!focusRoot) return null;
  return selectedFileContents?.[`${focusRoot}/package.json`] ?? null;
}

function resolveEffectiveFocusRoot(args: {
  paths: string[];
  topology: RepoAnalysis["topology"];
  projectType: string;
}) {
  if (
    args.topology.kind !== "single" ||
    (args.projectType !== "라이브러리 또는 SDK" &&
      args.projectType !== "컴포넌트 라이브러리 또는 디자인 시스템")
  ) {
    return args.topology.focusRoot;
  }

  if (!args.topology.focusRoot || !SINGLE_REPO_SUPPORT_FOCUS_ROOT_PATTERN.test(args.topology.focusRoot)) {
    return args.topology.focusRoot;
  }

  if (args.paths.some((path) => SINGLE_REPO_LIBRARY_ENTRY_PATTERN.test(path))) {
    return "src";
  }

  return null;
}

function isDisplayStackConfigPath(path: string) {
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

function displayStackPaths(paths: string[], focusRoot: string | null, projectType: string) {
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
    : paths.filter((path) => !path.includes("/") && isDisplayStackConfigPath(path));
  return [...new Set([...scoped, ...rootConfigs])];
}

function detectSummaryStack(args: {
  paths: string[];
  pkg: ReturnType<typeof parsePackageJson>;
  selectedFileContents?: Record<string, string>;
  focusRoot: string | null;
  projectType: string;
}) {
  const scopedPaths = displayStackPaths(args.paths, args.focusRoot, args.projectType);
  const workspacePkg = parsePackageJson(workspacePackageJsonText(args.selectedFileContents, args.focusRoot));

  if (!args.focusRoot) {
    return detectStack(scopedPaths, args.pkg);
  }

  return detectStack(scopedPaths, workspacePkg);
}

const SELF_BRANDED_LIBRARY_SIGNAL_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Clerk", pattern: /\bclerk\b/i },
  { name: "Firebase", pattern: /\bfirebase\b/i },
  { name: "Supabase", pattern: /\bsupabase\b/i },
];
const SELF_BRANDED_DB_NAMES = new Set(["Firebase", "Supabase"]);
const SELF_BRANDED_EXTERNAL_NAMES = new Set(["Clerk", "Firebase", "Supabase"]);
const BENIGN_LAYER_GAP_REASON_KEYS = new Set(["entry", "src-root", "root-file", "other", "cli"]);

function selfBrandedLibraryNames(args: {
  repo: RepoAnalysis["repo"];
  pkg?: ReturnType<typeof parsePackageJson>;
  workspacePkg?: ReturnType<typeof parsePackageJson>;
  readmeText?: string | null;
}) {
  const identityText = [
    args.repo.owner,
    args.repo.name,
    args.repo.description ?? "",
    args.pkg?.name ?? "",
    args.pkg?.description ?? "",
    args.workspacePkg?.name ?? "",
    args.workspacePkg?.description ?? "",
    args.readmeText ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return SELF_BRANDED_LIBRARY_SIGNAL_PATTERNS.filter((entry) => entry.pattern.test(identityText)).map(
    (entry) => entry.name
  );
}

function normalizeSemanticSignalsForProjectContext(args: {
  projectType: string;
  repo: RepoAnalysis["repo"];
  pkg?: ReturnType<typeof parsePackageJson>;
  workspacePkg?: ReturnType<typeof parsePackageJson>;
  readmeText?: string | null;
  signals: SemanticSignals;
}) {
  if (
    args.projectType !== "라이브러리 또는 SDK" &&
    args.projectType !== "컴포넌트 라이브러리 또는 디자인 시스템" &&
    args.projectType !== "학습용 예제 저장소"
  ) {
    return args.signals;
  }

  const selfBrandedNames = selfBrandedLibraryNames(args);

  if (selfBrandedNames.length === 0) {
    return args.signals;
  }

  const featurePattern = new RegExp(`^(${selfBrandedNames.join("|")})\\s+(연동 확인|연결 확인)$`, "i");
  const addonPattern = new RegExp(`\\b(${selfBrandedNames.join("|")})\\b`, "i");

  return {
    ...args.signals,
    keyFeatures: args.signals.keyFeatures.filter((feature) => !featurePattern.test(feature)),
    oneLinerAddon:
      args.signals.oneLinerAddon && addonPattern.test(args.signals.oneLinerAddon)
        ? null
        : args.signals.oneLinerAddon,
  };
}

function normalizeKeyFeaturesForProjectContext(args: {
  projectType: string;
  repo: RepoAnalysis["repo"];
  pkg?: ReturnType<typeof parsePackageJson>;
  workspacePkg?: ReturnType<typeof parsePackageJson>;
  readmeText?: string | null;
  keyFeatures: string[];
}) {
  if (
    args.projectType !== "라이브러리 또는 SDK" &&
    args.projectType !== "컴포넌트 라이브러리 또는 디자인 시스템" &&
    args.projectType !== "학습용 예제 저장소"
  ) {
    return args.keyFeatures;
  }

  const selfBrandedNames = selfBrandedLibraryNames(args);
  if (selfBrandedNames.length === 0) {
    if (
      args.projectType === "라이브러리 또는 SDK" ||
      args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템"
    ) {
      return args.keyFeatures.filter((feature) => feature !== "외부 서비스 연동");
    }

    return args.keyFeatures;
  }

  const suppressGenericDb = selfBrandedNames.some((name) => SELF_BRANDED_DB_NAMES.has(name));
  const suppressGenericExternal =
    args.projectType === "라이브러리 또는 SDK" ||
    args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템" ||
    selfBrandedNames.some((name) => SELF_BRANDED_EXTERNAL_NAMES.has(name));

  return args.keyFeatures.filter((feature) => {
    if (feature === "데이터 저장/조회" && suppressGenericDb) {
      return false;
    }

    if (feature === "외부 서비스 연동" && suppressGenericExternal) {
      return false;
    }

    return true;
  });
}
const REPRESENTATIVE_TOOLING_SCRIPT_PATTERN =
  /(^|\/)(scripts\/harness\/.+\.(py|ts|tsx|js|jsx|mjs|cjs)|\.(codex|claude)\/hooks\/.+\.(py|ts|tsx|js|jsx|mjs|cjs))$/i;
const REPRESENTATIVE_TEMPLATE_PATTERN =
  /(^|\/)templates\/.+\.(md|mdx|json|ya?ml|py|ts|tsx|js|jsx|mjs|cjs)$/i;
const REPRESENTATIVE_CONFIG_PATTERN =
  /(^|\/)(package\.json|tsconfig\.json|next\.config\.(ts|js|mjs)|tailwind\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|eslint\.config\.(js|mjs)|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json|firebase\.json|prisma\/schema\.prisma)$/i;
const REPRESENTATIVE_LIBRARY_ENTRY_PATTERN =
  /(^|\/)(src\/index\.(ts|tsx|js|jsx|mjs|cjs)|src\/main\.(ts|tsx|js|jsx|mjs|cjs)|index\.(ts|tsx|js|jsx|mjs|cjs)|main\.(ts|tsx|js|jsx|mjs|cjs))$/;
const ENVIRONMENT_SUPPORT_FILE_NAMES = [
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
  ".env.defaults",
  ".env.local.example",
  ".env.development.example",
  ".env.production.example",
  ".nvmrc",
  ".node-version",
  ".python-version",
  "pyproject.toml",
  "Pipfile",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "environment.yml",
  "environment.yaml",
  "go.mod",
  "Cargo.toml",
  "rust-toolchain.toml",
  "rust-toolchain",
  "deno.json",
  "deno.jsonc",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "docker-compose.override.yml",
  "docker-compose.override.yaml",
  "compose.yml",
  "compose.yaml",
  "compose.override.yml",
  "compose.override.yaml",
  "vercel.json",
  "render.yaml",
  "render.yml",
  "fly.toml",
  "railway.json",
  "netlify.toml",
] as const;
const OWNER_ENRICHMENT_REPO_LIMIT_AUTHENTICATED = 8;
const OWNER_ENRICHMENT_REPO_LIMIT_UNAUTHENTICATED = 3;

type TreeFileEntry = {
  path: string;
  size?: number;
};

function blobEntriesFromTree(tree: Awaited<ReturnType<typeof fetchRecursiveTree>>): TreeFileEntry[] {
  return tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({ path: entry.path, size: entry.size }));
}

function countDirectories(paths: string[]) {
  const directories = new Set<string>();

  for (const path of paths) {
    const parts = path.split("/");
    parts.pop();

    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      directories.add(current);
    }
  }

  return directories.size;
}

function findRootReadmePath(paths: string[]) {
  return paths.find((path) => /^README\.(md|mdx)$/i.test(path)) ?? null;
}

function findReadmePathForRoot(paths: string[], root: string | null) {
  if (!root) {
    return null;
  }

  return (
    paths.find((path) => path === `${root}/README.md` || path === `${root}/README.mdx`) ?? null
  );
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function collectEnvironmentSupportPaths(paths: string[], focusRoot: string | null) {
  const directCandidates = new Set<string>();
  const nestedCandidates: string[] = [];

  const scorePath = (path: string) => {
    let score = 0;
    if (!path.includes("/")) score += 90;
    if (focusRoot && path.startsWith(`${focusRoot}/`)) score += 70;
    if (/^docker\//i.test(path)) score += 55;
    if (/^(deploy|infra|ops|containers?)\//i.test(path)) score += 35;
    if (/compose/i.test(path)) score += 14;
    if (/^\.github\//i.test(path)) score -= 20;
    if (/^\.devcontainer\//i.test(path)) score -= 28;
    score -= path.length / 10;
    return score;
  };

  ENVIRONMENT_SUPPORT_FILE_NAMES.forEach((name) => {
    if (paths.includes(name)) {
      directCandidates.add(name);
    }

    if (focusRoot) {
      const scopedPath = `${focusRoot}/${name}`;
      if (paths.includes(scopedPath)) {
        directCandidates.add(scopedPath);
      }
    }

    nestedCandidates.push(
      ...paths.filter((path) => path.endsWith(`/${name}`) && !directCandidates.has(path))
    );
  });

  const rankedNested = unique(nestedCandidates)
    .sort((left, right) => scorePath(right) - scorePath(left) || left.localeCompare(right))
    .slice(0, 8);

  return [...directCandidates, ...rankedNested].sort((left, right) => left.localeCompare(right));
}

function toEvidenceDetails(
  evidence: string[],
  source: AnalysisEvidence["source"] = "heuristic",
  kind: AnalysisEvidence["kind"] = "fact"
): AnalysisEvidence[] {
  return evidence.map((item, index) => ({
    label: `evidence_${index + 1}`,
    detail: item,
    source,
    kind,
  }));
}

function detectAnalysisMode(args: {
  sourceFileCount: number;
  filteredFileCount: number;
  truncated: boolean;
}): AnalysisMode {
  if (
    args.truncated ||
    args.sourceFileCount > ANALYSIS_LIMITS.maxSourceFilesBeforeLimited ||
    args.filteredFileCount > ANALYSIS_LIMITS.maxFilteredFilesBeforeLimited
  ) {
    return "limited";
  }

  return "full";
}

function pickLimitedPaths(paths: string[], focusRoot: string | null) {
  function scorePath(path: string) {
    let score = 0;
    const insideFocusRoot = Boolean(focusRoot && path.startsWith(`${focusRoot}/`));

    if (path === "package.json") score += 300;
    if (/^README\.(md|mdx)$/i.test(path)) score += 260;
    if (ROOT_SIGNAL_PATTERN.test(path)) score += 220;
    if (path.endsWith("/package.json")) score += 180;
    if (insideFocusRoot) score += 160;
    if (HIGH_PRIORITY_FLOW_PATTERN.test(path)) score += 150;
    if (LIBRARY_PRIORITY_PATTERN.test(path)) score += 120;
    if (LIMITED_DB_PRIORITY_PATTERN.test(path)) score += 110;
    if (LIMITED_EXTERNAL_PRIORITY_PATTERN.test(path)) score += 90;
    if (path.startsWith("packages/")) score += 60;
    if (path.startsWith("apps/")) score += 50;
    if (path.split("/").length <= 2) score += 24;
    if (LOW_SIGNAL_LIMITED_PATTERN.test(path) && !insideFocusRoot) score -= 180;
    if (/packages\/generated\//i.test(path)) score -= 120;
    if (LOW_VALUE_LIBRARY_BUILD_PATTERN.test(path)) score -= 160;

    return score;
  }

  const globalPaths = unique(
    paths.filter((path) => ROOT_SIGNAL_PATTERN.test(path)).slice(0, ANALYSIS_LIMITS.maxGlobalConfigFilesInLimitedMode)
  );
  const focusPaths = focusRoot
    ? paths
        .filter((path) => path.startsWith(`${focusRoot}/`))
        .sort((a, b) => {
          return scorePath(b) - scorePath(a) || a.length - b.length || a.localeCompare(b);
        })
        .filter((path) => scorePath(path) > 0)
        .slice(0, ANALYSIS_LIMITS.maxFocusRootFilesInLimitedMode)
    : [];
  const readmes = unique([
    ...paths.filter((path) => /^README\.(md|mdx)$/i.test(path)),
    ...(focusRoot
      ? paths.filter((path) => path === `${focusRoot}/README.md` || path === `${focusRoot}/README.mdx`)
      : []),
  ]).slice(0, ANALYSIS_LIMITS.maxReadmeFilesInLimitedMode);
  const manifests = paths
    .filter((path) => /(^|\/)(package\.json|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json)$/i.test(path))
    .slice(0, ANALYSIS_LIMITS.maxManifestFilesInLimitedMode);
  const priorityFlows = [...paths]
    .sort((a, b) => scorePath(b) - scorePath(a) || a.length - b.length || a.localeCompare(b))
    .filter((path) => scorePath(path) > 0)
    .slice(0, ANALYSIS_LIMITS.maxPrunedFilesInLimitedMode);

  return unique([...globalPaths, ...readmes, ...manifests, ...focusPaths, ...priorityFlows]).slice(
    0,
    ANALYSIS_LIMITS.maxPrunedFilesInLimitedMode
  );
}

function representativeContentBudget(analysisMode: AnalysisMode) {
  return analysisMode === "limited"
    ? ANALYSIS_LIMITS.maxRepresentativeContentFilesInLimitedMode
    : ANALYSIS_LIMITS.maxRepresentativeContentFilesInFullMode;
}

function scoreRepresentativeContentPath(path: string, focusRoot: string | null) {
  let score = 0;
  const insideFocusRoot = Boolean(focusRoot && path.startsWith(`${focusRoot}/`));

  if (path === "package.json") score += 420;
  if (/^README\.(md|mdx)$/i.test(path)) score += 380;
  if (focusRoot && (path === `${focusRoot}/package.json` || path === `${focusRoot}/README.md` || path === `${focusRoot}/README.mdx`)) {
    score += 340;
  }
  if (REPRESENTATIVE_CONFIG_PATTERN.test(path)) score += 220;
  if (HIGH_PRIORITY_FLOW_PATTERN.test(path)) score += 190;
  if (REPRESENTATIVE_OPERATION_DOC_PATTERN.test(path)) score += 180;
  if (REPRESENTATIVE_TOOLING_SCRIPT_PATTERN.test(path)) score += 170;
  if (REPRESENTATIVE_LOGIC_PATTERN.test(path)) score += 140;
  if (REPRESENTATIVE_LIBRARY_ENTRY_PATTERN.test(path)) score += 130;
  if (LIMITED_DB_PRIORITY_PATTERN.test(path)) score += 120;
  if (LIMITED_EXTERNAL_PRIORITY_PATTERN.test(path)) score += 110;
  if (REPRESENTATIVE_TEMPLATE_PATTERN.test(path)) score += 100;
  if (insideFocusRoot) score += 180;
  if (path.split("/").length <= 2) score += 24;
  if (LOW_SIGNAL_LIMITED_PATTERN.test(path) && !insideFocusRoot) score -= 180;
  if (/packages\/generated\//i.test(path)) score -= 140;
  if (LOW_VALUE_LIBRARY_BUILD_PATTERN.test(path)) score -= 180;

  return score;
}

export function pickRepresentativeContentPaths(args: {
  paths: string[];
  focusRoot: string | null;
  analysisMode: AnalysisMode;
  fileSizes?: Map<string, number | undefined>;
  seededPaths?: string[];
}) {
  const maxFiles = representativeContentBudget(args.analysisMode);
  const allowedPaths = args.paths.filter((path) => {
    const size = args.fileSizes?.get(path);
    return size === undefined || size <= ANALYSIS_LIMITS.maxRepresentativeContentFileBytes;
  });
  const score = (path: string) => scoreRepresentativeContentPath(path, args.focusRoot);
  const sortByPriority = (left: string, right: string) =>
    score(right) - score(left) || left.length - right.length || left.localeCompare(right);
  const seededPaths = (args.seededPaths ?? []).filter((path) => allowedPaths.includes(path));
  const rootReadme = findRootReadmePath(allowedPaths);
  const focusReadme = findReadmePathForRoot(allowedPaths, args.focusRoot);
  const focusPackageJson =
    args.focusRoot && allowedPaths.includes(`${args.focusRoot}/package.json`)
      ? `${args.focusRoot}/package.json`
      : null;
  const rootConfigs = allowedPaths
    .filter((path) => REPRESENTATIVE_CONFIG_PATTERN.test(path))
    .sort(sortByPriority)
    .slice(0, ANALYSIS_LIMITS.maxRepresentativeRootConfigFiles);
  const focusPriority = args.focusRoot
    ? allowedPaths
        .filter((path) => path.startsWith(`${args.focusRoot}/`))
        .sort(sortByPriority)
        .filter((path) => score(path) > 0)
        .slice(0, ANALYSIS_LIMITS.maxRepresentativeFocusFiles)
    : [];
  const globalPriority = [...allowedPaths]
    .sort(sortByPriority)
    .filter((path) => {
      if (score(path) <= 0) {
        return false;
      }

      if (
        args.focusRoot &&
        LOW_SIGNAL_LIMITED_PATTERN.test(path) &&
        !path.startsWith(`${args.focusRoot}/`) &&
        !REPRESENTATIVE_CONFIG_PATTERN.test(path) &&
        !/^README\.(md|mdx)$/i.test(path)
      ) {
        return false;
      }

      return true;
    })
    .slice(0, maxFiles);

  return unique([
    ...seededPaths,
    "package.json",
    ...(rootReadme ? [rootReadme] : []),
    ...(focusPackageJson ? [focusPackageJson] : []),
    ...(focusReadme ? [focusReadme] : []),
    ...rootConfigs,
    ...focusPriority,
    ...globalPriority,
  ])
    .filter((path) => allowedPaths.includes(path))
    .slice(0, maxFiles);
}

async function fetchRepresentativeFileContents(args: {
  owner: string;
  repo: string;
  ref: string;
  paths: string[];
  focusRoot: string | null;
  analysisMode: AnalysisMode;
  fileSizes?: Map<string, number | undefined>;
  seededContents?: Record<string, string>;
  seededPaths?: string[];
}) {
  const selectedPaths = pickRepresentativeContentPaths({
    paths: args.paths,
    focusRoot: args.focusRoot,
    analysisMode: args.analysisMode,
    fileSizes: args.fileSizes,
    seededPaths: [...Object.keys(args.seededContents ?? {}), ...(args.seededPaths ?? [])],
  });
  const contents = new Map<string, string>(Object.entries(args.seededContents ?? {}));
  const fetchTargets = selectedPaths.filter((path) => !contents.has(path));
  const settled = await Promise.allSettled(
    fetchTargets.map(async (path) => {
      const text = await fetchTextFile(args.owner, args.repo, path, args.ref);
      return { path, text };
    })
  );

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return;
    }

    if (typeof result.value.text === "string") {
      contents.set(fetchTargets[index] ?? result.value.path, result.value.text);
    }
  });

  return {
    representativePaths: selectedPaths,
    selectedFileContents: Object.fromEntries(contents),
  };
}

function preferredReadmeStart(keyFiles: RepoAnalysis["keyFiles"]) {
  return keyFiles.find((file) => /(^|\/)README\.(md|mdx)$/i.test(file.path));
}

function preferredLayerStart(
  keyFiles: RepoAnalysis["keyFiles"],
  layerName: "UI" | "API"
) {
  return keyFiles.find(
    (file) =>
      file.relatedLayers.includes(layerName) &&
      !/(^|\/)README\.(md|mdx)$/i.test(file.path) &&
      !/(^|\/)package\.json$/i.test(file.path)
  );
}

function preferredStartKeyFile(keyFiles: RepoAnalysis["keyFiles"], projectType: string) {
  if (
    projectType === "학습용 예제 저장소" ||
    projectType === "라이브러리 또는 SDK" ||
    projectType === "컴포넌트 라이브러리 또는 디자인 시스템" ||
    projectType === "라이브러리 또는 개발 도구"
  ) {
    return preferredReadmeStart(keyFiles) ?? keyFiles[0];
  }

  if (
    projectType === "풀스택 웹앱" ||
    projectType === "프론트엔드 웹앱" ||
    projectType === "모노레포 웹 플랫폼"
  ) {
    return (
      preferredLayerStart(keyFiles, "UI") ??
      preferredReadmeStart(keyFiles) ??
      keyFiles[0]
    );
  }

  if (projectType === "백엔드 API 서비스" || projectType === "API 서버") {
    return (
      preferredLayerStart(keyFiles, "API") ??
      preferredReadmeStart(keyFiles) ??
      keyFiles[0]
    );
  }

  return keyFiles[0];
}

function recommendedStartFile(keyFiles: RepoAnalysis["keyFiles"], projectType: string) {
  return preferredStartKeyFile(keyFiles, projectType)?.path;
}

function recommendedStartReason(keyFiles: RepoAnalysis["keyFiles"], projectType: string) {
  return preferredStartKeyFile(keyFiles, projectType)?.whyImportant;
}

function buildLimitations(args: {
  analysisMode: AnalysisMode;
  truncated: boolean;
  sourceFileCount: number;
  filteredFileCount: number;
  analyzedFileCount: number;
  focusRoot: string | null;
}): AnalysisNotice[] {
  const notices: AnalysisNotice[] = [];

  if (args.analysisMode === "limited") {
    notices.push({
      code: "LIMITED_ANALYSIS_MODE",
      message:
        "대형 레포 또는 축약된 트리로 인해 전체 파일 대신 핵심 코드/설정 파일만 우선 분석했습니다.",
      details: {
        sourceFileCount: args.sourceFileCount,
        filteredFileCount: args.filteredFileCount,
        analyzedFileCount: args.analyzedFileCount,
        focusRoot: args.focusRoot,
      },
    });
  }

  if (args.truncated) {
    notices.push({
      code: "TREE_TRUNCATED",
      message: "GitHub tree 응답이 축약되어 대표 경로 중심의 제한 분석으로 전환했습니다.",
      details: {
        sourceFileCount: args.sourceFileCount,
      },
    });
  }

  return notices;
}

function buildWarnings(args: {
  stack: string[];
  packageJsonText?: string | null;
  packageJsonParsed: ReturnType<typeof parsePackageJson>;
  projectType: string;
  layerCoverage: ReturnType<typeof summarizeLayerCoverage>;
  unclassifiedSemanticSummary: ReturnType<typeof summarizeUnclassifiedCodeSemantics>;
}): AnalysisNotice[] {
  const notices: AnalysisNotice[] = [];
  const supported = args.stack.some((item) =>
    SUPPORTED_STACK_MARKERS.includes(item as (typeof SUPPORTED_STACK_MARKERS)[number])
  );
  const benignLayerGapOnly =
    args.layerCoverage.uncoveredReasons.length > 0 &&
    args.layerCoverage.uncoveredReasons.every((item) => BENIGN_LAYER_GAP_REASON_KEYS.has(item.key));
  const shouldSuppressLayerGapWarning =
    benignLayerGapOnly &&
    args.layerCoverage.uncoveredPaths.length >= 2 &&
    (args.projectType === "라이브러리 또는 SDK" ||
      args.projectType === "컴포넌트 라이브러리 또는 디자인 시스템" ||
      (args.unclassifiedSemanticSummary.groups.length === 0 &&
        args.layerCoverage.classifiedPaths.length >= 24 &&
        args.layerCoverage.classifiedPaths.length > args.layerCoverage.uncoveredPaths.length) ||
      (args.layerCoverage.uncoveredPaths.length <= 5 &&
        args.unclassifiedSemanticSummary.groups.length === 0));

  if (!supported) {
    notices.push({
      code: "SUPPORTED_STACK_GAP",
      message: "이 레포는 MVP 우선 지원 스택 바깥에 있어 일부 설명 정확도가 낮을 수 있습니다.",
      details: {
        stack: args.stack.join(", "),
        projectType: args.projectType,
      },
    });
  }

  if (args.packageJsonText && !args.packageJsonParsed) {
    notices.push({
      code: "PACKAGE_JSON_PARSE_SKIPPED",
      message: "package.json 내용을 완전히 파싱하지 못해 일부 스택 추론이 약해질 수 있습니다.",
    });
  }

  if (args.layerCoverage.uncoveredPaths.length > 0 && !shouldSuppressLayerGapWarning) {
    notices.push({
      code: "LAYER_CLASSIFICATION_GAP",
      message:
        "일부 코드 파일은 UI/API/DB 같은 의미 레이어로 자동 분류되지 않아 Code 범위로 묶일 수 있습니다.",
      details: {
        uncoveredCodeFileCount: args.layerCoverage.uncoveredPaths.length,
        samplePaths: args.layerCoverage.uncoveredPaths.slice(0, 3).join(", "),
        reasonSummary: args.layerCoverage.uncoveredReasons
          .slice(0, 3)
          .map((item) => `${item.label} ${item.count}개`)
          .join(", "),
        semanticSummary: args.unclassifiedSemanticSummary.groups
          .slice(0, 3)
          .map((item) => `${item.label} ${item.count}개`)
          .join(", "),
      },
    });
  }

  return notices;
}

function buildCoverageStatus(args: {
  analysisMode: AnalysisMode;
  stack: string[];
  layerCoverage: ReturnType<typeof summarizeLayerCoverage>;
  unclassifiedSemanticSummary: ReturnType<typeof summarizeUnclassifiedCodeSemantics>;
  warnings: AnalysisNotice[];
  limitations: AnalysisNotice[];
  focusRoot: string | null;
}): RepoAnalysis["coverage"] {
  const supportedStackDetected = args.stack.some((item) =>
    SUPPORTED_STACK_MARKERS.includes(item as (typeof SUPPORTED_STACK_MARKERS)[number])
  );
  const unclassifiedReasonSummary = args.layerCoverage.uncoveredReasons
    .slice(0, 4)
    .map((item) => `${item.label} ${item.count}개`)
    .join(", ");
  const unclassifiedSemanticSummary = args.unclassifiedSemanticSummary.groups
    .slice(0, 4)
    .map((item) => `${item.label} ${item.count}개`)
    .join(", ");
  const unclassifiedContentCoverage =
    args.layerCoverage.uncoveredPaths.length > 0
      ? `${args.unclassifiedSemanticSummary.inspectedPathCount}/${args.unclassifiedSemanticSummary.totalPathCount}`
      : null;
  const supportGapMessage = supportedStackDetected
    ? null
    : "이 레포는 MVP 우선 지원 스택 바깥에 있어 일부 설명 정확도가 낮을 수 있습니다.";
  const hasUnclassifiedCode = args.layerCoverage.uncoveredPaths.length > 0;
  const benignUnclassifiedOnly =
    args.layerCoverage.uncoveredReasons.length > 0 &&
    args.layerCoverage.uncoveredReasons.every((item) => BENIGN_LAYER_GAP_REASON_KEYS.has(item.key));
  const level =
    args.analysisMode === "limited" ? "limited" : hasUnclassifiedCode ? "partial" : "ok";
  const chipLabel = level === "limited" ? "제한 분석" : level === "partial" ? "부분 분석" : null;
  const summary =
    level === "limited"
      ? "전체 파일 대신 대표 경로 중심으로 분석했습니다."
      : level === "partial"
        ? benignUnclassifiedOnly
          ? `보조 코드 ${args.layerCoverage.uncoveredPaths.length}개는 아직 Code 범위로 남아 있습니다.`
          : `코드 ${args.layerCoverage.uncoveredPaths.length}개는 아직 의미 레이어로 자동 분류되지 않았습니다.`
        : "대표 범위의 코드 구조를 의미 레이어 기준으로 정리했습니다.";
  const details = [
    ...(level === "limited" ? ["대형 레포 또는 축약된 트리라서 핵심 경로만 먼저 분석했습니다."] : []),
    ...(hasUnclassifiedCode
      ? [
          `${
            benignUnclassifiedOnly ? "Code 범위로 남은 보조 코드" : "자동 분류되지 않은 코드"
          } ${args.layerCoverage.uncoveredPaths.length}개: ${args.layerCoverage.uncoveredPaths.slice(0, 3).join(", ")}`
        ]
      : []),
    ...(unclassifiedReasonSummary ? [`주된 미분류 유형: ${unclassifiedReasonSummary}`] : []),
    ...(unclassifiedSemanticSummary
      ? [
          `대표 본문 신호: ${unclassifiedSemanticSummary}${
            unclassifiedContentCoverage ? ` (대표 본문 ${unclassifiedContentCoverage})` : ""
          }`,
        ]
      : []),
    ...(supportGapMessage ? [supportGapMessage] : []),
  ];
  const compactReasonByCode: Partial<Record<string, string>> = {
    LIMITED_ANALYSIS_MODE: "대형 저장소라 핵심 경로를 먼저 분석했습니다.",
    TREE_TRUNCATED: "GitHub 트리 응답이 축약돼 일부 파일은 범위 밖일 수 있습니다.",
    SUPPORTED_STACK_GAP: "우선 지원 스택 밖이라 일부 의미 해석 정확도가 낮을 수 있습니다.",
    PACKAGE_JSON_PARSE_SKIPPED: "package.json 일부를 읽지 못해 스택 추론이 약해질 수 있습니다.",
    LAYER_CLASSIFICATION_GAP: "일부 코드는 아직 의미 레이어로 자동 분류되지 않았습니다.",
  };
  const reasonPriorityByCode: Partial<Record<AnalysisNotice["code"], number>> = {
    LIMITED_ANALYSIS_MODE: 100,
    SUPPORTED_STACK_GAP: 90,
    LAYER_CLASSIFICATION_GAP: 80,
    TREE_TRUNCATED: 40,
    PACKAGE_JSON_PARSE_SKIPPED: 30,
  };
  const noticesForReasons = [...args.limitations, ...args.warnings];
  const hasLimitedModeReason = noticesForReasons.some((item) => item.code === "LIMITED_ANALYSIS_MODE");
  const reasons = noticesForReasons
    .filter((item) => !(hasLimitedModeReason && item.code === "TREE_TRUNCATED"))
    .map((item, index) => ({
      text: (compactReasonByCode[item.code] ?? item.message).replace(/\.$/, "").trim(),
      priority: reasonPriorityByCode[item.code] ?? 0,
      index,
    }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .reduce<string[]>((acc, item) => {
      if (!acc.includes(item.text)) {
        acc.push(item.text);
      }
      return acc;
    }, [])
    .slice(0, 3);
  const omissions: string[] = [];

  if (args.analysisMode === "limited") {
    omissions.push(
      args.focusRoot
        ? "대표 범위 밖 workspace와 세부 파일"
        : "대표 경로 밖의 일부 파일"
    );
  }

  if (args.layerCoverage.uncoveredReasons.length > 0) {
    omissions.push(
      ...args.layerCoverage.uncoveredReasons
        .slice(0, 2)
        .map((item) =>
          item.label === "기타 공용 코드"
            ? "자동 분류되지 않은 일부 공용 코드"
            : `${item.label} 일부`
        )
    );
  }

  if (!supportedStackDetected) {
    omissions.push("지원 스택 바깥 영역의 일부 의미 설명");
  }

  const basedOn = unique(
    [
      ...(args.focusRoot ? ["대표 범위"] : []),
      ...(args.analysisMode === "limited" ? ["대표 경로"] : []),
      ...(args.limitations.some((item) => item.code === "TREE_TRUNCATED") ? ["축약된 GitHub 트리"] : []),
      ...(args.layerCoverage.uncoveredPaths.length > 0 ? ["미분류 코드 샘플"] : []),
      ...(!supportedStackDetected ? ["지원 스택 힌트"] : []),
    ].filter(Boolean)
  );
  const detail =
    level === "limited"
      ? args.focusRoot
        ? "선택된 대표 범위를 우선 분석해 바깥 workspace나 일부 세부 파일은 빠질 수 있습니다."
        : "전체 파일 대신 대표 경로를 우선 분석해 일부 세부 파일은 빠질 수 있습니다."
      : level === "partial"
        ? args.layerCoverage.uncoveredReasons.length > 0
          ? "핵심 구조는 정리됐지만 일부 보조 코드나 공용 코드는 Code 범위로 남아 있을 수 있습니다."
          : "핵심 구조는 정리됐지만 일부 파일 해석은 약할 수 있습니다."
        : !supportedStackDetected
          ? "구조 자체는 정리했지만, 우선 지원 스택 밖 영역은 일부 설명 정확도가 낮을 수 있습니다."
          : null;
  const headline =
    level === "limited"
      ? "대표 경로 기준으로 구조를 정리했습니다."
      : level === "partial"
        ? "핵심 구조는 정리했고, 일부 코드는 보조 범위로 남았습니다."
        : "표시 범위의 구조를 사실 기반으로 정리했습니다.";
  const trustSummary: RepoAnalysis["coverage"]["trustSummary"] = {
    level,
    headline,
    detail,
    reasons,
    omissions: unique(omissions).slice(0, 3),
    basedOn,
    approximate: args.analysisMode === "limited" || !supportedStackDetected,
  };

  return {
    level,
    chipLabel,
    summary,
    details,
    trustSummary,
    supportedStackDetected,
    supportGapMessage,
    codeLikeFileCount: args.layerCoverage.codeLikePaths.length,
    classifiedCodeFileCount: args.layerCoverage.classifiedPaths.length,
    unclassifiedCodeFileCount: args.layerCoverage.uncoveredPaths.length,
    unclassifiedCodeSamples: args.layerCoverage.uncoveredPaths.slice(0, 8),
    unclassifiedReasonSummary: unclassifiedReasonSummary || null,
    unclassifiedReasonGroups: args.layerCoverage.uncoveredReasons,
    unclassifiedSemanticSummary: unclassifiedSemanticSummary || null,
    unclassifiedSemanticGroups: args.unclassifiedSemanticSummary.groups,
    unclassifiedContentCoverage,
  };
}

function buildFacts(
  analysis: Omit<RepoAnalysis, "facts" | "inferences">,
  semanticSignals: SemanticSignals,
  layerCoverage: ReturnType<typeof summarizeLayerCoverage>,
  unclassifiedSemanticSummary: ReturnType<typeof summarizeUnclassifiedCodeSemantics>
): AnalysisFact[] {
  const unclassifiedPreview = layerCoverage.uncoveredPaths.slice(0, 8);
  const unclassifiedReasonSummary = layerCoverage.uncoveredReasons
    .slice(0, 4)
    .map((item) => `${item.label} ${item.count}개`)
    .join(", ");
  const unclassifiedSemanticHintSummary = unclassifiedSemanticSummary.groups
    .slice(0, 4)
    .map((item) => `${item.label} ${item.count}개`)
    .join(", ");
  const facts: AnalysisFact[] = [
    {
      id: "repo",
      label: "Repository",
      value: `${analysis.repo.owner}/${analysis.repo.name}`,
      source: "repo",
    },
    {
      id: "branch",
      label: "Default Branch",
      value: analysis.repo.branch,
      source: "repo",
    },
    {
      id: "sha",
      label: "Pinned Commit",
      value: analysis.repo.sha,
      source: "repo",
    },
    {
      id: "analysis_mode",
      label: "Analysis Mode",
      value: ANALYSIS_MODE_LABEL[analysis.analysisMode],
      source: "heuristic",
    },
    {
      id: "code_like_files",
      label: "Code-like Files",
      value: String(layerCoverage.codeLikePaths.length),
      source: "heuristic",
    },
    {
      id: "classified_code_files",
      label: "Layer-classified Code Files",
      value: String(layerCoverage.classifiedPaths.length),
      source: "heuristic",
    },
    {
      id: "unclassified_code_files",
      label: "Unclassified Code Files",
      value: String(layerCoverage.uncoveredPaths.length),
      source: "heuristic",
    },
    {
      id: "unclassified_code_samples",
      label: "Unclassified Code Samples",
      value: layerCoverage.uncoveredPaths.slice(0, 4).join(", "),
      source: "heuristic",
    },
    {
      id: "unclassified_code_preview",
      label: "Unclassified Code Preview",
      value: unclassifiedPreview.join(", "),
      source: "heuristic",
    },
    {
      id: "unclassified_code_reasons",
      label: "Unclassified Code Reasons",
      value: unclassifiedReasonSummary,
      source: "heuristic",
    },
    {
      id: "unclassified_code_semantic_hints",
      label: "Unclassified Code Semantic Hints",
      value: unclassifiedSemanticHintSummary,
      source: "heuristic",
    },
    {
      id: "unclassified_code_content_coverage",
      label: "Unclassified Code Content Coverage",
      value: `${unclassifiedSemanticSummary.inspectedPathCount}/${unclassifiedSemanticSummary.totalPathCount}`,
      source: "heuristic",
    },
    {
      id: "stack",
      label: "Detected Stack",
      value: analysis.summary.stack.join(", "),
      source: "package_json",
    },
    {
      id: "counts",
      label: "Routes / API",
      value: `${analysis.stats.routeCount} / ${analysis.stats.apiEndpointCount}`,
      source: "tree",
    },
  ];

  if (analysis.topology.focusRoot) {
    facts.push({
      id: "focus_root",
      label: "Focus Root",
      value: analysis.topology.focusRoot,
      source: analysis.topology.kind === "monorepo" ? "workspace" : "tree",
    });
  }

  semanticSignals.facts.forEach((fact) => {
    facts.push({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      source: "heuristic",
    });
  });

  return facts;
}

function buildInferences(
  analysis: Omit<RepoAnalysis, "facts" | "inferences">,
  semanticSignals: SemanticSignals
): AnalysisInference[] {
  const inferred: AnalysisInference[] = [
    {
      id: "project_type",
      label: "Project Type",
      conclusion: analysis.summary.projectType,
      confidence: analysis.analysisMode === "limited" ? "medium" : "high",
      evidence: toEvidenceDetails(
        [
          `스택: ${analysis.summary.stack.join(", ")}`,
          `레이어: ${analysis.layers.map((layer) => layer.name).join(", ") || "없음"}`,
        ],
        "heuristic",
        "inference"
      ),
    },
    {
      id: "reading_start",
      label: "Recommended Start",
      conclusion: analysis.summary.recommendedStartFile ?? "추천 시작 파일 없음",
      confidence: analysis.summary.recommendedStartFile ? "high" : "low",
      evidence: analysis.keyFiles[0]?.evidenceDetails ??
        toEvidenceDetails([analysis.summary.recommendedStartReason ?? "추천 근거 없음"], "heuristic", "inference"),
    },
    {
      id: "edit_strategy",
      label: "First Edit Strategy",
      conclusion: analysis.editGuides[0]?.intent ?? "추천 수정 가이드 없음",
      confidence: analysis.editGuides.length > 0 ? "medium" : "low",
      evidence:
        analysis.editGuides[0]?.evidenceDetails ??
        toEvidenceDetails([analysis.editGuides[0]?.reason ?? "수정 가이드 근거 없음"], "heuristic", "inference"),
    },
  ];

  semanticSignals.inferences.forEach((inference) => {
    inferred.push({
      id: inference.id,
      label: inference.label,
      conclusion: inference.conclusion,
      confidence: inference.confidence,
      evidence: toEvidenceDetails(inference.evidence, "heuristic", "inference"),
    });
  });

  return inferred;
}

function withStructuredEvidence(analysis: Omit<RepoAnalysis, "facts" | "inferences">) {
  return {
    ...analysis,
    layers: analysis.layers.map((layer) => ({
      ...layer,
      evidenceDetails: layer.evidenceDetails ?? toEvidenceDetails(layer.evidence, "heuristic", "fact"),
    })),
    keyFiles: analysis.keyFiles.map((file) => ({
      ...file,
      evidenceDetails: file.evidenceDetails ?? toEvidenceDetails(file.evidence, "heuristic", "fact"),
    })),
    editGuides: analysis.editGuides.map((guide) => ({
      ...guide,
      evidenceDetails: guide.evidenceDetails ?? toEvidenceDetails(guide.evidence, "heuristic", "fact"),
    })),
  };
}

export function analyzeRepositorySnapshot(snapshot: RepositorySnapshot): RepoAnalysis {
  const sourceFileCount = snapshot.sourceFileCount ?? snapshot.allPaths.length;
  const filteredPaths = filterAnalyzablePaths(snapshot.allPaths);
  const readmePath = findRootReadmePath(snapshot.allPaths);

  if (filteredPaths.length === 0) {
    throw createAnalysisError("NO_ANALYZABLE_FILES", "분석 가능한 코드 또는 설정 파일을 찾지 못했습니다.");
  }

  const packageJson = parsePackageJson(snapshot.packageJsonText ?? null);
  const draftTopology = buildTopology(filteredPaths, packageJson, {
    readmeText: snapshot.readmeText ?? null,
    repoName: snapshot.repo.name,
  });
  const analysisMode = detectAnalysisMode({
    sourceFileCount,
    filteredFileCount: filteredPaths.length,
    truncated: snapshot.truncated,
  });
  const paths =
    analysisMode === "limited"
      ? pickLimitedPaths(filteredPaths, draftTopology.focusRoot)
      : filteredPaths;

  if (paths.length === 0) {
    throw createAnalysisError("NO_ANALYZABLE_FILES", "제한 분석에 사용할 핵심 파일을 찾지 못했습니다.");
  }

  const topology = buildTopology(paths, packageJson, {
    readmeText: snapshot.readmeText ?? null,
    repoName: snapshot.repo.name,
  });
  const globalLayers = buildLayers(paths, packageJson);
  const globalStack = detectStack(paths, packageJson);
  const projectType = detectProjectType({
    paths,
    pkg: packageJson,
    layers: globalLayers,
    stack: globalStack,
    repositoryDescription: snapshot.repo.description,
    readmeText: snapshot.readmeText ?? null,
  });
  const effectiveFocusRoot = resolveEffectiveFocusRoot({
    paths,
    topology,
    projectType,
  });
  const analysisTopology =
    effectiveFocusRoot === topology.focusRoot ? topology : { ...topology, focusRoot: effectiveFocusRoot };
  const workspacePkg = parsePackageJson(
    workspacePackageJsonText(snapshot.selectedFileContents, analysisTopology.focusRoot)
  );
  const draftStack = detectSummaryStack({
    paths,
    pkg: packageJson,
    selectedFileContents: snapshot.selectedFileContents,
    focusRoot: analysisTopology.focusRoot,
    projectType,
  });
  const shouldScopeLayersToFocusRoot =
    analysisTopology.kind === "monorepo" ||
    projectType === "학습용 예제 저장소" ||
    projectType === "라이브러리 또는 SDK" ||
    projectType === "컴포넌트 라이브러리 또는 디자인 시스템";
  const layers = buildLayers(paths, packageJson, {
    focusRoot: analysisTopology.focusRoot,
    scopeToFocusRoot: shouldScopeLayersToFocusRoot,
    projectType,
  });
  const layerCoverage = summarizeLayerCoverage(paths, packageJson, {
    focusRoot: analysisTopology.focusRoot,
    scopeToFocusRoot: shouldScopeLayersToFocusRoot,
    projectType,
  });
  const semanticSignals = normalizeSemanticSignalsForProjectContext({
    projectType,
    repo: snapshot.repo,
    pkg: packageJson,
    workspacePkg,
    readmeText: snapshot.readmeText,
    signals: extractSemanticSignals({
      paths,
      selectedFileContents: snapshot.selectedFileContents,
      focusRoot: analysisTopology.focusRoot,
    }),
  });
  const unclassifiedSemanticSummary = summarizeUnclassifiedCodeSemantics({
    uncoveredPaths: layerCoverage.uncoveredPaths,
    selectedFileContents: snapshot.selectedFileContents,
    focusRoot: analysisTopology.focusRoot,
  });
  const keyFiles = applySemanticHintsToKeyFiles(
    buildKeyFiles(paths, packageJson, projectType, analysisTopology.focusRoot),
    semanticSignals,
    projectType
  );
  const editGuides = applySemanticHintsToEditGuides(
    buildEditGuides(paths, packageJson, projectType, analysisTopology.focusRoot),
    semanticSignals
  );
  const stack = refineDisplayStack({
    projectType,
    stack: draftStack,
    paths,
    focusRoot: analysisTopology.focusRoot,
    keyFiles,
    pkg: packageJson,
    selectedFileContents: snapshot.selectedFileContents,
    semanticSignals,
  });
  const featureSignalPaths = displayStackPaths(paths, analysisTopology.focusRoot, projectType);
  const difficulty = estimateDifficulty(paths.length, stack.length, globalLayers, snapshot.truncated);
  const keyFeatures = normalizeKeyFeaturesForProjectContext({
    projectType,
    repo: snapshot.repo,
    pkg: packageJson,
    workspacePkg,
    readmeText: snapshot.readmeText,
    keyFeatures: mergeSemanticKeyFeatures(
      buildKeyFeatures(paths, stack, globalLayers, packageJson, projectType, {
        signalPaths: featureSignalPaths,
      }),
      semanticSignals
    ),
  });
  const counts = collectCounts(paths, packageJson);
  const learningGuide = buildLearningGuide({
    analysisMode,
    repo: snapshot.repo,
    allPaths: snapshot.allPaths,
    paths,
    pkg: packageJson,
    projectType,
    stack,
    keyFeatures,
    keyFiles,
    recommendedStartFile: recommendedStartFile(keyFiles, projectType),
    recommendedStartReason: recommendedStartReason(keyFiles, projectType),
    semanticSignals,
    focusRoot: analysisTopology.focusRoot,
    readmePath,
    readmeText: snapshot.readmeText,
    selectedFileContents: snapshot.selectedFileContents,
  });
  const limitations = buildLimitations({
    analysisMode,
    truncated: snapshot.truncated,
    sourceFileCount,
    filteredFileCount: filteredPaths.length,
    analyzedFileCount: paths.length,
    focusRoot: analysisTopology.focusRoot,
  });
  const warnings = buildWarnings({
    stack,
    packageJsonText: snapshot.packageJsonText,
    packageJsonParsed: packageJson,
    projectType,
    layerCoverage,
    unclassifiedSemanticSummary,
  });
  const coverage = buildCoverageStatus({
    analysisMode,
    stack,
    layerCoverage,
    unclassifiedSemanticSummary,
    warnings,
    limitations,
    focusRoot: analysisTopology.focusRoot,
  });
  const baseAnalysis = withStructuredEvidence({
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    kind: "repo",
    analysisMode,
    repo: snapshot.repo,
    stats: {
      sourceFileCount,
      filteredFileCount: filteredPaths.length,
      fileCount: paths.length,
      directoryCount: countDirectories(paths),
      truncated: snapshot.truncated,
      routeCount: counts.routeCount,
      apiEndpointCount: counts.apiEndpointCount,
    },
    summary: {
      oneLiner: buildOneLiner({
        description: snapshot.repo.description ?? packageJson?.description ?? null,
        projectType,
        stack,
        routeCount: counts.routeCount,
        apiCount: counts.apiEndpointCount,
        truncated: analysisMode === "limited",
        semanticAddon: semanticSignals.oneLinerAddon,
        plainTitle: learningGuide.identity.plainTitle,
        identitySubtitle: learningGuide.identity.header.subtitle,
      }),
      projectType,
      stack,
      difficulty,
      keyFeatures,
      recommendedStartFile: recommendedStartFile(keyFiles, projectType),
      recommendedStartReason: recommendedStartReason(keyFiles, projectType),
      analysisScopeLabel:
        analysisMode === "limited"
          ? `${ANALYSIS_MODE_LABEL[analysisMode]} · 핵심 코드/설정 파일 ${paths.length}개 기준`
          : `코드/설정 파일 ${paths.length}개 기준 분석`,
    },
    topology: analysisTopology,
    limitations,
    warnings,
    layers,
    keyFiles,
    editGuides,
    learning: learningGuide,
    coverage,
  });

  return {
    ...baseAnalysis,
    facts: buildFacts(baseAnalysis, semanticSignals, layerCoverage, unclassifiedSemanticSummary),
    inferences: buildInferences(baseAnalysis, semanticSignals),
  };
}

export async function analyzePublicRepositoryWithMeta(
  repoUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<AnalysisWithMeta<RepoAnalysis>> {
  const ref = parseGitHubRepoUrl(repoUrl);
  const forceRefresh = options?.forceRefresh === true;
  const repoInflightKey = `repo-url:${ref.url}`;
  const logger = createAnalysisLogger({
    scope: "analyze",
    repoUrl: ref.url,
    runId: `${ref.owner}/${ref.repo}`,
  });

  logger.info("analysis:start", { repoUrl: ref.url });
  let deliverySource: "fresh" | "server-cache" | "shared-inflight" = "fresh";
  let deliveryScope: "repo-url" | "repo-sha" = "repo-sha";

  const repoInFlight = forceRefresh ? null : getInFlightAnalysis(repoInflightKey);

  if (repoInFlight) {
    logger.info("analysis:repo-inflight-hit", { repoInflightKey });
    return {
      analysis: await (repoInFlight as Promise<RepoAnalysis>),
      meta: buildAnalyzeTargetMeta({
        source: "shared-inflight",
        scope: "repo-url",
        forceRefresh,
      }),
    };
  }

  const promise = (async (): Promise<RepoAnalysis> => {
    const repository = await logger.time("github.fetchRepository", () =>
      fetchRepository(ref.owner, ref.repo)
    );
    const branch = await logger.time("github.fetchBranch", () =>
      fetchBranch(ref.owner, ref.repo, repository.default_branch)
    );
    const cacheKey = buildShaCacheKey(repository.owner.login, repository.name, branch.commit.sha);
    const cached = forceRefresh ? null : getCachedAnalysis(cacheKey);

    if (cached?.kind === "repo") {
      logger.info("analysis:cache-hit", { cacheKey });
      deliverySource = "server-cache";
      deliveryScope = "repo-sha";
      return cached;
    }

    const inFlight = forceRefresh ? null : getInFlightAnalysis(cacheKey);

    if (inFlight) {
      logger.info("analysis:inflight-hit", { cacheKey });
      deliverySource = "shared-inflight";
      deliveryScope = "repo-sha";
      return inFlight as Promise<RepoAnalysis>;
    }

    const buildPromise = logger.time("analysis.build", async () => {
      const tree = await logger.time("github.fetchRecursiveTree", () =>
        fetchRecursiveTree(ref.owner, ref.repo, branch.commit.sha)
      );
      const fileEntries = blobEntriesFromTree(tree);
      const allPaths = fileEntries.map((entry) => entry.path);
      const fileSizes = new Map(fileEntries.map((entry) => [entry.path, entry.size]));

      if (allPaths.length === 0) {
        throw createAnalysisError(
          "NO_ANALYZABLE_FILES",
          "파일이 없는 레포이거나 분석 가능한 텍스트 파일을 찾지 못했습니다."
        );
      }

      const packageJsonText = await logger.time("github.fetchPackageJson", () =>
        fetchTextFile(ref.owner, ref.repo, "package.json", branch.commit.sha)
      );
      const readmePath = findRootReadmePath(allPaths);
      const readmeText = readmePath
        ? await logger.time("github.fetchReadme", () =>
            fetchTextFile(ref.owner, ref.repo, readmePath, branch.commit.sha)
          )
        : null;
      const filteredPaths = filterAnalyzablePaths(allPaths);
      const draftTopology = buildTopology(filteredPaths, parsePackageJson(packageJsonText ?? null), {
        readmeText,
        repoName: repository.name,
      });
      const focusPackageJsonPath =
        draftTopology.focusRoot && allPaths.includes(`${draftTopology.focusRoot}/package.json`)
          ? `${draftTopology.focusRoot}/package.json`
          : null;
      const focusReadmePath = findReadmePathForRoot(allPaths, draftTopology.focusRoot);
      const environmentSupportPaths = collectEnvironmentSupportPaths(allPaths, draftTopology.focusRoot);
      const [focusPackageJsonText, focusReadmeText, environmentSupportEntries] = await Promise.all([
        focusPackageJsonPath
          ? logger.time("github.fetchFocusPackageJson", () =>
              fetchTextFile(ref.owner, ref.repo, focusPackageJsonPath, branch.commit.sha)
            )
          : Promise.resolve(null),
        focusReadmePath
          ? logger.time("github.fetchFocusReadme", () =>
              fetchTextFile(ref.owner, ref.repo, focusReadmePath, branch.commit.sha)
            )
          : Promise.resolve(null),
        Promise.all(
          environmentSupportPaths.map(async (path) => [
            path,
            await logger.time(`github.fetchEnvFile:${path}`, () =>
              fetchTextFile(ref.owner, ref.repo, path, branch.commit.sha)
            ),
          ])
        ),
      ]);
      const analysisMode = detectAnalysisMode({
        sourceFileCount: allPaths.length,
        filteredFileCount: filteredPaths.length,
        truncated: tree.truncated,
      });
      const contentPaths =
        analysisMode === "limited"
          ? pickLimitedPaths(filteredPaths, draftTopology.focusRoot)
          : filteredPaths;
      const previewCoverage = summarizeLayerCoverage(contentPaths, parsePackageJson(packageJsonText ?? null), {
        focusRoot: draftTopology.focusRoot,
        scopeToFocusRoot: draftTopology.kind === "monorepo",
      });
      const seededContents = Object.fromEntries(
        [
          packageJsonText ? ["package.json", packageJsonText] : null,
          readmePath && readmeText ? [readmePath, readmeText] : null,
          focusPackageJsonPath && focusPackageJsonText ? [focusPackageJsonPath, focusPackageJsonText] : null,
          focusReadmePath && focusReadmeText ? [focusReadmePath, focusReadmeText] : null,
          ...environmentSupportEntries.filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === "string" && entry[1].trim().length > 0
          ),
        ].filter((entry): entry is [string, string] => Boolean(entry))
      );
      const representativeContent = await logger.time("github.fetchRepresentativeContents", () =>
        fetchRepresentativeFileContents({
          owner: ref.owner,
          repo: ref.repo,
          ref: branch.commit.sha,
          paths: contentPaths,
          focusRoot: draftTopology.focusRoot,
          analysisMode,
          fileSizes,
          seededContents,
          seededPaths: previewCoverage.uncoveredPaths.slice(0, 4),
        })
      );

      const analysis = analyzeRepositorySnapshot({
        repo: {
          owner: repository.owner.login,
          name: repository.name,
          branch: repository.default_branch,
          sha: branch.commit.sha,
          url: repository.html_url,
          description: repository.description,
        },
        allPaths,
        sourceFileCount: allPaths.length,
        packageJsonText,
        readmeText,
        representativePaths: representativeContent.representativePaths,
        selectedFileContents: representativeContent.selectedFileContents,
        truncated: tree.truncated,
      });

      setCachedAnalysis(cacheKey, analysis);
      logger.info("analysis:complete", {
        cacheKey,
        analysisMode: analysis.analysisMode,
        projectType: analysis.summary.projectType,
        fileCount: analysis.stats.fileCount,
      });

      return analysis;
    });

    setInFlightAnalysis(cacheKey, buildPromise);

    try {
      return await buildPromise;
    } finally {
      clearInFlightAnalysis(cacheKey);
    }
  })();

  setInFlightAnalysis(repoInflightKey, promise);

  try {
    return {
      analysis: await promise,
      meta: buildAnalyzeTargetMeta({
        source: deliverySource,
        scope: deliveryScope,
        forceRefresh,
      }),
    };
  } finally {
    clearInFlightAnalysis(repoInflightKey);
  }
}

export async function analyzePublicRepository(
  repoUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<RepoAnalysis> {
  const result = await analyzePublicRepositoryWithMeta(repoUrl, options);
  return result.analysis;
}

function ownerMetadataScore(
  repo: Awaited<ReturnType<typeof fetchOwnerRepositories>>[number]
) {
  const ownerLogin = repo.full_name.split("/")[0] ?? "";
  const ownerToken = ownerLogin.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const repoToken = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const signal = `${repo.name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`.toLowerCase();
  let score = 0;

  score += Math.min(repo.stargazers_count, 5000) / 35;
  score += Math.min(repo.forks_count, 1000) / 60;
  if (repo.description) score += 18;
  if (repo.homepage) score += 16;
  if (!repo.archived) score += 10;
  if (!repo.fork) score += 10;
  if (/\b(example|starter|template|learn|guide|docs?|demo|tutorial)\b/i.test(signal)) {
    score += 12;
  }
  if (/\b(ui|design-system|library|sdk|tool|cli|api|server|app)\b/i.test(signal)) {
    score += 8;
  }
  if (ownerToken && repoToken === ownerToken) score += 22;
  if (ownerToken && repoToken.startsWith(ownerToken) && repoToken !== ownerToken) score += 18;
  if (/\b(official|primary|reference)\b/.test(signal) && /\b(sdk|api|client|library)\b/.test(signal)) {
    score += 12;
  }
  if (/\b(sdk|api|client)\b/.test(signal)) score += 10;

  const freshness = Date.parse(repo.updated_at);
  if (Number.isFinite(freshness)) {
    const ageDays = (Date.now() - freshness) / (1000 * 60 * 60 * 24);
    if (ageDays <= 30) score += 14;
    else if (ageDays <= 90) score += 9;
    else if (ageDays <= 180) score += 5;
    else if (ageDays > 365 * 5) score -= 24;
    else if (ageDays > 365 * 3) score -= 14;
    else if (ageDays > 365 * 2) score -= 8;

    if (ageDays > 365 * 2 && !repo.homepage && /^[a-z0-9]+-\d+(?:\.\d+)*$/i.test(repo.name)) {
      score -= 10;
    }
  }

  return score;
}

export function resolveOwnerEnrichmentRepoLimit() {
  return process.env.GITHUB_TOKEN
    ? OWNER_ENRICHMENT_REPO_LIMIT_AUTHENTICATED
    : OWNER_ENRICHMENT_REPO_LIMIT_UNAUTHENTICATED;
}

export function selectOwnerEnrichmentCandidates(
  repositories: Awaited<ReturnType<typeof fetchOwnerRepositories>>
) {
  const limit = resolveOwnerEnrichmentRepoLimit();

  return [...repositories]
    .filter((repo) => !repo.archived)
    .sort(
      (left, right) =>
        ownerMetadataScore(right) - ownerMetadataScore(left) ||
        left.full_name.localeCompare(right.full_name)
    )
    .slice(0, limit);
}

async function enrichOwnerRepositories(
  owner: string,
  repositories: Awaited<ReturnType<typeof fetchOwnerRepositories>>,
  candidates = selectOwnerEnrichmentCandidates(repositories)
) {
  type OwnerSamplingPayload = {
    readmeText: string | null;
    packageJsonText: string | null;
    pythonManifestPath: string | null;
    pythonManifestText: string | null;
    dockerfileText: string | null;
    composePath: string | null;
    composeText: string | null;
    deployConfigPaths: string[];
  };

  const candidateMap = new Map(candidates.map((repo) => [repo.full_name, repo] as const));

  async function fetchFirstAvailableTextFile(
    repoName: string,
    ref: string,
    paths: string[]
  ): Promise<{ path: string | null; text: string | null }> {
    for (const path of paths) {
      const text = await fetchTextFile(owner, repoName, path, ref).catch(() => null);
      if (text) {
        return { path, text };
      }
    }

    return { path: null, text: null };
  }

  async function fetchExistingTextFiles(
    repoName: string,
    ref: string,
    paths: string[]
  ): Promise<string[]> {
    const results = await Promise.all(
      paths.map(async (path) => {
        const text = await fetchTextFile(owner, repoName, path, ref).catch(() => null);
        return text ? path : null;
      })
    );

    return results.filter((value): value is string => Boolean(value));
  }

  const sampled = await Promise.all(
    repositories.map(async (repo) => {
      if (!candidateMap.has(repo.full_name)) {
        return [
          repo.full_name,
          {
            readmeText: null,
            packageJsonText: null,
            pythonManifestPath: null,
            pythonManifestText: null,
            dockerfileText: null,
            composePath: null,
            composeText: null,
            deployConfigPaths: [] as string[],
          } satisfies OwnerSamplingPayload,
        ] as const;
      }

      const ref = repo.default_branch || "HEAD";
      const [readmeText, packageJsonText, pythonManifest, composeFile, dockerfileText, deployConfigPaths] = await Promise.all([
        fetchReadmeText(owner, repo.name, ref).catch(() => null),
        fetchTextFile(owner, repo.name, "package.json", ref).catch(() => null),
        fetchFirstAvailableTextFile(repo.name, ref, [
          "pyproject.toml",
          "setup.cfg",
          "setup.py",
          "requirements.txt",
          "environment.yml",
          "environment.yaml",
        ]),
        fetchFirstAvailableTextFile(repo.name, ref, [
          "docker-compose.yml",
          "docker-compose.yaml",
          "compose.yml",
          "compose.yaml",
        ]),
        fetchTextFile(owner, repo.name, "Dockerfile", ref).catch(() => null),
        fetchExistingTextFiles(repo.name, ref, [
          "vercel.json",
          "netlify.toml",
          "fly.toml",
          "render.yaml",
          "render.yml",
          "railway.json",
        ]),
      ]);

      return [
        repo.full_name,
        {
          readmeText,
          packageJsonText,
          pythonManifestPath: pythonManifest.path,
          pythonManifestText: pythonManifest.text,
          dockerfileText,
          composePath: composeFile.path,
          composeText: composeFile.text,
          deployConfigPaths,
        } satisfies OwnerSamplingPayload,
      ] as const;
    })
  );

  const sampledMap = new Map<string, OwnerSamplingPayload>(sampled);

  return repositories.map((repo) => {
    const sampling = sampledMap.get(repo.full_name) ?? {
      readmeText: null,
      packageJsonText: null,
      pythonManifestPath: null,
      pythonManifestText: null,
      dockerfileText: null,
      composePath: null,
      composeText: null,
      deployConfigPaths: [],
    };

    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      homepage: repo.homepage,
      language: repo.language,
      topics: repo.topics ?? [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
      archived: repo.archived,
      fork: repo.fork,
      readmeText: sampling.readmeText,
      packageJsonText: sampling.packageJsonText,
      pythonManifestPath: sampling.pythonManifestPath,
      pythonManifestText: sampling.pythonManifestText,
      dockerfileText: sampling.dockerfileText,
      composePath: sampling.composePath,
      composeText: sampling.composeText,
      deployConfigPaths: sampling.deployConfigPaths,
    };
  });
}

export async function analyzePublicOwnerWithMeta(
  ownerUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<AnalysisWithMeta<OwnerAnalysis>> {
  const ref = parseGitHubTargetUrl(ownerUrl);

  if (ref.kind !== "owner") {
    throw createAnalysisError("INVALID_REPO_PATH", "GitHub owner URL 형식이 필요합니다.", {
      value: ownerUrl,
    });
  }

  const forceRefresh = options?.forceRefresh === true;
  const ownerInflightKey = `owner-url:${ref.url}`;
  const logger = createAnalysisLogger({
    scope: "analyze",
    repoUrl: ref.url,
    runId: ref.owner,
  });

  logger.info("analysis:start-owner", { ownerUrl: ref.url });
  let deliverySource: "fresh" | "server-cache" | "shared-inflight" = "fresh";
  let deliveryScope: "owner-url" | "owner-signature" = "owner-signature";

  const ownerInFlight = forceRefresh ? null : getInFlightAnalysis(ownerInflightKey);

  if (ownerInFlight) {
    logger.info("analysis:owner-inflight-hit", { ownerInflightKey });
    return {
      analysis: await (ownerInFlight as Promise<OwnerAnalysis>),
      meta: buildAnalyzeTargetMeta({
        source: "shared-inflight",
        scope: "owner-url",
        forceRefresh,
      }),
    };
  }

  const promise = (async () => {
    const profile = await logger.time("github.fetchOwnerProfile", () => fetchOwnerProfile(ref.owner));
    const repositories = await logger.time("github.fetchOwnerRepositories", () =>
      fetchOwnerRepositories({
        owner: ref.owner,
        ownerType: profile.ownerType,
        maxRepos: 100,
      })
    );
    const latestUpdatedAt = repositories[0]?.updated_at ?? "none";
    const cacheKey = buildOwnerCacheKey(profile.login, `${profile.public_repos}:${repositories.length}:${latestUpdatedAt}`);
    const cached = forceRefresh ? null : getCachedAnalysis(cacheKey);

    if (cached?.kind === "owner") {
      logger.info("analysis:cache-hit-owner", { cacheKey });
      deliverySource = "server-cache";
      deliveryScope = "owner-signature";
      return cached;
    }

    const inFlight = forceRefresh ? null : getInFlightAnalysis(cacheKey);

    if (inFlight) {
      logger.info("analysis:inflight-hit-owner", { cacheKey });
      deliverySource = "shared-inflight";
      deliveryScope = "owner-signature";
      return inFlight as Promise<OwnerAnalysis>;
    }

    const buildPromise = logger.time("analysis.build-owner", async () => {
      const enrichmentCandidates = selectOwnerEnrichmentCandidates(repositories);
      const enrichedRepositories = await logger.time("github.enrichOwnerRepositories", () =>
        enrichOwnerRepositories(ref.owner, repositories, enrichmentCandidates)
      );
      const analysis = analyzeOwnerSnapshot({
        profile: {
          login: profile.login,
          url: profile.html_url,
          avatarUrl: profile.avatar_url,
          profileType: profile.ownerType,
          displayName: profile.name,
          description: profile.description ?? profile.bio ?? null,
          blog: profile.blog ?? null,
          location: profile.location ?? null,
          publicRepoCount: profile.public_repos,
        },
        repositories: enrichedRepositories,
        sampledRepoCount: repositories.length,
        enrichedRepoCount: enrichmentCandidates.length,
      });

      setCachedAnalysis(cacheKey, analysis);
      logger.info("analysis:complete-owner", {
        cacheKey,
        publicRepoCount: analysis.summary.publicRepoCount,
        sampledRepoCount: analysis.summary.sampledRepoCount,
      });

      return analysis;
    });

    setInFlightAnalysis(cacheKey, buildPromise);

    try {
      return await buildPromise;
    } finally {
      clearInFlightAnalysis(cacheKey);
    }
  })();

  setInFlightAnalysis(ownerInflightKey, promise);

  try {
    return {
      analysis: await promise,
      meta: buildAnalyzeTargetMeta({
        source: deliverySource,
        scope: deliveryScope,
        forceRefresh,
      }),
    };
  } finally {
    clearInFlightAnalysis(ownerInflightKey);
  }
}

export async function analyzePublicOwner(
  ownerUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<OwnerAnalysis> {
  const result = await analyzePublicOwnerWithMeta(ownerUrl, options);
  return result.analysis;
}

export async function analyzePublicTargetWithMeta(
  targetUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<AnalysisWithMeta<AnalysisResult>> {
  const ref = parseGitHubTargetUrl(targetUrl);

  if (ref.kind === "owner") {
    return analyzePublicOwnerWithMeta(ref.url, options);
  }

  return analyzePublicRepositoryWithMeta(ref.url, options);
}

export async function analyzePublicTarget(
  targetUrl: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<AnalysisResult> {
  const result = await analyzePublicTargetWithMeta(targetUrl, options);
  return result.analysis;
}
