# 演化轮次选题 — 2026-07-04（M11 连接器 + M13 治理 companion 质量推分 r35）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 连接器 + M13 治理 companion 质量推分**（r34 已交付 CONN-021/009/015 + GOV-004/008 L1 kickoff 并推分至 86.0–88.1；本轮聚焦 **五 ID 破 90**（STUCK 各 1 轮），闭合方言 test_connection/schema、ES 索引映射、query-design 校验链与 ACL/RLS 钩子的完整度缺口）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`plan.archive.md` §M11/M13 对应项已由 r34 L1 落地；`prd.md` hub 8 维 — **CONN-021 86.0**、**CONN-009 86.2**、**GOV-008 86.8**、**GOV-004 87.2**、**CONN-015 88.1** 为 r34 簇唯一 <90；`evolution-state.md` **STUCK: 五 ID 各连续 1 轮**；待办池空；`git log -5` r34 已合并（PR #58，M11 connector + M13 gov L1 kickoff）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 CONN-003~CONN-004 均为未实现 11.8–12.3，均 <90，非评分饱和；待办池无未消化项）；对齐 r33 META/QUERY/DESIGN companion 质量推分节奏（r32 L1 → r33 破 90；r34 L1 → r35 推分）；CONN-015 已 88.1 距 90 最近，CONN/GOV 完整度 76–82% 为簇内最大缺口，单轮批处理质量推分；符合 `goal.md` **G2 多类别数据源可配置接入** 与 **G5 查询服务治理与总线对接** 设计器/权限 PoC 巩固
- **范围框定**：
  - **模块**（3）：`backend/app/datasources/` 方言与连接器（CONN-021/009/015）、`backend/app/gov/` query_design（GOV-004）、`backend/app/gov/` 或等价 ACL/RLS 联动（GOV-008）
  - **文件**（合计约 14–18，≤20）：test_connection/schema 边界与 types catalog、ES mapping 异常路径、query-design validate/save/get 完整度与 detail.fields、ACL/RLS 多维链 smoke；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：远期 CONN-003/005/007/008（Hive/SQL Server/ClickHouse/Doris 未 kickoff）；META-003~006、DESIGN-003~005；完整 BPM 工单流水线；Admin 连接器/治理全量 UI；M7 全量多维 RLS 设计器
- **不足 5 项原因**：不适用 — 本轮满 5 项（r34 STUCK 簇 companion 质量推分）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-003 | 12.3 | Hive 连接器，M11 未 kickoff；本轮优先闭合 r34 五 ID |
| CONN-005 | 12.2 | SQL Server 连接器，M11 远期扩展 |
| CONN-007 | 12.2 | ClickHouse 连接器，M11 远期（QUERY-004 已有方言 L1） |
| CONN-008 | 12.3 | Doris 连接器，M11 远期 |
| QUERY-008 | 11.3 | 配置→SQL 翻译器，M13 Dataset 路径 |
| META-003 | 11.6 | 维度字典注册，M13 后续项；META-001/002 已 r33 破 90 |
| META-001 | 90.0 | r33 已破 90，非薄弱 |
| DESIGN-001 | 90.1 | r33 已破 90，非薄弱 |

### STUCK 标注

- **STUCK: CONN-021 连续 1 轮未过 90**（最近 86.0，完整度 76% — TiDB 方言 L1 后 test_connection/schema/types 边界未充分）— 本轮主攻
- **STUCK: CONN-009 连续 1 轮未过 90**（最近 86.2，完整度 76% — StarRocks 方言连接与 schema 自省未闭合）— 本轮主攻
- **STUCK: GOV-008 连续 1 轮未过 90**（最近 86.8，完整度 76% — ACL/RLS 钩子多维链与 bypass 边界未充分）— 本轮主攻
- **STUCK: GOV-004 连续 1 轮未过 90**（最近 87.2，完整度 80% — query-design validate/save/get 聚合校验与异常路径未闭合）— 本轮主攻
- **STUCK: CONN-015 连续 1 轮未过 90**（最近 88.1，完整度 82% — ES 索引→schema 映射边界与连接失败路径未充分）— 本轮主攻

---

### 子项 1：CONN-021 TiDB 连接器

- **选题理由**：hub **r34 簇最低分 86.0**；**完整度 76%**、**用户价值 82%**；r34 已交付 TiDB 方言（委托 MysqlConnector）L1，test_connection 超时/凭证错误、schema 自省与 types catalog 边界未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.0/100（用户价值 **82%** · 完整度 **76%** · 可靠性 92% · 架构 88% · 测试覆盖 94% · 性能 **86%** · 安全性 88% · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% test_connection/schema/types）；可靠性（92%→≥94% 连接失败结构化 code）
- **用户感知**：TiDB 数据源在错误主机、错误凭证、空库时返回可定位错误；schema 与类型清单可稳定自省
- **类型**：补缺（闭合 r34 L1 遗留缺口）
- **验收标准**（来源 `plan.archive.md` §M11 · CONN-021 + r34 基线）：
  - test_connection：超时/拒绝/错误凭证 4xx + 结构化 `code` pytest
  - schema/types catalog：空库、未知表、类型枚举完整性 smoke
  - 加权总分目标 ≥90

### 子项 2：CONN-009 StarRocks 连接器

- **选题理由**：hub **86.2**；**完整度 76%**；r34 已交付 StarRocks 方言 L1，OLAP 特有 schema 自省与连接池/超时边界未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.2/100（用户价值 **82%** · 完整度 **76%** · 可靠性 94% · 架构 88% · 测试覆盖 94% · 性能 **86%** · 安全性 88% · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% schema 自省与 types）；性能（86%→≥90% 大表元数据 limit）
- **用户感知**：StarRocks 连接在 FE/BE 不可达时降级报错清晰；表/列元数据查询在宽表场景不超时
- **类型**：补缺
- **验收标准**（来源 `plan.archive.md` §M11 · CONN-009 + r34 基线）：
  - test_connection + schema：不可达端点、非法 catalog 4xx pytest
  - 元数据 list 分页/limit 边界与性能 smoke
  - 加权总分目标 ≥90

### 子项 3：GOV-008 治理权限联动 FR-1.6

- **选题理由**：hub **86.8**；**完整度 76%**；r34 已交付 ACL + RLS 钩子 L1，多维权限链、admin bypass 与越权 403 路径未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.8/100（用户价值 **82%** · 完整度 **76%** · 可靠性 92% · 架构 88% · 测试覆盖 94% · 性能 **86%** · 安全性 90% · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% ACL/RLS 链覆盖）；可靠性（92%→≥94% 越权阻断不泄漏数据）
- **用户感知**：查询设计保存/执行时，未授权数据源或维度被 RLS 阻断并返回 403/空结果；管理员 bypass 路径可审计
- **类型**：补缺（闭合 r34 L1 权限链缺口）
- **验收标准**（来源 `plan.archive.md` §M13 · GOV-008 + r34 ACL/RLS smoke）：
  - ACL/RLS：未授权 execute 403、多维链空结果、admin bypass 与非法 bypass 4xx pytest
  - 与 GOV-004 query-design save/get 联合回归
  - 加权总分目标 ≥90

### 子项 4：GOV-004 可视化查询设计 FR-1.3

- **选题理由**：hub **87.2**；**完整度 80%**、**用户价值 80%**；r34 已交付 query_design validate/save/get L1，聚合校验、非法字段引用与 version 冲突边界未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.2/100（用户价值 **80%** · 完整度 **80%** · 可靠性 94% · 架构 90% · 测试覆盖 96% · 性能 **86%** · 安全性 88% · 交互 N/A）
- **主攻薄弱维**：完整度（80%→≥90% validate/save/get 边界）；用户价值（80%→≥82% detail.fields 可感知反馈）
- **用户感知**：查询设计在非法聚合、未知字段、空条件组时返回结构化 `detail.fields`；并发保存冲突有明确 409
- **类型**：补缺
- **验收标准**（来源 `plan.archive.md` §M13 · GOV-004 + r34 designer API）：
  - validate/save/get：非法聚合、未知字段、空设计、version 冲突 4xx + `detail.fields` pytest
  - 与 QUERY-007 config_store 互操作回归（若已关联）
  - 加权总分目标 ≥90

### 子项 5：CONN-015 Elasticsearch 连接器

- **选题理由**：hub **88.1**（r34 簇最高分仍 <90）；**完整度 82%**；r34 已交付 ES 索引→schema 映射 L1，多索引、mapping 冲突与连接 TLS/认证边界未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：88.1/100（用户价值 **82%** · 完整度 **82%** · 可靠性 94% · 架构 90% · 测试覆盖 98% · 性能 **86%** · 安全性 88% · 交互 N/A）
- **主攻薄弱维**：完整度（82%→≥90% mapping 边界）；性能（86%→≥90% 大索引字段 limit）
- **用户感知**：Elasticsearch 数据源在索引不存在、mapping 冲突、认证失败时返回可定位错误；字段类型映射与 BI 查询类型一致
- **类型**：补缺
- **验收标准**（来源 `plan.archive.md` §M11 · CONN-015 + r34 ES dialect）：
  - test_connection：认证失败、TLS/主机错误 4xx pytest
  - schema：多索引、空索引、mapping 冲突与字段类型映射 smoke
  - 加权总分目标 ≥90
