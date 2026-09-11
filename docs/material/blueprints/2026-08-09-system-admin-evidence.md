# 证据袋 · 后台管理（`/admin/system/*`）

```yaml
scope: 后台管理模块（配置向导 / 组织 / 用户 / 角色 / 资源授权 / RLS / 审计）
scanned_at: 2026-08-09
domain_strength: strong
selection_constraints:
  - id: S1
    topic: 后台管理入口与路由守卫使用 system:* 粗粒度能力
    hard_reverse: true
    status: anchored
    evidence: [E3, E4, E5]
    blocks_flows: [F1]
    action: none
  - id: S2
    topic: 细粒度 system:role.read 等拆菜单（未来）
    hard_reverse: true
    status: assumed
    evidence: [E12]
    blocks_flows: []
    action: assume
  - id: S3
    topic: 首租户无预置岗位模板（可选导入，非自动加载）
    hard_reverse: false
    status: anchored
    evidence: [E2, E8]
    blocks_flows: [F1]
    action: none
items:
  - id: E1
    path: docs/automate/prd/F02-AUTH.md
    kind: prd
    note: AUTH-001~008 验收与代码锚点
  - id: E2
    path: docs/automate/goal.md
    kind: prd
    note: G4 零预置业务场景包
  - id: E3
    path: docs/ui/layout.md
    kind: ui
    note: §后台管理 IA、system:*、路由表
  - id: E4
    path: docs/services/auth.md
    kind: domain
    note: auth 域 In/Out、RLS/审计边界
  - id: E5
    path: fe/src/config/system-admin-nav.tsx
    kind: code
    note: 侧栏七路由 + 向导首页
  - id: E6
    path: fe/src/pages/admin/system/
    kind: code
    note: 各管理页实现
  - id: E7
    path: docs/material/product-reviewer/2026-07-31-system-admin-r3.md
    kind: spec
    note: 八维 75 分、刺点 B-1~B-12
  - id: E8
    path: docs/feature-truth/2026-08-07-system-admin-truth-audit.md
    kind: spec
    note: truth-verify 40 smoke、缺口清单
  - id: E9
    path: fe/src/lib/nav-active.ts
    kind: code
    note: 侧栏最长路径 active（2026-08-09 修复多选高亮）
  - id: E10
    path: docs/api/README.md
    kind: api
    note: orgs/users/roles/grants/rls/audit 契约索引
  - id: E11
    path: fe/src/pages/admin/system/**/*.smoke.test.tsx
    kind: code
    note: 40 passed（2026-08-09 回归）
  - id: E12
    path: docs/superpowers/plans/2026-07-13-permission-security-production-core.md
    kind: spec
    note: 未来细粒度 permission-codes 规划（未全量落地 UI）
gaps:
  - 真机首租户 scenario-playbook 未跑（H1）
  - 岗位模板一键导入仍 open（B-7，产品 optional）
  - 细粒度 RBAC 菜单未拆（H2，分期）
  - 运营队列：无组织用户/无权限角色告警（P2）
```
