# benchmarks

基准测试项目不放进本仓库的 pnpm Workspace，也不做 submodule。每个基准项目都是一个独立的 Git 仓库，平台只通过路径和 Commit 引用它。

## DogWalk

目录：`benchmarks/dogwalk/`（由 `.gitignore` 排除，尚未初始化）。

DogWalk 是六项测试的统一载体，包含：

- Next.js App Router + React + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL（独立数据库 `cab_dogwalk`）
- Zod
- Vitest + Playwright

基线快照规划：

| 标签 | 用途 |
|---|---|
| `snapshot/base` | 健康基线，功能开发、UI、自主交付 |
| `snapshot/bug-timezone` | 植入 Asia/Shanghai 日期筛选缺陷，用于调试测试 |
| `snapshot/review-target` | 包含待审查缺陷变更的分支，用于 Code Review 测试 |

## 为什么独立仓库

1. Agent 的 Worktree 只包含基准代码，不会看到平台源码。
2. 隐藏测试位于 `evaluator-runner/hidden-tests/`，不在任何 Worktree 中。
3. 每个任务可以固定不同的 `baseRef`，时区 Bug 与 Review 目标不会污染健康基线。
4. 快照可以打标签、对外发布、被社区复现。

## 初始化要求

创建仓库时必须：

```bash
cd benchmarks/dogwalk
git init
# 写入基线代码与测试
git add -A
git commit -m "chore: DogWalk baseline"
git tag snapshot/base
```

平台通过 `CAB_DOGWALK_REPO` 定位仓库，通过 `BenchmarkTask.baseRef` 选择快照。`pnpm evaluate` 在仓库不存在时会拒绝执行，不会退化成空跑。
