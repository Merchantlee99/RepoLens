import { describe, expect, it } from "vitest";
import { analyzeRepositorySnapshot } from "@/lib/analysis/analyzer";
import { buildArchitectureModel } from "@/lib/analysis/graph";
import {
  exampleCollectionFixture,
  toolingHarnessFixture,
} from "@/tests/fixtures/analyzer-fixtures";

describe("analysis graph focus rails", () => {
  it("does not label example collection focus roots as tooling", () => {
    const analysis = analyzeRepositorySnapshot(exampleCollectionFixture);
    const model = buildArchitectureModel(analysis);

    expect(analysis.topology.focusRoot).toBe("dashboard/final-example");
    expect(model.focusWorkspace?.groupKey).toBeNull();
    expect(model.railItems.find((item) => item.key === "tooling")?.disabled).toBe(true);
  });

  it("enables the tooling rail for development-tool repositories", () => {
    const analysis = analyzeRepositorySnapshot(toolingHarnessFixture);
    const model = buildArchitectureModel(analysis);

    expect(model.focusWorkspace?.groupKey).toBe("tooling");
    expect(model.railItems.find((item) => item.key === "tooling")?.disabled).toBe(false);
  });
});
