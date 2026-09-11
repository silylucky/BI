# Headless Automation Plan — 看板「无间隙」WYSIWYG 与几何压实

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> 日期：2026-07-15  
> 关联：`docs/bugs/BUG-10_dashboard-save-reload-layout-drift_2026-07-15.md` · `docs/bugs/BUG-11_dashboard-gap-zero-still-visible_2026-07-15.md`

## 0. 问题陈述（用户截图 + 对话）

用户将仪表板设为浅绿画布 + 浅蓝组件，并期望 **「无间隙」** 后组件外框贴齐。实际仍可见 **约 8–10px 宽的画布底色条**（截图中绿色条带），与 DataEase「无间隙」心智不符。

| 观察 | 含义 |
|------|------|
| 间隙宽度 ≈ 10px | 高度吻合 `gapPreset=md` → `pixelGutter=5`（双侧 padding 5+5） |
| 底色为画板色非组件色 | 间隙来自 **curGap shell padding** 或 **外框坐标未贴齐**，不是表头/图表内部样式 |
| 多组件一致 | 系统性 gap 配置/几何问题，非单组件样式 |

## 1. 根因分层（代码证据）

### RC-A — DE 间隙模型：padding 与坐标解耦 【设计层 · P0】

DataEase `curGap` 语义（已落地）：

- `x/y/width/height` = **外框**（layout outer rect）
- 视觉间距 = `shape` 外层 `padding: var(--dashboard-shape-gap)`
- `collisionGapPx` 恒为 0 — **改间隙不移动坐标**

证据：

- `fe/src/components/dashboard/componentGapRuntime.ts:18-22`
- `fe/src/index.css:538-542` `.dashboard-shape-gap-shell { padding: var(--dashboard-shape-gap) }`
- `docs/bugs/BUG-10` RC-2

**推论**：用户切「无间隙」仅将 `shellPaddingPx` 置 0；若外框坐标本就有空隙，或运行时仍读 `md`，绿色条带仍会出现。

### RC-B — 运行时间隙仍为非零 【配置层 · P0】

截图 10px 级条带与 `PIXEL_GAP_PRESET_PX.md = 5` 双侧之和高度一致。

可能路径：

1. `styleConfig.gapPreset` 仍为 `md`（未保存 / 未切 none）
2. `layout.styleConfig` 与编辑态 `liveStyle` 不一致（BUG-10 RC-1，R1 已部分修）
3. legacy `widgetGap:8` 经 bootstrap 推断为 `md` + `pixelGutter:5`

证据：`gapPolicy.ts` `gapPresetFields("md")` → `pixelGutter:5`；`resolveComponentGapRuntime(..., "pixel").shellPaddingPx`。

**验收探针**：运行时读取 `data-dashboard-gap-enabled` 与 `--dashboard-shape-gap`（`DashboardStyleSurface.tsx:63,56`）。

### RC-C — 切换无间隙后无几何压实 【几何层 · P0】

BUG-10 RC-6：`collisionGapPx=0`，无 auto-repack。

场景：

1. 用户在 `md` 下拖放，外框相切 → 视觉 10px 间距
2. 切 `none` → padding 0 → **若外框仍相切，视觉应贴齐** ✅
3. 若用户拖放时外框本就有坐标缝（未吸附相切、或按视觉边对齐留下 outer slack）→ 切 `none` 后 **padding 0 仍见画板缝** ❌

证据：`pixelMarkLine.ts` 吸附分 **外框边** 与 **gap 中线**（`collectGapAdjacencyCandidates`）；历史布局可能混合两种对齐习惯。

### RC-D — 保存/重开 WYSIWYG 漂移未完全收口 【持久化 · P1】

BUG-10 Phase 2/3 待执行：

- RC-4 缩放分母与 `canvas.height` 双轨 → 微缩放后间隙观感变化
- 缺 FE↔BE gap golden roundtrip E2E

### RC-E — 用户心智与产品文案差距 【UX · P2】

「无间隙」被理解为「组件蓝色区域贴边」，但产品仅改 padding，不承诺自动收紧历史坐标。缺：

- 切 none 时的「布局收紧」提示或一键操作
- 保存前 dirty 指纹是否含 gap 字段

## 2. 目标与非目标

### 目标（验收）

1. `gapPreset=none` 且已保存 → 编辑/预览/重开 **运行时** `--dashboard-shape-gap: 0px`，`data-dashboard-gap-enabled` 不存在
2. 外框相切的一组组件 → 视觉边 **无画板色条**（允许 1px 级抗锯齿）
3. 从 `md` 切 `none` → 提供 **可选自动压实** 或引导，使常见布局一次到位
4. 回归：gap roundtrip + 几何不变量测试绿

### 非目标

- 重写为「视觉坐标存储」（与 DE 外框模型背离）
- 全画布自动消除重叠（另开 CANVAS-04）
- 栅格 v1 迁移

## 3. 方案总览

```
┌─────────────────────────────────────────────────────────┐
│ GapPolicy（已有）→ shellPaddingPx → CSS padding         │
├─────────────────────────────────────────────────────────┤
│ + GapCompactionService（新增）                          │
│   gap 变小 / none 时：相邻外框吸附、消除坐标缝           │
├─────────────────────────────────────────────────────────┤
│ + GapRuntimeProbe（测试/调试）                          │
│   断言 scope CSS 变量 + 采样 widget 外框间距             │
├─────────────────────────────────────────────────────────┤
│ StylePipeline Phase 2/3（BUG-10 续）                    │
│   缩放单源 + persist golden                             │
└─────────────────────────────────────────────────────────┘
```

## 4. 改动清单

### Phase 0 — 诊断与复现锚点（0.5d）

| # | 文件 | 改动 |
|---|------|------|
| 0.1 | `docs/bugs/BUG-11_dashboard-gap-zero-still-visible_2026-07-15.md` | 登记现象、RC、验收 |
| 0.2 | `fe/src/components/dashboard/gapRuntimeProbe.ts` | 纯函数：`measurePixelLayoutGap(layout, shellPaddingPx)` → 外框缝列表 |
| 0.3 | `fe/src/components/dashboard/gapRuntimeProbe.test.ts` | fixture：相切+padding5 / 相切+padding0 / 坐标缝+padding0 |

### Phase 1 — 配置单源强化（P0 · 1d）

| # | 文件 | 改动 |
|---|------|------|
| 1.1 | `DashboardOverallConfigPanel.tsx` | 切「无间隙」时 `patchStyle` 显式 `gapPreset:none` 双通道清零；可选 toast「需保存后预览一致」 |
| 1.2 | `DashboardEditPage.tsx` | `isDirty` 指纹确认含 `gapPreset/pixelGutter/widgetGap` |
| 1.3 | `stylePipeline.test.ts` | 用例：`none` 保存→hydrate→`shellPaddingPx===0` |
| 1.4 | `backend/tests/test_dashboard_gap_style_config.py` | 增加 `none` roundtrip vector |

### Phase 2 — 间隙压实服务（P0 · 1.5d）

| # | 文件 | 改动 |
|---|------|------|
| 2.1 | `fe/src/components/dashboard/pixelCanvas/gapCompaction.ts` | **新模块** `compactPixelLayoutForGapChange(layout, prevGap, nextGap)` |
| 2.2 | 算法要点 | 对外框图建邻接；`nextGap<prevGap` 时沿轴将 separable 缝收敛至 `nextGap*2` 视觉目标（none→0）；保持最小 120×80；不解决大面积重叠 |
| 2.3 | `gapPolicy.ts` 或 `dashboardOverallConfigPanel` | `buildDashboardGapPatch` 后调用压实（仅 pixel layout v2） |
| 2.4 | `gapCompaction.test.ts` | md→none 两列相切 fixture 缝→0；none→md 仅 padding 变、坐标不变 |

### Phase 3 — 吸附语义收口（P1 · 0.5d）

| # | 文件 | 改动 |
|---|------|------|
| 3.1 | `pixelMarkLine.ts` | `gap===0` 时禁用 `collectGapAdjacencyCandidates`（已有）；文档注释：none 下只吸附外框 |
| 3.2 | `PixelShape.tsx` | 确认 `shapeGapPx` 与 scope CSS 变量同源（已一致，补断言测试） |

### Phase 4 — BUG-10 续（P1 · 1d）

| # | 文件 | 改动 |
|---|------|------|
| 4.1 | `geometry.ts` / `PixelCanvas.tsx` | 画布度量单源（WYSIWYG plan Phase 2） |
| 4.2 | `dashboardPersistRoundtrip.test.ts` | 多 widget JSON fixture 指纹不变 |

### Phase 5 — 体验（P2 · 0.5d）

| # | 改动 |
|---|------|
| 5.1 | 切 none 且检测到外框缝 > 阈值 → 轻提示：「已关闭间隙；是否收紧相邻组件？」 |
| 5.2 | bug-case-library 登记 `fe-dashboard-gap-zero-compaction` |

## 5. 八维度自审

| 维度 | 结论 |
|------|------|
| 1. 范围 | 仅 dashboard gap 策略 + pixel 几何；不改图表域 |
| 2. 依赖 | 依赖 StylePipeline、gapPolicy、PixelCanvas 已有设施 |
| 3. 风险 | 压实算法误移组件 → 限缩为「仅缩小正缝」+ 测试锚点；可 `--no-compact` 开关 |
| 4. 测试 | gapCompaction + gapRuntimeProbe + 既有 gap 测试 |
| 5. 性能 | O(n²) 邻接，n<50 可接受 |
| 6. 安全 | 无 |
| 7. 文档 | BUG-11 + evolution-state + bug-case |
| 8. 回滚 | 压实可 feature flag；pipeline 改动可独立 revert |

## 6. 整体验证方案

```bash
cd fe
npx vitest run \
  src/components/dashboard/gapCompaction.test.ts \
  src/components/dashboard/gapRuntimeProbe.test.ts \
  src/components/dashboard/dashboardGapConfig.test.ts \
  src/components/dashboard/stylePipeline.test.ts \
  src/components/dashboard/pixelCanvas/PixelShape.gap.test.tsx \
  src/components/dashboard/pixelCanvas/pixelMarkLine.test.ts
npx tsc --noEmit
cd ../backend && pytest tests/test_dashboard_gap_style_config.py -q
```

手测（用户截图场景）：

1. 打开看板 → 整体配置 → **无间隙** → 保存 → 硬刷新
2. DevTools：`.dashboard-theme-scope` 上 `--dashboard-shape-gap` 为 `0px`
3. 相邻蓝色组件之间 **无绿色条带**
4. 从「中」切「无间隙」→ 确认提示/自动压实 → 再保存重开一致
5. 编辑 ↔ 预览（未保存/已保存）间隙一致

## 7. 推荐执行顺序

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → 手测
         ↘ Phase 4 可并行（BUG-10 续）
Phase 5 收尾
```

推荐模型：`plan-execute` implementer；Phase 2 完成后 `plan-verify` 对照本节手测。

## 8. 决策点（已按 dev-autopilot 默认策略）

| 决策 | 选择 | 理由 |
|------|------|------|
| none 是否自动压实 | **是（默认可撤销一次）** | 用户「无间隙」心智 = 视觉贴边，仅改 padding 不足 |
| 存储模型 | **保持 DE 外框 + padding** | 与 PRD/已实现投资一致 |
| 重叠布局 | **不自动解开** | 范围控制；提示用户手动调整 |
