import fs from 'node:fs/promises';

const filePath = new URL('./analysis-regression-candidates.json', import.meta.url);
const VALID_TARGET_KINDS = new Set(['repo', 'owner', 'rate-limit']);
const VALID_STATUSES = new Set([
  'awaiting-url',
  'ready-for-probe',
  'blocked-by-quota',
  'ready-for-regression',
  'observing',
  'landed',
]);
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
const VALID_PROBE_MODES = new Set(['fresh-first', 'cache-friendly', 'owner-force-refresh', 'observe-live-429']);

function fail(message) {
  throw new Error(message);
}

function ensureString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function ensureStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    fail(`${label} must be a string array`);
  }
  return value.map((item) => item.trim());
}

function sortWeight(priority) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

async function main() {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (data.version !== 1) {
    fail(`analysis-regression-candidates.json version must be 1, got ${String(data.version)}`);
  }

  ensureString(data.updatedAt, 'updatedAt');
  if (!data.policy || typeof data.policy !== 'object') {
    fail('policy must be an object');
  }
  ensureString(data.policy.selectionRule, 'policy.selectionRule');
  ensureStringArray(data.policy.promotionChecklist, 'policy.promotionChecklist');
  ensureStringArray(data.policy.probeProtocol, 'policy.probeProtocol');

  if (!Array.isArray(data.candidates)) {
    fail('candidates must be an array');
  }

  const ids = new Set();
  const counts = new Map();
  const actionable = [];

  for (const [index, candidate] of data.candidates.entries()) {
    if (!candidate || typeof candidate !== 'object') {
      fail(`candidates[${index}] must be an object`);
    }

    const id = ensureString(candidate.id, `candidates[${index}].id`);
    if (ids.has(id)) {
      fail(`duplicate candidate id: ${id}`);
    }
    ids.add(id);

    ensureString(candidate.title, `candidates[${index}].title`);
    const targetKind = ensureString(candidate.targetKind, `candidates[${index}].targetKind`);
    const status = ensureString(candidate.status, `candidates[${index}].status`);
    const priority = ensureString(candidate.priority, `candidates[${index}].priority`);
    const probeMode = ensureString(candidate.probeMode, `candidates[${index}].probeMode`);
    ensureString(candidate.selectionHint, `candidates[${index}].selectionHint`);
    ensureStringArray(candidate.expectationFocus, `candidates[${index}].expectationFocus`);
    ensureString(candidate.notes, `candidates[${index}].notes`);

    if (!VALID_TARGET_KINDS.has(targetKind)) {
      fail(`candidates[${index}].targetKind must be one of ${[...VALID_TARGET_KINDS].join(', ')}`);
    }
    if (!VALID_STATUSES.has(status)) {
      fail(`candidates[${index}].status must be one of ${[...VALID_STATUSES].join(', ')}`);
    }
    if (!VALID_PRIORITIES.has(priority)) {
      fail(`candidates[${index}].priority must be one of ${[...VALID_PRIORITIES].join(', ')}`);
    }
    if (!VALID_PROBE_MODES.has(probeMode)) {
      fail(`candidates[${index}].probeMode must be one of ${[...VALID_PROBE_MODES].join(', ')}`);
    }

    if ((targetKind === 'repo' || targetKind === 'owner') && status !== 'awaiting-url') {
      ensureString(candidate.repoUrl, `candidates[${index}].repoUrl`);
    }

    if (targetKind === 'rate-limit' && candidate.repoUrl !== undefined && candidate.repoUrl !== null) {
      ensureString(candidate.repoUrl, `candidates[${index}].repoUrl`);
    }

    if (candidate.observed !== undefined) {
      if (!candidate.observed || typeof candidate.observed !== 'object') {
        fail(`candidates[${index}].observed must be an object when present`);
      }
      ensureString(candidate.observed.lastObservedAt, `candidates[${index}].observed.lastObservedAt`);
      if (
        candidate.observed.retryAfterSeconds !== undefined &&
        (typeof candidate.observed.retryAfterSeconds !== 'number' || candidate.observed.retryAfterSeconds < 0)
      ) {
        fail(`candidates[${index}].observed.retryAfterSeconds must be a non-negative number when present`);
      }
      if (candidate.observed.authMode !== undefined) {
        ensureString(candidate.observed.authMode, `candidates[${index}].observed.authMode`);
      }
    }

    counts.set(status, (counts.get(status) ?? 0) + 1);

    if (status !== 'landed') {
      actionable.push({
        id,
        title: candidate.title,
        priority,
        status,
        targetKind,
      });
    }
  }

  actionable.sort((left, right) =>
    sortWeight(right.priority) - sortWeight(left.priority) || left.title.localeCompare(right.title)
  );

  console.log(JSON.stringify({
    ok: true,
    file: filePath.pathname,
    candidateCount: data.candidates.length,
    statusCounts: Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    actionable: actionable.slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
