# 刁钻产品评审 · 后台管理（`/admin/system/*`）· r2

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | 头像菜单「后台管理」→ `/admin/system/{roles,users,grants,rls,orgs,audit}` 全模块 |
| 角色假设 | **平台管理员**（`system:*`）；次要：**安全审计员**（只读追溯） |
| 证据 | 代码走查（P0 修复后实现 + smoke 测试）；**未真机** |
| 轮次 | **r2**（P0 修复后再评） |
| 上轮报告 | `docs/material/product-reviewer/2026-07-31-system-admin.md` |
| 总分 | **72** / 100（本轮独立评分） |
| 较上轮 Δ | **+9**（r1=63；事后计算，非评分锚定） |
| 结论 | **小改后可用**（RBAC 主链路已立住；用户/组织生命周期仍欠账） |
| 硬门槛 | **无**（r1 的 B-1/B-2 已验证修复） |

## Review Card

- **主 JTBD**：租户管理员配置「角色权限 → 用户与组织 → 资源授权 → RLS → 可审计」闭环。
- **成功长什么样**：编辑角色勾选 `dashboard:read` 等 → 创建用户并绑定角色/组织 → 下拉选仪表板授权 → RLS 绑定可看见且可确认清空 → 审计可追溯。
- **最贵失败**：用户创建 silently 422（缺初始密码）；组织无法维护导致 RLS 组织维度悬空。
- **未真机**：是

## 执行摘要（刁钻口吻，短）

- **P0 修复有效**：RLS 绑定已 GET 回填 + 清空确认；角色有权限 Tab；授权有资源选择器——信任链基本恢复。
- **最锋利的新刺**：创建用户只填用户名，后端 `UserCreate` 强制 `initialPassword`（`users.py` / `UserListPage.tsx`）——主路径「开户」可能直接 422。
- **下一刀主线**：P1 用户生命周期（组织绑定 + 初始密码/重置密码），再碰组织树维护。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 78 | 权限矩阵已进产品面（`RolePermissionsPanel` + 编辑弹窗「权限」Tab）；用户/组织仍半截 |
| 2 主路径锋利 | 74 | 角色→权限→授权可走通（`ResourceGrantPicker`）；创建用户缺密码字段（`UserListPage` POST 仅 `username`） |
| 3 例外与逆操作 | 66 | RLS 清空二次确认（`RlsRoleBindingPanel` AlertDialog）；用户无停用入口；组织不可改删 |
| 4 角色与权责 | 72 | `system:*` 路由守卫不变；权限可配置；细粒度 `system:role.read` 未分菜单 |
| 5 认知与决策点 | 70 | 权限与基本信息分 Tab；授权列表显示资源名（`useGrantResourceNameMaps`）；RLS 术语仍重 |
| 6 状态与信任 | 76 | RLS/权限均 GET 回填 + version PUT；不再「空选即覆盖」静默风险 |
| 7 可发现与采用 | 62 | 入口仍在头像菜单；无首租户 Checklist（B-7 仍 open） |
| 8 可运营与可度量 | 75 | 审计日志能力未变（`AuditLogPage`）；仍缺无组织/无权限运营队列 |
| **总分** | **72** | 算术平均 |

## 硬门槛

- [ ] 无命中（r1 的 B-1、B-2 经本轮取证 **已解除**）

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 是 | 否 | ~~选角色后勾选从空开始~~ **已修复** | — | `RlsRoleBindingPanel.tsx` L57-74 GET 回填 |
| B-2 | 1 | P0 | 是 | 否 | ~~无权限矩阵~~ **已修复** | — | `RoleListPage.tsx` 权限 Tab · `RolePermissionsPanel.tsx` |
| B-3 | 2 | P0 | 否 | 否 | ~~手填 UUID~~ **已修复** | — | `ResourceGrantPicker.tsx` · `GrantsDialogs.tsx` |
| B-4 | 2 | P1 | 否 | 否 | ~~用户页无组织/改密~~ **已修复** | — | `UserManageSheet.tsx` · org/reset-password |
| B-5 | 3 | P1 | 否 | 否 | ~~组织树仅新建~~ **已修复** | — | `OrgTreePage.tsx` 编辑/删除 |
| B-6 | 6 | P1 | 否 | 否 | 角色状态筛选仅当前页 | total 与筛选不一致 | `RoleListPage.tsx` `filteredItems` |
| B-7 | 7 | P1 | 否 | 否 | ~~无引导~~ **部分修复** | 配置向导首页 + 导航重组 | `SystemAdminHomePage.tsx` |
| B-8 | 3 | P2 | 否 | 否 | RLS 维度类型只读 | 建错维度无法改 | `RlsAdminPage.tsx` |
| B-9 | 5 | P2 | 否 | 否 | 角色基本信息混默认看板 | 改名字却要懂 Dashboard | `RoleProfileFormFields.tsx` |
| B-10 | 7 | P2 | 否 | 是 | 授权页布局不统一 | 像后补模块 | `GrantsPage.tsx` |
| **B-11** | 2 | **P1** | 否 | 否 | ~~创建用户无初始密码字段~~ **已修复** | — | `CreateUserDialog.tsx` POST `initialPassword` |

## 处理清单（修复回写）

继承 r1 全表；r2 仅更新状态与验证列。

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | **verified** | r2 再评确认 | GET 回填 + 清空确认 + expectedVersion | `RlsRoleBindingPanel.smoke.test.tsx` 1 passed | — | 2026-07-31 |
| B-2 | P0 | 是 | 否 | **verified** | r2 再评确认 | 权限 Tab + `RolePermissionsPanel` | `RolePermissionsPanel.smoke.test.tsx` 1 passed | — | 2026-07-31 |
| B-3 | P0 | 否 | 否 | **verified** | r2 再评确认 | `ResourceGrantPicker` 下拉选资源 | `grants.smoke.test.tsx` 4 passed | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | **verified** | P1 修复 | `UserManageSheet` 组织 Tab + 重置密码 | `users.smoke.test.tsx` T-AUTH-003-04/05 | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | **verified** | UX 优化 | 组织节点编辑/删除 + 错误文案 | `orgs.smoke.test.tsx` 3 passed | — | 2026-07-31 |
| B-6 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-7 | P1 | 否 | 否 | **partial** | UX 优化 | `/admin/system` 配置向导；RLS 收至高级 | `system-admin.smoke.test.tsx` | — | 2026-07-31 |
| B-8 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-9 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-10 | P2 | 否 | 是 | open | — | — | — | ui-ux-reviewer | 2026-07-31 |
| B-11 | P1 | 否 | 否 | **verified** | P1 修复 | `CreateUserDialog` 初始密码 + 一次性展示 | `users.smoke.test.tsx` T-AUTH-003-03 | — | 2026-07-31 |

## 改进建议与方案（r2 增量）

### 建议优先（P1）

#### B-11 · 创建用户补全凭证流

| 项 | 内容 |
|----|------|
| 产品改法 | 创建对话框增加「初始密码」+ 可选「创建后展示一次性密码」；或「自动生成临时密码」按钮 |
| 第一刀切片 | 填用户名+密码可 201 创建；失败展示 `mapUserError` |
| 证据路径 | `UserListPage.tsx` · `users.py` POST |
| 预期提分 | 维 2 → 80 |

#### B-4 · 用户 Sheet 增加组织 + 重置密码

（同 r1 方案，未变）

### P2 / 视觉债

- B-10 → ui-ux-reviewer 统一 `GrantsPage` 列表信封

## 明确不改 / 非问题

- 头像菜单进入后台管理 — IA 既定（`layout.md`）
- P0 三项修复经 smoke 覆盖，本轮无回归证据

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-07-31-system-admin-r2.md`
- [ ] P1 批次：B-11 创建用户密码 → B-4 用户组织/改密
- [ ] 可选 product-reviewer r3 或真机 `scenario-playbook`
