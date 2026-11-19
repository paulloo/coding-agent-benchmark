# Coding Agent Benchmark

可复现、可量化、可扩展的 AI Coding Agent 横向评测平台。

平台把「控制平面」和「执行平面」分开：控制平面（Next.js Dashboard + PostgreSQL）负责 Agent 登记、任务版本、批次计划和结果展示；执行平面（Git Worktree + CLI Adapter + 独立评测）负责真正运行 Agent、收集产物和验收。Agent 不接触控制平面数据库。

## 当前状态

这是 v0.1.0 的第一个可用切片。已经能启动、能读写数据库、能创建批次计划，并具备执行与评分所需的核心原语。

| 模块 | 状态 |
|---|---|
| 仓库底座、Docker Compose、Prisma 迁移与种子 | 已完成 |
| 六份版本化 Prompt 与标准任务 | 已完成 |
| Agent Adapter（Claude Code / Codex CLI / OpenCode） | 已完成，CLI 参数需按实际版本复核 |
| Git Worktree 隔离、Diff 快照、产物落盘 | 已完成，含集成测试 |
| 类型检查 / 测试 / 构建 / 安全扫描评测器 | 已完成 |
| 七维评分与「数据缺失」语义 | 已完成 |
| Dashboard 只读页面与管理 API | 已完成 |
| 批次执行器 `scripts/evaluate.ts` | 已完成，依赖 DogWalk 仓库 |
| DogWalk 基准项目（独立仓库、base/bug/review 快照） | 未开始（下一批次） |
| 容器化执行平面、隐藏测试、Playwright 页面测试 | 未开始（下一批次） |

`pnpm evaluate` 在 DogWalk 仓库初始化之前会明确报错退出，不会产生任何伪造结果。种子数据也刻意不写入任何评测分数。

## 快速开始

前置：Node.js >= 22、pnpm 10、Docker。

```bash
pnpm install
pnpm bootstrap  # 创建 .env、启动 PostgreSQL、执行迁移、写入种子数据
pnpm dev       # http://localhost:3000
```

常用命令：

```bash
pnpm typecheck     # Prisma generate + 根脚本 + 所有工作区包
pnpm test          # Vitest（39 个用例：评分、Worktree、适配器、安全扫描）
pnpm test:smoke    # 对运行中的 Dashboard 做 17 项 API 与页面冒烟检查
pnpm build         # 生产构建 Dashboard
pnpm db:seed       # 幂等写入 Agent、Prompt、Task
pnpm reset --yes   # 清空平台库并重新初始化
pnpm evaluate --run <runId> --dry-run
```

数据库：

- 平台库：`cab_benchmark`，账号 `cab`，只给控制平面使用。
- 基准库：`cab_dogwalk`，账号 `cab_agent`，只通过 `DOGWALK_DATABASE_URL` 注入给 Agent。
- 端口映射到宿主机 `5433`，避免与本机 PostgreSQL 冲突。

## 目录结构

```text
apps/web/                 Next.js 控制平面：Dashboard + Route Handlers
packages/core/            Agent 契约、进程执行、Worktree、任务执行原语、评分
packages/adapters/        三个 CLI 适配器、JSONL 用量解析、进程取消
packages/evaluator/       验收检查、安全扫描、评分映射
packages/prompts/         六份版本化 Prompt（manifest + markdown）
packages/db/              Prisma Client 工厂与生成代码
prisma/                   平台库 Schema、迁移、种子
scripts/                  setup / reset / evaluate
evaluator-runner/         执行平面容器与隐藏测试挂载点
benchmarks/dogwalk/       独立 Git 仓库（下一批次）
docs/                     架构、协议、适配器、评分、安全
```

## 已实现的 API

```text
GET    /api/agents                     POST   /api/agents
GET    /api/agents/:id                 PATCH  /api/agents/:id
DELETE /api/agents/:id

GET    /api/tasks                      POST   /api/tasks
GET    /api/tasks/:id                  PATCH  /api/tasks/:id

GET    /api/runs                       POST   /api/runs
GET    /api/runs/:id
POST   /api/runs/:id/cancel
GET    /api/runs/:id/logs[?agentRunId=&stream=stdout|stderr|diff]
GET    /api/runs/:id/results

GET    /api/leaderboard
GET    /api/leaderboard/:agentId
GET    /api/reports/:runId
```

创建批次只生成执行计划（`QUEUED` + 每条 `AgentRun` 为 `PENDING`），不占用 HTTP 请求。执行由 `pnpm evaluate --run <id>` 在独立进程中完成。

## 与原始开发文档的差异

这些是有意为之的调整，均出于可复现性或平台安全性：

1. **包管理器使用 pnpm**，不是 Bun。本机未安装 Bun；pnpm Workspace 对 Prisma 和 Next 的工具链更稳。`packageManager` 字段已固定版本。
2. **Prisma 使用 7.10.1 稳定版**。`latest` 当前指向 8.0.0-rc，RC 不能作为评测基线。因此使用 `prisma.config.ts`、`prisma-client` 生成器与 `@prisma/adapter-pg`。
3. **隐藏测试不放在基准仓库内**。文档 §16 的目录树与 §9.2 冲突；隐藏测试将放在 `evaluator-runner/hidden-tests/`，运行时只读挂载。
4. **`initialCommit` 下沉到任务与运行维度**。时区 Bug 与 Code Review 目标无法与健康基线共用同一个 Commit，改用 `BenchmarkTask.baseRef`。
5. **补充文档要求的字段**：`PromptVersion` 表、`AgentRun.promptVersionId`、`benchmark_runs.mode`、`repetitionIndex`、`modelVersion`、`isolation`、`BenchmarkScore.coverage` 与缺失维度。
6. **脚本改为 TypeScript**（tsx 实现），Windows 与 Linux 行为一致；`.sh` 只作为可选的薄包装。
7. **执行隔离默认不是容器**。`CAB_EXECUTION_ISOLATION=host` 仅用于本地开发，Runner 会打印醒目警告；正式评测必须使用容器模式。

## 安全边界

- Agent 只拿到 `DOGWALK_DATABASE_URL`，永远拿不到 `DATABASE_URL`。
- 日志写入前会脱敏：密钥类环境变量、连接串中的密码。
- 产物读取接口会校验路径必须位于 `CAB_ARTIFACT_ROOT` 内。
- 每个 Agent 使用独立 Worktree 与独立分支，结束后自动提交、生成 Diff。
- 超时会终止整个进程树（Windows 使用 `taskkill /T`，POSIX 使用进程组信号）。
- 未实现容器沙箱之前，不应在宿主机上运行不可信代码。

## 下一批次

1. DogWalk 独立 Git 仓库：Schema、Seed、基础页面、可见测试，以及 `snapshot/base` 标签。
2. 时区 Bug 与 Review 目标快照，配合隐藏测试。
3. 执行平面容器（`evaluator-runner`）与隐藏测试挂载。
4. Dashboard 写操作界面（创建批次、取消、查看日志）、shadcn/ui 组件层、Playwright 页面测试。
