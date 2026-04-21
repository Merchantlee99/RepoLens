import fs from "node:fs/promises";

export const DEFAULT_RATE_LIMIT_CANDIDATE_ID = "rate-limit-long-countdown-observation";

export async function readRegressionCandidates(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeRegressionCandidates(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function discoverCandidate(data, candidateId) {
  if (!data || typeof data !== "object" || !Array.isArray(data.candidates)) {
    throw new Error("Candidate data is invalid.");
  }

  const candidate = data.candidates.find((item) => item?.id === candidateId);

  if (!candidate) {
    throw new Error(`Candidate not found: ${candidateId}`);
  }

  return candidate;
}

export function applyRateLimitObservation(data, args) {
  const candidate = discoverCandidate(data, args.candidateId);

  if (candidate.targetKind !== "rate-limit") {
    throw new Error(`Candidate ${args.candidateId} is not a rate-limit observation target.`);
  }

  const thresholdSeconds = Number.isFinite(args.thresholdSeconds) ? args.thresholdSeconds : 3600;
  const retryAfterSeconds = Number(args.retryAfterSeconds);

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    throw new Error(`retryAfterSeconds must be a non-negative number, got ${String(args.retryAfterSeconds)}`);
  }

  candidate.status = retryAfterSeconds >= thresholdSeconds ? "ready-for-regression" : "observing";
  candidate.repoUrl = args.repoUrl;
  candidate.observed = {
    lastObservedAt: args.observedAt,
    retryAfterSeconds,
    authMode: args.authMode ?? null,
  };
  candidate.notes =
    retryAfterSeconds >= thresholdSeconds
      ? `Observed retryAfterSeconds=${retryAfterSeconds} on ${args.repoUrl}; ready to promote a long-countdown live regression once expectations are written.`
      : `Observed retryAfterSeconds=${retryAfterSeconds} on ${args.repoUrl}; keep watching until a >=${thresholdSeconds}s countdown appears.`;

  data.updatedAt = args.updatedAt ?? args.observedAt.slice(0, 10);

  return {
    candidateId: candidate.id,
    status: candidate.status,
    retryAfterSeconds,
    thresholdSeconds,
    repoUrl: args.repoUrl,
    authMode: args.authMode ?? null,
  };
}

export async function discoverAnalyzeBaseUrl() {
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

  throw new Error("No local analyze server found. Start `pnpm dev` or set ANALYZE_BASE_URL explicitly.");
}
