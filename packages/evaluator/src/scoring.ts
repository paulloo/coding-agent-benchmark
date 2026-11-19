import {
  computeScore,
  scoreAgainstBudget,
  scoreFromRatio,
  type DimensionScore,
  type EvaluationResult,
  type ScoreReport,
} from "@cab/core";

export interface ScoreEvaluationInput {
  results: readonly EvaluationResult[];
  requiredCheckKeys: readonly string[];
  /** Wall-clock duration of the agent execution. */
  durationMs?: number;
  speedBudgetMs?: number;
  costUsd?: number;
  costBudgetUsd?: number;
  /** Number of human interventions. Undefined means "not tracked". */
  interventionCount?: number;
  /** Human experience rating 0..100. Undefined means "not reviewed". */
  experienceRating?: number;
}

function passRatio(results: readonly EvaluationResult[]): number | null {
  if (results.length === 0) {
    return null;
  }
  const passed = results.filter((result) => result.passed).length;
  return scoreFromRatio(passed / results.length);
}

/**
 * Maps automated evaluation output onto the seven scoring dimensions.
 * Dimensions without trustworthy data are reported as null so the score
 * report can show "unavailable" instead of an invented number.
 */
export function scoreEvaluation(input: ScoreEvaluationInput): ScoreReport {
  const required = new Set(input.requiredCheckKeys);
  const completionResults = input.results.filter((result) => required.has(result.checkKey));
  const qualityResults = input.results.filter((result) => !required.has(result.checkKey));

  const timeoutCount = input.results.filter((result) => result.details.timedOut === true).length;

  const dimensions: DimensionScore[] = [
    {
      key: "completion",
      weight: 25,
      score: passRatio(completionResults),
      note: required.size === 0 ? "该任务没有自动验收项，需要人工评审" : undefined,
    },
    {
      key: "quality",
      weight: 20,
      score: passRatio(qualityResults),
      note: qualityResults.length === 0 ? "没有额外的质量检查结果" : undefined,
    },
    {
      key: "autonomy",
      weight: 20,
      score:
        input.interventionCount === undefined
          ? null
          : scoreFromRatio(Math.max(0, 1 - input.interventionCount / 5)),
      note: input.interventionCount === undefined ? "人工干预次数未记录" : undefined,
    },
    {
      key: "speed",
      weight: 10,
      score:
        input.durationMs === undefined || input.speedBudgetMs === undefined
          ? null
          : scoreAgainstBudget(input.durationMs, input.speedBudgetMs),
      note:
        input.durationMs === undefined || input.speedBudgetMs === undefined
          ? "缺少耗时或时间预算"
          : undefined,
    },
    {
      key: "cost",
      weight: 10,
      score:
        input.costUsd === undefined || input.costBudgetUsd === undefined
          ? null
          : scoreAgainstBudget(input.costUsd, input.costBudgetUsd),
      note:
        input.costUsd === undefined || input.costBudgetUsd === undefined
          ? "该 Agent 未提供可信的成本数据"
          : undefined,
    },
    {
      key: "stability",
      weight: 10,
      score:
        input.results.length === 0
          ? null
          : scoreFromRatio(Math.max(0, 1 - timeoutCount / input.results.length)),
      note: "单次运行的基础设施稳定性；跨次波动需按重复实验汇总",
    },
    {
      key: "experience",
      weight: 5,
      score: input.experienceRating ?? null,
      note: input.experienceRating === undefined ? "尚未进行人工体验评分" : undefined,
    },
  ];

  return computeScore(dimensions, "automatic");
}
