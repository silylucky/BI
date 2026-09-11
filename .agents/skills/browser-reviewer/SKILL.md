---
name: browser-reviewer
description: >
  基于仓库 .dev 配置的真机浏览器走查（技术栈无关）：优先消费 scenario-playbook 产出的业务剧本，
  读取默认管理员账号与外部配置，按剧本/功能登录截图走查；采集 Console/网络错误；做 UI 视觉与
  像素级对照、风格一致性检查；输出带截图证据的分级报告。
  Use when the user asks for browser walkthrough, screenshot QA, live UI verification,
  console error smoke test, pixel-level UI check, style consistency in a running app, E2E visual
  review, execute a scenario playbook, or to验证功能 using .dev credentials — Console/Admin/SPA
  with a runnable local or staging URL. If no playbook exists, run scenario-playbook first or
  fall back to the generic walkthrough playbook.
---

# Browser Reviewer（真机走查 · 截图验收）

技术栈无关的**运行时浏览器**验收。Agent 已懂点页面；本 Skill 补：**`.dev` 凭证与外部配置约定**、**功能全量走查剧本**、**截图证据链**、**Console/网络错误零放过**、**视觉·像素·风格对照**、**先报告后改（默认不改代码）**。

与姊妹 skill 分工：

| Skill | 看什么 |
|-------|--------|
| [scenario-playbook](../scenario-playbook/SKILL.md) | **编剧**：自动发现或按用户指定 → 可执行走查剧本（本 Skill 的输入） |
| [create-dev-config](../create-dev-config/SKILL.md) | **配环境**：苏格拉底交互写出/补全 `.dev`（缺配置时先走这里） |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) | **静态**路由/菜谱/反模式（不需登录跑起来） |
| [code-reviewer](../code-reviewer/SKILL.md) | 假绿/stub/硬编码/可靠性（读代码） |
| [docs-reviewer](../docs-reviewer/SKILL.md) | 文档完整与 prd-sync |
| **本 Skill** | **演戏**：按剧本登录后点一遍 + 截图 + Console + 视觉 |

重叠可两边报；本 Skill 以**运行时证据**（截图路径、console 原文、复现步骤）为准。无业务剧本时：先跑 scenario-playbook，或降级通用幕并在报告披露。

## 何时启用

| 场景 | 动作 |
|------|------|
| 上线前 / 里程碑「真机可毕业」 | 有剧本则直接走查；无则先 [scenario-playbook](../scenario-playbook/SKILL.md) → 读 `.dev` → 起环境 → 按剧本走查 → 截图报告 |
| 大改 UI 后回归 | 按剧本/路由/域走查 + 与 baseline 像素对照 |
| 「帮我点一遍看有没有报错」 | 无剧本先生成关键场景剧本；再功能烟测 + Console/网络；视觉可降为抽检 |
| 用户已指定流程 | scenario-playbook **指定模式**出剧本 → 本 Skill 只执行该剧本 |
| 新环境 / 新 `.dev` 配置验证 | 校验 `.dev`；缺则 [create-dev-config](../create-dev-config/SKILL.md) → 登录与外部依赖连通性 → 主路径 |
| `.dev` 不存在 / 缺账号密码 | **停走查** → [create-dev-config](../create-dev-config/SKILL.md) → 回来继续 |

**不要**：替代完整 E2E 自动化测试套件的维护；在未授权环境用生产真实用户密码；把密码写进报告正文；未确认就大面积改前端。

## 必读顺序（≤3 次）

1. 本文件「前置」+「流程」+「严重度」+「安全」
2. [references/dev-config.md](references/dev-config.md) + [references/walkthrough-playbook.md](references/walkthrough-playbook.md) + [references/visual-qa.md](references/visual-qa.md)；剧本契约见 [scenario-playbook/references/playbook-format.md](../scenario-playbook/references/playbook-format.md)
3. 报告 [references/report-template.md](references/report-template.md)；执行细节 [references/scan-workflow.md](references/scan-workflow.md)

## 前置条件（缺一则先修或标 Blind spot）

| 项 | 要求 |
|----|------|
| `.dev/` | 符合 [dev-config.md](references/dev-config.md)；至少含 **active 环境** browser URL +（非生产）管理员账号。**缺失或缺必填 → 先跑 [create-dev-config](../create-dev-config/SKILL.md)**。`active_env` 为生产且未 `allow_prod` → 拒绝走查 |
| 可访问应用 | `base_url` 已监听；本 Skill **可**按 `.dev` 提示启动命令，但启动失败须停并报告 |
| 浏览器能力 | Cursor 浏览器 / MCP browser / 仓内 Playwright 任一可用；全无 → Blind spot，不得假装已走查 |
| 截图目录 | 默认写入 `.dev/walkthrough/<date>/`（gitignored）；报告只引用相对路径 |
| 证据留存 | 截图采集走证据层：`python3 ~/.agents/skills/_bin/evidence-run --slice <场景或路由 id> --phase screenshot --label "<页面/态>" -- <截图命令>`；工件路径进回传 `evidence.screenshots`（见 [evidence.md](../go-fast/references/evidence.md)）。手工点+MCP 截图无命令可包时，用一条落盘脚本包住，**禁止**事后补一条无关 evidence-run |

## 验收深度（五维）

| 维 | 必须 |
|----|------|
| **功能** | 登录成功；菜单/路由可达；主 CRUD/主流程按剧本点通；空态/错误态可触发则抽检 |
| **Console** | 无未捕获 error；warning 按白名单；页面切换后仍干净 |
| **网络** | 主路径无 4xx/5xx（预期 401/403 除外）；失败请求记入证据 |
| **视觉·像素** | 每页关键态截图；有 baseline 则做像素/感知 diff；无 baseline 则人工读图（对齐、裁切、重叠、溢出） |
| **风格一致** | 同菜谱页对照：页头、间距、按钮层级、空态、表格密度；与仓内标杆页或首张「金样」截图一致 |

细节见 [visual-qa.md](references/visual-qa.md)。

## 严重度

| 级 | 含义 | 典型 |
|----|------|------|
| **P0** | 不可毕业 | 无法登录；主流程断裂；白屏/无限 loading；Console 持续 error；主 API 5xx；明显错位/遮挡导致不可用 |
| **P1** | 上线前应修 | 次要流程失败；Console warning 刷屏；非主路径 4xx；风格严重漂移；相对 baseline 明显像素回归；裁切/溢出 |
| **P2** | 可跟踪 | 文案微调、轻微间距、无 baseline 的观感建议、第三方脚本 noise（已登记白名单外可降） |

**置信度**：P0/P1 须带：复现步骤 + 截图路径 +（若有）console/network 摘录。

## 安全（硬规则）

1. **密钥不出报告**：报告中账号可写用户名；密码/Token 一律 `***`；截图避免含完整密钥（登录页输入后尽快进入内页再截）。
2. **`.dev` 不入库**：检查 `.gitignore` 含 `.dev/`；若凭证已被跟踪 → P0 并停止把密钥写入任何新文件。
3. **仅用 `.dev` 提供的环境**：禁止改用用户口头生产密码；禁止对未在 `.dev` 声明的外部系统做写操作（除非剧本标明「允许写」）。
4. **破坏性操作**：删除/清空/对外发送类步骤默认 **跳过** 或走「只打开确认框不点确认」；用户显式要求才执行。

## 硬规则

1. **先读 `.dev`，再打开浏览器**：解析 `active_env` → `environments.*`（或旧式 `app.base_url`）；缺必填 → **转 [create-dev-config](../create-dev-config/SKILL.md)**。`active_env` 为生产且 `walkthrough.allow_prod≠true` → **停止走查**，提示改 active 或走 create-dev-config。
2. **先加载剧本，再点**：优先业务剧本（见 Phase 1）；无剧本则先 scenario-playbook 或降级通用幕并披露；禁止只点首页交差。
3. **每页至少一张关键态截图**；失败步骤必截。
4. **Console 与网络与页面绑定**：切换路由后清空或分段记录，避免张冠李戴。
5. **像素对照**：有 `.dev/baselines/`（或配置的 baseline 根）→ 必跑 diff；无则视觉读图，报告写明「无 baseline」，且**禁止**宣称做了数字 diff 或「像素级通过」（定义见 [visual-qa.md](references/visual-qa.md) §D）。
6. **新页截图自动收录候选金样**：无 baseline 的页，本次关键态截图直接复制到 `.dev/baselines/_candidates/`，并在报告「待确认金样」清单逐条列出（路由 + 路径 + viewport）。让用户**一次性批量看 20 张图**，比后期整批返工便宜。收录为**候选**不等于通过验收；转正需用户确认后移入 `.dev/baselines/`。
7. **先报告后改代码**：默认只产出报告与截图；修复需用户确认（可转 ui-ux-reviewer / code-reviewer 批次）。
8. **工具降级须披露**：用 Playwright 替代 MCP 浏览器等写进报告「扫描方式」。
9. **遵守剧本写边界**：`needs_confirm` / `allow_writes=false` / destructive 规则以剧本 + `.dev` 为准，取更严者。

---

## 流程（必须）

### Phase 0 · Dev Card + 环境

1. 读 `.dev/` → 校验 schema（[dev-config.md](references/dev-config.md)）；解析 `active_env`；缺失/缺必填/误瞄生产 → **先 [create-dev-config](../create-dev-config/SKILL.md)**
2. 写出 **Dev Card**（active_env、browser/api URL、部署/日志摘要、角色、viewport、baseline、allow_prod）
3. 确认应用可达；按需执行 active 环境的 `start`（超时失败 → 停）
4. 选择浏览器后端（MCP → Playwright → 无则 Blind spot）

### Phase 1 · 加载剧本 → 走查勾选表

**剧本加载顺序**（命中即用，见 [playbook-format.md](../scenario-playbook/references/playbook-format.md)）：

1. 用户/交接指定的 `critical.md`（或剧本目录）  
2. `.dev/playbooks/` 下最新日期目录的 `critical.md`  
3. `docs/qa/playbooks/` 下最新 `critical.md`  
4. 皆无 → **先跑 [scenario-playbook](../scenario-playbook/SKILL.md)**（用户要真机验收时）；用户拒绝生成则降级 [walkthrough-playbook.md](references/walkthrough-playbook.md) 通用幕，报告写明「无业务剧本」

将剧本 `ready` 步骤展开为勾选表；`blocked`/`draft` 披露。  
可选：再合并通用幕中「剧本未覆盖的一级菜单进入+截图」作烟测补全（标来源=`generic`）。  

每行：`ID | 场景 | 步骤 | 路由 | 状态(待/过/fail/跳过) | 截图 | Console | 备注`。

### Phase 2 · 登录与按剧本走查

按勾选表执行：共享前置（预检+登录）→ 各场景步骤 → 抽检响应式（若 `.dev` 声明）→ 登出（可选）。  
每步：操作 → 等稳定 → 截图 → 读 Console/网络 → 记结果。  
写操作严格按剧本标记 + `.dev` allow_*（更严者优先）。

### Phase 3 · 视觉与像素

1. 读图检查：对齐、间距、溢出、对比度明显问题  
2. 风格矩阵：同菜谱 ≥2 页对照  
3. 若有 baseline：diff → 超阈值（默认感知差或像素比见 visual-qa）记 finding  
4. 无 baseline 的页：截图收录 `_candidates/` → 汇总「待确认金样」清单进报告（硬规则 6）  

### Phase 4 · 报告

套 [report-template.md](references/report-template.md) → 附截图索引 + 待确认金样清单 + `evidence.screenshots` 工件路径 → **落盘**（见下）→ **停等确认**（若需修）。

**自动落盘**（默认，不必等用户点名）：主报告写入 `docs/material/browser-reviewer/<YYYY-MM-DD>-<slug>.md`，再走查 `…-r<N>.md`（`N≥2`；**禁止**覆盖上轮文件）。目录不存在则创建；`slug` = 剧本或范围短名，如 `order-critical`。  
**截图产物不入 `docs/`**：仍留在 `.dev/walkthrough/<date>/`（gitignored）——那是证据不是报告；主报告只引用其相对路径。  
对话展示摘要 + **落盘绝对路径**；回传 `report` 填该路径。用户明确说「勿落盘 / 只聊」→ 可跳过写文件，并在回传注明。

### Phase 5 ·（确认后）修复分流

- UI/风格/空态 → 建议用 [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) 批次或本会话按确认修  
- Console 源于业务 bug/假绿 → [code-reviewer](../code-reviewer/SKILL.md)  
- 金样转正（用户确认「接受现状为金样」）→ `_candidates/` 对应图移入 `.dev/baselines/`；未确认的留在候选目录，下次继续列  

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: browser-reviewer
mode: review                # 本 Skill 只有一种模式：走查取证、默认不改代码
scope: ""                   # 剧本 ID / 场景或路由范围
report: ""                  # 落盘路径 docs/material/browser-reviewer/<YYYY-MM-DD>-<slug>[-rN].md
env:
  active_env: ""            # .dev active 环境名
  base_url: ""              # 密码/Token 一律不出现在回传
  backend: mcp | playwright | none   # none → BLOCKED
playbook:
  source: business | generic | none  # generic/none 须在报告披露
  path: ""
steps:
  total: 0
  passed: 0
  failed: 0
  skipped: 0                # 含 destructive 主动跳过、blocked 场景
console_errors:
  error: 0                  # 未捕获 error 计数；>0 → status 禁止 DONE
  warning: 0
  network_failures: 0       # 主路径 4xx/5xx（预期 401/403 不计）
evidence:
  screenshots: []           # evidence-run 工件路径（.dev/walkthrough/<date>/...）；空 → 禁止声称已走查
  baseline_diff: true|false # 无 baseline 时 false，且禁止宣称「像素级通过」
  gold_candidates: []       # 待确认金样（.dev/baselines/_candidates/...）
findings: []                # {id, severity: P0|P1|P2, step, route, screenshot, repro}
remaining: []               # 未走完场景 / 需人裁定 / 盲区
coverage:
  blind_spots: []           # 未消解盲区：`场景或路由 | 未覆盖原因`；非空 → status 禁止 DONE
blockers:
  - ""
followups:
  - "create-dev-config / scenario-playbook / ui-ux-reviewer / code-reviewer"
```

**`status` 与覆盖度的绑定**：剧本 `ready` 步骤全走完（含写明理由的合理跳过）且无未消解盲区 → 可 `DONE`；盲区仅在边缘面（次要场景、响应式抽检、无 baseline 的观感项…）→ 最多 `DONE_WITH_CONCERNS` 且盲区原样进 `remaining`；盲区覆盖**登录 / 主流程场景 / 主 CRUD 路由**，或无浏览器后端、`.dev` 缺必填 → `BLOCKED`，此时「没发现 P0」不成立。

## 进度清单

```
- [ ] 0. Dev Card + .dev 校验 + 应用可达 + 浏览器后端
- [ ] 1. 加载业务剧本（或 scenario-playbook / 降级通用幕）→ 勾选表
- [ ] 2. 登录 + 按剧本走查 + 逐步截图 + Console/网络
- [ ] 3. 视觉读图 + 风格对照 + baseline diff（若有）+ 新页收候选金样
- [ ] 4. 标准报告（含待确认金样清单 + evidence.screenshots）；落盘 `docs/material/browser-reviewer/`；密钥已脱敏；停等确认
- [ ] 5. （确认后）修复分流或候选金样转正
```

## 禁止

- 未读 `.dev` 就猜账号密码  
- 报告或 commit 明文密码/Token  
- 无勾选表只截三张图宣称完成  
- 有业务剧本却故意不用、只点首页  
- 忽略 Console error  
- 无浏览器能力却写「已走查通过」  
- 未确认执行删除/对外副作用  
- 把静态 ui-ux-reviewer 结果冒充真机证据  
- 把 `blocked` 场景标成通过  
- 无 baseline 却宣称做了像素 diff / 「像素级通过」  
- 把候选金样当成「已验收基准」，或未经确认覆盖 `.dev/baselines/`  
- 报告只贴在对话、默认跳过落盘（用户明示「勿落盘」除外）；把截图证据搬进 `docs/material/`  

## 关联

- [dev-config.md](references/dev-config.md) · [walkthrough-playbook.md](references/walkthrough-playbook.md)
- [visual-qa.md](references/visual-qa.md) · [scan-workflow.md](references/scan-workflow.md)
- [report-template.md](references/report-template.md)
- 剧本作者：[scenario-playbook](../scenario-playbook/SKILL.md) · 格式 [playbook-format.md](../scenario-playbook/references/playbook-format.md)
- `.dev` 交互初始化：[create-dev-config](../create-dev-config/SKILL.md)
- 姊妹：[ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) · [code-reviewer](../code-reviewer/SKILL.md) · [docs-reviewer](../docs-reviewer/SKILL.md)
