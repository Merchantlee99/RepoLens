import fs from "node:fs/promises";

const casesPath = new URL("./analysis-regression-cases.json", import.meta.url);
const VALID_SCOPES = new Set(["repo", "owner", "all"]);
const VALID_FORCE_REFRESH_MODES = new Set(["all", "none", "repo-only", "owner-only"]);
const VALID_RATE_LIMIT_MODES = new Set(["fail", "soft", "owner-soft"]);

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

function regressionScope() {
  const scope = process.env.ANALYSIS_REGRESSION_SCOPE ?? "repo";
  if (!VALID_SCOPES.has(scope)) {
    throw new Error(
      `Unsupported ANALYSIS_REGRESSION_SCOPE: ${scope}. Expected one of ${[...VALID_SCOPES].join(", ")}`
    );
  }
  return scope;
}

function regressionForceRefreshMode() {
  const mode = process.env.ANALYSIS_REGRESSION_FORCE_REFRESH ?? "repo-only";
  if (!VALID_FORCE_REFRESH_MODES.has(mode)) {
    throw new Error(
      `Unsupported ANALYSIS_REGRESSION_FORCE_REFRESH: ${mode}. Expected one of ${[
        ...VALID_FORCE_REFRESH_MODES,
      ].join(", ")}`
    );
  }
  return mode;
}

function regressionRateLimitMode() {
  const mode = process.env.ANALYSIS_REGRESSION_RATE_LIMIT_MODE ?? "owner-soft";
  if (!VALID_RATE_LIMIT_MODES.has(mode)) {
    throw new Error(
      `Unsupported ANALYSIS_REGRESSION_RATE_LIMIT_MODE: ${mode}. Expected one of ${[
        ...VALID_RATE_LIMIT_MODES,
      ].join(", ")}`
    );
  }
  return mode;
}

function regressionMaxRetries() {
  const raw = process.env.ANALYSIS_REGRESSION_MAX_RETRIES ?? "1";
  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Unsupported ANALYSIS_REGRESSION_MAX_RETRIES: ${raw}. Expected a non-negative integer.`
    );
  }

  return value;
}

function regressionMaxWaitMs() {
  const raw = process.env.ANALYSIS_REGRESSION_MAX_WAIT_MS ?? "3000";
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Unsupported ANALYSIS_REGRESSION_MAX_WAIT_MS: ${raw}. Expected a non-negative number.`
    );
  }

  return value;
}

function regressionCaseFilters() {
  return (process.env.ANALYSIS_REGRESSION_CASE_FILTER ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayify(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function caseKinds(testCase) {
  const kinds = arrayify(testCase.expect?.kindIn);
  return kinds.length > 0 ? kinds : ["repo"];
}

function shouldIncludeCase(testCase, scope) {
  if (scope === "all") return true;
  return caseKinds(testCase).includes(scope);
}

function matchesCaseFilter(testCase, filters) {
  if (filters.length === 0) {
    return true;
  }

  const haystacks = [testCase.id, testCase.repoUrl, ...(arrayify(testCase.aliases) ?? [])]
    .filter((item) => typeof item === "string" && item.length > 0)
    .map((item) => item.toLowerCase());

  return filters.some((filter) => haystacks.some((item) => item.includes(filter.toLowerCase())));
}

function primaryCaseKind(testCase) {
  return caseKinds(testCase)[0] ?? "repo";
}

function shouldForceRefresh(testCase, mode) {
  const kind = primaryCaseKind(testCase);

  if (mode === "all") return true;
  if (mode === "none") return false;
  if (mode === "repo-only") return kind === "repo";
  if (mode === "owner-only") return kind === "owner";
  return true;
}

function shouldSoftBlockRateLimit(testCase, mode) {
  if (mode === "soft") return true;
  if (mode === "fail") return false;
  return primaryCaseKind(testCase) === "owner";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRetryDelayMs(error, maxWaitMs) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const retryAfterSeconds = Number(error.details?.retryAfterSeconds);

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    return null;
  }

  const delayMs = Math.ceil(retryAfterSeconds * 1000);

  if (delayMs === 0) {
    return 0;
  }

  return delayMs <= maxWaitMs ? delayMs : null;
}

function compareExpectations(result, expect) {
  const failures = [];

  if (expect.kindIn && !arrayify(expect.kindIn).includes(result.kind)) {
    failures.push(`kind expected one of ${arrayify(expect.kindIn).join(", ")} but got ${result.kind}`);
  }

  if (expect.warningsContain) {
    for (const warningCode of arrayify(expect.warningsContain)) {
      if (!result.warnings.includes(warningCode)) {
        failures.push(`warnings expected to include ${warningCode}`);
      }
    }
  }

  if (expect.warningsAbsent) {
    for (const warningCode of arrayify(expect.warningsAbsent)) {
      if (result.warnings.includes(warningCode)) {
        failures.push(`warnings expected to exclude ${warningCode}`);
      }
    }
  }

  if (expect.limitationsContain) {
    for (const limitationCode of arrayify(expect.limitationsContain)) {
      if (!result.limitations.includes(limitationCode)) {
        failures.push(`limitations expected to include ${limitationCode}`);
      }
    }
  }

  if (result.kind === "repo") {
    if (expect.projectTypeIn && !arrayify(expect.projectTypeIn).includes(result.projectType)) {
      failures.push(
        `projectType expected one of ${arrayify(expect.projectTypeIn).join(", ")} but got ${result.projectType}`
      );
    }

    if (expect.consumptionModeIn && !arrayify(expect.consumptionModeIn).includes(result.consumptionMode)) {
      failures.push(
        `consumptionMode expected one of ${arrayify(expect.consumptionModeIn).join(", ")} but got ${String(result.consumptionMode)}`
      );
    }

    if (expect.analysisModeIn && !arrayify(expect.analysisModeIn).includes(result.analysisMode)) {
      failures.push(
        `analysisMode expected one of ${arrayify(expect.analysisModeIn).join(", ")} but got ${result.analysisMode}`
      );
    }

    if (expect.focusRootEquals !== undefined && result.focusRoot !== expect.focusRootEquals) {
      failures.push(`focusRoot expected ${expect.focusRootEquals} but got ${String(result.focusRoot)}`);
    }

    if (
      expect.focusRootStartsWith &&
      (typeof result.focusRoot !== "string" || !result.focusRoot.startsWith(expect.focusRootStartsWith))
    ) {
      failures.push(
        `focusRoot expected prefix ${expect.focusRootStartsWith} but got ${String(result.focusRoot)}`
      );
    }

    if (expect.startFileIn && !arrayify(expect.startFileIn).includes(result.startFile)) {
      failures.push(
        `startFile expected one of ${arrayify(expect.startFileIn).join(", ")} but got ${String(result.startFile)}`
      );
    }

    if (expect.layerNamesContain) {
      for (const layerName of arrayify(expect.layerNamesContain)) {
        if (!result.layerNames.includes(layerName)) {
          failures.push(`layerNames expected to include ${layerName}`);
        }
      }
    }

    if (expect.layerNamesAbsent) {
      for (const layerName of arrayify(expect.layerNamesAbsent)) {
        if (result.layerNames.includes(layerName)) {
          failures.push(`layerNames expected to exclude ${layerName}`);
        }
      }
    }

    if (expect.keyFilesContain) {
      for (const keyFile of arrayify(expect.keyFilesContain)) {
        if (!result.keyFiles.includes(keyFile)) {
          failures.push(`keyFiles expected to include ${keyFile}`);
        }
      }
    }

    if (expect.firstKeyFileIn && !arrayify(expect.firstKeyFileIn).includes(result.keyFiles[0] ?? null)) {
      failures.push(
        `first key file expected one of ${arrayify(expect.firstKeyFileIn).join(", ")} but got ${String(result.keyFiles[0])}`
      );
    }

    if (expect.stackContain) {
      for (const stackItem of arrayify(expect.stackContain)) {
        if (!result.stack.includes(stackItem)) {
          failures.push(`stack expected to include ${stackItem}`);
        }
      }
    }

    if (expect.stackAbsent) {
      for (const stackItem of arrayify(expect.stackAbsent)) {
        if (result.stack.includes(stackItem)) {
          failures.push(`stack expected to exclude ${stackItem}`);
        }
      }
    }

    if (expect.inferenceIdsContain) {
      for (const inferenceId of arrayify(expect.inferenceIdsContain)) {
        if (!result.inferenceIds.includes(inferenceId)) {
          failures.push(`inferenceIds expected to include ${inferenceId}`);
        }
      }
    }

    if (expect.keyFeaturesContain) {
      for (const keyFeature of arrayify(expect.keyFeaturesContain)) {
        if (!result.keyFeatures.includes(keyFeature)) {
          failures.push(`keyFeatures expected to include ${keyFeature}`);
        }
      }
    }

    if (expect.keyFeaturesAbsent) {
      for (const keyFeature of arrayify(expect.keyFeaturesAbsent)) {
        if (result.keyFeatures.includes(keyFeature)) {
          failures.push(`keyFeatures expected to exclude ${keyFeature}`);
        }
      }
    }

    if (expect.oneLinerContain) {
      for (const snippet of arrayify(expect.oneLinerContain)) {
        if (typeof result.oneLiner !== "string" || !result.oneLiner.includes(snippet)) {
          failures.push(`oneLiner expected to contain ${snippet} but got ${String(result.oneLiner)}`);
        }
      }
    }

    if (expect.oneLinerAbsent) {
      for (const snippet of arrayify(expect.oneLinerAbsent)) {
        if (typeof result.oneLiner === "string" && result.oneLiner.includes(snippet)) {
          failures.push(`oneLiner expected to exclude ${snippet} but got ${String(result.oneLiner)}`);
        }
      }
    }

    if (expect.previewModeIn && !arrayify(expect.previewModeIn).includes(result.previewMode)) {
      failures.push(
        `previewMode expected one of ${arrayify(expect.previewModeIn).join(", ")} but got ${String(result.previewMode)}`
      );
    }

    if (expect.deployUrlContains) {
      for (const snippet of arrayify(expect.deployUrlContains)) {
        if (typeof result.deployUrl !== "string" || !result.deployUrl.includes(snippet)) {
          failures.push(`deployUrl expected to contain ${snippet} but got ${String(result.deployUrl)}`);
        }
      }
    }

    if (expect.deployUrlAbsent === true && result.deployUrl !== null) {
      failures.push(`deployUrl expected to be absent but got ${String(result.deployUrl)}`);
    }

    if (expect.usageRunContains) {
      for (const snippet of arrayify(expect.usageRunContains)) {
        if (!result.usageRun.some((item) => item.includes(snippet))) {
          failures.push(`usage.run expected to include a command containing ${snippet}`);
        }
      }
    }

    if (expect.coverageLevelIn && !arrayify(expect.coverageLevelIn).includes(result.coverageLevel)) {
      failures.push(
        `coverageLevel expected one of ${arrayify(expect.coverageLevelIn).join(", ")} but got ${String(result.coverageLevel)}`
      );
    }

    if (expect.coverageHeadlineContains) {
      for (const snippet of arrayify(expect.coverageHeadlineContains)) {
        if (
          typeof result.coverageHeadline !== "string" ||
          !result.coverageHeadline.includes(snippet)
        ) {
          failures.push(
            `coverageHeadline expected to contain ${snippet} but got ${String(result.coverageHeadline)}`
          );
        }
      }
    }

    if (expect.coverageDetailContains) {
      for (const snippet of arrayify(expect.coverageDetailContains)) {
        if (typeof result.coverageDetail !== "string" || !result.coverageDetail.includes(snippet)) {
          failures.push(
            `coverageDetail expected to contain ${snippet} but got ${String(result.coverageDetail)}`
          );
        }
      }
    }

    if (expect.coverageReasonsContain) {
      for (const snippet of arrayify(expect.coverageReasonsContain)) {
        if (!result.coverageReasons.some((item) => item.includes(snippet))) {
          failures.push(`coverageReasons expected one item containing ${snippet}`);
        }
      }
    }

    if (expect.coverageOmissionsContain) {
      for (const snippet of arrayify(expect.coverageOmissionsContain)) {
        if (!result.coverageOmissions.some((item) => item.includes(snippet))) {
          failures.push(`coverageOmissions expected one item containing ${snippet}`);
        }
      }
    }

    if (expect.coverageBasedOnContain) {
      for (const snippet of arrayify(expect.coverageBasedOnContain)) {
        if (!result.coverageBasedOn.some((item) => item.includes(snippet))) {
          failures.push(`coverageBasedOn expected one item containing ${snippet}`);
        }
      }
    }

    if (
      expect.coverageApproximateEquals !== undefined &&
      result.coverageApproximate !== expect.coverageApproximateEquals
    ) {
      failures.push(
        `coverageApproximate expected ${String(expect.coverageApproximateEquals)} but got ${String(result.coverageApproximate)}`
      );
    }

    if (expect.envRuntimeModeIn && !arrayify(expect.envRuntimeModeIn).includes(result.envRuntimeMode)) {
      failures.push(
        `envRuntimeMode expected one of ${arrayify(expect.envRuntimeModeIn).join(", ")} but got ${String(result.envRuntimeMode)}`
      );
    }

    if (expect.envDeployTargetsContain) {
      for (const target of arrayify(expect.envDeployTargetsContain)) {
        if (!result.envDeployTargets.includes(target)) {
          failures.push(`envDeployTargets expected to include ${target}`);
        }
      }
    }

    if (
      expect.envDeployTargetRequiredIn &&
      !arrayify(expect.envDeployTargetRequiredIn).includes(result.envDeployTargetRequired)
    ) {
      failures.push(
        `envDeployTargetRequired expected one of ${arrayify(expect.envDeployTargetRequiredIn).join(", ")} but got ${String(result.envDeployTargetRequired)}`
      );
    }

    if (expect.envDeployTargetRequiredAbsent === true && result.envDeployTargetRequired !== null) {
      failures.push(
        `envDeployTargetRequired expected to be absent but got ${String(result.envDeployTargetRequired)}`
      );
    }

    if (expect.envServicesRequiredContain) {
      for (const service of arrayify(expect.envServicesRequiredContain)) {
        if (!result.envServicesRequired.includes(service)) {
          failures.push(`envServicesRequired expected to include ${service}`);
        }
      }
    }

    if (expect.envServicesRequiredAbsent) {
      for (const service of arrayify(expect.envServicesRequiredAbsent)) {
        if (result.envServicesRequired.includes(service)) {
          failures.push(`envServicesRequired expected to exclude ${service}`);
        }
      }
    }

    if (expect.envServicesOptionalContain) {
      for (const service of arrayify(expect.envServicesOptionalContain)) {
        if (!result.envServicesOptional.includes(service)) {
          failures.push(`envServicesOptional expected to include ${service}`);
        }
      }
    }

    if (expect.envCostTierIn && !arrayify(expect.envCostTierIn).includes(result.envCostTier)) {
      failures.push(
        `envCostTier expected one of ${arrayify(expect.envCostTierIn).join(", ")} but got ${String(result.envCostTier)}`
      );
    }

    if (expect.envCostDriverKindsContain) {
      for (const kind of arrayify(expect.envCostDriverKindsContain)) {
        if (!result.envCostDriverKinds.includes(kind)) {
          failures.push(`envCostDriverKinds expected to include ${kind}`);
        }
      }
    }

    if (expect.envCostDriverKindsAbsent) {
      for (const kind of arrayify(expect.envCostDriverKindsAbsent)) {
        if (result.envCostDriverKinds.includes(kind)) {
          failures.push(`envCostDriverKinds expected to exclude ${kind}`);
        }
      }
    }

    if (
      expect.unclassifiedCodeFileCountMax !== undefined &&
      result.unclassifiedCodeFileCount > expect.unclassifiedCodeFileCountMax
    ) {
      failures.push(
        `unclassifiedCodeFileCount expected <= ${expect.unclassifiedCodeFileCountMax} but got ${result.unclassifiedCodeFileCount}`
      );
    }

    if (expect.unclassifiedCodeSamplesAbsent) {
      for (const path of arrayify(expect.unclassifiedCodeSamplesAbsent)) {
        if (result.unclassifiedCodeSamples.includes(path)) {
          failures.push(`unclassifiedCodeSamples expected to exclude ${path}`);
        }
      }
    }

    if (expect.identityTitleContains) {
      for (const snippet of arrayify(expect.identityTitleContains)) {
        if (typeof result.identityTitle !== "string" || !result.identityTitle.includes(snippet)) {
          failures.push(`identityTitle expected to contain ${snippet} but got ${String(result.identityTitle)}`);
        }
      }
    }

    if (expect.identitySubtitleContains) {
      for (const snippet of arrayify(expect.identitySubtitleContains)) {
        if (typeof result.identitySubtitle !== "string" || !result.identitySubtitle.includes(snippet)) {
          failures.push(
            `identitySubtitle expected to contain ${snippet} but got ${String(result.identitySubtitle)}`
          );
        }
      }
    }

    if (expect.identitySubtitleAbsent) {
      for (const snippet of arrayify(expect.identitySubtitleAbsent)) {
        if (typeof result.identitySubtitle === "string" && result.identitySubtitle.includes(snippet)) {
          failures.push(
            `identitySubtitle expected to exclude ${snippet} but got ${String(result.identitySubtitle)}`
          );
        }
      }
    }

    if (expect.identityPointsContain) {
      for (const snippet of arrayify(expect.identityPointsContain)) {
        if (!result.identityPoints.some((item) => item.includes(snippet))) {
          failures.push(`identityPoints expected one item containing ${snippet}`);
        }
      }
    }

    if (expect.identityPointsAbsent) {
      for (const snippet of arrayify(expect.identityPointsAbsent)) {
        if (result.identityPoints.some((item) => item.includes(snippet))) {
          failures.push(`identityPoints expected to exclude ${snippet}`);
        }
      }
    }

    if (
      expect.identityTrustSourceIn &&
      !arrayify(expect.identityTrustSourceIn).includes(result.identityTrustSource)
    ) {
      failures.push(
        `identityTrustSource expected one of ${arrayify(expect.identityTrustSourceIn).join(", ")} but got ${String(result.identityTrustSource)}`
      );
    }

    if (expect.readmeSummaryPresent === true && !result.readmeSummary) {
      failures.push("readmeSummary expected to be present");
    }

    if (expect.readmeSummaryContains) {
      for (const snippet of arrayify(expect.readmeSummaryContains)) {
        if (typeof result.readmeSummary !== "string" || !result.readmeSummary.includes(snippet)) {
          failures.push(`readmeSummary expected to contain ${snippet} but got ${String(result.readmeSummary)}`);
        }
      }
    }

    if (
      expect.readmeKeyPointsMin !== undefined &&
      result.readmeKeyPoints.length < expect.readmeKeyPointsMin
    ) {
      failures.push(
        `readmeKeyPoints expected at least ${expect.readmeKeyPointsMin} but got ${result.readmeKeyPoints.length}`
      );
    }

    if (expect.readmeKeyPointsContain) {
      for (const snippet of arrayify(expect.readmeKeyPointsContain)) {
        if (!result.readmeKeyPoints.some((item) => item.includes(snippet))) {
          failures.push(`readmeKeyPoints expected one item containing ${snippet}`);
        }
      }
    }

    if (expect.readmeKeyPointsAbsent) {
      for (const snippet of arrayify(expect.readmeKeyPointsAbsent)) {
        if (result.readmeKeyPoints.some((item) => item.includes(snippet))) {
          failures.push(`readmeKeyPoints expected to exclude ${snippet}`);
        }
      }
    }

    if (expect.readmeAudienceIn && !arrayify(expect.readmeAudienceIn).includes(result.readmeAudience)) {
      failures.push(
        `readmeAudience expected one of ${arrayify(expect.readmeAudienceIn).join(", ")} but got ${String(result.readmeAudience)}`
      );
    }

    if (
      expect.readmeArchitectureNotesMin !== undefined &&
      result.readmeArchitectureNotes.length < expect.readmeArchitectureNotesMin
    ) {
      failures.push(
        `readmeArchitectureNotes expected at least ${expect.readmeArchitectureNotesMin} but got ${result.readmeArchitectureNotes.length}`
      );
    }

    if (expect.readmeArchitectureNotesContain) {
      for (const snippet of arrayify(expect.readmeArchitectureNotesContain)) {
        if (!result.readmeArchitectureNotes.some((item) => item.includes(snippet))) {
          failures.push(`readmeArchitectureNotes expected one item containing ${snippet}`);
        }
      }
    }
  }

  if (result.kind === "owner") {
    if (expect.ownerTypeLabelIn && !arrayify(expect.ownerTypeLabelIn).includes(result.ownerTypeLabel)) {
      failures.push(
        `ownerTypeLabel expected one of ${arrayify(expect.ownerTypeLabelIn).join(", ")} but got ${String(result.ownerTypeLabel)}`
      );
    }

    if (expect.publicRepoCountMin !== undefined && result.publicRepoCount < expect.publicRepoCountMin) {
      failures.push(`publicRepoCount expected at least ${expect.publicRepoCountMin} but got ${result.publicRepoCount}`);
    }

    if (expect.sampledRepoCountMin !== undefined && result.sampledRepoCount < expect.sampledRepoCountMin) {
      failures.push(`sampledRepoCount expected at least ${expect.sampledRepoCountMin} but got ${result.sampledRepoCount}`);
    }

    if (expect.enrichedRepoCountMin !== undefined && result.enrichedRepoCount < expect.enrichedRepoCountMin) {
      failures.push(`enrichedRepoCount expected at least ${expect.enrichedRepoCountMin} but got ${result.enrichedRepoCount}`);
    }

    if (expect.enrichedRepoCountIn && !arrayify(expect.enrichedRepoCountIn).includes(result.enrichedRepoCount)) {
      failures.push(
        `enrichedRepoCount expected one of ${arrayify(expect.enrichedRepoCountIn).join(", ")} but got ${result.enrichedRepoCount}`
      );
    }

    if (expect.featuredReposContain) {
      for (const repoName of arrayify(expect.featuredReposContain)) {
        if (!result.featuredRepos.includes(repoName)) {
          failures.push(`featuredRepos expected to include ${repoName}`);
        }
      }
    }

    if (expect.featuredReposContainAny) {
      const candidates = arrayify(expect.featuredReposContainAny);
      if (!candidates.some((repoName) => result.featuredRepos.includes(repoName))) {
        failures.push(`featuredRepos expected to include one of ${candidates.join(", ")}`);
      }
    }

    if (expect.beginnerReposContainAny) {
      const candidates = arrayify(expect.beginnerReposContainAny);
      if (!candidates.some((repoName) => result.beginnerRepos.includes(repoName))) {
        failures.push(`beginnerRepos expected to include one of ${candidates.join(", ")}`);
      }
    }

    if (expect.commonStacksContain) {
      for (const stack of arrayify(expect.commonStacksContain)) {
        if (!result.commonStacks.includes(stack)) {
          failures.push(`commonStacks expected to include ${stack}`);
        }
      }
    }

    if (expect.keyThemesContain) {
      for (const theme of arrayify(expect.keyThemesContain)) {
        if (!result.keyThemes.includes(theme)) {
          failures.push(`keyThemes expected to include ${theme}`);
        }
      }
    }

    if (expect.keyThemesAbsent) {
      for (const theme of arrayify(expect.keyThemesAbsent)) {
        if (result.keyThemes.includes(theme)) {
          failures.push(`keyThemes expected to exclude ${theme}`);
        }
      }
    }

    if (
      expect.recommendedStartingPointsMin !== undefined &&
      result.recommendedStartingPoints.length < expect.recommendedStartingPointsMin
    ) {
      failures.push(
        `recommendedStartingPoints expected at least ${expect.recommendedStartingPointsMin} but got ${result.recommendedStartingPoints.length}`
      );
    }
  }

  return failures;
}

async function analyze(baseUrl, repoUrl, options = {}) {
  const forceRefresh = options.forceRefresh === true;
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repoUrl, forceRefresh }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    return {
      repoUrl,
      ok: false,
      status: response.status,
      error: payload.ok ? "Unknown error" : payload.error,
    };
  }

  const analysis = payload.data;

  if (analysis.kind === "owner") {
    return {
      repoUrl,
      ok: true,
      kind: "owner",
      ownerTypeLabel: analysis.summary.ownerTypeLabel,
      publicRepoCount: analysis.summary.publicRepoCount,
      sampledRepoCount: analysis.summary.sampledRepoCount,
      enrichedRepoCount: analysis.summary.enrichedRepoCount,
      commonStacks: analysis.summary.commonStacks,
      keyThemes: analysis.summary.keyThemes,
      recommendedStartingPoints: analysis.summary.recommendedStartingPoints,
      featuredRepos: analysis.portfolio.featuredRepos.map((item) => item.fullName),
      beginnerRepos: analysis.portfolio.beginnerRepos.map((item) => item.fullName),
      warnings: analysis.warnings.map((item) => item.code),
      limitations: analysis.limitations.map((item) => item.code),
    };
  }

  return {
    repoUrl,
    ok: true,
    kind: "repo",
    projectType: analysis.summary.projectType,
    consumptionMode: analysis.learning.identity.consumptionMode ?? null,
    analysisMode: analysis.analysisMode,
    focusRoot: analysis.topology.focusRoot,
    startFile: analysis.summary.recommendedStartFile,
    layerNames: analysis.layers.map((layer) => layer.name),
    keyFiles: analysis.keyFiles.map((item) => item.path),
    stack: analysis.summary.stack,
    keyFeatures: analysis.summary.keyFeatures,
    inferenceIds: analysis.inferences.map((item) => item.id),
    oneLiner: analysis.summary.oneLiner,
    previewMode: analysis.learning.preview.mode,
    deployUrl: analysis.learning.preview.deployUrl,
    usageRun: analysis.learning.usage.run,
    coverageLevel: analysis.coverage.level,
    coverageHeadline: analysis.coverage.trustSummary.headline,
    coverageDetail: analysis.coverage.trustSummary.detail,
    coverageReasons: analysis.coverage.trustSummary.reasons,
    coverageOmissions: analysis.coverage.trustSummary.omissions,
    coverageBasedOn: analysis.coverage.trustSummary.basedOn,
    coverageApproximate: analysis.coverage.trustSummary.approximate,
    unclassifiedCodeFileCount: analysis.coverage.unclassifiedCodeFileCount,
    unclassifiedCodeSamples: analysis.coverage.unclassifiedCodeSamples,
    envRuntimeMode: analysis.learning.environment.runtimeMode ?? null,
    envDeployTargets: analysis.learning.environment.cloud.deployTargets ?? [],
    envDeployTargetRequired: analysis.learning.environment.cloud.deployTargetRequired ?? null,
    envServicesRequired: analysis.learning.environment.cloud.servicesRequired ?? [],
    envServicesOptional: analysis.learning.environment.cloud.servicesOptional ?? [],
    envCostTier: analysis.learning.environment.costEstimate?.tier ?? null,
    envCostDriverKinds:
      analysis.learning.environment.costEstimate?.drivers?.map((item) => item.kind) ?? [],
    identityTitle: analysis.learning.identity.plainTitle,
    identitySubtitle: analysis.learning.identity.header.subtitle,
    identityPoints: analysis.learning.identity.header.points,
    identityTrustSource: analysis.learning.identity.trust.source,
    readmeSummary: analysis.learning.readmeCore.summary,
    readmeKeyPoints: analysis.learning.readmeCore.keyPoints,
    readmeAudience: analysis.learning.readmeCore.audience,
    readmeArchitectureNotes: analysis.learning.readmeCore.architectureNotes,
    routeCount: analysis.stats.routeCount,
    apiCount: analysis.stats.apiEndpointCount,
    warnings: analysis.warnings.map((item) => item.code),
    limitations: analysis.limitations.map((item) => item.code),
  };
}

async function analyzeWithPolicy(baseUrl, testCase, options) {
  const configuredForceRefresh = shouldForceRefresh(testCase, options.forceRefreshMode);
  const attempts = Math.max(1, options.maxRetries + 1);
  let forceRefresh = configuredForceRefresh;
  let usedCachedFallback = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await analyze(baseUrl, testCase.repoUrl, {
      forceRefresh,
    });

    if (result.ok) {
      return {
        ...result,
        attempts: attempt,
        requestedForceRefresh: configuredForceRefresh,
        finalForceRefresh: forceRefresh,
        usedCachedFallback,
      };
    }

    const errorCode = result.error?.code ?? null;

    if (errorCode !== "RATE_LIMITED") {
      return {
        ...result,
        attempts: attempt,
        requestedForceRefresh: configuredForceRefresh,
        finalForceRefresh: forceRefresh,
        usedCachedFallback,
      };
    }

    if (forceRefresh) {
      forceRefresh = false;
      usedCachedFallback = true;
      continue;
    }

    const delayMs = toRetryDelayMs(result.error, options.maxWaitMs);
    const isLastAttempt = attempt >= attempts;

    if (delayMs !== null && !isLastAttempt) {
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      continue;
    }

    if (shouldSoftBlockRateLimit(testCase, options.rateLimitMode)) {
      return {
        ...result,
        blocked: true,
        blockingReason: "RATE_LIMITED",
        attempts: attempt,
        requestedForceRefresh: configuredForceRefresh,
        finalForceRefresh: forceRefresh,
        usedCachedFallback,
      };
    }

    return {
      ...result,
      attempts: attempt,
      requestedForceRefresh: configuredForceRefresh,
      finalForceRefresh: forceRefresh,
      usedCachedFallback,
    };
  }

  throw new Error(`Regression retry loop exhausted for ${testCase.repoUrl}`);
}

const scope = regressionScope();
const forceRefreshMode = regressionForceRefreshMode();
const rateLimitMode = regressionRateLimitMode();
const maxRetries = regressionMaxRetries();
const maxWaitMs = regressionMaxWaitMs();
const caseFilters = regressionCaseFilters();
const allCases = await loadCases();
const cases = allCases.filter(
  (testCase) => shouldIncludeCase(testCase, scope) && matchesCaseFilter(testCase, caseFilters)
);
const results = [];
let hasFailure = false;
let blockedCount = 0;

if (cases.length === 0) {
  const filterNote =
    caseFilters.length > 0 ? ` and filter "${caseFilters.join(", ")}"` : "";
  throw new Error(`No regression cases matched scope "${scope}"${filterNote}.`);
}

const baseUrl = await discoverBaseUrl();

for (const testCase of cases) {
  const result = await analyzeWithPolicy(baseUrl, testCase, {
    forceRefreshMode,
    rateLimitMode,
    maxRetries,
    maxWaitMs,
  });

  if (!result.ok) {
    if (result.blocked) {
      blockedCount += 1;
    } else {
      hasFailure = true;
    }
    results.push(result);
    continue;
  }

  const failures = compareExpectations(result, testCase.expect ?? {});

  if (failures.length > 0) {
    hasFailure = true;
  }

  results.push({
    ...result,
    expected: testCase.expect,
    failures,
  });
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      scope,
      caseFilters,
      forceRefreshMode,
      rateLimitMode,
      maxRetries,
      maxWaitMs,
      selectedCaseCount: cases.length,
      skippedCaseCount: allCases.length - cases.length,
      blockedCount,
      blockedCases: results
        .filter((result) => result.blocked)
        .map((result) => ({
          repoUrl: result.repoUrl,
          retryAfterSeconds:
            typeof result.error?.details?.retryAfterSeconds === "number"
              ? result.error.details.retryAfterSeconds
              : null,
        })),
      results,
    },
    null,
    2
  )
);

if (hasFailure) {
  process.exitCode = 1;
}
