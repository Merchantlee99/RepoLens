import { describe, expect, it } from "vitest";
import { buildRepoDiagramView } from "@/components/repo-diagram-view-model";
import { analyzeRepositorySnapshot } from "@/lib/analysis/analyzer";
import { buildArchitectureModel } from "@/lib/analysis/graph";
import {
  fullstackAppFixture,
  monorepoPlatformFixture,
} from "@/tests/fixtures/analyzer-fixtures";

describe("repo diagram view model", () => {
  it("builds repo, scope, and layer nodes from a monorepo analysis", () => {
    const analysis = analyzeRepositorySnapshot(monorepoPlatformFixture);
    const model = buildArchitectureModel(analysis);
    const diagram = buildRepoDiagramView(model, analysis);

    expect(diagram.nodes.find((node) => node.kind === "repo")?.targetId).toBe("repo:overview");
    expect(diagram.nodes.find((node) => node.kind === "group")).toBeFalsy();
    expect(diagram.nodes.find((node) => node.kind === "scope")?.targetId).toBe(model.focusWorkspace?.id);
    expect(diagram.nodes.find((node) => node.kind === "scope")?.badges).toContain("apps");
    expect(diagram.nodes.find((node) => node.id === "layer:UI")?.count).toBeGreaterThan(0);
    // Repo → scope는 컨테이너 포함 관계라 화살표로 그리지 않는다 (repo가 외곽
    // 컨테이너, scope는 내부에 공간적으로 중첩). 해당 edge는 명시적으로 없음.
    expect(diagram.edges.find((edge) => edge.id === "diagram:repo-scope")).toBeFalsy();
    expect(diagram.edges.find((edge) => edge.id === "diagram:scope-API")).toBeTruthy();
  });

  it("synthesizes a repo-root scope when no focus workspace exists", () => {
    const analysis = analyzeRepositorySnapshot(fullstackAppFixture);
    const model = buildArchitectureModel(analysis);
    const diagram = buildRepoDiagramView(model, analysis);

    expect(model.focusWorkspace).toBeNull();
    expect(diagram.nodes.find((node) => node.id === "repo:scope")?.targetId).toBe("repo:overview");
    // Repo → scope 화살표는 제거됨 (포함은 공간 중첩으로 표현).
    expect(diagram.edges.find((edge) => edge.id === "diagram:repo-scope")).toBeFalsy();
    expect(diagram.edges.find((edge) => edge.id === "diagram:scope-API")).toBeTruthy();
  });
});
