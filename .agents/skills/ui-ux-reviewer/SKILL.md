---
name: ui-ux-reviewer
description: >
  上线前前端 UI/UX 全量扫描（技术栈无关）：路由勾选、标杆页对照、菜谱分类、视觉密度、CRUD 承载、
  列表行操作（幽灵按钮 / >4 收起为 … 菜单 / 删除红）、语义色与状态分色、空态/错误/分页/文案/深链、
  同构页应复用公共组件、壳与导航完整性、权限表面、异步提交反馈、响应式抽检、
  坏表单与半成品表面；
  默认 mode=auto-fix：报告 → 停等确认 → go-fast 修全量(P0+P1+P2)；指定 P0 或 P0+P1 跳确认；
  每页扫描结果 ≥3 条或声明穷尽；反模式六类各自独立计数器；
  输出可毕业报告。
  Use when preparing a frontend/console/admin app for launch, full UI UX audit, page craft graduation,
  design-system consistency scan, shared component reuse audit, empty sidebar/nav integrity, permission UX,
  submit/loading feedback, responsive smoke checks, empty-state CTA review, CRUD surface review,
  list row actions ghost/overflow menu, semantic status colors, delete destructive red,
  or pre-release visual QA across all mounted routes — React, Vue, Svelte, Next, Vite SPA, desktop webviews, etc.
---

# UI/UX Reviewer（上线前 · 前端可毕业）

技术栈无关的**前端产品表面**终局扫描。Agent 已懂通用 UI 评审；本 Skill 补：**路由全量勾选**、**本仓标杆菜谱复制**、**同构页复用公共组件**、**壳·导航·交互**、**反模式零放过（六类各自独立计数器）**、**可毕业闸门**、**默认 mode=auto-fix（确认后调 go-fast 修全量；指定 P0/P0+P1 跳确认）**、**每页扫描结果 ≥3 条或声明穷尽**。

不假设某设计系统或某仓路由。先找前端根、设计 Token、1～3 个标杆页与已有共享壳，再按菜谱并行扫全部已挂路由。

与 [code-reviewer](../code-reviewer/SKILL.md) 分工：假绿/stub/硬编码/后端可靠性/越权深挖 → 用 code-reviewer；**页级视觉·CRUD·文案·密度·空态·组件复用·壳导航·权限表面·异步反馈** → 用本 Skill。重叠（裸 path/YAML、半成品壳）两边都可报，本 Skill 以 UX 证据为主。布局/风格基准在 `docs/ui/`（由 [create-ui-docs](../create-ui-docs/SKILL.md) 提取）；**先验它可不可信，再拿它当尺子**（Phase 0.5），缺则先补再扫。任务价值/流程权责/状态机等**刁钻产品逻辑** → [product-reviewer](../product-reviewer/SKILL.md)，本 Skill 不替代。

## 何时启用

| 场景 | 动作 |
|------|------|
| 上线前 / 里程碑「前端可毕业」 | 路由清单 → 标杆+菜谱 → 并行扫（每页 ≥3 结果或穷尽声明） → 毕业报告 → **停等确认** → go-fast 全量修 |
| 控制台/管理端大面积页风格漂移 | 标杆对照 + 反模式扫，按域出修复批次 |
| 「对齐 page-craft / 设计系统」 | 套本仓菜谱矩阵，禁止另起 UI 库 |
| 同构列表/详情各写一套壳 | 复用审计 → 先抽/对齐共享再铺页 |
| 空侧栏、菜单 404、提交无反馈、权限假可点 | 壳·导航·交互扫描（见 shell-interaction） |
| 用户只要修 UI 不扫后端 | 本 Skill；缺 API 的假 KPI 记 finding，不替后端深审 |
| 用户指定 `P0` 或 `P0+P1` | `mode: auto-fix` + `cr_fix_scope=P0` 或 `P0+P1`；报告 → **跳过确认** → go-fast 修指定级别 |
| loop-polishing `ui`/`ux` lane | `mode: loop-lane`；报告+RP 后不停等、不改页 |

**不要**：重做已锁定标杆页（仅回归才小修）；借扫描做路由/壳/RBAC **模型**大重构；无契约却造假 KPI「好看」；替代完整无障碍/性能/安全审计。

## 必读顺序（≤3 次）

1. 本文件「流程」+「验收深度」+「严重度」+「非问题」+「硬规则」（含 docs/ui）
2. 目标仓 `docs/ui/anchor.md` + `layout.md` + 相关 `*-ia.md`（若存在）；否则先 create-ui-docs
3. [references/anti-patterns.md](references/anti-patterns.md) + [references/page-recipes.md](references/page-recipes.md) + [references/component-reuse.md](references/component-reuse.md) + [references/shell-interaction.md](references/shell-interaction.md)
4. 报告 [references/report-template.md](references/report-template.md) + 改造方案 [references/remediation-plan.md](references/remediation-plan.md)；执行 [references/scan-workflow.md](references/scan-workflow.md)

## 验收深度（六维）

| 维 | 必须 |
|----|------|
| **视觉** | 统一页头（跟 `docs/ui/layout.md` **页头形态**：`title-card` / `flush` / `minimal`；**标杆有右操作则标题卡/页头右侧须有主/次 CTA 槽**）；工具栏与表分区（gap/分割线，**非**外卡套内卡）；KPI/入口有**语义色 icon**（禁大面积卡片顶边着色）；禁止**内容区**卡片套卡片——含**列表外卡再套表格内框**（页头标题卡是壳层约定，不算套卡）；散装筛选、大面积无意义空白禁；**Dialog/Sheet/抽屉遮罩宜浅（约 20%–30% 黑）**；**语义色**：页头/入口/KPI 图标勿全站纯蓝；状态须分色；见 anti-patterns |
| **CRUD** | Create/Update/Delete/筛选有明确承载；**详情默认只读，编辑按钮后才可改**（新建除外）；危险操作用确认框；**列表行操作 = 幽灵按钮 ghost**；**>4 → `…` 下拉**；**删除 destructive 红**；页头主 CTA 用 solid，**勿与行内 ghost 抢视觉**；见 [page-recipes.md](references/page-recipes.md) 菜谱 B |
| **完整度** | 空态可行动（说明+CTA）；错误有统一壳+可读文案；列表有分页或明示「仅 N 条」；可深链的 KPI/摘要必须可点 |
| **文案与 Token** | 产品语言一致；**用户向人话**（禁 `STA-00X`、禁字段名/查询参数名作主文案、禁 **甲方/乙方/我方/贵方** 等合同口吻、禁工程黑话上屏）；无硬编码 hex；时间等人可读 |
| **组件复用** | 同菜谱/同构页须复用本仓页头、列表壳、空态、KPI、表单壳等；禁止平行手写第二套；见 [component-reuse.md](references/component-reuse.md) |
| **壳·导航·交互** | 侧栏/菜单非空壳；菜单↔路由一致；权限不足有诚实表面；主提交有 loading/防连点与成败反馈；弹层遮罩浅透；按产品承诺做响应式抽检；有暗色则抽检可读性。见 [shell-interaction.md](references/shell-interaction.md) |

**API 缺口**：只读字段/筛选/汇总缺契约 → 记 P1「缺契约」或书面**延期**（视觉仍可毕业，但禁止假数据冒充）；补契约须遵守**本仓**已有 codegen/envelope 纪律（勿手改生成物）。细节见 scan-workflow。

## 严重度

| 级 | 含义 | 典型 |
|----|------|------|
| **P0** | 不可毕业 | 有入口的半成品；假 KPI；主路径裸 path/JSON/YAML；危险操作无确认且易误触；**菜单进 404/空白页**；主提交静默失败 |
| **P1** | 上线前应修 | 反模式（**内容区套卡**/大卡套步骤小卡、顶边色条、裸 h1、空态无 CTA）；**页头形态漂移**（该有标题卡却无 / flush 仓硬套卡 / **标杆有右操作却页头右侧空**）；**详情非新建却默认编辑态**；同构未复用；CRUD 混乱；**行操作非幽灵 / >4 未收起 / 删除非红**；**图标·状态全蓝**；**文案：字段名/甲方乙方/工程黑话上屏**；空侧栏；菜单路由漂移；权限假可点；提交无反馈/可双提交；弹层遮罩过深；主路径响应式裁切 |
| **P2** | 可跟踪 | 次要文案润色、次要密度、书面延期 API、建议抽取、仅桌面产品的窄屏问题 |

**置信度**：P0 须带触发场景（谁在哪页做什么会踩中）。构不出场景 → 降 P1/P2 或进备注，勿虚报 P0。

## 非问题

1. **已锁定标杆页**：范围里标为对照的页面默认不改造；仅明显回归才报。
2. **测试 / Storybook 演示**：不进 findings。
3. **营销落地页**：本 Skill 默认面向 **App/Console/Admin**；落地页若用户点名再扫，且勿套控制台密度标准。
4. **已书面延期的 API**：总览登记延期即可，勿重复升 P0（假数据冒充除外 → 仍 P0）。
5. **正当差异**：不同菜谱或设计明确要求的布局差异，不因「没用同一个组件」误报（见 component-reuse「非问题」）。
6. **仅桌面产品**：FE Card 已声明 desktop-only 时，窄屏问题不升 P0/P1（可 P2）。

## 硬规则

1. **先验基准、再用基准**：`docs/ui` 是对照真源，但它本身可能是 AI 无锚自造的 —— 那样「代码 ↔ 文档一致」只是自证闭环。必须先做 **Phase 0.5 基准可信度校验**（见流程）。缺 `anchor.md` 是**硬项**：报告显著位置暴露 + 不得判「可毕业」，**禁止**悄悄降置信继续扫完了事。
2. **先路由清单，再扫**：以路由表/菜单为准做勾选；禁止只扫「顺眼的几个页」。
3. **对齐本仓标杆**：优先 `docs/ui` 锁定标杆；否则选最完整的 1～3 页（或设计系统 + page-craft skill）；禁止引入本仓没有的 UI 库「统一」。
4. **菜谱先分类再并行**：见 page-recipes 与 `docs/ui` 菜谱表；同菜谱用同一套壳。
5. **同构必须复用**：同菜谱 ≥3 页或明显同构 ≥2 页，须复用本仓共享壳；已有组件却平行手写 → P1；尚无共享但多页复制 → P1/P2 并进 S0 抽取。见 [component-reuse.md](references/component-reuse.md)。
6. **壳不可空、交互有回声**：预留导航槽必须有内容或收起；主提交有 pending/反馈；权限表面诚实。见 [shell-interaction.md](references/shell-interaction.md)。
7. **反模式即 fail**：见 anti-patterns（含**页头形态/右操作**、**内容区套卡**、**行操作幽灵/`…`/删除红**、**甲方等合同口吻**、**语义色**）。空 handler / 缺 loading / 裸 `<input>` 等**代码形状**问题：先按 [code-scanning](../code-scanning/SKILL.md) 探测；有 `ast-grep` → JSX/TSX 临时 pattern 或规则包优先于跨行 rg；无则 rg + Blind spot。**禁止**隐式安装。
8. **简陋/漂移必出改造方案**：P0·P1 的视觉·完整度·复用·壳类 finding 须挂 `RP-*`（菜谱 + 对标页 + 区块结构 + 复用/抽取 + 不做清单）。见 [remediation-plan.md](references/remediation-plan.md)。禁止只写「优化 UI」。
9. **先报告后改**：默认 `mode: auto-fix` + `fix_mode: confirm-batch`，报告落盘 → **停问**：「确认全量(P0+P1+P2)？或指定 P0/P0+P1？」；用户确认全量 → 调 [go-fast](../go-fast/SKILL.md) 修 P0+P1+P2（attended）；用户指定 `P0` / `P0+P1` → 跳过确认直接调 go-fast unattended 修指定级别；按**域或菜谱**拆 subagent，共享壳只串行改。`mode: loop-lane`（loop-polishing）→ 报告后不等人、不改代码。**绝不自动修 P2**（除非用户明示「全量」含 P2）。
10. **禁止假绿表面**：无 API 不造假 KPI；未就绪撤入口或空态诚实说明。
11. **方案只对齐本仓**：改造方案禁止新 UI 库、禁止无契约假 KPI、禁止借机改 RBAC/路由模型；**须对齐 `docs/ui` 已载明的禁止项**。
12. **列表行操作、页头与语义色**：行末 ghost；>4 → `…`；删除红；页头跟 layout 形态（title-card 含右操作槽）；图标/状态勿全蓝。见 page-recipes + anti-patterns。
13. **文案**：用户向人话；禁字段名/甲方乙方/工程黑话上屏（与 craft §8 同尺）。
14. **每页扫描密度下限**：每页 finding 数（含 P0/P1/P2 + 「已通过项」）≥ 3；不足 3 时**必须**在该页回传末尾加 `EXHAUSTED` 段（列出实际跑过的反模式关键词、查看的组件 path、抽样截图数、主观信心）。无 `EXHAUSTED` 段且结果 < 3 → 该页视为**未扫透**，进 Blind spot（**不得**记「通过」）。
15. **反模式独立计数器**：六类反模式在 lane 回传中**各自独立计 0/1/N**，禁止合并成「反模式 N 条」一笔带过：
    - **AP-A 内容区套卡**（含「列表外卡 + 表格内框」）
    - **AP-B 行操作**（非幽灵 / 数量 >4 未收起 / 删除非红）
    - **AP-C 页头形态漂移**（title-card/flush/minimal 不一致 / 标杆有右操作却页头空）
    - **AP-D 图标·状态全蓝**（页头/KPI/入口图标非语义色 / 状态 Badge 不分色）
    - **AP-E 文案**（字段名 / 甲方乙方 / PRD·ADR 编号 / 工程黑话上屏）
    - **AP-F 遮罩过深**（Dialog/Sheet/抽屉遮罩 >30% 黑）
    每页六类各打分（0=无 / 1=命中），命中即出独立 finding（不合并、不吞）。

---

## 流程（必须）

### Phase 0 · FE Card（主 agent，短）

| 探测 | 产出 |
|------|------|
| 前端根 | `fe/` / `web/` / `apps/web` / `src/`… |
| 框架与 UI | React/Vue/…；组件库；Token/CSS 变量位置 |
| 路由入口 | `main.tsx` / `router` / `app` 路由表、侧栏菜单 |
| 标杆页 | 1～3 个最完整页路径（用户可点名；否则自动挑） |
| 共享壳目录 | `components/` / `templates/` 中页头、列表壳、空态、KPI、表单壳等 |
| 响应式承诺 | 桌面 only / 含平板 / 含移动 |
| 主题 | 有无 dark / 多主题开关 |
| RBAC | 有无角色权限表面（有则必查权限 UX） |
| 设计 skill | 仓内 page-craft / design-system → 叠加遵守 |
| **docs/ui** | `anchor.md` / `layout.md` / `*-ia.md` 是否存在；设计锚、标杆与禁止项摘要；缺失则提示 create-ui-docs |
| 范围 | 整前端 / 若干域 / 用户排除列表 |

写出 **FE Card**（进报告）。模板见 [scan-workflow.md](references/scan-workflow.md)。

### Phase 0.5 · 基准可信度校验（在对照 docs/ui 之前）

验的不是代码，是**文档本身可不可信**。逐项判 `真 / 假 / 缺`：

| # | 检查项 | 不通过的含义 |
|---|--------|-------------|
| 1 | `docs/ui/anchor.md` 存在 | **硬项**：缺 → 基准无锚，见下方判定 |
| 2 | anchor 声称的组件库与版本，在 `package.json` / 依赖清单里真实存在 | 文档凭空选型，实现会装错包 |
| 3 | token 真源文件路径真实存在，且代码确实从它取色/取间距（抽查 2 处） | token 真源是摆设，页面各写各的 hex |
| 4 | 外部参考锚有链接或仓内路径，且写了**锚定层次** | 「参考了某某」但没说参考什么 = 没参考 |
| 5 | `*-ia.md` 每个标杆页路径真实存在 | 全批围着不存在的标杆对齐 |
| 6 | 抽 1～2 个标杆页：它确实是同菜谱中最完整的（页头/三态/复用齐） | 标杆本身就是半成品，越对齐越差 |
| 7 | `layout.md` 壳层/模板锚点路径真实存在；含 **页头形态**（title-card/flush/minimal）与右操作/行操作约定（或明示待补） | 壳规格是作文；缺页头形态 → 易扫出「各页各写」却无尺子 |
| 8 | 各项可信度标记齐全；`assumed` 项已列出 | 无分级 = 无法区分事实与假设 |

判定：

| 情形 | 结论 |
|------|------|
| 1～8 全过，且关键项非 `assumed` | 基准可信，正常对照 |
| 有 1～3 项不过，或部分关键项为 `assumed` | 报告标「**基准部分不可信**」，逐项列出；相关维度结论降为「待确认」 |
| 缺 `anchor.md`，或 anchor 整体为 `assumed`，或 ≥4 项不过 | 报告首屏标「**基准不可信，本次一致性结论仅供参考**」；**不得**判「可毕业」；出 finding「补设计锚（create-ui-docs）」 |

**`assumed` 的条目不得作为判定「合规」的依据** —— 代码与一条 AI 假设一致，不构成合规证据；只能写「与当前假设一致，假设待确认」。

### Phase 1 · 路由勾选表

列出全部**已挂**业务路由（排除 auth 回调、纯重定向、故事书）。每行：`路径 | 页面文件 | 菜谱 | 状态(待扫/通过/fail/延期)`。

实现前以路由源文件为准差分，避免漏路由。**同时**做菜单↔路由对账（见 shell-interaction）。

### Phase 2 · 菜谱分类

按 [page-recipes.md](references/page-recipes.md) 给每页贴菜谱 A–F（可扩展）。标杆页注明「锁定」。

### Phase 3 · 并行扫描 + 复用审计

按**域**或**菜谱**开多个 readonly explore subagent（提示词见 scan-workflow）。每页按**六维** + 反模式打分。

另开（或主 agent 兼任）：
- **复用审计**（[component-reuse.md](references/component-reuse.md)）
- **壳·导航·交互**抽检（[shell-interaction.md](references/shell-interaction.md)；可并入域 lane）

失败 lane：重试 1 次 → 主 agent 补扫 → 否则 Blind spot；有 Blind spot 不得宣称「可毕业」。

**穷尽**：每个 lane 回传须含 `routes_in_lane / fail_listed`；`fail_listed` 必须覆盖该 lane 全部 fail 路由。主 agent 合并时**禁止**把多页同构问题压成「几条代表」而不列齐 path。

**视觉证据（应用可跑时必做）**：对**标杆页 + 每个 fail 页**各取一张截图，走证据层留证 —— `python3 ~/.agents/skills/_bin/evidence-run --slice ui-review --phase screenshot --label "<路由>" -- <截图命令>`；工件路径进回传 `evidence.screenshots` 并在 finding 里引用。跑不起来（无 `.dev` / 无浏览器能力）→ 记 Blind spot「无运行时视觉证据」，**禁止**声称已做视觉验收。真机走查全量交 [browser-reviewer](../browser-reviewer/SKILL.md)。

### Phase 4 · 毕业报告

合并 finding（遵守穷尽盘点；过合并禁止）→ 为简陋/复用/壳类补齐 **改造方案 RP-***（[remediation-plan.md](references/remediation-plan.md)）→ 套 [report-template.md](references/report-template.md) → **落盘**（见下）→ **停等确认**（确认批次 = 默认采用所列 RP，除非用户改写）。总览须写 P0/P1/P2 计数 + 穷尽自检一句。

**自动落盘**（默认，不必等用户点名）：写入 `docs/material/ui-ux-reviewer/<YYYY-MM-DD>-<slug>.md`，再评 `…-r<N>.md`（`N≥2`；**禁止**覆盖上轮文件）。目录不存在则创建；`slug` = 范围短名，如 `console-launch`。对话展示摘要 + **落盘绝对路径**；回传 `report` 填该路径。用户明确说「勿落盘 / 只聊」→ 可跳过写文件，并在回传注明。

### mode=`auto-fix`（**默认** · 单独调用本 Skill）

**默认 mode**。扫完 → 报告 + RP 落盘 → 停等用户确认 → 确认后调 [go-fast](../go-fast/SKILL.md) 批量修。

| 项 | 规则 |
|----|------|
| 触发 | 单独调用本 Skill 且未明示其它 mode |
| 范围 | 默认 **整前端**（除非用户明示域/路由子集） |
| `fix_mode` | `confirm-batch`（默认）/ `auto`（用户指定 `P0` 或 `P0+P1` 时） |
| 报告后动作 | **落盘 + 给出 finding/RP 总览** → **停问**：「确认修全量(P0+P1+P2)？或指定 P0 / P0+P1？」 |
| 用户确认全量 | → **调 go-fast**（见 scan-workflow「调用 go-fast 路径」），`cr_fix_scope: all`，**attended**；S0 共享壳 → Sn 分域并行 |
| 用户指定 `P0` 或 `P0+P1` | → **跳过确认直接调 go-fast**，`cr_fix_scope: P0` 或 `P0+P1`，**unattended** |
| **绝不自动修 P2** | `all` 视同「确认全量含 P2」 |
| 不可自动修（须进 `remaining`）| 撤入口 vs 补契约的产品决策；共享壳抽取涉及设计决策（S0 仍须用户认领设计方向）；标杆页本身的修改；无契约补 API |
| Blind spot | 有未消解盲区 → `graduation: false`，盲区原样进 `coverage.blind_spots`；**禁止**判「可毕业」 |
| 回传 | 必填 `mode: auto-fix`、`fix_mode`、`auto_fixed`、`remaining`、`graduation`、`anchor_trust` |

### mode=`loop-lane`（loop-polishing 焦点 lane · 只评不修）

由 [loop-polishing](../loop-polishing/SKILL.md) 调用。与默认差异：

| 项 | 规则 |
|----|------|
| 触发 | 调用方明示 `mode: loop-lane`（或 orchestrator 标明 loop-polishing） |
| 流程 | Phase 0–4 **只到报告+RP**；落盘后 **立即** `DONE`，**禁止**停等确认 |
| 禁止 | Phase 5 改前端；借机大改 `docs/ui` 标杆 |
| 范围 | 默认编排方给出的 `scope` 路由/模块（可非整前端） |
| 回传 | `mode: loop-lane`；`fix_mode: none`；finding/RP 供编排方归一 |

单独调用本 Skill：仍默认 Phase 4 停等确认。

### Phase 5 ·（确认后）调 go-fast 分域修复

`mode: auto-fix` 确认后（或指定 P0/P0+P1 跳过确认后）→ **必须**调 [go-fast](../go-fast/SKILL.md) 执行批量修：

| 触发 | go-fast 入参 |
|------|-------------|
| 用户确认「全量 P0+P1+P2」 | `spec_ref` = 本 skill 落盘报告路径；`attendance: attended`；`cr_fix_scope: all` |
| 用户指定 `P0` | 同上；`attendance: unattended`；`cr_fix_scope: P0` |
| 用户指定 `P0+P1` | 同上；`attendance: unattended`；`cr_fix_scope: P0+P1` |

**报告作为规格**：本 skill 报告（含 FE Card + 路由勾选 + finding 表 + RP-*）即 go-fast 的 `spec_ref`，走**路径 B**。每条 finding 必须含：`id / severity(P0|P1|P2) / route / dim / rp / suggested_fix / unfixable_reason?`。

go-fast 内部按本 skill 的 RP 拆工单：
- **S0 共享壳**（Header/列表壳/空态/Token + 应复用未复用的抽取与改引用）→ **串行一片**（go-fast 编排契约「refactor-shared」独占一波）
- 各域页面按已确认 RP 施工（import 共享壳 + 区块顺序）→ **可并行**；禁止并行改同一共享文件
- 回归：反模式关键词 + 同菜谱抽检 ≥2 页 + 标杆页 + 菜单冒烟；有测则跑相关前端测

可选波次（大仓）：W1 共享壳结论与抽取 → W2 分域套菜谱 → W3 契约补齐 → W4 勾选 100% 或书面延期。小仓可压成「一报告 + 一批修」。

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: ui-ux-reviewer
mode: auto-fix | loop-lane | review
fix_mode: confirm-batch | auto | none        # auto-fix 默认 confirm-batch；用户指定 P0/P0+P1 → auto
cr_fix_scope: all | P0+P1 | P0                # auto-fix 下：用户确认全量=all；指定级别时收窄
scope: ""                   # 整前端 / 域或路由列表
report: ""                  # 落盘路径 docs/material/ui-ux-reviewer/<YYYY-MM-DD>-<slug>[-rN].md
graduation: true|false      # 前端「可毕业」与否；下列任一成立即 false：
                            # 有 P0 / 有未披露盲区 / anchor_trust != trusted
anchor_trust: trusted | partial | untrusted | missing   # Phase 0.5 结论；
                            # partial/untrusted/missing → graduation 禁止 true
routes:
  total: 0
  passed: 0
  failed: 0
  deferred: 0
findings: []                # {id, severity: P0|P1|P2, route, dim, rp: RP-*|"", ap_class: AP-A|...|none}
                            # ap_class = 反模式独立计数器归属（AP-A~F 之一），便于修复批次按类聚
remediation_plans: []       # RP ID 列表
evidence:
  screenshots: []           # evidence-run 工件路径；空 → 禁止声称视觉已验收
remaining: []               # 书面延期 API / 需裁定 / 盲区未修
coverage:
  blind_spots: []           # 未消解盲区：`lane | 未覆盖路由或域 | 原因`；非空 → status 禁止 DONE
blockers:
  - ""
followups:
  - "create-ui-docs / browser-reviewer / code-reviewer / go-fast"
```

**`status` 与覆盖度的绑定**：全路由已勾选（含写明理由的合理跳过）且无未消解盲区 → 可 `DONE`；盲区仅在边缘面（营销落地页、desktop-only 产品的窄屏、无契约的次要看板…）→ 最多 `DONE_WITH_CONCERNS` 且盲区原样进 `remaining`；盲区覆盖**生产主路径路由 / 主 CRUD 域 / 壳与导航** → `BLOCKED`，此时「没发现 P0」与 `graduation: true` 均不成立。

## 进度清单

```
- [ ] 0. FE Card + 标杆 + 共享壳 + 响应式/主题/RBAC 承诺
- [ ] 0.5 基准可信度校验 8 项 + 结论（不可信须写进报告首屏）
- [ ] 1. 路由勾选表 + 菜单对账
- [ ] 2. 菜谱分类
- [ ] 3. 并行扫（六维 + 反模式**六类独立计数器 AP-A~F**）+ 复用审计 + 壳/交互 + 视觉证据
       每页 finding ≥3 或 EXHAUSTED 段；Blind spots 已处理或标注
- [ ] 4. 毕业报告 + 改造方案 RP；落盘 `docs/material/ui-ux-reviewer/`；
       **mode=auto-fix（默认）**：停问「确认全量 or 指定 P0/P0+P1」；
       **用户指定 P0/P0+P1**：跳确认直接调 go-fast；
       **loop-lane**：落盘即完，不停等
- [ ] 5. （确认后或指定级别）调 go-fast：S0 共享串行 → 分域 RP 并行 → 回归（loop-lane：跳过）
```

## 禁止

- 未做路由勾选就宣称可上线  
- **基准不可信（缺 `anchor.md` / 整体 `assumed`）却判「可毕业」，或把「与 AI 假设一致」当合规证据**  
- 用新 UI 库或新视觉语言「统一」  
- 无契约造假 KPI / 写死演示数当正式数据  
- 三页各改「看起来像」却仍不抽/不引用共享壳  
- 简陋页只写「优化 UI」却无 RP 改造方案  
- **confirm-batch 模式（auto-fix 默认）未确认就调 go-fast 改页**；例外：用户指定 `P0` / `P0+P1` 跳确认直接修（仍禁止自动修 P2）；`mode: loop-lane` / `fix_mode: auto` 不受此限  
- **`fix_mode: auto` 下自动修任何 P2**（用户显式 `all` 含 P2 时除外）  
- 改造方案引入新 UI 库或无契约假 KPI  
- 并行舰队同时改同一共享组件  
- Blind spot 未披露却写「可毕业」；无截图却写「视觉已验收」
- 报告只贴在对话、默认跳过落盘（用户明示「勿落盘」除外）
- 每页扫描结果 <3 且无 `EXHAUSTED` 段就判该页「通过」（视为未扫透 → Blind spot）
- **反模式六类合并成「反模式 N 条」一笔带过**（必须 AP-A~F 各自独立计数）
- **`loop-lane` 下停等确认或进入 Phase 5 改代码**
- **抽样汇报**：只交代表页 / Top N / 「等 N 页」；勾选 fail 未进 findings

## 关联

- [anti-patterns.md](references/anti-patterns.md) · [page-recipes.md](references/page-recipes.md)
- [component-reuse.md](references/component-reuse.md) · [shell-interaction.md](references/shell-interaction.md)
- [remediation-plan.md](references/remediation-plan.md) · [report-template.md](references/report-template.md) · [scan-workflow.md](references/scan-workflow.md)
- 姊妹 skill：[code-reviewer](../code-reviewer/SKILL.md) · [browser-reviewer](../browser-reviewer/SKILL.md)（真机登录截图走查 + Console；静态页级扫用本 Skill）· [loop-polishing](../loop-polishing/SKILL.md)（`mode: loop-lane` 作 `ui`/`ux` lane）
