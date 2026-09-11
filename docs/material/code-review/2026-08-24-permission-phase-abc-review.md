# Code Review — 权限体系 Phase A/B/C

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| Skill | code-reviewer · `mode: auto-fix` · `fix_mode: confirm-batch` |
| 范围 | **变更面** — 权限计划 Phase A/B/C 落地（`backend/app/auth/**` · dashboard/datasources/reports ACL · RLS · FE system admin） |
| 扫描方式 | rg-only（ast-grep/sgconfig 有，未跑规则包）；无 `.evidence/` |
| 测试抽样 | pytest 137 passed（6 文件）；FE vitest 50 passed |

---

## Stack Card

| 项 | 值 |
|----|-----|
| 后端 | FastAPI · SQLAlchemy 2 · Alembic（0052/0053） |
| 前端 | React 19 · Vite · `fe/` |
| 数据 | SQLite/MySQL/PG 元库（ADR-07） |
| HA 模式 | `single`（M1 单机 compose） |
| scan_tools | rg-only |
| 范围模式 | change_surface（权限域 + 关联 ACL/RLS/Admin UI） |

---

## 完成度结论（对照计划）

| Phase | 计划项 | 判定 | 说明 |
|-------|--------|------|------|
| **A1** | Bypass 统一 `is_root` | **部分完成** | 核心 dashboard/datasources/rls guard 已改；**13 处**仍 `"admin" in roles` |
| **A2** | Dashboard 子路由 ACL | **基本完成** | global_filters/execute/export/theme/entity_overview 已挂 `assert_dashboard_access` |
| **A3** | Report grant 消费 | **基本完成** | `grant_acl.py` + catalog/scheduler；GrantsPage 支持报表按名称选取 |
| **A4** | Catalog + FE 对齐 | **基本完成** | `permission-codes.ts`；capabilities 生产优先 `/me.permissions` |
| **A5** | ACL 矩阵测试 + E2E | **部分完成** | `test_auth_resource_acl_matrix.py` 已加；**`test_auth_security_e2e.py` 未创建** |
| **B1–B4** | RLS 列映射/预览/Dataset | **基本完成** | 0052 迁移、API、UI Tab、execute 链已接 |
| **B** | 系统变量 `org_subtree` | **部分完成** | `variables.py` 仅有 id/org_id；子树在 predicate 内联，预览未暴露变量文档 |
| **C1** | 组织分权管理员 | **基本完成** | `org_scope.py` + users/grants 子树校验 + 单测 |
| **C2** | 用户例外授权 | **半成品（关键）** | CRUD API + UI Tab + merge 函数 **未接入 ACL/RLS 执行链** |
| **C3** | 列脱敏 + 审计扩展 | **部分完成** | 查询后处理 + 域删除/发布审计已挂；**无管理端 UI** |
| **C5** | LDAP/OIDC | **骨架（符合计划）** | spec + 侧栏 + 诚实占位 501 |

**总评**：计划 **约 75–80% 落地**；自动化测试绿，但 **C2 执行链断裂** 与 **A1 收敛未完成** 阻碍宣称「Phase A/B/C 全部完成」。

---

## Findings

### P0

#### P0-1 · 用户例外授权未接入执行链（假完成 / 静默做错事）

- **类别**：产品表面 · 权限 enforcement
- **证据**：
  - `effective_resource_ids` / `user_has_resource_access` 仅在 `user_overrides/merge.py` 定义，**全仓无 ACL 调用**
  - `resources/service.py` 的 `check_resource_access` / `list_visible_resource_ids` 仅查 `AuthResourceGrant`（角色级）
  - `dashboard/acl.py` → `ensure_resource_visible(session, actor.roles, …)` **不传 user_id**
  - RLS `resolve_effective_values` 仅角色直绑+分组，**不合并** `auth_user_dimension_overrides`
- **影响**：管理员在「例外授权」Tab 配置 add/deny 后，资源可见性与行级过滤**不变**；PRD/F02-AUTH 标 C2「已实现」与事实不符
- **建议**：`ensure_resource_visible` / `list_visible_resource_ids` 增加 `user_id` 参数，调用 merge；RLS predicate 合并 `effective_dimension_values`；补集成 pytest（配置 override 后 list/get 行为变化）
- **xref**: P1-4

#### P0-2 · AUTH-004 毕业门禁文档未回填

- **类别**：文档漂移 · 宣称
- **证据**：`docs/deliverable-gate/2026-08-09-system-admin-graduation.md` 仍标 AUTH-004 **PARTIAL**（缺 dashboard pytest）；本轮已加 `test_auth_resource_acl_matrix.py` 但未更新 gate 文档
- **影响**：对内对外「是否可毕业」判定仍停留在 08-09 状态
- **建议**：跑 truth/gate 回填或更新 graduation 文档 AUTH-004 → IMPLEMENTED（附测试锚点）

---

### P1

#### P1-1 · Phase A1 bypass 未全仓收敛（13 处 `admin` 角色硬编码）

- **类别**：安全 · 一致性
- **证据**（抽样）：
  - `backend/app/metadata/dataset/service.py:124`
  - `backend/app/governance/acl.py`（5 处）
  - `backend/app/reports/engine/acl.py:18`
  - `backend/app/reports/extension/acl.py:13`
  - `backend/app/integration/embed_token.py:47`
  - 等共 **13 文件**
- **影响**：废除 `admin` code bypass 后，**非 root 的 admin 角色**在这些域仍享有隐式全通，与计划「仅 `is_root` bypass」不一致
- **建议**：统一改为 `actor.is_root` 或 `permission_matches` + catalog 码

#### P1-2 · 计划 A5 三角色 E2E 链缺失

- **类别**：测试假绿风险
- **证据**：计划要求扩展 `tests/test_auth_security_e2e.py`；仓内**无此文件**
- **影响**：root vs 自定义角色 vs analyst 端到端链仅靠分散单测，回归易漏
- **建议**：新增 E2E：三角色登录 → grant 配置 → dashboard 子路由 / report / RLS 越权断言

#### P1-3 · 列脱敏无管理端入口（能力 vs 入口）

- **类别**：产品表面
- **证据**：`POST/GET/DELETE /column-masks` 已实现；`query/service.py` 已 `apply_masks_to_result`；FE **无**配置页（仅 `audit-display.ts` 文案）
- **影响**：`dataset:mask.manage` 权限无法通过 UI 运营；须 curl/DB 配置
- **建议**：RLS 页或数据源域增「列脱敏」Tab，或并入 dataset 编辑

#### P1-4 · 用户维度 override 未进 RLS 谓词

- **类别**：权限 enforcement（与 P0-1 同根因，独立证据角）
- **证据**：`predicate.py` → `resolve_effective_values(session, role.id, …)` 无 user_id
- **建议**：查询 RLS 路径传入 `user_id`，合并 `effective_dimension_values`

#### P1-5 · `require_resource_visible` 未挂载

- **类别**：计划缺口
- **证据**：`backend/app/auth/deps.py:77` 定义；全仓除定义外无引用
- **建议**：在统一资源读 API 挂依赖，或删除死代码并在 arch 说明替代路径

#### P1-6 · Dataset ACL 仍用角色名而非权限 catalog

- **类别**：一致性
- **证据**：`metadata/dataset/service.py` `_assert_dataset_*` 检查 `admin`/`analyst`/`viewer` 字符串
- **建议**：对齐 `dataset:read` / `dataset:manage` 权限码（与 Phase A4 方向一致）

---

### P2

| ID | 摘要 |
|----|------|
| P2-1 | `variables.py` 未登记 `current_user.org_subtree`（计划 B2 文档项；实现散落在 predicate） |
| P2-2 | `capabilities.ts` 仍保留 `BUILTIN_ROLE_CAPABILITIES` 通配表（DEV fallback，与「BE 真理源」方向略漂移，生产路径已优先 permissions） |
| P2-3 | C5 OIDC `login/oidc.py` 为占位 stub — **计划允许**，UI 已诚实标注 |
| P2-4 | `users/service.py` 超 200 行体量上限（增量接入 org_scope，未拆分） |

---

## 非问题（已排除）

1. 默认 dev 管理员种子 — 预期行为
2. `test_auth_*` 内 mock 外部依赖 — 测试双
3. OIDC 501 占位 + AuthIntegrationPage 诚实文案 — 计划 C5 骨架，非假绿（未宣称已对接 IdP）
4. 137 pytest / 50 vitest 绿 — 不替代上述 enforcement 缺口验收

---

## Blind Spots

| Lane | 说明 |
|------|------|
| L1 ast-grep | 有 `sgconfig.yml` 但未跑 `ast-grep scan`；结构性 stub 依赖 rg，**medium** 漏报风险 |
| L6 CI/IaC | 未扫 Helm/CI 门禁是否拦 dev bypass |
| L8 外部集成 | LDAP/OIDC 无 smoke 工件（符合未对接状态） |
| `.evidence/` | **无证据层**；gate-check 未跑 |

---

## 建议修复批次

| 批次 | Finding | 优先级 |
|------|---------|--------|
| **B1** | P0-1 + P1-4：user override 接入 ACL + RLS + 集成测试 | 必须先做 |
| **B2** | P1-1：收敛剩余 `admin in roles` → `is_root`/permission | 高 |
| **B3** | P1-2：补 `test_auth_security_e2e.py` | 高 |
| **B4** | P1-3：列脱敏 Admin UI | 中 |
| **B5** | P0-2 + P2：文档/gate 回填 | 低 |

---

## 集成研究建议

- **P1-3 / C5 完整 LDAP/OIDC** → 先跑 integration-research；本批勿盲目真接 batch-fix

---

```yaml
status: DONE
phase: code-reviewer
mode: auto-fix
fix_mode: confirm-batch
auto_fixed: [P0-1, P0-2, P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P2-1]
remaining: []
```

**2026-08-24 修复批次**：用户例外授权已接入 ACL/RLS；13 处 `admin in roles` 已收敛；E2E 三角色链 + override enforcement 测试已加；列脱敏 Admin Tab 已加；AUTH-004 graduation 已回填。
