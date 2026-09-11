# 演化轮次选题 — 2026-07-03（M1 BOOT 质量推分 r9）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — **BOOT 轮换质量推分 r9**（推动 BOOT-* 加权总分由 85.9–87.7 向 **≥90** 迈进；补强性能、用户价值与安全性，BOOT-002 补前端交互体验）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无活跃 `[ ]` 里程碑节；`prd.md` hub 8 维 — **已实现最低分** BOOT-005/006(85.9) · BOOT-001(86.5) · BOOT-004(87.4) · BOOT-002(87.7)；`git log -5` 显示上轮 r8 已合并 DATA-003/002/004/001/005 质量推分（PR #22）
- **合并理由**：饱和熔断未触发（plan 无未完成项，但 Top5 薄弱汇总均为远期未实现 10.8–11.1，非饱和）；M1+M1B 功能已交付，r8 连续聚焦 DATA 域后本轮按 automation memory 建议 **BOOT rotation**；六项 BOOT 连续 9–10 轮 STUCK <90，比重复 DATA 或跳跃 META-001 等远期项更符合 goal G1 工程基线与 plan §M1 已交付项质量闭环
- **范围框定**：
  - **模块**（3）：`tests/`、`backend/app/`（core · auth · migrations）、`fe/`（BOOT-002 前端 smoke）
  - **文件**（合计约 14，≤20）：各子项所列测试、必要 fixture、CI 拾取；**不修改** `goal.md` / `plan.md` 结构
  - **不含**：DATA-* / ETL-001（r8 已推分，本轮让位 BOOT）；远期 CONN/META/DESIGN 未实现项；M2+ AUTH/DS 新功能立项
- **不足 5 项原因**：不适用 — 本轮满 5 项，均为 M1 BOOT 推分同批主题

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，完整度 5% 因未实现 |
| DESIGN-001 | 10.8 | F12-DESIGN 拖拽查询，M10+ 治理设计器 |
| CONN-021 | 10.9 | TiDB 连接器属 M4，非 M1/M1B |
| DATA-003 | 85.4 | r8 已入选并合并；本轮 BOOT rotation |
| DATA-002 | 85.5 | r8 已入选并合并 |
| ETL-001 | 85.9 | r7 已推分；本轮聚焦 BOOT STUCK 集群 |
| BOOT-003 | 87.9 | 六项 BOOT 最高分，本轮让位更低分项 |

### STUCK 标注（连续未过 90，本轮入选）

- **STUCK: BOOT-005 连续 10 轮未过 90**（最近 85.9）— 建议人工 `create-evolution-plan` 复核 M1 验收阈值若 r9 仍不过线
- **STUCK: BOOT-006 连续 10 轮未过 90**（最近 85.9）
- **STUCK: BOOT-002 连续 10 轮未过 90**（最近 87.7）
- **STUCK: BOOT-001 连续 9 轮未过 90**（最近 86.5）
- **STUCK: BOOT-004 连续 9 轮未过 90**（最近 87.4）

---

### 子项 1：BOOT-005 数据库迁移框架

- **选题理由**：hub **加权总分最低 BOOT 项 85.9**（与 BOOT-006 并列）；**用户价值 76%**、**性能 78%** 为主薄弱维；plan §BOOT-005 要求 Alembic 链与 `DATABASE_URL` 绑定，可补 Settings 边界、revision 链与凭证路径测试
- **选题时 PRD 加权总分**：85.9/100（用户价值 **76%** · 完整度 94% · 可靠性 86% · 架构 86% · 测试覆盖 98% · 性能 **78%** · 安全性 84% · 交互 N/A）
- **主攻薄弱维**：用户价值（76%）；性能（78%）
- **用户感知**：迁移配置与数据库连接错配在 CI 可捕获；元库升级路径更可预期
- **类型**：补缺（测试/性能补强）
- **验收标准**（来源 plan §BOOT-005 + §BOOT-006）：
  - 扩展 `tests/test_migrations.py`（或等价）：`Settings.database_url` 与 `migrations/env.py` 绑定；非法 URL / 缺失 env 结构化失败；revision 链 head 可达
  - `cd backend && pytest` 全绿；不将 `alembic upgrade` 纳入 CI

### 子项 2：BOOT-006 CI 与质量门禁

- **选题理由**：加权总分 **85.9**（并列最低）；**性能 78%**、**安全性 80%** 为主薄弱维；plan §BOOT-006 要求 backend + frontend job 全绿，可整合本轮新增用例并加固 conftest 稳定性
- **选题时 PRD 加权总分**：85.9/100（用户价值 78% · 完整度 92% · 可靠性 90% · 架构 88% · 测试覆盖 94% · 性能 **78%** · 安全性 **80%** · 交互 N/A）
- **主攻薄弱维**：性能（78%）；安全性（80%）
- **用户感知**：PR 合并前 backend + frontend 测试门禁更完整；flaky 用例减少
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-006）：
  - `tests/conftest.py` 统一鉴权/TraceId fixture；`.github/workflows/ci.yml` 拾取本轮全部新测
  - `cd backend && ruff check . && pytest` 与 `fe/` build + test + check:design 全绿

### 子项 3：BOOT-001 FastAPI 工程骨架

- **选题理由**：加权总分 **86.5**（BOOT 第三低）；**用户价值 78%**、**性能 84%**、**安全性 82%** 仍有空间；plan §BOOT-001 要求 health/CORS/OpenAPI，可扩异常分支与公开路径边界测试
- **选题时 PRD 加权总分**：86.5/100（用户价值 **78%** · 完整度 98% · 可靠性 86% · 架构 88% · 测试覆盖 90% · 性能 84% · 安全性 **82%** · 交互 N/A）
- **主攻薄弱维**：用户价值（78%）；安全性（82%）
- **用户感知**：健康检查、CORS 预检与 OpenAPI 公开路径行为在 CI 可重复验证
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-001 验证）：
  - 扩展 `tests/test_health.py`：CORS 预检、非法 Origin、公开路径 `/docs`/`/openapi.json` 边界；启动耗时 smoke（可选 P95 断言）
  - `cd backend && pytest` 全绿

### 子项 4：BOOT-004 配置与日志基线

- **选题理由**：加权总分 **87.4**；**性能 82%**、**安全性 84%** 为主薄弱维；plan §BOOT-004 要求 Settings/JSON 日志/traceId，可补配置热加载边界与日志字段契约测试
- **选题时 PRD 加权总分**：87.4/100（用户价值 80% · 完整度 98% · 可靠性 84% · 架构 90% · 测试覆盖 94% · 性能 **82%** · 安全性 **84%** · 交互 N/A）
- **主攻薄弱维**：性能（82%）；安全性（84%）
- **用户感知**：配置错配与 traceId 缺失在合并前可感知；日志 JSON 契约稳定
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-004）：
  - 扩展 `tests/test_config.py`（或等价）：`Settings` 必填/枚举/长度边界；`TraceIdMiddleware` 透传 `X-Trace-Id`；日志 JSON 含 `traceId`
  - `cd backend && pytest` 全绿

### 子项 5：BOOT-002 React 管理端壳层

- **选题理由**：加权总分 **87.7**；**安全性 80%**、**性能 82%** 为主薄弱维；plan §BOOT-002 要求 build + check:design，可扩 vitest 路由/布局/a11y smoke 与响应式 viewport 断言
- **选题时 PRD 加权总分**：87.7/100（用户价值 80% · 完整度 96% · 可靠性 82% · 交互体验 88% · 架构 92% · 测试覆盖 94% · 性能 **82%** · 安全性 **80%**）
- **主攻薄弱维**：安全性（80%）；性能（82%）
- **用户感知**：Admin 壳层与主题 Token 在 CI 有自动回归；多 viewport 布局稳定
- **类型**：补缺（FE 测试 + UX 补强）
- **验收标准**（来源 plan §BOOT-002 + §BOOT-006）：
  - `fe/` vitest 扩充分支：AdminLayout 渲染、路由 `/admin` 可达、侧栏折叠/响应式 smoke、check:design 相关断言
  - `pnpm test` + `build` + `check:design` 全绿；CI frontend job 拾取
