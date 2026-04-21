import type {
  ArchitectureGraphModel,
  ArchitectureInspector,
  FocusRailKey,
} from "@/lib/analysis/graph";
import type {
  EditGuideInfo,
  KeyFileInfo,
  LayerName,
  RepoAnalysis,
} from "@/lib/analysis/types";
import { buildAnalysisStatusView as buildWorkspaceStatusView } from "@/components/result-workspace-model";

// ─── Labels ─────────────────────────────────────────────────────────────────

export const LAYER_SUBLABEL: Record<LayerName, string> = {
  UI: "화면",
  Logic: "동작",
  API: "요청 처리",
  DB: "데이터",
  External: "외부 서비스",
};

export const LAYER_TITLE_KO: Record<LayerName, string> = {
  UI: "화면 (UI)",
  Logic: "동작 (Logic)",
  API: "요청 처리 (API)",
  DB: "데이터 (DB)",
  External: "외부 서비스 (External)",
};

// ─── Path helpers ───────────────────────────────────────────────────────────

const GENERIC_BASENAMES = new Set([
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.mjs",
  "index.cjs",
  "utils.ts",
  "utils.js",
  "main.ts",
  "main.tsx",
  "main.js",
  "app.ts",
  "app.tsx",
  "app.js",
  "types.ts",
  "constants.ts",
  "package.json",
  "tsconfig.json",
  "README.md",
  "readme.md",
]);

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

// Generic names like `index.ts` get the parent folder prepended so the reader
// can tell which area the file belongs to. Non-generic names stay compact.
export function displayFileName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const base = parts[parts.length - 1] ?? path;
  if (!GENERIC_BASENAMES.has(base)) {
    return base;
  }
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${base}`;
  }
  return base;
}

const EXT_ALIAS: Record<string, string> = {
  tsx: "tsx",
  ts: "ts",
  jsx: "jsx",
  js: "js",
  mjs: "js",
  cjs: "js",
  json: "json",
  md: "md",
  mdx: "md",
  yml: "yml",
  yaml: "yml",
  toml: "toml",
  css: "css",
  scss: "css",
  html: "html",
  py: "py",
  rs: "rs",
  go: "go",
  java: "java",
};

export function extensionBadge(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_ALIAS[ext] ?? ext.slice(0, 4);
}

export function isTestFile(path: string): boolean {
  return /(^|\/)__tests__\//.test(path) || /\.(test|spec|stories)\.[a-zA-Z0-9]+$/i.test(path);
}

// ─── Role shortening ────────────────────────────────────────────────────────

// The analyzer's roles can be verbose ("UI 레이어 대표 파일"). This tightens them
// for the compact inline row label without inventing new meaning.
export function shortRole(role: string | undefined | null, layer?: LayerName): string {
  if (!role) return "";
  let trimmed = role.trim();

  // Strip standard "{Layer} 레이어 대표 파일" pattern -> "대표 파일 (추정)"
  if (/레이어 대표 파일$/.test(trimmed)) {
    return "대표 파일";
  }
  if (layer && trimmed.startsWith(`${layer} 레이어`)) {
    trimmed = trimmed.replace(`${layer} 레이어`, "").trim();
  }
  // Drop trailing punctuation
  trimmed = trimmed.replace(/[.。]+$/, "");
  // Hard cap
  if (trimmed.length > 14) {
    return `${trimmed.slice(0, 13)}…`;
  }
  return trimmed;
}

export function isSyntheticRole(role: string | undefined | null): boolean {
  if (!role) return true;
  return /레이어 대표 파일$/.test(role.trim());
}

// ─── File row model ─────────────────────────────────────────────────────────

export type VisibleFileRow = {
  path: string;
  display: string;
  extension: string;
  role: string;
  fullRole: string;
  isStart: boolean;
  isClickable: boolean;
  targetId?: string;
  isWeak: boolean;
  isTest: boolean;
};

type BuildRowsInput = {
  paths: string[];
  layerName: LayerName;
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
  limit?: number;
};

// Given a list of candidate file paths for a layer, this returns the rows that
// should actually render: focusRoot-first, test/spec deprioritised, generic
// names contextualised, start-file pinned (if present).
export function buildVisibleFileRows({
  paths,
  layerName,
  analysis,
  model,
  limit = 3,
}: BuildRowsInput): VisibleFileRow[] {
  const focusRoot = analysis.topology.focusRoot;
  const startFile = analysis.summary.recommendedStartFile;
  const keyFileByPath = new Map<string, KeyFileInfo>();
  analysis.keyFiles.forEach((kf) => keyFileByPath.set(kf.path, kf));

  const unique = Array.from(new Set(paths));

  const scored = unique.map((path) => {
    const kf = keyFileByPath.get(path);
    const role = kf?.role ?? "";
    const isWeak = !kf || isSyntheticRole(role);
    const isTest = isTestFile(path);
    const inFocus = focusRoot ? path.startsWith(`${focusRoot}/`) || path === focusRoot : false;
    const isStart = Boolean(startFile && path === startFile);

    // Lower score wins. Start > keyFile-in-focus > keyFile > focus-only > weak, tests last.
    let score = 0;
    if (isTest) score += 100;
    if (isWeak) score += 20;
    if (!inFocus && focusRoot) score += 5;
    if (isStart) score -= 50;

    return {
      path,
      role,
      isWeak,
      isTest,
      isStart,
      score,
    };
  });

  scored.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));

  const picked = scored.slice(0, limit);

  return picked.map((entry) => {
    const kf = keyFileByPath.get(entry.path);
    const isClickable = Boolean(model.inspectables[`file:${entry.path}`]);
    return {
      path: entry.path,
      display: displayFileName(entry.path),
      extension: extensionBadge(entry.path),
      role: shortRole(kf?.role ?? entry.role, layerName),
      fullRole: kf?.role ?? entry.role,
      isStart: entry.isStart,
      isClickable,
      targetId: isClickable ? `file:${entry.path}` : undefined,
      isWeak: entry.isWeak,
      isTest: entry.isTest,
    };
  });
}

// ─── Start-file anchor ──────────────────────────────────────────────────────

export type StartFileAnchor = {
  path: string;
  display: string;
  layerName: LayerName | null;
  // true if the start file is already visible as a row in some layer box —
  // in that case the page banner should NOT repeat the anchor.
  shownInBox: boolean;
  isClickable: boolean;
};

// Result 화면의 최상단 탭 구성.
//  - learning: 먼저 이해하기 (기본)
//  - readme: README 핵심 (현재는 fallback)
//  - canvas / diagram: 구조 보기 (canvas 기본, diagram은 sub-toggle)
//  - environment: 실행 환경
export type ResultViewMode =
  | "learning"
  | "readme"
  | "canvas"
  | "diagram"
  | "environment";

// Returns true when analysis.learning has anything worth showing in the
// "먼저 이해하기" view. Keeps the tab hidden for empty/weak analyses.
export function learningHasContent(analysis: RepoAnalysis): boolean {
  const l = analysis.learning;
  if (!l) return false;
  if (l.stackSummary) return true;
  if (l.stackGlossary.length > 0) return true;
  const u = l.usage;
  if (
    u.install.length > 0 ||
    u.run.length > 0 ||
    u.build.length > 0 ||
    u.test.length > 0 ||
    u.example.length > 0
  )
    return true;
  if (
    l.environment.runtimes.length > 0 ||
    l.environment.container.hasDockerfile ||
    l.environment.container.hasDockerCompose ||
    l.environment.hardware.gpuRequired ||
    l.environment.hardware.gpuHint !== null ||
    l.environment.hardware.minRamGb !== null ||
    l.environment.hardware.recommendedRamGb !== null ||
    l.environment.hardware.minDiskGb !== null ||
    l.environment.cloud.deployTargets.length > 0 ||
    l.environment.cloud.servicesRequired.length > 0
  ) {
    return true;
  }
  if (l.preview.mode === "readme_images" && l.preview.images.length > 0) return true;
  if (l.preview.mode === "deploy_url" && l.preview.deployUrl) return true;
  return false;
}

export type ResultSummaryStripView = {
  stackChips: string[];
  stackOverflow: number;
  summary: string;
  stackSummary: string | null;
  scaleLine: string | null;
};

// IdentityBar는 "이 레포가 뭐고 왜 존재하는지"를 한 번에 잡는 최상단 블록.
// 이제 `analysis.learning.identity`를 1차 소스로 쓰고, repo name이나 oneLiner
// 같은 기존 필드는 보조로만 내려간다.
export type ResultTrustView = {
  label: string; // "코드 기반" / "README 기반" / "코드+README" / "일부 추정"
  source: "code" | "readme" | "mixed" | "inferred";
  note: string | null;
  // Coverage 수준(ok/partial/limited)은 분석 범위 상태로 별도로 합쳐 표시.
  coverageLevel: "ok" | "partial" | "limited";
  coverageLabel: string | null;
};

export type ResultIdentityBarHighlight = {
  name: string;
  role: string;
  examplePath: string | null;
};

export type ResultIdentityBarView = {
  plainTitle: string;
  // title 바로 아래 1줄. backend가 준 초보자용 한국어 one-liner를 그대로 쓴다.
  // subtitle이 없을 때만 stackNarrative가 이 자리를 대체 (서로 배타).
  subtitle: string | null;
  // subtitle이 없을 때 fallback으로 노출되는 기술 중심 한 줄.
  stackNarrativeFallback: string | null;
  projectKind: string | null;
  // Monorepo의 대표 범위 / 단일 repo의 focus root 같은 scope 메타. Header에서
  // 중복으로 보여주지 않도록 Identity Bar caption에 흡수. 단일 scope 없으면 null.
  scopeLabel: string | null;
  // 라이브러리/앱/혼합 판정. 헤드라인 옆 작은 배지로 노출 — 한눈에
  // "이걸 설치해서 쓰는 건가, 실행하는 건가" 구분시킨다.
  consumptionMode: "import-as-library" | "run-as-app" | "hybrid" | "unknown" | null;
  // 핵심 포인트 bullet. backend header.points 기준, 최대 2개. emoji/prefix
  // 정리까지 여기서 끝내 컴포넌트는 그대로 렌더만 한다.
  points: string[];
  // 기술 highlights — 시각적으로는 badge+이름만. role/examplePath는
  // tooltip/inspector 연결 evidence로만 사용한다.
  highlights: ResultIdentityBarHighlight[];
  // Legacy raw chips. highlights가 있으면 숨기고 fallback 용도로만.
  coreStackChips: string[];
  coreStackOverflow: number;
  startFile: {
    path: string;
    display: string;
    reason: string | null;
  } | null;
  trust: ResultTrustView;
};

export type ResultIntroView = {
  stackChips: string[];
  stackOverflow: number;
  summary: string;
  featureLine: string | null;
  scaleItems: string[];
};

export type LeftPanelItem = {
  id: string;
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  targetId?: string;
  focusKey?: FocusRailKey;
  viewMode?: ResultViewMode;
  /** 항목 옆에 호환 상태 닷(blocker 🚫 / warning ⚠ / match ✓)을 그릴 때 사용. */
  statusDot?: "blocker" | "warning" | "match";
  /** 닷 hover 시 보여줄 설명. */
  statusHint?: string;
};

export type LeftPanelSection = {
  id: string;
  title: string;
  items: LeftPanelItem[];
};

export type AnalysisStatusChipView = {
  label: string;
  count: number;
};

export const ANALYSIS_STATUS_ID = "status:analysis";
export const CODE_FALLBACK_ID = "status:code-fallback";
export const FALLBACK_FILE_ID_PREFIX = "file-fallback:";

export function fallbackFileTargetId(path: string) {
  return `${FALLBACK_FILE_ID_PREFIX}${path}`;
}

export function isFallbackFileTargetId(targetId: string | null): targetId is `${typeof FALLBACK_FILE_ID_PREFIX}${string}` {
  return Boolean(targetId?.startsWith(FALLBACK_FILE_ID_PREFIX));
}

export function fallbackFilePathFromTargetId(targetId: `${typeof FALLBACK_FILE_ID_PREFIX}${string}`) {
  return targetId.slice(FALLBACK_FILE_ID_PREFIX.length);
}

export function buildStartFileAnchor(
  analysis: RepoAnalysis,
  model: ArchitectureGraphModel,
  visiblePathsByLayer: Map<LayerName, Set<string>>
): StartFileAnchor | null {
  const startFile = analysis.summary.recommendedStartFile;
  if (!startFile) return null;

  const kf = analysis.keyFiles.find((f) => f.path === startFile);
  const layerName = kf?.relatedLayers[0] ?? null;
  const shownInBox = layerName
    ? visiblePathsByLayer.get(layerName)?.has(startFile) ?? false
    : false;
  const isClickable = Boolean(model.inspectables[`file:${startFile}`]);

  return {
    path: startFile,
    display: displayFileName(startFile),
    layerName,
    shownInBox,
    isClickable,
  };
}

function compactStackLabel(label: string) {
  return label
    .replace("Tailwind CSS", "Tailwind")
    .replace("JavaScript / TypeScript", "JS/TS");
}

function compactWorkspaceLabel(root: string) {
  const parts = root.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return root;
  }
  return parts.slice(-2).join("/");
}

export function buildResultSummaryView(analysis: RepoAnalysis): ResultSummaryStripView {
  const stackChips = analysis.summary.stack
    .map((item) => compactStackLabel(item))
    .slice(0, 5);
  const stackOverflow = Math.max(0, analysis.summary.stack.length - stackChips.length);
  const scaleItems = [
    `파일 ${analysis.stats.fileCount}개`,
    analysis.stats.routeCount > 0
      ? `UI 진입점 ${analysis.stats.routeCount}개`
      : analysis.stats.apiEndpointCount > 0
        ? `API 진입점 ${analysis.stats.apiEndpointCount}개`
        : null,
  ].filter((item): item is string => Boolean(item));

  return {
    stackChips,
    stackOverflow,
    summary: analysis.summary.oneLiner,
    stackSummary: analysis.learning?.stackSummary ?? null,
    scaleLine: scaleItems.length > 0 ? scaleItems.join(" · ") : null,
  };
}

const COVERAGE_LABEL: Record<"ok" | "partial" | "limited", string> = {
  ok: "전체 분석",
  partial: "부분 분석",
  limited: "제한 분석",
};

const TRUST_SOURCE_LABEL: Record<
  "code" | "readme" | "mixed" | "inferred",
  string
> = {
  code: "코드 기반",
  readme: "README 기반",
  mixed: "코드+README",
  inferred: "일부 추정",
};

export function buildResultTrustView(analysis: RepoAnalysis): ResultTrustView {
  const source = analysis.learning?.identity?.trust?.source ?? "code";
  const note = analysis.learning?.identity?.trust?.note?.trim() || null;
  const coverageLevel = analysis.coverage.level;
  const rawCoverageLabel = analysis.coverage.chipLabel?.trim() || null;
  // `ok`에는 coverage 라벨을 별도로 노출하지 않는다 ("정상"을 매번 찍는 노이즈
  // 가 된다). 부분/제한일 때만 분석 범위를 따로 표시한다.
  const coverageLabel =
    coverageLevel === "ok"
      ? null
      : rawCoverageLabel ?? COVERAGE_LABEL[coverageLevel];

  return {
    label: TRUST_SOURCE_LABEL[source],
    source,
    note,
    coverageLevel,
    coverageLabel,
  };
}

export function buildResultIdentityBarView(
  analysis: RepoAnalysis
): ResultIdentityBarView {
  const identity = analysis.learning?.identity;
  const plainTitle =
    identity?.plainTitle?.trim() || analysis.summary.oneLiner;
  const projectKind =
    identity?.projectKind?.trim() || analysis.summary.projectType || null;

  const coreStackSource =
    identity?.coreStack && identity.coreStack.length > 0
      ? identity.coreStack
      : analysis.summary.stack;
  const coreStackChips = coreStackSource
    .map((item) => compactStackLabel(item))
    .slice(0, 5);
  const coreStackOverflow = Math.max(
    0,
    coreStackSource.length - coreStackChips.length
  );

  // Prefer identity.startHere over legacy recommendedStartFile — backend now
  // reasons about both README hints and heuristics there.
  const startFilePath =
    identity?.startHere?.path ??
    analysis.summary.recommendedStartFile ??
    null;
  const startReasonRaw =
    identity?.startHere?.reason?.trim() ||
    analysis.summary.recommendedStartReason?.trim() ||
    null;
  const startFile = startFilePath
    ? {
        path: startFilePath,
        display: displayFileName(startFilePath),
        reason: startReasonRaw,
      }
    : null;

  const trust = buildResultTrustView(analysis);

  const stackNarrative = identity?.stackNarrative?.trim() || null;
  const highlights: ResultIdentityBarHighlight[] = (identity?.stackHighlights ?? [])
    .map((h) => ({
      name: h.name.trim(),
      role: h.role.trim(),
      examplePath: h.examplePath?.trim() || null,
    }))
    .filter((h) => h.name.length > 0 && h.role.length > 0)
    .slice(0, 4);

  // backend가 직접 내려주는 초보자용 one-liner. plainTitle과 사실상 동일하면
  // 중복이라 숨긴다 (그 외에는 재가공하지 않음).
  const rawSubtitle = identity?.header?.subtitle?.trim() || null;
  const subtitle = suppressRedundantLine(rawSubtitle, plainTitle);
  // subtitle이 없으면 stackNarrative가 그 자리를 대체. 둘을 동시에 보여주지
  // 않는다 — spec이 상호 배타로 규정.
  const stackNarrativeFallback = subtitle ? null : stackNarrative;

  const stripBulletPrefix = (raw: string) =>
    raw
      .replace(/^[\s•●◦▪▫▶▸★☆►▼→\-*·]+/u, "")
      .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "")
      .trim();
  const primaryPoints = (identity?.header?.points ?? [])
    .map(stripBulletPrefix)
    // 너무 짧아 내용을 이해할 수 없는 point는 걸러낸다. 초보자가 "이게 뭐야"
    // 멈추지 않도록 최소 6자.
    .filter((p) => p.length >= 6);
  // identity.header.points가 비어 있는 레포(구형 분석/low-signal)에서는
  // summary.keyFeatures를 그대로 bullet으로 승격해 빈 슬롯을 막는다.
  // backend 계약을 재해석하지 않고 값만 소비.
  const fallbackFeatures = (analysis.summary.keyFeatures ?? [])
    .map(stripBulletPrefix)
    .filter((p) => p.length >= 4);
  const points = (primaryPoints.length > 0 ? primaryPoints : fallbackFeatures).slice(0, 2);

  // Monorepo일 때만 analysisScopeLabel을 caption에 노출. 단일 레포면 null.
  // "부분 분석/제한 분석" 같은 TrustChip prefix가 analysisScopeLabel 앞에도
  // 붙어오는 경우가 많아(예: "제한 분석 · 핵심 코드 3,676개 기준") 그 부분만
  // strip 해 중복 신호를 지운다. 남은 "핵심 코드 N개 기준" 부분이 정보가 된다.
  const scopeLabel = (() => {
    if (analysis.topology.kind !== "monorepo") return null;
    let raw = analysis.summary.analysisScopeLabel?.trim() || null;
    if (!raw) return null;
    const trustPrefix = trust.coverageLabel;
    if (trustPrefix) {
      const re = new RegExp(
        `^${trustPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*·?\\s*`
      );
      raw = raw.replace(re, "").trim();
    }
    return raw || null;
  })();

  return {
    plainTitle,
    subtitle,
    stackNarrativeFallback,
    projectKind,
    scopeLabel,
    consumptionMode: identity?.consumptionMode ?? null,
    points,
    highlights,
    coreStackChips,
    coreStackOverflow,
    startFile,
    trust,
  };
}

// plainTitle과 거의 동일한 subtitle이 들어오면 숨긴다.
function suppressRedundantLine(
  candidate: string | null,
  reference: string
): string | null {
  if (!candidate) return null;
  const strip = (v: string) => v.replace(/[\s·.,()/"'·]/g, "");
  const a = strip(candidate);
  const b = strip(reference);
  if (a.length === 0 || b.length === 0) return candidate;
  const min = Math.min(a.length, b.length);
  let common = 0;
  for (let i = 0; i < min; i++) {
    if (a[i] !== b[i]) break;
    common++;
  }
  return common / min >= 0.7 ? null : candidate;
}

export function buildResultIntroView(analysis: RepoAnalysis): ResultIntroView {
  const summary = buildResultSummaryView(analysis);

  return {
    stackChips: summary.stackChips,
    stackOverflow: summary.stackOverflow,
    summary: summary.summary,
    featureLine:
      analysis.summary.keyFeatures.length > 0
        ? analysis.summary.keyFeatures.slice(0, 2).join(" · ")
        : null,
    scaleItems: summary.scaleLine ? summary.scaleLine.split(" · ") : [],
  };
}

export function buildAnalysisStatusChip(analysis: RepoAnalysis): AnalysisStatusChipView | null {
  const status = buildWorkspaceStatusView(analysis);
  if (status.level === "ok") {
    return null;
  }

  return {
    label: status.chipLabel ?? "분석 상태",
    count: Math.max(1, status.details.length),
  };
}

export function buildLeftPanelSections({
  analysis,
  model,
  viewMode,
  activeFocus,
  selectedId,
  envCompatStatus,
}: {
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
  viewMode: ResultViewMode;
  activeFocus: FocusRailKey;
  selectedId: string | null;
  /** "실행 환경" 항목에 붙일 호환 상태 닷. 환경 미설정/미적용이면 undefined. */
  envCompatStatus?: { dot: "blocker" | "warning" | "match"; hint: string } | null;
}): LeftPanelSection[] {
  const status = buildWorkspaceStatusView(analysis);
  const layerCounts = new Map(model.layerCards.map((layer) => [layer.layerName, layer.fileCount]));
  const layerTargets = new Map(model.layerCards.map((layer) => [layer.layerName, layer.id]));
  const workspaceItems = Array.from(
    new Map(
      [...model.groupCards.flatMap((group) => group.workspaces), ...(model.focusWorkspace ? [model.focusWorkspace] : [])].map(
        (workspace) => [workspace.root, workspace]
      )
    ).values()
  )
    .sort(
      (left, right) =>
        Number(right.isFocus) - Number(left.isFocus) ||
        left.root.localeCompare(right.root)
    )
    .map<LeftPanelItem>((workspace) => ({
      id: `scope:${workspace.root}`,
      label: compactWorkspaceLabel(workspace.root),
      active: selectedId === workspace.id,
      targetId: workspace.id,
    }));

  const layerItems: LeftPanelItem[] = [
    {
      // `All` 의 count는 summary strip의 `파일 N개`와 중복이라 생략
      id: "layer:all",
      label: "전체",
      active: activeFocus === "all",
      targetId: model.overview.id,
      focusKey: "all",
    },
    ...(["UI", "Logic", "API", "DB", "External"] as LayerName[])
      .filter((layerName) => layerTargets.has(layerName))
      .map<LeftPanelItem>((layerName) => ({
        id: `layer:${layerName}`,
        // 영어 레이블(UI/Logic/…)은 Canvas에 이미 보이므로 좌측 패널에서는
        // 초보자 친화 한국어 서브라벨만 노출한다.
        label: LAYER_SUBLABEL[layerName],
        count: layerCounts.get(layerName) ?? 0,
        active: activeFocus === layerName,
        targetId: layerTargets.get(layerName) ?? model.overview.id,
        focusKey: layerName,
      })),
    ...(status.unclassifiedCodeFileCount > 0
      ? [
          {
            id: "layer:Code",
            label: "미분류 코드",
            count: status.unclassifiedCodeFileCount,
            active: selectedId === CODE_FALLBACK_ID,
            targetId: CODE_FALLBACK_ID,
          } satisfies LeftPanelItem,
        ]
      : []),
  ];

  // Suppress triple signal when the only concern is the unclassified-code
  // fallback: `레이어 · Code` + floating StatusChip already represent it.
  // The `상태` section is reserved for *other* limitations/warnings.
  const onlyCodeFallback =
    status.level !== "ok" &&
    status.unclassifiedCodeFileCount > 0 &&
    status.details.length <= 1;
  const statusItems: LeftPanelItem[] =
    status.level === "ok" || onlyCodeFallback
      ? []
      : [
          {
            id: `status:${status.level}`,
            label: status.chipLabel ?? "분석 상태",
            count: Math.max(1, status.details.length),
            active: selectedId === ANALYSIS_STATUS_ID,
            targetId: ANALYSIS_STATUS_ID,
          },
        ];

  const showLearningTab = learningHasContent(analysis);
  const showEnvironmentTab = environmentHasContent(analysis);
  const showReadmeTab = readmeCoreHasContent(analysis);

  // Primary tabs — ordered by the reading plan:
  //   1) "이 레포가 뭐고 어떤 걸 하는지"를 먼저 (먼저 이해하기)
  //   2) 구조로 들어가기 전에 README 맥락이 필요하면 (README 핵심)
  //   3) 구조 보기 (canvas). 관계도(diagram)은 canvas 안쪽에서 전환.
  //   4) 실행 조건이 복잡한 레포만 실행 환경 탭으로 분리.
  const viewItems: LeftPanelItem[] = [];

  if (showLearningTab) {
    viewItems.push({
      id: "view:learning",
      label: "먼저 이해하기",
      active: viewMode === "learning",
      viewMode: "learning" as ResultViewMode,
    });
  }

  viewItems.push({
    id: "view:canvas",
    label: "구조 보기",
    active: viewMode === "canvas" || viewMode === "diagram",
    viewMode: "canvas" as ResultViewMode,
  });

  if (showReadmeTab) {
    viewItems.push({
      id: "view:readme",
      label: "README 핵심",
      active: viewMode === "readme",
      viewMode: "readme" as ResultViewMode,
    });
  }

  if (showEnvironmentTab) {
    viewItems.push({
      id: "view:environment",
      label: "실행 환경",
      active: viewMode === "environment",
      viewMode: "environment" as ResultViewMode,
      statusDot: envCompatStatus?.dot,
      statusHint: envCompatStatus?.hint,
    });
  }

  return [
    {
      id: "view",
      title: "보기",
      items: viewItems,
    },
    {
      id: "layer",
      title: "범위",
      items: layerItems,
    },
    {
      id: "scope",
      title: "워크스페이스",
      items: analysis.topology.kind === "monorepo" ? workspaceItems : [],
    },
    {
      id: "status",
      title: "상태",
      items: statusItems,
    },
  ].filter((section) => section.items.length > 0);
}

// ─── Tab visibility helpers ─────────────────────────────────────────────────
// Keep these here (not in the panel) so workspace routing and the left-panel
// builder always agree on "should this tab even exist".

export function environmentHasContent(analysis: RepoAnalysis): boolean {
  const env = analysis.learning?.environment;
  if (!env) return false;
  return (
    env.runtimes.length > 0 ||
    env.container.hasDockerfile ||
    env.container.hasDockerCompose ||
    env.hardware.gpuRequired ||
    env.hardware.gpuHint !== null ||
    env.hardware.minRamGb !== null ||
    env.hardware.recommendedRamGb !== null ||
    env.hardware.minDiskGb !== null ||
    env.cloud.deployTargets.length > 0 ||
    env.cloud.servicesRequired.length > 0
  );
}

// README Core 탭은 이제 `analysis.learning.readmeCore`가 실제 필드로 들어온다.
// summary / quickstart / links / keyPoints / audience / architectureNotes 중
// 하나라도 있으면 탭이 노출된다. 빈 필드는 컴포넌트에서 조용히 숨긴다.
export function readmeCoreHasContent(analysis: RepoAnalysis): boolean {
  const core = analysis.learning?.readmeCore;
  if (!core) return false;
  if (core.summary?.trim()) return true;
  if (core.keyPoints.length > 0) return true;
  if (core.audience?.trim()) return true;
  if (core.quickstart.length > 0) return true;
  if (core.links.length > 0) return true;
  if (core.architectureNotes.length > 0) return true;
  return false;
}

function splitFactValues(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildLayerTechHints(analysis: RepoAnalysis, layerName: LayerName): string[] {
  const layer = analysis.layers.find((item) => item.name === layerName);
  if (!layer) return [];

  const stackSet = new Set(analysis.summary.stack);
  const dataClients = splitFactValues(
    analysis.facts.find((item) => item.id === "data_clients")?.value
  );
  const externalServices = splitFactValues(
    analysis.facts.find((item) => item.id === "external_services")?.value
  );

  const hints: string[] = [];

  if (layerName === "UI") {
    if (stackSet.has("React")) hints.push("React");
    if (stackSet.has("Next.js")) hints.push("Next.js");
    if (stackSet.has("Tailwind CSS")) hints.push("Tailwind");
  }

  if (layerName === "API") {
    if (layer.files.some((path) => /(^|\/)app\/api\/.+\/route\.(ts|tsx|js|jsx)$/i.test(path))) {
      hints.push("Route Handlers");
    } else if (layer.files.some((path) => /(^|\/)pages\/api\/.+\.(ts|tsx|js|jsx)$/i.test(path))) {
      hints.push("Pages API");
    }
    if (stackSet.has("Next.js")) hints.push("Next.js");
    if (stackSet.has("Node.js")) hints.push("Node.js");
  }

  if (layerName === "DB") {
    hints.push(...dataClients);
    if (stackSet.has("Supabase")) hints.push("Supabase");
    if (stackSet.has("Firebase")) hints.push("Firebase");
  }

  if (layerName === "External") {
    hints.push(...externalServices);
  }

  return Array.from(new Set(hints)).slice(0, 2);
}

function buildRelatedFileRows(
  path: string,
  layerName: LayerName,
  analysis: RepoAnalysis,
  model: ArchitectureGraphModel
) {
  const sameLayerKeyFiles = analysis.keyFiles
    .filter((file) => file.path !== path && file.relatedLayers.includes(layerName))
    .map((file) => file.path);
  const layerSampleFiles =
    analysis.layers.find((layer) => layer.name === layerName)?.files.filter((item) => item !== path) ?? [];

  const candidatePaths = Array.from(new Set([...sameLayerKeyFiles, ...layerSampleFiles]));
  if (candidatePaths.length === 0) {
    return [];
  }

  return buildVisibleFileRows({
    paths: candidatePaths,
    layerName,
    analysis,
    model,
    limit: 3,
  });
}

function buildFallbackFileRows(
  paths: string[],
  analysis: RepoAnalysis,
  model: ArchitectureGraphModel,
  limit = 5
) {
  const keyFileByPath = new Map<string, KeyFileInfo>();
  analysis.keyFiles.forEach((file) => keyFileByPath.set(file.path, file));
  const startFile = analysis.summary.recommendedStartFile;

  return Array.from(new Set(paths))
    .slice(0, limit)
    .map((path) => {
      const keyFile = keyFileByPath.get(path);
      const isKnownFile = Boolean(model.inspectables[`file:${path}`]);
      const role = keyFile?.role && !isSyntheticRole(keyFile.role) ? shortRole(keyFile.role) : "미분류 코드";

      return {
        path,
        display: displayFileName(path),
        extension: extensionBadge(path),
        role,
        fullRole: keyFile?.role ?? "의미 레이어로 아직 자동 분류되지 않은 코드",
        isStart: path === startFile,
        isClickable: true,
        targetId: isKnownFile ? `file:${path}` : fallbackFileTargetId(path),
        isWeak: !keyFile || isSyntheticRole(keyFile.role),
        isTest: isTestFile(path),
      };
    });
}

// ─── Narrative ("뭐야 / 왜 중요 / 다음") ─────────────────────────────────────

export type InspectorViewKind = "layer" | "file" | "other";

export type InspectorNarrativeSection = {
  label: string;
  body: string;
  weak?: boolean;
};

export type InspectorView = {
  kind: InspectorViewKind;
  title: string;
  subtitle: string;
  // Full value (e.g. unabridged path) surfaced as `title` attribute while
  // `subtitle` renders the compact form. Inspector overlay wires this.
  subtitleFull?: string;
  narrative: InspectorNarrativeSection[];
  files: VisibleFileRow[];
  breadcrumb?: { label: string; targetId: string };
  githubUrl?: string;
  editGuides: EditGuideInfo[];
  evidence: string[];
  // Layer-scoped action: when present, Inspector renders "이 레이어 지도 좁히기"
  // that switches the main view to the canvas focused on this layer.
  focusLayer?: LayerName;
};

export function buildAnalysisStatusView(analysis: RepoAnalysis): InspectorView {
  const status = buildWorkspaceStatusView(analysis);
  const warnings = analysis.warnings.map((notice) => notice.message);
  const limitations = analysis.limitations.map((notice) => notice.message);
  const evidence = [
    ...(analysis.analysisMode === "limited" ? ["현재 결과는 대표 경로 중심의 제한 분석입니다."] : []),
    ...limitations,
    ...warnings,
    ...(status.unclassifiedCodeSamples.length > 0
      ? [`미분류 코드: ${status.unclassifiedCodeSamples.join(", ")}`]
      : []),
  ];

  const limitationBody =
    limitations.length > 0
      ? limitations.slice(0, 2).join(" ")
      : status.unclassifiedCodeFileCount > 0
        ? `${status.unclassifiedCodeFileCount}개 코드 파일은 아직 의미 레이어로 자동 분류되지 않았습니다.`
        : "현재 별도 제한 사유는 보고되지 않았습니다.";

  const warningBody =
    status.details.length > 0
      ? status.details
          .slice(0, 2)
          .map((detail) => (detail.detail ? `${detail.label} (${detail.detail})` : detail.label))
          .join(" ")
      : "추가 경고 항목은 없습니다.";

  return {
    kind: "other",
    title: "분석 상태",
    subtitle:
      status.level === "ok"
        ? "정상"
        : `${status.chipLabel ?? "분석 상태"} · ${Math.max(1, status.details.length)}건`,
    narrative: [
      {
        label: "현재 상태",
        body: status.summary ?? "현재 표시할 분석 상태가 없습니다.",
        weak: status.level !== "ok",
      },
      { label: "빠질 수 있는 범위", body: limitationBody, weak: status.level !== "ok" },
      { label: "검토할 항목", body: warningBody, weak: status.details.length > 0 },
    ],
    files: [],
    editGuides: [],
    evidence,
  };
}

function editGuidesForLayer(layerName: LayerName, guides: EditGuideInfo[]) {
  return guides.filter((g) => g.relatedLayers.includes(layerName));
}

function editGuidesForFile(path: string, guides: EditGuideInfo[]) {
  return guides.filter((g) => g.files.includes(path));
}

function githubBlobUrl(path: string, analysis: RepoAnalysis): string {
  const { owner, name, branch } = analysis.repo;
  const safeBranch = branch || "main";
  return `https://github.com/${owner}/${name}/blob/${encodeURIComponent(
    safeBranch
  )}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function findLayerForFile(path: string, analysis: RepoAnalysis): LayerName | null {
  const kf = analysis.keyFiles.find((f) => f.path === path);
  if (kf?.relatedLayers[0]) return kf.relatedLayers[0];
  const layer = analysis.layers.find((l) => l.files.includes(path));
  return layer?.name ?? null;
}

function buildFileInspectorFromPath(args: {
  path: string;
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
  evidence?: string[];
  forceUnclassified?: boolean;
}): InspectorView {
  const { path, analysis, model, evidence = [], forceUnclassified = false } = args;
  const kf = analysis.keyFiles.find((f) => f.path === path);
  const inferredLayerName = findLayerForFile(path, analysis);
  const layerName = forceUnclassified ? null : inferredLayerName;
  const guides = editGuidesForFile(path, analysis.editGuides);
  const weak = forceUnclassified || !kf || isSyntheticRole(kf.role);

  const whatBody = forceUnclassified
    ? "이 파일은 현재 의미 레이어로 분류되지 않은 코드입니다."
    : kf?.role && !isSyntheticRole(kf.role)
      ? kf.role
      : layerName
        ? `${LAYER_SUBLABEL[layerName]} 레이어의 대표 파일로 추정됩니다.`
        : "이 파일의 역할은 분석 중입니다.";

  const whyBody = forceUnclassified
    ? "현재 구조도에는 직접 편입되지 않았지만, 저장소 동작을 이해할 때 확인할 가치가 있는 코드입니다."
    : kf?.whyImportant
      ? kf.whyImportant
      : layerName
        ? `${LAYER_SUBLABEL[layerName]} 레이어가 실제로 어떻게 동작하는지 보여주는 파일입니다.`
        : "이 파일은 해당 영역의 실제 동작을 이해할 때 참고할 수 있는 파일입니다.";

  // Evidence-ladder for "어디서 쓰여?". Backend now emits extra prefixes
  // (연결 로직, 연결 후 연동, 하위 연동) alongside the older 호출 진입 /
  // 내부 API 호출 / 화면 사용 지점 / API 사용 지점 prefixes. We combine them
  // so a chained API → Logic → DB/OpenAI flow shows as one sentence instead
  // of a single-hop summary.
  const readEvidence = (prefix: string) =>
    kf?.evidence.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
  // Full paths inside evidence strings are jargon for beginners. Convert each
  // path-like token to its display name; tech identifiers (Prisma, OpenAI…)
  // stay intact.
  const humanize = (value: string | undefined) => {
    if (!value) return value;
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((token) =>
        token.includes("/") || /\.[a-zA-Z0-9]{1,6}$/.test(token)
          ? displayFileName(token)
          : token
      )
      .join(", ");
  };
  const entryPath = humanize(readEvidence("호출 진입:"));
  const viaLogic = humanize(readEvidence("연결 로직:"));
  const downstream = humanize(readEvidence("연결 후 연동:"));
  const subIntegration = humanize(readEvidence("하위 연동:"));
  const uiUsage = humanize(readEvidence("화면 사용 지점:"));
  const apiUsage = humanize(readEvidence("API 사용 지점:"));
  const outgoingTarget = humanize(readEvidence("내부 API 호출:"));
  const relatedRows =
    layerName ? buildRelatedFileRows(path, layerName, analysis, model) : [];

  let usageBody: string;
  let usageWeak = false;
  if (entryPath && viaLogic && downstream) {
    usageBody = `${entryPath} 경로로 들어와 ${viaLogic} 를 거쳐 ${downstream} 로 이어집니다.`;
  } else if (entryPath && viaLogic) {
    usageBody = `${entryPath} 경로로 들어와 ${viaLogic} 에서 처리됩니다.`;
  } else if (entryPath && downstream) {
    usageBody = `${entryPath} 경로로 들어와 ${downstream} 로 이어집니다.`;
  } else if (entryPath) {
    usageBody = `${entryPath} 경로에서 이 파일로 들어옵니다.`;
  } else if (uiUsage) {
    usageBody = `${uiUsage} 화면에서 이 파일이 쓰입니다.`;
  } else if (apiUsage) {
    usageBody = `${apiUsage} API에서 이 파일이 쓰입니다.`;
  } else if (outgoingTarget && downstream) {
    usageBody = `이 파일에서 ${outgoingTarget} 요청이 나가고 ${downstream} 로 이어집니다.`;
  } else if (outgoingTarget) {
    usageBody = `이 파일에서 ${outgoingTarget} 요청이 나갑니다.`;
  } else if (subIntegration) {
    usageBody = `이 파일은 ${subIntegration} 연동을 포함합니다.`;
  } else if (downstream) {
    usageBody = `이 파일의 호출이 ${downstream} 로 이어집니다.`;
  } else if (layerName) {
    usageBody = `${LAYER_SUBLABEL[layerName]} 레이어 안에서 사용됩니다.`;
    usageWeak = true;
  } else if (forceUnclassified) {
    usageBody = "아직 어떤 레이어에 속하는지 판단할 만한 신호가 부족해요.";
    usageWeak = true;
  } else {
    usageBody = "이 파일이 어디에서 호출되는지 아직 단서가 부족해요.";
    usageWeak = true;
  }

  const breadcrumb =
    layerName && model.inspectables[`layer:${layerName}`]
      ? {
          label: `${LAYER_SUBLABEL[layerName]} ${layerName}`,
          targetId: `layer:${layerName}`,
        }
      : forceUnclassified
        ? {
            label: "미분류 코드 Code",
            targetId: CODE_FALLBACK_ID,
          }
        : undefined;

  return {
    kind: "file",
    title: basename(path),
    subtitle: displayFileName(path),
    subtitleFull: path,
    narrative: [
      { label: "이 파일은 무엇인가요?", body: whatBody, weak },
      { label: "왜 중요한가요?", body: whyBody, weak },
      { label: "어디에서 쓰이나요?", body: usageBody, weak: usageWeak },
    ],
    files: relatedRows,
    breadcrumb,
    githubUrl: githubBlobUrl(path, analysis),
    editGuides: guides,
    evidence: kf?.evidence?.length ? kf.evidence : evidence,
  };
}

export function buildCodeFallbackInspectorView(
  analysis: RepoAnalysis,
  model: ArchitectureGraphModel
): InspectorView {
  const status = buildWorkspaceStatusView(analysis);
  const codeLikeFiles = Number(analysis.facts.find((fact) => fact.id === "code_like_files")?.value ?? "0");
  const sampleRows = buildFallbackFileRows(status.unclassifiedCodeSamples, analysis, model, 5);
  const firstSample = sampleRows[0];
  const reasonLine = status.unclassifiedCodeReasonSummary
    ? `${status.unclassifiedCodeReasonSummary}.`
    : null;
  const semanticLine = status.unclassifiedCodeSemanticSummary
    ? `${status.unclassifiedCodeSemanticSummary}${status.unclassifiedCodeContentCoverage ? ` (대표 본문 ${status.unclassifiedCodeContentCoverage})` : ""}.`
    : null;

  return {
    kind: "layer",
    title: "미분류 코드 (Code)",
    subtitle: `Code fallback · ${status.unclassifiedCodeFileCount} files`,
    narrative: [
      {
        label: "이 범위는 무엇인가요?",
        body: "이 범위는 UI, API, DB 같은 의미 레이어로 아직 안정적으로 묶이지 않은 코드입니다.",
      },
      {
        label: "왜 중요한가요?",
        body:
          codeLikeFiles > 0
            ? `전체 코드성 파일 ${codeLikeFiles}개 중 ${status.unclassifiedCodeFileCount}개가 이 fallback에 남아 있습니다. 구조도를 볼 때 빠진 범위가 없는지 확인하는 용도입니다.${reasonLine ? ` ${reasonLine}` : ""}${semanticLine ? ` ${semanticLine}` : ""}`
            : `현재 구조도 바깥에 남은 코드를 따로 보여줘서 분석이 어디까지 정확한지 판단하게 돕습니다.${reasonLine ? ` ${reasonLine}` : ""}${semanticLine ? ` ${semanticLine}` : ""}`,
      },
      {
        label: "뭐부터 봐야 해?",
        body: firstSample
          ? `${firstSample.display} 같은 샘플 파일부터 보면 현재 휴리스틱이 놓친 범위를 빠르게 확인할 수 있습니다.`
          : "대표 샘플 파일은 아직 정리되지 않았습니다.",
        weak: !firstSample,
      },
    ],
    files: sampleRows,
    editGuides: [],
    evidence: status.details
      .map((detail) => (detail.detail ? `${detail.label} (${detail.detail})` : detail.label))
      .concat(
        status.unclassifiedCodeReasonSummary
          ? [`미분류 사유: ${status.unclassifiedCodeReasonSummary}`]
          : [],
      )
      .concat(
        status.unclassifiedCodeSemanticSummary
          ? [
              `본문 신호: ${status.unclassifiedCodeSemanticSummary}${
                status.unclassifiedCodeContentCoverage
                  ? ` (대표 본문 ${status.unclassifiedCodeContentCoverage})`
                  : ""
              }`,
            ]
          : [],
      )
      .concat(
        status.unclassifiedCodeSamples.length > 0
          ? [`샘플 파일: ${status.unclassifiedCodeSamples.join(", ")}`]
          : []
      ),
  };
}

export function buildFallbackFileInspectorView(args: {
  path: string;
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
}) {
  const { path, analysis, model } = args;
  return buildFileInspectorFromPath({
    path,
    analysis,
    model,
    evidence: ["이 파일은 현재 Code fallback에서 열린 샘플 파일입니다."],
    forceUnclassified: true,
  });
}

export function buildInspectorView({
  inspector,
  analysis,
  model,
}: {
  inspector: ArchitectureInspector;
  analysis: RepoAnalysis;
  model: ArchitectureGraphModel;
}): InspectorView {
  // ── Layer inspector ───────────────────────────────────────────────────────
  if (inspector.id.startsWith("layer:")) {
    const layerName = inspector.id.slice("layer:".length) as LayerName;
    const layer = analysis.layers.find((l) => l.name === layerName);
    const subLabel = LAYER_SUBLABEL[layerName];
    const startFile = analysis.summary.recommendedStartFile;
    const startInThisLayer = startFile
      ? analysis.keyFiles.find(
          (k) => k.path === startFile && k.relatedLayers.includes(layerName)
        )
      : undefined;

    // Use the full layer file set so the file-row scorer can surface the best
    // 5 — the inspector.files short-list only holds 4 and biases toward the
    // first-discovered ones, leaving screens with just 2 visible rows.
    const candidatePaths =
      layer?.files && layer.files.length > 0 ? layer.files : inspector.files;
    const visibleRows = buildVisibleFileRows({
      paths: candidatePaths,
      layerName,
      analysis,
      model,
      limit: 5,
    });

    const whatBody = layer?.description
      ? `${subLabel}에 해당하는 파일들이 모여 있는 레이어입니다. ${layer.description}`
      : `${subLabel}에 해당하는 파일들이 모여 있는 레이어입니다.`;

    // "왜 중요해?"를 파일 수 반복이 아니라, 각 레이어의 데이터 흐름상 역할
    // + 사용 기술로 구체화한다. fileCount는 subtitle에 이미 있으므로 중복 회피.
    const layerFlowRole: Record<LayerName, string> = {
      UI: "사용자 동작이 시작되는 첫 진입 범위입니다.",
      Logic: "화면과 서버 사이에서 상태와 계산을 담당합니다.",
      API: "서버 요청을 받아 처리하고 필요한 데이터로 연결합니다.",
      DB: "데이터를 저장하거나 조회하는 종단점입니다.",
      External: "외부 서비스와 연결되는 종단점입니다.",
    };
    const layerTechHints = buildLayerTechHints(analysis, layerName);
    const techSentence =
      layerTechHints.length > 0
        ? ` ${layerTechHints.join(", ")}로 구성돼 있습니다.`
        : "";
    // API · Logic 레이어에 한해 통합 흐름 inference가 있으면 한 문장 덧붙임.
    const integrationFlow =
      layerName === "API" || layerName === "Logic"
        ? analysis.inferences.find((item) => item.id === "api_logic_integration_flow")
            ?.conclusion
        : undefined;
    const flowSentence = integrationFlow ? ` 흐름: ${integrationFlow}.` : "";
    const whyBody = `${layerFlowRole[layerName]}${techSentence}${flowSentence}`;

    // "뭐부터 봐야 해?"에 이유 한 줄을 함께 붙여 "왜 이 파일부터인지"를 전달.
    let whereBody: string;
    let whereWeak = false;
    if (startInThisLayer) {
      const reason = analysis.summary.recommendedStartReason?.trim();
      const name = displayFileName(startInThisLayer.path);
      whereBody = reason
        ? `${name} — ${reason}`
        : `${name}. 이 레포 전체에서 가장 먼저 읽을 진입점입니다.`;
    } else if (visibleRows.length > 0) {
      const first = visibleRows.find((r) => !r.isWeak) ?? visibleRows[0];
      const kfReason = analysis.keyFiles.find((k) => k.path === first.path)?.whyImportant?.trim();
      if (first.isWeak) {
        whereBody = `${first.display} 이 대표 파일로 추정됩니다.`;
        whereWeak = true;
      } else if (kfReason) {
        whereBody = `${first.display} — ${kfReason}`;
      } else {
        whereBody = `${first.display} 이 우선 살펴볼 파일입니다.`;
      }
    } else {
      whereBody = "이 레이어의 대표 파일이 아직 정리되지 않았습니다.";
      whereWeak = true;
    }

    return {
      kind: "layer",
      title: LAYER_TITLE_KO[layerName],
      subtitle: `${layerName} layer${layer ? ` · ${layer.fileCount} files` : ""}`,
      narrative: [
        { label: "이 레이어는 무엇인가요?", body: whatBody },
        { label: "왜 중요한가요?", body: whyBody },
        { label: "뭐부터 봐야 해?", body: whereBody, weak: whereWeak },
      ],
      files: visibleRows,
      focusLayer: layerName,
      editGuides: editGuidesForLayer(layerName, analysis.editGuides),
      evidence: layer?.evidence ?? inspector.evidence,
    };
  }

  // ── File inspector ────────────────────────────────────────────────────────
  if (inspector.id.startsWith("file:")) {
    const path = inspector.id.slice("file:".length);
    return buildFileInspectorFromPath({
      path,
      analysis,
      model,
      evidence: inspector.evidence,
    });
  }

  // ── Other (overview / workspace / group / edit guide) ─────────────────────
  return {
    kind: "other",
    title: inspector.title,
    subtitle: inspector.subtitle,
    narrative: [{ label: "개요", body: inspector.body }],
    files: inspector.files.map((path) => ({
      path,
      display: displayFileName(path),
      extension: extensionBadge(path),
      role: "",
      fullRole: "",
      isStart: analysis.summary.recommendedStartFile === path,
      isClickable: Boolean(model.inspectables[`file:${path}`]),
      targetId: model.inspectables[`file:${path}`] ? `file:${path}` : undefined,
      isWeak: true,
      isTest: isTestFile(path),
    })),
    editGuides: [],
    evidence: inspector.evidence,
  };
}
