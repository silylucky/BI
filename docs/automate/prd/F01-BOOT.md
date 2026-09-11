# F01-BOOT 工程基线

> 模块：P0 · 8 维评分见 [`../prd.md`](../prd.md)

### [BOOT-001] FastAPI 工程骨架

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：P0
- **里程碑对齐**：M1 · 已完成 · 2026-07-03
- **描述**：FastAPI 工程骨架（SRS 追溯项）。
- **验收标准**：
  - [x] `backend/app` 可启动且 `/health` 返回 200
  - [x] OpenAPI 文档可访问
- **代码锚点**：`backend/app/main.py` · `backend/app/api/v1/` · `backend/pyproject.toml`
- **演化建议**：`tests/test_health.py` 25 项覆盖 docs/openapi CORS 预检非法 Origin（T-HLT-23~24）、公开路径无鉴权（T-HLT-25）；`tests/test_router.py` T-RTR-03~04 空 v1 路由非 500 + 生产路由数 ≥2；二期扩展健康检查维度（DB 连通性）

### [BOOT-002] React 管理端壳层

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：P0
- **里程碑对齐**：M-FINAL · 已完成 · 2026-07-07；M-PRODUCT F-A · 壳层清扫 · 2026-07-08；M-PRODUCT · F-C · 已完成 · 2026-07-08；**M-DEPTH F-0 · IA 减法 · 2026-07-10**
- **描述**：React 管理端壳层（SRS 追溯项）；M-FE-1 补齐 TanStack Query 与统一 API 客户端；M-FINAL F-A 建立 nav-manifest 单一真理源、resolveNavGroups 角色派生与里程碑可见性矩阵；M-FINAL F-B 能力驱动侧栏过滤（`capabilities.ts` + manifest `capability` 字段）；M-PRODUCT F-A 登录默认 Dashboard、M13 去预览、「我的」与「语义建模」IA 收拢；M-DEPTH F-0 侧栏降噪与 capability 路由守卫对齐。
- **验收标准**：
  - [x] `fe/` 可构建且 `/admin` 路由壳层可访问
  - [x] shadcn/ui + Tailwind v4 主题加载
  - [x] `@/lib/api.ts` 统一 fetch + Authorization 头
  - [x] `@/lib/queryKeys.ts` 与 TanStack Query provider
  - [x] `mapApiError` 结构化错误展示
  - [x] datasources 页可调用 DS CRUD API
  - [x] `fe/src/config/nav-manifest.tsx` 存在，`resolveNavGroups(role)` 派生三档侧栏
  - [x] `resolve-nav.test.ts` 覆盖 admin/analyst/viewer 三档 + 里程碑过滤（10 用例）
  - [x] 「报表」菜单含 subItems：预制报表 / 模板 / 调度
  - [x] 旧 `admin-nav.tsx`/`analyst-nav.tsx`/`user-nav.tsx` 已废弃/移除
  - [x] `AdminLayout.smoke.test.tsx` T-FE-SMFA-01~04 PASS（16 断言）
  - [x] viewer/analyst 不见未到期里程碑项；已交付里程碑（含 M13）admin 不显示「预览」badge（`ACTIVE_MILESTONES` 含 M13）
  - [x] `routes.smoke.test.tsx` T-RT-DL-01 死链检测 PASS
  - [x] manifest 项含 `capability`；`resolveNavGroups` 按能力过滤（T-NAV-CAP-01~04）
  - [x] 移除 `canManagePlatform`/`canEditDashboards` 硬编码三档 nav；自定义 role 在能力满足时可见分组
  - [x] manifest 系统管理含 grants 子项；`AdminLayout.smoke` T-FE-SMFB-01~03；`routes.smoke` T-RT-GRANTS-01
  - [x] 登录后各角色默认跳转 Dashboard（`AdminHomePage` + `resolveDefaultDashboardPath`；`AdminHome.smoke.test.tsx`）
  - [x] manifest「我的」→ `/admin/account/settings`
  - [x] manifest「数据」含「语义建模」subItems：元数据 / Dataset（`resolve-nav.test.ts` T-NAV-MF-06）
  - [x] `resolveNavGroups` 对 analyst/viewer 默认隐藏 `iaTier=engineering` 分组（T-NAV-FC-01~04）
  - [x] `layout.md` §3/§6 同步默认 IA 矩阵（数据工程/治理默认隐藏）
  - [x] **M-DEPTH F-0**：侧栏删「图表类型目录/实体与主题/独立数据接入」；数据连接嵌套同步任务；路由深链保留（2026-07-10）
  - [x] **M-DEPTH F-0**：`RequireCapabilityName` 与侧栏 capability 对齐；analyst 报表仅 `report:read`；`/embed/sdk-demo` 仅 DEV（2026-07-10）
  - [x] **M-DEPTH F-D〔可选〕**：ChartExplore → Palette Drawer；删 AdminHome 空跳转（`ChartExploreDrawer` · `/admin` index → `/admin/dashboards` · 2026-07-30）
- **代码锚点**：`fe/src/config/nav-manifest.tsx` · `fe/src/lib/capabilities.ts` · `fe/src/lib/resolve-nav.ts` · `fe/src/lib/resolve-nav.test.ts` · `fe/src/components/auth/require-capability.tsx` · `fe/src/layouts/AdminLayout.tsx` · `fe/src/layouts/AdminLayout.smoke.test.tsx` · `fe/src/pages/admin/AdminHomePage.tsx` · `fe/src/lib/defaultViewResolve.ts` · `fe/src/routes.tsx` · `fe/src/routes.smoke.test.tsx` · `fe/src/lib/api.ts` · `fe/src/lib/queryKeys.ts` · `fe/src/lib/apiError.ts` · `fe/scripts/check-design.mjs` · `docs/ui/layout.md`
- **演化建议**：F-D 可选精简；Playwright E2E 登录落点与业务页 Query 缓存策略调优

### [BOOT-003] 鉴权中间件骨架

- **状态**：已实现
- **goal_ref**：goal.md §2.4（G4）
- **期次**：P0
- **里程碑对齐**：M-FE-1 · 已完成 · 2026-07-06
- **描述**：鉴权中间件骨架（SRS 追溯项）；M-FE-1 交付正式 JWT 登录与会话。
- **验收标准**：
  - [x] 未认证访问受保护路由返回 401
  - [x] 公开路径（`/health`、`/docs`、`/redoc`、`/openapi.json`）无需认证仍可访问
  - [x] 认证上下文可注入 handler
  - [x] `POST /api/v1/auth/login` 返回 JWT
  - [x] `/login` 页与路由守卫（`RequireAuth`）
  - [x] `fe/src/lib/api.ts` 读 token，移除 `Bearer dev` 硬编码
  - [x] 未登录访问 `/admin/*` → `/login`；登录后 `GET /api/v1/me` 200
- **代码锚点**：`backend/app/auth/middleware.py` · `backend/app/auth/jwt.py` · `backend/app/auth/login/service.py` · `backend/app/api/v1/auth.py` · `fe/src/pages/login/LoginPage.tsx` · `fe/src/components/auth/require-auth.tsx` · `fe/src/lib/auth-token.ts` · `backend/migrations/versions/0017_auth_user_password.py`
- **演化建议**：`tests/test_me.py` JWT 矩阵 + fe routes smoke（M-FE-1 login 守卫）；二期补 refresh token、MFA 与密码重置

### [BOOT-004] 配置与日志基线

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：P0
- **里程碑对齐**：M1 · 已完成 · 2026-07-03
- **描述**：配置与日志基线（SRS 追溯项）。
- **验收标准**：
  - [x] 环境变量配置可加载
  - [x] 结构化日志输出请求 traceId
- **代码锚点**：`backend/app/core/config.py` · `backend/app/core/logging.py` · `backend/app/core/middleware.py`
- **演化建议**：`tests/test_trace.py` 18 项 + `tests/test_config.py` 13 项覆盖 cors_origins 空串（T-CFG-11）、analytics mysql 拒绝（T-CFG-12）、production+sqlite 组合（T-CFG-13）、连续请求 traceId 隔离（T-TRC-17）、LOG_LEVEL 热切换（T-TRC-18）；二期补 Settings 热加载与异常分支

### [BOOT-005] 数据库迁移框架

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：P0
- **里程碑对齐**：M1 · 已完成 · 2026-07-03
- **描述**：数据库迁移框架（SRS 追溯项）。
- **验收标准**：
  - [x] Alembic 或等价迁移可执行（`alembic upgrade head`）
  - [x] 平台元数据库可连接（`docker-compose.yml` PostgreSQL / MySQL / SQLite 三方言）
- **代码锚点**：`backend/migrations/` · `backend/migrations/dialect_ops.py` · `backend/app/core/db/meta.py` · `docker-compose.yml` · `backend/migrations/env.py`
- **演化建议**：`tests/test_meta_db_dialects.py` 覆盖 Settings 三方言 URL 与 SQLite `alembic upgrade head`；MySQL 集成测依赖 compose `meta-mysql:3309`；CI 仍不默认跑 docker `alembic upgrade`

### [BOOT-006] CI 与质量门禁

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：P0
- **里程碑对齐**：M1 · 已完成 · 2026-07-03
- **描述**：CI 与质量门禁（SRS 追溯项）。
- **验收标准**：
  - [x] lint + 单元测试 CI 通过
  - [x] 前后端可本地联调
- **代码锚点**：`.github/workflows/ci.yml` · `tests/conftest.py` · `tests/test_health.py`
- **演化建议**：CI 已含 backend 273 pytest + frontend 68 vitest + node:test 4；`tests/test_ci_env_contract.py` 12 项含 collect 下限 ≥258（T-CI-10）、job timeout-minutes（T-CI-11）、pnpm cache-dependency-path（T-CI-12）；`tests/test_ruff_contract.py` 2 项 ruff 子进程契约；二期增 docker postgres job 与 Playwright E2E
