# 演化轮次选题 — 2026-07-03（M3 数据源平台 kickoff r22）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M3 数据源平台 — **DS 核心 + MySQL 连接器 kickoff r22**（M1+M1B 全簇 ≥90.8、M2 AUTH 全簇 ≥90.8 已收官；本轮从 **plan.archive.md §M3** 首批 5 项立项，交付 ConnectorRegistry 插件注册表、数据源 CRUD、凭证加密、连通性测试与 MySQL 连接器的 **L1 模型 + 元库迁移 + API + pytest smoke**）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节；`plan.archive.md` §M3 DS-001~008 + CONN-001/002 为下一里程碑；`prd.md` hub 8 维 — **已实现簇** BOOT/DATA/AUTH 均 ≥90.8，**未实现最近期簇** DS-001~005 加权总分 12.8–13.6（完整度 5%、可靠性 0%、测试覆盖 0%）；`evolution-state.md` 待办池空、STUCK 表空；`git log -5` r21 已合并（PR #40，M2 AUTH quality push）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 META-001~CONN-009 均为远期未实现 10.8–11.1，均 <90，非评分饱和；待办池无未消化项）；DS-001/002/005/003 + CONN-001 同属 `backend/app/datasources/` 地基、相互依赖（注册表→CRUD→凭证→连通测试→首连接器），可单轮批处理 L1 交付；对齐 `goal.md` **G2 多类别数据源可配置接入** 与 P1-SMOKE 前置
- **范围框定**：
  - **模块**（3）：`backend/app/datasources/`（域模型、注册表、方言插件）、`backend/app/api/v1/`（datasources 路由入口）、`backend/migrations/`（元库 Alembic revision）
  - **文件**（合计约 16–18，≤20）：models、registry、service、schemas、router、dialects/mysql、migration、tests；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：DS-004/006/007/008（元数据浏览、连接池隔离、类型清单、M7 授权集成 — 留 r23+）；CONN-002 PostgreSQL（次轮）；远期 META/DESIGN/CONN-021；QUERY/VIZ 查询出数链；完整 Admin 数据源配置 UI（本期仅 API L1，FE 壳层后续轮次）
- **不足 5 项原因**：不适用 — 本轮满 5 项，均为 M3 DS 同批地基主题

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M7+，非 M3 当期 |
| QUERY-007 | 10.9 | 配置元模型存储，M10+ 治理域 |
| AUTH-006 | 90.8 | M2 已实现且 ≥90，非薄弱 |
| DATA-005 | 90.8 | M1B 已实现且 ≥90，非薄弱 |
| DS-004 | 13.6 | Schema 元数据浏览，依赖 DS-003 连通性先通 |
| DS-006 | 13.7 | 连接池隔离，依赖 DS-002 CRUD 与 CONN-001 先落地 |
| DS-007 | 13.2 | 已注册类型清单 API，可由 DS-001 注册表衍生，次轮 |
| CONN-002 | 13.6 | PostgreSQL 连接器，次轮与 CONN-001 对称扩展 |

### STUCK 标注

- 无 — `evolution-state.md` 选题卡住计数表为空

---

### 子项 1：DS-001 ConnectorRegistry 插件注册表

- **选题理由**：M3 首推项；hub **DS 簇地基之首**；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%** 均未实现；M1B `SourceConnection` 内联源连接与 M3 `dataSourceId` 需统一注册表桥接；本轮交付插件注册表 + 方言类型发现
- **选题时 PRD 加权总分**：13.2/100（用户价值 **58%** · 完整度 **5%** · 可靠性 **0%** · 架构 **8%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **10%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60% L1）；架构健康（8%→≥40% 插件注册与扩展点）
- **用户感知**：平台可发现已注册的连接器类型（首期 MySQL），新增连接器不改核心框架（NFR-04 演练）
- **类型**：创造（M3 新功能立项，符合 goal G2）
- **验收标准**（来源 `plan.archive.md` §M3 · DS-001）：
  - `backend/app/datasources/registry.py`：ConnectorRegistry 插件注册与按 type 解析
  - 方言插件入口约定（`register_dialect` 或等价）；MySQL 类型可注册
  - `tests/`：注册/发现 smoke、未知 type 结构化 4xx；pytest 全绿

### 子项 2：DS-002 数据源 CRUD API

- **选题理由**：hub **加权总分最低 12.8**（M3 簇最低）；**完整度 5%**；数据源实例管理为 P1-SMOKE 核心路径；依赖 DS-001 注册表解析连接器类型
- **选题时 PRD 加权总分**：12.8/100（用户价值 **54%** · 完整度 **5%** · 可靠性 **0%** · 架构 **9%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **11%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60% L1）；可靠性（0%→≥40% 输入校验与冲突处理）
- **用户感知**：管理员可通过 API 创建/查询/更新/删除数据源配置，获得 `dataSourceId` 供后续查询绑定
- **类型**：创造
- **验收标准**（来源 `plan.archive.md` §M3 · DS-002）：
  - `backend/app/datasources/models.py`：DataSource 元模型；Alembic revision 含 datasources 表
  - `POST/GET/PUT/DELETE /api/v1/datasources` OpenAPI 可见；响应不含明文凭证
  - pytest：CRUD smoke、重复 name/code 冲突、非法 type 4xx

### 子项 3：DS-005 凭证加密存储

- **选题理由**：加权总分 **13.3**；**完整度 5%**；M1B 已启用 `CREDENTIAL_FERNET_KEY`，M3 数据源凭证须复用同一加密通道；与 DS-002 CRUD 同轮闭合安全基线
- **选题时 PRD 加权总分**：13.3/100（用户价值 **57%** · 完整度 **5%** · 可靠性 **0%** · 架构 **12%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **8%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；安全性（8%→≥50% 加密存储与 API 脱敏）
- **用户感知**：数据源密码/密钥加密入库，API 与日志永不返回明文凭证
- **类型**：创造
- **验收标准**（来源 `plan.archive.md` §M3 · DS-005）：
  - 凭证字段 Fernet 加密写入元库；读取仅内部连库路径解密
  - `GET` 列表/详情响应脱敏（如 `password: "***"` 或省略）
  - pytest：加解密 round-trip、响应无泄露、无 `CREDENTIAL_FERNET_KEY` 时结构化启动/写入失败

### 子项 4：DS-003 连通性测试

- **选题理由**：加权总分 **13.2**；**完整度 5%**；建源后即时验证可达性为用户显性诉求；依赖 DS-002 实例 + DS-005 解密凭证 + CONN-001 方言连库
- **选题时 PRD 加权总分**：13.2/100（用户价值 **55%** · 完整度 **5%** · 可靠性 **0%** · 架构 **10%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；可靠性（0%→≥40% 超时/拒绝/错误凭据兜底）
- **用户感知**：保存数据源后可一键测试连通，成功/失败有明确原因（非笼统 500）
- **类型**：创造
- **验收标准**（来源 `plan.archive.md` §M3 · DS-003）：
  - `POST /api/v1/datasources/{id}/test-connection`（或等价）返回结构化 `{ ok, message, latencyMs }`
  - 错误凭据/不可达主机返回 4xx/结构化失败，不泄露密码
  - pytest：mock 或 compose 样例 MySQL 成功路径 + 失败路径 smoke

### 子项 5：CONN-001 MySQL 连接器

- **选题理由**：加权总分 **13.2**；**完整度 5%**；P1-SMOKE 指定 MySQL 为首连接器；与 DS-001 注册表、DS-003 测试链闭合 M3 L1 最小闭环
- **选题时 PRD 加权总分**：13.2/100（用户价值 **56%** · 完整度 **5%** · 可靠性 **0%** · 架构 **9%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；可靠性（0%→≥40% 连接超时与方言错误映射）
- **用户感知**：可选择 MySQL 类型创建数据源并成功通过连通性测试
- **类型**：创造
- **验收标准**（来源 `plan.archive.md` §M3 · CONN-001）：
  - `backend/app/datasources/dialects/mysql.py`（或等价）：实现注册表约定的连接/测试接口
  - 依赖 `pymysql` 或项目既定 MySQL 驱动；连接参数与 DS-002 模型对齐
  - pytest：方言单元测试 + 与 DS-003 集成 smoke（compose 样例 MySQL 或 mock）
