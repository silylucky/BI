# 反过抛（anti-overpolish）

打磨目标：**提高可生产使用的质量与体验**，不是无限微扰。  
单项命中 → 处理清单 `过抛风险=是`，默认不进 go-fast batch（可标 `wontfix` / `deferred`）。  
整环命中 → `stop_reason: overpolish`（当 `overpolish_stop=true`）。

## 何谓该抛（要做）

- 清假绿/stub/半成品入口/硬门槛  
- 主路径补齐空错载、提交反馈、危险确认、权限诚实表面  
- 对齐**本仓**标杆页/菜谱/Token（非另起设计系统）  
- 局部清 seam 泄漏、提高 locality（不改对外契约）  
- 邻域名词/状态/入口明显裂缝且改动面小  

## 过抛清单（不要做）

| 过抛 | 为何有害 | 处理 |
|------|----------|------|
| 重阴影、大渐变、玻璃拟态、装饰图标墙 | 噪、与控制台气质冲突 | 剔除；对齐标杆 |
| 处处微动效 / 无意义 skeleton 循环 | 慢、假精致 | 剔除 |
| 自定义一套间距/圆角「更精致」 | 邻页漂移 | 剔除 |
| 文案玩梗、为改而改的同义替换 | 无任务收益、制造 diff 噪音 | `wontfix` |
| `structural` 架构大搬家 / Speculative 加深 | 风险高、非抛光 | `deferred`；建议单独 arch-reviewer+grilling（`local-deepen` **不**属此列，见下） |
| 发明新功能/新菜单冒充打磨 | 越权当 prd | 标 `capability_gap` 或 `out_of_scope` → `deferred`；转 create-evolution-prd / blueprint；本环禁止实现 |
| 锁定标杆页「再美化」 | 破坏对照真源 | 禁止（回归除外） |
| 纯口味 P2 且 `total` 已 ≥ target | 收益≈0 | 剔除；可整环停 |
| 同一文件簇连续 ≥3 轮改动且 composite `\|Δ\| < plateau_delta` | 震荡/碾差分 | **先按下节判优先级**：未加深过 → 升格加深；加深过仍如此 → 整环 `overpolish` |
| 为抬分改文案/测例断言而不改行为 | 假抛光 | **违规**；判定见下「薄补丁守卫」 |
| 扩大 scope 到报告外模块「顺便重构」 | 失控 | 禁止；邻域只读 |
| 无障碍/性能全面审计范围外的深度优化 | 非本环承诺 | `deferred` |

（视觉过抛与 [create-ui-docs craft「避免抛光过度」](../../create-ui-docs/references/craft.md) 对齐。）

## 与 debt-map 升格的优先级（同一信号，两种解释 · 唯一裁决）

「同一簇反复改却不动分」这条信号，过抛闸读作「震荡，该停机」，债务地图（契约 §14）读作「补丁堆够了，该加深」。  
**顺序是：先加深，后停机。** 停机只是不再打补丁，它不会消除已经堆出来的补丁；先加深才有机会证明「加深之后仍无收益」。

| 该簇状态 | 判定 |
|----------|------|
| `ok` / `escalated`，**尚未**做过 `local-deepen` 加深切片 | **不**判 overpolish。按契约 §14 置 `escalated`；命中该 glob 的 finding 本轮 `deferred: debt_escalated`（**不**计入 `no_fixable_items`）；下一轮插加深切片；ledger 记 `deepen_pending: <簇>`，本轮**不**计入下方闸 2 |
| `deepened`（加深已合回 + ADR 落盘）后**仍**反复改且 `\|Δ\|` 仍 `< plateau_delta` | 判 `overpolish`（闸 2 成立）：加深过了还不动分，才算确在碾差分 |
| 候选被 arch-reviewer 判为 `structural` | 不判 overpolish；`park` 升人，ledger 记 `pending_human_arch`；该簇剩余 finding `deferred` |

**禁止**：用过抛停机绕开一次本该做的加深；把加深切片本身算作「该簇又改了一轮」去凑过抛闸（`refactor-shared` 片不计 `touch_count`，见契约 §14）。

## 薄补丁守卫（under-abstraction · 与过抛对称）

过抛防的是「为求精致改太多」；本节防的是**「为过分而做的最小表面修改」**。命中 → 该 finding **不得**记 `done`。

| 识别要点（命中任一即疑似） | 为什么不算完成 |
|--------------------------|----------------|
| 只改文案 / label / tooltip / 提示语，任务步骤与可达状态不变 | 用户仍做同样的操作、撞同样的死路 |
| 在原调用点加 `if` / 早返回 / 特判绕过，未改状态机、信息结构或权责判定 | 分支越堆越多，同类 finding 必回潮 |
| 只在 UI 层挡住，服务端 / 状态机仍可进入该非法态 | 假修，换个入口即复现 |
| 与本簇上一轮修复**同型**（同一 glob + 同一症状类别）却仍是局部改 | 第 2 次即预警，第 3 次触发 §14 升格 |
| 该 finding 的验收句只能写成「界面上看不到了」，写不出行为 / 状态断言 | 无可测行为差 |

**不算薄补丁（豁免）**：finding 标题/验收就是「空态/副标题/hint/按钮研发口吻」或「主路径暴露字段名/查询参数名/工程黑话（如 `ci_id`、ADR、stub）」——改成 craft §8 用户向人话即完成该 finding；**禁止**用「只是改文案」否决。同义换词抬分、任务死路未消 → 仍按上表否决。

**动作**：编排方在校验回写（契约 §3）时逐条对照；命中 → 状态回 `open`、ledger 记 `thin_patch_rejected: [ID…]`，且该簇 `touch_count += 1`（算触及，不算解决）。  
连续薄补丁是升格**双通道**中的快速通道（与 `touch_count` 慢速通道互补，任一成立即升格）；具体次数与 `deepen_threshold` 的数值真源在[契约 §14](../../go-fast/references/loop-orchestrator-contract.md)，本文不另定义。

## 整环停机闸（过抛）

在 `overpolish_stop=true` 时，任一成立 → 意图 `stop_reason: overpolish`（是否立刻 Phase 5 见下表 + [state-machine.md](state-machine.md) `honor_min_rounds`）：

1. **高原 + 无硬门槛**：满足主 SKILL 高原定义（仅 composite Δ），且可修硬门槛已空，且剩余 open 全是过抛风险/视觉债/P2 口味。  
2. **震荡**：同一路径前缀（目录）在最近 3 个 **Fix 轮**均有合回，且最近 `plateau_composites` 次可计算 composite `|Δtotal| < plateau_delta`，**且**该簇 debt-map 状态已 `deepened`（未加深过 → 先升格，见上节，本闸不成立）。  
3. **目标已达且仅剩过抛项**：`total >= target_score`，且 `fix_scope` 过滤后无可修。  
4. **未达标清单空**：不走本闸提前停；走 [dig.md](dig.md)。dig 只挖出过抛/视觉债/`capability_gap` → 不计挖成功（见 dig.md）。
4. **用户显式**：`不要再抛光了` / `过抛了` → `user_stop` 或 `overpolish`。

| `honor_min_rounds` | 命中闸 1–3 时 |
|--------------------|----------------|
| **`false`（默认）** | **立即** Phase 5 → `DONE_WITH_CONCERNS`，`early_overpolish_stop: true`；**禁止**空转 Review-only |
| **`true`（须用户明示「必须跑满」）** | 若仍有非过抛可修项可继续 Fix；若无可修 → **仍须** Phase 5 停机并记 `min_rounds_unmet` / `overpolish`；**禁止**纯评分凑轮 |

闸 4（用户显式停）**不受** `honor_min_rounds` 阻挡。

## Fix 过滤伪代码

```text
for item in open_items:
  if cluster(item).state == escalated and item.kind != deepen:
      reject → deferred(debt_escalated)      # 不计 no_fixable_items（契约 §14）
  elif hard_gate: keep (priority first)
  elif overpolish_risk: reject
  elif visual_debt and fix_scope != all: reject
  elif classification in (capability_gap, out_of_scope): reject → deferred(capability_gap|out_of_scope)
  elif arch and auth == structural: reject → deferred
  elif arch and auth == local-deepen and cluster.state != escalated: reject → deferred
  elif priority not in fix_scope: reject
  else: candidate
batch = first batch_size candidates
# 加深切片单独成波：不走本过滤、不占 batch_size（契约 §4 refactor-shared）
```

arch 授权级（`polish_safe` / `local-deepen` / `structural`）判定标准以 [arch-reviewer](../../arch-reviewer/SKILL.md)「授权级别」为唯一真源，本文件不另写一套。

## 与 plateau / regression 分工

| stop_reason | 含义 |
|-------------|------|
| `plateau` | 分不动了（可能仍有非过抛债，但收益低） |
| `overpolish` | 明确在做有害/无益微扰或震荡 |
| `regression` | 修坏了，综合分大跌 |

勿把 regression 报成 overpolish。
