# M13 设计器 + M11 OpenSearch + 治理/查询 L1 kickoff r49 设计

```yaml
date: 2026-07-04
milestone: M13/M11/GOV/QUERY
round_target: docs/superpowers/evolution/2026-07-04-round-target.md
prd_ids: [DESIGN-005, DESIGN-003, CONN-016, GOV-003, QUERY-003]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | 传统 SQL 模式 spec + 校验 REST | DESIGN-005 | `designer/` | 1（hub #1，用户价值 44%） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | 设计器域具备 SQL Lab 式契约与只读 SQL 守卫入口（无 Admin UI） |
| 2 | 输出字段与聚合配置契约 | DESIGN-003 | `designer/` | 2（hub #2） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | 输出字段/聚合规则可登记、非法 spec 结构化拦截 |
| 3 | OpenSearch 方言 + types catalog | CONN-016 | `datasources/dialects/` | 3（hub #3，G2） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | 数据源类型可选 `opensearch`；连通/索引 mapping 探测 mock smoke |
| 4 | 工单流程模板 REST 骨架 | GOV-003 | `governance/workflow/` | 4（hub #4） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | 治理域第三类能力可探测：模板登记 + 状态迁移守卫 |
| 5 | Native 查询双路径契约 + 路由守卫 | QUERY-003 | `query/native/` | 5（hub #5） | 完整度 **5%→≥76%**；架构 **12%→≥66%** | 搜索/文档/时序走 native 路径；禁止 SQL 伪装；非法入参 4xx |

**依赖链**：DESIGN-005 SQL 守卫（复用 `query/readonly`）→ DESIGN-003 输出字段（复用 `DESIGNER_FIELD_REGISTRY`）→ CONN-016 经 `register_connector_plugin` 登记 → GOV-003 工作流 FSM（对齐 `governance/publish` 模式）→ QUERY-003 路由守卫引用 `export_type_catalog()` category → `test_design_conn_gov_query_r49.py` smoke → r32 `test_meta_design_r32` 21/21 + r33 19/19 + r46 `test_nfr_gov_conn_r46` 36/36 回归 → P5 五 ID 加权总分 L1 目标 **≥85**（r50 companion **≥90**）。

**上轮已交付（本轮不重复）**：r32/r33 DESIGN-001/002 conditions + compute-rules；r34/r35 CONN-015 Elasticsearch；r46 GOV-005 publish FSM + NFR-005 `register_connector_plugin`；**不含** Admin 设计器 UI、OpenSearch 生产 HA、GOV BPM 全量工单、QUERY-003 Dataset 全链路（M13 四期）、r46 STUCK 簇 companion 推分。

**PRD 分片锚点漂移注记**（真理源：`round-target` > `prd.md` hub > 分片）：

| 项 | hub / round-target | 分片（陈旧） |
|----|-------------------|-------------|
| DESIGN-003/005 代码锚点 | `backend/app/designer/`（r32 已落地） | `frontend/src/pages/designer/...` |
| CONN-016 代码锚点 | 扁平 `dialects/opensearch.py`（与 r34 ES 惯例） | `dialects/opensearch/` 子目录 |
| GOV-003 代码锚点 | `governance/workflow/` + gov 路由 | 与 publish 子包并列 |
| QUERY-003 代码锚点 | `query/native/` + query 路由扩展 | 远期 `query/native/` 全执行链 |

本轮实现以 **hub + round-target + 现有 `designer/` / 扁平 dialects / governance 子包惯例** 为准；P5 回写分片锚点与验收勾选。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11/M13；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `designer/schemas.py` | DESIGN-001/002 条件与运算规则；`DESIGNER_FIELD_REGISTRY`；`DesignerError` + `DESIGN_*` 错误码 |
| `designer/service.py` | validate/save/get conditions + compute-rules；挂载 `config_store` |
| `api/v1/designer.py` | 5 路由（validate/put/get conditions + put/get compute-rules）；tags DESIGN-001/002 |
| `datasources/__init__.py` | 注册 19 种方言（含 gbase via plugin）；**无** `opensearch` |
| `dialects/elasticsearch.py` | ES L1 完整（test_connection/list_schemas/list_columns）；`ES_*` 错误码 |
| `core/nfr/plugin_extension.py` | `register_connector_plugin` 就绪（r46 NFR-005） |
| `governance/publish/` | GOV-005 状态机 `draft→pending_publish→published`（r46） |
| `governance/` | **无** `workflow/` 子包 |
| `query/readonly.py` | 只读 SQL 守卫完整（DML/DDL/多语句/注释剥离） |
| `query/translator/` | QUERY-008 翻译器；消费 `DESIGNER_FIELD_REGISTRY` |
| `query/` | **无** `native/` 子包；执行链仅 SQL/table 模式 |
| `api/v1/query.py` | execute + bindings + translate；**无** native 路由 |
| `api/v1/gov.py` | catalog + query-design + publish（r46）；**无** workflow 路由 |
| `pyproject.toml` connectors-ext | 含 `elasticsearch`；**无** `opensearch-py` |

**范围框定模块**（3）：`backend/app/designer/` + `backend/app/datasources/dialects/` + `backend/app/governance/` + `backend/app/query/native/`（横切面，计为 query 模块扩展）。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/designer/schemas.py` | DESIGN-003/005 | 修改：增 `OutputFieldsConfig`、`SqlModeSpec` 等 DTO |
| `backend/app/designer/output_fields.py` | DESIGN-003 | 新建：校验 + config_store 持久化 |
| `backend/app/designer/sql_mode.py` | DESIGN-005 | 新建：SQL 校验（委托 `readonly`）+ capabilities |
| `backend/app/api/v1/designer.py` | DESIGN-003/005 | 修改：追加 5 路由 |
| `backend/app/datasources/dialects/opensearch.py` | CONN-016 | 新建：`OpensearchConnector` |
| `backend/app/datasources/dialects/errors.py` | CONN-016 | 修改：`map_opensearch_error` + `OPENSEARCH_*` |
| `backend/app/datasources/dialects/__init__.py` | CONN-016 | 修改：导出 `OpensearchConnector` |
| `backend/app/datasources/__init__.py` | CONN-016 | 修改：`register_connector_plugin(OpensearchConnector())` |
| `backend/app/governance/workflow/__init__.py` | GOV-003 | 新建 |
| `backend/app/governance/workflow/schemas.py` | GOV-003 | 新建：模板/实例/迁移 DTO |
| `backend/app/governance/workflow/service.py` | GOV-003 | 新建：模板校验 + 实例 FSM |
| `backend/app/governance/workflow/errors.py` | GOV-003 | 新建：`WorkflowError` + `GOV_WORKFLOW_*` |
| `backend/app/api/v1/gov.py` | GOV-003 | 修改：追加 workflow 路由簇 |
| `backend/app/query/native/__init__.py` | QUERY-003 | 新建 |
| `backend/app/query/native/schemas.py` | QUERY-003 | 新建：`NativeQuerySpec`、`RoutingDecision` |
| `backend/app/query/native/guard.py` | QUERY-003 | 新建：`resolve_query_mode` + `validate_native_spec` |
| `backend/app/api/v1/query.py` | QUERY-003 | 修改：`POST /native/validate` + `GET /routing/modes` |
| `tests/test_design_conn_gov_query_r49.py` | 全部 | 新建（≥35 条断言函数） |

**跨模块只读依赖**（不修改，测试中引用）：`export_type_catalog()`、`register_connector_plugin`、`assert_readonly_sql`、`DESIGNER_FIELD_REGISTRY`、`test_meta_design_r32/r33`、`test_nfr_gov_conn_r46`。

**真理源优先级**：`round-target` > `prd.md` hub + 分片 > `docs/services/` > `docs/api/README.md`。

**本轮性质**：跨域 **L1 kickoff**（契约 + 守卫 smoke + pytest mock）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、OpenSearch 只读查询执行、GOV 真实 BPM 引擎、Alembic migration（workflow 实例 L1 用 `config_store` 或内存 dict）。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/designer/
├── schemas.py              # +OutputFieldItem, OutputFieldsConfig, SqlModeSpec
├── output_fields.py        # DESIGN-003 validate/save/get
└── sql_mode.py             # DESIGN-005 validate_sql + capabilities

backend/app/datasources/dialects/
└── opensearch.py           # CONN-016：OpenSearch 方言

backend/app/governance/workflow/
├── __init__.py
├── schemas.py              # WorkflowTemplate, WorkflowInstance, TransitionIn
├── service.py              # validate_template, create_instance, transition
└── errors.py               # GOV_WORKFLOW_INVALID_TRANSITION 等

backend/app/query/native/
├── __init__.py
├── schemas.py              # NativeQuerySpec, QueryRoutingOut
└── guard.py                # resolve_query_mode, validate_native_spec

backend/app/api/v1/
├── designer.py             # +output-fields + sql-mode 路由
├── gov.py                  # +workflow 路由簇
└── query.py                # +native/validate + routing/modes

tests/
└── test_design_conn_gov_query_r49.py
```

### 3.2 方案比选（Automation 代替用户对话）

#### DESIGN-005 传统 SQL 模式

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `SqlModeSpec` + `validate_sql_mode()` 委托 `assert_readonly_sql`；capabilities 返回允许的 statement 类 | 复用 QUERY 只读链；L1 无执行 |
| B | 新建 designer 内联 SQL 解析器 | 与 `readonly.py` 重复；可靠性风险 |
| C | 直接暴露 `POST /query/execute` 给设计器 | 越界 entry；无 spec 契约 |

**选用 A**；错误码映射：`QueryError` → `DesignerError` 包装为 `DESIGN_SQL_NOT_READONLY` / `DESIGN_SQL_TOO_LONG`（保留原 message，detail 一致）。

#### DESIGN-003 输出字段与聚合

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `OutputFieldsConfig` 含 `fields[]`（fieldId/alias/visible）+ `aggregates[]`（fn/groupBy）；校验 registry + 白名单聚合 | 与 r32 compute-rules 对称；META-004 L1 用 `metaFieldRef` 可选引用 glossary code |
| B | 合并进 compute-rules 单配置 | 混淆条件/输出语义；破坏 DESIGN-001/002 边界 |
| C | 依赖 META-004 Dataset ORM | Dataset 未实现；超 L1 |

**选用 A**；允许聚合函数：`sum`/`avg`/`count`/`min`/`max`（L1 白名单）；`groupBy` 字段须在 `DESIGNER_FIELD_REGISTRY`；空 `fields` → `DESIGN_EMPTY_OUTPUT_FIELDS`。

**META-004 联动（L1 最小）**：`OutputFieldItem.meta_field_ref` 可选；若提供则须在 glossary `code` 集合或 `DESIGNER_FIELD_REGISTRY` 中，否则 `DESIGN_UNKNOWN_META_REF`（测试用 r32 fixture 创建的 `order_amount` term）。

#### CONN-016 OpenSearch

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `opensearch.py` 镜像 `elasticsearch.py`；`opensearch-py` 加入 connectors-ext；`OPENSEARCH_*` 独立错误域 | 与 ES 解耦 branding；G2 搜索类独立 type |
| B | `type=opensearch` 但内部复用 `ElasticsearchConnector` | 错误码混用 ES_*；不满足 PRD |
| C | 仅 catalog 登记无 connector 实现 | 完整度不足 |

**选用 A**；`type=opensearch`，`category=search`，`capabilities=("connectivity_test", "schema_browser")`；`OPENSEARCH_MAX_MAPPING_FIELDS=500`；登记路径 **`register_connector_plugin`**（对齐 NFR-005）；默认 port **9200**（与 ES 相同，display_name=`OpenSearch`）。

#### GOV-003 工单流程模板

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | 内存 builtin 模板 + `config_store` 持久化实例；FSM 五态 + 角色守卫 | 无 migration；对齐 publish/service 模式 |
| B | 新 ORM `workflow_instances` 表 | 超 L1 文件预算 |
| C | 仅 OpenAPI schema 无 endpoint | 完整度不足 |

**选用 A**。

**状态集合**（PRD FR-1.2）：`draft` → `pending_approval` → `designing` → `pending_publish` → `published`。

**允许迁移**：

| 当前状态 | 动作 | 目标状态 | 角色守卫（L1） |
|----------|------|----------|----------------|
| `draft` | `submit` | `pending_approval` | `requester` |
| `pending_approval` | `approve` | `designing` | `approver` |
| `pending_approval` | `reject` | `draft` | `approver` |
| `designing` | `complete_design` | `pending_publish` | `designer` |
| `pending_publish` | `publish` | `published` | `publisher` |

非法迁移 → 400 `GOV_WORKFLOW_INVALID_TRANSITION`；角色不匹配 → 403 `GOV_WORKFLOW_FORBIDDEN_ROLE`；未知模板 → 404 `GOV_WORKFLOW_TEMPLATE_NOT_FOUND`。

**与 publish 边界**：`pending_publish→published` 的 `publish` 动作 L1 仅更新 workflow 实例状态，**不**调用 `integration.publish_service`（远期 GOV-004/005 衔接）。

#### QUERY-003 Native 双路径

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `resolve_query_mode(connector_type)` 基于 catalog `category`；`native` 类别 = `search`/`document`/`timeseries`；守卫拒绝 `sql` 字段 | 零侵入 executor；架构清晰 |
| B | 在 `QueryExecutor` 内分支 | 超 L1 范围；文件膨胀 |
| C | 仅文档约定无 API | 完整度/测试覆盖不足 |

**选用 A**。

**路由规则**：

```python
NATIVE_CATEGORIES = frozenset({"search", "document", "timeseries"})
# mysql/postgresql/... → "sql"
# opensearch/elasticsearch/mongodb/influxdb/... → "native"
```

**`NativeQuerySpec`**：`connectorType` + `body`（dict，如 ES `{"query":{"match_all":{}}}`）+ 可选 `index`；**禁止**同时携带 `sql` 字段。

守卫错误码：`QUERY_NATIVE_SQL_DISGUISE`（native 模式含 sql）、`QUERY_NATIVE_EMPTY_BODY`、`QUERY_NATIVE_UNSUPPORTED_CONNECTOR`、`QUERY_NATIVE_INVALID_BODY`。

**不做 SQL 伪装**：relational 连接器若提交 `body` 而非 `sql` → `QUERY_NATIVE_WRONG_MODE`（422）。

L1 **不实现** native 执行器；仅契约 + 路由探测 + 守卫 smoke。

## 4. 子项详细设计

### 4.1 DESIGN-005 — 传统 SQL 模式

#### Schema（`designer/schemas.py` 追加）

```python
class SqlModeSpec(BaseModel):
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    data_source_id: uuid.UUID = Field(alias="dataSourceId")
    sql: str = Field(min_length=1, max_length=65536)
    parameters: dict[str, object] = Field(default_factory=dict)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
```

#### API（`api/v1/designer.py` 追加）

| Method | Path | 行为 |
|--------|------|------|
| POST | `/designer/sql-mode/validate` | 校验 SQL 只读 + dataSourceId 非空；200 返回 `SqlModeSpec` |
| GET | `/designer/sql-mode/capabilities` | 返回 `{allowedStatements:["SELECT"], maxSqlLength:65536, highlightSupported:false}` |
| PUT | `/designer/sql-mode` | validate 通过后 `config_store` 持久化 `config_type=sql_mode` |
| GET | `/designer/sql-mode` | 按 ref_type/ref_id 读取 |

#### 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-DESIGN-R49-005-01 | 合法 `SELECT 1` → validate 200 |
| T-DESIGN-R49-005-02 | `INSERT INTO t VALUES(1)` → 422 `DESIGN_SQL_NOT_READONLY` |
| T-DESIGN-R49-005-03 | 空 SQL → 422 `DESIGN_SQL_EMPTY` |
| T-DESIGN-R49-005-04 | PUT 合法 spec → GET 往返一致 |
| T-DESIGN-R49-005-05 | GET capabilities 含 `maxSqlLength=65536` |

### 4.2 DESIGN-003 — 输出字段与聚合配置

#### Schema

```python
class OutputFieldItem(BaseModel):
    field_id: str = Field(alias="fieldId")
    alias: str | None = None
    visible: bool = True
    meta_field_ref: str | None = Field(default=None, alias="metaFieldRef")

class AggregateItem(BaseModel):
    fn: str  # sum|avg|count|min|max
    field_id: str = Field(alias="fieldId")
    group_by: list[str] = Field(default_factory=list, alias="groupBy")

class OutputFieldsConfig(BaseModel):
    schema_version: str = Field(alias="schemaVersion", default="1.0")
    fields: list[OutputFieldItem]
    aggregates: list[AggregateItem] = Field(default_factory=list)
    ref_type: str = Field(default="design_draft", alias="refType")
    ref_id: uuid.UUID = Field(alias="refId")
```

#### API

| Method | Path | 行为 |
|--------|------|------|
| POST | `/designer/output-fields/validate` | 校验 fields 非空、fieldId 在 registry、聚合 fn 白名单 |
| PUT | `/designer/output-fields` | 持久化 `config_type=output_fields` |
| GET | `/designer/output-fields` | 按 ref 读取 |

#### 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-DESIGN-R49-003-01 | 合法 fields PUT → GET 往返 |
| T-DESIGN-R49-003-02 | 空 fields → 422 `DESIGN_EMPTY_OUTPUT_FIELDS` |
| T-DESIGN-R49-003-03 | 未知 fieldId → 422 `DESIGN_UNKNOWN_FIELD` |
| T-DESIGN-R49-003-04 | 非法聚合 fn `median` → 422 `DESIGN_INVALID_AGGREGATE` |
| T-DESIGN-R49-003-05 | `metaFieldRef=order_amount`（glossary 存在）→ 200 |
| T-DESIGN-R49-003-06 | 与 DESIGN-005 同 ref_id 可并存读取 conditions + output-fields + sql-mode |

### 4.3 CONN-016 — OpenSearch 连接器

#### Connector 契约（`opensearch.py`）

- 类 `OpensearchConnector`：`type="opensearch"`，`category="search"`
- `test_connection`：空 host → `OPENSEARCH_INVALID_HOST`；auth/timeout/refused 映射
- `list_schemas`：cat indices（过滤 `.` 前缀）
- `list_columns`：mapping properties 类型归一（复用 ES `_ES_TYPE_MAP` 逻辑，模块内复制常量避免 cross-import 耦合）
- `open_connection` → `OpenSearch` client（`opensearch-py`）

#### errors.py 追加

`OPENSEARCH_INVALID_HOST`、`OPENSEARCH_CONNECTION_REFUSED`、`OPENSEARCH_AUTH_FAILED`、`OPENSEARCH_TIMEOUT`、`OPENSEARCH_UNKNOWN`

#### pyproject.toml

`connectors-ext` 追加 `opensearch-py>=2.4.0`（与 elasticsearch 并列 optional）。

#### 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R49-016-01 | `export_type_catalog()` 含 `opensearch`，category=`search` |
| T-CONN-R49-016-02 | `get_plugin_registration_meta("opensearch")` 含 `registered_via=plugin` |
| T-CONN-R49-016-03 | mock client.info 成功 → test_connection ok=True |
| T-CONN-R49-016-04 | 空 host → code=`OPENSEARCH_INVALID_HOST` |
| T-CONN-R49-016-05 | mock 401 → `OPENSEARCH_AUTH_FAILED` |
| T-CONN-R49-016-06 | list_columns 超 500 字段 truncate |

### 4.4 GOV-003 — 工单流程模板

#### Builtin 模板（`workflow/service.py`）

默认模板 id=`standard_query_release`：

```json
{
  "id": "standard_query_release",
  "name": "标准查询发布流程",
  "nodes": [
    {"id": "draft", "role": "requester"},
    {"id": "pending_approval", "role": "approver"},
    {"id": "designing", "role": "designer"},
    {"id": "pending_publish", "role": "publisher"},
    {"id": "published", "role": "publisher"}
  ]
}
```

#### API（`api/v1/gov.py` 追加）

| Method | Path | 行为 |
|--------|------|------|
| GET | `/gov/workflow/templates` | 列出 builtin 模板 |
| POST | `/gov/workflow/templates/validate` | 校验自定义模板 nodes 唯一、角色非空 |
| POST | `/gov/workflow/instances` | 创建实例（templateId + refId）；初始 `draft` |
| GET | `/gov/workflow/instances/{id}` | 状态 + allowedActions |
| POST | `/gov/workflow/instances/{id}/transition` | body: `{action, actorRole}` |

实例持久化：`config_store` `config_type=workflow_instance`（payload 含 status/templateId/history[]）。

#### 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-GOV-R49-003-01 | GET templates 含 `standard_query_release` |
| T-GOV-R49-003-02 | POST instance → status=draft |
| T-GOV-R49-003-03 | draft + submit + requester → pending_approval |
| T-GOV-R49-003-04 | pending_approval + approve + approver → designing |
| T-GOV-R49-003-05 | designing + complete_design + designer → pending_publish |
| T-GOV-R49-003-06 | pending_publish + publish + publisher → published |
| T-GOV-R49-003-07 | draft + publish → 400 `GOV_WORKFLOW_INVALID_TRANSITION` |
| T-GOV-R49-003-08 | pending_approval + approve + requester（错误角色）→ 403 `GOV_WORKFLOW_FORBIDDEN_ROLE` |

### 4.5 QUERY-003 — Native 查询双路径

#### API（`api/v1/query.py` 追加）

| Method | Path | 行为 |
|--------|------|------|
| GET | `/query/routing/modes` | 返回 `{modes:[{connectorType, mode}]}` 全 catalog 快照 |
| POST | `/query/native/validate` | 校验 `NativeQuerySpec`；200 返回 spec + resolvedMode |

#### 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-QUERY-R49-003-01 | routing modes 中 `opensearch`→`native`，`mysql`→`sql` |
| T-QUERY-R49-003-02 | opensearch + 合法 body 无 sql → validate 200 |
| T-QUERY-R49-003-03 | opensearch + 含 sql 字段 → 422 `QUERY_NATIVE_SQL_DISGUISE` |
| T-QUERY-R49-003-04 | mysql + body 无 sql → 422 `QUERY_NATIVE_WRONG_MODE` |
| T-QUERY-R49-003-05 | native + 空 body → 422 `QUERY_NATIVE_EMPTY_BODY` |
| T-QUERY-R49-003-06 | 未知 connectorType → 422 `QUERY_NATIVE_UNSUPPORTED_CONNECTOR` |

## 5. 测试策略

### 5.1 新套件 `test_design_conn_gov_query_r49.py`

- **夹具**：module-scoped sqlite memory（对齐 r32/r34 模式）；`AUTH = Bearer dev`
- **目标**：≥35 条断言函数（上表 30 条 + 5 条联动/健康检查）
- **联动**：T-R49-LINK-01 同 ref 读取 designer 三类配置；T-R49-LINK-02 `/health` 200
- **mock**：OpenSearch 使用 `@patch("app.datasources.dialects.opensearch.OpenSearch")` 或 `_build_client`

### 5.2 回归门控（P3/P4 必跑）

| 套件 | 门槛 |
|------|------|
| `test_design_conn_gov_query_r49.py` | 35/35 |
| `test_meta_design_r32.py` | 21/21 |
| `test_meta_design_r33.py` | 19/19 |
| `test_nfr_gov_conn_r46.py` | 36/36 |
| `ruff check .` | exit 0 |

## 6. 文档同步（P3 评估，design 仅列清单）

| 变更 | 同步目标 |
|------|----------|
| 新 designer 路由 9 条 | `docs/api/README.md` |
| designer 域扩展 | `docs/services/`（若存在 designer 附录则更新，否则 r32 锚点延续） |
| OpenSearch 方言 | `docs/services/datasources.md` |
| workflow 子包 | `docs/services/governance.md`（In/Out 增 workflow） |
| native 守卫 | `docs/services/query.md` |
| P5 勾选 | `prd/F12-DESIGN.md`、`F04-CONN.md`、`F10-GOV.md`、`F05-QUERY.md` |

## 7. 非目标（明确不做）

- Admin 设计器全量 UI（SQL 高亮编辑器、拖拽输出字段、工单看板）
- OpenSearch 生产集群 HA、只读 search 查询执行、compose 集成环境
- GOV BPM 全量工单引擎、≥2 真实总线端点、审批通知
- QUERY-003 Dataset 语义层全链路（M13 四期 META-004）
- `fe/` 任何文件触及
- Alembic migration（workflow 实例走 config_store）
- r46 STUCK 簇（NFR-005/006/007、GOV-005、CONN-019）companion 推分
- DESIGN-004 单独立项（12.1，Top5 已满）

## 8. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | L1 设计闭合方式 | L1 目标 |
|--------|------------------|-----------------|--------|
| DESIGN-005 | 完整度 5%、测试 0%、用户价值 44% | spec/validate REST + config_store + 5 pytest | ≥85 |
| DESIGN-003 | 完整度 5%、可靠性 0% | 输出字段/聚合契约 + 非法拦截 6 pytest | ≥85 |
| CONN-016 | 完整度 5%、测试 0% | dialect + plugin 登记 + mock smoke 6 pytest | ≥85 |
| GOV-003 | 完整度 5%、可靠性 0% | 五态 FSM + 角色守卫 8 pytest | ≥85 |
| QUERY-003 | 完整度 5%、架构 12% | 路由表 + native 守卫 6 pytest + 分层独立子包 | ≥85 |

## 9. UI 设计交付

**ui_design_skill**: `none`（本轮纯后端，不触及 `fe/`）

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `opensearch-py` 与 `elasticsearch` 依赖体积 | optional `connectors-ext`；测试 mock 不触网 |
| designer/schemas.py 行数逼近 200 行上限 | 聚合 DTO 保持精简；校验逻辑下沉 `output_fields.py`/`sql_mode.py` |
| workflow 与 publish 状态语义重叠 | 文档明确边界；L1 不串联 integration.publish_service |
| QUERY-003 与 QUERY-008 translator 循环依赖 | `native/guard.py` 仅依赖 `datasources.registry` 只读 catalog |

## 11. Spec Self-Review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 文件列表 18 ≤ 20，模块 3 域
- [x] 无 TBD/TODO 占位
- [x] 验收标准可测试（含测试 ID）
- [x] PRD 锚点漂移已注记
- [x] 非目标明确
- [x] ui_design_skill 已记录
