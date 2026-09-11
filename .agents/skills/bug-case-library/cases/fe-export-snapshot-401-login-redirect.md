# 导出快照页 401 踢登录导致 PDF 超时

- **ID**: CASE-2026-08-07-002
- **状态**: 已修复
- **影响**: fe · be · 报表定时 PDF
- **首次发现**: 2026-08-07

## 症状

- 看板/大屏定时报告试发失败：`Page.wait_for_selector: Timeout … [data-export-ready="true"]`
- Playwright 打开导出 URL 后最终停在登录页，而非 `/export/dashboard/...`

## 根因

1. 导出页图表走 `/api/v1/query/dataset/execute`（需 Bearer），未带 `X-Export-Token` → **401**
2. `apiFetch` 对 401 调用 `onUnauthorized` → 跳转 `/login`（仅 embed 豁免，导出未豁免）
3. `getAuthHeaders` 把导出 URL 的 `?token=` 误判为 embed token，优先发 `X-Embed-Token`

## 错误做法（避免）

- 导出快照页复用需登录的 `query/dataset/execute` / `query/execute`
- 仅靠 `?token=` 判断 embed（须结合 `/embed/` 路径）
- 无头渲染页 401 时清会话并 `navigate('/login')`

## 修复方式

- `fe/src/lib/api.ts`：`isHeadlessAuthContext`；导出优先 `X-Export-*`；401 不踢登录
- `fe/src/lib/chartExecuteProbe.ts`：导出走 `export-query` / `export-query/dataset/execute`
- `backend/.../export_snapshot.py` + `dashboards.py`：新增 dataset 导出代理；合成 actor 带 `admin` 绕过 ACL（边界由 export token 承担）
- `auth/middleware.py`：dataset 导出路径纳入 public export

## 验证

- Vitest：`api.test.ts` export snapshot auth；`chartExecuteProbe` 导出 dataset 路径
- pytest：`test_export_dataset_query_*`
- 试发：导出页停留且出现 `data-export-ready="true"`，不再进登录页

## 关联

- `DashboardExportSnapshotPage` · `export_render.py` · RPT-005
