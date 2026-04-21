"use client";

import type { RepoEnvHardware } from "@/lib/analysis/types";
import type { CompatResult, UserEnv } from "@/components/user-env";

// 하드웨어 요구 상세 + 내 환경 대비.
// 판정 severity(match/warning/blocker)는 backend matchRepoToEnv의 항목 결과를
// 그대로 사용해 상단 Hero와 톤 일치.
export function EnvHardwareBlock({
  hardware,
  userEnv,
  compat,
}: {
  hardware: RepoEnvHardware;
  userEnv?: UserEnv;
  compat?: CompatResult | null;
}) {
  type Severity = "match" | "warning" | "blocker" | "missing";
  type Row = {
    label: string;
    repoValue: string;
    myValue?: string | null;
    severity: Severity;
    hint?: string;
  };

  const pickSeverity = (key: string): Severity => {
    const item = compat?.items.find((i) => i.key === key);
    if (!item) return "missing";
    if (item.status === "match") return "match";
    if (item.status === "missing") return "missing";
    if (item.severity === "blocker") return "blocker";
    if (item.severity === "warning") return "warning";
    return "missing";
  };

  const rows: Row[] = [];

  // RAM
  if (hardware.minRamGb != null || hardware.recommendedRamGb != null) {
    const min = hardware.minRamGb;
    const rec = hardware.recommendedRamGb;
    const repoValue =
      min != null && rec != null && min !== rec
        ? `${min}~${rec} GB`
        : `${rec ?? min} GB`;
    const myRam = userEnv?.ramGb ?? null;
    rows.push({
      label: "RAM",
      repoValue,
      myValue: myRam != null ? `${myRam} GB` : null,
      severity: pickSeverity("hw:ram"),
      hint: rec != null ? `권장 ${rec} GB` : undefined,
    });
  }

  // Disk
  if (hardware.minDiskGb != null) {
    const myDisk = userEnv?.diskGb ?? null;
    rows.push({
      label: "디스크",
      repoValue: `${hardware.minDiskGb} GB 이상`,
      myValue: myDisk != null ? `${myDisk} GB` : null,
      severity: pickSeverity("hw:disk"),
    });
  }

  // CPU arch
  if (hardware.cpuArch && hardware.cpuArch !== "any") {
    const userArch = userEnv?.cpuArch ?? null;
    rows.push({
      label: "CPU",
      repoValue: cpuArchDisplay(hardware.cpuArch),
      myValue: userArch ? cpuArchShort(userArch) : null,
      severity: pickSeverity("hw:arch"),
    });
  }

  // GPU + VRAM 합쳐서 한 행 — backend는 hw:gpu / hw:vram 분리, worst one 채택
  if (hardware.gpuRequired || hardware.minVramGb != null) {
    const parts: string[] = [];
    if (hardware.gpuHint?.trim()) parts.push(hardware.gpuHint.trim());
    if (hardware.minVramGb != null) parts.push(`VRAM ${hardware.minVramGb} GB`);
    if (hardware.acceleratorPreference) {
      parts.push(hardware.acceleratorPreference.toUpperCase());
    }
    const repoValue = parts.length > 0 ? parts.join(" · ") : hardware.gpuRequired ? "필요" : "권장";

    const gpu = userEnv?.gpu ?? null;
    const myParts: string[] = [];
    if (gpu) {
      if (gpu.kind === "none") {
        myParts.push("없음");
      } else {
        myParts.push(gpuKindLabel(gpu.kind));
        if (gpu.vramGb != null) myParts.push(`${gpu.vramGb} GB`);
      }
    }
    // worst severity of gpu & vram
    const sevRank = { missing: 0, match: 1, warning: 2, blocker: 3 } as const;
    const sev1 = pickSeverity("hw:gpu");
    const sev2 = pickSeverity("hw:vram");
    const severity: Severity = sevRank[sev1] >= sevRank[sev2] ? sev1 : sev2;
    rows.push({
      label: "GPU",
      repoValue,
      myValue: myParts.length > 0 ? myParts.join(" · ") : null,
      severity,
    });
  }

  if (rows.length === 0 && (hardware.notes?.length ?? 0) === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
        하드웨어 요구
      </h3>
      <p className="mt-0.5 text-[11px] text-[var(--fg-dim)]">
        이 레포를 돌리는 데 권장되는 최소 사양과 내 환경 비교입니다.
      </p>
      {rows.length > 0 ? (
        <dl className="mt-3 space-y-2">
          {rows.map((r) => (
            <CompareRow key={r.label} row={r} />
          ))}
        </dl>
      ) : null}
      {hardware.notes && hardware.notes.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--fg-muted)]">
          {hardware.notes.map((note, i) => (
            <li key={i}>· {note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CompareRow({
  row,
}: {
  row: {
    label: string;
    repoValue: string;
    myValue?: string | null;
    severity: "match" | "warning" | "blocker" | "missing";
    hint?: string;
  };
}) {
  const statusClass =
    row.severity === "match"
      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
      : row.severity === "blocker"
        ? "border-[var(--accent-warm)]/60 bg-[var(--accent-warm)]/20 text-[var(--fg)]"
        : row.severity === "warning"
          ? "border-[var(--accent-warm)]/40 bg-[var(--accent-warm)]/10 text-[var(--fg)]"
          : "border-dashed border-[var(--border)] text-[var(--fg-dim)]";
  const statusIcon =
    row.severity === "match"
      ? "✓"
      : row.severity === "blocker"
        ? "🚫"
        : row.severity === "warning"
          ? "⚠"
          : "?";
  const statusLabel =
    row.severity === "match"
      ? "맞음"
      : row.severity === "blocker"
        ? "차단"
        : row.severity === "warning"
          ? "주의"
          : "미지정";
  return (
    <div className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-[11.5px]">
      <dt className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {row.label}
      </dt>
      <dd className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-[var(--fg)]" title={row.hint}>
          {row.repoValue}
        </span>
        {row.myValue ? (
          <>
            <span aria-hidden className="text-[var(--fg-dim)]">
              vs
            </span>
            <span className="min-w-0 truncate text-[var(--fg-muted)]">
              내 {row.myValue}
            </span>
          </>
        ) : row.severity === "missing" ? (
          <span className="text-[10.5px] text-[var(--fg-dim)]">
            내 환경에서 미지정
          </span>
        ) : null}
      </dd>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${statusClass}`}
        title={statusLabel}
      >
        <span aria-hidden>{statusIcon}</span>
        <span className="sr-only">{statusLabel}</span>
        <span>{statusLabel}</span>
      </span>
    </div>
  );
}

function cpuArchDisplay(arch: "any" | "x64" | "arm64" | "apple-silicon-ok"): string {
  if (arch === "x64") return "x64 전제";
  if (arch === "arm64") return "ARM64";
  if (arch === "apple-silicon-ok") return "Apple Silicon OK";
  return "상관없음";
}

function cpuArchShort(arch: "apple-silicon" | "x64" | "arm64"): string {
  if (arch === "apple-silicon") return "Apple Silicon";
  if (arch === "x64") return "x64";
  return "ARM64";
}

function gpuKindLabel(kind: "none" | "igpu" | "nvidia" | "apple-mps" | "amd"): string {
  if (kind === "nvidia") return "NVIDIA";
  if (kind === "apple-mps") return "Apple MPS";
  if (kind === "amd") return "AMD";
  if (kind === "igpu") return "iGPU";
  return "없음";
}
