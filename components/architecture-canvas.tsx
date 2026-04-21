"use client";

import { useEffect, useRef } from "react";
import type {
  ArchitectureGraphModel,
  ArchitectureLayerCard,
  FocusRailKey,
} from "@/lib/analysis/graph";
import type { LayerName, RepoAnalysis } from "@/lib/analysis/types";
import {
  ANALYSIS_STATUS_ID,
  buildLayerTechHints,
  CODE_FALLBACK_ID,
  displayFileName,
  fallbackFileTargetId,
  LAYER_SUBLABEL,
} from "@/components/result-view-model";
import { buildAnalysisStatusView } from "@/components/result-workspace-model";

type ArchitectureCanvasProps = {
  model: ArchitectureGraphModel;
  analysis: RepoAnalysis;
  activeFocus: FocusRailKey;
  selectedId?: string | null;
  onSelectNode?: (id: string, focusHint?: FocusRailKey) => void;
};

type NodeFrame = { x: number; y: number; w: number; h: number };

const CANVAS_WIDTH = 1180;
// Canvas layer cards are "concept chips" — dot + title + count + sublabel +
// techHints(≤2). Description moves to Inspector. Card height shrank from 148
// → 120, and canvas height follows suit to keep the 5-layer flow compact.
const CANVAS_BASE_HEIGHT = 492;
// When the Code-fallback strip is present, expand vertically to preserve the
// 5-layer spine rather than squeezing it into the right column.
const CANVAS_WITH_CODE_HEIGHT = 604;
const LAYER_W = 228;
const LAYER_H = 120;
const CODE_STRIP_FRAME = { x: 40, y: 472, w: 1100, h: 104 };

// Baseline frames (both sinks present). When only one of DB/External exists,
// the singleton pulls up to the main row so the right column doesn't feel
// lopsided. See resolveLayerFrames().
const MAIN_ROW_Y = 184;
const SINK_TOP_Y = 40;
const SINK_BOT_Y = 328;

const LAYER_FRAMES: Record<LayerName, NodeFrame> = {
  UI:       { x: 40,  y: MAIN_ROW_Y, w: LAYER_W, h: LAYER_H },
  Logic:    { x: 316, y: MAIN_ROW_Y, w: LAYER_W, h: LAYER_H },
  API:      { x: 592, y: MAIN_ROW_Y, w: LAYER_W, h: LAYER_H },
  DB:       { x: 868, y: SINK_TOP_Y, w: LAYER_W, h: LAYER_H },
  External: { x: 868, y: SINK_BOT_Y, w: LAYER_W, h: LAYER_H },
};

function resolveLayerFrames(layerByName: Map<LayerName, unknown>): Record<LayerName, NodeFrame> {
  const hasDB = layerByName.has("DB");
  const hasExternal = layerByName.has("External");
  const bothSinks = hasDB && hasExternal;
  return {
    UI: LAYER_FRAMES.UI,
    Logic: LAYER_FRAMES.Logic,
    API: LAYER_FRAMES.API,
    DB: { ...LAYER_FRAMES.DB, y: bothSinks ? SINK_TOP_Y : MAIN_ROW_Y },
    External: { ...LAYER_FRAMES.External, y: bothSinks ? SINK_BOT_Y : MAIN_ROW_Y },
  };
}

type EdgeSpec = { from: LayerName; to: LayerName; primary: boolean };

const LAYER_FLOW: EdgeSpec[] = [
  { from: "UI",    to: "Logic",    primary: true  },
  { from: "Logic", to: "API",      primary: true  },
  { from: "API",   to: "DB",       primary: false },
  { from: "API",   to: "External", primary: false },
];

const DOT_VAR: Record<LayerName, string> = {
  UI: "var(--dot-ui)",
  Logic: "var(--dot-logic)",
  API: "var(--dot-api)",
  DB: "var(--dot-db)",
  External: "var(--dot-external)",
};

function matchesFocus(focusKeys: FocusRailKey[], activeFocus: FocusRailKey) {
  if (activeFocus === "all") return true;
  return focusKeys.includes(activeFocus);
}

function layerEdgePath(from: NodeFrame, to: NodeFrame) {
  const startX = from.x + from.w;
  const startY = from.y + from.h / 2;
  const endX = to.x;
  const endY = to.y + to.h / 2;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function edgeTooltip({ from, to }: EdgeSpec) {
  if (from === "UI" && to === "Logic") {
    return "화면 동작이 로직으로 이어집니다";
  }
  if (from === "Logic" && to === "API") {
    return "로직이 서버 요청을 부릅니다";
  }
  if (from === "API" && to === "DB") {
    return "요청이 데이터에 닿습니다";
  }
  if (from === "API" && to === "External") {
    return "요청이 외부 서비스로 갑니다";
  }
  return "레이어가 서로 연결됩니다";
}

function StarPin({ className = "" }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M6 .75 7.45 4.2l3.55.35-2.7 2.5.8 3.45L6 8.8 2.9 10.5l.8-3.45L1 4.55l3.55-.35L6 .75Z" />
    </svg>
  );
}

function LayerNode({
  layer,
  analysis,
  frame,
  active,
  selected,
  hasStart,
  onSelect,
  onSelectStartFile,
}: {
  layer: ArchitectureLayerCard;
  analysis: RepoAnalysis;
  frame: NodeFrame;
  active: boolean;
  selected: boolean;
  hasStart: boolean;
  onSelect: () => void;
  onSelectStartFile: () => void;
}) {
  const dotColor = DOT_VAR[layer.layerName];
  const subLabel = LAYER_SUBLABEL[layer.layerName];
  // Canvas 레이어 카드는 "구조 지도" 역할만 — 설명(description)은 Inspector가
  // 담당하도록 옮기고, 카드 안에는 dot·title·count·sublabel·techHints(≤2)만
  // 둔다. 정보 밀도를 낮춰 5-layer 흐름이 한눈에 들어오게.
  const techHintsAll = buildLayerTechHints(analysis, layer.layerName);
  const techHints = techHintsAll.slice(0, 2);
  const techOverflow = Math.max(0, techHintsAll.length - techHints.length);

  return (
    <div
      data-node-id={layer.id}
      className="group/node absolute overflow-hidden rounded-lg border text-left transition-[opacity,border-color,background-color,box-shadow]"
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        opacity: active ? 1 : 0.32,
        background: "var(--surface-strong)",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        // 선택된 레이어는 accent tinted ring으로 시선을 먼저 잡는다.
        boxShadow: selected
          ? "0 0 0 1px var(--accent), 0 2px 10px -2px rgba(0,0,0,0.18)"
          : "none",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        title={layer.description || undefined}
        className="flex h-full w-full flex-col items-start gap-0 px-3 pt-2.5 pb-2.5 text-left hover:bg-[var(--surface-hover)] group-hover/node:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        aria-label={`${layer.title} 레이어 열기`}
        aria-pressed={selected}
      >
        <span className="flex w-full items-start gap-2">
          <span
            aria-hidden
            className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
            style={{ background: dotColor }}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[var(--fg)]">
                {layer.title}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {hasStart ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="여기부터 읽기"
                    title="여기부터 읽기"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectStartFile();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelectStartFile();
                      }
                    }}
                    className="inline-flex h-[14px] w-[14px] items-center justify-center text-[var(--accent)] hover:opacity-80"
                  >
                    <StarPin />
                  </span>
                ) : null}
                <span className="text-[10.5px] tabular-nums text-[var(--fg-dim)]">
                  {layer.fileCount}
                </span>
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--fg-muted)]">
              {subLabel}
            </span>
          </span>
        </span>
        {techHints.length > 0 ? (
          <span className="mt-auto flex w-full flex-wrap items-center gap-1 pt-2">
            {techHints.map((hint) => (
              <span
                key={hint}
                className="inline-flex max-w-full items-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]"
              >
                <span className="truncate">{hint}</span>
              </span>
            ))}
            {techOverflow > 0 ? (
              <span
                className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] px-1 py-0.5 text-[10px] text-[var(--fg-dim)]"
                title={techHintsAll.slice(2).join(" · ")}
              >
                +{techOverflow}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function ArchitectureCanvas({
  model,
  analysis,
  activeFocus,
  selectedId,
  onSelectNode,
}: ArchitectureCanvasProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Bring the selected node into view so the floating Inspector doesn't cover
  // it. We scroll horizontally only; vertical shift would break the gridbg.
  useEffect(() => {
    if (!selectedId) return;
    const container = scrollRef.current;
    if (!container) return;
    const node = container.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(selectedId)}"]`
    );
    if (!node) return;
    const INSPECTOR_WIDTH = 380; // 360px panel + right-3 gap
    const viewportLeft = container.scrollLeft;
    const viewportRight = viewportLeft + container.clientWidth;
    const visibleRight = viewportRight - INSPECTOR_WIDTH;
    const nodeLeft = node.offsetLeft;
    const nodeRight = nodeLeft + node.offsetWidth;
    if (nodeRight > visibleRight || nodeLeft < viewportLeft) {
      const target = Math.max(0, nodeLeft - 40);
      container.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [selectedId]);

  const layerByName = new Map<LayerName, ArchitectureLayerCard>();
  model.layerCards.forEach((card) => layerByName.set(card.layerName, card));

  const edges = LAYER_FLOW.filter(
    ({ from, to }) => layerByName.has(from) && layerByName.has(to)
  );

  const hasAnyLayer = layerByName.size > 0;
  const codeStatus = buildAnalysisStatusView(analysis);
  const showCodeStrip = codeStatus.unclassifiedCodeFileCount > 0;
  const canvasHeight = showCodeStrip ? CANVAS_WITH_CODE_HEIGHT : CANVAS_BASE_HEIGHT;
  const frames = resolveLayerFrames(layerByName);

  // Identify which layer owns the recommended-start file (for the ★ pin in
  // the layer header). Canvas no longer lists individual files — file-level
  // exploration happens in the Inspector ("관련 파일" section).
  const startFilePath = analysis.summary.recommendedStartFile ?? null;
  const startLayer: LayerName | null = (() => {
    if (!startFilePath) return null;
    for (const layer of model.layerCards) {
      if (layer.keyFiles.some((file) => file.path === startFilePath)) {
        return layer.layerName;
      }
    }
    return null;
  })();

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full overflow-auto"
      style={{
        backgroundImage:
          "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 24px 24px",
      }}
    >
      <div
        className="relative mx-auto"
        style={{ width: CANVAS_WIDTH, height: canvasHeight }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
          aria-hidden
        >
          <defs>
            <marker
              id="arrow-dim"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--fg-dim)" opacity="0.5" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--fg-muted)" />
            </marker>
          </defs>

          {edges.map(({ from, to, primary }) => {
            const fromFrame = frames[from];
            const toFrame = frames[to];
            const fromCard = layerByName.get(from)!;
            const toCard = layerByName.get(to)!;
            const active =
              matchesFocus(fromCard.focusKeys, activeFocus) &&
              matchesFocus(toCard.focusKeys, activeFocus);

            const strokeWidth = primary ? (active ? 1.4 : 1.1) : active ? 1.1 : 0.9;
            const dash = primary ? undefined : "5 4";

            return (
              <path
                key={`${from}-${to}`}
                d={layerEdgePath(fromFrame, toFrame)}
                fill="none"
                stroke={active ? "var(--fg-muted)" : "var(--fg-dim)"}
                strokeOpacity={active ? (primary ? 0.6 : 0.45) : 0.25}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                markerEnd={active ? "url(#arrow-active)" : "url(#arrow-dim)"}
              >
                <title>{edgeTooltip({ from, to, primary })}</title>
              </path>
            );
          })}
        </svg>

        {model.layerCards.map((layer) => {
          const frame = frames[layer.layerName];
          if (!frame) return null;

          const active = matchesFocus(layer.focusKeys, activeFocus);
          const selected = selectedId === layer.id;
          const hasStart = startLayer === layer.layerName;

          return (
            <LayerNode
              key={layer.id}
              layer={layer}
              analysis={analysis}
              frame={frame}
              active={active}
              selected={selected}
              hasStart={hasStart}
              onSelect={() => onSelectNode?.(layer.id, layer.layerName)}
              onSelectStartFile={() => {
                if (!startFilePath) return;
                onSelectNode?.(`file:${startFilePath}`, layer.layerName);
              }}
            />
          );
        })}

        {!hasAnyLayer ? (
          <div className="absolute left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-strong)] p-5 text-center">
            <p className="text-[13px] font-semibold text-[var(--fg)]">
              뚜렷한 레이어 구조가 잡히지 않았습니다.
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-[var(--fg-muted)]">
              라이브러리 · SDK · 도구형 저장소일 가능성이 높습니다. README와 진입 파일부터 읽어 보세요.
            </p>
          </div>
        ) : null}

        {showCodeStrip ? (
          <CodeFallbackStrip
            status={codeStatus}
            selectedId={selectedId}
            onSelect={(id) => onSelectNode?.(id)}
          />
        ) : null}
      </div>
    </div>
  );
}

function CodeFallbackStrip({
  status,
  selectedId,
  onSelect,
}: {
  status: ReturnType<typeof buildAnalysisStatusView>;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = selectedId === CODE_FALLBACK_ID || selectedId === ANALYSIS_STATUS_ID;
  const samples = status.unclassifiedCodeSamples.slice(0, 6);

  return (
    <button
      type="button"
      onClick={() => onSelect(CODE_FALLBACK_ID)}
      className="absolute rounded-lg border border-dashed bg-[var(--surface)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{
        left: CODE_STRIP_FRAME.x,
        top: CODE_STRIP_FRAME.y,
        width: CODE_STRIP_FRAME.w,
        height: CODE_STRIP_FRAME.h,
        borderColor: selected ? "var(--border-strong)" : "var(--border)",
        boxShadow: selected ? "0 0 0 1px var(--border-strong)" : "none",
      }}
      aria-label="미분류 코드 보기"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded border border-dashed border-[var(--border-strong)] font-mono text-[9px] text-[var(--fg-dim)]"
        >
          ?
        </span>
        <span className="text-[13px] font-semibold text-[var(--fg)]">의미 레이어 바깥 · Code</span>
        <span className="text-[10.5px] text-[var(--fg-dim)]">
          · UI/Logic/API/DB/External 어디에도 묶지 못한 코드 {status.unclassifiedCodeFileCount}개
        </span>
      </div>
      {samples.length > 0 ? (
        <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5">
          {samples.map((sample) => (
            <li key={sample}>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(fallbackFileTargetId(sample));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(fallbackFileTargetId(sample));
                  }
                }}
                title={sample}
                className="block truncate rounded px-1 py-0.5 font-mono text-[11px] text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              >
                {displayFileName(sample)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}
