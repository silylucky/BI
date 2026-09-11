# 看板画布交互与组件呈现 · DE 对标完善计划（视觉 + 真实现）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-14  

真理源：`docs/automate/prd/F07-DASH.md`（DASH-002/003/008）· `docs/ui/layout.md` · `b-design-system-tailadmin-radix`  
前置：`2026-07-14-dashboard-shell-theme-isolation.md`（DONE）· 画布 resize 多轮修补（未验收）  
DE 参考：Shape.vue · CanvasCore.vue · ChartComponentS2.vue（S2 表格）

---

## 0. 需求契约（dev-autopilot 编译）

| 字段 | 值 |
|------|-----|
| request | 看板 v2 像素画布：组件拖缩放体验对标 DataEase；内嵌表格/饼图/漏斗等视觉与布局符合 TailAdmin 设计系统；补齐「假实现/半成品」 |
| type | feature + bugfix |
| goal | 编辑态拖/缩放手感与 DE 同级；所有 widget 类型在缩小时内容跟手；表格等组件达到可交付视觉；PRD 未闭合项有明确落地或降级 |
| scope_include | `pixelCanvas/` · `ChartRenderer` · `EmbeddedChartTable` · `AdvancedEchartsChart` · `DashboardWidget` · 非 chart widget · `index.css` dashboard tokens · vitest · 手工 Pointer QA 清单 |
| scope_exclude | 引入 S2/AntV 运行时（NFR-08）· DASH-008 占位分组全量清零（另按 Phase 分期）· 后端 schema 变更（除非验收阻塞）· Playwright E2E（ companion） |
| acceptance | 见 §6 验收矩阵；各 Task 验证命令绿；手工 QA 清单 8/8 通过 |
| risk_level | medium |
| autonomy_policy | auto_accept_low_risk |

### 用户反馈摘要（本轮输入）

1. **样式不好看、布局不合理** — 尤其内嵌表格；需对齐 `b-design-system-tailadmin-radix`（`Table` 组件、密度、圆角、sticky 表头）。
2. **很多功能实现不好或未真正实现** — 拖缩放仅折线/柱图可用；饼图/漏斗/表格等外框变、内容不动或缩到阈值后卡住；配置栏仍有占位项误导。

---

## 1. 现状审计（代码证据）

### 1.1 已做但未验收（技术债）

| 项 | 路径 | 问题 |
|----|------|------|
| isPlayer 拖缩放 | `PixelShape.tsx` · `usePixelShapeDocumentDrag.ts` | document 级 pointer；`setDisplay` 同步外框；未做真实浏览器 QA |
| ECharts live resize | `pixelShapeLiveResize.ts` · `AdvancedEchartsChart.tsx` | 广播 + RO；饼/漏斗仍被反馈「纹丝不动」 |
| 表格 min-width | `EmbeddedChartTable.tsx` | 已去 `min-w-[320px]`，但 **原生 `<table>`**，未用设计系统 `Table` |
| Widget 防重绘 | `DashboardCanvasWidgetRenderer` memo | 图表不重挂载，但非 chart widget 未统一 `suspendLiveResize` |
| Mark line | `pixelMarkLine.ts` | 线可用；move preview 仍可能带动邻组件重绘 |

### 1.2 PRD 未闭合（F07-DASH）

| ID | 项 | 状态 |
|----|-----|------|
| DASH-002 | BUG-2 真实 Pointer QA | `[ ]` |
| DASH-008 | 6/10 配置分组仍为占位 | 见 `2026-07-13-dashboard-config-inspector-de-full.md` |
| DASH-004 | GlobalFilterBar 控件升级 | `[ ]` |

### 1.3 DataEase 对标要点（表格 + 缩放）

| DE 行为 | VitalSpan 差距 |
|---------|----------------|
| S2 容器 `width/height:100%` + `overflow:hidden` | 表格未走统一 Table 壳层 |
| 缩放时 `debounceRender` 重绘图表 | ECharts 依赖 `resize()`，需 isPlayer 脉冲 + 壳层尺寸链 |
| 列宽随容器 `%` 自适应 | `table-fixed` 等分已有；缺 compact 密度与 hover 行 |
| 组件自适应（画布 scale） | 仅壳层 rail 有 `--pixel-canvas-scale`，内容区未分级 |

---

## 2. 目标架构（一页图）

```text
PixelShape (isPlayer)
  ├─ DOM: style.width/height 每帧 setDisplay
  ├─ dispatch pixel-shape-live-resize
  └─ resize 期间: onPreview（与 move 对称，BUG-7 R1）

WidgetContentHost (新，薄包装)
  ├─ h-full min-w-0 + dashboard-widget-surface
  └─ chart → ChartRenderer (memo)
      ├─ Apex bar/line: height 100% + redrawOnParentResize
      ├─ ECharts: usePixelShapeLiveResize + autoResize
      └─ table → EmbeddedChartTable → ui/Table compact

非 chart：Filter/Text/Media/Tabs
  └─ 同一 ContentHost；h-full；无固定 min-height 卡死
```

---

## 3. 实施分期

> 原则：**先修「外框变内容不动」→ 再修视觉 → 再清 PRD/占位误导**。每 Phase 结束跑 completion-gate。

### Phase A · 交互真理源（P0，1–2 天）

**目标**：所有 widget 类型拖/缩放手感与 DE 同级。

| Task | 内容 | 文件 |
|------|------|------|
| A1 | **WidgetContentHost**：统一 `h-full min-w-0 overflow-hidden`；chart 子树挂 `suspendLiveResize` | `DashboardWidget.tsx` · 新建 `WidgetContentHost.tsx` |
| A2 | **ECharts 跟手验收加固**：`pixel-shape-outer` RO + live event；松手后 `resize({ width, height })` 带显式尺寸 | `AdvancedEchartsChart.tsx` |
| A3 | **非 chart isPlayer**：Text/Media/Filter/Tabs 去掉固定 `min-h-[*]` 卡死；Tabs 子槽 `min-h-0 flex-1` | 各 `*Widget.tsx` |
| A4 | **集成测试**：`PixelShape` resize 改变 outer style；live event 触发 mock resize | `PixelCanvas.test.tsx` · `charts.advanced.smoke.test.tsx` |
| A5 | **手工 QA 清单** 文档化（§6） | 本 plan §6 |

**不做**：CSS transform 缩放内容（已证明观感差，非 DE 路径）。

---

### Phase B · 设计系统视觉（P0，1 天）

**目标**：内嵌表格/空态/分页达到 TailAdmin 可交付水准。

| Task | 内容 | 文件 |
|------|------|------|
| B1 | **EmbeddedChartTable 重写**：使用 `@/components/ui/table`（`size="compact"` · `stickyHeader` · `variant="plain"`） | `EmbeddedChartTable.tsx` |
| B2 | **密度分级**：widget 高度 &lt; 120px（画布坐标）时 `compact`；&lt; 80px `ultra-compact`（`text-theme-xs` · `py-1`） | `EmbeddedChartTable.tsx` · `dashboardWidgetTypography.ts` |
| B3 | **分页脚**：复用 `ListPagePagination` 或紧凑 `IconButton` 行；贴底 `shrink-0 border-t` | `EmbeddedChartTable.tsx` |
| B4 | **空/错态**：表格无数据走 `dwState` + 居中；与 `ChartPanel` 语义一致 | `ChartRenderer.tsx` |
| B5 | **组件 README** 登记 EmbeddedChartTable | `fe/src/components/charts/adapters/README.md` 或 `components/README.md` |

**设计系统核对清单**（b-design-system）：

- [ ] 语义色 `gray-*` / `brand-*`，无硬编码 hex
- [ ] 圆角 `rounded-xl` 表格外壳
- [ ] sticky 表头 `z-10` + 背景与 `dashboard-theme-scope` 一致
- [ ] `focus-visible` 分页按钮
- [ ] dark: 完整 `dark:` 变体

---

### Phase C · 画布壳层与配置诚实（P1，1–2 天）

| Task | 内容 | 文件 |
|------|------|------|
| C1 | **DASH-002**：执行 BUG-2 Pointer QA 并回写 `F07-DASH.md` 勾选 | 手工 + 截图 |
| C2 | **配置占位诚实化**：`DashboardConfigSection` 占位分组改「即将推出」+ 禁用，或隐藏无实现项（图表样式/配色/标题 等） | `dashboardConfigPanels.tsx` |
| C3 | **预览管线**：move/resize 均走 `onPreview`（32ms 节流）；~~resize 禁止 onPreview~~ **已勘误**（BUG-7 R1） | `PixelShape.tsx` · `PixelCanvas.test.tsx` |
| C4 | **Mark line**：resize 时 mark guide rAF 节流（已做）；补单测「resize 不触发 previewLayout」 | `pixelMarkLine.test.ts` |

---

### Phase D · 可选增强（P2，排队）

| Task | 内容 | 说明 |
|------|------|------|
| D1 | 表格「列宽比例」记忆到 `chartConfig.styleOverrides` | 对标 DE `tableFieldWidth` % |
| D2 | Share/View 与编辑态表格密度一致 | `DashboardLayoutPreview` |
| D3 | Playwright pointer 回归 | companion |

---

## 4. 关键实现说明

### 4.1 EmbeddedChartTable（B1 目标结构）

```tsx
<Table size={density} stickyHeader wrapperClassName="h-full min-h-0 border-0 shadow-none">
  <TableHeader>...</TableHeader>
  <TableBody>...</TableBody>
</Table>
```

- 外层：`absolute inset-0 flex flex-col`（已有 `embeddedChartSurface`）
- 滚动：Table 自带 `overflow-auto` wrapper
- 列：保持 `table-fixed` + `colgroup` 等分；单元格 `truncate` + `title`

### 4.2 ECharts isPlayer（A2）

```typescript
// 松手瞬间
useEffect(() => {
  if (!suspendLiveResize) {
    const el = containerRef.current;
    if (el) chart.resize({ width: el.clientWidth, height: el.clientHeight });
  }
}, [suspendLiveResize]);
```

### 4.3 WidgetContentHost（A1）

```tsx
export function WidgetContentHost({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}
```

---

## 5. 文档同步（prd-sync）

| 变更 | 文档 |
|------|------|
| BUG-2 QA 通过 | `prd/F07-DASH.md` DASH-002 勾选 |
| 表格/缩放行为 | 无需 SRS；行为已在 PRD 隐含「可拖拽缩放」 |
| 配置占位隐藏 | `prd/F07-DASH.md` DASH-008 演化建议一句 |
| 新组件 | `fe/src/components/README.md` |

---

## 6. 验收矩阵

### 6.1 自动化

```bash
cd fe && npx tsc --noEmit
cd fe && npx vitest run \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx \
  src/components/dashboard/pixelCanvas/pixelShapeLiveResize.test.ts \
  src/components/charts/adapters/EmbeddedChartTable.test.tsx \
  src/components/charts/charts.advanced.smoke.test.tsx
```

### 6.2 手工 Pointer QA（必须 8/8）

| # | 操作 | 期望 |
|---|------|------|
| 1 | 表格：拖右下角缩小到极窄 | 可见区域继续变小；出现滚动条；文字省略号 |
| 2 | 表格：放大 | 列宽恢复；无永久裁切 |
| 3 | 饼图：拖缩放 | 图形随外框实时变化，非留白 |
| 4 | 漏斗图：拖缩放 | 同饼图 |
| 5 | 折线/柱图：拖缩放 | 保持现有丝滑 |
| 6 | 筛选器/文本/图片：拖缩放 | 内容填满外框，无固定高度留白 |
| 7 | 保存 → 刷新 | 尺寸保持 |
| 8 | 壳层深浅切换 vs 看板主题 | 互不污染（回归 shell-theme 计划） |

### 6.3 视觉抽检（b-design-system）

- [ ] 表格：圆角壳、compact 行高、sticky 表头不穿透
- [ ] 无大面积无意义空白
- [ ] 主内容不被裁切/重叠

---

## 7. 八维度自审

| 维度 | 结论 |
|------|------|
| 正确性 | isPlayer + live resize 解决根因；Table 组件统一视觉 |
| 范围 | 不引入 S2；DASH-008 全量留 Phase C2 诚实化 |
| 风险 | medium：多文件触摸；用 memo 防图表重挂载 |
| 可验证性 | vitest + 8 项手工 QA |
| 回滚 | 各 Phase 可独立 revert |
| 文档 | prd-sync 表 §5 |
| 性能 | rAF 节流；resize 不 preview |
| 一致性 | 对齐 DE 交互 + TailAdmin 视觉 |

**plan-review 预判**：`PASS`（低风险路径明确）；若 Phase D 纳入同 PR 则 `WARN`。

---

## 8. 推荐执行顺序（dev-autopilot A5）

1. Phase A（交互）→ completion-gate  
2. Phase B（表格视觉）→ completion-gate + 视觉抽检  
3. Phase C（QA + 配置诚实）→ plan-verify  
4. 更新 `docs/automate/evolution-state.md` 归档本轮  

**推荐模型**：实施 Phase A/B 用强推理模型；Phase C 文档/QA 可用默认模型。

---

## 9. 与当前 evolution-state 关系

- 权限核心计划（`2026-07-13-permission-security-production-core.md`）**继续 A5**，本计划 **排队**，不混入同一 PR。
- 合并顺序建议：权限 Task 完结 → 新开分支 `feat/dashboard-canvas-ux-de` 执行本计划。
