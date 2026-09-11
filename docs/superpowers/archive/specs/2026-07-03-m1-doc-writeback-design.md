# M1 文档回写 + 鉴权 Smoke 测试设计

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target.md
prd_ids: [BOOT-001, BOOT-002, BOOT-003, BOOT-004, BOOT-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 主题 | PRD ID | 类型 | 主攻 8 维薄弱项 |
|---|------|--------|------|----------------|
| 1 | API 路由登记 — `/health` | BOOT-001 | 文档对齐 | 测试覆盖（8%）· 完整度 |
| 2 | API 登记与鉴权域文档 — `/api/v1/me` | BOOT-003 | 文档对齐 | 测试覆盖（10%）· 安全性 |
| 3 | 核心域文档 — CORS 与 TraceId | BOOT-004 | 文档对齐 | 测试覆盖（8%）· 完整度 |
| 4 | 架构注记与 PRD 分片回写 | BOOT-002 · BOOT-006 | 文档对齐 | 完整度 · 测试覆盖（22%/32%） |
| 5 | 鉴权 smoke 测试 — `/api/v1/me` 401/200 | BOOT-003 | 测试补强 | 测试覆盖（10% → ≥40% 维度分） |

**执行顺序**：子项 1 → 2 → 3 → 4（文档可并行，建议按上表顺序避免交叉引用遗漏）→ 子项 5（测试验证文档所述行为）。

**依赖链**：PR #4 已合并 BOOT-002/006 实现；代码真理源已就绪。本轮仅将 `docs/` 与 `tests/` 对齐实现，**不修改** `backend/`、`fe/` 生产代码。

## 2. 现状与约束

### 2.1 代码现状（只读校验）

| 能力 | 实现锚点 | 行为摘要 |
|------|----------|----------|
| `GET /health` | `backend/app/main.py` L32–34 | 200 `{"status":"ok"}`；无鉴权 |
| `AuthMiddleware` | `backend/app/auth/middleware.py` | `PUBLIC_PATHS` 豁免；其余需 `Bearer`；`Bearer dev` 仅 `vitalspan_env=development` |
| `GET /api/v1/me` | `backend/app/api/v1/me.py` | 经 `get_current_user` 注入 `UserContext` |
| CORS | `main.py` L21–27 + `Settings.cors_origins` | 来源 `CORS_ORIGINS` 逗号分隔 |
| TraceId | `core/middleware.py` `TraceIdMiddleware` | 读/写 `X-Trace-Id`；JSON 日志含 `traceId` |
| 中间件栈 | `main.py` L21–29 | 注册顺序：CORS → TraceId → Auth（后注册者先执行） |
| 现有测试 | `tests/test_health.py` | `TestClient` fixture 于 `conftest.py` |

### 2.2 文档漂移摘要

| 文件 | 漂移 |
|------|------|
| `docs/api/README.md` | `/health` 仍为「规划」；缺 `GET /api/v1/me` 行 |
| `docs/services/auth.md` | 状态「未实现」；无 M1 骨架锚点 |
| `docs/services/core.md` | 状态「未实现」；入口表仍为「待建」 |
| `docs/services/README.md` | core/auth 索引仍为「未实现」 |
| `docs/arch.md` | §4.1 `fe/`/`tests/` 标「待建」；§4.2 core 含 auth middleware；§10 hub 写 118 项 |
| `prd/F01-BOOT.md` | 状态与勾选已基本对齐；`演化建议` 仍写「文档回写待下轮」 |

### 2.3 范围框定

| 模块 | 文件（8 个） |
|------|-------------|
| `docs/api/` | `README.md` |
| `docs/services/` | `auth.md` · `core.md` · `README.md` |
| `docs/` | `arch.md`（§4.1 · §4.2 · §4.3 · §10） |
| `docs/automate/prd/` | `F01-BOOT.md` |
| `tests/` | `test_me.py`（新建） |

### 2.4 真理源优先级

`round-target` > `plan.md` §M1「文档回写」> 既有 `2026-07-03-m1-fe-ci-design.md` §7.5 > `arch.md` > 代码。

## 3. 方案比选（摘要）

### 3.1 `/api/v1/me` 在 api README 中的位置

| 方案 | 说明 | 结论 |
|------|------|------|
| A 置于 §1「认证与会话」首行 | 与鉴权域语义一致；`auth/me` 保留规划并注记 | **采用**（与 fe-ci §7.5.1 一致） |
| B 新建 §0.5 或独立 M1 小节 | 结构清晰但打破现有分节惯例 | 否决 |

### 3.2 auth/core 域状态枚举

| 方案 | core | auth | 结论 |
|------|------|------|------|
| A core=`骨架` auth=`骨架` | 反映 M1 基线非完整 M7 | 保守 | 备选 |
| B core=`骨架` auth=`骨架` + README 一致 | services README 枚举仅四值 | **采用** |
| C 均标 `已实现` | 与 M7 完整 auth 语义冲突 | 否决 |

> `services/README.md` 状态枚举：`未实现` · `骨架` · `部分` · `已实现`。M1 横切基线用 **骨架**；完整 RBAC/RLS 属 M7，auth 不得标 `已实现`。

### 3.3 smoke 测试文件组织

| 方案 | 说明 | 结论 |
|------|------|------|
| A 新建 `tests/test_me.py` | 与 `test_health.py` 对称；CI 自动拾取 | **采用** |
| B 扩写 `test_health.py` | 职责混杂 | 否决 |
| C 新建 `tests/test_auth.py` | 过早泛化 | 本轮否决 |

## 4. 分项设计

### 4.1 子项 1 — BOOT-001 `/health` API 登记

**文件**：`docs/api/README.md` §0

| 列 | 变更前 | 变更后 |
|----|--------|--------|
| 状态 | `规划` | `已实现` |
| 代码锚点 | `backend/app/main.py` | 保持 |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `GET /health` 状态列为 `已实现` | 文档审查 |
| 2 | 行为与实现一致：200、无鉴权 | `pytest tests/test_health.py -v`（既有） |
| 3 | `last_updated` 保持或更新为 2026-07-03 | 文档 frontmatter |

---

### 4.2 子项 2 — BOOT-003 `/api/v1/me` API 登记 + auth 域文档

#### 4.2.1 `docs/api/README.md` §1

**新增行**（置于 §1 表首或 `auth/login` 之前）：

| 方法 | 路径 | 说明 | IF | 期次 | PRD | 状态 | 代码锚点 |
|------|------|------|-----|------|-----|------|----------|
| GET | `/api/v1/me` | M1 占位：当前用户（开发 `Bearer dev`） | 内部 | P0 | BOOT-003 | 已实现 | `backend/app/api/v1/me.py` |

**§1 既有行 `GET /api/v1/auth/me`**：

- 状态保持 `规划`
- 说明列追加注记：**「二期正式路径；M1 占位见 `GET /api/v1/me`」**（或等价措辞，不改变 path）

#### 4.2.2 `docs/services/auth.md`

| 字段 | 变更 |
|------|------|
| 状态 | `未实现` → **`骨架`** |
| PRD 引用 | 保留 F02-AUTH；补充 M1 骨架对应 BOOT-003 |
| 主要类型表 | 更新为已实现符号（M1 范围） |

**须登记的代码锚点**：

| 符号 | 说明 | 状态 |
|------|------|------|
| `AuthMiddleware` | ASGI 中间件；`main.py` 注册 | M1 骨架 |
| `PUBLIC_PATHS` | `/health`、`/docs`、`/redoc`、`/openapi.json` | M1 骨架 |
| `get_current_user` | `auth/deps.py`；handler 依赖注入 | M1 骨架 |
| `UserContext` | 占位用户上下文 | M1 骨架 |
| `Bearer dev` | 仅 `VITALSPAN_ENV=development` 接受 | M1 占位 |

**实现笔记**（新增段落，不写 HTTP schema）：

- `AuthMiddleware` 在 `backend/app/main.py` 通过 `app.add_middleware(AuthMiddleware)` 注册
- `OPTIONS` 预检直接放行，避免 CORS 被 401 拦截
- 完整 RBAC/RLS/审计属 M7，本期不展开

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | api README 含 `GET /api/v1/me` 已实现行 | 文档审查 |
| 2 | `auth/me` 仍为规划且含二期注记 | 文档审查 |
| 3 | `auth.md` 状态为 `骨架` 且锚点覆盖 middleware/deps/main/PUBLIC_PATHS | 文档审查 |
| 4 | `auth.md` 无 HTTP path/method JSON（遵守 docs-layer） | 文档审查 |

---

### 4.3 子项 3 — BOOT-004 core 域文档 + services 索引

#### 4.3.1 `docs/services/core.md`

| 字段 | 变更 |
|------|------|
| 状态 | `未实现` → **`骨架`** |
| 职责 | 保持；确认 CORS 委托 `Settings.cors_origins`、鉴权委托 `auth/` |
| 主要类型表 | 全部更新为 M1 已实现 |

**须登记的代码锚点**：

| 符号 | 说明 | 锚点 |
|------|------|------|
| `app.main:app` | ASGI 入口；中间件与路由挂载 | `backend/app/main.py` |
| `Settings` / `get_settings` | pydantic-settings；含 `cors_origins` 计算字段 | `backend/app/core/config.py` |
| `configure_logging` | JSON 结构化日志 | `backend/app/core/logging.py` |
| `TraceIdMiddleware` | 请求 trace；响应头 `X-Trace-Id` | `backend/app/core/middleware.py` |
| `CORSMiddleware` | 由 `main.py` 挂载；来源 `Settings.cors_origins` | `backend/app/main.py` |
| `GET /health` | 存活探针 | `backend/app/main.py` |

**边界节**：保持「鉴权委托 `auth`」表述。

#### 4.3.2 `docs/services/README.md`

| 附录 | 变更 |
|------|------|
| `core.md` 索引行 | 状态 `未实现` → **`骨架`** |
| `auth.md` 索引行 | 状态 `未实现` → **`骨架`** |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `core.md` 状态 `骨架` 且锚点含 config/logging/middleware/main | 文档审查 |
| 2 | CORS 来源描述指向 `Settings.cors_origins` / `CORS_ORIGINS` | 文档审查 |
| 3 | `README.md` 索引 core/auth 与分片状态一致 | 文档审查 |
| 4 | 与 `arch.md` §4.2 交叉引用无矛盾 | 双文件审查 |

---

### 4.4 子项 4 — BOOT-002/006 架构注记与 PRD 分片

#### 4.4.1 `docs/arch.md`

| 段落 | 变更内容 |
|------|----------|
| **§4.1** | `fe/`：`（待建）` → **`React 双端前端（M1 Admin 壳层已实现）`**；`tests/`：`（待建）` → **`单元 / smoke（M1：health + me）`** |
| **§4.2** | `core/` 行注释：`config, auth middleware, security, logging` → **`config, logging, TraceIdMiddleware；鉴权委托 auth/（AuthMiddleware 由 main.py 注册）`**；删除 core 内含 auth middleware 的误导 |
| **§4.3** | 在代码块后增 **M1 过渡布局** 注记块 |

**§4.3 M1 过渡布局注记（须写入）**：

```markdown
> **M1 过渡布局（2026-07-03）**：Admin 壳层已落地于 `fe/src/layouts/AdminLayout.tsx` +
> `fe/src/routes.tsx`（`/admin` 路由）。目标态目录 `src/app/` 在二期壳层统一时迁移；
> 详见 `prd/F01-BOOT.md` BOOT-002 与 `docs/ui/layout.md`。
```

| **§10** | `automate/prd.md` 描述：`118 项` → **`124 项`**（与 hub `feature_count: 124` 一致） |

#### 4.4.2 `prd/F01-BOOT.md`

| 项 | 变更 |
|----|------|
| BOOT-001~006 状态 | 保持 `已实现` |
| 验收标准 | 保持 `[x]`（与 plan §BOOT-* 一致） |
| `演化建议` | 删除或改写含「M1 文档回写待下轮」「api/services 待下轮」的过时句；保留二期正向建议（JWT、vitest、docker postgres job 等） |
| BOOT-003 代码锚点 | 确认含 `auth/middleware.py` · `auth/deps.py` · `api/v1/me.py` · **`main.py` 注册 `AuthMiddleware`** |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | arch §4.2 不再写 auth middleware 在 core/ | 文档审查 |
| 2 | arch §4.3 含 M1 过渡布局注记 | 文档审查 |
| 3 | arch §10 hub 计数为 124 项 | 文档审查 |
| 4 | F01-BOOT BOOT-001~006 已实现且验收全 `[x]` | 文档审查 |
| 5 | F01-BOOT 无「文档回写待下轮」残留 | 文档审查 |

> **P3 不修改** `docs/automate/plan.md`；文档回写 checklist 勾选由 **P5** 执行。

---

### 4.5 子项 5 — BOOT-003 鉴权 smoke 测试

**文件**：`tests/test_me.py`（新建）

#### 4.5.1 用例设计

```python
# 结构示意 — P3 实现时遵循 test_health.py 风格

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

#### 4.5.2 约束

- 复用 `tests/conftest.py` 的 `client` fixture；**不修改** conftest（`VITALSPAN_ENV` 默认 `development` 已满足 `Bearer dev`）
- 不 mock 中间件；走真实 `AuthMiddleware` 栈
- CI：`backend` job 已 `pytest`；新文件自动纳入，**无需改** `.github/workflows/ci.yml`

#### 4.5.3 验收标准（可测试）

| # | 标准 | 验证 |
|---|------|------|
| 1 | 无 Authorization → 401 + 标准错误体 | `pytest tests/test_me.py::test_me_without_token_returns_401 -v` |
| 2 | `Authorization: Bearer dev` → 200 + UserContext JSON | `pytest tests/test_me.py::test_me_with_bearer_dev_returns_200 -v` |
| 3 | 全量测试绿 | `cd backend && pytest` exit 0 |
| 4 | ruff 无新增告警 | `cd backend && ruff check .` |

## 5. 范围框定文件列表

| 路径 | 子项 | 操作 |
|------|:----:|------|
| `docs/api/README.md` | 1, 2 | 编辑 |
| `docs/services/auth.md` | 2 | 编辑 |
| `docs/services/core.md` | 3 | 编辑 |
| `docs/services/README.md` | 3 | 编辑 |
| `docs/arch.md` | 4 | 编辑（§4.1 · §4.2 · §4.3 · §10） |
| `docs/automate/prd/F01-BOOT.md` | 4 | 编辑 |
| `tests/test_me.py` | 5 | 新建 |

**合计**：7 路径（8 文件计数含 README 双域）；模块 2（`docs/` · `tests/`）。

## 6. 非目标（明确不做）

| 项 | 原因 |
|----|------|
| 修改 `backend/` · `fe/` 生产代码 | round-target 类型为文档对齐 + 测试补强 |
| 修改 `docs/automate/plan.md` 勾选 | P5 职责 |
| 修改 `docs/automate/prd.md` hub 8 维分数 | P5 重评 |
| `tests/conftest.py` 扩展 | 现有 fixture 足够 |
| CI workflow 变更 | pytest testpaths 已覆盖 `../tests` |
| BOOT-005 迁移/DB 测试 | 非本轮范围 |
| CORS 预检集成测试 | plan 可选；不阻塞 M1 文档收口 |
| TraceId 日志断言测试 | BOOT-004 演化建议留二期 |
| M1B DATA-* | queued 未激活 |
| META-001 / DESIGN-001 / CONN-021 | 远期薄弱项 |
| 前端 UI 变更 | 本轮不触及 `fe/` |

## 7. 与 PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮对齐方式 | 预期 P5 改善 |
|--------|-----------------|-------------|-------------|
| BOOT-001 | 测试覆盖 8% | `/health` 文档已实现；既有 `test_health.py` | 完整度 ↑ |
| BOOT-002 | 测试覆盖 22% | arch §4.3 M1 过渡布局；F01 演化建议清理 | 完整度 ↑ |
| BOOT-003 | 测试覆盖 10% | `test_me.py` 401/200；auth/api 文档锚点 | **测试覆盖 ↑（主攻击）** |
| BOOT-004 | 测试覆盖 8% | core.md CORS/TraceId 锚点；arch 交叉一致 | 完整度 ↑ |
| BOOT-006 | 测试覆盖 32% | pytest 套件 +2 用例；CI 无改动自动拾取 | 测试覆盖 ↑ |

**tie-break 依据**：hub 显示 BOOT-001~006 主薄弱维均为测试覆盖（8–32%）；本轮以 `test_me.py` 固化为可重复 CI 证据，同步消除 api/services/arch/prd 漂移以支撑完整度维 P5 重评。

## 8. P4 验证命令（实施阶段）

```bash
# 文档一致性（人工审查 + grep）
rg "规划" docs/api/README.md | rg health    # /health 不应再为规划
rg "/api/v1/me" docs/api/README.md
rg "118 项" docs/arch.md                     # 应无匹配
rg "待下轮" docs/automate/prd/F01-BOOT.md    # 应无匹配

# 测试
cd backend && ruff check . && pytest -v
pytest tests/test_health.py tests/test_me.py -v
```

## 9. Spec Self-Review

- [x] 覆盖 round-target 全部 5 子项
- [x] 未超出范围框定（8 文件 · 2 模块）
- [x] 无 TBD/TODO 占位
- [x] 未触及前端 UI → `ui_design_skill: none`（无 §UI 设计交付）
- [x] 与 fe-ci design §7.5 一致且无矛盾
- [x] 禁止写生产代码（本文档仅 spec）
