"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUDGET_OPTIONS,
  CLOUD_DEPLOY_OPTIONS,
  COMMON_SERVICES,
  CPU_ARCH_OPTIONS,
  DISK_OPTIONS,
  GPU_KIND_OPTIONS,
  RAM_OPTIONS,
  RUNTIME_MODE_OPTIONS,
  USER_ENV_PRESETS,
  type UserEnv,
  type UserEnvBudget,
  type UserEnvCpuArch,
  type UserEnvGpu,
  type UserEnvGpuKind,
  type UserEnvRuntimeMode,
  getUserCloudApis,
  userEnvIsEmpty,
} from "@/components/user-env";

// "내 환경 설정" 드로어 v2. 7축 입력 + 프리셋 + 수동 보정.
// 원칙:
//  - 입력 부담 최소 — 프리셋 하나만 눌러도 의미 있는 판정이 나가게
//  - 빈 값 허용 — null/undefined는 판정하지 않음
//  - "비우기"로 언제든 중립 비교로 되돌릴 수 있음
export function CompareEnvDrawer({
  open,
  env,
  onClose,
  onChange,
  onReset,
  extraServices,
  extraDeployTargets,
}: {
  open: boolean;
  env: UserEnv;
  onClose: () => void;
  onChange: (next: UserEnv) => void;
  onReset: () => void;
  extraServices?: string[];
  extraDeployTargets?: string[];
}) {
  if (!open) return null;
  return (
    <DrawerContent
      envInitial={env}
      onClose={onClose}
      onChange={onChange}
      onReset={onReset}
      extraServices={extraServices}
      extraDeployTargets={extraDeployTargets}
    />
  );
}

function DrawerContent({
  envInitial,
  onClose,
  onChange,
  onReset,
  extraServices,
  extraDeployTargets,
}: {
  envInitial: UserEnv;
  onClose: () => void;
  onChange: (next: UserEnv) => void;
  onReset: () => void;
  extraServices?: string[];
  extraDeployTargets?: string[];
}) {
  const [draft, setDraft] = useState<UserEnv>(envInitial);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    // 오픈 시 첫 번째 focusable(프리셋 버튼)로 포커스 이동.
    const t = window.setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.clearTimeout(t);
    };
  }, [onClose]);

  const isEmpty = userEnvIsEmpty(draft);

  // ── mutators ──────────────────────────────────────────────────────────────
  function setRuntime(
    key: "node" | "python" | "go" | "rust" | "java" | "ruby" | "bun" | "deno",
    value: string
  ) {
    setDraft((prev) => ({ ...prev, [key]: value.trim() || null }));
  }

  function setRam(v: number | null) {
    setDraft((prev) => ({ ...prev, ramGb: v }));
  }
  function setDisk(v: number | null) {
    setDraft((prev) => ({ ...prev, diskGb: v }));
  }
  function setCpuArch(v: UserEnvCpuArch) {
    setDraft((prev) => ({ ...prev, cpuArch: v }));
  }
  function setGpu(kind: UserEnvGpuKind, vramGb?: number | null) {
    const gpu: UserEnvGpu =
      kind === "none" ? { kind: "none" } : { kind, vramGb: vramGb ?? null };
    setDraft((prev) => ({ ...prev, gpu }));
  }
  function setDockerLevel(v: 0 | 1 | 2 | null) {
    setDraft((prev) => ({ ...prev, dockerLevel: v, hasDocker: undefined }));
  }
  function toggleDeploy(name: string) {
    setDraft((prev) => {
      const current = prev.cloudDeploy ?? [];
      return current.includes(name)
        ? { ...prev, cloudDeploy: current.filter((s) => s !== name) }
        : { ...prev, cloudDeploy: [...current, name] };
    });
  }
  function toggleService(name: string) {
    setDraft((prev) => {
      const current = getUserCloudApis(prev);
      const next = current.includes(name)
        ? current.filter((s) => s !== name)
        : [...current, name];
      return { ...prev, cloudApis: next, services: undefined };
    });
  }
  function setBudget(v: UserEnvBudget | null) {
    setDraft((prev) => ({ ...prev, budget: v }));
  }
  function setRuntimeMode(v: UserEnvRuntimeMode | null) {
    setDraft((prev) => ({ ...prev, runtimeMode: v }));
  }
  function applyPreset(apply: UserEnv) {
    setDraft(apply);
  }

  function handleSave() {
    onChange(draft);
    onClose();
  }
  function handleReset() {
    onReset();
    setDraft({});
  }

  // 레포 기반 suggested chips
  const serviceList = (() => {
    const extras = (extraServices ?? []).filter(
      (s) => typeof s === "string" && s.trim() !== ""
    );
    const seen = new Set(extras.map((s) => s.toLowerCase()));
    const rest = COMMON_SERVICES.filter((s) => !seen.has(s.toLowerCase()));
    return [...extras, ...rest];
  })();
  const deployList = (() => {
    const extras = (extraDeployTargets ?? []).filter(
      (s) => typeof s === "string" && s.trim() !== ""
    );
    const seen = new Set(extras.map((s) => s.toLowerCase()));
    const rest = CLOUD_DEPLOY_OPTIONS.filter(
      (s) => !seen.has(s.toLowerCase())
    );
    return [...extras, ...rest];
  })();

  const userApis = getUserCloudApis(draft);
  const dockerLevel =
    draft.dockerLevel ?? (draft.hasDocker === true ? 1 : draft.hasDocker === false ? 0 : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-end">
      <button
        type="button"
        aria-label="설정 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="env-drawer-title"
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] md:m-6 md:h-auto md:max-h-[calc(100vh-48px)] md:w-[460px] md:rounded-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2
                id="env-drawer-title"
                className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--fg)]"
              >
                내 환경 설정
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--fg-dim)]">
                레포가 내 환경에서 돌아가는지 바로 판정해요.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="text-[12px] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="space-y-5 px-4 py-4">
          {/* 1. 프리셋 */}
          <Section title="프리셋" hint="잘 모르면 가장 가까운 것 하나만 눌러도 판정이 나가요.">
            <ul className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="환경 프리셋">
              {USER_ENV_PRESETS.map((p, idx) => (
                <li key={p.id}>
                  <button
                    type="button"
                    ref={idx === 0 ? firstFocusableRef : undefined}
                    onClick={() => applyPreset(p.apply)}
                    className="flex w-full flex-col rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  >
                    <span className="text-[12px] font-medium text-[var(--fg)]">{p.label}</span>
                    <span className="mt-0.5 text-[10.5px] text-[var(--fg-dim)]">{p.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          {/* 2. 하드웨어 */}
          <Section title="하드웨어">
            <Field label="RAM">
              <ChipRow>
                {RAM_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={draft.ramGb === opt.value}
                    onClick={() => setRam(draft.ramGb === opt.value ? null : opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
            <Field label="디스크 여유">
              <ChipRow>
                {DISK_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={draft.diskGb === opt.value}
                    onClick={() => setDisk(draft.diskGb === opt.value ? null : opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
            <Field label="CPU">
              <ChipRow>
                {CPU_ARCH_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={draft.cpuArch === opt.value}
                    title={opt.hint}
                    onClick={() => setCpuArch(draft.cpuArch === opt.value ? null : opt.value)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
            <Field label="GPU">
              <ChipRow>
                {GPU_KIND_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    active={draft.gpu?.kind === opt.value}
                    title={opt.hint}
                    onClick={() => {
                      if (draft.gpu?.kind === opt.value) {
                        setDraft((p) => ({ ...p, gpu: null }));
                      } else {
                        setGpu(opt.value, draft.gpu?.vramGb);
                      }
                    }}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ChipRow>
              {draft.gpu && draft.gpu.kind !== "none" ? (
                <div className="mt-1.5">
                  <label className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                    VRAM
                    <input
                      type="number"
                      min={0}
                      max={256}
                      value={draft.gpu.vramGb ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw === "" ? null : Number(raw);
                        setGpu(draft.gpu!.kind, Number.isFinite(v) ? v : null);
                      }}
                      placeholder="8"
                      className="w-[70px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[11.5px] text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--border-strong)] focus:outline-none"
                    />
                    <span>GB</span>
                  </label>
                </div>
              ) : null}
            </Field>
          </Section>

          {/* 3. 런타임 */}
          <Section title="런타임 (선택)">
            <div className="grid grid-cols-2 gap-2">
              <RuntimeField
                label="Node.js"
                placeholder="예: 20, >=18"
                value={draft.node ?? ""}
                onChange={(v) => setRuntime("node", v)}
              />
              <RuntimeField
                label="Python"
                placeholder="예: 3.11"
                value={draft.python ?? ""}
                onChange={(v) => setRuntime("python", v)}
              />
              <RuntimeField
                label="Go"
                placeholder="예: 1.22"
                value={draft.go ?? ""}
                onChange={(v) => setRuntime("go", v)}
              />
              <RuntimeField
                label="Bun"
                placeholder="예: 1"
                value={draft.bun ?? ""}
                onChange={(v) => setRuntime("bun", v)}
              />
            </div>
          </Section>

          {/* 4. Docker (3단계) */}
          <Section title="Docker">
            <ChipRow>
              <Chip active={dockerLevel === 0} onClick={() => setDockerLevel(dockerLevel === 0 ? null : 0)}>
                없음
              </Chip>
              <Chip active={dockerLevel === 1} onClick={() => setDockerLevel(dockerLevel === 1 ? null : 1)}>
                로컬에서 쓸 수 있음
              </Chip>
              <Chip active={dockerLevel === 2} onClick={() => setDockerLevel(dockerLevel === 2 ? null : 2)}>
                Compose 멀티 OK
              </Chip>
            </ChipRow>
          </Section>

          {/* 5. 클라우드 배포 */}
          <Section
            title="배포 가능한 곳"
            hint="내가 실제로 배포할 수 있는 클라우드/플랫폼 (여러 개 OK)"
          >
            <ChipRow wrap>
              {deployList.map((name) => {
                const active = (draft.cloudDeploy ?? []).includes(name);
                return (
                  <Chip key={name} active={active} onClick={() => toggleDeploy(name)}>
                    {active ? "✓ " : ""}
                    {name}
                  </Chip>
                );
              })}
            </ChipRow>
          </Section>

          {/* 6. 외부 API / 서비스 */}
          <Section
            title="쓸 수 있는 외부 API (선택)"
            hint="OpenAI 키가 있다·Supabase 쓴다 같은 것들. 여러 개 선택 가능."
          >
            <ChipRow wrap>
              {serviceList.map((name) => {
                const active = userApis.includes(name);
                return (
                  <Chip key={name} active={active} onClick={() => toggleService(name)}>
                    {active ? "✓ " : ""}
                    {name}
                  </Chip>
                );
              })}
            </ChipRow>
          </Section>

          {/* 7. 월 예산 */}
          <Section title="월 예산" hint="이 레포를 돌리는 데 지출 가능한 금액">
            <ChipRow>
              {BUDGET_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.budget === opt.value}
                  title={opt.hint}
                  onClick={() => setBudget(draft.budget === opt.value ? null : opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </ChipRow>
          </Section>

          {/* 8. 실행 성향 */}
          <Section title="실행 성향">
            <ChipRow>
              {RUNTIME_MODE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.runtimeMode === opt.value}
                  title={opt.hint}
                  onClick={() =>
                    setRuntimeMode(draft.runtimeMode === opt.value ? null : opt.value)
                  }
                >
                  {opt.label}
                </Chip>
              ))}
            </ChipRow>
          </Section>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isEmpty}
            className="text-[11.5px] text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            비우기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] hover:opacity-90"
            >
              저장
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {title}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-5 text-[var(--fg-dim)]">{hint}</p>
      ) : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <p className="text-[11px] text-[var(--fg-muted)]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ChipRow({
  children,
  wrap = false,
  label,
}: {
  children: React.ReactNode;
  wrap?: boolean;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-1.5 ${wrap ? "flex-wrap" : "flex-wrap md:flex-nowrap"}`}
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 ${
        active
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function RuntimeField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11.5px] text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--border-strong)] focus:outline-none"
      />
    </label>
  );
}
