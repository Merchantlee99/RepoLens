import type { CompareDiff, CompareLayerKey } from "@/lib/analysis/compare";
import type { RepoEnvRuntime } from "@/lib/analysis/types";

export type CompareDiagnostics = {
  labels: {
    a: string;
    b: string;
  };
  warnings: string[];
  counts: {
    commonStack: number;
    onlyAStack: number;
    onlyBStack: number;
    sharedLayers: number;
    onlyALayers: number;
    onlyBLayers: number;
    runtimeBoth: number;
    runtimeDifferent: number;
    runtimeOnlyA: number;
    runtimeOnlyB: number;
    servicesCommon: number;
    servicesOnlyA: number;
    servicesOnlyB: number;
  };
  modes: {
    docker: "both" | "onlyA" | "onlyB" | "none";
    deploy: "shared" | "different" | "onlyA" | "onlyB" | "none";
  };
  previews: {
    commonStack: string[];
    onlyAStack: string[];
    onlyBStack: string[];
    sharedLayers: CompareLayerKey[];
    onlyALayers: CompareLayerKey[];
    onlyBLayers: CompareLayerKey[];
    runtimeDifferent: RepoEnvRuntime["name"][];
    servicesCommon: string[];
    servicesOnlyA: string[];
    servicesOnlyB: string[];
  };
};

function deployMode(diff: CompareDiff): CompareDiagnostics["modes"]["deploy"] {
  const a = diff.env.deployA;
  const b = diff.env.deployB;

  if (a.length === 0 && b.length === 0) return "none";
  if (a.length > 0 && b.length === 0) return "onlyA";
  if (a.length === 0 && b.length > 0) return "onlyB";

  const shared = a.filter((target) => b.includes(target));
  return shared.length > 0 ? "shared" : "different";
}

function dockerMode(diff: CompareDiff): CompareDiagnostics["modes"]["docker"] {
  if (diff.env.dockerA && diff.env.dockerB) return "both";
  if (diff.env.dockerA) return "onlyA";
  if (diff.env.dockerB) return "onlyB";
  return "none";
}

export function buildCompareDiagnostics(diff: CompareDiff): CompareDiagnostics {
  const sharedLayers = diff.layers.rows.filter((row) => row.shared).map((row) => row.layer);
  const onlyALayers = diff.layers.rows.filter((row) => row.aCount > 0 && row.bCount === 0).map((row) => row.layer);
  const onlyBLayers = diff.layers.rows.filter((row) => row.bCount > 0 && row.aCount === 0).map((row) => row.layer);
  const runtimeDifferent = diff.env.runtimes
    .filter((runtime) => runtime.match === "different")
    .map((runtime) => runtime.name);

  return {
    labels: {
      a: `${diff.repos.a.repo.owner}/${diff.repos.a.repo.name}`,
      b: `${diff.repos.b.repo.owner}/${diff.repos.b.repo.name}`,
    },
    warnings: diff.warnings,
    counts: {
      commonStack: diff.stack.common.length,
      onlyAStack: diff.stack.onlyA.length,
      onlyBStack: diff.stack.onlyB.length,
      sharedLayers: sharedLayers.length,
      onlyALayers: onlyALayers.length,
      onlyBLayers: onlyBLayers.length,
      runtimeBoth: diff.env.runtimes.filter((runtime) => runtime.match === "both").length,
      runtimeDifferent: runtimeDifferent.length,
      runtimeOnlyA: diff.env.runtimes.filter((runtime) => runtime.match === "onlyA").length,
      runtimeOnlyB: diff.env.runtimes.filter((runtime) => runtime.match === "onlyB").length,
      servicesCommon: diff.env.servicesCommon.length,
      servicesOnlyA: diff.env.servicesOnlyA.length,
      servicesOnlyB: diff.env.servicesOnlyB.length,
    },
    modes: {
      docker: dockerMode(diff),
      deploy: deployMode(diff),
    },
    previews: {
      commonStack: diff.stack.common.slice(0, 5),
      onlyAStack: diff.stack.onlyA.slice(0, 5),
      onlyBStack: diff.stack.onlyB.slice(0, 5),
      sharedLayers: sharedLayers.slice(0, 6),
      onlyALayers: onlyALayers.slice(0, 6),
      onlyBLayers: onlyBLayers.slice(0, 6),
      runtimeDifferent,
      servicesCommon: diff.env.servicesCommon.slice(0, 5),
      servicesOnlyA: diff.env.servicesOnlyA.slice(0, 5),
      servicesOnlyB: diff.env.servicesOnlyB.slice(0, 5),
    },
  };
}

export function formatCompareDiagnostics(diagnostics: CompareDiagnostics) {
  return [
    `compare ${diagnostics.labels.a} ↔ ${diagnostics.labels.b}`,
    `stack common=${diagnostics.counts.commonStack} onlyA=${diagnostics.counts.onlyAStack} onlyB=${diagnostics.counts.onlyBStack}`,
    `layers shared=${diagnostics.counts.sharedLayers} onlyA=${diagnostics.counts.onlyALayers} onlyB=${diagnostics.counts.onlyBLayers}`,
    `runtime both=${diagnostics.counts.runtimeBoth} different=${diagnostics.counts.runtimeDifferent} onlyA=${diagnostics.counts.runtimeOnlyA} onlyB=${diagnostics.counts.runtimeOnlyB}`,
    `services common=${diagnostics.counts.servicesCommon} onlyA=${diagnostics.counts.servicesOnlyA} onlyB=${diagnostics.counts.servicesOnlyB}`,
    `modes docker=${diagnostics.modes.docker} deploy=${diagnostics.modes.deploy}`,
  ];
}
