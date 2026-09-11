# 看板组件标题顶栏 · DataEase 对标设计

日期：2026-07-14  
真理源：`docs/automate/prd/F07-DASH.md` DASH-008-06 · DataEase 仪表板 §5.6 图表标题

---

## 1. 问题

v2 像素画布原先 **仅在选中时** 在 `PixelShape` 拖动手柄内显示标题；点击画布空白取消选中后标题消失，与 DataEase「组件顶栏常驻」不一致。

样式 Tab 中的「显示标题 / 备注 / 字号对齐」写入 `chartConfig.nativeBody.deStyle`，但备注未在画布渲染。

---

## 2. DataEase 行为（对标）

| 能力 | DataEase | VitalSpan（本方案） |
|------|----------|---------------------|
| 标题文本 | `widget.title`，布局 JSON 持久化 | `LayoutWidget.title` → `PUT layout` |
| 显示/隐藏 | 组件样式 → 标题开关 | `nativeBody.deStyle.title.show` |
| 全局样式 | 仪表板配置 → 图表标题 | `layout.styleConfig.titleStyle` |
| 组件覆盖 | 单组件标题样式 | `deStyle.title.{fontSize,color,align,...}` |
| 备注 | 样式 → 备注 | `deStyle.remark.{show,text}` |
| 编辑 | 顶栏内联 + 右栏样式 | `WidgetShapeChrome` + `ChartStylePanel` |
| 预览/分享 | 只读顶栏 | `mode=view` 只读 `WidgetShapeChrome` |

---

## 3. 数据模型（无需新表）

### 3.1 布局层（已有）

```json
{
  "id": "uuid",
  "type": "chart",
  "title": "区域销售",
  "chartConfig": { ... }
}
```

- 后端：`backend/app/dashboard/schemas.py` · `LayoutWidget.title`（1–120 字符）
- 校验：`validate_layout` 随布局保存

### 3.2 组件样式扩展（已有字段，文档化）

存入 `chartConfig.nativeBody`（`ChartViewConfig.nativeBody` / `native_body`）：

```json
{
  "deStyle": {
    "title": { "show": true, "fontSize": 16, "color": "#333", "align": "left" },
    "remark": { "show": true, "text": "单位：万元" }
  }
}
```

- 后端：`schemas/chart_view.py` · `native_body: dict`（透传，M1 不做细粒度 Pydantic）
- 前端读写：`fe/src/lib/chartDeStyle.ts`

### 3.3 全局标题（已有）

`layout.styleConfig.titleStyle` — 看板配置右栏「图表标题」分组。

---

## 4. 前端架构

```text
PixelShape (flex column)
├── pixel-shape-body（结构描边 + 操作轨）
└── pixel-shape-inner（DE shape-inner：统一 padding/背景/圆角）
    ├── WidgetShapeChrome   ← 标题 + 备注
    └── pixel-shape-content
        └── DashboardWidget shell=shape（无重复标题栏）
```

**子 Widget 约定**：`shell === "shape"` 时，Chart / Filter / Text / Media 等 **不再渲染自有 drag-handle 标题**，避免双层顶栏。

---

## 5. 验收

- [ ] 编辑态：选中/未选中均显示标题
- [ ] 样式 Tab 改标题文本 ↔ 顶栏同步
- [ ] `显示标题` 关闭后顶栏隐藏（`sr-only` 保留 a11y）
- [ ] 备注开启后在顶栏标题下展示
- [ ] 保存布局 → 刷新 → `title` + `deStyle` 回读一致
- [ ] `WidgetShapeChrome.test.tsx` 绿

---

## 6. 后续（未纳入本轮）

- 筛选器专用 `filterChromeStyle.titlePosition`（左/上）
- 后端对 `nativeBody.deStyle` 的结构化 Pydantic 校验（可选）
- Playwright：取消选中后标题仍可见
