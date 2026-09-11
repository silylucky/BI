# Finding 归一（loop-polishing 处理清单）

编排方把各 lane reviewer 产出 **映射**到统一处理清单后，才允许进 go-fast batch。  
列定义见主 SKILL；本文件是映射真源。

## 调用子 skill 时的 mode（强制）

| Skill | polishing 调用 | 行为 |
|-------|----------------|------|
| product-reviewer | 经 loop 编排（含本 skill） | 落盘后**不**等人；不改代码 |
| code-reviewer | `mode: loop-lane` | 只报告；**不停等**；**不** batch-fix |
| ui-ux-reviewer | `mode: loop-lane` | 只报告 + RP；**不停等**；**不**改前端 |
| arch-reviewer | `mode: loop-lane` | Explore + 候选分级（强度 + **授权级**）；**不**开 HTML 点选停问；**不** grilling 改码；升格簇可落 ADR + 出加深切片，改码仍交 go-fast |

修复 **只**经 go-fast（或 go-fast 收尾 CR）。禁止 lane reviewer 在 polishing 环内直接改业务树。

## 复合 lane 执行定义（`ux` / `neighbor` · 唯一口径）

这两个 lane 没有专属 reviewer skill，须按下表执行；**禁止**自行发挥或整读多个 reviewer 全流程（成本翻倍且易过抛）。

### `ux` lane

| 项 | 规则 |
|----|------|
| 跑什么 | **只跑 ui-ux-reviewer**（`mode: loop-lane`），扫描范围**收窄**到 [shell-interaction.md](../../ui-ux-reviewer/references/shell-interaction.md) 关注面：提交/加载反馈、空态与错误态、危险确认、导航可发现性、深链与回退 |
| 不跑什么 | **不**再整跑 product-reviewer（其任务/权责视角属 `product` lane）。仅在某条 finding 需要判断「是否伤害主任务」时，回读**本环最近一份 product 报告**的处理清单对照，不新开评分 |
| 维度归属 | 更新 [dimensions.md](dimensions.md) 维 6（交互反馈）与维 8（UX 闭环）；**不**更新维 1–2 |
| ID 前缀 | `U-`（与 `ui` lane 同源，跨轮继承同一 ID 空间，不另起编号） |
| 视觉债判定 | 纯口味密度/配色 → `视觉债=是`（`fix_scope=all` 时可修；收窄为 `P0+P1` 时不进 batch）；阻断任务完成或让用户误判状态 → `否` |

### `neighbor` lane

| 项 | 规则 |
|----|------|
| 邻域来源 | Phase 0 已写定的 `neighbors: [模块A, 模块B]`（最多 3 个，见 dimensions.md「邻域边界」）；**禁止**本台临时扩大 |
| 跑什么 | **只读抽检**，不整跑任何 reviewer：对每个邻域模块沿「入口菜单 → 主路径一屏 → 与本 `scope` 共享的名词/状态/权限」抽检，每个邻域至多 3 条 finding |
| 找什么 | 双边**裂缝**（同一业务名词两处叫法不同、同一状态两处取值不同、同一权限两处判定不同）、**重复**（两处各写一套本该共享的壳/表单/校验）、**断链**（本 scope 产出的对象在邻域没有入口或反向跳不回来） |
| 改哪边 | 默认**只改本 `scope` 一侧**；确需改邻域一侧 → `过抛风险=是` + `deferred`，建议另开一次 loop 以该邻域为 `scope` |
| 维度归属 | 只更新维 7（邻域契合）；`total` stale |
| ID 前缀 | `N-` |

两个 lane 均须落盘 `…-r<n>.md` 评分台报告并继承清单；无 finding 时照常落盘（记「本台无新增」）并按编排契约 §5.2.1 推进。

## ID 前缀

| 来源 | 前缀 | 示例 |
|------|------|------|
| product / flow | `P-` | `P-1`（可保留原 `B-*` 作别名列，主 ID 仍 `P-*`） |
| code | `C-` | `C-P0-1` 或映射原 `P0-1` → `C-1` |
| ui / ux | `U-` | `U-1`；RP 挂证据列 `RP-3` |
| arch | `A-` | `A-1` |
| neighbor | `N-` | `N-1` |

跨轮 **继承同一 ID**；禁止清空重编号（编排契约 §7）。

## 列映射

| 清单列 | product | code | ui-ux | arch | neighbor |
|--------|---------|------|-------|------|----------|
| 优先级 | 刺点 P0/P1/P2 | finding 级 | finding 级 | Strong→P1；Worth→P2；Speculative→不进 open | 抽检判定 |
| 硬门槛 | 清单列 | 假绿/半成品入口等 → 是 | 有入口半成品/假 KPI/主路径不可用 → 是 | 默认否（架构候选非硬门槛） | 严重裂缝可是 |
| 视觉债 | 清单列 | 纯风格且无可靠性 → 可是 | 纯口味密度/文案 → 是；任务伤害 → 否 | 否 | 否 |
| 过抛风险 | 见 anti-overpolish | 同左 | 重阴影/动效墙等 → 是 | `structural` / Speculative → 是（并 deferred） | 扩大邻域大改 → 是 |
| 状态 | 继承/映射 | 新 finding → open | 同左 | 见下「arch 授权级」 | open/deferred |
| 证据 | 路径/路由 | 路径+行为 | 路由+截图/DOM 描述 | 文件集 + 簇 glob + 摩擦一句 | 双边路径 |

## arch · 授权级三档（**替代**旧的「仅 polish_safe 可进 Fix」二分法）

判定标准以 [arch-reviewer](../../arch-reviewer/SKILL.md)「授权级别」为唯一真源；本表只定「进不进 batch」：

| 授权级 | 强度 | 本环处置 |
|--------|------|----------|
| `polish_safe` | Strong | `open`，**自动**进 Fix（现状不变），无需 ADR |
| `polish_safe` | Worth / Speculative | `deferred` |
| **`local-deepen`** | 任意 | 平时 `deferred: needs_escalation`（报告保留）；该簇 debt-map 状态 `escalated`（契约 §14）时 → **必须**做：落 ADR → 作 `refactor-shared` 加深切片独占一波（不占 `batch_size`） |
| `structural` | 任意 | `deferred` + `park` 升人；unattended **禁止**执行，ledger 记 `pending_human_arch` |

要点：

- **升格是唯一放行 `local-deepen` 的开关**。没升格就自动加深 = 越权；升格了却不做 = 补丁永远堆下去（正是本环要治的病）。  
- 加深切片的完成判定见契约 §4：不产出新 `done` finding、**禁止**拿它抬 `Δtotal`；解除升格见 §14。  
- 无 ADR → **禁止**开工（缺 ADR 时该簇维持 `escalated`，记 `blocked`）。

## 硬门槛并集

任一路径标 `硬门槛=是` 且 `open` → 综合 `total` 上限 69（dimensions.md）；Fix 必须优先清这些 ID。

## go-fast 回写

- `source_report` = 发起本批 Fix 时的打磨报告路径（通常上一评分台 `…-r<n>.md`）  
- `summary` = 已处理清单 ID（`P-`/`C-`/…）  
- 过抛剔除、未开工项 **禁止**标 `done`  
- 下一评分台继承清单；`done`→`verified` 或回潮 `open`
