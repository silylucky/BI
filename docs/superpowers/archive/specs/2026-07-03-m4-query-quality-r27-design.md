# M4 轻量查询质量推分 r27 设计 — QUERY-004 / QUERY-001 / QUERY-002 / QUERY-005 / QUERY-006

```yaml
date: 2026-07-03
milestone: M4
round_target: docs/superpowers/evolution/2026-07-03-round-target-r27.md
prd_ids: [QUERY-004, QUERY-001, QUERY-002, QUERY-005, QUERY-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | ClickHouse SQL 方言适配器 L1 | QUERY-004 | 1（主攻 STUCK） | 完整度 **88%→≥92%**；性能 **86%→≥90%** | ClickHouse 数据源 SQL/表模式与 MySQL/PG 行为一致；方言错误可定位 |
| 2 | 只读守卫与 SQL 注入边界加固 | QUERY-001 | 2 | 用户价值 **82%→≥86%**；性能 **86%→≥90%** | DML/DDL/多语句/注释绕过被结构化 4xx 拦截；只读路径延迟可控 |
| 3 | mode=table 边界与分页上限 | QUERY-002 | 3 | 用户价值 **82%→≥86%**；性能 **86%→≥90%** | 空表、大分页、非法 schema/table、超时返回明确错误 |
| 4 | chart_query_bindings 并发与 chartId 唯一 | QUERY-005 | 4 | 性能 **86%→≥90%**；可靠性 **94%→≥96%** | 重复 chartId 冲突明确；并发 PATCH 可预期；删除后不可见 |
| 5 | RLS 执行链边界与 admin 回退 | QUERY-006 | 5 | 用户价值 **82%→≥86%**；可靠性 **94%→≥96%** | 多角色/无规则语义清晰；与 ClickHouse 方言链集成 smoke |

**依赖链**：ClickHouse dialect 注册 → executor 错误映射扩展 → readonly/table 边界测试 → bindings chartId 约束 → RLS admin 回退 + 多方言集成 smoke → pytest r27 全绿 + r26 回归。

**上轮已交付（本轮不重复 L1 骨架）**：MySQL/PostgreSQL dialects、`QueryExecutor`、`readonly` 基础守卫、`chart_query_bindings` CRUD、`apply_rls_to_sql` 链、`test_query_l1_r26.py` T-Q-001~055（29 项）。

**STUCK 说明**：QUERY-004 连续 1 轮 88.5（r26 明示 ClickHouse 缺口）；本轮闭合 `get_sql_dialect("clickhouse")` 与 execute 成功/失败路径。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M4 + §M11 QUERY-004；**禁止**修改 `plan.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `dialects/__init__.py` | 仅注册 `mysql`、`postgresql`；`clickhouse` → `UnsupportedDialectError`（T-Q-025） |
| `dialects/mysql.py` / `postgres.py` | `quote_identifier`、`wrap_limit`（子查询 vs 后缀）、`build_table_select` 已实现 |
| `executor.py` | 执行链完整；`_map_execution_error` 仅通用 timeout/table-not-found；`_serialize_cell` 覆盖 datetime/Decimal/UUID |
| `readonly.py` | 拒绝首部 DML/DDL、多语句（`;`）、部分危险子句；**未**覆盖行内 `;` 后写操作、注释绕过 |
| `binding_service.py` | CRUD + `resolve_binding_execute`；**无** `chartId` 字段；**无** 并发冲突处理；硬删除 |
| `models.py` | `ChartQueryBinding` 无 `chart_id`、`deleted_at` |
| `rls/guard.py` | `apply_rls_to_sql` 委托 `prepare_query_rls`；异常降级 `1=0`；**无** admin 全量回退 |
| `api/v1/query.py` | execute + bindings 五路由；薄 entry |
| `core/config.py` | `query_default_limit=1000`、`query_timeout_seconds=30`（本轮只读，不扩 Settings） |
| CONN-007 | ClickHouse **连接器未实现**（`datasources/dialects/` 无 clickhouse）；**不在本轮范围** |

**范围框定模块**（2）：`backend/app/query/`、`backend/app/api/v1/`（query 路由）+ `tests/` + 文档同步。

**真理源优先级**：`round-target` > `prd/F05-QUERY.md` > `docs/services/query.md` > `docs/api/README.md`。

**本轮性质**：M4 QUERY 质量推分 companion（方言补缺 + 边界测试 + 可靠性加固），**纯后端**；不含 `fe/`、不含 CONN-007 连通、不含 Admin 查询设计器。

## 3. 架构设计

### 3.1 目标目录结构（增量）

```
backend/app/query/
├── dialects/
│   ├── clickhouse.py          # QUERY-004：新建
│   └── __init__.py            # 注册 clickhouse
├── executor.py                # CH 错误映射、可选 CH 类型序列化
├── readonly.py                # 注入/注释/DDL 边界加固
├── binding_service.py         # chartId 唯一、并发 PATCH 语义
├── models.py                  # chart_id 列（可选 unique）
├── schemas.py                 # BindingCreate/Out 增 chartId
└── rls/guard.py               # admin 无规则回退、多角色边界

backend/migrations/versions/
└── 0012_chart_query_bindings_chart_id.py   # chart_id unique（可空）

tests/
└── test_query_quality_r27.py  # T-Q-R27-xxx 新 smoke（不拆散 r26）

docs/services/query.md         # 方言/绑定/RLS 状态更新
docs/api/README.md             # 若 Binding 契约变更则同步
```

### 3.2 QUERY-004 — ClickHouse 方言适配器 L1

#### 3.2.1 方案比选

| 方案 | wrap_limit 策略 | 标识符 | 结论 |
|------|----------------|--------|------|
| A Postgres 后缀 `LIMIT/OFFSET` | 直接追加 | 反引号 `` ` `` | **采用** — CH 原生支持；与 MySQL 标识符风格一致 |
| B MySQL 子查询包裹 | `SELECT * FROM (...) AS _vs LIMIT` | 反引号 | 否决 — 对 CH 嵌套聚合不必要，性能维扣分 |
| C 双引号标识符 | 后缀 LIMIT | `"` | 否决 — 与项目 MySQL 风格不一致 |

#### 3.2.2 `ClickHouseDialect` 契约

**文件**：`backend/app/query/dialects/clickhouse.py`

| 方法 | 行为 |
|------|------|
| `connector_type` | `"clickhouse"` |
| `quote_identifier(name)` | `` `{name}` ``；非法标识符 → `validate_identifier` 抛错 |
| `qualify_table(schema, table)` | `` `{schema}`.`{table}` ``（CH 中 schema 映射 database） |
| `wrap_limit(sql, limit, offset)` | `normalized.rstrip(";")` + ` LIMIT {limit} OFFSET {offset}` |
| `build_table_select(...)` | `SELECT * FROM {qualified} LIMIT {limit} OFFSET {offset}` |

**注册**：`dialects/__init__.py` 增 `"clickhouse": ClickHouseDialect()`；`__all__` 导出 `ClickHouseDialect`。

#### 3.2.3 执行链与错误映射

**`executor._map_execution_error` 扩展**（识别 CH 驱动/消息片段，不依赖 CONN-007）：

| 触发条件（message 子串，case-insensitive） | code | HTTP |
|--------------------------------------------|------|:----:|
| `unknown table` / `doesn't exist` / `code: 60` | `QUERY_TABLE_NOT_FOUND` | 404 |
| `syntax error` / `code: 62` | `QUERY_SYNTAX_ERROR` | 400 |
| `timeout` / `timed out` | `QUERY_TIMEOUT` | 504 |
| 其他 | `QUERY_EXECUTION_ERROR` | 400 |

**类型序列化（完整度）**：`_serialize_cell` 增 `bytes` → hex 前缀字符串、`bool` 保持原样（CH 常返回 UInt8 布尔）。

**性能**：table 模式已 `skip_wrap_limit=True`，CH dialect 不二次包裹；单元测试断言 `wrap_limit` 为 O(1) 字符串拼接（无重复子查询）。

#### 3.2.4 测试策略（无真实 CH 容器）

| ID | 断言 |
|----|------|
| T-Q-R27-004-01 | `get_sql_dialect("clickhouse")` 成功；T-Q-025 行为改为 **仅** `unknown_type` 抛 `UnsupportedDialectError` |
| T-Q-R27-004-02 | `quote_identifier("col")` → `` `col` ``；非法名抛错 |
| T-Q-R27-004-03 | `wrap_limit("SELECT 1", limit=10, offset=2)` 含 `LIMIT 10` 与 `OFFSET 2` |
| T-Q-R27-004-04 | `build_table_select("db", "t", limit=50)` 经 `assert_readonly_sql` |
| T-Q-R27-004-05 | 创建 `type=clickhouse` 数据源（元库行）+ mock `pooled_connection` → `POST /execute` sql 模式 200 |
| T-Q-R27-004-06 | mock 抛出 `syntax error` → 400 `QUERY_SYNTAX_ERROR` |
| T-Q-R27-004-07 | mock 抛出 `Code: 60. DB::Exception: Unknown table` → 404 `QUERY_TABLE_NOT_FOUND` |

**验收（可测试）**：

- [ ] `clickhouse` 已注册且与 mysql/postgresql API 对称
- [ ] execute 成功路径 + 方言错误路径 pytest 绿
- [ ] 加权总分目标 ≥90（完整度 ≥92%、性能 ≥90%）

### 3.3 QUERY-001 — 只读守卫与性能边界

#### 3.3.1 `readonly.py` 加固

| 增强 | 规则 | code |
|------|------|------|
| 行内多语句 | `;\s*(INSERT\|UPDATE\|DELETE\|DROP\|ALTER\|CREATE\|TRUNCATE\|MERGE\|REPLACE)\b` | `QUERY_NOT_READONLY` |
| 块注释绕过 | 剥离 `/* ... */` 与 `-- ...\n` 后再校验（防 `SELECT 1 /* */ ; DELETE`） | 同上 |
| DDL 中部出现 | `\b(CREATE\|DROP\|ALTER)\s+(TABLE\|VIEW\|INDEX\|DATABASE)\b` 即使非首部 | 同上 |
| 超长 SQL | `len(sql) > 65536` → 400 | `QUERY_SQL_TOO_LONG` |

**保持**：现有首部 DML、多 `;`、`INTO OUTFILE` 等规则不回归。

#### 3.3.2 性能与并发 smoke

| ID | 断言 |
|----|------|
| T-Q-R27-001-01 | `INSERT`/`UPDATE`/`DELETE`/`CREATE TABLE`/`DROP TABLE` → 400 `QUERY_NOT_READONLY` |
| T-Q-R27-001-02 | `SELECT 1; SELECT 2` → 400 多语句 |
| T-Q-R27-001-03 | `SELECT 1 /*x*/ ; DELETE FROM t` → 400 |
| T-Q-R27-001-04 | `-- comment\nSELECT 1` → 通过 |
| T-Q-R27-001-05 | 65537 字符 SELECT → `QUERY_SQL_TOO_LONG` |
| T-Q-R27-001-06 | `ThreadPoolExecutor(4)` 并发 20 次 `assert_readonly_sql("SELECT 1")` 无异常 |
| T-Q-R27-001-07 | mock execute 路径 `time.perf_counter()` P95 < **50ms**（本机 CI mock 基线，与 r26 可比） |

**验收**：只读守卫扩展 pytest 全绿；P95 在约定阈值内。

### 3.4 QUERY-002 — mode=table 边界

| ID | 场景 | 期望 |
|----|------|------|
| T-Q-R27-002-01 | mock 返回 0 行 | 200，`rowCount=0`，`columns` 非空或空列表一致 |
| T-Q-R27-002-02 | `limit=query_default_limit`（1000） | 200；SQL/dialect 含 LIMIT 1000 |
| T-Q-R27-002-03 | `limit=query_default_limit+1` via API | 422 |
| T-Q-R27-002-04 | `schema="bad!"` / `table="bad!"` | 400（`validate_identifier`） |
| T-Q-R27-002-05 | mock `timed out` | 504 `QUERY_TIMEOUT` |
| T-Q-R27-002-06 | `offset=100` table 模式 | dialect SQL 含 `OFFSET 100` |
| T-Q-R27-002-07 | clickhouse 数据源 table 模式 mock 成功 | 与 T-Q-R27-004-05 共用 fixture |

**实现注记**：边界测试主要扩 `test_query_quality_r27.py` + 必要时 `executor._map_execution_error` 已覆盖 timeout；**不**改 table 模式核心算法。

### 3.5 QUERY-005 — chart_query_bindings 可靠性

#### 3.5.1 数据模型

**迁移 `0012_chart_query_bindings_chart_id.py`**：

- 列 `chart_id UUID NULL`
- 唯一索引 `uq_chart_query_bindings_chart_id` on `chart_id` WHERE `chart_id IS NOT NULL`（SQLite/PG 兼容：应用层先查 + DB unique）

**schemas**：`BindingCreate` / `BindingOut` 增 `chart_id: UUID | None = Field(default=None, alias="chartId")`。

**语义**：

- `chartId` 可选；若提供则全局唯一（一图表组件对应一绑定）
- 重复创建 → 409 `BINDING_CHART_CONFLICT`
- `PATCH`/`PUT` 改 `chartId` 为他人已占用 → 409

#### 3.5.2 并发与删除

| ID | 场景 | 期望 |
|----|------|------|
| T-Q-R27-005-01 | 两绑定同 `chartId` 创建 | 第二个 409 `BINDING_CHART_CONFLICT` |
| T-Q-R27-005-02 | 并发 2× PATCH 同 binding 不同 `name` | 两次均 200（last-write-wins）；无 500 |
| T-Q-R27-005-03 | DELETE binding 后 GET → 404；list 不含 |
| T-Q-R27-005-04 | DELETE 后 `bindingId` execute → 404 `BINDING_NOT_FOUND` |
| T-Q-R27-005-05 | 软删数据源（`deleted_at` 非空）上 binding execute | 404 `DATASOURCE_NOT_FOUND`（复用 executor） |

**软删说明**：binding 本体 L1 仍**硬删除**；「软删」验收指数据源软删后绑定 execute 不可见，不新增 `chart_query_bindings.deleted_at`（留 r28）。

#### 3.5.3 方案比选 — chartId 唯一

| 方案 | 说明 | 结论 |
|------|------|------|
| A `chart_id` UUID 可空 + unique | 对齐 FR-2.0b 组件引用 | **采用** |
| B `(name, data_source_id)` unique | 无 migration 但语义弱 | 否决 |
| C 应用层仅测重复 name | 不满足 round-target chartId | 否决 |

### 3.6 QUERY-006 — RLS 执行链加固

#### 3.6.1 admin 无规则回退

**问题**：`resolve_user_org_node_ids` 对 admin 无 org 绑定时返回空集 → `build_org_rls_fragment` → `1=0` → 误杀全量数据，拉低用户价值分。

**设计**：在 `rls/guard.py` 的 `apply_rls_to_sql` 入口：

```python
ADMIN_BYPASS_ROLES = frozenset({"admin"})

def _should_bypass_rls(user: UserContext) -> bool:
    return bool(ADMIN_BYPASS_ROLES.intersection(user.roles))
```

- 若 bypass：跳过 `prepare_query_rls`，SQL 不变（与 `rls.enabled=false` 开发开关正交；生产 admin 仍走 bypass 谓词）
- 非 admin：保持现有 org / 多维片段逻辑

**安全边界**：数据源级 ACL（`assert_visible`）不变；仅行级过滤语义调整。

#### 3.6.2 多角色与方言集成

| ID | 场景 | 期望 |
|----|------|------|
| T-Q-R27-006-01 | admin 执行 sql 模式 | `apply_rls_to_sql` **不**追加 `WHERE (1=0)`；mock 有数据 |
| T-Q-R27-006-02 | viewer 无 org grant | 仍 `1=0` 空集（回归 T-Q-041） |
| T-Q-R27-006-03 | 用户双角色 admin+viewer | admin bypass 生效 → 有数据 |
| T-Q-R27-006-04 | 多维 `column_by_dimension_id` mock | fragment 含 `AND` 合并 |
| T-Q-R27-006-05 | clickhouse + RLS 链 mock | execute 200；`apply_rls_to_sql` 被调用一次 |
| T-Q-R27-006-06 | 不可见 dataSource | 403（回归 T-Q-042） |

**不实现**：完整 M7 多维 RLS 设计器、策略 CRUD UI。

## 4. 范围框定文件清单（17 项）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/query/dialects/clickhouse.py` | QUERY-004 | 新建 |
| `backend/app/query/dialects/__init__.py` | QUERY-004 | 修改：注册 clickhouse |
| `backend/app/query/executor.py` | QUERY-004, 002 | 修改：CH 错误映射、bytes 序列化 |
| `backend/app/query/readonly.py` | QUERY-001 | 修改：注释剥离、行内写、长度上限 |
| `backend/app/query/binding_service.py` | QUERY-005 | 修改：chartId 冲突检测 |
| `backend/app/query/models.py` | QUERY-005 | 修改：`chart_id` 列 |
| `backend/app/query/schemas.py` | QUERY-005 | 修改：`chartId` 字段 |
| `backend/app/query/rls/guard.py` | QUERY-006 | 修改：admin bypass |
| `backend/app/api/v1/query.py` | 005 | 修改：409 映射（若需） |
| `backend/migrations/versions/0012_chart_query_bindings_chart_id.py` | QUERY-005 | 新建 |
| `tests/test_query_quality_r27.py` | 全部 | 新建：T-Q-R27-xxx（目标 ≥28 项） |
| `tests/test_query_l1_r26.py` | QUERY-004 | 修改：T-Q-025 拆分为 unknown only |
| `tests/test_migrations.py` | QUERY-005 | 修改：T-MIG-40 0012 upgrade |
| `docs/services/query.md` | 全部 | 修改：ClickHouse dialect、chartId、RLS bypass |
| `docs/api/README.md` | QUERY-005 | 修改：Binding chartId 字段说明 |
| `docs/automate/prd/F05-QUERY.md` | QUERY-004 | 修改（P3/P5）：ClickHouse 验收勾选 |
| `docs/automate/prd.md` | 全部 | 修改（P5）：8 维重评 |

**只读参照（不修改）**：

| 路径 | 用途 |
|------|------|
| `backend/app/datasources/acl.py` | 可见性 403 契约 |
| `backend/app/auth/rls/hooks.py` | `prepare_query_rls` 签名 |
| `backend/app/datasources/models.py` | `deleted_at` 软删字段 |
| `tests/test_query_l1_r26.py` | fixture 复用模式 |

**明确不修改**：`fe/`、`goal.md`、`plan.md` 结构、`datasources/dialects/*`（CONN-007）、`main.py`。

## 5. 非目标（明确不做）

- CONN-007 ClickHouse **连接器**（连通测试、元数据浏览、驱动依赖）
- QUERY-003 Native 双路径、QUERY-007~009 Dataset 路径
- M5 VIZ 渲染、Admin 查询设计器 UI
- M7 完整多维 RLS 设计器与策略管理 UI
- `chart_query_bindings` 软删除列（`deleted_at`）
- 真实 ClickHouse Docker compose 集成测试（可选 mark integration，不阻塞 L1）
- 修改 `goal.md` / `plan.md` 结构
- 前端 UI（`ui_design_skill: none`）

## 6. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮设计对齐 | 预期提升 |
|--------|------------------|--------------|----------|
| QUERY-004 | 完整度 88%、性能 86% | ClickHouse dialect 全方法 + 结构化错误码 + 无子查询 wrap | 完整度 **≥92%**；性能 **≥90%**；总分 **≥90** |
| QUERY-001 | 用户价值 82%、性能 86% | 注释/行内写/超长拦截 + 并发 smoke + P95 基线 | 用户价值 **≥86%**；性能 **≥90%** |
| QUERY-002 | 用户价值 82%、性能 86% | 空集/分页顶/非法标识/超时/CH table 边界 | 用户价值 **≥86%**；性能 **≥90%** |
| QUERY-005 | 性能 86%、可靠性 94% | chartId unique + 并发 PATCH + 删除不可见 + DS 软删联动 | 性能 **≥90%**；可靠性 **≥96%** |
| QUERY-006 | 用户价值 82%、可靠性 94% | admin bypass + 多角色 + CH 链集成 | 用户价值 **≥86%**；可靠性 **≥96%** |

**测试覆盖维**：`test_query_quality_r27.py` 目标 ≥28 条；`test_query_l1_r26.py` 全量回归；P4 `pytest` 基线 r26 **532 passed** + 4 skipped → 本轮目标 **≥560 passed** + 4 skipped。

**验证命令**：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

## 7. UI 设计交付

**`ui_design_skill`**: `none`（本轮纯后端，不触及 `fe/` 下任何 `*.tsx` / 页面 / 组件 / 样式文件）。

通用质量基线（仅文档记录，无 UI 实施）：

- API 错误码保持 envelope：`{ "code", "message", "detail": null }`
- 未来 M5 图表绑定 UI 将消费 `chartId` 与 409 冲突提示；本轮仅后端契约

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| ClickHouse 无连接器导致 E2E 无法连真库 | mock `pooled_connection` + dialect 单元测试；CONN-007 独立里程碑 |
| admin RLS bypass 扩大可见行 | 数据源 ACL 仍强制；仅行级谓词跳过；单测覆盖 viewer 仍 1=0 |
| migration 0012 与并行演化冲突 | P3 rebase `dev-auto`；`test_migrations` T-MIG-40 |
| QUERY-004 仍 <90 第三轮 STUCK | round-target 建议人工 `create-evolution-plan` 复核验收标准 |

## 9. Spec Self-Review

- [x] 覆盖 round-target 全部 5 子项与验收标准
- [x] 文件清单 17 项 ≤20；模块限于 `query/` + `api/v1/query` + tests + docs
- [x] 无 TBD/TODO 占位
- [x] 方案比选已记录（CH wrap_limit、chartId 唯一）
- [x] 纯后端，`ui_design_skill: none`
- [x] 未要求写生产代码
