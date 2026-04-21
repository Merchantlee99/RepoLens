"use client";

import type { RepoEnvCloud } from "@/lib/analysis/types";
import { runtimeModeLabel } from "@/components/user-env";
import type { UserEnv } from "@/components/user-env";

// 배포 타깃 & 실행 성향 블록 + 내 배포 가능 환경 대비.
export function EnvDeployBlock({
  cloud,
  runtimeMode,
  userEnv,
}: {
  cloud: RepoEnvCloud;
  runtimeMode?: "local-only" | "local-or-cloud" | "cloud-required";
  userEnv?: UserEnv;
}) {
  const targets = cloud.deployTargets ?? [];
  const required = cloud.deployTargetRequired ?? null;
  if (targets.length === 0 && !required && !runtimeMode) return null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
        배포 타깃
      </h3>
      <p className="mt-0.5 text-[11px] text-[var(--fg-dim)]">
        이 레포가 전제하거나 지원하는 실행 환경입니다.
      </p>

      {runtimeMode ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
            실행 성향
          </span>
          <span
            className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${modeClass(runtimeMode)}`}
          >
            {runtimeModeLabel(runtimeMode)}
          </span>
        </div>
      ) : null}

      {required ? (
        <RequiredDeployCard required={required} userDeploy={userEnv?.cloudDeploy ?? []} />
      ) : null}

      {targets.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
            배포 가능
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {targets.map((t) => {
              const userHas = (userEnv?.cloudDeploy ?? []).some(
                (d) => d.trim().toLowerCase() === t.trim().toLowerCase()
              );
              return (
                <li
                  key={t}
                  title={userHas ? "내 배포 가능 환경에도 포함" : undefined}
                  className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
                    userHas
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--fg)]"
                      : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg)]"
                  }`}
                >
                  {userHas ? <span aria-hidden>✓</span> : null}
                  <span>{t}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function RequiredDeployCard({
  required,
  userDeploy,
}: {
  required: string;
  userDeploy: string[];
}) {
  const norm = (s: string) => s.trim().toLowerCase();
  const has = userDeploy.some((d) => norm(d) === norm(required));
  const hasSet = userDeploy.length > 0;
  const status: "match" | "mismatch" | "missing" = !hasSet
    ? "missing"
    : has
      ? "match"
      : "mismatch";
  const tone =
    status === "match"
      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
      : status === "mismatch"
        ? "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/15"
        : "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10";
  const statusIcon = status === "match" ? "✓" : status === "mismatch" ? "🚫" : "?";
  const statusLabel =
    status === "match"
      ? "내 배포 가능 환경에 있음"
      : status === "mismatch"
        ? "내 배포 가능 환경에 없음 — 이 레포를 돌리려면 필요"
        : "내 배포 가능 환경 미지정";
  return (
    <div className={`mt-3 rounded-md border px-2.5 py-2 ${tone}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
          필수 배포 타깃
        </p>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--fg)]">
          <span aria-hidden>{statusIcon}</span>
          <span>{statusLabel}</span>
        </span>
      </div>
      <p className="mt-0.5 text-[12.5px] font-medium text-[var(--fg)]">{required}</p>
      <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
        이 레포의 기본 설정은 {required}에 강하게 묶여 있어요.
      </p>
    </div>
  );
}

function modeClass(
  mode: "local-only" | "local-or-cloud" | "cloud-required"
): string {
  if (mode === "cloud-required") {
    return "border-[var(--accent-warm)]/50 bg-[var(--accent-warm)]/10 text-[var(--fg)]";
  }
  if (mode === "local-only") {
    return "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]";
  }
  return "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--fg-muted)]";
}
