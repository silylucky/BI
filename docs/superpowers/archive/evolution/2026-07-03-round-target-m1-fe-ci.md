# 演化轮次选题 — 2026-07-03（M1 前端壳层 + CI 收尾）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：M1 P0 工程基线 — 前端 Admin 壳层 + CI 质量门禁 + M1 文档回写（完成 M1 当前节全部未完成勾选）
- **来源**：`docs/automate/plan.md` §M1 勾选清单剩余项 `BOOT-002`、`BOOT-006` + §M1 完成文档回写；`prd.md` hub 8 维作 tie-break 与评分引用
- **合并理由**：上轮已交付后端启动链（BOOT-004/001/005/003，PR #2 已合并）；plan 推荐顺序余下 `BOOT-002 → BOOT-006` 构成 M1 闭环——前端壳层使 `/admin` 可访问，CI 门禁固化 ruff/pytest/build/check:design，文档回写对齐实现状态
- **范围框定**：
  - **模块**（≤3）：`fe/`（前端壳层）、`tests/` + `.github/workflows/`（CI）、`docs/`（M1 收尾回写）
  - **文件**（合计约 19，≤20 上限）：见各子项
  - **不含**：TanStack Query、`@/lib/queryKeys`、`mapApiError`（二期联调，见 plan §BOOT-002 注记）；M1B（DATA-*）；非 M1 远期薄弱项（META/DESIGN/CONN）
- **不足 5 项原因**：plan M1 勾选仅剩 2 个 prd ID（BOOT-002、BOOT-006）；按 plan 实施展开拆为 5 个可批处理子项以覆盖交付物与验收，未突破单轮文件/模块上限

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-001 | 10.8 | F11-META 远期术语字典，不在 M1 当前节 |
| DESIGN-001 | 10.8 | F12-DESIGN 治理设计器，里程碑 M10+ |
| CONN-021 | 10.9 | TiDB 连接器属 M4，M1 未激活 |
| BOOT-001 | 69.4 | plan 已勾选完成；本轮不重复实施（STUCK 计数 1，未达 ≥3） |
| BOOT-003 | 73.4 | 同上，上轮已交付 |
| BOOT-004 | 70.7 | 同上，上轮已交付 |
| BOOT-005 | 66.8 | 同上，上轮已交付 |

---

### 子项 1：BOOT-002 FE 工程脚手架与 Design Token

- **选题理由**：plan §M1 推荐顺序第 5 项；无 pnpm/Vite/Tailwind/shadcn 基元则无法构建 Admin 壳层；M1 明确要求按 b-design-system `from-zero.md` 落地 Token
- **选题时 PRD 加权总分**：12.0/100（用户价值 51% · 完整度 5% · 可靠性 0% · 架构 9% · 测试 0% · 性能 0% · 安全 9% · 交互 N/A）
- **主攻薄弱维**：完整度、可靠性、测试覆盖、性能（均 ≤40%）
- **用户感知**：`pnpm dev` 可启动前端；Tailwind v4 + 设计 Token 加载；shadcn 基元（button、input 等）可在壳层复用
- **类型**：补缺（M1 前端工程未落地）
- **验收标准**（来源 plan §BOOT-002）：
  - `fe/package.json` 含 react、react-router v7、tailwind v4、shadcn/Radix 最小集；`dev` 支持 proxy 或 `VITE_API_BASE_URL`
  - `fe/vite.config.ts` 可构建
  - `fe/src/index.css` 含 Tailwind v4 + 设计系统 Token
  - `fe/src/components/ui/*` shadcn 基元最小集
  - `fe/src/components/README.md` 列 `ui/` 基元索引
  - `fe/.env.example` 含 `VITE_API_BASE_URL`
- **范围框定**：
  - `fe/package.json`
  - `fe/vite.config.ts`
  - `fe/src/index.css`
  - `fe/src/components/ui/*`（button、input 等最小集）
  - `fe/src/components/README.md`
  - `fe/.env.example`

### 子项 2：BOOT-002 Admin 壳层与路由

- **选题理由**：plan §BOOT-002 核心用户可见交付；290px 侧栏 Admin 壳层与 `/admin/*` 路由是 M1 联调验收前提（浏览器 :5173/admin）
- **选题时 PRD 加权总分**：12.0/100（同上 BOOT-002）
- **主攻薄弱维**：完整度、交互体验（壳层就绪后 ux 维可在 P5 重评）
- **用户感知**：浏览器访问 `/admin` 可见管理端壳层（侧栏 + 内容区）；主题与 layout.md §2 一致
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-002 + `layout.md` §2）：
  - `fe/src/layouts/AdminLayout.tsx`：290px 侧栏 Admin 壳层
  - `fe/src/routes.tsx`：react-router v7 嵌套路由；`/admin/*` 挂 `AdminLayout`
  - `cd fe && pnpm build` 成功
  - 浏览器访问 `/admin` 壳层可渲染
- **范围框定**：
  - `fe/src/layouts/AdminLayout.tsx`
  - `fe/src/routes.tsx`
  - `fe/src/main.tsx`（或入口文件，挂路由 Provider）
  - `fe/index.html`（若需）

### 子项 3：BOOT-002 设计合规门禁 check:design

- **选题理由**：plan §BOOT-002 明确要求 `check:design` 禁止硬编码色；与 BOOT-006 CI frontend job 联动，防止 Token 漂移
- **选题时 PRD 加权总分**：12.0/100（同上 BOOT-002）
- **主攻薄弱维**：架构健康、测试覆盖（静态门禁弥补 M1 无 E2E）
- **用户感知**：CI 与本地 `pnpm run check:design` 可拦截 `#hex`/`rgb(` 硬编码色，设计系统约束可执行
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-002）：
  - `fe/scripts/check-design.mjs` 扫描 `fe/src` 禁止 `#hex`/`rgb(`（`@design-token-ok` 豁免）
  - `fe/package.json` scripts 含 `"check:design": "node scripts/check-design.mjs"`
  - `pnpm run check:design` 退出码 0
- **范围框定**：
  - `fe/scripts/check-design.mjs`
  - `fe/package.json`（`check:design` script 行，与子项 1 协同）

### 子项 4：BOOT-006 CI 流水线与后端 smoke 测试

- **选题理由**：plan §M1 勾选清单末项；固化 ruff/pytest/build/check:design，使后续演化 PR 有自动化质量门禁；`test_health.py` 覆盖已交付 `/health`
- **选题时 PRD 加权总分**：12.8/100（用户价值 50% · 完整度 5% · 可靠性 0% · 架构 13% · 测试 0% · 性能 0% · 安全 13% · 交互 N/A）
- **主攻薄弱维**：完整度、可靠性、测试覆盖
- **用户感知**：PR 触发 GitHub Actions；backend ruff + pytest、frontend build + check:design 全绿方可合并
- **类型**：补缺
- **验收标准**（来源 plan §BOOT-006）：
  - `.github/workflows/ci.yml`：PR 触发；backend job `ruff check` + `pytest`；frontend job `pnpm install` + `build` + `check:design`；**不启动** docker postgres
  - `.gitignore` 忽略 `.env`、`node_modules/`、`fe/dist/` 等
  - `tests/conftest.py`：`TestClient(app)` fixture
  - `tests/test_health.py`：`GET /health` → 200 smoke
  - `backend/pyproject.toml` 已有 `[tool.ruff]`、`[tool.pytest.ini_options]`（BOOT-001 交付，本轮仅验证 CI 引用）
- **范围框定**：
  - `.github/workflows/ci.yml`
  - `.gitignore`
  - `tests/conftest.py`
  - `tests/test_health.py`

### 子项 5：BOOT-006 M1 文档回写与联调验收锚点

- **选题理由**：plan §「M1 完成 — 文档回写」为 M1 收尾必达；P5 须同步 prd 状态、api 登记、services/arch 锚点；联调步骤写入验收证据
- **选题时 PRD 加权总分**：12.8/100（同上 BOOT-006）；回写后 BOOT-001~006 completeness 维应在 P5 重评上升
- **主攻薄弱维**：完整度（文档与实现一致）
- **用户感知**：文档反映 M1 已实现能力；开发者可按 arch §9 完成本地联调
- **类型**：补缺（文档对齐，非新功能创造）
- **验收标准**（来源 plan §M1 完成 — 文档回写 + §BOOT-006 联调）：
  - `docs/api/README.md`：`/health` → 已实现；新增 `GET /api/v1/me`（M1 占位）；§1 `auth/me` 保留「规划」注记
  - `docs/services/core.md`、`auth.md`：状态与锚点（CORS、TraceId、`AuthMiddleware`）
  - `docs/arch.md`：§4.2 `auth` 挂载注记；§4.3 M1 过渡布局；§10 PRD hub 计数 124 项
  - `prd/F01-BOOT.md`：BOOT-001~006 状态 → 已实现，验收标准勾选
  - 本地联调：`docker compose up` + backend uvicorn + `fe pnpm dev` → `:5173/admin` 可访问、API 无 CORS 错误（手工验收，记入 P4 证据）
- **范围框定**：
  - `docs/api/README.md`
  - `docs/services/core.md`
  - `docs/services/auth.md`
  - `docs/arch.md`（§4.2、§4.3、§10 相关段落）
  - `prd/F01-BOOT.md`（状态与验收勾选）
  - `docs/automate/plan.md`（P5 仅勾选 BOOT-002、BOOT-006 行，不改结构）
