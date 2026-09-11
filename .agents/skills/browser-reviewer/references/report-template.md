# Report Template（真机走查报告）

走查结束必须按此结构输出。密码/Token 脱敏为 `***`。

```markdown
# [项目] 真机浏览器走查 · YYYY-MM-DD

## 总览

| 项 | 内容 |
|----|------|
| 范围 | 全功能 / 域… / 冒烟 |
| 剧本 | `.dev/playbooks/…/critical.md`（mode=auto\|specified）/ **无（降级 generic）** |
| active_env | local / staging / …（禁止未授权 prod） |
| Dev Card | browser_url…；api…；角色 admin；deploy/logs 摘要… |
| 浏览器后端 | MCP browser / Playwright / … |
| Viewport | desktop 1440×900；（+…） |
| Baseline | 有（n 张）/ 无；pixel mode=…；本次新收候选金样 n 张 |
| 产物目录 | `.dev/walkthrough/YYYY-MM-DD/`；证据工件 `.evidence/<run_id>/`（screenshot n 条） |
| 勾选 | 过 n · fail n · 跳过 n |
| Console error | n（白名单外） |
| P0 / P1 / P2 | n / n / n |
| 建议 | 真机可毕业 / 修完 P0 再宣布 / 暂缓 |

一句话结论：…

### Dev Card（摘要）

- active_env：…；地图：local/staging/prod 齐全否…
- 应用可达：是/否；browser_url…；api_url…；启动方式：…
- 部署/日志：deploy.location…；logs.url…（无则「未配置」）
- 登录：strategy=form；用户=`admin`；密码=已加载 / 生产地图无密码
- allow_writes / allow_destructive / allow_prod：…
- .dev gitignore：OK / **P0 已跟踪**

## Blind spots

| 项 | 说明 |
|----|------|
| … | 无浏览器 / 某域未启动 / … |

（有 Blind spot 时不得写「真机可毕业」。）

## 走查勾选表（摘要）

| ID | 步骤 | 结果 | 截图 |
|----|------|------|------|
| W1.2 | 登录 | 过 | `shots/W1.2-login-ok.png` |
| W3.… | … | fail | `shots/…-FAIL.png` |

（全文可放 artifact；此处保留 fail 与关键路径。）

## Console / 网络

| 级 | 次数 | 样例（脱敏） | 关联 step |
|----|------|--------------|-----------|
| error | n | `Uncaught TypeError:…` | W3.… |
| 5xx | n | `GET /api/… → 500` | … |

## 视觉 / 像素 / 风格

| ID | 类型 | 说明 | 证据 |
|----|------|------|------|
| V1 | 像素回归 | 与 baseline 差 3.2% | `baselines/…` vs `shots/…` |
| V2 | 风格 | 页头与金样不一致 | `shots/A` vs `shots/B` |

（无 baseline 时此表只写读图结论，**禁止**写百分比差值。）

## 待确认金样（新页自动收录 · 请批量过目）

| 路由 | viewport | 候选图 | 建议 |
|------|----------|--------|------|
| `/assets` | desktop | `baselines/_candidates/assets-desktop.png` | 认可 → 转正 / 不认可 → 走 UI 修复 |

一次看完比后期整批返工便宜。未确认的下次继续列。

## P0 Findings

### P0-1 · [短标题]

| 字段 | 内容 |
|------|------|
| 类别 | 功能 / Console / 网络 / 视觉 |
| 复现 | 1. … 2. … |
| 证据 | 截图 `…`；console `…` |
| 建议 | … |

## P1 Findings

### P1-1 · …

## P2 Findings

- …

## 非问题 / 白名单命中

| 项 | 原因 |
|----|------|
| React DevTools warning | allowlist |
| 只读跳过写操作 | allow_writes=false |

## 建议下一步（待确认）

| 选项 | 说明 |
|------|------|
| A 修 P0 功能/Console | 可本会话或转 code-reviewer |
| B 修视觉/风格 | 建议对齐 ui-ux-reviewer 标杆 |
| C 候选金样转正 | 认可的图从 `_candidates/` 移入 `.dev/baselines/` |
| D 补 `.dev` / gitignore | 配置或安全问题 |

**请确认**：要执行的修复选项。默认本 Skill 只交付报告与截图，不改业务代码。
```

## 截图在对话中的展示

向用户汇报 P0/P1 时，对关键 FAIL 截图使用 Read 读图并用文字描述问题；路径始终可点击/可复制。勿把整目录所有图无差别刷屏——**fail + 金样对照**优先。
