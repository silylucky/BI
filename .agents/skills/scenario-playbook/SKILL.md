---
name: scenario-playbook
description: >
  从代码仓库自动发现或按用户指定流程，生成核心业务场景的可执行走查剧本（逐步操作、期望、
  路由/UI 触点、写操作边界），供 browser-reviewer 真机执行；也可给 QA/手工验收。
  Use when generating walkthrough playbooks, critical-path scenarios, browser test scripts,
  E2E scenario steps, or before browser-reviewer when no playbook exists; when the user asks
  for 走查剧本 / 关键场景 / 操作验证步骤 / 指定流程展开成剧本 — Console/Admin/SPA.
---

# Scenario Playbook（场景剧本 · 供走查消费）

技术栈无关的**走查剧本作者**。只产剧本与勾选骨架，**不**打开浏览器、不截图、不改业务代码。

与姊妹 skill：

| Skill | 关系 |
|-------|------|
| **本 Skill** | 发现/指定场景 → 拆步骤 → 写出可执行剧本 |
| [browser-reviewer](../browser-reviewer/SKILL.md) | **消费**本产物做真机点选 + 截图 + Console |
| [create-dev-config](../create-dev-config/SKILL.md) | 缺 `.dev` 时先交互写出配置（allow_* / 账号） |
| [docs-reviewer](../docs-reviewer/SKILL.md) | `docs/domain` Process Test Pack 是重要输入源 |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) | 路由/菜谱可作场景覆盖参考，本 Skill 不替代静态 UI 审 |

## 何时启用

| 场景 | 动作 |
|------|------|
| 用户要走查 / 真机验收，但未给流程 | **自动发现**关键场景 → 写剧本 → 建议接着跑 browser-reviewer |
| 用户指定一条或多条业务流程 | **指定模式**：只展开指定流程，不擅自加主场景（可附「建议增补」附录） |
| 只要剧本不要跑浏览器 | 产出 Markdown 后停；路径告诉用户 |
| browser-reviewer 发现无剧本 | 先本 Skill 生成，再回去走查 |

**不要**：替 browser-reviewer 执行点击；用剧本掩盖未实现功能（stub 场景标 `blocked`）；未确认把破坏性步骤标为默认可执行。

## 必读顺序（≤3 次）

1. 本文件「双模式」+「流程」+「硬规则」
2. [references/playbook-format.md](references/playbook-format.md) + [references/discovery.md](references/discovery.md)
3. 执行细节 [references/scan-workflow.md](references/scan-workflow.md)

## 双模式（必须先判定）

| 模式 | 判定 | 行为 |
|------|------|------|
| **指定** | 用户给出流程名、步骤大纲、PRD 片段、或「只测 X」 | 仅展开这些场景为完整步骤；附录可列「发现但未纳入」的建议场景 |
| **自动** | 未指定流程，或说「关键路径 / 帮我扫一遍该测什么」 | 按 [discovery.md](references/discovery.md) 扫仓 → 选出 **核心关键场景** → 全部拆步 |

混淆时问一句；用户说「你看着办」→ **自动**。

## 产出位置

默认（优先可写且 gitignore 友好）：

```
.dev/playbooks/<YYYY-MM-DD>/
├── README.md           # 索引：模式、场景列表、交给 browser-reviewer 的入口
├── critical.md         # 主剧本（browser-reviewer 默认读这个）
└── optional.md         # 可选/建议增补（指定模式的附录，或自动模式的 P2 场景）
```

若无 `.dev/`：写到 `docs/qa/playbooks/<YYYY-MM-DD>/`，并**提示先跑 [create-dev-config](../create-dev-config/SKILL.md)** 补 `.dev`（写边界与账号才能安全交给 browser-reviewer）。  
格式必须符合 [playbook-format.md](references/playbook-format.md)，否则 browser-reviewer 拒收。

## 硬规则

1. **先定模式，再扫/再写**：指定模式禁止把自动发现的场景塞进主剧本（附录除外）。
2. **步骤可执行**：每步含：在哪（路由/菜单文案）、做什么（点击/填写）、期望什么、失败长什么样；禁止「验证下单功能」这类空话。
3. **核心优先**：自动模式主剧本只收 **P0/P1 关键路径**（登录壳 + 宣称已交付的主业务闭环）；全路由 CRUD 地毯式留给 browser-reviewer 通用幕或 optional。
4. **写操作边界**：尊重 `.dev` 的 `allow_writes` / `allow_destructive`（若可得）；不可得则步骤标 `needs_confirm`，默认只读打开到确认框为止。
5. **真源**：路由/文案/状态从代码或 `docs/domain` 抄；抄不到标 `待确认`，禁止臆造菜单名。
6. **交接清晰**：写完给出「下一步：用 browser-reviewer，剧本路径=…」；用户只要剧本则停。
7. **不执行浏览器**：本 Skill 只读代码与文档写 Markdown。

---

## 流程（必须）

### Phase 0 · Playbook Card

| 探测 | 产出 |
|------|------|
| 模式 | 指定 / 自动 |
| 指定内容 | 用户流程原文或要点（指定模式） |
| 前端根 / 路由 / 菜单 | 路径摘要 |
| docs/domain | 是否有 Process Test Pack |
| `.dev` | 有无；allow_writes / roles |
| 宣称材料 | README「已支持」能力 |

### Phase 1 · 场景清单

- **指定**：用户流程 → 场景 ID 列表（通常 1～N 条）  
- **自动**：按 discovery 打分 → 排序 → 截取核心（建议主剧本 **3～8** 条场景；过多则拆 optional）

输出场景表后再写步骤（可短暂停：用户若立刻改清单则按改后的写）。

### Phase 2 · 拆步写剧本

每场景套 playbook-format：前置夹具 → 逐步操作 → 期望 → 证据（截图点）→ 关联 API/文档。  
合并幕 0/1（预检+登录）一次即可，勿每个场景重复登录除非多角色。

### Phase 3 · 交接

- 写 `README.md` 索引  
- 回传：模式、场景数、主剧本路径、blocked/待确认项  
- 默认建议：接着 [browser-reviewer](../browser-reviewer/SKILL.md)（用户拒绝则停）

---

## 进度清单

```
- [ ] 0. Playbook Card + 模式判定
- [ ] 1. 场景清单（指定展开 / 自动发现排序）
- [ ] 2. critical.md（+ 按需 optional.md）步骤齐全
- [ ] 3. README 索引 + 交接 browser-reviewer 路径
```

## 落盘位置

| 产物 | 位置 | 说明 |
|------|------|------|
| 剧本本体 | `.dev/playbooks/<YYYY-MM-DD>/`（无 `.dev` → `docs/qa/playbooks/<YYYY-MM-DD>/`） | 可执行产物，browser-reviewer 直接消费 |
| 回报摘要 | `docs/material/scenario-playbook/<YYYY-MM-DD>-<slug>.md` | 模式、场景表、blocked/待确认、交接指引；剧本只链不复制 |

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: scenario-playbook
mode: specified | auto
report: ""                  # docs/material/scenario-playbook/<YYYY-MM-DD>-<slug>.md
playbooks: []               # 剧本文件路径（README.md / critical.md / optional.md 全列）
playbook_root: ""           # .dev/playbooks/<YYYY-MM-DD>/ 或 docs/qa/playbooks/<YYYY-MM-DD>/
scenario_count:
  total: 0
  critical: 0               # 主剧本 P0/P1 场景
  optional: 0
  blocked: 0
blocked:                    # 写成剧本但不可执行的场景
  - id: ""
    title: ""
    reason: ""              # stub / 即将推出 / 缺夹具 / 缺权限
write_boundary: from_dev_config | needs_confirm   # 无 .dev allow_* 时为 needs_confirm
remaining: []               # 待确认路由·文案、未纳入的建议场景
coverage:
  blind_spots: []           # `来源 | 未覆盖流程或路由 | 原因`；非空 → status 禁止 DONE
  sources_read: []          # routes / menu / docs/domain / README 宣称 / .dev
blockers:
  - ""
```

**`status` 与覆盖度的绑定**：指定场景全展开、或自动模式核心路径已覆盖且无未消解盲区 → 可 `DONE`；盲区仅在**边缘面**（optional 候选、非关键次级路由、可选角色）→ 最多 `DONE_WITH_CONCERNS` 且盲区进 `remaining`；盲区落在**主路径**（登录壳 / 宣称已交付的主业务闭环 / 用户点名的指定流程）→ `BLOCKED`，不得把半成品剧本交给 browser-reviewer。

## 禁止

- 未判定模式就既扫全仓又忽略用户指定  
- 步骤不可点、无期望、无路由/菜单触点  
- 把 stub/「即将推出」写成可执行主路径（应 `blocked` + 原因）  
- 自动执行删除/对外发送且标为默认通过项  
- 打开浏览器冒充本 Skill 已验收  

## 关联

- [playbook-format.md](references/playbook-format.md) · [discovery.md](references/discovery.md) · [scan-workflow.md](references/scan-workflow.md)
- 消费者：[browser-reviewer](../browser-reviewer/SKILL.md)
- `.dev` 初始化：[create-dev-config](../create-dev-config/SKILL.md)
- 输入参考：[docs-reviewer](../docs-reviewer/SKILL.md) domain Process Test Pack
