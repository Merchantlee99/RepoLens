import {
  pickLayerRepresentativePaths,
  rankLayerRepresentativePaths,
  representativePathBucket,
  representativeLayerConfidence,
  scoreLayerRepresentativePath,
} from "@/lib/analysis/heuristics";
import type {
  EditGuideInfo,
  KeyFileInfo,
  LayerName,
  RepoAnalysis,
  RepoLayer,
} from "@/lib/analysis/types";

export type FocusRailKey = "all" | LayerName | "packages" | "apps" | "tooling";

type GroupKey = "apps" | "packages" | "tooling";
type LayerTone = "ui" | "logic" | "api" | "db" | "external";

export type ArchitectureInspector = {
  id: string;
  kind: "overview" | "workspace" | "group" | "layer" | "file" | "edit";
  title: string;
  subtitle: string;
  body: string;
  badges: string[];
  files: string[];
  evidence: string[];
  layerName?: LayerName;
  path?: string;
  githubUrl?: string;
  parentId?: string;
  isFallback?: boolean;
};

export type ArchitectureFileCard = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  role: string;
  layerName: LayerName;
  isStartFile: boolean;
  isFallback: boolean;
  githubUrl: string;
  focusKeys: FocusRailKey[];
  priority: number;
};

export type ArchitectureWorkspaceCard = {
  id: string;
  title: string;
  subtitle: string;
  root: string;
  groupKey: GroupKey | null;
  isFocus: boolean;
  focusKeys: FocusRailKey[];
  manifestPath: string | null;
  fileHints: string[];
};

export type ArchitectureGroupCard = {
  id: string;
  key: GroupKey;
  title: string;
  subtitle: string;
  workspaceCount: number;
  focusKeys: FocusRailKey[];
  workspaces: ArchitectureWorkspaceCard[];
};

export type ArchitectureLayerCard = {
  id: string;
  layerName: LayerName;
  title: string;
  subtitle: string;
  description: string;
  fileCount: number;
  tone: LayerTone;
  focusKeys: FocusRailKey[];
  keyFiles: ArchitectureFileCard[];
  samplePaths: string[];
  confidence: "high" | "medium" | "low";
};

export type ArchitectureConnection = {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: "neutral" | "accent" | "muted";
  focusKeys: FocusRailKey[];
};

export type ArchitectureRailItem = {
  key: FocusRailKey;
  label: string;
  count: number;
  description: string;
  disabled: boolean;
  targetId: string;
};

export type ArchitectureRepoCard = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  badges: string[];
  focusKeys: FocusRailKey[];
};

export type ArchitectureGraphModel = {
  overview: ArchitectureInspector;
  inspectables: Record<string, ArchitectureInspector>;
  railItems: ArchitectureRailItem[];
  repoCard: ArchitectureRepoCard;
  groupCards: ArchitectureGroupCard[];
  focusWorkspace: ArchitectureWorkspaceCard | null;
  layerCards: ArchitectureLayerCard[];
  connections: ArchitectureConnection[];
  supportRoots: string[];
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function shortList(values: string[], limit = 4) {
  return unique(values).slice(0, limit);
}

function isDisplayNoisePath(path: string) {
  return /(^|\/)[^/]+\.(test|spec|stories|story)\.(ts|tsx|js|jsx|mjs|cjs|mdx)$/i.test(path);
}

function isGenericDisplayName(name: string) {
  return /^(index|main|utils?|package|route|page|layout|client|server|config)(\.[^.]+){1,2}$/i.test(
    name
  );
}

function displayFileTitle(path: string) {
  const segments = path.split("/");
  const base = segments[segments.length - 1] ?? path;

  if (!isGenericDisplayName(base)) {
    return base;
  }

  return segments.slice(Math.max(0, segments.length - 2)).join("/");
}

function buildGitHubBlobUrl(analysis: RepoAnalysis, path: string) {
  return `https://github.com/${analysis.repo.owner}/${analysis.repo.name}/blob/${analysis.repo.branch}/${path}`;
}

function scopePriority(path: string, focusRoot: string | null) {
  if (!focusRoot) {
    return 0;
  }

  return path.startsWith(`${focusRoot}/`) ? 0 : 1;
}

function workspaceGroupKey(root: string | null): GroupKey | null {
  if (!root) {
    return null;
  }

  if (root.startsWith("apps/")) {
    return "apps";
  }

  if (root.startsWith("packages/")) {
    return "packages";
  }

  return null;
}

function focusRootLabel(root: string | null) {
  if (!root) {
    return "repo root";
  }

  if (root === "src") {
    return "src root";
  }

  return root;
}

function layerTone(name: LayerName): LayerTone {
  switch (name) {
    case "UI":
      return "ui";
    case "Logic":
      return "logic";
    case "API":
      return "api";
    case "DB":
      return "db";
    case "External":
      return "external";
  }
}

function layerBody(layer: RepoLayer) {
  return `${layer.description} 현재 ${layer.fileCount}개 파일을 이 레이어 근거로 묶었습니다.`;
}

function supportRoots(analysis: RepoAnalysis) {
  return analysis.topology.workspaceRoots.filter((root) => {
    if (analysis.topology.focusRoot && root === analysis.topology.focusRoot) {
      return false;
    }

    return /(^|\/)(docs|storybook|playgrounds?|sandbox|showcase|preview|test|tests|testing|ssr-testing|v\d+)(\/|$)/i.test(
      root
    );
  });
}

function workspaceManifestPath(root: string, analysis: RepoAnalysis) {
  return (
    analysis.topology.manifestFiles.find((path) => path === `${root}/package.json`) ?? null
  );
}

function workspaceHints(root: string, analysis: RepoAnalysis) {
  const manifest = workspaceManifestPath(root, analysis);
  const relatedKeyFiles = analysis.keyFiles
    .filter((file) => file.path.startsWith(`${root}/`))
    .map((file) => file.path);

  return shortList(
    [...(manifest ? [manifest] : []), ...relatedKeyFiles],
    4
  );
}

function workspaceInspector(
  root: string,
  groupKey: GroupKey | null,
  isFocus: boolean,
  analysis: RepoAnalysis
): ArchitectureInspector {
  const files = workspaceHints(root, analysis);

  return {
    id: `workspace:${root}`,
    kind: "workspace",
    title: root,
    subtitle: isFocus
      ? groupKey === "tooling"
        ? "대표 tooling root"
        : groupKey === null
          ? "대표 범위"
        : "대표 workspace"
      : groupKey === "apps"
        ? "연결된 app workspace"
      : groupKey === "packages"
          ? "연결된 package workspace"
          : "연결된 tooling root",
    body: isFocus
      ? groupKey === "tooling"
        ? `현재 구조도에서 가장 먼저 읽어야 하는 tooling root입니다. 이 루트 안에서 운영 문서, 자동화 스크립트, 템플릿을 우선 정리했습니다.`
        : groupKey === null
          ? `현재 구조도에서 가장 먼저 읽어야 하는 대표 범위입니다. 이 루트 안에서 핵심 화면, API, 설정 파일을 우선 정리했습니다.`
        : `현재 구조도에서 가장 먼저 읽어야 하는 범위로 선택된 workspace입니다. 이 루트 안에서 레이어와 핵심 파일을 우선 정리했습니다.`
      : groupKey === "tooling"
        ? `운영 문서, 자동화 스크립트, 템플릿이 모인 tooling root입니다. 루트 README 다음으로 이 범위를 읽으면 저장소 목적이 더 빨리 풀립니다.`
        : groupKey === null
          ? `대표 범위와 연결된 루트입니다. 핵심 구조를 이해한 다음 세부 화면과 파일을 확장해서 읽으면 덜 헷갈립니다.`
        : `${groupKey === "apps" ? "앱" : "패키지"} 묶음 안에 있는 workspace입니다. 대표 범위를 이해한 다음 이 영역으로 확장하면 구조가 덜 헷갈립니다.`,
    badges: [groupKey ?? "focus-root", isFocus ? "focus" : "connected workspace"],
    files,
    evidence: [
      ...(workspaceManifestPath(root, analysis)
        ? [`manifest: ${workspaceManifestPath(root, analysis)}`]
        : [`root: ${root}`]),
      ...(isFocus ? [analysis.summary.recommendedStartFile ?? "추천 시작 파일 없음"] : []),
    ],
  };
}

function layerKeyFiles(layer: RepoLayer, analysis: RepoAnalysis): ArchitectureFileCard[] {
  const focusRoot = analysis.topology.focusRoot;
  const explicitKeyFiles = analysis.keyFiles
    .filter((file) => file.relatedLayers.includes(layer.name))
    .filter((file) => !isDisplayNoisePath(file.path))
    .sort(
      (left, right) =>
        scoreLayerRepresentativePath(right.path, layer.name, focusRoot) -
          scoreLayerRepresentativePath(left.path, layer.name, focusRoot) ||
        scopePriority(left.path, focusRoot) - scopePriority(right.path, focusRoot) ||
        left.readOrder - right.readOrder ||
        left.path.localeCompare(right.path)
    );
  const explicitPaths = new Set(explicitKeyFiles.map((file) => file.path));
  const fallbackPaths = pickLayerRepresentativePaths(
    layer.files.filter((path) => !isDisplayNoisePath(path)),
    layer.name,
    focusRoot,
    4
  ).filter((path) => !explicitPaths.has(path));

  const fallbackKeyFiles: KeyFileInfo[] = fallbackPaths.map((path, index) => ({
    path,
    readOrder: index + 1,
    role: `${layer.name} 레이어 대표 파일`,
    whyImportant: `${layer.name} 레이어의 대표 경로로 감지된 파일입니다.`,
    evidence: layer.evidence,
    relatedLayers: [layer.name],
  }));

  const combined = unique([...explicitKeyFiles, ...fallbackKeyFiles].map((file) => file.path)).map((path) => {
    const original =
      explicitKeyFiles.find((file) => file.path === path) ??
      fallbackKeyFiles.find((file) => file.path === path)!;

    return {
      id: `file:${path}`,
      title: displayFileTitle(path),
      subtitle: original.role,
      path,
      role: original.role,
      layerName: layer.name,
      isStartFile: analysis.summary.recommendedStartFile === path,
      isFallback: !explicitKeyFiles.some((file) => file.path === path),
      githubUrl: buildGitHubBlobUrl(analysis, path),
      focusKeys: ["all", layer.name],
      priority: scoreLayerRepresentativePath(path, layer.name, focusRoot),
    } satisfies ArchitectureFileCard;
  });

  const rankedCards = [...combined].sort(
    (left, right) =>
      right.priority - left.priority ||
      scopePriority(left.path, focusRoot) - scopePriority(right.path, focusRoot) ||
      left.path.localeCompare(right.path)
  );
  const startCard = rankedCards.find((file) => file.isStartFile);
  const remainingPaths = rankedCards
    .map((file) => file.path)
    .filter((path) => path !== startCard?.path);
  const selectedPaths = [
    ...(startCard ? [startCard.path] : []),
    ...pickLayerRepresentativePaths(
      remainingPaths,
      layer.name,
      focusRoot,
      startCard ? 2 : 3,
      startCard ? [representativePathBucket(startCard.path, layer.name)] : []
    ),
  ].slice(0, 3);
  const selectedCards: Array<ArchitectureFileCard | undefined> = selectedPaths.map((path) =>
    rankedCards.find((file) => file.path === path)
  );

  return selectedCards.filter((file): file is ArchitectureFileCard => file !== undefined);
}

function fileInspector(
  file: KeyFileInfo,
  analysis: RepoAnalysis,
  layerName?: LayerName
): ArchitectureInspector {
  return {
    id: `file:${file.path}`,
    kind: "file",
    title: file.path,
    subtitle: file.role,
    body: file.whyImportant,
    badges: [
      ...(layerName ? [layerName] : []),
      `read ${file.readOrder}`,
    ],
    files: [file.path],
    evidence: file.evidence,
    layerName,
    path: file.path,
    githubUrl: buildGitHubBlobUrl(analysis, file.path),
    parentId: layerName ? `layer:${layerName}` : undefined,
    isFallback: false,
  };
}

function editGuideInspector(guide: EditGuideInfo): ArchitectureInspector {
  return {
    id: `edit:${guide.intent}`,
    kind: "edit",
    title: guide.intent,
    subtitle: "수정 시작점",
    body: guide.reason,
    badges: ["edit guide"],
    files: guide.files,
    evidence: guide.evidence,
  };
}

function registerInspectable(registry: Record<string, ArchitectureInspector>, inspector: ArchitectureInspector) {
  registry[inspector.id] = inspector;
}

function prioritizedLayerPaths(paths: string[], analysis: RepoAnalysis, layerName: LayerName) {
  const focusRoot = analysis.topology.focusRoot;

  return rankLayerRepresentativePaths(
    paths.filter((path) => !isDisplayNoisePath(path)),
    layerName,
    focusRoot
  );
}

export function buildArchitectureModel(analysis: RepoAnalysis): ArchitectureGraphModel {
  const focusRoot = analysis.topology.focusRoot;
  const focusGroupKey = workspaceGroupKey(focusRoot);
  const resolvedFocusGroupKey =
    focusGroupKey ??
    (analysis.summary.projectType === "라이브러리 또는 개발 도구" && focusRoot ? "tooling" : null);
  const supportedGroups = analysis.topology.workspaceGroups.filter(
    (group): group is RepoAnalysis["topology"]["workspaceGroups"][number] & { name: GroupKey } =>
      group.name === "apps" || group.name === "packages"
  );
  const supportRootsList = supportRoots(analysis);
  const inspectables: Record<string, ArchitectureInspector> = {};
  const overview: ArchitectureInspector = {
    id: "repo:overview",
    kind: "overview",
    title: `${analysis.repo.owner}/${analysis.repo.name}`,
    subtitle: analysis.summary.projectType,
    body: analysis.summary.oneLiner,
    badges: [analysis.topology.kind === "monorepo" ? "monorepo" : "single repo", analysis.analysisMode],
    files: shortList(
      [analysis.summary.recommendedStartFile, ...analysis.topology.manifestFiles].filter(
        (value): value is string => Boolean(value)
      ),
      5
    ),
    evidence: [
      `스택: ${analysis.summary.stack.join(", ")}`,
      `Focus: ${focusRootLabel(focusRoot)}`,
      ...analysis.summary.keyFeatures,
    ],
  };
  registerInspectable(inspectables, overview);

  const repoCard: ArchitectureRepoCard = {
    id: overview.id,
    title: analysis.repo.name,
    subtitle: analysis.summary.projectType,
    body: analysis.summary.analysisScopeLabel,
    badges: [analysis.repo.branch, analysis.repo.sha.slice(0, 7), analysis.summary.difficulty],
    focusKeys: ["all"],
  };

  analysis.keyFiles.forEach((file) => {
    registerInspectable(
      inspectables,
      fileInspector(file, analysis, file.relatedLayers[0])
    );
  });

  const groupCards: ArchitectureGroupCard[] = supportedGroups.map((group) => {
    const workspaces = group.roots
      .slice()
      .sort((a, b) => Number(b === focusRoot) - Number(a === focusRoot) || a.localeCompare(b))
      .slice(0, 6)
      .map((root) => {
        const inspector = workspaceInspector(root, group.name, root === focusRoot, analysis);
        registerInspectable(inspectables, inspector);

        return {
          id: inspector.id,
          title: root.split("/").slice(1).join("/") || root,
          subtitle: root === focusRoot ? "focus" : root.includes("docs") || root.includes("storybook") || root.includes("showcase") ? "support" : "linked",
          root,
          groupKey: group.name,
          isFocus: root === focusRoot,
          focusKeys: ["all", group.name],
          manifestPath: workspaceManifestPath(root, analysis),
          fileHints: workspaceHints(root, analysis),
        } satisfies ArchitectureWorkspaceCard;
      });

    const inspector: ArchitectureInspector = {
      id: `group:${group.name}`,
      kind: "group",
      title: group.name,
      subtitle: `${group.count}개 workspace`,
      body:
        group.name === "apps"
          ? `사용자에게 보이는 앱, 문서 앱, 데모 앱 같은 workspace 묶음입니다. focus app이 있으면 여기서 대표 흐름이 시작됩니다.`
          : `공용 UI, 핵심 로직, SDK, 디자인 시스템 패키지가 모이는 묶음입니다. 여러 앱이 공통으로 쓰는 코드를 추적할 때 중요합니다.`,
      badges: [`${group.count} workspaces`, group.name],
      files: shortList(workspaces.flatMap((workspace) => workspace.fileHints), 6),
      evidence: group.roots.map((root) => `workspace: ${root}`).slice(0, 6),
    };
    registerInspectable(inspectables, inspector);

    return {
      id: inspector.id,
      key: group.name,
      title: group.name,
      subtitle: group.name === "apps" ? "사용자-facing 또는 support apps" : "공용 패키지와 재사용 코드",
      workspaceCount: group.count,
      focusKeys: ["all", group.name],
      workspaces,
    };
  });

  const focusWorkspaceInspector = focusRoot
    ? workspaceInspector(focusRoot, resolvedFocusGroupKey, true, analysis)
    : null;

  if (focusWorkspaceInspector) {
    registerInspectable(inspectables, focusWorkspaceInspector);
  }

  const focusWorkspace = focusRoot
    ? ({
        id: focusWorkspaceInspector!.id,
        title: focusRootLabel(focusRoot),
        subtitle: analysis.summary.recommendedStartFile ?? "대표 시작 범위",
        root: focusRoot,
        groupKey: resolvedFocusGroupKey,
        isFocus: true,
        focusKeys: ["all", ...(resolvedFocusGroupKey ? [resolvedFocusGroupKey] : [])],
        manifestPath: workspaceManifestPath(focusRoot, analysis),
        fileHints: workspaceHints(focusRoot, analysis),
      } satisfies ArchitectureWorkspaceCard)
    : null;

  const layerCards = analysis.layers.map((layer) => {
    const keyFiles = layerKeyFiles(layer, analysis);

    const inspector: ArchitectureInspector = {
      id: `layer:${layer.name}`,
      kind: "layer",
      title: layer.name,
      subtitle: `${layer.fileCount} files`,
      body: layerBody(layer),
      badges: [layer.name, `${layer.fileCount} files`],
      files: shortList(keyFiles.map((file) => file.path), 4),
      evidence: layer.evidence,
      layerName: layer.name,
      parentId: focusRoot ? `workspace:${focusRoot}` : overview.id,
    };
    registerInspectable(inspectables, inspector);

    keyFiles.forEach((file) => {
      const original = analysis.keyFiles.find((item) => item.path === file.path);
      registerInspectable(
        inspectables,
        original ? fileInspector(original, analysis, layer.name) : {
          id: file.id,
          kind: "file",
          title: file.path,
          subtitle: `${layer.name} 대표 파일`,
          body: `${layer.name} 레이어와 직접 연결된 대표 파일입니다.`,
          badges: [layer.name],
          files: [file.path],
          evidence: layer.evidence,
          layerName: layer.name,
          path: file.path,
          githubUrl: buildGitHubBlobUrl(analysis, file.path),
          parentId: inspector.id,
          isFallback: true,
        }
      );
    });

    return {
      id: inspector.id,
      layerName: layer.name,
      title: layer.name,
      subtitle: layer.description,
      description: layer.description,
      fileCount: layer.fileCount,
      tone: layerTone(layer.name),
      focusKeys: ["all", layer.name],
      keyFiles,
      samplePaths: shortList(prioritizedLayerPaths(layer.files, analysis, layer.name), 3),
      confidence: representativeLayerConfidence(layer.files, layer.name, focusRoot),
    } satisfies ArchitectureLayerCard;
  });

  analysis.editGuides.forEach((guide) => {
    registerInspectable(inspectables, editGuideInspector(guide));
  });

  const connections: ArchitectureConnection[] = [];
  const appsGroup = groupCards.find((group) => group.key === "apps");
  const packagesGroup = groupCards.find((group) => group.key === "packages");
  const toolingFocus = resolvedFocusGroupKey === "tooling" ? focusWorkspace : null;

  if (appsGroup) {
    connections.push({
      id: "repo-apps",
      from: repoCard.id,
      to: appsGroup.id,
      label: "apps cluster",
      tone: "neutral",
      focusKeys: ["all", "apps"],
    });
  }

  if (packagesGroup) {
    connections.push({
      id: "repo-packages",
      from: repoCard.id,
      to: packagesGroup.id,
      label: "packages cluster",
      tone: "neutral",
      focusKeys: ["all", "packages"],
    });
  }

  if (focusWorkspace) {
    connections.push({
      id: "repo-focus",
      from: repoCard.id,
      to: focusWorkspace.id,
      label: "focus scope",
      tone: "accent",
      focusKeys: ["all"],
    });

    if (resolvedFocusGroupKey === "apps" && appsGroup) {
      connections.push({
        id: "apps-focus",
        from: appsGroup.id,
        to: focusWorkspace.id,
        label: "대표 app",
        tone: "accent",
        focusKeys: ["all", "apps"],
      });
    }

    if (resolvedFocusGroupKey === "packages" && packagesGroup) {
      connections.push({
        id: "packages-focus",
        from: packagesGroup.id,
        to: focusWorkspace.id,
        label: "대표 package",
        tone: "accent",
        focusKeys: ["all", "packages"],
      });
    }
  }

  if (packagesGroup) {
    ["UI", "Logic"].forEach((layerName) => {
      const layerCard = layerCards.find((item) => item.layerName === layerName);

      if (!layerCard) {
        return;
      }

      connections.push({
        id: `packages-${layerName.toLowerCase()}`,
        from: packagesGroup.id,
        to: layerCard.id,
        label: layerName === "UI" ? "shared components" : "shared logic",
        tone: "muted",
        focusKeys: ["all", "packages", layerName as LayerName],
      });
    });
  }

  layerCards.forEach((layerCard) => {
    if (!focusWorkspace) {
      return;
    }

    connections.push({
      id: `focus-${layerCard.layerName.toLowerCase()}`,
      from: focusWorkspace.id,
      to: layerCard.id,
      label: layerCard.layerName,
      tone: "neutral",
      focusKeys: ["all", layerCard.layerName],
    });
  });

  const layerByName = (name: LayerName) => layerCards.find((item) => item.layerName === name);
  const uiLayer = layerByName("UI");
  const logicLayer = layerByName("Logic");
  const apiLayer = layerByName("API");
  const dbLayer = layerByName("DB");
  const externalLayer = layerByName("External");

  if (uiLayer && apiLayer) {
    connections.push({
      id: "ui-api",
      from: uiLayer.id,
      to: apiLayer.id,
      label: "user action",
      tone: "accent",
      focusKeys: ["all", "UI", "API"],
    });
  }

  if (logicLayer && apiLayer) {
    connections.push({
      id: "logic-api",
      from: logicLayer.id,
      to: apiLayer.id,
      label: "shared processing",
      tone: "muted",
      focusKeys: ["all", "Logic", "API"],
    });
  }

  if (apiLayer && dbLayer) {
    connections.push({
      id: "api-db",
      from: apiLayer.id,
      to: dbLayer.id,
      label: "data access",
      tone: "accent",
      focusKeys: ["all", "API", "DB"],
    });
  }

  if (apiLayer && externalLayer) {
    connections.push({
      id: "api-external",
      from: apiLayer.id,
      to: externalLayer.id,
      label: "third-party call",
      tone: "accent",
      focusKeys: ["all", "API", "External"],
    });
  }

  if (!apiLayer && logicLayer && externalLayer) {
    connections.push({
      id: "logic-external",
      from: logicLayer.id,
      to: externalLayer.id,
      label: "SDK / service",
      tone: "muted",
      focusKeys: ["all", "Logic", "External"],
    });
  }

  const railItems: ArchitectureRailItem[] = [
    {
      key: "all",
      label: "전체",
      count: analysis.stats.fileCount,
      description: "전체 구조를 한 장으로 보기",
      disabled: false,
      targetId: overview.id,
    },
    ...(["UI", "Logic", "API", "DB", "External"] as LayerName[]).map((layerName) => {
      const layer = layerCards.find((item) => item.layerName === layerName);

      return {
        key: layerName,
        label: layerName,
        count: layer?.fileCount ?? 0,
        description: layer?.description ?? `${layerName} 레이어가 감지되지 않았습니다.`,
        disabled: !layer,
        targetId: layer?.id ?? overview.id,
      } satisfies ArchitectureRailItem;
    }),
    {
      key: "packages",
      label: "packages",
      count: packagesGroup?.workspaceCount ?? 0,
      description: packagesGroup
        ? "공용 패키지와 재사용 코드에 포커스"
        : "packages 그룹이 감지되지 않았습니다.",
      disabled: !packagesGroup,
      targetId: packagesGroup?.id ?? overview.id,
    },
    {
      key: "tooling",
      label: "tooling",
      count: toolingFocus ? 1 : 0,
      description: toolingFocus
        ? "대표 tooling root와 연결된 문서/스크립트 범위에 포커스"
        : "대표 tooling root가 감지되지 않았습니다.",
      disabled: !toolingFocus,
      targetId: toolingFocus?.id ?? overview.id,
    },
    {
      key: "apps",
      label: "apps",
      count: appsGroup?.workspaceCount ?? 0,
      description: appsGroup ? "앱과 데모 workspace에 포커스" : "apps 그룹이 감지되지 않았습니다.",
      disabled: !appsGroup,
      targetId: appsGroup?.id ?? overview.id,
    },
  ];

  return {
    overview,
    inspectables,
    railItems,
    repoCard,
    groupCards,
    focusWorkspace,
    layerCards,
    connections,
    supportRoots: supportRootsList,
  };
}
