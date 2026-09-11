# 跨域远期薄弱项 L1 kickoff r59 设计

```yaml
date: 2026-07-04
milestone: META/CAT/DASH/CONN/DESIGN
round_target: docs/superpowers/evolution/2026-07-04-round-target-r59.md
prd_ids: [META-004, CAT-004, DASH-005, CONN-018, DESIGN-004]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | Dataset 元数据项 L1 骨架 + validate/list | META-004 | `metadata/dataset/` | 1（hub **#1 12.0**） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | `/api/v1/datasets` 可 list/validate；非法 spec 结构化 4xx |
| 2 | 分类树节点 L1 + move 环检测 | CAT-004 | `governance/catalog/classification/` | 2（hub **#2 12.0**） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | `/gov/catalog/classification/*` 可 CRUD/move；循环父节点被拦截 |
| 3 | 实体总览页 item 契约 + publish 探测 | DASH-005 | `dashboard/entity_overview/` | 3（hub **#3 12.1**） | 完整度 **5%→≥76%**；架构 **10%→≥66%** | 仪表板实体总览 validate/save/get；404/ACL smoke；不碰 DASH-006 主题分析 |
| 4 | 人大金仓方言 + registry 登记 | CONN-018 | `datasources/dialects/kingbase/` | 4（hub **#4 12.1**，G2） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | 类型列表含 `kingbase`；test-connection mock 成功/失败可验收 |
| 5 | 设计器工单关联 item validate/save/get | DESIGN-004 | `designer/workflow.py` | 5（hub **#5 12.1**） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | 设计器项可登记 workflow 引用；与 DESIGN-003/005 面不重复 |

**依赖链**：META-004 Dataset 内存 store → CAT-004 分类树（复用 themes 环检测模式）→ DASH-005 引用已有 `Dashboard` ORM + `config_store` → CONN-018 经 `register_connector_plugin` 登记（对齐 r46 NFR-005）→ DESIGN-004 只读引用 `governance/workflow` + `governance/publish` 状态 → `test_meta_cat_dash_conn_design_r59.py` smoke → r58 `test_dash_rpt_r58` 38/38 + r57 `test_dash_rpt_query_nfr_r57` 37/37 回归门控 → P5 五 ID 加权总分 L1 目标 **≥80**（companion r60+ **≥90**）。

**上轮已交付（本轮不重复）**：r55 META-006 entity schema；r53/r57/r58 DASH-006 主题分析 companion ≥91；r49/r52 DESIGN-003/005 sql_mode/output_fields；r46/r51 CONN-019 GBase + plugin 路径；r53/r57 catalog ACL；**不含** Admin 全量 UI、Kingbase 生产集群联调、fe 实体总览页、META/CAT 全量治理 UI、DASH-006 大改。

**PRD 分片锚点漂移注记**（真理源：`round-target` > `prd.md` hub > 分片）：

| 项 | hub / round-target L1 语义 | 分片（远期 SRS 追溯） |
|----|---------------------------|----------------------|
| META-004 | 元数据项 validate/items API | Dataset CRUD M1-DATASET（锚点 `metadata/dataset/` 一致） |
| CAT-004 | 分类树/项 CRUD + cycle guard | CAT-04 时间序列分析（锚点 `cat04.py`；L1 以 **classification 树** 落地，timeseries 模板留 companion） |
| DASH-005 | dashboard item + publish 探测 | 实体总览页 FR-6.2（锚点 `fe/entity-overview/`；L1 **后端契约先行**） |
| CONN-018 | `dialects/kingbase/` 子包 | 与 r46 扁平 `gbase.py` 惯例不同；**round-target 子目录优先** |
| DESIGN-004 | designer item validate/save/get | 设计器与工单关联（锚点 `designer/workflow.py` 一致） |

本轮实现以 **hub + round-target + 现有域子包惯例** 为准；P5 回写分片锚点与验收勾选。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §META/CAT/DASH/CONN/DESIGN；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `metadata/` | glossary/themes/dimensions/entity 已 L1；**无** `dataset/` 子包 |
| `query/dataset/guard.py` | 内置 `demo-orders` 等 stub + validate 路径；**无** CRUD 登记面 |
| `governance/catalog/` | GOV-001 条目 + seed categories；**无** 分类树子域 |
| `metadata/themes/service.py` | 主题树 move + 环检测 + `MAX_THEME_DEPTH=8`；**可复用算法** |
| `dashboard/service.py` | Dashboard CRUD + layout 校验完整；**无** entity-overview 子包 |
| `dashboard/theme/` | DASH-006 主题分析（r58 ≥91）；**边界独立** |
| `designer/` | DESIGN-001~003/005 已实现；**无** `workflow.py` |
| `governance/workflow/` | GOV-003 五态 FSM + config_store；可被 DESIGN-004 只读引用 |
| `governance/publish/` | GOV-005 状态机；DESIGN-004 同步 `publishStatus` 只读探测 |
| `datasources/__init__.py` | 21 种方言 + plugin（gbase/oceanbase/opensearch）；**无** `kingbase` |
| `dialects/postgres.py` | PG 连接器完整；KingbaseES **PG 协议兼容**，L1 委托目标 |
| `dialects/errors.py` | 至 `OCEANBASE_*`；**无** `KINGBASE_*` |
| `api/v1/metadata.py` | entity/dimensions/themes 路由；datasets **未挂载** |
| `api/v1/datasets.py` | **不存在**（api README 已规划） |
| `api/v1/gov.py` | catalog/publish/workflow 完整；**无** classification 路由 |
| `api/v1/dashboards.py` | CRUD + theme-analysis 路由；**无** entity-overview |
| `api/v1/designer.py` | conditions/compute/sql_mode/output_fields；**无** workflow-link |

**范围框定模块**（5）：`metadata/dataset/` · `governance/catalog/classification/` · `dashboard/entity_overview/` · `datasources/dialects/kingbase/` · `designer/workflow.py` + 薄 `api/v1` entry + pytest。

**范围框定文件列表**（19 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/metadata/dataset/schemas.py` | META-004 | 新建：`DatasetItemIn/Out`、`DatasetValidateOut` |
| `backend/app/metadata/dataset/service.py` | META-004 | 新建：内存 store + validate/list/get/create |
| `backend/app/metadata/dataset/errors.py` | META-004 | 新建：`DatasetError` + `META_DATASET_*` |
| `backend/app/api/v1/datasets.py` | META-004 | 新建：薄 entry 4 路由 |
| `backend/app/governance/catalog/classification/schemas.py` | CAT-004 | 新建：节点 DTO + move payload |
| `backend/app/governance/catalog/classification/service.py` | CAT-004 | 新建：树 CRUD/move/环检测 |
| `backend/app/governance/catalog/classification/errors.py` | CAT-004 | 新建：`CAT_CLASS_*` |
| `backend/app/dashboard/entity_overview/schemas.py` | DASH-005 | 新建：总览 item 契约（statCards/filters/drill） |
| `backend/app/dashboard/entity_overview/service.py` | DASH-005 | 新建：validate/save/get + publish 探测 |
| `backend/app/dashboard/entity_overview/errors.py` | DASH-005 | 新建：`DASH_OVERVIEW_*` |
| `backend/app/datasources/dialects/kingbase/__init__.py` | CONN-018 | 新建：导出 `KingbaseConnector` |
| `backend/app/datasources/dialects/kingbase/connector.py` | CONN-018 | 新建：PG 委托 + test_connection |
| `backend/app/datasources/dialects/errors.py` | CONN-018 | 修改：`map_kingbase_error` + `KINGBASE_*` |
| `backend/app/datasources/dialects/__init__.py` | CONN-018 | 修改：导出 kingbase |
| `backend/app/datasources/__init__.py` | CONN-018 | 修改：`register_connector_plugin(KingbaseConnector())` |
| `backend/app/designer/workflow.py` | DESIGN-004 | 新建：workflow-link validate/save/get |
| `backend/app/api/v1/gov.py` | CAT-004 | 修改：追加 classification 路由簇（≤4 路由） |
| `backend/app/api/v1/dashboards.py` | DASH-005 | 修改：追加 entity-overview 路由簇（≤3 路由） |
| `backend/app/api/v1/designer.py` | DESIGN-004 | 修改：追加 workflow-link 路由簇（≤3 路由） |
| `backend/tests/test_meta_cat_dash_conn_design_r59.py` | 全部 | 新建（≥30 条断言） |

**跨模块只读依赖**（不修改，测试中引用）：`export_type_catalog()`、`register_connector_plugin`、`Dashboard` ORM、`config_store`、`workflow_service`、`publish_service.get_publish_status`、`test_dash_rpt_r58`、`test_dash_rpt_query_nfr_r57`。

**真理源优先级**：`round-target` > `prd.md` hub + 分片 > `docs/services/` > `docs/api/README.md`。

**本轮性质**：跨五域 **L1 kickoff**（契约 + 守卫 smoke + pytest mock）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、Alembic migration（Dataset/分类树 L1 用内存 dict + `config_store`）、Kingbase 只读查询执行、生产级 timeseries 模板。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/metadata/dataset/
├── schemas.py
├── service.py
└── errors.py

backend/app/governance/catalog/classification/
├── schemas.py
├── service.py
└── errors.py

backend/app/dashboard/entity_overview/
├── schemas.py
├── service.py
└── errors.py

backend/app/datasources/dialects/kingbase/
├── __init__.py
└── connector.py

backend/app/designer/
└── workflow.py

backend/app/api/v1/
├── datasets.py              # META-004 新路由文件
├── gov.py                   # +classification
├── dashboards.py            # +entity-overview
└── designer.py              # +workflow-link

tests/
└── test_meta_cat_dash_conn_design_r59.py
```

**共享 L1 契约**（五子项均满足）：

| 契约项 | 要求 |
|--------|------|
| 错误体 | `{code, message, detail}`；校验失败含 `detail.fields` |
| 存储 | 进程内内存 dict 或 `config_store`（`ref_type` 见各子项）；文档注明非生产持久化 |
| 鉴权 | 沿用 `get_current_user` + `Bearer dev`；403/404 可测 |
| 性能 | 各 validate probe 单测 `elapsed_ms < 50`（同进程） |
| 回归 | r58 38/38 + r57 37/37 全绿不删旧套件 |

### 3.2 META-004 — Dataset 元数据项 L1

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 内存 store + validate REST（对齐 entity/schema L1） | `list`/`create`/`get`/`validate`；与 `query/dataset/guard` 内置集可后续合并 | **采用** |
| B 全量 ORM + Alembic migration | 四期完整 Dataset | 否决 — 超 L1、占文件预算 |
| C 仅扩展 `query/dataset/guard` 无 CRUD | 无 items API | 否决 — round-target 要求 items/validate |

#### 域逻辑

**`DatasetItemIn`**：`datasetId`（`^[a-z][a-z0-9_-]{1,63}$`）、`displayName`、`tables[]`（`name` + 可选 `alias`）、`computedFields[]`（`name` + `expression` 字符串 stub）、`allowedRoles[]`（默认 `["analyst"]`）。

**校验规则**：

- 空 `tables` → 422 `META_DATASET_EMPTY_TABLES`
- 重复 `datasetId` create → 409 `META_DATASET_CONFLICT`
- 未知 `datasetId` get → 404 `META_DATASET_NOT_FOUND`
- `computedFields` 名不符合 `^[a-z][a-z0-9_]{1,63}$` → 422 `META_DATASET_INVALID_FIELD`
- `validate` 不持久化，返回 `DatasetValidateOut(valid=true, datasetId, tableCount, computedFieldCount)`

**路由**（`api/v1/datasets.py`，`router` 挂 `api_v1_router`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/api/v1/datasets` | 列表（limit/offset，默认 50） |
| POST | `/api/v1/datasets` | 创建 |
| GET | `/api/v1/datasets/{dataset_id}` | 详情 |
| POST | `/api/v1/datasets/validate` | 仅校验 |

### 3.3 CAT-004 — 分类树 L1

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A `classification/` 子包 + 内存树（镜像 themes） | move 环检测 + `MAX_CLASS_DEPTH=8` | **采用** |
| B 单文件 `cat04.py` timeseries 模板 | 贴合 PRD 分片字面 | 否决 — round-target 要求 tree/item + cycle |
| C 扩展 `CatalogCategory` ORM | 需 migration | 否决 — L1 用内存 |

#### 域逻辑

**节点字段**：`nodeId`（uuid）、`code`（`^[A-Z][A-Z0-9_]{1,31}$`）、`name`、`parentId`（nullable）、`kind`（`folder`|`leaf`，默认 `folder`）、`sortOrder`。

**守卫**（复用 themes 算法）：

- 移动到自身或子孙 → 422 `CAT_CLASS_CYCLE`
- 深度 > 8 → 422 `CAT_CLASS_MAX_DEPTH`
- 未知 `parentId` → 404 `CAT_CLASS_PARENT_NOT_FOUND`
- 重复 `code` → 409 `CAT_CLASS_CODE_CONFLICT`
- 删除含子节点 → 409 `CAT_CLASS_HAS_CHILDREN`

**路由**（`gov.py` 追加，`prefix` 保持 `/gov`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/api/v1/gov/catalog/classification/nodes` | `?parentId=` 列表 |
| POST | `/api/v1/gov/catalog/classification/nodes` | 创建 |
| POST | `/api/v1/gov/catalog/classification/nodes/{node_id}/move` | 移动 |
| DELETE | `/api/v1/gov/catalog/classification/nodes/{node_id}` | 删除（叶或空文件夹） |

### 3.4 DASH-005 — 实体总览 item L1

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A `entity_overview/` 子包 + `config_store` 持久化 | validate statCards/filters/drill；绑定 `dashboardId` | **采用** — 与 DASH-006 theme 边界清晰 |
| B 扩展 `layout_json` widgets | 与 CRUD 耦合 | 否决 — 混淆 DASH-001~003 |
| C fe 页面先行 | 超范围 | 否决 |

#### 域逻辑

**`EntityOverviewItem`**：`dashboardId`（uuid）、`entityTypeRef`（引用 META-006 `typeCode`）、`statCards[]`（`metricKey` + `label`）、`filters[]`（`dimensionId` + 可选 `defaultValue`）、`drillTargets[]`（`widgetId` + `targetDashboardId` 可选）。

**校验**：

- 未知 `dashboardId` → 404 `DASH_OVERVIEW_DASHBOARD_NOT_FOUND`
- 空 `statCards` → 422 `DASH_OVERVIEW_EMPTY_CARDS`
- 重复 `metricKey` → 422 `DASH_OVERVIEW_DUPLICATE_METRIC`
- 非 owner 且非 admin 读/写 → 403 `DASH_OVERVIEW_FORBIDDEN`（对齐 dashboard ACL 惯例：比对 `created_by`）
- `publishStatus` 探测：只读调用 `publish_service.get_publish_status` 当 `catalogEntryId` 提供时；无 entry → `publishStatus=null`

**路由**（`dashboards.py`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/v1/dashboards/entity-overview/validate` | 校验 payload |
| PUT | `/api/v1/dashboards/{dashboard_id}/entity-overview` | save（config_store `ref_type=entity_overview`） |
| GET | `/api/v1/dashboards/{dashboard_id}/entity-overview` | get + `publishStatus` 探测 |

**与 DASH-006 边界**：`theme-analysis/*` 路由与 `entity_overview` 包**零交叉**；测试断言 theme 路由仍 200/422 行为不变。

### 3.5 CONN-018 — 人大金仓连接器 L1

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A PG 协议委托 `PostgresConnector` + 独立 `KINGBASE_*` 错误域 | 对齐 KingbaseES；默认端口 **54321** | **采用** |
| B MySQL 协议委托 | 仅兼容部分版本 | 否决 |
| C 真实集群联调 | 超 L1 | 否决 |

#### 域逻辑

**`KingbaseConnector`**（`kingbase/connector.py`）：

- `type = "kingbase"`、`category = "relational"`、`display_name = "人大金仓 KingbaseES"`
- `capabilities = ("connectivity_test", "schema_browser")`
- `KINGBASE_DEFAULT_PORT = 54321`、`KINGBASE_MAX_COLUMNS = 500`
- `test_connection` / `open_connection` / `list_*` 委托 `_inner: PostgresConnector`
- `map_kingbase_error`：将 `psycopg.OperationalError` 映射为 `KINGBASE_CONN_REFUSED` / `KINGBASE_AUTH_FAILED` / `KINGBASE_TIMEOUT` / `KINGBASE_UNKNOWN_DATABASE` / `KINGBASE_UNKNOWN`（复用 `map_postgres_operational_error` 再重命名 code 前缀）

**登记**：`register_connector_plugin(KingbaseConnector())` in `datasources/__init__.py`（与 gbase/oceanbase 并列）。

**测试**：mock `PostgresConnector.open_connection` / `ping`；`export_type_catalog()` 含 `kingbase`；`POST /api/v1/datasources/test-connection` draft payload `type=kingbase` 成功/失败链；响应**不得**含 `password` 字段。

### 3.6 DESIGN-004 — 设计器工单关联 L1

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A `workflow.py` workflow-link 契约 + config_store | `workflowInstanceId` + `catalogEntryId` + 只读 publish 同步 | **采用** |
| B 扩展 sql_mode/output_fields | 与 DESIGN-003/005 重复 | 否决 |
| C 全量 GOV BPM 引擎 | 超 L1 | 否决 |

#### 域逻辑

**`DesignerWorkflowLinkIn`**：`designerItemId`（uuid）、`workflowInstanceId`（uuid）、`catalogEntryId`（uuid，可选）、`designType`（`chart`|`report`|`query`，默认 `chart`）。

**校验**：

- 未知 `workflowInstanceId`（config_store 无 `workflow_instance`）→ 404 `DESIGN_WORKFLOW_INSTANCE_NOT_FOUND`
- 空 `designerItemId` → 422 `DESIGN_WORKFLOW_INVALID_ITEM`
- 重复 save 同一 `designerItemId` → 200 幂等覆盖
- `validate` 返回 `publishReady`（bool）：当 workflow 状态为 `approved` 且 catalog entry `status=published` 时为 true

**路由**（`designer.py`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/v1/designer/workflow-link/validate` | 校验关联 |
| PUT | `/api/v1/designer/workflow-link` | save |
| GET | `/api/v1/designer/workflow-link` | `?designerItemId=` 读取 |

**存储**：`config_store` `config_type=designer_workflow_link`，`ref_type=designer`，`ref_id=designerItemId`。

## 4. 分项验收标准（可测试）

### META-004

- [ ] `metadata/dataset/` 三文件 + `api/v1/datasets.py` 存在且 ruff clean
- [ ] GET `/datasets` 空列表 200；POST create 201；重复 id 409
- [ ] POST `/datasets/validate` 合法 payload 200 + `valid=true`；空 tables 422 `META_DATASET_EMPTY_TABLES`
- [ ] GET 未知 id 404 `META_DATASET_NOT_FOUND`
- [ ] pytest ≥6 条 META 断言

### CAT-004

- [ ] `classification/` 三文件 + gov 路由挂载
- [ ] 创建根节点 + 子节点；move 成环 422 `CAT_CLASS_CYCLE`
- [ ] 未知 parent 404；超深 422 `CAT_CLASS_MAX_DEPTH`
- [ ] pytest ≥6 条 CAT 断言

### DASH-005

- [ ] `entity_overview/` 三文件 + dashboards 路由挂载
- [ ] validate 空 statCards 422；未知 dashboard 404
- [ ] save/get 往返；非 owner 403（非 admin 角色）
- [ ] 不修改 `dashboard/theme/*` 行为；r58 theme 回归子集通过
- [ ] pytest ≥6 条 DASH 断言

### CONN-018

- [ ] `kingbase/` 子包 + `KINGBASE_*` 错误码 + plugin 登记
- [ ] `export_type_catalog()` 含 kingbase + `category=relational`
- [ ] test-connection mock 成功 `ok=true`；auth 失败结构化 `KINGBASE_AUTH_FAILED`
- [ ] 响应无密码泄露
- [ ] pytest ≥6 条 CONN 断言

### DESIGN-004

- [ ] `designer/workflow.py` + designer 路由挂载
- [ ] validate 未知 workflow instance 404
- [ ] save/get 幂等；`publishReady` 随 workflow/publish 状态变化
- [ ] 不触碰 `sql_mode.py` / `output_fields.py` 路由语义
- [ ] pytest ≥6 条 DESIGN 断言

### 回归门控

- [ ] `test_meta_cat_dash_conn_design_r59.py` ≥30 断言全绿
- [ ] `test_dash_rpt_r58` 38/38 + `test_dash_rpt_query_nfr_r57` 37/37 全绿
- [ ] 全量 pytest exit_code 0；ruff clean

## 5. 测试计划

**文件**：`backend/tests/test_meta_cat_dash_conn_design_r59.py`

**夹具**：`TestClient` + `Bearer dev`；dashboard fixture 创建一条 `Dashboard`；workflow fixture 复用 r49 模板创建 instance；kingbase mock patch `PostgresConnector.open_connection`。

**断言分组**（≥30）：

| 分组 | ID 前缀 | 条数 | 覆盖 |
|------|---------|:----:|------|
| META-004 | `T-META-R59-004-` | 7 | list/create/get/validate/409/404/fields |
| CAT-004 | `T-CAT-R59-004-` | 7 | create/move/cycle/depth/parent/409/delete |
| DASH-005 | `T-DASH-R59-005-` | 6 | validate/save/get/404/403/publishStatus |
| CONN-018 | `T-CONN-R59-018-` | 6 | catalog/types/test-ok/test-fail/no-password/limit |
| DESIGN-004 | `T-DESIGN-R59-004-` | 6 | validate/save/get/404/publishReady/idempotent |
| **合计** | | **32** | |

## 6. 非目标（明确不做）

- Admin / `fe/` 实体总览页、分类管理 UI、Dataset 管理 UI
- Kingbase 生产集群联调、只读查询集成测、新数据库驱动依赖
- CAT-04 timeseries 模板完整实现（`granularity/同比环比` 留 companion）
- DASH-005 统计卡片真实 query 执行、跨组件口径引擎
- DESIGN-004 真实 BPM 状态推送、企微/钉钉通知
- META-004 计算字段 SQL 解析、与 M4/M5/M6 统一引用
- Alembic migration、修改 `plan.md` / `goal.md`
- DASH-006 / DESIGN-003 / DESIGN-005 重复大改

## 7. PRD 8 维薄弱项对齐

| PRD ID | 选题时薄弱维 | L1 闭合策略 | 预期抬升 |
|--------|-------------|-------------|----------|
| META-004 | 完整度 5%、可靠性 0%、测试 0% | Dataset CRUD 契约 + validate 守卫 + 7 测 | 完整度 ≥76%、可靠性 ≥92%、测试 ≥96% |
| CAT-004 | 完整度 5%、可靠性 0%、测试 0% | 分类树 + cycle/depth 守卫 + 7 测 | 同上 |
| DASH-005 | 完整度 5%、可靠性 0%、架构 10% | entity_overview 子包边界 + ACL + 6 测 | 完整度 ≥76%、架构 ≥66% |
| CONN-018 | 完整度 5%、可靠性 0%、测试 0% | kingbase 方言 + HTTP 链 + 6 测 | 完整度 ≥76%、可靠性 ≥92% |
| DESIGN-004 | 完整度 5%、可靠性 0%、测试 0% | workflow-link + publish 探测 + 6 测 | 完整度 ≥76%、可靠性 ≥92% |

**加权总分 L1 目标**：五 ID **≥80**（破 12 分 stub）；companion 轮（r60+）目标 **≥90**。

## 8. UI 设计交付

```yaml
ui_design_skill: none
```

本轮**纯后端**，不触及 `fe/`、`*.tsx`、`*.vue` 或页面/组件目录；无目标项目 UI skill 读取义务。P3 各 Task 标注 `UI skill: none`。

## 9. P3 文档同步清单（实现后）

| 变更 | 同步文档 |
|------|----------|
| 五域 L1 落地 | `docs/services/metadata.md`、`governance.md`（classification）、`dashboard` 域附录（新建或扩写）、`datasources.md`、`designer.md` |
| 新路由 | `docs/api/README.md` §datasets、§gov classification、§dashboards entity-overview、§designer workflow-link、§datasources kingbase type |
| PRD 分片 | `F11-META` META-004、`F14-CAT` CAT-004、`F07-DASH` DASH-005、`F04-CONN` CONN-018、`F12-DESIGN` DESIGN-004 状态与锚点 |

---

**Self-review**：无 TBD/TODO；五子项全覆盖；19+1 文件 ≤20；与 round-target 验收一致；ui_design_skill none；未写生产代码。
