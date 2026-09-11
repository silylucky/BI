# 演化轮次选题 — 2026-07-04（M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 companion 质量推分 r39）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 companion 质量推分**（r38 已交付 QUERY-008 translate API + GaussDB/达梦/Trino 三方言 + META-003 dimensions L1 kickoff 并推分至 87.1–89.6；本轮聚焦 **五 ID 破 90**（STUCK 各 1 轮），闭合翻译器方言边界、三连接器 test_connection/schema/types 结构化错误域与维度字典 values 注册/校验完整度缺口）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`prd.md` hub 8 维 — **CONN-010 87.1**、**META-003 87.4**、**CONN-022 87.6**、**CONN-017 87.6**、**QUERY-008 89.6** 为 r38 簇唯一 <90；`evolution-state.md` **STUCK: 五 ID 各连续 1 轮**；待办池空；`git log -5` r38 已合并（PR #64，sha fee8a9c；G1 r39 reset idle sha f7e2c97）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 VIZ-003/QUERY-009/CONN-006 等为远期未实现 11.5–12.8，均 <90，非评分饱和；待办池无未消化项）；对齐 r36→r37、r34→r35、r32→r33 companion 质量推分节奏（L1 kickoff 后次轮破 90）；五 ID 同属 query 翻译层 + datasources 信创/专项方言 + metadata 维度域，共享结构化 `code`/detail.fields 与 pytest companion 模式，单轮批处理质量推分；符合 `goal.md` **G2 多类别数据源可配置接入**、**G3 BI 展现全链路**（QUERY-008 配置→SQL）与 M13 维度治理前置
- **范围框定**：
  - **模块**（≤3）：`backend/app/query/translator/`（QUERY-008）；`backend/app/datasources/dialects/` 下 gaussdb/dm/trino + `errors.py`（CONN-010/017/022）；`backend/app/metadata/dimensions/`（META-003）
  - **文件**（合计约 15–19，≤20）：翻译 API 多方言参数化与算子边界、GaussDB/DM/Trino test_connection/schema/types 闭合、dimensions values CRUD/校验链、pytest companion（`test_query_meta_conn_r39`）+ r38 回归；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：远期 VIZ-003/QUERY-009/CONN-006 等 ~12 分未 kickoff 项；生产级信创 HA 与完整 OLAP 优化；Admin 全量 UI；r37 已破 90 的 CONN-003~008 簇
- **不足 5 项原因**：不适用 — 本轮满 5 项（r38 STUCK 簇 companion 质量推分）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIZ-003 | 11.7 | 地图可视化，M7+ 展现域，未 kickoff |
| QUERY-009 | 11.7 | Dataset 查询路径，M13 四期语义层 |
| CONN-006 | 12.6 | SQLite 连接器，M11 远期 |
| CONN-011 | 11.9 | InfluxDB 时序，非 r38 簇 |
| CONN-004 | 90.0 | r37 已破 90，非薄弱 |
| GOV-004 | 90.5 | r35 已破 90，非薄弱 |

### STUCK 标注

- **STUCK: CONN-010 连续 1 轮未过 90**（最近 87.1，完整度 76% — Trino catalog/schema 自省与 types catalog 边界未充分）— 本轮主攻（簇内最低分）
- **STUCK: META-003 连续 1 轮未过 90**（最近 87.4，完整度 80% — 维度 values 注册/校验与 list 分页边界未闭合）— 本轮主攻
- **STUCK: CONN-022 连续 1 轮未过 90**（最近 87.6，完整度 78% — GaussDB 凭证/库错误与 schema 自省未充分）— 本轮主攻
- **STUCK: CONN-017 连续 1 轮未过 90**（最近 87.6，完整度 78% — 达梦 DM 连接与 schema owner/table 层级未闭合）— 本轮主攻
- **STUCK: QUERY-008 连续 1 轮未过 90**（最近 89.6，完整度 88% — 翻译器多方言参数化与非法算子/字段边界未充分）— 本轮主攻（距 90 最近，优先闭合）

---

### 子项 1：CONN-010 Trino 连接器

- **选题理由**：hub **r38 簇最低分 87.1**；**完整度 76%**；r38 已交付 Trino 方言 L1，catalog/schema 三级自省与 types catalog 边界未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.1/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **92%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% test_connection/schema/types）；可靠性（92%→≥94% TRINO_* 结构化 code）
- **用户感知**：Trino 数据源在错误 catalog/schema、凭证失败、端点不可达时返回可定位 `TRINO_*` 错误；schema 自省含 catalog/schema/table 层级稳定
- **类型**：补缺（闭合 r38 L1 遗留缺口）
- **验收标准**（来源 `prd.md` hub · CONN-010 + r38 基线）：
  - test_connection：端点不可达、登录失败、未知 catalog 4xx/`ok=false` + 结构化 `code` pytest
  - schema/types catalog：空 schema、未知 catalog、类型枚举完整性 smoke
  - 加权总分目标 ≥90

### 子项 2：META-003 维度字典注册

- **选题理由**：hub **87.4**；**完整度 80%**；r38 已交付 dimensions CRUD + migration 0016，values 注册/校验与 list 分页边界未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.4/100（用户价值 **82%** · 完整度 **80%** · 可靠性 **92%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（80%→≥90% values CRUD/校验链）；测试覆盖（96%→≥98% 空值/重复 code/分页边界回归）
- **用户感知**：维度字典在重复 code、非法 values、空列表时分页与校验返回明确 `META_*` 错误；values 注册与 glossary 风格一致
- **类型**：补缺
- **验收标准**（来源 hub · META-003 + r38 基线）：
  - dimensions values：重复 code、非法枚举、空 values 4xx pytest
  - list 分页/limit 边界与 glossary 对齐 smoke
  - 加权总分目标 ≥90

### 子项 3：CONN-022 人大金仓 GaussDB 连接器

- **选题理由**：hub **87.6**；**完整度 78%**；r38 已交付 GaussDB 方言 L1（委托 Postgres），凭证/库错误与 schema 自省边界未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.6/100（用户价值 **84%** · 完整度 **78%** · 可靠性 **93%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% test_connection/schema/types）；可靠性（93%→≥94% GAUSSDB_* 错误域）
- **用户感知**：GaussDB 在错误库名、凭证失败、端点不可达时返回 `GAUSSDB_*` 结构化错误；schema 自省与 PG 兼容层边界清晰
- **类型**：补缺
- **验收标准**（来源 hub · CONN-022 + r38 基线）：
  - test_connection：端点不可达、登录失败、未知 database 4xx/`ok=false` pytest
  - schema/types：空 schema、未知 owner、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 4：CONN-017 达梦 DM 连接器

- **选题理由**：hub **87.6**；**完整度 78%**；r38 已交付 DM 方言 L1，实例/库/凭证错误路径与 owner/table 层级自省未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.6/100（用户价值 **84%** · 完整度 **78%** · 可靠性 **93%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% test_connection/schema/types）；安全性（88%→≥90% 凭证与连接串脱敏边界）
- **用户感知**：达梦在错误实例/库/凭证时返回可定位 `DM_*` 错误；schema 自省覆盖 owner/table 层级
- **类型**：补缺
- **验收标准**（来源 hub · CONN-017 + r38 基线）：
  - test_connection：实例不可达、登录失败、未知 database 4xx/`ok=false` pytest
  - schema/types：空库、未知 owner、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 5：QUERY-008 配置→SQL 翻译器

- **选题理由**：hub **89.6**（r38 簇最高仍 <90，距 90 最近）；**完整度 88%**、**用户价值 82%**；r38 已交付 translate API + mysql/postgresql/clickhouse 参数化，多方言算子边界与非法字段/注入守卫未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：89.6/100（用户价值 **82%** · 完整度 **88%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（88%→≥92% 多方言参数化与算子白名单）；用户价值（82%→≥86% 配置→SQL 可感知闭环）
- **用户感知**：设计器配置经 translate API 生成可执行 SQL，非法字段/算子/方言组合返回 `QUERY_*` 结构化错误；参数化防注入链闭合
- **类型**：补缺
- **验收标准**（来源 hub · QUERY-008 + r38 基线）：
  - `POST /api/v1/query/translate`：多方言参数化、非法算子/字段 4xx pytest
  - 条件值 `parameters` dict 注入守卫与 DESIGNER_FIELD_REGISTRY 白名单 smoke
  - 加权总分目标 ≥90
