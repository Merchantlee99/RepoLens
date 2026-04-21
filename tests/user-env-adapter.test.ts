import { describe, expect, it } from "vitest";
import { toUserEnvLike } from "@/components/user-env";
import type { UserEnv } from "@/components/user-env";

describe("toUserEnvLike", () => {
  it("returns an empty-ish shape for an empty UserEnv", () => {
    const out = toUserEnvLike({});
    expect(out.hasDocker).toBeNull();
    expect(out.hasGpu).toBeNull();
    expect(out.ramGb).toBeNull();
    expect(out.diskGb).toBeNull();
    expect(out.cpuArch).toBeNull();
    expect(out.accelerators).toEqual([]);
    expect(out.services).toEqual([]);
    expect(out.deployTargets).toEqual([]);
    expect(out.runtimeMode).toBeNull();
    expect(out.budgetTier).toBeNull();
  });

  it("maps dockerLevel=0 to hasDocker=false, dockerLevel>=1 to true", () => {
    expect(toUserEnvLike({ dockerLevel: 0 }).hasDocker).toBe(false);
    expect(toUserEnvLike({ dockerLevel: 1 }).hasDocker).toBe(true);
    expect(toUserEnvLike({ dockerLevel: 2 }).hasDocker).toBe(true);
  });

  it("falls back to legacy hasDocker when dockerLevel missing", () => {
    expect(toUserEnvLike({ hasDocker: true }).hasDocker).toBe(true);
    expect(toUserEnvLike({ hasDocker: false }).hasDocker).toBe(false);
  });

  it("expands gpu.kind=nvidia into hasGpu=true + accelerators=['cuda']", () => {
    const out = toUserEnvLike({ gpu: { kind: "nvidia", vramGb: 12 } });
    expect(out.hasGpu).toBe(true);
    expect(out.vramGb).toBe(12);
    expect(out.accelerators).toEqual(["cuda"]);
  });

  it("expands apple-mps to mps accelerator", () => {
    const out = toUserEnvLike({ gpu: { kind: "apple-mps" } });
    expect(out.hasGpu).toBe(true);
    expect(out.accelerators).toEqual(["mps"]);
  });

  it("expands amd to rocm accelerator", () => {
    const out = toUserEnvLike({ gpu: { kind: "amd" } });
    expect(out.hasGpu).toBe(true);
    expect(out.accelerators).toEqual(["rocm"]);
  });

  it("treats gpu.kind=none as hasGpu=false with cpu-ok accelerator", () => {
    const out = toUserEnvLike({ gpu: { kind: "none" } });
    expect(out.hasGpu).toBe(false);
    expect(out.accelerators).toEqual(["cpu-ok"]);
  });

  it("treats igpu as hasGpu=true but no accelerators", () => {
    const out = toUserEnvLike({ gpu: { kind: "igpu" } });
    expect(out.hasGpu).toBe(true);
    expect(out.accelerators).toEqual([]);
  });

  it("treats null/undefined gpu as hasGpu=null (미입력)", () => {
    expect(toUserEnvLike({}).hasGpu).toBeNull();
    expect(toUserEnvLike({ gpu: null }).hasGpu).toBeNull();
  });

  it("translates runtimeMode 'cloud-ok' to backend 'cloud-required'", () => {
    expect(toUserEnvLike({ runtimeMode: "cloud-ok" }).runtimeMode).toBe("cloud-required");
    expect(toUserEnvLike({ runtimeMode: "local-only" }).runtimeMode).toBe("local-only");
    expect(toUserEnvLike({ runtimeMode: "local-or-cloud" }).runtimeMode).toBe("local-or-cloud");
  });

  it("merges cloudApis and legacy services with dedupe via Set order", () => {
    const env: UserEnv = {
      cloudApis: ["OpenAI", "Stripe"],
      services: ["Stripe", "Supabase"],
    };
    const out = toUserEnvLike(env);
    // merged Set preserves insertion order
    expect(out.services).toEqual(["OpenAI", "Stripe", "Supabase"]);
  });

  it("passes cpuArch + cloudDeploy + budget through unchanged", () => {
    const out = toUserEnvLike({
      cpuArch: "apple-silicon",
      cloudDeploy: ["Vercel", "AWS"],
      budget: "under_50",
    });
    expect(out.cpuArch).toBe("apple-silicon");
    expect(out.deployTargets).toEqual(["Vercel", "AWS"]);
    expect(out.budgetTier).toBe("under_50");
  });

  it("maps runtime keys flat (node/python/go/bun)", () => {
    const out = toUserEnvLike({ node: ">=20", python: "3.11", bun: "1", deno: null });
    expect(out.node).toBe(">=20");
    expect(out.python).toBe("3.11");
    expect(out.bun).toBe("1");
    expect(out.deno).toBeNull();
  });
});
