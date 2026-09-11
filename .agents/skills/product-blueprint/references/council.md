# 六席智囊团协议

主编排负责合并；席位用 **并行 Task/subagent**（[seat-prompts.md](seat-prompts.md)），**不传 model**（继承会话）。

## 防演戏（强制）

| 规则 | 说明 |
|------|------|
| **独立 Task** | 提纲阶段①：须为每个**出席**席位各开 Task；**禁止**主编排分饰六角写假投票 |
| **可定位** | `reasons` / `must_fix` 须落到章节号或表行；空 reasons 的 `pass` 无效 → 重派 |
| **合并透明** | 合并说明列出每席 vote + 采纳/驳回；驳回否决类 must_fix 须理由 |
| **痕迹** | 回传 `council.seats` 填真实结果；无人值守亦同 |

## 席位

| # | 席位 | id | 视角 | 对齐 |
|---|------|-----|------|------|
| 1 | **产品** | `product` | JTBD、主路径、例外、权责、F 预算、场景对照 | product-reviewer 刻度（不落其报告） |
| 2 | **规划** | `plan` | 长远、生产诚实、可验证；禁 stub/MVP | plan-reviewer 八维精神 |
| 3 | **架构** | `architecture` | 模块/数据归属、缝、**难回退选型门禁**、ADR 需求 | arch 边界；[selection-gate.md](selection-gate.md) |
| 4 | **运维审计** | `ops_audit` | 权限、审计、可观测、失败可恢复 | 企业运维面 |
| 5 | **终端用户** | `end_user` | 认知负荷、人话、图是否好懂、禁套卡 | craft；[diagrams.md](diagrams.md) |
| 6 | **领域实践** | `domain` | 业内做法、真情境；**图是否像真业务** | 证据袋 + 检索；**独立否决权** |

## 缩席（仅小 scope）

默认六席全开。同时满足才可缩席：

- scope 为**单页文案/单接口契约说明**，无新主业务状态机；且  
- 不涉及外部系统真接、不涉及权责/合规变化、**不涉及新的难回退技术方案/架构选型**  

| 可合并 | 不可省略 |
|--------|----------|
| `end_user`∪`product` → 一席（id 仍分开回传或标 `product+end_user`） | **`domain` 不可省略** |
| `architecture` 可标 `N/A`（合并说明写「无新边界且无新选型」） | 有写操作时 **`ops_audit` 不可省略**；有新难回退选型时 **`architecture` 不可 N/A** |

缩席须在 Card / 合并说明写明理由。灰色地带 → 不缩。

## 每席回传（强制短）

```yaml
seat: product | plan | architecture | ops_audit | end_user | domain
phase: outline | draft
vote: pass | revise | veto
reasons: []
must_fix: []
scenario_ok: true|false   # 产品/领域必填
diagrams_ok: true|false   # 建议：终端用户/产品/领域
selection_ok: true|false  # 架构必填：选型门禁是否过
```

## 投票规则

| 规则 | 说明 |
|------|------|
| **通过** | `pass`，或 `revise` 且主编排已吸收 must_fix |
| **否决门槛** | 任一座对以下 `veto` → 不得进下一阶段：主路径验收不诚实；权责黑洞；**无业内/场景锚点的主路径**（领域席）；关键写操作无审计/不可恢复且无说明；**关键底座选型仍为 `open` 却画成已定**（架构席） |
| **缺图 / F 爆量** | 无架构图、核心 F 缺流程图、图文严重不一致、核心 F>5 未进附录 → 至少 `revise`；假流程图 → 领域可 `veto` |
| **选型门禁** | `selection_ok=false` → 至少 `revise`；见 [selection-gate.md](selection-gate.md) |
| **弱证据** | `domain_strength=weak` 时领域席禁止无依据 `pass` |
| **轮次** | 提纲最多 **2** 轮；成稿 **1** 轮增量；僵持 → 升人（占配额）或 `DONE_WITH_CONCERNS` |
| **禁止** | 为凑票降级 demo 验收；无视领域/架构否决强行出稿；一人分饰 |

## 两阶段与 Token 经济

### 阶段① 提纲

输入：短提纲（outline-template）。  
目标：钉死场景、流程机、权责、页面清单、权限审计要点、**图**——大推翻发生在这里。  
派席：出席席位**全量**独立 Task。

### 阶段② 成稿（增量复评）

输入：完整文；派发时优先给**相对提纲的 diff / 变更章节列表**（见 seat-prompts 增量前缀）。  

| 默认必派 | 按需加派 |
|----------|----------|
| `product` + `plan` | 图或主路径有变 → `domain` + `end_user` |
| | 权限/审计段有变 → `ops_audit` |
| | 边界/外部依赖/**选型约束**有变 → `architecture` |

未派席位在合并说明写 `skipped_reason: unchanged_from_outline`。  
**禁止**在成稿轮引入提纲未出现的新**核心**主流程（要引入 → 退回提纲①）。  
附录 F 可在成稿补充，但确认面不展开；新增附录不触发全席重投，除非用户把某附录升为核心 F（L2）。

## 合并说明最低字段

```yaml
outline_round: 1|2
draft_review: full_incremental
seats:
  product: { vote: pass, absorbed: [] }
  domain: { vote: revise, absorbed: ["…"], rejected: [] }
skipped: { architecture: "unchanged_from_outline" }  # draft 轮
```
