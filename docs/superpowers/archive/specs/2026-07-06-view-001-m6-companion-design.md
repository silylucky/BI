# M5 VIEW-001 收官 + M6 NFR/GOV companion 设计

```yaml
date: 2026-07-06
milestone: M5 VIEW-001 收官 + M6 companion
round_target: docs/superpowers/evolution/2026-07-06-round-target-view-001-m6.md
base_branch: dev-auto
prd_ids: [VIEW-001, NFR-001, GOV-001]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | FR-VIEW-1 全 widget 校验与破坏性输入收官 | VIEW-001 | 1 | 用户价值 **84%**；完整度 **96%** | Dashboard 任意 widget 组合可校验；非法配置返回结构化 422 + `detail.fields`；存储 round-trip 稳定 |
| 2 | Dashboard 首屏 perf smoke 扩展 widget fixture 收官 | NFR-001 | 2 | 完整度 **92%**；性能 **90%** | 含地图/热力/KPI/时间轴的 Dashboard 首屏有可判定 P95 基线 |
| 3 | 查询接口分类 catalog 附录 E L1 | GOV-001 | 3 | 用户价值 **82%**；性能 **86%** | 平台可枚举附录 E 七分法 taxonomy；OpenAPI/治理文档有锚点 |

**依赖链**：VIEW-001 扩展 widget schema/破坏性用例闭合 → NFR-001 在同一四类 widget fixture 上断言 perf → GOV-001 附录 E taxonomy 独立交付（与 VIEW 无耦合）。

**上轮已交付（本轮不重复 L1 骨架）**：

- DASH-003：`builtin.py` 注册 map/heatmap/kpi/timeline；FE `WidgetPalette` 扩展分组；`charts.dash003.smoke.test.tsx`
- VIEW-001 M5 companion：`protocolVersion` + `protocol.py` + `test_view_m5_protocol.py` 基础 round-trip/未知 chartType/dashboard PUT-GET
- NFR-001 M5 companion：`dashboard-first-screen.perf.smoke.test.tsx` P95 smoke + `test_nfr_001_first_screen_smoke.py` widgetCount=4
- GOV-001 r30/r31：三分法 seed + catalog CRUD + 非法 category 4xx + bus 联动回归

**plan.md 状态**：M5 `VIEW-001`、M6 `NFR-001`/`GOV-001` 仍为 `[ ]`；分片验收未全勾。**禁止**修改 `plan.md` / `goal.md` 结构（P5 勾选）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `views/protocol.py` | `VIEW_PROTOCOL_VERSION=1`、`round_trip_view_document`、`export_view_json_schema()`；**无** HTTP schema 出口；**无**显式 `VIEW_PROTOCOL_UNSUPPORTED` |
| `views/validate.py` | 边界/colSpan/chartRef 环已闭合；扩展 widget 经 `validate_chart_view_config` 走 registry field_rule |
| `test_view_m5_protocol.py` | 5 条：四类 validate、round-trip、unknown chartType、dashboard PUT-GET；**缺** VIEW-001-04 破坏性（field_rule、protocolVersion、colSpan+扩展 widget 回归） |
| `api/v1/views.py` | 仅 `POST /validate`；**无** `GET /schema` |
| `dashboard_first_screen.py` | mock probe widgetCount=4；**无** fixture widget 类型画像；probe 不含 `fixtureProfile` |
| `test_nfr_001_first_screen_smoke.py` | 2 条 within_budget / simulate_slow；**未**断言扩展 widget fixture 标识 |
| `dashboard-first-screen.perf.smoke.test.tsx` | NFR-001-03 P95 ≤3000ms 已实现；mock 未区分 chartType 的 render-spec 响应 |
| `governance/catalog/models.py` | `SEED_CATEGORIES`/`VALID_CATEGORY_CODES` 仅 CAT-01~03；**缺** CAT-04~07 |
| `governance/catalog/service.py` | `_ensure_seed_categories` 仅在表空时 seed；**无** 附录 E 结构化 taxonomy API |
| `docs/srs/附录E-7类查询接口清单.md` | 七分法定义（CAT-01~07）；WS-01 待确认 |
| `prd/F09-VIEW.md` VIEW-001 | protocolVersion `[x]`；「全 BI 页面基于 DashboardView」仍 `[ ]`（非本轮） |
| `prd/F15-NFR.md` NFR-001 | fe P95 smoke `[x]`；并发压测 `[ ]`（非本轮） |
| `prd/F10-GOV.md` GOV-001 | 三分法 `[x]`；「7 类 taxonomy 可配置」`[ ]` |

**范围框定模块**（3）：`backend/app/`（views 协议 + gov catalog 附录 E stub）+ `fe/`（NFR perf smoke fixture 薄改）+ `tests/`。

**真理源优先级**：`round-target` > `plan.md` §M5/M6 > `prd/F09` · `F15` · `F10` > `docs/srs/附录E-7类查询接口清单.md` > b-design-system skill。

## 3. 范围框定文件清单（16 ≤ 20）

| 路径 | 子项 | 动作 |
|------|:----:|------|
| `backend/app/views/protocol.py` | VIEW-001 | 修改：`assert_protocol_version`、强化 `export_view_json_schema` |
| `backend/app/views/validate.py` | VIEW-001 | 修改：入口调用 protocol version guard |
| `backend/app/views/schemas.py` | VIEW-001 | 修改：`protocol_version` 校验错误码映射（若需） |
| `backend/app/api/v1/views.py` | VIEW-001 | 修改：新增 `GET /schema` |
| `tests/test_view_m5_protocol.py` | VIEW-001 | 修改：补 VIEW-001-04 破坏性 + schema API |
| `backend/app/core/nfr/dashboard_first_screen.py` | NFR-001 | 修改：`fixtureProfile` 常量 + probe 输出 |
| `tests/test_nfr_001_first_screen_smoke.py` | NFR-001 | 修改：断言扩展 widget fixture |
| `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx` | NFR-001 | 修改：per-type render-spec mock + 注释对齐 SRS 5s |
| `backend/app/governance/catalog/appendix_e.py` | GOV-001 | 新建：附录 E taxonomy 常量 + JSON schema |
| `backend/app/governance/catalog/models.py` | GOV-001 | 修改：扩展 SEED/VALID 至 CAT-01~07 |
| `backend/app/governance/catalog/schemas.py` | GOV-001 | 修改：`AppendixETaxonomyOut` 等 |
| `backend/app/governance/catalog/service.py` | GOV-001 | 修改：idempotent upsert seed；`get_appendix_e_taxonomy` |
| `backend/app/governance/catalog/probe.py` | GOV-001 | 新建：`probe_appendix_e_taxonomy_budget_ms` |
| `backend/app/api/v1/gov.py` | GOV-001 | 修改：`GET /catalog/appendix-e` |
| `tests/test_gov_001_catalog_appendix_e.py` | GOV-001 | 新建：taxonomy + probe + ACL |
| `docs/api/README.md` | 全部 | 修改：登记 `GET /views/schema`、`GET /gov/catalog/appendix-e` |

> P5 对账（非 P3 必改）：`docs/services/views.md`、`docs/services/governance.md`、`prd/F09-VIEW.md`、`prd/F15-NFR.md`、`prd/F10-GOV.md`。

## 4. 非目标（明确不做）

- M13 冻结项；Dataset 语义层（QUERY-009）；M7 连接器（CONN-004 等）
- CAT-001~007 分类 burst 专项（CAT-004~007 子域 API 已存在，本轮仅 taxonomy 枚举）
- GOV-002 总线 PoC 全链路；GOV-007 全自动注册
- 生产 TLS/全站 NFR（NFR-004）；报表 NFR-002；并发压测报告
- VIZ-005 筛选 UI（M11）；VIEW-002 defaultViewId；「全 BI 页面统一 DashboardView」
- 附录 E WS-01 对齐纪要；7 类 taxonomy **可配置** Admin UI（PRD 远期）
- 新增 Alembic migration（采用 idempotent upsert seed；无协议字段缺口）
- Playwright 真浏览器 perf；AntV L7 GIS

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维 | 本轮设计对策 |
|--------|--------|--------------|
| VIEW-001 | 用户价值 84%；完整度 96% | 扩展 widget field_rule 破坏性用例；`protocolVersion` 显式拒绝；`GET /schema` 可发现；dashboard round-trip 回归保留 |
| NFR-001 | 完整度 92%；性能 90% | probe 输出 `fixtureProfile` 含四类 widget；FE/BE smoke 同 fixture 标识；P95 ≤3000ms（vitest）+ budgetMs=5000（API）双轨可判 |
| GOV-001 | 用户价值 82%；性能 86% | 附录 E 七分法枚举 + 结构化 schema；`probe_appendix_e_taxonomy_budget_ms` ≤50ms；enterprise scope guard |

## 6. 架构设计

### 6.1 目标增量结构

```
backend/app/views/
├── protocol.py       # assert_protocol_version, export_view_json_schema
├── validate.py       # + protocol guard at entry
└── schemas.py        # (optional) error code doc

backend/app/api/v1/views.py   # + GET /schema

backend/app/core/nfr/
└── dashboard_first_screen.py # + M5_EXTENDED_WIDGET_FIXTURE profile

backend/app/governance/catalog/
├── appendix_e.py     # APPENDIX_E_TAXONOMY, export_schema()
├── models.py         # SEED_CATEGORIES CAT-01~07
├── schemas.py        # AppendixETaxonomyOut
├── service.py        # upsert seed, get_appendix_e_taxonomy
└── probe.py          # probe_appendix_e_taxonomy_budget_ms

tests/
├── test_view_m5_protocol.py
├── test_nfr_001_first_screen_smoke.py
└── test_gov_001_catalog_appendix_e.py   # NEW
```

### 6.2 VIEW-001 — FR-VIEW-1 收官

#### 6.2.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 补破坏性测试 + `GET /schema` + 显式 protocolVersion 守卫 | 闭合 plan 勾选；可测 | **采用** |
| B 独立 JSON Schema 文件与 Pydantic 双维护 | 漂移风险 | 否决 |
| C 新 views 存储表 | 超范围 | 否决 |

#### 6.2.2 protocolVersion 策略

- 常量：`VIEW_PROTOCOL_VERSION = 1`（已有）
- `assert_protocol_version(data)`：若 payload 含 `protocolVersion` 且 ≠ 1 → `ViewError("VIEW_PROTOCOL_UNSUPPORTED", ..., 422, [{"field":"protocolVersion",...}])`
- 缺省 `protocolVersion`：Pydantic default=1，行为不变
- `GET /api/v1/views/schema`：返回 `export_view_json_schema()`（Pydantic JSON Schema）；200；需鉴权（与 validate 一致）

#### 6.2.3 扩展 widget 破坏性用例（补 VIEW-001-04）

在 `test_view_m5_protocol.py` 新增/扩展：

| 用例 ID | 输入 | 期望 |
|---------|------|------|
| VIEW-001-04a | `heatmap` 仅 1 维 | 422 `CHART_FIELD_REQUIREMENT` + `detail.fields` 含 dimensions |
| VIEW-001-04b | `kpi` metrics=[] | 422 `CHART_FIELD_REQUIREMENT` + metrics |
| VIEW-001-04c | `timeline` dimensions=[] | 422 `CHART_FIELD_REQUIREMENT` |
| VIEW-001-04d | `protocolVersion: 2` | 422 `VIEW_PROTOCOL_UNSUPPORTED` |
| VIEW-001-04e | 扩展 widget + `colSpan: 3` | 422 `VIEW_LAYOUT_BOUNDS`（r31 回归） |
| VIEW-001-04f | `GET /api/v1/views/schema` | 200；`properties.protocolVersion` 存在 |
| VIEW-001-04g | `chartRef` 环（含 kpi widget） | 422 `VIEW_CHART_REF_CYCLE` |

保留既有 VIEW-001-01~05 与 dashboard PUT-GET round-trip。

#### 6.2.4 VIEW-001 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| VIEW-001-01 | 含四类 widget validate 200 | pytest（已有） |
| VIEW-001-02 | `round_trip_view_document` 等价 | pytest（已有） |
| VIEW-001-03 | 未知 chartType → 422 | pytest（已有） |
| VIEW-001-04 | field_rule / protocolVersion / bounds / cycle 破坏性 | pytest 新增 04a~04g |
| VIEW-001-05 | Dashboard PUT/GET + validate 一致 | pytest（已有） |
| VIEW-001-06 | `GET /views/schema` 可发现协议 | pytest |

### 6.3 NFR-001 — 首屏 perf smoke 收官

#### 6.3.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A probe 增 `fixtureProfile` + 测试断言同标识 | 闭合 plan；零 UI 行为变更 | **采用** |
| B 真实 Lighthouse/Playwright | 超预算 | 否决 |
| C 仅勾 plan 不改代码 | 不可验证 | 否决 |

#### 6.3.2 fixture 画像

`dashboard_first_screen.py` 新增：

```python
M5_EXTENDED_WIDGET_FIXTURE = {
    "id": "dash-m5-extended",
    "widgetTypes": ["map", "heatmap", "kpi", "timeline"],
    "widgetCount": 4,
}
```

`DashboardFirstScreenProbeOut` 增可选字段 `fixtureProfile: dict | None`（alias `fixtureProfile`）：

- 当 `dashboardId == "dash-m5-extended"` 或 `widgetCount == 4` 且 env `NFR001_FIXTURE_PROFILE=extended` 时填充
- 默认 probe 路径（`dash-probe`）行为不变，避免 r64/r67 回归

#### 6.3.3 FE perf smoke 薄改

`dashboard-first-screen.perf.smoke.test.tsx`：

- `mockApiFetch` 对 `/charts/render-spec` 按请求 body 的 `chartType` 返回对应 engine（map/heatmap→echarts，kpi 不走 render-spec）
- 文件头注释：vitest P95 3000ms 为 CI 稳定门槛；SRS/API `budgetMs` 默认 5000ms
- 不修改 `DashboardEditPage` 生产逻辑

#### 6.3.4 NFR-001 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| NFR-001-01 | 扩展 fixture probe withinBudget + fixtureProfile | pytest |
| NFR-001-02 | simulate_slow breach | pytest（已有） |
| NFR-001-03 | FE view 4 widget P95 ≤3000ms | vitest（已有，薄改 mock） |
| NFR-001-04 | r67 ACL/probe budget 回归 | 现有 `test_dash_nfr_conn_rpt_r67.py` 不回归 |

### 6.4 GOV-001 — 附录 E catalog L1

#### 6.4.1 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A `appendix_e.py` 静态七分法 + GET API + probe | 对齐 SRS 附录 E；L1 预算内 | **采用** |
| B 可配置 taxonomy DB + Admin UI | 超范围（PRD「7 类可配置」远期） | 否决 |
| C 仅扩 seed 无结构化 schema | 不满足「结构化 schema」验收 | 否决 |

#### 6.4.2 附录 E taxonomy 模型

`appendix_e.py` 定义 `APPENDIX_E_TAXONOMY: list[AppendixECategory]`（7 项，对齐 `docs/srs/附录E-7类查询接口清单.md` §一）：

| code | kind | 示例 API 模板 |
|------|------|---------------|
| CAT-01 | entity | `GET /api/v1/entities/{entityType}/{entityId}` |
| CAT-02 | aggregate | `GET /api/v1/stats/aggregate` |
| CAT-03 | geo | `GET /api/v1/geo/distribution` |
| CAT-04 | timeseries | `GET /api/v1/timeseries` |
| CAT-05 | ticket | `GET /api/v1/tickets/stats` |
| CAT-06 | production | `GET /api/v1/production/stats` |
| CAT-07 | audit | `GET /api/v1/workno/behavior` |

`export_appendix_e_schema()` 返回 JSON Schema（`$id: vitalspan://gov/appendix-e/v1`）描述 taxonomy 条目结构：`code`、`name`、`kind`、`description`、`exampleApi`、`status: "suggested"`。

#### 6.4.3 DB seed 扩展

`models.py` 扩展 `SEED_CATEGORIES` 与 `VALID_CATEGORY_CODES` 至 CAT-07。

`service.py` `_ensure_seed_categories` 改为 **idempotent upsert**：对 `APPENDIX_E_TAXONOMY` 中每个 code，若不存在则 INSERT；已存在则跳过（不覆盖 name，避免运维手改被抹除）。

`list_categories` 返回 7 项；`create_entry` 接受 CAT-04~07。

#### 6.4.4 API 与 probe

| 方法 | 路径 | 响应 |
|------|------|------|
| GET | `/api/v1/gov/catalog/appendix-e` | `{ appendix: "E", version: 1, taxonomy: [...], schema: {...} }` |
| GET | `/api/v1/gov/catalog/categories` | 7 项（既有，行为扩展） |

`probe.py`：

- `probe_appendix_e_taxonomy_budget_ms(actor)` → 调用 `get_appendix_e_taxonomy` 内存路径；`elapsed_ms < 50`

**ACL**（若适用）：`set_user_catalog_taxonomy_scope(user_id, allowed_prefix)` 模式对齐 NFR r67；`enterprise` 角色且 `catalogScope` 不匹配 → 403 `GOV_APPENDIX_E_FORBIDDEN`。admin/viewer 只读 GET 200。

#### 6.4.5 GOV-001 可测试验收标准

| ID | 验收项 | 判定方式 |
|----|--------|----------|
| GOV-001-01 | `GET /appendix-e` 返回 7 类 + schema | pytest |
| GOV-001-02 | `GET /categories` 含 CAT-01~07 | pytest |
| GOV-001-03 | 条目挂载 CAT-04 合法；CAT-99 → 400 | pytest |
| GOV-001-04 | `probe_appendix_e_taxonomy_budget_ms` ≤50ms | pytest |
| GOV-001-05 | enterprise 越权 scope → 403（若实现 ACL） | pytest |

## 7. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（已读 `SKILL.md` 核心规则与 `references/visual-language.md` 摘要）

### 7.1 页面信息架构

本轮 **不新增/修改生产页面路由**；仅触及 vitest perf smoke。

| 路由 | 模式 | 本轮变更 |
|------|------|----------|
| `/admin/dashboards/:id` | view | **无**生产 UI 变更；perf test 继续 mock `DashboardEditPage mode="view"` |

导航层级、主内容区 `max-w-(--breakpoint-2xl)`、空/加载/错误/权限态均沿用 M-FE-2/3 既有 `ChartPanel` + `ErrorBanner` 契约。

### 7.2 视觉层级

- 主操作：无变更
- 扩展 widget（map/heatmap/kpi/timeline）与基础 chart 共用 `ChartPanel` 卡片容器；KPI 走 `KpiCard` 指标数字层级（`text-2xl font-semibold`）
- perf smoke 仅验证 `aria-busy=false` 时机，不引入新视觉组件

### 7.3 组件映射

| 场景 | 复用 | 禁止 |
|------|------|------|
| Dashboard view perf | `DashboardEditPage`、`ChartPanel`、`KpiCard` | 页面内重写按钮/卡片 |
| 治理 taxonomy | 无 FE（本轮纯 API） | 新建 Admin taxonomy 页 |

### 7.4 Token 与密度

沿用 `fe/src/index.css` 语义 Token；perf test 不硬编码 hex。间距/圆角与 TailAdmin 卡片 `rounded-xl border border-gray-200` 一致。

### 7.5 响应式与可访问性

- perf smoke 默认 desktop viewport；不强制 mobile 截图（无 UI 变更）
- 保持 `aria-busy` 加载语义；键盘焦点无变更
- KPI 长数字：`tabular-nums` + 容器 `min-w-0 truncate`（已有 `KpiCard`）

### 7.6 视觉 QA 清单

| 检查项 | 方式 | 本轮 |
|--------|------|------|
| Desktop dashboard view 4 widget 加载完成 | vitest perf smoke 截图可选（非必须） | P3 若 FE 无漂移可 skip 截图 |
| Mobile viewport | 无变更 | N/A |
| 对齐/留白/层级 | 沿用 r216 DASH-003 基线 | 回归 vitest smoke |
| 色彩漂移 | `pnpm run check:design` | P4 全量 |

## 8. 错误码与 API 登记（增量）

| 码 | HTTP | 域 |
|----|------|-----|
| `VIEW_PROTOCOL_UNSUPPORTED` | 422 | views |
| `GOV_APPENDIX_E_FORBIDDEN` | 403 | gov（若 ACL 启用） |

`docs/api/README.md` 登记：

- `GET /api/v1/views/schema` — VIEW-001
- `GET /api/v1/gov/catalog/appendix-e` — GOV-001

## 9. 测试策略

```bash
# 后端增量
cd backend && pytest tests/test_view_m5_protocol.py tests/test_nfr_001_first_screen_smoke.py tests/test_gov_001_catalog_appendix_e.py -q

# 前端 perf smoke
cd fe && pnpm exec vitest run src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx

# 回归（P4 全量）
cd backend && pytest tests/test_view_gov_api_r31.py tests/test_dash_nfr_conn_rpt_r67.py -q
```

## 10. P5 对账预期

| 文档 | 更新 |
|------|------|
| `plan.md` | 勾选 M5 VIEW-001、M6 NFR-001、GOV-001 |
| `prd/F09-VIEW.md` | VIEW-001 验收补勾 destructive/schema；状态→已实现（companion 收官） |
| `prd/F15-NFR.md` | NFR-001 勾 plan 对应项；保留并发压测 `[ ]` |
| `prd/F10-GOV.md` | GOV-001 勾附录 E L1；保留「7 类可配置」「WS-01」`[ ]` |
| `docs/services/governance.md` | In：附录 E taxonomy GET；依赖不变 |

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 已有 DB 仅 3 类 seed | idempotent upsert 补 CAT-04~07 |
| `protocolVersion` Literal 与显式守卫重复 | 守卫先于 Pydantic，统一错误码 |
| perf P95 CI 抖动 | 保持 mock 即时返回；5 样本 P95；阈值 3000ms |
| 附录 E 与 WS-01 未对齐 | `status: "suggested"` + 文档注明 L1 stub |

---

**Spec self-review**：无 TBD/TODO；覆盖 round-target 三项；文件数 16；未超范围框定；未含生产代码。
