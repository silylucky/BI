---
name: user-guide-writer
description: >
  面向终端用户的帮助文档 / 用户手册写作与改写：任务导向、可读结构、精确 UI 文案、按需排障；
  禁止模板复读、实现细节外泄、概念文硬套「逐步操作」。生成或重写 help/manual 时使用，确保用户
  便于理解、阅读体验更好。Use when writing or rewriting in-app help, user manuals, getting-started
  guides, how-to articles, concept explainers, troubleshooting for end users; when help content is
  AI-template spam, vague "以 UI 为准", copy-pasted 401/403 blocks, cookie/session internals in
  beginner docs, or slug-only related links — distinct from docs-reviewer (engineering api/adr docs).
---

# User Guide Writer（用户手册 · 可读优先）

写给**人用产品**的帮助中心与用户手册。Agent 已会写 Markdown；本 Skill 补：**读者模型**、**文型分流**、**反模板复读**、**任务导向步骤**、**排障按需**、**验收清单**。

与 [docs-reviewer](../docs-reviewer/SKILL.md) 分工：`docs/api|adr|domain|service…` 给研发与运维；**本 Skill** 给登录用户/管理员的 **help / manual / getting-started**。不要把工程文档口吻塞进帮助中心。

## 何时启用

| 场景 | 动作 |
|------|------|
| 新功能补帮助文 | 定文型 → 对照 UI 写步骤 → 自检清单 |
| 批量「生成帮助」后质量差 | 按反模式重写，禁止只换标题套同一骨架 |
| 用户手册 / 上手指南改版 | 信息架构 + 文型矩阵 + 逐篇改写 |
| 评审现有 help 是否可读 | 用反模式与清单打分，再改 |

**不要**：把 OpenAPI/Cookie/内部路由当新手主线；为凑结构每篇粘贴相同 401/403；用「以 UI 为准」代替真实文案。

## 必读顺序（≤3 次）

1. 本文件「读者与文型」+「硬规则」+「写作流程」
2. [references/anti-patterns.md](references/anti-patterns.md) + [references/voice-and-structure.md](references/voice-and-structure.md)
3. 落笔用 [references/templates.md](references/templates.md)；交稿前 [references/quality-checklist.md](references/quality-checklist.md)

## 读者模型（落笔前写清）

每篇（或每批）先回答，可极短写在草稿头，不必全部进正文：

| 问 | 要求 |
|----|------|
| 谁 | 角色（新人 / 项目成员 / 开发者 / 管理员），忌「所有人」却写超管路径 |
| 要完成什么事 | **目标句**用用户语言（「把同事加进项目」），不用功能名堆砌 |
| 已知什么 | 是否已会登录、是否已有项目 |
| 成功长什么样 | 用户屏幕上能确认的结果（不是内部 URL 正则） |
| 失败时最可能卡在哪 | 只写**本稿相关**的 1～3 条，禁止宇宙排障 |

## 文型（先选型，再套模板）

| 文型 | 何时 | 主体结构 | 禁止 |
|------|------|----------|------|
| **概念 Concept** | 讲清楚模型/术语 | 是什么 → 为何重要 → 关系/边界 → 下一步链到任务文 | 「逐步操作」编号假步骤 |
| **任务 How-to** | 完成一件事 | 目标 → 你将需要 → 步骤（精确 UI）→ 如何确认成功 → 相关任务 | 空泛「进入某某模块」 |
| **参考 Reference** | 字段/权限/限额表 | 表格式；短说明 | 伪装成教程长文 |
| **排障 Troubleshoot** | 症状驱动 | 症状 → 原因 → 处理 → 仍不行时找谁 | 与任务文重复粘贴同一段 |

一篇只主打一种文型。登录文 ≠ 已登录才能做的任务文。

## 硬规则

1. **任务导向标题**：`邀请成员加入项目` ✅；`成员模块说明` / 纯路由名 ❌。
2. **UI 文案必须可核对**：按钮、菜单、页名与产品**一致**（对照前端或真机）；未知标 `待核对：…`，禁止「以 UI 为准」糊弄。
3. **一步一动作**：每步一个用户动作 + 可选「你会看到…」；不把三个界面塞进一步。
4. **排障按需**：只写本稿会触发的失败；全局登录过期 → 链到「登录与会话」一文，**禁止** 50 篇复制同一 401/403 段。
5. **实现细节分层**：Cookie 名、HttpOnly、内部 path、API 码 → 默认不进新手/任务文；若开发者需要，单独「参考/开发者」文并标明受众。
6. **相关链接用可读标题**：`[核心概念：组织与项目](...)` ✅；`[concepts](...)` ❌。
7. **前置条件要成真**：写「登录」的文，前置条件不得要求「已登录」；权限写**具体角色/权限名**，禁止「具备本操作所需权限」套话。
8. **禁止骨架复读**：多篇若除标题外结构句高度雷同 → 视为不合格，必须按文型重写。
9. **先读真 UI / 真路由再写**：有代码或可运行环境时对照；无则列出待核对项，不臆造控件。

## 好文档长什么样（验收直觉）

- 扫读 30 秒能知道「这篇让我完成什么」。
- 按步骤点，不需要猜菜单叫什么。
- 概念文读完能画关系，不会被迫「执行」假步骤。
- 排障像医生问诊，不像粘贴的服务器错误码表。
- 关联文是「下一步自然去哪」，不是 slug 列表。

## 写作流程

```
1. 定读者 + 目标句 + 文型
2. 对照 UI（或待核对清单）列出真实入口与控件文案
3. 套 templates 对应文型；删掉不适用的节（宁缺毋套话）
4. 相关文档：上一篇/下一篇/深入，用可读标题
5. 跑 quality-checklist；不过则改，禁止「先交后补」
```

批量生成时：**每篇独立目标句**；共享仅允许「术语表」「登录」等真正共享篇，用链接引用。

## 与反例（业务帮助常见翻车）

典型不合格信号（完整表见 anti-patterns）：

- 全文同一套「已登录 + nex_session + 401/403/页面无入口」
- 概念文也写「逐步操作：1.记住 A 2.记住 B」
- 登录文前置条件要求已登录
- 步骤靠「侧栏进入某某或对应列表」「或以 UI 为准」
- 相关文档链接文字是文件名 slug

## 禁止

- 为凑 frontmatter/模板每节必填而写空话  
- 把用户手册写成 API changelog  
- 无核对 UI 就批量产出几十篇同构「帮助」  
- 用工程 `docs-reviewer` 的 api/adr 模板写 help  

## 关联

- [anti-patterns.md](references/anti-patterns.md) · [voice-and-structure.md](references/voice-and-structure.md)
- [templates.md](references/templates.md) · [quality-checklist.md](references/quality-checklist.md)
- 工程文档：[docs-reviewer](../docs-reviewer/SKILL.md)
- 真机核对文案：[browser-reviewer](../browser-reviewer/SKILL.md)
