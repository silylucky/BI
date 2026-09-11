# M1 文档回写 idempotent 对账 + plan 勾选闭环 — 设计规格

```yaml
date: 2026-07-03
milestone: M1
round_target: docs/superpowers/evolution/2026-07-03-round-target-m1-plan-close.md
prd_ids: [BOOT-001, BOOT-003, BOOT-004, BOOT-002, BOOT-005, BOOT-006]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 主题 | PRD ID | 类型 | 主攻 8 维薄弱项 |
|---|------|--------|------|----------------|
| 1 | API 登记簿 idempotent 对账（`/health` · `/api/v1/me`） | BOOT-001 · BOOT-003 | 验证 / 条件补缺 | 完整度 |
| 2 | 域附录 `core.md` 状态与锚点对账 | BOOT-004 | 验证 / 条件补缺 | 完整度 · 架构 |
| 3 | 域附录 `auth.md` 状态与锚点对账 | BOOT-003 | 验证 / 条件补缺 | 完整度 · 安全性 |
| 4 | `arch.md` 架构真理源对账 | BOOT-001 ~ BOOT-006 | 验证 / 条件补缺 | 架构健康 |
| 5 | `F01-BOOT.md` 终检 + plan §文档回写 4 行勾选闭环 | BOOT-001 ~ BOOT-006 | 验证 + P5 勾选 | 完整度 · plan 当前节完成度 |

**执行顺序**：子项 1 → 2/3（可并行）→ 4 → 5 终检 → P5 plan 勾选。

**本轮定位**：PR #10/#11 已落地文档回写与 BOOT 测试；6 个框定文件**预期已对齐**。本轮以 **idempotent 对账**为主（grep + 人工读表），仅修补残留缺口；**不重复**测试实施或大规模文档改写。

## 2. 现状与约束

### 2.1 代码真理源（只读 · 范围外引用）

| 能力 | 锚点 | 行为摘要 |
|------|------|----------|
| `GET /health` | `backend/app/main.py` L32+ | 200 `{"status":"ok"}`；无鉴权 |
| `AuthMiddleware` | `backend/app/auth/middleware.py` | `PUBLIC_PATHS` 豁免；`main.py` L29 `add_middleware` |
| `GET /api/v1/me` | `backend/app/api/v1/me.py` | `get_current_user` 注入 `UserContext` |
| CORS | `main.py` + `Settings.cors_origins` | 来源 `CORS_ORIGINS` |
| TraceId | `backend/app/core/middleware.py` | `X-Trace-Id`；JSON 日志 `traceId` |

### 2.2 文档对账快照（2026-07-03 P1 扫描）

| 文件 | 当前状态 | round-target 期望 | 预期动作 |
|------|----------|-------------------|----------|
| `docs/api/README.md` | `/health`·`/api/v1/me` 已实现；`auth/me` 规划+二期注记 | 子项 1 全满足 | **idempotent pass** |
| `docs/services/core.md` | meta **已实现**；锚点含 config/logging/middleware/CORS | 子项 2 全满足 | **idempotent pass** |
| `docs/services/auth.md` | meta **已实现**；middleware/deps/PUBLIC_PATHS/main.py 注记齐全 | 子项 3 缺显式 `api/v1/me.py` 锚点行 | **条件编辑**（补一行入口表） |
| `docs/services/README.md` | core/auth 索引均为 **已实现** | 与子项 2/3 一致 | **idempotent pass** |
| `docs/arch.md` | §4.2 main.py 注册；§4.3 M1 过渡布局；§10 **124 项** | 子项 4 全满足 | **idempotent pass** |
| `prd/F01-BOOT.md` | BOOT-001~006 **已实现**；验收全 `[x]`；BOOT-003 含 main.py 锚点 | 子项 5 全满足 | **idempotent pass** |
| `docs/automate/plan.md` §文档回写 | **4 行仍为 `[ ]`** | P5 勾选 `[x]` | **P5 职责**（见 §4.5） |

### 2.3 范围框定

| 模块 | 文件 |
|------|------|
| `docs/api/` | `README.md` |
| `docs/services/` | `core.md` · `auth.md` · `README.md`（索引一行） |
| `docs/` | `arch.md`（§4.2 · §4.3 · §10） |
| `docs/automate/prd/` | `F01-BOOT.md` |

**合计 6 文件**；`plan.md` 勾选在 P5 执行，P3 只读校验内容已满足。

### 2.4 真理源优先级

`round-target` > `plan.md` §M1「文档回写」> 代码 > `prd-sync.mdc` > 既有文档。

## 3. 方案比选

### 3.1 文档已对齐时的实施策略

| 方案 | 说明 | 结论 |
|------|------|------|
| A idempotent 验证，零 diff 亦可合并 | round-target 明确「对账无缺口则 idempotent 通过」 | **采用** |
| B 强制改写措辞刷 last_updated | 无用户价值；违反最小 diff | 否决 |
| C 借机扩写 services 叙事 | 超出框定；docs-layer 禁止重复 PRD | 否决 |

### 3.2 plan §文档回写 4 行勾选（格式非 `<prd ID>:`）

| 方案 | 说明 | 结论 |
|------|------|------|
| A P5 例外勾选既有 `- [ ]` 文档行 | 行已是勾选位；改 `[ ]`→`[x]` 附日期，不改描述文本；满足 round-target 子项 5 | **采用** |
| B 依赖 P5 默认 prd-ID 匹配算法 | 4 行无 BOOT-* 前缀，算法 step 5 会跳过；无法闭环 M1 | 否决 |
| C P3 改 plan 结构为 prd ID 行 | SOP 禁止 P3 改 plan 结构 | 否决 |
| D 人工 `create-evolution-plan` | 仅当 P5 例外被编排器拒绝时的回退 | **回退路径** |

### 3.3 发现文档与实现严重漂移

| 方案 | 说明 | 结论 |
|------|------|------|
| A 仅改文档对齐代码 | round-target 默认 | **采用** |
| B 极小生产代码锚点修正 | 仅当路由/路径与登记簿不一致 | 条件启用；当前扫描**未触发** |

## 4. 分项设计

### 4.1 子项 1 — BOOT-001 + BOOT-003 API 登记簿

**文件**：`docs/api/README.md`

| 检查点 | 期望 |
|--------|------|
| §0 `GET /health` | 状态 `已实现`；锚点 `backend/app/main.py` |
| §1 `GET /api/v1/me` | 状态 `已实现`；锚点 `backend/app/api/v1/me.py`；说明含 M1 占位 |
| §1 `GET /api/v1/auth/me` | 状态 `规划`；说明含「二期正式路径」并指向 `/api/v1/me` |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | `/health` 状态为 `已实现` | `rg 'GET.*\/health' docs/api/README.md` |
| 2 | `/api/v1/me` 行存在且 `已实现` | `rg '/api/v1/me' docs/api/README.md` |
| 3 | `auth/me` 仍为规划且含二期注记 | 人工读 §1 |
| 4 | 不新增 HTTP 路由 | 对照 `backend/app/main.py` |

---

### 4.2 子项 2 — BOOT-004 `docs/services/core.md`

**文件**：`docs/services/core.md` · `docs/services/README.md`（core 索引行）

**须确认锚点**：`config.py` · `logging.py` · `middleware.py`（TraceId）· CORS/`Settings.cors_origins` · `GET /health` · 鉴权委托 `main.py` 注册。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | meta 状态 `已实现` | `rg '^\| 状态 \| \*\*已实现\*\*' docs/services/core.md` |
| 2 | 锚点表含上述文件 | 文档审查 |
| 3 | `README.md` core 行 `已实现` | `rg 'core.md' docs/services/README.md` |

---

### 4.3 子项 3 — BOOT-003 `docs/services/auth.md`

**文件**：`docs/services/auth.md` · `docs/services/README.md`（auth 索引行）

**须确认**：`AuthMiddleware` + **`main.py` 注册**；`PUBLIC_PATHS` 四路径；`deps.py`；**`api/v1/me.py` 锚点**（若入口表缺行则补一行，措辞与 F01-BOOT 一致）。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | meta 状态 `已实现` | `rg '^\| 状态 \| \*\*已实现\*\*' docs/services/auth.md` |
| 2 | 实现笔记含 `add_middleware(AuthMiddleware)` | `rg 'add_middleware\(AuthMiddleware\)' docs/services/auth.md` |
| 3 | `PUBLIC_PATHS` 与 `middleware.py` 一致 | 对照代码 |
| 4 | 含 `api/v1/me.py` 锚点 | `rg 'api/v1/me.py' docs/services/auth.md` |
| 5 | `README.md` auth 行 `已实现` | 文档审查 |

---

### 4.4 子项 4 — BOOT-001~006 `docs/arch.md`

**文件**：`docs/arch.md`（§4.2 · §4.3 · §10）

| 段落 | 期望 |
|------|------|
| §4.2 | 鉴权委托 auth/；**AuthMiddleware 由 main.py 注册** |
| §4.3 | **M1 过渡布局**注记（AdminLayout · routes · `/admin`） |
| §10 | hub **124 项**（无 `118 项` 残留） |

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | §4.2 含 main.py 注册 AuthMiddleware | `rg 'main.py.*AuthMiddleware|AuthMiddleware 由 main.py' docs/arch.md` |
| 2 | §4.3 含 `M1 过渡布局` | `rg 'M1 过渡布局' docs/arch.md` |
| 3 | §10 含 `124 项` | `rg '124 项' docs/arch.md` |
| 4 | 无 `118 项` | `rg '118 项' docs/arch.md` 应无匹配 |
| 5 | 不重复 PRD 验收条款 | §4 无 BOOT 勾选列表 |

---

### 4.5 子项 5 — BOOT-001~006 `F01-BOOT.md` + plan 勾选闭环

**文件（P3）**：`docs/automate/prd/F01-BOOT.md`

| 项 | 期望 |
|----|------|
| BOOT-001~006 | 状态 `已实现`；验收全 `[x]` |
| BOOT-003 锚点 | `auth/middleware.py` + `main.py` 注册 + `api/v1/me.py` |

**文件（P5）**：`docs/automate/plan.md` §「M1 完成 — 文档回写」

将下列 4 行（行内描述**不改**）由 `[ ]` 改为 `[x]`，末尾附 `（完成于 YYYY-MM-DD）`：

```markdown
- [x] `docs/api/README.md`：…（完成于 YYYY-MM-DD）
- [x] `docs/services/core.md`、`auth.md`：…（完成于 YYYY-MM-DD）
- [x] `docs/arch.md`：…（完成于 YYYY-MM-DD）
- [x] `prd/F01-BOOT.md`：…（完成于 YYYY-MM-DD）
```

**P5 hub**：若完整度维有变化，同步 `prd.md` 修订记录；8 维分数重评可选（文档轮改善有限）。

**验收标准（可测试）**

| # | 标准 | 验证 |
|---|------|------|
| 1 | F01 六项 `已实现` | `rg '^\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md \| wc -l` = 6 |
| 2 | 验收无未勾 `[ ]` | `rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md` 无匹配 |
| 3 | plan §文档回写 4 行均为 `[x]` | `rg '^- \[x\]' docs/automate/plan.md` 在文档回写节计数 = 4 |
| 4 | M1 当前节 BOOT 6/6 + 文档回写 4/4 全勾 | 人工读 plan M1 节 |

## 5. 范围框定文件列表

| 路径 | 子项 | P3 操作 | P5 操作 |
|------|:----:|---------|---------|
| `docs/api/README.md` | 1 | 验证 | — |
| `docs/services/core.md` | 2 | 验证 | — |
| `docs/services/auth.md` | 3 | 验证 / 补 me.py 锚点 | — |
| `docs/services/README.md` | 2, 3 | 验证 | — |
| `docs/arch.md` | 4 | 验证 | — |
| `docs/automate/prd/F01-BOOT.md` | 5 | 验证 | — |
| `docs/automate/plan.md` | 5 | 只读 | 勾选 4 行 |
| `docs/automate/prd.md` | 5 | — | 条件修订记录 |

## 6. 非目标（明确不做）

| 项 | 原因 |
|----|------|
| 修改 `backend/` · `fe/` 生产代码 | round-target 纯文档；当前无漂移 |
| 新建/修改 `tests/` | STUCK 测试覆盖留人工复核 |
| 修改 `plan.md` 结构或非文档回写行 | SOP 红线 |
| M1B DATA-* | queued（`m1b_activation: after-M1-complete`） |
| META-001 / DESIGN-001 / CONN-021 | 远期 |
| 前端 UI | 不触及 `fe/` |
| 重复 PR #10 大段 api/arch 改写 | 最小 diff |

## 7. 与 PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮对齐方式 | 预期改善 |
|--------|-----------------|-------------|----------|
| BOOT-001 | 完整度 98% · 测试 86% | api `/health` 登记确认 | 完整度维持 |
| BOOT-003 | 完整度 98% · 测试 **78%** | auth 域 + api `/me`；PUBLIC_PATHS | 完整度维持；测试维**不本轮** |
| BOOT-004 | 完整度 98% · 架构 90% | core 锚点确认 | 完整度维持 |
| BOOT-002/005/006 | 测试 82–90% STUCK | F01 + arch 终检；plan 闭环 | 完整度 ↑；测试 STUCK 留后 |

**tie-break**：plan 强制文档回写为 M1 关闭前置；完整度为主攻击维；连续 4–6 轮 <90 的测试覆盖**明确排除**（round-target STUCK 标注）。

## 8. UI 设计交付

`ui_design_skill: none` — 本轮不触及 `fe/` 或前端 UI 文件；无「UI 设计交付」小节要求。

## 9. P4 验证命令

```bash
# API
rg '/health|/api/v1/me' docs/api/README.md

# services
rg '^\| 状态 \| \*\*已实现\*\*' docs/services/core.md docs/services/auth.md
rg 'api/v1/me.py' docs/services/auth.md
rg 'core.md|auth.md' docs/services/README.md

# arch
rg 'M1 过渡布局|124 项' docs/arch.md
test -z "$(rg '118 项' docs/arch.md)" || exit 1

# F01
test "$(rg -c '^\*\*状态\*\*：已实现' docs/automate/prd/F01-BOOT.md)" -eq 6
test -z "$(rg '^  - \[ \]' docs/automate/prd/F01-BOOT.md)" || exit 1

# plan（P5 后）
test "$(rg -c '^- \[x\].*docs/api/README' docs/automate/plan.md)" -ge 1
```

## 10. Spec Self-Review

- [x] 覆盖 round-target 全部 5 子项
- [x] 未超出范围框定（6+plan 只读/P5）
- [x] 无 TBD/TODO 占位
- [x] `ui_design_skill: none`
- [x] plan 非 prd-ID 勾选例外路径已写明
- [x] 禁止写生产代码
