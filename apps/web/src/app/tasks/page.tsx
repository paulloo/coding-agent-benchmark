import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: Awaited<ReturnType<typeof loadTasks>> = [];
  let failure: string | null = null;

  try {
    tasks = await loadTasks();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <>
      <PageHeader
        title="测试任务"
        description="任务固定 Prompt 版本、超时、基准 Commit 与验收项。Prompt 一旦被批次使用，不允许原地修改。"
      />

      {failure ? (
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">无法读取任务列表</p>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-soft">{failure}</pre>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="还没有测试任务"
          description="运行 pnpm db:seed 会从 packages/prompts 载入六份版本化 Prompt 并生成对应任务。"
        />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{task.name}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-primary-dark">
                      {task.category}
                    </span>
                    {task.enabled ? null : (
                      <span className="rounded-full bg-line/60 px-2 py-0.5 text-[11px] text-ink-soft">
                        已停用
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{task.description}</p>
                </div>
                <div className="text-right text-xs text-ink-soft">
                  <p>权重 {task.weight}</p>
                  <p>超时 {Math.round(task.timeoutSeconds / 60)} 分钟</p>
                  <p className="font-mono">{task.baseRef ?? "继承默认基线"}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className="rounded-md bg-canvas px-2 py-1 font-mono">{task.key}</span>
                <span>
                  Prompt {task.promptVersion.prompt.slug} v{task.promptVersion.version}
                </span>
                <span className="text-line">|</span>
                <span>验收项：{task.requiredChecks.length > 0 ? task.requiredChecks.join("、") : "人工评审"}</span>
              </div>

              <details className="mt-4 rounded-xl bg-canvas p-4">
                <summary className="cursor-pointer text-sm font-medium">查看 Prompt 全文</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                  {task.promptVersion.content}
                </pre>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

async function loadTasks() {
  return getPrisma().benchmarkTask.findMany({
    orderBy: [{ weight: "desc" }, { key: "asc" }],
    include: { promptVersion: { include: { prompt: true } } },
  });
}
