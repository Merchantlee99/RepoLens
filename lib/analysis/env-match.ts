import type { RepoCostEstimate, RepoEnvRequirements, RepoEnvRuntime } from "@/lib/analysis/types";

export type UserEnvLike = Partial<Record<RepoEnvRuntime["name"], string | null>> & {
  runtimes?: Partial<Record<RepoEnvRuntime["name"], string | null>>;
  hasDocker?: boolean | null;
  services?: string[];
  ramGb?: number | null;
  diskGb?: number | null;
  hasGpu?: boolean | null;
  vramGb?: number | null;
  cpuArch?: "x64" | "arm64" | "apple-silicon" | "any" | null;
  accelerators?: Array<"cuda" | "mps" | "rocm" | "cpu-ok" | "cpu">;
  deployTargets?: string[];
  runtimeMode?: "local-only" | "local-or-cloud" | "cloud-required" | null;
  budgetTier?: RepoCostEstimate["tier"] | null;
};

export type EnvMatchReport = {
  items: Array<{
    key: string;
    label: string;
    status: "match" | "mismatch" | "missing";
    severity: "blocker" | "warning" | "info";
    detail?: string;
  }>;
  summary: {
    matched: number;
    mismatched: number;
    missing: number;
    blockers: number;
  };
  headline: string | null;
};

const RUNTIME_LABEL: Record<RepoEnvRuntime["name"], string> = {
  node: "Node.js",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  bun: "Bun",
  deno: "Deno",
};

const BUDGET_ORDER: RepoCostEstimate["tier"][] = [
  "free",
  "under_10",
  "under_50",
  "under_200",
  "prod",
];

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function canonicalServiceId(label: string) {
  const normalized = normalizeToken(label);

  if (/supabase postgres/.test(normalized)) return "postgres";
  if (/(^|[\s-])(postgres|postgresql|pg)([\s-]|$)/.test(normalized)) return "postgres";
  if (/(^|[\s-])mysql([\s-]|$)/.test(normalized)) return "mysql";
  if (/(^|[\s-])(mongo|mongodb)([\s-]|$)/.test(normalized)) return "mongodb";
  if (/upstash redis/.test(normalized)) return "redis";
  if (/(^|[\s-])redis([\s-]|$)/.test(normalized)) return "redis";
  if (/cloudflare r2|(^|[\s-])r2([\s-]|$)/.test(normalized)) return "cloudflare-r2";
  if (/(^|[\s-])(amazon s3|aws s3|s3)([\s-]|$)/.test(normalized)) return "s3";
  if (/(^|[\s-])(gcs|google cloud storage)([\s-]|$)/.test(normalized)) return "gcs";
  if (/(^|[\s-])(azure blob|azure storage blob)([\s-]|$)/.test(normalized)) return "azure-blob";
  if (/(^|[\s-])minio([\s-]|$)/.test(normalized)) return "minio";
  if (/open-?ai|chatgpt-api/.test(normalized)) return "openai";
  if (/anthropic|claude/.test(normalized)) return "anthropic";
  if (/(^|[\s-])supabase([\s-]|$)/.test(normalized)) return "supabase";
  if (/(^|[\s-])firebase([\s-]|$)/.test(normalized)) return "firebase";
  if (/(^|[\s-])stripe([\s-]|$)/.test(normalized)) return "stripe";
  if (/(^|[\s-])clerk([\s-]|$)/.test(normalized)) return "clerk";
  if (/(^|[\s-])auth0([\s-]|$)/.test(normalized)) return "auth0";
  if (/(^|[\s-])resend([\s-]|$)/.test(normalized)) return "resend";
  if (/sendgrid/.test(normalized)) return "sendgrid";
  if (/sentry/.test(normalized)) return "sentry";
  if (/pinecone/.test(normalized)) return "pinecone";
  if (/weaviate/.test(normalized)) return "weaviate";
  if (/qdrant/.test(normalized)) return "qdrant";
  if (/milvus/.test(normalized)) return "milvus";
  if (/chroma(?:db)?/.test(normalized)) return "chroma";

  return slugify(label);
}

function userRuntime(env: UserEnvLike, name: RepoEnvRuntime["name"]) {
  return env.runtimes?.[name] ?? env[name] ?? null;
}

function parseVersionCore(value: string | null | undefined) {
  if (!value) {
    return { major: null as number | null, minor: null as number | null };
  }

  const match = String(value).match(/(\d+)(?:\.(\d+))?/);
  if (!match) {
    return { major: null, minor: null };
  }

  return {
    major: Number(match[1]),
    minor: match[2] ? Number(match[2]) : null,
  };
}

type ParsedVersion = {
  major: number | null;
  minor: number | null;
};

type ParsedVersionRequirement = {
  min: ParsedVersion | null;
  minInclusive: boolean;
  max: ParsedVersion | null;
  maxInclusive: boolean;
  exact: boolean;
  majorWildcard: boolean;
};

function compareParsedVersion(left: ParsedVersion, right: ParsedVersion) {
  if (left.major === null || right.major === null) {
    return 0;
  }

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  return (left.minor ?? 0) - (right.minor ?? 0);
}

function parseRuntimeRequirement(version: string | null | undefined): ParsedVersionRequirement | null {
  const normalized = String(version ?? "").trim();
  if (!normalized || !/\d/.test(normalized) || /nightly|canary|latest/i.test(normalized)) {
    return null;
  }

  if (/\b\d+(?:\.\d+)?\s*(x|\*)\b/i.test(normalized)) {
    const parsed = parseVersionCore(normalized);
    return parsed.major === null
      ? null
      : {
          min: { major: parsed.major, minor: null },
          minInclusive: true,
          max: { major: parsed.major, minor: null },
          maxInclusive: true,
          exact: false,
          majorWildcard: true,
        };
  }

  const requirement: ParsedVersionRequirement = {
    min: null,
    minInclusive: true,
    max: null,
    maxInclusive: true,
    exact: false,
    majorWildcard: false,
  };

  normalized
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const operator = part.match(/^(>=|<=|>|<|\^|~)/)?.[1] ?? null;
      const parsed = parseVersionCore(operator ? part.slice(operator.length).trim() : part);
      if (parsed.major === null) {
        return;
      }

      if (!operator) {
        requirement.min = parsed;
        requirement.max = parsed;
        requirement.minInclusive = true;
        requirement.maxInclusive = true;
        requirement.exact = true;
        return;
      }

      if (operator === "^" || operator === "~") {
        requirement.min = parsed;
        requirement.minInclusive = true;
        requirement.max = { major: parsed.major, minor: null };
        requirement.maxInclusive = true;
        requirement.majorWildcard = true;
        return;
      }

      if (operator === ">=" || operator === ">") {
        requirement.min = parsed;
        requirement.minInclusive = operator === ">=";
        return;
      }

      if (operator === "<=" || operator === "<") {
        requirement.max = parsed;
        requirement.maxInclusive = operator === "<=";
      }
    });

  return requirement.min || requirement.max || requirement.exact ? requirement : null;
}

function versionSatisfiesRequirement(userValue: string, runtimeVersion: string) {
  const user = parseVersionCore(userValue);
  const requirement = parseRuntimeRequirement(runtimeVersion);

  if (user.major === null || !requirement) {
    return null;
  }

  const wildcardMajor = requirement.min?.major ?? null;
  if (requirement.majorWildcard && wildcardMajor !== null) {
    return user.major === wildcardMajor;
  }

  if (requirement.min) {
    const comparedToMin = compareParsedVersion(user, requirement.min);
    if (comparedToMin < 0 || (!requirement.minInclusive && comparedToMin === 0)) {
      return false;
    }
  }

  if (requirement.max) {
    const comparedToMax = compareParsedVersion(user, requirement.max);
    if (requirement.exact) {
      return comparedToMax === 0;
    }
    if (comparedToMax > 0 || (!requirement.maxInclusive && comparedToMax === 0)) {
      return false;
    }
  }

  return true;
}

function runtimeStatus(runtime: RepoEnvRequirements["runtimes"][number], userValue: string | null) {
  if (!userValue) {
    return {
      status: "missing" as const,
      severity: "info" as const,
      detail: "내 환경에서 지정하지 않음",
    };
  }

  if (!runtime.version) {
    return {
      status: "match" as const,
      severity: "info" as const,
      detail: undefined,
    };
  }

  const userCore = parseVersionCore(userValue);
  if (userCore.major === null) {
    return {
      status: "missing" as const,
      severity: "info" as const,
      detail: `버전 형식을 해석하지 못했습니다: ${userValue}`,
    };
  }

  const semverVerdict = versionSatisfiesRequirement(userValue, runtime.version);
  if (semverVerdict === false) {
    return {
      status: "mismatch" as const,
      severity: "blocker" as const,
      detail: `내 환경 ${userValue}가 필요 버전 ${runtime.version}와 맞지 않습니다.`,
    };
  }
  if (semverVerdict === true) {
    return {
      status: "match" as const,
      severity: "info" as const,
      detail: undefined,
    };
  }

  const minMajor = runtime.minMajor ?? null;
  const maxMajor = runtime.maxMajor ?? null;

  if (minMajor !== null && userCore.major < minMajor) {
    return {
      status: "mismatch" as const,
      severity: "blocker" as const,
      detail: `내 환경 ${userValue} < 필요 ${runtime.version}`,
    };
  }
  if (maxMajor !== null && userCore.major > maxMajor) {
    return {
      status: "mismatch" as const,
      severity: "blocker" as const,
      detail: `내 환경 ${userValue} > 허용 ${runtime.version}`,
    };
  }

  return {
    status: "match" as const,
    severity: "info" as const,
    detail: undefined,
  };
}

function normalizedDockerRequirement(env: RepoEnvRequirements) {
  const role = env.container.dockerRole ?? "none";
  if (role === "required") return "required" as const;
  if (role === "recommended" || role === "optional-dev" || role === "optional-deploy") {
    return "recommended" as const;
  }
  return "optional" as const;
}

function budgetRank(tier: RepoCostEstimate["tier"] | null | undefined) {
  return tier ? BUDGET_ORDER.indexOf(tier) : -1;
}

function providerKey(label: string) {
  return slugify(label);
}

function pushItem(
  target: EnvMatchReport["items"],
  item: EnvMatchReport["items"][number]
) {
  target.push(item);
}

export function buildEnvMatchReport(
  requirements: RepoEnvRequirements,
  env: UserEnvLike
): EnvMatchReport {
  const items: EnvMatchReport["items"] = [];

  requirements.runtimes.forEach((runtime) => {
    const verdict = runtimeStatus(runtime, userRuntime(env, runtime.name));
    pushItem(items, {
      key: `runtime:${runtime.name}`,
      label: `${RUNTIME_LABEL[runtime.name]}${runtime.version ? ` ${runtime.version}` : ""}`,
      status: verdict.status,
      severity: verdict.severity,
      detail: verdict.detail,
    });
  });

  if (requirements.hardware.minRamGb !== null) {
    if (env.ramGb === null || env.ramGb === undefined) {
      pushItem(items, {
        key: "hw:ram",
        label: `RAM 최소 ${requirements.hardware.minRamGb}GB`,
        status: "missing",
        severity: "info",
        detail: "내 RAM 정보를 입력하지 않았습니다.",
      });
    } else if (env.ramGb < requirements.hardware.minRamGb) {
      pushItem(items, {
        key: "hw:ram",
        label: `RAM 최소 ${requirements.hardware.minRamGb}GB`,
        status: "mismatch",
        severity: "warning",
        detail: `내 RAM ${env.ramGb}GB < 필요 ${requirements.hardware.minRamGb}GB`,
      });
    } else if (
      requirements.hardware.recommendedRamGb !== null &&
      env.ramGb < requirements.hardware.recommendedRamGb
    ) {
      pushItem(items, {
        key: "hw:ram",
        label: `RAM 권장 ${requirements.hardware.recommendedRamGb}GB`,
        status: "mismatch",
        severity: "warning",
        detail: `내 RAM ${env.ramGb}GB < 권장 ${requirements.hardware.recommendedRamGb}GB`,
      });
    } else {
      pushItem(items, {
        key: "hw:ram",
        label:
          requirements.hardware.recommendedRamGb !== null
            ? `RAM 권장 ${requirements.hardware.recommendedRamGb}GB`
            : `RAM 최소 ${requirements.hardware.minRamGb}GB`,
        status: "match",
        severity: "info",
      });
    }
  }

  if (requirements.hardware.minDiskGb !== null) {
    if (env.diskGb === null || env.diskGb === undefined) {
      pushItem(items, {
        key: "hw:disk",
        label: `디스크 ${requirements.hardware.minDiskGb}GB`,
        status: "missing",
        severity: "info",
      });
    } else if (env.diskGb < requirements.hardware.minDiskGb) {
      pushItem(items, {
        key: "hw:disk",
        label: `디스크 ${requirements.hardware.minDiskGb}GB`,
        status: "mismatch",
        severity: "warning",
        detail: `내 디스크 ${env.diskGb}GB < 필요 ${requirements.hardware.minDiskGb}GB`,
      });
    } else {
      pushItem(items, {
        key: "hw:disk",
        label: `디스크 ${requirements.hardware.minDiskGb}GB`,
        status: "match",
        severity: "info",
      });
    }
  }

  if (requirements.hardware.gpuRequired || (requirements.hardware.minVramGb ?? 0) > 0) {
    if (env.hasGpu === false) {
      pushItem(items, {
        key: "hw:gpu",
        label: requirements.hardware.gpuHint
          ? `GPU (${requirements.hardware.gpuHint})`
          : "GPU",
        status: "mismatch",
        severity: "blocker",
        detail: "레포는 GPU 신호가 있지만 내 환경은 GPU 미보유입니다.",
      });
    } else if (env.hasGpu === undefined || env.hasGpu === null) {
      pushItem(items, {
        key: "hw:gpu",
        label: requirements.hardware.gpuHint
          ? `GPU (${requirements.hardware.gpuHint})`
          : "GPU",
        status: "missing",
        severity: "info",
        detail: "내 GPU 보유 여부를 입력하지 않았습니다.",
      });
    } else {
      pushItem(items, {
        key: "hw:gpu",
        label: requirements.hardware.gpuHint
          ? `GPU (${requirements.hardware.gpuHint})`
          : "GPU",
        status: "match",
        severity: "info",
      });
    }
  }

  if ((requirements.hardware.minVramGb ?? 0) > 0) {
    if (env.vramGb === null || env.vramGb === undefined) {
      pushItem(items, {
        key: "hw:vram",
        label: `VRAM ${requirements.hardware.minVramGb}GB`,
        status: "missing",
        severity: "info",
        detail: "내 VRAM 정보를 입력하지 않았습니다.",
      });
    } else if (env.vramGb < (requirements.hardware.minVramGb ?? 0)) {
      pushItem(items, {
        key: "hw:vram",
        label: `VRAM ${requirements.hardware.minVramGb}GB`,
        status: "mismatch",
        severity: "blocker",
        detail: `내 VRAM ${env.vramGb}GB < 필요 ${requirements.hardware.minVramGb}GB`,
      });
    } else {
      pushItem(items, {
        key: "hw:vram",
        label: `VRAM ${requirements.hardware.minVramGb}GB`,
        status: "match",
        severity: "info",
      });
    }
  }

  if (requirements.hardware.cpuArch && requirements.hardware.cpuArch !== "any") {
    const repoArch = requirements.hardware.cpuArch;
    const userArch = env.cpuArch ?? null;
    if (!userArch) {
      pushItem(items, {
        key: "hw:arch",
        label: `CPU 아키텍처 ${repoArch}`,
        status: "missing",
        severity: "info",
      });
    } else {
      const matches =
        repoArch === "apple-silicon-ok"
          ? userArch === "apple-silicon" || userArch === "arm64" || userArch === "x64"
          : repoArch === "arm64"
            ? userArch === "arm64" || userArch === "apple-silicon"
            : repoArch === "x64"
              ? userArch === "x64"
              : true;
      pushItem(items, {
        key: "hw:arch",
        label: `CPU 아키텍처 ${repoArch}`,
        status: matches ? "match" : "mismatch",
        severity: matches ? "info" : "blocker",
        detail: matches ? undefined : `내 아키텍처 ${userArch}와 맞지 않습니다.`,
      });
    }
  }

  if (requirements.hardware.acceleratorPreference && requirements.hardware.acceleratorPreference !== "cpu-ok") {
    const accelerators = new Set((env.accelerators ?? []).map((item) => normalizeToken(item)));
    const accelerator = requirements.hardware.acceleratorPreference;
    if (accelerators.size === 0) {
      pushItem(items, {
        key: "hw:accelerator",
        label: `가속기 ${accelerator}`,
        status: "missing",
        severity: "info",
      });
    } else if (!accelerators.has(accelerator)) {
      pushItem(items, {
        key: "hw:accelerator",
        label: `가속기 ${accelerator}`,
        status: "mismatch",
        severity: "warning",
        detail: `내 가속기 목록에 ${accelerator}가 없습니다.`,
      });
    } else {
      pushItem(items, {
        key: "hw:accelerator",
        label: `가속기 ${accelerator}`,
        status: "match",
        severity: "info",
      });
    }
  }

  const dockerNeed = normalizedDockerRequirement(requirements);
  if (requirements.container.hasDockerfile || requirements.container.hasDockerCompose) {
    if (env.hasDocker === undefined || env.hasDocker === null) {
      pushItem(items, {
        key: "docker",
        label:
          dockerNeed === "required"
            ? "Docker 필수"
            : dockerNeed === "recommended"
              ? "Docker 권장"
              : "Docker 선택",
        status: "missing",
        severity: "info",
      });
    } else if (env.hasDocker === false && dockerNeed !== "optional") {
      pushItem(items, {
        key: "docker",
        label:
          dockerNeed === "required"
            ? "Docker 필수"
            : "Docker 권장",
        status: "mismatch",
        severity: "warning",
        detail:
          dockerNeed === "required"
            ? "이 레포는 Docker 전제 흐름이 있습니다."
            : "Docker가 있으면 실행과 보조 서비스 구성이 쉬워집니다.",
      });
    } else {
      pushItem(items, {
        key: "docker",
        label:
          dockerNeed === "required"
            ? "Docker 필수"
            : dockerNeed === "recommended"
              ? "Docker 권장"
              : "Docker 선택",
        status: "match",
        severity: "info",
      });
    }
  }

  const deployTargetRequired = requirements.cloud.deployTargetRequired ?? null;
  const userDeployTargets = new Set((env.deployTargets ?? []).map((target) => providerKey(target)));
  if (deployTargetRequired) {
    const key = providerKey(deployTargetRequired);
    if (userDeployTargets.size === 0) {
      pushItem(items, {
        key: `cloud:deploy:${key}`,
        label: `${deployTargetRequired} 배포`,
        status: "missing",
        severity: "info",
      });
    } else if (!userDeployTargets.has(key)) {
      pushItem(items, {
        key: `cloud:deploy:${key}`,
        label: `${deployTargetRequired} 배포`,
        status: "mismatch",
        severity: "blocker",
        detail: `${deployTargetRequired} 전용 배포 신호가 있습니다.`,
      });
    } else {
      pushItem(items, {
        key: `cloud:deploy:${key}`,
        label: `${deployTargetRequired} 배포`,
        status: "match",
        severity: "info",
      });
    }
  }

  if (requirements.runtimeMode === "cloud-required") {
    if (env.runtimeMode === null || env.runtimeMode === undefined) {
      pushItem(items, {
        key: "runtime-mode",
        label: "클라우드 실행 전제",
        status: "missing",
        severity: "info",
      });
    } else if (env.runtimeMode === "local-only") {
      pushItem(items, {
        key: "runtime-mode",
        label: "클라우드 실행 전제",
        status: "mismatch",
        severity: "blocker",
        detail: "이 레포는 클라우드 인프라 전제 신호가 있습니다.",
      });
    } else {
      pushItem(items, {
        key: "runtime-mode",
        label: "클라우드 실행 전제",
        status: "match",
        severity: "info",
      });
    }
  }

  const requiredServiceDetails =
    requirements.cloud.servicesRequiredDetails?.length
      ? requirements.cloud.servicesRequiredDetails
      : (requirements.cloud.apiServicesRequired ?? requirements.cloud.servicesRequired).map((label) => ({
          label,
          canonicalId: canonicalServiceId(label),
        }));
  const userServices = new Set((env.services ?? []).map(canonicalServiceId));
  requiredServiceDetails.forEach((service) => {
    if ((env.services?.length ?? 0) === 0) {
      pushItem(items, {
        key: `svc:${service.canonicalId}`,
        label: service.label,
        status: "missing",
        severity: "info",
        detail: "내 환경에서 외부 서비스 보유 여부를 입력하지 않았습니다.",
      });
      return;
    }

    pushItem(items, {
      key: `svc:${service.canonicalId}`,
      label: service.label,
      status: userServices.has(service.canonicalId) ? "match" : "mismatch",
      severity: userServices.has(service.canonicalId) ? "info" : "warning",
      detail: userServices.has(service.canonicalId)
        ? undefined
        : `내 환경 서비스 목록에 ${service.label}이 없습니다.`,
    });
  });

  if (requirements.costEstimate?.tier) {
    const requiredTier = requirements.costEstimate.tier;
    const userTier = env.budgetTier ?? null;
    if (!userTier) {
      pushItem(items, {
        key: "budget",
        label: `예산 ${requiredTier}`,
        status: "missing",
        severity: "info",
      });
    } else if (budgetRank(userTier) < budgetRank(requiredTier)) {
      pushItem(items, {
        key: "budget",
        label: `예산 ${requiredTier}`,
        status: "mismatch",
        severity: "warning",
        detail: `내 예산 단계 ${userTier} < 레포 요구 ${requiredTier}`,
      });
    } else {
      pushItem(items, {
        key: "budget",
        label: `예산 ${requiredTier}`,
        status: "match",
        severity: "info",
      });
    }
  }

  const summary = {
    matched: items.filter((item) => item.status === "match").length,
    mismatched: items.filter((item) => item.status === "mismatch").length,
    missing: items.filter((item) => item.status === "missing").length,
    blockers: items.filter((item) => item.status === "mismatch" && item.severity === "blocker").length,
  };

  const headline =
    items.find((item) => item.status === "mismatch" && item.severity === "blocker")?.detail ?? null;

  return {
    items,
    summary,
    headline,
  };
}
