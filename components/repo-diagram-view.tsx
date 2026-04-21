"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ANALYSIS_STATUS_ID,
  CODE_FALLBACK_ID,
  displayFileName,
  fallbackFileTargetId,
  LAYER_SUBLABEL,
} from "@/components/result-view-model";
import { buildAnalysisStatusView } from "@/components/result-workspace-model";
import {
  buildRepoDiagramView,
  type RepoDiagramFrame,
  type RepoDiagramItem,
  type RepoDiagramNode,
} from "@/components/repo-diagram-view-model";
import type { ArchitectureGraphModel, FocusRailKey } from "@/lib/analysis/graph";
import type { LayerName, RepoAnalysis } from "@/lib/analysis/types";

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

// Orthogonal edge routing with soft corners.
// - Same-y pair: single horizontal segment.
// - Above/below target: exit from top/bottom at an offset column so sibling
//   edges from the same source do not overlap (APIs fan out cleanly).
function edgePath(from: RepoDiagramFrame, to: RepoDiagramFrame) {
  const fromCy = from.y + from.h / 2;
  const toCy = to.y + to.h / 2;
  const fromCx = from.x + from.w / 2;
  const toCx = to.x + to.w / 2;

  const sameBand = Math.abs(fromCy - toCy) < 3;
  if (sameBand) {
    const sx = fromCx < toCx ? from.x + from.w : from.x;
    const ex = fromCx < toCx ? to.x : to.x + to.w;
    return `M ${sx} ${fromCy} L ${ex} ${toCy}`;
  }

  const targetAbove = toCy < fromCy;
  const targetRight = toCx >= fromCx;

  const sy = targetAbove ? from.y : from.y + from.h;
  // Offset exit column by ±30% of card width so left/right siblings diverge.
  const sx = targetRight ? from.x + from.w * 0.7 : from.x + from.w * 0.3;
  const ey = targetAbove ? to.y + to.h : to.y;
  const ex = toCx;
  const midY = (sy + ey) / 2;

  const r = 6;
  const sgnV = ey > sy ? 1 : -1;
  const sgnH = ex >= sx ? 1 : -1;

  // If horizontal travel is shorter than the corner radius, skip rounding.
  if (Math.abs(ex - sx) < r * 2) {
    return `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
  }

  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${midY - r * sgnV}`,
    `Q ${sx} ${midY} ${sx + r * sgnH} ${midY}`,
    `L ${ex - r * sgnH} ${midY}`,
    `Q ${ex} ${midY} ${ex} ${midY + r * sgnV}`,
    `L ${ex} ${ey}`,
  ].join(" ");
}

function toneColor(tone: "neutral" | "accent" | "muted", active: boolean) {
  if (!active) return "var(--fg-dim)";
  if (tone === "accent") return "var(--fg-muted)";
  if (tone === "muted") return "var(--fg-dim)";
  return "var(--fg-dim)";
}

function toneOpacity(tone: "neutral" | "accent" | "muted", active: boolean) {
  if (!active) return 0.22;
  if (tone === "accent") return 0.58;
  if (tone === "muted") return 0.34;
  return 0.4;
}

function toneDash(tone: "neutral" | "accent" | "muted") {
  return tone === "muted" ? "5 4" : undefined;
}

function toneWidth(tone: "neutral" | "accent" | "muted", active: boolean) {
  if (tone === "accent") return active ? 1.4 : 1;
  if (tone === "muted") return active ? 1.1 : 0.9;
  return active ? 1.2 : 0.9;
}

function StarPin() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 .75 7.45 4.2l3.55.35-2.7 2.5.8 3.45L6 8.8 2.9 10.5l.8-3.45L1 4.55l3.55-.35L6 .75Z" />
    </svg>
  );
}

// Plain-language hover text per edge. Edges are structural, not runtime-
// traced, so copy is kept conservative ("이어집니다" / "연결됩니다").
function edgeTooltip(from: RepoDiagramNode, to: RepoDiagramNode): string {
  if (from.kind === "repo" && to.kind === "scope") {
    return "이 레포에서 먼저 보는 범위입니다";
  }
  if (from.kind === "scope" && to.kind === "layer") {
    return `대표 범위에서 ${LAYER_SUBLABEL[to.layerName!]} 레이어로 이어집니다`;
  }
  if (from.kind === "layer" && to.kind === "layer") {
    const fromLabel = LAYER_SUBLABEL[from.layerName!];
    const toLabel = LAYER_SUBLABEL[to.layerName!];
    if (to.layerName === "DB") return `${fromLabel} 에서 데이터에 접근합니다`;
    if (to.layerName === "External") return `${fromLabel} 에서 외부 서비스를 호출합니다`;
    return `${fromLabel} 에서 ${toLabel} 로 이어집니다`;
  }
  return "두 노드가 구조적으로 연결됩니다";
}

function NodeItem({
  item,
  selected,
  onSelect,
}: {
  item: RepoDiagramItem;
  selected: boolean;
  onSelect: (targetId: string) => void;
}) {
  const clickable = Boolean(item.targetId);
  const Wrapper: "button" | "div" = clickable ? "button" : "div";
  const content = (
    <>
      {item.isStart ? (
        <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[var(--accent)]">
          <StarPin />
        </span>
      ) : (
        <span
          aria-hidden
          className="inline-flex h-[14px] w-[14px] shrink-0 rounded border border-[var(--border)] bg-[var(--surface)]"
        />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-[var(--fg-muted)]">
        {item.label}
      </span>
      {item.meta ? (
        <span className="shrink-0 max-w-[82px] truncate text-[10px] text-[var(--fg-dim)]">
          {item.meta}
        </span>
      ) : null}
    </>
  );

  const className = `flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left ${
    clickable
      ? "cursor-pointer hover:bg-[var(--surface-hover)]"
      : "cursor-default"
  } ${selected ? "bg-[var(--surface-hover)]" : ""}`;

  if (Wrapper === "button") {
    return (
      <button type="button" onClick={() => item.targetId && onSelect(item.targetId)} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

// Repo는 scope/layer를 품는 외곽 컨테이너로 그린다. 테두리 + 상단 헤더만
// 있고 내부는 비어 있어 nested cards가 그대로 노출된다. 선택/포커스 스타일은
// 일반 카드와 동일하지만 배경은 semi-transparent로 그리드가 살짝 보이게.
function RepoOutlineCard({
  node,
  selected,
  active,
  onSelect,
}: {
  node: RepoDiagramNode;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-node-id={node.id}
      className="absolute rounded-xl border-2 transition-[opacity,border-color,background-color]"
      style={{
        left: node.frame.x,
        top: node.frame.y,
        width: node.frame.w,
        height: node.frame.h,
        opacity: active ? 1 : 0.55,
        // 컨테이너임을 시각적으로 뚜렷이 — surface-strong을 옅게 깔고 dashed
        // 테두리로 "이 안이 하나의 범위"임을 강조.
        background: "color-mix(in oklab, var(--surface-strong) 35%, transparent)",
        borderStyle: "dashed",
        borderColor: selected ? "var(--border-strong)" : "var(--border)",
        boxShadow: selected ? "0 0 0 1px var(--border-strong)" : "none",
      }}
    >
      {/* 헤더 영역 — 컨테이너 좌측 상단에 배지처럼 배치. 클릭 시 overview
          inspector 오픈. caption은 헤더 바로 아래에 붙여 아래쪽 여백은 layer
          카드들 놓일 공간으로 비워둔다. */}
      <button
        type="button"
        onClick={onSelect}
        className="group absolute left-3 top-3 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
        aria-label={`${node.title} 레포 열기`}
      >
        <span
          aria-hidden
          className="inline-flex h-[9px] w-[9px] shrink-0 rounded-sm border border-[var(--border-strong)] bg-[var(--surface-strong)]"
        />
        <span className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[var(--fg-dim)]">
            레포
          </span>
          <span className="truncate text-[12.5px] font-semibold text-[var(--fg)]">
            {node.title}
          </span>
          {node.badges && node.badges.length > 0 ? (
            <span className="flex shrink-0 gap-1">
              {node.badges.slice(0, 2).map((badge) => (
                <span
                  key={badge}
                  className="rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-1.5 py-0.5 text-[9.5px] text-[var(--fg-dim)]"
                >
                  {badge}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      {node.caption ? (
        <p
          className="pointer-events-none absolute left-3 top-[52px] max-w-[420px] truncate text-[10.5px] text-[var(--fg-dim)]"
          title={node.caption}
        >
          {node.caption}
        </p>
      ) : null}
    </div>
  );
}

function DiagramNodeCard({
  node,
  selectedId,
  activeFocus,
  onSelect,
}: {
  node: RepoDiagramNode;
  selectedId: string | null | undefined;
  activeFocus: FocusRailKey;
  onSelect: (targetId: string, focusHint?: FocusRailKey) => void;
}) {
  const active = matchesFocus(node.focusKeys, activeFocus);
  const selected = selectedId === node.targetId;
  const selectedChild = node.items.some((item) => item.targetId === selectedId);
  const layerDot = node.layerName ? DOT_VAR[node.layerName] : null;
  const kindLabel =
    node.kind === "repo"
      ? "레포"
      : node.kind === "group"
        ? "클러스터"
        : node.kind === "scope"
          ? "대표 범위"
          : `레이어 · ${LAYER_SUBLABEL[node.layerName!]}`;

  return (
    <div
      data-node-id={node.id}
      className="absolute flex flex-col overflow-hidden rounded-lg border bg-[var(--surface-strong)] transition-[opacity,border-color,background-color]"
      style={{
        left: node.frame.x,
        top: node.frame.y,
        width: node.frame.w,
        height: node.frame.h,
        opacity: active ? 1 : 0.3,
        borderColor: selected || selectedChild ? "var(--border-strong)" : "var(--border)",
        boxShadow: selected || selectedChild ? "0 0 0 1px var(--border-strong)" : "none",
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(node.targetId, node.layerName)}
        className="flex w-full items-start gap-2 rounded-t-lg px-3 pt-2.5 pb-2 text-left hover:bg-[var(--surface-hover)]"
      >
        {layerDot ? (
          <span
            aria-hidden
            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
            style={{ background: layerDot }}
          />
        ) : (
          <span
            aria-hidden
            className="mt-[3px] inline-flex h-[10px] w-[10px] shrink-0 rounded-sm border border-[var(--border)] bg-[var(--surface)]"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] text-[var(--fg-dim)]">
            {kindLabel}
          </span>
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--fg)]">
              {node.title}
            </span>
            {typeof node.count === "number" ? (
              <span className="shrink-0 text-[10.5px] text-[var(--fg-dim)]">
                {node.count}
              </span>
            ) : null}
          </span>
          {node.subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] text-[var(--fg-muted)]">
              {node.subtitle}
            </span>
          ) : null}
          {node.techHints && node.techHints.length > 0 ? (
            <span className="mt-1 block truncate text-[10.5px] text-[var(--fg-muted)]">
              {node.techHints.join(" · ")}
            </span>
          ) : null}
        </span>
      </button>

      {node.caption ? (
        <p
          className="px-3 text-[10.5px] leading-5 text-[var(--fg-dim)] line-clamp-2"
          title={node.caption}
        >
          {node.caption}
        </p>
      ) : null}

      {node.badges && node.badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1 px-3">
          {node.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[9.5px] text-[var(--fg-dim)]"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {node.items.length > 0 ? (
        <ul className="mt-2 space-y-0.5 px-2 pb-2">
          {node.items.map((item) => (
            <li key={item.id}>
              <NodeItem
                item={item}
                selected={item.targetId === selectedId}
                onSelect={(targetId) => onSelect(targetId, node.layerName)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RepoDiagramView({
  model,
  analysis,
  activeFocus,
  selectedId,
  onSelectNode,
}: {
  model: ArchitectureGraphModel;
  analysis: RepoAnalysis;
  activeFocus: FocusRailKey;
  selectedId?: string | null;
  onSelectNode?: (id: string, focusHint?: FocusRailKey) => void;
}) {
  const diagram = useMemo(() => buildRepoDiagramView(model, analysis), [model, analysis]);
  const nodeMap = useMemo(
    () => new Map(diagram.nodes.map((node) => [node.id, node])),
    [diagram.nodes]
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the selected node out from under the floating Inspector.
  useEffect(() => {
    if (!selectedId) return;
    const container = scrollRef.current;
    if (!container) return;
    const node = container.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(selectedId)}"]`
    );
    if (!node) return;
    const INSPECTOR_WIDTH = 380;
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
  const codeStatus = useMemo(() => buildAnalysisStatusView(analysis), [analysis]);
  const showCodeStrip = codeStatus.unclassifiedCodeFileCount > 0;
  const stripHeight = 92;
  const stripTopGap = 20;
  const canvasHeight = showCodeStrip ? diagram.height + stripTopGap + stripHeight : diagram.height;
  const stripTop = diagram.height + stripTopGap;

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
      <div className="relative mx-auto" style={{ width: diagram.width, height: canvasHeight }}>
        {/* Repo outline container — 가장 뒤에 배경 레이어로. scope/layer를
            공간적으로 포함하는 외곽. */}
        {(() => {
          const repoNode = diagram.nodes.find((n) => n.kind === "repo");
          if (!repoNode) return null;
          const active = matchesFocus(repoNode.focusKeys, activeFocus);
          const selected = selectedId === repoNode.targetId;
          return (
            <RepoOutlineCard
              node={repoNode}
              selected={selected}
              active={active}
              onSelect={() => onSelectNode?.(repoNode.targetId)}
            />
          );
        })()}

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${diagram.width} ${canvasHeight}`}
          aria-hidden
        >
          <defs>
            <marker
              id="diagram-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--fg-dim)" opacity="0.65" />
            </marker>
          </defs>

          {diagram.edges.map((edge) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) {
              return null;
            }

            const active =
              matchesFocus(fromNode.focusKeys, activeFocus) &&
              matchesFocus(toNode.focusKeys, activeFocus) &&
              matchesFocus(edge.focusKeys, activeFocus);

            return (
              <g key={edge.id}>
                <path
                  d={edgePath(fromNode.frame, toNode.frame)}
                  fill="none"
                  stroke={toneColor(edge.tone, active)}
                  strokeOpacity={toneOpacity(edge.tone, active)}
                  strokeWidth={toneWidth(edge.tone, active)}
                  strokeDasharray={toneDash(edge.tone)}
                  markerEnd="url(#diagram-arrow)"
                >
                  <title>{edgeTooltip(fromNode, toNode)}</title>
                </path>
                <text
                  x={(fromNode.frame.x + fromNode.frame.w + toNode.frame.x) / 2}
                  y={(fromNode.frame.y + toNode.frame.y) / 2 - 8}
                  textAnchor="middle"
                  className="fill-[var(--fg-dim)] text-[10px]"
                  opacity={active ? 0.65 : 0.25}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {diagram.nodes
          .filter((node) => node.kind !== "repo")
          .map((node) => (
            <DiagramNodeCard
              key={node.id}
              node={node}
              selectedId={selectedId}
              activeFocus={activeFocus}
              onSelect={(targetId, focusHint) => onSelectNode?.(targetId, focusHint)}
            />
          ))}

        {showCodeStrip ? (
          <DiagramCodeStrip
            status={codeStatus}
            selectedId={selectedId}
            top={stripTop}
            width={diagram.width - 104}
            height={stripHeight}
            onSelect={(id) => onSelectNode?.(id)}
          />
        ) : null}
      </div>
    </div>
  );
}

function DiagramCodeStrip({
  status,
  selectedId,
  top,
  width,
  height,
  onSelect,
}: {
  status: ReturnType<typeof buildAnalysisStatusView>;
  selectedId?: string | null;
  top: number;
  width: number;
  height: number;
  onSelect: (id: string) => void;
}) {
  const selected = selectedId === CODE_FALLBACK_ID || selectedId === ANALYSIS_STATUS_ID;
  const samples = status.unclassifiedCodeSamples.slice(0, 4);

  return (
    <button
      type="button"
      onClick={() => onSelect(CODE_FALLBACK_ID)}
      className="absolute rounded-lg border border-dashed bg-[var(--surface)] px-4 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
      style={{
        left: 52,
        top,
        width,
        height,
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
        <span className="text-[13px] font-semibold text-[var(--fg)]">미분류 코드</span>
        <span className="text-[10.5px] text-[var(--fg-dim)]">
          · 자동으로 레이어에 묶지 못한 파일 {status.unclassifiedCodeFileCount}개
        </span>
      </div>
      {samples.length > 0 ? (
        <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
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
