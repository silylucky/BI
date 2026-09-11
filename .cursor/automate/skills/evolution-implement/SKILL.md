---
name: evolution-implement
description: >-
  自我演化 P3 开发 Automation 包装。Superpowers subagent-driven-development option 1 + TDD + 双 review。
  由 subagent evolution-implementer 执行。
---

# 开发（P3 · Automation）

## 何时使用

- P2 实现计划（`docs/superpowers/plans/*.md`）无占位符
- 由 **subagent `evolution-implementer`** 执行
- **先读本 skill**，再加载 Superpowers `subagent-driven-development`

## 项目技能与规则

技能与工程规范**来自目标项目本身**，不在 automate 仓库维护 skill 包。

### 技能目录（按优先级）

| 路径 | 说明 |
|------|------|
| `.agents/skills/<name>/SKILL.md` | skills CLI 惯例，优先 |
| `.cursor/skills/<name>/SKILL.md` | Cursor 项目 skill |

**fresh subagent** 每任务启动时优先读 `docs/automate/evolution-state.md`「项目技能规则索引」；索引缺失、`skill_rule_index_source_count` 与当前可见 skill/rule 文件数不一致、或与本任务 Files 明显不匹配时，才 **Glob** 上述目录，读各 `SKILL.md` frontmatter `description`（不必全文），按本任务 Files 选相关项加载（详见下「每任务派 Task 前」自加载原则）。

### 规则目录

| 路径 | subagent 行为 |
|------|----------------|
| `.cursor/rules/*.mdc` | `alwaysApply: true` → **自动注入**所有 agent / Task 子 agent |
| `.cursor/rules/*.mdc` | 仅 `globs` → Task 子 agent **不保证**自动匹配；见下 |

**硬红线**（API 格式、禁止项、目录约定）放 `.cursor/rules/`，关键约束用 `alwaysApply: true`。

### 每任务派 Task 前

> **自加载原则**：项目 skill 与 rule 含项目级开发规范与技能手册，必须可靠到达真正写代码的 fresh subagent。因 Task 为隔离上下文、`globs` 规则不保证自动匹配、编排者代为匹配存在漏配单点故障，**发现/加载下沉到 subagent**：由子 agent 在启动时按本任务将触碰的文件自行扫描并按需加载。编排者只提供 plan 显式 `Skills:`（权威）与任务 **Files**（匹配依据），不再逐条 `@` 引用规则。

1. 读 plan 该任务 **Files:** 与描述；读 `docs/automate/evolution-state.md`「项目技能规则索引」与 `skill_rule_index_source_count`
2. **技能**：plan 有 `**Skills:**` → 作为权威列表写入 Task prompt（子 agent 必 Read）；无则留空，交子 agent 自行匹配
3. **规则**：无需编排者逐条匹配；在 Task prompt 要求子 agent 先用索引匹配，索引缺失/过期才按 **Files** 自行扫描 `.cursor/rules/*.mdc`（`alwaysApply` 已由 Cursor 自动注入，无需重读）
4. **外置提示词**：若 `docs/automate/subagent/evolution-implementer.md` 存在，要求子 agent 自行 Read

Task prompt 首段模板（`<…>` 为当次任务实际填入；子 agent 隔离上下文，须**自加载**项目规范与技能）：

```markdown
## 启动（按本任务实际触碰的文件自加载项目规范与技能）

1. 项目规则：
   - 遵守已注入的 alwaysApply 规则
   - 先读 `docs/automate/evolution-state.md`「项目技能规则索引」匹配本任务 Files；索引缺失、source_count 不一致、或 Files 未覆盖才 Glob `.cursor/rules/*.mdc`，读各 frontmatter 的 `globs` / `description`，与本任务将触碰的文件路径比对；命中则 Read 并遵守（跳过已注入的 alwaysApply；匹配 0 条不编造规则路径）
2. 项目技能：
   - 指定 skill（plan 权威，若有则必 Read）：
     - `<skill-path>/SKILL.md`  <!-- plan 无 Skills 时删除本行 -->
   - 另自行匹配：优先用 `docs/automate/evolution-state.md`「项目技能规则索引」；索引缺失、source_count 不一致、或 Files 未覆盖才 Glob `.agents/skills`、`.cursor/skills`，读各 `SKILL.md` frontmatter `description`，按本任务 Files/描述选 1–3 个最相关项 Read（与上方列表去重；先读 frontmatter 再 Read 选中项，禁止全量 Read）
   - **跳过** frontmatter `description` 含「演化流程禁止调用」「演化 Automation … 禁止调用」等字样的技能（如 `create-evolution-*`，仅供用户手动触发）
3. 外置项目级实现约束（仅当文件存在时由 implementer 写入此行，否则删除）：
   - Read `docs/automate/subagent/evolution-implementer.md`，遵守其中实现相关约束（只能收窄/补充）
4. 再实现下列任务

## 任务
…
```

### 红线

- **禁止**假设 automate 仓库内有项目 skill / 规则；子 agent 只读**目标项目** `.agents/skills`、`.cursor/skills`、`.cursor/rules`
- **禁止**编排者在 prompt 中写死非 plan 来源的 skill / rule 名；规则匹配由子 agent 按 **Files** 与 frontmatter 自行完成
- **禁止**子 agent 一次性 Read 全部 skill 或全部 rule 全文；先读 frontmatter（`description` / `globs`）匹配，再 Read 选中项
- plan 未写 **Skills:** 时，**子 agent 必须**自行从项目 skill 目录匹配，不得跳过
- 索引命中足够时禁止重复全量扫描项目 skill/rule frontmatter；索引缺失、source_count 不一致、或无法覆盖 Files 时才重扫，并回写索引摘要与 `skill_rule_index_generated_at` / `skill_rule_index_source_count`
- **禁止**加载 frontmatter 标注「演化流程禁止调用」/「演化 Automation … 禁止调用」的人工交互技能（如 `create-evolution-goal/prd/plan`）；这些仅供用户手动触发

## Automation 覆盖

| 规则 | 要求 |
|---|---|
| 执行模式 | **固定 option 1**：Subagent-Driven Development |
| 用户确认 | **不询问** → 逐任务自动推进 |
| 每任务 | fresh implementer subagent（Task `generalPurpose`） |
| 双 review | Spec review → Quality review（Task `code-reviewer`），**禁止跳过** |
| TDD | 先写失败测试 → 实现 → 绿 |
| 范围 | **禁止**超出 plan + round-target 框定 |
| 分支 | 在功能分支开发，**禁止**在 main/master 直接改；开分支时**记录切出基分支** `base_branch`，P5 合并回该分支 |
| 前端 UI | 若 Task 含 **UI Acceptance** 或触及前端 UI 文件，必须加载计划指定的目标项目 UI/设计系统 skill；无匹配 skill 时按 design.md 通用 UI 质量基线实现，并完成视觉/状态 QA |

## 流程

```
读实现计划 → 创建 TodoWrite 任务列表
  → 每任务:
      0. 拼 Task prompt：plan Skills（权威）+ Files + 自加载指令（子 agent 自行匹配 skill/rule）
      1. Task implementer（隔离上下文，按 Files 自加载本任务相关 skill/rule）
      2. Task spec reviewer
      3. 不通过 → implementer 修复 → 重审
      4. Task code-reviewer
      5. 不通过 → implementer 修复 → 重审
      6. 前端 UI 任务：运行可用的设计 drift 静态检查；能启动前端时用浏览器截 desktop/mobile 图并人工比对 UI Acceptance
      7. commit + 标记任务完成
  → 全部任务完成
```

## 前端 UI 质量门控

仅当任务触及目标项目的前端 UI 文件时启用；纯后端/CLI/脚本项目不触发。

触及前端 UI 的任务，`Spec review` 与 `Quality review` 必须把以下项作为失败条件：

- 计划指定了 UI/设计系统 skill 但实现子 agent 未读取；或存在明显匹配 skill 却未按 Files/description 选中
- 页面使用硬编码颜色、默认调色板、局部私有按钮/表格/表单皮肤，或绕过项目已有组件体系
- 页面结构缺少明确主次层级：主操作不突出、卡片嵌套卡片、空白面积失衡、内容宽度无收口、表格/表单/详情区域承载关系混乱
- 缺少必要状态：loading、empty、error、disabled、selected、hover、focus、active、open/close 中与本任务相关的状态
- desktop 或 mobile 截图出现文本溢出、控件重叠、导航/工具栏拥挤、横向滚动未托管、图标/字号/间距明显不统一

前端 UI Task 完成摘要必须写明：

- `ui_design_skill: <已读取 skill 路径或 none>`
- `ui_acceptance: PASS`
- `screenshots: <desktop/mobile 路径或未运行原因>`
- `design_drift_checks: <命令与结果或未运行原因>`

## 输入

1. `docs/superpowers/plans/*.md`（全文）
2. `docs/superpowers/specs/*-design.md`（按需引用）
3. round-target 范围框定
4. 项目 `.agents/skills/`、`.cursor/skills/`、`.cursor/rules/`

## 产出

- 功能分支上的代码变更
- 测试（与实现同步）
- 每任务独立 commit（或按项目惯例）
- **`base_branch`**：功能分支切出时的基分支名（P5 PR/MR 合并目标）

同时更新 `docs/automate/evolution-state.md`「当前轮次」：

- `phase=P3_DONE`
- `branch=<功能分支名>`
- `base_branch=<切出基分支>`
- `prd_ids=<本轮触及 prd ID>`

## 完成标准

- [ ] plan 全部任务完成
- [ ] 每任务双 review 通过
- [ ] 测试在本地通过
- [ ] 前端 UI 任务的 UI Acceptance、截图 QA 或未运行原因、设计 drift 检查已记录
- [ ] 未超出范围框定

## 回传

```yaml
status: DONE | BLOCKED
phase: implementer
artifacts: [<功能分支名>]
summary:
  - "完成 <N> 任务"
  - "触及 <M> 文件"
  - "本地测试: exit_code 0"
  - "base_branch: <切出基分支>"
blockers: []
next: evolution-verifier
```

## 红线

- **禁止**跳过 Spec review 或 Quality review
- **禁止**未测试就标记任务完成
- **禁止**扩大扫描范围
- **禁止**前端 UI 任务在未加载/确认目标项目 UI 规范、未验证 UI Acceptance 时标记完成
