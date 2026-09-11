# Dataset 列表壳层同步 · matrix · 2026-07-31

| 字段 | 值 |
|------|-----|
| 路径 | **快捷** |
| 金标准 | `DatasourceListPage` · `/admin/datasources` · REV-03 |
| 金标准代换 | 无（用户未指定错标杆） |
| 同步层 | L2 + L3 |
| 状态 | **batch1-done** |

## Playbook 对照

| # | 项 | 金标准 | 目标（改前） | 层 | 动作 |
|---|-----|--------|--------------|-----|------|
| 3 | Toolbar SearchField | ✅ | ❌ | L2 | 补 filters + 客户端 filter |
| 4 | 筛选结果计数 | ✅ | ❌ | L2 | 补文案 |
| 5 | Error 在 table frame 内 | ✅ | ❌ 在 toolbar 下 | L3 | 移入 frame |
| 6 | loadingRows={5} | ✅ | ❌ | L3 | 加 prop |
| 6 | empty 有/无筛选分支 | ✅ | ❌ | L3 | hasFilters 空态 |

## 批次

| 批次 | 页面 | 文件 | 状态 |
|------|------|------|------|
| 1 | DatasetListPage | `fe/src/pages/admin/datasets/DatasetListPage.tsx` | done |

## 关联

- critique：`docs/ux-critique/2026-07-30-datasources-backlog.md` ISSUE-001、ISSUE-002
- receipt：`2026-07-31-dataset-list-sync-receipt.md`
