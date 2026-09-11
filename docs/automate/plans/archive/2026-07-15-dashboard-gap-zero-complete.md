# Headless Automation Plan — 看板「无间隙」根治（R2 完整方案）

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> 日期：2026-07-15  
> 前置：`2026-07-15-dashboard-gap-zero-compaction.md`（R1 已合入，用户仍反馈绿条）  
> Bug：`docs/bugs/BUG-11_dashboard-gap-zero-still-visible_2026-07-15.md`

## 0. 需求契约（dev-autopilot 编译）

| 字段 | 值 |
|------|-----|
| type | bugfix |
| goal | 用户选「无间隙」后，相邻组件视觉边贴齐，**无画板底色条**；编辑/预览/保存/重开一致 |
| scope_include | `gapPolicy` · `stylePipeline` · `gapCompaction` · `gapRuntimeProbe` · `prepareDashboardLayout` · `DashboardLayoutPreview` · `DashboardEditPage` · `PixelShape` CSS |
| scope_exclude | 图表内部样式 · 全画布重叠消解 · 栅格 v1 新特性 |
| acceptance | 本节 §6 命令全绿 + 手测 5 步 |
| risk_level | medium |
| autonomy_policy | auto_accept_low_risk |

## 1. 现象再确认（用户截图 2026-07-15）

| 观察 | 技术含义 |
|------|----------|
| 各组件交界处 **十字形** ~8–10px 绿条 | 系统性间隙，非单组件 bug |
| 绿条 = 画板底色（`--dashboard-artboard-bg`） | 来自 **shell padding 透明区** 或 **外框坐标缝** |
| 宽度 ≈ 10px | 与 `gapPreset=md` → `pixelGutter=5` **双侧之和**高度吻合 |

**关键推论**：仅凭肉眼无法区分「配置仍为 md」与「配置 none 但外框有 10px 坐标缝」——必须 **双通道诊断**（`analyzeDashboardGapLayout`）。

## 2. 根因分层（R2 深化 · 含代码证据）

### RC-A — DE 双通道间隙模型 【设计 · 不可删】

| 通道 | 机制 | 证据 |
|------|------|------|
| **配置通道** | `shellPaddingPx` → CSS `padding: var(--dashboard-shape-gap)` | `componentGapRuntime.ts:29-34`, `index.css:539-542` |
| **几何通道** | `x/y/width/height` 外框坐标；`collisionGapPx=0` | `componentGapRuntime.ts:21`, `collisionLayout.ts` |

视觉缝宽 ≈ `outerGapPx + 2 × shellPaddingPx`（`gapRuntimeProbe.estimateVisualGapPx`）。

### RC-B — 运行时仍为 md（配置未生效）【P0 · 最可能】

用户见 ~10px 且外框已相切 → **几乎确定 `shellPaddingPx=5`**。

失效路径：

1. 切了「无间隙」但 **未保存**，刷新后 `layout.styleConfig` 仍为 legacy `widgetGap:8` → bootstrap 推断 `md`（`gapPolicy.ts:155-158`）
2. `resolveEffectiveDashboardStyle` 在只读路径仅读 `layout.styleConfig`，无 liveStyle（分享页 `DashboardSharePage`）
3. 后端存了 `gapPreset:none` 但 FE hydrate 前仍有 `pixelGutter:5` 残留字段 → normalize 应清零，需 golden 向量守护

### RC-C — 外框坐标缝未压实 【P0 · R1 未全覆盖】

R1 仅在 `DashboardEditPage.applyStyleConfig` 压实 → **预览/分享/列表卡片** 未走同路径。

| 消费方 | R1 前 | R2 目标 |
|--------|-------|---------|
| `DashboardEditPage` load | ❌ 后补 | `prepareDashboardLayout` |
| `DashboardLayoutPreview` | ❌ | `preparePixelLayoutForDisplay` |
| `persistDashboardLayout` | ❌ | 保存前压实 |
| `DashboardSharePage` | ❌ | 经 `prepareDashboardLayout` / Preview |

压实算法局限（R1）：

- 只拉 **右/下** 邻居，复杂网格需多轮
- `CROSS_AXIS_OVERLAP_MIN=2`：行高错位组件不视为邻居
- 不处理 **重叠** 块（设计如此）

### RC-D — v1 迁移遗留坐标缝 【P1】

`migrateDashboardLayoutV1` 用 `PIXEL_ROW_MARGIN=12`  baked 进 y/height（`dashboardCanvasMode.ts:44-45`）。迁移后外框缝可能为 12px 级，与 md padding 叠加后更明显。

### RC-E — 吸附语义历史混合 【P1】

`pixelMarkLine.ts` 在 `gap>0` 时同时吸附 **外框边** 与 **间隙中线**（`collectGapAdjacencyCandidates`）。历史布局可能按中线对齐，切 none 后外框缝残留。`gap=0` 时已禁用中线吸附（`:268-276`）。

### RC-F — 缩放双轨（BUG-10 续）【P2】

画布缩放分母与 `canvas.height` 不一致 → 亚像素级「假缝」。不解释统一 10px 十字缝，但影响验收「1px 抗锯齿」边界。

### RC-G — 产品心智差距 【UX · P2】

「无间隙」用户期望 = **蓝色视觉边贴齐**；产品实现 = padding 归零 +（可选）坐标压实。缺运行时反馈：用户不知绿条来自配置还是几何。

## 3. 诊断决策树（实施/手测必用）

```
用户见绿条
  ├─ DevTools: --dashboard-shape-gap > 0 ?
  │    ├─ 是 → RC-B：强制 none + 保存 + 查 layout.styleConfig
  │    └─ 否 → 继续
  ├─ analyzeDashboardGapLayout().hasCoordinateGaps ?
  │    ├─ 是 → RC-C：压实 / 手动拖齐外框
  │    └─ 否 → 查圆角/边框/缩放 (RC-F)
  └─ 编辑 vs 预览 不一致 ?
       └─ RC-C 路径未统一 → 查 prepareDashboardLayout / Preview
```

## 4. 方案总览（R2）

```
                    ┌─────────────────────┐
                    │   GapPolicy (已有)   │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
 ┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
 │ GapRuntime    │   │ GapCompaction   │   │ StylePipeline    │
 │ Probe 诊断    │   │ v2 压实算法     │   │ load/save 单路径 │
 └───────────────┘   └─────────────────┘   └──────────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                    prepareDashboardLayout
                    DashboardLayoutPreview
                    persistDashboardLayout
                    applyStyleConfig (即时)
```

## 5. 改动清单

### Phase R2-1 — 单路径压实（P0）✅ 已启动

| # | 文件 | 改动 |
|---|------|------|
| 1 | `stylePipeline.ts` | `persistDashboardLayout` 保存前 `compactPixelLayoutWhenZeroGap`；导出 `preparePixelLayoutForDisplay` |
| 2 | `dashboardCanvasMode.ts` | `prepareDashboardLayout` v2/migrate 后 `preparePixelLayoutGeometry` |
| 3 | `DashboardLayoutPreview.tsx` | `displayLayout` 经 `preparePixelLayoutForDisplay` |
| 4 | `gapRuntimeProbe.ts` | `analyzeDashboardGapLayout` 诊断 API |
| 5 | `DashboardEditPage.tsx` | 去重 load/save 压实；切 none 时 toast 区分配置/几何 |

### Phase R2-2 — 压实算法 v2（P0 · 待执行）

| # | 改动 |
|---|------|
| 1 | `gapCompaction.ts`：`compactGridLayout` 多轮双向扫描；`CROSS_AXIS_OVERLAP_MIN` 降为 1 或用 overlap 比例 |
| 2 | 按 `measurePixelLayoutOuterGaps` 结果 **按缝宽降序** 逐条关闭 |
| 3 | 迁移布局专用：`compactMigratedV1Layout` 识别 12px 行距缝 |
| 4 | 测试：3×3 网格、错位行、v1 迁移 fixture |

### Phase R2-3 — 配置 WYSIWYG 硬门（P0 · 待执行）

| # | 改动 |
|---|------|
| 1 | `applyStyleConfig`：切 none 后断言 `resolvePixelGutter(next)===0`，否则 toast 错误 |
| 2 | `persistDashboardFingerprint` 含 gap 字段；dirty 未保存提示 |
| 3 | `DashboardOverallConfigPanel`：显示运行时 `shellPaddingPx`（仅 dev 或 `data-testid`） |
| 4 | 后端 + FE golden：`none` 向量禁止 `pixelGutter>0` 回写 |

### Phase R2-4 — 体验与可观测（P1 · 待执行）

| # | 改动 |
|---|------|
| 1 | 切 none 且 `analyzeDashboardGapLayout.estimatedMaxVisualGapPx > 2` → 提示「已收紧 N 处外框缝，请保存」 |
| 2 | bug-case-library：`fe-dashboard-gap-zero-compaction` |
| 3 | BUG-11 各 RC 状态逐条勾选 |

### Phase R2-5 — BUG-10 续（P2 · 可并行）

缩放单源、`dashboardPersistRoundtrip.test.ts` 多 widget fixture。

## 6. 整体验证方案

```bash
cd fe
npx vitest run \
  src/components/dashboard/pixelCanvas/gapCompaction.test.ts \
  src/components/dashboard/gapRuntimeProbe.test.ts \
  src/components/dashboard/dashboardGapConfig.test.ts \
  src/components/dashboard/stylePipeline.test.ts \
  src/components/dashboard/dashboardCanvasMode.test.ts \
  src/components/dashboard/DashboardLayoutPreview.test.tsx \
  src/components/dashboard/pixelCanvas/PixelShape.gap.test.tsx
npx tsc --noEmit
cd ../backend && pytest tests/test_dashboard_gap_style_config.py -q
```

手测：

1. 打开多组件看板 → 整体配置 → **无间隙** → 应 toast「已关闭组件间隙」或「已收紧…」
2. DevTools：`.dashboard-theme-scope` → `--dashboard-shape-gap: 0px`；无 `data-dashboard-gap-enabled`
3. 相邻组件 **无绿色十字条** → **保存** → 硬刷新 → 仍无
4. 编辑态 ↔ 预览态（`mode=view`）一致
5. 从「中」切「无间隙」→ 绿条应立即消失（配置通道）；若仅变窄未消失 → 保存后再查（几何通道）

## 7. 八维度自审

| 维 | 结论 |
|----|------|
| 范围 | dashboard gap + pixel 几何；不动图表域 |
| 依赖 | StylePipeline、gapPolicy、PixelCanvas |
| 风险 | 压实误移 → 限「仅关正缝」+ fixture；可 feature flag |
| 测试 | probe + compaction + pipeline + canvasMode |
| 性能 | O(n²) n<50 OK |
| 安全 | 无 |
| 文档 | BUG-11 + evolution-state + bug-case |
| 回滚 | R2-1 可独立 revert |

## 8. 推荐执行顺序

```
R2-1（单路径）→ 手测 → R2-2（算法）→ R2-3（配置门）→ R2-4（UX）
R2-5 与 R2-2 可并行
```

推荐模型：plan-execute implementer；R2-2 完成后 plan-verify 对照 §6 手测。
