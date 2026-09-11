# 跨域 companion 质量推分 r66 设计 — CAT-001 / CAT-002 / DASH-005 / RPT-001 / META-004

```yaml
date: 2026-07-04
milestone: CAT/DASH/RPT/META
round_target: docs/superpowers/evolution/2026-07-04-round-target-r66.md
prd_ids: [CAT-001, CAT-002, DASH-005, RPT-001, META-004]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | lifecycle 模板 scope ACL + stage move/NOT_FOUND + perf | CAT-001 | `governance/catalog/cat01/` | 1（hub **并列最低 83.9**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 生命周期模板越权被拦截；阶段重排/未知 key 返回结构化错误；列表/校验可探测 |
| 2 | aggregate 模板变体 ACL/validate + perf | CAT-002 | `governance/catalog/cat02/` | 2（hub **并列最低 83.9**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 聚合模板 enterprise/viewer 边界可验收；list/validate perf 可回归 |
| 3 | entity overview validate/ACL/probe 深化 | DASH-005 | `dashboard/entity_overview/` | 3（hub **84.0**，完整度 **74%** 最低） | 性能 **58%→≥88%**；完整度 **74%→≥90%** | 实体总览非法 config 被拦截；validate/get 响应可探测 |
| 4 | reports engine run ACL/NOT_FOUND + perf | RPT-001 | `reports/engine/` | 4（hub **84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | 报表运行越权与非法参数被结构化拦截；run probe 可回归 |
| 5 | dataset validate+CRUD ACL/probe 深化 | META-004 | `metadata/dataset/` | 5（hub **84.2**） | 性能 **58%→≥88%**；完整度 **76%→≥90%** | Dataset 校验与 CRUD 越权被拦截；非法 schema/列名可定位 |

**依赖链**：CAT-001 cat01 ACL/probe/stage-move → CAT-002 cat02 ACL/probe/list → DASH-005 entity_overview probe/validate 深化 → RPT-001 engine acl/probe → META-004 dataset ACL/probe → `test_cat_dash_rpt_meta_r66.py` companion → r65 `test_cat_rpt_meta_r65` 32/32 + r64 `test_nfr_cat_r64` 33/33 + r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r59 `test_meta_cat_dash_conn_design_r59` 34/34 回归门控 163/163 → P5 五 ID 加权总分 **≥90**（破 STUCK round 1）。

**上轮已交付（本轮不重复 L1 骨架）**：

| PRD | r59–r64 已有 | 本轮不重复 |
|-----|-------------|-----------|
| CAT-001 | `cat01/` validate/create/list + `CAT01_*` 空 stages/重复 stage/key 冲突（r64 L1 6 测） | 不重写 stages/entityType 基础校验语义 |
| CAT-002 | `cat02/` validate/create/attribution + `CAT02_*` 空 dimensions/metrics（r64 L1 6 测） | 不重写 aggregationFn 三值集合 |
| DASH-005 | `entity_overview/` validate/save/get + viewer 403 + duplicate metric（r59 L1 6 测） | 不重写 config_store ref_type；不碰 theme-analysis |
| RPT-001 | `engine/run` format 守卫 + NOT_TEMPLATE/NOT_FOUND/incomplete（r60 L1 7 测含 HTTP probe） | 不重写 renderSpec 形状；不实现 PDF |
| META-004 | `dataset/` list/create/get/validate + tables/field 校验（r59 L1 7 测） | 不重写内存 store 结构；不增 Alembic |

**PRD 锚点注记**（round-target 模块描述「分类项」指 **CAT 域模板项**，非 `classification/` 树——后者为 CAT-004 r59/r65 已 companion）：

| PRD ID | hub 语义 | 代码锚点 |
|--------|---------|----------|
| CAT-001 | CAT-01 实体生命周期查询类 | `governance/catalog/cat01/` |
| CAT-002 | CAT-02 统计分析聚合类 | `governance/catalog/cat02/` |

**STUCK 说明**：五 ID 各连续 1 轮（83.9–84.2）；本轮闭合 r59/r60/r64 L1 后遗留 **性能 58%** 与 **完整度 74–76%**；目标加权总分 **≥90**。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §CAT/DASH/RPT/META；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `cat01/service.py` | 内存 store；validate/create/list；**无** `UserContext`、**无** GET by key、**无** probe；`CAT01_NOT_FOUND` 已定义未使用 |
| `cat02/service.py` | validate/create/get attribution；**无** list、**无** ACL、**无** probe；`CAT02_NOT_FOUND` 仅 attribution 路径 |
| `entity_overview/service.py` | validate/save/get + owner ACL；**无** probe；**无** `entityTypeRef` pattern/空 drill 非法 widget 深化 |
| `reports/engine/service.py` | `run_template` 无 actor ACL；r60 测 HTTP 层计时；**无** 域内 `probe.py`/`acl.py` |
| `reports/catalog/acl.py` | catalog CRUD ACL 已有；engine run **未**调用 |
| `metadata/dataset/service.py` | CRUD/validate；**无** 角色 ACL、**无** probe、**无** duplicate table name 守卫 |
| `metadata/physical/service.py`（参照） | r65：`META_PHYSICAL_FORBIDDEN` + `probe_*_budget_ms` 模式 |
| `cat03/cat06/classification`（参照） | r65：`set_user_*_scope` + enterprise prefix + viewer 写禁止 + `probe.py` |
| `api/v1/gov.py` | lifecycle/aggregate 路由 **未**透传 `UserContext` 至 create |
| `api/v1/datasets.py` | create **未**传入 actor |
| `api/v1/reports/engine.py` | run **未**做 engine ACL |
| `test_nfr_cat_r64.py` | CAT-001/002 各 6 条 L1；**无** perf/ACL companion |
| `test_meta_cat_dash_conn_design_r59.py` | DASH-005/META-004 L1；**无** companion probe/ACL |
| `test_rpt_view_cat_gov_r60.py` | RPT-001 7 条 L1；**无** run ACL |

**范围框定模块**（5）：`governance/catalog/cat01/` · `governance/catalog/cat02/` · `dashboard/entity_overview/` · `reports/engine/` · `metadata/dataset/` + 薄 `api/v1` entry + pytest。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/governance/catalog/cat01/probe.py` | CAT-001 | 新建：`probe_list_lifecycle_budget_ms` + `probe_validate_lifecycle_budget_ms` |
| `backend/app/governance/catalog/cat01/service.py` | CAT-001 | 修改：scope ACL、`get_lifecycle_template`、stage move、list 过滤 |
| `backend/app/governance/catalog/cat01/errors.py` | CAT-001 | 修改：`CAT01_FORBIDDEN`、`CAT01_STAGE_NOT_FOUND`、`CAT01_STAGE_INDEX_OUT_OF_BOUNDS` |
| `backend/app/governance/catalog/cat02/probe.py` | CAT-002 | 新建：`probe_validate_aggregate_budget_ms` + `probe_list_aggregate_budget_ms` |
| `backend/app/governance/catalog/cat02/service.py` | CAT-002 | 修改：scope ACL、`list_aggregate_templates`、validate 深化 |
| `backend/app/governance/catalog/cat02/errors.py` | CAT-002 | 修改：`CAT02_FORBIDDEN`、`CAT02_DUPLICATE_DIMENSION`、`CAT02_DUPLICATE_METRIC` |
| `backend/app/dashboard/entity_overview/probe.py` | DASH-005 | 新建：`probe_validate_overview_budget_ms` + `probe_get_overview_budget_ms` |
| `backend/app/dashboard/entity_overview/service.py` | DASH-005 | 修改：validate 链深化（entityTypeRef/drill widget） |
| `backend/app/dashboard/entity_overview/errors.py` | DASH-005 | 修改：`DASH_OVERVIEW_INVALID_ENTITY_TYPE`、`DASH_OVERVIEW_INVALID_DRILL_WIDGET` |
| `backend/app/reports/engine/acl.py` | RPT-001 | 新建：`assert_engine_run_access` + `set_user_engine_scope` |
| `backend/app/reports/engine/probe.py` | RPT-001 | 新建：`probe_run_template_budget_ms` |
| `backend/app/reports/engine/service.py` | RPT-001 | 修改：run 前 ACL；非法 parameters 键守卫 |
| `backend/app/reports/engine/errors.py` | RPT-001 | 修改：`RPT_ENGINE_FORBIDDEN`、`RPT_ENGINE_INVALID_PARAMETER` |
| `backend/app/metadata/dataset/service.py` | META-004 | 修改：write ACL、enterprise list 过滤、duplicate table、probe 函数 |
| `backend/app/metadata/dataset/errors.py` | META-004 | 修改：`META_DATASET_FORBIDDEN`、`META_DATASET_DUPLICATE_TABLE` |
| `backend/app/api/v1/gov.py` | CAT-001/002 | 修改：create/list/get/move 透传 `UserContext`；GET `lifecycle-templates/{key}` |
| `backend/app/api/v1/dashboards.py` | DASH-005 | 修改：（无新路由；validate/get 行为随 service 深化） |
| `backend/app/api/v1/reports/engine.py` | RPT-001 | 修改：run 传入 actor |
| `backend/app/api/v1/datasets.py` | META-004 | 修改：create/list 传入 actor |
| `tests/test_cat_dash_rpt_meta_r66.py` | 全部 | 新建（≥32 条 companion 断言） |

**跨模块薄 entry 说明**：`gov.py`/`datasets.py`/`engine.py` 仅参数透传与至多 2 条新路由（cat01 GET + stage move）；业务逻辑留在五域框定内。`dashboards.py` 本轮可零行变更（service 深化自动生效），不计入 P3 文件预算亦可。

**真理源优先级**：`round-target` > `prd.md` hub + `F14-CAT` / `F07-DASH` / `F08-RPT` / `F11-META` > `docs/services/` > `docs/api/README.md`。

**本轮性质**：r59/r60/r64 L1 后 **companion 质量推分**；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin 全量页面、真实 SLA metrics 生产采集、PDF 全链路渲染、M7 地域权限 fe、只读查询集成测、CONN-018 Kingbase 深化、DASH-004/NFR-001–004/RPT-003/GOV-007 等同分 STUCK 簇。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/governance/catalog/cat01/
├── probe.py              # CAT-001：list + validate perf probe（budget 50ms）
├── service.py            # + entity scope ACL、get、stage move、list 过滤
└── errors.py             # + CAT01_FORBIDDEN / STAGE_* 

backend/app/governance/catalog/cat02/
├── probe.py              # CAT-002：validate + list perf probe
├── service.py            # + aggregate scope ACL、list、duplicate dim/metric
└── errors.py             # + CAT02_FORBIDDEN / DUPLICATE_*

backend/app/dashboard/entity_overview/
├── probe.py              # DASH-005：validate + get perf probe（需 sqlite fixture）
├── service.py            # + entityTypeRef/drill 校验深化
└── errors.py             # + INVALID_ENTITY_TYPE / INVALID_DRILL_WIDGET

backend/app/reports/engine/
├── acl.py                # RPT-001：run 访问控制 + enterprise template scope
├── probe.py              # RPT-001：同进程 run probe
├── service.py            # + ACL 调用、parameters 键守卫
└── errors.py             # + RPT_ENGINE_FORBIDDEN / INVALID_PARAMETER

backend/app/metadata/dataset/
├── service.py            # META-004：ACL + probe（内联 physical 模式）
└── errors.py             # + FORBIDDEN / DUPLICATE_TABLE

backend/app/api/v1/
├── gov.py                # cat01/02 actor 透传 + GET/move 路由
├── datasets.py           # actor 透传
└── reports/engine.py     # actor 透传

tests/
└── test_cat_dash_rpt_meta_r66.py   # T-*-R66-xxx
```

**共享 companion 契约**（五子项均满足）：

| 契约项 | L1 已有 | r66 增量 |
|--------|---------|----------|
| 结构化 `code` | 各域基础错误码 | 补 `CAT01_FORBIDDEN` / `CAT02_FORBIDDEN` / `DASH_OVERVIEW_INVALID_*` / `RPT_ENGINE_FORBIDDEN` / `META_DATASET_FORBIDDEN` |
| 性能 smoke | r60 HTTP 层单测（RPT-001） | 各域 `probe_*_budget_ms` ≤ **50ms**（同进程 `time.perf_counter`，无真实网络/DB 外链） |
| ACL | DASH-005 owner ACL；catalog acl 未接 engine | enterprise scope + viewer 写禁止 + engine run 403 |
| 错误体 | `{code, message, detail}` | 403/404/422 含 `detail.fields`（校验类） |
| 内存 store | cat01/02/dataset 进程内 dict | 文档注明非 Alembic；scope 注册函数供测试夹具 |
| 回归 | r59–r65 套件 | 163/163 全量门控不删旧套件 |

### 3.2 CAT-001 — lifecycle 模板 scope ACL、stage move 与 perf

#### 3.2.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | `cat01/probe.py` + service 内 `set_user_entity_scope` + stage 索引 move | 对齐 cat03/cat06 r65 惯例；PRD 锚点 cat01 一致 |
| B | 将 cat01 合并入 `classification/` 树 | 否决 — 与 PRD CAT-001 锚点漂移；CAT-004 已占 classification |
| C | 仅 pytest 计时不改 service | 否决 — 8 维性能维提升不足 |

#### 3.2.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `viewer` 单独角色 POST create | 403 | `CAT01_FORBIDDEN` |
| `enterprise` 且 `entityTypeCode` 不以 scope 前缀开头 | 403 | `CAT01_FORBIDDEN` |
| `allowedRoles` 为空列表 | 422 | `CAT01_EMPTY_ROLES` |
| GET `lifecycle-templates/{templateKey}` 未知 key | 404 | `CAT01_NOT_FOUND` |
| POST `.../{key}/stages/move` 未知 key | 404 | `CAT01_NOT_FOUND` |
| move 未知 `stageName` | 404 | `CAT01_STAGE_NOT_FOUND` |
| move `toIndex` 越界 | 422 | `CAT01_STAGE_INDEX_OUT_OF_BOUNDS` |
| enterprise list | 仅返回 `entityTypeCode` 匹配 scope 前缀项 | 200 过滤列表 |

**Stage move 语义**（round-target「move」在 lifecycle 域落地为**有序阶段重排**，非 classification 树）：

- Payload：`{ "stageName": "active", "toIndex": 2 }`
- 在模板 `lifecycleStages` 数组内移动单项；不引入图环检测（阶段名为字符串标签，无父子边）

**Scope 注册**：`set_user_entity_scope(user_id: str, entity_prefix: str)`，默认前缀 `"ticket"`（与 r64 夹具 `_lifecycle_payload` 一致）。

#### 3.2.3 可测试验收标准（CAT-001）

- [ ] `probe_list_lifecycle_templates_budget_ms()` 耗时 **< 50ms**
- [ ] `probe_validate_lifecycle_budget_ms()` 耗时 **< 50ms**
- [ ] viewer POST create → 403 `CAT01_FORBIDDEN`
- [ ] enterprise 越权 `entityTypeCode` → 403 `CAT01_FORBIDDEN`
- [ ] GET 未知 templateKey → 404 `CAT01_NOT_FOUND`
- [ ] stage move 未知 stageName → 404 `CAT01_STAGE_NOT_FOUND`
- [ ] r64 `T-CAT-R64-001-01~06` 回归全绿

### 3.3 CAT-002 — aggregate 模板变体 ACL、validate 与 perf

#### 3.3.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | cat02 独立 scope + list + probe；与 CAT-001 并行 | 变体边界不重复 cat01 测例 |
| B | cat01/cat02 共享 `catalog/acl.py` | 否决 — 超文件预算且两域错误码不同 |
| C | 仅加深 attribution GET | 否决 — 缺 list probe，完整度不足 |

#### 3.3.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| viewer POST create | 403 | `CAT02_FORBIDDEN` |
| enterprise `aggregateKey` 不以 scope 前缀开头 | 403 | `CAT02_FORBIDDEN` |
| `dimensions` 含重复项 | 422 | `CAT02_DUPLICATE_DIMENSION` |
| `metrics` 含重复项 | 422 | `CAT02_DUPLICATE_METRIC` |
| GET list（新路由 `GET /catalog/aggregate-templates`） | 分页；enterprise 过滤 | 200 |
| GET attribution 未知 key | 404 | `CAT02_NOT_FOUND`（已有，加 companion 单测固化） |

**Scope 注册**：`set_user_aggregate_scope(user_id, key_prefix)`，默认 `"AGG"`。

**与 CAT-001 不重复**：CAT-002 测例聚焦 `aggregateKey`/`dimensions`/`metrics`/`attributionLabel`；CAT-001 聚焦 `lifecycleStages`/`entityTypeCode`/`stage move`。

#### 3.3.3 可测试验收标准（CAT-002）

- [ ] `probe_validate_aggregate_budget_ms()` **< 50ms**
- [ ] `probe_list_aggregate_budget_ms()` **< 50ms**
- [ ] viewer create → 403 `CAT02_FORBIDDEN`
- [ ] enterprise 越权 aggregateKey → 403 `CAT02_FORBIDDEN`
- [ ] duplicate dimensions → 422 `CAT02_DUPLICATE_DIMENSION`
- [ ] r64 `T-CAT-R64-002-01~06` 回归全绿

### 3.4 DASH-005 — entity overview validate/ACL/probe 深化

#### 3.4.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | `entity_overview/probe.py` + service validate 补字段守卫 | 对齐 theme/global_filters probe 模式 |
| B | 仅 HTTP TestClient 计时 | 否决 — 与 r60 同类，域内 probe 可复用 P5 评分 |
| C | 扩展 fe 实体总览页 | 否决 — 超 round-target 范围 |

#### 3.4.2 边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `entityTypeRef` 不匹配 `^[a-z][a-z0-9_]{1,63}$` | validate 422 | `DASH_OVERVIEW_INVALID_ENTITY_TYPE` |
| `drillTargets[].widgetId` 不在 dashboard layout widgets | validate 422 | `DASH_OVERVIEW_INVALID_DRILL_WIDGET` |
| GET 未 save 的 overview | 404 | `DASH_OVERVIEW_NOT_FOUND`（已有） |
| 非 owner viewer save/get | 403 | `DASH_OVERVIEW_FORBIDDEN`（已有，加 probe 夹具回归） |
| `probe_validate_overview_budget_ms(session, item)` | 同进程 **< 50ms** | 测内调用 |
| `probe_get_overview_budget_ms(session, dashboard_id, actor)` | 已 save 场景 **< 50ms** | 测内调用 |

**不改动**：`theme-analysis/*` 路由；`statCards` 非空与 duplicate metricKey（r59 已有）。

#### 3.4.3 可测试验收标准（DASH-005）

- [ ] 非法 `entityTypeRef` → 422 `DASH_OVERVIEW_INVALID_ENTITY_TYPE`
- [ ] drill widget 不存在于 layout → 422 `DASH_OVERVIEW_INVALID_DRILL_WIDGET`
- [ ] `probe_validate_overview_budget_ms` **< 50ms**
- [ ] save/get 后 `probe_get_overview_budget_ms` **< 50ms**
- [ ] viewer 非 owner save → 403 `DASH_OVERVIEW_FORBIDDEN`
- [ ] r59 `T-DASH-R59-005-01~06` 回归全绿

### 3.5 RPT-001 — reports engine run ACL、非法参数与 perf

#### 3.5.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | 新建 `engine/acl.py` + `probe.py`；run 前 `assert_engine_run_access` | 与 `catalog/acl.py` 解耦但可读 `register_node_owner` |
| B | 复用 `catalog/acl.assert_catalog_action(read)` | 不足 — run 需 template 归属 enterprise scope |
| C | 仅保留 r60 HTTP 计时 | 否决 — 缺结构化 403 闭合 |

#### 3.5.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `viewer` run 他人模板（catalog owner ≠ actor 且无 admin） | 403 | `RPT_ENGINE_FORBIDDEN` |
| `enterprise` run 模板 nodeId 不在 scope 登记集合 | 403 | `RPT_ENGINE_FORBIDDEN` |
| `parameters` 含非字符串键或保留键 `__proto__` | 422 | `RPT_ENGINE_INVALID_PARAMETER` |
| 未知 template id | 404 | `RPT_ENGINE_TEMPLATE_NOT_FOUND`（已有） |
| `probe_run_template_budget_ms(template_id, payload)` | **< 50ms** | 域内 probe |

**Scope 注册**：`set_user_engine_scope(user_id, allowed_template_ids: set[uuid.UUID])`；测试在 create template 后登记。

**与 catalog acl 关系**：create template 时继续 `register_node_owner`；engine acl 在 run 时叠加 enterprise 白名单（不修改 catalog/acl.py 行为）。

#### 3.5.3 可测试验收标准（RPT-001）

- [ ] viewer run 非自有模板 → 403 `RPT_ENGINE_FORBIDDEN`
- [ ] enterprise run scope 外模板 → 403 `RPT_ENGINE_FORBIDDEN`
- [ ] `parameters: {"__proto__": "x"}` → 422 `RPT_ENGINE_INVALID_PARAMETER`
- [ ] `probe_run_template_budget_ms` **< 50ms**
- [ ] 未知 template → 404 `RPT_ENGINE_TEMPLATE_NOT_FOUND`
- [ ] format=pdf → 422 `RPT_ENGINE_FORMAT_NOT_SUPPORTED`（回归）
- [ ] r60 `T-RPT-R60-001-01~07` 回归全绿

### 3.6 META-004 — dataset validate+CRUD ACL 与 perf

#### 3.6.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | service 内联 probe（镜像 `physical/service.py`）+ write ACL | 省独立 probe 文件，≤20 文件预算 |
| B | 新建 `dataset/probe.py` | 可行但挤占 docs 预算 |
| C | 接 QUERY Dataset 执行链 | 否决 — 超 companion 范围 |

#### 3.6.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| viewer POST create | 403 | `META_DATASET_FORBIDDEN` |
| enterprise `datasetId` 不以 scope 前缀开头 | 403 | `META_DATASET_FORBIDDEN` |
| `tables` 中 `name` 重复 | 422 | `META_DATASET_DUPLICATE_TABLE` |
| enterprise list | 过滤 `datasetId` 前缀 | 200 |
| `probe_validate_dataset_budget_ms()` | **< 50ms** | 内联 |
| `probe_list_datasets_budget_ms()` | **< 50ms** | 内联 |

**Scope 注册**：`set_user_dataset_scope(user_id, id_prefix)`，默认 `"ds-"`。

#### 3.6.3 可测试验收标准（META-004）

- [ ] viewer create → 403 `META_DATASET_FORBIDDEN`
- [ ] enterprise 越权 datasetId → 403 `META_DATASET_FORBIDDEN`
- [ ] duplicate table name → 422 `META_DATASET_DUPLICATE_TABLE`
- [ ] `probe_validate_dataset_budget_ms` **< 50ms**
- [ ] `probe_list_datasets_budget_ms` **< 50ms**
- [ ] r59 `T-META-R59-004-01~09` 回归全绿

## 4. 测试策略（`test_cat_dash_rpt_meta_r66.py`）

| 区块 | 条数 | 夹具 |
|------|:----:|------|
| bootstrap + sqlite env | 1 | 镜像 r65 `cat_rpt_meta_r66` 内存库 |
| CAT-001 companion | 7 | enterprise/viewer override；`set_user_entity_scope` |
| CAT-002 companion | 6 | `set_user_aggregate_scope` |
| DASH-005 companion | 6 | 创建 dashboard + layout widget；save 后 probe get |
| RPT-001 companion | 7 | catalog template + `set_user_engine_scope` |
| META-004 companion | 6 | `set_user_dataset_scope` |
| **合计** | **≥33** | 满足 round-target ≥32 |

**命名**：`T-CAT-R66-001-xx` · `T-CAT-R66-002-xx` · `T-DASH-R66-005-xx` · `T-RPT-R66-001-xx` · `T-META-R66-004-xx`。

**回归门控**（P4 必跑）：

```bash
cd backend && python3 -m pytest -q \
  tests/test_cat_dash_rpt_meta_r66.py \
  tests/test_cat_rpt_meta_r65.py \
  tests/test_nfr_cat_r64.py \
  tests/test_cat_nfr_rpt_meta_r62.py \
  tests/test_cat_dash_viz_nfr_r61.py \
  tests/test_meta_cat_dash_conn_design_r59.py
```

期望：**r66 ≥32/32** + 回归 **163/163**；全量 pytest exit_code 0。

## 5. PRD 8 维薄弱项对齐

| PRD ID | 选题分 | 薄弱维（选题时） | r66 闭合动作 | 预期提分维 |
|--------|:------:|------------------|-------------|-----------|
| CAT-001 | 83.9 | 性能 58%、完整度 76% | entity scope ACL、GET/move NOT_FOUND、双 probe | 性能→≥88%、完整度→≥90%、安全→≥90% |
| CAT-002 | 83.9 | 性能 58%、完整度 76% | aggregate scope ACL、list、duplicate dim/metric、双 probe | 同上 |
| DASH-005 | 84.0 | 性能 58%、完整度 74% | entityTypeRef/drill 校验、validate/get probe | 完整度→≥90%、性能→≥88% |
| RPT-001 | 84.2 | 性能 58%、完整度 76% | engine acl、parameter 守卫、域内 probe | 性能→≥88%、完整度→≥90%、安全→≥88% |
| META-004 | 84.2 | 性能 58%、完整度 76% | dataset ACL、duplicate table、双 probe | 性能→≥88%、完整度→≥90%、安全→≥90% |

**P5 目标**：五 ID 加权总分 **≥90.0**（破 STUCK round 1）；测试覆盖维持 **≥98%**（新增 ≥32 断言 + 163 回归）。

## 6. 非目标（明确不做）

- Admin / `fe/` 全量页面与截图 QA
- IF-02 实体查询链、`GET /stats/aggregate` 真实聚合
- PDF/Word 报表渲染与 M3-LITE 数据源执行
- Dataset Alembic 持久化、指标计算引擎
- M7 地域 RLS、CONN-018 Kingbase 深化
- NFR-001–004 / DASH-004 / RPT-003 / GOV-007 等同分 STUCK 簇
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构

## 7. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| cat01/02 companion ACL/probe | `docs/services/governance.md` |
| entity_overview probe/validate | `docs/services/dashboard.md`（或等效域附录） |
| engine acl/probe | `docs/services/reports.md` |
| dataset ACL/probe | `docs/services/metadata.md` |
| 新路由（cat01 GET、aggregate list、stage move） | `docs/api/README.md` 各一行 |
| 验收勾选 | `docs/automate/prd/F14-CAT.md` · `F07-DASH.md` · `F08-RPT.md` · `F11-META.md` |

## 8. UI 设计交付

**`ui_design_skill`**: `none`（本轮纯后端，不触及 `fe/` 或 `*.tsx`）

本轮无前端门控；P2/P3/P4 Task 均标注 `UI skill: none`。

## 9. Self-review 清单

- [x] 覆盖 round-target 五子项，无 TBD/TODO
- [x] 文件列表 18 ≤ 20，未超出范围框定模块
- [x] CAT-001/002 锚定 `cat01`/`cat02`（非 classification），与 PRD 一致并注记 round-target 措辞
- [x] 每项含可测试验收标准与 perf ≤50ms 契约
- [x] 回归门控 163/163 与 r66 ≥32 测明确
- [x] 非目标与 8 维对齐已列
- [x] 未写生产代码
