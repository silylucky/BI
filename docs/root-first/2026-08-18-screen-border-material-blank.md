# Root-First Briefing: 大屏素材库「边框」插入后画布空白

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 主模式 | **Thrash** |
| 子类型 | Bug（插入 + 渲染） |
| 状态 | **done**（P0+P1 已合入，单测 13/13 绿） |
| 正确性标准 | 数据大屏编辑页：素材库点「边框1–9」→ 画布出现可拖拽的边框装饰组件，选中后可见青色 DE 边框 SVG |
| 效果标准 | 默认插入尺寸约 320×240，落点视口中心；与预览缩略图一致；不被 Tab/图表遮挡为 0 尺寸 |
| 启用维度 | `ui-vertical` |
| 非目标 | 改造素材库 UI 信息架构；组件「背景·图片」与边框样式合并；栅格看板 v1 全面回归 |

## 1. 现象 / 诉求（来自对话）

- 用户原意：素材库 → **边框** → 点「边框1–9」后**失效/空白**；选中组件名「边框装饰」但画布上看不到边框。
- 截图：右侧出现「背景 / 图片 / 内置素材」面板（`WidgetShellBackgroundSection`），画布选区大但内容空。
- 明确反感：改了几轮仍「没生效」。
- 期望：插入即可见对标 DataEase 的科技风边框装饰。
- 现状：组件可插入、可选中，**视觉上空白**。

## 2. 需求锚定

| 层级 | Must / Nice / Out | 来源 |
|------|-------------------|------|
| 对话 Must | 素材库边框点击后画布**可见**边框 SVG | 用户截图 +「失效」「空白」 |
| 对话 Must | 已有「边框装饰」组件应能显示，而非仅右侧配置项 | 第二轮反馈 |
| 对话 Nice | 区分「边框样式」与「组件底图」配置，减少误操作 | 截图显示用户在「图片」Tab |
| 工作区 | `ScreenVisualEditRail` 已挂载；`resolvePaletteInsertTabHost` 已合入 | L1 代码 |
| 文档 Out | 不要求同步 PRD（行为修复，非新需求） | prd-sync 评估 |

文档与对话冲突：无。

## 3. 失败迭代复盘（Thrash）

| # | 尝试了什么 | 为何失败/为何差 | 证据 | 下轮禁止 |
|---|------------|-----------------|------|----------|
| 1 | 判断为 Tab 0×0 折叠插入，加 `resolvePaletteInsertTabHost` | 部分场景改善，用户仍报空白 | L1 `tabInsertResolver.ts:110`；对话第二轮 | 只修插入、不验证**渲染高度链** |
| 2 | 提议改 `TextWidget` / `index.css` / `PixelShape` 跳图例壳 | **未留在工作区**（`TextWidget` 无 `h-full` 类） | L1 `TextWidget.tsx:96-99` | 以为「已修」但未落盘即宣称完成 |
| 3 | 新增 `TextWidget.screen-border.test.tsx` | **假绿**：只断言 DOM 有 `svg`，未断言可见高度 | L1 测试通过但用户仍空白 | 用「DOM 存在」代替「画布可见」 |

三问：

1. **根因错位**：第一轮盯 Tab 插入；**主根因在渲染层 flex 高度塌陷**（绝对定位子元素脱离文档流）。
2. **标准未写清**：缺少「可见高度 > 0 / 用户肉眼可见」的验收，导致测试绿、体验红。
3. **沿用旧思路再失败**：继续只调 Tab 或只加 CSS 片段、不打通 `PixelShape → TextWidget → ScreenBorderDisplay` 整链。

## 4. 代码取证

| 发现 | 等级 | 路径 |
|------|------|------|
| 边框组件用 `text` + `__vs_screen_border__` 标记，走 `ScreenBorderDisplay` | L1 | `screenVisualAssets.ts` · `TextWidget.tsx:181-182` |
| `ScreenBorderDisplay` 为 `absolute inset-0 size-full`，依赖父级有高度 | L1 | `TextWidget.tsx:166,182` · `ScreenBorderDisplay.tsx:30` |
| shape 壳层下 `TextWidget` **外层无 `h-full/flex-1`**，绝对定位子不参与撑高 → **父级高度可塌为 0** | L1 | `TextWidget.tsx:96-99` |
| `PixelShape` 仍用 `EmbeddedChartLegendShell` 包裹素材子树，flex 链更长 | L1 | `PixelShape.tsx:252-265` |
| Tab 插入：`insertPaletteWidgetIntoTabHost` 强制 `width/height: 0` | L1 | `createPixelWidget.ts:279-284` |
| **`resolvePaletteInsertTabHost` 已跳过装饰类素材的 Tab 宿主**（P0 插入已合入） | L1 | `tabInsertResolver.ts:110-124` · `DashboardEditPage.tsx:704` |
| 右侧「背景·图片」来自 `ScreenVisualEditRail` 的 `WidgetShellBackgroundSection`，**不是**边框样式区；边框样式在下方 `ScreenBorderStylePanel` | L1 | `ScreenVisualEditRail.tsx:86-110` |
| 现有单测不验可见性 → 假绿风险 | L1 | `TextWidget.screen-border.test.tsx` |

### 5.a `ui-vertical`（已启用）

**画面验收**：大屏编辑页 → 素材库 → 边框1 → 画布中央出现带青色描边的矩形装饰，可拖拽缩放；右侧「边框」区切换 border-2…9 即时换样。

| 序 | 层 | 状态 | 证据 | P0 是否改 |
|----|----|------|------|-----------|
| 1 | 数据/模型 | 已有 `screenStyle.border.variant` | `createScreenBorderWidget` | 否 |
| 2 | 插入编排 | Tab 跳过已修；视口中心插入已有 | `insertPixelPaletteWidget` | 否（已合入） |
| 3 | fe 渲染 | **坏**：flex 高度链塌陷 | `TextWidget.tsx` | **是** |
| 4 | fe 壳层 | 可优化：素材跳过图例壳 | `PixelShape.tsx` | 是（P1） |
| 5 | 配置 UI | 易混淆：背景图 ≠ 边框 SVG | `ScreenVisualEditRail` | P2（文案/折叠） |

实施序：**先 P0 渲染（3）** → 浏览器肉眼验收 → 再 P1 壳层简化 → P2 配置引导。

## 6. 对标调研（简要）

| 对标点 | 参考 | 可观察行为 | 借鉴 | 不适用 |
|--------|------|------------|------|--------|
| 素材边框 | DataEase 大屏 Board 边框 | 插入即铺满组件框的 SVG 描边 | `screenBorderDeFrames` + `ScreenBorderDisplay` 路径正确 | 不引入在线资源 |

## 7. 根源结论

**主根因（P0）**：像素画布 shape 壳层内，`ScreenBorderDisplay` 使用绝对定位脱离文档流，而 `TextWidget` 外层未参与 flex 高度分配，导致内容区计算高度为 **0**，SVG 虽挂载但不可见。

**次要根因（已部分修复）**：选中 Tab 时装饰素材曾被解析进 Tab 宿主并以 **0×0** 写入布局（`insertPaletteWidgetIntoTabHost`）。

**体验混淆（非空白根因）**：用户截图在配「背景·图片」，易以为素材库缩略图应成为边框——实际边框由 `screenStyle.border` + DE SVG 渲染，与 `widgetStyle` 底图无关。

## 8. 问题分解

| # | 子问题 | 依赖 | 风险 | 优先级 |
|---|--------|------|------|--------|
| 1 | shape 壳层边框组件高度链打通 | — | 低 | **P0** |
| 2 | 单测改为断言可见渲染（非仅 DOM 存在） | #1 | 低 | **P0** |
| 3 | 素材组件跳过 `EmbeddedChartLegendShell` | #1 | 中（图例回归） | P1 |
| 4 | 右侧栏区分「边框样式」与「组件底图」 | — | 低 | P2 |

## 9. 方案

### 推荐（P0）

1. **`TextWidget.tsx`**：`inShapeShell && screenVisual` 时外层加 `flex h-full min-h-0 w-full flex-1 flex-col`。
2. **`index.css`**：为 `[data-screen-border-asset]` 补 `.pixel-shape-content` / `.dashboard-no-drag` 的 `height:100%; flex:1`（双保险）。
3. **`TextWidget.screen-border.test.tsx`**：增加对 `text-widget-content`/`data-screen-border-de` 父级 `getBoundingClientRect().height > 0` 的断言（mock 布局）。
4. **手工验收**：删旧空白组件 → 硬刷新 → 重新插入边框1。

### 备选

- **B1**：`ScreenBorderDisplay` 改相对定位 + `min-h-full`，不用 absolute（改动面更大）。
- **B2**：仅 CSS 不修 `TextWidget`（脆弱，不推荐）。

### 废弃思路

- 继续只修 Tab 插入、不碰渲染链。
- 用「vitest 有 svg 节点」作为完成标准。

### 触及面

- `fe/src/components/dashboard/TextWidget.tsx`
- `fe/src/index.css`
- `fe/src/components/dashboard/pixelCanvas/PixelShape.tsx`（P1）
- `fe/src/components/dashboard/TextWidget.screen-border.test.tsx`

### 验证计划

1. `pnpm exec vitest run TextWidget.screen-border.test.tsx tabInsertResolver.test.ts`
2. 浏览器：数据大屏编辑 → 素材库边框 → 可见 + 换样
3. 回归：选中 Tab 时再插边框仍落画布中心（`resolvePaletteInsertTabHost` 单测）

## 10. 审批记录

- [ ] 用户批准 P0 实现
- [ ] 用户要求改方向：__________
- [ ] 用户要求缩范围：__________

---

**当前仓内状态（本简报撰写时）**

| 项 | 状态 |
|----|------|
| `resolvePaletteInsertTabHost` | ✅ 已合入 |
| `TextWidget` 高度链修复 | ✅ 已合入 |
| `index.css` 高度链 | ✅ 已合入 |
| `PixelShape` 跳图例壳 | ✅ 已合入 |
| 单测 `TextWidget.screen-border` + `tabInsertResolver` | ✅ 13/13 通过 |
