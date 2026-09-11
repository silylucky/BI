# 跨域 companion 质量推分 r63 设计 — VIZ-007 / VIEW-002 / DESIGN-004 / CAT-005 / VIEW-003

```yaml
date: 2026-07-04
milestone: VIZ/VIEW/DESIGN/CAT
round_target: docs/superpowers/evolution/2026-07-04-round-target-r63.md
prd_ids: [VIZ-007, VIEW-002, DESIGN-004, CAT-005, VIEW-003]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | SDK 门户 perf probe + lifecycle ACL 边界 | VIZ-007 | `viz/sdk_portal/` | 1（hub **并列最低 82.9**） | 性能 **58%→≥88%**；完整度 **74%→≥85%** | SDK init/lifecycle 响应可预测；越权 lifecycle 与缺 token 被结构化拦截 |
| 2 | 角色默认视图 bounds + resolve perf | VIEW-002 | `views/role_template.py` | 2（hub **并列最低 82.9**） | 性能 **58%→≥88%**；完整度 **74%→≥85%** | 角色默认视图 CRUD 边界更完整；resolve 时延可回归 |
| 3 | workflow-link publishReady/perf + 非法联动 | DESIGN-004 | `designer/workflow.py` | 3（hub **并列最低 82.9**） | 性能 **58%→≥88%**；完整度 **74%→≥85%** | 发布就绪状态可探测；非法 catalog/designType 联动被拦截 |
| 4 | 工单统计 ACL + stats perf probe | CAT-005 | `governance/catalog/cat05/` | 4（hub **83.3**） | 性能 **58%→≥88%**；完整度 **76%→≥88%** | 分类工单统计越权被拦截；统计查询 perf 可回归 |
| 5 | me/views bounds/cycle + perf probe | VIEW-003 | `views/user_override.py` | 5（hub **84.2**，与 #2 同域批处理） | 性能 **58%→≥88%**；完整度 **76%→≥88%** | 用户视图覆盖边界与循环检测更完整；perf smoke 可回归 |

**依赖链**：VIZ-007 sdk_portal probe/ACL → VIEW-002 role defaults bounds/probe → DESIGN-004 workflow-link probe/非法联动 → CAT-005 ticket stats ACL/probe → VIEW-003 me/views cycle/404/probe → `test_viz_view_design_cat_r63.py` companion → r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r60 `test_rpt_view_cat_gov_r60` 34/34 回归门控 → P5 五 ID 加权总分 **≥90**（破 STUCK round 1）。

**上轮已交付（本轮不重复 L1 骨架）**：

| PRD | r59–r61 已有 | 本轮不重复 |
|-----|-------------|-----------|
| VIZ-007 | `sdk_portal/` validate/lifecycle/capabilities + r61 7 测 | 不重写 embed/validate 语义 |
| VIEW-002 | role defaults CRUD + admin 403 + resolve + r60 6 测 | 不重写 store 结构 |
| DESIGN-004 | workflow-link validate/save/get + publishReady 探测 + r59 6 测 | 不重写 config_store 类型 |
| CAT-005 | ticket stats validate/create/list/stats + r61 7 测 | 不重写 mock counts 语义 |
| VIEW-003 | me/views create/list + bounds/classification + r60 6 测 | 不重写 r31 validate 核心路径 |

**STUCK 说明**：五 ID 各连续 1 轮（82.9–84.2）；本轮 companion 闭合 r59–r61 L1 后遗留的 **性能 58%** 与 **完整度 74–76%** 薄弱维；目标加权总分 **≥90**。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §VIZ/VIEW/DESIGN/CAT；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `viz/sdk_portal/service.py` | validate/lifecycle/capabilities；**无** `probe_*_budget_ms`；`auth_mode=token` 缺 token 仅返回 `tokenRequired=true` 不报错；lifecycle **无**角色 ACL |
| `viz/sdk_portal/errors.py` | 仅 `SdkPortalError` 基类；**无** `VIZ_SDK_FORBIDDEN`/`VIZ_SDK_TOKEN_REQUIRED`/`VIZ_SDK_DUPLICATE_ORIGIN` |
| `views/role_template.py` | admin PUT 守卫；**无** `maxWidgetCount` 上下界校验；**无** resolve perf probe；viewer 可读任意 role GET |
| `views/user_override.py` | create + list；**无** GET by id 404；**无** unknown dashboardId 404；**无** create perf probe |
| `views/validate.py` | r31 bounds/cycle 已有；me/views 非法 layout cycle 经 `validate_dashboard_view` 映射 |
| `designer/workflow.py` | publishReady 探测；**无** perf probe；**无** catalogEntryId + designType 非法组合守卫 |
| `cat05/service.py` | 内存 store + mock stats；**无**角色/企业域 ACL；create/list/stats **无** user 参数 |
| `cat06/service.py`（参照） | `_assert_brand_access` + `CAT06_BRAND_FORBIDDEN` 模式可复用至 cat05 |
| `api/v1/charts.py` | sdk 三路由；validate **未**传入 actor |
| `api/v1/gov.py` | ticket stats 四路由；create/stats **未** ACL |
| `test_cat_dash_viz_nfr_r61.py` | VIZ-007 6 条 + CAT-005 7 条 L1；**无** perf/ACL companion |
| `test_rpt_view_cat_gov_r60.py` | VIEW-002/003 各 6 条 L1；**无** perf probe |
| `test_meta_cat_dash_conn_design_r59.py` | DESIGN-004 6 条 L1；**无** perf/非法联动 |

**范围框定模块**（5）：

1. `backend/app/viz/sdk_portal/` — VIZ-007 companion
2. `backend/app/views/` — VIEW-002/003 companion（共享 `probe.py`）
3. `backend/app/designer/` — DESIGN-004 companion（仅 `workflow.py`）
4. `backend/app/governance/catalog/cat05/` — CAT-005 companion
5. `backend/app/api/v1/` — 薄 entry 增量（charts/views/designer/gov）

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/viz/sdk_portal/probe.py` | VIZ-007 | 新建：`probe_validate_sdk_budget_ms` + `probe_lifecycle_budget_ms` |
| `backend/app/viz/sdk_portal/service.py` | VIZ-007 | 修改：lifecycle ACL、token 必填、duplicate origin |
| `backend/app/viz/sdk_portal/errors.py` | VIZ-007 | 修改：新增错误码常量 |
| `backend/app/views/probe.py` | VIEW-002/003 | 新建：resolve/create override perf probes |
| `backend/app/views/role_template.py` | VIEW-002 | 修改：`maxWidgetCount` bounds、resolve probe 导出 |
| `backend/app/views/user_override.py` | VIEW-003 | 修改：get by id、dashboard 404、cycle 守卫巩固 |
| `backend/app/designer/workflow.py` | DESIGN-004 | 修改：probe + catalog/designType 非法联动 |
| `backend/app/governance/catalog/cat05/service.py` | CAT-005 | 修改：ticket ACL + stats probe |
| `backend/app/governance/catalog/cat05/errors.py` | CAT-005 | 修改：`CAT05_FORBIDDEN` 等 |
| `backend/app/api/v1/charts.py` | VIZ-007 | 修改：validate/lifecycle 传入 actor；可选 GET `/sdk/probe` |
| `backend/app/api/v1/views.py` | VIEW-002/003 | 修改：GET `/me/views/{id}`；role probe 路由（可选内部） |
| `backend/app/api/v1/designer.py` | DESIGN-004 | 修改：validate 错误映射不变 |
| `backend/app/api/v1/gov.py` | CAT-005 | 修改：create/stats 传入 `UserContext` |
| `tests/test_viz_view_design_cat_r63.py` | 全部 | 新建（≥32 条 companion 断言） |
| `docs/services/viz.md` | VIZ-007 | 修改：companion probe/ACL 登记 |
| `docs/services/views.md` | VIEW-002/003 | 修改：bounds/probe/GET by id |
| `docs/services/designer.md` | DESIGN-004 | 修改：workflow-link companion |
| `docs/services/governance.md` | CAT-005 | 修改：cat05 ACL 登记 |

**跨模块薄 entry 说明**：`api/v1/*.py` 四文件各 1–2 处改动，仅参数透传与路由增量；业务逻辑留在五域框定内。计入 ≤20 文件总预算。

**真理源优先级**：`round-target` > `prd.md` hub + `F06-VIZ` / `F09-VIEW` / `F12-DESIGN` / `F14-CAT` > `docs/services/` > `docs/api/README.md`。

**本轮性质**：r59–r61 L1 后 **companion 质量推分**；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin 全量页面、真实 SLA metrics 生产采集、PDF 全链路、M7 地域权限 fe、OpenSearch 只读集成测、四枚远期 stub（NFR-001/CAT-001/NFR-004/CAT-002，留 r64）。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/viz/sdk_portal/
├── probe.py              # VIZ-007：validate + lifecycle 同进程 perf probe（budget 50ms）
├── service.py            # + lifecycle ACL、token 必填、duplicate origin
└── errors.py             # + VIZ_SDK_* 常量

backend/app/views/
├── probe.py              # VIEW-002/003：resolve_defaults + create_override probes
├── role_template.py      # + maxWidgetCount [1,64]、VIEW_DEFAULT_OUT_OF_BOUNDS
└── user_override.py      # + get_override、dashboard 404、cycle 路径巩固

backend/app/designer/
└── workflow.py           # + probe_validate_workflow_link、catalog/designType 守卫

backend/app/governance/catalog/cat05/
├── service.py            # + _assert_ticket_access、probe_ticket_stats_budget_ms
└── errors.py             # + CAT05_FORBIDDEN

backend/app/api/v1/
├── charts.py             # validate/lifecycle actor 透传
├── views.py              # GET /users/me/views/{view_id}
├── designer.py           # （错误映射保持）
└── gov.py                # ticket create/stats user 透传

tests/
└── test_viz_view_design_cat_r63.py   # T-*-R63-xxx
```

**共享 companion 契约**（五子项均满足）：

| 契约项 | L1 已有 | r63 增量 |
|--------|---------|----------|
| 结构化 `code` | 各域基础错误码 | 补 `VIZ_SDK_*` / `VIEW_DEFAULT_OUT_OF_BOUNDS` / `DESIGN_WORKFLOW_CATALOG_MISMATCH` / `CAT05_FORBIDDEN` |
| 性能 smoke | 无 | 各域 `probe_*_budget_ms` ≤ **50ms**（同进程 `time.perf_counter`，无真实网络） |
| 错误体 | `{code, message, detail}` | ACL 403 含明确 message；校验 422 含 `detail.fields` |
| 内存 store | views/cat05 进程内 dict | 文档注明非 Alembic 持久化；ACL scope 注册函数供测试夹具 |
| 回归 | r59–r61 L1 套件 | r62 32/32 + r61 32/32 + r60 34/34 全量门控不删旧套件 |

### 3.2 VIZ-007 — SDK 门户 perf probe 与 lifecycle ACL

#### 3.2.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | 域内 `probe.py` + service ACL 深化；charts entry 透传 actor | 对齐 r52 `output_fields.probe_*` 惯例；薄 entry |
| B | 仅 pytest 内联计时，不改 service | 无法登记 API 面 perf smoke；8 维性能维提升不足 |
| C | 新建 `sdk_portal/acl.py` 子模块 | 文件预算紧张；单文件 service 增量即可 |

**推荐 A**：`probe_validate_sdk_budget_ms(payload)` 调用 `validate_sdk_init`；`probe_lifecycle_budget_ms(phase)` 调用 `lifecycle_manifest`；预算常量 `probe_sdk_validate_budget_ms = 50`。

#### 3.2.2 ACL 与边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `auth_mode=token` 且 `embedToken` 为空 | validate **422**（非仅 `tokenRequired` 标志） | `VIZ_SDK_TOKEN_REQUIRED` |
| `allowedOrigins` 含重复项 | validate 422 | `VIZ_SDK_DUPLICATE_ORIGIN` |
| lifecycle `phase=destroy` | 要求 actor 含 `admin` 或 `editor` | `VIZ_SDK_FORBIDDEN` 403 |
| `allowedOrigins` 超过 schema max（32） | Pydantic 422 或域映射 `VIZ_SDK_TOO_MANY_ORIGINS` | 保持与 embed 一致 |

**不改动**：`POST /charts/embed/validate` 语义；`GET /sdk/capabilities` 响应形状。

#### 3.2.3 可测试验收标准（VIZ-007）

- [ ] `probe_validate_sdk_budget_ms` 合法 payload 耗时 **< 50ms**（单元测 `test_viz_r63_007_probe_validate_under_budget`）
- [ ] `probe_lifecycle_budget_ms("init")` 耗时 **< 50ms**
- [ ] `auth_mode=token` 无 `embedToken` → 422 `VIZ_SDK_TOKEN_REQUIRED`
- [ ] duplicate `allowedOrigins` → 422 `VIZ_SDK_DUPLICATE_ORIGIN`
- [ ] viewer `lifecycle destroy` → 403 `VIZ_SDK_FORBIDDEN`
- [ ] r61 `T-VIZ-R61-007-01~06` 回归全绿

### 3.3 VIEW-002 — 角色默认视图 bounds 与 perf

#### 3.3.1 方案比选

| 方案 | 描述 | 取舍 |
|------|------|------|
| **A（推荐）** | `role_template` 内 bounds + `views/probe.py` resolve probe | 与 VIEW-003 共享 probe 模块 |
| B | 新建 `role_defaults/acl.py` | 超文件预算 |
| C | 仅加测试不加 bounds | 完整度维提升不足 |

#### 3.3.2 边界闭合

| 规则 | 行为 | 错误码 |
|------|------|--------|
| `maxWidgetCount` < 1 或 > 64 | PUT 422 | `VIEW_DEFAULT_OUT_OF_BOUNDS` |
| `resolve_defaults_for_roles([])` | 返回空默认 + maxWidgetCount=24 | 行为不变，加单测固化 |
| `probe_resolve_defaults_budget_ms(role_codes)` | 同进程 **< 50ms** | 导出至 `views/probe.py` |

**不改动**：admin PUT 403 `VIEW_DEFAULT_FORBIDDEN`；dashboard/report 404 路径；store 键规范化。

#### 3.3.3 可测试验收标准（VIEW-002）

- [ ] `maxWidgetCount=0` → 422 `VIEW_DEFAULT_OUT_OF_BOUNDS`
- [ ] `maxWidgetCount=65` → 422 `VIEW_DEFAULT_OUT_OF_BOUNDS`
- [ ] `probe_resolve_defaults_budget_ms(["admin","viewer"])` **< 50ms**
- [ ] r60 `T-VIEW-R60-002-01~06` 回归全绿

### 3.4 DESIGN-004 — workflow-link publishReady perf 与非法联动

#### 3.4.1 非法联动守卫

| 条件 | 行为 | 错误码 |
|------|------|--------|
| `designType=query` 且 `catalogEntryId` 非空 | validate 422（query 设计器不走 catalog 发布链） | `DESIGN_WORKFLOW_CATALOG_MISMATCH` |
| `catalogEntryId` 指向未 publish 条目且 workflow 已 published | `publishReady=false`（行为保持）+ validate 200 可测 | 加单测固化 |
| `workflowInstanceId` 存在但 status 非 published | `publishReady=false` | r59 已有，回归 |

#### 3.4.2 perf probe

- `probe_validate_workflow_link_budget_ms(session, link)`：调用 `validate_workflow_link`；预算 **50ms**。
- 测试夹具复用 r59 `_create_workflow_instance` 模式（published 路径需 workflow approve 辅助或 mock status）。

#### 3.4.3 可测试验收标准（DESIGN-004）

- [ ] `designType=query` + `catalogEntryId` → 422 `DESIGN_WORKFLOW_CATALOG_MISMATCH`
- [ ] `probe_validate_workflow_link_budget_ms` **< 50ms**
- [ ] published workflow + 无 catalog → `publishReady=true`（新测闭合完整度）
- [ ] r59 `T-DESIGN-R59-004-01~06` 回归全绿

### 3.5 CAT-005 — 工单统计 ACL 与 perf

#### 3.5.1 ACL 设计（对齐 cat06 模式）

```python
# 进程内测试可注册；文档注明非生产
_USER_TICKET_SCOPE: dict[str, str] = {}  # user_id -> allowed ticketCategoryKey

def set_user_ticket_scope(user_id: str, category_key: str) -> None: ...

def _assert_ticket_access(user: UserContext, category_key: str) -> None:
    roles = set(user.roles)
    if "admin" in roles or "analyst" in roles:
        return
    if "enterprise" in roles:
        expected = _USER_TICKET_SCOPE.get(user.id, "TICKET-DEFAULT")
        if category_key != expected:
            raise Cat05Error("CAT05_FORBIDDEN", ..., 403)
    if "viewer" in roles and "editor" not in roles:
        # create 禁止；stats GET 允许只读
        raise Cat05Error("CAT05_FORBIDDEN", "viewer cannot create ticket stats", 403)
```

| 操作 | admin/analyst | enterprise（scope 内） | enterprise（scope 外） | viewer |
|------|---------------|------------------------|------------------------|--------|
| POST items | ✓ | ✓ | 403 | 403 |
| GET stats | ✓ | ✓ | 403 | ✓（只读） |

#### 3.5.2 perf probe

- `probe_ticket_stats_budget_ms(key)`：调用 `get_ticket_stats`；预算 **50ms**（mock 计数，无 DB）。

#### 3.5.3 可测试验收标准（CAT-005）

- [ ] enterprise 用户 scope 外 key → GET stats 403 `CAT05_FORBIDDEN`
- [ ] viewer POST items → 403 `CAT05_FORBIDDEN`
- [ ] `probe_ticket_stats_budget_ms(existing_key)` **< 50ms**
- [ ] r61 `T-CAT-R61-005-01~07` 回归全绿

### 3.6 VIEW-003 — me/views bounds/cycle 与 perf

#### 3.6.1 增量闭合

| 能力 | 说明 |
|------|------|
| `get_override(user_id, view_id)` | 不存在 → `VIEW_OVERRIDE_NOT_FOUND` 404 |
| `GET /api/v1/users/me/views/{view_id}` | 新路由；404/200 |
| unknown `dashboardId` | create 前校验 `get_dashboard` → `VIEW_OVERRIDE_DASHBOARD_NOT_FOUND` 404 |
| layout chartRef cycle | 经 `validate_dashboard_view` → `VIEW_CHART_REF_CYCLE`（巩固 r60-003-06） |
| `probe_create_override_budget_ms` | 合法最小 payload **< 50ms** |

#### 3.6.2 可测试验收标准（VIEW-003）

- [ ] GET `/me/views/{unknown}` → 404 `VIEW_OVERRIDE_NOT_FOUND`
- [ ] POST 未知 dashboardId → 404 `VIEW_OVERRIDE_DASHBOARD_NOT_FOUND`
- [ ] chartRef cycle layout → 422 `VIEW_CHART_REF_CYCLE`
- [ ] `probe_create_override_budget_ms` **< 50ms**
- [ ] r60 `T-VIEW-R60-003-01~06` 回归全绿

## 4. 测试策略

### 4.1 新套件 `test_viz_view_design_cat_r63.py`

**夹具**：复用 r60/r61 模式 — module-scoped sqlite memory + `NFR08_RUNTIME_MODE=permissive` + `Bearer dev` admin 默认。

**用例分区**（≥32 断言，建议 34–36）：

| 前缀 | 数量 | 覆盖 |
|------|:----:|------|
| `T-VIZ-R63-007-*` | 7–8 | probe×2、token、duplicate origin、lifecycle ACL、r61 回归子集 |
| `T-VIEW-R63-002-*` | 5–6 | maxWidgetCount bounds、resolve probe |
| `T-DESIGN-R63-004-*` | 5–6 | catalog mismatch、probe、publishReady true |
| `T-CAT-R63-005-*` | 6–7 | enterprise scope、viewer create 403、stats probe |
| `T-VIEW-R63-003-*` | 6–7 | GET 404、dashboard 404、cycle、create probe |

### 4.2 回归门控（P4 必跑）

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_viz_view_design_cat_r63.py \
  ../tests/test_cat_nfr_rpt_meta_r62.py \
  ../tests/test_cat_dash_viz_nfr_r61.py \
  ../tests/test_rpt_view_cat_gov_r60.py \
  -v
```

Expected: r63 **≥32/32** + r62 **32/32** + r61 **32/32** + r60 **34/34**；全量 pytest exit_code **0**。

### 4.3 环境级 flaky 处理

- 全套件负载下个别 r58 遗留 `*_under_50ms` 用例可能偶发 >50ms：P4 隔离单测通过即可，与 r63 无关时记录 concern 不阻塞。

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | r63 设计闭合 | 预期提升 |
|--------|------------------|--------------|----------|
| VIZ-007 | 性能 58%、完整度 74% | probe×2 + lifecycle ACL + token/origin 边界 | 性能 **≥88%**、完整度 **≥85%** |
| VIEW-002 | 性能 58%、完整度 74% | maxWidgetCount bounds + resolve probe | 性能 **≥88%**、完整度 **≥85%** |
| DESIGN-004 | 性能 58%、完整度 74% | workflow probe + catalog/designType 守卫 + publishReady true 路径 | 性能 **≥88%**、完整度 **≥85%** |
| CAT-005 | 性能 58%、完整度 76% | ticket ACL + stats probe | 性能 **≥88%**、完整度 **≥88%** |
| VIEW-003 | 性能 58%、完整度 76% | GET by id + dashboard 404 + cycle + create probe | 性能 **≥88%**、完整度 **≥88%** |

**可靠性 / 安全性**：ACL 403 与 404 边界单测巩固 → 可靠性维持 **≥92%**、安全性 **≥88%**。

**交互维**：五 ID 均为后端 API，交互 N/A；不触发前端 UI 门控。

## 6. 非目标（明确不做）

- `fe/` JS SDK 初始化/销毁页面与 embed token 签发链（VIZ-007 PRD 未勾选项）
- VIEW-002 新用户 onboarding 自动继承与 DB 持久化
- VIEW-003 M7 全链路 RLS/org 绑定与 fe 个人视图 UI
- DESIGN-004 GOV-005 发布全链路与 BPM 双向状态同步
- CAT-005 真实工单表数据源绑定与生产查询链
- 四枚远期 stub：NFR-001、CAT-001、NFR-004、CAT-002（留 **r64 专用 stub 批**）
- Admin 全量 fe 页面、真实 SLA metrics 生产采集、PDF 全链路、OpenSearch 只读集成测
- Alembic 迁移（内存 store companion 轮惯例）
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构

## 7. 文档同步（P3/P5）

| 变更 | 同步文档 |
|------|----------|
| sdk_portal probe/ACL | `docs/services/viz.md` |
| views bounds/probe/GET by id | `docs/services/views.md` |
| workflow-link companion | `docs/services/designer.md` |
| cat05 ACL | `docs/services/governance.md` |
| 新路由（若有 GET me/views/{id}） | `docs/api/README.md`（P3 一行登记） |
| 五 ID 验收与 8 维评分 | `prd/F06|F09|F12|F14` + hub（**P5 对账**） |

## 8. Spec self-review

- [x] 覆盖 round-target 全部 5 子项
- [x] 18 文件 ≤ 20 预算
- [x] 无 TBD/TODO 占位
- [x] 每项有可测试验收标准
- [x] 纯后端；`ui_design_skill: none`
- [x] 未超出范围框定模块
- [x] 与 r59–r61 L1 不重复骨架
