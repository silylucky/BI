# API · 查询执行

| 字段 | 值 |
|------|-----|
| consumers | postman · 图表直连联调 |
| 路由索引 | [README.md §4](./README.md#4-查询执行if-06--m3-lite) |
| 域附录 | [services/query.md](../services/query.md) |

## 概述

M3-LITE：SQL / table 模式执行、图表绑定（`bindingId`）、Dataset 配置执行；只读，强制 LIMIT 与超时（`QUERY_DEFAULT_LIMIT` / `QUERY_TIMEOUT_SECONDS`）。

## 鉴权

Bearer JWT；执行前校验数据源 ACL 与 RLS（M7）。

## 端点索引（联调优先）

| ID | 方法 | 路径 | 摘要 | 成功码 |
|----|------|------|------|--------|
| Q-01 | POST | `/api/v1/query/execute` | SQL/table 执行 | 200 |
| Q-02 | GET | `/api/v1/query/bindings` | 绑定列表 | 200 |
| Q-03 | POST | `/api/v1/query/bindings` | 创建绑定 | 201 |
| Q-04 | POST | `/api/v1/query/execute-binding` | 按 bindingId 执行 | 200 |
| Q-05 | POST | `/api/v1/query/dataset/execute-config` | Dataset 配置执行 | 200 |

`POST /api/v1/query/dataset/execute-plan` 为规划/stub 路径 — 勿用于生产验收；见 code-reviewer 与 mock 登记。

## 端点详述

### Q-01 · POST `/api/v1/query/execute`

Table 模式（需有效 `dataSourceId`）：

```json
{
  "dataSourceId": "<uuid>",
  "mode": "table",
  "table": "vs_official_sales",
  "limit": 100
}
```

```bash
curl -sS -X POST "$baseUrl/api/v1/query/execute" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"dataSourceId":"...","mode":"table","table":"vs_official_sales","limit":10}'
```

### Q-04 · POST `/api/v1/query/execute-binding`

```json
{
  "bindingId": "<uuid>",
  "parameters": {}
}
```

## 错误信封

统一 `{ "code", "message", "detail" }`；常见：`PERMISSION_DENIED` · `DATASOURCE_NOT_FOUND` · 查询超时/超限。

## 冒烟清单

1. 准备可查询的 `dataSourceId`（官方 `demo` 或自建源）
2. `POST /api/v1/query/execute` table 模式 → 200 + `rows`
3. 创建 binding → `POST /api/v1/query/execute-binding` → 与直连结果一致
4. 越权 `dataSourceId` → 403/404（非 200 空数据）

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-08-09 | 初版可消费：execute / bindings / execute-plan 边界说明 |
