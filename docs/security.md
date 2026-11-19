# 安全

## 威胁模型

被评测的 Agent 拥有终端和文件系统权限。它可能：

- 读取工作区外的文件（密钥、其他 Agent 的结果）。
- 修改测试或评测代码来伪造通过。
- 写入恶意脚本、外联网络、消耗资源。
- 生成包含公式注入的 CSV 或带密钥的提交。

平台的目标不是防御恶意人类，而是保证评测结果可信、控制平面数据不被污染。

## 边界

```text
控制平面容器/进程        执行平面容器
┌──────────────────┐    ┌─────────────────────────┐
│ Dashboard        │    │ Agent CLI               │
│ PostgreSQL(cab)  │    │ DogWalk Worktree        │
│ 隐藏测试         │    │ DogWalk DB(cab_agent)   │
└──────────────────┘    └─────────────────────────┘
       只读结果                    无控制平面凭据
```

## 已实现的措施

1. **数据库隔离**
   - 平台库 `cab_benchmark` 使用 `cab` 账号。
   - 基准库 `cab_dogwalk` 使用 `cab_agent` 账号，无超级用户权限。
   - 初始化脚本只授予 `public` Schema 的 `USAGE, CREATE`。
2. **凭据最小化**
   - Runner 只注入 `DATABASE_URL=<DOGWALK_DATABASE_URL>` 与 `CI=1`。
   - 平台 `DATABASE_URL` 不进入 Agent 进程环境。
3. **日志脱敏**
   - 变量名匹配 `key/token/secret/password/credential/authorization` 时替换为 `[REDACTED]`。
   - 连接串中的密码在写盘前替换。
4. **产物路径校验**
   - 日志与 Diff 接口只允许读取 `CAB_ARTIFACT_ROOT` 之内的路径。
   - 越界返回 403。
5. **工作区隔离**
   - 每个 `AgentRun` 使用独立 Worktree 与独立分支。
   - 路径必须位于 `CAB_WORKSPACE_ROOT` 内，`../` 逃逸直接拒绝。
6. **超时与进程树**
   - 达到 `timeoutMs` 后终止整个进程树，避免子进程残留。
7. **结果可追溯**
   - 每次运行保留 `initialCommit`、`finalCommit`、二进制 Diff、stdout、stderr 与校验和。
8. **隐藏测试隔离**
   - 隐藏测试不在基准仓库内，Agent 没有挂载点。
9. **错误不掩盖**
   - Agent 不可用、基线解析失败、超时都会写入 `errorMessage`，不会转为低分静默通过。

## 必须遵守

- 正式评测必须在容器内执行（`CAB_EXECUTION_ISOLATION=container`）。
- `host` 模式只允许在本地、可信代码、可丢弃的开发机上使用；Runner 启动时会打印警告。
- 不要给 Agent 挂载 Docker Socket、SSH 目录、云凭证。
- Dashboard 没有账号体系，不能暴露到公网。
- 不要在 `.env` 中存放生产数据库连接串。

## 已知缺口

| 缺口 | 影响 | 计划 |
|---|---|---|
| 宿主机执行模式无沙箱 | 不可信代码可访问宿主文件 | 容器模式为正式路径 |
| 网络默认可达 | Agent 可访问外网 | 增加白名单/断网策略 |
| 无 CPU/内存配额 | 单次任务可耗尽资源 | 容器运行时限制 |
| Dashboard 无鉴权 | 内部管理后台 | 仅绑定本机，公网需前置鉴权 |
| 隐藏测试未实现 | 无法独立验收 | 下一批次 |

## 运行前检查清单

- [ ] `CAB_EXECUTION_ISOLATION=container`
- [ ] 基准仓库在只读挂载之外，Worktree 根目录可写但独立
- [ ] Agent 环境变量不含控制平面凭据
- [ ] 产物目录磁盘余量足够
- [ ] 批次已固定 Prompt 版本与初始 Commit
- [ ] 超时设置合理，避免长时间占用
- [ ] 完成后归档 Diff、日志与报告
