# 证据袋（Phase 1 产出）

深扫仓后必须形成可引用的证据袋，供提纲「依据」列、智囊团与确认面使用。  
可选落盘：`docs/material/blueprints/<YYYY-MM-DD>-<slug>-evidence.md`（长跑/无人值守建议落盘）。

难回退选型登记与门禁全文见 [selection-gate.md](selection-gate.md)。

## 强度

| `domain_strength` | 含义 | 后果 |
|-------------------|------|------|
| `strong` | 仓内领域/招标/客户文档或权威公开惯例可支撑主路径 | 可正常确认 |
| `mixed` | 部分有锚、部分靠合理推断 | 推断项必须进假设清单 |
| `weak` | 几乎无领域锚，主靠通用 SaaS 想象 | 确认面大红提示；无人值守 → 最多 `DONE_WITH_CONCERNS`；领域席不得假 pass |

外部契约不清或难回退多方案未比 → 调 [integration-research](../../integration-research/SKILL.md)，把简报路径写入证据袋与 `selection_constraints`，勿在蓝图里编造协议细节或伪选定。

存在 `selection_constraints[].status=open`（且 `blocks_flows` 非空或影响架构主边）→ 不得伪 `DONE`；最多 `DONE_WITH_CONCERNS` / `BLOCKED`。

## 结构（YAML 或等价表）

```yaml
scope: ""
scanned_at: YYYY-MM-DD
domain_strength: strong | mixed | weak
selection_constraints:
  - id: S1
    topic: ""
    hard_reverse: true
    status: anchored | researched | assumed | open
    evidence: []           # E# / ADR / docs/integrations/<slug>.md
    blocks_flows: []
    action: none | ask | research | assume
items:
  - id: E1
    path: docs/arch.md
    kind: arch | prd | ui | api | domain | adr | code | spec | public | integration
    note: "一句：与本 scope 哪段相关"
  - id: E2
    path: https://…
    kind: public
    note: "业内惯例：…；检索日 YYYY-MM-DD"
gaps:
  - "缺什么事实；已进假设 H? 或待硬决策 Q? 或选型 S?"
```

## 引用纪律

1. 场景对照表「依据」列写 `E#` 或短路径，禁止「常识」二字空挂。  
2. 选型约束「证据」列写 `E#` / ADR / 简报路径；`assumed` 必须同时有假设 H#。  
3. 智囊团派发时粘贴证据袋**摘要**（≤15 条）+ `selection_constraints` 全表；全文可给路径。  
4. 回传 YAML 可带 `evidence_ref` 与 `selection_gate`。  
5. **禁止**把未扫过的路径写进依据装样子；**禁止**无简报却写 `researched`。
