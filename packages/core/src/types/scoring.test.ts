import { describe, expect, it } from "vitest";
import {
  clampScore,
  computeScore,
  normalizeBetween,
  scoreAgainstBudget,
  scoreFromRatio,
  type DimensionScore,
} from "./scoring";

function dimension(key: DimensionScore["key"], score: number | null, weight = 10): DimensionScore {
  return { key, weight, score };
}

describe("score primitives", () => {
  it("clamps to the 0..100 range", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(105)).toBe(100);
    expect(() => clampScore(Number.NaN)).toThrow();
  });

  it("normalizes between a best and worst value", () => {
    expect(normalizeBetween(10, 10, 20)).toBe(100);
    expect(normalizeBetween(20, 10, 20)).toBe(0);
    expect(normalizeBetween(15, 10, 20)).toBe(50);
  });

  it("scores a 0..1 ratio", () => {
    expect(scoreFromRatio(0.333)).toBe(33.3);
  });

  it("uses a budget window for speed and cost", () => {
    expect(scoreAgainstBudget(50, 100)).toBe(100);
    expect(scoreAgainstBudget(100, 100)).toBe(66.67);
    expect(scoreAgainstBudget(200, 100)).toBe(0);
    expect(scoreAgainstBudget(-1, 100)).toBeNull();
    expect(scoreAgainstBudget(10, 0)).toBeNull();
  });
});

describe("computeScore", () => {
  it("returns a weighted mean when everything is measured", () => {
    const report = computeScore([
      dimension("completion", 100, 50),
      dimension("quality", 50, 50),
    ]);
    expect(report.totalScore).toBe(75);
    expect(report.coverage).toBe(1);
    expect(report.missingDimensions).toEqual([]);
  });

  it("renormalizes across measured dimensions and reports coverage", () => {
    const report = computeScore([
      dimension("completion", 80, 25),
      dimension("quality", null, 20),
      dimension("autonomy", 100, 20),
    ]);
    expect(report.totalScore).toBe(88.89);
    expect(report.coverage).toBe(0.6923);
    expect(report.missingDimensions).toEqual(["quality"]);
  });

  it("never invents a total when nothing was measured", () => {
    const report = computeScore([dimension("completion", null), dimension("cost", null)]);
    expect(report.totalScore).toBeNull();
    expect(report.coverage).toBe(0);
    expect(report.measuredDimensions).toEqual([]);
  });

  it("rejects duplicate dimensions and invalid weights", () => {
    expect(() =>
      computeScore([dimension("completion", 80), dimension("completion", 90)]),
    ).toThrow(/Duplicate/);
    expect(() => computeScore([dimension("quality", 80, 0)])).toThrow(/weight/);
  });
});
