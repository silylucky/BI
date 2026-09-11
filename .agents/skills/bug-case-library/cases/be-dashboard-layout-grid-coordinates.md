# Dashboard 布局坐标未持久化

- **ID**: CASE-2026-07-13-002
- **状态**: 已修复
- **影响**: be / admin-ui
- **首次发现**: 2026-07-13

## 症状

- 编辑页拖动组件后保存并刷新，组件回到流式排布位置。

## 根因

- `LayoutWidget` 未声明 `gridX`/`gridY`，Pydantic 在布局校验和 `model_dump` 时丢弃前端坐标。

## 错误做法（避免）

- 只在前端布局适配器写入坐标，却未将字段加入服务端持久化契约。

## 修复方式

- 在 `LayoutWidget` 定义可选坐标及 12 列边界校验；将行高上限与前端统一为 24。

## 验证

- PUT 含坐标的布局后 GET 坐标不变；坐标越界返回 `VIEW_LAYOUT_BOUNDS`。

## 关联

- `backend/app/dashboard/schemas.py`
- `tests/test_dashboard_layout_grid_xy.py`
