export const SCORE_DIMENSIONS = [
  "completion",
  "quality",
  "autonomy",
  "speed",
  "cost",
  "stability",
  "experience",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_WEIGHTS: Record<ScoreDimension, number> = {
  completion: 25,
  quality: 20,
  autonomy: 20,
  speed: 10,
  cost: 10,
  stability: 10,
  experience: 5,
};

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  completion: "任务完成度",
  quality: "代码质量",
  autonomy: "自主执行能力",
  speed: "执行速度",
  cost: "实际成本",
  stability: "稳定性",
  experience: "开发体验",
};

export interface DimensionScore {
  key: ScoreDimension;
  weight: number;
  /** null = not measured. Never substitute a default score. */
  score: number | null;
  note?: string;
}

export interface ScoreReport {
  dimensions: DimensionScore[];
  /** Weighted mean over measured dimensions, renormalized by coverage. */
  totalScore: number | null;
  /** Share of total weight that was actually measured, 0..1. */
  coverage: number;
  measuredDimensions: ScoreDimension[];
  missingDimensions: ScoreDimension[];
  scoredBy: "automatic" | "human" | "hybrid";
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Score must be finite, received ${value}`);
  }
  return Math.min(100, Math.max(0, value));
}

export function roundScore(value: number): number {
  return Math.round(clampScore(value) * 100) / 100;
}

/** Maps a value onto 0..100, where `best` scores 100 and `worst` scores 0. */
export function normalizeBetween(value: number, best: number, worst: number): number {
  if (best === worst) {
    throw new Error("normalizeBetween requires distinct best and worst values");
  }
  const ratio = (value - worst) / (best - worst);
  return roundScore(ratio * 100);
}

/** 0..1 ratio to a 0..100 score. */
export function scoreFromRatio(ratio: number): number {
  return roundScore(ratio * 100);
}

/**
 * Budget-based scoring used for speed and cost: at or below half the budget
 * earns 100, at or above twice the budget earns 0, linear in between.
 */
export function scoreAgainstBudget(value: number, budget: number): number | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(budget) || budget <= 0) {
    return null;
  }
  const ratio = value / budget;
  if (ratio <= 0.5) {
    return 100;
  }
  if (ratio >= 2) {
    return 0;
  }
  return roundScore(((2 - ratio) / 1.5) * 100);
}

export function computeScore(
  dimensions: readonly DimensionScore[],
  scoredBy: ScoreReport["scoredBy"] = "automatic",
): ScoreReport {
  if (dimensions.length === 0) {
    throw new Error("computeScore requires at least one dimension");
  }

  const seen = new Set<string>();
  for (const dimension of dimensions) {
    if (seen.has(dimension.key)) {
      throw new Error(`Duplicate score dimension: ${dimension.key}`);
    }
    seen.add(dimension.key);
    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      throw new Error(`Dimension ${dimension.key} has invalid weight: ${dimension.weight}`);
    }
    if (dimension.score !== null && !Number.isFinite(dimension.score)) {
      throw new Error(`Dimension ${dimension.key} has invalid score: ${dimension.score}`);
    }
  }

  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const measured = dimensions.filter((dimension) => dimension.score !== null);

  if (measured.length === 0) {
    return {
      dimensions: dimensions.map((dimension) => ({ ...dimension })),
      totalScore: null,
      coverage: 0,
      measuredDimensions: [],
      missingDimensions: dimensions.map((dimension) => dimension.key),
      scoredBy,
    };
  }

  const measuredWeight = measured.reduce((sum, dimension) => sum + dimension.weight, 0);
  const weighted = measured.reduce(
    (sum, dimension) => sum + clampScore(dimension.score as number) * dimension.weight,
    0,
  );

  return {
    dimensions: dimensions.map((dimension) => ({
      ...dimension,
      score: dimension.score === null ? null : roundScore(dimension.score),
    })),
    totalScore: roundScore(weighted / measuredWeight),
    coverage: Math.round((measuredWeight / totalWeight) * 10000) / 10000,
    measuredDimensions: measured.map((dimension) => dimension.key),
    missingDimensions: dimensions
      .filter((dimension) => dimension.score === null)
      .map((dimension) => dimension.key),
    scoredBy,
  };
}
