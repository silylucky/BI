# FE/BE：删除同步任务后 Dataset 仍残留在列表

## 症状

- 在「数据同步」删除同步任务后，「数据集」列表仍显示对应 `origin=sync_job` 的 Dataset。
- 列表中的数据来自托管分析库历史快照，与已删除的源/任务不再对应，用户感知为「源删了但数据还在、未同步」。

## 根因

1. `DELETE /api/v1/ingestion/sync-jobs/{id}` 仅删除 `SyncJob`，未级联清理 `datasets` 表与 `query_config_records` 绑定。
2. `datasets.sync_job_id` 无 FK，`list_datasets` 不校验任务是否仍存在。
3. 增量同步本身不传播源端删行（PRD/ingestion 边界内），与「任务已删但 Dataset 仍展示」是不同问题。

## 修复

- `delete_sync_job` → `delete_datasets_for_sync_job` 级联删除同步产物 Dataset 及 `dataset_query` 绑定。
- `list_datasets` 启动时 `purge_orphan_sync_datasets` + `purge_datasets_with_missing_table_source` 清理历史孤儿。
- `delete_dataset` 同步删除 `bound_config_id` 对应 query config。
- 删除数据源前检查是否被同步任务或 Dataset `tableSourceDataSourceId` 引用。

- 手动 Dataset 的 `tableSourceDataSourceId` 指向已软删数据源时，列表加载时一并清理。

## 锚点

- `backend/app/metadata/dataset/cleanup.py`
- `backend/app/api/v1/ingestion/sync.py` `delete_sync_job`
- `backend/app/metadata/dataset/service.py` `list_datasets` / `delete_dataset`
- `tests/test_dataset_sync_cleanup.py`

## 回归

```bash
cd backend && python -m pytest ../tests/test_dataset_sync_cleanup.py -q
```

## 未覆盖（产品边界）

- 增量同步模式下源表删行不会从分析库删除；需全量同步或重建任务。
