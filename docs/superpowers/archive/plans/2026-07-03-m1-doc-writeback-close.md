# M1 文档回写收尾 — 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `docs/api/README.md` · `docs/services/core.md` · `docs/services/auth.md` · `docs/services/README.md` · `docs/arch.md` · `docs/automate/prd/F01-BOOT.md`
> **子项：** BOOT-001 · BOOT-002 · BOOT-003 · BOOT-004 · BOOT-005 · BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `docs/**` 遵守 docs-layer）

**Goal:** 完成 M1 plan §「文档回写」4 行前置条件——将 services 域附录 core/auth 状态升至 **已实现**，并 idempotent 验证 api/arch/F01 分片已与代码一致；**不修改**生产代码、`tests/`、`plan.md`。

**Architecture:** 按 design 子项顺序：api 登记簿验证 → core 状态回写 → auth 状态回写 → arch 真理源验证 → F01 分片终检。仅 Task 2/3 预期产生 diff；其余 Task 以 grep/对照代码 idempotent pass 为主。M7 远期能力（RBAC/RLS/Audit）保留正文「待建」，不与 F02-AUTH 冲突。

**Tech Stack:** Markdown 文档 · ripgrep · 只读对照 `backend/app/` 锚点

## Global Constraints

- **禁止**修改 `backend/`、`fe/`、`tests/`
- **禁止**修改 `docs/automate/plan.md`（P5 勾选）与 `docs/automate/prd.md` hub 8 维（P5 重评）
- **禁止**新增 HTTP 路由或 API schema 到 `docs/services/`
- core/auth meta **状态** → `已实现`（round-target 强制）；类型表内 `M1 骨架` / `待建` 行**不改**
- `UI skill: none`（本轮不触及 `fe/`）
- 预估变更文件数：**6**（≤ round-target 上限 20）；预期实际 diff **3** 文件（core.md · auth.md · README.md 索引两行）

---

### Task 1: BOOT-001 + BOOT-003 — API 登记簿验证

**Files:**
- Verify: `docs/api/README.md`
- Read-only: `backend/app/main.py` · `backend/app/api/v1/me.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/docs-layer.mdc`（触及 `docs/api/`）

**UI skill:** none

**Interfaces:**
- Consumes: 无
- Produces: `docs/api/README.md` §0 `/health`、§1 `/api/v1/me` 状态均为 `已实现`；§1 `auth/me` 仍为 `规划` 且含二期注记

- [ ] **Step 1: 运行登记簿检查**

```bash
cd /workspace
rg 'GET.*`/health`' docs/api/README.md
rg '/api/v1/me' docs/api/README.md
rg '/api/v1/auth/me' docs/api/README.md
```

Expected: 三行均匹配；`/health` 与 `/api/v1/me` 行状态列为 `已实现`；`/api/v1/auth/me` 状态列为 `规划` 且说明含「二期正式路径」或「M1 占位见 `GET /api/v1/me`」。

- [ ] **Step 2: 对照代码锚点（只读）**

```bash
rg '@app.get\("/health"\)|def health' backend/app/main.py
rg 'router|/me' backend/app/api/v1/me.py
```

Expected: `/health` 锚点指向 `main.py`；`/me` 路由存在于 `me.py`。

- [ ] **Step 3: 条件编辑（仅 Step 1 失败时）**

若 `/health` 或 `/api/v1/me` 状态非 `已实现`，按 design §4.1 补正对应表格行，例如：

```markdown
| GET | `/health` | 健康检查 | — | P0 | BOOT-001 | 已实现 | `backend/app/main.py` |
```

```markdown
| GET | `/api/v1/me` | M1 占位：当前用户（开发 `Bearer dev`） | 内部 | P0 | BOOT-003 | 已实现 | `backend/app/api/v1/me.py` |
```

若 `auth/me` 缺二期注记，保持状态 `规划` 并补说明：

```markdown
| GET | `/api/v1/auth/me` | 当前用户与角色；二期正式路径，M1 占位见 `GET /api/v1/me` | 内部 | 一期 | AUTH-003 | 规划 | `backend/app/api/v1/auth.py` |
```

- [ ] **Step 4: 验证**

```bash
rg 'BOOT-001 \| 已实现' docs/api/README.md
rg 'BOOT-003 \| 已实现' docs/api/README.md
rg 'AUTH-003 \| 规划' docs/api/README.md
```

Expected: 三行均匹配。

- [ ] **Step 5: 提交（仅 Step 3 有 diff 时）**

```bash
git add docs/api/README.md
git commit -m "docs(api): align M1 /health and /api/v1/me registry"
```

若无 diff：记录 **idempotent pass**，跳过 commit。

---

### Task 2: BOOT-004 — `core.md` 与索引状态回写

**Files:**
- Modify: `docs/services/core.md`（meta 状态行）
- Modify: `docs/services/README.md`（core 索引行）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`（触及 `docs/services/`）
- Read `.cursor/rules/prd-sync.mdc`（域附录状态同步）

**UI skill:** none

**Interfaces:**
- Consumption: Task 1 完成（无硬依赖，可并行 Task 3）
- Produces: `core.md` meta `| 状态 | **已实现** |`；`README.md` core 行末列 `已实现`

- [ ] **Step 1: 确认锚点已存在（不改措辞）**

```bash
rg 'config\.py|logging\.py|middleware\.py|main\.py' docs/services/core.md
rg 'AuthMiddleware.*main\.py' docs/services/core.md
```

Expected: 锚点表含 Settings/config、logging、TraceIdMiddleware、CORS、GET /health；实现笔记含「AuthMiddleware 由 main.py 注册」。

- [ ] **Step 2: 更新 `core.md` meta 状态**

在 `docs/services/core.md` 元信息表，将第 8 行：

```markdown
| 状态 | **骨架** |
```

改为：

```markdown
| 状态 | **已实现** |
```

**禁止**修改 §主要类型表、§实现笔记、§边界正文。

- [ ] **Step 3: 更新 `README.md` core 索引行**

在 `docs/services/README.md` 域索引表，将：

```markdown
| [core.md](./core.md) | `app/core/` | F01-BOOT | M1 | 骨架 |
```

改为：

```markdown
| [core.md](./core.md) | `app/core/` | F01-BOOT | M1 | 已实现 |
```

- [ ] **Step 4: 验证**

```bash
rg '^\| 状态 \| \*\*已实现\*\* \|' docs/services/core.md
rg '\[core\.md\].*已实现' docs/services/README.md
rg 'path|method|GET \|' docs/services/core.md && exit 1 || true
```

Expected: core.md 状态匹配；README core 行含 `已实现`；services 无 HTTP schema 泄漏。

- [ ] **Step 5: 提交**

```bash
git add docs/services/core.md docs/services/README.md
git commit -m "docs(services): mark core domain M1 baseline as implemented"
```

---

### Task 3: BOOT-003 — `auth.md` 与索引状态回写

**Files:**
- Modify: `docs/services/auth.md`（meta 状态行）
- Modify: `docs/services/README.md`（auth 索引行）

**Skills:**
- Read `.cursor/rules/docs-layer.mdc`（触及 `docs/services/`）
- Read `.cursor/rules/prd-sync.mdc`（域附录状态同步）

**UI skill:** none

**Interfaces:**
- Consumes: 无（可与 Task 2 并行，合并时注意 README 冲突）
- Produces: `auth.md` meta `| 状态 | **已实现** |`；`README.md` auth 行末列 `已实现`

- [ ] **Step 1: 确认锚点与 M7 待建行（不改措辞）**

```bash
rg 'middleware\.py|deps\.py|me\.py|PUBLIC_PATHS|add_middleware' docs/services/auth.md
rg '待建' docs/services/auth.md
```

Expected: 实现笔记含 `app.add_middleware(AuthMiddleware)`；PUBLIC_PATHS 四路径；PermissionService/RlsPolicyService/AuditService 仍为「待建」。

- [ ] **Step 2: 更新 `auth.md` meta 状态**

在 `docs/services/auth.md` 元信息表，将：

```markdown
| 状态 | **骨架** |
```

改为：

```markdown
| 状态 | **已实现** |
```

**禁止**修改 §主要类型表中 `M1 骨架` 列值（仅 meta 状态升级）。

- [ ] **Step 3: 更新 `README.md` auth 索引行**

将：

```markdown
| [auth.md](./auth.md) | `app/auth/` | F02-AUTH | M7 | 骨架 |
```

改为：

```markdown
| [auth.md](./auth.md) | `app/auth/` | F02-AUTH | M7 | 已实现 |
```

- [ ] **Step 4: 对照 `PUBLIC_PATHS` 与代码**

```bash
rg 'PUBLIC_PATHS' backend/app/auth/middleware.py -A 3
rg '/health|/docs|/redoc|/openapi\.json' docs/services/auth.md
```

Expected: 文档四路径与 `middleware.py` 一致。

- [ ] **Step 5: 验证**

```bash
rg '^\| 状态 \| \*\*已实现\*\* \|' docs/services/auth.md
rg '\[auth\.md\].*已实现' docs/services/README.md
```

Expected: 两行均匹配。

- [ ] **Step 6: 提交**

```bash
git add docs/services/auth.md docs/services/README.md
git commit -m "docs(services): mark auth M1 cross-cutting baseline as implemented"
```

若 Task 2 已改 README 且未 push：rebase 或单次 commit 合并 Task 2+3 README 变更，避免重复 commit 冲突。

---

### Task 4: BOOT-001~006 — `arch.md` 架构真理源验证

**Files:**
- Verify: `docs/arch.md`（§4.2 · §4.3 · §10）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/docs-layer.mdc`（触及 `docs/arch.md`）

**UI skill:** none

**Interfaces:**
- Consumes: Task 2/3 域状态已回写（逻辑顺序；可并行只读验证）
- Produces: §4.2 含 main.py 注册 AuthMiddleware；§4.3 含 M1 过渡布局；§10 含 124 项且无 118 项

- [ ] **Step 1: grep 三项期望**

```bash
rg 'AuthMiddleware 由 main\.py 注册' docs/arch.md
rg 'M1 过渡布局' docs/arch.md
rg '124 项' docs/arch.md
rg '118 项' docs/arch.md && exit 1 || echo "OK: no 118"
```

Expected: 前三项匹配；`118 项` 无匹配。

- [ ] **Step 2: 条件编辑（仅 Step 1 失败时）**

§4.2 目录树 `core/` 注释行应为：

```markdown
│   ├── core/           # config, logging, TraceIdMiddleware；鉴权委托 auth/（AuthMiddleware 由 main.py 注册）
```

§4.3 代码块后应保留 `> **M1 过渡布局（2026-07-03）**` 注记（AdminLayout · routes · `/admin` · 目标态 `src/app/`）。

§10 hub 行应为：

```markdown
| [automate/prd.md](automate/prd.md) | 功能真理源 hub（124 项） |
```

- [ ] **Step 3: 人工读 §4 无 BOOT 验收勾选列表**

确认 arch §4 不含 PRD 验收 `[x]` 列表（prd-sync 边界）。

- [ ] **Step 4: 提交（仅 Step 2 有 diff 时）**

```bash
git add docs/arch.md
git commit -m "docs(arch): align M1 auth mount and PRD hub count"
```

若无 diff：记录 **idempotent pass**。

---

### Task 5: BOOT-001~006 — `F01-BOOT.md` 终检与聚合验证

**Files:**
- Verify: `docs/automate/prd/F01-BOOT.md`
- Verify: 范围框定内全部 6 文件（聚合）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`
- Read `.cursor/rules/prd-sync.mdc`（PRD 分片终检）

**UI skill:** none

**Interfaces:**
- Consumes: Task 1–4 全部完成
- Produces: F01 六项 `已实现`、验收全 `[x]`、BOOT-003 锚点含 main.py；P4 命令 exit 0

- [ ] **Step 1: F01 分片检查**

```bash
rg '^\- \*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md | wc -l
rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md && exit 1 || echo "OK: no unchecked"
rg 'main\.py.*AuthMiddleware|AuthMiddleware.*main\.py' docs/automate/prd/F01-BOOT.md
rg '待下轮' docs/automate/prd/F01-BOOT.md && exit 1 || echo "OK: no stale 待下轮"
```

Expected: 状态行计数 = **6**；无未勾 `[ ]`；BOOT-003 代码锚点含 `` `main.py` 注册 `AuthMiddleware` ``；无「待下轮」。

- [ ] **Step 2: 条件编辑（仅 Step 1 失败时）**

补缺失 `**状态**：已实现`、勾选 `[x]`，或修正 BOOT-003 代码锚点行为：

```markdown
- **代码锚点**：`backend/app/auth/middleware.py` · `backend/app/auth/deps.py` · `backend/app/api/v1/me.py`（`main.py` 注册 `AuthMiddleware`）
```

- [ ] **Step 3: 运行 design §8 聚合 P4 命令**

```bash
cd /workspace
rg '^\| 状态 \| \*\*已实现\*\* \|' docs/services/core.md docs/services/auth.md
rg 'core\.md|auth\.md' docs/services/README.md
rg '/health|/api/v1/me' docs/api/README.md
rg 'main\.py.*AuthMiddleware|M1 过渡布局|124 项' docs/arch.md
rg '118 项' docs/arch.md && exit 1 || true
test "$(rg '^\- \*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md | wc -l)" -eq 6
rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md && exit 1 || true
echo "P4 doc writeback aggregate: PASS"
```

Expected: 全部 exit 0，最后一行打印 `P4 doc writeback aggregate: PASS`。

- [ ] **Step 4: 提交（仅 Step 2 有 diff 时）**

```bash
git add docs/automate/prd/F01-BOOT.md
git commit -m "docs(prd): finalize F01-BOOT M1 acceptance alignment"
```

若无 diff：记录 **idempotent pass**；本轮 PR 至少含 Task 2/3 commits。

---

## Spec Self-Review（P2）

| 检查项 | 结果 |
|--------|------|
| design 5 子项 → 5 Task | ✓ |
| 无 TBD/TODO/适当处理 | ✓ |
| 每 Task 含验证命令 | ✓ |
| UI skill: none 已声明 | ✓ |
| 文件数 6 ≤ 20 | ✓ |
| 不含 plan.md 勾选 / 生产代码 | ✓ |

## P5 提醒（非 P3）

- 勾选 `docs/automate/plan.md` §M1「文档回写」4 行
- 重评 `docs/automate/prd.md` hub 8 维 BOOT-001~006
