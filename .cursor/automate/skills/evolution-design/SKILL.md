---
name: evolution-design
description: >-
  自我演化 P1 设计 Automation 包装。在 Superpowers brainstorming 基础上覆盖无人值守规则。
  由 subagent evolution-designer 执行。
---

# 设计（P1 · Automation）

## 何时使用

- G2 `round-target.md` 已锁定
- 由 **subagent `evolution-designer`** 执行
- **先读本 skill**，再加载 Superpowers `brainstorming`

## Automation 覆盖（优先于标准 brainstorming）

| 标准 brainstorming | Automation 替换 |
|---|---|
| 逐条问用户 | 用 round-target「每轮必答」+ PRD 8 维薄弱项代替 |
| 等待用户批准 spec | 写完 spec self-review 即完成 |
| 自由探索代码库 | **仅**读 round-target **范围框定**内文件 |
| 扩大设计范围 | **禁止**超出框定文件/模块 |

## 输入

1. `docs/superpowers/evolution/*-round-target.md`（必读）
2. `docs/automate/goal.md`、`docs/automate/prd.md` 对应功能项（只读校验）
3. 范围框定内的现有代码（按需 Read）
4. 若本轮范围触及目标项目的前端 UI 文件（如 `*.tsx`、`*.jsx`、`*.vue`、`*.svelte`、页面/组件/样式目录等）：必须按目标项目真实存在的 `.agents/skills/*/SKILL.md`、`.cursor/skills/*/SKILL.md` 匹配并读取 UI/设计系统相关 skill；若目标项目没有匹配 skill，则在 design.md 记录 `ui_design_skill: none` 并使用下方通用 UI 质量基线

## 产出

`docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`

同时更新 `docs/automate/evolution-state.md`「当前轮次」：

- `phase=P1_DONE`
- `design=<design.md 路径>`

须含：

- 批量主题与子项映射（prd ID）
- 每项验收标准（可测试）
- 范围框定文件列表
- 非目标（明确不做）
- 与 PRD 8 维薄弱项的对齐说明
- 若触及前端 UI，必须额外包含「UI 设计交付」小节：
  - `ui_design_skill`: 已读取的目标项目 UI/设计系统 skill 路径；无则写 `none`
  - 页面信息架构：导航层级、主内容区宽度/密度、空/加载/错误/权限态
  - 视觉层级：主操作、次操作、卡片/表格/表单/弹层的承载关系，避免只用大面积空白容器堆页面
  - 组件映射：复用哪些现有组件，哪些需要补封装，禁止页面局部重画一套按钮/表格/输入框
  - Token 与密度：语义色、背景层、边框、阴影、间距、圆角、字号、图标尺寸的统一策略
  - 响应式与可访问性：桌面/窄屏布局、键盘焦点、aria-label、长文本截断/换行策略
  - 视觉 QA 清单：至少覆盖 desktop 与 mobile 截图，检查对齐、留白、层级、状态、色彩漂移、文本溢出、控件重叠

## 完成标准

- [ ] 覆盖 round-target 全部子项
- [ ] 未超出范围框定
- [ ] self-review 通过（无 TBD/TODO）
- [ ] 若触及前端 UI，已读取目标项目 UI/设计系统 skill 或记录无匹配 skill，且 design.md 含完整「UI 设计交付」
- [ ] **禁止**写生产代码

## 回传

```yaml
status: DONE | BLOCKED
phase: designer
artifacts: [docs/superpowers/specs/...]
summary: [<N 项、范围框定文件数>]
next: evolution-planner
```
