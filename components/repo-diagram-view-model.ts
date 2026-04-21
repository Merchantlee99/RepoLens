import {
  buildLayerTechHints,
} from "@/components/result-view-model";
import type {
  ArchitectureGraphModel,
  ArchitectureConnection,
  ArchitectureWorkspaceCard,
  FocusRailKey,
} from "@/lib/analysis/graph";
import type { LayerName, RepoAnalysis } from "@/lib/analysis/types";

export type RepoDiagramItem = {
  id: string;
  label: string;
  meta?: string;
  targetId?: string;
  isStart?: boolean;
};

export type RepoDiagramFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RepoDiagramNode = {
  id: string;
  targetId: string;
  kind: "repo" | "group" | "scope" | "layer";
  title: string;
  subtitle?: string;
  caption?: string;
  badges?: string[];
  items: RepoDiagramItem[];
  focusKeys: FocusRailKey[];
  frame: RepoDiagramFrame;
  layerName?: LayerName;
  techHints?: string[];
  count?: number;
};

export type RepoDiagramViewModel = {
  width: number;
  height: number;
  nodes: RepoDiagramNode[];
  edges: ArchitectureConnection[];
};

// ─── Container-nested layout ────────────────────────────────────────────────
// Repo는 외곽 컨테이너(아웃라인)로 그려지고, scope와 layer들이 그 안에 공간적으로
// 포함된다. "repo → scope" 같은 포함 관계를 화살표로 표현하지 않는다 — 레포 안에
// 레이어가 "있다"는 사실은 시각적 중첩으로 충분히 읽힘.
//
// 내부 배치 (repo 컨테이너 안):
//   - 좌측 1열: Scope (대표 범위 카드)
//   - 우측 3열 그리드: UI/Logic 상단, API 중앙, DB/External 하단
//   - scope → API(hub) 화살표, hub → 주변 layer fan-out 화살표만 유지.
const WIDTH = 1180;
const HEIGHT = 620;
const CARD_W = 220;
const CARD_H = 140;
const SCOPE_W = 220;

// Repo 외곽 컨테이너 — 전체를 감싸는 outline box.
// 상단 60~70px는 헤더 영역(제목/배지/caption)으로 예약, 나머지는 content.
const REPO_FRAME: RepoDiagramFrame = { x: 16, y: 16, w: 1148, h: 584 };

// Content 좌표는 repo 컨테이너 내부 기준이 아닌 캔버스 절대 좌표 — SVG edge
// 계산과 절대 배치(div absolute top/left) 모두가 같은 좌표계를 쓰도록.
const UPPER_BAND_Y = 110; // UI / Logic
const MAIN_BAND_Y = 270;  // API (hub) + Scope 같은 수직선
const LOWER_BAND_Y = 430; // DB / External

// Scope — repo 내부 좌측 lane. MAIN_BAND_Y에 두어 API와 한 줄로 읽힘.
const SCOPE_FRAME: RepoDiagramFrame = { x: 44, y: MAIN_BAND_Y, w: SCOPE_W, h: CARD_H };

// Layer 3-컬럼 그리드 (repo 내부 우측).
const LAYER_COL_LEFT = 310;
const LAYER_COL_CENTER = 545;
const LAYER_COL_RIGHT = 780;

const LAYER_FRAMES: Record<LayerName, RepoDiagramFrame> = {
  UI:       { x: LAYER_COL_LEFT,   y: UPPER_BAND_Y, w: CARD_W, h: CARD_H },
  Logic:    { x: LAYER_COL_RIGHT,  y: UPPER_BAND_Y, w: CARD_W, h: CARD_H },
  API:      { x: LAYER_COL_CENTER, y: MAIN_BAND_Y,  w: CARD_W, h: CARD_H },
  DB:       { x: LAYER_COL_LEFT,   y: LOWER_BAND_Y, w: CARD_W, h: CARD_H },
  External: { x: LAYER_COL_RIGHT,  y: LOWER_BAND_Y, w: CARD_W, h: CARD_H },
};

function resolveDiagramLayerFrames(
  layerNames: Set<LayerName>
): Record<LayerName, RepoDiagramFrame> {
  const hasDB = layerNames.has("DB");
  const hasExternal = layerNames.has("External");
  const bothSinks = hasDB && hasExternal;
  // When only one sink exists, pull it to the middle column so it lines up
  // vertically with API (repo → scope → API → sink spine).
  return {
    UI: LAYER_FRAMES.UI,
    Logic: LAYER_FRAMES.Logic,
    API: LAYER_FRAMES.API,
    DB: {
      ...LAYER_FRAMES.DB,
      x: bothSinks ? LAYER_COL_LEFT : LAYER_COL_CENTER,
    },
    External: {
      ...LAYER_FRAMES.External,
      x: bothSinks ? LAYER_COL_RIGHT : LAYER_COL_CENTER,
    },
  };
}

function compactPathLabel(path: string) {
  const parts = path.split("/").filter(Boolean);
  const base = parts[parts.length - 1] ?? path;

  if (!/^(index|page|layout|route|main|package|config|server|client)(\.[^.]+){1,2}$/i.test(base)) {
    return base;
  }

  return parts.slice(-2).join("/");
}

function uniqueItems(items: RepoDiagramItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.targetId ?? item.id}:${item.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function scopeBadge(groupKey: ArchitectureWorkspaceCard["groupKey"]) {
  switch (groupKey) {
    case "apps":
      return "apps";
    case "packages":
      return "packages";
    case "tooling":
      return "tooling";
    default:
      return null;
  }
}

export function buildRepoDiagramView(
  model: ArchitectureGraphModel,
  analysis: RepoAnalysis
): RepoDiagramViewModel {
  const nodes: RepoDiagramNode[] = [];
  const clusterBadges = model.groupCards
    .filter((group) => group.workspaceCount > 0)
    .map((group) => `${group.key} ${group.workspaceCount}`);
  const repoBadges =
    clusterBadges.length > 0
      ? clusterBadges.slice(0, 2)
      : [analysis.topology.kind === "monorepo" ? "monorepo" : "single repo"];

  nodes.push({
    id: model.repoCard.id,
    targetId: model.repoCard.id,
    kind: "repo",
    title: model.repoCard.title,
    subtitle: model.repoCard.subtitle,
    caption: analysis.summary.oneLiner,
    badges: repoBadges,
    items: [],
    focusKeys: model.repoCard.focusKeys,
    frame: REPO_FRAME,
  });

  const scopeItems = model.focusWorkspace
    ? model.focusWorkspace.fileHints
    : [analysis.summary.recommendedStartFile, ...analysis.topology.manifestFiles].filter(
        (value): value is string => Boolean(value)
      );
  const scopeNodeId = model.focusWorkspace?.id ?? "repo:scope";
  const focusGroupBadge = scopeBadge(model.focusWorkspace?.groupKey ?? null);

  // Keep scope card visually balanced even when items are sparse: emit a
  // short caption that describes the reading anchor, regardless of whether
  // there's a focusWorkspace. This preserves the uniform card density.
  const scopeCaption = (() => {
    if (model.focusWorkspace) {
      const groupLabel =
        model.focusWorkspace.groupKey === "apps"
          ? "app 기준 대표 범위"
          : model.focusWorkspace.groupKey === "packages"
            ? "package 기준 대표 범위"
            : model.focusWorkspace.groupKey === "tooling"
              ? "tooling 기준 대표 범위"
              : "대표 workspace 기준 범위";
      return groupLabel;
    }
    if (analysis.topology.kind === "monorepo") {
      return "모노레포 루트 기준 읽기 범위";
    }
    return "레포 루트 기준 읽기 범위";
  })();

  nodes.push({
    id: scopeNodeId,
    targetId: model.focusWorkspace?.id ?? model.overview.id,
    kind: "scope",
    title: model.focusWorkspace?.title ?? "repo root",
    // subtitle omitted: kindLabel + focusGroupBadge already encode "app / package / tooling".
    caption: scopeCaption,
    badges: focusGroupBadge ? [focusGroupBadge] : undefined,
    items: uniqueItems(
      scopeItems.slice(0, 3).map((path) => ({
        id: path,
        label: compactPathLabel(path),
        targetId: model.inspectables[`file:${path}`] ? `file:${path}` : undefined,
        isStart: analysis.summary.recommendedStartFile === path,
      }))
    ),
    focusKeys: model.focusWorkspace?.focusKeys ?? ["all"],
    frame: SCOPE_FRAME,
  });

  const presentLayerNames = new Set(model.layerCards.map((card) => card.layerName));
  const frames = resolveDiagramLayerFrames(presentLayerNames);

  // Diagram layer nodes show *concept* only (kindLabel, title+count, techHints,
  // caption). File-level detail lives in the 이해 화면 (canvas) view and in
  // the inspector. This keeps the diagram readable as a structural map rather
  // than a file browser — particularly helpful for non-developer first-timers.
  model.layerCards.forEach((layer) => {
    nodes.push({
      id: layer.id,
      targetId: layer.id,
      kind: "layer",
      title: layer.title,
      // subtitle omitted: kindLabel already encodes "레이어 · 화면" sublabel
      // badges omitted: count moves inline next to title
      caption: layer.description,
      items: [],
      focusKeys: layer.focusKeys,
      frame: frames[layer.layerName],
      layerName: layer.layerName,
      techHints: buildLayerTechHints(analysis, layer.layerName),
      count: layer.fileCount,
    });
  });

  // ─── Edges (hub-and-spoke) ────────────────────────────────────────────────
  // Repo → scope 화살표는 제거. Repo는 scope/layer를 공간적으로 포함하는 외곽
  // 컨테이너이므로 포함 관계를 화살표로 그리면 "흐름"처럼 오독된다.
  // 남는 화살표:
  //   - scope → hub layer   : 대표 범위가 어느 레이어로 이어지는지
  //   - hub → others        : 레이어 간 실제 호출/의존 흐름
  const layerById = new Map(model.layerCards.map((card) => [card.layerName, card]));
  const edges: ArchitectureConnection[] = [];

  // Pick a hub layer in priority order. API is the canonical orchestrator;
  // Logic is the next-best central point; UI is the last resort. DB/External
  // are pure sinks and never act as hubs.
  const HUB_PRIORITY: LayerName[] = ["API", "Logic", "UI"];
  const hubCard = HUB_PRIORITY.map((name) => layerById.get(name)).find(
    (card): card is NonNullable<typeof card> => Boolean(card)
  );

  if (hubCard) {
    edges.push({
      id: `diagram:scope-${hubCard.layerName}`,
      from: scopeNodeId,
      to: hubCard.id,
      label: "",
      tone: "accent",
      focusKeys: ["all", hubCard.layerName],
    });

    model.layerCards.forEach((card) => {
      if (card.id === hubCard.id) return;
      const isSink = card.layerName === "DB" || card.layerName === "External";
      edges.push({
        id: `diagram:${hubCard.layerName}-${card.layerName}`,
        from: hubCard.id,
        to: card.id,
        label: "",
        tone: isSink ? "muted" : "neutral",
        focusKeys: ["all", hubCard.layerName, card.layerName],
      });
    });
  } else {
    // No orchestrator-class layer was detected. Connect scope directly to
    // whatever sink-class layers exist. This keeps the diagram readable even
    // for pure data / external-only repos.
    model.layerCards.forEach((card) => {
      edges.push({
        id: `diagram:scope-${card.layerName}`,
        from: scopeNodeId,
        to: card.id,
        label: "",
        tone: "muted",
        focusKeys: ["all", card.layerName],
      });
    });
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    nodes,
    edges,
  };
}
