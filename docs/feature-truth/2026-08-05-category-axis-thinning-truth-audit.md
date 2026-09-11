# Feature Truth Audit: 类别轴抽稀（单维 + 分层）对标 DataEase

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | 笛卡尔图 X 轴类目抽稀：单维（省/区县）与多维分层轴；含百分比堆叠柱图真机场景 |
| 锚点 | `axes.ts` · `hierarchicalAxis.ts` · `sceneGraph.ts` · `renderBar.ts` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **5/10 · D** |
| 状态 | draft |
| **sampling** | `full`（本功能相关子能力全列） |

## 1. 核验标准与预期（来自对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 单维类目轴：抽稀后标签**均匀铺满**至右端，无「有柱无字」大段空白；最长标签在间距允许时**完整展示** | 用户截图 +「参考 dataease」 |
| T2 | 单维类目轴：旋转标签**中心对齐**对应柱位，不左偏 | 用户截图 16:22 |
| T3 | 多维分层轴：同索引各层**同显同隐**，垂直对齐，不错位/不感数据缺失 | 对话「抽都抽」 |
| T4 | 百分比堆叠柱 Y 轴：0–100% 刻度可读（非重复 `0`/`1`） | 用户截图 16:22 |
| T5 | 修后编辑器真机目视验收通过 | feature-truth 铁律 |

- 非目标：44 型样式 Tab 全量；地图类

## 2. 完整链路图

```
categories → planCategoryAxisLayout / pickSynchronizedVisibleIndices
  → drawCartesianBandAxes (d3.axisBottom.tickValues)
  → applyRotatedCategoryLabels → SVG text
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|-----|------|---------|------|
| 1 | 抽稀算法 | 通 | `axes.test.ts` 15 passed | 像素取点 + 首尾必留 |
| 2 | 分层同步抽稀 | 通 | `hierarchicalAxis.test.ts` 13 passed | 按索引同步 |
| 3 | 柱图接线 | 通 | `renderBar.test.ts` tiered 1 case | 仅多维，无单维抽稀断言 |
| 4 | 轴绘制对齐 | **断** | 代码审阅 | d3 刻度在 band **左缘**，非中心 |
| 5 | 百分比 Y 轴格式 | **断** | 代码审阅 + 数值推演 | `isPercent` 未强制 percent format |
| 6 | 真机预览 | **未达标** | 用户截图 16:22 | 21 柱仅 ~14 标签、左偏、Y 轴 0/1 重复 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 单维抽稀无大间隙 | PARTIAL | 5/D | 算法有意跳过索引；640px×21 省 → 13 标签，用户见 14/21 |
| T2 | 标签柱位对齐 | BROKEN | 3/D | `axisBottom` + `text-anchor:end` 锚在 band 左缘 |
| T3 | 分层同步抽稀 | PARTIAL | 6/C | CHAIN 有；最新同步逻辑无 BROWSER |
| T4 | 百分比 Y 轴刻度 | BROKEN | 2/F | `decimals=0` 把 0.2–0.8 格式成 0 |
| T5 | 真机验收 | UNVERIFIED | 1/F | 无 MCP/browser 复验记录 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 类别轴拖 1 维 | `ChartDataSlots` | T1+T2 | 有间隙、左偏 | 2 | 0 | 1 | 2 | 2 | 5 | PARTIAL | 截图 16:22 |
| B2 | 类别轴拖 4 维 | 同上 | T3 | CHAIN 通；真机未复验 | 2 | 1 | 2 | 2 | 1 | 6 | PARTIAL | 单测 + 早前截图 |
| B3 | 百分比堆叠柱 | `renderBar isPercent` | T4 | Y 轴 0,0,0,1,1,1 | 2 | 0 | 1 | 1 | 2 | 4 | BROKEN | 截图 + `formatMetricValue` |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| axes-single-thinning | 单维抽稀算法 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `axes.test.ts`；无对齐/真机 |
| axes-band-center | band 中心对齐 | ❌ | ❌ | ❌ | NONE | 1 | 0 | BROKEN | `sceneGraph` 仍用 `d3.axisBottom` |
| hierarchical-sync | 分层同步抽稀 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `hierarchicalAxis.test.ts` |
| percentage-bar-stack | 百分比柱单维 | ❌ | ⚠️ | ❌ | GATE | 1 | 0 | BROKEN | 无单测；截图 Y+X 均错 |
| percentage-bar-stack-4dim | 百分比柱 4 维 | ❌ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | 共用 renderBar；无真机 |
| bar-stack / line / area | 其他笛卡尔 | ❌ | ⚠️ | ❌ | GATE | 1 | 0 | STUB | 共用轴逻辑未逐型 UI 验 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| GATE only | 1 |
| CHAIN | 3 |
| UI / BROWSER | 0 |
| NONE / BROKEN | 2（对齐、真机） |
| REAL 达标 | 0/6 |
| **逐一校验** | **否** — 单测 28/28 绿，但真机 0/6；对齐与 Y 轴格式未修 |
| **总体可否 REAL** | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| B1 | 2 | 0 | 1 | 2 | 2 | 5 | D | PARTIAL | 打通但间隙+错位 |
| B2 | 2 | 1 | 2 | 2 | 1 | 6 | C | PARTIAL | 分层 CHAIN 无 UI |
| B3 | 2 | 0 | 1 | 1 | 2 | 4 | D | BROKEN | Y 轴格式错 |
| T1–T5 综合 | — | — | — | — | — | **5** | **D** | **PARTIAL** | L≥2 但 C=0 多项 |

**打通但不对**（L≥2 且 C≤1）：B1、B3、T1、T2、T4

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest axes + hierarchicalAxis` | 全绿 | 28 passed | ✅ | 2026-08-05 16:24 |
| 2 | 模拟 21 省 × innerW=640 抽稀 | 均匀、右端有字 | **13/21** 索引，故意跳过粤/豫等 | ❌ | node 推演 |
| 3 | 模拟 21 省 × innerW=900 | 更多标签 | 18/21，仍有 3 个间隙 | ⚠️ | node 推演 |
| 4 | 审阅 `drawCartesianBandAxes` | 标签在 band 中心 | `d3.axisBottom` 刻度在 band **起点**；旋转后 `text-anchor:end` 更左偏 | ❌ | `sceneGraph.ts:372-383` |
| 5 | 审阅 `formatMetricValue` + `isPercent` | 0–100% | `decimals=0` → 0.2–0.8 显示为 `0` | ❌ | `dashboardStyleConfig.ts:1036-1041` |
| 6 | 用户真机截图 | T1–T4 | 14/21 标签、左偏、Y 0/1 重复 | ❌ | 截图 16:22 |
| 7 | MCP browser 复验 | 目视通过 | **未执行** | — | — |

## 5. 修复文档（P0，待批准）

### P0-1 — X 轴标签未对齐柱中心（T2 / B1）

**判定**：BROKEN（C=0）  
**根因**：`scaleBand` 的 `axisBottom` 将 text 锚在 band 左缘；`applyRotatedCategoryLabels` 设 `text-anchor:end`，旋转 -45° 后视觉更偏左。  
**修复方向**（对标 DataEase）：

- 方案 A：自定义类目轴，text `x = xScale(cat) + bandwidth/2`（与 `hierarchicalAxis.bandCenterPx` 一致）
- 方案 B：`tickSize` 回调 + `transform` 将 tick 文本平移 `+bandwidth/2`

**验收**：21 省百分比柱，标签中心与柱中心偏差 < 2px（截图或单测 SVG `x` 属性）。

### P0-2 — 单维抽稀仍有「有柱无字」间隙（T1 / B1）

**判定**：PARTIAL（C=1）  
**根因**：`effectiveMinPx = max(48, maxLabelW+12)` 对长省名过保守；overlap 过滤按序丢弃中间索引，不保证「视觉等距感」。  
**修复方向**：

- 旋转已启用时，用旋转后水平投影宽度，且 `minPx` 上限封顶（如 72px）避免只剩十几个刻度
- 或 DataEase 策略：**固定步长索引** `step = ceil(count / maxTicks)`，显示 `0, step, 2*step, …, last`，保证分布可预期
- 间隙处用户接受「隐藏」但需**分布均匀**（像素 gap 方差小）

**验收**：640px×21 省，标签数 ≥15 或像素间距方差 < 阈值；右端最后一个省可见。

### P0-3 — 百分比堆叠柱 Y 轴刻度（T4 / B3）

**判定**：BROKEN（C=0）  
**根因**：`isPercent` 仅归一化数据到 [0,1]，未设置 `valueFormat.type = 'percent'`；默认 `decimals=0` 使 0.2→`0`。  
**修复方向**：`renderBar.ts` 在 `isPercent` 时合并 `valueFormat: { type: 'percent', decimals: 0 }`（或 1）。  
**验收**：Y 轴显示 `0% 20% … 100%` 或 `0 0.2 … 1`（按产品约定）。

### P0-4 — 分层轴真机复验（T3 / T5）

**判定**：UNVERIFIED  
**修复方向**：MCP browser 走查 4 维柱图，断言四层同索引对齐。  
**验收**：截图归档 + 可选 SVG 单测断言同行 `x` 一致。

## 6. 结论（回答「真的完成了吗？」）

**没有完成。**  

| 维度 | 状态 |
|------|------|
| 单测 | ✅ 28 项通过（算法层 CHAIN） |
| 真机正确性 | ❌ 用户 16:22 截图仍不符合 T1–T4 |
| 可标 REAL | ❌ L≥2 但 C 多项为 0；无 UI/BROWSER 深度 |
| 与「对标 DataEase」 | ❌ 对齐、Y 轴格式、间隙观感均未达标 |

**建议下一步**（需用户批准）：按 P0-1 → P0-3 → P0-2 → P0-4 顺序修复，每项附 vitest + 真机截图复验后再更新本审计状态。
