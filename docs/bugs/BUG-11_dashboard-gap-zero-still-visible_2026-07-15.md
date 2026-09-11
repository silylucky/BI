# BUG-11 看板设「无间隙」后仍可见画板色条

> 状态：**R2 剖析完成 · R2-1 已合入 · R2-2~4 待执行**  
> 类型：WYSIWYG / gap 几何 + 配置双通道  
> Plan：`docs/automate/plans/2026-07-15-dashboard-gap-zero-complete.md`（R2 完整）  
> 前置 Plan：`docs/automate/plans/2026-07-15-dashboard-gap-zero-compaction.md`（R1）

## 现象

| 项 | 描述 |
|----|------|
| 用户操作 | 仪表板配置 → 整体配置 → **无间隙** |
| 期望 | 相邻组件外框/视觉边贴齐，无画板底色（浅绿）条带 |
| 实际 | 组件十字交界处仍有 **~8–10px** 绿条（2026-07-15 多组件截图） |
| 特征 | 各方向缝宽一致 → **系统性** gap，非单 widget 样式 |

## 失败时序（重建）

```
1. 布局在 md/legacy widgetGap 下完成，或外框按间隙中线吸附
2. 外框 x/y/w/h 持久化（collisionGapPx=0）
3. 用户切「无间隙」→ gapPreset:none（若未保存则刷新丢失）
4. 若 shellPaddingPx 仍=5 → 双侧 padding 露出 10px 画板色（RC-B）
5. 若 shellPaddingPx=0 但外框坐标有缝 → 同样露画板色（RC-C）
6. R1 压实仅 EditPage.applyStyleConfig → 预览/分享/列表未压实（RC-C2）
```

## 根因矩阵

### RC-A — DE 双通道模型 【设计 · 已知】

- **配置通道**：`shellPaddingPx` → `.dashboard-shape-gap-shell { padding }`
- **几何通道**：外框坐标缝（改间隙不移动组件）
- 视觉缝 ≈ `outerGap + 2×shellPadding`
- 证据：`componentGapRuntime.ts:18-22`，`index.css:539-542`，`gapRuntimeProbe.estimateVisualGapPx`

| 状态 | 未修（设计如此） |

### RC-B — 运行时仍为非零间隙 【配置 · P0】

截图 ~10px 与外框相切时 **高度吻合 md（pixelGutter=5×2）**。

| 路径 | 证据 |
|------|------|
| 未保存 none，重开 bootstrap 推断 md | `gapPolicy.ts:155-158` |
| legacy `widgetGap:8` 无 gapPreset | `normalizeDashboardGapConfig` |
| 只读页仅读 `layout.styleConfig` | `DashboardSharePage` → `DashboardLayoutPreview` |

| 状态 | R2-3 待执行（配置硬门 + golden） |

### RC-C — 外框坐标缝未压实 【几何 · P0】

| 子项 | 说明 | 状态 |
|------|------|------|
| RC-C1 | R1 仅 `applyStyleConfig` 压实 | R2-1 ✅ 扩至 load/preview/save |
| RC-C2 | 压实算法只拉右/下邻居；overlap<2 跳过 | R2-2 待执行 |
| RC-C3 | v1 迁移 `PIXEL_ROW_MARGIN=12` 遗留缝 | R2-2 待执行 |

证据：`gapCompaction.ts`，`dashboardCanvasMode.ts:44-45`

### RC-D — 吸附语义混合 【几何 · P1】

`gap>0` 时外框边与间隙中线混用 → 历史布局外框缝。`gap=0` 已禁用中线吸附。

证据：`pixelMarkLine.ts:268-276`

| 状态 | 文档已注明；靠压实收口 |

### RC-E — 缩放双轨 【WYSIWYG · P2】

BUG-10 RC-4，不解释统一 10px 十字缝。

| 状态 | BUG-10 Phase 2 待执行 |

### RC-F — 产品心智 / 无诊断 【UX · P2】

用户无法区分配置 vs 几何原因。

| 状态 | R2-1 ✅ `analyzeDashboardGapLayout`；R2-4 UI 待执行 |

## 诊断决策树

```
绿条可见
├─ --dashboard-shape-gap > 0 → RC-B（切 none + 保存）
├─ shell=0 且 hasCoordinateGaps → RC-C（压实 / R2-2）
├─ 编辑 OK 预览仍缝 → RC-C1（查 prepare 单路径）
└─ 仅亚像素 → RC-E
```

## 验收标准

1. `gapPreset=none` 保存重开 → `--dashboard-shape-gap: 0px`
2. `analyzeDashboardGapLayout`: `estimatedMaxVisualGapPx ≤ 2`（允许抗锯齿）
3. 编辑 / 预览 / 分享 / 重开 四态一致
4. `md → none` 即时消除配置通道绿条；几何通道自动或提示压实

## 修复记录

| 轮次 | 内容 | 状态 |
|------|------|------|
| R0 | 根因 + Headless Plan（compaction） | ✅ |
| R1 | gapCompaction + applyStyleConfig + none roundtrip | ✅ 不足：路径未统一 |
| R2-1 | prepareDashboardLayout / Preview / persist 单路径压实；analyzeDashboardGapLayout | ✅ 2026-07-15 |
| R2-2 | 切断 legacy widgetGap→pixelGutter 误推断；PixelCanvas 零间隙压实 | ✅ 2026-07-15 |
| R2-3 | 配置 WYSIWYG 硬门 | ⏳ |
| R2-4 | UX 提示 + bug-case | ⏳ |
