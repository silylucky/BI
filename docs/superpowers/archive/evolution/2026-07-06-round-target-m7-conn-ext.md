# 演化轮次选题 — 2026-07-06（M7 二期数据源类型扩展 · 批次 1）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M7 二期数据源类型扩展 kickoff（批次 1）** — MariaDB/Hive、SQL Server/Oracle、Oracle/SQL Server、SQLite、ClickHouse 五类连接器插件 L1；对齐 `goal.md` **G2 多类别数据源可配置接入** 与 plan §M7「FR-2.0-EXT / §9.1 二期」验收主线
- **来源**：`docs/automate/plan.md` §**M7**（第一个含未完成 `[ ]` 的节，**6 项** CONN-003~008；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M7 含 6 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` f641e19（G1 idle reset）+ 8244b65（M6 #211）+ 0a069cd（M5 VIEW-001 #210）+ ff5544b（M5 DASH-003 #209）+ 513ebb4（M-FE-3 #208）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **合并理由**：M6 一期集成验收已收官；M7 为二期首个未完成节，6 项同属 `datasources` 连接器域、可复用 CONN-001/002（MySQL/PG）插件骨架批处理；本批取 plan 顺序前 5 项（CONN-003~007），CONN-008（Doris）留次轮；不扩 M8 实体元数据或 M13 信创连接器
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/`（dialects + connector registry 插件注册）+ `backend/app/datasources/dialects/`（各方言实现）+ `tests/`（连通性/schema 探测 + registry 回归）
  - **文件**（估 ≤18，≤20）：每连接器 dialect + connector + test 约 3 文件 ×5 + registry 薄改动 + `docs/api/README.md` / `docs/services/datasources.md` 锚点；**不新增** migration 除非类型枚举表缺口
  - **不含**：M13 冻结项（CONN-017~022）、M11 三期连接器（CONN-009~016）、FE 数据源管理 UI（M-FE-1 已交付）、真实生产库 compose 全量 E2E（可 skip 无 compose）、Dataset 路径（QUERY-009）
- **5 项说明**：plan §M7 余 **6 项**，同节 batch 取顺序前 5 项；hub Top10 均 ≥90（饱和态）但以 plan 执行顺序为准；CONN-008 留 M7 批次 2

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-003 | 90.1 | **入选**（M7 plan #1；MariaDB / Hive 连接器） |
| CONN-004 | 90.0 | **入选**（M7 plan #2；hub #1 最低分；SQL Server / Oracle） |
| CONN-005 | 90.6 | **入选**（M7 plan #3；Oracle / SQL Server 连接器） |
| CONN-006 | 90.6 | **入选**（M7 plan #4；SQLite 连接器） |
| CONN-007 | 91.2 | **入选**（M7 plan #5；ClickHouse 连接器） |
| CONN-008 | 90.4 | M7 plan #6，留次轮批次 2（Apache Doris） |
| QUERY-009 | 90.0 | hub #2，Dataset 属 M13 冻结 |
| VIZ-005 | 90.0 | hub #3，维度指标 UI 属 M11 排队 |
| META-001 | 90.0 | hub #4，元数据属 M13 冻结 |
| CONN-001 | 92.5 | M3 已勾；MySQL 基线已交付 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 加权总分均 ≥90，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：Admin 可新建 MariaDB/Hive、SQL Server/Oracle、SQLite、ClickHouse 类型数据源；连通性测试与 schema 浏览可走通（与 MySQL/PG 同等路径）
2. **补缺 or 创造**：补缺（M7 plan 前 5 项未勾）；符合 `goal.md` **G2** 与 NFR-04 插件扩展性
3. **不做代价**：二期 FR-2.0-EXT 无法启动；政企常见 SQL Server/Oracle/ClickHouse 场景无法接入
4. **能否批处理更小项**：五插件共享 ConnectorRegistry 注册 + dialect 基类；各连接器独立 dialect/connector/test 三件套
5. **共几项/文件模块**：5 项；`backend` datasources + `tests`，估 ≤18 文件、2 模块（datasources + tests）

---

### 子项 1：CONN-003 MariaDB / Hive 连接器

- **选题理由**：M7 plan **顺序 #1 未完成**；hub 总分 90.1、用户价值 84% 为连接器域共性薄弱；MariaDB 可复用 MySQL dialect 差异点，Hive 为二期 OLAP 前置
- **选题时 PRD 加权总分**：90.1/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→MariaDB/Hive 可建源连通）；完整度（90%→分片验收可勾）
- **用户感知**：可选择 MariaDB 或 Hive 类型创建数据源并完成连通性测试
- **类型**：补缺（CONN 域二期扩展 L1）
- **验收标准**（来源 plan §M7 · CONN-003）：
  - MariaDB / Hive dialect + connector 插件注册至 ConnectorRegistry
  - 连通性 test + schema 元数据探测 pytest（可 mock/skip 无 compose）
  - 不扩 scope 至 Spark/Presto 或 M11 CONN-010

### 子项 2：CONN-004 SQL Server / Oracle 连接器

- **选题理由**：M7 plan **#2**；hub **总分 90.0 为系统最低**、完整度 88% 为入选项最薄弱；政企高频 SQL Server/Oracle 场景
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **88%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（88%→分片主流程可勾）；用户价值（84%→企业库可接入）
- **用户感知**：可选择 SQL Server 或 Oracle 类型创建数据源；凭证加密存储与 RLS 链路与既有 DS 一致
- **类型**：补缺（CONN 域二期扩展 L1）
- **验收标准**（来源 plan §M7 · CONN-004）：
  - SQL Server / Oracle dialect + connector 插件 + 驱动依赖声明（pyodbc/oracledb 等）
  - 连通性 + 元数据探测测试 + 凭证不落日志
  - 不扩 scope 至 M13 信创库（达梦/金仓等）

### 子项 3：CONN-005 Oracle / SQL Server 连接器

- **选题理由**：M7 plan **#3**；hub 总分 90.6；与 CONN-004 互补完成 Oracle/SQL Server 双端方言差异与驱动边界
- **选题时 PRD 加权总分**：90.6/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **92%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→Oracle 特有类型/分页方言覆盖）；性能（88%→连接池复用）
- **用户感知**：Oracle 与 SQL Server 在 schema 浏览、标识符引用、分页语义上行为正确
- **类型**：补缺（CONN 域二期扩展 L1）
- **验收标准**（来源 plan §M7 · CONN-005）：
  - Oracle / SQL Server 方言差异点（标识符、分页、类型映射）+L1 测试
  - 与 CONN-004 共享 registry 入口，不重复注册冲突
  - 不扩 scope 至 RAC/AlwaysOn 高可用专项

### 子项 4：CONN-006 SQLite 连接器

- **选题理由**：M7 plan **#4**；hub 总分 90.6、测试覆盖 100%；轻量本地/嵌入式数据源，实施成本低、可快速提升完整度
- **选题时 PRD 加权总分**：90.6/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→本地文件库可接入）；性能（88%→只读查询路径）
- **用户感知**：可上传或指定 SQLite 文件路径作为数据源并执行只读 SQL
- **类型**：补缺（CONN 域二期扩展 L1）
- **验收标准**（来源 plan §M7 · CONN-006）：
  - SQLite dialect + connector（文件路径校验、只读约束）
  - 连通性 + schema 探测 + 非法路径拦截测试
  - 不扩 scope 至写入/同步入托管库（M1B ingestion）

### 子项 5：CONN-007 ClickHouse 连接器

- **选题理由**：M7 plan **#5**；hub 总分 91.2、可靠性 96%/性能 92% 为 OLAP 类代表；完成本批关系型+OLAP 混合覆盖
- **选题时 PRD 加权总分**：91.2/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **96%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **92%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→ClickHouse OLAP 可建源）；安全性（88%→只读账号与 TLS 选项）
- **用户感知**：可创建 ClickHouse 数据源；`SHOW TABLES`/列元数据浏览可用；M3-LITE 只读 SQL 可执行
- **类型**：补缺（CONN 域二期 OLAP L1）
- **验收标准**（来源 plan §M7 · CONN-007）：
  - ClickHouse dialect + connector + HTTP/native 驱动封装
  - schema 探测 + 只读 SQL 执行链测试
  - 不扩 scope 至 M8 CONN-008 Doris 或 M11 StarRocks（CONN-009）
