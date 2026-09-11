# M1 文档回写 idempotent 对账 + plan 勾选闭环 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `docs/api/README.md` · `docs/services/core.md` · `docs/services/auth.md` · `docs/services/README.md` · `docs/arch.md` · `docs/automate/prd/F01-BOOT.md`（`docs/automate/plan.md` P5 只读校验）
> **子项：** BOOT-001 · BOOT-003 · BOOT-004 · BOOT-002 · BOOT-005 · BOOT-006
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `docs/**` 时遵守 `docs-layer.mdc`）

**Goal:** 对框定 6 个文档文件执行 idempotent 对账，修补 `auth.md` 入口表缺失的 `api/v1/me.py` 锚点行，确认 F01-BOOT 与 arch/api/services 一致，为 P5 勾选 `plan.md` §「M1 完成 — 文档回写」4 行做准备。

**Architecture:** 纯文档轮；以 ripgrep + 人工读表验证为主；仅当检查失败时做最小 diff 编辑；不修改 `backend/`、`fe/`、`tests/` 或 `plan.md` 结构。

**Tech Stack:** Markdown · ripgrep · Git（有变更才提交）

## Global Constraints

- 真理源优先级：`round-target` > `plan.md` §文档回写 > 代码 > `prd-sync.mdc` > 既有文档
- 禁止修改 `backend/`、`fe/`、`tests/`；禁止改 `plan.md` 结构（P5 例外勾选 4 行）
- `ui_design_skill: none` — 所有 Task 不触及前端 UI 文件
- 对账无缺口 → idempotent 通过；零 diff 合法
- `plan.md` §文档回写 4 行无 `<prd ID>:` 前缀 → P5 例外勾选，P3 只读校验内容已满足

---

### Task 1: API 登记簿 idempotent 对账（BOOT-001 · BOOT-003）

**Files:**
- Verify: `docs/api/README.md`
- Read-only ref: `backend/app/main.py` · `backend/app/api/v1/me.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

触及 `docs/api/` — 遵守 `docs-layer.mdc`（HTTP 契约登记，不写业务流程叙事）。

- [ ] **Step 1: 验证 `/health` 已实现**

Run:

```bash
rg 'GET.*\/health' docs/api/README.md
rg '已实现.*backend/app/main.py' docs/api/README.md
```

Expected: 匹配 §0 `GET /health` 行，状态 `已实现`，锚点 `backend/app/main.py`。

- [ ] **Step 2: 验证 `/api/v1/me` 已实现**

Run:

```bash
rg '/api/v1/me' docs/api/README.md
rg '已实现.*backend/app/api/v1/me.py' docs/api/README.md
```

Expected: §1 存在 `GET /api/v1/me`，状态 `已实现`，锚点 `backend/app/api/v1/me.py`，说明含 M1 占位。

- [ ] **Step 3: 验证 `auth/me` 仍为规划且含二期注记**

Run:

```bash
rg '/api/v1/auth/me' docs/api/README.md
```

Expected: 状态 `规划`；说明含「二期正式路径」并指向 `/api/v1/me`（人工读 §1 相邻行确认）。

- [ ] **Step 4: 确认未新增 HTTP 路由（只读）**

Run:

```bash
rg '@app\.(get|post)|router\.(get|post)' backend/app/main.py backend/app/api/v1/me.py
```

Expected: 仅既有 `/health` 与 `/api/v1/me` 路由；本 Task **不编辑** 代码。

- [ ] **Step 5: 条件编辑（仅 Step 1–3 失败时）**

若任一步失败，按 `docs/superpowers/specs/2026-07-03-m1-plan-close-design.md` §4.1 表格修正 `docs/api/README.md` 对应行（状态、锚点、二期注记），然后重跑 Step 1–3。

- [ ] **Step 6: 提交（仅当有 diff）**

```bash
git diff --quiet docs/api/README.md || git add docs/api/README.md && git commit -m "docs(api): idempotent reconcile /health and /api/v1/me registry"
```

Expected: 当前快照下 idempotent pass，通常无提交。

---

### Task 2: 域附录 core 状态与锚点对账（BOOT-004）

**Files:**
- Verify: `docs/services/core.md` · `docs/services/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

触及 `docs/services/` — 域边界与锚点，不写 HTTP schema。

- [ ] **Step 1: 验证 core.md meta 已实现**

Run:

```bash
rg '^\| 状态 \| \*\*已实现\*\*' docs/services/core.md
```

Expected: 1 行匹配。

- [ ] **Step 2: 验证锚点表含 M1 关键文件**

Run:

```bash
rg 'config\.py|logging\.py|middleware\.py|CORS|cors_origins|GET /health|main\.py' docs/services/core.md
```

Expected: 锚点表含 `config.py`、`logging.py`、`middleware.py`（TraceId）、CORS/`Settings.cors_origins`、`main.py` 挂载注记。

- [ ] **Step 3: 验证 services README 索引**

Run:

```bash
rg 'core\.md' docs/services/README.md
```

Expected: 索引行状态为 `已实现`。

- [ ] **Step 4: 条件编辑（仅 Step 1–3 失败时）**

在 `docs/services/core.md` 补全缺失锚点或 meta 状态；同步 `docs/services/README.md` core 行。措辞参照 `docs/automate/prd/F01-BOOT.md` BOOT-004 代码锚点。

- [ ] **Step 5: 提交（仅当有 diff）**

```bash
git diff --quiet docs/services/core.md docs/services/README.md || \
  git add docs/services/core.md docs/services/README.md && \
  git commit -m "docs(services): idempotent reconcile core.md anchors"
```

---

### Task 3: 域附录 auth 状态与锚点对账（BOOT-003）

**Files:**
- Modify (conditional): `docs/services/auth.md`
- Verify: `docs/services/README.md`
- Read-only ref: `backend/app/auth/middleware.py` · `backend/app/main.py`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

触及 `docs/services/` — 预期 **条件编辑**：入口表补 `api/v1/me.py` 锚点行。

- [ ] **Step 1: 验证 meta 与 main.py 注册注记**

Run:

```bash
rg '^\| 状态 \| \*\*已实现\*\*' docs/services/auth.md
rg 'add_middleware\(AuthMiddleware\)' docs/services/auth.md
```

Expected: 各 1 行匹配；实现笔记含 `app.add_middleware(AuthMiddleware)`。

- [ ] **Step 2: 验证 PUBLIC_PATHS 与代码一致**

Run:

```bash
rg 'PUBLIC_PATHS' docs/services/auth.md backend/app/auth/middleware.py
```

Expected: 文档列 `/health`、`/docs`、`/redoc`、`/openapi.json` 与 `middleware.py` 中 `PUBLIC_PATHS` 集合一致。

- [ ] **Step 3: 检测 `api/v1/me.py` 锚点**

Run:

```bash
rg 'api/v1/me\.py' docs/services/auth.md && echo PASS || echo NEED_EDIT
```

Expected（当前 P1 扫描）: `NEED_EDIT` — 入口表缺显式行。

- [ ] **Step 4: 补入口表一行（仅 Step 3 为 NEED_EDIT 时）**

在 `docs/services/auth.md`「主要类型 / 入口（M1 骨架）」表中，于 `get_current_user` 行之后、`PermissionService` 行之前插入：

```markdown
| `GET /api/v1/me` | `api/v1/me.py`；`get_current_user` 注入 `UserContext` | BOOT-003 | M1 骨架 |
```

完整上下文（插入后片段）：

```markdown
| `get_current_user` | `auth/deps.py`；handler 依赖注入 | BOOT-003 | M1 骨架 |
| `GET /api/v1/me` | `api/v1/me.py`；`get_current_user` 注入 `UserContext` | BOOT-003 | M1 骨架 |
| `UserContext` | 占位用户上下文 | BOOT-003 | M1 占位 |
```

- [ ] **Step 5: 重验证锚点**

Run:

```bash
rg 'api/v1/me\.py' docs/services/auth.md
rg 'auth\.md' docs/services/README.md
```

Expected: `api/v1/me.py` 至少 1 匹配；README auth 索引行 `已实现`。

- [ ] **Step 6: 提交**

```bash
git add docs/services/auth.md
git commit -m "docs(services): add api/v1/me.py anchor to auth.md entry table"
```

Expected: 本 Task 通常产生 1 行 diff 提交。

---

### Task 4: arch.md 架构真理源对账（BOOT-001 ~ BOOT-006）

**Files:**
- Verify: `docs/arch.md`（§4.2 · §4.3 · §10）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

触及 `docs/arch.md` — 架构决策与目录，不重复 PRD 验收条款。

- [ ] **Step 1: 验证 §4.2 main.py 注册 AuthMiddleware**

Run:

```bash
rg 'AuthMiddleware 由 main\.py 注册|main\.py.*AuthMiddleware' docs/arch.md
```

Expected: §4.2 含鉴权委托 `auth/` 且 **AuthMiddleware 由 main.py 注册**。

- [ ] **Step 2: 验证 §4.3 M1 过渡布局**

Run:

```bash
rg 'M1 过渡布局' docs/arch.md
```

Expected: 含 AdminLayout · routes · `/admin` 注记。

- [ ] **Step 3: 验证 §10 PRD hub 124 项、无 118 项残留**

Run:

```bash
rg '124 项' docs/arch.md
test -z "$(rg '118 项' docs/arch.md)" && echo PASS || echo FAIL
```

Expected: `124 项` 匹配；`118 项` 无匹配。

- [ ] **Step 4: 确认 §4 无 BOOT 勾选列表（人工扫读）**

Run:

```bash
rg 'BOOT-00[1-6]' docs/arch.md | head -5
```

Expected: 若有 BOOT 引用仅为交叉指针，非验收勾选列表；违反则删重复 PRD 条款。

- [ ] **Step 5: 条件编辑 + 提交（仅 Step 1–3 失败时）**

```bash
git diff --quiet docs/arch.md || git add docs/arch.md && git commit -m "docs(arch): idempotent reconcile M1 auth mount and hub count"
```

---

### Task 5: F01-BOOT 终检 + plan 勾选前置校验（BOOT-001 ~ BOOT-006）

**Files:**
- Verify: `docs/automate/prd/F01-BOOT.md`
- Read-only: `docs/automate/plan.md` §「M1 完成 — 文档回写」（P5 勾选，P3 不改）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 验证六项 BOOT 状态已实现**

Run:

```bash
test "$(rg -c '\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md)" -eq 6 && echo PASS || echo FAIL
```

Expected: `PASS`（计数 = 6）。

- [ ] **Step 2: 验证验收标准无未勾选项**

Run:

```bash
test -z "$(rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md)" && echo PASS || echo FAIL
```

Expected: `PASS`（无 `  - [ ]` 行）。

- [ ] **Step 3: 验证 BOOT-003 代码锚点**

Run:

```bash
rg 'auth/middleware\.py' docs/automate/prd/F01-BOOT.md
rg 'main\.py.*AuthMiddleware|AuthMiddleware' docs/automate/prd/F01-BOOT.md
rg 'api/v1/me\.py' docs/automate/prd/F01-BOOT.md
```

Expected: BOOT-003 代码锚点行含 `middleware.py`、`main.py` 注册、`api/v1/me.py`。

- [ ] **Step 4: 只读校验 plan §文档回写内容已满足（勾选留 P5）**

Run:

```bash
rg -n 'M1 完成 — 文档回写' docs/automate/plan.md
rg '^- \[ \]' docs/automate/plan.md | head -6
```

Expected: §文档回写 4 行仍为 `[ ]`（P5 职责）；行内描述与当前文档状态一致。P3 **禁止**修改 `plan.md`。

- [ ] **Step 5: 条件编辑 F01（仅 Step 1–3 失败时）**

修正 `docs/automate/prd/F01-BOOT.md` 状态/验收/锚点，然后重跑 Step 1–3。

- [ ] **Step 6: 全量 P4 预检命令**

Run:

```bash
set -e
rg '/health|/api/v1/me' docs/api/README.md
rg '^\| 状态 \| \*\*已实现\*\*' docs/services/core.md docs/services/auth.md
rg 'api/v1/me\.py' docs/services/auth.md
rg 'core\.md|auth\.md' docs/services/README.md
rg 'M1 过渡布局|124 项' docs/arch.md
test -z "$(rg '118 项' docs/arch.md)"
test "$(rg -c '\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md)" -eq 6
test -z "$(rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md)"
echo "P4 precheck PASS"
```

Expected: 末行 `P4 precheck PASS`（plan 勾选计数在 P5 后由 P4 完整验证补跑）。

- [ ] **Step 7: 提交（仅 F01 有 diff）**

```bash
git diff --quiet docs/automate/prd/F01-BOOT.md || \
  git add docs/automate/prd/F01-BOOT.md && \
  git commit -m "docs(prd): idempotent reconcile F01-BOOT M1 acceptance"
```

## P5 交接说明（P3 不执行）

`docs/automate/plan.md` §「M1 完成 — 文档回写」4 行由 P5 例外勾选：

```markdown
- [x] `docs/api/README.md`：…（完成于 YYYY-MM-DD）
- [x] `docs/services/core.md`、`auth.md`：…（完成于 YYYY-MM-DD）
- [x] `docs/arch.md`：…（完成于 YYYY-MM-DD）
- [x] `prd/F01-BOOT.md`：…（完成于 YYYY-MM-DD）
```

仅改 `[ ]` → `[x]` 并附完成日期；**不改**行内描述文本。

## 预估

| 指标 | 值 |
|------|-----|
| Task 数 | 5 |
| 预估变更文件 | 1（`auth.md` 补 1 行）；其余 5 文件 idempotent pass |
| 总框定文件 | 6 + plan 只读 |
