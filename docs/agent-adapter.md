# Agent Adapter

## 契约

适配器是唯一的 Agent 接入点。控制平面只认识 `AgentAdapter`，不关心 CLI、参数或输出格式。

```ts
interface AgentAdapter {
  id: string;
  name: string;
  vendor: string;
  version: string;
  checkAvailability(): Promise<AgentAvailability>;
  getCapabilities(): AgentCapabilities;
  execute(input: AgentExecuteInput): Promise<AgentRunResult>;
  cancel(runId: string): Promise<boolean>;
}
```

实现位于 `packages/core/src/types/agent.ts`，基类位于 `packages/adapters/src/shared/cli-adapter.ts`。

- `input.timeoutMs` 是硬超时，不是建议值。
- `input.runId` 用于登记子进程，取消时按这个 ID 终止。
- `execute` 只负责运行和采集，不写数据库、不评分。
- `result.usageUnavailableReason` 用于解释为什么没有 Token 或成本数据。

## 能力矩阵

| 适配器 | 命令 | 流式 | 无头 | MCP | 模型选择 | Token | 成本 |
|---|---|---|---|---|---|---|---|
| Claude Code | `claude` | 是 | 是 | 是 | 是 | 是 | 是 |
| Codex CLI | `codex` | 是 | 是 | 是 | 是 | 是 | 否 |
| OpenCode | `opencode` | 是 | 是 | 是 | 是 | 否（默认） | 否 |

能力矩阵是声明，不是承诺。Runner 只信实际解析到的字段；解析不到就写 `null`。

## CLI 参数

参数集合在编写时依据各 CLI 的无头约定实现：

| 适配器 | 默认参数 |
|---|---|
| Claude Code | `-p <prompt> --output-format stream-json --verbose --permission-mode bypassPermissions [--model X]` |
| Codex CLI | `exec --json --full-auto [--model X] <prompt>` |
| OpenCode | `run [--model X] [--print-logs] <prompt>` |

CLI 参数会随版本变化。升级任一 CLI 后必须重新验证 `buildArgs`，否则任务可能直接以非零退出码失败。失败会被记录为失败，不会被解释为低分。

可以通过环境变量覆盖二进制路径：

```bash
CAB_CLAUDE_BIN=/opt/claude/bin/claude
CAB_CODEX_BIN=/usr/local/bin/codex
CAB_OPENCODE_BIN=/usr/local/bin/opencode
CAB_CLAUDE_PERMISSION_MODE=bypassPermissions
CAB_OPENCODE_PRINT_LOGS=1
```

## 用量解析

- Claude Code：读取最后一条 `type=result` 事件，映射 `input_tokens`、`output_tokens`、`cache_read_input_tokens` 与 `total_cost_usd`。
- Codex：读取包含 `usage` 的事件，映射 `input_tokens`、`output_tokens`、`cached_input_tokens`；CLI 不提供金额。
- OpenCode：仅当 stdout 是 JSON 且包含 `usage` 或 `tokens` 对象时解析。

解析失败时 `tokenUsage` 与 `costUsd` 均为 `undefined`，并附带原因。禁止用输出长度估算。

## 取消与超时

`CliAgentAdapter` 内部维护 `ProcessRegistry`：

1. `execute` 注册 `AbortController`。
2. `cancel(runId)` 触发 abort。
3. `runProcess` 收到信号后终止整个进程树：
   - Windows：`taskkill /pid <pid> /T /F`
   - POSIX：向进程组发送 `SIGTERM`，2 秒后 `SIGKILL`

Runner 每 5 秒检查一次批次状态，因此取消延迟通常不超过 5 秒。

## 新增一个适配器

1. 在 `packages/adapters/src/<id>.ts` 实现 `buildArgs` 与 `parseUsage`。
2. 用 `CliAgentAdapter` 组合，声明 `capabilities`。
3. 在 `registry.ts` 注册，并加入 `ADAPTER_IDS`。
4. 在 `prisma/seed.ts` 重新执行即可写入 `agents` 表。
5. 补两类测试：参数构造、用量解析（含解析失败路径）。

不需要修改 Runner、评分器或数据库 Schema。

## 版本记录

`Agent.version` 的初始值为 `unknown`。Runner 每次探测成功后，把 `--version` 的第一行写回数据库，长度截断到 120 字符。适配器自身的实现版本记录在 `AgentAdapter.version`，两者不混用。

## 环境注入

Runner 只向 Agent 注入：

- `DOGWALK_DATABASE_URL`（作为 `DATABASE_URL`）
- `CI=1`

控制平面的 `DATABASE_URL`、API Key 与工作区外路径不会传入。日志写入前会按密钥变量名做脱敏。
