# 演化轮次选题 — 2026-07-03（M1 文档回写收尾 · 关闭当前节）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — **文档回写收尾**（对齐 plan §「M1 完成 — 文档回写」4 行勾选清单，使 M1 当前节可 P5 闭环）
- **来源**：`docs/automate/plan.md` §M1 — BOOT 勾选 6/6 已完成；**§文档回写 4 行仍为 `[ ]`**（当前节唯一未完成块）；`prd.md` hub — 已实现 BOOT 加权总分 77.9–85.6，主薄弱维测试覆盖；远期 META-001（10.8）等完整度 5% 因未实现
- **合并理由**：上轮 r1/r2 聚焦 pytest/vitest 测试补强（PR #7/#8）；PR #6 曾部分履约文档回写但 plan 无 BOOT-ID 格式行未勾选。在 `m1b_activation: after-M1-complete` 前提下，**必须先完成文档回写**再激活 M1B；同批处理 API 登记簿、域附录、架构与 PRD 分片状态，避免分散 4 轮 PR
- **范围框定**：
  - **模块**（2）：`docs/`（api · services · arch · automate/prd）
  - **文件**（合计约 6，≤20）：`docs/api/README.md`、`docs/services/core.md`、`docs/services/auth.md`、`docs/arch.md`、`docs/automate/prd/F01-BOOT.md`；按需只读 `docs/services/README.md` 索引一行状态
  - **不含**：生产代码变更（除非发现文档与实现严重漂移需极小锚点修正）；M1B（DATA-*）；远期薄弱项 META-001 / DESIGN-001 / CONN-021；重复上轮测试补强
- **不足 5 项原因**：不适用 — plan 文档回写 4 行拆为 5 个子项（services 拆 core/auth 两行），满 5 项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非当前节 |
| BOOT-* 测试补强 r3 | 77.9–85.6 | 连续两轮测试 push 后仍 <90；本轮优先 plan 强制文档回写以关闭 M1，测试 STUCK 留人工复核或后续轮 |
| DATA-004 | 12.5 | M1B queued，plan 明确 M1 全部完成后激活 |

### STUCK 标注（连续未过 90，本轮入选 BOOT 文档对齐）

- **STUCK: BOOT-001 连续 4 轮未过 90**（最近 82.2）— 本轮仅文档/PRD 状态对齐，不重复测试实施
- **STUCK: BOOT-002 连续 4 轮未过 90**（最近 79.8）
- **STUCK: BOOT-004 连续 4 轮未过 90**（最近 82.2）
- **STUCK: BOOT-005 连续 3 轮未过 90**（最近 77.9）
- **STUCK: BOOT-006 连续 4 轮未过 90**（最近 82.1）
- **STUCK: BOOT-003 连续 3 轮未过 90**（最近 85.6）
- 建议：若 M1 文档闭环后 BOOT 仍长期 <90，人工 `create-evolution-plan` 复核 M1 验收阈值或拆分里程碑

---

### 子项 1：BOOT-001 + BOOT-003 — API 登记簿回写（`/health` · `/api/v1/me`）

- **选题理由**：plan §文档回写第 1 行；BOOT-001 提供 `/health` 与 OpenAPI 壳层，BOOT-003 提供 `GET /api/v1/me` M1 占位验收；hub 加权总分 BOOT-001 **82.2**、BOOT-003 **85.6**，完整度 94–96% 但 API 登记簿可能仍为「规划」
- **选题时 PRD 加权总分**：BOOT-001 82.2/100（用户价值 78% · 完整度 94% · 可靠性 82% · 架构 88% · 测试覆盖 72% · 性能 84% · 安全性 74% · 交互 N/A）；BOOT-003 85.6/100（用户价值 82% · 完整度 96% · 可靠性 82% · 架构 88% · 测试覆盖 78% · 性能 86% · 安全性 86% · 交互 N/A）
- **主攻薄弱维**：完整度（文档与实现一致）；测试覆盖间接受益（登记簿可引用已有 pytest 锚点）
- **用户感知**：`docs/api/README.md` 可查 M1 已实现路由与代码锚点，联调与 Agent 读契约不再误判为未实现
- **类型**：补缺（文档同步）
- **验收标准**（来源 plan §M1 完成 — 文档回写 第 1 行）：
  - `docs/api/README.md`：`GET /health` 状态 → **已实现**；**新增** `GET /api/v1/me`（M1 占位验收，锚点 `backend/app/api/v1/me.py`）
  - §1 `auth/me` 保留「规划」并注「二期正式路径」
  - 不新增 HTTP 路由；仅文档与 plan 对齐

### 子项 2：BOOT-004 — 域附录 `docs/services/core.md` 状态与锚点

- **选题理由**：plan §文档回写第 2 行（core 半）；BOOT-004 交付 Settings、logging、TraceIdMiddleware；hub 加权总分 **82.2**，架构 90%、完整度 94%
- **选题时 PRD 加权总分**：82.2/100（用户价值 74% · 完整度 94% · 可靠性 78% · 架构 90% · 测试覆盖 80% · 性能 82% · 安全性 78% · 交互 N/A）
- **主攻薄弱维**：完整度（域文档状态与 `backend/app/core/` 一致）
- **用户感知**：研发读 services 附录可知 core 域 M1 已实现能力与边界
- **类型**：补缺
- **验收标准**（来源 plan §文档回写 + prd-sync 总表）：
  - `docs/services/core.md`：实现状态 → 已实现；代码锚点含 `config.py`、`logging.py`、`middleware.py`（TraceId）、CORS 相关 Settings 字段
  - `docs/services/README.md` 索引行状态与 core 一致（若已有索引）

### 子项 3：BOOT-003 — 域附录 `docs/services/auth.md` 状态与锚点

- **选题理由**：plan §文档回写第 2 行（auth 半）；BOOT-003 鉴权中间件 + `main.py` 注册；hub 加权总分 **85.6**
- **选题时 PRD 加权总分**：85.6/100（用户价值 82% · 完整度 96% · 可靠性 82% · 架构 88% · 测试覆盖 78% · 性能 86% · 安全性 86% · 交互 N/A）
- **主攻薄弱维**：完整度；安全性（公开路径 `PUBLIC_PATHS` 文档化）
- **用户感知**：auth 域边界、依赖与入口（middleware、deps、me 路由）可在 services 附录一次性读懂
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-003 + §文档回写）：
  - `docs/services/auth.md`：状态已实现；锚点 `auth/middleware.py`、`auth/deps.py`、`api/v1/me.py`；**明确** `AuthMiddleware` 在 `main.py` 注册；公开路径列表与 plan 一致

### 子项 4：BOOT-001 ~ BOOT-006 — `docs/arch.md` 架构真理源对齐

- **选题理由**：plan §文档回写第 3 行；跨 BOOT 架构注记（auth 挂载、M1 过渡布局、PRD 计数）
- **选题时 PRD 加权总分**（代表项 BOOT-004）：82.2/100（架构 90% 为主攻）
- **主攻薄弱维**：架构健康（文档分层与目录约定一致）
- **用户感知**：arch.md 与当前 M1 目录/挂载方式一致，避免误读 `frontend/` 或错误鉴权注册点
- **类型**：补缺
- **验收标准**（来源 plan §文档回写第 3 行）：
  - §4.2 `auth` 挂载改为 **`main.py` 注册** `AuthMiddleware`
  - §4.3 增 **M1 过渡布局**注记（`fe/` 壳层、不含二期 API 客户端）
  - §10 PRD hub 计数 → **124 项**
  - 不重复 PRD 验收条款（见 prd-sync 边界）

### 子项 5：BOOT-001 ~ BOOT-006 — `prd/F01-BOOT.md` 状态与验收勾选

- **选题理由**：plan §文档回写第 4 行；P5 需分片状态与 hub 8 维一致；六项 BOOT 均已实现但分片可能仍为部分勾选
- **选题时 PRD 加权总分**（六项范围）：77.9–85.6/100；主薄弱维仍为测试覆盖 68–82%
- **主攻薄弱维**：完整度（验收标准勾选与代码锚点）
- **用户感知**：PRD 分片反映 M1 BOOT 真实交付状态，演化后续轮次不再重复 M1 实施
- **类型**：补缺
- **验收标准**（来源 plan §文档回写第 4 行）：
  - `docs/automate/prd/F01-BOOT.md`：BOOT-001~006 状态 → **已实现**；验收标准逐条勾选
  - BOOT-003 代码锚点与 plan 一致（`auth/middleware.py` + **`main.py` 注册**）
  - P5 同步 hub 修订记录（若完整度维有变化）；plan §文档回写 4 行由 P5 勾选（picker 不改 plan 结构）
