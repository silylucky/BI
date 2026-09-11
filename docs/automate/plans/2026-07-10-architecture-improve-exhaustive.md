# 全仓架构改进计划（穷举问题清单 + 分阶段治理）

日期：2026-07-10  
触发：`/improve-codebase-architecture`  
输入：
- arch-inspect `scan-20260710T071909`（健康分 76 / 369 项 / 门禁阻断）
- FE 穷举扫描（[FE explore](37752d25-4344-400e-b639-bdecab9058d6)）
- BE 穷举扫描（[BE explore](2b9c7905-b397-43ef-9d76-f1570a0fdd86)）

> **原则**：不人为截断到 20–30 条；同类问题可合并编号但不得丢类。  
> **处置顺序**：P0 真 bug / 安全 → P1 假能力与 ACL → P2 体量/重复 → P3 清理。

---

## 0. 总览

| 来源 | 规模 | 说明 |
|------|------|------|
| arch-inspect | **369**（P1 306 + P2 63） | 以 `api.doc_consistency` 路径参数/文档漂移为主 |
| FE 手工穷举 | **AD-001 ~ AD-114**（114） | 死代码、God 文件、RBAC、mock、测试缺口 |
| BE 手工穷举 | **BE-001 ~ BE-170**（约 170） | InMemory、probe、分层、SQL/ACL、migration |
| **合计（去重前）** | **~650+** | 文档漂移与分层项与 arch-inspect 大量重叠 |

### 可交付相关（与刚合入的 M-DEPTH 对照）

| 已缓解 | 仍开 |
|--------|------|
| Dataset 内存 → ORM（T1） | 报表/实体/物理表/调度等仍 InMemory |
| 筛选器假控件（T2） | Dashboard CRUD 无所有权 ACL（R0 已补最小读 ACL） |
| 报表静默 mock（T3） | honesty gate 空壳（R0 已实装） |
| 治理默认隐藏（T4） | EmbedChartPage stub；SharePage layout（R0 已修） |
| **连接器 30 型已注册** | **仅 6 型查询主路径可用**；24 型「连接侧 only」见 §8 |

---

## 1. P0 — 必须立刻修（真 bug / 安全 / 交付门禁失效）

| ID | 域 | 问题 | 证据 |
|----|-----|------|------|
| P0-01 | FE | **DashboardSharePage 读错字段**：`layout.widgets` vs API `layoutJson` → 分享页恒空 | `DashboardSharePage.tsx` |
| P0-02 | BE | **主题 drill SQL 拼接注入**：`f"{k} = '{v}'"` | `dashboard/theme/query.py` |
| P0-03 | BE | **Dashboard CRUD 无所有权/角色 ACL** | `dashboard/service.py` |
| P0-04 | BE | **Dataset get 无读权限 / allowed_roles 未强制** | `metadata/dataset/service.py` |
| P0-05 | BE | **实体类型 / 物理表仍 InMemory**（重启丢） | `entity/service.py` · `physical/service.py` |
| P0-06 | BE | **报表目录/调度/模板/扩展/预制 全 InMemory** | `reports/{catalog,scheduler,templates,extension,prefab}` |
| P0-07 | TEST | **`test_delivery_honesty_gate.py` 为空壳 `assert True`** | 交付门禁失效 |
| P0-08 | MIG | **无 physical/entity/reports 相关 Alembic** | migrations 仅至 0023 datasets |

---

## 2. P1 — 高优先级（假能力、ACL、分层、关键路径）

### 2.1 客户路径假能力 / stub

| ID | 问题 | 路径 |
|----|------|------|
| P1-FE-01 | EmbedChartPage 硬编码 funnel/SQL/假 dataSourceId | `embed/EmbedChartPage.tsx` |
| P1-FE-02 | Embed 用自身 origin 校验，非 parent | 同上 |
| P1-FE-03 | ReportExportCard 硬编码 template UUID | `ReportExportCard.tsx` |
| P1-BE-01 | 嵌入 token / 导出任务 / 执行历史 InMemory | `embed_token.py` · `reports_export.py` · `executor.py` |
| P1-BE-02 | 用户视图覆盖 InMemory（role defaults 已 ORM） | `views/store.py` |
| P1-BE-03 | 总线默认 InMemoryBusPoCAdapter | `governance/catalog/service.py` |
| P1-BE-04 | CAT02/07 POC 种子数据当查询结果 | `cat02/query.py` · `cat07/service.py` |
| P1-BE-05 | lineage_stub | `physical/gov_refs.py` |
| P1-BE-06 | 11+ gov `*-probe` + 全套 nfr probe 挂在 `/api/v1` | `gov.py` · `nfr.py` |
| P1-BE-07 | `X-Rpt-Execute-Mock` / `mock_execute_schedule` 仍可达 | `reports/__init__.py` |
| P1-BE-08 | **生产代码** `unittest.mock`（kingbase probe） | `dialects/kingbase/probe.py` |
| P1-BE-09 | native executor 多数 `not implemented` | `query/native/executor.py` |

### 2.2 RBAC / 安全

| ID | 问题 | 路径 |
|----|------|------|
| P1-FE-04 | dashboard list/view/edit/share **无 RequireCapabilityName** | `routes.tsx` |
| P1-FE-05 | DashboardEditPage 无 `dashboard:edit` 检查 | `DashboardEditPage.tsx` |
| P1-FE-06 | Share 页「返回编辑」对 viewer 可见 | `DashboardSharePage.tsx` |
| P1-FE-07 | EmbedLayout 无鉴层 | `EmbedLayout.tsx` |
| P1-BE-10 | 20+ 模块 `_USER_*_SCOPE` 进程内伪 ACL | dataset/prefab/cat*/nfr… |
| P1-BE-11 | catalog ACL `read` 对任意登录用户放行 | `reports/catalog/acl.py` |
| P1-BE-12 | physical list/get 无读 ACL | `physical/service.py` |
| P1-BE-13 | ingestion SQL 表名/列名拼接 | `sync_executor.py` |
| P1-BE-14 | `dev-switch` 任意已登录可换身份 | `api/v1/auth.py` |
| P1-BE-15 | 幂等/导出 store 无 TTL → 内存泄漏 | `query_services.py` · `reports_export.py` |
| P1-BE-16 | ingestion scheduler `except: pass` 静默失败 | `ingestion/scheduler.py` |
| P1-BE-17 | sync run 无行级锁 | `sync_executor.py` |

### 2.3 重复 / 分层

| ID | 问题 | 路径 |
|----|------|------|
| P1-DUP-01 | designer vs `/gov/query-design` 双栈 | `designer/*` · `governance/query_design/*` |
| P1-LAY-01 | `core/nfr/*` import `auth.deps` / `datasources.registry` | 多个 nfr 模块 |
| P1-LAY-02 | `gov.py` 973 行 entry 上帝文件 | `api/v1/gov.py` |
| P1-LAY-03 | query 调 `datasources.service._resolve_connection_options` 私有 API | `query/executor.py` |
| P1-LAY-04 | auth middleware/deps 分层违规（arch-inspect #227-229） | `auth/middleware.py` · `deps.py` · `rls/predicate.py` |
| P1-LAY-05 | FE DashboardEditPage 直接深依赖 15+ dashboard 内部模块 | `DashboardEditPage.tsx` |

### 2.4 文档 / API 契约（arch-inspect 大宗）

| ID | 问题 | 规模 |
|----|------|------|
| P1-DOC-01 | `api.doc_consistency`：路径参数名 `{id}` vs `{*_id}` 不一致 | **~200+** 条（见 scan report #1–69+） |
| P1-DOC-02 | 文档「规划」路由无实现：logout、auth/me、users/{id}、query/preview、entities/types、governance/tickets… | ~15 |
| P1-DOC-03 | 僵尸路由：`POST /designer/workflow-link`（实为 `/validate`） | 1 |
| P1-DOC-04 | CAT IF-02 文档路径与 `/gov/catalog/*` 实现漂移 | 多条 |

### 2.5 测试缺口（关键）

| ID | 问题 |
|----|------|
| P1-TEST-01 | SharePage / LoginPage / viewer 深链 edit 无回归 |
| P1-TEST-02 | honesty gate 空壳（同 P0-07） |
| P1-TEST-03 | 大量测试 `._store.clear()` 绑定 InMemory 实现 |

### 2.6 连接器查询能力缺口（CONN-QUERY）

> **判据**（2026-07-13 实扫 `export_type_catalog()` + `get_sql_dialect` + `_SUPPORTED_NATIVE_TYPES`）：  
> - **可用**：`connectivity_test` + `schema_browser` + **查询执行**（SQL 或 Native）  
> - **不可用（本清单）**：能注册/测通/浏览 Schema，但看板 `POST /api/v1/query/execute` 主路径失败  
> - **代码锚点**：`backend/app/query/dialects/__init__.py`（mysql/postgresql/clickhouse/**sqlite/sqlserver/oracle** Phase2）· `query/native/executor.py`（native + csv/excel/rest_api Phase1）· `datasources/__init__.py`（30 型注册）

#### 2.6.1 已可用（22）— 对照基线

| type | 显示名 | 模式 | 默认依赖 | 备注 |
|------|--------|------|----------|------|
| `mysql` | MySQL | SQL | ✅ | 开箱即查 |
| `postgresql` | PostgreSQL | SQL | ✅ | 开箱即查；平台元库 |
| `mariadb` / `tidb` / `starrocks` / `doris` / `oceanbase` / `gbase` | MySQL 协议系 | SQL | 见左 | ✅ R1.5-A → mysql dialect |
| `kingbase` / `gaussdb` / `redshift` / `timescaledb` | PostgreSQL 协议系 | SQL | 见左 | ✅ R1.5-B → postgresql dialect |
| `elasticsearch` | Elasticsearch | Native | ✅ | 开箱即查 |
| `clickhouse` | ClickHouse | SQL | `connectors-ext` | 需 `clickhouse-connect` |
| `mongodb` | MongoDB | Native | `connectors-ext` | 需 `pymongo` |
| `opensearch` | OpenSearch | Native | `connectors-ext` | 需 `opensearch-py` |
| `csv` | CSV | Native | 标准库 | ✅ Phase1 接线 native execute |
| `excel` | Excel | Native | `openpyxl`（ext） | ✅ Phase1 接线 native execute |
| `rest_api` | REST API | Native | 无 | ✅ Phase1 接线 native execute |
| `sqlite` | SQLite | SQL | 标准库 | ✅ Phase2 独立 SqlDialect |
| `sqlserver` | SQL Server | SQL | `pymssql`（ext） | ✅ Phase2 独立 SqlDialect |
| `oracle` | Oracle | SQL | `oracledb`（ext） | ✅ Phase2 独立 SqlDialect |

#### 2.6.2 不可用 — 半可用（连接侧 only，8）

> CONN-Q-01~09、CONN-Q-19、CONN-Q-22~24、**CONN-Q-10~12** 已闭合，移出本表。

| ID | type | 显示名 | 模式 | 驱动 | 根因 | 修复轨 |
|----|------|--------|------|------|------|--------|
| CONN-Q-13 | `dm` | 达梦 DM | SQL | `dmPython`（ext） | 无 SQL 方言 | R1.5-D / Phase3 |
| CONN-Q-14 | `db2` | IBM Db2 | SQL | `ibm_db`（未进 ext） | 无方言 + 驱动常缺 | R1.5-D |
| CONN-Q-15 | `hive` | Apache Hive | SQL | `pyhive`（ext） | 无 SQL 方言 | R1.5-D / Phase3 |
| CONN-Q-16 | `impala` | Apache Impala | SQL | `pyhive`（ext） | 无 SQL 方言 | R1.5-D / Phase3 |
| CONN-Q-17 | `trino` | Trino | SQL | `trino`（ext） | 无 SQL 方言 | R1.5-D / Phase3 |
| CONN-Q-18 | `presto` | Presto | SQL | 同 trino | 无 SQL 方言 | R1.5-D / Phase3 |
| CONN-Q-20 | `influxdb` | InfluxDB | Native | `influxdb-client`（ext） | native execute 未实现 | R1.5-E |
| CONN-Q-21 | `tdengine` | TDengine | Native | `taospy`（ext） | 同上 | R1.5-E |

#### 2.6.3 产品诚实（与 CONN-QUERY 联动）

| ID | 项 | 说明 |
|----|-----|------|
| CONN-Q-UI-01 | 类型目录未区分「可查询」 | `/admin/connectors` 与 types API 应标 `queryCapable: true/false` | ✅ R1.5-C |
| CONN-Q-UI-02 | 建数据源未拦截不可用类型 | 选 CONN-Q-* 类型后仍可走图表 SQL → 运行时才 422 | ✅ R1.5-C 选型副标题标注「仅连接」 |
| CONN-Q-DOC-01 | PRD CONN-* 勾选「已实现」≠ 查询可用 | `F04-CONN.md` / `F05-QUERY.md` 需 companion 区分 connect vs execute |

---

## 3. P2 — 可重构 / 死代码 / 体量（完整 FE+BE 编号保留）

### 3.1 FE 死代码与补丁残留（AD-001 ~ AD-026, AD-108+）

完整见探索报告；摘要类：

- 未使用导出：`RequirePlatformAdmin`、`canManagePlatform`、`isWorkspaceViewPath`、`breadcrumb.tsx` 整文件、`browserCompat` 未接入 App 等（AD-001~012）
- deprecated 路径/别名：`ACCOUNT_SETTINGS_PATH`、`CHART_TYPES_CATALOG_LEGACY_PATH`、`ThemeToggle` alias、Input/Alert variant（AD-013~017）
- H1/FAKE 横幅与 env 散落（AD-018~020）— **产品诚实需要，归「治理」非删**
- 文件源占位账号、设计器硬编码 templateId（AD-023~024）
- DEV sdk-demo / changeme 密码（AD-111~114）

### 3.2 FE God 文件与目录超限（AD-027 ~ AD-049）

| 文件 | 行数 |
|------|------|
| DashboardEditPage | 593 |
| RlsAdminPage | 547 |
| designer-panels | 531 |
| RoleListPage | 507 |
| app-sidebar | 355 |
| DatasourceListPage | 346 |
| ChartExplorePage | 344 |
| DashboardListPage | 327 |
| … | 另有 290–305 区间 6+ 文件 |
| `components/dashboard/` | **23** 文件（上限 12） |
| `components/ui/` | **26** 文件 |

### 3.3 FE 重复逻辑（AD-050 ~ AD-056）

- DataSource/Dataset 列表类型三处复制
- 15+ 页本地 ErrorBanner
- `VITE_API_BASE_URL` 回退三处
- SchedulePanel vs ReportSchedulesPage 重叠

### 3.4 FE 风险（非 P0/P1 的断言与静默）（AD-064 ~ AD-084）

- 大量 `!` 非空断言（QuickCreate、Rls、Schedule、layoutHistory…）
- loadFilters / defaultViewResolve 静默吞错
- `*` 路由重定向掩盖 404
- ingestion 复用 `datasource:*` capability 语义不准

### 3.5 FE 测试缺口续（AD-096 ~ AD-107）

MetadataHub、GovernanceCatalog、OrgTree、QueryServices、ChartExplore、Account*、e2e 仅 1 条

### 3.6 BE InMemory / POC 续（BE-008 ~ BE-032）

openapi mapping、cat01–06、classification、batch jobs、bus auto FSM、builtin datasets、drill_stub、views 双写

### 3.7 BE God 文件（BE-077 ~ BE-098）

`gov.py` 973 · `errors.py` 700 · `nfr.py` 517 · `metadata.py` 488 · `designer.py` 375 · …（>200 行共 20+）

### 3.8 BE 软删 / schema（BE-123 ~ BE-163）

datasets/bindings/glossary 无 soft-delete；bound_config_id 无 FK；query_config_records 多类型挤一表；ingestion SourceConnection 文档称 ORM 实为 Pydantic

### 3.9 arch-inspect P2 文档架构（63）

领域文档/README 表一致性等（详见 `problems-merged.json`）

---

## 4. P3 — 低优先级清理

- eslint-disable exhaustive-deps（AD-025/026）
- 逼近 300 行文件（DesignerPage 299 等）
- 无 TODO 注释导致债不可 grep（BE-056）— 建议补 ADR/债清单而非乱加 TODO
- PLACEHOLDER_HINT 文案类

---

## 5. 分阶段执行计划（可并行 worktree）

### Wave R0 — 止血（1–2 日，串行）✅ 2026-07-10

1. ✅ 修 P0-01 SharePage `layoutJson`  
2. ✅ 修 P0-02 theme drill 标识符校验 + 字面量转义（拒 `;`/`--`/`/*`）  
3. ✅ 实装 honesty gate（Dataset ORM、无 mock://、gov nav 默认隐藏、筛选控件、Share 字段）  
4. ✅ Dashboard/Dataset 读路径最小 ACL（P0-03/04：owner/admin；`allowedRoles`）  
5. ✅ 回归：`test_delivery_honesty_gate` · `test_r0_acl_and_sql_safety` · SharePage smoke  

### Wave R1 — API 文档对账工厂（3–5 日，可脚本化）

1. 脚本批量对齐 `docs/api/README.md` 路径参数与 OpenAPI（消化 arch-inspect ~200 P1）  
2. 删除或改标「规划」僵尸行；zombie workflow-link 修正  
3. probe 路由加 `x-internal` 或迁 `/api/v1/internal/*`（不进产品 OpenAPI 主面）  

### Wave R1.5 — 连接器查询对齐（2–4 日，可并行 R1）

> 消化 §2.6 **CONN-Q-01 ~ CONN-Q-24**；优先「别名映射」低成本项。

| 轨 | 范围 | 条目 | 验收 |
|----|------|------|------|
| R1.5-A | MySQL 协议系别名 | CONN-Q-01~06 | ✅ `mariadb`/`tidb`/`starrocks`/`doris`/`oceanbase`/`gbase` → mysql dialect |
| R1.5-B | PostgreSQL 协议系别名 | CONN-Q-07~09、CONN-Q-19 | ✅ `kingbase`/`gaussdb`/`redshift`/`timescaledb` → postgresql dialect |
| R1.5-C | 产品诚实 | CONN-Q-UI-01~02、CONN-Q-DOC-01 | ✅ types API `queryCapable`/`queryMode`；FE 选型副标题标注「仅连接」 |
| R1.5-D | 独立 SQL 方言（排期） | CONN-Q-10~18 | ✅ sqlite/sqlserver/oracle Phase2；dm/db2/hive/impala/trino/presto 待 Phase3 |
| R1.5-E | Native 补齐（排期） | CONN-Q-20~24 | ✅ csv/excel/rest_api Phase1 接线；influx/tdengine 仍待实现 |

**R1.5-A/B 实现要点**：`query/dialects/__init__.py` 增加 `CONNECTOR_SQL_DIALECT_ALIASES`；`executor`/`translator`/`table.py` 解析前映射；`timescaledb` 改 `category` 为 relational 或强制 sql 路由。

### Wave R2 — 持久化收口（1–2 周，多 worktree）

| 轨 | 内容 |
|----|------|
| R2-A | physical + entity ORM + migration |
| R2-B | reports catalog/templates/schedules/extension ORM |
| R2-C | views user_overrides ORM；embed token / export store 持久或 Redis |
| R2-D | 去掉测试专用 `_USER_*_SCOPE` 默认路径，改为 DB grant/RLS |

### Wave R3 — 安全与嵌入（3–5 日）

1. routes 看板 capability 守卫 + EditPage canEdit  
2. EmbedChartPage 真配置 + parent origin  
3. ingestion SQL 标识符白名单  
4. 限制/审计 `dev-switch`  
5. 无界 store TTL  

### Wave R4 — 结构重构（1–2 周）

1. 拆 `gov.py` / `nfr.py` / `metadata.py`  
2. designer/gov query-design 收敛 ADR + 抽公共内核  
3. FE：拆 DashboardEditPage / RlsAdminPage / designer-panels；dashboard 子目录分包  
4. 统一 ErrorBanner、DS/Dataset 类型、api base URL helper  
5. 删死导出与未用 breadcrumb  

### Wave R5 — 测试与债可视化（持续）

1. Share/Login/viewer-edit RBAC smoke  
2. 替换 `._store.clear()` 为 DB fixture  
3. 维护 `docs/automate/plans/` 债看板；arch-inspect 门禁调参（文档类降为 P2 或自动修）  

---

## 6. 明确「不要当 bug 删」的项

| 项 | 原因 |
|----|------|
| GovernanceHonestyBanner / VITE_GOV_NAV | A1/H1 产品诚实，不是残留补丁 |
| nfr probe（迁 internal 后） | 工程门禁需要 |
| execute-plan 内部路径 | 可保留但不得冒充主路径 |
| 同目录 ui/ 超 12 文件 | shadcn 惯例，可豁免或分子目录 |

---

## 7. 建议下一步

1. ~~**立即**：Wave R0~~ ✅ 2026-07-10  
2. **并行**：Wave R1 文档对账脚本（快速消掉 arch-inspect 门禁大宗）  
3. **并行/紧随**：Wave **R1.5** 连接器查询对齐（CONN-Q-01~09 别名映射 + UI 诚实标注）  
4. **排期**：R2 持久化（否则「可交付」仍被报表/实体重启丢失打回）  
5. **排期**：R1.5-D/E 独立方言与 Native（CONN-Q-10~24）

完整 FE 编号清单：见 agent [FE explore](37752d25-4344-400e-b639-bdecab9058d6) 输出。  
完整 BE 编号清单：见 agent [BE explore](2b9c7905-b397-43ef-9d76-f1570a0fdd86) 输出。  
arch-inspect 全量：`.arch-inspect/artifacts/scans/scan-20260710T071909/report.md` + `problems-merged.json`。  
连接器查询缺口：**§2.6 CONN-Q-01 ~ CONN-Q-24**（本文件维护）。
