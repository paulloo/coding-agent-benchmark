# evaluator-runner

执行平面的容器基底。它不包含任何隐藏测试，隐藏测试在运行时以只读方式挂载到 `/hidden-tests`。

## 镜像内容

- Node.js 24（Debian slim）
- pnpm 10.34.9
- git、ca-certificates、tini
- 非 root 用户 `benchmark`（UID 10001）

## 构建与运行

```bash
docker build -t cab-evaluator:0.1.0 evaluator-runner

docker run --rm \
  -v "<workspace>:/workspace:ro" \
  -v "<artifacts>:/artifacts" \
  -v "$PWD/evaluator-runner/hidden-tests:/hidden-tests:ro" \
  -e DOGWALK_DATABASE_URL="postgresql://cab_agent:...@postgres:5432/cab_dogwalk" \
  cab-evaluator:0.1.0
```

## 约束

- 不把控制平面数据库连接串传入容器。
- `/workspace` 只读挂载；Agent 执行使用独立 Worktree，不应直接挂载基准仓库。
- 隐藏测试不得被打进基准镜像或基准仓库。
- 容器需要显式设置 CPU、内存、PID 与网络限制。
- 需要额外浏览器依赖时，在镜像中预装 Playwright，不要运行时联网下载。

## 当前状态

该目录目前只提供工具链基底与挂载契约。隐藏测试执行入口、Playwright 浏览器与资源限制会随 DogWalk 基线一起落地。
