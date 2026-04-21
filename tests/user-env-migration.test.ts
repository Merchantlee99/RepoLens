import { describe, expect, it } from "vitest";
import {
  getUserCloudApis,
  getUserDockerLevel,
  userEnvIsEmpty,
  type UserEnv,
} from "@/components/user-env";

// Migration helpers are internal, but their behavior surfaces through
// getUserCloudApis / getUserDockerLevel / userEnvIsEmpty.
// We test the observable v1→v2 read shims directly here — localStorage의
// 실제 경로는 DOM 의존이라 jsdom 필요. 여기서는 shim 함수만 검증.

describe("userEnvIsEmpty", () => {
  it("returns true for empty object", () => {
    expect(userEnvIsEmpty({})).toBe(true);
  });

  it("returns false when any runtime is set", () => {
    expect(userEnvIsEmpty({ node: ">=20" })).toBe(false);
  });

  it("returns false when legacy hasDocker is boolean (even false)", () => {
    expect(userEnvIsEmpty({ hasDocker: false })).toBe(false);
    expect(userEnvIsEmpty({ hasDocker: true })).toBe(false);
  });

  it("returns false when dockerLevel is 0 (explicit 없음)", () => {
    expect(userEnvIsEmpty({ dockerLevel: 0 })).toBe(false);
  });

  it("returns false when legacy services has items", () => {
    expect(userEnvIsEmpty({ services: ["OpenAI"] })).toBe(false);
  });

  it("returns false when cloudApis has items", () => {
    expect(userEnvIsEmpty({ cloudApis: ["OpenAI"] })).toBe(false);
  });

  it("treats gpu={kind:'none'} as empty (기본값)", () => {
    expect(userEnvIsEmpty({ gpu: { kind: "none" } })).toBe(true);
  });

  it("returns false when gpu kind is a real GPU", () => {
    expect(userEnvIsEmpty({ gpu: { kind: "nvidia", vramGb: 12 } })).toBe(false);
  });

  it("returns false for any of: ramGb / diskGb / cpuArch / budget / runtimeMode", () => {
    expect(userEnvIsEmpty({ ramGb: 16 })).toBe(false);
    expect(userEnvIsEmpty({ diskGb: 200 })).toBe(false);
    expect(userEnvIsEmpty({ cpuArch: "x64" })).toBe(false);
    expect(userEnvIsEmpty({ budget: "free" })).toBe(false);
    expect(userEnvIsEmpty({ runtimeMode: "local-only" })).toBe(false);
  });
});

describe("getUserCloudApis (v1 services + v2 cloudApis merge)", () => {
  it("returns [] for empty env", () => {
    expect(getUserCloudApis({})).toEqual([]);
  });

  it("returns cloudApis only when services missing", () => {
    expect(getUserCloudApis({ cloudApis: ["OpenAI"] })).toEqual(["OpenAI"]);
  });

  it("returns legacy services only when cloudApis missing (v1 반복 호환)", () => {
    const env: UserEnv = { services: ["Supabase"] };
    expect(getUserCloudApis(env)).toEqual(["Supabase"]);
  });

  it("merges and dedupes, cloudApis 우선 순서", () => {
    const env: UserEnv = {
      cloudApis: ["OpenAI", "Stripe"],
      services: ["Stripe", "Supabase"],
    };
    expect(getUserCloudApis(env)).toEqual(["OpenAI", "Stripe", "Supabase"]);
  });
});

describe("getUserDockerLevel (v1 hasDocker → v2 dockerLevel alias)", () => {
  it("returns null when neither present", () => {
    expect(getUserDockerLevel({})).toBeNull();
  });

  it("prefers dockerLevel over legacy hasDocker", () => {
    expect(getUserDockerLevel({ dockerLevel: 2, hasDocker: false })).toBe(2);
    expect(getUserDockerLevel({ dockerLevel: 0, hasDocker: true })).toBe(0);
  });

  it("falls back to hasDocker when dockerLevel missing", () => {
    expect(getUserDockerLevel({ hasDocker: true })).toBe(1);
    expect(getUserDockerLevel({ hasDocker: false })).toBe(0);
  });
});
