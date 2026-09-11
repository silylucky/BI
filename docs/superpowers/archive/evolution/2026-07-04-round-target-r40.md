# 演化轮次选题 — 2026-07-04（M11 嵌入式/时序/文档连接器 L1 kickoff r40）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 嵌入式/时序/文档连接器 L1 kickoff**（r39 已交付 QUERY-008/CONN-022/META-003/CONN-017/CONN-010 companion 质量推分并五 ID 破 90；hub 薄弱项 Top5 中 VIZ-003/QUERY-009 为展现/M13 远期域，**连接器簇 CONN-006/011/012/013/014** 为下一未 kickoff 五类方言，完整度 5%、可靠性/测试覆盖 0%；本轮对齐 r36 L1 kickoff 节奏，批处理 SQLite/InfluxDB/TDengine/TimescaleDB/MongoDB 的 `test_connection` + schema 自省 + types catalog 骨架）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`prd.md` hub 8 维 — **CONN-014 11.5**、**CONN-011 11.9**、**CONN-012 12.4**、**CONN-006 12.6**、**CONN-013 12.8** 为连接器域最低分簇（薄弱汇总 #3–#7）；`evolution-state.md` 待办池空、STUCK 表空；`git log -5` r39 已合并（PR #65，sha c09246a；G1 r40 reset idle sha 36e943d）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 VIZ-003/QUERY-009/CONN-006 等为 11.5–12.8，均 <90，非评分饱和；待办池无未消化项）；对齐 r36→r37、r38→r39 节奏（关系型/OLAP L1 → companion 推分；信创/专项 L1 → companion 推分；本轮启动嵌入式/时序/文档簇 L1）；五 ID 同属 `datasources/` 方言插件面、共享 ConnectorRegistry 契约与结构化 `code` 模式，单轮批处理 L1 符合 `goal.md` **G2 多类别数据源可配置接入** 与 NFR-04 插件扩展；**不含** Admin 连接器 UI 全量
- **范围框定**：
  - **模块**（1–2）：`backend/app/datasources/` 方言与连接器注册（CONN-006/011/012/013/014）；`backend/app/datasources/dialects/` 子包扩展
  - **文件**（合计约 14–18，≤20）：五方言 connector 类、types catalog 枚举、`test_connection`/schema 自省 API 链、结构化错误 `code`（`SQLITE_`/`INFLUX_`/`TDENGINE_`/`TIMESCALE_`/`MONGODB_*`）、pytest smoke（mock 或 compose 可选）；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：r39 已破 90 的 QUERY-008/CONN-022/META-003/CONN-017/CONN-010；远期 VIZ-003 地图可视化、QUERY-009 Dataset 查询路径（M13 四期）；OpenSearch/信创连接器（CONN-016~020）；生产级时序 HA 与完整文档库聚合优化；Admin 数据源配置全量 UI
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub 薄弱连接器簇 L1 kickoff）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIZ-003 | 11.7 | 地图可视化，M7+ 展现域，非连接器域 |
| QUERY-009 | 11.7 | Dataset 查询路径，M13 四期语义层，goal 一至三期 Out of Scope |
| CONN-016 | 11.6 | OpenSearch 搜索连接器，本轮优先 hub #3–#7 簇 |
| CONN-018 | 12.1 | 人大金仓，r38/r39 信创簇已 kickoff |
| CONN-004 | 90.0 | r37 已破 90，非薄弱 |
| QUERY-008 | 90.4 | r39 已破 90，非薄弱 |

### STUCK 标注

- 无 — `evolution-state.md` 选题卡住计数表为空（r39 五 ID 已破 90 清零）

---

### 子项 1：CONN-014 MongoDB 连接器

- **选题理由**：hub **连接器簇最低分 11.5**（薄弱汇总 #7）；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%** 均未实现；文档型 NoSQL 为 G2 多源接入下一优先未 kickoff 项
- **选题时 PRD 加权总分**：11.5/100（用户价值 **46%** · 完整度 **5%** · 可靠性 **0%** · 架构 **8%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **13%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60% L1）；架构健康（8%→≥40% 方言与 registry 解耦）
- **用户感知**：管理员可登记 MongoDB 数据源并 test_connection；成功/失败有明确 `MONGODB_*` code 与 traceId；schema 自省可列出 database/collection 骨架
- **类型**：创造（M11 L1 kickoff，符合 goal G2）
- **验收标准**（来源 `prd.md` hub · CONN-014）：
  - MongoDB 方言注册至 ConnectorRegistry；`test_connection` 超时/拒绝/凭证错误 4xx + 结构化 `code` pytest
  - schema/types catalog L1 smoke（空库、未知 database 边界）
  - 加权总分目标 L1 kickoff 后推至 80+（r41 companion 目标 ≥90）

### 子项 2：CONN-011 InfluxDB 连接器

- **选题理由**：hub **11.9**（薄弱汇总 #4）；**完整度 5%**；时序类首项未 kickoff，与 CONN-012/013 同批闭合时序族
- **选题时 PRD 加权总分**：11.9/100（用户价值 **48%** · 完整度 **5%** · 可靠性 **0%** · 架构 **12%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **10%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；可靠性（0%→≥40% test_connection 结构化失败路径）
- **用户感知**：InfluxDB 数据源连通性检测；bucket/org 错误时不 500；元数据 list 有 limit 守卫
- **类型**：创造
- **验收标准**（来源 hub · CONN-011）：
  - InfluxDB connector L1：`test_connection` + schema 自省 pytest
  - 非法 org/bucket、HTTP 不可达结构化 `INFLUX_*` 错误
  - types catalog 枚举与时序字段类型 smoke

### 子项 3：CONN-012 TDengine 连接器

- **选题理由**：hub **12.4**（薄弱汇总 #5）；**完整度 5%**；国产时序库扩展，与 InfluxDB/TimescaleDB 共享时序 connector 契约
- **选题时 PRD 加权总分**：12.4/100（用户价值 **49%** · 完整度 **5%** · 可靠性 **0%** · 架构 **13%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **11%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；测试覆盖（0%→≥50% 契约 smoke）
- **用户感知**：TDengine 连接在错误 host/库/凭证时返回可定位 `TDENGINE_*` 错误；超级表/子表元数据骨架可列举
- **类型**：创造
- **验收标准**（来源 hub · CONN-012）：
  - TDengine connector L1：`test_connection` + schema/types pytest
  - 端点不可达、登录失败、未知 database 4xx
  - ConnectorRegistry 插件注册不修改核心框架（NFR-04）

### 子项 4：CONN-006 SQLite 连接器

- **选题理由**：hub **12.6**（薄弱汇总 #3，系统 Top3 之一）；**完整度 5%**；嵌入式/文件型源为政企离线场景常见，M11 扩展未 kickoff
- **选题时 PRD 加权总分**：12.6/100（用户价值 **50%** · 完整度 **5%** · 可靠性 **0%** · 架构 **14%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **11%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；安全性（11%→≥40% 文件路径穿越与只读守卫 L1）
- **用户感知**：SQLite 文件路径数据源 test_connection 成功/失败可感知；非法路径/权限拒绝返回 `SQLITE_*` 结构化错误
- **类型**：创造
- **验收标准**（来源 hub · CONN-006）：
  - SQLite 方言 connector：`test_connection` + schema/types catalog pytest
  - 文件不存在、路径穿越、只读库边界 4xx
  - 与 CONN-011/012/013/014 联合 registry 回归 smoke

### 子项 5：CONN-013 TimescaleDB 连接器

- **选题理由**：hub **12.8**（薄弱汇总 #6）；**完整度 5%**；PG 时序扩展，可复用 Postgres 方言模式并独立连接器契约
- **选题时 PRD 加权总分**：12.8/100（用户价值 **50%** · 完整度 **5%** · 可靠性 **0%** · 架构 **14%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥60%）；可靠性（0%→≥40% hypertable 元数据自省边界）
- **用户感知**：TimescaleDB 数据源连通性检测；schema 自省区分普通表与 hypertable；凭证失败可定位
- **类型**：创造
- **验收标准**（来源 hub · CONN-013）：
  - TimescaleDB connector L1：对齐 PG 兼容层的 `test_connection`/schema pytest
  - 非法 database、扩展未安装、连接超时结构化 `TIMESCALE_*` 错误
  - types catalog 与 PG 族对齐 smoke；五方言联合 pytest 回归门控
