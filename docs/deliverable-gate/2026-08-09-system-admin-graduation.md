# 产品可交付毕业判定 — 后台管理（`/admin/system/*`）+ 首租户分权闭环

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-09 |
| Skill | `~/.cursor/skills/product-deliverable-gate/` |
| Scope | **模块** · `/admin/system/*`（AUTH-001～008）+ **首租户场景**（向导→授权→分析员可见资源） |
| Companion | **不含** B-7 岗位模板 · 细粒度 `system:role.read` 拆菜单 · LDAP/OAuth 管理入口 |
| 判定 | **CONDITIONAL** |
| 加权总分 | **7.7 / 10** |

---

## 0. 范围与假设

- **Intake**：用户问「这部分是否可以交付」——上下文为 2026-08-09 系统管理 audit、首租户写闭环、browser-reviewer R2→R3 修复链。
- **边界**：`fe/src/pages/admin/system/**` · `/api/v1/{orgs,users,roles,resource-grants,rls,audit}` · 分权验收含 `dashboard:read` + 资源 grant 可见性（含 2026-08-09 `dashboard/acl.py` 修复）。
- **Truth 模式**：hybrid（读盘 `2026-08-07-system-admin-truth-audit.md` + 本回合 vitest 40/40 + browser R3 + API 抽样）。
- **签字延期**：无。

---

## 1. 合同清单

| 合同 ID | 来源 | 描述摘要 | plan 分期 |
|---------|------|----------|-----------|
| AUTH-001 | F02-AUTH | 角色注册与 Admin UI | M-FE-3 · F-B `[x]` |
| AUTH-002 | F02-AUTH | 组织树配置 | 一期 `[x]` |
| AUTH-003 | F02-AUTH | 用户角色绑定 + 生命周期 | M-FE-3 `[x]` |
| AUTH-004 | F02-AUTH | 资源授权 + 未授权不可见 | M-FINAL F-B `[x]` |
| AUTH-005 | F02-AUTH | RLS 维度类型 | 一期 `[x]` |
| AUTH-006 | F02-AUTH | 维度分组与角色关联 UI | M-DEPTH F-C `[x]` |
| AUTH-007 | F02-AUTH | RLS 谓词注入 | 一期 `[x]` |
| AUTH-008 | F02-AUTH | 操作审计日志 UI | M-DEPTH F-C `[x]` |
| B-7 岗位模板 | 蓝图演化 | 向导一键演示岗位 | **Out · companion** |
| O1 首租户闭环 | 剧本 optional | 分析员登录见授权资源 | 走查验收项 |

---

## 2. 完整度矩阵

| 合同 ID | 来源 | 状态 | plan | 证据摘要 | 备注 |
|---------|------|------|------|----------|------|
| AUTH-001 | F02-AUTH | IMPLEMENTED | `[x]` | `roles.smoke` · `test_auth_rbac_l1` | |
| AUTH-002 | F02-AUTH | IMPLEMENTED | `[x]` | `orgs.smoke` 4 条 · org API | |
| AUTH-003 | F02-AUTH | IMPLEMENTED | `[x]` | `users.smoke` 6+1 条 | 含解锁 |
| AUTH-004 | F02-AUTH | IMPLEMENTED | `[x]` | `test_auth_resource_acl_matrix.py` · `test_auth_user_override_enforcement.py` · dashboard/report ACL | 2026-08-24：用户例外授权接入执行链；报表 grant pytest 绿 |
| AUTH-005 | F02-AUTH | IMPLEMENTED | `[x]` | `rls` API · `test_auth_rbac_l1` T-AUTH-D* | |
| AUTH-006 | F02-AUTH | IMPLEMENTED | `[x]` | `RlsAdminPage` · `rls.smoke` | |
| AUTH-007 | F02-AUTH | IMPLEMENTED | `[x]` | `predicate.py` · `test_auth_rbac_l1` T-AUTH-RLS* | 后台仅配置面 |
| AUTH-008 | F02-AUTH | IMPLEMENTED | `[x]` | `AuditLogPage` · `audit.smoke` 4/4 | |
| B-7 岗位模板 | 蓝图 | DEFERRED | — | 无 UI | 非 PRD 硬验收 |
| O1 首租户闭环 | 走查 | **PARTIAL** | — | browser R3 · API 200 | 须在 **数据大屏** 路径验收 |

### 2.1 统计

| 状态 | 数量 | 占比（含 DEFERRED） |
|------|------|---------------------|
| IMPLEMENTED | 8 | 80% |
| PARTIAL | 1 | 10% |
| DEFERRED | 1 | 10% |
| MISSING | 0 | 0% |

**合同完整度分（0–10）**：**8.0** — 8 项合同 ID 无 MISSING；AUTH-004 / O1 因测试与验收路径未完全闭合标 PARTIAL。

### 2.2 合同 vs Truth 张力

| 合同 ID | 合同状态 | Truth 判定 | 说明 |
|---------|----------|------------|------|
| AUTH-001～003 | IMPLEMENTED | PARTIAL～REAL | truth T3～T5 多为 PARTIAL（GATE 控件） |
| AUTH-004 | PARTIAL | PARTIAL | PRD 勾「未授权不可见」；truth 未覆盖 dashboard ACL 链；2026-08-09 代码已补 |
| AUTH-006～008 | IMPLEMENTED | PARTIAL | T7/T8 GATE-only 行仍在 |
| O1 | PARTIAL | 原 E17 NONE → R3 部分 REAL | truth 审计日早于 R3，未回填 |

---

## 3. Truth 汇总（hybrid）

| 路径/模块 | 审计文档 | 日期 | 判定 | 分数 | GATE-only | 逐一校验 |
|-----------|----------|------|------|------|-----------|----------|
| `/admin/system/*` | `docs/feature-truth/2026-08-07-system-admin-truth-audit.md` | 2026-08-07 | PARTIAL | 7.2/10 | 5 实体 | **否** |
| 首租户真机 | `docs/material/browser-reviewer/2026-08-09-system-admin-walkthrough-r3.md` | 2026-08-09 | PARTIAL+ | — | — | O1 数据大屏 ✅ |
| 看板 grant ACL | *未入 truth 文档* | 2026-08-09 | **未审计** | — | — | API 手测 ✅ |

**本回合动态验证**

| 步骤 | 期望 | 实际 | 一致 |
|------|------|------|------|
| `npx vitest run src/pages/admin/system` | 40 passed | **40/40** | ✅ |
| `walkthrough_analyst` GET `/dashboards?surfaceKind=data-screen` | total≥1 | total=1 | ✅ |
| browser `/admin/data-screens` | 见授权大屏 | 「数字政府 KPI 驾驶舱」 | ✅ |
| truth §3d REAL 达标 | ≥90% 或逐一校验是 | 8/16 REAL；逐一校验否 | ❌ |

### 3.1 待跑 truth-verify

| 路径 | 原因 | 建议 |
|------|------|------|
| AUTH-004 dashboard grant 链 | `dashboard/acl.py` 新合入，truth 未更新 | `/feature-truth-verify` scope=system-admin + AUTH-004 dashboard |
| E17 首租户 | R3 已有 browser 证据，需回填 truth §4 | 更新 `2026-08-07-system-admin-truth-audit.md` 或新建 reverify |

**Truth 可用性分（0–10）**：**7.2** — 主路径 smoke 全绿 + R3 真机补强；但 **逐一校验仍为否**，dashboard ACL 无 formal truth 行。

---

## 4. Bug 与阻塞债

### 4.1 阻塞清单（毕业相关）

| ID | 优先级 | 来源 | 摘要 | 状态 | 解除条件 |
|----|--------|------|------|------|----------|
| GATE-T-01 | **P1** | truth §3d | 关键路径 **逐一校验：否**（5 GATE-only + 2 NONE） | OPEN | truth reverify → 逐一校验是 或 REAL≥90% |
| GATE-AUTH4-01 | **P1** | AUTH-004 · R3 | 仪表板 grant 可见性缺 backend pytest | OPEN | `test_auth_rbac` 或 dashboard list ACL 单测 |
| GATE-O1-01 | P2 | browser R3 | O1 剧本若只验 `/admin/dashboards` 会误判失败 | OPEN | 剧本改 `/admin/data-screens` 或改授权资源类型 |
| GATE-UI-01 | P2 | R2 写闭环 | 角色权限 UI 保存可能未落库（自动化/API 已绕过） | OPEN | 复现并修 `RolePermissionsPanel` 或保存 API 契约 |
| GATE-DEMO-01 | P2 | R1/R3 | 组织树 61 节点含 `RLS Bind Org*` 测试噪声 | OPEN | 清理 demo 库或走查专用 seed |
| B-7 | P2 | 蓝图 G2 | 岗位模板未做 | DEFERRED | 用户 explicit 纳入 scope |

### 4.2 签字延期

无。

### 4.3 已闭合（本迭代）

| ID | 摘要 | 证据 |
|----|------|------|
| P1-R2-01 | `demo_analyst` 无 `dashboard:read` | API version 2 已写入 |
| P1-R2-02 | 看板列表未接 grant | `dashboard/acl.py` + API total=1 |
| G6 | 侧栏双高亮 | `app-sidebar.tsx` 最长路径匹配 |

**Bug 清零度分（0–10）**：**7.8** — 无 scope 内未签字 **P0**；2 条 **P1** 阻塞 formal Go。

---

## 5. 毕业判定

| 维度 | 得分 | 权重 | 加权 |
|------|------|------|------|
| 合同完整度 | 8.0 | 30% | 2.40 |
| Truth 可用性 | 7.2 | 35% | 2.52 |
| Bug 清零度 | 7.8 | 25% | 1.95 |
| 可交付文档 | 8.0 | 10% | 0.80 |
| **合计** | — | — | **7.7 / 10** |

**判定**：**CONDITIONAL**

**一句话**：后台管理主路径与首租户分权闭环**已达内测/演示可交付**；因 truth **逐一校验未过**、AUTH-004 仪表板链**缺自动化验真**，**不宜标 Go（正式毕业）**。

### 5.1 Go 阻塞项

1. **truth §3d 逐一校验：否** — 硬触发，不得 Go。
2. **AUTH-004 dashboard grant** — 功能已修（2026-08-09），须补 truth/pytest 后方可与 PRD「未授权不可见」对齐为 IMPLEMENTED。
3. **O1 验收路径** — 演示交付须在剧本/手册中写明「授权 data-screen → 验数据大屏」。

### 5.2 Conditional 解除条件（满足后可复跑 gate → Go）

- [ ] `/feature-truth-verify` 更新 system-admin 审计（含 dashboard ACL + R3 首租户）
- [ ] backend 增加 dashboard list + grant 可见性 pytest（≥1 条）
- [ ] `.dev/playbooks` O1 路径对齐 `surface_kind`
- [ ] （可选）角色权限 UI 保存落库复现修复

---

## 6. 交接清单

| 缺口 | 优先级 | 交接 Skill | 说明 |
|------|--------|------------|------|
| truth 回填 | P1 | `feature-truth-verify` | dashboard ACL + E17 browser 证据 |
| dashboard ACL 单测 | P1 | implement + pytest | `backend/app/dashboard/acl.py` |
| 剧本 O1 | P2 | `scenario-playbook` | `/admin/data-screens` |
| 权限保存 UI | P2 | `root-first-solve` | 写闭环权限未落库根因 |
| 演示数据清理 | P2 | seed/运维 | 组织树噪声 |
| 岗位模板 | P3 | `go-fast` 切片 | B-7 optional |

---

## 7. 验证命令（复现）

```bash
# FE system-admin smoke
cd fe && npx vitest run src/pages/admin/system

# API：分析员可见授权大屏
cd backend && python -c "
import requests
B='http://localhost:8000/api/v1'
t=requests.post(f'{B}/auth/login',json={'username':'walkthrough_analyst','password':'Walkthrough1'}).json()['accessToken']
h={'Authorization':f'Bearer {t}'}
print('perms', requests.get(f'{B}/me',headers=h).json().get('permissions'))
print('screens', requests.get(f'{B}/dashboards?surfaceKind=data-screen',headers=h).json().get('total'))
"
```

---

## 8. 元信息

- **用户批准修复**：否（本 skill 默认只报告；代码修复来自前序会话）
- **关联 truth**：`docs/feature-truth/2026-08-07-system-admin-truth-audit.md`
- **关联 PRD**：`docs/automate/prd/F02-AUTH.md` AUTH-001～008
- **关联走查**：`docs/material/browser-reviewer/2026-08-09-system-admin-walkthrough-r3.md`
- **关联蓝图**：`docs/material/blueprints/2026-08-09-system-admin-audit.md`
