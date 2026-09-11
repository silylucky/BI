# 本轮演化目标（共 5 项）— r51

> 生成：2026-07-04 · G2 evolution-picker · 来源：prd.md hub 8 维评分（薄弱项汇总 Top5 + r46 STUCK 簇）
> 主题：**NFR 非功能横切 + GOV 查询服务发布 + GBase 信创连接器 companion 质量推分**

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：NFR 非功能横切（浏览器推送/信创国产化/连接器插件扩展性）+ GOV-005 查询服务发布 + CONN-019 GBase 信创连接器 **companion 质量推分**（r46 已交付五 ID L1 kickoff 并推分至 79.2–84.1；本轮聚焦 **五 ID 破 90**，闭合 r46 修订记录明示的浏览器矩阵/真实推送通道/审批通知/性能与完整度薄弱维）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 薄弱项 Top5 — **NFR-006 79.2**、**NFR-007 80.0**、**NFR-005 81.2**、**GOV-003 81.4**、**DESIGN-005 81.4**（r49 L1 簇）；`evolution-state.md` **选题卡住计数：r46 五 ID 各连续 1 轮**（NFR-005/006/007、GOV-005、CONN-019，加权 79.2–84.1）；待办池空；`git log -5` r50 G1 bootstrap 已合并（PR #78，sha 04a1085；r49 feat 已 Squash merge #76 sha c60ab89）
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；Top5 加权总分 79.2–81.4 均 <90，非评分饱和；待办池无未消化项）；对齐 r44→r45、r40→r41、r42→r43、**r46→r51** companion 质量推分节奏（L1 kickoff 后次轮破 90）；r49 round-target 与 r46 修订记录明示 r46 STUCK 簇 companion 留 r50+，本轮承接；五 ID 虽跨 NFR/GOV/CONN 三域，但同属 r46 交付簇（`core/nfr` + `governance/publish` + `datasources/dialects/gbase` + `api/v1/nfr`），共享 **性能 58%** 与完整度 76–78% 薄弱维、结构化错误域与 `test_nfr_gov_conn_r46` companion 模式，单轮批处理质量推分；符合 `goal.md` **G2 多类别数据源**（CONN-019）、**G5 查询服务治理**（GOV-005）与 NFR-04 插件扩展（NFR-005）
- **范围框定**：
  - **模块**（≤3）：`backend/app/core/nfr/`（NFR-005/006/007 横切 companion：浏览器矩阵探测、推送通道降级链、信创清单边界、插件扩展钩子回归）+ `backend/app/governance/`（GOV-005 发布 FSM companion：审批通知钩子、非法状态迁移/并发 smoke）+ `backend/app/datasources/dialects/`（CONN-019 GBase companion：HTTP 4xx/502 链、空库/列 limit 边界、MySQL 委托错误域上浮）
  - **文件**（合计约 15–18，≤20）：NFR push_config 浏览器矩阵 + 真实推送通道 mock/降级；NFR xinchuang 合规检查边界；NFR plugin_extension registry 零侵入回归；GOV-005 publish FSM 审批通知 companion + 幂等/并发；GBase dialect test_connection/metadata 链 companion；pytest companion（`test_nfr_gov_conn_r51` 或同级）+ r46 `test_nfr_gov_conn_r46` 36/36 + r49 `test_design_conn_gov_query_r49` 回归门控
  - **不含**：Admin 全量 UI、生产级推送 SDK 全量对接、信创全量认证、GBase 生产 HA、GOV BPM 全量工单流；r49 L1 簇（DESIGN-005/003、CONN-016、GOV-003、QUERY-003，81.4–83.2）companion 推分留 r52+；只读查询全链路/META-004 远期项
- **不足 5 项原因**：不适用 — 本轮满 5 项（r46 STUCK 簇 companion 质量推分）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| NFR-006 浏览器与消息推送 | 79.2 | **入选**（hub #1 最低；r46 L1 簇） |
| NFR-007 信创国产化 | 80.0 | **入选**（hub #2；与 CONN-019 同批内聚） |
| NFR-005 连接器插件扩展性 | 81.2 | **入选**（hub #3；NFR-04 横切） |
| GOV-003 治理项 | 81.4 | r49 L1 刚交付（81.4），companion 留 r52+ |
| DESIGN-005 设计器项 | 81.4 | r49 L1 刚交付，companion 留 r52+ |
| QUERY-003 查询项 | 82.5 | r49 L1 刚交付（82.5），companion 留 r52+ |
| GOV-005 查询服务发布 | 82.6 | **入选**（r46 L1 簇；G5 治理 companion） |
| DESIGN-003 设计器项 | 82.9 | r49 L1 刚交付，companion 留 r52+ |
| CONN-016 OpenSearch | 83.2 | r49 L1 刚交付，companion 留 r52+ |
| CONN-019 南大通用 GBase | 84.1 | **入选**（r46 L1 簇末项；信创连接器 companion） |

### STUCK 标注

- 五 ID 均在选题卡住计数表（各连续 **1** 轮，最近总分 79.2–84.1）— **未达 ≥3 轮硬标注阈值**，本轮作为 r46 簇 companion 质量推分主攻项纳入，不单独标 `STUCK:` 硬阻塞

## 演化北极星自检

1. **用户感知**：政企部署侧可见浏览器推送矩阵探测与降级指引、信创合规边界闭合、查询服务发布具备审批通知钩子；GBase 连接器错误链与元数据边界更完整；集成方感知 NFR 横切守卫从骨架升级为可验收 companion。
2. **补缺 or 创造**：补缺（完整度 76–78%、性能 58%、r46 修订记录明示 companion 遗留项）；符合 `goal.md` G2/G5 与 NFR-04。
3. **不做代价**：NFR/GOV/CONN r46 簇停留 L1 骨架（79–84 分），浏览器矩阵/推送降级/审批通知/GBase HTTP 链缺口持续，无法破 90 进入下一演化轨道。
4. **能否批处理更小项**：已批处理为 r46 跨域五 ID companion 质量推分（单轮 ≤20 文件、≤3 模块）。
5. **共几项/文件模块**：5 项；core/nfr + governance + datasources + tests，估 ≤18 文件、3 模块。

---

### 子项 1：NFR-006 浏览器与消息推送

- **选题理由**：hub **#1 最低分（79.2）**；**性能 58%** 为全表最薄弱共性维；**架构 68%** 为簇内最低；r46 已交付 push_config 契约 L1，浏览器矩阵/真实推送通道/降级链 companion 未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：79.2/100（用户价值 **74%** · 完整度 **76%** · 可靠性 **92%** · 架构 **68%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥86% 推送探测与降级 smoke）；架构（68%→≥88% 浏览器矩阵与通道解耦）
- **用户感知**：平台可探测支持的浏览器矩阵，推送未配置或通道失败时有明确降级与结构化错误指引
- **类型**：补缺（闭合 r46 L1 遗留推送 companion 缺口）
- **验收标准**（来源 hub · NFR-006 + r46 基线）：
  - 浏览器矩阵探测 + 推送通道 mock/降级 companion
  - pytest companion + r46 `test_nfr_gov_conn_r46` 回归
  - 加权总分目标 ≥90

### 子项 2：NFR-007 信创国产化

- **选题理由**：hub **#2（80.0）**；**性能 58%**；r46 已交付 xinchuang 检查清单 L1，合规边界与不合规组件拦截 companion 未闭合；与 CONN-019 信创连接器同批内聚；STUCK upsert round 1
- **选题时 PRD 加权总分**：80.0/100（用户价值 **76%** · 完整度 **76%** · 可靠性 **92%** · 架构 **72%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥86% 合规检查 smoke）；完整度（76%→≥88% 不合规项枚举与指引链）
- **用户感知**：部署侧信创合规检查可枚举不合规组件并给出修复指引，检查过程可探测不阻塞启动
- **类型**：补缺
- **验收标准**（来源 hub · NFR-007 + r46 基线）：
  - 信创清单边界 companion + 不合规拦截 smoke
  - 与 CONN-019 GBase 登记联动回归
  - pytest companion；加权总分目标 ≥90

### 子项 3：NFR-005 连接器插件扩展性

- **选题理由**：hub **#3（81.2）**；**性能 58%**；直接支撑 `goal.md` 成功指标「新增连接器不改核心框架（NFR-04）」；r46 已交付 plugin_extension/registry 钩子 L1，零侵入与新增方言 companion 回归未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：81.2/100（用户价值 **76%** · 完整度 **76%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **82%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥86% registry 探测 smoke）；完整度（76%→≥88% 扩展点文档化与 CONN-019 登记路径闭合）
- **用户感知**：新增 GBase/OpenSearch 等方言仅需插件登记，核心 ConnectorRegistry 行为不变且可自动化验证
- **类型**：补缺
- **验收标准**（来源 hub · NFR-005 + r46 基线）：
  - 插件扩展点 companion + registry 零侵入回归（含 CONN-019 路径）
  - pytest companion + 连接器 dialect 回归门控
  - 加权总分目标 ≥90

### 子项 4：GOV-005 查询服务发布

- **选题理由**：hub **r46 簇（82.6）**；**性能 58%**；衔接 r44/r45 已破 90 的 API-003 查询服务集成面；r46 已交付 publish FSM L1，审批通知钩子/非法状态并发 companion 未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：82.6/100（用户价值 **76%** · 完整度 **78%** · 可靠性 **94%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥86% 发布状态迁移 smoke）；完整度（78%→≥88% 审批通知钩子 + 并发/幂等边界）
- **用户感知**：查询服务发布具备审批通知契约，非法状态迁移与并发发布被结构化拦截
- **类型**：补缺
- **验收标准**（来源 hub · GOV-005 + r45 API-003 基线）：
  - 发布 FSM 审批通知 companion + 并发/幂等 smoke
  - 与 integration query_services 边界对齐回归
  - pytest companion + r46 回归；加权总分目标 ≥90

### 子项 5：CONN-019 南大通用 GBase 连接器

- **选题理由**：hub **r46 簇末项（84.1）**；**性能 58%**、**完整度 78%**；信创数据库连接器；r46 已交付 GBase dialect L1，HTTP 4xx/502 链与空库/列 limit 边界 companion 未闭合；STUCK upsert round 1
- **选题时 PRD 加权总分**：84.1/100（用户价值 **84%** · 完整度 **78%** · 可靠性 **92%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥86% test_connection/metadata 链 smoke）；完整度（78%→≥88% 空库/列 limit 边界 + GBASE_* 错误域上浮）
- **用户感知**：GBase 数据源测试连接与元数据探测错误可定位，空库与超大列集有明确边界处理
- **类型**：补缺
- **验收标准**（来源 hub · CONN-019 + r40/r41 连接器 companion 模式）：
  - GBase dialect HTTP 链 + 空库/limit 边界 companion
  - pytest companion + r46/r41 连接器回归门控
  - 加权总分目标 ≥90
