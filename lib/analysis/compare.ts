import type { LayerName, RepoAnalysis, RepoEnvRuntime } from "@/lib/analysis/types";
import { validateGitHubTargetUrlInput } from "@/lib/analysis/validators";

export type CompareLayerKey = LayerName | "Code";

export type CompareDiff = {
  repos: {
    a: RepoAnalysis;
    b: RepoAnalysis;
  };
  stack: {
    common: string[];
    onlyA: string[];
    onlyB: string[];
  };
  layers: {
    rows: Array<{
      layer: CompareLayerKey;
      aCount: number;
      bCount: number;
      shared: boolean;
    }>;
  };
  env: {
    runtimes: Array<{
      name: RepoEnvRuntime["name"];
      aVersion: string | null;
      bVersion: string | null;
      aMinMajor?: number | null;
      aMaxMajor?: number | null;
      bMinMajor?: number | null;
      bMaxMajor?: number | null;
      aRange?: RepoEnvRuntime["range"] | null;
      bRange?: RepoEnvRuntime["range"] | null;
      match: "both" | "onlyA" | "onlyB" | "different";
    }>;
    dockerA: boolean;
    dockerB: boolean;
    dockerRoleA?: RepoAnalysis["learning"]["environment"]["container"]["dockerRole"];
    dockerRoleB?: RepoAnalysis["learning"]["environment"]["container"]["dockerRole"];
    servicesCommon: string[];
    servicesOnlyA: string[];
    servicesOnlyB: string[];
    deployA: string[];
    deployB: string[];
  };
  warnings: string[];
};

export type ValidatedCompareRepoTarget = {
  owner: string;
  repo: string;
  canonicalUrl: string;
  label: string;
};

const LAYER_ORDER: CompareLayerKey[] = ["UI", "Logic", "API", "DB", "External", "Code"];
const RUNTIME_ORDER: RepoEnvRuntime["name"][] = [
  "node",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "bun",
  "deno",
];

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeVersion(value: string | null) {
  return value?.replace(/\s+/g, "").toLowerCase() ?? null;
}

function normalizeRangeValue(value: RepoEnvRuntime["range"] | null | undefined) {
  return value ?? "unknown";
}

function fallbackRuntimeShape(runtime: RepoEnvRuntime) {
  const version = normalizeVersion(runtime.version);
  if (!version || !/\d/.test(version) || /nightly|canary|latest/i.test(version)) {
    return {
      minMajor: runtime.minMajor ?? null,
      maxMajor: runtime.maxMajor ?? null,
      range: normalizeRangeValue(runtime.range),
    };
  }

  const parseMajor = (input: string) => {
    const match = input.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };
  const parts = version
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
    } satisfies {
      minMajor: number | null;
      maxMajor: number | null;
      range: RepoEnvRuntime["range"];
    };
  }

  const exactMajor = parseMajor(version);
  if (exactMajor === null) {
    return {
      minMajor: runtime.minMajor ?? null,
      maxMajor: runtime.maxMajor ?? null,
      range: normalizeRangeValue(runtime.range),
    };
  }

  return {
    minMajor: exactMajor,
    maxMajor: exactMajor,
    range: "exact",
  } satisfies {
    minMajor: number | null;
    maxMajor: number | null;
    range: RepoEnvRuntime["range"];
  };
}

function runtimeShape(runtime: RepoEnvRuntime) {
  const fallback = fallbackRuntimeShape(runtime);
  return {
    version: runtime.version,
    minMajor: runtime.minMajor ?? fallback.minMajor,
    maxMajor: runtime.maxMajor ?? fallback.maxMajor,
    range: normalizeRangeValue(runtime.range) ?? fallback.range,
  };
}

function orderedSet(values: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  values.forEach((value) => {
    const key = normalizeToken(value);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    ordered.push(value);
  });

  return ordered;
}

function diffValues(aValues: string[], bValues: string[]) {
  const aOrdered = orderedSet(aValues);
  const bOrdered = orderedSet(bValues);
  const aSet = new Set(aOrdered.map((value) => normalizeToken(value)));
  const bSet = new Set(bOrdered.map((value) => normalizeToken(value)));

  return {
    common: aOrdered.filter((value) => bSet.has(normalizeToken(value))),
    onlyA: aOrdered.filter((value) => !bSet.has(normalizeToken(value))),
    onlyB: bOrdered.filter((value) => !aSet.has(normalizeToken(value))),
  };
}

function buildLayerCountMap(analysis: RepoAnalysis) {
  const counts = new Map<CompareLayerKey, number>();

  analysis.layers.forEach((layer) => {
    counts.set(layer.name, layer.fileCount);
  });

  if (analysis.coverage.unclassifiedCodeFileCount > 0) {
    counts.set("Code", analysis.coverage.unclassifiedCodeFileCount);
  }

  return counts;
}

function buildRuntimeMap(analysis: RepoAnalysis) {
  const runtimes = new Map<
    RepoEnvRuntime["name"],
    {
      version: string | null;
      minMajor: number | null;
      maxMajor: number | null;
      range: RepoEnvRuntime["range"];
    }
  >();

  analysis.learning.environment.runtimes.forEach((runtime) => {
    if (!runtimes.has(runtime.name)) {
      runtimes.set(runtime.name, runtimeShape(runtime));
    }
  });

  return runtimes;
}

function runtimeMatchForCompare(args: {
  a: { version: string | null; minMajor: number | null; maxMajor: number | null; range: RepoEnvRuntime["range"] } | null;
  b: { version: string | null; minMajor: number | null; maxMajor: number | null; range: RepoEnvRuntime["range"] } | null;
}): CompareDiff["env"]["runtimes"][number]["match"] {
  if (!args.a || !args.b) {
    return args.a ? "onlyA" : "onlyB";
  }

  if (args.a.version === null || args.b.version === null) {
    return "both";
  }

  const sameRange =
    args.a.minMajor === args.b.minMajor &&
    args.a.maxMajor === args.b.maxMajor &&
    normalizeRangeValue(args.a.range) === normalizeRangeValue(args.b.range);

  if (sameRange) {
    return "both";
  }

  return normalizeVersion(args.a.version) === normalizeVersion(args.b.version) ? "both" : "different";
}

function buildServiceMap(analysis: RepoAnalysis) {
  const cloud = analysis.learning.environment.cloud;
  const details =
    cloud.servicesRequiredDetails?.length
      ? cloud.servicesRequiredDetails
      : cloud.servicesRequired.map((label) => ({
          label,
          canonicalId: normalizeToken(label).replace(/[^a-z0-9]+/g, "-"),
          kind: "other" as const,
        }));
  const services = new Map<string, string>();

  details.forEach((service) => {
    if (!services.has(service.canonicalId)) {
      services.set(service.canonicalId, service.label);
    }
  });

  return services;
}

function diffServiceMaps(aServices: Map<string, string>, bServices: Map<string, string>) {
  const common: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];

  aServices.forEach((label, canonicalId) => {
    if (bServices.has(canonicalId)) {
      common.push(label);
      return;
    }
    onlyA.push(label);
  });

  bServices.forEach((label, canonicalId) => {
    if (!aServices.has(canonicalId)) {
      onlyB.push(label);
    }
  });

  return {
    common: orderedSet(common),
    onlyA: orderedSet(onlyA),
    onlyB: orderedSet(onlyB),
  };
}

function sortRuntimeNames(names: Iterable<RepoEnvRuntime["name"]>) {
  return [...new Set(names)].sort((left, right) => {
    const leftIndex = RUNTIME_ORDER.indexOf(left);
    const rightIndex = RUNTIME_ORDER.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? RUNTIME_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? RUNTIME_ORDER.length : rightIndex;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

export function validateCompareRepoInput(input: string): ValidatedCompareRepoTarget {
  const validated = validateGitHubTargetUrlInput(input);

  if (validated.kind !== "repo") {
    throw new Error("비교 모드는 repo URL만 지원합니다.");
  }

  return {
    owner: validated.owner,
    repo: validated.repo,
    canonicalUrl: validated.canonicalUrl,
    label: `${validated.owner}/${validated.repo}`,
  };
}

export function buildCompareWarnings(aUrl: string, bUrl: string) {
  const warnings: string[] = [];

  if (aUrl === bUrl) {
    warnings.push("두 레포를 동일하게 입력했어요.");
  }

  return warnings;
}

export function buildCompareDiff(a: RepoAnalysis, b: RepoAnalysis): CompareDiff {
  const stack = diffValues(a.summary.stack, b.summary.stack);
  const aLayerCounts = buildLayerCountMap(a);
  const bLayerCounts = buildLayerCountMap(b);
  const layerRows = LAYER_ORDER
    .map((layer) => {
      const aCount = aLayerCounts.get(layer) ?? 0;
      const bCount = bLayerCounts.get(layer) ?? 0;
      return {
        layer,
        aCount,
        bCount,
        shared: aCount > 0 && bCount > 0,
      };
    })
    .filter((row) => row.aCount > 0 || row.bCount > 0);

  const aRuntimes = buildRuntimeMap(a);
  const bRuntimes = buildRuntimeMap(b);
  const runtimeRows = sortRuntimeNames([...aRuntimes.keys(), ...bRuntimes.keys()]).map((name) => {
    const aRuntime = aRuntimes.get(name) ?? null;
    const bRuntime = bRuntimes.get(name) ?? null;
    const aVersion = aRuntime?.version ?? null;
    const bVersion = bRuntime?.version ?? null;
    const match = runtimeMatchForCompare({
      a: aRuntime,
      b: bRuntime,
    });

    return {
      name,
      aVersion,
      bVersion,
      aMinMajor: aRuntime?.minMajor ?? null,
      aMaxMajor: aRuntime?.maxMajor ?? null,
      bMinMajor: bRuntime?.minMajor ?? null,
      bMaxMajor: bRuntime?.maxMajor ?? null,
      aRange: aRuntime?.range ?? "unknown",
      bRange: bRuntime?.range ?? "unknown",
      match,
    };
  });

  const aServices = buildServiceMap(a);
  const bServices = buildServiceMap(b);
  const services = diffServiceMaps(aServices, bServices);

  return {
    repos: {
      a,
      b,
    },
    stack,
    layers: {
      rows: layerRows,
    },
    env: {
      runtimes: runtimeRows,
      dockerA:
        a.learning.environment.container.hasDockerfile ||
        a.learning.environment.container.hasDockerCompose,
      dockerB:
        b.learning.environment.container.hasDockerfile ||
        b.learning.environment.container.hasDockerCompose,
      dockerRoleA: a.learning.environment.container.dockerRole ?? "none",
      dockerRoleB: b.learning.environment.container.dockerRole ?? "none",
      servicesCommon: services.common,
      servicesOnlyA: services.onlyA,
      servicesOnlyB: services.onlyB,
      deployA: orderedSet(a.learning.environment.cloud.deployTargets),
      deployB: orderedSet(b.learning.environment.cloud.deployTargets),
    },
    warnings: buildCompareWarnings(a.repo.url, b.repo.url),
  };
}
