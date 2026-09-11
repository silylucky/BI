# M11 连接器 + M13 治理 companion 质量推分 r35 设计 — CONN-021/009/015 + GOV-004/008

```yaml
date: 2026-07-04
milestone: M11 + M13
round_target: docs/superpowers/evolution/2026-07-04-round-target-r35.md
prd_ids: [CONN-021, CONN-009, GOV-008, GOV-004, CONN-015]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | TiDB 连通/schema/types 边界闭合 | CONN-021 | 1（簇最低分 86.0） | 完整度 **76%→≥88%**；可靠性 **92%→≥94%** | 错误主机/凭证/超时返回 `TIDB_*` 结构化 code；空库与未知表 schema 自省稳定 |
| 2 | StarRocks 连通/schema 与元数据 limit | CONN-009 | 2 | 完整度 **76%→≥88%**；性能 **86%→≥90%** | FE/BE 不可达报错清晰；宽表列元数据有 limit 不超时 |
| 3 | ACL/RLS 多维链与 bypass 边界 | GOV-008 | 3 | 完整度 **76%→≥88%**；可靠性 **92%→≥94%** | 未授权 execute 403；无绑定维度空结果链；admin bypass 可审计；非法 bypass 4xx |
| 4 | query-design validate/save/get 聚合校验 | GOV-004 | 4 | 完整度 **80%→≥90%**；用户价值 **80%→≥82%** | 非法聚合/空设计/未知字段/version 冲突均 `detail.fields`；与 config_store 互操作稳定 |
| 5 | Elasticsearch 索引映射与连接边界 | CONN-015 | 5（距 90 最近 88.1） | 完整度 **82%→≥90%**；性能 **86%→≥90%** | 认证/TLS/主机错误可定位；多索引/mapping 冲突/空索引/字段类型映射一致 |

**依赖链**：CONN-021 `TIDB_*` 错误码 + schema mock → CONN-009 `STARROCKS_*` 扩展 + metadata limit → GOV-008 acl execute/RLS 链 → GOV-004 validate 边界 + computeRules 透传 → CONN-015 mapping 边界 + 字段 limit → `test_connectors_gov_r35.py` 全绿 + r34 15/15 + r33 19/19 回归。

**上轮已交付（本轮不重复 L1 骨架）**：r34 `dialects/tidb.py`（MySQL 委托）、`starrocks.py`（`STARROCKS_TIMEOUT`）、`elasticsearch.py`（index→schema L1）、`governance/query_design/` validate/save/get、`acl.py` pending_publish 守卫、`test_connectors_gov_r34.py` 15 条 smoke。

**STUCK 说明**：五 ID 各连续 1 轮未破 90（86.0–88.1）；本轮 companion 质量推分闭合完整度缺口，目标加权总分 **≥90**。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M11/M13；**禁止**修改 `plan.md` / `goal.md` 结构。

**路径注记**：round-target 写作 `backend/app/gov/`，实现域为 **`backend/app/governance/`**（query_design + acl）；设计以下文实际路径为准。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `dialects/tidb.py` | 纯委托 `MysqlConnector`；`test_connection` 返回 `MYSQL_*` 而非 `TIDB_*`；**无**独立 OperationalError 包装 |
| `dialects/starrocks.py` | 已有 `STARROCKS_TIMEOUT/CONN_REFUSED/AUTH_FAILED`；schema 方法仍委托 MySQL；**无**非法 catalog/空 schema 守卫；**无**列元数据 limit |
| `dialects/elasticsearch.py` | 已有 `ES_INVALID_HOST`、基础 mapping 列浏览；**无**多索引 pattern、mapping 类型冲突检测、ES→BI 类型归一、`list_columns` limit；TLS 仅 port==443 |
| `dialects/errors.py` | MySQL/PG 映射完整；**无** TiDB/ES 专用导出 |
| `governance/query_design/service.py` | validate 委托 designer；revision 冲突已映射；**无** computeRules 非法聚合经 gov 路径 smoke；get 404 有测但未覆盖空 conditions |
| `governance/acl.py` | save/publish 守卫；admin bypass 调 `_assert_rls_binding`；**无** `execute` action；**无**多维 RLS 空链显式 403；**无** bypass 审计日志 |
| `api/v1/gov.py` | `_gov_query_design_error` 输出 `detail.fields`；**无** execute/preview 端点 |
| `test_connectors_gov_r34.py` | 15 条；TiDB 仅 catalog + ok mock；StarRocks 仅 timeout；ES 仅单 index；GOV 无 empty/aggregate/computeRules |

**范围框定模块**（3）：`backend/app/datasources/dialects/`（CONN-021/009/015）、`backend/app/governance/query_design/` + `acl.py`（GOV-004/008）、`tests/` + 文档同步。

**范围框定文件列表**（17 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/tidb.py` | CONN-021 | 修改 |
| `backend/app/datasources/dialects/starrocks.py` | CONN-009 | 修改 |
| `backend/app/datasources/dialects/elasticsearch.py` | CONN-015 | 修改 |
| `backend/app/datasources/dialects/errors.py` | CONN-021 | 修改（导出 `TIDB_*` 常量别名，可选） |
| `backend/app/governance/acl.py` | GOV-008 | 修改 |
| `backend/app/governance/query_design/service.py` | GOV-004/008 | 修改 |
| `backend/app/governance/query_design/schemas.py` | GOV-004 | 修改（错误码常量，若有） |
| `backend/app/api/v1/gov.py` | GOV-008 | 修改（`POST /query-design/preview-execute` 薄入口，见 §3.4） |
| `tests/test_connectors_gov_r35.py` | 全部 | 新建 |
| `docs/services/datasources.md` | CONN-021/009/015 | 修改 |
| `docs/services/governance.md` | GOV-004/008 | 修改 |
| `docs/api/README.md` | GOV-008 | 修改（登记 preview-execute 一行） |
| `docs/automate/prd/F04-CONN.md` | CONN-* | P5 对账（非 P3） |
| `docs/automate/prd/F10-GOV.md` | GOV-* | P5 对账（非 P3） |

**真理源优先级**：`round-target` > `prd/F04-CONN.md` + `prd/F10-GOV.md` > `docs/services/datasources.md` · `governance.md` > `docs/api/README.md`。

**本轮性质**：M11/M13 **质量推分** companion（边界闭合 + pytest + 文档），**纯后端**；`ui_design_skill: none`；不含 `fe/`、CONN-003~008 远期方言、META/DESIGN 远期项、完整 BPM、M7 全量 RLS 设计器、真实 ES/StarRocks 集成环境。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/dialects/
├── tidb.py              # + TIDB_* test_connection 包装；schema 空库/未知表边界
├── starrocks.py         # + STARROCKS_* 全量；list_columns limit；非法 schema 守卫
├── elasticsearch.py     # + 多索引/mapping 冲突/类型映射/limit/TLS+auth pytest 路径
└── errors.py            # + TIDB_* 常量（映射自 MYSQL_*）

backend/app/governance/
├── acl.py               # + execute 守卫、多维 RLS 空链、audit log、非法 bypass
├── query_design/
│   ├── service.py       # + preview_execute 编排、computeRules 校验链巩固
│   └── schemas.py       # + PreviewExecuteOut（若需）
└── api/v1/gov.py        # + POST /gov/query-design/preview-execute

tests/
└── test_connectors_gov_r35.py   # T-*-R35-xxx 新用例（≥18 条）
```

### 3.2 CONN-021 — TiDB 连通与 schema/types 边界

#### 3.2.1 方案比选

| 方案 | 错误码 | schema 边界 | 结论 |
|------|--------|-------------|------|
| A 镜像 StarRocks：tidb 自有 `test_connection` + `_map_tidb_error` | `TIDB_*` | 委托 MySQL + mock 测空/未知 | **采用** — 与 r34 StarRocks 模式一致，不 fork MySQL SQL |
| B 继续纯委托，测试接受 `MYSQL_*` | 无独立码 | 同左 | 否决 — PRD/round-target 要求 TiDB 可区分错误域 |
| C 新建 `dialects/tidb/errors.py` | 独立模块 | — | 否决 — 超文件预算且无复用收益 |

#### 3.2.2 `test_connection` 强化

**文件**：`backend/app/datasources/dialects/tidb.py`

- 新增常量：`TIDB_TIMEOUT`、`TIDB_CONN_REFUSED`、`TIDB_AUTH_FAILED`、`TIDB_UNKNOWN_DATABASE`、`TIDB_UNKNOWN`（映射表同 StarRocks，源为 `map_mysql_operational_error`）。
- `test_connection`：不再直接 `return self._inner.test_connection(...)`；改为 `open_connection` + `ping` + `OperationalError` 捕获，返回 `code=TIDB_*`（与 StarRocks 实现结构对称）。
- 默认 port 文档注释保持 **4000**（连接参数仍由调用方 `DataSource.port` 传入，不在连接器内硬编码端口）。

#### 3.2.3 schema/types 边界

| 场景 | 行为 | 测试方式 |
|------|------|----------|
| 空库（无用户 schema） | `list_schemas` 返回 `[]` 或仅过滤 `information_schema`/`mysql`/`sys` 后为空 | mock cursor `fetchall=[]` 或仅系统库 |
| 未知表 `list_columns` | 返回 `[]`（MySQL INFORMATION_SCHEMA 零行） | mock 空结果 |
| types catalog | `tidb` 项含 `type/displayName/category/capabilities` 且 `schema_browser` ∈ capabilities | 直接调 `export_type_catalog()` |
| 凭证错误 | `ok=False`, `code=TIDB_AUTH_FAILED` | mock `OperationalError(1045, ...)` |
| 连接拒绝 | `code=TIDB_CONN_REFUSED` | mock errno 2003 |
| 超时 | `code=TIDB_TIMEOUT` | mock errno 2013 |

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R35-021-01 | types catalog 含 `tidb`，`category=relational`，capabilities 含 `schema_browser` |
| T-CONN-R35-021-02 | mock 成功 ping → `ok=True` |
| T-CONN-R35-021-03 | mock 1045 → `code=TIDB_AUTH_FAILED` |
| T-CONN-R35-021-04 | mock 2003 → `code=TIDB_CONN_REFUSED` |
| T-CONN-R35-021-05 | mock 2013 → `code=TIDB_TIMEOUT` |
| T-CONN-R35-021-06 | mock 空 schemas → `list_schemas` 返回 `[]` |
| T-CONN-R35-021-07 | mock 未知表 columns 查询零行 → `list_columns` 返回 `[]` |

### 3.3 CONN-009 — StarRocks 连通、schema 与元数据 limit

#### 3.3.1 连通性扩展

**文件**：`backend/app/datasources/dialects/starrocks.py`

- 补测：`STARROCKS_CONN_REFUSED`、`STARROCKS_AUTH_FAILED`（映射路径已有，r34 仅覆盖 timeout）。
- 非法 catalog：`list_tables` / `list_columns` 当 schema 名含非法字符或空字符串时，**在连接器层** `raise ValueError("invalid schema")`；metadata service 已 400 空 schema，单测直接调 connector 传 `schema=""` 断言 ValueError 或返回 `[]`（采用 **ValueError → metadata 502 映射** 太重；改为 `list_tables(conn, "")` 返回 `[]` + 文档说明，非法字符 schema mock 零表）。

#### 3.3.2 元数据 limit（性能维）

- 常量：`STARROCKS_MAX_COLUMNS = 500`（模块级，与 ES 对齐）。
- `list_columns`：查询后若 `len(rows) > STARROCKS_MAX_COLUMNS`，切片前 500 列（稳定排序保持 `ORDER BY ORDINAL_POSITION`）；不抛错，保证宽表 smoke 有界。
- 性能 smoke：mock 600 列，`len(list_columns(...)) == 500`，elapsed < 0.1s（纯 Python 切片）。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R35-009-01 | mock 2003 → `STARROCKS_CONN_REFUSED` |
| T-CONN-R35-009-02 | mock 1045 → `STARROCKS_AUTH_FAILED` |
| T-CONN-R35-009-03 | mock 不存在 schema 的 tables 查询 → `[]` |
| T-CONN-R35-009-04 | mock 600 列 → 返回 500 列 |
| T-CONN-R35-009-05 | types catalog `starrocks` `category=olap` |

### 3.4 GOV-008 — ACL/RLS 多维链与 bypass

#### 3.4.1 方案比选

| 方案 | execute 守卫 | 多维 RLS | 结论 |
|------|--------------|----------|------|
| A `acl.py` 增 `assert_query_design_execute` + `POST .../preview-execute` 薄 API | HTTP 可测 403 | 调 `prepare_query_rls` 多维 dict | **采用** — 满足「execute 403」可感知且不改 query 执行器 |
| B 仅单元测直接调 acl 私有函数 | 无 HTTP | 同左 | 否决 — 完整度评分偏 API 契约 |
| C 接入真实 `POST /query/execute` | 真实执行链 | 过重 | 否决 — 超出 round-target，依赖 QUERY 全链 |

#### 3.4.2 ACL 扩展

**文件**：`backend/app/governance/acl.py`

新增：

```python
def assert_query_design_execute(
    session: Session,
    actor: UserContext,
    *,
    data_source_id: uuid.UUID | None,
) -> str:
    """返回 RLS SQL fragment；未授权抛 GovAclError 403。"""
```

规则：

| 场景 | 行为 | code | HTTP |
|------|------|------|:----:|
| `viewer` 无 `designer`/`admin` 角色 | 拒绝 | `GOV_ACL_FORBIDDEN` | 403 |
| 非 admin 且无 org 绑定（`resolve_user_org_node_ids` 空） | 拒绝 | `GOV_RLS_BINDING_REQUIRED` | 403 |
| admin | 允许；`logger.info("gov_acl_bypass", extra={actor, action: execute})` 审计 | — | 200 |
| 多维链全空（`build_multi_dimension_rls_fragment` → 含 `1=0`） | 允许返回 fragment（**不泄漏数据**）；响应 `rlsFragment` 含 `1=0` | — | 200 |
| `designer` 伪造 `admin` 角色（roles 仅 viewer+designer 无 admin）尝试 bypass | 仍走 binding 检查 | `GOV_RLS_BINDING_REQUIRED` | 403 |

**文件**：`backend/app/governance/query_design/service.py`

- `preview_query_design_execute(session, actor, data_source_id)`：调 `assert_query_design_execute`；若 `data_source_id` 非空则 `datasources.acl.assert_visible`；返回 `{"rlsFragment": fragment}`。
- save 路径不变；与 GOV-004 联合回归在测试中顺序调用 save → preview-execute。

**文件**：`backend/app/api/v1/gov.py`

- `POST /api/v1/gov/query-design/preview-execute`
- Body：`{"dataSourceId": "<uuid|null>"}` 
- 响应 200：`{"rlsFragment": "t.org_node_id IN (...)" | "1=0"}` 
- 403：`GOV_ACL_FORBIDDEN` / `GOV_RLS_BINDING_REQUIRED`

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-GOV-R35-008-01 | viewer `POST preview-execute` → 403 `GOV_ACL_FORBIDDEN` |
| T-GOV-R35-008-02 | designer 无 org mock 空 → 403 `GOV_RLS_BINDING_REQUIRED` |
| T-GOV-R35-008-03 | admin + mock org + mock RLS → 200 且 `rlsFragment` 非空 |
| T-GOV-R35-008-04 | admin bypass 触发 logging（caplog `gov_acl_bypass`） |
| T-GOV-R35-008-05 | mock 多维链全空 → 200 且 `rlsFragment == "1=0"` |
| T-GOV-R35-008-06 | save draft 后 preview-execute 联合 200（GOV-004 回归） |

### 3.5 GOV-004 — query-design validate/save/get 边界

#### 3.5.1 校验链巩固

**文件**：`backend/app/governance/query_design/service.py`（逻辑已委托 designer，本轮**不复制**校验规则）

需覆盖的 gov 路径错误透传（`_wrap_designer_error` 已有）：

| 场景 | designer code | HTTP | detail.fields |
|------|---------------|:----:|---------------|
| 空 conditions | `DESIGN_EMPTY_CONDITIONS` | 422 | `[{field: "conditions", ...}]` |
| 未知 fieldId | `DESIGN_UNKNOWN_FIELD` | 422 | 含 `conditions[0].fieldId` |
| 非法聚合 `median(...)` | `DESIGN_INVALID_AGGREGATE` | 422 | 含 `rules[n].expression` |
| 空 title | `GOV_QUERY_DESIGN_INVALID` | 422 | `[{field: "title", ...}]`（service 已有） |
| 未知 dataSourceId | `GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE` | 422 | `[{field: "dataSourceId", ...}]` |
| revision 冲突 | `CONFIG_VERSION_CONFLICT` | 409 | fields 可选 |
| get 不存在 ref | `GOV_QUERY_DESIGN_NOT_FOUND` | 404 | — |

**computeRules 路径**：validate/save payload 增 `computeRules` 段（复用 r33 `_valid_compute_rules` 形状），经 gov API 触发 `DESIGN_INVALID_AGGREGATE`。

**config_store 互操作**：save 后 `GET /api/v1/query/configs?config_type=visual_query_design&ref_type=gov_query_design&ref_id=...` 返回 200（若 r33 query_configs 路由已存在）；否则仅 gov get 回归。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-GOV-R35-004-01 | 空 `conditions: []` validate → 422 `DESIGN_EMPTY_CONDITIONS` + fields |
| T-GOV-R35-004-02 | computeRules 含 `median(x)` validate → 422 `DESIGN_INVALID_AGGREGATE` + fields |
| T-GOV-R35-004-03 | blank title validate → 422 `GOV_QUERY_DESIGN_INVALID` |
| T-GOV-R35-004-04 | 随机 `dataSourceId` validate → 422 `GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE` |
| T-GOV-R35-004-05 | get 随机 ref → 404 `GOV_QUERY_DESIGN_NOT_FOUND` |
| T-GOV-R35-004-06 | revision 冲突 → 409 `CONFIG_VERSION_CONFLICT`（复用 r34 模式） |
| T-GOV-R35-004-07 | 合法 save + get round-trip `revision` 一致 |

### 3.6 CONN-015 — Elasticsearch 映射与连接边界

#### 3.6.1 连接错误扩展

**文件**：`backend/app/datasources/dialects/elasticsearch.py`

- 补显式 pytest：mock `AuthenticationException` 或 message 含 `401` → `ES_AUTH_FAILED`；connection refused → `ES_CONNECTION_REFUSED`；timeout → `ES_TIMEOUT`。
- TLS：`port == 443` 使用 `https`（已有）；增测 port 443 mock `Elasticsearch` hosts 含 `https://`。

#### 3.6.2 schema/mapping 边界

| 场景 | 行为 |
|------|------|
| 多索引 | `cat.indices` 返回 `orders`,`events`；过滤 `.` 前缀；排序稳定 |
| 空索引 | mapping `properties: {}` → `list_columns` 返回 `[]` |
| mapping 类型冲突 | 同字段名在不同子 path 出现不同类型 → 取 **首个** 并 `data_type` 后缀 `_conflict` 或统一为 `conflict`（采用：`data_type=f"{t1}|{t2}"` 当检测不一致；单索引无冲突） |
| ES→BI 类型映射 | `keyword/text→string`，`long/integer/double→number`，`date→datetime`，`boolean→boolean`，`object/nested→json`，未知→`unknown` |
| 字段 limit | `ES_MAX_MAPPING_FIELDS = 500`；超出切片（与 StarRocks 对称） |

实现要点：

- 新增 `_normalize_es_type(es_type: str) -> str` 纯函数。
- `list_columns` 遍历 properties 时应用归一化；嵌套 object **不展开**（L1 保持 flat properties 一层，与 r34 一致）。
- 多索引：r35 范围仍为**单 index 作为 schema 名**（`list_columns(conn, index_name, "_doc")`）；多索引体现在 `list_schemas` 返回多项。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-CONN-R35-015-01 | mock 401 → `ES_AUTH_FAILED` |
| T-CONN-R35-015-02 | mock connection refused → `ES_CONNECTION_REFUSED` |
| T-CONN-R35-015-03 | mock timeout → `ES_TIMEOUT` |
| T-CONN-R35-015-04 | 多索引 list_schemas 含 2 个非系统 index |
| T-CONN-R35-015-05 | 空 mapping → `list_columns` `[]` |
| T-CONN-R35-015-06 | keyword/long → `data_type` 为 `string`/`number` |
| T-CONN-R35-015-07 | mock 600 fields → 返回 500 |
| T-CONN-R35-015-08 | port 443 → `_build_client` 使用 https URL（patch 断言 kwargs） |

## 4. 测试策略

### 4.1 新套件

**文件**：`tests/test_connectors_gov_r35.py`

- 独立 SQLite DB：`connectors_gov_r35`（模式同 r34 fixture）。
- 命名：`T-CONN-R35-*` / `T-GOV-R35-*` / `T-REG-R35-*`。
- 目标 **≥18** 条新测（上表合计 33 条，实施时可合并参数化，计划阶段承诺 ≥18 独立断言函数）。
- 保留 `test_connectors_gov_r34.py` 不删；Task 末全量回归 r34 15/15 + r33 19/19。

### 4.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest tests/test_connectors_gov_r35.py tests/test_connectors_gov_r34.py tests/test_meta_design_r33.py -v
```

全量基线：r34 后 **742 passed** + 4 skipped；本轮目标 **≥760 passed** + 4 skipped。

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | 目标 |
|--------|------------------|--------------|------|
| CONN-021 | 完整度 76%、可靠性 92% | `TIDB_*` 全路径 + schema 空/未知 smoke | 完整度 ≥88%、可靠性 ≥94% |
| CONN-009 | 完整度 76%、性能 86% | 拒绝/凭证 + columns limit 500 | 完整度 ≥88%、性能 ≥90% |
| GOV-008 | 完整度 76%、可靠性 92% | execute API + RLS 空链 + bypass 审计 | 完整度 ≥88%、可靠性 ≥94% |
| GOV-004 | 完整度 80%、用户价值 80% | empty/aggregate/404/409 fields 全覆盖 | 完整度 ≥90%、用户价值 ≥82% |
| CONN-015 | 完整度 82%、性能 86% | mapping 边界 + 类型归一 + field limit | 完整度 ≥90%、性能 ≥90% |

## 6. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- Hive/SQL Server/ClickHouse/Doris（CONN-003~008）及未 kickoff 方言
- META-003~006、DESIGN-003~005、QUERY-008/009 Dataset 路径
- Admin 连接器/治理全量 UI（`fe/`）
- 完整 BPM 工单流水线、GOV-003 publish 引擎、真实总线 HTTP
- M7 全量多维 RLS 设计器、真实 TiDB/StarRocks/ES 容器集成测
- Elasticsearch 嵌套 object 递归展开、跨索引 field 合并查询
- 新增 Alembic migration

## 7. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| TiDB/StarRocks/ES 边界与错误码 | `docs/services/datasources.md` §r35 |
| query-design preview-execute + ACL | `docs/services/governance.md` §r35 |
| 新路由 | `docs/api/README.md` 一行 |
| 验收勾选 | `prd/F04-CONN.md`、`prd/F10-GOV.md`（**P5**） |

## 8. UI 设计交付

```yaml
ui_design_skill: none
```

本轮纯后端 API 质量推分，不触及 `fe/` 与壳层 IA；无 UI 设计交付小节要求（Automation 豁免）。

## 9. Self-review 清单

- [x] 覆盖 round-target 五子项全部验收标准
- [x] 文件列表 17 ≤ 20，未超出模块框定
- [x] 无 TBD/TODO 占位
- [x] `ui_design_skill: none` 已记录
- [x] 错误体与项目 envelope 一致：`{code, message, detail}`
- [x] 未要求编写生产代码（本文档仅设计）
