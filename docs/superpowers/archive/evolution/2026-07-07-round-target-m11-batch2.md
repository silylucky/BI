# 演化轮次选题 — 2026-07-07（M11 三期原生连接器扩展 · 批次 2）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 三期文档型/搜索型连接器 + Native 查询双路径 + 维度指标筛选 UI（批次 2）** — MongoDB、Elasticsearch、OpenSearch 三类 NoSQL/搜索连接器 L1；QUERY-003 Native 查询双路径与 M4 合并验收；VIZ-005 图表维度/指标/筛选配置 Admin UI；对齐 `goal.md` **G2 多类别数据源可配置接入**、**G3 图表直连消费** 与 plan §M11「FR-2.0-EXT 三期、FR-2.1、NFR-07 / §9.1 三期」验收主线
- **来源**：`docs/automate/plan.md` §**M11**（第一个含未完成 `[ ]` 的节，**9 项** CONN-014~016/QUERY-003/VIZ-005/VIZ-007/CAT-004~006；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M11 含 9 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` e2e0001（G1 idle reset）+ 8b32aaa（M11 batch1 CONN-009~013 #219）+ f6ed5e6（M10 #218）+ 6f906f6（M9 #217）+ 3760784（M8 #216）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **合并理由**：上轮 M11 batch1 已交付 CONN-009~013（时序/OLAP 类）；本批接续 plan 顺序前三项 NoSQL/搜索连接器，并纳入紧耦合的 QUERY-003（Native 双路径为 Mongo/ES 查询前置）与 hub 最低分 VIZ-005（完整度 88% 最薄弱）；五 ID 同属三期 FR-2.0-EXT/FR-2.1 主线；VIZ-007 SDK 嵌入、CAT-004~006 分类 handler 留 M11 批次 3
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/`（CONN-014~016 dialect + connector 插件）+ `backend/app/query/`（QUERY-003 Native 双路径执行链）+ `fe/src/`（VIZ-005 维度指标筛选配置 UI）
  - **文件**（估 ≤20，≤20）：每连接器 dialect + connector + test 约 3 文件 ×3 + query native path ~4 + FE chart config UI ~5 + `docs/api/README.md` / `docs/services/` 锚点 + compose fixture 可选
  - **不含**：M13 冻结项（CONN-017~022、QUERY-009 Dataset）、M11 余项 VIZ-007/CAT-004~006（批次 3）、M12 调度/视图、真实生产集群全量 E2E（可 skip 无 compose）、Dataset 语义层路径
- **5 项说明**：plan §M11 余 **9 项**，取 plan 顺序前 5 项（CONN-014~016 → QUERY-003 → VIZ-005）；hub Top10 均 ≥90（饱和态）但以 plan 执行顺序为主；VIZ-007/CAT-004~006 留批次 3

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-014 | 90.1 | **入选**（M11 plan #1；MongoDB 连接器；hub #9） |
| CONN-015 | 91.0 | **入选**（M11 plan #2；Elasticsearch 连接器） |
| CONN-016 | 90.4 | **入选**（M11 plan #3；OpenSearch 连接器；hub #10） |
| QUERY-003 | 90.4 | **入选**（M11 plan #4；Native 查询双路径；与 NoSQL 连接器紧耦合） |
| VIZ-005 | 90.0 | **入选**（M11 plan #5；hub #2 最低分；完整度 88% 最薄弱） |
| VIZ-007 | 90.1 | M11 plan #6，SDK 嵌入门户留批次 3 |
| CAT-004 | 90.1 | M11 plan #7，CAT-04 时间序列留批次 3 |
| CAT-005 | 90.4 | M11 plan #8，CAT-05 工单受理留批次 3 |
| CAT-006 | 90.1 | M11 plan #9，CAT-06 生产销售统计留批次 3 |
| QUERY-009 | 90.0 | hub #1，Dataset 属 M13 冻结 |
| META-001 | 90.0 | hub #3，元数据属 M13 冻结 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 加权总分均 ≥90，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：Admin 可新建 MongoDB/Elasticsearch/OpenSearch 数据源并完成连通性测试；图表配置页可设置维度/指标/筛选器；Native 查询路径可对文档/搜索源执行只读探测
2. **补缺 or 创造**：补缺（M11 plan 前 5 项未勾）；符合 `goal.md` **G2/G3** 与 NFR-07 插件扩展性
3. **不做代价**：三期 NoSQL/搜索场景无法接入；图表配置仍缺维度指标 UI；Native 双路径阻塞 Mongo/ES 消费路径
4. **能否批处理更小项**：三连接器共享 ConnectorRegistry 注册 + dialect 基类；QUERY-003 与 datasources native mode 共用执行入口；VIZ-005 FE 独立子模块
5. **共几项/文件模块**：5 项；`datasources` + `query` + `fe`，估 ≤20 文件、3 模块

---

### 子项 1：CONN-014 MongoDB 连接器

- **选题理由**：M11 plan **顺序 #1 未完成**；hub 总分 90.1、用户价值 84% 为连接器域共性薄弱；接续 batch1 时序/OLAP 类，补齐文档型数据源
- **选题时 PRD 加权总分**：90.1/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→MongoDB 可建源连通）；完整度（90%→分片验收可勾）
- **用户感知**：可选择 MongoDB 类型创建数据源；连通性测试与 collection/字段元数据探测可走通
- **类型**：补缺（CONN 域三期 NoSQL L1）
- **验收标准**（来源 plan §M11 · CONN-014）：
  - MongoDB dialect + connector 插件注册至 ConnectorRegistry
  - 连通性 test + collection/字段元数据探测 pytest（可 mock/skip 无 compose）
  - 只读约束；凭证加密存储与 RLS 链路与既有 DS 一致
  - 不扩 scope 至 GridFS 写入或 M13 信创库

### 子项 2：CONN-015 Elasticsearch 连接器

- **选题理由**：M11 plan **#2**；hub 总分 91.0；政企日志/搜索场景高频；与 OpenSearch 共享搜索 API 模式
- **选题时 PRD 加权总分**：91.0/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **96%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→ES 索引可接入）；性能（88%→只读查询路径）
- **用户感知**：可创建 Elasticsearch 数据源；index mapping 元数据浏览可用
- **类型**：补缺（CONN 域三期搜索 L1）
- **验收标准**（来源 plan §M11 · CONN-015）：
  - Elasticsearch dialect + connector（HTTP REST 封装）
  - 连通性 + index/mapping 探测测试 + 凭证不落日志
  - 不扩 scope 至集群管理/ILM 或写入路径

### 子项 3：CONN-016 OpenSearch 连接器

- **选题理由**：M11 plan **#3**；hub 总分 90.4；与 CONN-015 互补完成 ES 分叉生态；信创/私有化部署常见
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→OpenSearch 可建源）；完整度（90%→分片主流程可勾）
- **用户感知**：可创建 OpenSearch 数据源；与 Elasticsearch 类型在 Admin 中独立可选
- **类型**：补缺（CONN 域三期搜索 L1）
- **验收标准**（来源 plan §M11 · CONN-016）：
  - OpenSearch dialect + connector（与 ES 差异点：认证/版本探测）
  - 连通性 + 元数据探测 + 与 CONN-015 无 registry 冲突
  - 不扩 scope 至 OpenSearch Dashboards 嵌入

### 子项 4：QUERY-003 Native 查询双路径

- **选题理由**：M11 plan **#4**；hub 总分 90.4；与 CONN-014~016 紧耦合（Mongo/ES 不走 SQL 需 Native path）；plan 注「与 M4 合并验收」
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **96%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→NoSQL 源可查询出数）；完整度（90%→双路径验收可勾）
- **用户感知**：对 MongoDB/ES/OpenSearch 数据源，图表与查询 API 可走 Native 模式执行只读探测并返回结构化结果
- **类型**：补缺（QUERY 域三期 Native 路径 L1）
- **验收标准**（来源 plan §M11 · QUERY-003）：
  - `mode=native` 执行链与既有 `mode=sql`/`mode=table` 并列；RLS/鉴权与 QUERY-006 一致
  - Mongo/ES/OpenSearch native 探测 pytest + API 契约登记
  - 不扩 scope 至 GraphQL/自定义 DSL 设计器（M13 DESIGN-*）

### 子项 5：VIZ-005 维度指标筛选配置 UI

- **选题理由**：M11 plan **#5**；hub **总分 90.0 为入选项最低**、完整度 **88% 为最薄弱维度**；三期 FR-2.1 图表完整插件消费链 FE 缺口
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **88%** · 可靠性 **96%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（88%→维度/指标/筛选配置 UI 可勾）；用户价值（84%→图表配置可感知）
- **用户感知**：图表编辑页可配置维度字段、指标聚合、筛选条件；保存后 Dashboard 消费路径生效
- **类型**：补缺（VIZ 域三期 FE companion）
- **验收标准**（来源 plan §M11 · VIZ-005）：
  - Admin 图表配置 UI：维度/指标/筛选器表单 + ChartViewConfig 协议 round-trip
  - vitest 组件测试 + `check:design` PASS
  - 不扩 scope 至 M13 设计器（DESIGN-001）或 GIS/地图子类型
