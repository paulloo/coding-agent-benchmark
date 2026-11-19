# 架构

## 控制平面与执行平面

```mermaid
flowchart TB
  UI[Dashboard<br/>apps/web] --> API[Route Handlers]
  API --> DB[(PostgreSQL<br/>cab_benchmark)]
  API -->|创建计划| RUNS[BenchmarkRun / AgentRun]
  CLI[scripts/evaluate.ts] -->|读取 PENDING| DB
  CLI --> WM[Workspace Manager<br/>packages/core]
  WM --> WT[Git Worktree]
  WT --> AGENT[Agent CLI]
  CLI --> EVAL[Evaluator<br/>packages/evaluator]
  EVAL --> DB
  CLI --> ART[(Artifacts<br/>stdout / stderr / diff)]
  API -->|读取产物路径| ART
```

控制平面不执行 Agent。评测批次创建后只是数据库中的执行矩阵，`scripts/evaluate.ts` 作为独立进程消费这些记录。这样 HTTP 请求不会持有长进程，Runner 崩溃也不会破坏控制平面。

## 包依赖

```mermaid
flowchart LR
  core[packages/core] --> adapters[packages/adapters]
  core --> evaluator[packages/evaluator]
  core --> web[apps/web]
  db[packages/db] --> web
  prompts[packages/prompts] --> seed[prisma/seed.ts]
  adapters --> runner[scripts/evaluate.ts]
  evaluator --> runner
```

`core` 只依赖 Node 内置模块，不依赖 Prisma。数据库类型只出现在 `packages/db` 和 `apps/web`，避免执行层被控制平面的持久化细节污染。

## 一次运行的时序

```mermaid
sequenceDiagram
  participant API
  participant DB
  participant Runner
  participant Git
  participant Agent
  participant Eval

  API->>DB: 创建 BenchmarkRun(QUEUED)
  API->>DB: 创建 AgentRun(PENDING) x N
  Runner->>DB: 读取 PENDING 记录
  Runner->>DB: BenchmarkRun -> RUNNING
  Runner->>Git: worktree add -b benchmark/<key> <baseCommit>
  Runner->>Agent: execute(prompt, timeoutMs, env)
  Agent-->>Runner: stdout / stderr / exitCode
  Runner->>Git: commit 未提交变更，diff base..HEAD
  Runner->>Eval: 在工作区执行 typecheck / unit / e2e / security
  Eval-->>Runner: EvaluationResult[]
  Runner->>DB: 写入结果、评分、产物索引
  Runner->>DB: BenchmarkRun -> COMPLETED
```

## 关键实现位置

| 能力 | 文件 |
|---|---|
| Agent 契约 | `packages/core/src/types/agent.ts` |
| 执行计划矩阵 | `packages/core/src/types/run.ts` |
| 进程与超时终止 | `packages/core/src/lib/exec.ts` |
| Worktree 与 Diff | `packages/core/src/workspace/git.ts` |
| 单任务执行与产物落盘 | `packages/core/src/task-engine/execute.ts` |
| 评分 | `packages/core/src/types/scoring.ts` |
| 验收检查 | `packages/evaluator/src/checks.ts` |
| 评分映射 | `packages/evaluator/src/scoring.ts` |
| 批次执行循环 | `scripts/evaluate.ts` |

## 数据模型

```mermaid
erDiagram
  Agent ||--o{ AgentRun : executes
  BenchmarkTask ||--o{ AgentRun : instantiates
  Prompt ||--o{ PromptVersion : versions
  PromptVersion ||--o{ BenchmarkTask : pins
  BenchmarkRun ||--o{ AgentRun : contains
  AgentRun ||--|| BenchmarkScore : scored_by
  AgentRun ||--o{ EvaluationResult : evaluated_by
  AgentRun ||--o{ BenchmarkArtifact : produces

  Agent {
    string id PK
    string slug UK
    string adapter
    string version
    json capabilities
  }
  PromptVersion {
    string id PK
    int version
    string content
    json inputSchema
  }
  BenchmarkTask {
    string id PK
    string key UK
    int weight
    int timeoutSeconds
    string baseRef
    string[] requiredChecks
  }
  BenchmarkRun {
    string id PK
    enum status
    enum mode
    json configuration
  }
  AgentRun {
    string id PK
    int repetitionIndex
    enum status
    int durationMs
    decimal costUsd
    string finalCommit
  }
  BenchmarkScore {
    decimal totalScore
    decimal coverage
    string[] missingDimensions
  }
```

`AgentRun` 的唯一键是 `(benchmarkRunId, agentId, taskId, repetitionIndex)`，重复实验不会互相覆盖。`PromptVersion` 由任务固定；修改 Prompt 必须产生新版本，否则历史批次无法解释。

## 状态机

```mermaid
stateDiagram-v2
  [*] --> QUEUED: POST /api/runs
  QUEUED --> RUNNING: runner 启动
  RUNNING --> COMPLETED: 所有记录到达终态
  RUNNING --> FAILED: 全部失败或超时
  RUNNING --> CANCELLED: POST /cancel
  QUEUED --> CANCELLED: POST /cancel
```

Agent 运行记录独立维护 `PENDING -> RUNNING -> COMPLETED | FAILED | TIMEOUT | CANCELLED`。Runner 在每条记录开始前重新读取批次状态，并在执行期间每 5 秒轮询取消信号。
