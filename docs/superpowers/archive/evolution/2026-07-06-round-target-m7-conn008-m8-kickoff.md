# 演化轮次选题 — 2026-07-06（M7 收官 + M8 实体元数据 kickoff）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M7 收官（CONN-008 Doris）+ M8 实体元数据与总览页 kickoff** — 完成二期最后一个关系型/OLAP 连接器，并启动物理表元数据登记、实体 schema 配置、全局筛选器 BE 联动链与实体总览页（FR-6.2）；对齐 `goal.md` **G2 多源接入** 与 **G5 查询治理/实体模型**、plan §M7–M8 与 P2-SMOKE 前置
- **来源**：`docs/automate/plan.md` §**M7**（第一个含未完成 `[ ]` 的节，余 **1 项** CONN-008）+ §**M8**（**4 项** kickoff：META-005/006、DASH-004/005）；饱和熔断**已跳过**（plan 存在且 M7/M8 含未完成项；hub Top5 均 ≥90 为已知饱和态）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` 8e78e1d（G1 r232）+ e0b427e（#213）+ 0493fb2（M7 r228 #212）+ 8244b65（M6 #211）+ 0a069cd（M5 #210）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **孤儿分支决策**：**优先续作** `origin/feat/m7-conn008-m8-entity-kickoff-r231`（含 CONN-008 + META-005/006 + DASH-004/005 实现；P4 r231 BLOCKED 于 pytest ACL 回归 `test_dash_r61_004_forbidden_viewer`），rebase 至 `dev-auto` 后修复验证阻塞再开 PR；**禁止**从零重复实现已交付方言/页面骨架
- **合并理由**：M7 批次 1（CONN-003~007）已 merge #212；CONN-008 为 M7 末项自然收官；M8 四 kickoff 项同属实体元数据 + Dashboard 消费链，依赖 M7 连接器扩展与 M-FE-3 DASH-004 FE 已交付，可同轮批处理；不扩 M9 主题分析或 M13 冻结项
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/`（Doris dialect/connector）+ `backend/app/` 元数据域（META-005/006 API/模型）+ `backend/app/` Dashboard 域 + `fe/`（DASH-005 实体总览页；DASH-004 BE 联动链）
  - **文件**（估 ≤18，≤20）：Doris dialect+connector+test ~4；meta entity 模型/API ~6；dash global filter execute 链 ~4；fe entity overview 页+路由+smoke ~4；docs/api + services 锚点
  - **不含**：M9 DASH-006 主题分析、M13 META-001~004 Dataset 语义层、M11 三期连接器、全新 FE GlobalFilterBar（M-FE-3 已交付）
- **5 项说明**：plan §M7 余 1 项 + §M8 kickoff 4 项恰好 5 项；hub 饱和但以 plan 执行顺序为准

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-008 | 90.4 | **入选**（M7 plan 末项；Apache Doris 连接器） |
| META-005 | 90.5 | **入选**（M8 plan #1；物理表元数据登记 M1-ENTITY） |
| META-006 | 90.4 | **入选**（M8 plan #2；实体类型 schema 配置） |
| DASH-004 | 92.1 | **入选**（M8 plan #3；全局筛选器 BE 联动链；FE 见 M-FE-3 已勾） |
| DASH-005 | 90.4 | **入选**（M8 plan #4；实体总览页 FR-6.2） |
| QUERY-009 | 90.0 | hub #1，Dataset 属 M13 冻结 |
| VIZ-005 | 90.0 | hub #2，维度指标 UI 属 M11 排队 |
| META-001 | 90.0 | hub #3，术语字典属 M13 冻结 |
| DASH-006 | 91.2 | M9 主题分析，非 M8 kickoff |
| CONN-009 | 90.4 | M11 三期 StarRocks，非当前节 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 加权总分均 ≥90，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：Admin 可新建 Doris 数据源并完成连通性测试；物理表可登记为实体元数据；实体总览页可按类型浏览；全局筛选器变更驱动 widget 数据刷新（BE execute 链）
2. **补缺 or 创造**：补缺（M7 末连接器 + M8 plan kickoff 未勾）；符合 `goal.md` **G2** 与 **G5**、SRS M1-ENTITY-MODEL / FR-6.2
3. **不做代价**：M7 二期 FR-2.0-EXT 无法收官；P2-SMOKE（实体总览 + 扩展连接器）无法启动；Doris 政企 OLAP 场景无法接入
4. **能否批处理更小项**：CONN-008 独立 dialect 三件套；META-005/006 共享元数据域；DASH-004/005 共享 Dashboard 消费链 — 已按 plan 最小 kickoff 批处理
5. **共几项/文件模块**：5 项；`datasources` + 元数据 + `dashboard`/`fe`，估 ≤18 文件、3 模块

---

### 子项 1：CONN-008 Apache Doris 连接器

- **选题理由**：M7 plan **唯一未完成项**；hub 总分 90.4、用户价值 84% 为连接器域共性薄弱；复用 CONN-007 ClickHouse 同类 OLAP 插件骨架
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→Doris 可建源连通）；完整度（90%→分片验收可勾）
- **用户感知**：可选择 Apache Doris 类型创建数据源并完成连通性测试与 schema 浏览
- **类型**：补缺（M7 plan 末项连接器插件）
- **验收标准**（来源 plan §M7 · CONN-008）：
  - `DorisConnector` 注册至 ConnectorRegistry
  - 连通性测试 + schema 元数据浏览 API 可走通
  - pytest 集成验收（compose 可 skip 无 Doris 时）
  - `docs/api/README.md` / `docs/services/datasources.md` 锚点登记

### 子项 2：META-005 物理表元数据登记 M1-ENTITY

- **选题理由**：M8 plan **#1 kickoff**；实体模型地基，DASH-005 总览页依赖本项数据
- **选题时 PRD 加权总分**：90.5/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→物理表可登记为平台实体）；架构健康（88%→元数据域边界清晰）
- **用户感知**：管理员可将数据源物理表登记为实体，供总览页与后续主题分析引用
- **类型**：补缺（M8 实体元数据 kickoff）
- **验收标准**（来源 plan §M8 · META-005）：
  - 物理表元数据 CRUD API（登记/查询/更新）
  - 与 `dataSourceId` + schema/table 关联
  - pytest 主流程 + 边界用例
  - `docs/services/` 元数据域附录登记

### 子项 3：META-006 实体类型 schema 配置

- **选题理由**：M8 plan **#2**；实体类型定义与 schema 配置，META-005 上下游衔接
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→实体类型可配置）；完整度（90%→类型 schema 端到端）
- **用户感知**：可配置实体类型及其字段 schema，驱动总览页分类展示
- **类型**：补缺（M8 实体元数据 kickoff）
- **验收标准**（来源 plan §M8 · META-006）：
  - 实体类型 schema CRUD API
  - 与 META-005 登记实体关联
  - pytest 覆盖类型创建与 schema 校验
  - API 契约登记 `docs/api/README.md`

### 子项 4：DASH-004 全局筛选器联动

- **选题理由**：M8 plan **#3**；BE 全局筛选器 execute 联动链（M-FE-3 已交付 FE GlobalFilterBar）；本轮补齐 BE widget execute 合并筛选参数
- **选题时 PRD 加权总分**：92.1/100（用户价值 **90%** · 完整度 **98%** · 可靠性 **94%** · 交互体验 **86%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **88%**）
- **主攻薄弱维**：安全性（88%→越权 viewer 不可见未授权 widget 数据）；性能（88%→筛选器驱动批量 execute）
- **用户感知**：Dashboard 全局筛选器变更后，各 widget 查询自动携带筛选参数刷新数据
- **类型**：补缺（M8 BE 联动链；FE 已由 M-FE-3 交付）
- **验收标准**（来源 plan §M8 · DASH-004）：
  - BE widget execute 合并 global filter 参数
  - ACL：未授权 viewer 访问受限 widget 返回 403 或空集（修复 r231 P4 阻塞用例）
  - pytest 覆盖筛选器传递 + ACL 回归
  - 与 M-FE-3 FE 刷新链端到端可验

### 子项 5：DASH-005 实体总览页 FR-6.2

- **选题理由**：M8 plan **#4**；二期实体总览消费页，P2-SMOKE「扩展连接器 + 实体总览」核心验收项
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→实体总览可浏览）；交互体验（本轮新增 FE 页后由 N/A 转实评）
- **用户感知**：侧栏可进入实体总览页，按实体类型浏览已登记物理表/实体
- **类型**：补缺（M8 FR-6.2 kickoff）
- **验收标准**（来源 plan §M8 · DASH-005）：
  - `/admin/entities` 或等价路由与导航登记
  - 对接 META-005/006 API 展示实体列表与类型
  - fe vitest smoke + 路由注册
  - `docs/ui/layout.md` 导航 IA 对齐
