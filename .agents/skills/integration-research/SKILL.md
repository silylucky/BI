---
name: integration-research
description: >
  外部契约与技术方案选型调研（技术栈无关）：针对 PRD/arch 依赖缺口、难回退技术取舍、
  或 stub 假绿 finding，检索官方文档/SDK/协议/GitHub 参考与社区方案，产出调研简报
  （术语对齐、2–3 候选、八维择优素材、失败语义、阻塞项），并写出可重复执行的 smoke
  脚本、用真实端点/厂商沙箱真打一次留证。
  Use when researching external contracts, tech selection, SDK vs community lib vs DIY,
  OAuth/OIDC/LDAP/SAML, SMTP/SMS/object storage/queues, cloud/HCI/SaaS APIs, middleware
  or storage engine choices, protocol adapters, or before go-fast/loop-goal-prd/loop-goal-product true-connect
  when contracts or options are unclear.
---

# Integration Research（外部契约 · 技术方案调研）

技术栈无关。Agent 已会写适配器与选型；本 Skill 补：**契约/选型不明时先调研再交付**、**候选须可八维对照**、**会话中锐化术语/对账代码/场景压失败语义**、**与 PRD/arch/go-fast 接力**、**禁止用 stub 顶替研究缺口**，以及**禁止用「从没打通过的真 SDK 代码」冒充已对接**。

**产出三件套（缺一不得宣称已对接）**：简报 `docs/integrations/<slug>.md` + 可重复执行的 `contracts/<slug>.smoke.<ext>` + **一次成功的 smoke 证据工件**。  
**正确时机 = 开工前**，配合 [go-fast](../go-fast/SKILL.md)「开工前 0.6 外部依赖盘点」一次性全量盘点；**「实现完再补简报」是反模式**。若 README/SOP 与此冲突，以 go-fast 开工前门为准。

## 范围（主责）

| 主责 | 例 |
|------|-----|
| **外部契约调研** | 仓外协议/服务怎么鉴权、调用、失败、配额；官方文档与沙箱要求 |
| **技术方案选型调研** | 官方 SDK vs 社区库 vs 自研；中间件/存储/队列/搜索等引擎取舍；难回退的集成形态 |

示例（**非穷尽**）：OAuth2/OIDC、LDAP/AD、SAML、邮件/短信、对象存储、消息队列、云/HCI/SaaS API、支付/地图等第三方，以及「选哪个客户端库/协议实现/开源组件」类选型。

**不要用本 Skill**：无外部契约、也无难回退技术取舍的纯本仓业务实现（直接 go-fast）；已钉死且契约清楚的重复接线（直接真接）。

## 何时启用

| 场景 | 动作 |
|------|------|
| PRD/arch 外部依赖契约不清，或验收无真路径 | 调研 → 简报 → 候选 + 八维素材 |
| 技术方案/组件/SDK 多选一，影响主路径 | 对比 2–3 方案 + 八维 |
| `docs/arch.md` 依赖节空/薄，失败语义不清 | 补契约与选型素材 |
| code-reviewer / go-fast 命中外部 stub、假成功 | **先调研**；禁 stub 顶替 |
| go-fast「开工前 0.6」盘出 `credential: need/blocked` 的依赖 | 出简报 + smoke 脚本；缺哪个 env 变量名写进 blockers |
| go-fast / loop-goal-prd 契约不明门 | 出简报；`auto_best` 时调用方按八维选定后真接 |
| 用户点名「怎么对接 X / 选哪个库 / 找方案」 | 直接出简报 |

**不要**：替代 code-reviewer 清 stub；把网上方案写成「已实现」；对无关选型的琐碎内部重构做「调研表演」。

## 八维（择优刻度 · 摘要）

对每个**候选方案**打 0–100，总分 = 算术平均；`auto_best` 与简报推荐同尺。八个维度：**最佳长远规划 / 最佳产品体验 / 最佳生产诚实 / 最佳架构边界 / 最佳可靠性 / 最佳可运维 / 最佳安全合规 / 最佳交付可验证**。

硬门槛两条：**依赖 stub/假成功的候选直接淘汰**（生产诚实 = 0）；**无成功 smoke 证据时「生产诚实」「交付可验证」两维各 ≤ 60**（凭据本可得却没打 → ≤ 40）。

逐维取证口径、选定/并列规则、无 smoke 上限全文见 [references/scoring.md](references/scoring.md)。

## 可行性刻度

与 `.dev` `integrations[].credential` 一一对齐（go-fast `external_deps[].credential` 同值）：

| 级 | 含义 | credential | 对 PRD/实现的建议 |
|----|------|-----------|-------------------|
| **A 可公开真接** | 契约清 + 凭据/沙箱已具备 | `have` | **必须真打 smoke**；过了才可排「已实现」 |
| **B 有文档缺环境** | 契约清，缺账号/沙箱/证书 | `need` | 可选定方案 + 先写 smoke 脚本；**unattended 下不得悄悄推进为「已实现」**，只能 `DONE_WITH_CONCERNS` + blockers 列缺哪个 env 变量名；PRD 保持未实现 |
| **C 需人工材料** | 闭源手册/NDA/现场 API | `blocked` | BLOCKED；撤宣称/入口直至材料到位 |
| **D 不建议接入** | 无稳定 API、许可证/安全不可接受 | — | Out of Scope 或换依赖；勿 stub |

## 硬规则

1. **默认只写简报**：产物路径见 [smoke-contract.md](references/smoke-contract.md)；**禁止**把 stub 改成真接。未经确认（或未经调用方 `auto_best` 八维选定）**禁止**修改 `docs/automate/prd*` 业务完成态或业务主路径。  
   - 单独/attended 调用：等人确认再回写 arch/PRD。  
   - 经 go-fast / loop-goal-prd / loop-goal-product 的 `auto_best`：允许调用方按选定方案继续真接；PRD「已实现」仍须真实验收后再诚实回写。
2. **禁止 stub 方案（零例外）**：候选与交付路径**不得**含「先 mock / stub / 假成功 / 内存假后端」；契约不明时 stub **不能**顶替研究或真接。测试双可另述，**不进**生产验收与「已实现」勾选。
3. **证据可追溯**：每个推荐须带官方文档或仓库链接；无公开资料 → 可行性标 **需人工手册/NDA**，状态 **BLOCKED**，建议 PRD 保持未实现或撤入口。
4. **失败诚实性必写**：依赖不可用时的错误/重试/降级；**禁止**「降级仍返回成功」。
5. **首版切片须真实路径**：可缩小范围（如仅鉴权+List），不可降验收标准。
6. **先仓内再外网**：先扫本仓已有适配器/配置/`.dev`；再 WebSearch / 官方 docs / GitHub。
7. **真打优先于文档**：契约要点一写清就落 `contracts/<slug>.smoke.<ext>` 并真跑一次（Phase 3.5）；smoke 未过**不得**出现「已对接 / 已实现」措辞。失败语义须落成代码 + 测试，不是只写进简报。
8. **术语当场钉死**：模糊/冲突称呼当场对齐；决议写入简报「术语对齐」，勿攒到会话末再补。
9. **ADR 稀疏**：仅当「难回退 + 无上下文会惊讶 + 真有取舍」三者同时成立时，才在确认后提议写 ADR；易改的库选择不写。

## references 索引

必读顺序（≤3 次）：本文件 → 模板 → 流程/评分。

| 文件 | 内容 |
|------|------|
| [references/brief-template.md](references/brief-template.md) | 简报模板（Phase 3 按此写盘） |
| [references/phases.md](references/phases.md) | 会话纪律（锐化称呼 / 对账代码 / 场景探针 / 即时落盘）+ Phase 0–5 全流程 + Phase 4 auto_best 口径 + 何时提议 ADR |
| [references/smoke-contract.md](references/smoke-contract.md) | 产物位置表 + Phase 3.5 smoke 约定（路径/内容/打向/凭据/判定）+ evidence-run/gate-check 命令 + 失败语义落地 + 无凭据处理 |
| [references/scoring.md](references/scoring.md) | 八维逐维取证口径、选定与并列规则、无 smoke 上限 |
| [references/research-workflow.md](references/research-workflow.md) | 研究步骤细则：仓内勘察、检索轨 A/B、候选表、场景探针、反模式、与真接交界 |
| [references/handoff.md](references/handoff.md) | 与姊妹 skill 分工表 + 接力顺序 |
| [plan-reviewer/dimensions](../plan-reviewer/references/dimensions.md) | 八维锚点（外部参考） |

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: integration-research
slug: ""
kind: contract | tech_choice | protocol | vendor | hybrid
feasibility: A | B | C | D
credential: have | need | blocked   # 与 .dev integrations[].credential 同值
smoke: ""                 # contracts/<slug>.smoke.<ext>；A/B 级必填
smoke_evidence: ""        # 成功 smoke 工件路径；为空 → 禁止任何「已对接」措辞
failure_semantics_tested: false     # 超时/401/429/幂等四类是否已有测试（非仅写文档）
selected: ""              # 推荐或 auto_best 选定
needs_adr: false          # 难回退选型：true（可事后补）
scores:                   # 选定方案八维；或 candidates[].scores
  long_term: 0
  product: 0
  honesty: 0
  architecture: 0
  reliability: 0
  operability: 0
  security: 0
  verifiability: 0
  total: 0
artifacts:
  - docs/integrations/<slug>.md
  - contracts/<slug>.smoke.<ext>
summary:
  - ""
blockers:
  - ""                    # 缺凭据时须写明 env 变量名 + 获取方式
followups:
  - ""
```

> 上面 `scores.*` 为**集成研究专用八维**，与 plan-reviewer 的八维（`product_ux` / `production_honesty` 等）不是同一套字段名，编排层勿混用。

**喂给 [go-fast](../go-fast/SKILL.md)**：`external_deps[] = {name: <规范名>, credential, smoke: <smoke_evidence>}`；`integration_decisions[].{brief, selected, smoke, failure_semantics_tested}` 直接取本回传同名字段（`smoke` 取 `smoke_evidence`）。

## 红线

- **禁止**将 stub/mock/假成功/测试 mock 列为推荐交付方案或算作集成完成（契约/选型不明时 stub **零例外**不可顶替）
- **禁止**无成功 smoke 工件就宣称「已对接 / 已实现 / 可勾选」；**禁止**拿本地 mock server、Postman 假服务器或录制回放冒充 smoke `[gate: smoke]`
- **禁止**把失败语义只写进简报而不落成代码 + 测试就标 `failure_semantics_tested: true`
- **禁止**事后补研究（实现完再补简报走过场）；正确时机是开工前盘点
- **禁止**跳过八维对照就宣称「最佳方案」（`auto_best` / 简报推荐均须有分）
- **禁止**未确认（且非调用方 `auto_best`）修改 PRD hub/分片、`docs/adr/` 或批量改业务代码
- **禁止**无链接臆造「官方 API」或组件能力
- **禁止**为每个小库选择滥写 ADR（不过稀疏门槛就不提议）
- **禁止**用实现细节填「术语对齐」（术语 = 叫什么；实现 = 怎么接，分节存放）
- 演化无人值守流程**不得**自动把简报验收草案标为「已实现」
