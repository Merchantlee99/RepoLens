"use client";

import type { RepoCostEstimate } from "@/lib/analysis/types";
import type { CompatResult, UserEnv } from "@/components/user-env";
import { budgetTierLabel } from "@/components/user-env";

// 월 비용 추정 + 내 예산 대비. 판정 severity는 backend(matchRepoToEnv)의
// item "budget" 결과를 그대로 사용해 Hero와 톤을 일치시킨다.
export function EnvCostBlock({
  cost,
  userEnv,
  compat,
}: {
  cost: RepoCostEstimate;
  userEnv?: UserEnv;
  compat?: CompatResult | null;
}) {
  const range = (() => {
    // free tier에서 low/high=0이 내려와도 "$0–0/월"처럼 보이지 않도록
    // tier label로 폴백.
    if (cost.tier === "free") return tierRangeLabel("free");
    if (cost.monthlyUsdLow != null && cost.monthlyUsdHigh != null) {
      if (cost.monthlyUsdLow === cost.monthlyUsdHigh) {
        return cost.monthlyUsdHigh === 0
          ? tierRangeLabel(cost.tier)
          : `~ $${cost.monthlyUsdHigh}/월`;
      }
      return `$${cost.monthlyUsdLow}–${cost.monthlyUsdHigh}/월`;
    }
    if (cost.monthlyUsdHigh != null && cost.monthlyUsdHigh > 0) {
      return `~ $${cost.monthlyUsdHigh}/월`;
    }
    return tierRangeLabel(cost.tier);
  })();

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          예상 월 비용
        </h3>
        <span
          className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium ${tierChipClass(cost.tier)}`}
        >
          {tierLabel(cost.tier)}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-[var(--fg-dim)]">
        보수적인 범위이며, 실제 사용량과 요금 정책에 따라 달라집니다.
      </p>
      <p className="mt-3 text-[18px] font-semibold tabular-nums text-[var(--fg)]">
        {range}
      </p>

      {/* 내 예산 대비 — backend item severity로 통일 */}
      {userEnv?.budget ? (
        <BudgetCompare
          repoTier={cost.tier}
          userTier={userEnv.budget}
          compat={compat}
        />
      ) : (
        <p className="mt-2 text-[10.5px] text-[var(--fg-dim)]">
          내 예산이 설정되지 않았어요 — 설정하면 오버 여부를 바로 볼 수 있어요.
        </p>
      )}

      {cost.drivers && cost.drivers.length > 0 ? (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
            비용 근거
          </p>
          <ul className="mt-1.5 space-y-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
            {cost.drivers.map((d, i) => (
              <li key={i} className="flex gap-1.5">
                <span
                  className={`inline-flex h-fit shrink-0 items-center rounded-sm border px-1 py-0 text-[9.5px] font-medium ${driverChipClass(d.kind)}`}
                >
                  {driverLabel(d.kind)}
                </span>
                <span className="text-[var(--fg)]">{d.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function BudgetCompare({
  repoTier,
  userTier,
  compat,
}: {
  repoTier: RepoCostEstimate["tier"];
  userTier: NonNullable<UserEnv["budget"]>;
  compat?: CompatResult | null;
}) {
  const item = compat?.items.find((i) => i.key === "budget");
  // Backend severity를 그대로 사용해 Hero와 통일.
  const status: "match" | "warning" | "blocker" = !item
    ? userTier === repoTier
      ? "match"
      : "warning"
    : item.status === "match"
      ? "match"
      : item.severity === "blocker"
        ? "blocker"
        : item.severity === "warning"
          ? "warning"
          : "match";
  const statusClass =
    status === "match"
      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
      : status === "warning"
        ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]"
        : "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/20 text-[var(--fg)]";
  const statusIcon = status === "match" ? "✓" : status === "warning" ? "⚠" : "🚫";
  const message =
    status === "match"
      ? "내 예산 범위 안"
      : status === "warning"
        ? "예산 초과 — 주의"
        : "예산 부족으로 실행 어려움";
  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/40 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
          내 예산 대비
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium ${statusClass}`}
        >
          <span aria-hidden>{statusIcon}</span>
          <span>{message}</span>
        </span>
      </div>
      <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
        내 예산 <strong className="text-[var(--fg)]">{budgetTierLabel(userTier)}</strong> vs 레포 요구{" "}
        <strong className="text-[var(--fg)]">{budgetTierLabel(repoTier)}</strong>
      </p>
    </div>
  );
}

function tierLabel(tier: RepoCostEstimate["tier"]): string {
  switch (tier) {
    case "free":
      return "무료";
    case "under_10":
      return "~$10";
    case "under_50":
      return "~$50";
    case "under_200":
      return "~$200";
    case "prod":
      return "프로덕션";
  }
}

function tierRangeLabel(tier: RepoCostEstimate["tier"]): string {
  switch (tier) {
    case "free":
      return "$0/월";
    case "under_10":
      return "$0–10/월";
    case "under_50":
      return "$10–50/월";
    case "under_200":
      return "$50–200/월";
    case "prod":
      return "$200+/월";
  }
}

function tierChipClass(tier: RepoCostEstimate["tier"]): string {
  if (tier === "free" || tier === "under_10") {
    return "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]";
  }
  if (tier === "prod") {
    return "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/15 text-[var(--fg)]";
  }
  return "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]";
}

function driverLabel(kind: "llm" | "gpu" | "saas" | "storage"): string {
  if (kind === "llm") return "LLM";
  if (kind === "gpu") return "GPU";
  if (kind === "saas") return "SaaS";
  return "Storage";
}

function driverChipClass(kind: "llm" | "gpu" | "saas" | "storage"): string {
  if (kind === "llm") {
    return "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";
  }
  if (kind === "gpu") {
    return "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]";
  }
  return "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";
}
