"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { StackBadge } from "@/components/stack-badge";
import type {
  RepoAnalysis,
  RepoEnvironmentGuide,
  RepoEnvRuntime,
  RepoLearningGuide,
  RepoPreviewImage,
  RepoStackGlossaryItem,
  RepoUsageGuide,
} from "@/lib/analysis/types";

// ─── Labels & helpers ──────────────────────────────────────────────────────

const SOURCE_LABEL: Record<RepoUsageGuide["source"], string> = {
  package_json: "package.json에서 읽음",
  readme: "README에서 읽음",
  mixed: "package.json + README 조합",
  none: "",
};

const ENV_RUNTIME_LABEL: Record<RepoEnvRuntime["name"], string> = {
  node: "Node.js",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  bun: "Bun",
  deno: "Deno",
};

const ENV_RUNTIME_SOURCE_LABEL: Record<RepoEnvRuntime["source"], string> = {
  package_json: "package.json",
  nvmrc: ".nvmrc",
  node_version: ".node-version",
  python_version: ".python-version",
  pyproject: "pyproject.toml",
  requirements_txt: "requirements.txt",
  setup_py: "setup.py",
  setup_cfg: "setup.cfg",
  environment_yml: "environment.yml",
  pipfile: "Pipfile",
  go_mod: "go.mod",
  cargo_toml: "Cargo.toml",
  rust_toolchain: "rust-toolchain",
  deno_json: "deno.json",
  dockerfile: "Dockerfile",
  readme: "README",
};

function environmentHasContent(environment: RepoEnvironmentGuide) {
  return !(
    environment.runtimes.length === 0 &&
    !environment.container.hasDockerfile &&
    !environment.container.hasDockerCompose &&
    !environment.hardware.gpuRequired &&
    environment.hardware.gpuHint === null &&
    environment.hardware.minRamGb === null &&
    environment.hardware.recommendedRamGb === null &&
    environment.hardware.minDiskGb === null &&
    environment.cloud.deployTargets.length === 0 &&
    environment.cloud.servicesRequired.length === 0
  );
}

function sectionEmpty(list: string[] | undefined): boolean {
  return !list || list.length === 0;
}

// ─── Monorepo command classification ────────────────────────────────────────
//
// analysis.learning.usage can mix two styles in monorepos:
//  1) focus-app commands: `cd apps/web && pnpm dev` — beginner-friendly.
//     The user can paste one line and it runs.
//  2) repo-root runner commands: `turbo run dev --filter web`,
//     `pnpm --filter @repo/web build`, `yarn workspace web test`, `nx test web`.
//     These need monorepo tooling knowledge to read.
//
// We surface (1) first under "바로 실행", and hide (2) under "루트에서 실행
// (고급)" so beginners are not confronted with filter syntax up-front.
type UsageCommandKind = "focus" | "root" | "plain";

function classifyCommand(command: string): UsageCommandKind {
  const trimmed = command.trim();
  if (/^cd\s+[^\s]+\s*&&/.test(trimmed)) return "focus";
  if (/\bturbo\b/.test(trimmed)) return "root";
  if (/\bnx\b/.test(trimmed)) return "root";
  if (/pnpm\s+--filter\b/.test(trimmed)) return "root";
  if (/yarn\s+workspace\b/.test(trimmed)) return "root";
  if (/npm\s+--workspace\b/.test(trimmed)) return "root";
  return "plain";
}

function splitUsageCommands(list: string[]) {
  const focus: string[] = [];
  const root: string[] = [];
  const plain: string[] = [];
  for (const cmd of list) {
    const kind = classifyCommand(cmd);
    if (kind === "focus") focus.push(cmd);
    else if (kind === "root") root.push(cmd);
    else plain.push(cmd);
  }
  // Beginner-friendly ordering: focus > plain > (root hidden in advanced block)
  return { simple: [...focus, ...plain], advanced: root };
}

// ─── Usage block ────────────────────────────────────────────────────────────

type UsageKind = RepoUsageGuide["details"][number]["kind"];
type UsageDetail = RepoUsageGuide["details"][number];

// Backend may hand us a verbose explanation. Trim to first clause and cap so
// the label stays scannable.
function compactExplanation(text: string): string {
  const first = text.split(/[,.·\n]/)[0].trim();
  if (first.length === 0) return "";
  if (first.length <= 30) return first;
  return `${first.slice(0, 29)}…`;
}

// Command-shape heuristic used when backend didn't supply an explanation.
// Keeps labels predictable across languages/stacks.
function heuristicLabel(command: string, kind: UsageKind): string | null {
  const c = command.trim().toLowerCase();
  if (/docker[-\s]?compose/.test(c)) return "Docker Compose로 실행";
  if (c.startsWith("docker build")) return "Docker 이미지 빌드";
  if (c.startsWith("docker run")) return "Docker 컨테이너 실행";
  if (c.startsWith("uvicorn")) return "FastAPI/Uvicorn 서버";
  if (c.startsWith("cargo run")) return "Rust 프로그램 실행";
  if (c.startsWith("cargo build")) return "Rust 빌드";
  if (c.startsWith("cargo test")) return "Rust 테스트";
  if (c.startsWith("go run")) return "Go 프로그램 실행";
  if (c.startsWith("go build")) return "Go 빌드";
  if (c.startsWith("go test")) return "Go 테스트";
  if (/\b(jest|vitest|mocha|pytest|phpunit)\b/.test(c)) return "자동화 테스트 실행";
  if (/\b(next|vite)\b/.test(c) && /\bdev\b/.test(c)) return "개발 서버 실행";
  if (/\b(next|vite)\b/.test(c) && /\bbuild\b/.test(c)) return "프로덕션 빌드";
  if (/\b(next|vite)\b/.test(c) && /\bstart\b/.test(c)) return "프로덕션 서버 실행";
  if (kind === "install") {
    if (/\bpnpm\b/.test(c)) return "pnpm 의존성 설치";
    if (/\bnpm\b/.test(c)) return "npm 의존성 설치";
    if (/\byarn\b/.test(c)) return "yarn 의존성 설치";
    if (/\bbun\b/.test(c)) return "Bun 의존성 설치";
    if (/\b(pip|poetry)\b/.test(c)) return "Python 의존성 설치";
  }
  return null;
}

function labelFor(
  command: string,
  kind: UsageKind,
  detailsByKind: Map<string, UsageDetail>
): string | null {
  const detail = detailsByKind.get(`${kind}::${command.trim()}`);
  if (detail?.explanation) {
    const compact = compactExplanation(detail.explanation);
    if (compact) return compact;
  }
  return heuristicLabel(command, kind);
}

function CommandList({
  items,
  kind,
  detailsByKind,
  muted = false,
}: {
  items: string[];
  kind: UsageKind;
  detailsByKind: Map<string, UsageDetail>;
  muted?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((command) => {
        const label = labelFor(command, kind, detailsByKind);
        return (
          <li
            key={command}
            className={`rounded-sm border border-[var(--border)] px-2 py-1 ${
              muted ? "bg-[var(--surface-strong)]" : "bg-[var(--surface)]"
            }`}
          >
            {label ? (
              <p
                className={`text-[11px] ${
                  muted ? "text-[var(--fg-dim)]" : "text-[var(--fg)]"
                }`}
              >
                {label}
              </p>
            ) : null}
            <p
              className={`truncate font-mono text-[10.5px] ${
                label
                  ? "mt-0.5 text-[var(--fg-dim)]"
                  : muted
                    ? "text-[var(--fg-dim)]"
                    : "text-[var(--fg-muted)]"
              }`}
              title={command}
            >
              {command.trim()}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function UsageSection({
  title,
  items,
  kind,
  detailsByKind,
}: {
  title: string;
  items: string[];
  kind: UsageKind;
  detailsByKind: Map<string, UsageDetail>;
}) {
  if (sectionEmpty(items)) return null;
  const { simple, advanced } = splitUsageCommands(items);
  const hasSimple = simple.length > 0;
  const hasAdvanced = advanced.length > 0;

  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-medium text-[var(--fg-dim)]">{title}</p>
      {hasSimple ? (
        <div>
          <p className="text-[10px] text-[var(--fg-dim)]">앱 안에서 실행</p>
          <div className="mt-1">
            <CommandList items={simple} kind={kind} detailsByKind={detailsByKind} />
          </div>
        </div>
      ) : null}
      {hasAdvanced ? (
        <div>
          <p className="text-[10px] text-[var(--fg-dim)]">repo 루트에서 실행</p>
          <div className="mt-1">
            <CommandList items={advanced} kind={kind} detailsByKind={detailsByKind} muted />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UsageBlock({ usage }: { usage: RepoUsageGuide }) {
  const allEmpty =
    sectionEmpty(usage.install) &&
    sectionEmpty(usage.run) &&
    sectionEmpty(usage.build) &&
    sectionEmpty(usage.test) &&
    sectionEmpty(usage.example);

  if (allEmpty) return null;

  const sourceLabel = SOURCE_LABEL[usage.source];

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-[var(--fg)]">사용법</h3>
        {sourceLabel ? (
          <span className="text-[10px] text-[var(--fg-dim)]">{sourceLabel}</span>
        ) : null}
      </div>
      <p className="mt-1 text-[10.5px] text-[var(--fg-dim)]">
        명령줄(터미널)에 한 줄씩 복사해 실행합니다.
      </p>
      {(() => {
        const detailsByKind = new Map<string, UsageDetail>();
        for (const detail of usage.details) {
          detailsByKind.set(`${detail.kind}::${detail.command.trim()}`, detail);
        }
        return (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <UsageSection title="설치" kind="install" items={usage.install} detailsByKind={detailsByKind} />
            <UsageSection title="실행" kind="run" items={usage.run} detailsByKind={detailsByKind} />
            <UsageSection title="빌드" kind="build" items={usage.build} detailsByKind={detailsByKind} />
            <UsageSection title="테스트" kind="test" items={usage.test} detailsByKind={detailsByKind} />
            <UsageSection title="예시" kind="example" items={usage.example} detailsByKind={detailsByKind} />
          </div>
        );
      })()}
    </section>
  );
}

// ─── Environment block ──────────────────────────────────────────────────────

function EnvironmentColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[180px] flex-1">
      <p className="text-[10.5px] font-medium text-[var(--fg-dim)]">{title}</p>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

function BadgeRow({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--fg-muted)]">
      <StackBadge name={label} />
      <span className="truncate">{label}</span>
    </span>
  );
}

// Optional-service variant: dashed border + dim text signals that the
// connection is opt-in (e.g., `REDIS_URL` env flag). Used in the 선택 연동
// group so it never competes visually with required services.
function OptionalBadgeRow({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10.5px] text-[var(--fg-dim)]">
      <StackBadge name={label} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function RuntimeRow({ runtime }: { runtime: RepoEnvRuntime }) {
  const version = runtime.version ? ` ${runtime.version}` : "";
  // Collapse name + version + source into a single row so 3-runtime projects
  // stay compact. Source is demoted to dim suffix instead of its own line.
  return (
    <div className="flex items-baseline gap-1.5 text-[11.5px] leading-5">
      <StackBadge name={ENV_RUNTIME_LABEL[runtime.name]} />
      <span className="font-medium text-[var(--fg)]">
        {ENV_RUNTIME_LABEL[runtime.name]}
        <span className="text-[var(--fg-muted)]">{version}</span>
      </span>
      <span className="text-[10px] text-[var(--fg-dim)]">
        · {ENV_RUNTIME_SOURCE_LABEL[runtime.source]}
      </span>
    </div>
  );
}

function HardwareFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[11.5px] leading-5 text-[var(--fg-muted)]">
      <span className="font-medium text-[var(--fg)]">{label}</span>
      <span className="ml-1 break-words">{value}</span>
    </div>
  );
}

// Render a truncated list with a "+N more" overflow, so n8n-class compose
// files don't blow up a column. Falls back to single-value for short arrays.
function summarizeList(items: string[], max: number): string {
  if (items.length === 0) return "";
  if (items.length <= max) return items.join(", ");
  const shown = items.slice(0, max).join(", ");
  return `${shown} +${items.length - max}개`;
}

// Strip the most common markdown artefacts from README-derived notes so we
// don't render raw "**Storage**:" or trailing truncation markers to users.
function cleanNote(note: string): string {
  return note
    .replace(/\*{1,3}/g, "")
    .replace(/^[>\-\s]+/, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+$/g, "")
    .trim();
}

export function EnvironmentBlock({ environment }: { environment: RepoEnvironmentGuide }) {
  if (!environmentHasContent(environment)) {
    return null;
  }

  const runtimeVisible = environment.runtimes.length > 0;
  const containerVisible =
    environment.container.hasDockerfile ||
    environment.container.hasDockerCompose ||
    Boolean(environment.container.baseImage) ||
    environment.container.exposedPorts.length > 0 ||
    environment.container.composeServices.length > 0;
  const cloudVisible =
    environment.cloud.servicesRequired.length > 0 ||
    environment.cloud.servicesOptional.length > 0 ||
    environment.cloud.deployTargets.length > 0;

  // Hardware column now only surfaces *positive* signals. "GPU 불필요" is the
  // default and printing it every time felt like noise. Notes only show when
  // backend actually extracted them.
  const gpuInfoVisible =
    environment.hardware.gpuRequired ||
    environment.hardware.gpuHint !== null;
  const hardwareInfoVisible =
    gpuInfoVisible ||
    environment.hardware.recommendedRamGb !== null ||
    environment.hardware.minRamGb !== null ||
    environment.hardware.minDiskGb !== null ||
    environment.hardware.notes.length > 0;

  const servicesRequiredVisible = environment.cloud.servicesRequired.length > 0;
  const servicesOptionalVisible = environment.cloud.servicesOptional.length > 0;
  const deployTargetsVisible = environment.cloud.deployTargets.length > 0;

  // Low-confidence ops get a subtle opacity nudge + the "README 기반" chip,
  // so the user notices the caveat without the section looking broken.
  const confidenceChipLabel =
    environment.confidence === "low"
      ? "README 기반"
      : null;
  const bodyOpacity = environment.confidence === "low" ? "opacity-95" : "";

  return (
    <section
      className={`rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3 ${bodyOpacity}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold text-[var(--fg)]">실행 환경</h3>
          {environment.summary ? (
            <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
              {environment.summary}
            </p>
          ) : null}
        </div>
        {confidenceChipLabel ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]"
            title="README 문구를 보고 추정한 정보입니다. 실제 값과 다를 수 있습니다."
          >
            <span
              aria-hidden
              className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-[var(--border-strong)] text-[8px]"
            >
              i
            </span>
            {confidenceChipLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        {runtimeVisible ? (
          <EnvironmentColumn title="런타임">
            <div className="space-y-0.5">
              {environment.runtimes.map((runtime) => (
                <RuntimeRow key={`${runtime.name}:${runtime.source}`} runtime={runtime} />
              ))}
            </div>
          </EnvironmentColumn>
        ) : null}

        {containerVisible ? (
          <EnvironmentColumn title="컨테이너">
            {environment.container.hasDockerfile || environment.container.hasDockerCompose ? (
              <div className="flex flex-wrap gap-1">
                {environment.container.hasDockerfile ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] text-[var(--fg-muted)]">
                    <StackBadge name="docker" /> Dockerfile
                  </span>
                ) : null}
                {environment.container.hasDockerCompose ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] text-[var(--fg-muted)]">
                    compose
                  </span>
                ) : null}
              </div>
            ) : null}
            {environment.container.baseImage ? (
              <HardwareFact label="base" value={environment.container.baseImage} />
            ) : null}
            {environment.container.exposedPorts.length > 0 ? (
              <HardwareFact
                label="port"
                value={summarizeList(
                  environment.container.exposedPorts.map(String),
                  4
                )}
              />
            ) : null}
            {environment.container.composeServices.length > 0 ? (
              <HardwareFact
                label="services"
                value={summarizeList(environment.container.composeServices, 5)}
              />
            ) : null}
          </EnvironmentColumn>
        ) : null}

        {hardwareInfoVisible ? (
          <EnvironmentColumn title="하드웨어">
            {environment.hardware.recommendedRamGb !== null ? (
              <HardwareFact label="RAM 권장" value={`${environment.hardware.recommendedRamGb}GB`} />
            ) : null}
            {environment.hardware.minRamGb !== null ? (
              <HardwareFact label="RAM 최소" value={`${environment.hardware.minRamGb}GB`} />
            ) : null}
            {environment.hardware.minDiskGb !== null ? (
              <HardwareFact label="디스크 최소" value={`${environment.hardware.minDiskGb}GB`} />
            ) : null}
            {gpuInfoVisible ? (
              <HardwareFact
                label="GPU"
                value={
                  environment.hardware.gpuHint
                    ? `필요 · ${environment.hardware.gpuHint}`
                    : "필요"
                }
              />
            ) : null}
            {environment.hardware.notes.slice(0, 2).map((note) => {
              const cleaned = cleanNote(note);
              if (!cleaned) return null;
              return (
                <p
                  key={note}
                  className="line-clamp-2 text-[10.5px] leading-5 text-[var(--fg-dim)]"
                  title={cleaned}
                >
                  “{cleaned}”
                </p>
              );
            })}
          </EnvironmentColumn>
        ) : null}

        {cloudVisible ? (
          <EnvironmentColumn title="외부 서비스 · 배포">
            {servicesRequiredVisible ? (
              <div>
                <p className="text-[10px] text-[var(--fg-dim)]">필요 서비스</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {environment.cloud.servicesRequired.map((service) => (
                    <BadgeRow key={service} label={service} />
                  ))}
                </div>
              </div>
            ) : null}
            {servicesOptionalVisible ? (
              <div className={servicesRequiredVisible ? "mt-1.5" : ""}>
                <p className="text-[10px] text-[var(--fg-dim)]">선택 연동</p>
                <div className="mt-1 flex flex-wrap gap-1 opacity-80">
                  {environment.cloud.servicesOptional.map((service) => (
                    <OptionalBadgeRow key={service} label={service} />
                  ))}
                </div>
              </div>
            ) : null}
            {deployTargetsVisible ? (
              <div className={servicesRequiredVisible || servicesOptionalVisible ? "mt-1.5" : ""}>
                <p className="text-[10px] text-[var(--fg-dim)]">배포 가능</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {environment.cloud.deployTargets.map((target) => (
                    <BadgeRow key={target} label={target} />
                  ))}
                </div>
              </div>
            ) : null}
          </EnvironmentColumn>
        ) : null}
      </div>

      {environment.confidence === "low" && environment.confidenceNote ? (
        <p className="mt-3 text-[10.5px] leading-5 text-[var(--fg-dim)]">
          {environment.confidenceNote}
        </p>
      ) : null}
    </section>
  );
}

// ─── Preview block ──────────────────────────────────────────────────────────

function PreviewImageGallery({ images }: { images: RepoPreviewImage[] }) {
  // Beginner-first: first image takes a hero slot (full width, tall), remaining
  // fill a 2-col grid at a readable but compact size. object-contain prevents
  // cropping so screenshots read as "whole product", not a thumbnail.
  const [hero, ...rest] = images.slice(0, 6);
  if (!hero) return null;

  return (
    <div className="space-y-2">
      <a
        href={hero.url}
        target="_blank"
        rel="noreferrer noopener"
        title={hero.alt || hero.url}
        className="block overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.url}
          alt={hero.alt || "preview"}
          loading="lazy"
          className="block max-h-[460px] w-full object-contain"
        />
      </a>
      {rest.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {rest.map((image) => (
            <li
              key={image.url}
              className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
            >
              <a
                href={image.url}
                target="_blank"
                rel="noreferrer noopener"
                title={image.alt || image.url}
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt || "preview"}
                  loading="lazy"
                  className="block max-h-[200px] w-full object-contain"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeployPreview({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 많은 실제 배포 사이트가 `X-Frame-Options`/`CSP`로 iframe을 거부한다. 이때
  // `onError`가 발동되지 않고 iframe만 검게 남아 사용자가 "아무것도 없네"로
  // 오해한다. 5초 내 `onLoad`가 안 뜨면 실패 폴백으로 전환.
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => {
      setState((prev) => (prev === "loading" ? "failed" : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="space-y-2">
      {state !== "failed" ? (
        <div className="relative overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
          {state === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center text-[11.5px] text-[var(--fg-dim)]">
              배포 사이트 불러오는 중…
            </div>
          ) : null}
          <iframe
            ref={iframeRef}
            src={url}
            title="배포 미리보기"
            className="block h-[420px] w-full"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-[11.5px] leading-5 text-[var(--fg-muted)]">
          이 사이트는 RepoLens 안에서 직접 미리볼 수 없어요. 아래 링크로 새 탭에서 열어 보세요.
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
      >
        <span>라이브 사이트 열기</span>
        <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

// Map a raw deployRationale string to a short UI badge. Unknown strings fall
// back to a truncated version of the original so we never invent meaning.
function classifyRationale(rationale: string): string {
  const r = rationale.toLowerCase();
  if (/(vercel\.json|fly\.toml|render\.yaml|netlify\.toml|railway\.json|app\.yaml)/.test(r)) {
    return "배포 설정 확인됨";
  }
  if (/(readme).*(demo|live|live site|preview)/.test(r) || /demo (link|url)/.test(r)) {
    return "README demo 링크";
  }
  if (/(homepage|package\.json.*(homepage|url)|official)/.test(r)) {
    return "공식 호스팅 도메인";
  }
  if (/(docs|documentation).*(deploy|host)/.test(r)) {
    return "문서 사이트 연결";
  }
  if (/badge|shield/.test(r)) {
    return "README 배포 배지";
  }
  // Unknown: 더 긴 cap. 22 char cap이 "README에서 공식 사용 주소로 추..." 같은
  // 잘린 반쪽 문장을 만들어 사용자가 답답해했음. 36까지 허용.
  const trimmed = rationale.trim();
  if (trimmed.length <= 36) return trimmed;
  return `${trimmed.slice(0, 35)}…`;
}

function RationaleChips({ rationale }: { rationale: string[] }) {
  if (rationale.length === 0) return null;
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of rationale) {
    const label = classifyRationale(raw);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
    if (labels.length >= 3) break;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="inline-flex items-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]"
          title={rationale.join("\n")}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function PreviewBlock({ preview }: { preview: RepoLearningGuide["preview"] }) {
  if (preview.mode === "none") return null;
  if (preview.mode === "readme_images" && preview.images.length === 0) return null;
  if (preview.mode === "deploy_url" && !preview.deployUrl) return null;

  const sourceLabel =
    preview.source === "package_json"
      ? "package.json에서 읽음"
      : preview.source === "readme"
        ? "README에서 읽음"
        : preview.source === "mixed"
          ? "package.json + README 조합"
          : "";

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-[var(--fg)]">미리보기</h3>
        {sourceLabel ? (
          <span className="text-[10px] text-[var(--fg-dim)]">{sourceLabel}</span>
        ) : null}
      </div>
      <div className="mt-2">
        {preview.mode === "readme_images" ? (
          <>
            <PreviewImageGallery images={preview.images} />
            {preview.deployUrl ? (
              <div className="mt-2">
                <a
                  href={preview.deployUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                >
                  <span>라이브 사이트 열기</span>
                  <span aria-hidden>↗</span>
                </a>
                <RationaleChips rationale={preview.deployRationale} />
              </div>
            ) : null}
          </>
        ) : preview.mode === "deploy_url" && preview.deployUrl ? (
          <>
            <DeployPreview url={preview.deployUrl} />
            <RationaleChips rationale={preview.deployRationale} />
          </>
        ) : null}
      </div>
    </section>
  );
}

// ─── View ───────────────────────────────────────────────────────────────────
//
// 먼저 이해하기 탭 — "README보다 먼저 이 레포를 이해하는 화면".
//
// Identity Bar가 plainTitle / projectKind / stackNarrative / highlights /
// startFile을 이미 상단에서 모두 커버하므로, 이 탭은 Bar가 답하지 않는
// "이유와 맥락"만 채운다. 중복 라벨(이 레포는 무엇인가요 / 어떤 종류인가요)은
// Identity Bar로 넘어간 뒤 여기서는 제거한다.
//
//   1) 무엇을 하는 프로그램인가요? → identity.useCase
//   2) 누가 쓰나요?                → identity.audience
//   3) 실행하면 무엇이 나오나요?   → identity.outputType + preview
//   4) 어디부터 보면 되나요?       → identity.startHere + identity.readOrder
//   5) 기술 스택 상세              → stackGlossary (usedFor · paths · reasons)
//   6) 실행 환경                   → environment 요약 (상세는 전용 탭)

export function ResultLearningPanel({
  analysis,
  onGoEnvironment,
  onStartFileClick,
}: {
  analysis: RepoAnalysis;
  onGoEnvironment?: () => void;
  onStartFileClick?: (path: string) => void;
}) {
  const learning = analysis.learning;
  const identity = learning?.identity ?? null;

  const plainTitle = identity?.plainTitle?.trim() || null;
  const useCase = identity?.useCase?.trim() || null;
  const audience = identity?.audience?.trim() || null;
  const rawOutputType = identity?.outputType?.trim() || null;
  // 백엔드가 plainTitle과 outputType을 거의 같은 문장으로 보낼 때가 있다
  // (예: plainTitle "다른 코드에서 불러다 쓰는 라이브러리" /
  //  outputType "다른 코드에서 불러다 쓰는 패키지"). 공백/기호 제거 후 두
  //  문장의 공통 prefix가 둘 중 짧은 쪽의 70% 이상이면 outputType을 생략한다.
  const outputType = suppressIfRedundant(rawOutputType, plainTitle);
  const projectKind = identity?.projectKind?.trim() || null;
  const consumptionMode = identity?.consumptionMode ?? null;
  // consumptionMode에 따라 "실행/설치" 섹션 제목을 전환. 라이브러리면 설치, 앱이면 실행.
  const outputSectionTitle =
    consumptionMode === "import-as-library"
      ? "설치해서 어떻게 쓰나요"
      : consumptionMode === "hybrid"
        ? "설치/실행하면 어떻게 쓰나요"
        : "실행하면 무엇이 나오나요";
  // startHerePath 자체는 Identity Bar의 시작 파일 CTA가 담당한다. 학습 패널은
  // readOrder(여러 단계)만 렌더해 중복을 피한다. reason은 readOrder 섹션의
  // 보조 설명으로만 사용.
  const startHereReason = identity?.startHere?.reason?.trim() || null;
  const readOrder = (identity?.readOrder ?? [])
    // 라벨이 너무 짧거나 의미가 없는 step은 UI에서 걸러낸다. 백엔드가
    // "먼저 보기" / "보기" / "시작" 같은 무의미 한 줄을 내려줄 때가 있음.
    .filter((step) => {
      const label = step.label?.trim() ?? "";
      if (label.length === 0) return false;
      const meaninglessLabels = new Set([
        "먼저 보기",
        "보기",
        "시작",
        "열기",
        "확인",
        "읽기",
      ]);
      if (meaninglessLabels.has(label)) return false;
      // path도 reason도 없는 짧은 라벨은 빈 줄로 보이니 숨김.
      const reason = step.reason?.trim() ?? "";
      if (label.length <= 5 && !step.path && reason.length === 0) return false;
      return true;
    });
  // header.points는 이제 Identity Bar가 전담한다 (최대 2개). 여기서는
  // 중복 렌더하지 않는다.

  const previewVisible =
    (learning.preview.mode === "readme_images" &&
      learning.preview.images.length > 0) ||
    (learning.preview.mode === "deploy_url" && Boolean(learning.preview.deployUrl));
  const environmentVisible = environmentHasContent(learning.environment);

  const hasAnything =
    plainTitle ||
    useCase ||
    audience ||
    outputType ||
    projectKind ||
    readOrder.length > 0 ||
    previewVisible ||
    environmentVisible;

  if (!hasAnything) {
    const startFile = analysis.summary.recommendedStartFile ?? null;
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-[400px] rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-strong)]/40 p-5 text-center">
          <p className="text-[12.5px] font-medium text-[var(--fg)]">
            이 레포는 정리할 신호가 적어요.
          </p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--fg-muted)]">
            README/매니페스트가 짧거나 지원 스택 밖일 수 있어요. 아래 경로로 먼저 들여다 보세요.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11.5px]">
            {startFile ? (
              <button
                type="button"
                onClick={() => onStartFileClick?.(startFile)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <span className="font-mono text-[10.5px] text-[var(--fg-dim)]">대표 파일</span>
                <span className="truncate font-mono">{startFile.split("/").pop()}</span>
                <span aria-hidden className="text-[var(--fg-dim)]">→</span>
              </button>
            ) : null}
            <span className="text-[var(--fg-dim)]">구조 보기 탭에서 레이어 지도로도 살펴볼 수 있어요.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-3 px-4 py-4 lg:px-6 lg:py-5">
        {/* Trust 가드레일은 ResultWorkspace 최상단에서 한 번만 렌더된다.
            중복을 피하려고 이 탭 내부에서는 배너를 띄우지 않는다. */}

        {/* 1) 읽는 순서 — "먼저 이해하기" 탭의 주인공. Identity Bar가 시작 파일
            하나의 CTA를 제공했고, 여기선 "그 다음 무엇을 볼지"를 단계로 안내.
            startFilePath 자체를 다시 큰 버튼으로 반복하지 않는다 (중복 방지). */}
        {readOrder.length > 0 ? (
          <section className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3">
            <h3 className="text-[12px] font-semibold text-[var(--fg)]">
              읽는 순서
            </h3>
            {startHereReason ? (
              <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
                {startHereReason}
              </p>
            ) : null}
            <ol className="mt-2 space-y-2">
              {readOrder.map((step, idx) => (
                <li key={`${step.label}:${idx}`} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[10.5px] font-semibold text-[var(--fg-muted)]"
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] leading-5 text-[var(--fg)]">
                      {step.label}
                    </p>
                    {step.path ? (
                      <button
                        type="button"
                        onClick={
                          onStartFileClick && step.path
                            ? () => onStartFileClick(step.path as string)
                            : undefined
                        }
                        disabled={!onStartFileClick}
                        className={`mt-0.5 inline-block max-w-full truncate font-mono text-[10.5px] text-[var(--fg-dim)] ${
                          onStartFileClick
                            ? "hover:text-[var(--fg-muted)] hover:underline"
                            : "cursor-default"
                        }`}
                        title={step.path}
                      >
                        {step.path}
                      </button>
                    ) : null}
                    {step.reason ? (
                      <p className="mt-0.5 text-[11px] leading-5 text-[var(--fg-dim)]">
                        {step.reason}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* 2) 실행/설치하면 어떻게 쓰나요 — readOrder 다음 "결과 감"을 잡는
            보조 섹션. preview 이미지가 있으면 함께. */}
        {outputType || previewVisible ? (
          <section className="space-y-2">
            <header>
              <h3 className="text-[12px] font-semibold text-[var(--fg)]">
                {outputSectionTitle}
              </h3>
              {outputType ? (
                <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
                  {outputType}
                </p>
              ) : null}
            </header>
            {previewVisible ? <PreviewBlock preview={learning.preview} /> : null}
          </section>
        ) : null}

        {/* 3) 맥락 — useCase + audience를 Q&A 2블록 대신 한 줄 paragraph로
            통합. 짧게, "좀 더 알고 싶으면" 톤으로. */}
        {useCase || audience ? (
          <section className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
              조금 더
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--fg)]">
              {useCase ? <span>{useCase}</span> : null}
              {useCase && audience ? (
                <span className="text-[var(--fg-dim)]"> · </span>
              ) : null}
              {audience ? (
                <span>
                  <span className="text-[var(--fg-dim)]">쓰는 사람 · </span>
                  {audience}
                </span>
              ) : null}
            </p>
          </section>
        ) : null}

        {/* 4) 기술 스택 — 이 레포에서의 역할 중심 */}
        {learning.stackGlossary.length > 0 ? (
          <section>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[12px] font-semibold text-[var(--fg)]">
                기술 스택 — 이 레포에서의 역할
              </h3>
              <span className="text-[10px] text-[var(--fg-dim)]">
                코드와 README 신호로 판단
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {learning.stackGlossary.map((item) => (
                <GlossaryRow key={item.name} item={item} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* 7) 실행 환경 요약 — 상세는 전용 탭으로 */}
        {environmentVisible ? (
          <section className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-[var(--fg)]">
                  실행 환경
                </p>
                {learning.environment.summary ? (
                  <p
                    className="mt-0.5 line-clamp-1 text-[11px] text-[var(--fg-muted)]"
                    title={learning.environment.summary}
                  >
                    {learning.environment.summary}
                  </p>
                ) : null}
              </div>
              {onGoEnvironment ? (
                <button
                  type="button"
                  onClick={onGoEnvironment}
                  className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  자세히 →
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// 간단한 정규화: 띄어쓰기/기호 제거 후 비교. 거의 동일한 문장 판정 용도.
function stripped(value: string): string {
  return value.replace(/[\s·.,()/"'·]/g, "");
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    if (a[i] !== b[i]) return i;
  }
  return limit;
}

function suppressIfRedundant(
  candidate: string | null,
  reference: string | null
): string | null {
  if (!candidate) return null;
  if (!reference) return candidate;
  const a = stripped(candidate);
  const b = stripped(reference);
  if (a.length === 0 || b.length === 0) return candidate;
  const common = commonPrefixLength(a, b);
  const shortest = Math.min(a.length, b.length);
  if (shortest === 0) return candidate;
  // 70% 이상 겹치면 사실상 같은 문장 재진술 → 생략
  return common / shortest >= 0.7 ? null : candidate;
}

// ─── Stack glossary row ────────────────────────────────────────────────────
//
// "정의 목록"이 아니라 "이 기술이 이 레포에서 어떤 역할을 하는가" 중심의 행.
// 읽기 우선순위:
//   1) 기술명     — 눈에 먼저 띄어야 함
//   2) usedFor    — 이 레포에서 맡는 역할 (메인 카피)
//   3) description— "이게 뭐야"에 대한 일반 설명 (보조, 두 번째로 읽힘)
//   4) examplePaths — 근거 파일 (mono chip 최대 2개, truncate)
//   5) reasons    — "왜 감지됐지"의 약한 근거 줄 (dim, 한 줄 요약)
//
// usedFor/examplePaths가 비어 있으면 "정의형" fallback으로 자연스럽게 축소.
// 구 cache payload(두 필드 없음)에서도 깨지지 않게 전부 옵셔널 처리.
function GlossaryRow({ item }: { item: RepoStackGlossaryItem }) {
  const usedFor = item.usedFor?.trim() || null;
  const description = item.description?.trim() || null;
  const paths = (item.examplePaths ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 2);
  const reasons = (item.reasons ?? [])
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  // reasons가 여러 개면 앞 2~3개만 ·으로 이어붙여 한 줄 요약으로. 과밀 방지.
  const reasonLine = reasons.length > 0 ? reasons.slice(0, 3).join(" · ") : null;

  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">
          <StackBadge name={item.name} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 1) 기술명 */}
          <p className="text-[12.5px] font-semibold text-[var(--fg)]">
            {item.name}
          </p>

          {/* 2) usedFor — 메인 카피 */}
          {usedFor ? (
            <p className="mt-1 text-[12px] leading-5 text-[var(--fg)]">
              {usedFor}
            </p>
          ) : null}

          {/* 3) description — 일반 설명. usedFor가 없으면 이 줄이 메인 톤으로
              승격되고, 있으면 보조 dim 톤으로 남는다. */}
          {description ? (
            <p
              className={`mt-1 text-[11.5px] leading-5 ${
                usedFor ? "text-[var(--fg-dim)]" : "text-[var(--fg-muted)]"
              }`}
            >
              {description}
            </p>
          ) : null}

          {/* 4) examplePaths */}
          {paths.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {paths.map((path) => (
                <code
                  key={path}
                  title={path}
                  className="inline-block max-w-full truncate rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--fg-muted)]"
                >
                  {path}
                </code>
              ))}
            </div>
          ) : null}

          {/* 5) reasons — 감지 근거, 한 줄 dim 요약. 있을 때만. */}
          {reasonLine ? (
            <p
              className="mt-1.5 line-clamp-1 text-[10.5px] leading-5 text-[var(--fg-dim)]"
              title={reasons.join("\n")}
            >
              근거 · {reasonLine}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

