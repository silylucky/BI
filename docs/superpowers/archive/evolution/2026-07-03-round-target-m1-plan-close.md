# 演化轮次选题 — 2026-07-03（M1 完成 — 文档回写 plan 勾选闭环）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — **文档回写验证与 plan 勾选闭环**（对齐 plan §「M1 完成 — 文档回写」4 行，使 M1 当前节全部 `[x]`，满足 `m1b_activation: after-M1-complete`）
- **来源**：`docs/automate/plan.md` §M1 — BOOT 勾选 6/6 已完成；**§文档回写 4 行仍为 `[ ]`**（当前节唯一未完成块）；`prd.md` hub — 已实现 BOOT 加权总分 **82.4–86.1**（仍 <90），主薄弱维测试覆盖；远期 META-001（10.8）等完整度 5% 因未实现，非当前节
- **合并理由**：PR #10 已落地文档回写实施、PR #11 完成 BOOT 测试 r4，但 plan 无 `- [ ] <prd ID>:` 格式导致 §文档回写 4 行未被 P5 勾选。在 M1B queued 前提下，本轮以 **idempotent 对账 + 缺口修补 + P5 plan 勾选** 关闭 M1，避免再开第六轮纯测试 push（STUCK 6 轮仍 <90）
- **范围框定**：
  - **模块**（2）：`docs/`（api · services · arch · automate/prd）
  - **文件**（合计约 6，≤20）：`docs/api/README.md`、`docs/services/core.md`、`docs/services/auth.md`、`docs/arch.md`、`docs/automate/prd/F01-BOOT.md`；按需只读 `docs/services/README.md` 索引一行状态
  - **不含**：M1B（DATA-*）；远期薄弱项 META-001 / DESIGN-001 / CONN-021；大规模测试补强（留人工 `create-evolution-plan` 复核 ≥90 阈值）；生产代码变更（除非对账发现文档与实现严重漂移需极小锚点修正）
- **不足 5 项原因**：不适用 — plan 文档回写 4 行拆为 5 个子项（services 拆 core/auth 两行），满 5 项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非当前节 |
| BOOT-* 测试补强 r5 | 82.4–86.1 | 连续 4–6 轮 STUCK <90；plan 强制文档回写未勾选，优先关闭 M1 当前节 |
| DATA-004 | 12.5 | M1B queued，plan 明确 M1 全部完成后激活 |

### STUCK 标注（连续未过 90，本轮入选 BOOT 文档/plan 对齐）

- **STUCK: BOOT-002 连续 6 轮未过 90**（最近 84.7）— 本轮仅文档/PRD/plan 对齐，不重复测试实施
- **STUCK: BOOT-005 连续 5 轮未过 90**（最近 82.4）
- **STUCK: BOOT-006 连续 6 轮未过 90**（最近 84.5）
- **STUCK: BOOT-001 连续 6 轮未过 90**（最近 86.0）
- **STUCK: BOOT-004 连续 6 轮未过 90**（最近 86.1）
- **STUCK: BOOT-003 连续 4 轮未过 90**（最近 86.0）
- 建议：M1 plan 闭环后若 BOOT 仍长期 <90，人工 `create-evolution-plan` 复核 M1 验收阈值或下调推分目标、激活 M1B

---

### 子项 1：BOOT-001 + BOOT-003 — API 登记簿 idempotent 对账（`/health` · `/api/v1/me`）

- **选题理由**：plan §文档回写第 1 行；BOOT-001 提供 `/health` 与 OpenAPI 壳层，BOOT-003 提供 `GET /api/v1/me` M1 占位验收
- **选题时 PRD 加权总分**：BOOT-001 **86.0**/100（用户价值 78% · 完整度 98% · 可靠性 84% · 架构 88% · 测试覆盖 86% · 性能 84% · 安全性 82% · 交互 N/A）；BOOT-003 **86.0**/100（用户价值 82% · 完整度 98% · 可靠性 82% · 架构 88% · 测试覆盖 **78%** · 性能 86% · 安全性 86% · 交互 N/A）
- **主攻薄弱维**：完整度（登记簿与实现一致）；BOOT-003 测试覆盖（78%）间接受益（登记簿引用已有 pytest 锚点）
- **用户感知**：`docs/api/README.md` 可查 M1 已实现路由与代码锚点，联调与 Agent 读契约不再误判为未实现
- **类型**：补缺（文档同步 / idempotent 验证）
- **验收标准**（来源 plan §M1 完成 — 文档回写 第 1 行）：
  - `docs/api/README.md`：`GET /health` 状态 → **已实现**；**新增** `GET /api/v1/me`（M1 占位验收，锚点 `backend/app/api/v1/me.py`）
  - §1 `auth/me` 保留「规划」并注「二期正式路径」
  - 对账无缺口则 idempotent 通过；不新增 HTTP 路由

### 子项 2：BOOT-004 — 域附录 `docs/services/core.md` 状态与锚点

- **选题理由**：plan §文档回写第 2 行（core 半）；BOOT-004 交付 Settings、logging、TraceIdMiddleware
- **选题时 PRD 加权总分**：**86.1**/100（用户价值 78% · 完整度 98% · 可靠性 84% · 架构 90% · 测试覆盖 90% · 性能 82% · 安全性 80% · 交互 N/A）
- **主攻薄弱维**：完整度（域文档状态与 `backend/app/core/` 一致）
- **用户感知**：研发读 services 附录可知 core 域 M1 已实现能力与边界
- **类型**：补缺
- **验收标准**（来源 plan §文档回写 + prd-sync 总表）：
  - `docs/services/core.md`：实现状态 → 已实现；代码锚点含 `config.py`、`logging.py`、`middleware.py`（TraceId）、CORS 相关 Settings 字段
  - `docs/services/README.md` 索引行状态与 core 一致（若已有索引）

### 子项 3：BOOT-003 — 域附录 `docs/services/auth.md` 状态与锚点

- **选题理由**：plan §文档回写第 2 行（auth 半）；BOOT-003 鉴权中间件 + `main.py` 注册
- **选题时 PRD 加权总分**：**86.0**/100（用户价值 82% · 完整度 98% · 可靠性 82% · 架构 88% · 测试覆盖 **78%** · 性能 86% · 安全性 86% · 交互 N/A）
- **主攻薄弱维**：完整度；安全性（公开路径 `PUBLIC_PATHS` 文档化）
- **用户感知**：auth 域边界、依赖与入口（middleware、deps、me 路由）可在 services 附录一次性读懂
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-003 + §文档回写）：
  - `docs/services/auth.md`：状态已实现；锚点 `auth/middleware.py`、`auth/deps.py`、`api/v1/me.py`；**明确** `AuthMiddleware` 在 `main.py` 注册；公开路径列表与 plan 一致

### 子项 4：BOOT-001 ~ BOOT-006 — `docs/arch.md` 架构真理源对齐

- **选题理由**：plan §文档回写第 3 行；跨 BOOT 架构注记（auth 挂载、M1 过渡布局、PRD 计数）
- **选题时 PRD 加权总分**（代表项 BOOT-004）：**86.1**/100（架构 90% 为主攻）
- **主攻薄弱维**：架构健康（文档分层与目录约定一致）
- **用户感知**：arch.md 与当前 M1 目录/挂载方式一致，避免误读 `frontend/` 或错误鉴权注册点
- **类型**：补缺
- **验收标准**（来源 plan §文档回写第 3 行）：
  - §4.2 `auth` 挂载改为 **`main.py` 注册** `AuthMiddleware`
  - §4.3 增 **M1 过渡布局**注记（`fe/` 壳层、不含二期 API 客户端）
  - §10 PRD hub 计数 → **124 项**
  - 不重复 PRD 验收条款（见 prd-sync 边界）

### 子项 5：BOOT-001 ~ BOOT-006 — `prd/F01-BOOT.md` 状态验收 + plan §文档回写勾选

- **选题理由**：plan §文档回写第 4 行 + P5 须将 4 行 `[ ]` → `[x]`；六项 BOOT 均已实现但分片/plan 可能仍未闭环
- **选题时 PRD 加权总分**（六项范围）：**82.4–86.1**/100；主薄弱维仍为测试覆盖 78–90%
- **主攻薄弱维**：完整度（验收标准勾选与代码锚点）；plan 当前节完成度
- **用户感知**：PRD 分片与 plan 反映 M1 BOOT 真实交付状态，演化可激活 M1B
- **类型**：补缺
- **验收标准**（来源 plan §文档回写第 4 行 + P5 plan 勾选规则）：
  - `docs/automate/prd/F01-BOOT.md`：BOOT-001~006 状态 → **已实现**；验收标准逐条勾选
  - BOOT-003 代码锚点与 plan 一致（`auth/middleware.py` + **`main.py` 注册**）
  - P5：`plan.md` §「M1 完成 — 文档回写」4 行勾选为 `[x]`（附完成日期）；hub 修订记录若完整度维有变化则同步
