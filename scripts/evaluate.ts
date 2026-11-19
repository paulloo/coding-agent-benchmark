import "dotenv/config";
import path from "node:path";
import { createAdapter } from "@cab/adapters";
import { createPrismaClient, Prisma } from "@cab/db";
import {
  executeAgentTask,
  isGitRepository,
  removeWorkspace,
  resolveCommit,
  type AgentAdapter,
  type AgentRunResult,
} from "@cab/core";
import { runEvaluation, scoreEvaluation } from "@cab/evaluator";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function positionalRunId(): string | undefined {
  const candidate = process.argv[2];
  return candidate && !candidate.startsWith("--") ? candidate : undefined;
}

function statusFor(result: AgentRunResult): "COMPLETED" | "FAILED" | "TIMEOUT" | "CANCELLED" {
  if (result.cancelled) {
    return "CANCELLED";
  }
  if (result.timedOut) {
    return "TIMEOUT";
  }
  return result.exitCode === 0 ? "COMPLETED" : "FAILED";
}

async function main(): Promise<void> {
  const runId = argValue("--run") ?? positionalRunId();
  if (!runId) {
    console.error("用法: pnpm evaluate --run <benchmarkRunId> [--agent <slug>] [--task <key>] [--dry-run] [--cleanup]");
    process.exit(2);
  }

  const dryRun = process.argv.includes("--dry-run");
  const cleanup = process.argv.includes("--cleanup");
  const agentFilter = argValue("--agent");
  const taskFilter = argValue("--task");

  const prisma = createPrismaClient();

  try {
    const run = await prisma.benchmarkRun.findUnique({
      where: { id: runId },
      include: {
        agentRuns: {
          include: { agent: true, task: true, promptVersion: true },
          orderBy: [{ repetitionIndex: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!run) {
      throw new Error(`评测批次不存在: ${runId}`);
    }
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) {
      throw new Error(`批次已处于终态 ${run.status}，不能重复执行`);
    }
    if (run.agentRuns.length === 0) {
      throw new Error("批次没有 Agent 运行计划，请通过 POST /api/runs 重新创建");
    }

    const queue = run.agentRuns.filter(
      (agentRun) =>
        agentRun.status === "PENDING" &&
        (!agentFilter || agentRun.agent.slug === agentFilter) &&
        (!taskFilter || agentRun.task.key === taskFilter),
    );

    if (queue.length === 0) {
      throw new Error("没有匹配的待执行 Agent 运行记录");
    }

    console.log(`批次 ${run.name} (${run.id})`);
    console.log(`待执行 ${queue.length} 条记录，模式 ${run.mode}`);
    for (const item of queue) {
      console.log(
        `  - ${item.agent.slug} / ${item.task.key} / r${item.repetitionIndex} / 超时 ${item.task.timeoutSeconds}s`,
      );
    }

    if (dryRun) {
      console.log("\n--dry-run 已启用，未执行任何任务。");
      return;
    }

    const repoPath = path.resolve(process.env.CAB_DOGWALK_REPO ?? "./benchmarks/dogwalk");
    if (!(await isGitRepository(repoPath))) {
      throw new Error(
        `DogWalk 基准仓库不存在或不是 Git 仓库: ${repoPath}\n` +
          "该仓库按文档作为独立 Git 仓库维护，请先完成 Batch 3 的 DogWalk 初始化。",
      );
    }

    const workspaceRoot = path.resolve(process.env.CAB_WORKSPACE_ROOT ?? "./workspace");
    const artifactRoot = path.resolve(process.env.CAB_ARTIFACT_ROOT ?? "./artifacts");
    const defaultBaseRef = process.env.CAB_DEFAULT_BASE_REF ?? "snapshot/base";
    const costBudget = process.env.CAB_COST_BUDGET_USD
      ? Number(process.env.CAB_COST_BUDGET_USD)
      : undefined;

    const isolation = process.env.CAB_EXECUTION_ISOLATION === "container" ? "CONTAINER" : "HOST";
    if (isolation !== "CONTAINER") {
      console.warn(
        "\n[警告] 当前为 HOST 执行模式。Agent 将直接使用宿主机权限，仅限本地可信开发。" +
          "正式评测必须使用 CAB_EXECUTION_ISOLATION=container。\n",
      );
    }

    const agentEnvironment: Record<string, string> = { CI: "1" };
    if (process.env.DOGWALK_DATABASE_URL) {
      agentEnvironment.DATABASE_URL = process.env.DOGWALK_DATABASE_URL;
    } else {
      console.warn("[警告] 未设置 DOGWALK_DATABASE_URL，依赖数据库的测试可能失败。");
    }

    await prisma.benchmarkRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt: run.startedAt ?? new Date() },
    });

    const adapters = new Map<string, AgentAdapter>();
    const availability = new Map<string, string | null>();

    let processed = 0;
    for (const agentRun of queue) {
      const currentStatus = await prisma.benchmarkRun.findUnique({
        where: { id: run.id },
        select: { status: true },
      });
      if (currentStatus?.status === "CANCELLED") {
        console.log("\n批次已被取消，停止执行。");
        break;
      }

      const adapterKey = agentRun.agent.adapter;
      let adapter = adapters.get(adapterKey);
      if (!adapter) {
        adapter = createAdapter(adapterKey);
        adapters.set(adapterKey, adapter);
        const probe = await adapter.checkAvailability();
        availability.set(
          agentRun.agent.id,
          probe.available ? null : probe.error ?? "CLI 不可用",
        );
        if (probe.available && probe.version) {
          await prisma.agent.update({
            where: { id: agentRun.agent.id },
            data: { version: probe.version.slice(0, 120) },
          });
        }
        console.log(
          `\n[adapter] ${adapter.name}: ${probe.available ? `可用 (${probe.version ?? "版本未知"})` : "不可用"}`,
        );
      }

      const unavailableReason = availability.get(agentRun.agent.id);
      if (unavailableReason) {
        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status: "FAILED",
            startedAt: new Date(),
            finishedAt: new Date(),
            errorMessage: `Agent 不可用: ${unavailableReason}`,
          },
        });
        console.error(`  [skip] ${agentRun.agent.slug}: ${unavailableReason}`);
        continue;
      }

      const baseRef = agentRun.task.baseRef ?? defaultBaseRef;
      let baseCommit: string;
      try {
        baseCommit = await resolveCommit(repoPath, baseRef);
      } catch (error) {
        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMessage: `无法解析基线 ${baseRef}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        });
        continue;
      }

      const startedAt = new Date();
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "RUNNING",
          isolation,
          startedAt,
          initialCommit: baseCommit,
          workspacePath: path.join(
            workspaceRoot,
            run.id,
            agentRun.agent.slug,
            agentRun.task.key,
            `r${agentRun.repetitionIndex}`,
          ),
        },
      });

      const controller = new AbortController();
      let cancelling = false;
      const poller = setInterval(() => {
        void (async () => {
          if (cancelling) {
            return;
          }
          const latest = await prisma.benchmarkRun.findUnique({
            where: { id: run.id },
            select: { status: true },
          });
          if (latest?.status === "CANCELLED") {
            cancelling = true;
            await adapter?.cancel(agentRun.id);
            controller.abort();
          }
        })().catch(() => undefined);
      }, 5000);

      try {
        console.log(`\n[run] ${agentRun.agent.slug} / ${agentRun.task.key} / r${agentRun.repetitionIndex}`);

        const outcome = await executeAgentTask({
          agentRunId: agentRun.id,
          adapter,
          prompt: agentRun.promptVersion.content,
          repoPath,
          workspaceRoot,
          artifactRoot,
          workspaceKey: `${run.id}/${agentRun.agent.slug}/${agentRun.task.key}/r${agentRun.repetitionIndex}`,
          baseRef,
          timeoutMs: agentRun.task.timeoutSeconds * 1000,
          ...(agentRun.model ? { model: agentRun.model } : {}),
          environment: agentEnvironment,
          signal: controller.signal,
        });

        const result = outcome.result;
        const status = statusFor(result);
        const errorMessage =
          status === "FAILED"
            ? `Agent 退出码 ${result.exitCode}: ${result.stderr.slice(-2000)}`
            : status === "TIMEOUT"
              ? `超过 ${agentRun.task.timeoutSeconds}s 超时限制`
              : null;

        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status,
            finishedAt: result.finishedAt,
            durationMs: result.durationMs,
            exitCode: result.exitCode,
            inputTokens: result.tokenUsage?.inputTokens ?? null,
            outputTokens: result.tokenUsage?.outputTokens ?? null,
            cachedTokens: result.tokenUsage?.cachedTokens ?? null,
            costUsd: result.costUsd ?? null,
            finalCommit: outcome.finalCommit,
            stdoutPath: outcome.artifacts.find((artifact) => artifact.type === "STDOUT")?.path ?? null,
            stderrPath: outcome.artifacts.find((artifact) => artifact.type === "STDERR")?.path ?? null,
            diffPath: outcome.diffPath,
            errorMessage,
          },
        });

        await prisma.benchmarkArtifact.deleteMany({ where: { agentRunId: agentRun.id } });
        await prisma.benchmarkArtifact.createMany({
          data: outcome.artifacts.map((artifact) => ({
            agentRunId: agentRun.id,
            type: artifact.type,
            path: artifact.path,
            checksum: artifact.checksum,
            size: artifact.size,
          })),
        });

        console.log(
          `  [done] ${status} · ${outcome.diffStats.filesChanged} 文件变更 · ${(
            result.durationMs / 1000
          ).toFixed(1)}s`,
        );

        const checkKeys = agentRun.task.requiredChecks;
        if (checkKeys.length > 0 && status !== "CANCELLED") {
          const artifactDir = path.join(artifactRoot, agentRun.id);
          const report = await runEvaluation({
            agentRunId: agentRun.id,
            workspacePath: outcome.workspace.path,
            artifactDir,
            checkKeys,
            diffPath: outcome.diffPath,
            environment: agentEnvironment,
          });

          await prisma.evaluationResult.deleteMany({ where: { agentRunId: agentRun.id } });
          await prisma.evaluationResult.createMany({
            data: report.results.map((evaluation) => ({
              agentRunId: agentRun.id,
              checkKey: evaluation.checkKey,
              category: evaluation.category,
              passed: evaluation.passed,
              score: evaluation.score,
              details: evaluation.details as Prisma.InputJsonValue,
              rawLogPath: evaluation.rawLogPath ?? null,
              durationMs: evaluation.durationMs,
            })),
          });

          const score = scoreEvaluation({
            results: report.results,
            requiredCheckKeys: checkKeys,
            durationMs: result.durationMs,
            speedBudgetMs: agentRun.task.timeoutSeconds * 1000,
            costUsd: result.costUsd,
            costBudgetUsd: costBudget,
          });

          const dimension = (key: (typeof score.dimensions)[number]["key"]) =>
            score.dimensions.find((entry) => entry.key === key)?.score ?? null;

          const scoreData = {
            completionScore: dimension("completion"),
            qualityScore: dimension("quality"),
            autonomyScore: dimension("autonomy"),
            speedScore: dimension("speed"),
            costScore: dimension("cost"),
            stabilityScore: dimension("stability"),
            experienceScore: dimension("experience"),
            totalScore: score.totalScore,
            coverage: score.coverage,
            measuredDimensions: score.measuredDimensions,
            missingDimensions: score.missingDimensions,
            scoredBy: score.scoredBy,
          };

          await prisma.benchmarkScore.upsert({
            where: { agentRunId: agentRun.id },
            create: { agentRunId: agentRun.id, ...scoreData },
            update: scoreData,
          });

          console.log(
            `  [score] 总分 ${score.totalScore ?? "数据缺失"} · 覆盖率 ${(
              score.coverage * 100
            ).toFixed(0)}%`,
          );
        }

        if (cleanup) {
          await removeWorkspace(outcome.workspace);
        }
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  [error] ${message}`);
        await prisma.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status: controller.signal.aborted ? "CANCELLED" : "FAILED",
            finishedAt: new Date(),
            errorMessage: message.slice(0, 4000),
          },
        });
      } finally {
        clearInterval(poller);
      }
    }

    const [remaining, failed, total, latestRun] = await Promise.all([
      prisma.agentRun.count({
        where: { benchmarkRunId: run.id, status: { in: ["PENDING", "RUNNING"] } },
      }),
      prisma.agentRun.count({
        where: { benchmarkRunId: run.id, status: { in: ["FAILED", "TIMEOUT"] } },
      }),
      prisma.agentRun.count({ where: { benchmarkRunId: run.id } }),
      prisma.benchmarkRun.findUnique({ where: { id: run.id }, select: { status: true } }),
    ]);

    const finalStatus =
      latestRun?.status === "CANCELLED"
        ? "CANCELLED"
        : remaining > 0
          ? "RUNNING"
          : failed === total && total > 0
            ? "FAILED"
            : "COMPLETED";

    await prisma.benchmarkRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        finishedAt: finalStatus === "RUNNING" ? null : new Date(),
      },
    });

    console.log(`\n批次状态: ${finalStatus} · 本次处理 ${processed} 条记录`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\n评测执行失败:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
