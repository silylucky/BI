# Sync → Dataset → Execute 消费链路 Truth Audit

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 脚本 | `scripts/truth_verify_sync_consume.py` |
| 范围 | 同步表 `orders_clean` → 登记 PG 5433 → 创建 Dataset → bind → `/query/dataset/execute` |

## 结论

消费路径已从「看板写 SQL」修正为 **Dataset 三步链路**（登记分析库 → 创建 Dataset → 空白看板选 Dataset）。

## 验证项

| 步骤 | 期望 | 状态 |
|------|------|------|
| PG `orders_clean` 存在 | 行数与样例列可读 | 脚本 `pg_probe` |
| `GET .../consume-hints` | 返回 `targetTable` / `suggestedDatasetId` | 有 `orders_clean` 任务时探测 |
| 创建/绑定 Dataset | `POST /datasets` + `bind-query-config` | `verify_dataset_chain` |
| Dataset 出数 | `POST /query/dataset/execute` 行数 = PG count | 同上 |
| UI 引导 | 无「看板 SQL」；有「创建数据集」按钮 | `SyncJobConsumeGuide` smoke |

## 运行

```bash
# 需 sample-mysql + analytics-postgres + 后端 8000
python scripts/truth_verify_sync_consume.py
```

## 相关锚点

- FE：`fe/src/lib/syncConsumePaths.ts` · `SyncJobConsumeGuide.tsx` · `DatasetFormPage.tsx`
- BE：`GET /api/v1/ingestion/sync-jobs/{id}/consume-hints` · `ensure_analytics_datasource`
- 用户指南：`docs/user-guide/ingestion-sync-jobs-how-to.md` §同步完成后
