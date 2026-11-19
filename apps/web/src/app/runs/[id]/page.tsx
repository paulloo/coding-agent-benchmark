import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { formatCost, formatDateTime, formatDuration, formatScore, formatTokens } from "@/lib/format";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let run: Awaited<ReturnType<typeof loadRun>>;
  try {
    run = await loadRun(id);
  } catch (error) {
    return (
      <>
        <PageHeader title="批次详情" />
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">无法读取批次</p>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-soft">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </Card>
      </>
    );
  }

  if (!run) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={run.name}
        description={`状态 ${run.status} · 模式 ${run.mode} · 初始 Commit ${
          run.initialCommit?.slice(0, 12) ?? "未固定"
        }`}
        actions={
          <Link
            className="rounded-xl bg-card px-3 py-2 text-sm text-ink-soft ring-1 ring-line hover:text-ink"
            href={`/api/reports/${run.id}`}
          >
            导出 JSON 报告
          </Link>
        }
      />

      {run.agentRuns.length === 0 ? (
        <EmptyState
          title="批次还没有运行记录"
          description="创建批次时应同时生成 Agent 运行计划。若这里为空，请检查创建参数。"
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold">Agent 运行</h2>
            <Table>
              <thead>
                <tr>
                  <Th>Agent</Th>
                  <Th>任务</Th>
                  <Th>状态</Th>
                  <Th>模型</Th>
                  <Th>耗时</Th>
                  <Th>Token</Th>
                  <Th>成本</Th>
                  <Th>总分</Th>
                  <Th>产物</Th>
                </tr>
              </thead>
              <tbody>
                {run.agentRuns.map((agentRun) => (
                  <tr key={agentRun.id}>
                    <Td className="font-medium">{agentRun.agent.name}</Td>
                    <Td className="text-ink-soft">{agentRun.task.name}</Td>
                    <Td>
                      <StatusBadge status={agentRun.status} />
                    </Td>
                    <Td className="font-mono text-xs text-ink-soft">{agentRun.model ?? "默认"}</Td>
                    <Td className="text-ink-soft">{formatDuration(agentRun.durationMs)}</Td>
                    <Td className="text-ink-soft">
                      {formatTokens(agentRun.inputTokens)} / {formatTokens(agentRun.outputTokens)}
                    </Td>
                    <Td className="text-ink-soft">{formatCost(agentRun.costUsd)}</Td>
                    <Td className="font-semibold tabular-nums">
                      {formatScore(agentRun.score?.totalScore)}
                    </Td>
                    <Td>
                      {agentRun.stdoutPath ? (
                        <Link
                          className="text-primary hover:text-primary-dark"
                          href={`/api/runs/${run.id}/logs?agentRunId=${agentRun.id}`}
                        >
                          日志
                        </Link>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold">自动验收结果</h2>
            {run.agentRuns.every((agentRun) => agentRun.evaluations.length === 0) ? (
              <EmptyState
                title="还没有验收结果"
                description="验收由 Runner 在工作区外执行。Agent 自报的测试结果不会作为评分依据。"
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Agent</Th>
                    <Th>检查项</Th>
                    <Th>分类</Th>
                    <Th>结果</Th>
                    <Th>得分</Th>
                    <Th>说明</Th>
                  </tr>
                </thead>
                <tbody>
                  {run.agentRuns.flatMap((agentRun) =>
                    agentRun.evaluations.map((evaluation) => {
                      const details = (evaluation.details ?? {}) as Record<string, unknown>;
                      const summary =
                        typeof details.summary === "string" ? details.summary : "—";
                      return (
                        <tr key={evaluation.id}>
                          <Td className="text-ink-soft">{agentRun.agent.name}</Td>
                          <Td className="font-mono text-xs">{evaluation.checkKey}</Td>
                          <Td className="text-ink-soft">{evaluation.category}</Td>
                          <Td>
                            <span
                              className={
                                evaluation.passed
                                  ? "rounded-full bg-muted px-2 py-0.5 text-xs text-primary-dark"
                                  : "rounded-full bg-[#f9e5e0] px-2 py-0.5 text-xs text-danger"
                              }
                            >
                              {evaluation.passed ? "通过" : "失败"}
                            </span>
                          </Td>
                          <Td className="tabular-nums">{formatScore(evaluation.score)}</Td>
                          <Td className="text-ink-soft">{summary}</Td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

async function loadRun(id: string) {
  return getPrisma().benchmarkRun.findUnique({
    where: { id },
    include: {
      agentRuns: {
        orderBy: { createdAt: "asc" },
        include: {
          agent: true,
          task: true,
          score: true,
          evaluations: { orderBy: { checkKey: "asc" } },
        },
      },
    },
  });
}
