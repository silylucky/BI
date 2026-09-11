# BUG-10 看板保存后重开布局/间隙与编辑态不一致

> 状态：**修复中（StylePipeline R1）** · 类型：WYSIWYG 持久化 · 模块：dashboard / pixel canvas

## 现象（用户反馈 + 截图 L2）

| 对比项 | 保存前（编辑态，图1） | 保存后重开（图2） |
|--------|----------------------|-------------------|
| 组件间隙 | 用户感知为「当前编辑间距」 | 间距变紧/变松，与保存前不同 |
| 组件相对位置 | 漏斗与地图等存在重叠/贴边 | 重叠关系或垂直节奏变化 |
| 预览 | 与编辑不一致 | 同 save/reload 类问题 |

截图线索：图1 有选中框/resize 手柄（编辑 chrome）；图2 为纯展示态。不能将 chrome 差异等同于坐标漂移，但间隙与垂直节奏变化与用户描述一致。

## 失败时序（重建）

```
1. 用户在编辑页调整布局 + 间隙（styleConfig 写入 React state）
2. layout.styleConfig（pixel history 内）可能仍为旧值或未 bootstrap
3. 点击保存 → buildDashboardLayoutForSave(styleConfigRef) → PUT layoutJson
4. 后端 validate_layout_dict → gap normalize + widget order 重排
5. resetLayout(normalizedLayout)；setStyleConfig(savedStyle)
6. 用户关闭/刷新 → load()
7. prepareDashboardLayout → resetLayout + setWidgets(syncChart...) 双写  ← 已修
8. 预览/编辑分别读 style 源不一致  ← 已修
9. gap runtime 与 save normalize 不一致  ← 已修
```

## 根因分层（L1 代码证据）

### RC-1 styleConfig 三源分裂 【P0 · 部分已修】

| 源 | 路径 | 问题 |
|----|------|------|
| React state | `DashboardEditPage.styleConfig` | 编辑 UI 与 PixelCanvas 消费 |
| layout 内嵌 | `pixel.layout.styleConfig` | 加载后可能 stale，预览曾只读此源 |
| 持久化 | `layoutJson.styleConfig` | save 时 normalize，edit 曾未 normalize |

证据：

- `DashboardLayoutPreview.tsx` 曾 `const styleConfig = layout.styleConfig ?? {}`（预览不读 live state）
- `applyStyleConfig` 曾直接 `setState`，不经 bootstrap/normalize

**修复**：`stylePipeline.hydrateDashboardStyle` + `resolveEffectiveDashboardStyle`；预览传入 live style。

### RC-2 GapPolicy 运行时 vs 持久化不对称 【P0 · 部分已修】

- DE 模型：间隙 = shape 外层 `padding`（`--dashboard-shape-gap`），**坐标 x/y/w/h 不变**，视觉变。
- `resolvePixelGutter` 在仅有 legacy `widgetGap:8` 时曾返回 `0`，save normalize 后变 `pixelGutter:5` → **保存后间隙突然出现**。

证据：`gapPolicy.ts` `resolvePixelGutter` fallback；`dashboardGapConfig.test.ts` legacy 用例。

### RC-3 加载双写 layout 【P1 · 已修】

`load()` 顺序：`resetLayout(prepared)` → `setWidgets(syncChartWidgetsForColorScheme(...))`。

后者经 `mergeLayoutWidgetIntoPixel` 二次 `pixel.setLayout`，虽保留几何，但增加漂移面与竞态。

**修复**：`syncPixelLayoutChartStyles` 合并进单次 `resetLayout`。

### RC-4 缩放分母与 canvas.height 双轨 【P1 · 待修】

- 渲染高度：`viewCanvasHeight = max(320, widgets 最低点)`（`PixelCanvas.tsx:176-182`）
- 缩放分母：`resolveScaleDesignHeight(layout.canvas.height)` cap 900（`geometry.ts:80-81`）
- 保存：`fitCanvasHeightToContent` 改写 `canvas.height`（`dashboardCanvasMode.ts:154`）

保存前后 scale 可能微变 → 用户感知「布局变了」（实为缩放变）。

### RC-5 编辑 chrome 误导 【P2 · 文档/UX】

选中态 border/手柄/overflow 与 view 态不同，易误判为持久化漂移。

### RC-6 重叠坐标未 repack 【P2 · 产品边界】

`collisionGapPx=0`；commit 时 `resolvePixelCollisions` 仅交互态。允许持久化重叠（截图漏斗/地图）。重开不会 auto-repack，但若 save 前后 gap 变，重叠视觉会变。

## 修复记录

| 轮次 | 内容 | 状态 |
|------|------|------|
| R1 | StylePipeline + load 单写 + preview live style + gap legacy 推断 | ✅ 代码已合入 |
| R2 | 缩放/画布高度单源 + golden roundtrip E2E | 待执行 |
| R3 | FE/BE gap 契约 golden + Share 页 hydrate | 待执行 |

## 验收标准

1. 编辑 → 保存 → 刷新：同一 dashboard `persistDashboardFingerprint` 不变（无脏标记）
2. `gapPreset none/md` 与 `widget x/y/w/h` roundtrip 测试绿
3. 预览与编辑在同一 viewport 宽度下 `data-dashboard-gap-enabled` 与 `--dashboard-shape-gap` 一致
4. 手测：用户截图场景保存重开，间隙与组件外框对齐一致
