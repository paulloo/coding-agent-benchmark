import type { PrismaClient } from "@cab/db";
import { SCORE_DIMENSIONS, type ScoreDimension } from "@cab/core";

type ScoreField =
  | "completionScore"
  | "qualityScore"
  | "autonomyScore"
  | "speedScore"
  | "costScore"
  | "stabilityScore"
  | "experienceScore";

const DIMENSION_FIELDS: Record<ScoreDimension, ScoreField> = {
  completion: "completionScore",
  quality: "qualityScore",
  autonomy: "autonomyScore",
  speed: "speedScore",
  cost: "costScore",
  stability: "stabilityScore",
  experience: "experienceScore",
};

interface ScoreRow {
  totalScore: unknown;
  coverage: unknown;
  completionScore: unknown;
  qualityScore: unknown;
  autonomyScore: unknown;
  speedScore: unknown;
  costScore: unknown;
  stabilityScore: unknown;
  experienceScore: unknown;
  agentRun: {
    agentId: string;
    agent: { name: string; vendor: string };
  };
}

export interface LeaderboardEntry {
  agentId: string;
  name: string;
  vendor: string;
  runCount: number;
  measuredRunCount: number;
  totalScore: number | null;
  coverage: number | null;
  dimensions: Record<ScoreDimension, number | null>;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

/**
 * Averages only measured values. An agent with no trustworthy cost data gets
 * a null cost dimension rather than a zero, and the coverage column shows how
 * much of the score is actually backed by measurements.
 */
export async function buildLeaderboard(prisma: PrismaClient): Promise<LeaderboardEntry[]> {
  const scores = (await prisma.benchmarkScore.findMany({
    include: { agentRun: { include: { agent: true } } },
    orderBy: { createdAt: "desc" },
  })) as unknown as ScoreRow[];

  const grouped = new Map<string, { name: string; vendor: string; scores: ScoreRow[] }>();
  for (const score of scores) {
    const agent = score.agentRun.agent;
    const existing = grouped.get(score.agentRun.agentId);
    if (existing) {
      existing.scores.push(score);
    } else {
      grouped.set(score.agentRun.agentId, {
        name: agent.name,
        vendor: agent.vendor,
        scores: [score],
      });
    }
  }

  const entries: LeaderboardEntry[] = [];
  for (const [agentId, group] of grouped) {
    const totals = group.scores
      .map((score) => Number(score.totalScore))
      .filter((value) => Number.isFinite(value));
    const coverages = group.scores
      .map((score) => Number(score.coverage))
      .filter((value) => Number.isFinite(value));

    const dimensions = Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => {
        const field = DIMENSION_FIELDS[dimension];
        const values = group.scores
          .map((score) => Number(score[field]))
          .filter((value) => Number.isFinite(value));
        return [dimension, average(values)];
      }),
    ) as Record<ScoreDimension, number | null>;

    entries.push({
      agentId,
      name: group.name,
      vendor: group.vendor,
      runCount: group.scores.length,
      measuredRunCount: totals.length,
      totalScore: average(totals),
      coverage: average(coverages),
      dimensions,
    });
  }

  return entries.sort((left, right) => {
    if (left.totalScore === null && right.totalScore === null) {
      return left.name.localeCompare(right.name);
    }
    if (left.totalScore === null) {
      return 1;
    }
    if (right.totalScore === null) {
      return -1;
    }
    return right.totalScore - left.totalScore;
  });
}
