"use client";

import { StackBadge } from "@/components/stack-badge";
import type { CompareDiff } from "@/lib/analysis/compare";

const RUNTIME_LABEL: Record<string, string> = {
  node: "Node.js",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  bun: "Bun",
  deno: "Deno",
};

const CAP = 8;

export function CompareEnvDiff({
  env,
  aLabel,
  bLabel,
}: {
  env: CompareDiff["env"];
  aLabel: string;
  bLabel: string;
}) {
  const deployDiffers =
    env.deployA.length !== env.deployB.length ||
    env.deployA.some((item) => !env.deployB.includes(item)) ||
    env.deployB.some((item) => !env.deployA.includes(item));

  const hasAnything =
    env.runtimes.length > 0 ||
    env.dockerA ||
    env.dockerB ||
    env.servicesCommon.length > 0 ||
    env.servicesOnlyA.length > 0 ||
    env.servicesOnlyB.length > 0 ||
    deployDiffers;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <header className="mb-4">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          환경 호환성
        </h2>
        <p className="mt-1 text-[11.5px] text-[var(--fg-dim)]">
          런타임 · Docker · 필요한 외부 서비스 · 배포 타깃을 비교합니다.
        </p>
      </header>

      {!hasAnything ? (
        <p className="text-[12px] text-[var(--fg-dim)]">
          비교 가능한 환경 정보가 없습니다.
        </p>
      ) : (
        <div className="space-y-5">
          {env.runtimes.length > 0 ? (
            <div>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-dim)]">
                런타임
              </h3>
              <div className="space-y-1.5">
                {env.runtimes.map((runtime) => (
                  <RuntimeRow
                    key={runtime.name}
                    name={runtime.name}
                    aVersion={runtime.aVersion}
                    bVersion={runtime.bVersion}
                    match={runtime.match}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-dim)]">
              Docker
            </h3>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[12px]">
              <DockerCell badge="A" sub={aLabel} present={env.dockerA} />
              <DockerCell badge="B" sub={bLabel} present={env.dockerB} />
            </div>
          </div>

          {env.servicesCommon.length > 0 ||
          env.servicesOnlyA.length > 0 ||
          env.servicesOnlyB.length > 0 ? (
            <div>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-dim)]">
                필요한 서비스
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                <ServiceColumn badge="공통" sub="양쪽 모두" items={env.servicesCommon} tone="common" />
                <ServiceColumn badge="A에만" sub={aLabel} items={env.servicesOnlyA} tone="side" />
                <ServiceColumn badge="B에만" sub={bLabel} items={env.servicesOnlyB} tone="side" />
              </div>
            </div>
          ) : null}

          {deployDiffers ? (
            <div>
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-dim)]">
                배포 타깃
              </h3>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <DeployColumn badge="A" sub={aLabel} items={env.deployA} />
                <DeployColumn badge="B" sub={bLabel} items={env.deployB} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MatchBadge({ match }: { match: "both" | "onlyA" | "onlyB" | "different" }) {
  if (match === "both") {
    return (
      <span
        title="양쪽 동일"
        className="inline-flex items-center gap-1 rounded-sm bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]"
      >
        ✓ 같음
      </span>
    );
  }
  if (match === "different") {
    return (
      <span
        title="버전이 서로 다름"
        className="inline-flex items-center gap-1 rounded-sm bg-[var(--accent-warm)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-warm)]"
      >
        ≠ 다름
      </span>
    );
  }
  if (match === "onlyA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
        A에만
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
      B에만
    </span>
  );
}

function RuntimeRow({
  name,
  aVersion,
  bVersion,
  match,
}: {
  name: string;
  aVersion: string | null;
  bVersion: string | null;
  match: "both" | "onlyA" | "onlyB" | "different";
}) {
  const label = RUNTIME_LABEL[name] ?? name;
  // UI 방어 — backend compare.ts가 null 버전 한쪽 있으면 "both"로 판정해
  // `v20` vs `>=22` 같은 실제 버전 불일치도 "같음"으로 나올 때가 있다.
  // 두 버전이 모두 있고 실제 비교 시 다르면 시각적으로 "다름"으로 승격.
  const effectiveMatch: typeof match =
    match === "both" &&
    aVersion &&
    bVersion &&
    normalizeDisplayVersion(aVersion) !== normalizeDisplayVersion(bVersion)
      ? "different"
      : match;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
      <MatchBadge match={effectiveMatch} />
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--fg)]">
        <StackBadge name={label.toLowerCase()} />
        <span>{label}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[var(--fg-dim)]">A</span>
        <VersionCell version={aVersion} present={match === "both" || match === "different" || match === "onlyA"} />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[var(--fg-dim)]">B</span>
        <VersionCell version={bVersion} present={match === "both" || match === "different" || match === "onlyB"} />
      </span>
    </div>
  );
}

function normalizeDisplayVersion(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function VersionCell({ version, present }: { version: string | null; present: boolean }) {
  if (!present) {
    return <span className="text-[var(--fg-dim)]">—</span>;
  }
  return (
    <span className="truncate font-mono text-[11.5px] text-[var(--fg-muted)]">
      {version ?? "버전 미지정"}
    </span>
  );
}

function DockerCell({
  badge,
  sub,
  present,
}: {
  badge: string;
  sub: string;
  present: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--fg-muted)]">
          {badge}
        </span>
        <p className="mt-1 truncate text-[11px] text-[var(--fg-dim)]" title={sub}>
          {sub}
        </p>
      </div>
      {present ? (
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent)]">
          ✓ 있음
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10.5px] text-[var(--fg-dim)]">
          — 없음
        </span>
      )}
    </div>
  );
}

function ServiceColumn({
  badge,
  sub,
  items,
  tone,
}: {
  badge: string;
  sub: string;
  items: string[];
  tone: "common" | "side";
}) {
  const visible = items.slice(0, CAP);
  const overflow = Math.max(0, items.length - CAP);
  const badgeTone =
    tone === "common"
      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
      : "border border-[var(--border)] text-[var(--fg-muted)]";
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold ${badgeTone}`}>
            {badge}
          </span>
          <p className="mt-1 truncate text-[11px] text-[var(--fg-dim)]" title={sub}>
            {sub}
          </p>
        </div>
        <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--fg-dim)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] italic text-[var(--fg-dim)]">없음</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {visible.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              <StackBadge name={item} />
              <span className="truncate">{item}</span>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-dim)]">
              +{overflow}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function DeployColumn({
  badge,
  sub,
  items,
}: {
  badge: string;
  sub: string;
  items: string[];
}) {
  const visible = items.slice(0, CAP);
  const overflow = Math.max(0, items.length - CAP);
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--fg-muted)]">
            {badge}
          </span>
          <p className="mt-1 truncate text-[11px] text-[var(--fg-dim)]" title={sub}>
            {sub}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] italic text-[var(--fg-dim)]">없음</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {visible.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--fg)]"
            >
              <StackBadge name={item} />
              <span className="truncate">{item}</span>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="inline-flex items-center rounded-sm border border-dashed border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--fg-dim)]">
              +{overflow}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
