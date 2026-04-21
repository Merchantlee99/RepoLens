import {
  DEFAULT_RATE_LIMIT_CANDIDATE_ID,
  applyRateLimitObservation,
  discoverAnalyzeBaseUrl,
  readRegressionCandidates,
  writeRegressionCandidates,
} from "./regression-candidate-utils.mjs";

const filePath = new URL("./analysis-regression-candidates.json", import.meta.url);

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, got ${raw}`);
  }
  return value;
}

function buildRequestConfig() {
  return {
    candidateId: process.env.RATE_LIMIT_CANDIDATE_ID ?? DEFAULT_RATE_LIMIT_CANDIDATE_ID,
    repoUrl:
      process.env.RATE_LIMIT_REPO_URL ?? "https://github.com/vercel/next-learn",
    forceRefresh: envFlag("RATE_LIMIT_FORCE_REFRESH", true),
    thresholdSeconds: envNumber("RATE_LIMIT_THRESHOLD_SECONDS", 3600),
    writeBack: envFlag("RATE_LIMIT_WRITE_BACK", true),
  };
}

async function main() {
  const config = buildRequestConfig();
  const baseUrl = await discoverAnalyzeBaseUrl();
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repoUrl: config.repoUrl,
      forceRefresh: config.forceRefresh,
    }),
  });
  const payload = await response.json();

  if (response.ok && payload?.ok) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          observed: false,
          reason: "NOT_RATE_LIMITED",
          baseUrl,
          candidateId: config.candidateId,
          repoUrl: config.repoUrl,
          forceRefresh: config.forceRefresh,
        },
        null,
        2
      )
    );
    return;
  }

  const error = payload?.error ?? null;
  const retryAfterSeconds =
    typeof error?.details?.retryAfterSeconds === "number"
      ? error.details.retryAfterSeconds
      : Number(response.headers.get("Retry-After"));

  if (error?.code !== "RATE_LIMITED" || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          observed: false,
          reason: error?.code ?? "ANALYZE_FAILED",
          baseUrl,
          candidateId: config.candidateId,
          repoUrl: config.repoUrl,
          forceRefresh: config.forceRefresh,
          error,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const data = await readRegressionCandidates(filePath);
  const observedAt = new Date().toISOString();
  const authMode =
    (typeof error?.details?.authMode === "string" && error.details.authMode) ||
    (typeof error?.details?.githubAuthMode === "string" && error.details.githubAuthMode) ||
    null;

  const summary = applyRateLimitObservation(data, {
    candidateId: config.candidateId,
    repoUrl: config.repoUrl,
    retryAfterSeconds,
    authMode,
    observedAt,
  });

  if (config.writeBack) {
    await writeRegressionCandidates(filePath, data);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        observed: true,
        baseUrl,
        candidateId: config.candidateId,
        forceRefresh: config.forceRefresh,
        writeBack: config.writeBack,
        summary,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
