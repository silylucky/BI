# 演化轮次选题 — 2026-07-04（M11 嵌入式/时序/文档连接器 companion 质量推分 r41）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M11 嵌入式/时序/文档连接器 companion 质量推分**（r40 已交付 CONN-006/011/012/013/014 五方言 L1 kickoff 并推分至 86.1–88.8；本轮聚焦 **五 ID 破 90**（STUCK 各 1 轮），闭合 SQLite 路径穿越/只读守卫、InfluxDB/TDengine/TimescaleDB schema/types 自省边界、MongoDB collection 元数据与结构化 `MONGODB_`/`INFLUX_`/`TDENGINE_`/`SQLITE_`/`TIMESCALE_*` 错误域完整度缺口）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（M11/M12/M13 无活跃节，已知 concern）；`prd.md` hub 8 维 — **CONN-014 86.1**、**CONN-011 86.8**、**CONN-012 87.9**、**CONN-006 88.4**、**CONN-013 88.8** 为 r40 簇唯一 <90；`evolution-state.md` **选题卡住计数：五 ID 各连续 1 轮**；待办池空；`git log -5` r40 已合并（PR #66，sha ddfeb11；G1 r41 reset idle sha 311d91e）
- **合并理由**：饱和熔断未触发（plan 无未完成项故执行熔断检查；Top5 薄弱汇总 VIZ-004/008/CONN-016 等为远期未实现 11.3–11.7，均 <90，非评分饱和；待办池无未消化项）；对齐 r36→r37、r38→r39、r40→r41 companion 质量推分节奏（L1 kickoff 后次轮破 90）；五 ID 同属 `datasources/` 嵌入式/时序/文档方言簇，共享 ConnectorRegistry 契约、结构化 `code` 与 pytest companion 模式，单轮批处理质量推分；符合 `goal.md` **G2 多类别数据源可配置接入** 与 NFR-04 插件扩展
- **范围框定**：
  - **模块**（1–2）：`backend/app/datasources/dialects/`（sqlite/influxdb/tdengine/timescaledb/mongodb）；`backend/app/datasources/errors.py` 或方言内错误域上浮
  - **文件**（合计约 14–18，≤20）：五方言 test_connection/schema/types 边界闭合、MAX_COLUMNS/limit 守卫、结构化错误 `code` 链、pytest companion（`test_connectors_gov_r41`）+ r40/r39/r37/r36 回归；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：远期 VIZ-004/008、QUERY-009、CONN-016~020 等 ~12 分未 kickoff 项；生产级时序 HA 与完整文档库聚合优化；Admin 数据源配置全量 UI；r39 已破 90 的 QUERY-008/CONN-022/META-003/CONN-017/CONN-010 簇
- **不足 5 项原因**：不适用 — 本轮满 5 项（r40 STUCK 簇 companion 质量推分）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIZ-004 | 11.3 | 桑基图，M7+ 展现域，未 kickoff |
| VIZ-008 | 11.4 | 关系图，M7+ 展现域，未 kickoff |
| CONN-016 | 11.6 | OpenSearch 搜索连接器，非 r40 簇 |
| QUERY-009 | 11.7 | Dataset 查询路径，M13 四期语义层 |
| QUERY-008 | 90.4 | r39 已破 90，非薄弱 |
| CONN-004 | 90.0 | r37 已破 90，非薄弱 |

### STUCK 标注

- 五 ID 均在选题卡住计数表（各连续 **1** 轮，最近总分 86.1–88.8）— **未达 ≥3 轮硬标注阈值**，本轮作为 companion 质量推分主攻项纳入，不单独标 `STUCK:` 硬阻塞

---

### 子项 1：CONN-014 MongoDB 连接器

- **选题理由**：hub **r40 簇最低分 86.1**；**完整度 76%**；r40 已交付 MongoDB 方言 L1，collection/database 元数据自省与 `MONGODB_*` 错误域边界未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.1/100（用户价值 **82%** · 完整度 **76%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **86%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：完整度（76%→≥88% test_connection/schema/types）；可靠性（92%→≥94% MONGODB_* 结构化 code）
- **用户感知**：MongoDB 在错误 database、凭证失败、端点不可达时返回可定位 `MONGODB_*` 错误；schema 自省可稳定列出 database/collection 骨架
- **类型**：补缺（闭合 r40 L1 遗留缺口）
- **验收标准**（来源 `prd.md` hub · CONN-014 + r40 基线）：
  - test_connection：端点不可达、登录失败、未知 database 4xx/`ok=false` + 结构化 `code` pytest
  - schema/types catalog：空库、未知 database、类型枚举完整性 smoke
  - 加权总分目标 ≥90

### 子项 2：CONN-011 InfluxDB 连接器

- **选题理由**：hub **86.8**（簇内次低）；**完整度 78%**；r40 已交付 InfluxDB 方言 L1，org/bucket 错误路径与 schema 自省 limit 守卫未充分；STUCK upsert round 1
- **选题时 PRD 加权总分**：86.8/100（用户价值 **82%** · 完整度 **78%** · 可靠性 **92%** · 架构 **90%** · 测试覆盖 **96%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% test_connection/schema/types）；可靠性（92%→≥94% INFLUX_* 错误域）
- **用户感知**：InfluxDB 在非法 org/bucket、HTTP 不可达、凭证失败时返回 `INFLUX_*` 结构化错误；元数据 list 有 limit 守卫
- **类型**：补缺
- **验收标准**（来源 hub · CONN-011 + r40 基线）：
  - test_connection：端点不可达、登录失败、未知 org/bucket 4xx/`ok=false` pytest
  - schema/types：空 bucket、未知 org、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 3：CONN-012 TDengine 连接器

- **选题理由**：hub **87.9**；**完整度 78%**；r40 已交付 TDengine 方言 L1，超级表/子表元数据自省与 `TDENGINE_*` 错误域未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：87.9/100（用户价值 **82%** · 完整度 **78%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（78%→≥88% test_connection/schema/types）；测试覆盖（98%→≥100% 边界回归）
- **用户感知**：TDengine 在错误 host/库/凭证时返回可定位 `TDENGINE_*` 错误；超级表/子表元数据骨架可稳定列举
- **类型**：补缺
- **验收标准**（来源 hub · CONN-012 + r40 基线）：
  - test_connection：端点不可达、登录失败、未知 database 4xx/`ok=false` pytest
  - schema/types：空库、未知超级表、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 4：CONN-006 SQLite 连接器

- **选题理由**：hub **88.4**；**完整度 80%**；r40 已交付 SQLite 方言 L1，文件路径穿越/只读守卫与 schema/types 边界未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：88.4/100（用户价值 **84%** · 完整度 **80%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（80%→≥90% 路径穿越/只读守卫）；安全性（88%→≥90% 文件路径校验链）
- **用户感知**：SQLite 在文件不存在、路径穿越、只读库时返回 `SQLITE_*` 结构化错误；test_connection 成功/失败可感知
- **类型**：补缺
- **验收标准**（来源 hub · CONN-006 + r40 基线）：
  - test_connection：文件不存在、路径穿越、只读库 4xx/`ok=false` pytest
  - schema/types：空库、非法路径、类型枚举 smoke
  - 加权总分目标 ≥90

### 子项 5：CONN-013 TimescaleDB 连接器

- **选题理由**：hub **88.8**（r40 簇最高仍 <90）；**完整度 80%**；r40 已交付 TimescaleDB 方言 L1，hypertable 元数据自省与 `TIMESCALE_*` 错误域未充分闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：88.8/100（用户价值 **84%** · 完整度 **80%** · 可靠性 **94%** · 架构 **92%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（80%→≥88% test_connection/schema/types）；可靠性（94%→≥96% TIMESCALE_* 错误域）
- **用户感知**：TimescaleDB 在非法 database、扩展未安装、连接超时时返回 `TIMESCALE_*` 结构化错误；schema 自省区分普通表与 hypertable
- **类型**：补缺
- **验收标准**（来源 hub · CONN-013 + r40 基线）：
  - test_connection：端点不可达、登录失败、未知 database 4xx/`ok=false` pytest
  - schema/types：空库、hypertable 边界、类型枚举与 PG 族对齐 smoke
  - 加权总分目标 ≥90
