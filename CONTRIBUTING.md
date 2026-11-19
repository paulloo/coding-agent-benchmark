# 参与贡献

感谢你愿意改进 Coding Agent Benchmark。这个项目的价值来自可复现的评测，所以对正确性的要求高于对功能数量的要求。

## 开发环境

前置：Node.js >= 22、pnpm 10、Docker。

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

提交前必须通过：

```bash
pnpm typecheck
pnpm test
pnpm build
```

Dashboard 相关改动还需要启动服务后执行：

```bash
pnpm start
pnpm test:smoke
```

## 提交规范

- 一个提交只做一件事，消息使用 `feat:` / `fix:` / `docs:` / `test:` / `chore:` 前缀。
- 不提交 `.env`、`node_modules`、`.next`、`artifacts`、`workspace` 或 Prisma 生成代码。
- 不提交任何真实 API Key、数据库凭据或个人信息。
- 新增依赖需要在 PR 中说明必要性；能用现有依赖解决就不要引入新包。

## 评测完整性

这是项目的核心约束，违反的 PR 不会合并：

1. 不伪造评测数据、评分、Token 用量或成本。
2. CLI 没有报告的指标写为「不可用」，不能按输出长度估算。
3. 隐藏测试不得放进基准仓库或被 Agent 工作区读取。
4. 修改 Prompt 必须产生新版本，不能原地修改已被批次使用的版本。
5. 修复评测基础设施问题后，重新运行整个批次，而不是只修补某一条结果。

## 新增 Prompt 或任务

1. 在 `packages/prompts/prompts/<id>/` 下新增目录。
2. 写 `manifest.json`（含 `category`、`weight`、`timeoutSeconds`、`baseRef`、`requiredChecks`）与 `v<version>.md`。
3. 运行 `pnpm db:seed` 验证加载。
4. 在 PR 中说明评分标准与可能的作弊路径。

## 新增 Agent 适配器

参考 `docs/agent-adapter.md`。必须同时提交参数构造测试与用量解析测试，并声明真实的能力矩阵。

## 报告问题

使用 Issue 模板。涉及安全问题时，不要公开利用细节，先通过仓库安全公告（Security Advisory）联系维护者。

## 许可证

贡献即表示同意以 MIT License 发布。
