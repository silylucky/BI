# 跨域远期 stub L1 kickoff r62 设计

```yaml
date: 2026-07-04
milestone: CAT/NFR/RPT/META
round_target: docs/superpowers/evolution/2026-07-04-round-target-r62.md
prd_ids: [CAT-006, NFR-003, RPT-002, RPT-003, META-005]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | 生产与销售统计类 production stats 模板 + 企业域隔离 | CAT-006 | `governance/catalog/cat06/` | 1（hub **#1 12.1**） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | `/gov/catalog/production-stats/*` 可 validate/create/stats；跨 `brandId` 被 403 |
| 2 | 核心看板可用性 SLA 探测 + 告警配置登记 | NFR-003 | `core/nfr/dashboard_sla.py` | 2（hub **#2 12.1**） | 完整度 **5%→≥76%**；架构 **8%→≥70%** | `/nfr/dashboard-sla/*` 可 validate/probe/alerts；未达标结构化 4xx/503 |
| 3 | 预制分析报表体系 entity×analysis 绑定 | RPT-002 | `reports/prefab/` | 3（hub **#3 12.6**） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | `/reports/prefab/*` 可 list/validate/bind；维度字典缺失 422 |
| 4 | Word/Excel/PDF 模板定义与校验 | RPT-003 | `reports/templates/` | 4（hub **#4 13.0**） | 完整度 **5%→≥76%**；可靠性 **0%→≥92%** | `/reports/templates/*` 可 define/validate；非法嵌套块 422 |
| 5 | 物理表/字段元数据登记 | META-005 | `metadata/physical/` | 5（hub **#5 13.1**） | 完整度 **5%→≥76%**；测试覆盖 **0%→≥96%** | `/metadata/physical-tables/*` 可 register/validate/get；与 META-006 entity schema 边界清晰 |

**依赖链**：CAT-006 独立内存 store → NFR-003 横切 probe（复用 `report_perf` 模式）→ RPT-002 prefab 登记（只读引用 `metadata/dimensions` 字典 code 存在性 stub）→ RPT-003 templates 定义（与 `reports/catalog` `templateKind` 互补，不重复 RPT-004/005/006/007 extension/scheduler 面）→ META-005 physical 登记（只读校验 `datasources` id 格式，不执行连接）→ `test_cat_nfr_rpt_meta_r62.py` smoke → r61 `test_cat_dash_viz_nfr_r61` 32/32 + r60 `test_rpt_view_cat_gov_r60` 34/34 + r59 `test_meta_cat_dash_conn_design_r59` 34/34 回归门控 → P5 五 ID 加权总分 L1 目标 **≥80**（companion r63+ **≥90**）。

**上轮已交付（本轮不重复）**：r61 CAT-005/003 + NFR-002 report_perf；r60 RPT-001 engine + CAT-007 workno；r59 META-004 dataset + CAT-004 classification；r58 RPT-004/005 catalog/extension/scheduler companion；r55 META-006 entity schema；**不含** Admin 全量 UI、报表 fe 渲染/PDF 全链路、分类树 fe 页面、NFR 生产级 perf/SLA 全量 suite、META 全量治理 UI、真实 M3-LITE 查询执行。

**PRD 分片锚点漂移注记**（真理源：`round-target` > `prd.md` hub > 分片）：

| 项 | hub / round-target L1 语义 | 分片（远期 SRS 追溯） |
|----|---------------------------|----------------------|
| CAT-006 | catalog 分类子域 scaffold + item 路由 + cycle/move smoke | CAT-06 生产与销售统计（锚点 `cat06.py`；L1 以 **cat06 子包 + production stats 模板** 落地，非 classification 树重复） |
| NFR-003 | core/nfr 横切 scaffold + 合规/探测 smoke | NFR-02 核心看板可用性 SLA（锚点 `ops/sla/`；L1 **core/nfr/dashboard_sla** 契约先行） |
| RPT-002 | reports item 最小路由 + ACL/404 smoke | FR-3.1 预制分析（锚点 `reports/prefab/` 一致） |
| RPT-003 | reports extension/param 最小路由 | Word/Excel/PDF 模板定义（锚点 `reports/templates/` 一致；与 catalog `templateKind` 分工：catalog=目录节点，templates=内容 spec） |
| META-005 | metadata item 最小路由 + validate/404 | M1-ENTITY 物理表登记（锚点 `metadata/entity/`；L1 新建 **`metadata/physical/`** 子包，entity schema 与物理表映射分轨） |

本轮实现以 **hub + round-target + 现有域子包惯例** 为准；P5 回写分片锚点与验收勾选。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §CAT/NFR/RPT/META；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `governance/catalog/cat05/` | ticket-stats validate/create/list/stats（r61）；**无** cat06 |
| `governance/catalog/classification/` | 分类树 CRUD/move（r59）；**与 CAT-006 独立** |
| `governance/catalog/cat07/` | workno behavior（r60）；**模式可复用** |
| `core/nfr/report_perf.py` | NFR-002 probe 模式（validate + mock elapsedMs）；**无** dashboard SLA |
| `core/nfr/errors.py` | 至 `REPORT_PERF_*`；**无** `DASHBOARD_SLA_*` |
| `api/v1/nfr.py` | runtime/report-perf/browser 等路由完整；**无** dashboard-sla |
| `reports/catalog/` | RPT-004 树形目录 + ACL（r53/r57）；**无** prefab/templates 子域 |
| `reports/engine/` | RPT-001 run（r60）；**无** FR-3.1 预制分析绑定面 |
| `reports/extension/` | compare/ACL（r58）；**边界独立**，RPT-003 不扩展 compare |
| `metadata/entity/` | META-006 entity type schema（r54/r55）；**无** 物理表/字段登记 store |
| `metadata/dimensions/` | 维度字典 L1（r38/r39）；RPT-002 **只读校验 dimensionCode 存在** |
| `api/v1/gov.py` | cat03/cat05/cat07 + classification；**无** production-stats 路由簇 |
| `api/v1/metadata.py` | entity-types/themes/dimensions；**无** physical-tables |
| `api/v1/reports/__init__.py` | catalog/scheduler/batch + engine_router；**无** prefab/templates router |

**范围框定模块**（5）：`governance/catalog/cat06/` · `core/nfr/dashboard_sla` · `reports/prefab/` · `reports/templates/` · `metadata/physical/` + 薄 `api/v1` entry + pytest。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/governance/catalog/cat06/schemas.py` | CAT-006 | 新建：ProductionStats 模板 DTO |
| `backend/app/governance/catalog/cat06/service.py` | CAT-006 | 新建：validate/create/list/stats + brand 域隔离 |
| `backend/app/governance/catalog/cat06/errors.py` | CAT-006 | 新建：`Cat06Error` + `CAT06_*` |
| `backend/app/core/nfr/dashboard_sla.py` | NFR-003 | 新建：SLA validate/probe/alerts config |
| `backend/app/core/nfr/errors.py` | NFR-003 | 修改：追加 `DASHBOARD_SLA_*` 常量 |
| `backend/app/reports/prefab/schemas.py` | RPT-002 | 新建：PrefabBinding / AnalysisType DTO |
| `backend/app/reports/prefab/service.py` | RPT-002 | 新建：list/validate/upsert + dimension 守卫 |
| `backend/app/reports/prefab/errors.py` | RPT-002 | 新建：`PrefabError` + `RPT_PREFAB_*` |
| `backend/app/reports/templates/schemas.py` | RPT-003 | 新建：TemplateDefinition + Block DTO |
| `backend/app/reports/templates/service.py` | RPT-003 | 新建：define/validate/get + format 守卫 |
| `backend/app/reports/templates/errors.py` | RPT-003 | 新建：`TemplateDefError` + `RPT_TEMPLATE_*` |
| `backend/app/metadata/physical/schemas.py` | META-005 | 新建：PhysicalTableRegister DTO |
| `backend/app/metadata/physical/service.py` | META-005 | 新建：register/validate/get/list |
| `backend/app/metadata/physical/errors.py` | META-005 | 新建：`PhysicalTableError` + `META_PHYSICAL_*` |
| `backend/app/api/v1/gov.py` | CAT-006 | 修改：追加 production-stats 路由簇（≤4 路由） |
| `backend/app/api/v1/nfr.py` | NFR-003 | 修改：追加 dashboard-sla 路由簇（≤3 路由） |
| `backend/app/api/v1/reports/prefab.py` | RPT-002 | 新建：薄 entry ≤3 路由 |
| `backend/app/api/v1/reports/templates.py` | RPT-003 | 新建：薄 entry ≤3 路由 |
| `backend/app/api/v1/metadata.py` | META-005 | 修改：追加 physical-tables 路由簇（≤4 路由） |
| `backend/app/api/v1/reports/__init__.py` | RPT-002/003 | 修改：`include_router(prefab_router)` + `templates_router` |
| `backend/tests/test_cat_nfr_rpt_meta_r62.py` | 全部 | 新建（≥30 条断言） |

**跨模块只读依赖**（不修改，测试中引用）：`dimension_service.list_dimensions`（或内存 seed）、`reports/catalog/acl.assert_catalog_action` 模式镜像、`UserContext.roles`、`test_cat_dash_viz_nfr_r61`、`test_rpt_view_cat_gov_r60`、`test_meta_cat_dash_conn_design_r59`。

**真理源优先级**：`round-target` > `prd.md` hub + 分片 > `docs/services/` > `docs/api/README.md`。

**本轮性质**：跨四域 **L1 kickoff**（契约 + 守卫 smoke + pytest mock）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、Alembic migration、真实 SLA 监控系统、Jasper/PDF 渲染、物理表 introspection 联调、production stats 真实数据源查询。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/governance/catalog/cat06/
├── schemas.py
├── service.py
└── errors.py

backend/app/core/nfr/
└── dashboard_sla.py          # NFR-003（errors.py 追加常量）

backend/app/reports/prefab/
├── schemas.py
├── service.py
└── errors.py

backend/app/reports/templates/
├── schemas.py
├── service.py
└── errors.py

backend/app/metadata/physical/
├── schemas.py
├── service.py
└── errors.py

backend/app/api/v1/
├── gov.py                    # +production-stats
├── nfr.py                    # +dashboard-sla
├── metadata.py               # +physical-tables
└── reports/
    ├── prefab.py             # RPT-002 薄 entry
    ├── templates.py          # RPT-003 薄 entry
    └── __init__.py           # include 两 router

tests/
└── test_cat_nfr_rpt_meta_r62.py
```

**共享 L1 契约**（五子项均满足）：

| 契约项 | 要求 |
|--------|------|
| 错误体 | `{code, message, detail}`；校验失败含 `detail.fields` |
| 存储 | 进程内内存 dict；文档注明非生产持久化 |
| 鉴权 | 沿用 `get_current_user` + `Bearer dev`；403/404 可测 |
| 性能 | 各 validate/probe 单测 `elapsed_ms < 50`（同进程） |
| 回归 | r61 32/32 + r60 34/34 + r59 34/34 全绿不删旧套件 |

### 3.2 方案比选（Automation 代替用户对话）

#### CAT-006 生产与销售统计

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `cat06/` 子包 + 内存 store；`vendorType`/`brandId`/`locType` 模板 + stats mock | 对齐 cat05/cat07；SRS 附录 E CAT-06 入参 |
| B | 扩展 `classification/` 树节点 kind=production | 与 CAT-004 语义混淆 |
| C | 独立 `api/v1/production.py` 顶层路由 | 超 round-target gov/catalog 惯例 |

**选用 A**；企业域隔离：`roles` 含 `enterprise` 时 `brandId` 必须匹配 `_USER_BRAND_SCOPE[user_id]`（测试 fixture 注入），否则 403 `CAT06_BRAND_FORBIDDEN`；`admin`/`analyst` 可跨 brand。

#### NFR-003 核心看板 SLA

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `dashboard_sla.py` mock uptime probe + alerts config 登记（内存） | 对齐 r61 `report_perf`；可测 structured 响应 |
| B | 接入 Prometheus/真实 APM | 超 L1；需外部依赖 |
| C | 仅静态文档无 API | 完整度不足 |

**选用 A**；默认 SLA 目标 **99.5%**（`slaTargetPercent=99.5`）；mock `uptimePercent=99.7` 达标；`strict` 模式（env `DASHBOARD_SLA_MODE=strict`）下 probe < 99.5 → 503 `DASHBOARD_SLA_BELOW_TARGET`。

#### RPT-002 预制分析

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `prefab/` 内存 binding：`entityTypeCode` × `analysisType` + `dimensionCodes[]` | 闭合 FR-3.1「N×M 可配置」骨架 |
| B | 复用 `reports/catalog` 节点 type=prefab | 与 RPT-004 目录语义耦合 |
| C | fe 固定分析页 | 超范围（纯后端） |

**选用 A**；`analysisType` 枚举：`lifecycle`|`activity`|`trend`|`distribution`；维度字典：校验 code 在 `metadata/dimensions` store 或内置 seed `region`/`status` 存在，否则 422 `RPT_PREFAB_DIMENSION_UNKNOWN`。

#### RPT-003 模板定义

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `templates/` 内容 spec：`format` word/excel/pdf + `blocks[]`（sql/table/chart） | 与 catalog `templateKind` 分工清晰 |
| B | 扩展 `extension/` param 集 | 与 RPT-005 scheduler 重复 |
| C | 真实 Office/PDF 解析 | 超 L1 |

**选用 A**；块类型 `sql`|`table`|`chart`；`sql` 块须非空 `queryRef`；`chart` 块须 `chartType`；非法组合 → 422 `RPT_TEMPLATE_INVALID_BLOCK`。

#### META-005 物理表登记

| 方案 | 说明 | 取舍 |
|------|------|------|
| A（推荐） | `metadata/physical/` 独立子包；`tableFqn` + `columns[]` + `dataSourceId` | 与 META-006 entity schema 分轨；支撑 FR-6.2 登记面 |
| B | 扩展 `entity/service.py` 内嵌 physicalMapping | 混淆逻辑/物理层 |
| C | ORM + Alembic | 超 L1 文件预算 |

**选用 A**；`tableFqn` 模式 `^[a-z][a-z0-9_]{0,62}\.[a-z][a-z0-9_]{1,63}$`；列 `name` + `dataType` + `nullable`；空 columns → 422 `META_PHYSICAL_EMPTY_COLUMNS`；重复 fqn → 409 `META_PHYSICAL_CONFLICT`。

### 3.3 CAT-006 — 生产与销售统计 L1

#### 域逻辑

**`ProductionStatsItemIn`**：`statsKey`（`^[A-Z][A-Z0-9_]{1,31}$`）、`displayName`、`vendorType`（`enterprise`|`scheme`|`model`|`dcas`）、`brandId`（`^[A-Z0-9]{2,16}$`）、`locType`（`warehouse`|`retail`|`all`，默认 `all`）、`metricKeys`（默认 `["inbound","inventory","activation"]`）。

**校验规则**：

- 空 `metricKeys` → 422 `CAT06_EMPTY_METRICS`
- 非法 `vendorType` → 422 `CAT06_INVALID_VENDOR`
- 重复 `statsKey` create → 409 `CAT06_KEY_CONFLICT`
- 未知 `statsKey` stats → 404 `CAT06_NOT_FOUND`
- enterprise 用户跨 `brandId` → 403 `CAT06_BRAND_FORBIDDEN`

**`ProductionStatsProbeOut`**（mock）：`inbound`、`inventory`、`opened`、`activated` 分项整数 + `sampledAt`。

**路由**（`gov.py`，prefix `/gov`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/v1/gov/catalog/production-stats/validate` | 仅校验 |
| POST | `/api/v1/gov/catalog/production-stats` | 创建模板 |
| GET | `/api/v1/gov/catalog/production-stats` | 列表 limit/offset |
| GET | `/api/v1/gov/catalog/production-stats/{stats_key}/stats` | mock 分项统计 |

### 3.4 NFR-003 — 核心看板可用性 L1

#### 域逻辑

**`DashboardSlaProbeIn`**：`dashboardId`（uuid 字符串，必填）、`windowHours`（默认 24，范围 1–168）、`slaTargetPercent`（默认 99.5，范围 90.0–99.99）。

**`DashboardSlaProbeOut`**：`dashboardId`、`uptimePercent`（mock **99.7**）、`slaTargetPercent`、`withinSla`（bool）、`windowHours`、`sampledAt`。

**`DashboardSlaAlertsOut`**：`enabled`（bool）、`channels`（`["email","webhook"]` stub）、`thresholdPercent`（默认 99.5）、`configured`（bool，至少一项 channel 非空即 true）。

**守卫**：

- 空 `dashboardId` → 422 `DASHBOARD_SLA_DASHBOARD_REQUIRED`
- `windowHours` 越界 → 422 `DASHBOARD_SLA_WINDOW_OUT_OF_RANGE`
- strict 模式且 mock 可调为 99.0 → 503 `DASHBOARD_SLA_BELOW_TARGET`（测试用 env 或 probe 参数 `simulateBreach=true` 可选字段）

**路由**（`nfr.py`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/v1/nfr/dashboard-sla/validate` | 校验配置 |
| POST | `/api/v1/nfr/dashboard-sla/probe` | uptime mock probe |
| GET | `/api/v1/nfr/dashboard-sla/alerts` | 告警配置探测 |

### 3.5 RPT-002 — 预制分析报表 L1

#### 域逻辑

**`PrefabBindingIn`**：`bindingKey`（`^[a-z][a-z0-9_-]{1,63}$`）、`entityTypeCode`、`analysisType`、`dimensionCodes[]`（≥1）、`displayName`、`allowedRoles[]`（默认 `["analyst"]`）。

**校验**：

- 未知 `entityTypeCode`（可选：校验 `metadata/entity` store 或允许任意 pattern 合法即可；L1 采用 pattern `^[a-z][a-z0-9_]{1,63}$` + 非空）→ 422 `RPT_PREFAB_INVALID_ENTITY`
- 未知 `dimensionCodes` → 422 `RPT_PREFAB_DIMENSION_UNKNOWN`
- 重复 bindingKey → 409 `RPT_PREFAB_CONFLICT`
- viewer 角色 POST upsert → 403 `RPT_PREFAB_FORBIDDEN`（镜像 catalog ACL 惯例）

**路由**（`reports/prefab.py`，挂 `/reports`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/api/v1/reports/prefab/bindings` | 列表 |
| POST | `/api/v1/reports/prefab/bindings/validate` | 校验 |
| PUT | `/api/v1/reports/prefab/bindings/{binding_key}` | upsert |

### 3.6 RPT-003 — 模板定义 L1

#### 域逻辑

**`TemplateDefinitionIn`**：`templateKey`、`format`（`word`|`excel`|`pdf`）、`displayName`、`blocks[]`（`TemplateBlock`：`blockType` sql/table/chart + 类型专属字段）。

**块规则**：

- `sql`：`queryRef` 非空，max 256
- `table`：`tableRef` 非空
- `chart`：`chartType` 非空（枚举 line/bar/pie）
- 空 `blocks` → 422 `RPT_TEMPLATE_EMPTY_BLOCKS`
- 未知 `blockType` → 422 `RPT_TEMPLATE_INVALID_BLOCK`
- 未知 `templateKey` get → 404 `RPT_TEMPLATE_NOT_FOUND`

**路由**（`reports/templates.py`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/v1/reports/templates/validate` | 校验定义 |
| PUT | `/api/v1/reports/templates/{template_key}` | 登记定义 |
| GET | `/api/v1/reports/templates/{template_key}` | 读取定义 |

**与 RPT-004 边界**：catalog 节点 `templateKind` 仅标识目录树节点类型；`templates/` 存**内容 spec**，二者通过未来 companion 用相同 `templateKey` 关联，本轮不强制外键。

### 3.7 META-005 — 物理表元数据登记 L1

#### 域逻辑

**`PhysicalTableRegisterIn`**：`tableFqn`、`dataSourceId`（uuid）、`displayName`、`entityTypeCode`（可选，链到 META-006）、`columns[]`（`PhysicalColumn`：name/dataType/nullable/description）。

**校验**：

- 非法 `tableFqn` 格式 → 422 `META_PHYSICAL_INVALID_FQN`
- 空 `columns` → 422 `META_PHYSICAL_EMPTY_COLUMNS`
- 重复 `tableFqn` → 409 `META_PHYSICAL_CONFLICT`
- 未知 fqn get → 404 `META_PHYSICAL_NOT_FOUND`
- 列名重复 → 422 `META_PHYSICAL_DUPLICATE_COLUMN`
- 非法 `dataSourceId` 格式 → 422 `META_PHYSICAL_INVALID_DATASOURCE`

**路由**（`metadata.py`）：

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/api/v1/metadata/physical-tables` | 列表 |
| POST | `/api/v1/metadata/physical-tables` | 登记 |
| GET | `/api/v1/metadata/physical-tables/{table_fqn}` | 详情（path 用 URL-encoded fqn 或 `?fqn=` 查询参数，实现择一并在测试中固定） |
| POST | `/api/v1/metadata/physical-tables/validate` | 仅校验 |

**推荐**：GET 详情用 query `?fqn=schema.table` 避免 path 点号编码歧义。

## 4. 分项验收标准（可测试）

### CAT-006

- [ ] `governance/catalog/cat06/` 三文件 + `gov.py` production-stats 路由簇存在且 ruff clean
- [ ] POST validate 合法 payload 200 + `valid=true`
- [ ] POST create 201；重复 statsKey 409 `CAT06_KEY_CONFLICT`
- [ ] GET stats 未知 key 404 `CAT06_NOT_FOUND`
- [ ] enterprise fixture 跨 brandId 403 `CAT06_BRAND_FORBIDDEN`
- [ ] 非法 vendorType 422 `CAT06_INVALID_VENDOR`
- [ ] pytest ≥6 条 CAT-006 断言（T-CAT-R62-006-01~06）

### NFR-003

- [ ] `core/nfr/dashboard_sla.py` + `nfr.py` 路由簇存在
- [ ] POST validate 200；空 dashboardId 422 `DASHBOARD_SLA_DASHBOARD_REQUIRED`
- [ ] POST probe 200 + `withinSla=true`（mock 99.7 ≥ 99.5）
- [ ] simulateBreach 或 strict 模式 probe 503 `DASHBOARD_SLA_BELOW_TARGET`
- [ ] GET alerts 200 + `configured` 字段存在
- [ ] windowHours 越界 422 `DASHBOARD_SLA_WINDOW_OUT_OF_RANGE`
- [ ] pytest ≥6 条 NFR-003 断言（T-NFR-R62-003-01~06）

### RPT-002

- [ ] `reports/prefab/` 三文件 + `api/v1/reports/prefab.py` 存在
- [ ] GET bindings 空列表 200
- [ ] POST validate 合法 200；未知 dimension 422 `RPT_PREFAB_DIMENSION_UNKNOWN`
- [ ] PUT upsert 200；重复后覆盖幂等
- [ ] viewer 角色 PUT 403 `RPT_PREFAB_FORBIDDEN`
- [ ] pytest ≥6 条 RPT-002 断言（T-RPT-R62-002-01~06）

### RPT-003

- [ ] `reports/templates/` 三文件 + `api/v1/reports/templates.py` 存在
- [ ] POST validate word+sql 块 200
- [ ] 空 blocks 422 `RPT_TEMPLATE_EMPTY_BLOCKS`
- [ ] 非法 blockType 422 `RPT_TEMPLATE_INVALID_BLOCK`
- [ ] PUT 登记后 GET 200 回读一致
- [ ] GET 未知 templateKey 404 `RPT_TEMPLATE_NOT_FOUND`
- [ ] pytest ≥6 条 RPT-003 断言（T-RPT-R62-003-01~06）

### META-005

- [ ] `metadata/physical/` 三文件 + `metadata.py` 路由簇存在
- [ ] POST register 201；重复 fqn 409 `META_PHYSICAL_CONFLICT`
- [ ] POST validate 空 columns 422 `META_PHYSICAL_EMPTY_COLUMNS`
- [ ] GET 未知 fqn 404 `META_PHYSICAL_NOT_FOUND`
- [ ] 列名重复 422 `META_PHYSICAL_DUPLICATE_COLUMN`
- [ ] GET list 含已登记项
- [ ] pytest ≥6 条 META-005 断言（T-META-R62-005-01~06）

### 回归与总量

- [ ] `test_cat_nfr_rpt_meta_r62.py` **≥30** 新断言（五子项合计 ≥30）
- [ ] `test_cat_dash_viz_nfr_r61.py` **32/32** 回归
- [ ] `test_rpt_view_cat_gov_r60.py` **34/34** 回归
- [ ] `test_meta_cat_dash_conn_design_r59.py` **34/34** 回归
- [ ] 从 `backend/` 全量 pytest exit 0；ruff clean

## 5. 非目标（明确不做）

| 类别 | 不做项 |
|------|--------|
| 前端 | `fe/` 生产统计页、看板 SLA 仪表盘、预制分析页、模板设计器、物理表 Admin UI |
| 报表全链路 | PDF/Word/Excel 真实渲染、Jasper 引擎、M3-LITE 数据执行 |
| NFR 生产 | Prometheus/Grafana 集成、真实 99.5% 月度 SLA 计算、告警 webhook 发送 |
| META 全量 | 物理表自动 introspection、与 GOV catalog 引用释放、Dataset 指标引擎 |
| CAT 重复 | classification 树改动、CAT-005/007 companion 破 90（留 r63+） |
| 数据层 | Alembic migration；本轮全部内存 dict |
| 文档 | P3 前不改 PRD 分片勾选（P5 重评回写） |

## 6. PRD 8 维薄弱项对齐

| PRD ID | 选题时薄弱维 | L1 设计闭合方式 | L1 目标分 |
|--------|-------------|-----------------|:---------:|
| CAT-006 | 完整度 5%、可靠性 0%、测试 0% | cat06 四路由 + brand 403 守卫 + ≥6 pytest | ≥80 |
| NFR-003 | 完整度 5%、可靠性 0%、架构 8% | dashboard_sla 三路由 + strict breach + core/nfr 边界清晰 | ≥80 |
| RPT-002 | 完整度 5%、可靠性 0%、测试 0% | prefab binding + dimension 守卫 + ACL 403 + ≥6 pytest | ≥80 |
| RPT-003 | 完整度 5%、可靠性 0%、测试 0% | templates 块校验链 + 三格式 + ≥6 pytest | ≥80 |
| META-005 | 完整度 5%、可靠性 0%、测试 0% | physical 登记/validate + fqn/column 守卫 + ≥6 pytest | ≥80 |

**共性闭合**：完整度 5%→L1 可调用 API 骨架；可靠性 0%→结构化 4xx/403/404/409 守卫；测试覆盖 0%→单文件 ≥30 断言 + 三轮回归门控。

## 7. 测试设计摘要

**文件**：`backend/tests/test_cat_nfr_rpt_meta_r62.py`

**夹具**：模块级 sqlite memory（对齐 r61/r60）；`AUTH = Bearer dev`；`enterprise_user` fixture（roles=`["enterprise"]`，brandScope=`BRAND01`）；`viewer_user` fixture（prefab 403）。

**断言分布**（≥30）：

| 区块 | 数量 | 代表用例 |
|------|:----:|----------|
| T-CAT-R62-006 | 6 | validate/create/stats/brand403/vendor422/notFound |
| T-NFR-R62-003 | 6 | validate/probe/alerts/window422/breach503/emptyDashboard |
| T-RPT-R62-002 | 6 | list/validate/upsert/dimension422/viewer403/conflict409 |
| T-RPT-R62-003 | 6 | validate word/empty422/invalidBlock/put-get/notFound |
| T-META-R62-005 | 6 | register/validate/duplicate409/emptyColumns/notFound/list |

**回归门控命令**（P4 验证）：

```bash
cd backend && python3 -m pytest tests/test_cat_nfr_rpt_meta_r62.py -q
cd backend && python3 -m pytest tests/test_cat_dash_viz_nfr_r61.py tests/test_rpt_view_cat_gov_r60.py tests/test_meta_cat_dash_conn_design_r59.py -q
cd backend && python3 -m pytest -q
cd backend && ruff check .
```

## 8. P5 文档回写清单（P3 不执行）

| 文档 | 动作 |
|------|------|
| `docs/automate/prd/F14-CAT.md` CAT-006 | 勾选 production stats 模板；更新锚点 `cat06/` |
| `docs/automate/prd/F15-NFR.md` NFR-003 | 勾选 SLA probe + alerts stub；锚点 `dashboard_sla.py` |
| `docs/automate/prd/F08-RPT.md` RPT-002/003 | 勾选 L1 验收；更新锚点 |
| `docs/automate/prd/F11-META.md` META-005 | 勾选物理表登记；锚点 `metadata/physical/` |
| `docs/api/README.md` | 登记 5 组新路由 |
| `docs/services/` | 评估 `governance.md`/`reports.md`/`metadata.md` 边界一句 |

## 9. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项（CAT-006/NFR-003/RPT-002/RPT-003/META-005）
- [x] 文件列表 18 项 ≤ 20；无 TBD/TODO 占位
- [x] 每项验收标准可测试且含错误码
- [x] 非目标与 r59–r61 已交付面边界明确
- [x] 纯后端：`ui_design_skill: none`（无「UI 设计交付」小节）
- [x] 未超出范围框定模块
- [x] 禁止写生产代码（本文档仅设计）
