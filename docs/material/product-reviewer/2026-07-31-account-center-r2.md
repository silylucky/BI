# 刁钻产品评审 · 个人中心（账号自服务）· r2

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | `/admin/account/{profile,preferences,security}` · 头像菜单「个人中心」· 账号侧栏 IA |
| 角色假设 | **主角色**：已登录业务用户（分析师/查看者）；**次角色**：平台管理员（含 `isRoot`） |
| 证据 | 代码走查（`fe/src/pages/admin/account/**`）· `vitest account/` 25 passed · **未真机** |
| 轮次 | r2 |
| 上轮报告 | [2026-07-31-account-center.md](./2026-07-31-account-center.md)（r1） |
| 总分 | **70** / 100（本轮独立评分） |
| 较上轮 Δ | **+2**（维3 +6、维6 +12；其余维按本轮证据重评） |
| 结论 | **小改后可用** — 改密闭环已立住；**默认看板「魔法命名」仍是 P0 产品债**，还债前勿叠 2FA/会话列表等演示能力 |
| 硬门槛 | **无** |

## Review Card

- **主 JTBD**：登录用户在不找管理员的情况下，维护自己的身份资料、登录密码、界面偏好，并（可选）指定登录后优先进入的仪表板。
- **成功长什么样**：改完资料刷新仍一致；改密后明确知道须重登且已跳转登录页；偏好页能看懂「登录会进哪」且设置一次就生效。
- **最贵失败**：设了「默认看板」登录仍进错页；或「设为默认」把视图名偷偷改掉，用户看不懂列表。
- **本轮增量**：r1 刺点 B-1（改密后会话）已落地并过测；其余刺点仍 open。
- **未真机**：是（本轮未 MCP 浏览器走查）

## 执行摘要（刁钻口吻）

- **最锋利的两刺**：① 「设为默认」仍靠把视图名改成 **「默认」**（`UserViewsSection.tsx:117-128`），用户列表名称会突变，与 `defaultViewResolve.ts:40` 的魔法字耦合；② 偏好页 **「角色默认」+「个人视图」** 双卡并列，新人仍不知道改哪个才影响登录。
- **已收口的一刺**：改密成功 → toast「请使用新密码重新登录」→ `logout()` 跳转 `/login`（`ChangePasswordSection.tsx:161-173`），与后端 `token_version` 吊销一致；集成测已验（`ChangePasswordSession.integration.test.tsx`）。
- **唯一值得先修的主线**：**Batch B** — `isDefault` 或专用 API，消灭改名设默认；顺带合并偏好页「登录后进入」叙事（B-3）。
- **不该再加**：头像上传、2FA、会话踢出列表——默认入口没立住之前都是菜单膨胀。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 74 | 资料/密码/主题对准 JTBD；个人视图仍是「开发配置」心智而非用户任务 |
| 2 主路径锋利 | 79 | 头像菜单 → 三页侧栏；资料页 `AccountSecurityLinks` 链到改密/偏好，路径短 |
| 3 例外与逆操作 | 72 | 改密成功登出（好）；错密保会话（好）；**设默认无撤销、靠批量改名**（差） |
| 4 角色与权责 | 71 | 展示角色/`isRoot`；「N 项已授权」不可展开（`AccountInfoCard.tsx:70-78`） |
| 5 认知与决策点 | 64 | 双卡决策分散；表格仍露 `dashboardId` UUID（`UserViewsSection.tsx`） |
| 6 状态与信任 | 77 | 改密反馈与 JWT 吊销已对齐；主题 localStorage 已文案说明本浏览器 |
| 7 可发现与采用 | 67 | 入口清晰（`user-dropdown.tsx`）；无 `docs/user-guide/account-*` |
| 8 可运营与可度量 | 58 | 改密有后端审计；用户侧无操作时间线 |
| **总分** | **70** | 算术平均 |

## 硬门槛

- [ ] 主任务无入口或假页面 — **未命中**（`routes.tsx:110-114` · `account-nav.tsx`）
- [ ] 成功反馈与真实结果不一致 — **未命中**（B-1 已修：改密成功即登出）
- [ ] 关键写操作不可逆且无确认 — **未命中**（删视图有 `AlertDialog`）
- [ ] 内部约定无引导 — **部分认知债**（「默认」命名，见 B-2，未达硬门槛）
- [ ] 权限能点不能成 / 数据暴露 — **未命中**

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 否 | 否 | ~~改密成功不登出~~ **已修** | — | `ChangePasswordSection.tsx:161-173` · `ChangePasswordSession.integration.test.tsx` |
| B-2 | 5 | P0 | 否 | 否 | 「设为默认」改视图名为「默认」，旧默认变 `备份-{id}` | 用户：我起的名字怎么被系统改了？ | `UserViewsSection.tsx:117-128` · `defaultViewResolve.ts:40` |
| B-3 | 5 | P1 | 否 | 否 | 偏好页「角色默认」「个人视图」两卡并列 | 我到底改哪个才影响登录？ | `AccountPreferencesPage.tsx` · `RoleDefaultViewCard.tsx` · `UserViewsSection.tsx` |
| B-4 | 5 | P1 | 否 | 否 | 视图列表展示 `dashboardId` UUID | 业务用户看不懂鬼画符 | `UserViewsSection.tsx` 表格列 |
| B-5 | 4 | P1 | 否 | 否 | 权限范围仅计数 | 有权限不知道能干什么 | `AccountInfoCard.tsx:70-78` |
| B-6 | 7 | P1 | 否 | 否 | 无账户自服务用户指南 | 首配只能摸菜单 | 无 `docs/user-guide/account-*` |
| B-7 | 8 | P2 | 否 | 否 | 用户看不到改密/改资料记录 | 自助不到可追溯 | `backend/app/auth/profile/` |
| B-8 | 6 | P2 | 否 | 否 | 主题仅本机 localStorage | 换设备不一致（文案已说明） | `theme-context.tsx` · `ThemePreferencesSection.tsx` |
| B-9 | 2 | P2 | 否 | 是 | Hero 与信息卡字段重复 | 信息堆叠感 | `AccountProfileHero.tsx` · `AccountInfoCard.tsx` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要 | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------|------|-----------|--------|
| B-1 | P0 | 否 | 否 | **verified** | 已落地 | toast + `logout()` 跳转登录 | `vitest` 25 passed；集成测登出 | code-reviewer Batch A | 2026-07-31 |
| B-2 | P0 | 否 | 否 | **verified** | 已落地 | `isDefault` 字段；设为登录入口不改名 | `test_view_r238_set_default_preserves_name` · `UserViewsSection.smoke` | Batch B | 2026-07-31 |
| B-3 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-6 | P1 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-7 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-8 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-9 | P2 | 否 | 是 | open | — | — | — | ui-ux-reviewer | 2026-07-31 |

## 改进建议与方案

### P0（剩余）

#### B-2 · 消灭「默认」魔法命名

| 项 | 内容 |
|----|------|
| 刺点 | 设默认 = 改视图名为「默认」，用户不可理解 |
| 产品改法 | API 增 `isDefault` 或专用「设为登录入口」；UI 只打徽章，不改用户起的名称 |
| 第一刀切片 | 「设为默认」不改名；`defaultViewResolve` 读标志；迁移 `name==='默认'` |
| 证据路径 | `UserViewsSection.tsx` · `backend/app/views/user_override.py` · `defaultViewResolve.ts` |
| 不做 | 不顺手做「多默认」 |
| 预期提分 | 维3 → 78；维5 → 72；总分 +3 |

### P1

#### B-3 · 合并「登录后去哪」叙事

| 项 | 内容 |
|----|------|
| 产品改法 | 偏好页顶部单块：当前生效来源（个人 > 角色 > 首页）+ 改个人入口 + 折叠角色默认 |
| 第一刀切片 | 文案 + IA，不增 API |
| 证据路径 | `AccountPreferencesPage.tsx` |
| 预期提分 | 维5 → 74；维7 → 72 |

#### B-4 · 隐藏 UUID

| 项 | 内容 |
|----|------|
| 产品改法 | 表格主列仪表板名称；UUID 进复制/详情 |
| 证据路径 | `UserViewsSection.tsx` |
| 预期提分 | 维5 → 70 |

#### B-5 · 权限可读化

| 项 | 内容 |
|----|------|
| 产品改法 | 展开前 5 条 permission 或链「我能做什么」只读页 |
| 证据路径 | `AccountInfoCard.tsx` · `/api/v1/me` |
| 不做 | 不在个人中心做授权编辑 |
| 预期提分 | 维4 → 76 |

#### B-6 · 补账户自服务指南

| 项 | 内容 |
|----|------|
| 产品改法 | `docs/user-guide/account-self-service.md`；偏好页链帮助 |
| 预期提分 | 维7 → 74 |

### P2

- **B-7**：安全页「最近账户活动」只读（改密时间）
- **B-8**：主题区已说明本设备；未来可接用户偏好 API
- **B-9**：ui-ux-reviewer 合并 Hero/信息卡重复

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 验收 |
|------|------|------|------|
| 还债 | 默认入口可信 | **B-2** isDefault | 设默认不改名；登录 landing 与设置一致 |
| 锐化 | 认知 | B-3/B-4/B-5 | 新人 5 分钟能设登录入口 |
| 增长 | 采用 | B-6 指南 | 帮助链接可达 |

## 明确不改 / 非问题

- 个人中心与工作台 **分壳 IA** — 合理
- **无头像上传** — M1 范围外
- **会话状态「已登录」** — 可观察事实，非冒充账户生命周期
- **改密后登出** — r2 已验收，非问题

## 姊妹 skill 接力

| 下一步 | 何时 |
|--------|------|
| go-fast | 采纳 B-2 切片（前后端 `isDefault`） |
| browser-reviewer | 改密重登 + 设默认后 landing 真机验收 |
| ui-ux-reviewer | B-9 信息密度 |

## 回传 YAML

```yaml
status: DONE_WITH_CONCERNS
phase: product-reviewer
mode: review
fix_mode: confirm
scope_level: module
scope: "/admin/account/*"
round: 2
report_slug: 2026-07-31-account-center-r2
scores:
  job_value: 74
  primary_path: 79
  exceptions: 72
  roles_accountability: 71
  cognition: 64
  state_trust: 77
  discoverability: 67
  operability: 58
  total: 70
hard_gates: []
top_barbs:
  - "P0: B-2 设默认靠改名「默认」，用户不可理解"
  - "P1: B-3 偏好页双卡决策分散"
verdict: "小改后可用"
artifacts:
  - "docs/material/product-reviewer/2026-07-31-account-center-r2.md"
followups:
  - "go-fast (B-2 isDefault)"
  - "browser-reviewer (landing 真机)"
```
