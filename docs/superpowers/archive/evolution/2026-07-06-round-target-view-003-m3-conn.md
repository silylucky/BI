# 演化轮次选题 — 2026-07-06（M-FE-3 收官 + M3 关系型连接器）

## 本轮演化目标（共 3 项）

### 选题决策

- **批量主题**：**M-FE-3 收官（VIEW-003 余留）+ M3 关系型连接器** — 完成登录后角色默认 Dashboard 重定向与用户视图覆盖 companion；落地 MySQL/PostgreSQL 方言连接器，对齐 `goal.md` **P1-SMOKE** 前置（MySQL/PG 建源）
- **来源**：`docs/automate/plan.md` §**M-FE-3**（第一个含未完成 `[ ]` 的节，**1 项** VIEW-003；frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）+ §**M3** 下一批未完成项 CONN-001/002；饱和熔断**已跳过**（plan 存在且 M-FE-3 含 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` eb08f67（G1 reset after #207）+ 2427627（M-FE-3 #207）+ ce725cc（M-FE-2 #206）+ c39cabf（M-FE-1 #205）+ ba9cbdd（G1 r190 #204）；上游 G0 PASS · G1 DONE_WITH_CONCERNS · base_branch=dev-auto
- **合并理由**：上轮 M-FE-3 已交付 AUTH-001/003、DASH-004 与 VIEW-003 **部分实现**（`defaultViewResolve` 链路与 vitest smoke）；plan 仍留 VIEW-003 `[ ]`（Playwright E2E、用户视图覆盖边缘、分片/plan 勾选未收口）。M-FE-3 收官后按 plan 推荐顺序进入 **M3 CONN**；双连接器共享 `datasources/dialects/` 插件模式，可同轮批处理
- **范围框定**：
  - **模块**（≤3）：`fe/`（VIEW-003 Playwright E2E、默认视图/覆盖边缘）+ `backend/app/datasources/dialects/`（CONN-001/002 方言实现）+ `tests/`（pytest 连接器 + vitest/Playwright）
  - **文件**（估 ≤18，≤20）：`fe/src/**/defaultView*`、`fe/e2e/` 或 Playwright 配置、`backend/app/datasources/dialects/mysql*`、`backend/app/datasources/dialects/postgres*`、连接器注册与集成测、薄 `docs/api/README.md` 登记（若触及）
  - **不含**：组织树 UI（AUTH-002）、地图/热力/KPI 扩展（DASH-003 · M5）、VIEW-001 协议大改（M5 排队）、M6/M7 远期 stub、M13 冻结项、Dataset 语义层
- **不足 5 项原因**：plan §M-FE-3 **仅 1 项**未完成；§M3 关系型连接器 **仅 2 项** `[ ]`；三项已覆盖 FE 收官 + P1-SMOKE 双方言主路径，估 12–18 文件，不跨节从 hub 饱和项（Top5 均 ≥90）强行凑第四、五项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIEW-003 | 91.9 | **入选**（plan M-FE-3 唯一 `[ ]`，上轮部分实现待收口） |
| CONN-001 | 90.1 | **入选**（plan M3 #1，MySQL 连接器） |
| CONN-002 | 90.1 | **入选**（plan M3 #2，PostgreSQL 连接器） |
| CAT-001 | 90.0 | hub #1 饱和 ≥90；属 M6 排队，非 plan 当前节 |
| CAT-002 | 90.0 | hub #2，同上 |
| CONN-004 | 90.0 | hub #3，属 M7 排队 |
| VIEW-001 | 90.2 | M5 排队；本轮聚焦 M-FE-3 收官 + M3 CONN |
| DASH-003 | 90.7 | M5 组件库扩展，工作量与连接器叠加超批处理上限 |
| NFR-001 | 90.0 | M6 首屏性能，非 plan 推荐顺序下一批 |
| AUTH-002 | 92.1 | 组织树非 M-FE-3 checklist |

### STUCK 标注

- 选题卡住计数表**空** — 三入选 ID 无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：消费账号登录后稳定进入角色默认 Dashboard（含无默认/用户覆盖边缘）；管理员可用 MySQL/PG 真实连接器建源并连通性测试通过
2. **补缺 or 创造**：补缺（VIEW-003 上轮 partial + CONN 桩/占位待实装）；符合 `goal.md` **G2 多源接入** 与 **P1-SMOKE** 前置
3. **不做代价**：M-FE-3 plan 无法勾选完成；P1-SMOKE 仍缺原生 MySQL/PG 方言；hub VIEW-003 完整度维（94%）与 plan 漂移持续
4. **能否批处理更小项**：VIEW-003 余留为 E2E/边缘收口（小）；CONN-001/002 共享方言插件骨架（中）；合计在 ≤20 文件预算内
5. **共几项/文件模块**：3 项；`fe/` + `datasources/dialects/` + `tests/`，估 12–18 文件、3 模块

---

### 子项 1：VIEW-003 用户默认视图 FE（收官）

- **选题理由**：plan M-FE-3 **唯一** `[ ]`；上轮已交付 `defaultViewResolve` 与 vitest smoke，分片标「部分实现」、plan 未勾；hub 修订记录注明 Playwright E2E 留 companion
- **选题时 PRD 加权总分**：91.9/100（用户价值 **90%** · 完整度 **94%** · 可靠性 **94%** · 交互 **86%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **92%**）
- **主攻薄弱维**：完整度（94%→分片验收全勾 + plan 勾选）；交互体验（86%→登录重定向/空态/用户覆盖流畅）；测试覆盖（补 Playwright E2E 浏览器路径）
- **用户感知**：消费账号登录后自动进入角色默认 Dashboard；用户个人视图覆盖（FR-VIEW-4 companion）可用；无默认视图时有明确降级引导
- **类型**：补缺（VIEW 域 FE companion 收官）
- **验收标准**（来源 plan §M-FE-3 · VIEW-003 + M12 合并注记）：
  - 登录后按角色重定向默认 Dashboard（延续上轮 `defaultViewResolve`）
  - 用户视图覆盖边缘场景可验收（与 FR-VIEW-4 companion 对齐）
  - Playwright E2E：登录 → 默认 Dashboard 路径 smoke
  - plan §M-FE-3 VIEW-003 可勾选；分片验收标准全绿

### 子项 2：CONN-001 MySQL 连接器

- **选题理由**：plan M3 **#1**；P1-SMOKE 要求 MySQL 建源；hub 用户价值 82% 为薄弱维
- **选题时 PRD 加权总分**：90.1/100（用户价值 **82%** · 完整度 **92%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→真实 MySQL 建源/查询可用）；完整度（92%→方言参数/连通性/元数据浏览端到端）
- **用户感知**：管理员可选择 MySQL 类型创建数据源，连通性测试与 Schema 浏览对真实 MySQL 实例生效
- **类型**：补缺（CONN 域方言实装）
- **验收标准**（来源 plan §M3 · CONN-001）：
  - `mysql` 类型在 ConnectorRegistry 注册并可 CRUD 数据源
  - 连通性测试对 compose 样例 MySQL 成功
  - Schema 元数据浏览（schemas/tables/columns）可用
  - pytest 集成测覆盖连接与探测路径

### 子项 3：CONN-002 PostgreSQL 连接器

- **选题理由**：plan M3 **#2**；P1-SMOKE 要求 PG 建源；与 CONN-001 同批方言插件模式
- **选题时 PRD 加权总分**：90.1/100（用户价值 **82%** · 完整度 **92%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→真实 PG 建源/查询可用）；完整度（92%→与 MySQL 对称的方言覆盖）
- **用户感知**：管理员可选择 PostgreSQL 类型创建数据源，连通性测试与 Schema 浏览对真实 PG 实例生效
- **类型**：补缺（CONN 域方言实装）
- **验收标准**（来源 plan §M3 · CONN-002）：
  - `postgres` 类型在 ConnectorRegistry 注册并可 CRUD 数据源
  - 连通性测试对 compose 样例 PG 成功
  - Schema 元数据浏览可用
  - pytest 集成测覆盖连接与探测路径
