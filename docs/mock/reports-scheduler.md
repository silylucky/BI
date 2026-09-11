# 报表调度 Mock / Semi-real

| 字段 | 值 |
|------|-----|
| 模块 | `backend/app/reports/scheduler/` |
| 域附录 | [services/reports.md](../services/reports.md) |
| API | `POST /api/v1/reports/schedules/{id}/execute` |

## 执行 mock（probe）

| 开关 | 行为 |
|------|------|
| Header `X-Rpt-Execute-Mock: 1` | `mock_execute_schedule`；产物 `test://` URI（非客户默认路径） |
| 默认 | `semi_real_execute_schedule` |

## 投递 mock

| 开关 | 行为 |
|------|------|
| 未配 SMTP 且无 `X-Rpt-Delivery-Mock` | `unconfigured`（**禁止**静默 `delivered`） |
| Header `X-Rpt-Delivery-Mock: 1` | `_deliver_explicit_mock`（测试/探针） |

## 相关代码

- `scheduler/executor.py` · `scheduler/delivery.py` · `scheduler/delivery_adapter.py` · `scheduler/channels/dispatch.py`
- `api/v1/reports/__init__.py` 透传 header
