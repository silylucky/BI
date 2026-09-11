# 信创部署验收（NFR-007）

> 报告端点：`GET /api/v1/nfr/xinchuang/deployment-report`  
> Markdown 导出：`GET /api/v1/nfr/xinchuang/deployment-report?format=markdown`

## 预期信创连接器（F-C CONN-017~022，r248）

`EXPECTED_XINCHUANG_TYPES = ("dm", "kingbase", "gbase", "oceanbase", "tidb", "gaussdb")`

响应字段 `missingExpectedTypes` = `EXPECTED` − 已注册信创方言。

## 报告字段

| 字段 | 说明 |
|------|------|
| `schemaVersion` | 报告 schema 版本（`1.0`） |
| `generatedAt` | ISO8601 生成时间 |
| `missingExpectedTypes` | 未注册的预期信创类型 |
| `registeredXinchuangConnectors` | registry 中 gbase/dm/gaussdb/kingbase 等 |
| `composeServices` | 解析仓库根 `docker-compose.yml` 服务名 |
| `dialectReadOnlySmoke` | 已注册信创方言存在性 smoke |
| `overallAcceptance` | `accepted` / `conditional` / `rejected` |
| `components` | DB/中间件/OS 组件清单 stub |

## Markdown 格式

`format=markdown` 返回 `text/markdown`，标题 `## 信创部署验收报告`，含连接器/compose/smoke 表格段落。

## docker-compose 对照

本地开发栈见仓库根 `docker-compose.yml`：`postgres`（5432）、`analytics-postgres`（5433）、`sample-mysql`（3307）、`sample-mariadb`（3308）、`sample-clickhouse`（8124）、`sample-timescaledb`（5434/`ops_tsdb`）。详见 `docs/arch.md` §9。

## 环境变量

| 变量 | 说明 |
|------|------|
| `XINCHUANG_DEPLOY_MODE=strict` | 无信创连接器 → 422 `XINCHUANG_NON_COMPLIANT` |
| `XINCHUANG_DEPLOY_MODE=permissive` | 默认 |

## pytest

- `tests/test_mfinal_fe_gov_batch3_r247.py` — `T-NFR-R247-007-*`
- `tests/test_mfinal_fe_gov_batch4_r248.py` — `T-NFR-R248-007-*`（schema/markdown/missing types）
- `@pytest.mark.xinchuang_smoke` — CONN-017~022 `describe_registration_path`
