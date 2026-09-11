# 产物位置与 smoke 契约

## 产物位置

| 产物 | 路径 | 说明 |
|------|------|------|
| 调研简报 | `docs/integrations/<slug>.md` | slug 按主题：`oauth-oidc` / `mq-nats-vs-kafka` / `objstore-minio` 等 |
| **smoke 脚本** | `contracts/<slug>.smoke.<ext>` | 可行性 A/B **必需**；`<ext>` 跟目标仓技术栈；入库（脚本不含凭据值） |
| **smoke 证据** | `.evidence/<run_id>/…`（不入库） | `evidence-run --phase smoke` 产出；宣称「已对接」的唯一凭证 |
| 索引（可选） | `docs/integrations/README.md` | 一行一条：主题 → 简报 → 状态 |
| 选型 ADR（可选） | `docs/adr/<主题>-<模块\|流程>.md` | 过稀疏门槛；`auto_best` 可事后补；格式对齐 docs-reviewer ADR |

无 `docs/` 时：先建 `docs/integrations/`；勿另起平行树。ADR 目录仅在首篇 ADR 确认写入时创建。

## Phase 3.5 · smoke 真打（A 级必做；B 级拿到凭据即补）

契约要点一写清就**立刻写脚本真打一次**，不要拖到实现阶段 —— 文档里的 scope / 签名 / 错误码与沙箱实际行为的偏差，只有真打才看得见。

| 项 | 约定 |
|----|------|
| 路径 | `contracts/<slug>.smoke.<ext>`，`<ext>` 跟目标仓技术栈（`sh`+curl / `js` / `py` / `go` …） |
| 内容 | 最小鉴权 + **一次只读或幂等写**；**可重复执行**，重复跑不留脏数据 |
| 打向 | **真实端点或厂商沙箱**。本地 mock server / Postman 假服务器 / 录制回放**一律不算** —— 那是假通，比 stub 更难发现 |
| 凭据 | 只从 `.dev` `integrations[].credential_env` 声明的 env 变量名读；变量缺失须**非零退出并打印缺哪个**，不得跳过判成功；**禁止**硬编码或写进仓库 |
| 判定 | 断言状态码 + 关键字段，**不是**「有响应就算过」 |

```bash
EV=~/.agents/skills/_bin/evidence-run
$EV --slice INT-<slug> --phase smoke --label "<slug> 最小真实调用" -- ./contracts/<slug>.smoke.sh
~/.agents/skills/_bin/gate-check smoke --slug <slug>     # 退出码 0 才算过
```

**失败语义落地**：超时、鉴权失效(401)、限流退避(429)、幂等/重试**四类**须写进实现代码并各有测试；简报 §5.1 逐条注明对应测试文件/用例名。只写进文档 = 未落地，回传 `failure_semantics_tested: false`。

**无凭据不要编造**：credential 标 `need|blocked` → 可行性 B/C，`blockers` 写明缺哪个 env 变量名与获取方式；smoke 脚本仍先写好（拿到凭据即可跑）。
