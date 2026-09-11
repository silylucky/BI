# 演化轮次选题 — 2026-07-03（M1B 激活 — 数据接入后端 + Admin 配置台首期）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1B 数据接入与清洗 — **首期 5 项按 plan 推荐顺序落地**（DATA-004 → DATA-001 → DATA-002 → ETL-001 → DATA-003），形成「托管库 + 同步 API + 执行器 + 清洗规则 + Admin 配置台」闭环骨架；**DATA-005 端到端验收与文档回写顺延下轮**
- **来源**：`docs/automate/plan.md` §M1B — M1 BOOT 6/6 与 §文档回写 4/4 均已 `[x]`，`m1b_activation: after-M1-complete` 条件已满足；当前节唯一未完成块为 M1B 勾选清单 6 项；`prd.md` hub — M1B 六项完整度 5%、加权 12.1–13.3（未实现）
- **合并理由**：BOOT-001~006 连续 5–8 轮 STUCK（82.4–86.4 <90），上轮文档回写已 idempotent 闭环（PR #13），再推纯测试边际收益递减；plan §M1 完成注记与上轮 round-target 均建议 **M1 闭环后激活 M1B**；同节批处理 plan 推荐顺序前五项，比跳跃 META-001（10.8）等 M11+ 远期项更符合 goal G2 与 plan 顺序
- **范围框定**：
  - **模块**（4，略超软限 3 — 含 M1B 跨域首期例外）：`backend/app/ingestion/`、`backend/app/api/v1/ingestion/`、`backend/app/core/`（config）、`fe/src/pages/admin/ingestion/`
  - **文件**（合计约 16，≤20）：`docker-compose.yml`、`backend/app/core/config.py`、`backend/.env.example`、`backend/migrations/versions/*ingestion*`、`backend/pyproject.toml`、`backend/app/ingestion/{models,sync_executor,scheduler,etl_rules}.py`、`backend/app/api/v1/ingestion/sync.py`、`docs/api/README.md` §9 登记、`fe/src/pages/admin/ingestion/*`、`fe/src/routes.tsx`
  - **不含**：DATA-005 L1/L2 全链路验收与 `services/ingestion.md` 终稿（下轮）；M3+ `dataSourceId` / ConnectorRegistry；BOOT 再推分；远期 META-001 / DESIGN-001 / CONN-021
- **不足 5 项原因**：不适用 — 满 5 项；DATA-005 有意排除（plan 推荐顺序末位集成验收，依赖本轮前五项交付）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| BOOT-005 | 82.4 | STUCK 7 轮；M1 plan 已闭环，按 plan 与上轮建议激活 M1B |
| BOOT-003 | 86.4 | STUCK 6 轮；测试覆盖 78% 再推分难破 90，让位 M1B |
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非当前节 |
| DATA-005 | 13.0 | plan 顺序末位端到端验收，依赖 DATA-004~003 + ETL-001 先落地 |

### STUCK 标注（本轮未入选 BOOT，延续 evolution-state 计数）

- **STUCK: BOOT-002 连续 8 轮未过 90**（最近 84.7）— 建议人工 `create-evolution-plan` 复核 M1 ≥90 阈值或接受 M1B 激活后 BOOT 推分降频
- **STUCK: BOOT-005 连续 7 轮未过 90**（最近 82.4）
- **STUCK: BOOT-006 连续 8 轮未过 90**（最近 84.5）
- **STUCK: BOOT-001 连续 8 轮未过 90**（最近 86.0）
- **STUCK: BOOT-004 连续 8 轮未过 90**（最近 86.1）
- **STUCK: BOOT-003 连续 6 轮未过 90**（最近 86.4）

---

### 子项 1：DATA-004 托管分析库与配置项

- **选题理由**：plan §M1B 推荐顺序首位；hub 加权 **12.5**（六项 M1B 中并列低位）；无托管库则后续同步/清洗无法验收
- **选题时 PRD 加权总分**：**12.5**/100（用户价值 52% · 完整度 **5%** · 可靠性 **0%** · 架构 10% · 测试覆盖 **0%** · 性能 **0%** · 安全性 10% · 交互 N/A）
- **主攻薄弱维**：完整度（5%）；可靠性（0%）；测试覆盖（0%）
- **用户感知**：本地 `docker compose` 可启托管分析库与样例源库；`CREDENTIAL_FERNET_KEY` 启用后可加密源连接凭证
- **类型**：创造（M1B 新域 ingestion 基础设施）
- **验收标准**（来源 plan §DATA-004）：
  - `docker-compose.yml` 增 `analytics-postgres` + 样例 MySQL/PG 源库
  - `Settings` 增 `ANALYTICS_DATABASE_URL`；`.env.example` 对齐；**M1B 启用** `CREDENTIAL_FERNET_KEY`
  - 元库 Alembic revision 含 `ingestion_*` 表（任务、运行历史、清洗规则、凭证引用）
  - `pyproject.toml` 增 `apscheduler`、`pymysql`（或等价 MySQL 驱动）
  - 验证：`docker compose up -d` → 托管库 + 样例源可连；`alembic upgrade head` 含 ingestion 元表

### 子项 2：DATA-001 同步任务模型与 API

- **选题理由**：plan 顺序第 2；hub **12.9**；定义 `SourceConnection` 内联模型与 CRUD API，M1B 不依赖 M3 `dataSourceId`
- **选题时 PRD 加权总分**：**12.9**/100（用户价值 53% · 完整度 **5%** · 可靠性 **0%** · 架构 11% · 测试覆盖 **0%** · 性能 **0%** · 安全性 11% · 交互 N/A）
- **主攻薄弱维**：完整度；架构健康（域边界与 API 契约）
- **用户感知**：OpenAPI 可见同步任务 CRUD + 手动 `run`；可用内联源连接创建任务
- **类型**：创造
- **验收标准**（来源 plan §DATA-001）：
  - `backend/app/ingestion/models.py`：`SourceConnection` 内联、`sourceDataSourceId` 预留可空
  - `backend/app/api/v1/ingestion/sync.py`：CRUD + `POST .../run`
  - `docs/api/README.md` §9 登记同步 API（规划→已实现）
  - API 创建任务无需 M3 数据源 API

### 子项 3：DATA-002 同步执行器（定时/手动）

- **选题理由**：plan 顺序第 3；hub **13.3**（M1B 最高分但仍未实现）；承接 DATA-001 模型，完成读源写托管库
- **选题时 PRD 加权总分**：**13.3**/100（用户价值 54% · 完整度 **5%** · 可靠性 **0%** · 架构 12% · 测试覆盖 **0%** · 性能 **0%** · 安全性 12% · 交互 N/A）
- **主攻薄弱维**：可靠性（0%）；测试覆盖（0%）
- **用户感知**：手动/定时触发同步后托管库目标表有数据；失败可查运行历史并重跑
- **类型**：创造
- **验收标准**（来源 plan §DATA-002）：
  - `sync_executor.py`：全量同步（M1B 可先全量）；`SourceConnection` 连源库写托管库
  - `scheduler.py`：APScheduler cron 触发
  - 失败至少 1 次自动重试；历史记 `failed` + `errorMessage` + `traceId`
  - compose 样例源表 → 托管库目标表有数据

### 子项 4：ETL-001 清洗规则引擎（轻量）

- **选题理由**：plan 顺序第 4；hub **12.5**；同步流水线写托管库前应用 JSON 规则
- **选题时 PRD 加权总分**：**12.5**/100（用户价值 52% · 完整度 **5%** · 可靠性 **0%** · 架构 11% · 测试覆盖 **0%** · 性能 **0%** · 安全性 11% · 交互 N/A）
- **主攻薄弱维**：完整度；可靠性
- **用户感知**：含脏值源表经规则后目标字段符合配置（列重命名、类型转换、空值填充、简单过滤）
- **类型**：创造
- **验收标准**（来源 plan §ETL-001）：
  - `backend/app/ingestion/etl_rules.py`：规则类型可 JSON 配置
  - 挂载于同步流水线**写托管库前**
  - 含脏值样例表经规则后目标表字段符合配置

### 子项 5：DATA-003 Admin 配置台页面

- **选题理由**：plan 顺序第 5；hub **12.1**（M1B 六项最低）；Admin UI 完成创建任务 → 手动运行 → 查看历史闭环（**触发前端 UI 门控**）
- **选题时 PRD 加权总分**：**12.1**/100（用户价值 51% · 完整度 **5%** · 可靠性 **0%** · 架构 10% · 测试覆盖 **0%** · 性能 **0%** · 安全性 10% · 交互体验待评）
- **主攻薄弱维**：完整度；交互体验（前端条件维，M1B 首期 UI）
- **用户感知**：浏览器 `/admin/ingestion/*` 可管理同步任务、运行历史与清洗规则表单
- **类型**：创造
- **验收标准**（来源 plan §DATA-003 + `layout.md`）：
  - `fe/src/pages/admin/ingestion/`：任务列表/编辑、运行历史、清洗规则表单
  - `fe/src/routes.tsx` 登记 `/admin/ingestion/*`
  - 浏览器完成：创建任务 → 手动运行 → 查看历史
  - `pnpm build` + `check:design` 通过；遵循 b-design-system skill
