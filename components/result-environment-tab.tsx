"use client";

import { EnvCompatHero } from "@/components/env-compat-hero";
import { EnvCostBlock } from "@/components/env-cost-block";
import { EnvDeployBlock } from "@/components/env-deploy-block";
import { EnvHardwareBlock } from "@/components/env-hardware-block";
import { EnvironmentBlock } from "@/components/result-learning-panel";
import type { CompatResult, UserEnv } from "@/components/user-env";
import type { RepoAnalysis } from "@/lib/analysis/types";

// 실행 환경 탭 — 이 화면이 "내 환경에서 돌릴 수 있나?"에 답하는 주 무대.
// 상단에 대형 호환 판정 Hero(EnvCompatHero), 그 아래에 항목별 상세 블록이
// 각자 "내 환경 vs 레포 요구" 비교를 자체 포함.
export function ResultEnvironmentTab({
  analysis,
  userEnv,
  compat,
  envAnalyzable,
  onOpenEnvSettings,
}: {
  analysis: RepoAnalysis;
  userEnv: UserEnv;
  compat: CompatResult | null;
  envAnalyzable: boolean;
  onOpenEnvSettings: () => void;
}) {
  const env = analysis.learning?.environment;
  const hasContent =
    env &&
    (env.runtimes.length > 0 ||
      env.container.hasDockerfile ||
      env.container.hasDockerCompose ||
      env.hardware.gpuRequired ||
      env.hardware.gpuHint !== null ||
      env.hardware.minRamGb !== null ||
      env.hardware.recommendedRamGb !== null ||
      env.hardware.minDiskGb !== null ||
      env.hardware.minVramGb != null ||
      env.hardware.cpuArch != null ||
      env.cloud.deployTargets.length > 0 ||
      env.cloud.servicesRequired.length > 0 ||
      !!env.runtimeMode ||
      !!env.costEstimate);

  if (!env || !hasContent) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="max-w-[360px] text-center text-[12px] leading-6 text-[var(--fg-muted)]">
          이 레포에서 실행 환경으로 판단할 만한 신호를 찾지 못했습니다.
          README 또는 매니페스트가 비어 있거나, 표준 경로 밖에 있습니다.
        </p>
      </div>
    );
  }

  const hw = env.hardware;
  const hasHardwareDetail =
    hw.minRamGb != null ||
    hw.recommendedRamGb != null ||
    hw.minDiskGb != null ||
    hw.gpuRequired ||
    hw.minVramGb != null ||
    (hw.cpuArch && hw.cpuArch !== "any") ||
    (hw.notes?.length ?? 0) > 0;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-3 px-4 py-4 lg:px-6 lg:py-5">
        {/* Trust 가드레일은 ResultWorkspace 최상단에서 한 번만 렌더된다. */}
        {/* Hero — 탭 진입 시 가장 먼저 눈에 들어오는 "판정" 결과 */}
        <EnvCompatHero
          userEnv={userEnv}
          compat={compat}
          envAnalyzable={envAnalyzable}
          onOpenSettings={onOpenEnvSettings}
        />

        <EnvironmentBlock environment={env} />
        {hasHardwareDetail ? (
          <EnvHardwareBlock hardware={hw} userEnv={userEnv} compat={compat} />
        ) : null}
        {env.costEstimate ? (
          <EnvCostBlock cost={env.costEstimate} userEnv={userEnv} compat={compat} />
        ) : null}
        <EnvDeployBlock
          cloud={env.cloud}
          runtimeMode={env.runtimeMode}
          userEnv={userEnv}
        />
      </div>
    </div>
  );
}
