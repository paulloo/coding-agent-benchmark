import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let runs: Awaited<ReturnType<typeof loadRuns>> = [];
  let failure: string | null = null;

  try {
    runs = await loadRuns();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <>
      <PageHeader
        title="评测批次"
        description="一个批次包含多条 Agent 运行记录。执行由独立 Runner 完成，控制平面只负责计划、状态和产物索引。"
      />

      {failure ? (
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">无法读取批次</p>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-soft">{failure}</pre>
        </Card>
      ) : runs.length === 0 ? (
        <EmptyState
          title="还没有评测批次"
          description="调用 POST /api/runs 创建批次，指定任务、Agent 与重复次数。所有执行使用独立 Git Worktree。"
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>批次</Th>
                <Th>状态</Th>
                <Th>模式</Th>
                <Th>初始 Commit</Th>
                <Th>运行数</Th>
                <Th>开始</Th>
                <Th>耗时</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const duration =
                  run.startedAt && run.finishedAt
                    ? run.finishedAt.getTime() - run.startedAt.getTime()
                    : null;
                return (
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
                    <Td className="font-mono text-xs text-ink-soft">
                      {run.initialCommit ? run.initialCommit.slice(0, 10) : "—"}
                    </Td>
                    <Td className="tabular-nums">{run._count.agentRuns}</Td>
                    <Td className="text-ink-soft">{formatDateTime(run.startedAt)}</Td>
                    <Td className="text-ink-soft">{formatDuration(duration)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

async function loadRuns() {
  return getPrisma().benchmarkRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { agentRuns: true } } },
  });
}
