# Dashboard 编辑页热更新/重载清空未保存布局

- **ID**: CASE-2026-07-13-002
- **状态**: 已修复
- **影响**: fe / dashboard edit
- **首次发现**: 2026-07-13

## 症状

- 开发时 Vite 热更新或页面自动刷新后，画布组件与右侧配置「直接没了」或回退到上次保存状态
- 后端日志短时间重复 `GET /dashboards/:id` + `GET .../global-filters`（404 可忽略）
- 用户误以为 `global-filters` 404 导致丢数据

## 根因

1. **`global-filters` 404 无害**：未配置联动时后端返回 `DASH_FILTER_NOT_FOUND`；`load()` 已 `.catch(() => null)`，不会清空画布。
2. **真正问题在 `DashboardEditPage.load()`**：
   - 每次执行 `setLoading(true)` → 整页 Skeleton 替换编辑区（视觉「内容没了」）
   - 成功后无条件 `resetLayout(source)` → 用服务端 layout 覆盖本地未保存编辑
   - `useEffect(..., [load])` 在 `load` 回调引用变化时会再次触发（开发态 StrictMode / HMR 更易复现）

## 修复方式

- 仅首次进入显示 Skeleton；已 hydrated 后后台拉取不再闪屏
- 有未保存更改（`isDirty`）时跳过后台 `resetLayout`，保留本地编辑
- `useEffect` 仅在 `id` / `mode` 变化时 `load({ force: true })`

## 验证

- 编辑看板未保存 → 触发 HMR 或手动刷新：不应被服务端旧 layout 覆盖（刷新整页仍会丢内存态，属预期）
- 同页停留、非 force 重载：画布保持可见且不 reset
- `global-filters` 404 仍可出现，画布不受影响

## 关联

- `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
