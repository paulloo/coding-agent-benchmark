import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

const CAPABILITY_LABELS: Array<[string, string]> = [
  ["supportsStreaming", "流式输出"],
  ["supportsHeadless", "无头执行"],
  ["supportsMcp", "MCP"],
  ["supportsModelSelection", "模型选择"],
  ["supportsTokenUsage", "Token 统计"],
  ["supportsCost", "成本统计"],
];

export default async function AgentsPage() {
  let agents: Awaited<ReturnType<typeof loadAgents>> = [];
  let failure: string | null = null;

  try {
    agents = await loadAgents();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="登记在平台侧的 Agent 与适配器。版本号在执行时由 CLI 探测结果更新，未探测时保留 unknown。"
      />

      {failure ? (
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">无法读取 Agent 列表</p>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-soft">{failure}</pre>
        </Card>
      ) : agents.length === 0 ? (
        <EmptyState
          title="还没有登记 Agent"
          description="运行 pnpm db:seed 会写入首批三个适配器：Claude Code、Codex CLI 与 OpenCode。"
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>名称</Th>
                <Th>厂商</Th>
                <Th>类型</Th>
                <Th>适配器</Th>
                <Th>版本</Th>
                <Th>能力</Th>
                <Th>状态</Th>
                <Th>更新时间</Th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const capabilities = (agent.capabilities ?? {}) as Record<string, unknown>;
                return (
                  <tr key={agent.id}>
                    <Td className="font-medium">{agent.name}</Td>
                    <Td className="text-ink-soft">{agent.vendor}</Td>
                    <Td className="text-ink-soft">{agent.category}</Td>
                    <Td className="font-mono text-xs text-ink-soft">{agent.adapter}</Td>
                    <Td className="text-ink-soft">{agent.version}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {CAPABILITY_LABELS.filter(([key]) => capabilities[key] === true).map(
                          ([key, label]) => (
                            <span
                              key={key}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-primary-dark"
                            >
                              {label}
                            </span>
                          ),
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={
                          agent.enabled
                            ? "rounded-full bg-muted px-2 py-0.5 text-xs text-primary-dark"
                            : "rounded-full bg-line/60 px-2 py-0.5 text-xs text-ink-soft"
                        }
                      >
                        {agent.enabled ? "启用" : "停用"}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">{formatDateTime(agent.updatedAt)}</Td>
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

async function loadAgents() {
  return getPrisma().agent.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }] });
}
