import fs from "node:fs/promises";

const casesPath = new URL("./compare-regression-cases.json", import.meta.url);

async function discoverBaseUrl() {
  if (process.env.ANALYZE_BASE_URL) {
    return process.env.ANALYZE_BASE_URL;
  }

  const candidates = ["http://localhost:3000", "http://localhost:3001"];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: "text/html",
        },
      });

      if (response.ok) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    "No local analyze server found. Start `pnpm dev` or set ANALYZE_BASE_URL explicitly."
  );
}

async function loadCases() {
  const raw = await fs.readFile(casesPath, "utf8");
  return JSON.parse(raw);
}

function arrayify(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function ordered(values) {
  return [...new Set(values)];
}

function diffValues(aValues, bValues) {
  const aOrdered = ordered(aValues);
  const bOrdered = ordered(bValues);
  const aSet = new Set(aOrdered);
  const bSet = new Set(bOrdered);

  return {
    common: aOrdered.filter((value) => bSet.has(value)),
    onlyA: aOrdered.filter((value) => !bSet.has(value)),
    onlyB: bOrdered.filter((value) => !aSet.has(value)),
  };
}

function buildLayerCountMap(analysis) {
  const counts = new Map();

  for (const layer of analysis.layers) {
    counts.set(layer.name, layer.fileCount);
  }

  if (analysis.coverage.unclassifiedCodeFileCount > 0) {
    counts.set("Code", analysis.coverage.unclassifiedCodeFileCount);
  }

  return counts;
}

function buildRuntimeMap(analysis) {
  const runtimes = new Map();

  for (const runtime of analysis.learning.environment.runtimes) {
    if (!runtimes.has(runtime.name)) {
      runtimes.set(runtime.name, {
        version: runtime.version ?? null,
        minMajor: runtime.minMajor ?? null,
        maxMajor: runtime.maxMajor ?? null,
        range: runtime.range ?? "unknown",
      });
    }
  }

  return runtimes;
}

function normalizeVersion(version) {
  return version === null ? null : String(version).replace(/\s+/g, "").toLowerCase();
}

function runtimeMatch(aRuntime, bRuntime) {
  if (!aRuntime || !bRuntime) {
    return aRuntime ? "onlyA" : "onlyB";
  }

  if (aRuntime.version === null || bRuntime.version === null) {
    return "both";
  }

  const sameRange =
    aRuntime.minMajor === bRuntime.minMajor &&
    aRuntime.maxMajor === bRuntime.maxMajor &&
    aRuntime.range === bRuntime.range;

  if (sameRange) {
    return "both";
  }

  return normalizeVersion(aRuntime.version) === normalizeVersion(bRuntime.version)
    ? "both"
    : "different";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildServiceMap(analysis) {
  const cloud = analysis.learning.environment.cloud;
  const details =
    cloud.servicesRequiredDetails?.length
      ? cloud.servicesRequiredDetails
      : cloud.servicesRequired.map((label) => ({
          label,
          canonicalId: slugify(label),
        }));
  const services = new Map();

  for (const service of details) {
    if (!services.has(service.canonicalId)) {
      services.set(service.canonicalId, service.label);
    }
  }

  return services;
}

function diffServiceMaps(aServices, bServices) {
  const common = [];
  const onlyA = [];
  const onlyB = [];

  for (const [canonicalId, label] of aServices.entries()) {
    if (bServices.has(canonicalId)) {
      common.push(label);
      continue;
    }
    onlyA.push(label);
  }

  for (const [canonicalId, label] of bServices.entries()) {
    if (!aServices.has(canonicalId)) {
      onlyB.push(label);
    }
  }

  return {
    common: ordered(common),
    onlyA: ordered(onlyA),
    onlyB: ordered(onlyB),
  };
}

function dockerMode(a, b) {
  if (a && b) return "both";
  if (a) return "onlyA";
  if (b) return "onlyB";
  return "none";
}

function deployMode(a, b) {
  if (a.length === 0 && b.length === 0) return "none";
  if (a.length > 0 && b.length === 0) return "onlyA";
  if (a.length === 0 && b.length > 0) return "onlyB";
  const shared = a.filter((value) => b.includes(value));
  return shared.length > 0 ? "shared" : "different";
}

function buildWarnings(aUrl, bUrl) {
  const warnings = [];
  if (aUrl === bUrl) {
    warnings.push("두 레포를 동일하게 입력했어요.");
  }
  return warnings;
}

function buildCompareSummary(a, b) {
  const stack = diffValues(a.summary.stack, b.summary.stack);
  const aLayers = buildLayerCountMap(a);
  const bLayers = buildLayerCountMap(b);
  const layerNames = ordered([...aLayers.keys(), ...bLayers.keys()]);
  const sharedLayers = layerNames.filter((name) => (aLayers.get(name) ?? 0) > 0 && (bLayers.get(name) ?? 0) > 0);
  const onlyALayers = layerNames.filter((name) => (aLayers.get(name) ?? 0) > 0 && (bLayers.get(name) ?? 0) === 0);
  const onlyBLayers = layerNames.filter((name) => (bLayers.get(name) ?? 0) > 0 && (aLayers.get(name) ?? 0) === 0);

  const aRuntimes = buildRuntimeMap(a);
  const bRuntimes = buildRuntimeMap(b);
  const runtimeNames = ordered([...aRuntimes.keys(), ...bRuntimes.keys()]);
  const runtimeDifferent = [];
  const runtimeOnlyA = [];
  const runtimeOnlyB = [];

  for (const name of runtimeNames) {
    const aRuntime = aRuntimes.get(name);
    const bRuntime = bRuntimes.get(name);
    const match = runtimeMatch(aRuntime, bRuntime);

    if (match === "different") runtimeDifferent.push(name);
    if (match === "onlyA") runtimeOnlyA.push(name);
    if (match === "onlyB") runtimeOnlyB.push(name);
  }

  const services = diffServiceMaps(buildServiceMap(a), buildServiceMap(b));

  return {
    warnings: buildWarnings(a.repo.url, b.repo.url),
    commonStack: stack.common,
    onlyAStack: stack.onlyA,
    onlyBStack: stack.onlyB,
    sharedLayers,
    onlyALayers,
    onlyBLayers,
    runtimeNames,
    runtimeDifferent,
    runtimeOnlyA,
    runtimeOnlyB,
    dockerMode: dockerMode(
      a.learning.environment.container.hasDockerfile || a.learning.environment.container.hasDockerCompose,
      b.learning.environment.container.hasDockerfile || b.learning.environment.container.hasDockerCompose
    ),
    deployMode: deployMode(
      ordered(a.learning.environment.cloud.deployTargets),
      ordered(b.learning.environment.cloud.deployTargets)
    ),
    servicesCommon: services.common,
    servicesOnlyA: services.onlyA,
    servicesOnlyB: services.onlyB,
  };
}

async function analyze(baseUrl, repoUrl) {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repoUrl, forceRefresh: true }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload.ok ? "Unknown error" : payload.error,
    };
  }

  return {
    ok: true,
    analysis: payload.data,
  };
}

function compareExpectations(result, expect) {
  const failures = [];

  if (expect.aKindIn && !arrayify(expect.aKindIn).includes(result.aKind)) {
    failures.push(`aKind expected one of ${arrayify(expect.aKindIn).join(", ")} but got ${String(result.aKind)}`);
  }

  if (expect.bKindIn && !arrayify(expect.bKindIn).includes(result.bKind)) {
    failures.push(`bKind expected one of ${arrayify(expect.bKindIn).join(", ")} but got ${String(result.bKind)}`);
  }

  if (expect.compareEligible !== undefined && result.compareEligible !== expect.compareEligible) {
    failures.push(`compareEligible expected ${String(expect.compareEligible)} but got ${String(result.compareEligible)}`);
  }

  if (!result.compareEligible) {
    return failures;
  }

  for (const warning of arrayify(expect.warningsContain)) {
    if (!result.warnings.includes(warning)) {
      failures.push(`warnings expected to include ${warning}`);
    }
  }

  for (const stack of arrayify(expect.commonStackContain)) {
    if (!result.commonStack.includes(stack)) {
      failures.push(`commonStack expected to include ${stack}`);
    }
  }

  for (const stack of arrayify(expect.onlyAStackContain)) {
    if (!result.onlyAStack.includes(stack)) {
      failures.push(`onlyAStack expected to include ${stack}`);
    }
  }

  for (const stack of arrayify(expect.onlyBStackContain)) {
    if (!result.onlyBStack.includes(stack)) {
      failures.push(`onlyBStack expected to include ${stack}`);
    }
  }

  for (const layer of arrayify(expect.sharedLayersContain)) {
    if (!result.sharedLayers.includes(layer)) {
      failures.push(`sharedLayers expected to include ${layer}`);
    }
  }

  for (const layer of arrayify(expect.onlyALayersContain)) {
    if (!result.onlyALayers.includes(layer)) {
      failures.push(`onlyALayers expected to include ${layer}`);
    }
  }

  for (const layer of arrayify(expect.onlyBLayersContain)) {
    if (!result.onlyBLayers.includes(layer)) {
      failures.push(`onlyBLayers expected to include ${layer}`);
    }
  }

  for (const runtime of arrayify(expect.runtimeNamesContain)) {
    if (!result.runtimeNames.includes(runtime)) {
      failures.push(`runtimeNames expected to include ${runtime}`);
    }
  }

  for (const runtime of arrayify(expect.runtimeDifferentContain)) {
    if (!result.runtimeDifferent.includes(runtime)) {
      failures.push(`runtimeDifferent expected to include ${runtime}`);
    }
  }

  for (const runtime of arrayify(expect.runtimeOnlyAContain)) {
    if (!result.runtimeOnlyA.includes(runtime)) {
      failures.push(`runtimeOnlyA expected to include ${runtime}`);
    }
  }

  for (const runtime of arrayify(expect.runtimeOnlyBContain)) {
    if (!result.runtimeOnlyB.includes(runtime)) {
      failures.push(`runtimeOnlyB expected to include ${runtime}`);
    }
  }

  for (const service of arrayify(expect.servicesCommonContain)) {
    if (!result.servicesCommon.includes(service)) {
      failures.push(`servicesCommon expected to include ${service}`);
    }
  }

  for (const service of arrayify(expect.servicesOnlyAContain)) {
    if (!result.servicesOnlyA.includes(service)) {
      failures.push(`servicesOnlyA expected to include ${service}`);
    }
  }

  for (const service of arrayify(expect.servicesOnlyBContain)) {
    if (!result.servicesOnlyB.includes(service)) {
      failures.push(`servicesOnlyB expected to include ${service}`);
    }
  }

  if (expect.dockerModeIn && !arrayify(expect.dockerModeIn).includes(result.dockerMode)) {
    failures.push(`dockerMode expected one of ${arrayify(expect.dockerModeIn).join(", ")} but got ${result.dockerMode}`);
  }

  if (expect.deployModeIn && !arrayify(expect.deployModeIn).includes(result.deployMode)) {
    failures.push(`deployMode expected one of ${arrayify(expect.deployModeIn).join(", ")} but got ${result.deployMode}`);
  }

  return failures;
}

async function main() {
  const baseUrl = await discoverBaseUrl();
  const cases = await loadCases();
  const results = [];
  let hasFailures = false;

  for (const testCase of cases) {
    const [aResult, bResult] = await Promise.all([
      analyze(baseUrl, testCase.a),
      analyze(baseUrl, testCase.b),
    ]);

    if (!aResult.ok || !bResult.ok) {
      const result = {
        name: testCase.name,
        a: testCase.a,
        b: testCase.b,
        ok: false,
        failures: [
          !aResult.ok ? `A failed with status ${aResult.status ?? "?"}` : null,
          !bResult.ok ? `B failed with status ${bResult.status ?? "?"}` : null,
        ].filter(Boolean),
        aError: aResult.ok ? null : aResult.error,
        bError: bResult.ok ? null : bResult.error,
      };
      results.push(result);
      hasFailures = true;
      continue;
    }

    const analysisA = aResult.analysis;
    const analysisB = bResult.analysis;
    const compareEligible = analysisA.kind === "repo" && analysisB.kind === "repo";
    const summary = compareEligible ? buildCompareSummary(analysisA, analysisB) : null;
    const result = {
      name: testCase.name,
      a: testCase.a,
      b: testCase.b,
      ok: true,
      aKind: analysisA.kind,
      bKind: analysisB.kind,
      compareEligible,
      ...(summary ?? {}),
    };

    const failures = compareExpectations(result, testCase.expect ?? {});
    if (failures.length > 0) {
      result.ok = false;
      result.failures = failures;
      hasFailures = true;
    }

    results.push(result);
  }

  console.log(JSON.stringify(results, null, 2));

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
