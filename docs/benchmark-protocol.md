# 评测协议

## 目标

同一份需求、同一个起点、同一套验收，让不同 Agent 的结果可以横向比较。任何影响结果的条件都必须被记录。

## 输入固定项

| 项目 | 来源 | 说明 |
|---|---|---|
| 基准仓库 | `CAB_DOGWALK_REPO` | 独立 Git 仓库，非 submodule |
| 初始 Commit | `BenchmarkTask.baseRef` | 任务级固定，默认 `snapshot/base` |
| Prompt 版本 | `PromptVersion` | 批次创建时写入 `AgentRun.promptVersionId` |
| 超时 | `BenchmarkTask.timeoutSeconds` | 同时作为速度评分预算 |
| 验收项 | `BenchmarkTask.requiredChecks` | 空数组表示人工评审 |
| 模型 | `AgentRun.model` | 未指定则使用 CLI 默认 |
| 执行模式 | `BenchmarkRun.mode` | `NATIVE` 或 `CONTROLLED` |

## 运行步骤

1. `POST /api/runs` 创建批次与执行矩阵，状态为 `QUEUED`。
2. `pnpm evaluate --run <id>` 读取计划，将批次置为 `RUNNING`。
3. 对每条 `AgentRun`：
   1. 解析基线 Commit，写入 `initialCommit`。
   2. 创建独立 Worktree 与 `benchmark/...` 分支。
   3. 注入 Prompt 与隔离环境变量，执行 Agent CLI。
   4. 捕获 stdout / stderr，超时则终止进程树。
   5. 提交遗留变更，生成 `base..HEAD` 的二进制 Diff。
   6. 在工作区执行任务要求的验收项。
   7. 写入 `EvaluationResult`、`BenchmarkScore`、`BenchmarkArtifact`。
4. 所有记录进入终态后更新批次状态与 `finishedAt`。

## 重复实验

每个任务至少执行 3 次。平台用 `repetitionIndex` 区分，并保存每一次的独立结果。汇总时：

- 报告平均分与标准差。
- 记录失败率，不能只取最好的一次。
- 未测量维度在每次运行中保持 `null`，汇总时也只对已测量样本求均值。

创建批次时通过 `repetitions` 参数控制，上限 10。

## 隐藏测试

隐藏测试不属于 Agent 工作区：

- 位置：`evaluator-runner/hidden-tests/`。
- 执行：由评测服务在主工作区之外运行，使用独立的基准数据库账号。
- 只读：Agent 没有挂载点，也无法通过仓库路径访问。
- 结果：每项测试的原始输出单独落盘，不依赖 Agent 自报。

## 真实性约束

1. 不能依据输出长度推算 Token。
2. CLI 没有报告成本时，`costUsd` 写 `null`，评分维度显示「数据缺失」。
3. 不能只根据 Agent 自己运行的测试结果评分。
4. 不能人工修改 Diff 后再计分；如需修复基础设施问题，应重新跑整个批次。
5. 任何人工介入都要记录次数，用于 `autonomy` 维度。

## 两种模式

- `NATIVE`：使用各工具官方推荐模型与配置，比较产品整体体验。
- `CONTROLLED`：尽量固定模型、版本、推理等级与权限，比较 Harness 差异。

无法对齐模型时必须标记为非完全可比，报告中不得隐藏该差异。

## 环境记录

批次创建时写入 `BenchmarkRun.configuration`，运行记录保存 `environment`。至少包含：

- Agent 名称、适配器版本、CLI 版本（探测结果）。
- 模型名称与版本、推理等级。
- 操作系统、Node 版本。
- 基准仓库路径与初始 Commit。
- Prompt 版本。
- 隔离模式与网络策略。
- 开始与结束时间。

## 取消语义

`POST /api/runs/:id/cancel` 会把批次和未完成记录置为 `CANCELLED`。Runner 每 5 秒轮询一次，并向正在执行的适配器发送取消信号；适配器终止子进程树。已完成的记录保留，不会被回滚。
