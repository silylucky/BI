# API · 数据源（连接层）

| 字段 | 值 |
|------|-----|
| consumers | postman · 控制台联调 |
| 路由索引 | [README.md §3](./README.md#3-数据源if-06--连接层) |
| 域附录 | [services/datasources.md](../services/datasources.md) |

## 概述

数据源 CRUD、连通性测试、元数据浏览（schema/table/column）；凭证 **SM4** 加密存储，API 不返回明文密码。

## 环境与 Base URL

同 [auth.md](./auth.md)；所有端点需 Bearer token（`datasource:*` 等权限由 RBAC 控制）。

## 鉴权

先完成 [auth.md](./auth.md) 登录；列表/详情受数据源 ACL 过滤。

## 网关要点

| uri 前缀 | methods | 备注 |
|----------|---------|------|
| `/api/v1/datasources*` | GET, POST, PUT, PATCH, DELETE | 写操作需对应 capability |

## 端点索引（联调优先）

| ID | 方法 | 路径 | 摘要 | 成功码 |
|----|------|------|------|--------|
| DS-01 | GET | `/api/v1/datasources` | 列表（ACL；默认隐藏托管分析库，`includeManaged=true` 可见） | 200 |
| DS-02 | POST | `/api/v1/datasources` | 创建 | 201 |
| DS-03 | GET | `/api/v1/datasources/{id}` | 详情 | 200 |
| DS-04 | POST | `/api/v1/datasources/{id}/test` | 连通性测试 | 200 |
| DS-05 | GET | `/api/v1/datasources/types` | 已注册连接器类型 | 200 |
| DS-06 | GET | `/api/v1/datasources/{id}/schemas` | schema 列表 | 200 |

完整路由见 README §3。

## 端点详述

### DS-02 · POST `/api/v1/datasources`

创建 MySQL 样例源（本地 `sample-mysql:3307`）：

```json
{
  "name": "联调样例 MySQL",
  "type": "mysql",
  "connection": {
    "host": "localhost",
    "port": 3307,
    "database": "sample_db",
    "username": "sample",
    "password": "sample"
  }
}
```

```bash
curl -sS -X POST "$baseUrl/api/v1/datasources" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d @body.json
```

### DS-04 · POST `/api/v1/datasources/{id}/test`

```bash
curl -sS -X POST "$baseUrl/api/v1/datasources/$id/test" \
  -H "Authorization: Bearer $token"
```

成功时返回连通性结果对象；失败信封 `code` + `message`（非假成功）。

## 冒烟清单

1. 登录获 token
2. `GET /api/v1/datasources/types` → 含 `mysql` / `postgresql` 等
3. 创建或选用已有 `demo` 官方源
4. `POST .../test` → 成功
5. `GET .../schemas` → 返回 schema 列表

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-08-09 | 初版可消费：核心 CRUD/test/types/schemas |
