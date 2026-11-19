export const TASK_CATEGORIES = [
  "UNDERSTANDING",
  "FEATURE_DEVELOPMENT",
  "DEBUGGING",
  "UI",
  "CODE_REVIEW",
  "DELIVERY",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const BENCHMARK_MODES = ["NATIVE", "CONTROLLED"] as const;
export type BenchmarkMode = (typeof BENCHMARK_MODES)[number];

export const BENCHMARK_RUN_STATUSES = [
  "DRAFT",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type BenchmarkRunStatus = (typeof BENCHMARK_RUN_STATUSES)[number];

export const AGENT_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
  "SKIPPED",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const ISOLATION_MODES = ["CONTAINER", "HOST"] as const;
export type IsolationMode = (typeof ISOLATION_MODES)[number];

export const EVALUATION_CATEGORIES = ["BUILD", "TEST", "SECURITY", "QUALITY", "DIFF"] as const;
export type EvaluationCategory = (typeof EVALUATION_CATEGORIES)[number];

export interface BenchmarkTaskDefinition {
  key: string;
  name: string;
  category: TaskCategory;
  timeoutSeconds: number;
  weight: number;
  baseRef: string | null;
  prompt: {
    slug: string;
    version: number;
    content: string;
  };
}

export interface PlannedExecution {
  taskKey: string;
  agentSlug: string;
  repetitionIndex: number;
  workspaceKey: string;
  baseRef: string;
  timeoutMs: number;
}

/**
 * Produces the full execution matrix before anything runs. Runs are always
 * identified by task, agent and repetition so repeated experiments never
 * overwrite each other.
 */
export function buildExecutionPlan(input: {
  tasks: readonly BenchmarkTaskDefinition[];
  agentSlugs: readonly string[];
  defaultBaseRef: string;
  repetitions: number;
  runId: string;
}): PlannedExecution[] {
  if (input.repetitions < 1) {
    throw new Error("repetitions must be at least 1");
  }
  if (input.tasks.length === 0) {
    throw new Error("execution plan requires at least one task");
  }
  if (input.agentSlugs.length === 0) {
    throw new Error("execution plan requires at least one agent");
  }

  const plan: PlannedExecution[] = [];
  for (const task of input.tasks) {
    for (const agentSlug of input.agentSlugs) {
      for (let repetitionIndex = 0; repetitionIndex < input.repetitions; repetitionIndex += 1) {
        plan.push({
          taskKey: task.key,
          agentSlug,
          repetitionIndex,
          workspaceKey: `${input.runId}/${agentSlug}/${task.key}/r${repetitionIndex}`,
          baseRef: task.baseRef ?? input.defaultBaseRef,
          timeoutMs: task.timeoutSeconds * 1000,
        });
      }
    }
  }
  return plan;
}
