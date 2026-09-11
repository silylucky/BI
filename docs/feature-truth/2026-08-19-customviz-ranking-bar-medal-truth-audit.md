# Feature Truth Audit：排名条(带序号)-降序（ranking-bar-medal-v1）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-19 |
| 核验范围 | 新入库 artifact `0833b30b-39d4-4a58-80f6-030de7cbe377` / `custom-viz-ranking-bar-medal.json` |
| 锚点 | `docs/api/vs-ai-spec/examples/custom-viz-ranking-bar-medal.json` · `ChartPickerPopover` · `CustomVizWidget` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8.5/10 · A** |
| 状态 | verified |
| **sampling** | `full`（10 条用户期望 T1–T10 全列 §3d） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | POST 入库后 ChartPicker「自定义」出现「排名条(带序号)-降序」磁贴 | 用户诉求 / `00-REQUIREMENTS.md` |
| T2 | 未绑数据时显示「请在右侧绑定数据集与字段」 | PLATFORM-SLA / html 状态机 |
| T3 | 绑定 dimension+metric 后按 **数值降序** 渲染 | 用户诉求 |
| T4 | 前 3 名显示 **rank-1/2/3** 徽章样式 | 用户诉求 |
| T5 | 条形长度随最大值比例 | 用户诉求 |
| T6 | 检查器可编辑 **10 项** styleSchema | 用户诉求 |
| T7 | `maxItems` 限制显示条数 | styleSchema |
| T8 | `valueFormatter` 改变数值展示 | styleSchema |
| T9 | `showAnimation` 控制入场动画 | styleSchema |
| T10 | `showRankBadge=false` 隐藏徽章 | styleSchema |

非目标：DeepTalk 桌面 `custom-viz-ranking-bar-desc.json`；BROWSER 全页走查（本轮未跑）。

## 2. 完整链路图

```text
POST bundle → ai_viz_artifacts (0833b30b…)
  → GET /ai-viz/artifacts → ChartPicker 自定义磁贴
  → 拖入 customViz widget → GET entry HTML
  → mountCustomVizHtml → vsCv.mount → inject payload(rows/style)
  → 降序 + 徽章 + 条形
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | 入库 lint | 通 | `test_official_ranking_bar_medal_passes_lint` 1 passed |
| 2 | API 列表/entry | 通 | GET artifacts 含 uuid；entry 5403B 含 `vsCv.mount` |
| 3 | mount 渲染 | 通 | `customVizHost.examples.test.ts` 降序+徽章+formatter+比例 |
| 4 | 看板拖入+绑数 | **未 BROWSER 验** | 静态：`CustomVizWidget` + `ChartPickerPopover` |
| 5 | 10 项样式 UI | **部分** | manifest 有 schema；无 medal 专用 StyleForm 逐键单测 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据 |
|----|--------|------|---------|------|
| T1 | 入库+列表 | **REAL** | 9/A | POST ok + API list 3 条 |
| T2 | unbound 引导 | **REAL** | 9/A | examples `shows unbound hint for ranking-bar-medal` |
| T3 | 降序 | **REAL** | 10/A | examples 断言 labels `甲,乙,丙,丁` |
| T4 | 前三徽章 | **REAL** | 10/A | rank-1/2/3 + 1×rank-other |
| T5 | 条形比例 | **REAL** | 9/A | examples 断言 fill width 100% vs 10% |
| T6 | 10 项样式面板 | **PARTIAL** | 6/C | schema 在 manifest；通用 Form 未逐键验 |
| T7 | maxItems | **REAL** | 9/A | examples 12 行 → 5 行 |
| T8 | valueFormatter | **REAL** | 9/A | percent 25.0% / thousands 1.5k |
| T9 | showAnimation | **PARTIAL** | 6/C | 测 false 无动画；未验动画 DOM |
| T10 | hide badge | **REAL** | 9/A | showRankBadge false → 0 `.badge` |

## 3b. 前端控件下钻

| ID | 控件 | 期望 | 实际 | 判定 | 证据 |
|----|------|------|------|------|------|
| B1 | ChartPicker 自定义磁贴 | 点击插入 widget | **UI 单测** | REAL | `ChartPickerPopover.test` medal tile click |
| B2 | 检查器绑数据集 | bound 后出图 | **未 medal 专用单测** | PARTIAL | 与演示排名条同路径 |
| B3 | 样式 Tab | 10 项可改 | **未逐键验** | PARTIAL | `CustomVizStyleForm` 通用 |

T 映射：T1→B1；T2–T5→mount 单测；T6–T10→B3

## 3d. 覆盖矩阵

| 实体 ID | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|-------|-----|---------|------|---|---|------|------|
| T1 入库/磁贴 | ✅ lint | ✅ API list | ✅ click | ❌ | CHAIN+UI | 2 | 2 | **REAL** | upload + ChartPicker test |
| T2 unbound | ✅ | ✅ examples | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | unbound hint test |
| T3 降序 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | sort test |
| T4 徽章 | ✅ | ✅ | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | badge class test |
| T5 条形比例 | ✅ | ✅ width 断言 | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | fill width test |
| T6 样式 10 项 | ✅ schema | ❌ | ❌ | ❌ | GATE | 1 | 1 | **PARTIAL** | manifest only |
| T7 maxItems | ✅ | ✅ slice | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | 12→5 rows |
| T8 valueFormatter | ✅ enum | ✅ percent/thousands | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | formatter test |
| T9 showAnimation | ✅ | ⚠️ 测 false | ❌ | ❌ | CHAIN | 1 | 1 | **PARTIAL** | 未验动画 DOM |
| T10 hide badge | ✅ | ✅ no badge | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | showRankBadge false |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 10 |
| REAL 达标 | **8/10**（T1–T5、T7–T8、T10） |
| PARTIAL | 2（T6、T9） |
| STUB/UNVERIFIED | 0 |
| BROWSER | 0 |
| **逐一校验** | **否** — T6 样式面板逐键、T9 动画 DOM、BROWSER 未验 |
| **总体可否 REAL** | **否**（缺 BROWSER + 样式 UI 逐键） |
| **核心可用（拖入+绑数+降序+徽章）** | **是** — T1–T5 REAL + 已入库 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| T3 降序 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL |
| T4 徽章 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL |
| T5 条形比例 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| T6 样式 | 1 | 1 | 2 | 2 | 1 | 7 | B | PARTIAL |
| T8 格式化 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| T10 关徽章 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| B1 磁贴点击 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |

**打通但不对**：0  
**假功能/壳**：无（外部 desc.json 为反例，已弃用）

## 4. 动态验证记录

| 步骤 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|--------|------|
| pytest medal lint | 绿 | 1 passed | ✅ | 2026-08-19 14:55 |
| vitest examples | 17 绿 | 17 passed | ✅ | P1：formatter/badge/maxItems/width |
| vitest ChartPicker | 6 绿 | 6 passed | ✅ | medal tile click |
| GET artifacts | 含 0833b30b… | 3 条（medal+d3+demo） | ✅ | python API |
| GET entry | 含 mount | len 5403, mount true | ✅ | python API |
| ChartPicker 点击 | 出现第三条磁贴 | **UI 单测** | ✅ | `ChartPickerPopover.test.tsx` |

## 5. 修复文档（P1 已完成）

| ID | 缺口 | 修复方向 | 修后验收 |
|----|------|----------|----------|
| P1 | T8 valueFormatter | examples 单测 percent/thousands | ✅ REAL |
| P2 | T10 showRankBadge | inject style false → 无 `.badge` | ✅ REAL |
| P3 | B1 ChartPicker | `ChartPickerPopover.test` mock 含 medal displayName | ✅ REAL |
| P4 | T5/T7 条形与截断 | fill width + maxItems 断言 | ✅ REAL |
| P5 | BROWSER | 绑 demo 数据目视动画 | 待做 — T9 REAL |

## 6. 结论（是否可用）

| 问题 | 答案 |
|------|------|
| **能在 VitalSpan 里用吗？** | **能** — 已入库、entry 可加载、降序+前三徽章经单测验证 |
| **为何之前看不到？** | 外部 AI 只写桌面 JSON，未 POST；协议也不合规 |
| **现在怎么看到？** | 刷新看板 → 自定义 →「排名条(带序号)-降序」→ **绑定数据集** |
| **算 REAL 吗？** | **总体 PARTIAL 8.5/A** — 8/10 子项 REAL；缺样式 UI 逐键与 BROWSER |

## 7. 交接

- P1 单测已落地：`customVizHost.examples.test.ts` + `ChartPickerPopover.test.tsx`
- 可选 P5：BROWSER 走查动画与样式面板逐键
- 外部 desc.json 仍不可用，请使用仓内 `custom-viz-ranking-bar-medal.json`
