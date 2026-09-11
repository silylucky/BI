---
name: evolution-topic-picker
description: >-
  自我演化 G2 批量选题 subagent 专用技能。只读文档，默认 5 项，结合 PRD 8 维选薄弱项。
  禁止读源码选题。由 evolution-picker 执行。
---

# Evolution Topic Picker

## 硬约束

- **选题只读文档**：`docs/automate/goal.md`、`docs/automate/prd.md`（hub）、`docs/automate/plan.md`（可选）、`docs/automate/evolution-state.md`、`git log -5`
- **`docs/automate/plan.md` 只读**：禁止创建或修改
- **禁止** Grep/SemanticSearch/读源码 用于选题
- 代码扫描选题 → 仅 `evolution-bounded-explorer` 在 G2 不足时执行，且只写待办池，不直接定题
- **禁止读 `docs/automate/prd/` 分片**：G2 选题所需的薄弱项汇总、加权总分、功能索引均在 hub

## 选题顺序

0. **饱和熔断检查**（前置：`docs/automate/plan.md` 存在且当前节有未完成 `[ ]` 项 → **跳过熔断**，直接进入步骤 1）：hub 薄弱项汇总 **Top 5 加权总分均 ≥ 90** 且 `evolution-state.md` 待办池无未消化项
   （未消化项 = `evolution-state.md` 待办池中未勾选的 `[ ]` 条目）。
   薄弱项汇总不足 5 行时按现有全部行判定；汇总为空且 hub 8 维总表加权总分全部 ≥90 同样视为饱和。
   → 回传 `status: BLOCKED`，`blockers: ["SATURATED: 评分饱和，需人工干预"]`，本轮结束；
   summary 中建议人工动作：`create-evolution-plan` 排新里程碑 / `create-evolution-goal` 修订方向 / 立项新功能。
   **禁止**为凑项数派 bounded-explorer
1. **`docs/automate/plan.md` 存在？**
   - **是** → 读**当前里程碑节**（第一个含未完成 `[ ]` 的节）未完成项 → 映射 prd ID
   - **否** → 跳过，直接进入步骤 2
2. 按 **prd 8 维**排序：任一维度分% ≤40 或加权总分最低优先
3. `docs/automate/evolution-state.md` **待办池**同主题补足
4. 仍 <3 项 → 回报 `next: evolution-bounded-explorer`；explorer 完成后**重新执行本技能**
5. **STUCK 标记**：对入选项读 `docs/automate/evolution-state.md`「选题卡住计数」；连续未过轮次 ≥3 的入选项，在 round-target「选题决策」与回传 summary 标 `STUCK: <ID> 连续 N 轮未过 90`，建议人工 `create-evolution-goal` / `create-evolution-plan` 复核验收标准（**非硬阻塞**，仅标注、不改本轮 `status`，仍可入选）

## 批量规则

| 项 | 规则 |
|----|------|
| 目标 | **5 项**，下限 **3**（须写原因） |
| 同节 plan | plan 存在且主项 6–15 文件时，从同节/prd/待办池加小项凑 5 |
| 主项 >15 文件 | 单独成轮，不合并 |
| 上限 | ≤20 文件、≤3 模块；禁止 10 项 |

## 产出

`docs/superpowers/evolution/YYYY-MM-DD-round-target.md`

同时更新 `docs/automate/evolution-state.md`「当前轮次」：

| 字段 | 值 |
|------|----|
| phase | G2_DONE |
| round_target | 本轮 round-target 路径 |
| prd_ids | 本轮入选 prd ID（逗号分隔） |

```markdown
## 本轮演化目标（共 N 项）

### 选题决策
- 批量主题 / 来源 / 合并理由 / 范围框定 / 不足5项原因

### 候选对比
| 候选 prd ID | 加权总分 | 未选原因 |

### 子项 k：<prd ID> <标题>
- 选题理由 / 选题时 PRD 加权总分=/100（价完靠交架测性安各维分%）/ 主攻薄弱维
- 用户感知 / 类型(补缺|创造) / 验收标准
```

## 演化北极星（选题时自检）

1. 用户会感知到什么不同？
2. 补缺还是创造？（创造须符合 docs/automate/goal.md）
3. 不做代价？
4. 能否批处理更小项？
5. 共几项？合计文件/模块？

## 回传

```yaml
status: DONE | BLOCKED
phase: evolution-picker
artifacts: [docs/superpowers/evolution/YYYY-MM-DD-round-target.md]
summary: ["共 5 项", "来源 plan § M4-2 | prd 8维", "最低分 AUTH-003 40.0/100", "STUCK: AUTH-003 连续 3 轮未过 90"]
next: evolution-designer | evolution-bounded-explorer
```

饱和时：

```yaml
status: BLOCKED
phase: evolution-picker
artifacts: []
summary: ["薄弱项 Top5 加权总分均 ≥90，待办池空", "建议: create-evolution-plan 排新里程碑或修订 goal"]
blockers: ["SATURATED: 评分饱和，需人工干预"]
next: null
```
