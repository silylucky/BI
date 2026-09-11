# 演化轮次选题 — 2026-07-03（M1 BOOT 推分过线 r4）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — BOOT 测试覆盖与安全性 **r4 推分**（推动加权总分由 78.2–83.0 向 **≥90** 迈进，关闭 STUCK 循环）
- **来源**：`docs/automate/plan.md` §M1 — BOOT 勾选 6/6 已完成；§「M1 完成 — 文档回写」4 行仍为 `[ ]` 但 **PR #10 + P5 r3 已 idempotent 闭环**（plan 无 BOOT-ID 格式，勾选留 P5/plan-fix）；`prd.md` hub 8 维 — 已实现 BOOT 主薄弱维均为 **测试覆盖 68–82%**，加权总分仍 <90
- **合并理由**：饱和熔断已跳过（plan 有未完成 `[ ]`）；文档回写实施已合并，重复选题会空转。M1B `queued` 未激活前，同里程碑批处理五项最低分 BOOT 的测试/安全补强，比跳跃 META-001（10.8）等远期未实现项更符合 plan 顺序与 goal G1 工程基线
- **范围框定**：
  - **模块**（3）：`tests/`、`backend/app/`（core · auth · migrations）、`fe/`（BOOT-002 前端 smoke）
  - **文件**（合计约 12，≤20）：各子项所列测试与必要 fixture/CI 拾取
  - **不含**：M1B（DATA-*）；远期薄弱项 META-001 / DESIGN-001 / CONN-021；plan 文档回写重复实施（仅 P5 重评时同步 idempotent 对账）
- **不足 5 项原因**：不适用 — 本轮满 5 项，均为 M1 BOOT 推分同批主题

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非当前节 |
| BOOT-003 | 86.0 | 六项 BOOT 最高分，本轮让位更低分项 |
| DATA-004 | 12.5 | M1B queued，plan 明确 M1 全部完成后激活 |
| plan §文档回写 4 行 | — | PR #10 r3 已落地；plan `[ ]` 为结构未同步，非重复实施选题 |

### STUCK 标注（连续未过 90，本轮入选）

- **STUCK: BOOT-005 连续 4 轮未过 90**（最近 78.2）— 建议人工 `create-evolution-plan` 复核 M1 验收阈值若 r4 仍不过线
- **STUCK: BOOT-002 连续 5 轮未过 90**（最近 80.1）
- **STUCK: BOOT-006 连续 5 轮未过 90**（最近 82.5）
- **STUCK: BOOT-001 连续 5 轮未过 90**（最近 83.0）
- **STUCK: BOOT-004 连续 5 轮未过 90**（最近 83.0）

---

### 子项 1：BOOT-005 数据库迁移框架

- **选题理由**：hub 加权总分 **78.2**（六项 BOOT 最低），测试覆盖 **75%**、安全性 **72%**；plan §BOOT-005 交付 Alembic 链，可补 Settings URL 绑定、env 导入与凭证相关边界测试
- **选题时 PRD 加权总分**：78.2/100（用户价值 72% · 完整度 88% · 可靠性 76% · 架构 86% · 测试覆盖 **75%** · 性能 78% · 安全性 **72%** · 交互 N/A）
- **主攻薄弱维**：测试覆盖（75%）；安全性（72%）
- **用户感知**：CI 自动捕获迁移配置与数据库连接串错配，元库升级前可感知回归保障
- **类型**：补缺（测试/安全补强）
- **验收标准**（来源 plan §BOOT-005 + §BOOT-006）：
  - 扩展 `tests/test_migrations.py`（或等价）：`Settings.database_url` 与 `migrations/env.py` 绑定一致；非法 URL / 缺失 env 有结构化失败路径
  - `cd backend && pytest` 全绿；不将 `alembic upgrade` 纳入 CI

### 子项 2：BOOT-002 React 管理端壳层

- **选题理由**：加权总分 **80.1**，测试覆盖 **68%**（前端条件维最低档）、安全性 **72%**；plan §BOOT-002 要求 build + check:design，可扩 vitest 路由/布局 smoke 与 a11y 基础断言
- **选题时 PRD 加权总分**：80.1/100（用户价值 78% · 完整度 96% · 可靠性 72% · 交互体验 78% · 架构 92% · 测试覆盖 **68%** · 性能 82% · 安全性 **72%**）
- **主攻薄弱维**：测试覆盖（68%）；安全性（72%）
- **用户感知**：Admin 壳层与主题 Token 在 CI 有自动回归，前端基线质量可感知提升
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-002 + §BOOT-006）：
  - `fe/` vitest 扩充分支：AdminLayout 渲染、路由 `/admin` 可达、check:design 相关 smoke
  - `.github/workflows/ci.yml` frontend job 拾取；`pnpm build` + `check:design` 仍通过

### 子项 3：BOOT-006 CI 与质量门禁

- **选题理由**：加权总分 **82.5**，测试覆盖 **82%** 已较高但 reliability/security 仍有空间；本轮整合前四项新增用例，加固 conftest 与 CI 稳定性
- **选题时 PRD 加权总分**：82.5/100（用户价值 78% · 完整度 92% · 可靠性 80% · 架构 88% · 测试覆盖 **82%** · 性能 78% · 安全性 78% · 交互 N/A）
- **主攻薄弱维**：可靠性（80%）；测试覆盖（向 ≥90% 维度分推进）
- **用户感知**：PR 合并前 backend + frontend 测试门禁更完整， flaky 用例减少
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-006）：
  - `tests/conftest.py` 统一鉴权/TraceId fixture；CI backend + frontend job 拾取本轮全部新测
  - `cd backend && ruff check . && pytest` 与 `fe/` build + test + check:design 全绿

### 子项 4：BOOT-001 FastAPI 工程骨架

- **选题理由**：加权总分 **83.0**，测试覆盖 **72%**、安全性 **74%**；plan §BOOT-001 要求 health/CORS/OpenAPI，可扩异常分支与公开路径边界测试
- **选题时 PRD 加权总分**：83.0/100（用户价值 78% · 完整度 98% · 可靠性 82% · 架构 88% · 测试覆盖 **72%** · 性能 84% · 安全性 **74%** · 交互 N/A）
- **主攻薄弱维**：测试覆盖（72%）；安全性（74%）
- **用户感知**：健康检查、CORS 预检与 OpenAPI 公开路径行为在 CI 可重复验证
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-001 验证）：
  - 扩展 `tests/test_health.py`：CORS 预检、非法 Origin、公开路径 `/docs`/`/openapi.json` 边界
  - `cd backend && pytest` 全绿

### 子项 5：BOOT-004 配置与日志基线

- **选题理由**：加权总分 **83.0**，用户价值 **74%** 相对偏低，测试覆盖 **80%**、安全性 **78%**；plan §BOOT-004 要求 TraceId 日志 JSON，可补日志 context 与 Settings 校验测试
- **选题时 PRD 加权总分**：83.0/100（用户价值 **74%** · 完整度 98% · 可靠性 78% · 架构 90% · 测试覆盖 **80%** · 性能 82% · 安全性 78% · 交互 N/A）
- **主攻薄弱维**：用户价值（74%）；测试覆盖（80%）
- **用户感知**：每次请求的 trace 可追踪性与配置加载错误可在合并前暴露
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-004 验证）：
  - 扩展 `tests/test_trace.py`（或等价）：`GET /health` 日志含 `traceId`；透传 `X-Trace-Id`；Settings 缺省/非法 `LOG_LEVEL` 等边界
  - `cd backend && pytest` 全绿
