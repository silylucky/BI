# 刁钻产品评审 · 后台管理（`/admin/system/*`）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | 头像菜单「后台管理」→ `/admin/system/{roles,users,grants,rls,orgs,audit}` 全模块 |
| 角色假设 | **平台管理员**（持有 `system:*`，负责开户、角色、资源可见性与审计）；次要：**安全审计员**（只读追溯） |
| 证据 | 代码走查（路由、页面、API 契约、PRD F02-AUTH）；**未真机** |
| 轮次 | r1 |
| 上轮报告 | — |
| 总分 | **63** / 100（本轮独立评分） |
| 较上轮 Δ | — |
| 结论 | **勿扩功能先还债**（RBAC 主链路未在产品面闭环，RLS 绑定存在静默清空风险） |
| 硬门槛 | **命中 2 条**（挂 B-1、B-2） |

## Review Card

- **主 JTBD**：租户 IT/数据管理员在平台内完成「组织 → 角色与权限 → 用户归属 → 资源授权 → 行级策略 → 可审计」的闭环配置，使业务用户登录后只能看到该看的。
- **成功长什么样**：新建分析师角色 → 勾选 `dashboard:read` 等权限 → 创建用户并绑定组织与角色 → 授权可见仪表板 → 配置 RLS 分组 → 用户在分析菜单只看到授权内容；任何变更可在审计日志还原「谁、何时、改了什么」。
- **最贵失败**：RLS 角色绑定被误保存为空导致全员数据范围放大/缩小；角色无权限却绑了资源授权造成「能进菜单但全 403」；审计查不到责任人。
- **未真机**：是（基于源码与 smoke 测试推演主路径）

## 执行摘要（刁钻口吻，短）

- **最锋利的三刺**：① RLS「角色绑定」页不加载已有绑定，空勾选 + 保存 = 全量清空；② 后端已有 `GET/PUT /roles/{id}/permissions` 与权限目录 API，前端零入口——后台管理名不副实；③ 资源授权要手填 UUID，管理员必抄控制台。
- **唯一值得先修的主线**：**信任链**——先让「看见的状态 = 库里的状态」（RLS 绑定 GET、角色权限矩阵），再谈资源选择器与组织用户联动。
- **不该再加的功能**：在权限矩阵缺失时再堆「高级策略向导」或新菜单分组；会把半成品伪装成完整 RBAC。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 72 | 六页覆盖 AUTH-001～008 主域，但「配权限」这一核心价值只能在 API 完成（`roles.py` 有 permissions 端点，`RoleListPage` 无 UI） |
| 2 主路径锋利 | 65 | 入口固定到角色列表（`SYSTEM_ADMIN_HOME_PATH`），但完整开户需跨 4～5 页且无引导；资源授权卡在 UUID 手填（`GrantsDialogs.tsx`） |
| 3 例外与逆操作 | 58 | RLS 全量替换有文案提示，但未加载现态时「保存」等同误删；用户无停用/删号；组织树仅可新建不可改删 |
| 4 角色与权责 | 70 | 路由与侧栏均 `system:*` 守卫（`routes.tsx` · `resolve-nav.ts`）；审计详情可还原操作者（`AuditDetailSheet`）；页内未区分只读审计员 |
| 5 认知与决策点 | 62 | 角色弹窗混「元数据 + 默认看板」却无「权限」Tab；授权列表只显示 `resourceId` 截断；RLS 三 Tab 术语门槛高 |
| 6 状态与信任 | 40 | **硬门槛**：`RlsRoleBindingPanel` 注释写明「无 GET 时以空选起步」，而后端已有 `GET /roles/{id}/dimension-groups`——界面状态与真实绑定不一致 |
| 7 可发现与采用 | 60 | 能力藏在头像菜单（`user-dropdown.tsx`），空态有部分 CTA；缺「首租户 RBAC 清单」式引导 |
| 8 可运营与可度量 | 75 | 审计日志筛选 + 详情 + 动作中文化较完整（`AuditLogPage` · `audit-display.ts`）；缺「无组织用户/无权限角色」运营队列 |
| **总分** | **63** | 算术平均；硬门槛命中 → 结论不得「可规模化推广」 |

## 硬门槛

每条命中项挂刺点 ID：

- [x] **B-1**：成功反馈与真实结果不一致 / 状态表面不诚实 — RLS 角色绑定 UI 不展示已绑定分组，保存 toast「已绑定」可能掩盖清空
- [x] **B-2**：主任务依赖内部约定 — 角色权限、用户组织、重置密码等后端已就绪，产品面无入口，管理员需懂 API 或数据库

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 是 | 否 | 选角色后勾选列表始终从空开始 | 「我打开绑定页怎么全是空的？点保存后别人突然看不了数据了」 | `fe/src/pages/admin/system/rls/RlsRoleBindingPanel.tsx`（无 GET）；`backend/app/api/v1/roles.py` `GET /{role_id}/dimension-groups` |
| B-2 | 1 | P0 | 是 | 否 | 角色 CRUD 无权限矩阵 | 「后台管理连权限都配不了，还要我找研发调接口？」 | `RoleListPage.tsx`；`GET/PUT /api/v1/roles/{id}/permissions`；`GET /api/v1/permissions` |
| B-3 | 2 | P0 | 否 | 否 | 新建授权需手填资源 UUID | 「我去哪抄这一长串 ID？配错了还要猜」 | `fe/src/pages/admin/system/grants/GrantsDialogs.tsx` `grant-resource-id` |
| B-4 | 2 | P1 | 否 | 否 | 用户页仅用户名 + 角色，无组织/资料/改密 | 「组织树建了，用户怎么挂上去？」 | `UserListPage.tsx`；`users.py` `PUT /{user_id}/org` · `POST /reset-password` |
| B-5 | 3 | P1 | 否 | 否 | 组织树只读展示 + 新建，无编辑删除 | 「写错部门名只能找 DBA？」 | `OrgTreePage.tsx`（无 PUT/DELETE 调用） |
| B-6 | 6 | P1 | 否 | 否 | 角色「启用/停用」筛选仅过滤当前页 | 「显示 2 个但一共 50 个角色，到底几个停用了？」 | `RoleListPage.tsx` `filteredItems` 客户端过滤 + 服务端分页 |
| B-7 | 7 | P1 | 否 | 否 | 后台管理入口仅在头像菜单 | 「新接手的管理员找了半天权限在哪」 | `user-dropdown.tsx` · `docs/ui/layout.md` §3 |
| B-8 | 3 | P2 | 否 | 否 | RLS 维度类型列表无编辑/删除入口 | 「建错维度只能堆垃圾数据」 | `RlsAdminPage.tsx` dimensions Tab 只读表 |
| B-9 | 5 | P2 | 否 | 否 | 角色表单同时承载默认看板/报表模板 | 「改个名字为什么要懂 Dashboard ID？」 | `RoleListPage.tsx` 编辑弹窗 |
| B-10 | 7 | P2 | 是 | 是 | 资源授权页布局与其它列表页不一致 | 纯壳层不统一，加重「这块像后补的」感受 | `GrantsPage.tsx` vs `RoleListPage.tsx` `ListPageSection` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | verified | GET 回填 + 清空确认 | `RlsRoleBindingPanel.tsx` · `RlsRoleBindingPanel.smoke.test.tsx` | r2 再评确认 | — | 2026-07-31 |
| B-2 | P0 | 是 | 否 | verified | 角色编辑「权限」Tab + `RolePermissionsPanel` | `RoleListPage.tsx` · `RolePermissionsPanel.tsx` | r2 再评确认 | — | 2026-07-31 |
| B-3 | P0 | 否 | 否 | verified | `ResourceGrantPicker` 按类型下拉选资源 | `GrantsDialogs.tsx` · `GrantsPage.tsx` · `ResourceGrantPicker.tsx` | r2 再评确认 | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-6 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-7 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-8 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-9 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-10 | P2 | 否 | 是 | open | — | — | — | ui-ux-reviewer | 2026-07-31 |

## 改进建议与方案

### P0

#### B-1 · RLS 角色绑定必须加载现态

| 项 | 内容 |
|----|------|
| 刺点 | 绑定面板不 GET，保存即全量替换可能清空 |
| 产品改法 | 选角色后**先拉取** `GET /roles/{id}/dimension-groups` 回填勾选；若将保存为空且原绑定非空，强制二次确认「将移除 N 个分组」 |
| 第一刀切片 | 选「分析师」角色 → 已绑分组自动勾选；vitest 覆盖 GET mock |
| 证据路径 | `RlsRoleBindingPanel.tsx` · `roles.py` dimension-groups · `rls.smoke.test.tsx` |
| 不做 | 不改绑定模型；不合并维度直绑 UI |
| 预期提分 | 维 6 → 78；维 3 → 68 |

#### B-2 · 角色权限矩阵（产品主任务补齐）

| 项 | 内容 |
|----|------|
| 刺点 | 后台管理无法配置 `permission_codes` |
| 产品改法 | 在角色编辑流增加「权限」步骤/Tab：按域分组展示 `GET /permissions` 目录，保存 `PUT /roles/{id}/permissions`；root 角色只读展示「全部权限」 |
| 第一刀切片 | 编辑 `admin` 角色可见勾选 `system:*` 等；保存后 `/me` 权限变化可测 |
| 证据路径 | 新建 `RolePermissionsPanel.tsx` · `RoleListPage.tsx` · `permissions.py` · `roles.py` permissions 端点 |
| 不做 | 不做自定义权限码注册 UI |
| 预期提分 | 维 1 → 82；维 2 → 74 |

#### B-3 · 资源授权资源选择器

| 项 | 内容 |
|----|------|
| 刺点 | 手填 UUID |
| 产品改法 | 按 `resourceType` 联动下拉/搜索（复用 `DashboardPickerSelect` 模式）：数据源列表、仪表板列表、报表节点列表 |
| 第一刀切片 | 选「仪表板」后出现名称下拉，列表展示资源名而非仅 ID |
| 证据路径 | `GrantsDialogs.tsx` · `useGrantsPage.ts` · `/api/v1/dashboards` · datasources · reports catalog |
| 不做 | 不做批量导入授权 |
| 预期提分 | 维 2 → 80；维 5 → 70 |

### P1

#### B-4 · 用户生命周期补全

| 产品改法 | 用户 Sheet 增加：组织节点选择（`GET/PUT /users/{id}/org`）、重置密码（展示一次性临时密码）、显示名/邮箱只读或跳转个人中心 |
| 第一刀切片 | 「管理角色」旁「管理组织」→ 组织树下拉保存 |
| 证据路径 | `UserListPage.tsx` · `users.py` |
| 预期提分 | 维 2 → 76；维 4 → 76 |

#### B-6 · 角色状态筛选服务端化

| 产品改法 | `GET /roles` 增加 `is_active` 查询参数，或移除误导性客户端筛选 |
| 第一刀切片 | 筛选「仅停用」时 total 与列表一致 |
| 证据路径 | `RoleListPage.tsx` · `roles.py` list 端点 |
| 预期提分 | 维 6 → 55→65 |

#### B-7 · 首登管理员引导（轻量）

| 产品改法 | 首次进入 `/admin/system/roles` 且仅内置角色时，顶部 Checklist 卡片：① 创建业务角色 ② 配置权限 ③ 创建用户 ④ 资源授权 |
| 不做 | 不做多步 wizard 阻断 |
| 预期提分 | 维 7 → 72 |

### P2

#### B-5 · 组织树维护

| 产品改法 | 节点行内编辑名称、删除（带子节点警告）、从用户页链入「未分配组织用户」 |
| 证据路径 | `OrgTreePage.tsx` · `orgs.py` |

#### B-10 · 列表页视觉对齐

| 产品改法 | `GrantsPage` 迁入 `ListPageSection` / `ListPageTableFrame`；交给 ui-ux-reviewer 统一 |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 依赖 | 验收 |
|------|------|------|------|------|
| 还债 | 状态诚实 + RBAC 主任务 | B-1 GET 回填 + 空保存确认；B-2 权限矩阵 | 无 | RLS 冒烟 + 权限 PUT 集成测 |
| 锐化 | 配置效率与认知 | B-3 资源选择器；B-4 用户组织；B-6 筛选 | 还债完成 | 管理员无 UUID 可完成授权 |
| 增长 | 采用与运营 | B-7 引导；审计钻取到对象页；无权限/无组织队列 | B-2 | 新管理员 15 分钟内完成样例角色 |

## 明确不改 / 非问题

- 后台管理从头像进入而非主侧栏 — 与 `layout.md` ADR 一致，属 IA 选择非缺陷
- 审计日志已具备筛选与详情 — 维 8 相对强项，本轮不降级
- 后端 RBAC/RLS 测试覆盖（`test_auth_rbac_l1.py`）— 属 code-reviewer 范畴
- B-10 纯视觉 — 交 ui-ux-reviewer，非产品主线

## 开放问题（待产品裁定）

1. 角色「默认看板/报表模板」是否应从角色弹窗拆到独立「登录体验」配置页？
2. 细粒度 `system:role.read` vs `system:*` 是否要在前端分菜单可见（当前统一 `system:*`）？
3. 用户创建后初始密码交付方式：邮件 / 一次性展示 / 强制首次登录改密？

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-07-31-system-admin.md`
- [ ] 仅采纳报告（不改仓）
- [ ] P0 写入 PRD/plan（create-evolution-*）
- [ ] P0 修复：B-1 RLS GET 回填 → B-2 权限矩阵 → B-3 资源选择器
- [ ] 页级视觉债 B-10 → ui-ux-reviewer
- [ ] 真机补证 → scenario-playbook / browser-reviewer
