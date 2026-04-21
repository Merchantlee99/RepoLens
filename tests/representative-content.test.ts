import { describe, expect, it } from "vitest";
import { pickRepresentativeContentPaths } from "@/lib/analysis/analyzer";
import { ANALYSIS_LIMITS } from "@/lib/analysis/constants";
import { filterAnalyzablePaths } from "@/lib/analysis/heuristics";
import {
  solutionExampleCollectionFixture,
  toolingHarnessFixture,
} from "@/tests/fixtures/analyzer-fixtures";

describe("pickRepresentativeContentPaths", () => {
  it("prefers focus-root files over starter examples in tutorial repositories", () => {
    const paths = filterAnalyzablePaths(solutionExampleCollectionFixture.allPaths);
    const selected = pickRepresentativeContentPaths({
      paths,
      focusRoot: "workshop/solution",
      analysisMode: "full",
      seededPaths: ["package.json", "README.md"],
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        "README.md",
        "package.json",
        "workshop/solution/app/page.tsx",
        "workshop/solution/app/layout.tsx",
        "workshop/solution/app/api/hello/route.ts",
        "workshop/solution/tsconfig.json",
      ])
    );
    expect(selected).not.toContain("workshop/starter/app/page.tsx");
    expect(selected.length).toBeLessThanOrEqual(
      ANALYSIS_LIMITS.maxRepresentativeContentFilesInFullMode
    );
  });

  it("includes operating docs, scripts, and templates for tooling repositories", () => {
    const paths = filterAnalyzablePaths(toolingHarnessFixture.allPaths);
    const selected = pickRepresentativeContentPaths({
      paths,
      focusRoot: "vb-pack-codex-harness",
      analysisMode: "full",
      seededPaths: ["README.md"],
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        "README.md",
        "vb-pack-codex-harness/README.md",
        "vb-pack-codex-harness/AGENTS.md",
        "vb-pack-codex-harness/scripts/harness/bootstrap.py",
        "vb-pack-codex-harness/templates/Prompt.md",
      ])
    );
  });

  it("skips oversized files before content fetch selection", () => {
    const selected = pickRepresentativeContentPaths({
      paths: [
        "README.md",
        "package.json",
        "app/page.tsx",
        "app/layout.tsx",
        "app/heavy-client.tsx",
      ],
      focusRoot: "app",
      analysisMode: "full",
      fileSizes: new Map([
        ["README.md", 1200],
        ["package.json", 600],
        ["app/page.tsx", 2400],
        ["app/layout.tsx", 1800],
        ["app/heavy-client.tsx", ANALYSIS_LIMITS.maxRepresentativeContentFileBytes + 1],
      ]),
      seededPaths: ["package.json", "README.md"],
    });

    expect(selected).toEqual(
      expect.arrayContaining(["README.md", "package.json", "app/page.tsx", "app/layout.tsx"])
    );
    expect(selected).not.toContain("app/heavy-client.tsx");
  });
});
