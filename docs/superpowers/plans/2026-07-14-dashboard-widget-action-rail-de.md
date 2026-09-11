# 看板组件选中操作条 · DE 对标修复计划

日期：2026-07-14  
关联：`PixelShapeActionRail` · DASH-002 像素画布

---

## 0. 用户澄清

| 竖条图标（上→下） | DataEase 语义 | 当前错误 | 目标 |
|------------------|---------------|----------|------|
| ① | **查看数据** → 明细表弹窗 | 误为「放大」 | 打开 `WidgetViewDataDialog` |
| ② | **放大** → 大图预览弹窗 | 误为「编辑图表」 | 打开 `WidgetEnlargeDialog` |
| ③ | **更多** ⋮ | 基本正确 | 保留；与①②重复可接受 |

「更多」菜单仍含：复制、放大、查看数据、导出为、隐藏、删除（后两项占位）。

---

## 1. 范围

| 包含 | 不含 |
|------|------|
| 修正竖条图标顺序与 `aria-label` | 栅格 RGL 画布同款操作条 |
| 查看数据弹窗（表格式 + 导出 CSV） | 服务端 Excel/PDF 导出 |
| 放大弹窗（分辨率选择 + 图表预览） | 隐藏组件持久化字段 |
| `DashboardEditPage` 弹窗状态编排 | PRD 状态回写 |

---

## 2. Task

### T1 — 修正 `PixelShapeActionRail` 语义

- ① `Table2` → `onViewData`
- ② `Maximize2` → `onEnlarge`
- 删除「编辑图表」占位

### T2 — `WidgetViewDataDialog`

- 标题：组件名
- 顶栏：导出 Excel（CSV 下载）、导出原始明细（高 limit CSV）
- 主体：`useChartExecute` 结果表格
- 仅 `chart` 类型可打开

### T3 — `WidgetEnlargeDialog`

- 标题：组件名
- 顶栏：分辨率 `Select`（1280×720 / 1920×1080 / 自适应）
- 主体：`ChartRenderer` 固定尺寸预览
- 导出图片：M1 占位（toast 提示），后续接 ECharts/Apex export

### T4 — `DashboardEditPage` 接线

- `onViewData` / `onEnlarge` 打开对应对话框（**不再**用放大改 widget 尺寸）
- 传入 `filterParameters`、`styleConfig`

### T5 — 测试

- `geometry.test.ts` 已有左右翻转
- 新增 `WidgetViewDataDialog.test.tsx` smoke：打开、表头渲染
- `PixelShapeActionRail`：`aria-label` 顺序断言（可选）

---

## 3. 验收

- [ ] 选中图表后竖条①打开**数据表**弹窗（与 DE 截图一致）
- [ ] 竖条②打开**大图**弹窗（分辨率 + 图表）
- [ ] 「更多」菜单功能可用，与竖条重复可接受
- [ ] `vitest run` 相关用例绿

---

## 4. 验证命令

```bash
cd fe && npx vitest run \
  src/components/dashboard/widget-actions/WidgetViewDataDialog.test.tsx \
  src/components/dashboard/pixelCanvas/geometry.test.ts \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
```
