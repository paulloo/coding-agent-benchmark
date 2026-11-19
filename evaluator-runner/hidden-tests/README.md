# hidden-tests

隐藏测试的挂载点，不属于 DogWalk 仓库，也不会被复制进 Agent 的 Worktree。

契约：

- 测试以独立项目形式维护，自带依赖锁定。
- 运行时只读挂载到容器 `/hidden-tests`。
- 通过环境变量接收基准数据库连接与工作区路径。
- 每项测试输出机器可读结果，由 `packages/evaluator` 汇总。
- 不允许被测 Agent 读取或修改这里的任何文件。

具体测试用例随 DogWalk 基线一起实现。
