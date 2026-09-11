# Mark Line + 碰撞挤压预览 联合修复计划

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  

日期：2026-07-14  
前置：`docs/automate/plans/2026-07-14-dashboard-pixel-mark-line-de.md`  
DE 参考：MarkLine.vue（吸附改 style）+ CanvasCore move 事件（组件实时位移）

---

## 0. 需求契约

| 字段 | 值 |
|------|-----|
| request | 恢复拖动挤压预览，并与 mark-line 磁吸同时生效 |
| type | bugfix |
| goal | 拖移/缩放时：蓝线吸附 + 邻组件级联下推预览 + 松手 commit |
| scope_include | PixelShape 拖动管线、PixelCanvas previewLayout、snapTargets 分离、单测 |
| scope_exclude | v1 RGL；DE 矩阵重排；多选对齐工具栏 |
| acceptance | vitest 绿；拖动重叠时邻组件实时下推；吸附线仍显示且松手位置对齐 |
| risk_level | low |
| autonomy_policy | auto_accept_low_risk |

---

## 1. 问题根因

| 现象 | 根因 |
|------|------|
| 移动时挤压效果消失 | mark-line 落地时移除 `onPreview` → `previewLayout` 不再更新 |
| 预览位置未自动对齐 | 吸附只更新 PixelShape 本地 `display`，未把 **snapped rect** 传入 collision preview |

初版 plan §3.4 为避免吸附与推挤打架，规定「拖动中仅吸附」。用户验收反馈：**需要 DE 式拖动手感 = 吸附 + 实时挤压预览并存**。

## 2. DataEase 调研结论

| 能力 | DE 行为 | VitalSpan 对标 |
|------|---------|----------------|
| Mark line | `move` 事件 → 改 curComponent style + 画线 | `computeMarkLineSnap` + Overlay |
| 邻组件位移 | 自由像素模式下邻组件 **不** 随拖移级联（矩阵模式另议） | **保留** 级联下推（产品差异化） |
| 吸附参考 | `componentData` 中 **其他** 组件当前 style（不含自己） | 用 **已提交 layout** 作 snap 锚点，避免 preview 推挤导致吸附目标跳动 |
| 生命周期 | `unMove` 清线 | `pointerup` 清线 |

**关键决策**：吸附锚点 = `layout`（committed）；渲染/挤压 = `previewLayout`（snapped rect 驱动）。

## 3. 目标数据流

```text
PointerMove
  → applyPixelInteraction → draft
  → computeMarkLineSnap(draft, snapTargets from layout, …) → snapped + guides
  → setDisplayRect(snapped)                    // 活动组件本地预览
  → onMarkGuidesChange(guides)
  → onPreview(withRect(widget, snapped))       // 恢复
       → setPreviewLayout(resolvePixelCollisions(layout, id, snapped))
PointerUp
  → onMarkGuidesChange(null)
  → onCommit(snapped) → 写回 layout
```

## 4. 实施任务

### T1 — PixelShape 双通道回调
- 恢复 `onPreview`，在 `pointermove` 传入 **snapped** rect
- 新增 `snapTargets`（committed 邻组件），与 `otherWidgets`（preview，供 action rail）分离

### T2 — PixelCanvas 恢复 handlePreview
- `handlePreview` → `setPreviewLayout(resolveActive(widget))`
- 传 `snapTargets={layout.widgets.filter(≠self)}`

### T3 — 单测
- 双组件拖动重叠：`pointermove` 后邻组件 `style.top` 变化（preview 推挤）
- mark-line 仍对 committed 锚点吸附（已有 pixelMarkLine.test.ts）

### T4 — 验证

```bash
cd fe && npx vitest run \
  src/components/dashboard/pixelCanvas/pixelMarkLine.test.ts \
  src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx \
  src/components/dashboard/pixelCanvas/geometry.test.ts
```

## 5. 八维度自审

| 维度 | 结论 |
|------|------|
| 正确性 | 🟢 管线顺序：先吸附再 collision |
| 完整性 | 🟢 恢复用户可见挤压 + 保留 mark-line |
| 风险 | 🟢 不改 schema；松手逻辑不变 |
| 性能 | 🟢 每帧一次 collision O(n²) 与改前一致 |
