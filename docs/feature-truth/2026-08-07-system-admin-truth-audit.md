# Feature Truth Audit: 后台管理（`/admin/system/*`）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-07 |
| 核验范围 | 头像/顶栏进入 → `/admin/system` 及 `{orgs,users,roles,grants,rls,audit}` 全部页面与主交互 |
| 锚点 | `fe/src/pages/admin/system/**` · `fe/src/config/system-admin-nav.tsx` · `fe/src/components/layout/system-admin-header-button.tsx` · `/api/v1/{orgs,users,roles,resource-grants,rls,audit}` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7.2 / 10 · B**（主路径可用；未真机；部分控件与测试缺口） |
| 状态 | approved-fix |
| **sampling** | **full**（用户：「是否全部可用，并且好用」= 后台管理全模块） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 平台管理员可从顶栏或头像进入后台，侧栏切换为系统管理导航，可返回工作台 | r3 B-7 · `layout.md` · `AdminLayout` |
| T2 | 配置向导四步（组织→角色→用户→授权）展示进度，链到对应页，空库时有「继续配置」 | `SystemAdminHomePage` · r3 维 2 |
| T3 | 组织树可新建/编辑/删除，错误有人话提示 | r3 B-5 verified |
| T4 | 用户可创建、绑角色、绑组织、改密、停用/启用/解锁 | r3 B-4/B-11/B-12 |
| T5 | 角色可新建、搜/筛（含停用）、编辑资料、配权限矩阵 | r3 B-2/B-6/B-9 |
| T6 | 资源授权可新建（选角色+资源）、撤销、列表筛选与分页 | r3 B-3/B-10 |
| T7 | RLS 可维护维度类型/分组、角色绑定可回填并保存 | r3 B-1/B-8 |
| T8 | 审计日志可筛、分页、看详情，文案可读 | r3 维 8 |
| T9 | **好用**：首租户冷启动有引导；非 IT 能跟向导走完；无「能点但结果错」 | 对话「全部可用且好用」· r3 总分 75 |

- **非目标**：岗位角色模板一键导入（B-7 明确 optional）· 浏览器真机 E2E · 细粒度 `system:role.read` 拆菜单

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 功能子域（T） | 9 | 0 | 9 | T1–T9 |
| 路由页 | 7 | 0 | 7 | `system-admin-nav.tsx` + `/admin/system` 首页 |
| 壳层入口 | 3 | 0 | 3 | 顶栏 · 头像 · 侧栏 |
| 可交互控件（§3b） | 52 | 6 | 46 | 各页源码 aria-label / 按钮枚举 |
| smoke 用例 | 31 | 0 | 31 | `fe/src/pages/admin/system/**/*.smoke.test.tsx` + `AdminLayout` SMFB |

Out 控件（不验）：向导步骤装饰图标、概览只读数字、审计详情内「复制 traceId」、角色批量删除未接业务、纯 Tooltip 悬停

## 2. 完整链路图

```
顶栏/头像 → beginSystemAdmin → /admin/system
侧栏 SYSTEM_ADMIN_NAV_SECTIONS ↔ 七子路由
向导 GET orgs/users/roles/grants → 步骤 done 徽章 → Link 跳转

组织：GET/POST/PUT/DELETE /api/v1/orgs
用户：GET users · POST create · PUT roles/org · POST reset-password/disable/enable/unlock
角色：GET roles?is_active · POST/PUT role · PUT permissions
授权：GET/POST/DELETE resource-grants · ResourceGrantPicker
RLS：维度类型/分组 CRUD · 角色绑定 GET+PUT
审计：GET /api/v1/audit/events?filters → DetailSheet
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 路由/壳 | 通 | `AdminLayout.smoke` T-FE-SMFB-00/04/05 | 系统侧栏 + 顶栏入口 |
| 2 | 向导进度 | **偏** | `system-admin.smoke.test.tsx` 2 passed | `userTotal>1` 判完成偏粗 |
| 3 | 组织 CRUD | 通 | `orgs.smoke.test.tsx` 3 passed | 缺 POST 新建专测 |
| 4 | 用户主路径 | 通 | `users.smoke.test.tsx` 6 passed | 解锁未专测 |
| 5 | 角色+权限 | 通 | `roles` 4 + `RolePermissionsPanel` 1 | 编辑/删除/批量未测 |
| 6 | 资源授权 | 通 | `grants.smoke.test.tsx` 5 passed | 列表筛选未测 |
| 7 | RLS | **偏** | `rls` 3 + `RlsRoleBindingPanel` 1 | 新建维度/保存绑定 POST 未全测 |
| 8 | 审计 | **偏** | `audit.smoke` 3/4 pass；1 测例红 | 日期 label 测例漂移；筛选 API 未断言 |
| 9 | 真机 | **未** | — | 无 MCP/Playwright |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 入口与导航 | **PARTIAL** | 8/B | 顶栏+侧栏 UI 测；头像菜单项无专测 |
| T2 | 配置向导 | **PARTIAL** | 7/B | 渲染+链接通；done 启发式；无模板 |
| T3 | 组织架构 | **PARTIAL** | 8/B | 编辑/删除 UI 测；新建无 POST 测 |
| T4 | 用户管理 | **REAL** | 9/A | 6 条 smoke 覆盖主链+停用 |
| T5 | 角色管理 | **PARTIAL** | 8/B | 新建/筛选/权限有测；编辑删除未点 |
| T6 | 资源授权 | **PARTIAL** | 8/B | CRUD+分页有测；toolbar 筛选未验 |
| T7 | 行级权限 | **PARTIAL** | 7/B | 维度改删有测；分组 CRUD/保存绑定不全 |
| T8 | 审计日志 | **PARTIAL** | 7/B | 列表/详情/分页有测；日期筛选测例红 |
| T9 | 好用（产品） | **PARTIAL** | 7/B | r3=75；B-7 模板缺；无真机走查 |

## 3b. 前端控件下钻表

功能块映射：T1→B1–B10 · T2→B11–B21 · T3→B22–B27 · T4→B28–B37 · T5→B38–B44 · T6→B45–B50 · T7→B51–B60 · T8→B61–B67

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 深度 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|------|
| B1 | 顶栏「系统管理」 | `system-admin-header-button.tsx:24` | admin 可见，已在 system 时隐藏 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | T-FE-SMFB-04/05 |
| B2 | 头像菜单「后台管理」 | `user-dropdown.tsx` | 进入 `/admin/system` | 静态接线 | 1 | 2 | 1 | 1 | 2 | 7 | STUB | GATE | 无专测 |
| B3 | 侧栏「配置向导」 | nav Link | 路由 `/admin/system` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | T-FE-SMFB-00 |
| B4 | 侧栏「组织架构」 | nav Link | `/admin/system/orgs` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | T-FE-SMFB-01 |
| B5 | 侧栏「用户管理」 | subItems | `/admin/system/users` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | GATE | 侧栏文本测 |
| B6 | 侧栏「角色管理」 | subItems | `/admin/system/roles` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | GATE | 同上 |
| B7 | 侧栏「资源授权」 | subItems | `/admin/system/grants` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | T-FE-SMFB-01 |
| B8 | 侧栏「行级权限」 | nav Link | `/admin/system/rls` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | GATE | rls smoke 挂载 |
| B9 | 侧栏「审计日志」 | nav Link | `/admin/system/audit` | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | GATE | audit smoke |
| B10 | 返回工作台 | user menu | 回到原 workspace | 未在本 scope 专测 | 1 | 2 | 1 | 1 | 2 | 7 | STUB | GATE | T-FE-32 在 account 场景 |
| B11 | 继续配置 | `SystemAdminHomePage:150` | 跳转首个未完成步 | 静态 Link | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | GATE | 无 userEvent |
| B12 | 步骤卡·组织 | StepCard Link | → orgs | href 正确 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | UI | `system-admin.smoke` |
| B13 | 步骤卡·角色 | StepCard | → roles | 未专测 href | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | 同页渲染 |
| B14 | 步骤卡·用户 | StepCard | → users | 未专测 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | 同页渲染 |
| B15 | 步骤卡·授权 | StepCard | → grants | 未专测 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | 同页渲染 |
| B16–B20 | 快捷入口×5 | aside Link | 五路由 | 静态 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | 无点击测 |
| B21 | 打开行级权限 | aside Button | → rls | 静态 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | 无点击测 |
| B22 | 新建组织 | `OrgTreePage` POST | 创建节点 | 接线存在 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | GATE | 无 POST smoke |
| B23 | 编辑组织 | PUT | 改名保存 | PUT body 正确 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | `orgs.smoke` |
| B24 | 删除组织 | DELETE | 确认后删除 | DELETE 发出 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | `orgs.smoke` |
| B25 | 组织表单保存 | create/edit dialog | 校验+提交 | edit 已验 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | UI | create 未验 |
| B26 | 搜索用户 | SearchField | 过滤列表 | 挂载 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | GATE | T-AUTH-003-01 |
| B27 | 创建用户 | POST + 初始密码 | 列表刷新 | POST 含 password | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-003-03 |
| B28 | 管理·角色绑定 | PUT roles | roleIds 正确 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-003-02 |
| B29 | 保存组织归属 | PUT org | org_id 正确 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-003-04 |
| B30 | 重置密码 | POST reset-password | 确认后调用 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-003-05 |
| B31 | 停用账号 | POST disable | 确认+徽章变停用 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-003-06 |
| B32 | 重新启用 | POST enable | 停用后可启用 | 测例见按钮 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | UI | 未点 enable POST |
| B33 | 解除锁定 | POST unlock | 锁定后解锁 | 接线存在 | 1 | 2 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无专测 |
| B34 | 搜索角色 | searchbox | 前缀筛选 | 单控件存在 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | UI | T-AUTH-001-03 |
| B35 | 筛选角色状态 | GET is_active | 仅停用 total 一致 | query 含 false | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-001-04 |
| B36 | 新建角色 | POST | 列表刷新 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-001-02 |
| B37 | 编辑角色 | PUT | 更新资料 | 未点测 | 1 | 2 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无 userEvent |
| B38 | 删除角色 | DELETE | 确认删除 | 未点测 | 1 | 2 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 无 userEvent |
| B39 | 保存权限 | PUT permissions | codes 持久化 | checkbox+保存 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | `RolePermissionsPanel.smoke` |
| B40 | 角色表单分组 | profile 区块 | 基本信息与默认页分离 | 静态结构 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL | GATE | B-9 代码；无专测 |
| B41 | 搜索资源 ID | grants toolbar | 客户端过滤 | 未验 | 0 | 1 | 0 | 0 | 1 | 2 | UNVERIFIED | NONE | — |
| B42 | 筛选角色/类型 | Select | 过滤列表 | 未验 | 0 | 1 | 0 | 0 | 1 | 2 | UNVERIFIED | NONE | — |
| B43 | 新建授权 | POST | 选角色+资源 | 全链通 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-004-FE-03 |
| B44 | 撤销授权 | DELETE | 确认撤销 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-004-FE-04 |
| B45 | 授权分页 | client pagination | >20 分页 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-AUTH-004-FE-05 |
| B46 | 编辑维度类型 | PUT | 改名保存 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-RLS-02 |
| B47 | 删除维度类型 | DELETE | 确认删除 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | T-RLS-03 |
| B48 | 新建维度类型 | POST | 创建维度 | 未点测 | 1 | 2 | 0 | 1 | 2 | 6 | PARTIAL | GATE | 按钮存在 |
| B49 | 新建/编辑分组 | POST/PUT | 分组 CRUD | 仅挂载 | 1 | 1 | 0 | 1 | 2 | 5 | STUB | GATE | tab smoke |
| B50 | 保存角色绑定 | PUT bindings | 勾选持久化 | 回填 checkbox | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | UI | `RlsRoleBindingPanel` 无保存点击 |
| B51 | 搜索操作 | audit search | debounce 查 API | 挂载未断言 API | 1 | 2 | 0 | 1 | 2 | 6 | PARTIAL | GATE | — |
| B52 | 筛选目标类型 | Select | query target_type | 未验 | 0 | 1 | 0 | 0 | 1 | 2 | UNVERIFIED | NONE | — |
| B53 | 筛选起始日期 | DateField | created_after ISO | UI 有；测例找错 label | 2 | 2 | 0 | 1 | 2 | 7 | PARTIAL | GATE | 测例 `筛选起始时间` vs `筛选起始日期` |
| B54 | 筛选结束日期 | DateField | created_before | 同 B53 | 2 | 2 | 0 | 1 | 2 | 7 | PARTIAL | GATE | 同上 |
| B55 | 查看详情 | DetailSheet | 展示 trace/摘要 | 符合 | 2 | 2 | 2 | 2 | 2 | 10 | **REAL** | UI | audit smoke |
| B56 | 审计分页 | pagination | 翻页拉取 | 下一页 enabled | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | UI | 未点下一页 |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| E01 | 壳层·顶栏入口 | ✅ | — | ✅ | UI | 2 | 2 | REAL | T-FE-SMFB-04/05 |
| E02 | 壳层·侧栏导航 | ✅ | — | ✅ | UI | 2 | 2 | REAL | T-FE-SMFB-00/01 |
| E03 | 壳层·头像入口 | ✅ | — | ❌ | GATE | 1 | 2 | STUB | 代码接线 |
| E04 | 配置向导 | ✅ | — | ✅ | UI | 2 | 1 | PARTIAL | `system-admin.smoke` 2 pass |
| E05 | 组织·列表/编辑/删 | — | — | ✅ | UI | 2 | 2 | REAL | `orgs.smoke` 3 pass |
| E06 | 组织·新建 | ✅ | — | ❌ | GATE | 1 | 2 | STUB | POST 无测 |
| E07 | 用户·全主链 | — | — | ✅ | UI | 2 | 2 | REAL | `users.smoke` 6 pass |
| E08 | 用户·解锁 | ✅ | — | ❌ | GATE | 1 | 2 | STUB | `UserAccountStatusPanel` |
| E09 | 角色·新建/筛选 | — | — | ✅ | UI | 2 | 2 | REAL | `roles.smoke` |
| E10 | 角色·编辑/删除 | ✅ | — | ❌ | GATE | 1 | 2 | STUB | UI 存在无测 |
| E11 | 角色·权限矩阵 | — | — | ✅ | UI | 2 | 2 | REAL | `RolePermissionsPanel.smoke` |
| E12 | 授权·CRUD | — | — | ✅ | UI | 2 | 2 | REAL | `grants.smoke` 5 pass |
| E13 | 授权·列表筛选 | ❌ | — | ❌ | NONE | 0 | 1 | UNVERIFIED | toolbar 未验 |
| E14 | RLS·维度类型改删 | — | — | ✅ | UI | 2 | 2 | REAL | T-RLS-02/03 |
| E15 | RLS·分组/绑定保存 | ✅ | — | ⚠️ | GATE | 1 | 1 | STUB | 回填无保存 POST |
| E16 | 审计·列表/详情/分页 | — | — | ✅ | UI | 2 | 2 | PARTIAL | 1 测例红；筛选 API 未断言 |
| E17 | 真机首租户走查 | ❌ | — | ❌ | NONE | 0 | 0 | UNVERIFIED | 无 BROWSER |
| E18 | 岗位模板（B-7） | ❌ | — | ❌ | NONE | 0 | 0 | UNVERIFIED | 产品 optional |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 18 |
| GATE only | 5（E03,E06,E08,E10,E15） |
| CHAIN | 0 |
| UI | 11 |
| BROWSER | 0 |
| NONE（未验） | 2（E13,E17；E18 为 Out 可选） |
| REAL 达标 | 8 / 16 必验（不含 E18） |
| **逐一校验** | **否** — 16 必验中 2 行 NONE、5 行仅 GATE；46 控件中 4 行 UNVERIFIED |
| 总体可否 REAL | **否** — 存在 NONE + 无 BROWSER + 测例 1 红 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T4 用户 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 6 smoke |
| T1 入口 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 头像未 UI 测 |
| T3 组织 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 新建未测 |
| T5 角色 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 编辑删未测 |
| T6 授权 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 筛选 NONE |
| T2 向导 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | done 启发式 |
| T7 RLS | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | 绑定保存不全 |
| T8 审计 | 2 | 2 | 1 | 1 | 2 | 8 | B | PARTIAL | 测例漂移 |
| T9 好用 | 1 | 1 | 1 | 2 | 2 | 7 | B | PARTIAL | 无真机·无模板 |

**T 总分（Bx 最低分加权）**：**7.2 / 10 · B**  
**打通但不对**（L≥2 且 C≤1）：0 条主链；**启发式/未验**导致 C=1：T2、T7、T9  
**假功能**（STUB/BROKEN）：无整页 BROKEN；E03/E06/E08/E10/E15 为 GATE 壳

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `npx vitest run src/pages/admin/system` | 31 passed | **30 passed, 1 failed** | ❌ | 2026-08-07 跑测；`audit.smoke` 日期 label |
| 2 | 用户停用 | POST disable → 徽章「已停用」 | 符合 | ✅ | T-AUTH-003-06 |
| 3 | 角色仅停用筛选 | GET `is_active=false` | mock 收到 false | ✅ | T-AUTH-001-04 |
| 4 | 授权新建 | POST 后列表含仪表板名 | 符合 | ✅ | T-AUTH-004-FE-03 |
| 5 | RLS 改维度名 | PUT body name 更新 | 符合 | ✅ | T-RLS-02 |
| 6 | 向导用户步 done | 有业务用户即绿 | `userTotal>1`（含 admin） | ⚠️ | `SystemAdminHomePage:113` 可能误判 |
| 7 | 审计日期筛选 | 见「筛选起始日期」 | UI 有；测例找「时间」 | ⚠️ | 功能在、测例过期 |

## 5. 修复文档

### P0 — 无（无 BROKEN 主链）

主路径 CRUD 在 smoke 层已通；无「点击即崩」级 P0。

### P1 — B53/B54 审计测例漂移（测试债）

**判定**：PARTIAL 7/10，C=2 功能在、测例错  
**期望 vs 实际**：测例找 `筛选起始时间`；组件 `aria-label="筛选起始日期"`  
**根因**：`audit.smoke.test.tsx:45-46` 与 `AuditLogPage.tsx:149-156` 不一致  
**修复方向**：改测例 label；补一条选日期后 `created_after` 出现在 query 的断言  
**修后验收**：audit smoke 4/4 绿；深度 UI

### P1 — E13 授权列表筛选（未验）

**判定**：UNVERIFIED  
**期望 vs 实际**：选角色/类型后表格行过滤；未执行  
**修复方向**：`grants.smoke` 增 T-AUTH-004-FE-06 筛选断言  
**修后验收**：L≥2 C≥2

### P1 — E08 用户解锁

**判定**：STUB GATE  
**期望 vs 实际**：锁定用户显示「解除锁定」且 POST unlock；仅代码审查  
**修复方向**：`users.smoke` mock `lockedUntil` 未来时间 + 点击解锁  
**修后验收**：REAL

### P2 — T2 向导完成判定

**判定**：PARTIAL C=1  
**期望 vs 实际**：应「除内置 admin 外另有业务用户」才绿；现 `userTotal > 1`  
**根因**：`SystemAdminHomePage.tsx:113`  
**修复方向**：改为 `userTotal > 1` 且排除 root/或 `businessUserCount > 0`  
**修后验收**：向导文案与真实进度一致

### P2 — E15 RLS 保存绑定

**判定**：STUB  
**期望 vs 实际**：勾选后「保存绑定」PUT；仅回填 GET 测  
**修复方向**：`rls.smoke` 补保存点击 + PUT 断言  
**修后验收**：PARTIAL→REAL

### P2 — B-7 岗位模板（产品）

**判定**：UNVERIFIED（optional）  
**修复方向**：向导空库「一键演示岗位」；非阻断「全部可用」

### P2 — 真机首租户走查

**判定**：NONE  
**修复方向**：`scenario-playbook` 从向导 → 授权 → 业务用户登录看板

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | E-audit-test | 修 audit 日期 label 测例 + 补 API 断言 |
| P1 | E13 | 授权 toolbar 筛选 smoke |
| P1 | E08 | 用户解锁 smoke |
| P2 | T2 | 向导 user 步 done 启发式 |
| P2 | E15 | RLS 保存绑定 POST smoke |
| P2 | E06/E10 | 组织新建、角色编辑删除 smoke |
| P2 | E17 | 真机 scenario-playbook |
| P3 | B-7 | 岗位模板（optional） |

## 7. 交接

- **结论**：后台管理 **基本可用（PARTIAL → 接近 REAL）**——P1/P2 修复已合入，vitest **40/40 绿**。
- **已修复（2026-08-07）**：
  - audit 日期 label 测例 + 搜索 debounce API 断言
  - 授权角色筛选 `T-AUTH-004-FE-06`
  - 用户解锁 `T-AUTH-003-07`
  - 向导用户步 done：排除当前登录管理员
  - RLS 保存绑定 PUT、组织新建 POST、角色编辑/删除 smoke
- **仍 open**：岗位模板（B-7 optional）· 真机 scenario-playbook
- 用户批准修复：**是**（「修复」）
