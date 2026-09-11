# designer — 可视化设计器

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/designer/` |
| PRD | [F12-DESIGN](../automate/prd/F12-DESIGN.md) · DESIGN-001 ~ DESIGN-005 |
| 里程碑 | M2（四期） |
| 状态 | **部分（L1 + F-E 批次 2）** |

## 职责

- **字段注册表与 SQL 预览**（DESIGN-001 r245）：`GET /fields`、`POST /preview/translate`
- **配置快照与一键提交工单**（DESIGN-004 r245/r246）：`capture_snapshot` + `POST /submit-workflow`；`GET /snapshots/{id}` ACL；`snapshotRevision` 写入实例 payload
- **设计器工单关联**（DESIGN-004 r246）：双向 `workflow-link` 查询/撤回；实例列表与快照回看
- **传统 SQL 模式**（DESIGN-005 r246）：`design_mode` 切换 + Admin SQL 面板；submit 按 mode 分支完整性校验
- **运算规则维护**（DESIGN-002）：表达式白名单、依赖环检测与持久化
- **输出字段与聚合**（DESIGN-003）：字段注册表 + glossary 元字段引用校验与持久化
- **传统 SQL 模式**（DESIGN-005）：只读 SQL 校验、能力声明与持久化（`design_mode` + `sql_mode`）
- 图表/Dashboard 设计器服务端契约（保存草稿、校验）
- 与 `metadata` Dataset 的设计态绑定（四期）
- 设计资源版本与协作锁（按需）

## 边界

| In | Out |
|----|-----|
| 查询条件/运算规则 schema 校验与 API | 画布 UI（前端 Admin） |
| SQL 模式/输出字段 schema 校验与 API | 运行时查询（→ `query`） |
| 配置持久化委托 `query/config_store` | 完整 BPM 工单 UI（四期） |
| workflow-link 契约（`designer/workflow.py`） | BPM 状态推送/企微通知（companion） |

## 依赖

- `core`、`auth`
- `query/config_store`（QUERY-007）：`query_conditions` / `compute_rules` / `sql_mode` / `output_fields` 类型存储
- `metadata`、`dashboard`（发布衔接，四期）

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `QueryConditionsConfig` | 查询条件 schema v1.0 | DESIGN-001 | L1 已实现 |
| `ComputeRulesConfig` | 运算规则 schema v1.0 | DESIGN-002 | L1 已实现 |
| `SqlModeSpec` / `sql_mode.py` | SQL 只读模式校验 + 持久化 | DESIGN-005 | L1 已实现 |
| `OutputFieldsConfig` / `output_fields.py` | 输出字段/聚合校验 + 持久化 | DESIGN-003 | L1 已实现 |
| `preview.py` | 字段注册表 + 预览翻译（DESIGN-001 r245） | DESIGN-001 | L1 已实现 |
| `snapshot.py` | 设计器三块配置不可变快照 + owner ACL | DESIGN-004 | L1 已实现 r245/r246 |
| `workflow.py` | 工单 link 双向查询/撤回 + submit 快照修订 | DESIGN-004 | L1 已实现 r246 |
| `sql_mode.py` | `design_mode` + SQL 只读模式 | DESIGN-005 | L1 已实现 r246 |
| `workflow.py` | 设计器项与工单实例关联 + submit_with_snapshot | DESIGN-004 | L1 已实现 r245 |
| `designer/service` | 校验 + 委托 config_store | DESIGN-001/002 | L1 已实现 |
| `DesignerService` | 草稿与校验（全量） | DESIGN-001~003 | 待建 |
| `ChartViewConfig` | 图表配置契约（与 `schemas` 共享） | DESIGN-004~005 · F06-VIZ | 待建 |

## 错误码（L1）

| code | 场景 |
|------|------|
| `DESIGN_EMPTY_CONDITIONS` | 条件列表为空 |
| `DESIGN_INVALID_OPERATOR` | 未知操作符 |
| `DESIGN_VALUE_TYPE_MISMATCH` | 值与 valueType 不匹配 |
| `DESIGN_INVALID_EXPRESSION` | 表达式不在白名单 |
| `DESIGN_RULE_CYCLE` | 规则 dependsOn 成环 |
| `DESIGN_UNKNOWN_FIELD` | 未知 fieldId（不在注册表） |
| `DESIGN_INVALID_CROSS_FIELD` | 跨字段/自引用 value |
| `DESIGN_RULE_TYPE_MISMATCH` | ruleType 与 expression 不一致 |
| `DESIGN_RULE_BROKEN_CHAIN` | dependsOn 引用未知规则 id |
| `DESIGN_INVALID_AGGREGATE` | 非法聚合函数（如 median） |
| `DESIGN_EMPTY_OUTPUT_FIELDS` | 输出字段列表为空 |
| `DESIGN_SQL_NOT_READONLY` | SQL 非只读 |
| `DESIGN_SQL_EMPTY` | SQL 为空 |
| `DESIGN_UNKNOWN_TARGET_FIELD` | targetField 不在注册表 |

## 字段注册表（L1 stub）

`DESIGNER_FIELD_REGISTRY`：`order_amount`、`order_date`、`customer_id`、`status`、`region_code`（及 r32 兼容 `amount`、`x`、`y`）。

## 关联 API

见 [api/README.md](../api/README.md) §4 查询配置与 §设计器。

## 实现笔记

- r32：`backend/app/api/v1/designer.py`；持久化 type=`query_conditions`|`compute_rules` 经 QUERY-007
- r49：`sql_mode.py`/`output_fields.py`；`config_type=sql_mode`|`output_fields`；DESIGN-005 委托 `query/readonly.assert_readonly_sql`

### r52 companion 质量推分（DESIGN-005/003）

- **DESIGN-005**：`sql_mode` 校验失败 `detail.remediation`；`probe_validate_sql_mode`；`chart_view` sql 模式联动 `CHART_SQL_NOT_READONLY`（委托 `assert_readonly_sql`）
- **DESIGN-003**：`MAX_OUTPUT_FIELDS=64`、`MAX_AGGREGATES=16`；重复 fieldId → `DESIGN_DUPLICATE_OUTPUT_FIELD`；`probe_validate_output_fields`（<50ms smoke）

### r63 companion 质量推分（DESIGN-004）

- `probe_validate_workflow_link_budget_ms`（50ms）；`DESIGN_WORKFLOW_CATALOG_MISMATCH`（query designType 禁止 catalogEntryId）
