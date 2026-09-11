# 难回退选型门禁（强制参考约束）

技术方案 / 架构选型是蓝图的**硬约束输入**，不是成稿后补丁。路选错难纠正、易留历史债务——**先钉选型状态，再锁依赖该选型的主路径图**。

本 Skill **不替代** [integration-research](../../integration-research/SKILL.md) 的多候选八维择优与 smoke；负责：**识别 → 挂证 → 未决显式化 → 门禁状态**。

## 什么算难回退选型

触及任一条即登记（证据袋 `selection_constraints`）：

| 类别 | 例 |
|------|-----|
| **外部契约底座** | 鉴权协议族、消息/对象存储/搜索引擎、厂商 API 形态 |
| **数据与边界** | 系统 of record、跨域数据归属、同步 vs 事件主路径 |
| **部署与运行时** | 单仓/多服务切分、嵌入 vs 旁路、强依赖中间件版本 |
| **难换集成形态** | 官方 SDK vs 自研协议、长连接 vs 轮询作主通道 |

**不算**（勿占配额、勿伪调研）：可逆 UI 文案、同库内表结构微调、纯展示字段、已有 ADR/arch **已钉死且无冲突**的重复确认。

## 状态机

| `status` | 含义 | 可否写进架构图主路径为「已定」 |
|----------|------|--------------------------------|
| `anchored` | 仓内 ADR / arch / 已确认蓝图已钉死，抽检无冲突 | 是 |
| `researched` | 已有 integration-research 简报（+ 推荐或并列），路径在证据袋 | 仅当用户/配额已裁定；否则图旁注「推荐待确认」 |
| `assumed` | 合理默认进假设清单（H#），确认面醒目；用户整包接受才可当约束 | 否（须标假设） |
| `open` | 无锚、无简报、未升人 | **否**；阻塞伪 `DONE` |

## Phase 1 登记（最低）

每个约束一行：

```yaml
selection_constraints:
  - id: S1
    topic: ""                    # 人话：选什么
    hard_reverse: true
    status: anchored | researched | assumed | open
    evidence: []                 # E# / ADR 路径 / 简报路径
    blocks_flows: []             # 依赖它的核心 F id，若有
    action: none | ask | research | assume
```

| `action` | 何时 |
|----------|------|
| `none` | `anchored` 或已裁定的 `researched` |
| `ask` | 难回退 ∧ 仓内无锚 ∧ 改主路径/权责/数据归属 → **优先占提问配额** |
| `research` | 外部契约/多方案不明 → 调 integration-research，简报进证据袋后再写依赖图 |
| `assume` | 配额用尽或 `max_questions=0`；必须 `assumed` + 假设行，**不得**装成已裁定 |

## 门禁（进提纲 / 请确认前）

1. 凡 `blocks_flows` 非空的约束：`open` → **不得**宣称提纲/成稿可确认；升人、调研或降为 `assumed`（带债务说明）。  
2. 任一 `open` 难回退约束仍在 → 回传最多 `DONE_WITH_CONCERNS`（或 `BLOCKED` 若主路径完全不可画）；**禁止**无人值守伪 `DONE`。  
3. `assumed` 必须出现在确认面「假设」且标注 **难回退选型**；用户未确认假设整包 → 不得当已裁定交 `spec`/go-fast。  
4. 架构席：主路径把 `open`/`assumed` 写成既成事实且无标注 → `revise`；关键底座 `open` 仍画死 → 可 `veto`。  
5. **顺序**：先更新 `selection_constraints` 状态，再定稿依赖该选型的架构图/核心 F；禁止「先画完流程再选型」。

## 与提问配额

硬决策定义含：**难回退技术方案/架构选型**（与主流程/权责/数据归属同级）。  
配额内优先问 `action=ask` 的选型，再问其余硬决策；可逆项不得挤占。
