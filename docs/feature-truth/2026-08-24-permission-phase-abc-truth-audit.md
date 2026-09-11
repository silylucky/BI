# Feature Truth Audit: 权限体系 Phase A/B/C 完成度

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-24 |
| 核验范围 | AUTH-001～008 + Phase A/B/C 计划对账（`F02-AUTH.md` §Phase C） |
| 锚点 | `/admin/system/*` · `/api/v1/{roles,users,orgs,resource-grants,rls,column-masks,audit,users/*/resource-grants}` |
| 总体判定 | **PARTIAL+**（Phase A/B/C 可毕业；C5 除外） |
| **总分 / 档位** | **9.0 / 10 · A-** |
| 状态 | verified（O1 2026-08-25） |
| **sampling** | `full`（合同 12 项全枚举；FE 按 9 管理页 + Rls 5 Tab 下钻） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 角色/组织/用户 CRUD + 权限码绑定可运营 | AUTH-001～003 · PRD |
| T2 | 资源 grant 控制 dashboard/datasource/report 可见；子路由不可 IDOR | AUTH-004 · Phase A |
| T3 | RLS 维度/分组/列映射可配置；查询注入谓词 | AUTH-005～007 · Phase B |
| T4 | 权限变更与域删除可审计 | AUTH-008 · Phase C3 |
| T5 | 组织范围管理员仅管子树用户/授权 | C1 |
| T6 | 用户例外授权 ± 覆盖角色默认且运行时生效 | C2 |
| T7 | 列脱敏配置后查询结果掩码 | C3 |
| T8 | LDAP/OIDC 规格门 + 管理入口（骨架） | C5 · spec |
| T9 | 仅 `is_root` bypass 资源 ACL/RLS | Phase A1 · `auth/bypass.py` |

- 非目标：LDAP/OIDC 真联调（C5 明确骨架）、Playwright 全站 E2E、MFA/多租户

## 2. 完整链路图（摘要）

```
Admin UI → apiFetch → FastAPI + require_permission → domain service
  → auth/resources|rls|user_overrides|masking → DB (Alembic 0052/0053)
  → 查询链 query/service + rls/guard → 结果 mask 后返回
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | FE 路由/守卫 | 通 | `routes.tsx` · `permission-codes.ts` · vitest **57/57** |
| 2 | API 鉴权 | 通 | `test_auth_rbac_l1.py` 122 passed |
| 3 | 资源 ACL + override | 通 | `test_auth_resource_acl_matrix.py` · `test_auth_user_override_enforcement.py`（含维度 RLS） |
| 4 | RLS 列映射/预览 | 通 | `test_auth_rls_column_bindings.py` · `rls.smoke` T-RLS-04 |
| 5 | 列脱敏后处理 | 通 | `test_auth_column_masks.py` 3 passed（含 query 全链） |
| 6 | LDAP/OIDC 登录 | 断（占位） | `login/oidc.py` → 501 |
| 7 | 首租户真机走查 | **已验** | O1 browser 2026-08-25（见 §4 步骤 9） |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 角色/组织/用户 | **REAL** | 8.5/B+ | rbac_l1 + roles/orgs/users smoke |
| T2 | 资源 ACL | **REAL** | 8.0/B | acl matrix + override enforcement |
| T3 | RLS 产品化 | **REAL** | 8.0/B+ | 列映射 CHAIN + `rls.smoke` T-RLS-04/05 |
| T4 | 审计 | **REAL** | 8.0/B | audit smoke + write_hooks 扩展 |
| T5 | 组织分权 | **REAL** | 7.5/B | `test_auth_org_scoped_admin.py` 3 passed |
| T6 | 用户例外 | **REAL** | 8.0/B+ | 资源链 + 维度 RLS e2e + `users.smoke` T-AUTH-C2-01 |
| T7 | 列脱敏 | **REAL** | 8.0/B+ | mask service + `execute_query` 全链 + `rls.smoke` T-RLS-05 |
| T8 | LDAP/OIDC | **STUB** | 4/D | 诚实骨架；不可标 REAL |
| T9 | is_root bypass | **REAL** | 8.5/B+ | rg 零 `"admin" in roles`；bypass.py |

## 3b. 前端控件下钻（管理面关键增量）

| ID | 文案/位置 | 期望 | 实际 | L | C | 判定 | 证据 |
|----|-----------|------|------|---|---|------|------|
| B1 | Rls「列映射」Tab | 可 CRUD + 预览 | vitest T-RLS-04 POST mock | 2 | 2 | **REAL** | `rls.smoke.test.tsx` |
| B2 | Rls「列脱敏」Tab | 可 CRUD mask | vitest T-RLS-05 POST mock | 2 | 2 | **REAL** | `rls.smoke.test.tsx` |
| B3 | 用户「例外授权」Tab | PUT resource/dimension override | vitest T-AUTH-C2-01 PUT mock | 2 | 2 | **REAL** | `users.smoke.test.tsx` |
| B4 | 「认证集成」页 | 展示 LDAP/OIDC 未启用 | 静态 Badge；无联调 | 2 | 2 | **REAL（骨架）** | `AuthIntegrationPage.tsx` |
| B5 | Grants 报表选取 | 按名称选 report 节点 | vitest T-AUTH-004-FE-07 + browser 报表选项 | 2 | 2 | **REAL** | `grants.smoke` |

已有 smoke 页（roles/orgs/users/grants/rls 全 Tab/audit/platform）：**REAL @ UI**（57/57 vitest）。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| AUTH-001 | 角色 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | rbac_l1 R* · roles.smoke |
| AUTH-002 | 组织 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | rbac_l1 O* · orgs.smoke |
| AUTH-003 | 用户 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | rbac_l1 U* · users.smoke |
| AUTH-004 | 资源授权 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | acl matrix · grants.smoke |
| AUTH-005 | 维度类型 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | rbac_l1 D* · rls.smoke T-RLS-02/03 |
| AUTH-006 | 维度分组/角色绑定 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | rls.smoke Tab 切换 |
| AUTH-007 | RLS 注入+列映射 | ✅ | ✅ | ✅ | CHAIN | 2 | 2 | REAL | col bindings pytest · rls.smoke T-RLS-04 |
| AUTH-008 | 审计 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | audit.smoke |
| C1 | 组织范围管理 | ✅ | ✅ | ✅ | CHAIN | 2 | 2 | **REAL** | org_scoped pytest · users/grants smoke C1 |
| C2 | 用户例外授权 | ✅ | ✅ | ✅ | CHAIN | 2 | 2 | REAL | override enforcement + 维度 RLS · users.smoke |
| C3 | 列脱敏+域审计 | ✅ | ✅ | ✅ | CHAIN | 2 | 2 | REAL | mask service + query 全链 · rls.smoke T-RLS-05 |
| C5 | LDAP/OIDC | ✅ | ❌ | ✅ | GATE | 1 | 1 | STUB | spec + 501 占位 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **12** |
| CHAIN 绿 | **11** |
| UI smoke 绿 | **12**（含 C1 + report picker） |
| GATE only | **1**（C5） |
| NONE（未验 UI） | **0** |
| REAL 达标 | **11 / 12** |
| **逐一校验** | **否** — 仅 C5 STUB（计划内 LDAP/OIDC） |
| 总体可否 REAL | **Phase A/B/C 可毕业** — 除 C5 外 11/11 REAL |

## 3c. 五维评分汇总（合同级）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| AUTH-001～003,008 | 2 | 2 | 2 | 2 | 1 | 9 | A- | REAL |
| AUTH-004,006 | 2 | 2 | 2 | 2 | 1 | 8.5 | B+ | REAL |
| AUTH-007,C1,C2,C3 | 2 | 2 | 2 | 2 | 1 | 8.5～9 | A- | REAL |
| C5 | 1 | 1 | 2 | 1 | 1 | 4 | D | STUB |

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致 |
|------|------|------|------|------|
| 1 | `pytest` 9 个 auth 专项文件 | 全绿 | **154 passed** | ✅ |
| 2 | `vitest run src/pages/admin/system` | 全绿 | **57 passed** | ✅ |
| 3 | `rg "admin" in roles` backend | 0 命中 | **0** | ✅ |
| 4 | override add 后 dashboard ACL | 可见 | `test_user_override_add_visible_in_acl_chain` PASS | ✅ |
| 5 | override deny 后 dashboard ACL | 不可见 | `test_user_override_deny_blocks_acl_chain` PASS | ✅ |
| 6 | 三角色安全链 | root bypass / grant / 403 | `test_auth_security_e2e.py` 3 PASS | ✅ |
| 7 | OIDC callback 未配置 | 501 | `ExternalAuthNotConfiguredError` | ✅（骨架预期） |
| 8 | 列映射/列脱敏 Tab vitest | 有下钻 | T-RLS-04/05 PASS | ✅ |
| 9 | 首租户 browser O1 | 管理面关键路径可访问 | **2026-08-25 PASS**（见下） | ✅ |

**O1 走查记录（2026-08-25 · `localhost:5173` + `:8000`）**

| 步骤 | 路径/操作 | 结果 |
|------|-----------|------|
| O1-1 | `/admin/system` 配置向导 | ✅ 基础 3/3 完成 |
| O1-2 | `/admin/system/rls` → 列映射 | ✅ 「新建列映射」可见 |
| O1-3 | `/admin/system/rls` → 列脱敏 | ✅ 「新建脱敏规则」可见 |
| O1-4 | `/admin/system/grants` → 新建授权 → 资源类型 | ✅ 含「报表」+ picker |
| O1-5 | `/admin/system/users` → 管理 → 例外授权 | ✅ 表单与「添加例外授权」 |
| O1-6 | `/admin/system/auth-integration` | ✅ C5 骨架文案诚实展示 |

## 5. 修复文档（P1，非 P0）

### P1-A～D — **已闭合**（2026-08-24）

| ID | 状态 | 证据 |
|----|------|------|
| P1-A | ✅ | `rls.smoke.test.tsx` T-RLS-04/05 |
| P1-B | ✅ | `users.smoke.test.tsx` T-AUTH-C2-01 |
| P1-C | ✅ | `test_dimension_override_deny_*` in `test_auth_user_override_enforcement.py` |
| P1-D | ✅ | `test_execute_query_applies_column_masks` in `test_auth_column_masks.py` |

### P1-F～H — **已闭合**（2026-08-25）

| ID | 状态 | 证据 |
|----|------|------|
| P1-F C1 FE smoke | ✅ | `users.smoke` T-AUTH-C1-01/03 · `grants.smoke` T-AUTH-C1-02 |
| P1-G B5 report picker | ✅ | `grants.smoke` T-AUTH-004-FE-07 |
| P1-H O1 browser | ✅ | §4 步骤 9 走查表 |

附：`grantErrors`/`userErrors` 补 `ORG_SCOPE_FORBIDDEN` 人话映射；`grants.smoke` mock 改为 `importOriginal` 保留 `ApiRequestError`。

### P1-E — C5 LDAP/OIDC（非 bug）

**判定**：STUB（计划内）  
**说明**：不可标 REAL；须 spec gate + integration-research 后单独立项  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| ~~P1~~ | ~~P1-A/B/C/D/F/G/H~~ | **已闭合** |
| P2 | C5 | LDAP/OIDC 真联调（单独立项，spec gate 后） |

## 7. 交接

- **结论**：Phase A/B/C **已毕业**（11/11 REAL + O1 走查）；**唯一未交付项为 C5 LDAP/OIDC 真实现**（骨架已诚实标注 STUB）。
- 文档：`docs/material/code-review/2026-08-24-permission-phase-abc-review.md`（修复已合入）
