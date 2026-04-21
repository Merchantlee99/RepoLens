"use client";

import { StackBadge } from "@/components/stack-badge";

const CAP = 8;

export function CompareStackDiff({
  common,
  onlyA,
  onlyB,
  aLabel,
  bLabel,
}: {
  common: string[];
  onlyA: string[];
  onlyB: string[];
  aLabel: string;
  bLabel: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <header className="mb-4">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          스택 겹침
        </h2>
        <p className="mt-1 text-[11.5px] text-[var(--fg-dim)]">
          두 레포가 공유하는 기술 · 한쪽에만 있는 기술을 나눠서 표시합니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StackColumn
          badge="공통"
          sub="양쪽 모두 사용"
          count={common.length}
          items={common}
          tone="common"
        />
        <StackColumn
          badge="A에만"
          sub={aLabel}
          count={onlyA.length}
          items={onlyA}
          tone="a"
        />
        <StackColumn
          badge="B에만"
          sub={bLabel}
          count={onlyB.length}
          items={onlyB}
          tone="b"
        />
      </div>
    </section>
  );
}

function StackColumn({
  badge,
  sub,
  count,
  items,
  tone,
}: {
  badge: string;
  sub: string;
  count: number;
  items: string[];
  tone: "common" | "a" | "b";
}) {
  const visible = items.slice(0, CAP);
  const overflow = Math.max(0, items.length - CAP);

  const badgeTone =
    tone === "common"
      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
      : "border border-[var(--border)] text-[var(--fg-muted)]";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold ${badgeTone}`}
          >
            {badge}
          </span>
          <p
            className="mt-1 truncate text-[11px] text-[var(--fg-dim)]"
            title={sub}
          >
            {sub}
          </p>
        </div>
        <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--fg-dim)]">
          {count}개
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-[11.5px] text-[var(--fg-dim)]">없음</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {visible.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] text-[var(--fg)]"
            >
              <StackBadge name={item} />
              <span className="truncate">{item}</span>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="inline-flex items-center rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-[11.5px] text-[var(--fg-dim)]">
              +{overflow}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
