---
name: evolution-plan
description: >-
  自我演化 P2 计划 Automation 包装。在 Superpowers writing-plans 基础上强制完整计划与 option 1。
  由 subagent evolution-planner 执行。
---

# 计划（P2 · Automation）

## 何时使用

- P1 `design.md` 已完成
- 由 **subagent `evolution-planner`** 执行
- **先读本 skill**，再加载 Superpowers `writing-plans`

## Automation 覆盖（优先于标准 writing-plans）

| 规则 | 要求 |
|---|---|
| 用户确认 | **不询问** → writing-plans 完成后直接 option 1 |
| 占位符 | **禁止** TBD、TODO、「适当处理」 |
| 执行模式 | 头部**必须**含 `subagent-driven-development (option 1)` |
| 任务粒度 | 每步含完整代码片段 + 验证命令 |
| 范围 | 不得超出 design.md + round-target 框定 |

## 输入

1. `docs/superpowers/specs/*-design.md`（全文）
2. `docs/superpowers/evolution/*-round-target.md`
3. 范围框定内代码（按需）
4. 目标项目 `.agents/skills/`、`.cursor/skills/`、`.cursor/rules/`（按需 Glob，见下）

## 项目技能与规则（写 plan 时）

技能与规则**来自目标项目**，不在 automate 仓库维护；**禁止**在 plan 中写死特定框架 skill 或 rule 名（除非该路径确已在目标项目中 Glob 到）。

写 plan 前建议 **Glob**：

| 路径 | 用途 |
|------|------|
| `.agents/skills/*/SKILL.md` | 优先；读 frontmatter `description` |
| `.cursor/skills/*/SKILL.md` | 备选 skill 目录 |
| `.cursor/rules/*.mdc` | 了解 alwaysApply / globs，便于 Task 拆分与 **Files** 对齐 |

- **Skills:** 仅写 Glob 到的真实路径；按 Task **Files** 与 skill `description` 选 0–3 个
- 若 Task 触及前端 UI 文件（如 `*.tsx`、`*.jsx`、`*.vue`、`*.svelte`、页面/组件/样式目录等），且目标项目存在匹配的 UI/设计系统 skill，则该 Task 的 **Skills:** 必须显式写入该真实 skill 路径；若不存在匹配 skill，Task 必须写明 `UI skill: none` 并使用 design.md「UI 设计交付」中的通用 UI 质量基线
- 任务域与某条 `globs` 规则明显相关时，可在 Task 描述中注明「触及 `<路径域>`」，供 P3 动态 `@` 引用；**不要**在 plan 里预写未验证存在的 rule 文件名
- 将本次 Glob 到的项目 skill/rule frontmatter 写入 `docs/automate/evolution-state.md`「项目技能规则索引」（≤80 行，仅路径、description、globs、更新时间；禁止写全文）。同时在「当前轮次」写 `skill_rule_index_generated_at` 与 `skill_rule_index_source_count`。P3 优先使用该索引，缺失、source_count 不一致、或 Files 触及未覆盖路径时才重建。

## 产出

`docs/superpowers/plans/YYYY-MM-DD-<name>.md`

同时更新 `docs/automate/evolution-state.md`「当前轮次」：

- `phase=P2_DONE`
- `plan=<实现计划路径>`
- `skill_rule_index_generated_at=<ISO 时间或日期>`
- `skill_rule_index_source_count=<本次扫描 skill/rule 文件数>`

计划头部模板：

```markdown
# <主题> 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** <文件列表>
> **子项：** <prd ID 列表>
> **项目技能：** `.agents/skills/` 或 `.cursor/skills/`（P3 按 Files 按需 Read；plan 可预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；其余由 P3 按 Files 与 globs 动态匹配）
```

每个 Task 须含 **Files:**；可选 **Skills:**（仅当已 Glob 到且与 Files 相关时填写）：

```markdown
### Task N: …

**Files:** <相对项目根的路径>
**Skills:**（可选；省略则 P3 按 Files 自行匹配）
- Read `<.agents/skills 或 .cursor/skills 下的真实路径>/SKILL.md`
```

未写 **Skills:** 时，P3 根据 Files 与 skill `description` 从项目 skill 目录自行匹配（见 `evolution-implement`）。

前端 UI Task 还须包含 **UI Acceptance:**：

```markdown
**UI Acceptance:**
- 复用目标项目 UI/设计系统 skill 指定组件/布局；无匹配 skill 时遵守 design.md 通用 UI 质量基线
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡
- hover/focus/active/loading/empty/error 等状态有实现或有明确非目标说明
- 通过可用的设计 drift 静态检查（语义 token、图标出口、无硬编码色、无局部私有组件体系等）
```

## 完成标准

- [ ] 每个 design 子项有对应任务
- [ ] 无占位符
- [ ] 每任务有验证命令
- [ ] 前端 UI 任务已显式关联 UI/设计系统 skill 或记录 `UI skill: none`，并包含 UI Acceptance
- [ ] 预估总文件数 ≤ round-target 上限（≤20）

## 回传

```yaml
status: DONE | BLOCKED
phase: planner
artifacts: [docs/superpowers/plans/...]
summary: [<任务数、预估文件数>]
next: evolution-implementer
```
