# M6 一期集成验收收官设计 — GOV-002 / CAT-001~003 / NFR-004

```yaml
date: 2026-07-06
milestone: M6
round_target: docs/superpowers/evolution/2026-07-06-round-target-m6-integration.md
base_branch: dev-auto
prd_ids: [GOV-002, CAT-001, CAT-002, CAT-003, NFR-004]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | 总线半自动注册 PoC FSM + scope/probe | GOV-002 | 1 | 用户价值 **82%**；性能 **86%** | 半自动登记路径可查询 `pending/registered/failed`；越权 403；probe ≤50ms |
| 2 | CAT-01 生命周期类 catalog 集成 probe | CAT-001 | 2 | 用户价值 **84%**；完整度 **90%** | 可探测附录 E CAT-01 模板枚举；scope ACL 生效；边界输入结构化拒绝 |
| 3 | CAT-02 聚合统计类 catalog 集成 probe | CAT-002 | 3 | 用户价值 **84%**；完整度 **90%** | 可探测 CAT-02 聚合模板；duplicate dim/metric 422；probe ≤50ms |
| 4 | CAT-03 地域维度类 catalog 集成 probe | CAT-003 | 4 | 用户价值 **84%**；完整度 **90%** | 可探测 geo region 树；非法/空地域输入守卫；probe ≤50ms |
| 5 | HTTPS 响应脱敏审计 guard + audit probe | NFR-004 | 5 | 用户价值 **84%**；性能 **88%** | API 响应审计不含明文凭证；结构化 audit probe 可判定 |

**依赖链**：GOV-002 semi-auto FSM/probe → CAT-001 handler/probe → CAT-002 handler/probe → CAT-003 handler/probe → NFR-004 middleware guard → M6 集成 pytest 全绿 → P5 勾 plan §M6 五项 + PRD 对账。

**上轮已交付（本轮不重复 L1/companion 骨架）**：

| 域 | 已有能力 | 本轮不重复 |
|----|----------|-----------|
| GOV-002 | `POST /gov/bus/register` InMemory adapter；幂等 201/200；admin 403；timeout/4xx/5xx path 约定（r31） | 不重写 adapter 失败分支语义 |
| GOV-007 | `bus/auto.py` FSM `idle/auto_registering/succeeded/failed` + auto-register probe | 不扩全自动注册或真实总线 HTTP |
| CAT-001~003 | `cat01/02/03` service + probe + r65/r66 ACL companion | 不重写模板 validate 核心规则 |
| NFR-004 | `https_audit.py` status/mask-probe + r68 ACL/perf | 不扩生产 TLS 终止或持久化 audit store |
| GOV-001 | `test_gov_001_catalog_appendix_e.py` 附录 E L1（r219） | 不重复 7 类 taxonomy 枚举 |

**plan.md 状态**：M6 余 5 项 `[ ]`（GOV-002/CAT-001~003/NFR-004）。**禁止**修改 `plan.md` / `goal.md` 结构（P5 勾选）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `governance/bus/poc.py` | 仅 re-export `InMemoryBusAdapter`；**无** semi-auto FSM |
| `governance/catalog/service.py` | `register_entry_to_bus` 写 `BusRegistration.status=succeeded`；**无** pending/registered/failed 查询面 |
| `api/v1/gov.py` | `POST /bus/register` 仅 admin；**无** enterprise path scope；**无** semi-auto FSM GET；**无** `/bus/register/probe` |
| `governance/bus/auto.py` | GOV-007 全自动 FSM（**不同**状态名与 API）；与 semi-auto 隔离 |
| `cat01/02/03/probe.py` | 域内 perf probe 已有；**无** M6 集成 HTTP handler 聚合 discovery+ACL+perf |
| `core/nfr/https_audit.py` | mask-probe 脱敏逻辑；**无** 响应链路 middleware；**无** audit ring buffer |
| `main.py` | TraceId + Auth middleware；**无** HTTPS audit guard |
| `tests/` | r31/r64/r66/r68 分散覆盖；**无** `test_gov_002*` / `test_cat_00*` / `test_nfr_004*` M6 集成验收文件 |

**范围框定模块**（3）：`backend/app/governance/`（bus PoC FSM + cat handlers）+ `backend/app/core/`（https audit guard）+ `tests/`。

**真理源优先级**：`round-target` > `plan.md` §M6 > `prd/F10-GOV` · `F14-CAT` · `F15-NFR` > `docs/services/governance.md` · `core.md` > `docs/api/README.md`。

## 3. 范围框定文件清单（18）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/governance/bus/poc_fsm.py` | GOV-002 | 新建：semi-auto FSM `pending/registered/failed` |
| `backend/app/governance/bus/probe.py` | GOV-002 | 修改：`probe_semi_auto_register_budget_ms` |
| `backend/app/governance/catalog/service.py` | GOV-002 | 修改：登记前后 FSM 跃迁钩子 |
| `backend/app/governance/catalog/cat01/handler.py` | CAT-001 | 新建：`run_cat01_catalog_probe` |
| `backend/app/governance/catalog/cat02/handler.py` | CAT-002 | 新建：`run_cat02_catalog_probe` |
| `backend/app/governance/catalog/cat03/handler.py` | CAT-003 | 新建：`run_cat03_catalog_probe` |
| `backend/app/core/nfr/https_audit.py` | NFR-004 | 修改：audit ring buffer + `export_audit_probe` |
| `backend/app/core/middleware/https_audit_guard.py` | NFR-004 | 新建：JSON 响应脱敏 + 审计写入 |
| `backend/app/main.py` | NFR-004 | 修改：条件注册 `HttpsAuditGuardMiddleware` |
| `backend/app/api/v1/gov.py` | GOV/CAT | 修改：FSM GET、bus/cat M6 probe 路由 |
| `backend/app/api/v1/nfr.py` | NFR-004 | 修改：`GET /https-audit/audit-probe` |
| `tests/test_gov_002_bus_poc_fsm.py` | GOV-002 | 新建：M6 集成验收 |
| `tests/test_cat_001_lifecycle_m6.py` | CAT-001 | 新建：M6 集成验收 |
| `tests/test_cat_002_aggregate_m6.py` | CAT-002 | 新建：M6 集成验收 |
| `tests/test_cat_003_region_m6.py` | CAT-003 | 新建：M6 集成验收 |
| `tests/test_nfr_004_https_audit.py` | NFR-004 | 新建：M6 集成验收 |
| `docs/api/README.md` | 全部 | 修改：登记新路由 |
| `docs/services/governance.md` | GOV/CAT | 修改：FSM + M6 probe 锚点 |

> P5 对账（非 P3 必改）：`docs/services/core.md`、`prd/F10-GOV.md`、`prd/F14-CAT.md`、`prd/F15-NFR.md`。

## 4. 非目标（明确不做）

- M13 冻结项；GOV-007 全自动总线；≥2 真实总线 HTTP 端点；审批工单流水线
- CAT-004~007 扩展；IF-02 实体/聚合/地域真实查询链；地图可视化（DASH-005）
- 生产全站 TLS 终止、ingress 强制、持久化 audit store、NFR-006 浏览器推送
- M7 连接器（CONN-004 等）；Dataset（QUERY-009）；`fe/` 任何变更
- 新增 Alembic migration（FSM 与 audit buffer 均内存 companion）
- 修改 `plan.md` / `goal.md` 结构

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维 | 本轮设计对策 |
|--------|--------|--------------|
| GOV-002 | 用户价值 82%；性能 86% | 可查询 semi-auto FSM；enterprise path scope；`probe_semi_auto_register_budget_ms` ≤50ms；专用 `test_gov_002*` 可演示登记路径 |
| CAT-001 | 用户价值 84%；完整度 90% | M6 handler 聚合 taxonomy 码 CAT-01 + list/validate probe + ACL 403；边界空 stages/越权用例 |
| CAT-002 | 用户价值 84%；完整度 90% | M6 handler 聚合 CAT-02 + duplicate dim/metric 422 + list/validate probe |
| CAT-003 | 用户价值 84%；完整度 90% | M6 handler 聚合 CAT-03 + 空/非法 regionCode + viewer 写禁止 + geo probe |
| NFR-004 | 用户价值 84%；性能 88% | 响应链路 guard 脱敏；audit ring buffer 无明文 token；`audit-probe` + middleware 开销 ≤50ms |

## 6. 架构设计

### 6.1 目标增量结构

```
backend/app/governance/
├── bus/
│   ├── poc_fsm.py          # SemiAutoFsmState + transitions + scope
│   └── probe.py            # + probe_semi_auto_register_budget_ms
├── catalog/
│   ├── service.py          # register_entry_to_bus hooks FSM
│   ├── cat01/handler.py    # run_cat01_catalog_probe
│   ├── cat02/handler.py    # run_cat02_catalog_probe
│   └── cat03/handler.py    # run_cat03_catalog_probe

backend/app/core/
├── nfr/https_audit.py      # + AuditRingBuffer, export_audit_probe
└── middleware/
    └── https_audit_guard.py  # HttpsAuditGuardMiddleware

backend/app/api/v1/
├── gov.py                  # FSM GET, bus/cat M6 probes
└── nfr.py                  # GET /https-audit/audit-probe

tests/
├── test_gov_002_bus_poc_fsm.py
├── test_cat_001_lifecycle_m6.py
├── test_cat_002_aggregate_m6.py
├── test_cat_003_region_m6.py
└── test_nfr_004_https_audit.py
```

### 6.2 GOV-002 — 半自动总线 PoC FSM

#### 6.2.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 新建 `poc_fsm.py` 内存 FSM + GET 查询 | 状态名对齐 plan：`pending/registered/failed`；与 GOV-007 auto FSM 隔离 | **采用** |
| B 复用 `BusRegistration.status` 并改值为 registered | 需 migration + 破坏 r31 幂等语义 | 否决 |
| C 仅增测试不重 FSM | 无法满足 round-target「FSM 可查询」 | 否决 |

#### 6.2.2 FSM 语义

**文件**：`backend/app/governance/bus/poc_fsm.py`

```python
SemiAutoFsmState = Literal["pending", "registered", "failed"]
```

| 事件 | 前状态 | 后状态 | 触发点 |
|------|--------|--------|--------|
| 发起登记 | （无）/ `failed` | `pending` | `register_entry_to_bus` 入口（adapter 调用前） |
| 登记成功 | `pending` | `registered` | adapter `succeeded` + DB commit 后 |
| 登记失败 | `pending` | `failed` | adapter 失败或 `CatalogError` |
| 幂等重登 | `registered` | `registered` | 已有 succeeded `BusRegistration`；FSM 保持 registered |

- 存储：`_SEMI_AUTO_FSM: dict[UUID, SemiAutoFsmState]`（进程内；与 auto FSM 字典分离）
- `get_semi_auto_fsm(entry_id) -> SemiAutoFsmState`：无记录时返回 `pending` 仅当存在 in-flight pending；已 registered 行存在时返回 `registered`
- `set_user_bus_register_scope(user_id, path_prefix)`：enterprise 用户仅可登记 `path.startswith(prefix)` 的 catalog entry

#### 6.2.3 API 契约

| Method | Path | 说明 | 鉴权 |
|--------|------|------|------|
| GET | `/api/v1/gov/bus/register/fsm` | Query `catalogEntryId`；返回 `{fsmState, catalogEntryId, busId?}` | 已登录 |
| GET | `/api/v1/gov/bus/register/probe` | 创建 fixture entry + 半自动登记计时；`{elapsedMs, ok}` | admin/integration |
| POST | `/api/v1/gov/bus/register` | **既有**；补充：入口写 FSM pending；成功 registered；失败 failed；enterprise scope | admin |

**错误码**（新增/复用）：

| code | HTTP | 场景 |
|------|:----:|------|
| `BUS_REGISTER_FORBIDDEN` | 403 | 非 admin；或 enterprise path scope 越界 |
| `GOV_BUS_FSM_NOT_FOUND` | 404 | GET fsm 时 catalog entry 不存在 |
| 既有 r31 码 | 4xx/5xx | timeout/4xx/5xx/幂等 |

#### 6.2.4 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-GOV-002-01 | publish entry → POST register 201 → GET fsm `registered` + `busId` 非空 |
| T-GOV-002-02 | `force-fail` path entry → POST register 502 → GET fsm `failed` |
| T-GOV-002-03 | 二次 register 同 entry → 200 幂等 → fsm 仍 `registered` |
| T-GOV-002-04 | viewer POST register → 403 `BUS_REGISTER_FORBIDDEN` |
| T-GOV-002-05 | enterprise scope 外 path → 403 `BUS_REGISTER_FORBIDDEN` |
| T-GOV-002-06 | `probe_semi_auto_register_budget_ms` / HTTP probe `ok=true` 且 `<50ms` |

### 6.3 CAT-001 — 生命周期类 M6 catalog handler

#### 6.3.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 每 cat 增 `handler.py` + `GET .../m6-probe` 聚合 | 复用既有 service/probe；输出统一 M6 验收 JSON | **采用** |
| B 仅新建 pytest 调 service | 无 HTTP discovery 面 | 否决 |
| C 合并三 cat 为单 handler | 违背域边界 | 否决 |

#### 6.3.2 Handler 契约

**文件**：`backend/app/governance/catalog/cat01/handler.py`

```python
class Cat01CatalogProbeOut(BaseModel):
    category_code: str = "CAT-01"
    template_count: int
    acl_ready: bool
    list_probe_ok: bool
    validate_probe_ok: bool
    elapsed_ms: float
```

- `run_cat01_catalog_probe(actor)`：调用 `list_lifecycle_templates` + `probe_list/validate_lifecycle_budget_ms`；`acl_ready=True` 当 `set_user_entity_scope` 机制可导入
- **路由**：`GET /api/v1/gov/catalog/lifecycle-templates/m6-probe` → 200 `Cat01CatalogProbeOut`；enterprise 越权 scope 时 403 `CAT01_FORBIDDEN`

#### 6.3.3 验收标准

| ID | 断言 |
|----|------|
| T-CAT-001-M6-01 | GET m6-probe → 200 + `categoryCode=CAT-01` + `listProbeOk` + `validateProbeOk` |
| T-CAT-001-M6-02 | POST lifecycle-templates 空 stages → 422 `CAT01_EMPTY_STAGES` |
| T-CAT-001-M6-03 | enterprise 越权 entityType → 403 `CAT01_FORBIDDEN` |
| T-CAT-001-M6-04 | viewer POST create → 403 |
| T-CAT-001-M6-05 | list/validate probe `elapsedMs < 50` |

### 6.4 CAT-002 — 聚合统计类 M6 catalog handler

**文件**：`backend/app/governance/catalog/cat02/handler.py`

- 输出 `Cat02CatalogProbeOut`：`categoryCode=CAT-02`、`attributionReady`（attribution GET 200 stub）、`listProbeOk`、`validateProbeOk`
- **路由**：`GET /api/v1/gov/catalog/aggregate-templates/m6-probe`

| ID | 断言 |
|----|------|
| T-CAT-002-M6-01 | GET m6-probe → 200 + CAT-02 字段齐备 |
| T-CAT-002-M6-02 | validate duplicate dimensions → 422 `CAT02_DUPLICATE_DIMENSION` |
| T-CAT-002-M6-03 | enterprise 越权 aggregate scope → 403 `CAT02_FORBIDDEN` |
| T-CAT-002-M6-04 | list/validate probe `<50ms` |

### 6.5 CAT-003 — 地域维度类 M6 catalog handler

**文件**：`backend/app/governance/catalog/cat03/handler.py`

- 输出 `Cat03CatalogProbeOut`：`categoryCode=CAT-03`、`regionCount`、`listProbeOk`、`moveProbeOk`
- **路由**：`GET /api/v1/gov/catalog/geo-regions/m6-probe`

| ID | 断言 |
|----|------|
| T-CAT-003-M6-01 | GET m6-probe → 200 + CAT-03 字段齐备 |
| T-CAT-003-M6-02 | create 非法 regionCode 格式 → 422 |
| T-CAT-003-M6-03 | viewer POST create geo → 403 `CAT03_FORBIDDEN` |
| T-CAT-003-M6-04 | enterprise 越权 region prefix → 403 |
| T-CAT-003-M6-05 | list/move probe `<50ms` |

### 6.6 NFR-004 — HTTPS 脱敏审计 guard

#### 6.6.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A Starlette middleware 扫描 JSON 响应 + ring buffer | 链路级 companion；可 audit-probe | **采用** |
| B 仅扩 mask-probe POST | 无「guard」语义 | 否决 |
| C 全量 body 落盘 | 超范围 + 安全风险 | 否决 |

#### 6.6.2 Middleware 行为

**文件**：`backend/app/core/middleware/https_audit_guard.py`

- 注册条件：`HTTPS_AUDIT_GUARD` env 为 `1`（TestClient fixture 默认开启；生产默认 off）
- 仅处理 `Content-Type: application/json` 且 path 前缀 `/api/v1/`
- 解析响应 body dict；对 `_MASK_KEYS`（password/apiKey/credential/secret/token）替换为 `***`
- 写入 `AuditRingBuffer`（max 32 条）：`{traceId, path, method, maskedFields, timestamp}` — **禁止**存原始明文
- 响应 body 不变（guard 审计侧车，不改客户端可见 payload）；追加响应头 `X-Audit-Sampled: 1`（有敏感字段时）

**文件**：`backend/app/core/nfr/https_audit.py` 扩展：

- `record_audit_event(...)` / `export_audit_probe(actor) -> AuditProbeOut`
- `export_audit_probe` 返回最近事件列表，断言每条 `maskedFields` 非空时无明文字段值

#### 6.6.3 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/nfr/https-audit/audit-probe` | `{events[], eventCount, plaintextLeaked: false}` |
| POST | `/api/v1/nfr/https-audit/mask-probe` | **既有** |
| GET | `/api/v1/nfr/https-audit/status` | **既有** |

#### 6.6.4 验收标准

| ID | 断言 |
|----|------|
| T-NFR-004-M6-01 | fixture 启用 guard → 调含 password 的响应路由 → audit-probe `plaintextLeaked=false` |
| T-NFR-004-M6-02 | audit 事件无 `password`/`token` 明文值 |
| T-NFR-004-M6-03 | enterprise 越权 auditScope → mask-probe 403（r68 回归） |
| T-NFR-004-M6-04 | `probe_https_mask_budget_ms` + status probe `<50ms` |
| T-NFR-004-M6-05 | `simulateAuditFailure=true` → `auditLogged=false` |

## 7. 测试策略

### 7.1 新建 M6 集成文件（不删 r31/r64/r66/r68）

| 文件 | 覆盖 PRD | 预估用例数 |
|------|----------|:----------:|
| `test_gov_002_bus_poc_fsm.py` | GOV-002 | 6 |
| `test_cat_001_lifecycle_m6.py` | CAT-001 | 5 |
| `test_cat_002_aggregate_m6.py` | CAT-002 | 4 |
| `test_cat_003_region_m6.py` | CAT-003 | 5 |
| `test_nfr_004_https_audit.py` | NFR-004 | 5 |

- 各文件 module-scoped sqlite fixture（对齐 `test_gov_001_catalog_appendix_e.py` 模式）
- `test_nfr_004` autouse 设置 `HTTPS_AUDIT_GUARD=1`

### 7.2 回归门控

```bash
cd backend && pytest \
  tests/test_gov_002_bus_poc_fsm.py \
  tests/test_cat_001_lifecycle_m6.py \
  tests/test_cat_002_aggregate_m6.py \
  tests/test_cat_003_region_m6.py \
  tests/test_nfr_004_https_audit.py \
  tests/test_gov_001_catalog_appendix_e.py \
  tests/test_view_gov_api_r31.py \
  tests/test_nfr_gov_rpt_view_r68.py::test_nfr_r68_004 \
  -q --tb=short
```

期望：**exit 0**；新增 25 条 + 关键回归无破坏。

## 8. 文档同步（P3 最小 / P5 对账）

| 变更 | 文档 |
|------|------|
| 新 gov/nfr 路由 | `docs/api/README.md` |
| bus FSM + cat M6 probe | `docs/services/governance.md` |
| https audit guard | `docs/services/core.md`（P5） |
| plan §M6 五项勾选 | `plan.md`（P5 only） |
| PRD 验收勾选项 | `prd/F10-GOV.md` GOV-002；`prd/F14-CAT.md` CAT-001~003；`prd/F15-NFR.md` NFR-004（P5） |

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| semi-auto FSM 与 GOV-007 auto FSM 混淆 | 独立模块 `poc_fsm.py`；API 路径 `/bus/register/*` vs `/bus/auto-register/*` |
| middleware 解析非 JSON 响应失败 | 仅 JSON；解析失败跳过审计不写 buffer |
| cat M6 probe 与 r66 probe 重复 | handler 聚合输出；不删既有 probe 函数 |
| 性能回归 | 所有 probe 硬限 50ms；CI 同机测量 |

## 10. Spec self-review

- [x] 覆盖 round-target 五项，无 TBD/TODO
- [x] 18 文件 ≤ 范围框定；无 `fe/`；无 production code
- [x] 每项验收标准可映射 pytest ID
- [x] 非目标显式排除 GOV-007/CAT-004+/生产 TLS
- [x] `ui_design_skill: none`（纯后端 companion）
- [x] FSM 状态名与 round-target 一致：`pending/registered/failed`
