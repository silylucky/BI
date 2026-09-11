# VitalSpan 真机浏览器走查 · 2026-08-09

## 总览

| 项 | 内容 |
|----|------|
| 范围 | 后台管理首租户主路径（`/admin/system/*`） |
| 剧本 | `.dev/playbooks/2026-08-09/critical.md`（mode=specified） |
| active_env | local |
| Dev Card | browser `http://localhost:5173/admin` · api `http://localhost:8000` · 角色 admin · 密码已加载（`backend/.env`） |
| 浏览器后端 | MCP browser（cursor-ide-browser） |
| Viewport | desktop 1440×900（默认） |
| Baseline | **无**；本次新收候选金样 6 张 |
| 产物目录 | `.dev/walkthrough/2026-08-09/shots/` |
| 写边界 | `allow_writes=false` · `allow_destructive=false` |
| 勾选 | 过 **22** · fail **0** · 跳过 **3**（写提交步按边界取消） |
| Console error | **0**（走查段内未捕获） |
| P0 / P1 / P2 | **0** / **0** / **1** |
| 建议 | **只读走查可毕业**；完整首租户闭环需开启 `allow_writes` 后复跑 |

一句话结论：在只读边界下，配置向导与各管理页表单均可达、文案与剧本一致，侧栏最长路径匹配正常，未发现阻断性运行时错误。

### Dev Card（摘要）

- active_env：local；`.dev/config.yaml` 齐全
- 应用可达：是；health `200`；fe `pnpm dev` + backend `:8000` 已运行
- 登录：strategy=form；用户=`admin`；密码=已加载（报告脱敏）
- allow_writes / allow_destructive / allow_prod：false / false / false
- .dev gitignore：OK（walkthrough 证据在 gitignore 路径）

## Blind spots

| 项 | 说明 |
|----|------|
| G0.3/G0.4 登录流 | 浏览器已有 admin 会话，未重跑 `/login` 表单（非阻断） |
| 写提交闭环 | `allow_writes=false`，S2～S5 均在确认框前取消 |
| optional O1 | 未切换 analyst 账号验资源可见性 |
| 像素 diff | 无 `.dev/baselines/` 正式金样，仅人工读图 |

## 走查勾选表（摘要）

| ID | 步骤 | 结果 | 截图 |
|----|------|------|------|
| S0.1 | health 200 | 过 | — |
| S0.2 | 应用可打开 | 过（沿用会话） | — |
| S1 | 配置向导四步 + 进度文案 | 过 | `shots/S1-wizard.png` |
| S2 | 组织架构 · 新建组织对话框 · 取消 | 过（只读） | `shots/S2-org-create-dialog.png` |
| S3 | 角色管理 · 新建角色对话框 · 取消 | 过（只读） | `shots/S3-role-create-dialog.png` |
| S4 | 用户管理 · 创建用户对话框 · 取消 | 过（只读） | `shots/S4-user-create-dialog.png` |
| S5 | 资源授权 · 新建授权对话框 · 取消 | 过（只读） | `shots/S5-grant-create-dialog.png` |
| S6 | 侧栏单项高亮（`/grants` 仅「资源授权」active） | 过 | `shots/S6-nav-grants.png` |

## Console / 网络

| 级 | 次数 | 样例 | 关联 step |
|----|------|------|-----------|
| error | 0 | — | — |
| 5xx | 0 | 主路径 API 正常 | S1～S5 |

## 视觉 / 像素 / 风格

| ID | 类型 | 说明 | 证据 |
|----|------|------|------|
| V1 | 读图 | 页头、对话框、空态与 TailAdmin 风格一致；无遮挡/溢出 | 各 `shots/*.png` |
| V2 | 数据噪声 | 组织树含大量 `RLS Bind Org*` 测试节点（60+），列表可读性一般 | `S2` 背景 |

（无 baseline，未做数字像素 diff。）

## 待确认金样（新页自动收录 · 请批量过目）

| 路由 | viewport | 候选图 | 建议 |
|------|----------|--------|------|
| `/admin/system` | desktop | `.dev/baselines/_candidates/system-admin-S1-wizard.png` | 认可 → 转正 |
| `/admin/system/orgs` | desktop | `…/system-admin-S2-org-create-dialog.png` | 认可 → 转正 |
| `/admin/system/roles` | desktop | `…/system-admin-S3-role-create-dialog.png` | 认可 → 转正 |
| `/admin/system/users` | desktop | `…/system-admin-S4-user-create-dialog.png` | 认可 → 转正 |
| `/admin/system/grants` | desktop | `…/system-admin-S5-grant-create-dialog.png` | 认可 → 转正 |
| `/admin/system/grants` | desktop | `…/system-admin-S6-nav-grants.png` | 认可 → 转正 |

## P0 Findings

（无）

## P1 Findings

（无）

## P2 Findings

### P2-1 · 组织树测试数据噪声

- **现象**：`/admin/system/orgs` 列表充斥 `RLS Bind Org*` 重复命名节点，影响演示观感。
- **复现**：登录 admin → 组织架构。
- **证据**：`shots/S2-org-create-dialog.png` 背景列表。
- **建议**：演示环境清理或隔离 RLS 测试种子；产品层可增加「仅业务组织」筛选（非阻断）。

## 后续建议

1. 若要验证书写闭环：将 `.dev` `walkthrough.allow_writes` 临时设为 `true`，复跑 S2～S5 提交步 + optional O1。
2. 认可上表金样后，将 `_candidates/` 移入 `.dev/baselines/` 供下次像素回归。
3. 资源授权当前为空（向导第 4 步「去配置」），与概览「资源授权 0」一致，属数据状态而非缺陷。

---

```yaml
status: DONE_WITH_CONCERNS
phase: browser-reviewer
mode: review
scope: system-admin-first-tenant S0-S6
report: docs/material/browser-reviewer/2026-08-09-system-admin-first-tenant.md
env:
  active_env: local
  base_url: http://localhost:5173/admin
  backend: mcp
playbook:
  source: business
  path: .dev/playbooks/2026-08-09/critical.md
steps:
  total: 25
  passed: 22
  failed: 0
  skipped: 3
console_errors:
  error: 0
  warning: 0
  network_failures: 0
evidence:
  screenshots:
    - .dev/walkthrough/2026-08-09/shots/S1-wizard.png
    - .dev/walkthrough/2026-08-09/shots/S2-org-create-dialog.png
    - .dev/walkthrough/2026-08-09/shots/S3-role-create-dialog.png
    - .dev/walkthrough/2026-08-09/shots/S4-user-create-dialog.png
    - .dev/walkthrough/2026-08-09/shots/S5-grant-create-dialog.png
    - .dev/walkthrough/2026-08-09/shots/S6-nav-grants.png
  baseline_diff: false
  gold_candidates:
    - .dev/baselines/_candidates/system-admin-S1-wizard.png
    - .dev/baselines/_candidates/system-admin-S2-org-create-dialog.png
    - .dev/baselines/_candidates/system-admin-S3-role-create-dialog.png
    - .dev/baselines/_candidates/system-admin-S4-user-create-dialog.png
    - .dev/baselines/_candidates/system-admin-S5-grant-create-dialog.png
    - .dev/baselines/_candidates/system-admin-S6-nav-grants.png
findings:
  - id: P2-1
    severity: P2
    step: S2
    route: /admin/system/orgs
    screenshot: .dev/walkthrough/2026-08-09/shots/S2-org-create-dialog.png
    repro: 打开组织架构页查看列表
remaining:
  - 登录流未重跑（已有会话）
  - 写提交闭环未验（allow_writes=false）
  - optional O1 analyst 登录未跑
coverage:
  blind_spots:
    - G0.3 登录表单 | 已有会话，未重跑
    - 写提交 | allow_writes=false 主动跳过
blockers: []
followups:
  - 开启 allow_writes 后复跑写步与 O1
  - 批量确认金样转正
```
