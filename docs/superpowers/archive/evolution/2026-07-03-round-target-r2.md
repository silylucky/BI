# 演化轮次选题 — 2026-07-03 r2（M1 BOOT 测试与安全补强 · 向 90 推进）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — BOOT 测试覆盖与安全/可靠性补强（第二轮测试 push；推动加权总分由 73.9–82.2 向 ≥90 迈进）
- **来源**：`docs/automate/plan.md` §M1 BOOT 勾选 6/6 已完成；§文档回写 4 行仍为 `[ ]`（PR #6 已履约、无 BOOT-ID 格式，勾选留 P5/plan-fix）；`prd.md` hub 8 维 — 已实现 BOOT 项加权总分仍均 <90，主薄弱维仍为测试覆盖（45–80%）及 BOOT-002/006 安全性（58–66%）
- **合并理由**：上轮 PR #7（480aede）合并后 P5 重评 BOOT-001~006 测试覆盖 8–42% → 45–80%，总分 73.9–82.2；M1B 仍为 `queued`（`m1b_activation: after-M1-complete`），远期薄弱项 META-001（10.8）等完整度 5% 因未实现，不符合当前节执行顺序。同里程碑批处理深化 pytest/vitest 与鉴权负例，比跳跃 M1B 或 META 更符合 goal G1 工程基线
- **范围框定**：
  - **模块**（3）：`tests/`、`backend/app/auth/`、`fe/src/`（最小 smoke）
  - **文件**（合计约 12，≤20）：各子项所列测试与必要 fixture/helper；**不改** plan 文档回写结构
  - **不含**：M1B（DATA-*）；远期 META-001 / DESIGN-001 / CONN-021；重复上轮已交付的 migrations/trace/health 基础用例（仅扩展边缘场景）
- **不足 5 项原因**：不适用 — 本轮满 5 项；BOOT-004（82.2，测试覆盖 80%）让位更低分项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 术语字典，M11+ 远期，未实现 |
| DATA-004 | 12.5 | M1B queued，plan 明确 M1 完成后激活 |
| BOOT-004 | 82.2 | 六项最高；测试覆盖已 80%，主攻可靠性边际收益低于其余五项 |
| plan §文档回写 4 行 | — | PR #6 已落地实现；`[ ]` 为 plan 结构未同步，非重复实施选题 |
| AUTH-001 | 13.2 | M2 鉴权域，当前节 M1 未激活 |

### STUCK 标注（连续未过 90）

- **STUCK: BOOT-002 连续 3 轮未过 90**（最近 74.3）— 建议人工 `create-evolution-goal` / `create-evolution-plan` 复核验收标准若本轮仍不过
- **STUCK: BOOT-001 连续 3 轮未过 90**（最近 78.6）
- **STUCK: BOOT-006 连续 3 轮未过 90**（最近 77.4）
- BOOT-005 连续 2 轮（最近 73.9）；BOOT-003 连续 2 轮（最近 78.6）— 本轮纳入 push

---

### 子项 1：BOOT-005 数据库迁移框架 — Settings 校验与 env 绑定边缘测试

- **选题理由**：hub 显示 BOOT-005 加权总分 **73.9**（六项最低），测试覆盖 **55%**；上轮已补基础 migrations 导入测试，本轮扩展 `Settings` 缺省/非法 `DATABASE_URL`、env 覆盖与 `alembic.ini` script_location 一致性负例
- **选题时 PRD 加权总分**：73.9/100（用户价值 70% · 完整度 86% · 可靠性 70% · 架构 86% · 测试覆盖 **55%** · 性能 78% · 安全性 70% · 交互 N/A）
- **主攻薄弱维**：测试覆盖（55%）；可靠性（配置错配早暴露）
- **用户感知**：元库连接串缺失或格式错误时，开发者在 CI 即可看到明确失败信息，而非部署时才发现
- **类型**：补缺（测试补强）
- **验收标准**（来源 plan §BOOT-005 + §BOOT-006）：
  - 扩展 `tests/test_migrations.py`（或等价）：`Settings` 缺 `DATABASE_URL` 时明确失败；合法 URL monkeypatch 后 `migrations/env.py` 绑定一致
  - **不启动** docker postgres；`cd backend && pytest` 全绿

### 子项 2：BOOT-002 React 管理端壳层 — 路由与设计门禁深化 smoke

- **选题理由**：BOOT-002 加权总分 **74.3**（第二低），测试覆盖 **45%**、安全性 **58%**；上轮 vitest 最小 smoke 已合并，本轮补 AdminLayout 渲染断言、`check:design` 违规样例负向（或 token 豁免注释边界）与路由嵌套 `/admin/*` 可达性
- **选题时 PRD 加权总分**：74.3/100（用户价值 76% · 完整度 94% · 可靠性 68% · 交互体验 72% · 架构 92% · 测试覆盖 **45%** · 性能 82% · 安全性 **58%**）
- **主攻薄弱维**：测试覆盖（45%）；安全性（设计 Token 门禁可回归）
- **用户感知**：Admin 壳层与设计 Token 违规在 PR 合并前自动拦截，前端基线更可信赖
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-002 + §BOOT-006）：
  - `fe/` vitest 扩展：`AdminLayout` smoke（侧栏/主内容区挂载）；`/admin` 路由表含预期 path
  - CI frontend job 执行扩展测试；`pnpm build` + `check:design` 仍通过

### 子项 3：BOOT-003 鉴权中间件骨架 — 负例与公开路径覆盖

- **选题理由**：上轮让位未选；hub 加权总分 **78.6**，测试覆盖 **55%**；plan §BOOT-003 要求 `PUBLIC_PATHS` 豁免与 `Bearer dev` 占位，本轮补未授权/畸形 Token/公开路径矩阵 pytest
- **选题时 PRD 加权总分**：78.6/100（用户价值 82% · 完整度 96% · 可靠性 78% · 架构 88% · 测试覆盖 **55%** · 性能 86% · 安全性 78% · 交互 N/A）
- **主攻薄弱维**：测试覆盖（55%）；安全性（鉴权负例）
- **用户感知**：未带 Token 访问受保护 API 稳定 401；公开文档与健康检查无需 Token；开发占位 `Bearer dev` 行为可回归
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-003 验证）：
  - `tests/test_me.py` 或 `tests/test_auth.py` 扩展：`GET /api/v1/me` 无 Token → 401；`Authorization: Bearer invalid` → 401；`Bearer dev` → 200；`/health`、`/openapi.json` 无 Token → 200
  - `cd backend && pytest` 全绿

### 子项 4：BOOT-001 FastAPI 工程骨架 — 错误路径与 OpenAPI 契约测试

- **选题理由**：BOOT-001 加权总分 **78.6**，测试覆盖 **55%**；上轮已扩 CORS/health，本轮补 404 未知路由、OpenAPI `paths` 含 `/health` 与 `/api/v1/me`、中间件链顺序不破坏公开路径
- **选题时 PRD 加权总分**：78.6/100（用户价值 76% · 完整度 94% · 可靠性 76% · 架构 88% · 测试覆盖 **55%** · 性能 84% · 安全性 72% · 交互 N/A）
- **主攻薄弱维**：测试覆盖（55%）；可靠性（路由壳稳定性）
- **用户感知**：API 壳层契约在 CI 中可重复验证，联调前即可发现路由注册遗漏
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-001 验证）：
  - 扩展 `tests/test_health.py` 或新文件：`GET /nonexistent` → 404；`GET /openapi.json` JSON `paths` 含 `/health`；CORS 预检仍绿
  - `cd backend && pytest` 全绿

### 子项 5：BOOT-006 CI 与质量门禁 — 套件整合与鉴权 fixture 复用

- **选题理由**：BOOT-006 加权总分 **77.4**，测试覆盖 **70%**、安全性 **66%**；本轮前四项新增用例须被 CI 稳定拾取；统一 `conftest.py` 的 `auth_headers`/`client` fixture 供 auth/me/trace 复用，并确认 workflow 与本地命令等价
- **选题时 PRD 加权总分**：77.4/100（用户价值 75% · 完整度 88% · 可靠性 74% · 架构 88% · 测试覆盖 **70%** · 性能 78% · 安全性 **66%** · 交互 N/A）
- **主攻薄弱维**：测试覆盖（70% → 向 90）；安全性（CI 门禁完整性）
- **用户感知**：PR 合并前 backend + frontend 测试门禁覆盖鉴权与壳层场景，M1 质量基线可感知提升
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-006）：
  - `tests/conftest.py`：`auth_headers`（`Bearer dev`）与 `client` fixture 被子项 3–4 复用
  - `.github/workflows/ci.yml`：backend `pytest -v` 拾取全部新用例；frontend job 拾取子项 2 扩展测试
  - 本地 `cd backend && ruff check . && pytest -v` 与 CI 等价全绿
