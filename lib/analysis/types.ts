export type Difficulty = "easy" | "medium" | "hard";
export type AnalysisMode = "full" | "limited";
export type LayerName = "UI" | "Logic" | "API" | "DB" | "External";
export type AnalysisTargetKind = "repo" | "owner";
export type EvidenceSource =
  | "repo"
  | "tree"
  | "package_json"
  | "readme"
  | "workspace"
  | "heuristic";
export type InferenceConfidence = "low" | "medium" | "high";

export type AnalysisEvidence = {
  label: string;
  detail: string;
  source: EvidenceSource;
  kind: "fact" | "inference";
};

export type AnalysisNotice = {
  code: string;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};

export type AnalysisFact = {
  id: string;
  label: string;
  value: string;
  source: EvidenceSource;
};

export type AnalysisInference = {
  id: string;
  label: string;
  conclusion: string;
  confidence: InferenceConfidence;
  evidence: AnalysisEvidence[];
};

export type RepoLayer = {
  name: LayerName;
  description: string;
  files: string[];
  fileCount: number;
  evidence: string[];
  evidenceDetails?: AnalysisEvidence[];
};

export type KeyFileInfo = {
  path: string;
  role: string;
  whyImportant: string;
  readOrder: number;
  evidence: string[];
  evidenceDetails?: AnalysisEvidence[];
  relatedLayers: LayerName[];
};

export type EditGuideInfo = {
  intent: string;
  files: string[];
  reason: string;
  evidence: string[];
  evidenceDetails?: AnalysisEvidence[];
  relatedLayers: LayerName[];
};

export type RepoStackGlossaryItem = {
  name: string;
  kind: "framework" | "runtime" | "language" | "styling" | "database" | "tool";
  description: string;
  reasons: string[];
  usedFor: string | null;
  examplePaths: string[];
};

export type RepoStackRoleHighlight = {
  name: string;
  role: string;
  examplePath: string | null;
};

export type RepoIdentityHeaderGuide = {
  subtitle: string | null;
  points: string[];
};

export type RepoUsageGuide = {
  install: string[];
  run: string[];
  build: string[];
  test: string[];
  example: string[];
  source: "package_json" | "readme" | "mixed" | "none";
  details: Array<{
    kind: "install" | "run" | "build" | "test" | "example";
    command: string;
    source: "package_json" | "readme";
    scope: "root" | "focus";
    explanation: string | null;
  }>;
};

export type RepoPreviewImage = {
  url: string;
  alt: string;
  source: "readme";
  kind: "ui" | "diagram" | "generic";
  confidence: "high" | "medium";
};

export type RepoPreviewGuide = {
  mode: "readme_images" | "deploy_url" | "none";
  images: RepoPreviewImage[];
  deployUrl: string | null;
  source: "package_json" | "readme" | "mixed" | "none";
  deployConfidence: "high" | "medium" | null;
  deployRationale: string[];
};

export type RepoEnvRuntimeRange =
  | "exact"
  | "gte"
  | "lte"
  | "between"
  | "unknown";

export type RepoEnvRuntime = {
  name: "node" | "python" | "go" | "rust" | "java" | "ruby" | "bun" | "deno";
  version: string | null;
  minMajor?: number | null;
  maxMajor?: number | null;
  range?: RepoEnvRuntimeRange | null;
  source:
    | "package_json"
    | "nvmrc"
    | "node_version"
    | "python_version"
    | "pyproject"
    | "requirements_txt"
    | "setup_py"
    | "setup_cfg"
    | "environment_yml"
    | "pipfile"
    | "go_mod"
    | "cargo_toml"
    | "rust_toolchain"
    | "deno_json"
    | "dockerfile"
    | "readme";
};

export type RepoEnvContainer = {
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  baseImage: string | null;
  exposedPorts: number[];
  composeServices: string[];
  composeServiceCount?: number;
  needsMultiContainer?: boolean;
  dockerRole?:
    | "optional"
    | "recommended"
    | "required"
    | "optional-dev"
    | "optional-deploy"
    | "none";
};

export type RepoEnvHardware = {
  gpuRequired: boolean;
  gpuHint: string | null;
  minRamGb: number | null;
  recommendedRamGb: number | null;
  minDiskGb: number | null;
  minVramGb?: number | null;
  cpuArch?: "any" | "x64" | "arm64" | "apple-silicon-ok";
  acceleratorPreference?: "cuda" | "mps" | "rocm" | "cpu-ok" | null;
  notes: string[];
  source: "readme" | "package_json" | "dockerfile" | "mixed" | "none";
};

export type CloudService = {
  label: string;
  canonicalId: string;
  kind: "ai" | "database" | "auth" | "payment" | "email" | "infra" | "queue" | "other";
};

export type RepoEnvCloud = {
  deployTargets: string[];
  deployTargetRequired?: string | null;
  servicesRequired: string[];
  servicesOptional: string[];
  apiServicesRequired?: string[];
  apiServicesOptional?: string[];
  servicesRequiredDetails?: CloudService[];
  servicesOptionalDetails?: CloudService[];
  source: "readme" | "package_json" | "config_files" | "mixed" | "none";
};

export type RepoCostEstimate = {
  tier: "free" | "under_10" | "under_50" | "under_200" | "prod";
  monthlyUsdLow: number | null;
  monthlyUsdHigh: number | null;
  drivers: Array<{
    kind: "llm" | "gpu" | "saas" | "storage";
    note: string;
  }>;
};

export type RepoEnvironmentGuide = {
  summary: string;
  runtimes: RepoEnvRuntime[];
  container: RepoEnvContainer;
  hardware: RepoEnvHardware;
  cloud: RepoEnvCloud;
  runtimeMode?: "local-only" | "local-or-cloud" | "cloud-required";
  costEstimate?: RepoCostEstimate;
  confidence: "high" | "medium" | "low";
  confidenceNote: string | null;
};

export type RepoEnvRequirements = RepoEnvironmentGuide;

export type RepoIdentityReadStep = {
  label: string;
  path: string | null;
  reason: string;
};

export type RepoIdentityGuide = {
  plainTitle: string;
  projectKind: string;
  consumptionMode?: "import-as-library" | "run-as-app" | "hybrid" | "unknown";
  useCase: string | null;
  audience: string | null;
  outputType: string | null;
  coreStack: string[];
  stackNarrative: string | null;
  stackHighlights: RepoStackRoleHighlight[];
  header: RepoIdentityHeaderGuide;
  startHere: {
    path: string | null;
    reason: string | null;
  };
  readOrder: RepoIdentityReadStep[];
  trust: {
    source: "code" | "readme" | "mixed" | "inferred";
    note: string | null;
  };
};

export type RepoReadmeLink = {
  label: string;
  url: string;
  kind: "demo" | "deploy" | "docs" | "reference";
};

export type RepoReadmeGuide = {
  summary: string | null;
  keyPoints: string[];
  audience: string | null;
  quickstart: string[];
  links: RepoReadmeLink[];
  architectureNotes: string[];
  source: "readme" | "mixed" | "none";
};

export type RepoLearningGuide = {
  identity: RepoIdentityGuide;
  readmeCore: RepoReadmeGuide;
  stackSummary: string | null;
  stackGlossary: RepoStackGlossaryItem[];
  usage: RepoUsageGuide;
  preview: RepoPreviewGuide;
  environment: RepoEnvironmentGuide;
};

export type RepoAnalysisStatusLevel = "ok" | "partial" | "limited";

export type RepoAnalysisGroupSummary = {
  key: string;
  label: string;
  count: number;
  samples: string[];
};

export type RepoCoverageTrustSummary = {
  level: RepoAnalysisStatusLevel;
  headline: string;
  detail: string | null;
  reasons: string[];
  omissions: string[];
  basedOn: string[];
  approximate: boolean;
};

export type RepoAnalysisCoverage = {
  level: RepoAnalysisStatusLevel;
  chipLabel: string | null;
  summary: string;
  details: string[];
  trustSummary: RepoCoverageTrustSummary;
  supportedStackDetected: boolean;
  supportGapMessage: string | null;
  codeLikeFileCount: number;
  classifiedCodeFileCount: number;
  unclassifiedCodeFileCount: number;
  unclassifiedCodeSamples: string[];
  unclassifiedReasonSummary: string | null;
  unclassifiedReasonGroups: RepoAnalysisGroupSummary[];
  unclassifiedSemanticSummary: string | null;
  unclassifiedSemanticGroups: RepoAnalysisGroupSummary[];
  unclassifiedContentCoverage: string | null;
};

export type RepoTopology = {
  kind: "single" | "monorepo";
  workspaceRoots: string[];
  workspaceGroups: Array<{
    name: string;
    roots: string[];
    count: number;
  }>;
  focusRoot: string | null;
  manifestFiles: string[];
};

export type RepoAnalysis = {
  schemaVersion: "mvp-v3";
  kind: "repo";
  analysisMode: AnalysisMode;
  repo: {
    owner: string;
    name: string;
    branch: string;
    sha: string;
    url: string;
    description: string | null;
  };
  stats: {
    sourceFileCount: number;
    filteredFileCount: number;
    fileCount: number;
    directoryCount: number;
    truncated: boolean;
    routeCount: number;
    apiEndpointCount: number;
  };
  summary: {
    oneLiner: string;
    projectType: string;
    stack: string[];
    difficulty: Difficulty;
    keyFeatures: string[];
    recommendedStartFile?: string;
    recommendedStartReason?: string;
    analysisScopeLabel: string;
  };
  topology: RepoTopology;
  facts: AnalysisFact[];
  inferences: AnalysisInference[];
  limitations: AnalysisNotice[];
  warnings: AnalysisNotice[];
  layers: RepoLayer[];
  keyFiles: KeyFileInfo[];
  editGuides: EditGuideInfo[];
  learning: RepoLearningGuide;
  coverage: RepoAnalysisCoverage;
};

export type OwnerProfileType = "organization" | "user";
export type OwnerRepoCategory = "product" | "library" | "example" | "tooling" | "docs" | "infra";
export type OwnerRecommendationReasonCode =
  | "active_product"
  | "beginner_example"
  | "clear_description"
  | "core_library"
  | "deployed_preview"
  | "docs_friendly"
  | "high_stars"
  | "light_setup"
  | "package_stack_signal"
  | "readme_stack_signal"
  | "recently_updated"
  | "tooling_entry";

export type OwnerRecommendationReason = {
  code: OwnerRecommendationReasonCode;
  label: string;
  source: EvidenceSource;
};

export type OwnerRepoEnvSnapshot = {
  runtimeLabel: string | null;
  needsDocker: boolean;
  gpuRequired: boolean;
  gpuHint: string | null;
  servicesRequired: string[];
  deployTargets: string[];
  pillSummary: string | null;
  confidence: "high" | "medium" | "low";
};

export type OwnerRepositorySummary = {
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
  category: OwnerRepoCategory;
  categoryLabel: string;
  stackSignals: string[];
  featuredReason: string;
  featuredReasonDetails: OwnerRecommendationReason[];
  beginnerReason: string;
  beginnerReasonDetails: OwnerRecommendationReason[];
  environment: OwnerRepoEnvSnapshot;
  sampling: {
    readmeSampled: boolean;
    packageJsonSampled: boolean;
  };
};

export type OwnerCategorySummary = {
  key: OwnerRepoCategory;
  label: string;
  count: number;
};

export type OwnerAnalysis = {
  schemaVersion: "mvp-v3";
  kind: "owner";
  owner: {
    login: string;
    url: string;
    avatarUrl: string | null;
    profileType: OwnerProfileType;
    displayName: string | null;
    description: string | null;
    blog: string | null;
    location: string | null;
  };
  summary: {
    oneLiner: string;
    ownerTypeLabel: string;
    publicRepoCount: number;
    sampledRepoCount: number;
    enrichedRepoCount: number;
    commonStacks: string[];
    commonLanguages: string[];
    keyThemes: string[];
    recommendedStartingPoints: string[];
  };
  portfolio: {
    featuredRepos: OwnerRepositorySummary[];
    beginnerRepos: OwnerRepositorySummary[];
    latestRepos: OwnerRepositorySummary[];
    categories: OwnerCategorySummary[];
  };
  facts: AnalysisFact[];
  warnings: AnalysisNotice[];
  limitations: AnalysisNotice[];
};

export type AnalysisResult = RepoAnalysis | OwnerAnalysis;

export type AnalyzeTargetRequest = {
  repoUrl: string;
  forceRefresh?: boolean;
};

export type AnalyzeRepoErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, string | number | boolean | null>;
};

export type GitHubAuthMode = "token" | "tokenless";

export type AnalyzePolicyMeta = {
  githubAuthMode: GitHubAuthMode;
  serverCacheTtlMs: number;
  serverInFlightDedupe: true;
  tokenlessRateLimitPerHour: number | null;
};

export type AnalyzeDeliveryMeta = {
  source: "fresh" | "server-cache" | "shared-inflight";
  scope: "repo-url" | "repo-sha" | "owner-url" | "owner-signature";
  forceRefresh: boolean;
};

export type AnalyzeTargetMeta = {
  policy: AnalyzePolicyMeta;
  delivery?: AnalyzeDeliveryMeta;
};

export type AnalyzeTargetResponse =
  | {
      ok: true;
      data: AnalysisResult;
      meta?: AnalyzeTargetMeta;
    }
  | {
      ok: false;
      error: AnalyzeRepoErrorPayload;
      meta?: AnalyzeTargetMeta;
    };

export function isRepoAnalysis(analysis: AnalysisResult): analysis is RepoAnalysis {
  return analysis.kind === "repo";
}

export function isOwnerAnalysis(analysis: AnalysisResult): analysis is OwnerAnalysis {
  return analysis.kind === "owner";
}
