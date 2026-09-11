# 看板编辑 DE 工具栏完整对标（占位 → 真功能）

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-13  
真理源：`docs/automate/prd/F07-DASH.md` · `docs/ui/layout.md` · DataEase v2 `dashboard_basicfunctions`

---

## 0. 问题陈述

`CanvasEditToolbar` 已对标 DE `middle-area` 视觉（图标+文字），但 **5/7 按钮为 disabled 占位**：

| 按钮 | 现状 | PRD/Schema |
|------|------|------------|
| 图表 | ✅ `ChartPickerPopover` DE 分区网格 | DASH-003 |
| 查询组件 | ⚠️ 仅插入默认 filter，无控件类型选择 | DASH-004 M-DEPTH F-B 未闭合 |
| 富文本 | ❌ 占位 | **无 widget type** |
| 媒体 | ❌ 占位 | **无 widget type** |
| Tab | ❌ 占位 | **无 widget type** |
| 更多 | ❌ 占位 | 部分能力散落（联动/样式） |
| 复用 | ❌ 占位 | **无 API/流程** |

用户契约（dev-autopilot）：**完整立项** · 验收 **plan-verify** · 新能力 **同步 PRD**。

---

## 1. 目标与非目标

### 1.1 目标

1. 工具栏每个可见按钮均有 **可验收的真实行为**（或 Wave 内明确下线，禁止长期 disabled 占位）。
2. `layoutJson` 与 `backend/app/dashboard/schemas.py` 支持新增 widget 类型，**旧 layout round-trip 兼容**。
3. PRD 新增 **DASH-007** 登记 DE 工具栏与 widget 扩展；分 Wave 勾选验收。
4. `docs/ui/layout.md` 补充编辑页工具栏 IA。

### 1.2 非目标

- 不对标 DE 全部顶栏（撤销/发布/移动端布局等）— 见 Wave 6 子集。
- 不做像素画布 layout v2（见 `2026-07-13-dashboard-canvas-drag-last-attempt.md`）。
- 不做富文本 WYSIWYG 全功能编辑器（MVP：Markdown/纯文本块）。
- 不做媒体上传后端（MVP：URL 引用 + 占位图）。

---

## 2. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Widget 类型扩展 | `LayoutWidget.type` 联合类型增量扩展 | 与现有 chart/filter 一致；Pydantic validator 按 type 校验 config |
| layout 版本 | 保持 `version: 1`，新 type 可选字段 | 避免迁移风暴；旧客户端忽略未知 type |
| 查询组件 | 复用 `FilterWidgetConfig.controlType` | BE 已有 `text/select/date/multiselect` |
| Tab | `type: "tabs"` + `tabsConfig: { panes: [{ id, title, childWidgetIds[] }] }` | 子 widget 仍扁平列表，用 parentId 或 pane 引用 |
| 复用 | `POST .../widgets/import` 读源 dashboard layout 片段 | 不跨租户；需 edit 权限 |
| 更多 | 下拉挂接已有能力入口 | 样式→全局主题 stub；外部参数→`LinkageRulesPanel` 跳转 |

---

## 3. Wave 划分

### Wave 1 — 查询组件真功能（P0 · 2–3 人日）

**目标**：「查询组件」对标 DE 筛选器入口，可选控件类型后插入。

| Task | 层 | 文件 | 验收 |
|------|-----|------|------|
| W1-1 | FE | `QueryComponentPicker.tsx` | 下拉：文本/下拉/日期/多选，对应 `controlType` |
| W1-2 | FE | `CanvasEditToolbar.tsx` | 查询组件改为 popover，非单按钮 |
| W1-3 | FE | `createLayoutWidget.ts` | `createFilterWidget(controlType)` |
| W1-4 | FE | `FilterWidgetInspector.tsx` | 插入后可在右栏改 dimension/options |
| W1-5 | PRD | `F07-DASH.md` DASH-004 | 勾选 M-DEPTH F-B 子项「Palette 可拖入+类型」 |
| W1-6 | Test | `dashboard.smoke.test.tsx` | 选「下拉」插入 → layout 含 `controlType: select` |

### Wave 2 — 富文本 widget（P1 · 3–4 人日）

| Task | 层 | 文件 | 验收 |
|------|-----|------|------|
| W2-1 | BE | `schemas.py` | `type: "text"` + `textConfig: { content, variant: markdown\|plain }` |
| W2-2 | BE | layout validate | text widget 无 chartConfig |
| W2-3 | FE | `layoutUtils.ts` · `createLayoutWidget.ts` | round-trip |
| W2-4 | FE | `TextWidget.tsx` + `DashboardWidget` | view/edit 渲染 |
| W2-5 | FE | `TextWidgetInspector.tsx` | 内容编辑 |
| W2-6 | FE | `CanvasEditToolbar` | 富文本启用 + 插入 |
| W2-7 | PRD | DASH-007-02 | 勾选 |

### Wave 3 — 媒体 widget（P1 · 2–3 人日）

| Task | 层 | 文件 | 验收 |
|------|-----|------|------|
| W3-1 | BE | `schemas.py` | `type: "media"` + `mediaConfig: { url, alt, fit }` |
| W3-2 | FE | `MediaWidget.tsx` | 图片展示 + 裂图占位 |
| W3-3 | FE | 工具栏 + inspector | 插入/改 URL |
| W3-4 | PRD | DASH-007-03 | 勾选 |

### Wave 4 — Tab 容器（P2 · 4–5 人日）

| Task | 说明 | 验收 |
|------|------|------|
| W4-1 | `tabs` widget + 子 widget `tabPaneId` 字段 | 编辑态切换 Tab 页 |
| W4-2 | 拖入仅当前 Tab 页 | smoke |
| W4-3 | PRD DASH-007-04 | 勾选 |

### Wave 5 — 复用（P2 · 3 人日）

| Task | 说明 | 验收 |
|------|------|------|
| W5-1 | `ReuseWidgetDialog`：选看板 → 选 widget → 克隆 id | 插入副本 |
| W5-2 | BE 可选：校验源 dashboard 读权限 | pytest |
| W5-3 | PRD DASH-007-05 | 勾选 |

### Wave 6 — 「更多」菜单（P2 · 2 人日）

| 入口 | 行为 |
|------|------|
| 仪表板样式 | 打开侧栏/对话框：组件间距、背景（对接 DASH 主题 companion） |
| 外部参数 | 跳转/展开 `LinkageRulesPanel` |
| 隐藏设置 | 占位 Wave 7 或标为 Out of Scope |

### Wave 7 — 工具栏诚实化（P0 · 0.5 人日，**Wave 1 前可先做**）

在 Wave 2+ 未交付前：

- **方案 A（推荐）**：未实现按钮 **不渲染**，仅保留图表+查询组件，避免假功能。
- **方案 B**：保留按钮但 `title` 写「计划 Wave N」，PRD 链接 — 用户已否决纯占位。

> 本轮用户选择完整立项 → Wave 1 起按序交付，**Wave 7 方案 A 仅作 Wave 2 前的临时措施（可选）**。

---

## 4. PRD 同步（本轮必做）

| 文档 | 动作 |
|------|------|
| `prd/F07-DASH.md` | 新增 **DASH-007** DE 编辑工具栏与扩展 widget |
| `prd.md` hub | `feature_count` +1，`last_updated` |
| `docs/ui/layout.md` | `/admin/dashboards/:id/edit` 工具栏 IA 表 |
| `fe/src/components/README.md` | 登记 `CanvasEditToolbar` · `ChartPickerPopover` · pickers |

### DASH-007 验收摘要（写入 PRD 分片）

- DASH-007-01：图表工具栏 DE 分区选择器（已实现，勾选）
- DASH-007-02：查询组件类型选择插入
- DASH-007-03：富文本 widget
- DASH-007-04：媒体 widget
- DASH-007-05：Tab 容器
- DASH-007-06：跨看板复用
- DASH-007-07：「更多」子菜单至少 2 项可用

---

## 5. 验证方案

```bash
# 每 Wave 合并前
cd fe && npx vitest run src/pages/admin/dashboard/dashboard.smoke.test.tsx \
  src/components/dashboard/FilterWidget.smoke.test.tsx

cd backend && pytest tests/test_dashboard_layout*.py tests/test_cat_dash*.py -q
```

plan-verify 对照本文件 Wave 表逐项勾选。

---

## 6. 八维度自审

| 维度 | 结论 |
|------|------|
| 目标-实现一致性 | 🟢 每 Wave 对应 PRD 子项 |
| 必要性 | 🟢 直接回应「占位非真功能」 |
| 正确性 | 🟡 Tab/复用需 ADR 评审后定稿 |
| 完整性 | 🟢 含 BE+FE+PRD+测试 |
| 一致性 | 🟢 沿用 chart/filter 模式 |
| 副作用 | 🟡 layout 校验收紧需兼容测试 |
| 降级合理性 | 🟢 无静默 fallback |
| 顺序依赖 | 🟢 Wave1 无阻塞 Wave2 |
| 可验证性 | 🟢 每 Task 有 smoke/pytest |

---

## 7. 执行顺序建议

1. **立即**：PRD DASH-007 登记 + evolution-state 契约（本轮）
2. **Wave 1**：查询组件选择器（最高性价比，BE 已就绪）
3. **Wave 2–3**：富文本、媒体（独立 widget type）
4. **Wave 5–6**：复用、更多（依赖产品确认 Tab 优先级时可并行 4）

---

## 8. 风险

| 风险 | 缓解 |
|------|------|
| Tab 嵌套 layout 复杂 | Wave 4 单独立项评审 |
| widget 超 32 上限 | 复用时 clone 校验 |
| 与画布拖拽轮次冲突 | 本 plan 独立分支，不改 RGL 核心 |
