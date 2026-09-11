# 演化轮次选题 — 2026-07-04（M11 关系型/OLAP 连接器 L1 kickoff r36）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 关系型/OLAP 连接器 L1 kickoff**（r35 已交付 CONN-021/009/015 + GOV-004/008 companion 质量推分并五 ID 破 90；hub 薄弱项 Top5 均为 **未实现** 连接器簇 CONN-003/007/005/008/004，完整度 5%、可靠性/测试覆盖 0%；本轮对齐 r34 L1 kickoff 节奏，批处理五类方言 `test_connection` + schema 自省 + types catalog 骨架）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`plan.archive.md` §M11 对应 CONN-003~008 仍为未勾选；`prd.md` hub 8 维 — **CONN-003 12.3**、**CONN-007 12.2**、**CONN-005 12.2**、**CONN-008 12.3**、**CONN-004 11.8** 为系统最低分簇；`evolution-state.md` 待办池空、STUCK 表空；`git log -5` r35 已合并（PR #60，M11 CONN + M13 GOV companion quality push）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 CONN-003~CONN-004 均为 11.8–12.3，均 <90，非评分饱和；待办池无未消化项）；对齐 r32→r34 节奏（META/DESIGN L1 → CONN/GOV L1；r33/r35 companion 推分）；五 ID 同属 `datasources/` 方言插件面、共享 ConnectorRegistry 契约，单轮批处理 L1 符合 `goal.md` **G2 多类别数据源可配置接入** 与 NFR-04 插件扩展；**不含** Admin 连接器 UI 全量
- **范围框定**：
  - **模块**（1–2）：`backend/app/datasources/` 方言与连接器注册（CONN-003/004/005/007/008）；必要时 `backend/app/datasources/dialects/` 子包扩展
  - **文件**（合计约 14–18，≤20）：五方言 connector 类、types catalog 枚举、`test_connection`/schema 自省 API 链、结构化错误 `code`、pytest smoke（mock 或 compose 可选）；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：r35 已破 90 的 CONN-021/009/015；GOV-004/008 companion；QUERY-008/009 Dataset 路径；META-003~006；Hive/ClickHouse/Doris 生产级 HA 与完整 OLAP 优化；Admin 数据源配置全量 UI
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub 薄弱 Top5 同域 L1 kickoff）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| QUERY-008 | 11.3 | 配置→SQL 翻译器，M13 Dataset 路径，非连接器域 |
| CONN-022 | 11.3 | GaussDB 信创扩展，本轮优先 hub Top5 |
| META-003 | 11.6 | 维度字典注册，M13 后续项 |
| VIZ-003 | 11.7 | 地图可视化，M7+ 展现域 |
| QUERY-009 | 11.7 | Dataset 查询路径，M13 四期语义层 |
| CONN-021 | 90.1 | r35 已破 90，非薄弱 |
| GOV-004 | 90.5 | r35 已破 90，非薄弱 |

### STUCK 标注

- 无 — `evolution-state.md` 选题卡住计数表为空（r35 五 ID 已破 90 清零）

---

### 子项 1：CONN-003 Hive 连接器

- **选题理由**：hub **系统最低分 12.3**；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%** 均未实现；M11 扩展簇在 r34/r35 TiDB/StarRocks/ES 之后，Hive 为 G2 多源接入下一优先未 kickoff 项
- **选题时 PRD 加权总分**：12.3/100（用户价值 **52%** · 完整度 **5%** · 可靠性 **0%** · 架构 **11%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **8%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60% L1）；可靠性（0%→≥40% test_connection 结构化失败路径）
- **用户感知**：管理员可登记 Hive 数据源并 test_connection；成功/失败有明确 `code` 与 traceId；schema 自省可列出库/表骨架
- **类型**：创造（M11 L1 kickoff，符合 goal G2）
- **验收标准**（来源 `prd.md` hub · CONN-003 + `plan.archive.md` §M11 连接器扩展）：
  - Hive 方言注册至 ConnectorRegistry；`test_connection` 超时/拒绝/凭证错误 4xx + 结构化 `code` pytest
  - schema/types catalog L1 smoke（空库、未知 catalog 边界）
  - 加权总分目标 L1 kickoff 后推至 80+（r37 companion 目标 ≥90）

### 子项 2：CONN-007 ClickHouse 连接器

- **选题理由**：hub **12.2**（Top2）；**完整度 5%**；OLAP 类与 r34 QUERY-004 方言 L1 可复用模式，独立连接器契约未立项
- **选题时 PRD 加权总分**：12.2/100（用户价值 **51%** · 完整度 **5%** · 可靠性 **0%** · 架构 **8%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；架构健康（8%→≥40% 方言与 registry 解耦）
- **用户感知**：ClickHouse 数据源可连通性检测；元数据 list 在宽表场景有 limit 守卫
- **类型**：创造
- **验收标准**（来源 hub · CONN-007 + §M11）：
  - ClickHouse connector L1：`test_connection` + schema 自省 pytest
  - 非法 database/table、HTTP/TCP 不可达结构化错误
  - types catalog 枚举与 QUERY 方言对齐 smoke

### 子项 3：CONN-005 SQL Server 连接器

- **选题理由**：hub **12.2**（Top3）；**完整度 5%**；政企常见 SQL Server 源，M11 关系型扩展未 kickoff
- **选题时 PRD 加权总分**：12.2/100（用户价值 **49%** · 完整度 **5%** · 可靠性 **0%** · 架构 **13%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **10%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；安全性（10%→≥40% 凭证与 TLS 选项 L1）
- **用户感知**：SQL Server 连接在错误实例/库/凭证时返回可定位错误；schema 自省覆盖 dbo 与自定义 schema
- **类型**：创造
- **验收标准**（来源 hub · CONN-005 + §M11）：
  - SQL Server 方言 connector：`test_connection` + schema/types pytest
  - 实例不可达、登录失败、未知 database 4xx
  - 只读守卫与现有 datasources 链复用不回归

### 子项 4：CONN-008 Doris 连接器

- **选题理由**：hub **12.3**（Top4）；**完整度 5%**；Apache Doris 与 StarRocks 同 OLAP 族，r34 StarRocks L1 后可批处理 Doris 方言
- **选题时 PRD 加权总分**：12.3/100（用户价值 **50%** · 完整度 **5%** · 可靠性 **0%** · 架构 **9%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **13%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；可靠性（0%→≥40% FE/BE 不可达降级）
- **用户感知**：Doris 数据源连通性检测与表元数据查询；端点错误时不 500
- **类型**：创造
- **验收标准**（来源 hub · CONN-008 + §M11）：
  - Doris connector L1：对齐 CONN-009 StarRocks 契约的 test_connection/schema pytest
  - 非法 catalog、连接池超时边界 smoke
  - ConnectorRegistry 插件注册不修改核心框架（NFR-04）

### 子项 5：CONN-004 Oracle 连接器

- **选题理由**：hub **11.8**（Top5）；**完整度 5%**；政企 Oracle 源为 M11 关系型扩展标配，与 CONN-005 同批 L1 闭合关系型对
- **选题时 PRD 加权总分**：11.8/100（用户价值 **48%** · 完整度 **5%** · 可靠性 **0%** · 架构 **12%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **9%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；测试覆盖（0%→≥50% 契约 smoke）
- **用户感知**：Oracle 数据源 test_connection 成功/失败可感知；schema 自省含 owner/table 层级
- **类型**：创造
- **验收标准**（来源 hub · CONN-004 + §M11）：
  - Oracle 方言 connector：`test_connection` + schema/types catalog pytest
  - SID/service name 错误、凭证失败、空 schema 4xx
  - 与 CONN-003/005/007/008 联合 registry 回归 smoke
