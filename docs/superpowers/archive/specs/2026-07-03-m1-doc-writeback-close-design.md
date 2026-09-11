# M1 文档回写收尾 — 设计规格

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target-m1-doc-writeback.md
prd_ids: [BOOT-001, BOOT-002, BOOT-003, BOOT-004, BOOT-005, BOOT-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 主题 | PRD ID | 类型 | 主攻 8 维薄弱项 |
|---|------|--------|------|----------------|
| 1 | API 登记簿回写 — `/health` · `/api/v1/me` | BOOT-001 · BOOT-003 | 文档对齐 | 完整度 |
| 2 | 域附录 `core.md` 状态与锚点 | BOOT-004 | 文档对齐 | 完整度 · 架构 |
| 3 | 域附录 `auth.md` 状态与锚点 | BOOT-003 | 文档对齐 | 完整度 · 安全性 |
| 4 | `arch.md` 架构真理源对齐 | BOOT-001 ~ BOOT-006 | 文档对齐 | 架构健康 |
| 5 | `F01-BOOT.md` 分片状态与验收勾选 | BOOT-001 ~ BOOT-006 | 文档对齐 | 完整度 |

**执行顺序**：子项 1 → 2/3（可并行）→ 4 → 5。子项 5 为终检，确认前四项无遗漏后勾选 F01 分片。

**依赖链**：PR #6/#7/#8 已落地 M1 实现与部分文档；本轮为 **纯文档** 收尾，使 plan §「M1 完成 — 文档回写」4 行可在 P5 勾选，关闭 M1 当前节。

## 2. 现状与约束

### 2.1 代码真理源（只读校验 · 范围外引用）

| 能力 | 锚点 | 行为摘要 |
|------|------|----------|
| `GET /health` | `backend/app/main.py` L32–34 | 200 `{"status":"ok"}`；无鉴权 |
| `AuthMiddleware` | `backend/app/auth/middleware.py` | `PUBLIC_PATHS` 豁免；`main.py` L29 注册 |
| `GET /api/v1/me` | `backend/app/api/v1/me.py` | `get_current_user` 注入 `UserContext` |
| CORS | `main.py` L21–27 + `Settings.cors_origins` | 来源 `CORS_ORIGINS` |
| TraceId | `backend/app/core/middleware.py` | `X-Trace-Id`；JSON 日志 `traceId` |
| 中间件栈 | `main.py` L21–29 | CORS → TraceId → Auth（后注册者先执行） |

### 2.2 文档漂移摘要（2026-07-03 扫描）

| 文件 | 当前 | 目标 | 动作 |
|------|------|------|------|
| `docs/api/README.md` | `/health` 已实现；`/api/v1/me` 已登记；`auth/me` 规划+二期注记 | 与 plan 第 1 行一致 | **验证**（预期无需编辑） |
| `docs/services/core.md` | 状态 **骨架** | **已实现** | **编辑** meta 状态字段 |
| `docs/services/auth.md` | 状态 **骨架** | **已实现** | **编辑** meta 状态字段 |
| `docs/services/README.md` | core/auth 索引 **骨架** | **已实现** | **编辑** 索引行 |
| `docs/arch.md` | §4.2 main.py 注册；§4.3 M1 过渡布局；§10 **124 项** | 与 plan 第 3 行一致 | **验证**（预期无需编辑） |
| `prd/F01-BOOT.md` | BOOT-001~006 **已实现**；验收全 `[x]`；BOOT-003 含 main.py 锚点 | 与 plan 第 4 行一致 | **验证**（预期无需编辑） |
| `docs/automate/plan.md` §文档回写 | 4 行仍为 `[ ]` | P5 勾选 | **P3/P5 不编辑 plan 结构** |

> **语义说明**：`auth.md` / `core.md` 标 **已实现** 指 M1 横切基线（BOOT-003/004）交付完成；完整 RBAC/RLS（M7）仍在正文「边界」与类型表「待建」行中声明，不与 F02-AUTH 远期项冲突。

### 2.3 范围框定

| 模块 | 文件 |
|------|------|
| `docs/api/` | `README.md` |
| `docs/services/` | `core.md` · `auth.md` · `README.md`（索引一行） |
| `docs/` | `arch.md`（§4.2 · §4.3 · §10） |
| `docs/automate/prd/` | `F01-BOOT.md` |

**合计 6 文件**；不含生产代码、不含 `tests/`、不含 `plan.md` 勾选。

### 2.4 真理源优先级

`round-target` > `plan.md` §M1「文档回写」> 代码 > 既有 `arch.md` / `prd-sync.mdc`。

## 3. 方案比选（摘要）

### 3.1 core/auth 域状态枚举

| 方案 | core | auth | 结论 |
|------|------|------|------|
| A 保持 **骨架** | 反映 M1 非 M7 完整域 | 与 round-target 验收冲突 | 否决 |
| B 标 **已实现** + 正文保留 M7 待建 | 与 plan/round-target 一致；边界节澄清远期 | **采用**（round-target 强制） |
| C 标 **部分** | 枚举合法但 round-target 未授权 | 否决 |

### 3.2 发现文档与实现严重漂移时

| 方案 | 说明 | 结论 |
|------|------|------|
| A 仅改文档 | round-target 默认 | **采用** |
| B 极小锚点修正生产代码 | 仅当文档审查发现路由/路径与代码不一致 | 条件启用；本轮扫描 **未触发** |

### 3.3 重复测试补强

| 方案 | 说明 | 结论 |
|------|------|------|
| A 本轮纯文档 | round-target 明确；BOOT-* STUCK 留后续 | **采用** |
| B 追加 `test_me.py` | 属 r1 旧 round-target | 否决 |

## 4. 分项设计

### 4.1 子项 1 — BOOT-001 + BOOT-003 API 登记簿

**文件**：`docs/api/README.md`

**预期现状（PR #6 已部分履约）**：

| 检查点 | 期望 |
|--------|------|
| §0 `GET /health` | 状态 `已实现`；锚点 `backend/app/main.py` |
| §1 `GET /api/v1/me` | 状态 `已实现`；锚点 `backend/app/api/v1/me.py`；说明含 M1 占位 / `Bearer dev` |
| §1 `GET /api/v1/auth/me` | 状态 `规划`；说明含「二期正式路径」并指向 `/api/v1/me` |

**若验证通过**：无编辑；在 P4 记录「idempotent pass」。

**若任一检查失败**：按上表补行或改状态列；不新增 HTTP 路由。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `GET /health` 状态为 `已实现` | `rg 'GET.*\/health' docs/api/README.md` + 人工读状态列 |
| 2 | `GET /api/v1/me` 行存在且状态 `已实现` | `rg '/api/v1/me' docs/api/README.md` |
| 3 | `auth/me` 仍为规划且含二期注记 | 人工读 §1 |
| 4 | 无未登记 M1 路由 | 对照 `backend/app/main.py` + `api/v1/` |

---

### 4.2 子项 2 — BOOT-004 `docs/services/core.md`

**文件**：`docs/services/core.md` · `docs/services/README.md`（core 索引行）

| 字段 | 变更前 | 变更后 |
|------|--------|--------|
| `core.md` meta 状态 | `骨架` | **`已实现`** |
| `README.md` core 索引状态 | `骨架` | **`已实现`** |

**须保留/确认的锚点**（已存在则不改措辞，仅核对）：

| 符号 | 锚点 |
|------|------|
| `Settings` / `get_settings` | `backend/app/core/config.py` |
| `configure_logging` | `backend/app/core/logging.py` |
| `TraceIdMiddleware` | `backend/app/core/middleware.py` |
| `CORSMiddleware` / CORS 来源 | `backend/app/main.py` · `Settings.cors_origins` / `CORS_ORIGINS` |
| `GET /health` | `backend/app/main.py` |
| 鉴权委托 | 正文明确 `AuthMiddleware` 由 `main.py` 注册，不在 `core/` |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `core.md` meta 状态为 `已实现` | `rg '^\| 状态 \|' docs/services/core.md` |
| 2 | 锚点表含 config · logging · middleware · CORS | 文档审查 |
| 3 | `README.md` core 行状态 `已实现` | `rg 'core.md' docs/services/README.md` |
| 4 | 无 HTTP schema 写入 services | docs-layer 合规 |

---

### 4.3 子项 3 — BOOT-003 `docs/services/auth.md`

**文件**：`docs/services/auth.md` · `docs/services/README.md`（auth 索引行）

| 字段 | 变更前 | 变更后 |
|------|--------|--------|
| `auth.md` meta 状态 | `骨架` | **`已实现`** |
| `README.md` auth 索引状态 | `骨架` | **`已实现`** |

**须保留/确认的锚点与注记**：

| 项 | 内容 |
|----|------|
| `AuthMiddleware` | `backend/app/auth/middleware.py`；**`main.py` 注册** |
| `PUBLIC_PATHS` | `/health`、`/docs`、`/redoc`、`/openapi.json` |
| `get_current_user` | `backend/app/auth/deps.py` |
| `GET /api/v1/me` | `backend/app/api/v1/me.py`（API 细节 → api README） |
| M7 待建 | `PermissionService` / `RlsPolicyService` / `AuditService` 保持「待建」 |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `auth.md` meta 状态为 `已实现` | `rg '^\| 状态 \|' docs/services/auth.md` |
| 2 | 实现笔记含 `app.add_middleware(AuthMiddleware)` | 文档审查 |
| 3 | `PUBLIC_PATHS` 四路径与 `middleware.py` 一致 | 对照代码 |
| 4 | `README.md` auth 行与分片一致 | 文档审查 |

---

### 4.4 子项 4 — BOOT-001~006 `docs/arch.md`

**文件**：`docs/arch.md`（§4.2 · §4.3 · §10）

| 段落 | 期望内容 |
|------|----------|
| **§4.2** | `core/` 注释：**鉴权委托 auth/（AuthMiddleware 由 main.py 注册）**；不在 core 列 auth middleware |
| **§4.3** | 代码块后 **M1 过渡布局** 注记（AdminLayout · routes · `/admin` · 目标态 `src/app/` 迁移说明） |
| **§10** |  | `automate/prd.md` 描述为 **124 项**（与 hub `feature_count: 124` 一致） |

**预期现状**：三项均已写入（2026-07-03 修订）。P3 以 grep 验证；无匹配则补写，有匹配则 idempotent pass。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | §4.2 含 `main.py` 注册 `AuthMiddleware` | `rg 'main.py.*AuthMiddleware' docs/arch.md` |
| 2 | §4.3 含 `M1 过渡布局` | `rg 'M1 过渡布局' docs/arch.md` |
| 3 | §10 含 `124 项` 且无 `118 项` | `rg '124 项' docs/arch.md`；`rg '118 项' docs/arch.md` 无匹配 |
| 4 | 不重复 PRD 验收条款 | 人工读 §4 无 BOOT 勾选列表 |

---

### 4.5 子项 5 — BOOT-001~006 `prd/F01-BOOT.md`

**文件**：`docs/automate/prd/F01-BOOT.md`

| 项 | 期望 |
|----|------|
| BOOT-001~006 状态 | 均为 `已实现` |
| 验收标准 | 全部 `[x]` |
| BOOT-003 代码锚点 | `auth/middleware.py` · `auth/deps.py` · `api/v1/me.py` · **`main.py` 注册 AuthMiddleware`** |
| 演化建议 | 无「文档回写待下轮」类过时句 |

**预期现状**：已对齐。P3 终检；若有遗漏则补勾或改锚点字符串。

**P5 职责（非 P3）**：hub 8 维修订记录；`plan.md` §文档回写 4 行勾选。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | 六项状态均为 `已实现` | `rg '^\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md` 计数 = 6 |
| 2 | 验收标准无未勾 `[ ]` | `rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md` 无匹配 |
| 3 | BOOT-003 锚点含 main.py | 读 BOOT-003 代码锚点行 |
| 4 | 无「待下轮」文档回写残留 | `rg '待下轮' docs/automate/prd/F01-BOOT.md` 无匹配 |

## 5. 范围框定文件列表

| 路径 | 子项 | 操作 |
|------|:----:|------|
| `docs/api/README.md` | 1 | 验证 / 条件编辑 |
| `docs/services/core.md` | 2 | 编辑（状态） |
| `docs/services/auth.md` | 3 | 编辑（状态） |
| `docs/services/README.md` | 2, 3 | 编辑（索引状态） |
| `docs/arch.md` | 4 | 验证 / 条件编辑 |
| `docs/automate/prd/F01-BOOT.md` | 5 | 验证 / 条件编辑 |

## 6. 非目标（明确不做）

| 项 | 原因 |
|----|------|
| 修改 `backend/` · `fe/` 生产代码 | round-target 纯文档 |
| 新建/修改 `tests/` | 测试 STUCK 非本轮；上轮 r1/r2 已补强 |
| 修改 `docs/automate/plan.md` 勾选 | P5 职责 |
| 修改 `docs/automate/prd.md` hub 分数 | P5 重评 |
| M1B DATA-* | queued |
| META-001 / DESIGN-001 / CONN-021 | 远期 |
| 前端 UI | 不触及 `fe/` |
| 重复 PR #6 已完成的 api/arch/F01 大段改写 | 最小 diff |

## 7. 与 PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮对齐方式 | 预期 P5 改善 |
|--------|-----------------|-------------|-------------|
| BOOT-001 | 完整度 94% · 测试覆盖 72% | api `/health` 登记确认 | 完整度维持/↑ |
| BOOT-002 | 完整度 · 测试覆盖 68% | arch §4.3 M1 注记确认；F01 终检 | 完整度 ↑ |
| BOOT-003 | 完整度 96% · 安全性 86% | auth 域 + api `/me` 文档；PUBLIC_PATHS | 完整度 ↑ |
| BOOT-004 | 完整度 94% · 架构 90% | core 状态 → 已实现；CORS/TraceId 锚点 | 完整度 ↑ |
| BOOT-005 | 完整度 · 测试覆盖 68% | F01 分片勾选确认（间接） | 完整度 ↑ |
| BOOT-006 | 完整度 · 测试覆盖 70% | F01 + arch 索引一致 | 完整度 ↑ |

**tie-break**：plan 强制文档回写块为 M1 关闭前置；完整度维为主攻击；测试覆盖 STUCK 项本轮 **不重复实施**（round-target STUCK 标注）。

## 8. P4 验证命令（实施阶段）

```bash
# 状态字段
rg '^\| 状态 \| \*\*' docs/services/core.md docs/services/auth.md
rg 'core.md|auth.md' docs/services/README.md

# API 登记
rg '/health|/api/v1/me' docs/api/README.md

# arch 真理源
rg 'main.py.*AuthMiddleware|M1 过渡布局|124 项' docs/arch.md
rg '118 项' docs/arch.md && exit 1 || true

# F01 分片
rg '^\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md | wc -l  # 期望 6
rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md && exit 1 || true
```

## 9. Spec Self-Review

- [x] 覆盖 round-target 全部 5 子项
- [x] 未超出范围框定（6 文件 · `docs/` 模块）
- [x] 无 TBD/TODO 占位
- [x] 未触及前端 UI → `ui_design_skill: none`
- [x] 与 plan §M1 文档回写 4 行一一对应
- [x] 禁止写生产代码（本文档仅 spec）
