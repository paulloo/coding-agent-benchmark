import type { PrismaClient } from "@cab/db";
import { buildExecutionPlan } from "@cab/core";
import { HttpError } from "./http";

export interface CreateRunInput {
  name: string;
  mode: "NATIVE" | "CONTROLLED";
  taskKeys?: string[];
  agentSlugs?: string[];
  repetitions: number;
}

/**
 * Creates the control-plane record and the full execution matrix. No agent is
 * invoked here: the runner picks up PENDING agent runs so the API can return
 * immediately and the request never owns a long-lived process.
 */
export async function createBenchmarkRun(prisma: PrismaClient, input: CreateRunInput) {
  const tasks = await prisma.benchmarkTask.findMany({
    where: {
      enabled: true,
      ...(input.taskKeys ? { key: { in: input.taskKeys } } : {}),
    },
    include: { promptVersion: true },
  });

  const agents = await prisma.agent.findMany({
    where: {
      enabled: true,
      ...(input.agentSlugs ? { slug: { in: input.agentSlugs } } : {}),
    },
  });

  if (tasks.length === 0) {
    throw new HttpError(400, "没有匹配的启用任务，无法创建评测批次");
  }
  if (agents.length === 0) {
    throw new HttpError(400, "没有匹配的启用 Agent，无法创建评测批次");
  }

  const missingTaskKeys = (input.taskKeys ?? []).filter(
    (key) => !tasks.some((task) => task.key === key),
  );
  const missingAgents = (input.agentSlugs ?? []).filter(
    (slug) => !agents.some((agent) => agent.slug === slug),
  );
  if (missingTaskKeys.length > 0 || missingAgents.length > 0) {
    throw new HttpError(400, "部分任务或 Agent 不存在或已停用", {
      unknownTasks: missingTaskKeys,
      unknownAgents: missingAgents,
    });
  }

  const defaultBaseRef = process.env.CAB_DEFAULT_BASE_REF ?? "snapshot/base";
  const isolation = process.env.CAB_EXECUTION_ISOLATION === "container" ? "CONTAINER" : "HOST";

  return prisma.$transaction(async (transaction) => {
    const run = await transaction.benchmarkRun.create({
      data: {
        name: input.name,
        status: "QUEUED",
        mode: input.mode,
        configuration: {
          repetitions: input.repetitions,
          taskKeys: tasks.map((task) => task.key),
          agentSlugs: agents.map((agent) => agent.slug),
          defaultBaseRef,
          isolation,
        },
      },
    });

    const plan = buildExecutionPlan({
      tasks: tasks.map((task) => ({
        key: task.key,
        name: task.name,
        category: task.category,
        timeoutSeconds: task.timeoutSeconds,
        weight: task.weight,
        baseRef: task.baseRef,
        prompt: {
          slug: task.promptVersion.promptId,
          version: task.promptVersion.version,
          content: task.promptVersion.content,
        },
      })),
      agentSlugs: agents.map((agent) => agent.slug),
      defaultBaseRef,
      repetitions: input.repetitions,
      runId: run.id,
    });

    await transaction.agentRun.createMany({
      data: plan.map((execution) => {
        const task = tasks.find((candidate) => candidate.key === execution.taskKey);
        const agent = agents.find((candidate) => candidate.slug === execution.agentSlug);
        if (!task || !agent) {
          throw new HttpError(500, "执行计划与数据库记录不一致");
        }
        return {
          benchmarkRunId: run.id,
          agentId: agent.id,
          taskId: task.id,
          promptVersionId: task.promptVersionId,
          repetitionIndex: execution.repetitionIndex,
          status: "PENDING" as const,
          isolation,
        };
      }),
    });

    return transaction.benchmarkRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { _count: { select: { agentRuns: true } } },
    });
  });
}
