# page-style-sync 收据 · batch 1 · 2026-07-31

| 项 | 值 |
|----|-----|
| 路径 | 快捷 |
| 金标准 | `DatasourceListPage` · `/admin/datasources` · REV-03 |
| 金标准代换 | 无 |
| 同步层 | L2 + L3 |
| 本批页面 | `DatasetListPage` |
| check:design | fail（仓库既有 hex 违规，**本批触及文件无新增**） |

## 触及文件

- `fe/src/pages/admin/datasets/DatasetListPage.tsx`

## 壳层改动

| 页 | 层 | 改动 |
|----|-----|------|
| DatasetListPage | L2 | `ListPageToolbar` 增加 `SearchField`；批量区旁「筛选结果 N 条」 |
| DatasetListPage | L2 | 客户端 filter（名称/ID）；有搜索时隐藏分页（未改 API） |
| DatasetListPage | L3 | `PageErrorBanner` 移入 `ListPageTableFrame` |
| DatasetListPage | L3 | `DataTable` 增加 `loadingRows={5}`；筛选/空态分支 |

## 未改

- columns 语义、queryKey 结构、DELETE API、RBAC、路由

## 关联

- 矩阵：`2026-07-31-dataset-list-sync-matrix.md`
- critique：ISSUE-001、ISSUE-002（datasources backlog）

## 下一批

- 无（本模块列表壳层已与金标准对齐）
