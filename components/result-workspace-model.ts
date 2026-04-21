import type { ArchitectureGraphModel, FocusRailKey } from "@/lib/analysis/graph";
import type { RepoAnalysis } from "@/lib/analysis/types";

export type WorkspaceViewMode = "canvas" | "diagram";
export type ResultStatusLevel = "ok" | "partial" | "limited";
export type ResultSidebarSectionId = "views" | "layers" | "scopes" | "status";
export type CanvasLayoutPreset = "single" | "split" | "triad" | "cluster";

export type ResultAnalysisStatusDetail = {
  id: string;
  label: string;
  detail?: string;
};

export type ResultAnalysisStatusView = {
  level: ResultStatusLevel;
  chipLabel: string | null;
  summary: string | null;
  details: ResultAnalysisStatusDetail[];
  unclassifiedCodeFileCount: number;
  unclassifiedCodeSamples: string[];
  unclassifiedCodeReasonSummary: string | null;
  unclassifiedCodeSemanticSummary: string | null;
  unclassifiedCodeContentCoverage: string | null;
};

export type ResultSidebarItem = {
  id: string;
  label: string;
  count?: number;
  description?: string;
  targetId?: string;
  focusKey?: FocusRailKey;
  selected?: boolean;
  kind: "view" | "focus" | "status";
};

export type ResultSidebarSection = {
  id: ResultSidebarSectionId;
  label: string;
  items: ResultSidebarItem[];
};

// Backend now emits `analysis.coverage` as the canonical status payload.
// We read it directly and shape details for the UI; the previous
// warning/fact-based recompute is dropped.
export function buildAnalysisStatusView(analysis: RepoAnalysis): ResultAnalysisStatusView {
  const coverage = analysis.coverage;
  const details: ResultAnalysisStatusDetail[] = coverage.details.map(
    (message, index) => ({ id: `coverage:${index}`, label: message })
  );

  return {
    level: coverage.level,
    chipLabel: coverage.chipLabel,
    summary: coverage.level === "ok" ? null : coverage.summary || null,
    details: coverage.level === "ok" ? [] : details,
    unclassifiedCodeFileCount: coverage.unclassifiedCodeFileCount,
    unclassifiedCodeSamples: coverage.unclassifiedCodeSamples,
    unclassifiedCodeReasonSummary: coverage.unclassifiedReasonSummary,
    unclassifiedCodeSemanticSummary: coverage.unclassifiedSemanticSummary,
    unclassifiedCodeContentCoverage: coverage.unclassifiedContentCoverage,
  };
}

function layerSidebarItems(model: ArchitectureGraphModel, activeFocus: FocusRailKey) {
  return model.railItems
    .filter(
      (item) =>
        item.key === "UI" ||
        item.key === "Logic" ||
        item.key === "API" ||
        item.key === "DB" ||
        item.key === "External"
    )
    .filter((item) => !item.disabled)
    .map((item) => ({
      id: `layer:${item.key}`,
      label: item.label,
      count: item.count,
      description: item.description,
      targetId: item.targetId,
      focusKey: item.key,
      selected: activeFocus === item.key,
      kind: "focus" as const,
    })) satisfies ResultSidebarItem[];
}

function scopeSidebarItems(model: ArchitectureGraphModel, activeFocus: FocusRailKey) {
  return model.railItems
    .filter(
      (item) => item.key === "apps" || item.key === "packages" || item.key === "tooling"
    )
    .filter((item) => !item.disabled)
    .map((item) => ({
      id: `scope:${item.key}`,
      label: item.label,
      count: item.count,
      description: item.description,
      targetId: item.targetId,
      focusKey: item.key,
      selected: activeFocus === item.key,
      kind: "focus" as const,
    })) satisfies ResultSidebarItem[];
}

export function buildResultSidebarSections(args: {
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
  viewMode: WorkspaceViewMode;
  activeFocus: FocusRailKey;
}): ResultSidebarSection[] {
  const { analysis, model, viewMode, activeFocus } = args;
  const status = buildAnalysisStatusView(analysis);
  const sections: ResultSidebarSection[] = [];

  sections.push({
    id: "views",
    label: "보기",
    items: [
      {
        id: "view:canvas",
        label: "이해 화면",
        selected: viewMode === "canvas",
        kind: "view",
      },
      {
        id: "view:diagram",
        label: "구조도",
        selected: viewMode === "diagram",
        kind: "view",
      },
    ],
  });

  const layers: ResultSidebarItem[] = [...layerSidebarItems(model, activeFocus)];
  if (status.unclassifiedCodeFileCount > 0) {
    layers.push({
      id: "layer:Code",
      label: "Code",
      count: status.unclassifiedCodeFileCount,
      description: "의미 레이어로 자동 분류되지 않은 핵심 코드",
      targetId: model.overview.id,
      selected: false,
      kind: "focus",
    });
  }
  if (layers.length > 0) {
    sections.push({ id: "layers", label: "레이어", items: layers });
  }

  const scopes = scopeSidebarItems(model, activeFocus);
  if (scopes.length > 0) {
    sections.push({ id: "scopes", label: "범위", items: scopes });
  }

  if (status.level !== "ok") {
    sections.push({
      id: "status",
      label: "상태",
      items: [
        {
          id: `status:${status.level}`,
          label: status.chipLabel ?? "분석 상태",
          description: status.summary ?? undefined,
          count: status.unclassifiedCodeFileCount > 0 ? status.unclassifiedCodeFileCount : undefined,
          kind: "status",
        },
      ],
    });
  }

  return sections;
}

export function buildCanvasLayoutPreset(args: {
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
}) {
  const status = buildAnalysisStatusView(args.analysis);
  const visibleCategoryCount = args.model.layerCards.length + (status.unclassifiedCodeFileCount > 0 ? 1 : 0);

  if (visibleCategoryCount <= 1) {
    return "single" satisfies CanvasLayoutPreset;
  }
  if (visibleCategoryCount === 2) {
    return "split" satisfies CanvasLayoutPreset;
  }
  if (visibleCategoryCount === 3) {
    return "triad" satisfies CanvasLayoutPreset;
  }
  return "cluster" satisfies CanvasLayoutPreset;
}
