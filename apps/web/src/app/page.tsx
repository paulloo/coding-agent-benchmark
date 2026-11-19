import Link from "next/link";
import { Card, EmptyState, StatCard, StatusBadge, Table, Td, Th, PageHeader } from "@/components/ui";
import { formatDateTime, formatScore, formatDuration } from "@/lib/format";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

async function loadDashboard() {
  const prisma = getPrisma();
  const [agents, tasks, runCount, activeRuns, recentRuns, topScores, evaluations] = await Promise.all([
    prisma.agent.count(),
    prisma.benchmarkTask.count({ where: { enabled: true } }),
    prisma.benchmarkRun.count(),
    prisma.benchmarkRun.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
    prisma.benchmarkRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { agentRuns: true } } },
    }),
    prisma.benchmarkScore.findMany({
      where: { totalScore: { not: null } },
      orderBy: { totalScore: "desc" },
      take: 20,
      include: { agentRun: { include: { agent: true } } },
    }),
    prisma.evaluationResult.count(),
  ]);

  const seen = new Set<string>();
  const leaderboard = topScores.filter((score) => {
    if (seen.has(score.agentRun.agentId)) {
      return false;
    }
    seen.add(score.agentRun.agentId);
    return true;
  });

  return { agents, tasks, runCount, activeRuns, recentRuns, leaderboard, evaluations };
}

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof loadDashboard>>;
  try {
    data = await loadDashboard();
  } catch (error) {
    return (
      <>
        <PageHeader title="总览" description="评测平台控制平面的运行状态。" />
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">数据库尚未就绪</p>
          <p className="mt-2 text-sm text-ink-soft">
            页面无法读取评测数据。请确认 PostgreSQL 已启动并完成迁移与种子数据初始化。
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-canvas p-4 text-xs text-ink-soft">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <p className="mt-4 text-xs text-ink-soft">初始化命令：pnpm bootstrap</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="总览"
        description="以统一测试项目、标准任务和独立验收为核心的 Coding Agent 评测控制台。"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="已接入 Agents" value={data.agents} hint="在 Agent Registry 中登记" />
        <StatCard label="启用任务" value={data.tasks} hint="六类标准测试任务" />
        <StatCard label="评测批次" value={data.runCount} hint={`${data.activeRuns} 个批次排队或运行中`} />
        <StatCard label="评测结果项" value={data.evaluations} hint="自动验收检查产生的记录" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">最近评测批次</h2>
            <Link className="text-sm text-primary hover:text-primary-dark" href="/runs">
              查看全部
            </Link>
          </div>
          {data.recentRuns.length === 0 ? (
            <EmptyState
              title="还没有评测批次"
              description="通过 POST /api/runs 创建批次后，批次会出现在这里。批次只记录执行计划，实际执行由独立 Runner 完成。"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>批次</Th>
                  <Th>状态</Th>
                  <Th>模式</Th>
                  <Th>Agent 运行</Th>
                  <Th>创建时间</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <Td>
                      <Link className="font-medium hover:text-primary" href={`/runs/${run.id}`}>
                        {run.name}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={run.status} />
                    </Td>
                    <Td className="text-ink-soft">{run.mode}</Td>
                    <Td className="tabular-nums">{run._count.agentRuns}</Td>
                    <Td className="text-ink-soft">{formatDateTime(run.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">当前领先者</h2>
            <Link className="text-sm text-primary hover:text-primary-dark" href="/leaderboard">
              排行榜
            </Link>
          </div>
          {data.leaderboard.length === 0 ? (
            <EmptyState
              title="暂无可用评分"
              description="评分只会从真实执行结果计算。没有测量数据的维度显示为数据缺失，不会按 0 分处理。"
            />
          ) : (
            <ul className="space-y-3">
              {data.leaderboard.map((score, index) => (
                <li
                  key={score.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full bg-card text-xs font-semibold text-ink-soft">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{score.agentRun.agent.name}</p>
                      <p className="text-xs text-ink-soft">
                        {formatDuration(score.agentRun.durationMs)} · 覆盖{" "}
                        {Math.round(Number(score.coverage) * 100)}%
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{formatScore(score.totalScore)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
