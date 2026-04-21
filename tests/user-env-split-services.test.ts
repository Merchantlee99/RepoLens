import { describe, expect, it } from "vitest";
import { splitServices, serviceKindIcon, serviceKindLabel } from "@/components/user-env";
import type { RepoEnvCloud } from "@/lib/analysis/types";

function mkCloud(partial: Partial<RepoEnvCloud>): RepoEnvCloud {
  return {
    deployTargets: [],
    servicesRequired: [],
    servicesOptional: [],
    source: "none",
    ...partial,
  };
}

describe("splitServices", () => {
  it("returns empty split for null/empty cloud", () => {
    expect(splitServices(null)).toEqual({
      apiRequired: [],
      apiOptional: [],
      infraRequired: [],
      infraOptional: [],
    });
    expect(splitServices(undefined)).toEqual({
      apiRequired: [],
      apiOptional: [],
      infraRequired: [],
      infraOptional: [],
    });
  });

  it("uses servicesRequiredDetails when present and categorizes by kind", () => {
    const cloud = mkCloud({
      servicesRequiredDetails: [
        { label: "OpenAI", canonicalId: "openai", kind: "ai" },
        { label: "Upstash Redis", canonicalId: "redis", kind: "database" },
        { label: "Stripe", canonicalId: "stripe", kind: "payment" },
        { label: "Postgres", canonicalId: "postgres", kind: "database" },
      ],
    });
    const out = splitServices(cloud);
    expect(out.apiRequired.map((s) => s.canonicalId)).toEqual(["openai", "stripe"]);
    expect(out.infraRequired.map((s) => s.canonicalId)).toEqual(["redis", "postgres"]);
  });

  it("splits optional services similarly", () => {
    const cloud = mkCloud({
      servicesOptionalDetails: [
        { label: "Anthropic", canonicalId: "anthropic", kind: "ai" },
        { label: "MySQL", canonicalId: "mysql", kind: "database" },
      ],
    });
    const out = splitServices(cloud);
    expect(out.apiOptional.map((s) => s.canonicalId)).toEqual(["anthropic"]);
    expect(out.infraOptional.map((s) => s.canonicalId)).toEqual(["mysql"]);
  });

  it("forces API category when label appears in apiServicesRequired even if kind is 'other'", () => {
    const cloud = mkCloud({
      apiServicesRequired: ["SendGrid"],
      servicesRequiredDetails: [
        { label: "SendGrid", canonicalId: "sendgrid", kind: "other" },
      ],
    });
    const out = splitServices(cloud);
    expect(out.apiRequired.map((s) => s.label)).toEqual(["SendGrid"]);
    expect(out.infraRequired).toEqual([]);
  });

  it("synthesizes details from flat arrays when servicesRequiredDetails missing", () => {
    const cloud = mkCloud({
      servicesRequired: ["Supabase", "Postgres"],
      apiServicesRequired: ["Supabase"],
    });
    const out = splitServices(cloud);
    // apiHint is set to "ai" for synthesized api-marked services
    expect(out.apiRequired.map((s) => s.label)).toEqual(["Supabase"]);
    expect(out.infraRequired.map((s) => s.label)).toEqual(["Postgres"]);
  });

  it("defaults synthesized services to infra when no apiHint", () => {
    const cloud = mkCloud({
      servicesRequired: ["Postgres", "Redis"],
    });
    const out = splitServices(cloud);
    // kind 'other' → infra category
    expect(out.apiRequired).toEqual([]);
    expect(out.infraRequired.map((s) => s.label)).toEqual(["Postgres", "Redis"]);
  });
});

describe("serviceKindIcon / serviceKindLabel", () => {
  it("returns distinct icons for each kind", () => {
    const icons = ["ai", "database", "auth", "payment", "email", "queue", "infra", "other"].map(
      (k) => serviceKindIcon(k as never)
    );
    const unique = new Set(icons);
    // 'other' uses fallback '·' which could equal others — at minimum we want
    // ai/db/auth/payment/email/queue/infra all distinct.
    const primary = new Set([
      serviceKindIcon("ai"),
      serviceKindIcon("database"),
      serviceKindIcon("auth"),
      serviceKindIcon("payment"),
      serviceKindIcon("email"),
      serviceKindIcon("queue"),
      serviceKindIcon("infra"),
    ]);
    expect(primary.size).toBe(7);
    expect(unique.size).toBeGreaterThanOrEqual(7);
  });

  it("returns Korean-friendly labels", () => {
    expect(serviceKindLabel("ai")).toBe("AI");
    expect(serviceKindLabel("database")).toBe("DB");
    expect(serviceKindLabel("infra")).toBe("Infra");
    expect(serviceKindLabel("other")).toBe("기타");
  });
});
