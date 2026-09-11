# 看板「仪表板配置」右栏全量对标 DataEase 实施计划

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-13  
真理源：`docs/automate/prd/F07-DASH.md` · `docs/ui/layout.md` · DataEase v2 [仪表板基础功能 §5 样式](https://dataease.cn/docs/v2/user_manual/dashboard_basicfunctions/)  
UI 壳层（已落地）：`fe/src/components/dashboard/DashboardContextInspector.tsx` · `DashboardConfigSection.tsx`

---

## 0. 问题陈述

点击画布空白处时，DataEase 右侧弹出 **「仪表板配置」** 手风琴（非空状态提示）。VitalSpan 已对齐 IA 壳层，但 **10 个分组中仅 3 个有部分能力，6 个为占位，1 个为扩展项**：

| 分组 | VitalSpan 现状 | DataEase 参考 |
|------|----------------|---------------|
| 仪表板风格 | 🟡 浅/深色卡片 + `colorScheme` 预览 | §5.1 仪表板主题 |
| 整体配置 | 🟡 仅 `widgetGap` 数字输入（栅格） | §5.2 仪表板整体配置 |
| 仪表板背景 | 🟡 仅背景色文本 | §5.3 仪表板背景 |
| 图表样式 | ⬜ 占位 | §5.4 图表样式 |
| 图表配色 | ⬜ 占位 | §5.5 组件配色 |
| 图表标题 | ⬜ 占位 | §5.6 图表标题 |
| 查询组件 | ⬜ 占位 | §5.7 查询组件 |
| 数字内容格式 | ⬜ 占位 | DE 面板同名分组（v2.10+） |
| 高级样式设置 | ⬜ 占位 | DE 面板：联动/钻取/跳转图标色、钻取层级色 |
| 筛选联动 | 🟡 `LinkageRulesPanel` 条件展示 | VitalSpan 扩展（对标 DASH-004 + DE 外部参数 §6） |

**交互契约（已收口）**

- 点击画布空白 → 取消组件选中，**固定展示**本栏（不自动收起）。
- 仅用户点击「收回」竖条可折叠右栏。
- 样式变更写入 `layoutJson.styleConfig`，随 **保存布局** 持久化（对标 DE「保存仪表板主题」语义，合并进统一保存）。

---

## 1. 目标与非目标

### 1.1 目标

1. 右栏每个折叠分组具备 **可验收的真实配置项**（或明确标注远期并移出占位误导）。
2. `DashboardStyleConfig` 扩展为结构化主题/样式契约，编辑、预览、分享、View 一致消费。
3. 全局样式 **级联到已有组件**，组件级 Inspector 可微调（对标 DE「仪表板优先、组件覆盖」）。
4. PRD 新增 **DASH-008** 登记本能力；分 Phase 勾选验收。
5. TailAdmin/Radix 视觉：`DashboardConfigSection` 灰底标题条 + `Collapsible`（已符合 `b-design-system-tailadmin-radix`）。

### 1.2 非目标

- 不对标 DE 发布/草稿双版本、移动端布局、组件隐藏 §7（另立计划）。
- 不引入 DataEase 运行时（NFR-08）。
- 一期不实现自定义主题 JSON 导入导出（仅系统浅/深 + 后续内置配色方案）。
- 秒级自动刷新仅在 **公共链接/分享 View** 生效，编辑页不轮询（对齐 DE 提示）。

---

## 2. DataEase 功能分解 → VitalSpan 功能 ID

> 参考：[DataEase 仪表板基础功能 §5](https://dataease.cn/docs/v2/user_manual/dashboard_basicfunctions/) · 面板走查（v2.10 样式栏）

### DASH-008-01 · 仪表板风格（§5.1）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-01-a | 系统浅色/深色主题切换 | 🟡 `colorScheme` 已写入 `styleConfig`，画布局部预览 | 完善 View/Share 全页应用 |
| 08-01-b | 主题预览缩略图卡片 | ✅ `ThemePreviewCard` | — |
| 08-01-c | 独立「保存」主题按钮 | 🔄 合并为「保存布局」；栏内提示文案 | 保持，文档说明 |
| 08-01-d | 自定义主题（扩展） | ⬜ | Phase 4+ |

**验收**：切换主题 → 编辑画布即时预览；保存并刷新后 `styleConfig.colorScheme` 回读一致；View/Share 页面整体浅/深生效。

---

### DASH-008-02 · 整体配置（§5.2）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-02-a | 组件间隙：大/中/小/自定义 0–10 | 🟡 仅 `widgetGap` px；像素画布 gap=0 | `gapPreset` + 像素模式可选 gutter |
| 08-02-b | 缩放模式：按画布比例 / 按组件比例 | 🟡 v2 仅宽度贴合 `scaledCanvasMetrics` | `scaleMode: canvas \| component` |
| 08-02-c | 仪表板主题色（accent） | ⬜ | `themeAccent` token |
| 08-02-d | 字体更换 | ⬜ | `fontFamily` 枚举 |
| 08-02-e | 刷新频率（秒级，仅公共链接） | ⬜ | `refreshIntervalSec` + Share 页定时器 |
| 08-02-f | 结果展示数量覆盖 1–10000 | ⬜ | `defaultQueryLimit` 覆盖 `CHART_EXECUTE_LIMIT` |

**验收**：栅格模式间隙预设可切换；v2 画布缩放模式在编辑/预览一致；公共链接设置刷新后仅 Share 生效。

---

### DASH-008-03 · 仪表板背景（§5.3）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-03-a | 背景颜色 | 🟡 `canvasBackground` 文本色 | 色板 + 取色器 |
| 08-03-b | 背景图片上传 | ⬜ | `canvasBackgroundImage` URL + 上传 API |
| 08-03-c | 清除/重新上传 | ⬜ | 重置按钮 |

**验收**：纯色/图片背景在编辑画布与 View 一致；图片走现有媒体上传或静态资源策略。

---

### DASH-008-04 · 图表样式（§5.4）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-04-a | 全局组件背景色 | ⬜ | `widgetStyle.background` |
| 08-04-b | 透明度 | ⬜ | `widgetStyle.opacity` |
| 08-04-c | 圆角 | ⬜ | `widgetStyle.borderRadius` |
| 08-04-d | 边框（色/宽/线型） | ⬜ | `widgetStyle.border` |
| 08-04-e | 组件级微调 | ⬜ | `chartConfig.styleOverrides` 合并规则 |

**验收**：修改全局样式后所有 chart/filter/text 外框同步；单组件 Inspector「样式」Tab 可覆盖全局。

---

### DASH-008-05 · 图表配色（§5.5）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-05-a | 图表系列配色方案（内置多套） | ⬜ | `paletteId` → `chart-theme` 预设 |
| 08-05-b | 自定义配色 | ⬜ | `paletteColors[]` |
| 08-05-c | 指标卡/文本卡配色 | ⬜ | `kpiStyle` / `textCardStyle` |
| 08-05-d | 表格配色（表头/单元格/汇总） | ⬜ | `tableStyle` |

**验收**：切换「科技/商务」等预设后柱状/折线颜色变化；KPI 卡片文字/背景跟随；表格表头色跟随。

---

### DASH-008-06 · 图表标题（§5.6）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-06-a | 全局标题：字号/颜色/字重/对齐 | ⬜ | `titleStyle` |
| 08-06-b | 字间距 | ⬜ | `titleStyle.letterSpacing` |
| 08-06-c | 组件级标题覆盖 | 🟡 组件 `title` 字段 | `chartConfig.titleStyle` 合并 |

**验收**：全局改标题样式后所有组件标题同步；单组件可关闭标题或局部改色。

---

### DASH-008-07 · 查询组件（§5.7）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-07-a | 过滤组件标题位置/颜色 | ⬜ | `filterChromeStyle` |
| 08-07-b | 输入框/下拉框样式 | ⬜ | `filterControlStyle` |
| 08-07-c | 与 DASH-007-02 控件类型正交 | 🟡 已可插入 filter | 样式与类型解耦 |

**验收**：拖入筛选器后，全局查询组件样式作用于所有 `FilterWidget`；View 模式 GlobalFilterBar 同步。

---

### DASH-008-08 · 数字内容格式（DE 面板分组）

| 子项 | DataEase 行为 | VitalSpan 状态 | 交付物 |
|------|---------------|----------------|--------|
| 08-08-a | KPI/指标默认小数位 | ⬜ | `numberFormat.decimals` |
| 08-08-b | 千分位/百分比/货币 | ⬜ | `numberFormat.type` |
| 08-08-c | 单位后缀 | ⬜ | `numberFormat.unit` |
| 08-08-d | 组件级覆盖 | ⬜ | `metric.format` 合并 |

**验收**：仪表板级设 2 位小数后所有 KPI 默认两位；单指标可覆盖。

---

### DASH-008-09 · 高级样式设置（DE 面板分组）

| 子项 | DataEase 行为（走查） | VitalSpan 状态 | 交付物 |
|------|----------------------|----------------|--------|
| 08-09-a | 联动/钻取/跳转图标颜色 | ⬜ | `actionIconColor` |
| 08-09-b | 钻取层级展示颜色 | ⬜ | `drillLevelColors[]` |
| 08-09-c | 与组件「高级」Tab 不重复 | 🟡 `WidgetAdvancedAccordion` 已有占位 | 全局默认 + 组件覆盖 |

**验收**：配置图标色后，组件工具栏联动/钻取图标颜色变化（钻取 UI 落地后验收 b）。

---

### DASH-008-10 · 筛选联动（VitalSpan 扩展）

| 子项 | 行为 | VitalSpan 状态 | 交付物 |
|------|------|----------------|--------|
| 08-10-a | 联动规则编辑 | ✅ `LinkageRulesPanel` | — |
| 08-10-b | 有筛选器时默认展开 | ✅ | — |
| 08-10-c | 与 DE 外部参数 §6 对齐 | 🟡 Share Ticket 未做 | 见 DASH-004 / Share 计划 |
| 08-10-d | 常显于配置栏（非条件隐藏） | ⬜ 当前无 filter 时不显示 | 改为常显折叠项 |

**验收**：无筛选器时仍可见「筛选联动」分组（空态引导）；有规则时 PUT global-filters 成功。

---

## 3. 数据模型（`DashboardStyleConfig` 演进）

**当前**（`layoutUtils.ts`）：

```ts
{ widgetGap?, canvasBackground?, colorScheme?: 'light' | 'dark' }
```

**目标结构**（分 Phase 增量，保持向后兼容）：

```ts
type DashboardStyleConfig = {
  colorScheme?: 'light' | 'dark';
  themeAccent?: string;
  fontFamily?: string;
  gapPreset?: 'none' | 'sm' | 'md' | 'lg' | 'custom';
  widgetGap?: number;
  scaleMode?: 'canvas' | 'component';
  canvasBackground?: string;
  canvasBackgroundImage?: string;
  refreshIntervalSec?: number;
  defaultQueryLimit?: number;
  widgetStyle?: { background?, opacity?, borderRadius?, border? };
  paletteId?: string;
  paletteColors?: string[];
  titleStyle?: { fontSize?, color?, fontWeight?, align?, letterSpacing? };
  filterChromeStyle?: { titlePosition?, titleColor? };
  filterControlStyle?: { borderRadius?, height? };
  numberFormat?: { decimals?, type?, unit? };
  actionIconColor?: string;
  drillLevelColors?: string[];
};
```

**持久化**：`buildDashboardLayoutForSave` · `backend/app/dashboard/schemas.py` `styleConfig` JSON 字段同步扩展；缺字段 = 默认。

**样式合并优先级**：`dashboard.styleConfig` → `widget.*Override` → 组件 Inspector 本地修改。

---

## 4. 实施 Phase

### Phase 0 — 壳层与交互（✅ 2026-07-13）

- [x] `DashboardConfigSection` 手风琴 IA
- [x] 点击空白展示「仪表板配置」；右栏默认展开、仅手动折叠
- [x] 仪表板风格浅/深卡片 + `colorScheme` 预览
- [x] 整体配置 `widgetGap`、仪表板背景色
- [x] 占位分组 + 筛选联动条件展示

### Phase 1 — 主题与画布基础（P0）

| Task | 内容 | 文件锚点 |
|------|------|----------|
| 1.1 | View/Share 应用 `colorScheme` | `DashboardLayoutPreview` · `DashboardSharePage` |
| 1.2 | 间隙预设 + 栅格 `DashboardGrid` gap | `DashboardContextInspector` · `DashboardGrid` |
| 1.3 | v2 `scaleMode` 切换与 `geometry.ts` | `pixelCanvas/geometry.ts` · `PixelCanvas` |
| 1.4 | 背景色取色器 + 清除 | `DashboardContextInspector` |
| 1.5 | BE schema 扩展 + round-trip 测试 | `schemas.py` · `dashboard.smoke.test` |

### Phase 2 — 全局组件外观（P1）

| Task | 内容 |
|------|------|
| 2.1 | `widgetStyle` 全局背景/圆角/边框 → `DashboardWidget` shell |
| 2.2 | `titleStyle` 全局标题 → 各 Widget 标题栏 |
| 2.3 | 组件 Inspector「样式」Tab 覆盖开关 |
| 2.4 | 复用组件时样式适配（对标 DE §9） |

### Phase 3 — 配色与数字格式（P1）

| Task | 内容 |
|------|------|
| 3.1 | 内置 `paletteId` 对接 `chart-theme.ts` |
| 3.2 | KPI/表格子样式 |
| 3.3 | `numberFormat` 默认 + `KpiCard` 消费 |
| 3.4 | 配置栏 UI：配色方案网格 + 数字格式表单 |

### Phase 4 — 查询组件与高级样式（P2）

| Task | 内容 |
|------|------|
| 4.1 | `filterChromeStyle` / `filterControlStyle` |
| 4.2 | `actionIconColor` · `drillLevelColors` |
| 4.3 | 筛选联动分组常显 + 空态 |
| 4.4 | 移除「后续版本开放」占位，改为禁用项说明或真功能 |

### Phase 5 — 运行时增强（P2）

| Task | 内容 |
|------|------|
| 5.1 | `refreshIntervalSec` 仅 Share/公共 View |
| 5.2 | `defaultQueryLimit` 覆盖 execute limit |
| 5.3 | 背景图上传与 CDN/静态资源策略 |
| 5.4 | 批量操作样式（对标 DE §8，依赖多选 Inspector） |

---

## 5. UI 规格（TailAdmin × Radix）

| 项 | 规格 |
|----|------|
| 栏宽 | `max-w-[min(480px,46%)]`（已用） |
| 分组头 | `bg-gray-50` / `dark:bg-white/[0.03]`，左三角 `ChevronRight` |
| 默认展开 | 仅「仪表板风格」；其余折叠 |
| 主题卡片 | 选中 `border-brand-500` + 浅蓝底 |
| 表单控件 | `h-9` Input · `Label` `text-theme-xs` |
| 滚动 | 栏内 `overflow-y-auto`；`scrollbar-gutter: stable` 由画布侧承担 |
| 无障碍 | 主题卡片 `aria-pressed`；分组 `Collapsible` 键盘可达 |

---

## 6. 测试与验收

```bash
# 单元 / 冒烟
cd fe && npx vitest run \
  src/components/dashboard/DashboardContextInspector.test.tsx \
  src/pages/admin/dashboard/dashboard.smoke.test.tsx

# 后端 layout round-trip（Phase 1.5 起）
pytest tests/test_dash_m5_widgets.py -q -k style
```

| 场景 | 判据 |
|------|------|
| 空白点击 | 右栏显示「仪表板配置」手风琴，不收起 |
| 主题切换 | 画布预览变化；保存刷新后保持 |
| 全局样式 | 改圆角/标题色后所有组件同步 |
| 组件覆盖 | 单组件 Inspector 改色优先于全局 |
| 占位清零 | Phase 4 后无「后续版本开放」误导文案 |

---

## 7. 文档同步（完成 Phase 时）

| Phase 完成 | 同步 |
|------------|------|
| Phase 1 | `prd/F07-DASH.md` 新增 DASH-008；`docs/ui/layout.md` 右栏 IA |
| Phase 2+ | `docs/services/dashboard.md`（若建）styleConfig 边界 |
| 全量 | `DashboardStyleDialog` 与右栏字段单一真理源（弃重复 Dialog 或改为跳转） |

---

## 8. 依赖与风险

| 依赖 | 说明 |
|------|------|
| DASH-002 v2 画布稳定 | `scaleMode` 与 BUG-2 修订联动 |
| DASH-004 | 筛选联动、GlobalFilterBar 升级 |
| `chart-theme.ts` | 配色方案唯一出口 |
| 钻取/跳转 UI | 08-09-b 待钻取功能立项 |

| 风险 | 缓解 |
|------|------|
| `styleConfig` 膨胀 | 分 namespace 对象；schema 版本字段 |
| 全局/组件样式冲突 | 文档化合并优先级 + 单测 |
| 像素画布 gap=0 与 DE 间隙语义不同 | UI 注明；v2 可选 `pixelGutter` |

---

## 9. 功能清单总表（执行看板）

| ID | 分组 | 子功能数 | 状态 | Phase |
|----|------|----------|------|-------|
| DASH-008-01 | 仪表板风格 | 4 | 🟡 1/4 | 0–1 |
| DASH-008-02 | 整体配置 | 6 | 🟡 1/6 | 1 |
| DASH-008-03 | 仪表板背景 | 3 | 🟡 1/3 | 1 |
| DASH-008-04 | 图表样式 | 5 | ⬜ 0/5 | 2 |
| DASH-008-05 | 图表配色 | 4 | ⬜ 0/4 | 3 |
| DASH-008-06 | 图表标题 | 3 | 🟡 0.5/3 | 2 |
| DASH-008-07 | 查询组件 | 3 | 🟡 0.5/3 | 4 |
| DASH-008-08 | 数字内容格式 | 4 | ⬜ 0/4 | 3 |
| DASH-008-09 | 高级样式设置 | 3 | ⬜ 0/3 | 4 |
| DASH-008-10 | 筛选联动 | 4 | 🟡 2/4 | 0–4 |

**合计**：10 分组 · 39 子功能 · **约 15% 已交付**（壳层 + 部分主题/间隙/背景/联动）

**Phase 1 执行计划**：[`2026-07-13-dashboard-config-phase1-execute.md`](./2026-07-13-dashboard-config-phase1-execute.md)（plan-review **PASS**，待 A5）

---

## 10. 参考链接

- DataEase：[仪表板基础功能 — §5 样式](https://dataease.cn/docs/v2/user_manual/dashboard_basicfunctions/)
- DataEase：[图表样式设计](https://dataease.cn/docs/v2/user_manual/view_module/panel_view_style_design/)（组件级微调参考）
- VitalSpan 画布设计：`docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md`
- VitalSpan 组件 Inspector Phase 1：`docs/automate/plans/2026-07-13-dashboard-inspector-de-phase1.md`
