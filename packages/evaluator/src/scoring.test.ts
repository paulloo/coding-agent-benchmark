import { describe, expect, it } from "vitest";
import type { EvaluationResult } from "@cab/core";
import { scoreEvaluation } from "./scoring";

function result(checkKey: string, passed: boolean, timedOut = false): EvaluationResult {
  return {
    checkKey,
    category: "TEST",
    passed,
    score: passed ? 100 : 0,
    details: { timedOut },
    durationMs: 1000,
  };
}

describe("scoreEvaluation", () => {
  it("separates required acceptance checks from quality checks", () => {
    const report = scoreEvaluation({
      results: [
        result("typecheck", true),
        result("unit", true),
        result("build", false),
        result("lint", true),
      ],
      requiredCheckKeys: ["typecheck", "unit", "build"],
    });

    expect(report.dimensions.find((dimension) => dimension.key === "completion")?.score).toBe(66.67);
    expect(report.dimensions.find((dimension) => dimension.key === "quality")?.score).toBe(100);
  });

  it("leaves unmeasured dimensions null instead of inventing values", () => {
    const report = scoreEvaluation({
      results: [result("unit", true)],
      requiredCheckKeys: ["unit"],
    });

    expect(report.dimensions.find((dimension) => dimension.key === "cost")?.score).toBeNull();
    expect(report.dimensions.find((dimension) => dimension.key === "autonomy")?.score).toBeNull();
    expect(report.dimensions.find((dimension) => dimension.key === "experience")?.score).toBeNull();
    expect(report.missingDimensions).toContain("cost");
    expect(report.coverage).toBeLessThan(1);
  });

  it("renormalizes the total across measured dimensions only", () => {
    const report = scoreEvaluation({
      results: [
        result("typecheck", true),
        result("unit", true),
        result("build", true),
      ],
      requiredCheckKeys: ["typecheck", "unit", "build"],
      durationMs: 60_000,
      speedBudgetMs: 600_000,
      costUsd: 1.5,
      costBudgetUsd: 2,
      interventionCount: 0,
    });

    expect(report.dimensions.find((dimension) => dimension.key === "speed")?.score).toBe(100);
    expect(report.dimensions.find((dimension) => dimension.key === "autonomy")?.score).toBe(100);
    expect(report.totalScore).not.toBeNull();
    expect(report.coverage).toBe(0.75);
  });

  it("counts timeouts as reduced stability", () => {
    const report = scoreEvaluation({
      results: [result("unit", false, true), result("build", true)],
      requiredCheckKeys: ["unit", "build"],
    });
    expect(report.dimensions.find((dimension) => dimension.key === "stability")?.score).toBe(50);
  });

  it("returns a null total when nothing was measured", () => {
    const report = scoreEvaluation({ results: [], requiredCheckKeys: [] });
    expect(report.totalScore).toBeNull();
    expect(report.coverage).toBe(0);
  });
});
