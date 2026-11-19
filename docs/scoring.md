# 评分

评分分为两层，必须分开保存：

1. **自动评分**：由 `packages/evaluator` 从验收结果计算。
2. **人工评分**：体验、架构合理性等无法自动判定的维度。

两者合并时保留 `BenchmarkScore.scoredBy`（`automatic` / `human` / `hybrid`），不得覆盖原始自动结果。

## 七维权重

| 维度 | 权重 | 数据来源 |
|---|---:|---|
| 任务完成度 completion | 25 | 必需验收项通过率 |
| 代码质量 quality | 20 | 非必需质量检查通过率 |
| 自主执行能力 autonomy | 20 | 人工干预次数 |
| 执行速度 speed | 10 | 实际耗时 / 时间预算 |
| 实际成本 cost | 10 | 可信成本 / 成本预算 |
| 稳定性 stability | 10 | 单次运行中超时检查占比 |
| 开发体验 experience | 5 | 人工评分 |

注意：任务本身的权重（10/25/20/15/10/20）用于批次汇总，与这里的评分维度权重不是同一套数值。

## 计算公式

### 完成度与质量

```text
score = passedChecks / totalChecks * 100
```

- 完成度只统计 `BenchmarkTask.requiredChecks` 中的检查。
- 质量统计其余检查（lint、e2e、安全扫描等）。
- 没有对应检查时返回 `null`，不是 100 也不是 0。

### 速度与成本

```text
ratio = value / budget
ratio <= 0.5  -> 100
ratio >= 2    -> 0
否则           -> (2 - ratio) / 1.5 * 100
```

- 速度预算等于任务超时时间。
- 成本预算来自 `CAB_COST_BUDGET_USD`，未配置时成本维度为 `null`。
- 成本必须来自 CLI 报告；没有就缺失。

### 自主性

```text
score = max(0, 1 - interventions / 5) * 100
```

干预次数未记录时为 `null`。

### 稳定性

```text
score = (1 - timedOutChecks / totalChecks) * 100
```

这是单次运行的基础设施稳定性。跨次波动应由重复实验的标准差与失败率表达，不能混入这一项来掩盖问题。

## 数据缺失与覆盖率

`computeScore` 只对已测量维度加权，并按已测量权重重新归一化：

```text
total   = Σ(score_i * weight_i) / Σ(weight_i)   // 仅 measured
coverage = Σ(weight_i measured) / Σ(all weight)
```

结果必须同时展示 `coverage` 与 `missingDimensions`。例如某 Agent 不报告成本：

- 成本维度显示「数据缺失」。
- 总分仍然可计算，但覆盖率下降。
- 不允许把成本按 0 分计入，也不允许按满分计入。

当所有维度都缺失时，`totalScore` 为 `null`，榜单显示「数据缺失」而不是 0。

## 榜单聚合

- 按 Agent 汇总所有 `BenchmarkScore`。
- 总分只对 `totalScore != null` 的样本求均值。
- 每个维度只对非空值求均值，并单独展示样本数（`measuredRunCount / runCount`）。
- 四个冠军（编码、自主、性价比、体验）分别取对应维度均分最高者；没有数据时显示缺失，不产生赢家。

## 人工评分

人工评分必须：

- 使用独立记录，不修改自动结果。
- 写明评分人、时间、依据。
- 对 UI 质量这类主观维度给出评分细则，避免只给一个总分。

## 反作弊约束

1. Agent 自报的测试结果不参与评分。
2. 隐藏测试在 Agent 工作区之外执行。
3. 超时与崩溃按失败处理，不重试后取最好一次。
4. 修改测试文件来让测试通过时，Diff 会保留证据，隐藏测试仍会独立验证。
