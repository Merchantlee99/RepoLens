import { layersForPath } from "@/lib/analysis/heuristics";
import type { EditGuideInfo, KeyFileInfo } from "@/lib/analysis/types";

type InternalApiCall = {
  sourcePath: string;
  endpoint: string;
  apiPath: string;
};

type RouteHandler = {
  path: string;
  methods: string[];
};

type PathServiceInfo = {
  path: string;
  names: string[];
};

type InternalImportLink = {
  sourcePath: string;
  targetPath: string;
  sourceLayers: string[];
  targetLayers: string[];
};

export type UnclassifiedSemanticHint = {
  key: string;
  label: string;
  count: number;
  samples: string[];
};

export type UnclassifiedSemanticSummary = {
  inspectedPathCount: number;
  totalPathCount: number;
  groups: UnclassifiedSemanticHint[];
};

export type SemanticSignals = {
  representativeFileCount: number;
  internalApiCalls: InternalApiCall[];
  internalImportLinks: InternalImportLink[];
  uiLogicLinks: InternalImportLink[];
  apiLogicLinks: InternalImportLink[];
  routeHandlers: RouteHandler[];
  dbClients: PathServiceInfo[];
  externalServices: PathServiceInfo[];
  keyFeatures: string[];
  oneLinerAddon: string | null;
  facts: Array<{ id: string; label: string; value: string }>;
  inferences: Array<{
    id: string;
    label: string;
    conclusion: string;
    confidence: "low" | "medium" | "high";
    evidence: string[];
  }>;
};

type SemanticFlowMaps = {
  routeMethodsByPath: Map<string, string[]>;
  dbClientsByPath: Map<string, string[]>;
  externalServicesByPath: Map<string, string[]>;
  incomingImportsByPath: Map<string, InternalImportLink[]>;
  outgoingImportsByPath: Map<string, InternalImportLink[]>;
  outgoingCallsByPath: Map<string, InternalApiCall[]>;
  incomingCallsByApiPath: Map<string, InternalApiCall[]>;
};

type IntegrationSurface = {
  names: string[];
  dbNames: string[];
  externalNames: string[];
  detailLines: string[];
  touchedPaths: string[];
};

const UI_PATH_PATTERN =
  /(^|\/)(app\/.+\/page\.(ts|tsx|js|jsx|mdx)|app\/page\.(ts|tsx|js|jsx|mdx)|pages\/.+\.(ts|tsx|js|jsx|mdx)|pages\/index\.(ts|tsx|js|jsx|mdx)|components\/.+\.(ts|tsx|js|jsx)|ui\/.+\.(ts|tsx|js|jsx))$/;
const APP_API_PATTERN = /(^|\/)app\/api(?:\/(.*))?\/route\.(ts|tsx|js|jsx)$/;
const PAGES_API_PATTERN = /(^|\/)pages\/api(?:\/(.*))?\.(ts|tsx|js|jsx)$/;
const ROOT_API_PATTERN = /(^|\/)api\/(.*)\.(ts|tsx|js|jsx)$/;
const FETCH_TARGET_PATTERN = /\bfetch\s*\(\s*(['"`])([^'"`]+)\1/g;
const AXIOS_TARGET_PATTERN =
  /\baxios\.(?:get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\1/g;
const ROUTE_METHOD_PATTERN =
  /export\s+(?:default\s+)?(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
const EXPRESS_METHOD_PATTERN = /\b(?:router|app)\.(get|post|put|patch|delete)\s*\(/gi;

const DB_CLIENT_MARKERS: Record<string, RegExp[]> = {
  Prisma: [/@prisma\/client\b/i, /\bPrismaClient\b/, /\bprisma\./],
  Supabase: [/@supabase\/supabase-js\b/i, /\bcreate(?:Browser|Server)?Client\b/, /\bsupabase\b/i],
  Firebase: [/firebase-admin\b/i, /firebase\/app\b/i, /\binitializeApp\b/, /\bgetFirestore\b/],
  Drizzle: [/drizzle-orm\b/i, /\bdrizzle\b/],
  Mongoose: [/\bmongoose\b/],
  Sequelize: [/\bsequelize\b/i],
  TypeORM: [/\btypeorm\b/i],
  Knex: [/\bknex\b/i],
};

const EXTERNAL_SERVICE_MARKERS: Record<string, RegExp[]> = {
  OpenAI: [/\bopenai\b/i, /\bOpenAI\b/],
  Stripe: [/\bstripe\b/i, /\bStripe\b/],
  Slack: [/@slack\/web-api\b/i, /\bWebClient\b/],
  GitHub: [/@octokit\b/i, /\boctokit\b/i],
  Resend: [/\bresend\b/i, /\bResend\b/],
  Sentry: [/@sentry\//i, /\bSentry\b/],
  Clerk: [/@clerk\//i, /\bClerk\b/, /\bclerk\b/],
  Anthropic: [/@anthropic-ai\/sdk\b/i, /\bAnthropic\b/],
};
const ONE_LINER_EXTERNAL_PRIORITY: Record<string, number> = {
  OpenAI: 100,
  Anthropic: 95,
  Stripe: 90,
  Clerk: 70,
  GitHub: 65,
  Slack: 60,
  Resend: 55,
  Sentry: 10,
};
const STRONG_EXTERNAL_PROMOTION_NAMES = new Set(["OpenAI", "Anthropic", "Stripe", "Clerk"]);
const CONDITIONAL_EXTERNAL_PROMOTION_NAMES = new Set(["GitHub", "Slack", "Resend"]);
const LOW_SIGNAL_EXTERNAL_NAMES = new Set(["Sentry"]);
const ONE_LINER_DB_PRIORITY: Record<string, number> = {
  Prisma: 90,
  Supabase: 85,
  Firebase: 80,
  TypeORM: 70,
  Drizzle: 68,
  Mongoose: 65,
  Sequelize: 60,
  Knex: 55,
};
const CLI_RUNTIME_PATTERN = /\b(process\.argv|commander|yargs|cac|oclif|zx)\b/i;
const BACKGROUND_RUNTIME_PATTERN = /\b(bullmq|bull|agenda|cron|schedule|worker|queue|job)\b/i;
const IMPORT_FROM_PATTERN =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_PATTERN = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const IMPORTABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".prisma"];
const APP_STRUCTURAL_PROJECT_TYPES = new Set([
  "풀스택 웹앱",
  "프론트엔드 웹앱",
  "모노레포 웹 플랫폼",
  "백엔드 API 서비스",
  "API 서버",
]);
const CONTEXT_KEY_FILE_PATTERN =
  /(^|\/)(README\.(md|mdx)|package\.json|tsconfig\.json|pnpm-workspace\.yaml|turbo\.json|nx\.json|lerna\.json|next\.config\.(ts|js|mjs)|tailwind\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|eslint\.config\.(js|mjs))$/i;

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function compactPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return parts.slice(-2).join("/");
}

function dirname(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function isMarkdownPath(path: string) {
  return /\.mdx?$/i.test(path);
}

function stripImportQuery(specifier: string) {
  return specifier.split("?")[0]?.split("#")[0] ?? specifier;
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

function normalizeEndpoint(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname || "/";
      if (!path.startsWith("/api/") && path !== "/api") {
        return null;
      }
      return path !== "/api" && path.endsWith("/") ? path.slice(0, -1) : path;
    } catch {
      return null;
    }
  }

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const path = normalized.split("?")[0]?.split("#")[0] ?? normalized;

  if (!path.startsWith("/api/") && path !== "/api") {
    return null;
  }

  return path !== "/api" && path.endsWith("/") ? path.slice(0, -1) : path;
}

function normalizeRouteTail(tail: string | undefined) {
  if (!tail) {
    return "";
  }

  const withoutExtension = tail.replace(/\.(ts|tsx|js|jsx)$/i, "");
  const withoutIndex = withoutExtension.replace(/\/index$/i, "");
  return withoutIndex === "index" ? "" : withoutIndex;
}

function apiEndpointFromPath(path: string) {
  const appMatch = path.match(APP_API_PATTERN);

  if (appMatch) {
    const tail = normalizeRouteTail(appMatch[2]);
    return tail ? `/api/${tail}` : "/api";
  }

  const pagesMatch = path.match(PAGES_API_PATTERN);

  if (pagesMatch) {
    const tail = normalizeRouteTail(pagesMatch[2]);
    return tail ? `/api/${tail}` : "/api";
  }

  const rootApiMatch = path.match(ROOT_API_PATTERN);

  if (rootApiMatch) {
    const tail = normalizeRouteTail(rootApiMatch[2]);
    return tail ? `/api/${tail}` : "/api";
  }

  return null;
}

function extractTargets(text: string) {
  const targets: string[] = [];

  for (const pattern of [FETCH_TARGET_PATTERN, AXIOS_TARGET_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const target = match[2];
      if (target) {
        targets.push(target);
      }
    }
  }

  return unique(targets);
}

function extractImportSpecifiers(text: string) {
  const specifiers: string[] = [];

  [IMPORT_FROM_PATTERN, REQUIRE_PATTERN, DYNAMIC_IMPORT_PATTERN].forEach((pattern) => {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  });

  return unique(specifiers);
}

function resolveInternalImport(args: {
  sourcePath: string;
  specifier: string;
  paths: string[];
  focusRoot?: string | null;
}) {
  const specifier = stripImportQuery(args.specifier.trim());
  if (!specifier) {
    return null;
  }

  const baseCandidates: string[] = [];
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    baseCandidates.push(normalizePath(`${dirname(args.sourcePath)}/${specifier}`));
  } else if (specifier.startsWith("@/") || specifier.startsWith("~/")) {
    const suffix = specifier.slice(2);
    baseCandidates.push(suffix);
    baseCandidates.push(`src/${suffix}`);
    if (args.focusRoot) {
      baseCandidates.push(`${args.focusRoot}/${suffix}`);
    }
  } else if (specifier.startsWith("/")) {
    const suffix = specifier.slice(1);
    baseCandidates.push(suffix);
    baseCandidates.push(`src/${suffix}`);
    if (args.focusRoot) {
      baseCandidates.push(`${args.focusRoot}/${suffix}`);
    }
  } else {
    return null;
  }

  const expanded = unique(
    baseCandidates.flatMap((candidate) => {
      const base = normalizePath(candidate);
      if (!base) {
        return [];
      }

      return [
        base,
        ...IMPORTABLE_EXTENSIONS.map((extension) => `${base}${extension}`),
        ...IMPORTABLE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
      ];
    })
  );

  const matches = expanded.filter((candidate) => args.paths.includes(candidate));
  if (matches.length === 0) {
    return null;
  }

  return matches.sort(
    (left, right) =>
      Number(Boolean(args.focusRoot && right.startsWith(`${args.focusRoot}/`))) -
        Number(Boolean(args.focusRoot && left.startsWith(`${args.focusRoot}/`))) ||
      left.length - right.length ||
      left.localeCompare(right)
  )[0]!;
}

function extractRouteMethods(text: string) {
  const methods: string[] = [];

  ROUTE_METHOD_PATTERN.lastIndex = 0;
  let routeMatch: RegExpExecArray | null;
  while ((routeMatch = ROUTE_METHOD_PATTERN.exec(text)) !== null) {
    methods.push(routeMatch[1]!.toUpperCase());
  }

  EXPRESS_METHOD_PATTERN.lastIndex = 0;
  let expressMatch: RegExpExecArray | null;
  while ((expressMatch = EXPRESS_METHOD_PATTERN.exec(text)) !== null) {
    methods.push(expressMatch[1]!.toUpperCase());
  }

  return unique(methods);
}

function extractNamedMarkers(
  text: string,
  markers: Record<string, RegExp[]>
) {
  return Object.entries(markers)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([name]) => name);
}

function uniquePathInfo(items: PathServiceInfo[]) {
  const map = new Map<string, string[]>();

  items.forEach((item) => {
    const current = map.get(item.path) ?? [];
    map.set(item.path, unique([...current, ...item.names]).sort((a, b) => a.localeCompare(b)));
  });

  return [...map.entries()]
    .map(([path, names]) => ({ path, names }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeHintGroups(items: Array<{ key: string; label: string; path: string }>) {
  const map = new Map<string, UnclassifiedSemanticHint>();

  items.forEach((item) => {
    const current = map.get(item.key) ?? {
      key: item.key,
      label: item.label,
      count: 0,
      samples: [],
    };
    current.count += 1;
    if (current.samples.length < 3) {
      current.samples.push(item.path);
    }
    map.set(item.key, current);
  });

  return [...map.values()].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label)
  );
}

function buildFlowMapsFromSelectedFileContents(args: {
  selectedFileContents?: Record<string, string>;
  focusRoot?: string | null;
}) {
  const fileContents = Object.entries(args.selectedFileContents ?? {})
    .filter(([, text]) => typeof text === "string" && text.trim().length > 0)
    .filter(([path]) => !isMarkdownPath(path))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const availablePaths = fileContents.map(([path]) => path);
  const internalImportLinks = new Map<string, InternalImportLink>();
  const dbClients: PathServiceInfo[] = [];
  const externalServices: PathServiceInfo[] = [];

  fileContents.forEach(([path, text]) => {
    const dbNames = extractNamedMarkers(text, DB_CLIENT_MARKERS);
    if (dbNames.length > 0) {
      dbClients.push({ path, names: dbNames });
    }

    const serviceNames = extractNamedMarkers(text, EXTERNAL_SERVICE_MARKERS);
    if (serviceNames.length > 0) {
      externalServices.push({ path, names: serviceNames });
    }

    extractImportSpecifiers(text).forEach((specifier) => {
      const targetPath = resolveInternalImport({
        sourcePath: path,
        specifier,
        paths: availablePaths,
        focusRoot: args.focusRoot,
      });

      if (!targetPath) {
        return;
      }

      const link: InternalImportLink = {
        sourcePath: path,
        targetPath,
        sourceLayers: layersForPath(path),
        targetLayers: layersForPath(targetPath),
      };
      internalImportLinks.set(`${link.sourcePath}::${link.targetPath}`, link);
    });
  });

  return buildSemanticFlowMaps({
    representativeFileCount: fileContents.length,
    internalApiCalls: [],
    internalImportLinks: [...internalImportLinks.values()],
    uiLogicLinks: [],
    apiLogicLinks: [],
    routeHandlers: [],
    dbClients: uniquePathInfo(dbClients),
    externalServices: uniquePathInfo(externalServices),
    keyFeatures: [],
    oneLinerAddon: null,
    facts: [],
    inferences: [],
  });
}

function semanticHintsForText(path: string, text: string) {
  const hints: Array<{ key: string; label: string; path: string }> = [];
  const dbNames = extractNamedMarkers(text, DB_CLIENT_MARKERS);
  const externalNames = extractNamedMarkers(text, EXTERNAL_SERVICE_MARKERS);
  const apiTargets = extractTargets(text).map((target) => normalizeEndpoint(target)).filter(Boolean);
  const routeMethods = extractRouteMethods(text);

  if (dbNames.length > 0) {
    hints.push({ key: "db-usage", label: "DB 사용 신호", path });
  }

  if (externalNames.length > 0) {
    hints.push({ key: "external-usage", label: "외부 SDK 사용 신호", path });
  }

  if (apiTargets.length > 0) {
    hints.push({ key: "internal-api", label: "내부 API 호출 신호", path });
  }

  if (routeMethods.length > 0) {
    hints.push({ key: "request-handler", label: "요청 처리 함수 신호", path });
  }

  if (CLI_RUNTIME_PATTERN.test(text)) {
    hints.push({ key: "cli-runtime", label: "CLI 실행 신호", path });
  }

  if (BACKGROUND_RUNTIME_PATTERN.test(text)) {
    hints.push({ key: "background-runtime", label: "백그라운드 실행 신호", path });
  }

  return hints;
}

function buildPrimaryFlowSentence(signals: {
  internalApiCalls: InternalApiCall[];
  dbClients: PathServiceInfo[];
  externalServices: PathServiceInfo[];
  flowMaps?: Pick<SemanticFlowMaps, "dbClientsByPath" | "externalServicesByPath" | "outgoingImportsByPath">;
}) {
  const primaryFlow = signals.internalApiCalls
    .slice()
    .sort(
      (left, right) =>
        Number(UI_PATH_PATTERN.test(right.sourcePath)) - Number(UI_PATH_PATTERN.test(left.sourcePath)) ||
        left.sourcePath.localeCompare(right.sourcePath)
    )[0];

  if (!primaryFlow) {
    return null;
  }

  const apiServices =
    signals.externalServices.find((item) => item.path === primaryFlow.apiPath)?.names ?? [];
  const apiDbClients = signals.dbClients.find((item) => item.path === primaryFlow.apiPath)?.names ?? [];
  const downstreamSurface = signals.flowMaps
    ? collectIntegrationSurfaceFromPath(primaryFlow.apiPath, signals.flowMaps, 2)
    : { names: [], dbNames: [], externalNames: [], detailLines: [], touchedPaths: [] };
  const downstream = unique([...apiServices, ...apiDbClients]);
  const expandedDownstream = unique([...downstream, ...downstreamSurface.names]);
  const surfacePhrase = buildOneLinerSurfacePhrase({
    dbNames: unique([...apiDbClients, ...downstreamSurface.dbNames]),
    externalNames: unique([...apiServices, ...downstreamSurface.externalNames]),
  });

  if (expandedDownstream.length > 0 && surfacePhrase?.phrase) {
    return `대표 코드 기준, ${compactPath(primaryFlow.sourcePath)}에서 ${primaryFlow.endpoint} 요청을 보내고 이 API 흐름에서 ${surfacePhrase.phrase}이 확인됩니다.`;
  }

  return `대표 코드 기준, ${compactPath(primaryFlow.sourcePath)}에서 ${primaryFlow.endpoint} 요청으로 서버 처리 흐름이 이어집니다.`;
}

function collectPromotedIntegrationSurface(args: {
  internalApiCalls: InternalApiCall[];
  dbClients: PathServiceInfo[];
  externalServices: PathServiceInfo[];
  flowMaps?: Pick<SemanticFlowMaps, "dbClientsByPath" | "externalServicesByPath" | "outgoingImportsByPath">;
}) {
  const primaryFlow = args.internalApiCalls
    .slice()
    .sort(
      (left, right) =>
        Number(UI_PATH_PATTERN.test(right.sourcePath)) - Number(UI_PATH_PATTERN.test(left.sourcePath)) ||
        left.sourcePath.localeCompare(right.sourcePath)
    )[0];

  if (!primaryFlow || !args.flowMaps) {
    return {
      dbNames: unique(args.dbClients.flatMap((item) => item.names)),
      externalNames: unique(args.externalServices.flatMap((item) => item.names)).filter(isRepoWidePromotableExternal),
    };
  }

  const apiServices = args.externalServices.find((item) => item.path === primaryFlow.apiPath)?.names ?? [];
  const apiDbClients = args.dbClients.find((item) => item.path === primaryFlow.apiPath)?.names ?? [];
  const downstreamSurface = collectIntegrationSurfaceFromPath(primaryFlow.apiPath, args.flowMaps, 2);
  const dbNames = unique([...apiDbClients, ...downstreamSurface.dbNames]);
  const externalNames = unique([...apiServices, ...downstreamSurface.externalNames]);

  if (dbNames.length > 0 || externalNames.length > 0) {
    return { dbNames, externalNames };
  }

  return {
    dbNames: unique(args.dbClients.flatMap((item) => item.names)),
    externalNames: unique(args.externalServices.flatMap((item) => item.names)),
  };
}

function rankOneLinerNames(names: string[], priorities: Record<string, number>) {
  return unique(names)
    .sort(
      (left, right) =>
        (priorities[right] ?? 0) - (priorities[left] ?? 0) || left.localeCompare(right)
    );
}

function summarizeNameList(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} 등`;
}

function isRepoWidePromotableExternal(name: string) {
  if (STRONG_EXTERNAL_PROMOTION_NAMES.has(name)) {
    return true;
  }

  if (CONDITIONAL_EXTERNAL_PROMOTION_NAMES.has(name)) {
    return false;
  }

  return !LOW_SIGNAL_EXTERNAL_NAMES.has(name);
}

function summarizeOneLinerSurfaceNames(args: { dbNames: string[]; externalNames: string[] }) {
  const rankedDb = rankOneLinerNames(args.dbNames, ONE_LINER_DB_PRIORITY);
  const rankedExternal = rankOneLinerNames(args.externalNames, ONE_LINER_EXTERNAL_PRIORITY);
  const meaningfulExternal = rankedExternal.filter((name) => !LOW_SIGNAL_EXTERNAL_NAMES.has(name));
  const effectiveExternal =
    meaningfulExternal.length > 0
      ? meaningfulExternal
      : [];
  const merged =
    rankedDb.length > 0 && effectiveExternal.length > 0
      ? [rankedDb[0]!, effectiveExternal[0]!]
      : [...rankedDb, ...effectiveExternal].slice(0, 2);
  return {
    summary: summarizeNameList(merged),
    dbNames: rankedDb.length > 0 && effectiveExternal.length > 0 ? rankedDb.slice(0, 1) : rankedDb.slice(0, 2),
    externalNames:
      rankedDb.length > 0 && effectiveExternal.length > 0
        ? effectiveExternal.slice(0, 1)
        : effectiveExternal.slice(0, 2),
  };
}

function buildOneLinerSurfacePhrase(args: { dbNames: string[]; externalNames: string[] }) {
  const summarizedSurface = summarizeOneLinerSurfaceNames(args);
  const dbSummary = summarizeNameList(summarizedSurface.dbNames);
  const externalSummary = summarizeNameList(summarizedSurface.externalNames);

  if (dbSummary && externalSummary) {
    return {
      summary: summarizedSurface.summary,
      phrase: `${dbSummary} 연결과 ${externalSummary} 연동`,
      dbNames: summarizedSurface.dbNames,
      externalNames: summarizedSurface.externalNames,
    };
  }

  if (dbSummary) {
    return {
      summary: summarizedSurface.summary,
      phrase: `${dbSummary} 연결`,
      dbNames: summarizedSurface.dbNames,
      externalNames: summarizedSurface.externalNames,
    };
  }

  if (externalSummary) {
    return {
      summary: summarizedSurface.summary,
      phrase: `${externalSummary} 연동`,
      dbNames: summarizedSurface.dbNames,
      externalNames: summarizedSurface.externalNames,
    };
  }

  return null;
}

function buildSemanticKeyFeatures(args: {
  internalApiCalls: InternalApiCall[];
  dbClients: PathServiceInfo[];
  externalServices: PathServiceInfo[];
  flowMaps?: Pick<SemanticFlowMaps, "dbClientsByPath" | "externalServicesByPath" | "outgoingImportsByPath">;
}) {
  const promotedSurface = collectPromotedIntegrationSurface(args);
  const summarizedSurface = summarizeOneLinerSurfaceNames(promotedSurface);
  const candidates: Array<{ text: string; priority: number }> = [];

  if (summarizedSurface.dbNames[0]) {
    candidates.push({
      text: `${summarizedSurface.dbNames[0]} 연결 확인`,
      priority: 100,
    });
  }

  if (summarizedSurface.externalNames[0]) {
    candidates.push({
      text: `${summarizedSurface.externalNames[0]} 연동 확인`,
      priority: 92,
    });
  }

  return candidates
    .sort((left, right) => right.priority - left.priority || left.text.localeCompare(right.text))
    .map((item) => item.text);
}

export function extractSemanticSignals(args: {
  paths: string[];
  selectedFileContents?: Record<string, string>;
  focusRoot?: string | null;
}) : SemanticSignals {
  const fileContents = Object.entries(args.selectedFileContents ?? {})
    .filter(([path, text]) => args.paths.includes(path) && typeof text === "string" && text.trim().length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const endpointToApiPath = new Map<string, string>();
  const internalApiCalls: InternalApiCall[] = [];
  const internalImportLinks: InternalImportLink[] = [];
  const routeHandlers: RouteHandler[] = [];
  const dbClients: PathServiceInfo[] = [];
  const externalServices: PathServiceInfo[] = [];

  args.paths.forEach((path) => {
    const endpoint = apiEndpointFromPath(path);
    if (endpoint) {
      endpointToApiPath.set(endpoint, path);
    }
  });

  fileContents.forEach(([path, text]) => {
    if (!isMarkdownPath(path)) {
      const methods = extractRouteMethods(text);
      if (methods.length > 0) {
        routeHandlers.push({ path, methods });
      }

      const dbNames = extractNamedMarkers(text, DB_CLIENT_MARKERS);
      if (dbNames.length > 0) {
        dbClients.push({ path, names: dbNames });
      }

      const externalNames = extractNamedMarkers(text, EXTERNAL_SERVICE_MARKERS);
      if (externalNames.length > 0) {
        externalServices.push({ path, names: externalNames });
      }

      extractTargets(text).forEach((target) => {
        const endpoint = normalizeEndpoint(target);
        if (!endpoint) {
          return;
        }

        const apiPath = endpointToApiPath.get(endpoint);
        if (!apiPath) {
          return;
        }

        internalApiCalls.push({
          sourcePath: path,
          endpoint,
          apiPath,
        });
      });

      extractImportSpecifiers(text).forEach((specifier) => {
        const targetPath = resolveInternalImport({
          sourcePath: path,
          specifier,
          paths: args.paths,
          focusRoot: args.focusRoot,
        });

        if (!targetPath || targetPath === path) {
          return;
        }

        internalImportLinks.push({
          sourcePath: path,
          targetPath,
          sourceLayers: layersForPath(path),
          targetLayers: layersForPath(targetPath),
        });
      });
    }
  });

  const dedupedCalls = unique(
    internalApiCalls.map((item) => `${item.sourcePath}::${item.endpoint}::${item.apiPath}`)
  )
    .map((value) => {
      const [sourcePath, endpoint, apiPath] = value.split("::");
      return { sourcePath, endpoint, apiPath };
    })
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath) || a.endpoint.localeCompare(b.endpoint));
  const dedupedDbClients = uniquePathInfo(dbClients);
  const dedupedExternalServices = uniquePathInfo(externalServices);
  const dedupedImportLinks = unique(
    internalImportLinks.map((item) => `${item.sourcePath}::${item.targetPath}`)
  )
    .map((value) => {
      const [sourcePath, targetPath] = value.split("::");
      return {
        sourcePath,
        targetPath,
        sourceLayers: layersForPath(sourcePath),
        targetLayers: layersForPath(targetPath),
      };
    })
    .sort(
      (left, right) =>
        left.sourcePath.localeCompare(right.sourcePath) ||
        left.targetPath.localeCompare(right.targetPath)
    );
  const uiLogicLinks = dedupedImportLinks.filter(
    (item) => item.sourceLayers.includes("UI") && item.targetLayers.includes("Logic")
  );
  const apiLogicLinks = dedupedImportLinks.filter(
    (item) => item.sourceLayers.includes("API") && item.targetLayers.includes("Logic")
  );
  const importMaps = buildSemanticFlowMaps({
    representativeFileCount: fileContents.length,
    internalApiCalls: dedupedCalls,
    internalImportLinks: dedupedImportLinks,
    uiLogicLinks,
    apiLogicLinks,
    routeHandlers: routeHandlers.sort((a, b) => a.path.localeCompare(b.path)),
    dbClients: dedupedDbClients,
    externalServices: dedupedExternalServices,
    keyFeatures: [],
    oneLinerAddon: null,
    facts: [],
    inferences: [],
  });
  const apiLogicIntegrationFlows = apiLogicLinks
    .map((link) => ({
      ...link,
      surface: collectIntegrationSurfaceFromPath(link.targetPath, importMaps, 2),
    }))
    .filter((item) => item.surface.names.length > 0);
  const oneLinerAddon = buildPrimaryFlowSentence({
    internalApiCalls: dedupedCalls,
    dbClients: dedupedDbClients,
    externalServices: dedupedExternalServices,
    flowMaps: importMaps,
  }) ??
    (uiLogicLinks.length > 0
      ? `대표 코드 기준, ${compactPath(uiLogicLinks[0]!.sourcePath)}에서 ${compactPath(uiLogicLinks[0]!.targetPath)} 로직을 직접 사용합니다.`
      : null) ??
    ((dedupedExternalServices.length > 0 || dedupedDbClients.length > 0)
      ? (() => {
          const surfacePhrase = buildOneLinerSurfacePhrase(
            collectPromotedIntegrationSurface({
              internalApiCalls: [],
              dbClients: dedupedDbClients,
              externalServices: dedupedExternalServices,
            })
          );
          if (!surfacePhrase?.phrase) return null;
          return `대표 코드 기준, ${surfacePhrase.phrase}이 확인됩니다.`;
        })()
        : null);

  const facts: SemanticSignals["facts"] = [];
  if (fileContents.length > 0) {
    facts.push({
      id: "representative_content",
      label: "Representative Content",
      value: `${fileContents.length} files`,
    });
  }
  if (dedupedCalls.length > 0) {
    facts.push({
      id: "representative_api_calls",
      label: "Representative API Calls",
      value: unique(dedupedCalls.map((item) => item.endpoint)).slice(0, 3).join(", "),
    });
  }
  if (dedupedImportLinks.length > 0) {
    facts.push({
      id: "representative_import_links",
      label: "Representative Import Links",
      value: dedupedImportLinks
        .slice(0, 3)
        .map((item) => `${compactPath(item.sourcePath)} -> ${compactPath(item.targetPath)}`)
        .join(", "),
    });
  }
  const dbNames = unique(dedupedDbClients.flatMap((item) => item.names));
  if (dbNames.length > 0) {
    facts.push({
      id: "data_clients",
      label: "Data Clients",
      value: dbNames.join(", "),
    });
  }
  const externalNames = unique(dedupedExternalServices.flatMap((item) => item.names));
  if (externalNames.length > 0) {
    facts.push({
      id: "external_services",
      label: "External Services",
      value: externalNames.join(", "),
    });
  }

  const inferences: SemanticSignals["inferences"] = [];
  if (dedupedCalls.length > 0) {
    const first = dedupedCalls[0]!;
    inferences.push({
      id: "primary_flow",
      label: "Primary Flow",
      conclusion: `${compactPath(first.sourcePath)} -> ${first.endpoint} -> ${compactPath(first.apiPath)}`,
      confidence: "medium",
      evidence: [
        `요청 시작 파일: ${first.sourcePath}`,
        `내부 API 엔드포인트: ${first.endpoint}`,
        `매칭된 API 파일: ${first.apiPath}`,
      ],
    });
  }
  if (externalNames.length > 0 || dbNames.length > 0) {
    inferences.push({
      id: "integration_surface",
      label: "Integration Surface",
      conclusion: [
        dbNames.length > 0 ? `데이터 연결: ${dbNames.join(", ")}` : null,
        externalNames.length > 0 ? `외부 연동: ${externalNames.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" / "),
      confidence: "medium",
      evidence: [
        ...dedupedDbClients.slice(0, 2).map((item) => `${item.path}: ${item.names.join(", ")}`),
        ...dedupedExternalServices.slice(0, 2).map((item) => `${item.path}: ${item.names.join(", ")}`),
      ],
    });
  }
  if (uiLogicLinks.length > 0) {
    const first = uiLogicLinks[0]!;
    inferences.push({
      id: "ui_logic_flow",
      label: "UI to Logic",
      conclusion: `${compactPath(first.sourcePath)} -> ${compactPath(first.targetPath)}`,
      confidence: "medium",
      evidence: [
        `화면 파일: ${first.sourcePath}`,
        `직접 가져오는 로직 파일: ${first.targetPath}`,
      ],
    });
  }
  if (apiLogicLinks.length > 0) {
    const first = apiLogicLinks[0]!;
    inferences.push({
      id: "api_logic_flow",
      label: "API to Logic",
      conclusion: `${compactPath(first.sourcePath)} -> ${compactPath(first.targetPath)}`,
      confidence: "medium",
      evidence: [
        `API 파일: ${first.sourcePath}`,
        `직접 가져오는 로직 파일: ${first.targetPath}`,
      ],
    });
  }
  if (apiLogicIntegrationFlows.length > 0) {
    const first = apiLogicIntegrationFlows[0]!;
    inferences.push({
      id: "api_logic_integration_flow",
      label: "API to Logic to Integration",
      conclusion: `${compactPath(first.sourcePath)} -> ${compactPath(first.targetPath)} -> ${first.surface.names.join(", ")}`,
      confidence: "medium",
      evidence: [
        `API 파일: ${first.sourcePath}`,
        `중간 로직 파일: ${first.targetPath}`,
        ...first.surface.detailLines.slice(0, 3).map((detail) => `하위 연결: ${detail}`),
      ],
    });
  }

  return {
    representativeFileCount: fileContents.length,
    internalApiCalls: dedupedCalls,
    internalImportLinks: dedupedImportLinks,
    uiLogicLinks,
    apiLogicLinks,
    routeHandlers: routeHandlers.sort((a, b) => a.path.localeCompare(b.path)),
    dbClients: dedupedDbClients,
    externalServices: dedupedExternalServices,
    keyFeatures: buildSemanticKeyFeatures({
      internalApiCalls: dedupedCalls,
      dbClients: dedupedDbClients,
      externalServices: dedupedExternalServices,
      flowMaps: importMaps,
    }),
    oneLinerAddon,
    facts,
    inferences,
  };
}

export function summarizeUnclassifiedCodeSemantics(args: {
  uncoveredPaths: string[];
  selectedFileContents?: Record<string, string>;
  focusRoot?: string | null;
}): UnclassifiedSemanticSummary {
  const items: Array<{ key: string; label: string; path: string }> = [];
  let inspectedPathCount = 0;
  const maps = buildFlowMapsFromSelectedFileContents({
    selectedFileContents: args.selectedFileContents,
    focusRoot: args.focusRoot,
  });

  args.uncoveredPaths.forEach((path) => {
    const text = args.selectedFileContents?.[path];
    if (typeof text !== "string" || text.trim().length === 0 || isMarkdownPath(path)) {
      return;
    }

    inspectedPathCount += 1;
    items.push(...semanticHintsForText(path, text));

    const downstreamTargets = unique(
      (maps.outgoingImportsByPath.get(path) ?? [])
        .filter((link) =>
          link.targetLayers.some(
            (layer) => layer === "Logic" || layer === "DB" || layer === "External"
          )
        )
        .map((link) => link.targetPath)
    );
    const downstreamSurface =
      downstreamTargets.length > 0
        ? collectIntegrationSurfaceForPaths(downstreamTargets, maps, 2)
        : { names: [], dbNames: [], externalNames: [], detailLines: [], touchedPaths: [] };

    if (downstreamSurface.dbNames.length > 0) {
      items.push({ key: "indirect-db-usage", label: "간접 DB 사용 신호", path });
    }

    if (downstreamSurface.externalNames.length > 0) {
      items.push({ key: "indirect-external-usage", label: "간접 외부 SDK 사용 신호", path });
    }
  });

  return {
    inspectedPathCount,
    totalPathCount: args.uncoveredPaths.length,
    groups: summarizeHintGroups(items),
  };
}

function appendSentences(base: string, extras: string[]) {
  const uniqueExtras = unique(
    extras
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (uniqueExtras.length === 0) {
    return base;
  }

  return `${base} ${uniqueExtras.join(" ")}`.trim();
}

function buildSemanticFlowMaps(signals: SemanticSignals): SemanticFlowMaps {
  const routeMethodsByPath = new Map(signals.routeHandlers.map((item) => [item.path, item.methods]));
  const dbClientsByPath = new Map(signals.dbClients.map((item) => [item.path, item.names]));
  const externalServicesByPath = new Map(
    signals.externalServices.map((item) => [item.path, item.names])
  );
  const incomingImportsByPath = new Map<string, InternalImportLink[]>();
  const outgoingImportsByPath = new Map<string, InternalImportLink[]>();
  const outgoingCallsByPath = new Map<string, InternalApiCall[]>();
  const incomingCallsByApiPath = new Map<string, InternalApiCall[]>();

  signals.internalImportLinks.forEach((link) => {
    incomingImportsByPath.set(link.targetPath, [...(incomingImportsByPath.get(link.targetPath) ?? []), link]);
    outgoingImportsByPath.set(link.sourcePath, [...(outgoingImportsByPath.get(link.sourcePath) ?? []), link]);
  });

  signals.internalApiCalls.forEach((call) => {
    outgoingCallsByPath.set(call.sourcePath, [...(outgoingCallsByPath.get(call.sourcePath) ?? []), call]);
    incomingCallsByApiPath.set(call.apiPath, [...(incomingCallsByApiPath.get(call.apiPath) ?? []), call]);
  });

  return {
    routeMethodsByPath,
    dbClientsByPath,
    externalServicesByPath,
    incomingImportsByPath,
    outgoingImportsByPath,
    outgoingCallsByPath,
    incomingCallsByApiPath,
  };
}

function collectIntegrationSurfaceFromPath(
  path: string,
  maps: Pick<SemanticFlowMaps, "dbClientsByPath" | "externalServicesByPath" | "outgoingImportsByPath">,
  maxDepth = 2
): IntegrationSurface {
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path, depth: 0 }];
  const names: string[] = [];
  const dbNamesTouched: string[] = [];
  const externalNamesTouched: string[] = [];
  const detailLines: string[] = [];
  const touchedPaths: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.path)) {
      continue;
    }

    visited.add(current.path);

    const dbNames = maps.dbClientsByPath.get(current.path) ?? [];
    const externalNames = maps.externalServicesByPath.get(current.path) ?? [];

    if (dbNames.length > 0 || externalNames.length > 0) {
      touchedPaths.push(current.path);
      if (dbNames.length > 0) {
        dbNamesTouched.push(...dbNames);
        names.push(...dbNames);
        detailLines.push(`${compactPath(current.path)}: ${dbNames.join(", ")}`);
      }
      if (externalNames.length > 0) {
        externalNamesTouched.push(...externalNames);
        names.push(...externalNames);
        detailLines.push(`${compactPath(current.path)}: ${externalNames.join(", ")}`);
      }
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    (maps.outgoingImportsByPath.get(current.path) ?? []).forEach((link) => {
      if (
        link.targetLayers.some((layer) => layer === "Logic" || layer === "DB" || layer === "External") &&
        !visited.has(link.targetPath)
      ) {
        queue.push({ path: link.targetPath, depth: current.depth + 1 });
      }
    });
  }

  return {
    names: unique(names),
    dbNames: unique(dbNamesTouched),
    externalNames: unique(externalNamesTouched),
    detailLines: unique(detailLines),
    touchedPaths: unique(touchedPaths),
  };
}

function collectIntegrationSurfaceForPaths(
  paths: string[],
  maps: Pick<SemanticFlowMaps, "dbClientsByPath" | "externalServicesByPath" | "outgoingImportsByPath">,
  maxDepth = 2
): IntegrationSurface {
  const surfaces = paths.map((path) => collectIntegrationSurfaceFromPath(path, maps, maxDepth));

  return {
    names: unique(surfaces.flatMap((surface) => surface.names)),
    dbNames: unique(surfaces.flatMap((surface) => surface.dbNames)),
    externalNames: unique(surfaces.flatMap((surface) => surface.externalNames)),
    detailLines: unique(surfaces.flatMap((surface) => surface.detailLines)),
    touchedPaths: unique(surfaces.flatMap((surface) => surface.touchedPaths)),
  };
}

function semanticPathScore(path: string, maps: SemanticFlowMaps) {
  const layers = layersForPath(path);
  const routeMethods = maps.routeMethodsByPath.get(path) ?? [];
  const dbNames = maps.dbClientsByPath.get(path) ?? [];
  const externalNames = maps.externalServicesByPath.get(path) ?? [];
  const incomingImports = maps.incomingImportsByPath.get(path) ?? [];
  const outgoingImports = maps.outgoingImportsByPath.get(path) ?? [];
  const outgoingCalls = maps.outgoingCallsByPath.get(path) ?? [];
  const incomingCalls = maps.incomingCallsByApiPath.get(path) ?? [];
  const hasUiLogicIncoming = incomingImports.some((item) => item.sourceLayers.includes("UI"));
  const hasApiLogicIncoming = incomingImports.some((item) => item.sourceLayers.includes("API"));
  const hasUiLogicOutgoing = outgoingImports.some(
    (item) => item.sourceLayers.includes("UI") && item.targetLayers.includes("Logic")
  );
  const hasApiLogicOutgoing = outgoingImports.some(
    (item) => item.sourceLayers.includes("API") && item.targetLayers.includes("Logic")
  );

  let score = 0;

  if (layers.includes("UI") && outgoingCalls.length > 0) {
    score += 300;
  }

  if (layers.includes("UI") && hasUiLogicOutgoing) {
    score += 150;
  }

  if (layers.includes("Logic") && hasUiLogicIncoming) {
    score += 340;
  } else if (layers.includes("Logic") && hasApiLogicIncoming) {
    score += 220;
  }

  if (layers.includes("API") && incomingCalls.length > 0) {
    score += 130;
  }

  if (layers.includes("API") && hasApiLogicOutgoing) {
    score += 90;
  }

  if (layers.includes("API") && routeMethods.length > 0) {
    score += 35;
  }

  if (dbNames.length > 0) {
    score += layers.includes("DB") ? 120 : 15;
  }

  if (externalNames.length > 0) {
    score += layers.includes("External") ? 110 : 15;
  }

  if (layers.includes("Logic") && outgoingCalls.length > 0) {
    score += 80;
  }

  return score;
}

function keyFileStructuralAdjustment(file: KeyFileInfo, projectType?: string | null) {
  if (!projectType || !APP_STRUCTURAL_PROJECT_TYPES.has(projectType)) {
    return 0;
  }

  if (CONTEXT_KEY_FILE_PATTERN.test(file.path)) {
    return /README\.mdx?$/i.test(file.path) ? -24 : -140;
  }

  return 0;
}

function semanticGuidePriority(path: string, maps: SemanticFlowMaps) {
  const layers = layersForPath(path);
  const outgoingCalls = maps.outgoingCallsByPath.get(path) ?? [];
  const incomingCalls = maps.incomingCallsByApiPath.get(path) ?? [];
  const incomingImports = maps.incomingImportsByPath.get(path) ?? [];
  const dbNames = maps.dbClientsByPath.get(path) ?? [];
  const externalNames = maps.externalServicesByPath.get(path) ?? [];

  if (layers.includes("UI") && outgoingCalls.length > 0) {
    return {
      reason: `${compactPath(path)}가 대표 화면 흐름의 시작점이라 먼저 보는 편이 빠릅니다.`,
      evidence: `대표 흐름 우선 파일: ${compactPath(path)}`,
    };
  }

  if (layers.includes("Logic") && incomingImports.some((item) => item.sourceLayers.includes("UI"))) {
    return {
      reason: `${compactPath(path)}가 화면에서 직접 호출되는 로직이라 우선 배치했습니다.`,
      evidence: `대표 흐름 연결 로직: ${compactPath(path)}`,
    };
  }

  if (layers.includes("API") && incomingCalls.length > 0) {
    return {
      reason: `${compactPath(path)}가 대표 요청 흐름과 직접 연결돼 있어 우선 배치했습니다.`,
      evidence: `대표 요청 파일: ${compactPath(path)}`,
    };
  }

  if (layers.includes("Logic") && incomingImports.some((item) => item.sourceLayers.includes("API"))) {
    return {
      reason: `${compactPath(path)}가 API 뒤에서 바로 호출되는 로직이라 우선 배치했습니다.`,
      evidence: `API 연결 로직: ${compactPath(path)}`,
    };
  }

  if (dbNames.length > 0) {
    return {
      reason: `${compactPath(path)}에서 데이터 연결이 확인돼 수정 시작점으로 우선 배치했습니다.`,
      evidence: `데이터 연결 파일: ${compactPath(path)}`,
    };
  }

  if (externalNames.length > 0) {
    return {
      reason: `${compactPath(path)}에서 외부 연동이 확인돼 수정 시작점으로 우선 배치했습니다.`,
      evidence: `외부 연동 파일: ${compactPath(path)}`,
    };
  }

  return null;
}

function buildSupplementalSemanticKeyFile(args: {
  path: string;
  incomingImportsByPath: Map<string, InternalImportLink[]>;
}) : KeyFileInfo {
  const relatedLayers = layersForPath(args.path);
  const incomingImports = args.incomingImportsByPath.get(args.path) ?? [];
  const uiImporters = unique(
    incomingImports
      .filter((item) => item.sourceLayers.includes("UI"))
      .map((item) => compactPath(item.sourcePath))
  );
  const apiImporters = unique(
    incomingImports
      .filter((item) => item.sourceLayers.includes("API"))
      .map((item) => compactPath(item.sourcePath))
  );

  if (relatedLayers.includes("Logic")) {
    const role =
      uiImporters.length > 0 && apiImporters.length === 0
        ? "화면 연결 로직 파일"
        : apiImporters.length > 0 && uiImporters.length === 0
          ? "서버 처리 로직 파일"
          : uiImporters.length > 0 || apiImporters.length > 0
            ? "공통 처리 로직 파일"
            : "핵심 로직 파일";
    const whyImportant =
      uiImporters.length > 0 && apiImporters.length === 0
        ? `${uiImporters.join(", ")} 화면이 직접 가져오는 로직이라 사용자 흐름을 따라 읽을 때 중요합니다.`
        : apiImporters.length > 0 && uiImporters.length === 0
          ? `${apiImporters.join(", ")} API가 직접 호출하는 로직이라 서버 처리 흐름을 이해하는 데 중요합니다.`
          : uiImporters.length > 0 || apiImporters.length > 0
            ? `${[...uiImporters, ...apiImporters].join(", ")} 흐름에 함께 연결된 공통 로직입니다.`
            : "대표 흐름과 직접 연결된 로직 파일이라 실제 동작을 이해하는 데 중요합니다.";

    return {
      path: args.path,
      role,
      whyImportant,
      readOrder: 0,
      evidence: unique([
        `경로: ${args.path}`,
        uiImporters.length > 0 ? `화면 사용 지점: ${uiImporters.join(", ")}` : null,
        apiImporters.length > 0 ? `API 사용 지점: ${apiImporters.join(", ")}` : null,
      ].filter(Boolean) as string[]),
      relatedLayers,
    };
  }

  return {
    path: args.path,
    role: "핵심 구조 파일",
    whyImportant: "대표 흐름에서 직접 연결된 파일이라 구조를 따라 읽을 때 확인할 가치가 큽니다.",
    readOrder: 0,
    evidence: [`경로: ${args.path}`],
    relatedLayers,
  };
}

export function applySemanticHintsToKeyFiles(
  keyFiles: KeyFileInfo[],
  signals: SemanticSignals,
  projectType?: string | null
) {
  const maps = buildSemanticFlowMaps(signals);

  const supplementalPaths = unique([
    ...signals.uiLogicLinks.map((item) => item.targetPath),
    ...signals.apiLogicLinks.map((item) => item.targetPath),
  ])
    .filter((path) => !keyFiles.some((file) => file.path === path))
    .slice(0, Math.max(0, 10 - keyFiles.length));
  const enrichedKeyFiles = [
    ...keyFiles,
    ...supplementalPaths.map((path) =>
      buildSupplementalSemanticKeyFile({
        path,
        incomingImportsByPath: maps.incomingImportsByPath,
      })
    ),
  ];
  const originalReadOrderByPath = new Map(enrichedKeyFiles.map((file, index) => [file.path, index]));
  const rankedKeyFiles = [...enrichedKeyFiles].sort(
    (left, right) =>
      (semanticPathScore(right.path, maps) + keyFileStructuralAdjustment(right, projectType)) -
        (semanticPathScore(left.path, maps) + keyFileStructuralAdjustment(left, projectType)) ||
      (originalReadOrderByPath.get(left.path) ?? 0) - (originalReadOrderByPath.get(right.path) ?? 0) ||
      left.path.localeCompare(right.path)
  );

  return rankedKeyFiles.map((file, index) => {
    let role = file.role;
    const evidence = [...file.evidence];
    const extraWhy: string[] = [];
    const routeMethods = maps.routeMethodsByPath.get(file.path) ?? [];
    const dbNames = maps.dbClientsByPath.get(file.path) ?? [];
    const externalNames = maps.externalServicesByPath.get(file.path) ?? [];
    const incomingImports = maps.incomingImportsByPath.get(file.path) ?? [];
    const outgoingImports = maps.outgoingImportsByPath.get(file.path) ?? [];
    const outgoingCalls = maps.outgoingCallsByPath.get(file.path) ?? [];
    const incomingCalls = maps.incomingCallsByApiPath.get(file.path) ?? [];
    const uiImporters = unique(
      incomingImports
        .filter((item) => item.sourceLayers.includes("UI"))
        .map((item) => compactPath(item.sourcePath))
    );
    const apiImporters = unique(
      incomingImports
        .filter((item) => item.sourceLayers.includes("API"))
        .map((item) => compactPath(item.sourcePath))
    );
    const logicTargets = unique(
      outgoingImports
        .filter((item) => item.targetLayers.includes("Logic"))
        .map((item) => compactPath(item.targetPath))
    );
    const logicTargetPaths = unique(
      outgoingImports
        .filter((item) => item.targetLayers.includes("Logic"))
        .map((item) => item.targetPath)
    );
    const downstreamFromLogicTargets =
      logicTargetPaths.length > 0
        ? collectIntegrationSurfaceForPaths(logicTargetPaths, maps, 2)
        : { names: [], dbNames: [], externalNames: [], detailLines: [], touchedPaths: [] };
    const downstreamFromCurrentFile = collectIntegrationSurfaceFromPath(file.path, maps, 2);

    if (file.relatedLayers.includes("API") && routeMethods.length > 0) {
      role =
        routeMethods.length === 1
          ? `${routeMethods[0]} 요청 처리 진입점`
          : `API 진입점 (${routeMethods.slice(0, 2).join("/")})`;
      extraWhy.push(`이 파일이 ${routeMethods.join(", ")} 요청을 직접 처리합니다.`);
      evidence.push(`처리 메서드: ${routeMethods.join(", ")}`);
    }

    if (file.relatedLayers.includes("DB") && dbNames.length === 1) {
      role = `${dbNames[0]} 연결 파일`;
    }

    if (file.relatedLayers.includes("External") && externalNames.length === 1) {
      role = `${externalNames[0]} 연동 파일`;
    }

    if (file.relatedLayers.includes("Logic")) {
      if (uiImporters.length > 0 && apiImporters.length === 0) {
        role = "화면 연결 로직 파일";
      } else if (apiImporters.length > 0 && uiImporters.length === 0) {
        role = "서버 처리 로직 파일";
      } else if (uiImporters.length > 0 || apiImporters.length > 0) {
        role = "공통 처리 로직 파일";
      }
    }

    if (dbNames.length > 0) {
      extraWhy.push(`${dbNames.join(", ")} 사용이 대표 코드에서 확인됩니다.`);
      evidence.push(`데이터 클라이언트: ${dbNames.join(", ")}`);
    }

    if (externalNames.length > 0) {
      extraWhy.push(`${externalNames.join(", ")} 연동이 대표 코드에서 확인됩니다.`);
      evidence.push(`외부 서비스: ${externalNames.join(", ")}`);
    }

    if (uiImporters.length > 0) {
      extraWhy.push(`${uiImporters.join(", ")}에서 이 파일을 직접 가져와 사용합니다.`);
      evidence.push(`화면 사용 지점: ${uiImporters.join(", ")}`);
    }

    if (apiImporters.length > 0) {
      extraWhy.push(`${apiImporters.join(", ")}에서 이 파일을 직접 가져와 처리 흐름에 포함합니다.`);
      evidence.push(`API 사용 지점: ${apiImporters.join(", ")}`);
    }

    if (file.relatedLayers.includes("UI") && logicTargets.length > 0) {
      extraWhy.push(`이 화면은 ${logicTargets.join(", ")} 같은 로직 파일과 직접 연결됩니다.`);
      evidence.push(`내부 로직 import: ${logicTargets.join(", ")}`);
    }

    if (file.relatedLayers.includes("API") && logicTargets.length > 0) {
      extraWhy.push(`이 API는 ${logicTargets.join(", ")} 로직을 함께 사용합니다.`);
      evidence.push(`연결 로직: ${logicTargets.join(", ")}`);
    }

    if (file.relatedLayers.includes("API") && downstreamFromLogicTargets.names.length > 0) {
      extraWhy.push(
        `이 API는 ${logicTargets.join(", ")} 로직을 거쳐 ${downstreamFromLogicTargets.names.join(", ")} 연결로 이어집니다.`
      );
      evidence.push(`연결 후 연동: ${downstreamFromLogicTargets.names.join(", ")}`);
    }

    if (
      file.relatedLayers.includes("Logic") &&
      (uiImporters.length > 0 || apiImporters.length > 0) &&
      downstreamFromCurrentFile.names.length > 0
    ) {
      extraWhy.push(`이 로직은 ${downstreamFromCurrentFile.names.join(", ")} 연결과 직접 이어집니다.`);
      evidence.push(`하위 연동: ${downstreamFromCurrentFile.names.join(", ")}`);
    }

    if (outgoingCalls.length > 0) {
      const endpoints = unique(outgoingCalls.map((call) => call.endpoint));
      extraWhy.push(`이 파일에서 ${endpoints.join(", ")} 요청이 시작됩니다.`);
      evidence.push(`내부 API 호출: ${endpoints.join(", ")}`);
    }

    if (incomingCalls.length > 0) {
      const callers = unique(incomingCalls.map((call) => compactPath(call.sourcePath)));
      const endpoints = unique(incomingCalls.map((call) => call.endpoint));
      extraWhy.push(`${callers.join(", ")}에서 ${endpoints.join(", ")} 경로로 이 파일에 연결됩니다.`);
      evidence.push(`호출 진입: ${callers.join(", ")}`);
    }

    return {
      ...file,
      readOrder: index + 1,
      role,
      whyImportant: appendSentences(file.whyImportant, extraWhy),
      evidence: unique(evidence),
    };
  });
}

export function applySemanticHintsToEditGuides(
  editGuides: EditGuideInfo[],
  signals: SemanticSignals
) {
  const maps = buildSemanticFlowMaps(signals);
  const originalGuideOrder = new Map(editGuides.map((guide, index) => [guide.intent, index]));
  const rankedGuides = [...editGuides]
    .map((guide) => {
      const originalFileOrder = new Map(guide.files.map((path, index) => [path, index]));
      const files = [...guide.files].sort(
        (left, right) =>
          semanticPathScore(right, maps) - semanticPathScore(left, maps) ||
          (originalFileOrder.get(left) ?? 0) - (originalFileOrder.get(right) ?? 0) ||
          left.localeCompare(right)
      );
      const topSemanticFile = files.find((path) => semanticPathScore(path, maps) > 0) ?? null;
      const priority = topSemanticFile ? semanticGuidePriority(topSemanticFile, maps) : null;
      const reason = priority ? appendSentences(guide.reason, [priority.reason]) : guide.reason;
      const evidence = priority ? unique([priority.evidence, ...guide.evidence]) : guide.evidence;
      const guideScore = Math.max(0, ...files.map((path) => semanticPathScore(path, maps)));

      return {
        ...guide,
        files,
        reason,
        evidence,
        _semanticScore: guideScore,
      };
    })
    .sort(
      (left, right) =>
        right._semanticScore - left._semanticScore ||
        (originalGuideOrder.get(left.intent) ?? 0) - (originalGuideOrder.get(right.intent) ?? 0) ||
        left.intent.localeCompare(right.intent)
    );

  return rankedGuides.map((guide) => ({
    intent: guide.intent,
    files: guide.files,
    reason: guide.reason,
    evidence: guide.evidence,
    relatedLayers: guide.relatedLayers,
  }));
}

export function mergeSemanticKeyFeatures(baseFeatures: string[], signals: SemanticSignals) {
  const hasSemanticDbFeature = signals.keyFeatures.some((feature) => /연결 확인$/.test(feature));
  const hasSemanticExternalFeature = signals.keyFeatures.some((feature) => /연동 확인$/.test(feature));
  const rankBaseFeature = (feature: string) => {
    if (/^워크스페이스 \d+개 감지$/.test(feature)) return 100;
    if (feature === "공용 패키지 + 앱 분리 구조") return 96;
    if (feature === "페이지 기반 진입 구조") return 92;
    if (feature === "재사용 컴포넌트 구조") return 88;
    if (feature === "라이브러리 진입점") return 84;
    if (feature === "명령줄 실행 흐름") return 82;
    if (feature === "운영 문서 중심 구조") return 80;
    if (feature === "자동화/검증 스크립트 포함") return 78;
    if (feature === "재사용 템플릿 포함") return 76;
    if (feature === "여러 예제 앱 포함") return 74;
    if (feature === "컴포넌트 패키지 중심 구조") return 72;
    if (feature === "문서/쇼케이스 앱 동반") return 70;
    if (feature === "서버 요청 처리") return 52;
    if (feature === "데이터 저장/조회") return 28;
    if (feature === "외부 서비스 연동") return 24;
    if (feature === "유틸리티 기반 스타일링") return 16;
    return 40;
  };

  const filteredBaseFeatures = baseFeatures.filter((feature) => {
    if (feature === "외부 서비스 연동" && hasSemanticExternalFeature) {
      return false;
    }

    if (feature === "데이터 저장/조회" && hasSemanticDbFeature) {
      return false;
    }

    return true;
  });
  const orderedBaseFeatures = [...filteredBaseFeatures].sort(
    (left, right) => rankBaseFeature(right) - rankBaseFeature(left) || baseFeatures.indexOf(left) - baseFeatures.indexOf(right)
  );

  return unique([...signals.keyFeatures, ...orderedBaseFeatures]).slice(0, 5);
}
