# 刁钻产品评审 · 个人中心（账号自服务）· r3

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | `/admin/account/{profile,preferences,security}` · 头像菜单「个人中心」· 账号侧栏 IA |
| 角色假设 | **主角色**：已登录业务用户（分析师/查看者）；**次角色**：平台管理员（含 `isRoot`） |
| 证据 | 代码走查（`fe/src/pages/admin/account/**` · `defaultViewResolve.ts` · `backend/app/views/user_override.py`）· `vitest account/` 26 passed · **未真机** |
| 轮次 | r3 |
| 上轮报告 | [2026-07-31-account-center-r2.md](./2026-07-31-account-center-r2.md) |
| 总分 | **72** / 100（本轮独立评分） |
| 较上轮 Δ | **+2**（维1 +1、维3 +6、维5 +2、维6 +3；其余按证据重评） |
| 结论 | **小改后可用，核心自服务可交付** — P0 债已清；剩余为认知锐化（B-3/B-4）与采用文档（B-6），可边用边补 |
| 硬门槛 | **无** |

## Review Card

- **主 JTBD**：登录用户在不找管理员的情况下，维护自己的身份资料、登录密码、界面偏好，并（可选）指定登录后优先进入的仪表板。
- **成功长什么样**：改资料一致；改密后自动到登录页用新密码；设「登录入口」不改名且登录落点一致。
- **最贵失败**：仍剩认知债——新人不知「角色默认 vs 个人视图」优先级；表格 UUID 干扰理解。
- **本轮增量**：B-1（改密登出）、B-2（`isDefault` / 「设为登录入口」）均已落地并过测。
- **未真机**：是

## 执行摘要（刁钻口吻）

- **P0 已清零**：改密成功 → toast + `logout()`（`ChangePasswordSection.tsx:161-173`）；设登录入口靠 `isDefault`，**不改视图名**（`UserViewsSection.tsx:117-119` · `user_override.py` · `defaultViewResolve.ts`）。
- **仍刺的两处**：① 偏好页三卡（主题 / 角色默认 / 个人视图）无统一「登录后会进哪」叙事（B-3）；② 视图表仍露 `dashboardId` UUID（B-4）。
- **可交付边界**：资料读写、改密闭环、主题切换、个人登录入口配置——**可给业务用户用**；别在 B-3/B-6 未补前宣传「零培训上手」。
- **别加**：2FA、会话列表、头像上传——锐化与文档债未清前仍是菜单膨胀。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 75 | 登录入口从「魔法命名」变为可理解任务；主题/资料/改密仍对准 JTBD |
| 2 主路径锋利 | 79 | 头像菜单 → 三页侧栏；`AccountSecurityLinks` 快捷链未变 |
| 3 例外与逆操作 | 78 | 改密成功登出、错密保会话；设登录入口可逆（再点另一行）；删视图有确认 |
| 4 角色与权责 | 71 | 角色/`isRoot` 可见；权限仍仅计数（`AccountInfoCard.tsx:70-78`） |
| 5 认知与决策点 | 66 | 「登录入口」徽章优于改名；双卡 + UUID 仍分散决策 |
| 6 状态与信任 | 80 | 改密与 JWT 吊销对齐；`isDefault` 与 landing 解析一致（含旧数据迁移） |
| 7 可发现与采用 | 67 | 入口清晰；仍无 `docs/user-guide/account-*` |
| 8 可运营与可度量 | 58 | 后端审计有；用户不可见操作时间线 |
| **总分** | **72** | 算术平均 |

## 硬门槛

- [ ] 主任务无入口或假页面 — **未命中**
- [ ] 成功反馈与真实结果不一致 — **未命中**（B-1、B-2 已修）
- [ ] 关键写操作不可逆且无确认 — **未命中**
- [ ] 内部约定无引导 — **部分认知债**（B-3 优先级未写进 UI，未达硬门槛）
- [ ] 权限能点不能成 / 数据暴露 — **未命中**

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据 |
|----|----|--------|--------|--------|------|----------|------|
| B-1 | 6 | P0 | 否 | 否 | **已修** 改密后登出 | — | `ChangePasswordSection.tsx:161-173` |
| B-2 | 5 | P0 | 否 | 否 | **已修** `isDefault` + 「设为登录入口」 | — | `UserViewsSection.tsx:117-119` · `user_override.py` |
| B-3 | 5 | P1 | 否 | 否 | 偏好页三卡无统一「登录后进入」说明 | 新人：改主题还是改看板？ | `AccountPreferencesPage.tsx` |
| B-4 | 5 | P1 | 否 | 否 | 列表仍展示 `dashboardId` | 业务用户被 UUID 吓到 | `UserViewsSection.tsx` 仪表板列 |
| B-5 | 4 | P1 | 否 | 否 | 权限仅「N 项已授权」 | 不知道能干什么 | `AccountInfoCard.tsx:70-78` |
| B-6 | 7 | P1 | 否 | 否 | 无账户自服务指南 | 首配靠摸 | 无 `docs/user-guide/account-*` |
| B-7 | 8 | P2 | 否 | 否 | 无用户可读操作记录 | 出事找管理员查库 | `backend/app/auth/profile/` |
| B-8 | 6 | P2 | 否 | 否 | 主题仅本机 | 文案已说明 | `ThemePreferencesSection.tsx` |
| B-9 | 2 | P2 | 否 | 是 | Hero 与信息卡重复 | 堆信息感 | `AccountProfileHero.tsx` · `AccountInfoCard.tsx` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要 | 验证 | 更新于 |
|----|--------|--------|--------|------|----------|----------|------|--------|
| B-1 | P0 | 否 | 否 | **verified** | — | toast + logout | 集成测 + 26 vitest | 2026-07-31 |
| B-2 | P0 | 否 | 否 | **verified** | — | `isDefault` API + UI | `test_view_r238_set_default_preserves_name` | 2026-07-31 |
| B-3 | P1 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-6 | P1 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-7 | P2 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-8 | P2 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-9 | P2 | 否 | 是 | open | — | — | — | 2026-07-31 |

## 改进建议（剩余 P1 优先）

### B-3 · 偏好页「登录后进入」单叙事（第一刀）

| 项 | 内容 |
|----|------|
| 产品改法 | `AccountPreferencesPage` 顶部 Alert/说明块：优先级 **个人登录入口 > 角色默认 > 工作台首页**；链到下方对应卡 |
| 第一刀 | 纯文案 + 折叠「查看角色默认」；不增 API |
| 证据路径 | `AccountPreferencesPage.tsx` |
| 预期提分 | 维5 → 72；维7 → 70 |

### B-4 · 隐藏 UUID

| 项 | 内容 |
|----|------|
| 产品改法 | 表格主列只显示仪表板名称；ID 放复制菜单或开发者折叠 |
| 证据路径 | `UserViewsSection.tsx` |
| 预期提分 | 维5 → 70 |

### B-6 · 用户指南

| 项 | 内容 |
|----|------|
| 产品改法 | `docs/user-guide/account-self-service.md`；偏好页链帮助 |
| 预期提分 | 维7 → 74 |

## 能力交付判定

| 能力 | 可交付？ | 说明 |
|------|----------|------|
| 个人资料查看/编辑 | ✅ | PATCH `/me` + FE 测 |
| 修改密码 | ✅ | 成功登出闭环 |
| 界面主题 | ✅ | localStorage，文案已说明本机 |
| 个人登录入口 | ✅ | `isDefault`，不改名 |
| 角色默认（只读） | ✅ | 只读展示 |
| 零培训上手 | ⚠️ | 缺 B-3/B-6 |

## 姊妹 skill 接力

| 下一步 | 何时 |
|--------|------|
| go-fast | B-3 偏好页叙事（小改） |
| browser-reviewer | 改密重登 + 设登录入口后 landing 真机 |
| ui-ux-reviewer | B-4 UUID 隐藏 + B-9 信息密度 |

## 回传 YAML

```yaml
status: DONE_WITH_CONCERNS
phase: product-reviewer
mode: review
fix_mode: confirm
scope_level: module
scope: "/admin/account/*"
round: 3
report_slug: 2026-07-31-account-center-r3
scores:
  job_value: 75
  primary_path: 79
  exceptions: 78
  roles_accountability: 71
  cognition: 66
  state_trust: 80
  discoverability: 67
  operability: 58
  total: 72
hard_gates: []
top_barbs:
  - "P1: B-3 偏好页缺「登录后进入」统一叙事"
  - "P1: B-4 视图列表仍露 dashboardId UUID"
verdict: "小改后可用，核心自服务可交付"
artifacts:
  - "docs/material/product-reviewer/2026-07-31-account-center-r3.md"
followups:
  - "go-fast (B-3 叙事)"
  - "browser-reviewer (landing 真机)"
```
