# GitLab Issue 驱动 SOP

**Automations 独立任务**：Issue 检测 → 路由 → 设计 → 开发 → 验证 → MR 合并 → 关闭 Issue，全闭环。

与 [`self-evolution.md`](./self-evolution.md) 的分工：

- **本 SOP**：仅处理 GitLab 上**已存在的 Open Issue**（Bug → Path B，功能 → Path F）
- **自我演化**：无 Issue 或需主动演化 → 使用 `self-evolution.md`，**勿在本流程中执行**

**无 Open Issue 时直接结束**，禁止读 prd、扫代码、创建 Issue。

---

## 部署

```bash
git submodule add <repo> .automate
bash .automate/install.sh
```

Automations 入口：

```
Read .cursor/automate/sop/gitlab-issue.md
```

| 层 | 路径 |
|----|------|
| **SOP** | `.cursor/automate/sop/gitlab-issue.md` |
| **Skill** | `.cursor/automate/skills/`（与自我演化共用） |
| **Subagent** | `.cursor/agents/evolution-*.md`（按需委派） |

---

## 流程定位

本流程为**Issue 驱动的独立自动化**，仅消费 GitLab 已有 Issue：

```
Phase 0  Issue 检测与路由
  ├── 有 Issue（Bug）     → Path B：Bug 分析 + 修复 + 验证 + 收尾
  ├── 有 Issue（Feature） → Path F：Phase 1–5 功能开发
  └── 无 Open Issue      → 结束（不开发、不演化、不创建 Issue）
          ↓（有 Issue 时）
  Phase 1–4  设计 + 计划 + 开发 + 验证
          ↓
  Phase 5  创建 MR → 合并 → 关闭 Issue → 评论结案
```

本流程负责**从 Issue 检测到合并关闭的完整闭环**，包含 approve、merge 及 Issue 结案。

## Superpowers 工作流总览

```
Phase 0  入口检测          → Issue 检测 & 路由（无 Issue → 结束）
Path B   Bug 修复入口       → Bug 分析 → 修复计划（有 Bug Issue 时）
Path F   功能开发入口       → Phase 1–5（有功能 Issue 时）
Phase 1  brainstorming     → 探索 + 设计文档
Phase 2  writing-plans     → 实现计划
Phase 3  subagent-driven-dev → 选项 1：每任务派子 agent + 双阶段 review
Phase 4  verification      → 验证测试通过
Phase 5  finishing         → 创建 MR → 合并 → 关闭 Issue → 评论结案
```

**writing-plans 完成后不询问用户**，直接选择 **选项 1：Subagent-Driven Development**。

---

# Phase 0：入口检测（Issue 检测 & 路由）

**宣布：**「正在检查代码仓库中的待处理 Issue。」

### 0.1 获取当前仓库的 Open Issues

用 GitLab MCP 列出 open issues，整理：

- Issue 编号、标题、labels、创建时间、优先级标签（若有）
- 过滤掉 Draft PR 关联的占位 Issue

**多个 Issue 时的优先级排序**（只处理排名第一的）：

1. label 含 `priority:critical` 或 `urgent` → 最优先
2. label 含 `bug` → 次优先（线上问题影响用户）
3. label 含 `enhancement` / `feature` → 按创建时间最早排序
4. 同优先级 → 取编号最小（最早创建）

记录本次处理的 **Issue 编号**，全流程使用。

### 0.2 路由决策

| 条件 | 路由 |
|------|------|
| 有 Open Issue，label 含 `bug` 或标题含 `fix/error/crash/broken/regression` | → **Path B：Bug 修复**（Phase B1 → B2 → B3 → Phase 4 → Phase 5） |
| 有 Open Issue，label 为 `enhancement` / `feature` 或无特殊 label | → **Path F：功能开发**（Phase 1 → 2 → 3 → 4 → 5） |
| **无 Open Issue** | → **结束**。输出摘要后退出；**禁止**开发、读 prd、扫代码、创建 Issue |

**不要同时处理多个 Issue。**

### 0.3 无 Issue 时（强制）

**宣布：**「无待处理 Issue，本轮结束。」

```yaml
status: DONE
phase: issue-detection
summary: ["无 Open Issue，未进入开发"]
next: null
```

演化需求请切换 Automations 任务至 `sop/self-evolution.md`。

---

# Path B：Bug 修复

## Phase B1：Bug 分析

**宣布：**「正在分析 Bug Issue #<issue_number>。」

### B1.1 读取 Issue 完整上下文

用 GitLab MCP 读取 Bug Issue 全文（含截图、日志、复现步骤、跟进评论）。记录：

- Bug 描述、复现步骤、实际行为 vs 预期行为
- 影响范围（版本、模块、受影响用户比例）
- 严重程度（崩溃 / 数据错误 / 功能异常 / 样式问题）

### B1.2 根因分析

- 浏览相关代码、近期 commit、对应测试用例
- 定位根因（错误代码路径 / 边界条件 / 竞态 / 配置错误 / 数据异常）
- 判断是**单点 Bug** 还是**系统性问题**（系统性问题需拆分 Issue）

### B1.3 修复方案评估

提出 1–2 种修复方案，对比：

- 影响范围（是否影响现有功能）
- 修复彻底性（治标 vs 治本）
- 测试策略（如何通过测试复现并验证修复）

### B1.4 撰写 Bug 分析文档

保存至：

```
docs/superpowers/specs/YYYY-MM-DD-bug-<issue-number>-<bug-name>.md
```

须包含：

- Bug 根因分析
- 推荐修复方案及理由
- 影响评估（范围与风险）
- 验证方法（复现步骤 + 修复后验证命令）

### B1.5 阶段闸门

- [ ] 根因已定位
- [ ] 修复方案已确定
- [ ] 测试策略已明确（含复现测试设计）

---

## Phase B2：Bug 修复计划

等同 **Phase 2（Writing Plans）**，差异点：

- 计划文件命名：`docs/superpowers/plans/YYYY-MM-DD-bug-<issue-number>-<bug-name>.md`
- 计划**必须以复现测试开头**：先写 failing test 复现 bug → 确认测试失败 → 再实现修复
- 计划中注明 Issue 编号

---

## Phase B3：Bug 修复执行

等同 **Phase 3（Subagent-Driven Development）**，差异点：

- 分支命名：`fix/<issue-number>-<bug-name>`
- 子 agent 接收任务时须包含 Bug 分析文档路径与根因摘要

**完成后进入 Phase 4（验证）。**

---

# Phase 1：Brainstorming（需求 → 设计）

> **适用路径：** Path F（有功能 Issue）

**宣布：**「正在使用 brainstorming 流程分析 Issue 需求。」

### 1.1 读取 Issue 完整上下文

用 GitLab MCP 读取 Phase 0 选定的 Issue 全文（含截图、跟进消息）。记录：

- 需求摘要、验收标准、优先级
- 约束（截止时间、技术限制、不能动的模块）

**Issue 是唯一需求来源。** 本流程**禁止**读取 `docs/automate/prd.md` 补充或改写需求；prd 对齐在 MR 合并后由人工或其他流程处理。

### 1.2 探索项目上下文

- 浏览相关代码、文档、近期 commit
- 确认需求影响范围；若涉及多个独立子系统，**拆分为子项目**，本次只处理第一个

### 1.3 澄清需求（Automation 适配）

Brainstorming 默认逐条向用户提问。在 Automation 中：

- 若 issue 需求信息**已足够明确** → 记录合理假设，写入设计文档「假设」章节，继续
- 若存在**关键歧义**（影响架构选型）→ 从系统定位和目标的第一性原理评估最优选择
- **不要**在一条 Automation 运行中连问多个问题

### 1.4 提出 2–3 种方案

在内部比较方案利弊，设计文档中写明推荐方案及理由。

### 1.5 撰写设计文档

保存至：

```
docs/superpowers/specs/YYYY-MM-DD-<feature-name>-design.md
```

须包含：

- 背景与目标（引用 Issue 编号）
- 验收标准（可测试，与 Issue 中的验收标准对应）
- 推荐方案与架构
- 不做什么（范围边界）
- 假设与待确认项

### 1.6 设计自检

检查：占位符、矛盾、歧义、范围蔓延。有问题当场修正。

### 1.7 阶段闸门

- [ ] 设计文档已保存，含 Issue 编号引用
- [ ] 验收标准可测试
- [ ] 范围明确且可在一个 PR 内完成

**禁止**在本阶段写生产代码或脚手架。

---

# Phase 2：Writing Plans（设计 → 实现计划）

**宣布：**「正在使用 writing-plans 流程编写实现计划。」

### 2.1 编写计划

保存至：

```
docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md
```

计划开头**必须**包含：

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development (option 1).
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** [一句话]

**Issue:** #<issue_number>

**Architecture:** [2-3 句]

**Tech Stack:** [关键技术]

---
```

### 2.2 任务粒度

每个任务 2–5 分钟一步，包含：

- 精确文件路径（Create / Modify / Test）
- **完整代码**（不允许 TBD、TODO、「适当处理」）
- 精确命令与预期输出
- TDD 步骤：写失败测试 → 运行确认失败 → 最小实现 → 运行确认通过 → commit

### 2.3 计划自检

对照设计文档检查：每条需求有对应任务；无占位符；类型/命名前后一致；Issue 编号已在计划头部记录。

### 2.4 执行方式（固定选 1，不询问）

**writing-plans 完成后直接进入 Phase 3，不询问用户选 1 还是 2。**

| 选项 | 本 Automation |
|------|---------------|
| **1. Subagent-Driven（选用）** | 每任务派独立子 agent + 双阶段 review |
| 2. Inline Execution | **不采用** |

---

# Phase 3：Subagent-Driven Development（选项 1）

**宣布：**「正在使用 subagent-driven-development 执行计划。」

### 3.1 准备隔离工作区

按 `using-git-worktrees` 原则创建隔离环境：

1. 从当前工作基分支创建功能分支（记录 `base_branch` = 切出点分支名）：
   - 功能 PR：`feat/<feature-name>`
   - Bug 修复 PR：`fix/<issue-number>-<bug-name>`
2. 优先使用 `.worktrees/` 或 `worktrees/` 目录；Cloud Agent 若不支持 worktree，在功能分支上直接工作
3. **禁止**在 `dev` / `main` / `master` 上直接开发（除非当前 `base_branch` 就是它们）

### 3.2 读取计划并建任务列表

- 一次性读取计划全文
- 提取所有任务完整文本与上下文
- 用 TodoWrite 创建任务清单，逐项推进

### 3.3 每任务循环（严格顺序）

对每个任务执行：

#### Step A：派发 Implementer 子 agent

使用 Task 工具（`generalPurpose` 等），按以下模板派发。**不要把计划文件路径丢给子 agent，粘贴任务全文。**

```
Task: Implement Task N: [任务名]

## Task Description
[从计划中粘贴完整任务文本]

## Context
[该任务在整体中的位置、依赖、架构背景]

## Before You Begin
有歧义先提问；无歧义再动手。

## Your Job
1. 严格按任务规范实现
2. 遵循 TDD（先失败测试，再实现）
3. 运行验证命令，确认通过
4. Commit（中文 commit message）
5. Self-review：检查遗漏、多余实现、测试覆盖
6. 回报状态：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED

Work from: [功能分支 / worktree 路径]
```

**禁止**并行派发多个 Implementer（避免冲突）。

#### Step B：Spec Compliance Review

任务完成后，派发 **spec-reviewer** 子 agent：

- 对照计划检查：需求是否全覆盖、有无多余实现
- 未通过 → Implementer 修复 → 重新 spec review
- 通过 ✅ 后才进入 Step C

#### Step C：Code Quality Review

Spec 通过后，派发 **code-quality-reviewer** 子 agent：

- 检查代码质量、测试、命名、边界情况
- 未通过 → Implementer 修复 → 重新 quality review
- 通过 ✅ 后标记 Todo 任务完成

**禁止**在 spec review 未 ✅ 时开始 quality review。

#### Step D：处理子 agent 状态

| 状态 | 处理 |
|------|------|
| DONE | 进入 review |
| DONE_WITH_CONCERNS | 阅读 concerns，判断后继续或修复 |
| NEEDS_CONTEXT | 补充上下文后重新派发 |
| BLOCKED | 评估：补上下文 / 拆任务 / 回报人工并退出（**不要**自行切换 subagent 模型） |

### 3.4 全部任务完成后

派发 **final code-reviewer** 子 agent，对整个实现做最终审查。

---

# Phase 4：Verification Before Completion

**宣布：**「正在执行 verification-before-completion。」

在声称完成前**必须**：

1. 确定验证命令（项目测试套件：`npm test` / `go test ./...` / `pytest` 等）
2. **完整运行**命令
3. 读取输出与 exit code
4. 测试失败 → **停止**，不创建 PR，在对应 Issue 上添加失败说明评论，Slack 通知阻塞原因
5. 测试通过 → 继续 Phase 5

**禁止**未跑测试就声称「已完成」。

---

# Phase 5：Finishing（PR → 合并 → 关闭 Issue）

**宣布：**「正在使用 finishing-a-development-branch 流程收尾。」

### 5.1 确认 Issue 编号

Issue 编号在 Phase 0 检测时已记录，直接使用。**禁止**在本流程中创建新 Issue。

### 5.2 创建 PR

通过 GitLab MCP 创建 MR（**统一为非 Draft · Ready for Review**）：

**功能 PR：**

```
title：feat: <描述> (closes #<issue_number>)

body：
Closes #<issue_number>

## 需求
<摘要，与 Issue 验收标准对应>

## 方案
<设计要点，链到 docs/superpowers/specs/...>

## 实现
<改了什么文件 / 模块>

## 测试
<验证命令与输出结果>

## 来源
Issue: #<issue_number> <issue_标题>
```

**Bug 修复 PR：**

```
title：fix: <描述> (fixes #<issue_number>)

body：
Fixes #<issue_number>

## 根因
<Bug 分析摘要>

## 修复方案
<修复要点>

## 验证
<复现测试 + 修复后验证命令与结果>

## 来源
Issue: #<issue_number> <issue_标题>
```

PR body 中使用 `Closes #N`（功能）或 `Fixes #N`（Bug）。

### 5.3 合并 PR

MR 创建成功后，用 GitLab MCP 执行 **Squash merge**：

- 合并策略：**Squash merge**（保持主分支提交历史整洁）
- 合并 commit message：`<PR 标题> (#<pr_number>)`
- 合并目标分支：**功能分支切出时的基分支**（从哪切出就合并回哪；**禁止**默认假设 `dev` / `main`）

合并成功后记录合并时间与 commit SHA。

### 5.4 关闭 Issue + 结案评论

合并完成后，用 GitLab MCP 在 Issue 上添加结案评论，再确认 Issue 已关闭（MR 描述含 `Closes #N` / `Fixes #N` 时会自动关闭，否则手动关闭 issue）：

```
✅ 已完成并关闭

- MR #<mr_number> 已合并至 <目标分支>
- 变更摘要：<一句话描述改动内容>
- 合并时间：<timestamp>
- Commit：<short_sha>
```

### 5.5 清理分支

合并后删除功能分支（GitLab MCP 删除分支），保持仓库整洁。

---

## 工具约束

- 使用 GitLab MCP 进行 Issue **读取**、评论、MR 创建、合并、关闭、分支删除
- **禁止**使用 GitLab MCP **创建 Issue**（本流程不造 Issue）
- 使用 Read 工具确认消息内容与图片
- 遵循 Superpowers 阶段顺序，**禁止跳阶段**
- writing-plans 后**固定** Subagent-Driven（选项 1），不询问
- 每任务必须：Implementer → Spec Review → Quality Review
- 子 agent 必须遵循 TDD
- 完成前必须跑测试验证
- 固定创建 PR 后执行 Squash merge，不保留功能分支

## 红线

- **禁止**在 Phase 0 路由完成前进入任何开发阶段
- **禁止**在无 Open Issue 时继续（须按 0.3 结束；演化用 `self-evolution.md`）
- **禁止**自行创建 Issue、读 prd 选题、扫代码找改进点
- **禁止**同时处理多个 Issue
- **禁止**读取 `docs/automate/prd.md` 作为本流程需求来源
- 设计未文档化前**禁止**写生产代码
- 计划中**禁止**占位符
- **禁止**跳过 spec review 或 quality review
- **禁止**并行派发多个 Implementer
- **禁止**未验证就声称测试通过
- **禁止**在 `dev` / `main` / `master` 上直接开发
- review 有问题**禁止**带问题进入下一任务
- **禁止**在 MR 创建后跳过合并步骤（须完成合并 → 关闭 Issue → 结案评论）
- **禁止**在 MR 创建前忘记填写 `Closes #N` / `Fixes #N`
