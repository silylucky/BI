# M-FINAL F-E 治理收官 + F-F NFR companion 首批（批次 4）设计

```yaml
date: 2026-07-07
milestone: M-FINAL · F-E 收官 + F-F 首批
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fe-gov-batch4.md
prd_ids: [GOV-007, GOV-008, NFR-003, NFR-005, NFR-007]
ui_design_skill: none
status: design
base_branch: dev-auto
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:----:|------------|----------|
| 1 | 总线全自动注册收官 | GOV-007 | `governance/bus/` + `integration/` + `governance/publish/` | 1 | 用户价值 **88%**；完整度 **92%** | 查询服务发布成功后自动向数据交换总线注册；失败可重试、可降级、留审计 |
| 2 | 治理权限联动收官 | GOV-008 | `governance/acl*.py` | 2 | 用户价值 **86%**；完整度 **90%** | 工单/发布/总线操作受角色×资源×工作流矩阵约束；越权结构化拒绝 |
| 3 | 核心看板可用性探针 | NFR-003 | `core/nfr/dashboard_availability.py` | 3 | 用户价值 **86%**；性能 **88%** | 运维/CI 一键验证核心 Dashboard 可用且首屏 P95 在阈值内 |
| 4 | 连接器插件扩展性演练 | NFR-005 | `core/nfr/plugin_extension.py` | 4 | 用户价值 **86%**；架构健康 **90%** | 新增连接器类型演练通过连通性与只读查询链，核心框架无侵入 |
| 5 | 信创国产化部署报告 | NFR-007 | `core/nfr/xinchuang.py` | 5 | 用户价值 **88%**；完整度 **94%** | 政企交付可获得结构化信创合规探测报告（JSON/Markdown） |

**依赖链**：GOV-007 IF-01 适配 + 失败降级 → GOV-008 矩阵守卫补洞 → NFR-003 核心看板批量 smoke → NFR-005 drill 连通/只读链 → NFR-007 报告格式与 F-C 方言对账 → `test_mfinal_fe_gov_batch4_r248.py` P4-SMOKE 尾段 → docs 同步 → plan F-E 二项 + F-F 三项可勾选。

**上轮已交付（r247 批次 3，本轮不重复 L1 骨架）**：

- `bus/pipeline.py`：`trigger_auto_bus_register` + retry + audit `traceId`
- `acl_matrix.py` + `acl.py`：9 行矩阵 + publish/workflow/bus `assert_*`
- `dashboard_availability.py`：复合 SLA + 首屏 P95 报告 + strict 503
- `plugin_extension.py`：`run_extension_drill` 注册 `drill_stub` + `zeroInvasion`
- `xinchuang.py`：`build_xinchuang_deployment_report` + compose 解析
- `tests/test_mfinal_fe_gov_batch3_r247.py`：35 条 T-GOV/NFR-R247-*

**本轮性质**：F-E/F-F **批次 4 companion 验收缺口补全**（非真实总线 HTTP、非生产 metrics、非第三方插件仓库）。聚焦 plan 可勾选与 P4-SMOKE 尾段「发布→总线注册」可执行。

## 2. 范围框定

### 2.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| governance | `backend/app/governance/` | 总线全自动注册失败降级、发布联动结构化输出、ACL 矩阵守卫补洞 |
| nfr | `backend/app/core/nfr/` | 看板可用性批量 smoke、插件 drill 连通/只读链、信创报告 Markdown 导出 |
| integration | `backend/app/integration/` | IF-01 总线适配器工厂，供 pipeline 与 integration API 共用 |

> **路径说明**：round-target 写作 `gov/`、`nfr/` 为 PRD 简称；实现真理源为 `governance/`、`core/nfr/`（与 r247 一致）。

### 2.2 文件列表（16）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/integration/bus_adapter_factory.py` | 007 | **新建** `get_bus_adapter()`：统一 `InMemoryBusAdapter` + `RetryingBusAdapter` 构造（IF-01 适配层入口） |
| `backend/app/integration/bus_register.py` | 007 | 改用 `bus_adapter_factory`；导出 `register_with_if01_adapter` |
| `backend/app/governance/bus/degradation.py` | 007 | **新建** `BusRegisterOutcome`；`record_deferred_registration()` 审计 + FSM `deferred` 态 |
| `backend/app/governance/bus/pipeline.py` | 007 | 使用 IF-01 工厂；失败时写 `deferred` 而非仅 `failed`（publish 源）；retry 仍走 `failed` |
| `backend/app/governance/publish/service.py` | 007 | `approve_entry` / `publish_from_workflow` 返回 `busRegisterStatus`；不再裸 `except: pass` |
| `backend/app/governance/publish/schemas.py` | 007 | `PublishActionOut` 增可选 `busRegisterStatus` / `busRegisterErrorCode` |
| `backend/app/governance/acl.py` | 008 | `assert_workflow_transition` 对齐矩阵全 action；`assert_publish_action` 增 self-approve 守卫 |
| `backend/app/core/nfr/dashboard_availability.py` | 003 | `CORE_DASHBOARD_IDS` 常量；`probe_core_dashboards_smoke()` 批量探针 |
| `backend/app/core/nfr/plugin_extension.py` | 005 | drill 增 `connectivityOk` / `readonlyQueryOk`；`assert_core_module_unchanged()` 契约守卫 |
| `backend/app/core/nfr/xinchuang.py` | 007 | `render_deployment_report_markdown()`；`EXPECTED_XINCHUANG_TYPES` 与 F-C CONN-017~022 对账 |
| `backend/app/api/v1/gov.py` | 007、008 | publish 响应透传 `busRegisterStatus`；无新路由 |
| `backend/app/api/v1/nfr.py` | 003、005、007 | `GET .../dashboard-availability/smoke`；drill 响应增字段；`deployment-report?format=markdown` |
| `tests/test_mfinal_fe_gov_batch4_r248.py` | 全部 | **新建** ≥28 条 + P4-SMOKE 尾段单测 |
| `docs/api/README.md` | 全部 | 新路由/查询参数登记 |
| `docs/services/governance.md` | 007、008 | 失败降级、IF-01 工厂、ACL 补洞锚点 |
| `docs/nfr/dashboard-availability.md` · `docs/nfr/xinchuang-deployment.md` | 003、007 | 批量 smoke、Markdown 格式、F-C 方言表 |

**真理源优先级**：`round-target` > `prd.md` hub + `F10-GOV.md`/`F15-NFR.md` > `docs/services/governance.md` > `docs/api/README.md`。

### 2.3 非目标（明确不做）

- 真实总线 HTTP 端点对接、生产级熔断与 circuit breaker（GOV-007 PRD 远期项）
- 发布后 RLS 端到端真实 org 全链路（GOV-008 PRD 远期项）
- 生产 metrics store、PagerDuty/ops 告警联动（NFR-003 远期项）
- 第三方插件样例 PR 与独立扩展仓库（NFR-005 远期项）
- 全量信创认证与生产部署签收（NFR-007 远期项）
- NFR-008 零 DE/SS 部署报告（F-F 批次 2 独立轮次）
- Admin 全量 FE 新页、F-G CONN-023~027
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构（P5 仅勾选五行）

## 3. 架构设计

### 3.1 GOV-007 — 总线全自动注册收官

#### 方案比选

| 方案 | IF-01 统一 | 失败降级 | P4-SMOKE | 结论 |
|------|-----------|---------|----------|------|
| A IF-01 工厂 + `deferred` FSM + publish 结构化 outcome + 集成测尾段 | 是 | 发布成功、总线 deferred | 单文件链式测 | **采用** |
| B 保持 pipeline 内联 adapter，仅加测 | 否 | 无 | 弱 | 否决 |
| C 真实 HTTP bus mock server | 过重 | — | — | 远期 |

#### IF-01 适配层统一

**`integration/bus_adapter_factory.py`**：

```text
get_bus_adapter(*, max_attempts: int = 3) -> BusAdapter
  - 返回 RetryingBusAdapter(InMemoryBusAdapter(), max_attempts)
  - pipeline 与 bus_register.register_catalog_to_bus 共用，消除双份 RetryingBusAdapter
```

#### 失败降级语义

| 触发源 | 总线结果 | 发布状态 | FSM | 审计 action | HTTP |
|--------|---------|---------|-----|-------------|------|
| `approve` / `publish_from_workflow` | 成功 | `published` | `succeeded` | `bus_auto_register_succeeded` | 200 + `busRegisterStatus=succeeded` |
| `approve` 总线瞬时失败（可重试耗尽） | 失败 | `published`（不 rollback） | `deferred` | `bus_auto_register_deferred` | 200 + `busRegisterStatus=deferred` + `busRegisterErrorCode` |
| `POST /bus/auto-register` 手动 | 失败 | 不变 | `failed` | `bus_auto_register_failed` | 502/409 |
| `POST .../retry` | 成功 | 不变 | `succeeded` | `bus_auto_register_succeeded` | 200/201 |

**`governance/bus/degradation.py`**：

- `BusRegisterOutcome(status: Literal["succeeded","deferred","failed"], error_code: str | None, bus_id: str | None)`
- `record_deferred_registration(db, actor, entry_id, trace_id, error_code)` → FSM `deferred` + audit
- publish 源调用 `trigger_auto_bus_register` 时捕获 `CatalogError`，映射为 `deferred` 而非抛出让 approve 失败

#### 可测试验收标准

1. `approve_entry` 成功 + path 正常 → `busRegisterStatus=succeeded`，FSM `registered`/`succeeded`
2. path 含 `force-timeout` 且重试耗尽 → approve 仍 200、`status=published`、`busRegisterStatus=deferred`、`busRegisterErrorCode=BUS_REGISTER_RETRY_EXHAUSTED`
3. deferred 态 `POST /bus/auto-register/retry` → `succeeded` 或 502 exhausted
4. 二次 `POST /bus/auto-register` 幂等 200 `autoRegistered=false`（回归 r247）
5. audit 含 `bus_auto_register_deferred` 且 `traceId` 非空
6. `GET /bus/auto-register/probe` ≤50ms（回归）
7. **P4-SMOKE 尾段**：`submit-workflow` → `pending_publish` transition → `POST /publish/from-workflow` → FSM `registered` 或 `deferred` 可 retry

### 3.2 GOV-008 — 治理权限联动收官

#### 方案比选

| 方案 | 矩阵覆盖 | 水平越权 | 垂直越权 | 结论 |
|------|---------|---------|---------|------|
| A 矩阵驱动的 `assert_*` 补洞 + 新测 | 全 9 action | publisher 无 grant | viewer→integration | **采用** |
| B 仅文档勾选无代码 | — | — | — | 否决 |
| C 新 RBAC 表 | 过重 | — | — | 远期 |

#### 守卫补洞

**`acl.py` 增量**：

- `assert_workflow_transition`：增 `publish` action → 要求 `publisher`/`admin`（与 workflow FSM 终态对齐）
- `assert_publish_action` approve：同一 `actor.id` 为 entry `owner_id` 且无 admin → 403 `GOV_ACL_SELF_APPROVE_FORBIDDEN`（水平越权）
- `assert_bus_register`：保持 integration/admin；enterprise scope path 仍由 `bus/auto.py` 处理（回归）

**矩阵一致性**：`describe_gov_permission_matrix()` 行数 ≥9；每项 `action` 与 `acl.py` role_map 一一对应（单测断言）。

#### 可测试验收标准

1. viewer `POST publish/.../approve` → 403 `GOV_ACL_FORBIDDEN`（回归）
2. publisher 无 `gov_catalog_entry` grant → 403 `GOV_RESOURCE_FORBIDDEN`（回归）
3. publisher 有 grant → 200 approve（回归）
4. approver `POST /bus/auto-register` → 403（回归）
5. **新增** owner publisher 自批无 admin → 403 `GOV_ACL_SELF_APPROVE_FORBIDDEN`
6. **新增** requester 对 `approve` transition → 403 `GOV_WORKFLOW_FORBIDDEN`
7. `GET /gov/acl/matrix` 含 `bus_auto_register_retry` 且 `resourceGrantRequired` 对 publish_approve 为 true

### 3.3 NFR-003 — 核心看板可用性

#### 方案比选

| 方案 | 批量 smoke | P95 断言 | CI | 结论 |
|------|-----------|---------|-----|------|
| A `CORE_DASHBOARD_IDS` + `/smoke` 端点 + pytest P95 | 是 | ≤5000ms 硬断言 | pytest marker | **采用** |
| B 仅文档更新 | 否 | — | — | 否决 |

#### 增量

**`dashboard_availability.py`**：

```text
CORE_DASHBOARD_IDS = ("core-dash", "executive-overview")
probe_core_dashboards_smoke(actor) -> list[DashboardAvailabilityReport]
  - 遍历 CORE_DASHBOARD_IDS 调用 build_dashboard_availability_report
  - 全部 within_sla and within_first_screen_budget → ok=True
```

**`GET /api/v1/nfr/dashboard-availability/smoke`**：

- 响应 `{ "dashboards": [...], "allAvailable": bool, "p95ThresholdMs": 5000 }`
- `DASHBOARD_AVAILABILITY_MODE=strict` 且任一 unavailable → 503 `DASHBOARD_AVAILABILITY_BREACH`

#### 可测试验收标准

1. `GET .../report?dashboardId=core-dash` → `overallStatus=available`（回归）
2. `simulateBreach=true` permissive → `withinSla=false`（回归）
3. strict + breach → 503（回归）
4. **新增** `GET .../smoke` → `allAvailable=true`，每项 `firstScreenP95Ms ≤ 5000`
5. **新增** `simulateBreach` 在 smoke 端点 → `allAvailable=false`
6. `probe_dashboard_availability_budget_ms` ≤50ms（回归）
7. pytest marker `@pytest.mark.nfr_dashboard_smoke` 可单独 CI 执行

### 3.4 NFR-005 — 连接器插件扩展性

#### 方案比选

| 方案 | 连通性 | 只读查询 | 核心零侵入证明 | 结论 |
|------|--------|---------|---------------|------|
| A drill 内 `test_connection` + mock readonly + 源文件契约列表 | 是 | 是 | 白名单文件 | **采用** |
| B 仅 registry 注册 | 弱 | 否 | 弱 | r247 已有 |
| C git diff 快照 | 脆弱 | — | — | 否决 |

#### 增量

**`plugin_extension.py`**：

```text
ExtensionDrillResult 增字段: connectivity_ok: bool, readonly_query_ok: bool
run_extension_drill():
  - register drill_stub
  - stub.test_connection() → connectivity_ok
  - stub 实现 probe_readonly_sql() 返回 ("SELECT 1", True) → readonly_query_ok
assert_core_module_unchanged() -> bool
  - 断言 inspect.getsource(registry.register) 不含 "drill_stub"
  - 白名单：仅 plugin_extension.py 与 datasources/dialects/ 可引用 drill_stub
```

**`GET /api/v1/nfr/plugin-extension/drill`** 响应增 `connectivityOk`、`readonlyQueryOk`。

#### 可测试验收标准

1. drill → `registered=true`, `zeroInvasion=true`（回归）
2. **新增** `connectivityOk=true`, `readonlyQueryOk=true`
3. `probe_registry` <50ms（回归）
4. teardown 后 registry 无 `drill_stub`（回归）
5. **新增** `assert_core_module_unchanged()` 单测为 true
6. `describe_registration_path("gbase")` steps ≥1（回归 xinchuang_smoke）

### 3.5 NFR-007 — 信创国产化部署报告

#### 方案比选

| 方案 | JSON schema | Markdown | F-C 对账 | 结论 |
|------|------------|----------|---------|------|
| A schemaVersion + `format=markdown` + EXPECTED_TYPES | 是 | 是 | CONN-017~022 | **采用** |
| B 仅 JSON 补字段 | 部分 | 否 | 弱 | 否决 |

#### 增量

**`xinchuang.py`**：

```text
EXPECTED_XINCHUANG_TYPES = ("dm", "kingbase", "gbase", "oceanbase", "tidb", "gaussdb")
build_xinchuang_deployment_report() 增:
  - schema_version: "1.0"
  - generated_at: ISO8601
  - missing_expected_types: sorted(set(EXPECTED) - set(registered))
render_deployment_report_markdown(report) -> str  # 表格：组件/连接器/compose/smoke
```

**`GET /api/v1/nfr/xinchuang/deployment-report?format=markdown`**：

- `format=json`（默认）或 `markdown`
- markdown 返回 `text/markdown` body
- strict 且无信创连接器仍 422（回归）

#### 可测试验收标准

1. JSON 含 `schemaVersion`, `generatedAt`, `registeredXinchuangConnectors` 含 `gbase`（回归）
2. compose 含 `postgres`（回归）
3. strict 空 registry → 422 `XINCHUANG_NON_COMPLIANT`（回归）
4. dialect smoke 全 ok（回归）
5. **新增** `missingExpectedTypes` 在缺 oceanbase/tidb 时非空（permissive）
6. **新增** `format=markdown` → `Content-Type: text/markdown`，含 `## 信创部署验收报告` 标题
7. `probe_deployment_report_budget_ms` <100ms（回归）

## 4. 集成测试 — `test_mfinal_fe_gov_batch4_r248.py`

### 4.1 Fixture 策略

- 复用 r247 模式：`sqlite+pysqlite` 内存库、`jwt_auth_headers`、role fixtures（viewer/integration/publisher/enterprise）
- `autouse`：`DASHBOARD_AVAILABILITY_MODE=permissive`、`XINCHUANG_DEPLOY_MODE=permissive`
- 模块结束清理：`bus_auto._auto_states`、drill teardown、dependency overrides

### 4.2 用例分布（≥28）

| 前缀 | 数量 | 覆盖 |
|------|------|------|
| `test_gov_r248_007_*` | 9 | IF-01 工厂、deferred 降级、retry、幂等、audit、probe、P4-SMOKE 尾段 |
| `test_gov_r248_008_*` | 6 | 矩阵、self-approve、workflow 越权、grant、enterprise bus |
| `test_nfr_r248_003_*` | 5 | smoke 端点、P95、strict、enterprise scope、probe budget |
| `test_nfr_r248_005_*` | 4 | connectivity、readonly、zero_invasion、teardown |
| `test_nfr_r248_007_*` | 4 | markdown、missing types、schema、budget |

### 4.3 P4-SMOKE 尾段单测（GOV-007-09）

```text
test_gov_r248_007_09_p4_smoke_publish_to_bus_tail:
  1. PUT designer conditions/rules/output (refId=REF_ID)
  2. POST /designer/submit-workflow
  3. transition submit + approve + complete_design → pending_publish
  4. POST /gov/publish/from-workflow
  5. assert catalogEntryId 非空、entry status=published
  6. GET /gov/bus/register/fsm?catalogEntryId= → fsmState in (registered, succeeded, deferred)
  7. if deferred → POST /bus/auto-register/retry → succeeded or 502 exhausted
```

不覆盖 F-D Dataset 建表段（属 P4-SMOKE 前半，已由 QUERY/META 轮次交付）；本测仅验收 round-target 指定的**尾段**。

### 4.4 回归门控

- 新套件 28/28 绿
- `tests/test_mfinal_fe_gov_batch3_r247.py` 全量回归绿（无行为破坏）
- `cd backend && ruff check .`
- `pytest /workspace/tests -q` 全量绿

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本设计推分动作 | 可观测信号 |
|--------|-----------------|---------------|-----------|
| GOV-007 | 用户价值 88%、完整度 92% | IF-01 统一 + deferred 降级 + P4-SMOKE 尾段 | publish 200 且 `busRegisterStatus` 可判定；尾段 pytest 绿 |
| GOV-008 | 用户价值 86%、完整度 90% | self-approve 守卫 + workflow publish 角色 + 矩阵单测 | 水平/垂直越权 403 结构化码 |
| NFR-003 | 用户价值 86%、性能 88% | `/smoke` 批量 + P95≤5000 硬断言 | CI marker `nfr_dashboard_smoke` 绿 |
| NFR-005 | 用户价值 86%、架构 90% | 连通/只读链 + `assert_core_module_unchanged` | drill 响应四布尔全 true |
| NFR-007 | 用户价值 88%、完整度 94% | Markdown 导出 + F-C 六型对账 | `missingExpectedTypes` + markdown 体 |

## 6. 文档同步（P3 执行，P1 仅列清单）

| 变更 | 文档 |
|------|------|
| `GET /nfr/dashboard-availability/smoke` | `docs/api/README.md` |
| `deployment-report?format=markdown` | `docs/api/README.md` |
| publish `busRegisterStatus` 字段 | `docs/api/README.md` §gov publish |
| 失败降级 FSM `deferred`、IF-01 工厂 | `docs/services/governance.md` |
| 批量 smoke、P95 阈值 | `docs/nfr/dashboard-availability.md` |
| Markdown 报告、EXPECTED_TYPES | `docs/nfr/xinchuang-deployment.md` |
| GOV-007~008、NFR-003/005/007 状态 → 已实现（companion r248） | `prd/F10-GOV.md`、`prd/F15-NFR.md`（P5） |
| plan F-E 二行 + F-F 三行 `[x]` | `docs/automate/plan.md`（P5） |

## 7. UI 设计交付

```yaml
ui_design_skill: none
```

本轮范围不含 `fe/` 文件变更（round-target 明确「不含 Admin 全量 FE 新页」）。NFR 探针与治理验收均为后端 API + pytest/CI 可执行面；无新增页面、组件或 Token 变更。

**视觉 QA**：不适用（`last_ui_verified_command: N/A`）。

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| deferred FSM 与 r247 `failed` 语义冲突 | 仅 publish 源写 `deferred`；手动 auto-register 仍 `failed`；r247 测回归 |
| drill_stub 污染生产 registry | 仅 pytest/DRILL_MODE；teardown + autouse fixture |
| Markdown 端点 Content-Type 与 JSON 客户端 | 默认 `format=json`；markdown 显式 query |
| 16 文件上限 | 无新域模块；`degradation.py` 与 `bus_adapter_factory.py` 各 <80 行 |

## 9. Spec Self-Review

- [x] 覆盖 round-target 五子项全部验收标准
- [x] 文件列表 16 ≤ 16，模块 3 ≤ 3
- [x] 无 TBD/TODO 占位
- [x] 非目标与 PRD 远期项边界清晰
- [x] ui_design_skill: none 已记录
- [x] 未超出范围框定（无 FE、无真实 bus HTTP、无 NFR-008）
