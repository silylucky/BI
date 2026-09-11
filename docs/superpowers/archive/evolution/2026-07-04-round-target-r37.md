# 演化轮次选题 — 2026-07-04（M11 关系型/OLAP 连接器 companion 质量推分 r37）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 关系型/OLAP 连接器 companion 质量推分**（r36 已交付 CONN-003/007/005/008/004 五方言 L1 kickoff 并推分至 86.2–87.8；本轮聚焦 **五 ID 破 90**（STUCK 各 1 轮），闭合 Hive/ClickHouse/SQL Server/Doris/Oracle 的 test_connection/schema/types 边界、结构化错误域与 registry HTTP 链完整度缺口）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`plan.archive.md` §M11 对应 CONN-003~008 已由 r36 L1 落地；`prd.md` hub 8 维 — **CONN-004 86.2**、**CONN-008 87.2**、**CONN-005 87.4**、**CONN-003 87.6**、**CONN-007 87.8** 为 r36 簇唯一 <90；`evolution-state.md` **STUCK: 五 ID 各连续 1 轮**；待办池空；`git log -5` r36 已合并（PR #61，sha 059d222；G0 r37 PR #62 已 Squash merge dev-auto sha 8354ba6）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 QUERY-008/CONN-022/META-003 等为远期未实现 11.3–11.7，均 <90，非评分饱和；待办池无未消化项）；对齐 r34→r35、r32→r33 companion 质量推分节奏（L1 kickoff 后次轮破 90）；五 ID 同属 `datasources/` 方言插件面、共享 ConnectorRegistry 与 HIVE_/CLICKHOUSE_/SQLSERVER_/DORIS_/ORACLE_* 错误域，单轮批处理质量推分；符合 `goal.md` **G2 多类别数据源可配置接入** 与 NFR-04 插件扩展巩固
- **范围框定**：
  - **模块**（1–2）：`backend/app/datasources/` 方言与连接器注册（CONN-003/004/005/007/008）；`backend/app/datasources/dialects/` 子包边界与 types catalog
  - **文件**（合计约 14–18，≤20）：五方言 test_connection/schema 边界、types catalog 完整性、结构化 `code` 与 detail.fields、registry HTTP 链 smoke、pytest companion（`test_connectors_gov_r37`）；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：远期 QUERY-008/009、META-003~006、CONN-022 GaussDB；Hive/ClickHouse/Doris 生产级 HA 与完整 OLAP 优化；Admin 数据源配置全量 UI；r35 已破 90 的 CONN-021/009/015
- **不足 5 项原因**：不适用 — 本轮满 5 项（r36 STUCK 簇 companion 质量推分）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| QUERY-008 | 11.3 | 配置→SQL 翻译器，M13 Dataset 路径，非连接器域 |
| CONN-022 | 11.3 | GaussDB 信创扩展，M11 远期；本轮优先闭合 r36 五 ID |
| META-003 | 11.6 | 维度字典注册，M13 后续项 |
| VIZ-003 | 11.7 | 地图可视化，M7+ 展现域 |
| QUERY-009 | 11.7 | Dataset 查询路径，M13 四期语义层 |
| CONN-021 | 90.1 | r35 已破 90，非薄弱 |
| GOV-004 | 90.5 | r35 已破 90，非薄弱 |

### STUCK 标注

- **STUCK: CONN-004 连续 1 轮未过 90**（最近 86.2，完整度 76% — Oracle 方言 L1 后 test_connection/schema/types 边界未充分）— 本轮主攻（簇内最低分）
- **STUCK: CONN-008 连续 1 轮未过 90**（最近 87.2，完整度 78% — Doris 连接与 schema 自省未闭合）— 本轮主攻
- **STUCK: CONN-005 连续 1 轮未过 90**（最近 87.4，完整度 78% — SQL Server 实例/库/凭证错误路径未充分）— 本轮主攻
- **STUCK: CONN-003 连续 1 轮未过 90**（最近 87.6，完整度 80% — Hive catalog/schema 边界与 types catalog 未闭合）— 本轮主攻
- **STUCK: CONN-007 连续 1 轮未过 90**（最近 87.8，完整度 78% — ClickHouse 元数据 limit 与不可达端点降级未充分）— 本轮主攻

---

### 子项 1：CONN-004 Oracle 连接器

- **选题理由**：hub **r36 簇最低分 86.2**；**完整度 76%**、**用户价值 82%**；r36 已交付 Oracle 方言 L1，SID/service name 错误、凭证失败与 schema owner/table 层级自省边界未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.2/100（用户价值 **82%** · 完整度 **76%** · 可靠性 **92%** · 架构 **90%** · 测试覆盖 **94%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% test_connection/schema/types）；可靠性（92%→≥94% ORACLE_* 结构化 code）
- **用户感知**：Oracle 数据源在错误 SID/service、凭证失败、空 schema 时返回可定位 `ORACLE_*` 错误；schema 自省含 owner/table 层级稳定
- **类型**：补缺（闭合 r36 L1 遗留缺口）
- **验收标准**（来源 `prd.md` hub · CONN-004 + `plan.archive.md` §M11 + r36 基线）：
  - test_connection：SID/service 错误、登录失败、未知 database 4xx + 结构化 `code` pytest
  - schema/types catalog：空 schema、未知 owner、类型枚举完整性 smoke
  - 加权总分目标 ≥90

### 子项 2：CONN-008 Doris 连接器

- **选题理由**：hub **87.2**；**完整度 78%**；r36 已交付 Doris 方言 L1，FE/BE 不可达与非法 catalog 降级路径未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.2/100（用户价值 **82%** · 完整度 **78%** · 可靠性 **93%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% schema 自省与 types）；可靠性（93%→≥94% DORIS_* 端点不可达降级）
- **用户感知**：Doris 连接在 FE/BE 不可达时降级报错清晰；表/列元数据查询有 limit 守卫不 500
- **类型**：补缺
- **验收标准**（来源 hub · CONN-008 + §M11 + r36 基线）：
  - test_connection + schema：不可达端点、非法 catalog 4xx pytest
  - 元数据 list 分页/limit 边界 smoke
  - 加权总分目标 ≥90

### 子项 3：CONN-005 SQL Server 连接器

- **选题理由**：hub **87.4**；**完整度 78%**；r36 已交付 SQL Server 方言 L1，实例不可达、登录失败与 dbo/自定义 schema 自省未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.4/100（用户价值 **82%** · 完整度 **78%** · 可靠性 **93%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% test_connection/schema/types）；安全性（90%→≥92% 凭证与 TLS 选项边界）
- **用户感知**：SQL Server 在错误实例/库/凭证时返回可定位 `SQLSERVER_*` 错误；schema 自省覆盖 dbo 与自定义 schema
- **类型**：补缺
- **验收标准**（来源 hub · CONN-005 + §M11 + r36 基线）：
  - test_connection：实例不可达、登录失败、未知 database 4xx pytest
  - schema/types catalog：空库、未知 schema、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 4：CONN-003 Hive 连接器

- **选题理由**：hub **87.6**；**完整度 80%**；r36 已交付 Hive 方言 L1，catalog/schema 边界与 types catalog 完整性未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.6/100（用户价值 **82%** · 完整度 **80%** · 可靠性 **93%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（80%→≥90% schema/types 边界）；测试覆盖（96%→≥98% 空库/未知 catalog 回归）
- **用户感知**：Hive 数据源在错误 catalog、凭证失败时返回 `HIVE_*` 结构化错误；schema 自省可列出库/表骨架
- **类型**：补缺
- **验收标准**（来源 hub · CONN-003 + §M11 + r36 基线）：
  - test_connection：超时/拒绝/错误凭证 4xx + `HIVE_*` code pytest
  - schema/types：空库、未知 catalog、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 5：CONN-007 ClickHouse 连接器

- **选题理由**：hub **87.8**（r36 簇最高仍 <90）；**完整度 78%**；r36 已交付 ClickHouse 方言 L1，宽表元数据 limit 与 HTTP/TCP 不可达结构化错误未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.8/100（用户价值 **82%** · 完整度 **78%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **90%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% schema 自省与 types）；性能（90%→≥92% 大表元数据 limit）
- **用户感知**：ClickHouse 连接在不可达端点、非法 database/table 时返回 `CLICKHOUSE_*` 错误；元数据 list 在宽表场景有 limit 守卫
- **类型**：补缺
- **验收标准**（来源 hub · CONN-007 + §M11 + r36 基线）：
  - test_connection + schema：不可达端点、非法 database/table 4xx pytest
  - 元数据 list 分页/limit 边界与 types catalog 对齐 QUERY 方言 smoke
  - 加权总分目标 ≥90
