# 跨域 companion 质量推分 r67 设计 — DASH-004 / NFR-001 / NFR-002 / CONN-018 / RPT-003

```yaml
date: 2026-07-04
milestone: DASH/NFR/CONN/RPT
round_target: docs/superpowers/evolution/2026-07-04-round-target-r67.md
prd_ids: [DASH-004, NFR-001, NFR-002, CONN-018, RPT-003]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | global_filter_linkage validate/ACL/probe 深化 | DASH-004 | `dashboard/global_filters/` | 1（hub **#1 84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 非法联动配置被拦截；GET/validate 响应可探测 |
| 2 | dashboard-first-screen ACL/probe 深化 | NFR-001 | `core/nfr/dashboard_first_screen.py` | 2（hub **#2 84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 首屏 perf 探测可回归；非法 dashboardId/scope 被结构化拦截 |
| 3 | report-perf mock probe ACL/validate 深化 | NFR-002 | `core/nfr/report_perf.py` | 3（hub **#3 84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 报表 perf 探测可回归；非法 report/参数被拦截 |
| 4 | kingbase PG 委托 HTTP 链/错误域/probe 深化 | CONN-018 | `datasources/dialects/kingbase/` | 4（hub **#6 84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | Kingbase 测试/探测越权被拦截；非法连接参数可定位 |
| 5 | template blocks ACL/validate/probe 深化 | RPT-003 | `reports/templates/` | 5（hub **#7 84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 模板块越权与非法 block 被拦截；validate/get perf 可回归 |

**依赖链**：DASH-004 global_filters probe/ACL/validate 深化 → NFR-001 first-screen ACL/probe → NFR-002 report-perf ACL/probe → CONN-018 kingbase params/probe/HTTP 链 → RPT-003 templates ACL/probe → `test_dash_nfr_conn_rpt_r67.py` companion → r66 `test_cat_dash_rpt_meta_r66` 33/33 + r65 `test_cat_rpt_meta_r65` 32/32 + r64 `test_nfr_cat_r64` 33/33 + r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r59 `test_meta_cat_dash_conn_design_r59` 34/34 回归门控 196/196 → P5 五 ID 加权总分 **≥90**（破 STUCK round 1）。

**上轮已交付（本轮不重复 L1 骨架）**：

| PRD | r59–r64 已有 | 本轮不重复 |
|-----|-------------|-----------|
| DASH-004 | `global_filters/` validate/save/get + config_store + owner ACL + widget 存在性（r61 L1 6 测） | 不重写 config_store ref_type；不碰 fe 筛选器 UI |
| NFR-001 | `dashboard_first_screen` validate/probe mock + budget/widget 边界（r64 L1 6 测） | 不重写 elapsedMs=800 mock 语义；不建 `tests/perf/nfr01_dashboard/` |
| NFR-002 | `report_perf` validate/probe mock + budget/sampleRows 边界（r61 L1 6 测） | 不重写 elapsedMs=120 mock；不建真实 perf suite |
| CONN-018 | Kingbase PG 委托 + `map_kingbase_error` + HTTP draft test + 列截断（r59 L1 6 测） | 不重写 registry 登记；不补只读查询集成测 |
| RPT-003 | templates validate/put/get + sql/table/chart blocks（r62 L1 6 测） | 不重写内存 store 结构；不实现 PDF/Word 渲染 |

**STUCK 说明**：五 ID 各连续 1 轮（84.2）；本轮闭合 r59/r61/r62/r64 L1 后遗留 **性能 58%** 与 **完整度 76%**；目标加权总分 **≥90**。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §DASH/NFR/CONN/RPT；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `global_filters/service.py` | validate/save/get + owner/admin ACL；**无** probe；**无** enterprise scope；**无** dimensionRef/parameterKey 深化校验 |
| `dashboard_first_screen.py` | mock probe validate + simulateSlow；**无** 域内 probe 函数；**无** ACL；dashboardId 仅非空守卫 |
| `report_perf.py` | mock probe validate；**无** 域内 probe；**无** ACL；**无** sampleQueryId 格式守卫 |
| `kingbase/connector.py` | PG 委托 test_connection + map_kingbase_error；**无** 入参预校验；**无** probe；HTTP 层未对 kingbase 缺字段做 422 |
| `reports/templates/service.py` | 内存 store validate/upsert/get；**无** ACL；**无** probe；viewer 可 PUT |
| `reports/prefab/service.py`（参照） | r65：`set_user_prefab_scope` + viewer 写禁止 + `probe.py` |
| `entity_overview/probe.py`（参照） | r66：session 级双 probe ≤50ms |
| `reports/engine/acl.py`（参照） | r66：enterprise scope + viewer 403 |
| `test_cat_dash_viz_nfr_r61.py` | DASH-004/NFR-002 各 6 条 L1；**无** companion perf/ACL |
| `test_nfr_cat_r64.py` | NFR-001 6 条 L1 + 同进程 <50ms 单测；**无** ACL companion |
| `test_meta_cat_dash_conn_design_r59.py` | CONN-018 6 条 L1；**无** params/probe companion |
| `test_cat_nfr_rpt_meta_r62.py` | RPT-003 6 条 L1；**无** ACL/probe companion |

**范围框定模块**（5）：`dashboard/global_filters/` · `core/nfr/`（first-screen + report_perf）· `datasources/dialects/kingbase/` · `reports/templates/` + 薄 `api/v1` entry + pytest。

**范围框定文件列表**（19 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/dashboard/global_filters/probe.py` | DASH-004 | 新建：`probe_validate_linkage_budget_ms` + `probe_get_linkage_budget_ms` |
| `backend/app/dashboard/global_filters/service.py` | DASH-004 | 修改：enterprise scope、`dimensionRef`/`parameterKey` 校验、viewer PUT 403 |
| `backend/app/dashboard/global_filters/errors.py` | DASH-004 | 修改：`DASH_FILTER_INVALID_DIMENSION_REF`、`DASH_FILTER_DUPLICATE_PARAMETER_KEY` |
| `backend/app/core/nfr/dashboard_first_screen.py` | NFR-001 | 修改：ACL、`dashboardId` pattern、双 probe 函数 |
| `backend/app/core/nfr/errors.py` | NFR-001/002 | 修改：`DASHBOARD_FIRST_SCREEN_FORBIDDEN`、`REPORT_PERF_FORBIDDEN` 等常量 |
| `backend/app/core/nfr/report_perf.py` | NFR-002 | 修改：ACL、`sampleQueryId` 守卫、`simulateFailure` 降级、双 probe |
| `backend/app/datasources/dialects/kingbase/params.py` | CONN-018 | 新建：`validate_kingbase_connection_params` + 错误码上浮 |
| `backend/app/datasources/dialects/kingbase/probe.py` | CONN-018 | 新建：`probe_test_connection_budget_ms`（mock inner） |
| `backend/app/datasources/dialects/kingbase/connector.py` | CONN-018 | 修改：test_connection 前 params 校验 |
| `backend/app/datasources/dialects/errors.py` | CONN-018 | 修改：`KINGBASE_INVALID_PARAMS`、`KINGBASE_PORT_OUT_OF_RANGE` |
| `backend/app/reports/templates/probe.py` | RPT-003 | 新建：`probe_validate_template_budget_ms` + `probe_get_template_budget_ms` |
| `backend/app/reports/templates/acl.py` | RPT-003 | 新建：`assert_template_write_access` + `set_user_template_scope` |
| `backend/app/reports/templates/service.py` | RPT-003 | 修改：ACL 调用、duplicate block、chartType 枚举守卫 |
| `backend/app/reports/templates/errors.py` | RPT-003 | 修改：`RPT_TEMPLATE_FORBIDDEN`、`RPT_TEMPLATE_DUPLICATE_BLOCK` |
| `backend/app/api/v1/nfr.py` | NFR-001/002 | 修改：probe/validate 路由传入 `UserContext` 做 ACL |
| `backend/app/api/v1/reports/templates.py` | RPT-003 | 修改：upsert/get 传入 actor |
| `backend/app/api/v1/datasources.py` | CONN-018 | 修改：kingbase draft test 前 params 校验（经 service 或直连） |
| `tests/test_dash_nfr_conn_rpt_r67.py` | 全部 | 新建（≥32 条 companion 断言） |

**跨模块薄 entry 说明**：`nfr.py`/`templates.py`/`datasources.py` 仅 actor 透传与错误映射；业务逻辑留在五域框定内。`dashboards.py` 本轮可零行变更（service 深化经既有路由自动生效）。

**真理源优先级**：`round-target` > `prd.md` hub + `F07-DASH` / `F15-NFR` / `F04-CONN` / `F08-RPT` > `docs/services/` > `docs/api/README.md`。

**本轮性质**：r59/r61/r62/r64 L1 后 **companion 质量推分**；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin 全量页面、真实 SLA metrics、PDF 全链路、M7 地域权限 fe、只读查询集成测、NFR-003/NFR-004/GOV-007 等同分 STUCK 簇。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/dashboard/global_filters/
├── probe.py              # DASH-004：validate + get perf probe（budget 50ms）
├── service.py            # + enterprise scope、dimensionRef/parameterKey 校验
└── errors.py             # + INVALID_DIMENSION_REF / DUPLICATE_PARAMETER_KEY

backend/app/core/nfr/
├── dashboard_first_screen.py  # NFR-001：ACL + dashboardId pattern + 双 probe
├── report_perf.py             # NFR-002：ACL + sampleQueryId + simulateFailure + 双 probe
└── errors.py                  # + FORBIDDEN / INVALID_* 常量

backend/app/datasources/dialects/kingbase/
├── params.py             # CONN-018：连接参数预校验
├── probe.py              # CONN-018：mock test_connection probe ≤50ms
└── connector.py          # + params 校验入口

backend/app/reports/templates/
├── acl.py                # RPT-003：viewer 禁写 + enterprise scope
├── probe.py              # RPT-003：validate + get perf probe
├── service.py            # + ACL、duplicate block
└── errors.py             # + FORBIDDEN / DUPLICATE_BLOCK

backend/app/api/v1/
├── nfr.py                # first-screen/report-perf actor 透传
├── reports/templates.py  # upsert/get actor 透传
└── datasources.py        # kingbase params 422 链（薄）

tests/
└── test_dash_nfr_conn_rpt_r67.py   # T-*-R67-xxx
```

**共享 companion 契约**（五子项均满足）：

| 契约项 | L1 已有 | r67 增量 |
|--------|---------|----------|
| 结构化 `code` | 各域基础错误码 | 补 `DASH_FILTER_*` / `DASHBOARD_FIRST_SCREEN_FORBIDDEN` / `REPORT_PERF_FORBIDDEN` / `KINGBASE_INVALID_PARAMS` / `RPT_TEMPLATE_FORBIDDEN` |
| 性能 smoke | r61/r64 部分 HTTP/单测 <50ms | 各域 `probe_*_budget_ms` ≤ **50ms**（同进程 `time.perf_counter`，无真实网络/DB 外链） |
| ACL | DASH-004 owner ACL；templates 无 ACL | enterprise scope + viewer 写禁止 + NFR probe 403 |
| 错误体 | `{code, message, detail}` | 403/404/422 含 `detail.fields`（校验类） |
| 内存 store | templates 进程内 dict | scope 注册函数供测试夹具 |
| 回归 | r59–r66 套件 | 196/196 全量门控不删旧套件 |

### 3.2 DASH-004 — global_filter_linkage validate/ACL/probe

#### 3.2.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | `global_filters/probe.py` + service 内 `set_user_filter_dashboard_scope` + 校验链深化 | 对齐 entity_overview/prefab r65–r66 惯例 |
| B | 将 linkage 合并入 `dashboard/service.py` | 否决 — 与 r61 域边界漂移 |
| C | 仅 pytest 计时不改 service | 否决 — 8 维性能维提升不足 |

#### 3.2.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `viewer` PUT save | 403（在 owner 检查前） | `DASH_FILTER_FORBIDDEN` |
| `enterprise` 且 `dashboardId` 不在 scope 集合 | 403 GET/PUT | `DASH_FILTER_FORBIDDEN` |
| `dimensionRef` 不匹配 `^[a-z][a-z0-9_.]{0,127}$` | 422 | `DASH_FILTER_INVALID_DIMENSION_REF` |
| `linkageRules` 中重复 `parameterKey` | 422 | `DASH_FILTER_DUPLICATE_PARAMETER_KEY` |
| `sourceFilterId` 未知（已有） | 422 | `DASH_FILTER_UNKNOWN_SOURCE` |
| GET 未配置 linkage | 404 | `DASH_FILTER_NOT_FOUND` |

**Scope 注册**：`set_user_filter_dashboard_scope(user_id: str, allowed_dashboard_ids: set[uuid.UUID])`，默认测试夹具注册 admin 创建的首个 dashboard id。

#### 3.2.3 可测试验收标准（DASH-004）

- [ ] `probe_validate_linkage_budget_ms(session, item)` 耗时 **< 50ms**
- [ ] `probe_get_linkage_budget_ms(session, dashboard_id, actor)` 耗时 **< 50ms**（需 sqlite fixture 已 save）
- [ ] enterprise 越权 dashboardId GET → 403 `DASH_FILTER_FORBIDDEN`
- [ ] viewer PUT save → 403 `DASH_FILTER_FORBIDDEN`
- [ ] 非法 `dimensionRef` → 422 `DASH_FILTER_INVALID_DIMENSION_REF`
- [ ] 重复 `parameterKey` → 422 `DASH_FILTER_DUPLICATE_PARAMETER_KEY`
- [ ] r61 `T-DASH-R61-004-01~06` 回归全绿

### 3.3 NFR-001 — dashboard-first-screen ACL/probe

#### 3.3.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | 在 `dashboard_first_screen.py` 内增 ACL + probe 函数 + `nfr.py` 透传 actor | 与 r64 单文件锚点一致，省文件预算 |
| B | 新建 `dashboard_first_screen_acl.py` | 可行但多 1 文件；本轮 file 预算紧时否决 |
| C | HTTP 层仅 pytest 计时 | 否决 — 完整度不足 |

#### 3.3.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `enterprise` 且 `dashboardId` 不在 scope 前缀 | 403 probe/validate | `DASHBOARD_FIRST_SCREEN_FORBIDDEN` |
| `dashboardId` 含空格或非法字符 | 422 | `DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID`（新常量） |
| `budgetMs`/`widgetCount` 越界（已有） | 422 | 既有 `DASHBOARD_FIRST_SCREEN_*` |
| `simulateSlow`（已有） | 200 breach | 保持 r64 语义 |

**Scope 注册**：`set_user_first_screen_scope(user_id: str, dashboard_prefix: str)`，默认 `"dash-"`。

**Probe 函数**：

- `probe_validate_first_screen_budget_ms()` — 调用 `validate_dashboard_first_screen` 样例 payload
- `probe_first_screen_probe_budget_ms()` — 调用 `probe_dashboard_first_screen` 样例 payload

#### 3.3.3 可测试验收标准（NFR-001）

- [ ] 两 probe 函数各 **< 50ms**
- [ ] enterprise 越权 `dashboardId` → 403 `DASHBOARD_FIRST_SCREEN_FORBIDDEN`
- [ ] `dashboardId="bad id"` → 422 `DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID`
- [ ] r64 `T-NFR-R64-001-01~06` 回归全绿

### 3.4 NFR-002 — report-perf ACL/validate/probe

#### 3.4.1 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `enterprise` 且 `reportId` 不以 scope 前缀开头 | 403 | `REPORT_PERF_FORBIDDEN` |
| `sampleQueryId` 非空但不符合 `^[a-z][a-z0-9_-]{1,63}$` | 422 | `REPORT_PERF_INVALID_SAMPLE_QUERY`（新常量） |
| `simulateFailure: true`（新字段，可选） | 200 `samplePassed=false` | 降级链闭合 |
| `reportId` 空（已有） | 422 | `REPORT_PERF_REPORT_REQUIRED` |

**Scope 注册**：`set_user_report_perf_scope(user_id: str, report_prefix: str)`，默认 `"rpt-"`。

**Probe 函数**：

- `probe_validate_report_perf_budget_ms()`
- `probe_report_perf_probe_budget_ms()`

#### 3.4.2 可测试验收标准（NFR-002）

- [ ] 两 probe 函数各 **< 50ms**
- [ ] enterprise 越权 `reportId` → 403 `REPORT_PERF_FORBIDDEN`
- [ ] 非法 `sampleQueryId` → 422 `REPORT_PERF_INVALID_SAMPLE_QUERY`
- [ ] `simulateFailure=true` → `samplePassed=false`
- [ ] r61 `T-NFR-R61-002-01~06` 回归全绿

### 3.5 CONN-018 — kingbase 参数校验、HTTP 链与 probe

#### 3.5.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | `kingbase/params.py` + `probe.py` + connector 入口校验 | 对齐 gbase r51 companion 错误域模式 |
| B | 仅在 HTTP schema 层 Pydantic 校验 | 否决 — 连接器域完整度不足 |
| C | 真实 Kingbase 集成测 | 否决 — round-target 明确不含 |

#### 3.5.2 参数校验与错误域

| 规则 | 行为 | 错误码 |
|------|------|--------|
| 缺 `host`/`database`/`username` | 422（HTTP）或 `TestConnectionResult(ok=False)` | `KINGBASE_INVALID_PARAMS` |
| `port` 非 1–65535 | 422 | `KINGBASE_PORT_OUT_OF_RANGE` |
| psycopg 错误（已有） | mock 链 | `KINGBASE_AUTH_FAILED` 等 |
| HTTP 响应无 password（已有） | 回归 | r59 保持 |

**Probe**：`probe_test_connection_budget_ms(**kwargs)` — `patch` inner `open_connection` 为 no-op mock，测 `test_connection` 全流程 **< 50ms**。

**HTTP 链**：`datasources.test_connection_draft` 对 `type=kingbase` 在调 connector 前调用 `validate_kingbase_connection_params`；校验失败 → `DataSourceError` 映射 422 + `KINGBASE_INVALID_PARAMS`。

#### 3.5.3 可测试验收标准（CONN-018）

- [ ] `probe_test_connection_budget_ms()` **< 50ms**
- [ ] 缺 `host` HTTP draft → 422 `KINGBASE_INVALID_PARAMS`
- [ ] `port=0` → 422 `KINGBASE_PORT_OUT_OF_RANGE`
- [ ] mock auth 失败仍 `KINGBASE_AUTH_FAILED`（r59 回归）
- [ ] 响应无 password 泄露（r59 回归）
- [ ] r59 `T-CONN-R59-018-01~06` 回归全绿

### 3.6 RPT-003 — template blocks ACL/validate/probe

#### 3.6.1 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `viewer` PUT upsert | 403 | `RPT_TEMPLATE_FORBIDDEN` |
| `enterprise` 且 `templateKey` 不以 scope 前缀开头 | 403 PUT/GET | `RPT_TEMPLATE_FORBIDDEN` |
| 重复 block（同 `blockType`+`queryRef`/`tableRef`） | 422 | `RPT_TEMPLATE_DUPLICATE_BLOCK` |
| `chart` 块 `chartType` 非法字面量 | 422 | `RPT_TEMPLATE_INVALID_BLOCK`（已有） |
| GET 未知 key（已有） | 404 | `RPT_TEMPLATE_NOT_FOUND` |

**Scope 注册**：`set_user_template_scope(user_id: str, key_prefix: str)`，默认 `"tmpl-"`。

#### 3.6.2 可测试验收标准（RPT-003）

- [ ] `probe_validate_template_budget_ms()` **< 50ms**
- [ ] `probe_get_template_budget_ms(key)` **< 50ms**（需先 upsert）
- [ ] viewer PUT → 403 `RPT_TEMPLATE_FORBIDDEN`
- [ ] enterprise 越权 key GET → 403
- [ ] duplicate sql block → 422 `RPT_TEMPLATE_DUPLICATE_BLOCK`
- [ ] r62 `T-RPT-R62-003-01~06` 回归全绿

## 4. 测试策略

### 4.1 新测文件 `tests/test_dash_nfr_conn_rpt_r67.py`

| 区块 | 断言数（约） | 覆盖 |
|------|:-----------:|------|
| Fixture bootstrap | 2 | sqlite env + health |
| DASH-004 | 7 | probe×2、ACL×2、validate×2、回归指针 |
| NFR-001 | 6 | probe×2、ACL、invalid id、HTTP validate |
| NFR-002 | 6 | probe×2、ACL、sampleQueryId、simulateFailure |
| CONN-018 | 6 | probe、params×2、auth mock、no password |
| RPT-003 | 7 | probe×2、ACL×2、duplicate block、回归 |
| **合计** | **≥34** | 满足 round-target ≥32 |

**命名**：`T-DASH-R67-004-xxx` · `T-NFR-R67-001-xxx` · `T-NFR-R67-002-xxx` · `T-CONN-R67-018-xxx` · `T-RPT-R67-003-xxx`。

**Fixture**：复用 r61 风格 module-scoped sqlite（`cat_dash_viz_nfr_r61` 或独立 `dash_nfr_conn_rpt_r67` memory DB）；`enterprise_user` / `viewer_user` dependency override 与 r66 一致。

### 4.2 回归门控（P4 必跑）

| 套件 | 断言 |
|------|------|
| `test_dash_nfr_conn_rpt_r67.py` | ≥32/32 |
| `test_cat_dash_rpt_meta_r66.py` | 33/33 |
| `test_cat_rpt_meta_r65.py` | 32/32 |
| `test_nfr_cat_r64.py` | 33/33 |
| `test_cat_nfr_rpt_meta_r62.py` | 32/32 |
| `test_cat_dash_viz_nfr_r61.py` | 32/32 |
| `test_meta_cat_dash_conn_design_r59.py` | 34/34 |
| **合计** | **196/196** |

全量：`cd backend && python3 -m ruff check . && python3 -m pytest -q` exit_code **0**。

## 5. PRD 8 维薄弱项对齐

| PRD ID | 选题分 | 最薄弱维 | r67 设计闭合点 | P5 目标维 |
|--------|:------:|----------|----------------|-----------|
| DASH-004 | 84.2 | 性能 58%、完整度 76% | validate/get 双 probe、enterprise scope、dimensionRef/parameterKey | 性能→≥88%、完整度→≥90% |
| NFR-001 | 84.2 | 性能 58%、完整度 76% | ACL + dashboardId pattern + 双 probe | 同上 |
| NFR-002 | 84.2 | 性能 58%、完整度 76% | ACL + sampleQueryId + simulateFailure + 双 probe | 同上 |
| CONN-018 | 84.2 | 性能 58%、完整度 76% | params 预校验、HTTP 422 链、test_connection probe | 同上 |
| RPT-003 | 84.2 | 性能 58%、完整度 76% | ACL、duplicate block、validate/get probe | 同上 |

**P5 目标**：五 ID 加权总分 **≥90.0**（破 STUCK round 1）；测试覆盖维持 **≥98%**（新增 ≥32 断言 + 196 回归）。

## 6. 非目标（明确不做）

- Admin / `fe/` 全量页面、全局筛选器 UI、首屏 fe companion
- `tests/perf/nfr01_dashboard/`、`tests/perf/nfr01_report/` 真实 perf suite 与并发压测报告
- PDF/Word/Excel 真实渲染与模板设计器 fe
- Kingbase 只读查询集成测、UI 选型、生产 TLS 深化
- M7 地域 RLS、真实 SLA metrics 生产采集
- NFR-003 / NFR-004 / GOV-007 等同分 STUCK 簇（留 r68+）
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构

## 7. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| global_filters companion probe/ACL | `docs/services/dashboard.md`（或等效域附录） |
| NFR first-screen/report-perf ACL | `docs/services/core.md` 或 NFR 横切登记 |
| kingbase params/probe | `docs/services/datasources.md` |
| templates ACL/probe | `docs/services/reports.md` |
| 无新路由（行为深化） | `docs/api/README.md` 仅更新状态注记 |
| 验收勾选 | `docs/automate/prd/F07-DASH.md` · `F15-NFR.md` · `F04-CONN.md` · `F08-RPT.md` |

## 8. UI 设计交付

**`ui_design_skill`**: `none`（本轮纯后端，不触及 `fe/` 或 `*.tsx`）

本轮无前端门控；P2/P3/P4 Task 均标注 `UI skill: none`。

## 9. Self-review 清单

- [x] 覆盖 round-target 五子项，无 TBD/TODO
- [x] 文件列表 19 ≤ 20，未超出范围框定模块
- [x] 每项含可测试验收标准与 perf ≤50ms 契约
- [x] 回归门控 196/196 与 r67 ≥32 测明确
- [x] 非目标与 8 维对齐已列
- [x] 未写生产代码
