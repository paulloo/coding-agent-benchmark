import type { EvaluationCategory } from "./run";

export interface EvaluationDetails {
  command?: string;
  exitCode?: number | null;
  summary?: string;
  metrics?: Record<string, number>;
  notes?: string[];
  truncatedOutput?: string;
  [key: string]: unknown;
}

export interface EvaluationResult {
  checkKey: string;
  category: EvaluationCategory;
  passed: boolean;
  /** null means the check produced no meaningful numeric score. */
  score: number | null;
  details: EvaluationDetails;
  rawLogPath?: string;
  durationMs: number;
}

export interface EvaluationReport {
  agentRunId: string;
  workspacePath: string;
  startedAt: string;
  finishedAt: string;
  results: EvaluationResult[];
}

export const ARTIFACT_TYPES = [
  "STDOUT",
  "STDERR",
  "DIFF",
  "REPORT",
  "SCREENSHOT",
  "OTHER",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
