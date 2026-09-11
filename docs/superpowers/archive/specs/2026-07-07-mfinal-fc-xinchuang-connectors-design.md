# Design Spec: M-FINAL · F-C 批次 1 — 信创连接器 companion 收官（CONN-017~021）

```yaml
date: 2026-07-07
round: r242
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fc.md
prd_ids: [CONN-017, CONN-018, CONN-019, CONN-020, CONN-021]
phase: P1
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
scope_file_count: 16
```

---

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | `type` | 默认端口 | 协议委托 | 执行顺序 | 主攻薄弱维 |
|---|------|--------|--------|----------|----------|:--------:|------------|
| 1 | 达梦 DM companion | CONN-017 | `dm` | 5236 | dmPython（Oracle 风格） | 1 | 用户价值 84%→Admin 可选；性能 88%→只读探针 |
| 2 | 人大金仓 companion | CONN-018 | `kingbase` | 54321 | PostgreSQL | 2 | 用户价值 84%；安全性 88%→凭证不落日志 |
| 3 | 南大通用 GBase companion | CONN-019 | `gbase` | 5258 | MySQL | 3 | 用户价值 84%；完整度 90%→PRD 可勾 |
| 4 | OceanBase companion | CONN-020 | `oceanbase` | 2881 | MySQL | 4 | 用户价值 84%；性能 88%→分布式只读探针 |
| 5 | TiDB companion | CONN-021 | `tidb` | 4000 | MySQL | 5 | 用户价值 84%；完整度 90%→与 mysql 类型区分 |

**共享范式**（对齐 M11 batch1 CONN-009~013 / r235）：后端 L1 已注册 → 本轮补 `probe_readonly_sql` + pytest 集成套件 + `DatasourceFormPage` 字段 hints + types catalog 断言 + 文档锚点；compose 真机可选 skip。

**依赖链**：五方言 `probe_readonly_sql`（或模块级 helper）→ `tests/test_mfinal_fc_r242.py` 新建（≥25 断言）→ FE hints + smoke → `docs/api` + `docs/services/datasources.md` 状态同步 → r38~r67 既有套件全量回归。

**STUCK**：五 ID 均为 F-C 首次入选，无连续未过轮次。

---

## 2. 上下文与问题陈述

### 2.1 当前痛点

| 连接器 | 后端 L1 | PRD 未勾项 | FE 缺口 |
|--------|---------|-----------|---------|
| DM (`dm.py`) | r38+r39 mock/HTTP 链完整 | UI 可选、只读查询 | `CONNECTOR_FIELD_HINTS` 无 `dm`；types API 有但表单默认 port 仍为 3306 |
| Kingbase (`kingbase/`) | r59+r67 params/probe | UI 可选、schema+只读集成测 | 无 hints；默认 port 不匹配 54321 |
| GBase (`gbase.py`) | r46+r51 companion | UI 可选、只读集成测 | 无 hints |
| OceanBase (`oceanbase.py`) | r54+r55 companion | UI 可选、只读集成测 | 无 MySQL 兼容模式说明 |
| TiDB (`tidb.py`) | r34+r35 companion | UI 可选、只读集成测 | 无 hints；与 mysql 类型在 UI 上无差异化提示 |

`GET /api/v1/datasources/types` 已含五型（`export_type_catalog`）；缺口为 **浏览器可选验收** 与 **只读 SQL 探针集成测**。

### 2.2 方案对比（已选推荐项）

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A（推荐） | 连接器级 `probe_readonly_sql` + mock pytest + readonly-guard HTTP；FE 扩 `CONNECTOR_FIELD_HINTS` | 与 r235 TimescaleDB / r236 nosql probe 同范式；不触 `query/dialects` | 不覆盖 `POST /query/execute` 真执行 | **选用** |
| B | 同步扩展 `query/dialects/__init__.py` 别名 + execute_sql 集成 | PRD「只读查询」字面更完整 | 超 round-target 模块框定（`query/` 未列入）；DM 分页方言需额外设计 | **非目标（留 F-D）** |
| C | 仅 FE hints，不测 probe | 改动最小 | 无法满足 plan F-C 与 PRD 只读集成测勾选 | 否决 |

---

## 3. 范围框定

### 3.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| 方言 companion | `backend/app/datasources/dialects/` | 五型 `probe_readonly_sql` |
| 集成测 | `tests/` | `test_mfinal_fc_r242.py` + 可选 `conftest` 注释 |
| Admin FE | `fe/src/pages/admin/datasources/` | hints + smoke |

### 3.2 文件列表（16）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/datasources/dialects/dm.py` | CONN-017 | 新增 `probe_readonly_sql`（`SELECT 1 FROM DUAL`） |
| `backend/app/datasources/dialects/kingbase/connector.py` | CONN-018 | 新增 `probe_readonly_sql`（`SELECT 1` via psycopg） |
| `backend/app/datasources/dialects/gbase.py` | CONN-019 | 新增 `probe_readonly_sql`（委托 inner cursor） |
| `backend/app/datasources/dialects/oceanbase.py` | CONN-020 | 新增 `probe_readonly_sql` |
| `backend/app/datasources/dialects/tidb.py` | CONN-021 | 新增 `probe_readonly_sql` |
| `tests/test_mfinal_fc_r242.py` | 全部 | **新建** ≥25 用例（types + probe + readonly-guard + HTTP test 无密码） |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | 全部 | 扩展 `CONNECTOR_FIELD_HINTS` + OceanBase 辅助说明 |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | 全部 | **新建** 五型 types 下拉 + port 默认值 smoke |
| `docs/api/README.md` | 全部 | 五型 FE 可选 + probe 锚点一行 |
| `docs/services/datasources.md` | 全部 | companion r242 状态、probe 登记 |
| `docs/automate/prd/F04-CONN.md` | CONN-* | **P5 对账**（非 P3） |

**不在范围**：CONN-022 GaussDB；F-G CONN-023~027；`query/dialects` 别名；Dataset 路径；compose 信创真机镜像；`backend/app/query/` 执行链改动；新增 HTTP 路由。

---

## 4. 后端设计

### 4.1 `probe_readonly_sql` 契约

对齐 `TimescaledbConnector.probe_readonly_sql`（r235 T-CONN-R235-013-04）：

```python
def probe_readonly_sql(self, connection: Any) -> bool:
    """Execute minimal read-only probe; return True on success."""
```

| 连接器 | SQL 探针 | 连接 API |
|--------|----------|----------|
| DM | `SELECT 1 FROM DUAL` | `connection.cursor().execute(...)` |
| Kingbase | `SELECT 1` | `connection.execute("SELECT 1")`（psycopg） |
| GBase / OceanBase / TiDB | `SELECT 1` | `connection.cursor().execute("SELECT 1")`（pymysql 委托） |

**实现策略**：GBase/OceanBase/TiDB 可复用同一 3 行实现（inner pymysql connection）；不新建独立 `relational_probe.py` 包（避免超目录文件数；三处复制 ≤6 行可接受）。

**错误处理**：probe 内不吞异常；测试侧 mock 成功路径；异常路径由单独用例 assert `False` 或让 mock 抛错（可选 1 条/型）。

### 4.2 集成测 `test_mfinal_fc_r242.py`

**标记**：`pytestmark = [pytest.mark.integration]`（与 r235 一致）。

**夹具**：复用 module 级 sqlite meta env 模式（照抄 `test_connectors_m11_r235.py` 的 `r235_sqlite_env` 结构，命名 `r242_sqlite_env`）；**不**扩展 `m11_compose_env`（信创库无标准 compose 端口）。

**用例矩阵**（每型 ≥5 条，合计 ≥25）：

| ID 模式 | 断言 |
|---------|------|
| T-CONN-R242-017-01 | `export_type_catalog` 含 `dm`，`displayName` 含「达梦」，`category=relational` |
| T-CONN-R242-017-02 | mock dmPython cursor → `DmConnector().probe_readonly_sql(conn)` True；`execute` 调 `SELECT 1 FROM DUAL` |
| T-CONN-R242-017-03 | `POST /datasources/test` type=dm mock 失败 → 响应无 `password` 字段 |
| T-CONN-R242-017-04 | `POST /query/readonly-guard` connectorType=dm sql=`SELECT 1` → 200 ok mode=sql |
| T-CONN-R242-018-01~04 | Kingbase types + probe + params 422 链（复用 r67 `KINGBASE_INVALID_PARAMS`）+ readonly-guard |
| T-CONN-R242-019-01~04 | GBase types + probe + HTTP test 无密码 + readonly-guard |
| T-CONN-R242-020-01~05 | OceanBase types + probe + 空 schema 注释回归（r55）+ readonly-guard + `probe_test_connection_budget_ms` 常量存在 |
| T-CONN-R242-021-01~05 | TiDB types + probe + 与 mysql 类型 key 不等 + readonly-guard + mock `TIDB_AUTH_FAILED` 回归 |

**可选 compose live**：每型 1 条 `@pytest.mark.integration` + `pytest.skip("xinchuang DB not in compose")` 占位并注释理由（与 round-target「compose 或 skip」一致）；**禁止**因无环境导致 CI 红。

**回归闸门**：`pytest tests/test_query_meta_conn_r38.py tests/test_meta_cat_dash_conn_design_r59.py tests/test_nfr_gov_conn_r46.py tests/test_rpt_gov_meta_conn_r55.py tests/test_connectors_gov_r34.py` 全绿；`ruff check backend tests`。

### 4.3 凭证 / RLS / 安全（不变）

- 沿用 Fernet 加密与 `decrypt_credential`；HTTP test/create 响应 JSON **不得**含 `password`。
- ACL / RLS 链与既有 DS CRUD 一致；本轮不修改 `auth/` 或 `acl.py`。

---

## 5. 子项验收标准（可测试）

### CONN-017 达梦 DM

| # | 验收 | 验证方式 |
|---|------|----------|
| 1 | `GET /datasources/types` 含 `dm` | T-CONN-R242-017-01 |
| 2 | DatasourceForm 可选达梦，port 默认 5236 | FE smoke T-CONN-R242-FE-017 |
| 3 | `probe_readonly_sql` mock 成功 | T-CONN-R242-017-02 |
| 4 | readonly-guard dm + SELECT 1 | T-CONN-R242-017-04 |
| 5 | test 响应无密码泄露 | T-CONN-R242-017-03 |
| 6 | PRD「UI 可选」「只读查询集成测」可勾 | P5 对账 |

### CONN-018 人大金仓

| # | 验收 | 验证方式 |
|---|------|----------|
| 1 | types 含 `kingbase` | T-CONN-R242-018-01 |
| 2 | Form port 54321 + 可选 | FE smoke |
| 3 | probe + schema 元数据 mock 回归（r59 套件不回归失败） | 全量 pytest |
| 4 | params 422 `KINGBASE_INVALID_PARAMS` 仍有效 | T-CONN-R242-018-03 |
| 5 | readonly-guard kingbase | T-CONN-R242-018-04 |

### CONN-019 南大通用 GBase

| # | 验收 | 验证方式 |
|---|------|----------|
| 1 | types + Form port 5258 | catalog + FE smoke |
| 2 | probe_readonly_sql | T-CONN-R242-019-02 |
| 3 | 连通性 pytest + HTTP 链 | r46/r51 回归 + r242 HTTP |
| 4 | 不扩写入/同步路径 | 代码审查：无 ingestion 改动 |

### CONN-020 OceanBase

| # | 验收 | 验证方式 |
|---|------|----------|
| 1 | types + Form port 2881 + 租户提示文案 | catalog + FE |
| 2 | probe + readonly-guard | r242 |
| 3 | Form hints 说明 MySQL 兼容模式差异 | FE：databaseLabel「租户/数据库」+ `description` 辅助行 |
| 4 | r55 边界回归 | pytest r55 全绿 |

### CONN-021 TiDB

| # | 验收 | 验证方式 |
|---|------|----------|
| 1 | types 含独立 `tidb`（非 mysql） | T-CONN-R242-021-01 |
| 2 | Form port 4000 | FE smoke |
| 3 | probe + readonly-guard | r242 |
| 4 | 与 CONN-001 mysql 类型不混淆 | Select 同时含 mysql 与 tidb 两项 |

---

## 6. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 6.1 页面信息架构

| 项 | 规格 |
|----|------|
| 路由 | `/admin/datasources/new` · `/admin/datasources/:id/edit`（既有 `DatasourceFormPage`） |
| 导航层级 | Admin 壳层 → 数据 → 数据源列表 → 新建/编辑 |
| 主内容区 | `AdminPageShell` + `Card max-w-2xl mx-auto`（与现页一致，禁止扩宽） |
| 空态 | types API 失败时 Select 回退 `[{ type: "mysql", displayName: "MySQL" }]`（保持现状） |
| 加载态 | edit 模式 `Skeleton h-64`（保持现状） |
| 错误态 | 表单顶 `border-error-500 bg-error-50` 告警条 + `mapApiError` 中文 |
| 权限态 | 路由层 `RequirePlatformAdmin`（既有）；本轮不新增 capability 项 |

### 6.2 视觉层级

| 元素 | 承载 | 规则 |
|------|------|------|
| 主操作 | 「保存」`Button variant="primary"` 表单底全宽 | 唯一 primary |
| 次操作 | 「返回列表」`Button variant="outline"` 在 `AdminPageShell.actions` | 不抢主操作 |
| 表单字段 | `Card` > `grid gap-4` > `Label` + `Input`/`Select` | 禁止裸 div 堆输入 |
| 类型说明 | OceanBase：类型 Select 下方 `text-theme-sm text-gray-500` 一行辅助文案 | 非 Alert，避免恐吓式错误色 |
| 高级选项 | `Collapsible` 描述字段 | 保持现有折叠模式 |

### 6.3 组件映射

| 需求 | 组件 | 禁止 |
|------|------|------|
| 类型下拉 | 既有 `Select` + `SelectItem` | 手写 dropdown |
| 端口/库名 | 既有 `Input` + `Label` | 原生 input |
| 辅助说明 | `p.text-theme-sm.text-gray-500.dark:text-gray-400` | 新建 Alert 组件 |
| 测试 | vitest + RTL smoke | E2E 浏览器 |

**复用**：`AdminPageShell`、`Card`、`Input`、`Select`、`Button`、`Skeleton`、`Collapsible`（均已存在）。

**补封装**：无；仅扩展 `CONNECTOR_FIELD_HINTS` 常量对象。

### 6.4 Token 与密度

- 间距：字段 `gap-4`；host/port 行 `sm:grid-cols-2`
- 圆角：Card 默认；错误条 `rounded-xl`
- 字号：标签 `Label` 默认；辅助文案 `text-theme-sm`
- 色：语义 error 仅用于提交失败；辅助说明用 `gray-500`
- 图标：Collapsible `ChevronDown size-4`（保持）
- 提交前：`pnpm run check:design` 无新增 hex 硬编码

### 6.5 `CONNECTOR_FIELD_HINTS` 增量

```typescript
const CONNECTOR_FIELD_HINTS: Record<string, { port: string; databaseLabel: string; usernameLabel: string }> = {
  // 既有 mongodb / elasticsearch / opensearch …
  dm: { port: "5236", databaseLabel: "库/模式（OWNER）", usernameLabel: "用户名" },
  kingbase: { port: "54321", databaseLabel: "数据库", usernameLabel: "用户名" },
  gbase: { port: "5258", databaseLabel: "数据库", usernameLabel: "用户名" },
  oceanbase: { port: "2881", databaseLabel: "租户/数据库", usernameLabel: "用户名" },
  tidb: { port: "4000", databaseLabel: "数据库", usernameLabel: "用户名" },
};
```

**类型切换行为**：`onValueChange` 已根据 hints 重置 `port`；五型加入后自动生效。

**OceanBase 辅助文案**（`form.type === "oceanbase"` 时渲染）：

> 使用 MySQL 兼容协议连接；集群部署请填写 OBProxy 主机与租户名。

### 6.6 响应式与可访问性

| 项 | 策略 |
|----|------|
| 桌面 | `max-w-2xl` 居中单列表单 |
| 窄屏 | host/port `sm:grid-cols-2` 降为单列（Tailwind 默认堆叠） |
| 焦点 | Radix Select/Input 保留 focus-visible ring |
| aria | 既有 `htmlFor`/`id` 配对；辅助文案用 `id="oceanbase-hint"` + `aria-describedby` 挂到 database Input |
| 长文本 | displayName 在 SelectItem 内单行；溢出 `truncate` |

### 6.7 视觉 QA 清单

| 场景 | 检查项 |
|------|--------|
| Desktop 1280px | 五型在 Select 中可见；选 oceanbase 见辅助文案；port 随类型切换 |
| Mobile 375px | 字段无横向溢出；保存按钮不被键盘遮挡（现有布局） |
| Dark | 辅助文案 `dark:text-gray-400`；错误条 dark 变体 |
| 状态 | 提交中按钮「保存中…」disabled；edit 密码留空提示不变 |

**截图**：headless 云环境以 RTL smoke 代替；P4 记录 `screenshots 未运行` 若仍无浏览器。

### 6.8 FE Smoke `datasource-form.smoke.test.tsx`

| ID | 断言 |
|----|------|
| T-CONN-R242-FE-01 | mock types 含五型 + mysql；Select 渲染 displayName |
| T-CONN-R242-FE-02 | 选 `tidb` → port input value `4000` |
| T-CONN-R242-FE-03 | 选 `dm` → database label 含「OWNER」 |
| T-CONN-R242-FE-04 | 选 `oceanbase` → 辅助文案可见 |

---

## 7. PRD 8 维薄弱项对齐

| PRD ID | 选题时薄弱维 | 本轮设计对齐 |
|--------|-------------|-------------|
| CONN-017 | 用户价值 84%、性能 88% | FE 可选 + probe 计时可选断言 latency 字段存在 |
| CONN-018 | 用户价值 84%、安全性 88% | FE 可选 + HTTP 响应无密码 + r67 params 回归 |
| CONN-019 | 用户价值 84%、完整度 90% | 全验收勾选项可测试闭合 |
| CONN-020 | 用户价值 84%、性能 88% | probe + r55 perf 常量回归 |
| CONN-021 | 用户价值 84%、完整度 90% | 独立 tidb 类型 UI + 全套 pytest |

**预期 hub 提升**：用户价值维 +2~4 分/ID（UI 可浏览器验收）；完整度 +1~2（只读集成测可勾）；测试覆盖维持 ≥98%。

---

## 8. 非目标

- CONN-022 GaussDB（F-C 批次 2）
- F-G CONN-023~027
- `query/dialects` 注册 tidb/dm 等 → `execute_sql` 真执行（留 F-D QUERY 路径）
- compose 信创数据库容器
- 数据源详情页 / 元数据浏览 UI 改动
- 修改 `plan.md` / `goal.md` 结构（P5 勾选条目）

---

## 9. 整体验收信号

```
GET /api/v1/datasources/types  → dm, kingbase, gbase, oceanbase, tidb
DatasourceFormPage             → 五型可选、port/label hints、OceanBase 说明
pytest test_mfinal_fc_r242.py  → ≥25 passed；全量回归无退化
fe vitest datasource-form.smoke → 4/4
check:design                   → PASS
docs/api + services            → 锚点与「companion r242」状态
```

**下轮建议**：F-C 批次 2 → CONN-022 GaussDB 单 ID。

---

## 10. Spec Self-Review

- [x] 覆盖 round-target 五子项
- [x] 文件列表 16 ≤ 18，模块 3
- [x] 无 TBD/TODO
- [x] UI 设计交付完整；ui_design_skill 已声明
- [x] 未要求生产代码
