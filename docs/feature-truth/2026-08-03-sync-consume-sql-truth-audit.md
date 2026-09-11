# Feature Truth Audit: 同步消费链 · SQL 查 orders_clean

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 核验范围 | 同步成功后，登记分析库 → `POST /api/v1/query/execute` 执行 `SELECT * FROM "orders_clean"` 是否真通且结果正确 |
| 锚点 | `localhost:5433/analytics.orders_clean` · `/api/v1/query/execute` · `SyncJobConsumeGuide.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8/10 · B** |
| 状态 | draft |
| **sampling** | `full`（用户问句 + `/feature-truth-verify`，非抽样） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 同步任务成功后，分析库 `5433/analytics` 存在表 `orders_clean`，行数与 `rows_synced` 一致 | 用户指南 · 上轮修复验证 |
| T2 | 登记 PostgreSQL 分析库后，`POST /api/v1/query/execute` 执行 `SELECT * FROM "orders_clean"` 返回 200，列与行内容与 PG 直查一致 | **用户原问** |
| T3 | 无引号写法 `SELECT * FROM orders_clean` 同样可用（小写表名） | PG 标识符规则 · 引导文案对照 |
| T4 | Schema 浏览器能列出 `orders_clean` | 数据源管理 UX |
| T5 | `SyncJobConsumeGuide` 展示 SQL 示例与「登记分析库」「打开仪表板」链接 | 消费引导 PRD/计划 C |
| T6 | 图表/仪表板 UI 绑定该数据源并渲染出图 | 引导第 2–3 步（完整 BI 消费） |

- 非目标：增量/全量同步逻辑复验（见 `2026-08-03-sync-jobs-deliverable-truth-audit.md`）；E2E 浏览器走查整页出图

## 2. 完整链路图

```
同步 run 成功 → sync_write → analytics PG orders_clean
  → 用户登记 PG 5433 数据源 → query/execute(SQL)
  → 返回 columns+rows → （未验）图表/仪表板渲染
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 数据落库 | **通** | `scripts/truth_verify_sync_consume.py` PG probe | 5 行，5 列 |
| 2 | 数据源登记 | **通** | 同上 · POST `/api/v1/datasources` 201 | 需 `code` 字段 |
| 3 | 查询协议 | **通** | 同上 · 3 种 SQL 均 200 | 含双引号表名 |
| 4 | Schema 浏览 | **通** | GET `.../tables?schema=public` | 含 `orders_clean` |
| 5 | FE 引导 | **通** | vitest `SyncJobsPage_shows_consume_guide_after_success` | mock API |
| 6 | 图表/仪表板 | **断** | 未做 UI/BROWSER | T6 NONE |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 分析库表存在且行数正确 | **REAL** | 10/A | PG 直查 count=5 |
| T2 | 双引号 SQL 经 API 真通 | **REAL** | 10/A | execute 返回 5 行 |
| T3 | 无引号 SQL 等价 | **REAL** | 10/A | 同上 |
| T4 | Schema 浏览器 | **REAL** | 9/A | tables 含 orders_clean |
| T5 | 消费引导 FE | **REAL** | 8/B | smoke 2 用例通过 |
| T6 | 图表/仪表板出图 | **UNVERIFIED** | —/— | 未验 |

## 3b. 前端控件下钻表（SyncJobConsumeGuide + 列表入口）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 深度 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|------|
| B1 | 链接「数据连接 → 新建」 | `Link /admin/datasources/new` | href 正确 | `/admin/datasources/new` | 2 | 2 | — | — | 2 | 8 | REAL | UI | smoke 登记分析库 link |
| B2 | SQL 示例 code 块 | 静态 `sqlExample` | 展示 `SELECT * FROM "orders_clean"` | 与源码一致 | 2 | 2 | — | — | 2 | 8 | REAL | UI | `SyncJobConsumeGuide.tsx:17` |
| B3 | 链接「分析 → 仪表板」 | `Link /admin/dashboards` | href 正确 | 源码 `/admin/dashboards` | 2 | 2 | — | — | 2 | 8 | REAL | UI | 源码 |
| B4 | 按钮「登记分析库」 | `Button asChild` | 同 B1 | smoke 通过 | 2 | 2 | — | — | 2 | 8 | REAL | UI | `shows_consume_guide_after_success` |
| B5 | 按钮「打开仪表板」 | `Button asChild` | `/admin/dashboards` | 源码一致 | 2 | 2 | — | — | 2 | 8 | REAL | UI | 源码 |
| B6 | 列表「下一步：出图指引」 | `SyncJobsTable` Link | 跳转编辑/历史 | 源码有链接 | 1 | 1 | — | — | 1 | 4 | STUB | GATE | 仅源码，无 click 测 |

Out：空态第 4 步文案（B7，已由 `SyncJobsEmptyState_shows_consume_step` 覆盖，同 T5）

功能块映射：T2/T3 → API 链；T5 → B1–B5；T6 → （未映射 FE 控件）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| E1-pg-orders_clean | 数据 | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | PG probe count=5 |
| E2-sql-unquoted | SQL | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | execute 5 rows |
| E3-sql-quoted | SQL | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | execute 5 rows |
| E4-sql-count | SQL | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | cnt=5 |
| E5-datasource-create | API | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | POST 201 |
| E6-schema-tables | API | — | ✅ | — | — | CHAIN | 2 | 2 | REAL | orders_clean listed |
| E7-consume-guide-render | FE | — | — | ✅ | — | UI | 2 | 2 | REAL | vitest 2 passed |
| E8-chart-bind | BI | ❌ | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 未验 |
| E9-dashboard-publish | BI | ❌ | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 未验 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 9 |
| GATE only | 0 |
| CHAIN | 6 |
| UI | 1 |
| BROWSER | 0 |
| NONE（未验） | 2（E8/E9 图表仪表板） |
| REAL 达标 | 7/9 |
| **逐一校验** | **否** — SQL/查询链 7/7 已验；图表/仪表板 UI 未验 |
| 总体可否 REAL | **否** — T6 NONE；scope 总体 PARTIAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T2（用户核心问） | 2 | 2 | 2 | 2 | 2 | 10 | A | **REAL** | 双引号 SQL 真通 |
| T5 | 2 | 2 | — | — | 2 | 8 | B | REAL | smoke 非真机 |
| T6 | 0 | 0 | 0 | — | — | 0 | F | UNVERIFIED | 未验 |
| **scope 总体** | 2 | 2 | 2 | 2 | 2 | **8** | **B** | **PARTIAL** | SQL 链 REAL；BI 出图未闭环 |

**打通但不对**：0  
**假功能（STUB/BROKEN）**：B6（列表链接仅 GATE）

评分细则：feature-truth-verify scoring-rubric

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | PG 直查 `orders_clean` | 表存在，5 行，5 列 | count=5；列 id/product_name/amount/status/note | ✅ | `truth_verify_sync_consume.py` 2026-08-03 |
| 2 | PG 直查 `"orders_clean"` | 与无引号同 count | quoted_count=5 | ✅ | 同上 |
| 3 | 登记分析库 POST datasources | 201，可连接 5433 | 201 id=5eca1f2e-… | ✅ | 同上 |
| 4 | execute `SELECT * FROM orders_clean` | 200，5 行，列一致 | columns 5，rows 5 | ✅ | 同上 |
| 5 | execute `SELECT * FROM "orders_clean"` | 200，5 行，列一致 | columns 5，rows 5 | ✅ | 同上 |
| 6 | execute `SELECT COUNT(*) AS cnt` | cnt=5 | [5] | ✅ | 同上 |
| 7 | schema tables | 含 orders_clean | ['orders_clean'] | ✅ | 同上 |
| 8 | vitest consume guide | 引导文案+链接 | 2 tests passed | ✅ | `ingestion.smoke.test.tsx` |
| 9 | 图表绑定 SQL 出图 | 表/柱图可见 | **未执行** | ❌ | — |

### 命令输出摘要

```text
python scripts/truth_verify_sync_consume.py → exit 0
  pg_count=5, sql_variants_ok=3/3, orders_clean_in_schema_browser=true

npx vitest run ... -t "SyncJobsPage_shows_consume_guide|SyncJobsEmptyState_shows_consume"
  2 passed
```

## 5. 修复文档

### T6 — 图表/仪表板出图（E8/E9）

**判定 / 得分**：UNVERIFIED 0/10  
**期望 vs 实际**：引导承诺「新建图表 → 选数据源 → SQL → 加入仪表板」；本轮仅验到 query/execute，未在 UI 创建图表/widget。  
**根因**：truth 范围停在 API；无浏览器走查。  
**修复方向**：可选补 E2E 或手工剧本；非 SQL 可用性阻塞。  
**优先级**：P1（产品闭环）；**不阻塞**用户原问「SQL 能否这么写」。

### B6 — 列表「下一步：出图指引」

**判定**：STUB 4/10（GATE-only）  
**修复方向**：补 vitest 断言 href/导航目标。  
**优先级**：P2

### 文档/引导（非 bug，可选优化）

**观察**：`SyncJobConsumeGuide` 示例为 `SELECT * FROM "orders_clean"`（双引号）。  
**事实**：小写表名在 PG 中**无引号与双引号等价**；本轮两种写法 API 均 200。  
**可选优化**：示例改为 `SELECT * FROM orders_clean` 或并列两种写法，降低新手对引号的困惑。  
**优先级**：P2 文案

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T6 | 补图表/仪表板 UI 或 E2E 消费闭环 |
| P2 | B6 | 列表出图指引链接补 UI 测试 |
| P2 | B2 | SQL 示例可简化为无引号或加注说明 |

## 7. 交接

- **用户原问结论**：**可以。** `SELECT * FROM "orders_clean"` 与 `SELECT * FROM orders_clean` 在已同步、已登记分析库的前提下均经 live API 验证通过，返回 5 行、列与 PG 直查一致。
- 前置条件：① `analytics-postgres:5433` 运行；② 同步任务已成功写入；③ 在「数据连接」登记 PG（127.0.0.1:5433/analytics，用户/密码 vitalspan）。
- 建议：`仅报告` / 批准修 P2 文案 / 交接 `root-first-solve` 补 T6 E2E
- 用户批准修复：**否**
