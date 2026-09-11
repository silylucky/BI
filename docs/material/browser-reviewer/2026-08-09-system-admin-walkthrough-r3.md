# Browser Reviewer · 首租户真机走查 R3（修复复验）

| 项 | 内容 |
|----|------|
| 日期 | 2026-08-09 23:25 |
| 环境 | local · `http://localhost:5173` · API `http://localhost:8000` |
| 剧本 | `.dev/playbooks/2026-08-09/critical.md` + optional O1 |
| 结论 | **P1 已修复**；O1 在**数据大屏**路径通过（授权资源为 `data-screen`） |

## 本轮代码修复

| 修复项 | 说明 |
|--------|------|
| `demo_analyst` 功能权限 | API 写入 `dashboard:read`（`permissionCodes` version 2） |
| 看板 ACL 接入资源授权 | 新增 `backend/app/dashboard/acl.py`；`list_dashboards` / `assert_dashboard_access` 合并 owner、官方 demo slug、grant 可见 ID |

## 场景结果

| 场景 | 结果 | 证据 |
|------|------|------|
| S1–S5 管理侧数据 | ✅ | 与 R2 一致（组织/用户/角色/授权夹具仍在库） |
| O1 · 分析员登录 | ✅ | `walkthrough_analyst` 可登录 |
| O1 · `/me` 权限 | ✅ | `permissions: ["dashboard:read"]` |
| O1 · `/admin/dashboards` | ✅（预期空） | 授权对象为 **data-screen**，`surfaceKind=dashboard` 过滤后 `total=0` |
| O1 · `/admin/data-screens` | ✅ | 列表 1 条「数字政府 KPI 驾驶舱」；分页「共 1 个大屏」 |

## API 摘录（脱敏）

```
walkthrough_analyst GET /me:
  roles=["demo_analyst"], permissions=["dashboard:read"]

GET /api/v1/dashboards:
  total=1  # 无 surfaceKind 过滤

GET /api/v1/dashboards?surfaceKind=dashboard:
  total=0

GET /api/v1/dashboards?surfaceKind=data-screen:
  total=1, name=数字政府 KPI 驾驶舱

GET /api/v1/dashboards/00000000-0000-4000-8003-000000000002:
  200 OK
```

## Findings

### 已关闭 · P1 角色权限 + 看板 grant 不可见

- **权限**：`PUT /roles/{demo_analyst_id}/permissions` 写入 `dashboard:read`
- **可见性**：非 admin 列表/详情现包含 `auth_resource_grants` 中授权的 dashboard ID

### P2 · O1 验收路径需对齐资源类型

- S5 授权的资源 `00000000-0000-4000-8003-000000000002` 的 `surface_kind` 为 **data-screen**（slug `workspace-gov-digital-cockpit`）
- 走查剧本 O1 若只打开 `/admin/dashboards` 会显示「暂无仪表板」，属**筛选语义正确**，非 ACL 失败
- **建议**：剧本 O1 改为验证 `/admin/data-screens`，或授权一条 `surface_kind=dashboard` 的看板

### P2 · 数据大屏页预览缩略图部分「无权执行此操作」（继承）

- 仅授权 1 个大屏；其余官方 demo 大屏预览无 grant，缩略图区域报错文案属预期

### P2 · 组织树测试数据噪声（继承 R1/R2）

## 真机快照（浏览器 accessibility）

- URL：`/admin/data-screens`
- 可见链接：`数字政府 KPI 驾驶舱`
- 文案：`共 1 个大屏 ，按最近更新排序`

## 测试

- API 冒烟：分析员列表/详情 200 ✅
- `pytest -k dashboard`：1 个既有失败（`test_validate_layout_rejects_unlinked_chart_without_chart_config`），与本轮 ACL 无关

## 与 R2 对比

| R2 问题 | R3 状态 |
|---------|---------|
| `permissions: []` | ✅ 已修复 |
| `GET /dashboards` 403 | ✅ 已修复 |
| 看板列表空（grant 未接入） | ✅ 后端已接入；FE 按 surface 分栏后应在**数据大屏**看到 |
