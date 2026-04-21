import { parsePackageJson, type PackageJsonShape } from "@/lib/analysis/heuristics";
import type {
  AnalysisFact,
  AnalysisNotice,
  EvidenceSource,
  OwnerAnalysis,
  OwnerRepoEnvSnapshot,
  OwnerProfileType,
  OwnerRecommendationReason,
  OwnerRepoCategory,
  OwnerRepositorySummary,
} from "@/lib/analysis/types";

export type OwnerProfileSnapshot = {
  login: string;
  url: string;
  avatarUrl: string | null;
  profileType: OwnerProfileType;
  displayName: string | null;
  description: string | null;
  blog: string | null;
  location: string | null;
  publicRepoCount: number;
};

export type OwnerRepositorySnapshot = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  updatedAt: string;
  archived: boolean;
  fork: boolean;
  readmeText?: string | null;
  packageJsonText?: string | null;
  pythonManifestPath?: string | null;
  pythonManifestText?: string | null;
  dockerfileText?: string | null;
  composePath?: string | null;
  composeText?: string | null;
  deployConfigPaths?: string[];
};

export type OwnerAnalysisSnapshot = {
  profile: OwnerProfileSnapshot;
  repositories: OwnerRepositorySnapshot[];
  sampledRepoCount?: number;
  enrichedRepoCount?: number;
};

type EnrichedOwnerRepository = OwnerRepositorySummary &
  OwnerRepositorySnapshot & {
  themeSignals: string[];
};

const OWNER_CATEGORY_LABELS: Record<OwnerRepoCategory, string> = {
  product: "제품/앱",
  library: "라이브러리",
  example: "예제/학습",
  tooling: "도구/SDK",
  docs: "문서/가이드",
  infra: "인프라",
};

const STACK_TOPIC_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  typescript: "TypeScript",
  javascript: "JavaScript",
  nodejs: "Node.js",
  node: "Node.js",
  python: "Python",
  tailwindcss: "Tailwind CSS",
  tailwind: "Tailwind CSS",
  prisma: "Prisma",
  supabase: "Supabase",
  firebase: "Firebase",
  openai: "OpenAI",
  vercel: "Vercel",
};

const STACK_DEPENDENCY_LABELS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  typescript: "TypeScript",
  tailwindcss: "Tailwind CSS",
  prisma: "Prisma",
  drizzle: "Drizzle",
  "@supabase/supabase-js": "Supabase",
  supabase: "Supabase",
  firebase: "Firebase",
  "firebase-admin": "Firebase",
  openai: "OpenAI",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  vue: "Vue",
  svelte: "Svelte",
  vite: "Vite",
  zustand: "Zustand",
  redux: "Redux",
  zod: "Zod",
  trpc: "tRPC",
  "@trpc/server": "tRPC",
  mongoose: "Mongoose",
};

const THEME_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "AI", pattern: /\b(ai|llm|gpt|assistant|openai|anthropic|rag|agent)\b/i },
  { label: "UI", pattern: /\b(ui|component|components|design-system|storybook|frontend|front-end)\b/i },
  { label: "API", pattern: /\b(api|backend|server|route handler|rest|graphql)\b/i },
  { label: "데이터", pattern: /\b(data|database|db|analytics|warehouse|etl)\b/i },
  { label: "인증", pattern: /\b(auth|oauth|identity|login|sign in|signup|session)\b/i },
  { label: "학습", pattern: /\b(example|starter|template|tutorial|guide|learn|workshop|boilerplate)\b/i },
  { label: "개발 도구", pattern: /\b(cli|sdk|tooling|tool|plugin|generator|linter|formatter)\b/i },
  { label: "인프라", pattern: /\b(terraform|kubernetes|helm|docker|infra|devops|deployment|platform)\b/i },
  { label: "문서", pattern: /\b(docs?|documentation|handbook|manual)\b/i },
];

const OWNER_THEME_TOPIC_EXCLUSIONS = new Set([
  "postgres",
  "postgresql",
  "database",
  "databases",
  "mysql",
  "mariadb",
  "redis",
  "mongodb",
  "openai",
  "anthropic",
  "supabase",
  "firebase",
  "vercel",
  "nextjs",
  "react",
  "typescript",
  "javascript",
  "nodejs",
  "node",
  "python",
  "go",
  "rust",
  "elixir",
  "tailwindcss",
  "tailwind",
  "prisma",
  "drizzle",
]);

const OWNER_ENV_SERVICE_DEPENDENCIES: Record<string, string> = {
  pg: "PostgreSQL",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mysql2: "MySQL",
  mongodb: "MongoDB",
  mongoose: "MongoDB",
  redis: "Redis",
  ioredis: "Redis",
  openai: "OpenAI",
  "@anthropic-ai/sdk": "Anthropic",
  anthropic: "Anthropic",
  stripe: "Stripe",
  "@supabase/supabase-js": "Supabase",
  supabase: "Supabase",
  firebase: "Firebase",
  "firebase-admin": "Firebase",
};

const OWNER_RUNTIME_LANGUAGE_LABELS: Partial<Record<NonNullable<OwnerRepositorySnapshot["language"]>, string>> = {
  TypeScript: "Node",
  JavaScript: "Node",
  Python: "Python",
  Go: "Go",
  Rust: "Rust",
  Java: "Java",
  Ruby: "Ruby",
};

const GPU_SIGNAL_PATTERN = /\b(torch|tensorflow(?:-gpu)?|cuda|cupy|jax(?:\[cuda\])?|nvidia|gpu)\b/i;
const GPU_HINT_PATTERN = /\b(cuda|gpu|rtx|apple silicon|metal|nvidia)\b/i;
const OWNER_DEPLOY_TARGET_PRIORITY = [
  "Vercel",
  "Railway",
  "Fly.io",
  "Render",
  "Netlify",
  "GitHub Pages",
] as const;

function readmeLines(text: string | null | undefined) {
  return (text ?? "")
    .slice(0, 12000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pythonVersionFromManifest(path: string | null | undefined, text: string | null | undefined) {
  if (!path || !text) return null;

  if (path === "pyproject.toml") {
    return text.match(/requires-python\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
  }

  if (path === "setup.py") {
    return text.match(/python_requires\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
  }

  if (path === "setup.cfg") {
    return text.match(/python_requires\s*=\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
  }

  if (path === "requirements.txt") {
    return null;
  }

  if (path === "environment.yml" || path === "environment.yaml") {
    return (
      text.match(/(?:^|\n)\s*-\s*python(?:[=<>!~]=?|==)\s*([0-9][^\s#]*)/i)?.[1] ??
      text.match(/(?:^|\n)\s*python(?:[=<>!~]=?|==)\s*([0-9][^\s#]*)/i)?.[1] ??
      null
    );
  }

  return null;
}

function ownerLoginFromFullName(fullName: string) {
  return fullName.split("/")[0] ?? "";
}

function normalizeIdentifier(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repoAgeDays(updatedAt: string) {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function humanizeRuntimeVersion(version: string | null | undefined) {
  if (!version) return null;
  const normalized = version.trim();
  const gte = normalized.match(/^>=\s*([0-9]+(?:\.[0-9]+)?)/);
  if (gte) return `${gte[1]}+`;
  const caret = normalized.match(/^\^?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (caret) return caret[1];
  return normalized;
}

function runtimeDisplay(label: string, version: string | null | undefined) {
  const humanized = humanizeRuntimeVersion(version);
  return humanized ? `${label} ${humanized}` : label;
}

function detectRuntimeLabel(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null) {
  const labels: string[] = [];
  const nodeVersion = pkg?.engines?.node ?? null;
  const pythonVersion = pythonVersionFromManifest(repo.pythonManifestPath, repo.pythonManifestText);

  if (pkg || nodeVersion) {
    labels.push(runtimeDisplay("Node", nodeVersion));
  }

  if (repo.pythonManifestText || pythonVersion) {
    labels.push(runtimeDisplay("Python", pythonVersion));
  }

  if (labels.length > 0) {
    return unique(labels).join(" · ");
  }

  const languageLabel = repo.language ? OWNER_RUNTIME_LANGUAGE_LABELS[repo.language] : null;
  return languageLabel ?? null;
}

function detectGpuHint(repo: OwnerRepositorySnapshot) {
  for (const line of readmeLines(repo.readmeText)) {
    if (GPU_HINT_PATTERN.test(line)) {
      return line.length > 140 ? `${line.slice(0, 137)}...` : line;
    }
  }

  return null;
}

function deployTargetsFromConfigPaths(paths: string[]) {
  const targets = new Set<string>();

  paths.forEach((path) => {
    const normalized = path.toLowerCase();
    if (normalized.endsWith("vercel.json")) targets.add("Vercel");
    if (normalized.endsWith("netlify.toml")) targets.add("Netlify");
    if (normalized.endsWith("fly.toml")) targets.add("Fly.io");
    if (normalized.endsWith("railway.json")) targets.add("Railway");
    if (normalized.endsWith("render.yaml") || normalized.endsWith("render.yml")) targets.add("Render");
  });

  return [...targets];
}

function sortDeployTargets(targets: Iterable<string>) {
  return [...new Set(targets)].sort((left, right) => {
    const leftIndex = OWNER_DEPLOY_TARGET_PRIORITY.indexOf(
      left as (typeof OWNER_DEPLOY_TARGET_PRIORITY)[number]
    );
    const rightIndex = OWNER_DEPLOY_TARGET_PRIORITY.indexOf(
      right as (typeof OWNER_DEPLOY_TARGET_PRIORITY)[number]
    );
    const normalizedLeft = leftIndex === -1 ? OWNER_DEPLOY_TARGET_PRIORITY.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? OWNER_DEPLOY_TARGET_PRIORITY.length : rightIndex;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

function detectDeployTargets(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null) {
  const targets = new Set<string>();
  const signal = `${repo.homepage ?? ""}\n${pkg?.homepage ?? ""}\n${repo.readmeText ?? ""}`;

  if (/vercel(\.app|\.com)?/i.test(signal)) targets.add("Vercel");
  if (/netlify(\.app|\.com)?/i.test(signal)) targets.add("Netlify");
  if (/fly\.io|fly\.dev/i.test(signal)) targets.add("Fly.io");
  if (/railway(\.app)?/i.test(signal)) targets.add("Railway");
  if (/render(\.com)?|onrender\.com/i.test(signal)) targets.add("Render");
  if (/github\.io|github pages/i.test(signal)) targets.add("GitHub Pages");
  deployTargetsFromConfigPaths(repo.deployConfigPaths ?? []).forEach((target) => targets.add(target));

  return sortDeployTargets(targets);
}

function detectRequiredServices(
  repo: OwnerRepositorySnapshot,
  pkg: PackageJsonShape | null
) {
  const services = new Set<string>();
  const dependencies = dependencyNames(pkg);

  dependencies.forEach((dependency) => {
    const label = OWNER_ENV_SERVICE_DEPENDENCIES[dependency.toLowerCase()];
    if (label) services.add(label);
  });

  const composeSignal = repo.composeText?.toLowerCase() ?? "";

  if (/\b(postgres|postgresql)\b/.test(composeSignal)) services.add("PostgreSQL");
  if (/\bredis\b/.test(composeSignal)) services.add("Redis");
  if (/\bmysql\b/.test(composeSignal)) services.add("MySQL");
  if (/\bmongo(db)?\b/.test(composeSignal)) services.add("MongoDB");

  const readmeSignal = repo.readmeText ?? "";
  if (/cloudflare\s*r2/i.test(readmeSignal)) services.add("Cloudflare R2");
  if (/upstash\s*redis/i.test(readmeSignal)) services.add("Upstash Redis");

  return [...services];
}

function buildEnvironmentPillSummary(snapshot: OwnerRepoEnvSnapshot) {
  const tokens = [
    snapshot.runtimeLabel,
    snapshot.needsDocker ? "Docker" : null,
    snapshot.gpuRequired ? "GPU 필요" : null,
  ].filter((value): value is string => Boolean(value));

  if (tokens.length === 0 && snapshot.servicesRequired[0]) {
    tokens.push(`${snapshot.servicesRequired[0]} 필요`);
  }

  return tokens.length > 0 ? tokens.join(" · ") : null;
}

function beginnerSetupPenalty(repo: EnrichedOwnerRepository) {
  let penalty = 0;

  if (repo.environment.gpuRequired) penalty += 28;
  if (repo.environment.needsDocker) penalty += 10;
  if (repo.environment.servicesRequired.length >= 2) {
    penalty += Math.min(12, (repo.environment.servicesRequired.length - 1) * 4);
  }

  return penalty;
}

function hasLightweightSetup(repo: EnrichedOwnerRepository) {
  return (
    !repo.environment.gpuRequired &&
    !repo.environment.needsDocker &&
    repo.environment.servicesRequired.length <= 1
  );
}

function buildEnvironmentSnapshot(
  repo: OwnerRepositorySnapshot,
  pkg: PackageJsonShape | null,
  sampling: OwnerRepositorySummary["sampling"]
): OwnerRepoEnvSnapshot {
  const runtimeLabel = detectRuntimeLabel(repo, pkg);
  const needsDocker = Boolean(repo.dockerfileText || repo.composeText);
  const servicesRequired = detectRequiredServices(repo, pkg);
  const deployTargets = detectDeployTargets(repo, pkg);
  const gpuRequired = GPU_SIGNAL_PATTERN.test(
    [repo.readmeText, repo.pythonManifestText, repo.packageJsonText, repo.dockerfileText, repo.composeText]
      .filter((value): value is string => Boolean(value))
      .join("\n")
  );
  const gpuHint = detectGpuHint(repo);
  const sourceKinds = new Set<string>();

  if (sampling.packageJsonSampled) sourceKinds.add("package_json");
  if (sampling.readmeSampled) sourceKinds.add("readme");
  if (repo.pythonManifestText) sourceKinds.add("python_manifest");
  if (repo.dockerfileText || repo.composeText) sourceKinds.add("docker");
  if ((repo.deployConfigPaths ?? []).length > 0) sourceKinds.add("deploy_config");
  if (runtimeLabel && !sampling.packageJsonSampled && !repo.pythonManifestText && repo.language) {
    sourceKinds.add("repo");
  }

  let confidence: OwnerRepoEnvSnapshot["confidence"] = "low";
  if (sourceKinds.has("repo") && sourceKinds.size === 1) {
    confidence = "low";
  } else if (sourceKinds.size >= 3) {
    confidence = "high";
  } else if (sourceKinds.size >= 1) {
    confidence = "medium";
  }

  const environment: OwnerRepoEnvSnapshot = {
    runtimeLabel,
    needsDocker,
    gpuRequired,
    gpuHint,
    servicesRequired,
    deployTargets,
    pillSummary: null,
    confidence,
  };

  environment.pillSummary = buildEnvironmentPillSummary(environment);
  return environment;
}

function officialRepoAffinityScore(repo: EnrichedOwnerRepository, pkg: PackageJsonShape | null) {
  const ownerLogin = ownerLoginFromFullName(repo.fullName);
  const ownerToken = normalizeIdentifier(ownerLogin);
  const repoToken = normalizeIdentifier(repo.name);
  const pkgName = (pkg?.name ?? "").toLowerCase();
  const signal = normalizeSignal([
    repo.name,
    repo.description,
    repo.homepage,
    repo.readmeText,
    pkg?.name,
    pkg?.description,
    ...(pkg?.keywords ?? []),
  ]);
  let score = 0;

  if (ownerToken && repoToken === ownerToken) score += 24;
  if (ownerToken && repoToken.startsWith(ownerToken) && repoToken !== ownerToken) score += 20;
  if (ownerToken && repoToken.endsWith(ownerToken) && repoToken !== ownerToken) score += 12;
  if (ownerLogin && pkgName.startsWith(`@${ownerLogin.toLowerCase()}/`)) score += 16;
  if (
    ownerLogin &&
    new RegExp(
      `\\b${escapeRegex(ownerLogin)}[- ]?(sdk|api|client|node|python|js|ts|go|java|ruby)\\b`,
      "i"
    ).test(signal)
  ) {
    score += 18;
  }
  if (/\b(official|primary|reference)\b/i.test(signal) && /\b(sdk|api|client|library)\b/i.test(signal)) {
    score += 14;
  }
  if (repo.category === "tooling" && /\b(sdk|api|client)\b/i.test(signal)) {
    score += 12;
  }
  if (repo.homepage && repo.sampling.readmeSampled) score += 6;

  return score;
}

function staleFeaturedPenalty(repo: EnrichedOwnerRepository) {
  const ageDays = repoAgeDays(repo.updatedAt);
  if (ageDays === null) return 0;

  let penalty = 0;

  if (ageDays > 365 * 5) penalty += 28;
  else if (ageDays > 365 * 3) penalty += 18;
  else if (ageDays > 365 * 2) penalty += 10;
  else if (ageDays > 365) penalty += 4;

  if (ageDays > 365 * 2 && !repo.homepage && !repo.sampling.packageJsonSampled) {
    penalty += 8;
  }

  if (ageDays > 365 * 2 && /^[a-z0-9]+-\d+(?:\.\d+)*$/i.test(repo.name)) {
    penalty += 12;
  }

  return penalty;
}

function normalizeSignal(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function topEntries(values: string[], count: number) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, count)
    .map(([value]) => value);
}

function dateFreshnessScore(updatedAt: string) {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return 0;

  const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

  if (ageDays <= 30) return 18;
  if (ageDays <= 90) return 12;
  if (ageDays <= 180) return 8;
  if (ageDays <= 365) return 4;
  return 0;
}

function readmeSignal(text: string | null | undefined) {
  if (!text) return "";
  return text.slice(0, 12000).toLowerCase();
}

function packageKeywordSignal(pkg: PackageJsonShape | null) {
  if (!pkg) return [];
  return [pkg.name, pkg.description, ...(pkg.keywords ?? [])].filter((value): value is string => Boolean(value));
}

function dependencyNames(pkg: PackageJsonShape | null) {
  if (!pkg) return [];
  return unique([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
}

function buildRepositorySignal(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null) {
  return normalizeSignal([
    repo.name,
    repo.description,
    repo.homepage,
    ...repo.topics,
    ...packageKeywordSignal(pkg),
    readmeSignal(repo.readmeText),
    ...dependencyNames(pkg),
  ]);
}

function detectCategory(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null): OwnerRepoCategory {
  const signal = buildRepositorySignal(repo, pkg);

  if (/\b(docs?|documentation|guide|guides|handbook|manual|website)\b/.test(signal)) {
    return "docs";
  }

  if (/\b(example|examples|tutorial|starter|template|learn|demo|workshop|boilerplate|quickstart)\b/.test(signal)) {
    return "example";
  }

  if (/\b(cli|sdk|tool|tools|plugin|action|eslint|config|generator|starter-kit|codemod)\b/.test(signal)) {
    return "tooling";
  }

  if (/\b(terraform|kubernetes|helm|docker|infra|devops|deployment|iac|platform engineering)\b/.test(signal)) {
    return "infra";
  }

  if (/\b(component|components|design-system|ui|primitive|library|kit|icons?)\b/.test(signal)) {
    return "library";
  }

  return "product";
}

function detectStackSignals(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null) {
  const topicMatches = repo.topics
    .map((topic) => STACK_TOPIC_LABELS[topic.toLowerCase()])
    .filter((value): value is string => Boolean(value));
  const languageMatches = repo.language
    ? [STACK_TOPIC_LABELS[repo.language.toLowerCase()] ?? repo.language]
    : [];
  const dependencyMatches = dependencyNames(pkg)
    .map((dependency) => STACK_DEPENDENCY_LABELS[dependency.toLowerCase()])
    .filter((value): value is string => Boolean(value));
  const readmeMatches = Object.entries(STACK_TOPIC_LABELS)
    .filter(([token]) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(repo.readmeText ?? ""))
    .map(([, label]) => label);

  return unique([...topicMatches, ...languageMatches, ...dependencyMatches, ...readmeMatches]).slice(0, 6);
}

function detectThemeSignals(repo: OwnerRepositorySnapshot, pkg: PackageJsonShape | null, category: OwnerRepoCategory) {
  const signal = buildRepositorySignal(repo, pkg);
  const tags = new Set<string>();

  tags.add(OWNER_CATEGORY_LABELS[category]);

  repo.topics.forEach((topic) => {
    const normalized = topic.trim().toLowerCase();
    if (!normalized || STACK_TOPIC_LABELS[normalized]) return;
    if (normalized.length <= 2) return;
    if (OWNER_THEME_TOPIC_EXCLUSIONS.has(normalized)) return;
    tags.add(topic);
  });

  THEME_PATTERNS.forEach(({ label, pattern }) => {
    if (pattern.test(signal)) {
      tags.add(label);
    }
  });

  return [...tags].slice(0, 6);
}

function pushReason(
  reasons: OwnerRecommendationReason[],
  args: { code: OwnerRecommendationReason["code"]; label: string; source: EvidenceSource }
) {
  if (reasons.some((reason) => reason.code === args.code)) {
    return;
  }

  reasons.push(args);
}

function featuredReasonDetails(repo: EnrichedOwnerRepository) {
  const reasons: OwnerRecommendationReason[] = [];

  if (repo.category === "product") {
    pushReason(reasons, {
      code: "active_product",
      label: "대표 제품 흐름을 보여주는 레포",
      source: "heuristic",
    });
  }

  if (repo.homepage) {
    pushReason(reasons, {
      code: "deployed_preview",
      label: "공식 사이트나 배포 주소가 보임",
      source: "repo",
    });
  }

  if (repo.stars >= 500) {
    pushReason(reasons, {
      code: "high_stars",
      label: "대표 공개 레포로 볼 수 있을 만큼 관심도가 높음",
      source: "repo",
    });
  }

  if (dateFreshnessScore(repo.updatedAt) >= 12) {
    pushReason(reasons, {
      code: "recently_updated",
      label: "최근에도 계속 관리되고 있음",
      source: "repo",
    });
  }

  if (repo.category === "library") {
    pushReason(reasons, {
      code: "core_library",
      label: "재사용되는 핵심 라이브러리 성격이 강함",
      source: "heuristic",
    });
  }

  if (repo.category === "tooling") {
    pushReason(reasons, {
      code: "tooling_entry",
      label: "조직의 개발 도구 방향을 보여주는 레포",
      source: "heuristic",
    });
  }

  if (repo.description) {
    pushReason(reasons, {
      code: "clear_description",
      label: "설명이 비교적 분명해 맥락을 잡기 쉬움",
      source: "repo",
    });
  }

  if (repo.sampling.packageJsonSampled && repo.stackSignals.length > 0) {
    pushReason(reasons, {
      code: "package_stack_signal",
      label: `package.json에서 ${repo.stackSignals.slice(0, 2).join(" · ")} 신호가 보임`,
      source: "package_json",
    });
  }

  if (repo.sampling.readmeSampled && repo.stackSignals.length > 0) {
    pushReason(reasons, {
      code: "readme_stack_signal",
      label: "README에서 실제 사용 맥락을 확인할 수 있음",
      source: "readme",
    });
  }

  return reasons.slice(0, 4);
}

function beginnerReasonDetails(repo: EnrichedOwnerRepository) {
  const reasons: OwnerRecommendationReason[] = [];

  if (repo.category === "example") {
    pushReason(reasons, {
      code: "beginner_example",
      label: "예제나 스타터 성격이 강해 입문용으로 적합함",
      source: "heuristic",
    });
  }

  if (repo.category === "docs") {
    pushReason(reasons, {
      code: "docs_friendly",
      label: "문서나 가이드 성격이 강해 따라가기 쉬움",
      source: "heuristic",
    });
  }

  if (hasLightweightSetup(repo)) {
    pushReason(reasons, {
      code: "light_setup",
      label: "실행 환경 부담이 낮아 가볍게 훑어보기 좋음",
      source: "heuristic",
    });
  }

  if (repo.description) {
    pushReason(reasons, {
      code: "clear_description",
      label: "설명이 비교적 분명해 처음 읽기 좋음",
      source: "repo",
    });
  }

  if (repo.homepage) {
    pushReason(reasons, {
      code: "deployed_preview",
      label: "배포 주소가 있어 결과물을 바로 확인할 수 있음",
      source: "repo",
    });
  }

  if (dateFreshnessScore(repo.updatedAt) >= 12) {
    pushReason(reasons, {
      code: "recently_updated",
      label: "최근에도 관리되고 있어 현재 구조를 보기 좋음",
      source: "repo",
    });
  }

  if (repo.sampling.readmeSampled && repo.stackSignals.length > 0) {
    pushReason(reasons, {
      code: "readme_stack_signal",
      label: "README에 사용 흐름이 드러나 있음",
      source: "readme",
    });
  }

  if (repo.sampling.packageJsonSampled && repo.stackSignals.length > 0) {
    pushReason(reasons, {
      code: "package_stack_signal",
      label: "package.json만 봐도 기술 조합을 파악하기 쉬움",
      source: "package_json",
    });
  }

  if (repo.category === "library") {
    pushReason(reasons, {
      code: "core_library",
      label: "핵심 라이브러리라 구조가 비교적 선명함",
      source: "heuristic",
    });
  }

  return reasons.slice(0, 4);
}

function buildReasonSummary(args: {
  reasons: OwnerRecommendationReason[];
  fallback: string;
  emphasis: "featured" | "beginner";
}) {
  const [first, second] = args.reasons;

  if (!first) {
    return args.fallback;
  }

  if (args.emphasis === "featured") {
    if (first.code === "beginner_example") {
      return "입문용 예제 성격이 강해 먼저 보기 좋습니다.";
    }

    if (first.code === "deployed_preview") {
      return "공식 사이트 또는 배포 주소가 있어 결과물을 이해하기 쉽습니다.";
    }

    if (first.code === "high_stars") {
      return "대표 공개 레포로 보일 만큼 사용 흔적과 관심도가 높습니다.";
    }

    if (first.code === "core_library") {
      return "재사용 가능한 핵심 라이브러리 성격이 강합니다.";
    }
  }

  if (args.emphasis === "beginner") {
    if (first.code === "beginner_example") {
      return "예제 흐름이 분명해 이 오너를 처음 이해할 때 출발점으로 적합합니다.";
    }

    if (first.code === "docs_friendly") {
      return "문서와 가이드 성격이 강해 구조를 따라가기 쉽습니다.";
    }

    if (first.code === "light_setup") {
      return "실행 환경 부담이 낮아 가볍게 훑어보기 좋은 레포입니다.";
    }
  }

  return second ? `${first.label} · ${second.label}` : first.label;
}

function featuredScore(repo: EnrichedOwnerRepository) {
  let score = 0;
  const pkg = parsePackageJson(repo.packageJsonText ?? null);

  score += Math.min(repo.stars, 4000) / 35;
  score += Math.min(repo.forks, 1000) / 50;
  score += dateFreshnessScore(repo.updatedAt);
  score += officialRepoAffinityScore(repo, pkg);
  if (repo.description) score += 10;
  if (repo.homepage) score += 14;
  if (!repo.archived) score += 6;
  if (!repo.fork) score += 8;
  if (repo.sampling.readmeSampled) score += 4;
  if (repo.sampling.packageJsonSampled) score += 4;

  const categoryBonus: Record<OwnerRepoCategory, number> = {
    product: 18,
    library: 15,
    tooling: 12,
    example: 10,
    docs: 8,
    infra: 9,
  };

  score += categoryBonus[repo.category];

  repo.featuredReasonDetails.forEach((reason) => {
    if (reason.code === "high_stars") score += 12;
    if (reason.code === "deployed_preview") score += 10;
    if (reason.code === "active_product") score += 8;
    if (reason.code === "core_library") score += 6;
    if (reason.code === "recently_updated") score += 5;
  });

  return score - staleFeaturedPenalty(repo);
}

function beginnerScore(repo: EnrichedOwnerRepository) {
  let score = 0;

  if (repo.description) score += 18;
  if (repo.homepage) score += 10;
  if (!repo.archived) score += 6;
  if (!repo.fork) score += 8;
  score += Math.min(repo.stars, 1000) / 40;
  score += dateFreshnessScore(repo.updatedAt);
  if (repo.sampling.readmeSampled) score += 6;
  if (repo.sampling.packageJsonSampled) score += 4;

  const categoryBonus: Record<OwnerRepoCategory, number> = {
    product: 14,
    library: 10,
    example: 18,
    tooling: 8,
    docs: 16,
    infra: 6,
  };

  score += categoryBonus[repo.category];

  repo.beginnerReasonDetails.forEach((reason) => {
    if (reason.code === "beginner_example") score += 14;
    if (reason.code === "docs_friendly") score += 12;
    if (reason.code === "clear_description") score += 8;
    if (reason.code === "deployed_preview") score += 6;
    if (reason.code === "readme_stack_signal") score += 6;
    if (reason.code === "light_setup") score += 8;
  });

  return score - beginnerSetupPenalty(repo);
}

function buildSummaryLine(args: {
  profile: OwnerProfileSnapshot;
  categories: Array<{ key: OwnerRepoCategory; label: string; count: number }>;
  commonStacks: string[];
}) {
  const displayName = args.profile.displayName || args.profile.login;
  const subject = args.profile.profileType === "organization" ? "오가니제이션" : "사용자";
  const dominantCategories = args.categories.slice(0, 2).map((item) => item.label);
  const stackText = args.commonStacks.slice(0, 3).join(", ");
  const categoryText =
    dominantCategories.length > 0 ? dominantCategories.join(" · ") : "여러 공개 프로젝트";
  const stackSuffix = stackText ? ` ${stackText} 신호가 자주 보입니다.` : "";

  return `${displayName}는 공개 레포 ${args.profile.publicRepoCount}개를 운영하는 GitHub ${subject}이며, 주로 ${categoryText} 중심 포트폴리오를 갖고 있습니다.${stackSuffix}`;
}

function buildFacts(args: {
  profile: OwnerProfileSnapshot;
  categories: Array<{ key: OwnerRepoCategory; label: string; count: number }>;
  featuredRepos: OwnerRepositorySummary[];
  commonLanguages: string[];
  commonStacks: string[];
}): AnalysisFact[] {
  const facts: AnalysisFact[] = [
    {
      id: "owner_public_repo_count",
      label: "공개 레포 수",
      value: `${args.profile.publicRepoCount}개`,
      source: "repo",
    },
  ];

  if (args.categories[0]) {
    facts.push({
      id: "owner_primary_category",
      label: "대표 카테고리",
      value: args.categories[0].label,
      source: "heuristic",
    });
  }

  if (args.commonLanguages[0]) {
    facts.push({
      id: "owner_primary_language",
      label: "많이 보이는 언어",
      value: args.commonLanguages[0],
      source: "repo",
    });
  }

  if (args.commonStacks[0]) {
    facts.push({
      id: "owner_primary_stack",
      label: "많이 보이는 스택",
      value: args.commonStacks[0],
      source: "heuristic",
    });
  }

  if (args.featuredRepos[0]) {
    facts.push({
      id: "owner_featured_repo",
      label: "대표 레포",
      value: args.featuredRepos[0].fullName,
      source: "repo",
    });
  }

  return facts;
}

function buildLimitations(args: {
  profile: OwnerProfileSnapshot;
  sampledRepoCount: number;
}): AnalysisNotice[] {
  const notices: AnalysisNotice[] = [];

  if (args.sampledRepoCount < args.profile.publicRepoCount) {
    notices.push({
      code: "OWNER_REPO_SAMPLE_LIMIT",
      message: "공개 레포 전체가 아니라 최근 공개 레포 일부를 기준으로 요약했습니다.",
      details: {
        sampledRepoCount: args.sampledRepoCount,
        totalPublicRepos: args.profile.publicRepoCount,
      },
    });
  }

  return notices;
}

function buildWarnings(args: {
  repositories: OwnerRepositorySummary[];
  featuredRepos: OwnerRepositorySummary[];
}) {
  const warnings: AnalysisNotice[] = [];

  if (args.repositories.length === 0) {
    warnings.push({
      code: "OWNER_WITHOUT_PUBLIC_REPOS",
      message: "분석할 공개 레포를 찾지 못했습니다.",
    });
  }

  if (
    args.featuredRepos.length > 0 &&
    args.featuredRepos.every(
      (repo) => repo.description === null && !repo.sampling.readmeSampled && !repo.sampling.packageJsonSampled
    )
  ) {
    warnings.push({
      code: "OWNER_REPO_METADATA_SPARSE",
      message: "대표 레포 설명과 README 신호가 부족해 카테고리 분류 정확도가 낮을 수 있습니다.",
    });
  }

  return warnings;
}

function enrichRepository(repo: OwnerRepositorySnapshot): EnrichedOwnerRepository {
  const pkg = parsePackageJson(repo.packageJsonText ?? null);
  const category = detectCategory(repo, pkg);
  const stackSignals = detectStackSignals(repo, pkg);
  const sampling = {
    readmeSampled: Boolean(repo.readmeText),
    packageJsonSampled: Boolean(repo.packageJsonText && pkg),
  };
  const base: EnrichedOwnerRepository = {
    ...repo,
    category,
    categoryLabel: OWNER_CATEGORY_LABELS[category],
    stackSignals,
    featuredReason: "",
    featuredReasonDetails: [],
    beginnerReason: "",
    beginnerReasonDetails: [],
    environment: buildEnvironmentSnapshot(repo, pkg, sampling),
    sampling,
    themeSignals: detectThemeSignals(repo, pkg, category),
  };

  base.featuredReasonDetails = featuredReasonDetails(base);
  base.beginnerReasonDetails = beginnerReasonDetails(base);
  base.featuredReason = buildReasonSummary({
    reasons: base.featuredReasonDetails,
    fallback: "조직 성격을 보여주는 대표 공개 레포입니다.",
    emphasis: "featured",
  });
  base.beginnerReason = buildReasonSummary({
    reasons: base.beginnerReasonDetails,
    fallback: "이 오너를 처음 이해할 때 출발점으로 보기 좋습니다.",
    emphasis: "beginner",
  });

  return base;
}

export function analyzeOwnerSnapshot(snapshot: OwnerAnalysisSnapshot): OwnerAnalysis {
  const repositories = snapshot.repositories.map(enrichRepository);

  const featuredRepos = [...repositories]
    .sort((left, right) => featuredScore(right) - featuredScore(left) || left.name.localeCompare(right.name))
    .slice(0, 8);
  const beginnerRepos = [...repositories]
    .sort((left, right) => beginnerScore(right) - beginnerScore(left) || left.name.localeCompare(right.name))
    .slice(0, 6);
  const latestRepos = [...repositories]
    .sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.name.localeCompare(right.name)
    )
    .slice(0, 6);

  const categories = Object.entries(OWNER_CATEGORY_LABELS)
    .map(([key, label]) => ({
      key: key as OwnerRepoCategory,
      label,
      count: repositories.filter((repo) => repo.category === key).length,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const commonLanguages = topEntries(
    repositories.map((repo) => repo.language).filter((value): value is string => Boolean(value)),
    5
  );
  const commonStacks = topEntries(repositories.flatMap((repo) => repo.stackSignals), 6);
  const keyThemes = unique([
    ...categories.slice(0, 3).map((item) => item.label),
    ...topEntries(repositories.flatMap((repo) => repo.themeSignals), 6),
  ]).slice(0, 6);

  return {
    schemaVersion: "mvp-v3",
    kind: "owner",
    owner: {
      login: snapshot.profile.login,
      url: snapshot.profile.url,
      avatarUrl: snapshot.profile.avatarUrl,
      profileType: snapshot.profile.profileType,
      displayName: snapshot.profile.displayName,
      description: snapshot.profile.description,
      blog: snapshot.profile.blog,
      location: snapshot.profile.location,
    },
    summary: {
      oneLiner: buildSummaryLine({
        profile: snapshot.profile,
        categories,
        commonStacks,
      }),
      ownerTypeLabel: snapshot.profile.profileType === "organization" ? "오가니제이션" : "사용자",
      publicRepoCount: snapshot.profile.publicRepoCount,
      sampledRepoCount: snapshot.sampledRepoCount ?? repositories.length,
      enrichedRepoCount: snapshot.enrichedRepoCount ?? repositories.length,
      commonStacks,
      commonLanguages,
      keyThemes,
      recommendedStartingPoints: beginnerRepos.slice(0, 3).map((repo) => repo.fullName),
    },
    portfolio: {
      featuredRepos,
      beginnerRepos,
      latestRepos,
      categories,
    },
    facts: buildFacts({
      profile: snapshot.profile,
      categories,
      featuredRepos,
      commonLanguages,
      commonStacks,
    }),
    warnings: buildWarnings({
      repositories,
      featuredRepos,
    }),
    limitations: buildLimitations({
      profile: snapshot.profile,
      sampledRepoCount: snapshot.sampledRepoCount ?? repositories.length,
    }),
  };
}
