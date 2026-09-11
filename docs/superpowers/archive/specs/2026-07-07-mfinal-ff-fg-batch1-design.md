# Design Spec: M-FINAL · F-F 收官（NFR-008）+ F-G 缺口连接器首批（CONN-023~026）

```yaml
date: 2026-07-07
round: r249
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-ff-fg-batch1.md
prd_ids: [NFR-008, CONN-023, CONN-024, CONN-025, CONN-026]
phase: P1
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
scope_file_count: 18
```

---

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | 零 DE/SS 部署验收收官 | NFR-008 | `core/nfr/` + `docs/nfr/` | 1 | 用户价值 86%→生产可判定；完整度 90%→清单+探针全绿 | 运维可执行探针/查阅报告，确认无 Superset/DataEase |
| 2 | REST API 数据源 | CONN-023 | `dialects/rest_api.py` | 2 | 完整度 84%→注册+建源+只读链；测试 84%→smoke | 管理员可选 REST API，连通测试成功，types 可见 |
| 3 | Excel/CSV 文件源 | CONN-024 | `dialects/excel.py` · `csv_file.py` | 3 | 完整度 84%；可靠性 84%→非法路径拦截 | 可指定本地/远程文件，浏览 sheet/列，连通测试 |
| 4 | IBM Db2 | CONN-025 | `dialects/db2.py` | 4 | 完整度 84%→probe_readonly_sql；测试 84% | 可新建 Db2 源，schema 浏览与连通测试 |
| 5 | Apache Impala | CONN-026 | `dialects/impala.py` | 5 | 完整度 84%；安全性 86%→只读守卫 | 可新建 Impala 源，连通与只读探针 |

**依赖链**：NFR-008 compose 清单 + markdown 报告 → 四型方言注册/errors → `probe_readonly_*` / `execute_native_query`（方言级）→ `test_mfinal_ff_fg_batch1_r249.py`（≥30 断言）→ FE `CONNECTOR_FIELD_HINTS` + smoke → `docs/api` + `docs/services/datasources.md` → r57/r242 回归。

**STUCK**：五 ID 无连续未过轮次；CONN-023~026 为 hub 初评未实现项。

---

## 2. 上下文与问题陈述

### 2.1 当前痛点

| 子项 | 已有（r53/r57） | plan/PRD 未勾原因 | 本轮缺口 |
|------|----------------|-------------------|----------|
| NFR-008 | `runtime-compliance` + `deployment-report`（pyproject/loaded-modules） | plan F-F `[ ]`；goal §5「部署清单与运行时进程检查」未闭环 | 无 compose 服务禁入扫描；无 ops Markdown 报告；无 r249 CI 门禁簇 |
| CONN-023~026 | 22 方言已注册，无四型 | PRD 状态「未实现」 | 无方言文件、无 types、无连通/只读链、无 FE hints |

### 2.2 方案对比（Automation 覆盖 · 已选推荐项）

**NFR-008**

| 方案 | 描述 | 结论 |
|------|------|------|
| A（推荐） | 扩展 `deployment_report.py`：compose 禁入扫描 + markdown + `docs/nfr/zero-de-ss-deployment.md` + r249 pytest | 对齐 NFR-007 r247/r248 范式；不引入 OS 进程枚举 | **选用** |
| B | 独立 shell 探针扫容器进程 | 与 PRD r53「非 OS 进程枚举」一致但难 CI | 否决 |
| C | 仅文档无代码 | 无法勾 plan | 否决 |

**CONN-023~026（共享）**

| 方案 | 描述 | 结论 |
|------|------|------|
| A（推荐） | 每型独立 `dialects/*.py` + `register_dialect`；mock/responses 集成测；FE hints only | 零侵入 NFR-04；符合 round-target ≤18 文件 | **选用** |
| B | 统一 `generic_api.py` 多 type | 难满足 PRD 分类型错误码与元数据语义 | 否决 |
| C | 同步扩展 `query/native/executor.py` 全链路 HTTP 出数 | 超模块框定；文件预算紧 | **非目标（companion）** |

**CONN-024 类型建模**

| 方案 | 描述 | 结论 |
|------|------|------|
| A（推荐） | 独立 `type=excel` 与 `type=csv` 两个 Connector 类 | 与 PRD/SRS 一致；types API 两项 | **选用** |
| B | 统一 `spreadsheet` + 子格式 | PRD 明确要求两项 catalog | 否决 |

---

## 3. 范围框定

### 3.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| NFR 部署验收 | `backend/app/core/nfr/` · `backend/app/api/v1/nfr.py` | NFR-008 compose 清单、markdown 报告 |
| 方言插件 | `backend/app/datasources/dialects/` | CONN-023~026 四型实现与注册 |
| 集成测 + 文档 + FE hints | `tests/` · `docs/` · `fe/.../DatasourceFormPage.tsx` | r249 smoke、登记、Admin 可选 |

### 3.2 文件列表（18）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/core/nfr/deployment_report.py` | NFR-008 | compose 禁入扫描、`composeServices`/`forbiddenComposeHits`、markdown renderer |
| `backend/app/api/v1/nfr.py` | NFR-008 | `GET .../deployment-report?format=markdown` |
| `docs/nfr/zero-de-ss-deployment.md` | NFR-008 | **新建** ops 清单、环境变量、pytest 指针 |
| `backend/app/datasources/dialects/rest_api.py` | CONN-023 | **新建** |
| `backend/app/datasources/dialects/excel.py` | CONN-024 | **新建** |
| `backend/app/datasources/dialects/csv_file.py` | CONN-024 | **新建**（`type=csv`） |
| `backend/app/datasources/dialects/db2.py` | CONN-025 | **新建** |
| `backend/app/datasources/dialects/impala.py` | CONN-026 | **新建** |
| `backend/app/datasources/dialects/errors.py` | CONN-* | `REST_API_*` · `FILE_*` · `DB2_*` · `IMPALA_*` + mapper |
| `backend/app/datasources/dialects/__init__.py` | CONN-* | export 四型 |
| `backend/app/datasources/__init__.py` | CONN-* | `register_dialect` 四型 |
| `backend/app/query/native/guard.py` | CONN-023/024 | `NATIVE_CATEGORIES` 增 `api`、`file`（routing 正确性） |
| `tests/test_mfinal_ff_fg_batch1_r249.py` | 全部 | **新建** ≥30 用例 |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | CONN-* | 扩展 `CONNECTOR_FIELD_HINTS` + 简短辅助说明 |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | CONN-* | 四型 types 下拉 + port/label smoke |
| `docs/api/README.md` | 全部 | NFR-008 markdown + 四型 types 锚点 |
| `docs/services/datasources.md` | CONN-* | 四型登记、边界 In 行 |
| `docs/automate/prd/F15-NFR.md` · `F04-CONN.md` | 全部 | **P5 对账**（非 P3） |

### 3.3 非目标（明确不做）

- CONN-027 Redshift（F-G 批次 2）
- Admin 全量新页、文件上传 UI、REST OAuth2 专用表单项（PRD companion）
- `query/native/executor.py` HTTP 级 `execute_native_query`（rest_api/excel/csv）；本轮方言级 pytest 覆盖只读路径
- `backend/app/core/config.py` `FILE_UPLOAD_MAX_MB`（远程 URL + 本地路径 L1，对齐 sqlite 路径语义）
- compose 真机 Db2/Impala 镜像（mock + 分层 skip 契约）
- Dataset 路径、AI/SQL 问数、`query/dialects` SQL 别名扩展
- OS 级 Superset/DataEase 进程枚举（保持 r53 模块扫描策略）

---

## 4. NFR-008 设计

### 4.1 部署验收报告扩展

在 `build_deployment_acceptance_report()` 中追加（复用 `xinchuang._parse_compose_services` 逻辑，抽取至 `deployment_report._parse_compose_services()` 避免跨域 import）：

| 检查项 id | 逻辑 | pass 条件 |
|-----------|------|-----------|
| `compose-forbidden-services` | 解析 `docker-compose.yml` 服务名 + `image:` 行 | 无 `superset`/`dataease`/`apache-superset` 子串（大小写不敏感） |
| `deployment-ready` | 既有 runtime compliant | 同 r57 |
| `ci-gate-hint` | 静态提示 | 始终 pass |

**响应新增字段**（JSON）：

- `composeServices: string[]`
- `forbiddenComposeHits: string[]`（命中禁入 token 的服务/镜像片段）
- `schemaVersion: "1.0"`

**overall_acceptance 规则**（在既有 runtime 规则上叠加）：

- `forbiddenComposeHits` 非空 → 至少 `conditional`；`NFR08_RUNTIME_MODE=strict` → `rejected`
- runtime compliant 且 compose 无命中 → `accepted`

### 4.2 Markdown 导出

`GET /api/v1/nfr/runtime-compliance/deployment-report?format=markdown`

- `Content-Type: text/markdown`
- 标题 `## 零第三方 BI 部署验收报告`
- 段落：runtime 摘要表、compose 服务列表、禁入命中、remediation_index、ci-gate 说明

### 4.3 Ops 文档

`docs/nfr/zero-de-ss-deployment.md` 登记：

- 端点、环境变量 `NFR08_RUNTIME_MODE`（permissive/strict）
- goal §5 成功指标对账表
- compose 禁入规则与 remediation
- pytest：`test_mfinal_ff_fg_batch1_r249.py` `T-NFR-R249-008-*`

### 4.4 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-NFR-R249-008-01 | 默认环境 `deployment-report` JSON `overallAcceptance=accepted`，含 `composeServices` 非空 |
| T-NFR-R249-008-02 | mock compose 文本含 `superset` 服务名 → `forbiddenComposeHits` 非空，`overallAcceptance=conditional` |
| T-NFR-R249-008-03 | strict + forbidden hit → `rejected` |
| T-NFR-R249-008-04 | `format=markdown` 200，`text/markdown`，含 `## 零第三方 BI` |
| T-NFR-R249-008-05 | `probe_deployment_report_budget_ms() ≤ 100` |
| T-NFR-R249-008-06 | `POST /runtime-compliance/assert` strict 违规路径 503 `NFR_RUNTIME_VIOLATION` |

### 4.5 PRD 8 维对齐（NFR-008）

| 维 | 本轮提升 |
|----|----------|
| 用户价值 86% | ops 可判定 goal §5「无 DE/SS 容器」 |
| 完整度 90% | 清单 + markdown + CI 簇闭合 plan F-F |
| 可靠性 96% | 保持 ≤100ms 预算；失败路径 conditional/rejected |
| 测试覆盖 98% | r249 六用例补 compose/markdown/strict |

---

## 5. CONN-023 REST API 设计

### 5.1 连接器契约

```text
type: rest_api
category: api
capabilities: connectivity_test, schema_browser, native_query
display_name: REST API
默认 port: 443（http 用 80；scheme 由 port 推断：443→https，否则 http）
```

**字段映射**（复用 DataSource 列，无 migration）：

| 字段 | 语义 |
|------|------|
| `host` | base URL（`https://api.example.com`，无尾斜杠） |
| `database` | probe 路径（默认 `/` 或 `/health`） |
| `username` / `password` | Basic Auth（可选） |
| `port` | 覆盖默认端口；校验用 |

**test_connection**：`GET {base}{probe_path}`，`timeout_sec`；解析 2xx 为成功。

**元数据**（mock JSON 或 `responses` 测试夹具）：

- `list_schemas` → 顶层 object keys（逻辑 namespace）
- `list_tables` → 子 object keys 或数组项名
- `list_columns` → 叶子字段名 + 推断类型（`string`/`number`/`boolean`/`json`）

**execute_native_query**（方言级，pytest 调用）：

- `body.path` 必填；`body.method` 可选默认 GET；`body.jsonPath` 可选数组展开
- 使用 `httpx`（已在项目依赖则直接用，否则 `urllib` stdlib）
- `guard_native_injection(body)` 复用

**probe_readonly_fetch**（模块级 helper，供 smoke）：

- 成功 GET probe 返回 True

**错误码**：`REST_API_INVALID_URL`、`REST_API_AUTH_FAILED`、`REST_API_TIMEOUT`、`REST_API_PROBE_FAILED`

### 5.2 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R249-023-01 | `export_type_catalog` 含 `rest_api`，`category=api` |
| T-CONN-R249-023-02 | `GET /datasources/types` 含 REST API displayName |
| T-CONN-R249-023-03 | mock httpx 2xx → test_connection ok |
| T-CONN-R249-023-04 | 401 → `REST_API_AUTH_FAILED` |
| T-CONN-R249-023-05 | `execute_native_query` mock JSON 返回 columns/rows |
| T-CONN-R249-023-06 | `GET /query/routing-modes` 中 `rest_api` mode=native |
| T-CONN-R249-023-07 | `POST /datasources/test` 响应无 `password` |

---

## 6. CONN-024 Excel/CSV 设计

### 6.1 双类型契约

| type | category | display_name | 文件扩展名 |
|------|----------|--------------|------------|
| `excel` | `file` | Excel | `.xlsx`（L1 不含 `.xls`） |
| `csv` | `file` | CSV | `.csv` |

**字段映射**：

| 场景 | `host` | `database` |
|------|--------|------------|
| 本地文件 | 绝对/相对路径 | sheet 名（excel，可选默认首个 sheet） |
| 远程 HTTPS | 完整 URL | sheet 名（csv 忽略） |

**路径安全**（对齐 `sqlite.py`）：

- 禁止 `..` 穿越；本地须 `is_file()` + 可读
- 远程：仅 `https://`；超时与 404 映射 `FILE_REMOTE_HTTP_ERROR`

**解析**：

- Excel：`openpyxl` read_only；无依赖时 `test_connection` 返回 `FILE_PARSE_ERROR` + driver missing 文案
- CSV：`csv` stdlib + `Sniffer` 推断分隔符

**元数据**：

- excel：`list_schemas` → `[SchemaInfo("workbook")]`；`list_tables` → sheet 名；`list_columns` → 首行表头
- csv：单 schema `file`；单 table `data`

**execute_native_query**：`body.table`（sheet 名）+ `limit`；返回 tabular rows

**错误码**：`FILE_NOT_FOUND`、`FILE_PARSE_ERROR`、`FILE_REMOTE_HTTP_ERROR`、`FILE_EXTENSION_DENIED`

**扩展名白名单**：`.xlsx` / `.csv`；违例 `FILE_EXTENSION_DENIED`

### 6.2 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R249-024-01 | types 含 `excel` 与 `csv`，`category=file` |
| T-CONN-R249-024-02 | fixture `.xlsx` 路径 → list_tables 含 sheet |
| T-CONN-R249-024-03 | fixture `.csv` → list_columns 非空 |
| T-CONN-R249-024-04 | `..` 路径 → `FILE_NOT_FOUND` 或 traversal 码 |
| T-CONN-R249-024-05 | `execute_native_query` csv 至少 1 行 |
| T-CONN-R249-024-06 | routing modes `excel`/`csv` mode=native |

---

## 7. CONN-025 IBM Db2 设计

### 7.1 连接器契约

```text
type: db2
category: relational
capabilities: connectivity_test, schema_browser
display_name: IBM Db2
默认 port: 50000
```

**驱动**：`ibm_db` / `ibm_db_dbi`；ImportError → `test_connection` 结构化失败 `DB2_DRIVER_MISSING`（测试 mock 驱动）

**实现**：参考 `hive.py` + `postgres.py` 错误映射模式

- `test_connection`：`SELECT 1 FROM SYSIBM.SYSDUMMY1`（LUW）
- `probe_readonly_sql`：同上
- `list_schemas` / `list_tables` / `list_columns`：标准 JDBC 元数据或 `SYSCAT` 查询；过滤系统 schema

**错误码**：`DB2_AUTH_FAILED`、`DB2_CONN_REFUSED`、`DB2_UNKNOWN_DATABASE`、`DB2_TIMEOUT`、`DB2_DRIVER_MISSING`

### 7.2 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R249-025-01 | types 含 `db2`，`category=relational` |
| T-CONN-R249-025-02 | mock connection → `probe_readonly_sql` True |
| T-CONN-R249-025-03 | auth 失败 → `DB2_AUTH_FAILED` |
| T-CONN-R249-025-04 | `POST .../readonly-guard` sql 路径 mode=sql 通过 |
| T-CONN-R249-025-05 | HTTP test 响应无密码 |

---

## 8. CONN-026 Apache Impala 设计

### 8.1 连接器契约

```text
type: impala
category: lake
capabilities: connectivity_test, schema_browser
display_name: Apache Impala
默认 port: 21050
```

**实现**：委托 `pyhive.hive` 或 `impyla`（优先复用 `hive.py` 的 `pyhive.hive.connect` 模式，database/port 默认不同）

- `test_connection`：`SELECT 1`
- `probe_readonly_sql`：`SELECT 1`
- 元数据：`SHOW DATABASES` / `SHOW TABLES IN {schema}` / `DESCRIBE {schema}.{table}`

**错误码**：`IMPALA_AUTH_FAILED`、`IMPALA_CONN_REFUSED`、`IMPALA_UNKNOWN_DATABASE`、`IMPALA_TIMEOUT`

**与 Hive 关系**：共享 `map_hive_error` 或抽取 `map_impala_error` 别名（同协议族）

### 8.2 验收标准（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R249-026-01 | types 含 `impala`，`category=lake` |
| T-CONN-R249-026-02 | mock → probe_readonly_sql True |
| T-CONN-R249-026-03 | unknown database → `IMPALA_UNKNOWN_DATABASE` |
| T-CONN-R249-026-04 | empty schema list_tables → `[]` |
| T-CONN-R249-026-05 | routing mode=sql（lake 非 native） |

---

## 9. 集成测 `test_mfinal_ff_fg_batch1_r249.py`

**标记**：`pytestmark = [pytest.mark.integration]`

**夹具**：

- `tests/fixtures/rest_api_sample.json` — mock API 响应（可选内联 patch）
- `tests/fixtures/sample.csv` · `tests/fixtures/sample.xlsx` — 最小 2 行数据
- module env：复用 r242 sqlite meta 模式命名 `r249_sqlite_env`

**规模**：≥30 测试函数；NFR 6 + CONN-023 7 + CONN-024 6 + CONN-025 5 + CONN-026 5 + LINK 1（types 总数含四新型）

**compose smoke**：`@pytest.mark.compose` 可选；默认 mock；文档化 `COMPOSE_DB2_URL` / `COMPOSE_IMPALA_URL` skip 契约

---

## 10. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 10.1 范围说明

本轮 **不新建页面**；仅在既有 `DatasourceFormPage`（`/admin/datasources/new`）扩展类型 hints。对齐 round-target「表单 hints + smoke」。

### 10.2 页面信息架构

- **导航**：Admin → 数据源 → 新建/编辑（`docs/ui/layout.md` 既有 IA）
- **主内容**：`AdminPageShell` + 单卡表单；`max-w` 随壳层 `breakpoint-2xl`
- **状态**：types 加载 `Skeleton`；提交错误卡内 `Alert`；无新权限态

### 10.3 视觉层级

| 元素 | 承载 |
|------|------|
| 类型选择 | 主表单 `Select`（已有） |
| 端口/库名标签 | `CONNECTOR_FIELD_HINTS` 驱动 `Label` 文案 |
| 辅助说明 | `text-muted-foreground text-sm` 段落（OceanBase/GaussDB 同模式） |
| 主操作 | 底部「测试连接」「保存」`Button` variant 不变 |

### 10.4 组件映射

| 需求 | 组件 | 禁止 |
|------|------|------|
| 类型下拉 | `@/components/ui/select` | 手写 dropdown |
| 字段标签 | `Label` + hints map | 裸 `<label>` |
| 说明文案 | `p.text-sm.text-muted-foreground` | 新 Card 堆叠 |
| 测试 | 扩 `datasource-form.smoke.test.tsx` | 新 E2E 框架 |

**CONNECTOR_FIELD_HINTS 新增**：

| type | port | databaseLabel | usernameLabel | 辅助说明（页面内条件渲染） |
|------|------|---------------|---------------|---------------------------|
| `rest_api` | `443` | API 探测路径 | 用户名（Basic，可选） | 「base URL 填主机地址；HTTPS 默认 443」 |
| `excel` | `1` | Sheet 名（可选） | —（隐藏或禁用密码区不变） | 「host 填本地 .xlsx 路径或 HTTPS 文件 URL」 |
| `csv` | `1` | — | — | 「host 填本地 .csv 路径或 HTTPS URL」 |
| `db2` | `50000` | 数据库 | 用户名 | — |
| `impala` | `21050` | 数据库 | 用户名 | 「兼容 Hive 协议；默认 LDAP/无认证由后端处理」 |

> excel/csv：`port=1` 满足后端校验占位（对齐 sqlite）；不在 UI 强调端口字段时可保持可见但 hints 默认 1。

### 10.5 Token 与密度

- 沿用 `index.css` 语义色；说明文字 `text-muted-foreground`
- 表单项 `grid gap-2` / 卡片 `Card` padding 与 r242 一致
- 图标：仅既有 `ChevronDown`；不新增图标尺寸

### 10.6 响应式与可访问性

- 桌面：双列 `md:grid-cols-2` 保持
- 窄屏：表单单列堆叠；`Select` 全宽
- `Label` `htmlFor` 与 `Input` `id` 对齐；辅助说明 `aria-describedby` 关联首相关输入
- 长 URL：Input 全宽 + `truncate` 仅在列表态；表单内允许换行滚动

### 10.7 视觉 QA 清单

| 检查项 | desktop | mobile |
|--------|---------|--------|
| 四型出现在类型下拉 | ✓ | ✓ |
| 选 rest_api 后端口 443 | ✓ | ✓ |
| 选 db2 后端口 50000 | ✓ | ✓ |
| 辅助说明不挤压主按钮 | ✓ | ✓ |
| 暗色模式文字对比度 | ✓ | ✓ |
| 加载态 Skeleton 无布局跳动 | ✓ | — |

验证命令：`cd fe && pnpm run test -- datasource-form.smoke` + `pnpm run check:design`

---

## 11. PRD 8 维薄弱项对齐（CONN-023~026）

| PRD ID | 薄弱维 | 本轮设计回应 |
|--------|--------|--------------|
| CONN-023 | 完整度 84%、测试 84% | 方言全链 + 7 pytest + types/routing |
| CONN-024 | 完整度 84%、可靠性 84% | 双类型 + 路径/扩展名守卫 + fixture 解析 |
| CONN-025 | 完整度 84%、测试 84% | db2 方言 + probe_readonly_sql + mock 集成 |
| CONN-026 | 完整度 84%、安全性 86% | impala 只读探针 + readonly-guard + 凭证脱敏 HTTP 测 |

**刻意 companion（P5 后可选）**：

- CONN-023 OAuth2、分页游标
- CONN-024 多 sheet 关联、上传 UI、`FILE_UPLOAD_MAX_MB`
- CONN-025 Db2 z/OS 差异
- CONN-026 Kerberos/SASL
- `query/native/executor.py` 注册 rest_api/excel/csv 的 HTTP 出数

---

## 12. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `openpyxl`/`ibm_db` 可选依赖缺失 | 结构化 `*_DRIVER_MISSING`；CI 以 mock 为主 |
| 文件数超 18 | csv/excel 不抽第四模块；executor 不改 |
| PRD UI 表单项多于 hints | round-target 优先；P5 对账注明 companion |
| Impala 与 Hive 代码重复 | impala 模块 ≤120 行；必要时 import hive 私有 connect 助手 |

---

## 13. Self-review 清单

- [x] 覆盖 round-target 五子项
- [x] 文件列表 ≤18，模块 ≤3（`guard.py` 视为 CONN routing 必要补丁，不计第四业务模块）
- [x] 无 TBD/TODO 占位
- [x] 非目标显式列出 CONN-027、Admin 新页、executor HTTP 出数
- [x] UI 设计交付完整；已读取 b-design-system skill
- [x] 每项含可测试验收 ID
