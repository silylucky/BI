# Feature Truth Audit: 个人中心（账号导航）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 核验范围 | 账号侧栏 + `/admin/account/{profile,preferences,security}` 全部可交互能力 |
| 锚点 | `fe/src/config/account-nav.tsx` · `fe/src/pages/admin/account/**` · `/api/v1/me` · `/api/v1/auth/change-password` · `/api/v1/users/me/views` · `/api/v1/roles/{role}/default-views` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.4 / 10 · C** |
| 状态 | approved-fix |
| **sampling** | **full**（用户：「查看是否可用」= 账号导航全部功能） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 从用户菜单进入个人中心后，侧栏显示「返回工作台 + 个人资料/偏好/安全」且可切换 | `AdminLayout` · `ACCOUNT_NAV_SECTIONS` |
| T2 | 个人资料页展示 `/me` 真实字段（账号、邮箱、角色、权限） | `AccountProfilePage` · `MeProfileOut` |
| T3 | 编辑显示名称/邮箱后 PATCH `/me` 成功并刷新展示 | `ProfileEditDialog` |
| T4 | 偏好页可切换浅色/深色/跟随系统，刷新后主题保持 | `ThemePreferencesSection` · `theme-context` |
| T5 | 偏好页展示当前角色默认仪表板（只读）并可跳转打开 | `RoleDefaultViewCard` |
| T6 | 个人视图可创建/编辑/设默认/删除，登录后 `defaultViewResolve` 优先用户「默认」视图 | `UserViewsSection` · `defaultViewResolve.ts` |
| T7 | 安全页可改密：校验、错误映射、错密不踢会话、成功后旧 JWT 失效 | `ChangePasswordSection` · `test_auth_profile.py` |
| T8 | 安全页展示当前会话摘要（账号/角色） | `AccountSecurityOverview` |

- **非目标**：头像上传、2FA、会话列表踢出、账户停用态 API、浏览器真机 E2E（本轮未跑 MCP）

## 2. 完整链路图

```
用户菜单 → beginAccountManagement → /admin/account/profile
侧栏 ACCOUNT_NAV_SECTIONS ↔ 三子路由
返回工作台 → workspace-context.returnToWorkspace → 快照路径或 /admin/dashboards

个人资料：GET/PATCH /api/v1/me → profile_service
改密：POST /api/v1/auth/change-password → profile_service.change_password + audit
个人视图：/api/v1/users/me/views CRUD → user_override
角色默认：GET /api/v1/roles/{role}/default-views → role_template
主题：localStorage theme（纯 FE）
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 路由 | 通 | `routes.tsx:110-114` | `account/settings` 重定向 preferences |
| 2 | 侧栏 IA | 通 | `AdminLayout.smoke` T-FE-32 | 账号区替换主壳导航 |
| 3 | GET /me | 通 | `test_auth_profile.py` 13 passed | 含 displayName/email/roles |
| 4 | PATCH /me | 通 | `test_patch_me_updates_profile` | 422 非法邮箱 |
| 5 | change-password | 通 | 7 条 profile 改密用例 | TOKEN_REVOKED / 错密保会话 |
| 6 | users/me/views | 通（后端） | `test_viz_view_design_cat_r63.py` 子集 | FE 仅空态 smoke |
| 7 | 主题持久化 | 通（静态） | `theme-context.tsx:43-45` | localStorage，无服务端 |
| 8 | 账户状态展示 | **假** | `AccountInfoCard.tsx:49-54` | 硬编码「正常」，无 API |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 侧栏导航与返回 | **PARTIAL** | 7/B | Layout smoke UI；返回路径依赖快照未单测 |
| T2 | 资料展示 | **PARTIAL** | 6/C | smoke 挂载；账户状态硬编码 |
| T3 | 资料编辑 | **PARTIAL** | 7/B | 后端 CHAIN；FE 无保存 userEvent |
| T4 | 界面主题 | **PARTIAL** | 7/B | 接线 localStorage；无自动化 |
| T5 | 角色默认只读 | **STUB** | 5/C | GET 接线；`roles[0]` 可能错角色 |
| T6 | 个人视图 CRUD | **PARTIAL** | 6/C | 后端有；FE 仅空态 smoke |
| T7 | 修改密码 | **REAL** | 9/A | 11 FE + 13 BE 用例 |
| T8 | 安全会话概览 | **STUB** | 5/C | 只读 GET /me；无专测 |

## 3b. 前端控件下钻表

Out：装饰性 Avatar 字母、纯展示 dl 字段（无点击）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 深度 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|------|
| B1 | 返回工作台 | `account-sidebar-back.tsx:15` → `returnToWorkspace` | 回到进入前的 workspace 路径 | navigate + 清快照 | 2 | 2 | 1 | 1 | 2 | 8 | PARTIAL | UI | `AdminLayout.smoke` T-FE-32 |
| B2 | 个人资料 nav | `app-sidebar` Link | 路由至 profile | 路由存在 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 同上 |
| B3 | 偏好设置 nav | Link | 路由至 preferences | 路由存在 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 同上 |
| B4 | 安全设置 nav | Link | 路由至 security | 路由存在 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 同上 |
| B5 | 编辑基本资料 | `AccountProfileHero:41` | 打开编辑弹窗 | 打开 Dialog | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | UI | smoke 未点按 |
| B6 | 重试 | `AccountProfilePage:41` | refetch /me | invalidate query | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | UI | 未专测 |
| B7 | 电子邮箱 | `AccountSecurityLinks:67` | 打开编辑并聚焦邮箱 | focus=email 已实现 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | CHAIN | 代码 L1；无 userEvent |
| B8 | 登录密码 | Link → security | 跳转安全页 | 路由通 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 静态 |
| B9 | 默认看板 | Link → preferences | 跳转偏好页 | 路由通 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | 静态 |
| B10 | 编辑-取消 | `ProfileEditDialog:119` | 关闭不保存 | onOpenChange | 2 | 2 | 2 | 2 | 2 | 10 | REAL | CHAIN | 标准 Dialog |
| B11 | 编辑-保存 | `ProfileEditDialog:94` PATCH | 更新并 toast | API 后端已验 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | CHAIN | BE `test_patch_me`；FE 无点击测 |
| B12 | 主题-浅色 | `ThemePreferencesSection:53` | setTheme light + localStorage | 接线正确 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | CHAIN | 无自动化 |
| B13 | 主题-深色 | 同上 dark | 同上 | 同上 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | CHAIN | 无自动化 |
| B14 | 主题-跟随系统 | 同上 auto | matchMedia | 同上 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | CHAIN | 无自动化 |
| B15 | 角色默认-打开 | `RoleDefaultViewCard:70` Link | 打开默认仪表板 | 依赖 GET default-views | 1 | 1 | 1 | 2 | 2 | 7 | STUB | GATE | 无 FE 测；roles[0] 风险 |
| B16 | 新建视图 | `UserViewsSection:190` | 打开表单 | Dialog 开 | 2 | 1 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无列表态测 |
| B17 | 创建第一个视图 | empty CTA | 同 B16 | 同 B16 | 2 | 1 | 0 | 1 | 2 | 6 | PARTIAL | UI | empty smoke only |
| B18 | 批量模式 | `ListPageBatchActions` | 进入多选 | 有数据时可用 | 1 | 1 | 0 | 1 | 1 | 4 | STUB | NONE | 未验 |
| B19 | 全选 | `ListHeaderCheckbox` | 选中全部行 | 未验 | 0 | 0 | 0 | 0 | 0 | 0 | UNVERIFIED | NONE | — |
| B20 | 行选择 | `ListRowCheckbox` | 切换单行 | 未验 | 0 | 0 | 0 | 0 | 0 | 0 | UNVERIFIED | NONE | — |
| B21 | 仪表板链接 | row Link | 打开 dashboard 查看态 | 路由存在 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | GATE | 未验有数据行 |
| B22 | 编辑视图 | `openEdit` | PUT 更新 | API 后端有 | 2 | 1 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无 FE 集成测 |
| B23 | 设为默认 | `setDefault` | 名称为「默认」的视图优先 landing | 靠重命名约定 | 2 | 1 | 1 | 1 | 2 | 7 | PARTIAL | CHAIN | 脆弱命名 |
| B24 | 删除 | DELETE | 删除后回落角色默认 | API 后端有 | 2 | 1 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无 FE 测 |
| B25 | 批量删除确认 | `BatchDeleteDialog` | 批量 DELETE | 未验 | 0 | 0 | 0 | 0 | 0 | 0 | UNVERIFIED | NONE | — |
| B26 | 视图表单-取消 | `UserViewFormDialog:74` | 关闭 | 标准 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | CHAIN | — |
| B27 | 视图表单-保存 | POST/PUT views | 持久化个人视图 | 后端 CRUD 有 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | CHAIN | FE 未点保存 |
| B28 | 仪表板选择器 | `DashboardPickerSelect` | 拉取列表并选择 | GET dashboards | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | GATE | 对话框内未测 |
| B29 | 更新密码 | `ChangePasswordSection:276` | POST change-password | 全链路已验 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | 11 vitest + BE |
| B30-32 | 显示/隐藏密码 ×3 | IconButton toggle | 切换 type 不丢值 | 已验 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | smoke |

功能块映射：T1→B1-B4；T2→B5-B6+展示块；T3→B7,B10,B11；T4→B12-B14；T5→B15；T6→B16-B28；T7→B29-B32；T8→（只读，无 B）

**打通但不对（L≥2 且 C≤1）**：B16,B17,B22,B24（FE 未验正确持久化）；T2 账户状态展示（硬编码）

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|------------|------|---|---|------|------|
| T1 | 导航/返回 | ✅ 路由 | ✅ workspace | ✅ Layout smoke | UI | 2 | 2 | PARTIAL | `AdminLayout.smoke.test.tsx:371` |
| T2 | 资料展示 | ✅ 组件树 | ✅ GET /me BE | ✅ profile smoke | UI | 2 | 1 | PARTIAL | 状态硬编码 |
| T3 | 资料编辑 | ✅ PATCH 契约 | ✅ `test_patch_me` | ❌ | CHAIN | 2 | 2 | PARTIAL | 缺 FE save 测 |
| T4 | 界面主题 | ✅ theme-context | ✅ localStorage 写 | ❌ | CHAIN | 2 | 2 | PARTIAL | 无 test |
| T5 | 角色默认 | ✅ GET API | ❌ | ❌ | GATE | 1 | 1 | STUB | `roles[0]` |
| T6 | 个人视图 | ✅ views API | ✅ r63 BE | ⚠️ empty smoke | GATE | 2 | 1 | PARTIAL | 无 CRUD UI 测 |
| T7 | 修改密码 | ✅ 表单校验 | ✅ BE 审计 | ✅ 11 vitest | UI | 2 | 2 | **REAL** | `test_auth_profile` |
| T8 | 会话概览 | ✅ GET /me | ❌ | ❌ | GATE | 1 | 1 | STUB | 只读卡片 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体（T） | 8 |
| GATE only | 2（T5,T8） |
| CHAIN | 3（T3,T4,T6 部分） |
| UI / BROWSER | 4（T1,T2,T7 + T6 空态） |
| NONE（未验 B） | 3（B19,B20,B25） |
| **REAL 达标** | 1/8（T7） |
| **逐一校验** | **否** — 已验 5/8 T 有 UI/CHAIN；3 控件 NONE；T2 正确性未达标 |
| **总体可否 REAL** | **否** — 多 T STUB/PARTIAL；账户状态假数据 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T7 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 改密全链路 |
| T1 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL | — |
| T3 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | FE 缺口 |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 无 test |
| T2 | 2 | 1 | 2 | 2 | 2 | 9 | A | PARTIAL | 状态硬编码 |
| T6 | 2 | 1 | 1 | 1 | 2 | 7 | B | PARTIAL | CRUD UI 未验 |
| T5 | 1 | 1 | 1 | 2 | 2 | 7 | B | STUB | — |
| T8 | 1 | 1 | 2 | 2 | 2 | 8 | B | STUB | — |

**加权总体**：(10+9+10+10+9+7+7+8)/8 ≈ **6.4 · C**

**打通但不对**：T2 账户状态；T6 FE 持久化未验  
**假功能**：无（硬编码属 PARTIAL 非 STUB 入口）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest run src/pages/admin/account/` | 20 passed | **20 passed** | ✅ | 2026-07-31 15:13 输出 |
| 2 | `pytest test_auth_profile.py` | 13 passed | **13 passed** | ✅ | 2026-07-31 15:14 输出 |
| 3 | 读 `AccountInfoCard` 账户状态 | 来自 API 或隐藏 | 固定 Badge「正常」 | ❌ | `AccountInfoCard.tsx:49-54` |
| 4 | 读 `RoleDefaultViewCard` 角色选择 | primaryRole 逻辑 | `roles[0]` | ❌ | `RoleDefaultViewCard.tsx:26` |
| 5 | `UserViewsSection` 测试覆盖 | create/edit/delete UI | 仅 empty 文案断言 | ❌ | `UserViewsSection.smoke.test.tsx` |
| 6 | MCP 浏览器点按全页 | 可操作 | **未执行** | — | 本轮无 BROWSER |

## 5. 修复文档

### T2 — 账户状态硬编码

**判定 / 得分**：PARTIAL 6/C（C=1）  
**期望 vs 实际**：应反映真实账户状态（或不在无 API 时展示）→ 始终「正常」  
**根因**：`fe/src/pages/admin/account/components/AccountInfoCard.tsx:49-54`、`AccountProfileHero.tsx:61-63`  
**修复方向**：后端 `/me` 增 `status` 字段，或移除/改为「已登录」等可证事实  
**修后验收**：C≥2，T2 REAL

### T5 — 角色默认取错角色

**判定**：STUB  
**期望 vs 实际**：多角色用户应展示主角色（admin>analyst>viewer）默认 → 取 `roles[0]`  
**根因**：`RoleDefaultViewCard.tsx:26`  
**修复方向**：复用 `primaryRoleLabel` 同源逻辑选 role code  
**修后验收**：CHAIN + 单测 mock GET

### T6 — 个人视图 FE CRUD 无 UI 验证

**判定**：PARTIAL  
**期望 vs 实际**：创建/编辑/设默认/删除应 toast + 列表刷新 → 仅静态接线 + 后端测  
**根因**：缺 `UserViewsSection` 集成测（mock apiFetch 序列）  
**修复方向**：补 3–5 条 userEvent 测：create、setDefault、delete  
**触及文件**：`UserViewsSection.smoke.test.tsx`  
**修后验收**：T6 UI 深度，B16-B24 非 NONE

### T3 — 资料保存 FE 缺口

**判定**：PARTIAL  
**根因**：`ProfileEditDialog` 无保存 userEvent 测  
**修复方向**：mock PATCH 断言 payload + toast  
**优先级**：P1

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T2 | 移除或对接真实账户状态，避免误导 |
| P1 | T5 | 角色默认卡片用主角色而非 `roles[0]` |
| P1 | T6 | 补个人视图 CRUD 前端集成测 |
| P2 | T3/T4 | 补 Profile 保存与主题切换 smoke |
| P2 | B19-B25 | 补批量操作 UI 测或标为低优先级 Out |

## 7. 交接

- **结论**：个人中心 **基本可用（PARTIAL）**；**改密（T7）可标 REAL**；导航与路由通；资料/偏好/视图多条链路后端已通但 FE 验证不足；账户状态展示不正确。
- 建议：P0 修 T2 → `root-first-solve` 或批准后直接修
- 用户批准修复：**是**（2026-07-31「修复问题」）

## 8. 修复记录（2026-07-31）

| ID | 修复 | 文件 |
|----|------|------|
| T2 | 「账户状态/正常」→「会话状态/已登录」（可观察事实） | `AccountInfoCard.tsx` · `AccountProfileHero.tsx` |
| T5 | 新增 `primaryRoleCode()`，角色默认卡片按主角色拉 API | `session.ts` · `RoleDefaultViewCard.tsx` |
| T3 | 补 `ProfileEditDialog` PATCH 集成测 | `ProfileEditDialog.test.tsx` |
| T6 | 补个人视图创建/删除 UI 测；删除按钮加 `aria-label` | `UserViewsSection.tsx` · `UserViewsSection.smoke.test.tsx` |
| — | `DashboardPickerSelect` 受控 value 消除 uncontrolled 警告 | `DashboardPickerSelect.tsx` |

**验证**：`vitest account/` **29 passed**；`session.test.ts` **5 passed**
