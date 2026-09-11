# 演化轮次选题 — 2026-07-03（M1B 收尾 — DATA-005 端到端验收与文档回写）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1B 数据接入与清洗 — **DATA-005 L1 端到端验收 + 文档回写**，同轮对已实现 M1B 四项（DATA-001/002、ETL-001、DATA-003）做 L1 验收驱动的测试/文档补强，推动 hub 加权分向 90 靠近
- **来源**：`docs/automate/plan.md` §M1B — 勾选清单唯一未完成 `[ ] DATA-005`；§文档同步待办 `plan.archive.md`、`docs/services/ingestion.md` 均标注「待 DATA-005」；`prd.md` hub — DATA-005 完整度 5%、加权 **13.0**；上轮 M1B 前五项（DATA-004~003 + ETL-001）已合并（PR #14），hub 重评 76.3–83.2 仍 <90
- **合并理由**：plan 当前节仅剩 DATA-005；L1 验收天然覆盖 sync executor、ETL 规则与 Admin UI 全路径，比跳跃 META-001（10.8）/ DESIGN-001（10.8）/ CONN-021（10.9）等 M4+ 远期项更符合 goal G2 DATA-SMOKE 与 plan 顺序；同节批处理 5 项，主项 DATA-005 约 10–14 文件， companion 项各 1–3 文件，合计 ≤20
- **范围框定**：
  - **模块**（3）：`backend/app/ingestion/` + `tests/`（ingestion e2e）、`fe/src/pages/admin/ingestion/`（UI smoke）、`docs/`（prd/services/plan.archive/srs 回写）
  - **文件**（合计约 14，≤20）：`tests/test_ingestion_e2e.py`（或等价 L1 集成用例）、`tests/test_sync_executor.py`、`tests/test_etl_rules.py`、`fe/src/pages/admin/ingestion/**/*.test.tsx`（或 vitest smoke）、`docs/automate/prd/F16-DATA.md`、`docs/services/ingestion.md`、`docs/automate/plan.archive.md`（M1B 节 + 124 项计数）、`docs/srs/全生命周期系统需求规格说明书.md` §3.6 状态回写（若 L1 通过）
  - **不含**：DATA-005 **L2**（托管库 → DS-002 `dataSourceId` → FR-2.0b SQL 出数，留 M3/M4）；M3+ ConnectorRegistry / `sourceDataSourceId`；BOOT STUCK 再推分；远期 META/DESIGN/CONN 项
- **不足 5 项原因**：不适用 — 满 5 项；DATA-004 有意排除（hub 80.7 已高于 DATA-003/002，L1 验收间接覆盖托管库配置，边际推分低于 executor/UI/ETL）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12 拖拽查询条件，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非 M1B 当前节 |
| BOOT-003 | 86.4 | STUCK 6 轮；M1 plan 已闭环，M1B 收尾优先 |
| BOOT-005 | 82.4 | STUCK 7 轮；让位 plan §M1B 末项 DATA-005 |
| DATA-004 | 80.7 | L1 验收间接覆盖；本轮 companion 边际低于 DATA-002/003 |

### STUCK 标注（本轮未入选 BOOT，延续 evolution-state 计数）

- **STUCK: BOOT-002 连续 8 轮未过 90**（最近 84.7）— 建议人工 `create-evolution-plan` 复核 M1 ≥90 阈值或接受 M1B 收尾后 BOOT 推分降频
- **STUCK: BOOT-005 连续 7 轮未过 90**（最近 82.4）
- **STUCK: BOOT-006 连续 8 轮未过 90**（最近 84.5）
- **STUCK: BOOT-001 连续 8 轮未过 90**（最近 86.0）
- **STUCK: BOOT-004 连续 8 轮未过 90**（最近 86.1）
- **STUCK: BOOT-003 连续 6 轮未过 90**（最近 86.4）

---

### 子项 1：DATA-005 端到端验收与文档回写（L1）

- **选题理由**：plan §M1B 勾选清单唯一未完成项；hub 加权 **13.0**（完整度 **5%**）；goal §5 DATA-SMOKE 指标 L1 子集；上轮 round-target 明确顺延本项
- **选题时 PRD 加权总分**：**13.0**/100（用户价值 55% · 完整度 **5%** · 可靠性 **0%** · 架构 12% · 测试覆盖 **0%** · 性能 **0%** · 安全性 11% · 交互 N/A）
- **主攻薄弱维**：完整度（5%）；测试覆盖（0%）；可靠性（0%）
- **用户感知**：compose 样例源 → Admin 配置同步+清洗 → 托管库目标表数据正确 → 运行历史可查；PRD/域文档/plan.archive 与实现一致
- **类型**：补缺（M1B 集成验收 + 文档闭环）
- **验收标准**（来源 plan §DATA-005 L1 + 文档行）：
  - **L1**：内联 `SourceConnection` → 配置同步任务 + 清洗规则 → 手动/定时运行 → 托管库目标表字段符合规则；运行历史含 traceId、行数或 errorMessage
  - **文档**：`prd/F16-DATA.md` DATA-001 SourceConnection 描述对齐；`docs/services/ingestion.md` SourceConnection 边界 In/Out；`plan.archive.md` M1B 节目标与 124 项计数；SRS §3.6 → 已实现（L1 通过后）
  - **不含 L2**：DS-002 登记 `dataSourceId` 与 FR-2.0b SQL 出数（M3/M4 复测）

### 子项 2：DATA-002 同步执行器可靠性测试补强

- **选题理由**：hub **77.4**，主薄弱维测试覆盖 **55%**；L1 验收需覆盖全量同步、失败重试、运行历史 failed 态
- **选题时 PRD 加权总分**：**77.4**/100（用户价值 76% · 完整度 82% · 可靠性 84% · 架构 86% · 测试覆盖 **55%** · 性能 74% · 安全性 80% · 交互 N/A）
- **主攻薄弱维**：测试覆盖（55%）
- **用户感知**：同步失败自动重试至少 1 次；仍失败时历史可查 errorMessage 并可手动重跑
- **类型**：补缺
- **验收标准**（来源 plan §DATA-002 + L1 场景）：
  - 集成/单元测试覆盖：`sync_executor.py` 成功路径、源连接失败、写托管库失败、重试后仍 failed
  - 运行历史字段：`status`、`errorMessage`、`traceId`、行数统计
  - compose 样例 MySQL/PG 源表 → 托管库目标表有数据

### 子项 3：DATA-003 Admin 配置台 e2e smoke（**触发前端 UI 门控**）

- **选题理由**：hub **76.3**（M1B 已实现项最低），测试覆盖 **58%**、交互体验 **70%**；L1 要求浏览器完成创建→运行→查历史
- **选题时 PRD 加权总分**：**76.3**/100（用户价值 78% · 完整度 88% · 可靠性 76% · 交互体验 **70%** · 架构 86% · 测试覆盖 **58%** · 性能 76% · 安全性 72%）
- **主攻薄弱维**：测试覆盖（58%）；交互体验（70%）
- **用户感知**：`/admin/ingestion/*` 任务 CRUD、手动运行、运行历史列表与清洗规则表单在 L1 smoke 中可重复验证
- **类型**：补缺
- **验收标准**（来源 plan §DATA-003 + b-design-system skill）：
  - vitest/playwright 级 smoke：创建任务 → 触发 run → 历史列表可见（可 mock API 或 TestClient 联调）
  - 空状态/错误态有明确文案（非空白页）
  - `pnpm build` + `check:design` 通过

### 子项 4：ETL-001 清洗规则 L1 脏数据场景

- **选题理由**：hub **80.8**，L1 必验「含脏值源表经规则后目标字段符合配置」；测试覆盖 82% 但边界场景可补强
- **选题时 PRD 加权总分**：**80.8**/100（用户价值 72% · 完整度 90% · 可靠性 80% · 架构 88% · 测试覆盖 82% · 性能 78% · 安全性 76% · 交互 N/A）
- **主攻薄弱维**：可靠性（脏数据/空值/类型转换边界）；测试覆盖（边界用例）
- **用户感知**：列重命名、类型转换、空值填充、简单过滤四类规则在 L1 样例表上可验证
- **类型**：补缺
- **验收标准**（来源 plan §ETL-001）：
  - 测试用例：四类规则 JSON 配置各至少 1 场景；规则链组合 1 场景
  - 挂载点：同步写托管库**前**应用规则（与 `etl_rules.py` 一致）
  - L1 集成用例含脏值输入 → 目标表字段符合预期

### 子项 5：DATA-001 SourceConnection 模型与 API 文档对齐

- **选题理由**：hub **83.2**，完整度 94%；DATA-005 文档回写要求 F16-DATA DATA-001 与 `SourceConnection` 实现对齐；API 契约是 L1 创建任务前置
- **选题时 PRD 加权总分**：**83.2**/100（用户价值 74% · 完整度 94% · 可靠性 82% · 架构 88% · 测试覆盖 78% · 性能 78% · 安全性 88% · 交互 N/A）
- **主攻薄弱维**：完整度（文档与 OpenAPI 一致性）；测试覆盖（CRUD + run API 契约）
- **用户感知**：OpenAPI 与 PRD 对 `SourceConnection` 字段描述一致；内联源连接创建任务无需 M3 数据源
- **类型**：补缺
- **验收标准**（来源 plan §DATA-001 + DATA-005 文档行）：
  - `prd/F16-DATA.md`：DATA-001 状态、验收勾选、`SourceConnection` 字段表与实现对齐
  - `docs/api/README.md` §9 同步 API 参数/示例与 OpenAPI 一致
  - API 测试：CRUD + `POST .../run` 返回结构与错误码覆盖
