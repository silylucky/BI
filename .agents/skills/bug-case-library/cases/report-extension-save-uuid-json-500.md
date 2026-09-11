# 报表扩展配置保存 500：boundConfigId UUID 未 JSON 序列化

## 症状

- 文档模板 → 扩展配置 → 数据集模式 → 点「保存扩展配置」
- Toast：`后端服务内部错误，请重启 uvicorn 并查看终端日志`
- 终端：`TypeError: Object of type UUID is not JSON serializable`

## 根因

`extension/service.py` 的 `upsert` 用 `model_dump(by_alias=True)` 写入 `metrics` JSON 列；`MetricAdjustment.boundConfigId` 为 `uuid.UUID`，SQLAlchemy JSON 编码失败。

## 修复

`model_dump(by_alias=True, mode="json")`，使 UUID 落库为字符串。

## 锚点

- `backend/app/reports/extension/service.py` — `upsert`
- `backend/app/reports/extension/schemas.py` — `MetricAdjustment.boundConfigId`
