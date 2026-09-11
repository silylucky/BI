# metadata — 元数据与语义层

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/metadata/` |
| PRD | [F11-META](../automate/prd/F11-META.md) · META-001 ~ META-006 |
| 里程碑 | M1（四期 Dataset 语义层） |
| 状态 | **已实现（M-DEPTH F-A）** · META-004 ORM + Admin UI + DatasetListPage（2026-07-29 doc sync） |

## 职责

- **术语字典**（`glossary/`）：业务术语 code/名称/定义维护（META-001）
- **业务主题树**（`themes/`）：多级主题节点、移动与环检测（META-002）
- **维度字典**（`dimensions/`）：维度 code 与枚举值注册/维护（META-003）
- **实体类型 schema**（`entity/`）：实体属性/生命周期配置（META-006）
- **Dataset 元数据项**（`dataset/`）：ORM 持久化 validate/list/create/update/delete/bind（META-004）
- **官方示例 Dataset**：启动 seed 仅保留四类典型（区域销售宽表、销售明细、销售地理、网格事件）；多余 `demo-*` 启动时删除，存量看板改绑到保留项
- 逻辑数据集（Dataset）定义：表关联、计算字段、指标维度（四期）
- 与物理数据源映射；版本与发布状态
- 为 `query` 四期提供语义解析输入
- 资产目录元数据（与 `governance` 协同）

## 边界

| In | Out |
|----|-----|
| 术语字典 CRUD、业务主题树 CRUD/move | 物理连接与方言（→ `datasources`） |
| 维度字典 CRUD、枚举值注册/列表/删除 | 物理字段映射（META-001 后续） |
| 实体类型 schema CRUD + GOV openapi 引用计数 | 物理字段映射（META-001 后续） |
| Dataset 元数据项 validate/list/create/update/delete/bind（`datasets` 表 ORM） | 物理字段映射（META-001 后续） |
| Dataset 语义模型 CRUD + 可视化编辑 + 计算字段 | 查询执行（→ `query`；主路径 `POST /query/dataset/execute`） |
| 图表可选绑定 Dataset（与直连 SQL 并存） | 一至三期「不经 Dataset」仅指合同主路径，非禁用本域 |

## 依赖

- `core`、`datasources`、`auth`

## 被依赖

- `query`（四期）、`governance`、`designer`

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `GlossaryTerm` / `glossary/service` | 术语字典 CRUD | META-001 | L1 已实现 |
| `ThemeNode` / `themes/service` | 主题树 CRUD/move、环检测 | META-002 | L1 已实现 |
| `DimensionDict` / `dimensions/service` | 维度字典 CRUD + 枚举值注册 | META-003 | L1 已实现 |
| `entity/service` | 实体类型 schema CRUD + `validate_entity_type_ref` | META-006 | L1 已实现 r54 |
| `dataset/service` + `DatasetRecord` | Dataset ORM（`datasets` · Alembic `0023`）+ validate/list/create/update/delete/bind + scope ACL + probe | META-004 | **已实现**（M-DEPTH F-A） |
| `physical/service` | 物理表 validate/register/list/update/delete + register-from-schema + `_ds_table_index` 复合唯一 | META-005 | L1 M8 r232 收官 |
| **FE** | `fe/src/pages/admin/datasets/DatasetListPage.tsx` · `DatasetEditorForm.tsx`（可视化编辑） | META-004 | M-DEPTH F-A · 2026-07-29 |
| `DatasetService` | 语义层 CRUD（ORM 四期） | META-001~003 | 待建 |
| `SemanticResolver` | 逻辑 → 物理 SQL | META-004 | 待建 |

## 错误码（L1）

| code | 场景 |
|------|------|
| `META_TERM_FORBIDDEN` | viewer/editor 写术语被拒（r244） |
| `META_THEME_FORBIDDEN` | viewer/editor 写主题被拒（r244） |
| `META_DIM_FORBIDDEN` | viewer/editor 写维度被拒（r244） |
| `META_DATASET_CONFIG_TYPE_INVALID` | bind 非 dataset_query 配置（r244） |
| `META_TERM_NOT_FOUND` | 术语不存在 |
| `META_TERM_IN_USE` | 术语被主题节点引用 |
| `META_THEME_NOT_FOUND` | 主题节点不存在 |
| `META_THEME_PARENT_NOT_FOUND` | 父节点不存在 |
| `META_THEME_CYCLE` | 移动形成环 |
| `META_THEME_HAS_CHILDREN` | 删除含子节点 |
| `META_TERM_INVALID_NAME` | name 仅空白 |
| `META_TERM_INVALID_STATUS` | status 非 active/inactive |
| `META_THEME_MAX_DEPTH` | 主题树深度超过 8 |
| `META_DIM_CODE_CONFLICT` | 维度 code 重复 |
| `META_DIM_NOT_FOUND` | 维度不存在 |
| `META_DIM_INVALID_CODE` | code 空白或非法 |
| `META_DIM_INVALID_NAME` | name 空白 |
| `META_DIM_INVALID_STATUS` | status 非法 |
| `META_DIM_VALUE_CODE_CONFLICT` | 同维度下 value code 重复 |
| `META_DIM_VALUE_INVALID_CODE` | value code 空白或不符合 `^[a-z][a-z0-9_]{1,63}$` |
| `META_DIM_VALUE_INVALID_LABEL` | value label 空白 |
| `META_DIM_VALUE_DUPLICATE_BATCH` | 同批次重复 value code |
| `META_DIM_VALUE_NOT_FOUND` | 枚举值不存在 |
| `META_DATASET_CONFLICT` | datasetId 重复 |
| `META_DATASET_NOT_FOUND` | Dataset 不存在 |
| `META_DATASET_EMPTY_TABLES` | tables 为空 |
| `META_DATASET_INVALID_FIELD` | computedFields 名非法 |
| `META_DATASET_FORBIDDEN` | viewer/enterprise scope 外写拒绝（r66） |
| `META_DATASET_DUPLICATE_TABLE` | tables 中 name 重复（r66） |
| `META_PHYSICAL_DS_TABLE_CONFLICT` | 同 dataSourceId+schema+table 重复 register-from-schema |

常量：`MAX_THEME_DEPTH=8`、`TERM_MAX_TEXT_LENGTH=4000`；migration `0016_dimension_dict.py`（`dimension_dicts` + `dimension_values`）；`0019_dimension_theme_node.py`（`dimension_dicts.theme_node_id` nullable FK → `theme_nodes.id`）。

### 写 ACL（r244 · META-001~003）

| 角色 | 读 | 写（POST/PUT/DELETE/move/register values） |
|------|----|---------------------------------------------|
| admin, analyst | 允许 | 允许 |
| editor, viewer, enterprise | 允许 | **拒绝** 403 `META_*_FORBIDDEN` |

实现：`metadata/_acl.py` → glossary/themes/dimensions service 写入口；Dataset 复用 r66 `_assert_dataset_write_access`。

列表探针：`probe_list_terms_budget_ms` / `probe_list_themes_budget_ms` / `probe_list_dimensions_budget_ms` ≤50ms。

### r244 F-D 收官（META-001~004 · 2026-07-07）

- **META-001~003**：共享写 ACL + Admin CRUD UI（`metadata-panels.tsx`）；维度可选 `themeNodeId` FK
- **META-004**：`PUT/DELETE /datasets/{id}`、`POST …/bind-query-config`；`bound_config_id` ORM 列（Alembic `0023`）；四步 QUERY 集成测 `tests/test_mfinal_fd_meta_r244.py`（28 条）；M-DEPTH F-A：`DatasetTablePicker` + `ComputedFieldsEditor` + `DatasetBindPanel`

## 关联 API

见 [api/README.md](../api/README.md) §7 元数据。

## 实现笔记

- r32：migration 0015（`glossary_terms`、`theme_nodes`）；`backend/app/api/v1/metadata.py` 统一 entry
- r38：migration 0016（`dimension_dicts`、`dimension_values`）；`dimensions/` 域模块 + 8 REST 路由（META-003 L1）
- r39：values `register_values` 批内重复预检；`list_values`/`list_dimensions` 分页 limit 上限 500（与 glossary 对齐）；`test_query_meta_conn_r39` T-META-R39-003-*

### r66 companion 质量推分（META-004）

- **META-004**：`dataset/service` — `set_user_dataset_scope` + `META_DATASET_FORBIDDEN`（viewer 写禁止 / enterprise `datasetId` 前缀 scope）；duplicate table name（`META_DATASET_DUPLICATE_TABLE`）；`probe_validate_dataset_budget_ms` / `probe_list_datasets_budget_ms` ≤50ms；**ORM + Alembic `0023_datasets_orm`**（重启可恢复；测试 `_store.clear()` 兼容清表）

### r65 companion 质量推分（META-005）

- **META-005**：`physical/service` — `register_physical_table(user)` admin/analyst only（`META_PHYSICAL_FORBIDDEN`）；column name `^[a-z][a-z0-9_]{0,63}$`（`META_PHYSICAL_INVALID_COLUMN`）；`probe_validate_physical_budget_ms` / `probe_list_physical_tables_budget_ms` ≤50ms；内存 store 非 Alembic

### M8 r231 kickoff（META-005 / META-006 · 2026-07-06）

- **META-005**：`register_from_schema` → `datasources.metadata.list_columns` 单一真理源；`GET /physical-tables?entityTypeCode=` 过滤；测试锚点 `tests/test_meta_dash_m8_r231.py` T-META-R231-005-*
- **META-006**：`EntityTypeCreate/Update/Out.physicalTableFqn`；`bind_entity_type_code` 公有方法 + `_ref_counts` 交叉 guard（`META_ENTITY_TYPE_MAPPING_CONFLICT`）；测试锚点 `tests/test_meta_dash_m8_r231.py` T-META-R231-006-*
