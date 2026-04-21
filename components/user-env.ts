"use client";

// "내 환경" v2 — Result/Compare가 레포를 사용자 관점에서 판정하기 위한 스펙.
// 판정 엔진은 backend의 `lib/analysis/env-match.ts` (buildEnvMatchReport)로
// 단일화되어 있고, 이 파일은:
//   - UserEnv v2 타입 + localStorage 영속
//   - v1 → v2 migrate-on-read
//   - UserEnv → UserEnvLike 어댑터 (GPU kind → hasGpu/accelerators/vramGb 분해)
//   - 프리셋/라벨/칩 옵션
// 만 담당한다.

import { useCallback, useSyncExternalStore } from "react";
import {
  buildEnvMatchReport,
  type EnvMatchReport,
  type UserEnvLike,
} from "@/lib/analysis/env-match";
import type {
  CloudService,
  RepoAnalysis,
  RepoCostEstimate,
  RepoEnvCloud,
  RepoEnvRuntime,
} from "@/lib/analysis/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserEnvGpuKind =
  | "none"
  | "igpu"
  | "nvidia"
  | "apple-mps"
  | "amd";

export type UserEnvGpu = {
  kind: UserEnvGpuKind;
  vramGb?: number | null;
};

export type UserEnvCpuArch = "apple-silicon" | "x64" | "arm64" | null;

export type UserEnvBudget = RepoCostEstimate["tier"]; // "free" | "under_10" | …

export type UserEnvRuntimeMode = "local-only" | "local-or-cloud" | "cloud-ok";

export type UserEnv = {
  // 1. 런타임
  node?: string | null;
  python?: string | null;
  go?: string | null;
  rust?: string | null;
  java?: string | null;
  ruby?: string | null;
  bun?: string | null;
  deno?: string | null;

  // 2. 하드웨어
  ramGb?: number | null;
  diskGb?: number | null;
  cpuArch?: UserEnvCpuArch;
  gpu?: UserEnvGpu | null;

  // 3. Docker 3단계 — 0=없음, 1=로컬, 2=Compose 멀티
  dockerLevel?: 0 | 1 | 2 | null;
  /** @deprecated dockerLevel을 쓰되 v1 호환용으로 남김 */
  hasDocker?: boolean;

  // 4. 클라우드 배포 타깃
  cloudDeploy?: string[];

  // 5. 외부 API 서비스 (내 보유 키)
  cloudApis?: string[];
  /** @deprecated v1 name — cloudApis로 이관됨. 읽기 호환용 */
  services?: string[];

  // 6. 월 예산
  budget?: UserEnvBudget | null;

  // 7. 실행 성향
  runtimeMode?: UserEnvRuntimeMode | null;
};

type RuntimeName = RepoEnvRuntime["name"];

const RUNTIME_KEYS: RuntimeName[] = [
  "node",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "bun",
  "deno",
];

const STORAGE_KEY_V2 = "repolens:user-env:v2";
const STORAGE_KEY_V1 = "repolens:user-env:v1";

// ─── Constants: UI options ─────────────────────────────────────────────────

export const RAM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 8, label: "8 GB" },
  { value: 16, label: "16 GB" },
  { value: 32, label: "32 GB" },
  { value: 64, label: "64 GB" },
  { value: 128, label: "128 GB+" },
];

export const DISK_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 50, label: "50 GB" },
  { value: 200, label: "200 GB" },
  { value: 500, label: "500 GB" },
  { value: 1000, label: "1 TB+" },
];

export const CPU_ARCH_OPTIONS: Array<{
  value: Exclude<UserEnvCpuArch, null>;
  label: string;
  hint: string;
}> = [
  { value: "apple-silicon", label: "Apple Silicon", hint: "M1/M2/M3/M4 맥" },
  { value: "x64", label: "Intel · AMD x64", hint: "윈도우/리눅스/인텔 맥" },
  { value: "arm64", label: "ARM64 Linux", hint: "라즈베리파이 · 서버" },
];

export const GPU_KIND_OPTIONS: Array<{
  value: UserEnvGpuKind;
  label: string;
  hint: string;
}> = [
  { value: "none", label: "없음", hint: "CPU만" },
  { value: "igpu", label: "내장(iGPU)", hint: "Intel/AMD 내장" },
  { value: "nvidia", label: "NVIDIA", hint: "CUDA 지원" },
  { value: "apple-mps", label: "Apple MPS", hint: "M 시리즈 맥 GPU" },
  { value: "amd", label: "AMD", hint: "ROCm 지원" },
];

export const BUDGET_OPTIONS: Array<{
  value: UserEnvBudget;
  label: string;
  hint: string;
}> = [
  { value: "free", label: "무료만", hint: "무료 티어로만" },
  { value: "under_10", label: "월 $10 이하", hint: "가볍게 취미" },
  { value: "under_50", label: "월 $50 이하", hint: "사이드 프로젝트" },
  { value: "under_200", label: "월 $200 이하", hint: "진지한 개인용" },
  { value: "prod", label: "프로덕션", hint: "회사 예산 수준" },
];

export const RUNTIME_MODE_OPTIONS: Array<{
  value: UserEnvRuntimeMode;
  label: string;
  hint: string;
}> = [
  { value: "local-only", label: "로컬만", hint: "내 컴퓨터에서만" },
  { value: "local-or-cloud", label: "혼합", hint: "로컬 + 약간 클라우드" },
  { value: "cloud-ok", label: "클라우드 OK", hint: "k8s/서버리스도 좋아요" },
];

export const CLOUD_DEPLOY_OPTIONS: string[] = [
  "AWS",
  "GCP",
  "Azure",
  "Vercel",
  "Cloudflare",
  "Fly",
  "Railway",
  "Render",
  "Netlify",
  "Self-host",
];

export const COMMON_SERVICES = [
  "OpenAI",
  "Anthropic",
  "Supabase",
  "Firebase",
  "Postgres",
  "MySQL",
  "Redis",
  "Stripe",
  "Auth0",
  "Clerk",
];

// ─── Presets ────────────────────────────────────────────────────────────────

export const USER_ENV_PRESETS: Array<{
  id: string;
  label: string;
  hint: string;
  apply: UserEnv;
}> = [
  {
    id: "mbp-m2-16",
    label: "맥북 M2 16GB",
    hint: "Apple Silicon + 가볍게",
    apply: {
      node: ">=20",
      ramGb: 16,
      cpuArch: "apple-silicon",
      gpu: { kind: "apple-mps" },
      dockerLevel: 1,
      budget: "under_10",
      runtimeMode: "local-only",
    },
  },
  {
    id: "mbp-m3-pro",
    label: "맥북 M3 Pro 36GB",
    hint: "여유 있는 Apple Silicon",
    apply: {
      node: ">=20",
      python: ">=3.11",
      ramGb: 36,
      cpuArch: "apple-silicon",
      gpu: { kind: "apple-mps" },
      dockerLevel: 2,
      budget: "under_50",
      runtimeMode: "local-or-cloud",
    },
  },
  {
    id: "win-rtx-4070",
    label: "윈도우 RTX 4070",
    hint: "게이밍 PC · 12GB VRAM",
    apply: {
      node: ">=20",
      python: ">=3.11",
      ramGb: 32,
      cpuArch: "x64",
      gpu: { kind: "nvidia", vramGb: 12 },
      dockerLevel: 1,
      budget: "under_50",
      runtimeMode: "local-only",
    },
  },
  {
    id: "linux-rtx-4090",
    label: "리눅스 RTX 4090",
    hint: "파워 유저 · 24GB VRAM",
    apply: {
      python: ">=3.11",
      ramGb: 64,
      cpuArch: "x64",
      gpu: { kind: "nvidia", vramGb: 24 },
      dockerLevel: 2,
      budget: "under_200",
      runtimeMode: "local-or-cloud",
    },
  },
  {
    id: "ai-starter",
    label: "AI 앱 시작",
    hint: "Node + OpenAI 키",
    apply: {
      node: ">=20",
      ramGb: 16,
      dockerLevel: 0,
      cloudApis: ["OpenAI"],
      budget: "under_50",
      runtimeMode: "local-or-cloud",
    },
  },
  {
    id: "node-project",
    label: "Node.js 프로젝트",
    hint: "웹 백엔드 기본",
    apply: {
      node: ">=20",
      ramGb: 16,
      dockerLevel: 1,
      budget: "under_10",
      runtimeMode: "local-or-cloud",
    },
  },
  {
    id: "python-project",
    label: "Python 프로젝트",
    hint: "데이터/스크립트 기본",
    apply: {
      python: ">=3.11",
      ramGb: 16,
      dockerLevel: 1,
      budget: "under_10",
      runtimeMode: "local-or-cloud",
    },
  },
  {
    id: "aws-freetier",
    label: "AWS 프리티어",
    hint: "배포 AWS만",
    apply: {
      cloudDeploy: ["AWS"],
      budget: "free",
      runtimeMode: "cloud-ok",
    },
  },
  {
    id: "company-prod",
    label: "회사 프로덕션",
    hint: "k8s · 여러 클라우드",
    apply: {
      cloudDeploy: ["AWS", "GCP"],
      dockerLevel: 2,
      budget: "prod",
      runtimeMode: "cloud-ok",
    },
  },
  {
    id: "empty",
    label: "비어있음",
    hint: "판정을 끄고 중립 비교",
    apply: {},
  },
];

// ─── Migration ──────────────────────────────────────────────────────────────

function migrateV1(raw: UserEnv): UserEnv {
  const next: UserEnv = { ...raw };
  if (next.services && next.services.length > 0 && !next.cloudApis) {
    next.cloudApis = [...next.services];
  }
  if (next.dockerLevel == null && typeof next.hasDocker === "boolean") {
    next.dockerLevel = next.hasDocker ? 1 : 0;
  }
  return next;
}

function readFromStorage(): UserEnv {
  if (typeof window === "undefined") return {};
  try {
    const v2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as UserEnv;
      if (parsed && typeof parsed === "object") return parsed;
    }
    const v1 = window.localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const parsed = JSON.parse(v1) as UserEnv;
      if (parsed && typeof parsed === "object") {
        const migrated = migrateV1(parsed);
        try {
          window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
          window.localStorage.removeItem(STORAGE_KEY_V1);
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

// ─── Storage (useSyncExternalStore) ─────────────────────────────────────────

let cachedSnapshot: UserEnv = {};
let cachedSnapshotKey = "";
const EMPTY_SNAPSHOT: UserEnv = {};

function refreshSnapshot(): UserEnv {
  const next = readFromStorage();
  const nextKey = JSON.stringify(next);
  if (nextKey !== cachedSnapshotKey) {
    cachedSnapshot = next;
    cachedSnapshotKey = nextKey;
  }
  return cachedSnapshot;
}

function getSnapshot(): UserEnv {
  return cachedSnapshot;
}

function writeToStorage(env: UserEnv) {
  if (typeof window === "undefined") return;
  try {
    if (!env || Object.keys(env).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY_V2);
    } else {
      window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(env));
    }
    window.dispatchEvent(new CustomEvent("repolens:user-env-change"));
  } catch {
    /* ignore */
  }
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    refreshSnapshot();
    onChange();
  };
  refreshSnapshot();
  window.addEventListener("storage", handler);
  window.addEventListener("repolens:user-env-change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("repolens:user-env-change", handler);
  };
}

export function useUserEnv(): [UserEnv, (next: UserEnv) => void, () => void] {
  const env = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const setEnv = useCallback((next: UserEnv) => writeToStorage(next), []);
  const reset = useCallback(() => writeToStorage({}), []);
  return [env, setEnv, reset];
}

export function userEnvIsEmpty(env: UserEnv): boolean {
  if (!env) return true;
  const hasRuntime = RUNTIME_KEYS.some(
    (k) => (env[k] ?? null) !== null && env[k] !== undefined
  );
  const hasHardware =
    env.ramGb != null ||
    env.diskGb != null ||
    env.cpuArch != null ||
    (env.gpu != null && env.gpu.kind !== "none");
  const hasDocker =
    env.dockerLevel != null || typeof env.hasDocker === "boolean";
  const hasCloudDeploy = (env.cloudDeploy?.length ?? 0) > 0;
  const hasCloudApis =
    (env.cloudApis?.length ?? 0) > 0 || (env.services?.length ?? 0) > 0;
  const hasBudget = env.budget != null;
  const hasRuntimeMode = env.runtimeMode != null;
  return !(
    hasRuntime ||
    hasHardware ||
    hasDocker ||
    hasCloudDeploy ||
    hasCloudApis ||
    hasBudget ||
    hasRuntimeMode
  );
}

export function getUserCloudApis(env: UserEnv): string[] {
  const merged = new Set<string>();
  for (const s of env.cloudApis ?? []) merged.add(s);
  for (const s of env.services ?? []) merged.add(s);
  return Array.from(merged);
}

export function getUserDockerLevel(env: UserEnv): 0 | 1 | 2 | null {
  if (env.dockerLevel != null) return env.dockerLevel;
  if (env.hasDocker === true) return 1;
  if (env.hasDocker === false) return 0;
  return null;
}

// ─── Adapter: UserEnv → UserEnvLike ─────────────────────────────────────────

// Backend `buildEnvMatchReport`이 기대하는 flat 구조로 변환.
// gpu.kind → hasGpu/accelerators 분해, dockerLevel → hasDocker로 압축.
export function toUserEnvLike(env: UserEnv): UserEnvLike {
  const dockerLevel = getUserDockerLevel(env);
  const hasDocker: boolean | null =
    dockerLevel == null ? null : dockerLevel > 0;

  const gpu = env.gpu ?? null;
  const hasGpu: boolean | null =
    gpu == null ? null : gpu.kind !== "none";

  const accelerators: Array<"cuda" | "mps" | "rocm" | "cpu-ok" | "cpu"> = [];
  if (gpu) {
    if (gpu.kind === "nvidia") accelerators.push("cuda");
    else if (gpu.kind === "apple-mps") accelerators.push("mps");
    else if (gpu.kind === "amd") accelerators.push("rocm");
    else if (gpu.kind === "none") accelerators.push("cpu-ok");
    // igpu → 가속기 없음
  }

  return {
    node: env.node ?? null,
    python: env.python ?? null,
    go: env.go ?? null,
    rust: env.rust ?? null,
    java: env.java ?? null,
    ruby: env.ruby ?? null,
    bun: env.bun ?? null,
    deno: env.deno ?? null,
    hasDocker,
    services: getUserCloudApis(env),
    ramGb: env.ramGb ?? null,
    diskGb: env.diskGb ?? null,
    hasGpu,
    vramGb: gpu?.vramGb ?? null,
    cpuArch: env.cpuArch ?? null,
    accelerators,
    deployTargets: env.cloudDeploy ?? [],
    // 프론트 "cloud-ok"("클라우드 OK")를 backend 매처의 "cloud-required"로 번역.
    // 의미: "사용자는 클라우드 실행도 수용함" → 레포가 cloud-required여도 match.
    runtimeMode:
      env.runtimeMode === "cloud-ok"
        ? "cloud-required"
        : env.runtimeMode ?? null,
    budgetTier: env.budget ?? null,
  };
}

// ─── Matching (backend-delegated) ───────────────────────────────────────────

// 프론트 편의를 위해 EnvMatchReport에 warnings 카운트 하나만 추가.
export type CompatResult = EnvMatchReport & {
  warnings: number;
};

export function matchRepoToEnv(analysis: RepoAnalysis, env: UserEnv): CompatResult {
  const requirements = analysis.learning?.environment;
  if (!requirements) {
    return {
      items: [],
      summary: { matched: 0, mismatched: 0, missing: 0, blockers: 0 },
      headline: null,
      warnings: 0,
    };
  }
  const report = buildEnvMatchReport(requirements, toUserEnvLike(env));
  const warnings = report.items.filter((i) => i.severity === "warning").length;
  return { ...report, warnings };
}

// ─── Display helpers (kept for UI components) ───────────────────────────────

export function budgetTierLabel(tier: RepoCostEstimate["tier"]): string {
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

export function runtimeModeLabel(
  mode: "local-only" | "local-or-cloud" | "cloud-required" | "cloud-ok"
): string {
  if (mode === "local-only") return "로컬 전용";
  if (mode === "cloud-required") return "클라우드 필수";
  return "혼합";
}

// Docker role을 UI가 공통으로 쓰는 3-상태로 정규화. 새 값(optional/recommended/
// required) 우선, 레거시(optional-dev/optional-deploy → recommended, none → 중립).
export type EffectiveDockerRole = "required" | "recommended" | "optional" | "none";

export function normalizeDockerRole(
  raw: string | null | undefined,
  legacyNeedsDocker: boolean
): EffectiveDockerRole {
  switch (raw) {
    case "required":
      return "required";
    case "recommended":
    case "optional-dev":
    case "optional-deploy":
      return "recommended";
    case "optional":
      return "optional";
    case "none":
      return "none";
    default:
      return legacyNeedsDocker ? "required" : "none";
  }
}

// ─── Helpers for drawer suggestions ─────────────────────────────────────────

function normalize(v: string): string {
  return v.replace(/\s+/g, "").toLowerCase();
}

// ─── Service category split ─────────────────────────────────────────────────
// "API 키가 필요한 SaaS" vs "core infra"를 분리 렌더하기 위한 헬퍼.
//
// 기준:
//  - backend의 apiServicesRequired/Optional이 명시적으로 분류한 "계정 필요" 쪽
//  - 그 외의 servicesRequired/Optional은 infra (DB/Queue/…)
//  - CloudService.kind가 있으면 보조 신호로 활용(ai/payment/auth/email → api)

export type CloudServiceCategory = "api" | "infra";

const API_KINDS: Array<CloudService["kind"]> = ["ai", "payment", "auth", "email"];

export function serviceCategory(svc: Pick<CloudService, "kind">): CloudServiceCategory {
  return API_KINDS.includes(svc.kind) ? "api" : "infra";
}

export type SplitServices = {
  apiRequired: CloudService[];
  apiOptional: CloudService[];
  infraRequired: CloudService[];
  infraOptional: CloudService[];
};

// CloudService 디테일을 우선 사용, 없으면 string 배열을 synthesize.
// apiServicesRequired가 별도로 있으면 그 교집합을 "api" 카테고리로 강제 고정.
export function splitServices(cloud: RepoEnvCloud | null | undefined): SplitServices {
  const empty: SplitServices = {
    apiRequired: [],
    apiOptional: [],
    infraRequired: [],
    infraOptional: [],
  };
  if (!cloud) return empty;

  const apiRequiredLabels = new Set(
    (cloud.apiServicesRequired ?? []).map(normalize)
  );
  const apiOptionalLabels = new Set(
    (cloud.apiServicesOptional ?? []).map(normalize)
  );

  function resolve(details: CloudService[] | undefined, flat: string[] | undefined, apiHint: Set<string>): CloudService[] {
    if (details && details.length > 0) return details;
    return (flat ?? []).map((label) => ({
      label,
      canonicalId: normalize(label),
      kind: apiHint.has(normalize(label)) ? "ai" : "other",
    }));
  }

  const required = resolve(cloud.servicesRequiredDetails, cloud.servicesRequired, apiRequiredLabels);
  const optional = resolve(cloud.servicesOptionalDetails, cloud.servicesOptional, apiOptionalLabels);

  const requiredApiLabels = apiRequiredLabels;
  const optionalApiLabels = apiOptionalLabels;

  const out: SplitServices = { ...empty };
  for (const svc of required) {
    const isApi =
      requiredApiLabels.has(normalize(svc.label)) ||
      requiredApiLabels.has(normalize(svc.canonicalId)) ||
      serviceCategory(svc) === "api";
    (isApi ? out.apiRequired : out.infraRequired).push(svc);
  }
  for (const svc of optional) {
    const isApi =
      optionalApiLabels.has(normalize(svc.label)) ||
      optionalApiLabels.has(normalize(svc.canonicalId)) ||
      serviceCategory(svc) === "api";
    (isApi ? out.apiOptional : out.infraOptional).push(svc);
  }
  return out;
}

// kind별 아이콘(text) + 라벨(aria). 실제 아이콘은 emoji로 가볍게 — 과장 금지.
export function serviceKindIcon(kind: CloudService["kind"]): string {
  switch (kind) {
    case "ai":
      return "🤖";
    case "database":
      return "🗄";
    case "auth":
      return "🔐";
    case "payment":
      return "💳";
    case "email":
      return "✉️";
    case "queue":
      return "📨";
    case "infra":
      return "⚙️";
    default:
      return "·";
  }
}

export function serviceKindLabel(kind: CloudService["kind"]): string {
  switch (kind) {
    case "ai":
      return "AI";
    case "database":
      return "DB";
    case "auth":
      return "Auth";
    case "payment":
      return "Payment";
    case "email":
      return "Email";
    case "queue":
      return "Queue";
    case "infra":
      return "Infra";
    default:
      return "기타";
  }
}

// ─── Compose / multi-container 보조 ──────────────────────────────────────────

export function describeDockerNeed(
  role: EffectiveDockerRole,
  needsMultiContainer: boolean | undefined,
  composeServiceCount: number | undefined
): { short: string; long: string } | null {
  if (role === "none") return null;
  const multi = Boolean(needsMultiContainer || (composeServiceCount ?? 0) >= 2);
  if (role === "required") {
    return multi
      ? {
          short: composeServiceCount
            ? `Docker Compose · ${composeServiceCount}개 서비스`
            : "Docker Compose (멀티)",
          long: "여러 컨테이너를 Compose로 같이 띄워야 동작합니다.",
        }
      : { short: "Docker", long: "Docker로 실행하는 흐름이 전제입니다." };
  }
  if (role === "recommended") {
    return {
      short: multi ? "Docker Compose (권장)" : "Docker (권장)",
      long: "있으면 실행/보조 서비스 구성이 훨씬 편해집니다.",
    };
  }
  // optional
  return {
    short: multi ? "Docker Compose (선택)" : "Docker (선택)",
    long: "선택 사항 — 없어도 돌아갑니다.",
  };
}

// ─── Drawer suggestions ─────────────────────────────────────────────────────

export function collectCloudServiceLabels(
  analyses: Array<RepoAnalysis | null | undefined>
): string[] {
  const seen = new Map<string, string>();
  for (const a of analyses) {
    const cloud = a?.learning?.environment?.cloud;
    if (!cloud) continue;
    const details = [
      ...(cloud.servicesRequiredDetails ?? []),
      ...(cloud.servicesOptionalDetails ?? []),
    ];
    if (details.length > 0) {
      for (const svc of details) {
        const id = normalize(svc.canonicalId);
        if (!seen.has(id)) seen.set(id, svc.label);
      }
    } else {
      const names = [
        ...(cloud.apiServicesRequired ?? cloud.servicesRequired ?? []),
        ...(cloud.apiServicesOptional ?? cloud.servicesOptional ?? []),
      ];
      for (const name of names) {
        const id = normalize(name);
        if (!seen.has(id)) seen.set(id, name);
      }
    }
  }
  return Array.from(seen.values());
}

// 프리셋 ID로 preset apply 값을 조회. 딥링크(?env=mbp-m3-pro)에서 한 번 적용
// 후 URL 파라미터를 제거하는 플로우에서 사용.
export function presetApplyById(id: string): UserEnv | null {
  const p = USER_ENV_PRESETS.find((preset) => preset.id === id);
  return p ? { ...p.apply } : null;
}

export function collectDeployTargets(
  analyses: Array<RepoAnalysis | null | undefined>
): string[] {
  const seen = new Set<string>();
  for (const a of analyses) {
    const targets = a?.learning?.environment?.cloud?.deployTargets ?? [];
    const required = a?.learning?.environment?.cloud?.deployTargetRequired;
    for (const t of targets) seen.add(t);
    if (required) seen.add(required);
  }
  return Array.from(seen);
}
