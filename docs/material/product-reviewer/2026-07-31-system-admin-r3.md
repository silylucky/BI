# 刁钻产品评审 · 后台管理（`/admin/system/*`）· r3

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | 头像菜单「后台管理」→ `/admin/system` 及 `{orgs,roles,users,grants,rls,audit}` |
| 角色假设 | **平台管理员**（`system:*`）；次要：**安全审计员**（只读追溯） |
| 证据 | 代码走查（UX 优化后实现 + smoke 测试）；**未真机** |
| 轮次 | **r3**（配置向导 / 组织维护 / 导航重组后再评） |
| 上轮报告 | `docs/material/product-reviewer/2026-07-31-system-admin-r2.md` |
| 总分 | **75** / 100（本轮独立评分） |
| 较上轮 Δ | **+3**（r2=72；事后计算，非评分锚定） |
| 结论 | **小改后可用**（首租户可跟向导走完；运维例外与用户生命周期仍欠账） |
| 硬门槛 | **无** |

## Review Card

- **主 JTBD**：租户管理员按业务顺序完成「组织 → 岗位角色 → 用户 → 资源授权」，必要时再配行级权限，并可审计追溯。
- **成功长什么样**：配置向导四步变绿 → 业务人员能登录、看到被授权的报表/仪表板 → 组织与权限变更有日志。
- **最贵失败**：向导看似完成但用户仍无法登录/看不到资源；或误删组织/角色无恢复路径。
- **未真机**：是

## 执行摘要（刁钻口吻，短）

- **UX 优化有效**：`/admin/system` 配置向导把「先干什么」说清楚了；组织可改删；RLS 收到「高级」；权限矩阵只说人话——**像产品了，不像裸引擎**。
- **仍像 IT 后台的地方**：入口还在头像里；用户停用/解锁 API 有、UI 无；角色状态筛选仍骗分页 total（B-6）。
- **下一刀**：用户生命周期例外（停用/解锁）+ 角色筛选服务端化；可选岗位模板降低冷启动成本。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 82 | `SystemAdminHomePage` 四步向导 + 各页业务向 description（`OrgTreePage` / `RoleListPage`） |
| 2 主路径锋利 | 79 | 向导链 org→roles→users→grants；`CreateUserDialog` 初始密码；`UserManageSheet` 组织+改密 |
| 3 例外与逆操作 | 68 | `OrgTreePage` 编辑/删除 + `mapOrgError`；用户 `disable/enable/unlock` 无 UI（`users.py`） |
| 4 角色与权责 | 72 | 路由仍 `RequireCapabilityName capability="system:*"`（`routes.tsx`）；细粒度 `system:role.read` 未拆菜单 |
| 5 认知与决策点 | 77 | `RolePermissionsPanel` 仅展示中文名+说明；RLS 标题「高级」+ 引导回向导（`RlsAdminPage.tsx`） |
| 6 状态与信任 | 78 | RLS/权限 GET 回填 + version PUT 未回归；向导进度基于 API 计数（`SystemAdminHomePage`） |
| 7 可发现与采用 | 71 | 默认入口改 `/admin/system`（`workspace.ts`）；仍仅头像菜单，无岗位模板/空状态一键导入 |
| 8 可运营与可度量 | 76 | `AuditLogPage` 仍在；向导侧栏概览计数；缺「无组织用户/无权限角色」运营队列 |
| **总分** | **75** | 算术平均 |

## 硬门槛

- [ ] 无命中

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 是 | 否 | ~~RLS 绑定不回填~~ **已修复** | — | `RlsRoleBindingPanel.tsx` |
| B-2 | 1 | P0 | 是 | 否 | ~~无权限矩阵~~ **已修复** | — | `RolePermissionsPanel.tsx` |
| B-3 | 2 | P0 | 否 | 否 | ~~授权手填 UUID~~ **已修复** | — | `ResourceGrantPicker.tsx` |
| B-4 | 2 | P1 | 否 | 否 | ~~用户无组织/改密~~ **已修复** | — | `UserManageSheet.tsx` |
| B-5 | 3 | P1 | 否 | 否 | ~~组织仅新建~~ **已修复** | — | `OrgTreePage.tsx` · `OrgTreeRows.tsx` |
| B-6 | 6 | P1 | 否 | 否 | 角色状态筛选仅当前页 | 「共 N 个」与筛选结果对不上 | `RoleListPage.tsx` L135-140 `filteredItems` |
| B-7 | 7 | P1 | 否 | 否 | 入口仍藏头像；无模板 | 向导有了，但新人仍要先找到头像 | `user-dropdown.tsx` · `SystemAdminHomePage.tsx` |
| B-8 | 3 | P2 | 否 | 否 | RLS 维度类型只读 | 建错维度无法改 | `RlsAdminPage.tsx` |
| B-9 | 5 | P2 | 否 | 否 | 角色基本信息混默认看板 | 改岗位名却要懂 Dashboard | `RoleProfileFormFields.tsx` L80+ |
| B-10 | 7 | P2 | 否 | 是 | 授权页布局不统一 | 像后补模块 | `GrantsPage.tsx` |
| B-11 | 2 | P1 | 否 | 否 | ~~创建用户无密码~~ **已修复** | — | `CreateUserDialog.tsx` |
| **B-12** | 3 | **P1** | 否 | 否 | 用户无停用/解锁入口 | 「这人离职了怎么封号？」只能找 API | `users.py` disable/enable/unlock；`UserManageSheet.tsx` 无对应操作 |

## 处理清单（修复回写）

继承 r2 全表；r3 更新状态与新刺点。

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | **verified** | r3 再评确认 | — | smoke 未回归 | — | 2026-07-31 |
| B-2 | P0 | 是 | 否 | **verified** | r3 再评确认 | — | smoke 未回归 | — | 2026-07-31 |
| B-3 | P0 | 否 | 否 | **verified** | r3 再评确认 | — | smoke 未回归 | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | **verified** | r3 再评确认 | `UserManageSheet` 组织+改密 | `users.smoke.test.tsx` 5 passed | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | **verified** | r3 再评确认 | 组织编辑/删除 | `orgs.smoke.test.tsx` 3 passed | — | 2026-07-31 |
| B-6 | P1 | 否 | 否 | **verified** | r3 修复 | `roles.py` + `RoleListPage.tsx` 服务端 `is_active` 筛选 | `roles.smoke.test.tsx` T-AUTH-001-04 | — | 2026-07-31 |
| B-7 | P1 | 否 | 否 | **partial** | r3 收口 | 顶栏「系统管理」入口；岗位模板仍缺 | `AdminLayout.smoke.test.tsx` T-FE-SMFB-04/05 | — | 2026-08-07 |
| B-8 | P2 | 否 | 否 | **verified** | r3 收口 | `RlsAdminPage` 维度类型编辑/删除 | `rls.smoke.test.tsx` T-RLS-02/03 | — | 2026-08-07 |
| B-9 | P2 | 否 | 否 | **verified** | r3 收口 | `RoleProfileFormFields` 基本信息/登录默认页分组 | `roles.smoke.test.tsx` 回归 | — | 2026-08-07 |
| B-10 | P2 | 否 | 是 | **verified** | r3 收口 | `GrantsPage` 对齐 list-page-kit + 客户端分页 | `grants.smoke.test.tsx` T-AUTH-004-FE-05 | — | 2026-08-07 |
| B-11 | P1 | 否 | 否 | **verified** | r3 再评确认 | `CreateUserDialog` | `users.smoke.test.tsx` T-AUTH-003-03 | — | 2026-07-31 |
| B-12 | P1 | 否 | 否 | **verified** | r3 修复 | `UserAccountStatusPanel.tsx` 停用/启用/解锁 | `users.smoke.test.tsx` T-AUTH-003-06 | — | 2026-07-31 |

## 改进建议与方案（r3 增量）

### 建议优先（P1）

#### B-12 · 用户管理补全生命周期例外

| 项 | 内容 |
|----|------|
| 产品改法 | 在 `UserManageSheet`「组织与安全」增加：停用账号、重新启用、解锁（失败锁定） |
| 第一刀切片 | 停用需二次确认；列表/Sheet 展示 `isActive` 状态徽章 |
| 证据路径 | `UserManageSheet.tsx` · `users.py` POST disable/enable/unlock |
| 预期提分 | 维 3 → 74 |

#### B-6 · 角色状态筛选服务端化

| 项 | 内容 |
|----|------|
| 产品改法 | `GET /roles` 增加 `is_active` 查询参数，或移除误导性客户端筛选 |
| 第一刀切片 | 筛选「仅停用」时 total 与列表一致 |
| 证据路径 | `RoleListPage.tsx` · `roles.py` list |
| 预期提分 | 维 6 → 82 |

#### B-7 · 完成首租户采用（续）

| 项 | 内容 |
|----|------|
| 产品改法 | 可选「导入岗位模板」（分析员/领导只读）；工作台设置区增加「系统管理」入口（与头像并列） |
| 第一刀切片 | 向导空库时提供「一键创建演示岗位」按钮（可关闭） |
| 证据路径 | `SystemAdminHomePage.tsx` · `docs/ui/layout.md` |
| 预期提分 | 维 7 → 78 |

### P2 / 视觉债

- B-10 → ui-ux-reviewer 统一 `GrantsPage` 列表信封
- B-9 → 角色「默认看板」移至高级折叠区，与岗位名称分离

## 明确不改 / 非问题

- 头像菜单作为后台管理入口之一 — IA 既定（`layout.md`）；r3 已通过向导降低「进来后迷路」
- 零预置业务场景包 — 产品定位（`goal.md` G4）；模板应为可选导入而非自动加载
- P0 项经 r3 代码走查无回归证据

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-07-31-system-admin-r3.md`
- [x] P1：B-12 用户停用/解锁 UI · B-6 角色筛选
- [x] r3 收口：B-8/B-9/B-10；B-7 顶栏入口（模板仍 open）
- [ ] 可选：B-7 岗位角色模板一键导入
- [ ] 可选真机 `scenario-playbook`：首租户从向导走到授权报表
