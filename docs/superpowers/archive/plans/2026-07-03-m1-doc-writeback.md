# M1 文档回写 + 鉴权 Smoke 测试 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `docs/api/README.md` · `docs/services/auth.md` · `docs/services/core.md` · `docs/services/README.md` · `docs/arch.md` · `docs/automate/prd/F01-BOOT.md` · `tests/test_me.py`
> **子项：** BOOT-001 · BOOT-002 · BOOT-003 · BOOT-004 · BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `docs/**` 遵守 docs-layer；触及 `tests/**` 遵守 backend-fastapi）

**Goal:** 将 M1 已实现能力（`/health`、`/api/v1/me`、CORS、TraceId、Admin 壳层）回写至 `docs/` 真理源，并新增 `/api/v1/me` 鉴权 smoke 测试固化 CI 证据；**不修改** `backend/`、`fe/` 生产代码。

**Architecture:** 按 design 子项顺序执行：api README → services 域附录 → arch/PRD 交叉注记 → pytest smoke。文档变更以代码锚点为唯一行为真理源；测试走真实 `AuthMiddleware` 栈，复用 `conftest.py` 的 `client` fixture。

**Tech Stack:** Markdown 文档 · pytest + FastAPI TestClient · ruff（backend job）

## Global Constraints

- **禁止**修改 `backend/`、`fe/` 生产代码
- **禁止**修改 `docs/automate/plan.md`（P5 勾选）与 `docs/automate/prd.md` hub 8 维分数（P5 重评）
- **禁止**修改 `tests/conftest.py`、`.github/workflows/ci.yml`
- auth/core M1 状态枚举为 **`骨架`**（非 `已实现`；完整 RBAC 属 M7）
- `docs/services/` 不写 HTTP path/method JSON（→ `docs/api/`）
- `UI skill: none`（本轮不触及 `fe/`）
- 预估变更文件数：**7**（≤ round-target 上限 20）

---

### Task 1: BOOT-001 — `/health` API 登记

**Files:**
- Modify: `docs/api/README.md`（§0 `/health` 行）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`（文档分层边界）

**Interfaces:**
- Consumes: 无
- Produces: `docs/api/README.md` §0 `GET /health` 状态列为 `已实现`

- [ ] **Step 1: 更新 `/health` 状态列**

在 `docs/api/README.md` §0 系统表中，将 `/health` 行「状态」从 `规划` 改为 `已实现`：

```markdown
| GET | `/health` | 健康检查 | — | P0 | BOOT-001 | 已实现 | `backend/app/main.py` |
```

其余列（方法、路径、说明、IF、期次、PRD、代码锚点）保持不变。`last_updated: 2026-07-03` frontmatter 保持不动。

- [ ] **Step 2: 验证文档与既有测试**

Run:
```bash
rg '\| GET \| `/health`' docs/api/README.md
```
Expected: 行末含 `已实现`

Run:
```bash
cd backend && pytest tests/test_health.py -v
```
Expected: `test_health_returns_ok` PASS

- [ ] **Step 3: Commit**

```bash
git add docs/api/README.md
git commit -m "docs(api): mark GET /health as implemented (BOOT-001)"
```

---

### Task 2: BOOT-003 — `/api/v1/me` API 登记与 auth 域文档

**Files:**
- Modify: `docs/api/README.md`（§1 新增行 + `auth/me` 注记）
- Modify: `docs/services/auth.md`（状态、锚点、实现笔记）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`
- Read `.cursor/rules/prd-sync.mdc`（域附录与 API 同步）

**Interfaces:**
- Consumes: Task 1 已完成 api README 基础
- Produces: `docs/api/README.md` §1 含 `GET /api/v1/me` 已实现行；`docs/services/auth.md` 状态 `骨架`

- [ ] **Step 1: 在 api README §1 新增 `/api/v1/me` 行**

在 `docs/api/README.md` §1「认证与会话」表**首行**（`auth/login` 之前）插入：

```markdown
| GET | `/api/v1/me` | M1 占位：当前用户（开发 `Bearer dev`） | 内部 | P0 | BOOT-003 | 已实现 | `backend/app/api/v1/me.py` |
```

- [ ] **Step 2: 更新 `auth/me` 规划行说明列**

将 §1 既有行：

```markdown
| GET | `/api/v1/auth/me` | 当前用户与角色 | 内部 | 一期 | AUTH-003 | 规划 | `backend/app/api/v1/auth.py` |
```

改为：

```markdown
| GET | `/api/v1/auth/me` | 当前用户与角色；二期正式路径，M1 占位见 `GET /api/v1/me` | 内部 | 一期 | AUTH-003 | 规划 | `backend/app/api/v1/auth.py` |
```

- [ ] **Step 3: 更新 `docs/services/auth.md` 全文**

将 `docs/services/auth.md` 替换为：

```markdown
# auth — 认证与权限

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/auth/` |
| PRD | [F02-AUTH](../automate/prd/F02-AUTH.md) · AUTH-001 ~ AUTH-008；M1 骨架 [BOOT-003](../automate/prd/F01-BOOT.md) |
| 里程碑 | M7（完整 RBAC）；M1 横切鉴权骨架 |
| 状态 | **骨架** |

## 职责

- 用户认证（会话 / Token，与部署模式对齐）
- RBAC：角色、权限点、资源绑定
- 组织维度、多维行级权限（RLS）策略
- 操作审计日志

## 边界

| In | Out |
|----|-----|
| 身份、授权、RLS 策略定义 | 查询执行细节（→ `query` 消费策略） |
| 租户/组织模型 | 业务视图模板内容（→ `views`） |

## 依赖

- `core`

## 被依赖

- `datasources`、`query`、`dashboard`、`reports`、`governance`、`views`

## 主要类型 / 入口（M1 骨架）

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `AuthMiddleware` | ASGI 中间件；`main.py` 注册 | BOOT-003 | M1 骨架 |
| `PUBLIC_PATHS` | `/health`、`/docs`、`/redoc`、`/openapi.json` 豁免 | BOOT-003 | M1 骨架 |
| `get_current_user` | `auth/deps.py`；handler 依赖注入 | BOOT-003 | M1 骨架 |
| `UserContext` | 占位用户上下文 | BOOT-003 | M1 骨架 |
| `Bearer dev` | 仅 `VITALSPAN_ENV=development` 接受 | BOOT-003 | M1 占位 |
| `PermissionService` | RBAC 校验 | AUTH-002~004 | 待建 |
| `RlsPolicyService` | 行级策略 | AUTH-005~006 | 待建 |
| `AuditService` | 审计写入 | AUTH-007~008 | 待建 |

## 关联 API

见 [api/README.md](../api/README.md) §认证 · §权限。

## 实现笔记

- `AuthMiddleware` 在 `backend/app/main.py` 通过 `app.add_middleware(AuthMiddleware)` 注册
- `OPTIONS` 预检直接放行，避免 CORS 被 401 拦截
- 完整 RBAC/RLS/审计属 M7，本期不展开
```

- [ ] **Step 4: 验证文档**

Run:
```bash
rg '/api/v1/me' docs/api/README.md
```
Expected: 至少 2 处匹配（新行 + `auth/me` 注记）

Run:
```bash
rg '骨架' docs/services/auth.md | head -1
```
Expected: 元信息表状态为 `骨架`

Run:
```bash
rg 'AuthMiddleware|PUBLIC_PATHS|get_current_user|Bearer dev' docs/services/auth.md
```
Expected: 4 处以上匹配

Run:
```bash
rg 'POST /api/v1/auth/login' docs/services/auth.md || true
```
Expected: 无匹配（services 不写 HTTP schema）

- [ ] **Step 5: Commit**

```bash
git add docs/api/README.md docs/services/auth.md
git commit -m "docs(api,auth): register GET /api/v1/me and update auth domain (BOOT-003)"
```

---

### Task 3: BOOT-004 — core 域文档与 services 索引

**Files:**
- Modify: `docs/services/core.md`
- Modify: `docs/services/README.md`（core/auth 索引行状态）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`
- Read `.cursor/rules/prd-sync.mdc`

**Interfaces:**
- Consumes: Task 2 auth 域状态 `骨架`
- Produces: `docs/services/core.md` 状态 `骨架`；`docs/services/README.md` core/auth 索引一致

- [ ] **Step 1: 更新 `docs/services/core.md` 全文**

将 `docs/services/core.md` 替换为：

```markdown
# core — 应用内核

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/core/` |
| PRD | [F01-BOOT](../automate/prd/F01-BOOT.md) · BOOT-001 ~ BOOT-006 |
| 里程碑 | M1 |
| 状态 | **骨架** |

## 职责

- 应用配置（`Settings`、环境变量校验）
- FastAPI 应用工厂、`lifespan`、全局异常处理
- 请求 ID、结构化日志、健康检查
- 安全中间件基座（CORS 来源 `Settings.cors_origins` / `CORS_ORIGINS`；鉴权委托 `auth/`）
- 数据库会话 / 依赖注入入口（`get_db`）

## 边界

| In | Out |
|----|-----|
| 配置、日志、中间件、健康端点 | 业务 RBAC（→ `auth`） |
| OpenAPI 元信息与路由挂载 | 领域查询与连接器（→ `query` / `datasources`） |

## 依赖

- 无业务域上游；被所有域服务依赖

## 主要类型 / 入口（M1 已实现）

| 符号 | 说明 | 锚点 |
|------|------|------|
| `app.main:app` | ASGI 入口；中间件与路由挂载 | `backend/app/main.py` |
| `Settings` / `get_settings` | pydantic-settings；含 `cors_origins` 计算字段 | `backend/app/core/config.py` |
| `configure_logging` | JSON 结构化日志 | `backend/app/core/logging.py` |
| `TraceIdMiddleware` | 请求 trace；响应头 `X-Trace-Id` | `backend/app/core/middleware.py` |
| `CORSMiddleware` | 由 `main.py` 挂载；来源 `Settings.cors_origins` | `backend/app/main.py` |
| `GET /health` | 存活探针 | `backend/app/main.py` |

## 关联 API

见 [api/README.md](../api/README.md) §系统。

## 实现笔记

- 中间件注册顺序（`main.py`）：CORS → TraceId → Auth（后注册者先执行）
- 鉴权逻辑委托 `auth/`；`AuthMiddleware` 由 `main.py` 注册，不在 `core/` 内实现
```

- [ ] **Step 2: 更新 `docs/services/README.md` 索引行**

将域索引表中两行：

```markdown
| [core.md](./core.md) | `app/core/` | F01-BOOT | M1 | 未实现 |
```

改为：

```markdown
| [core.md](./core.md) | `app/core/` | F01-BOOT | M1 | 骨架 |
```

将：

```markdown
| [auth.md](./auth.md) | `app/auth/` | F02-AUTH | M7 | 未实现 |
```

改为：

```markdown
| [auth.md](./auth.md) | `app/auth/` | F02-AUTH | M7 | 骨架 |
```

- [ ] **Step 3: 验证文档一致性**

Run:
```bash
rg '骨架' docs/services/core.md docs/services/README.md
```
Expected: core.md 元信息 + README 索引 core/auth 各一行

Run:
```bash
rg 'cors_origins|CORS_ORIGINS|TraceIdMiddleware' docs/services/core.md
```
Expected: 3 处以上匹配

Run:
```bash
rg 'auth middleware' docs/services/core.md || true
```
Expected: 无「core 内含 auth middleware」表述（仅「委托 auth/」）

- [ ] **Step 4: Commit**

```bash
git add docs/services/core.md docs/services/README.md
git commit -m "docs(services): update core domain and index status to 骨架 (BOOT-004)"
```

---

### Task 4: BOOT-002/006 — 架构注记与 PRD 分片回写

**Files:**
- Modify: `docs/arch.md`（§4.1 · §4.2 · §4.3 · §10）
- Modify: `docs/automate/prd/F01-BOOT.md`（演化建议清理）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`
- Read `.cursor/rules/prd-sync.mdc`

**Interfaces:**
- Consumes: Task 2/3 services 与 arch 交叉引用基线
- Produces: `docs/arch.md` M1 过渡布局注记；hub 计数 124；F01-BOOT 无「待下轮」残留

- [ ] **Step 1: 更新 `docs/arch.md` §4.1 顶层目录注释**

在 §4.1 代码块中替换两行：

```diff
-├── fe/                      # （待建）React 双端前端
+├── fe/                      # React 双端前端（M1 Admin 壳层已实现）
```

```diff
-├── tests/                   # （待建）单元 / smoke / perf
+├── tests/                   # 单元 / smoke（M1：health + me）
```

- [ ] **Step 2: 更新 `docs/arch.md` §4.2 core 行注释**

将：

```
│   ├── core/           # config, auth middleware, security, logging
```

改为：

```
│   ├── core/           # config, logging, TraceIdMiddleware；鉴权委托 auth/（AuthMiddleware 由 main.py 注册）
```

- [ ] **Step 3: 在 `docs/arch.md` §4.3 代码块后插入 M1 过渡布局注记**

在 §4.3 前端目标布局代码块（以 `vite.config.ts` 行结尾的 ``` 之后）、`### 4.4 演化与 Agent 资产` 之前插入：

```markdown
> **M1 过渡布局（2026-07-03）**：Admin 壳层已落地于 `fe/src/layouts/AdminLayout.tsx` +
> `fe/src/routes.tsx`（`/admin` 路由）。目标态目录 `src/app/` 在二期壳层统一时迁移；
> 详见 `prd/F01-BOOT.md` BOOT-002 与 `docs/ui/layout.md`。
```

- [ ] **Step 4: 更新 `docs/arch.md` §10 hub 计数**

将 §10 文档索引表中：

```markdown
| [automate/prd.md](automate/prd.md) | 功能真理源 hub（118 项） |
```

改为：

```markdown
| [automate/prd.md](automate/prd.md) | 功能真理源 hub（124 项） |
```

- [ ] **Step 5: 清理 `docs/automate/prd/F01-BOOT.md` 演化建议**

将各 BOOT 项「演化建议」中含「M1 文档回写」「api/services 待下轮」「文档回写 checklist 待下轮」「M1 api/services 文档回写待下轮」的句子删除或改写，保留二期正向建议。目标全文：

**BOOT-001 演化建议** 改为：
```markdown
- **演化建议**：二期扩展健康检查维度（DB 连通性）；维持 `tests/test_health.py` CI 覆盖
```

**BOOT-002 演化建议** 改为：
```markdown
- **演化建议**：二期补 TanStack Query、`@/lib/api.ts` 与业务页；增 vitest/Playwright 覆盖壳层交互
```

**BOOT-003 演化建议** 改为：
```markdown
- **演化建议**：二期替换 `Bearer dev` 为正式 JWT；`tests/test_me.py` 已覆盖 401/200 smoke
```

**BOOT-004 演化建议** 改为：
```markdown
- **演化建议**：二期补 Settings 加载与 traceId 日志断言测试
```

**BOOT-005 演化建议** 保持：
```markdown
- **演化建议**：CI 环境补 docker postgres job（BOOT-006）；M1B 增 ingestion 元表 revision
```

**BOOT-006 演化建议** 改为：
```markdown
- **演化建议**：CI 增 docker postgres job；补 Settings/traceId 集成测试
```

确认 BOOT-001~006 状态仍为 `已实现`、验收标准仍为 `[x]`、BOOT-003 代码锚点含 `main.py` 注册 `AuthMiddleware`（已存在，勿删）。

- [ ] **Step 6: 验证文档**

Run:
```bash
rg '118 项' docs/arch.md || echo "OK: no 118 match"
```
Expected: 无匹配或输出 `OK`

Run:
```bash
rg 'M1 过渡布局' docs/arch.md
```
Expected: 1 处匹配

Run:
```bash
rg 'auth middleware, security' docs/arch.md || echo "OK: misleading core comment removed"
```
Expected: 无匹配

Run:
```bash
rg '待下轮' docs/automate/prd/F01-BOOT.md || echo "OK: no 待下轮"
```
Expected: 无匹配

Run:
```bash
rg '已实现' docs/automate/prd/F01-BOOT.md | wc -l
```
Expected: ≥ 6（BOOT-001~006 各一项）

- [ ] **Step 7: Commit**

```bash
git add docs/arch.md docs/automate/prd/F01-BOOT.md
git commit -m "docs(arch,prd): M1 transition notes and F01-BOOT evolution cleanup (BOOT-002/006)"
```

---

### Task 5: BOOT-003 — 鉴权 smoke 测试 `/api/v1/me`

**Files:**
- Create: `tests/test_me.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.cursor/rules/backend-fastapi.mdc`（触及 `tests/**`）

**UI skill:** none

**Interfaces:**
- Consumes: `tests/conftest.py` 的 `client` fixture；`AuthMiddleware` 真实栈
- Produces: `test_me_without_token_returns_401` · `test_me_with_bearer_dev_returns_200`

- [ ] **Step 1: 新建 `tests/test_me.py`**

创建文件 `tests/test_me.py`：

```python
def test_me_without_token_returns_401(client):
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json() == {
        "code": "UNAUTHORIZED",
        "message": "Missing or invalid bearer token",
        "detail": None,
    }


def test_me_with_bearer_dev_returns_200(client):
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer dev"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": "dev",
        "username": "dev",
        "roles": ["admin"],
    }
```

- [ ] **Step 2: 运行新增用例**

Run:
```bash
cd backend && pytest tests/test_me.py -v
```
Expected: 2 passed

- [ ] **Step 3: 运行全量测试与 ruff**

Run:
```bash
cd backend && ruff check . && pytest -v
```
Expected: ruff 无新增告警；全量 pytest exit 0

Run:
```bash
cd backend && pytest tests/test_health.py tests/test_me.py -v
```
Expected: 3 passed（health 1 + me 2）

- [ ] **Step 4: Commit**

```bash
git add tests/test_me.py
git commit -m "test(auth): add /api/v1/me 401/200 smoke tests (BOOT-003)"
```

---

## P4 整体验证（全部 Task 完成后）

Run:
```bash
# 文档一致性
rg "规划" docs/api/README.md | rg health || echo "OK: /health not 规划"
rg "/api/v1/me" docs/api/README.md
rg "118 项" docs/arch.md || echo "OK"
rg "待下轮" docs/automate/prd/F01-BOOT.md || echo "OK"

# 测试
cd backend && ruff check . && pytest -v
```

Expected: grep 检查通过；pytest 全绿。

---

## Spec Self-Review

| design 子项 | 对应 Task | 覆盖 |
|-------------|-----------|------|
| 1 BOOT-001 `/health` | Task 1 | ✓ |
| 2 BOOT-003 api + auth | Task 2 | ✓ |
| 3 BOOT-004 core + index | Task 3 | ✓ |
| 4 BOOT-002/006 arch + PRD | Task 4 | ✓ |
| 5 BOOT-003 smoke test | Task 5 | ✓ |

- 无 TBD/TODO 占位
- 预估变更文件：7
- 未触及 `backend/`、`fe/` 生产代码
- `UI skill: none`
