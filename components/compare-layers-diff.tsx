"use client";

import type { CompareDiff, CompareLayerKey } from "@/lib/analysis/compare";

const LAYER_LABEL: Record<CompareLayerKey, string> = {
  UI: "UI",
  Logic: "Logic",
  API: "API",
  DB: "DB",
  External: "External",
  Code: "Code",
};

export function CompareLayersDiff({
  rows,
  aLabel,
  bLabel,
}: {
  rows: CompareDiff["layers"]["rows"];
  aLabel: string;
  bLabel: string;
}) {
  const max = rows.reduce(
    (acc, row) => Math.max(acc, row.aCount, row.bCount),
    0
  );

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
            구조 비교
          </h2>
          <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-dim)]">
            파일 역할별 개수. UI · 로직 · API · DB · 외부 · 기타.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-[var(--fg-dim)]">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2.5 w-4 rounded-sm border border-[var(--border-strong)] bg-[var(--accent)]/30"
            />
            공유
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-[var(--border)]"
            />
            한쪽에만
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--fg-dim)]">
          비교할 레이어 데이터가 없습니다.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="hidden grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-1 text-[11px] text-[var(--fg-dim)] md:grid">
            <span className="uppercase tracking-[0.04em]">유형</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
                A
              </span>
              <span className="truncate" title={aLabel}>
                {aLabel}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
                B
              </span>
              <span className="truncate" title={bLabel}>
                {bLabel}
              </span>
            </span>
          </div>
          {rows.map((row) => (
            <LayerRow
              key={row.layer}
              layer={row.layer}
              aCount={row.aCount}
              bCount={row.bCount}
              shared={row.shared}
              max={max}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LayerRow({
  layer,
  aCount,
  bCount,
  shared,
  max,
}: {
  layer: CompareLayerKey;
  aCount: number;
  bCount: number;
  shared: boolean;
  max: number;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
      <span className="text-[12px] font-medium text-[var(--fg)]">
        {LAYER_LABEL[layer]}
      </span>
      <Bar count={aCount} max={max} shared={shared} present={aCount > 0} />
      <Bar count={bCount} max={max} shared={shared} present={bCount > 0} />
    </div>
  );
}

function Bar({
  count,
  max,
  shared,
  present,
}: {
  count: number;
  max: number;
  shared: boolean;
  present: boolean;
}) {
  const pct = max > 0 && count > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
  const border = shared
    ? "border-[var(--border-strong)]"
    : "border-dashed border-[var(--border)]";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative h-5 min-w-0 flex-1 overflow-hidden rounded-sm border ${border} bg-[var(--surface-strong)]/30`}
      >
        {pct > 0 ? (
          <div
            className={`h-full ${
              shared ? "bg-[var(--accent)]/70" : "bg-[var(--fg-muted)]/40"
            }`}
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
      <span
        className={`w-8 shrink-0 text-right text-[11.5px] tabular-nums ${
          present ? "text-[var(--fg)]" : "text-[var(--fg-dim)]"
        }`}
      >
        {count}
      </span>
    </div>
  );
}
