---
name: doc-bootstrap
description: >-
  核心文档 bootstrap：检查并生成 docs/automate/goal.md、docs/automate/prd.md、docs/automate/evolution-state.md；
  docs/automate/plan.md 可选只读校验。由 subagent doc-bootstrap 执行，prd 生成走 prd-bootstrap + prd-scoring。
---

# 文档 Bootstrap

## 何时使用

- PR 闸门 `PASS` 后、选题前
- 由 **subagent `evolution-doc-bootstrap`** 执行

## 检查顺序（强制）

### 0. 确保 `docs/automate/` 目录存在

| 状态 | 动作 |
|------|------|
| 不存在 | `mkdir -p docs/automate` |
| 已存在 | 跳过 |

### 1. `docs/automate/goal.md`

| 状态 | 动作 |
|------|------|
| 不存在 | 分析 README、package 描述、现有文档 → 生成 goal.md（产品定位、核心目标、用户画像） |
| 已存在 | **只读，严禁修改** |

### 2. `docs/automate/prd.md`

| 状态 | 动作 |
|------|------|
| 不存在 | 加载 `skills/prd-bootstrap` → 扫描代码 → 生成 **hub + 分片**（`prd.md` + `prd/F<NN>-<域>.md`） |
| 存在·单文件旧格式（无 `evolution_hub: true`） | **不迁移**（结构迁移须人工跑 `create-evolution-prd`）；本轮照常使用，回传 summary 注明「建议人工迁移 hub+分片」 |
| 存在·hub+分片 | 确认 hub 含 **系统薄弱项汇总** + **8 维总表** + **功能索引**；缺失则加载 `skills/prd-scoring` 补全 |
| 存在·hub+分片·但严重过时 | 编排器判定后，按 prd-bootstrap 增量对齐 |

模板：`.cursor/automate/templates/prd-hub.md` + `.cursor/automate/templates/prd-feature.md`

### 3. `docs/automate/plan.md`（可选 · 只读）

| 状态 | 动作 |
|------|------|
| 不存在 | **跳过，禁止创建** |
| 已存在 | **只读**校验与 prd ID 映射一致；**禁止修改** |

当前节定义（供回传摘要）：第一个含未完成 `[ ]` 的节。

### 4. `docs/automate/evolution-state.md`

| 状态 | 动作 |
|------|------|
| 不存在 | 按 `.cursor/automate/templates/evolution-state.md` 创建空模板（当前轮次、待办池、模块地图、项目技能规则索引、上次扫描摘要、选题卡住计数） |
| 已存在 | 确认含下列固定章节；缺失则补空章节，保留已有内容 |

固定章节：

```markdown
## 当前轮次

| 字段 | 值 |
|------|----|
| phase | idle |
| round_target |  |
| design |  |
| plan |  |
| branch |  |
| base_branch |  |
| prd_ids |  |
| pr_number |  |
| last_verified_command |  |
| last_verified_exit_code |  |
| deployed_automate_rev |  |
| skill_rule_index_generated_at |  |
| skill_rule_index_source_count |  |

## 待办池

## 模块地图

## 项目技能规则索引

> 由 P2/P3 按需刷新；仅保存路径、frontmatter 摘要、globs，不保存全文。
> 当 `.agents/skills`、`.cursor/skills`、`.cursor/rules` 文件数量变化，或 plan 触及未覆盖路径时，视为过期并刷新。

## 上次扫描摘要

## 选题卡住计数（连续未过 90 的功能项）

| prd ID | 连续未过轮次 | 最近加权总分 | 最近评分日期 |
|--------|:-----------:|:-----------:|------------|
```

旧账本迁移规则：

- 已存在 `docs/automate/evolution-state.md` 时，**禁止重建覆盖**
- 若缺固定章节，只在文件末尾追加缺失章节，保留原有待办池、模块地图、STUCK 计数
- 若已有 `当前轮次` 但缺字段，只补字段行；未知旧字段保留
- 若 `.cursor/automate/VERSION` 存在，把 `automate_rev` 记录到 `deployed_automate_rev`
- 若 `项目技能规则索引` 为空，不在 G1 扫描项目 skills/rules；只回传 `state: skill/rule index empty, P2 will refresh`

## 产出提交

- 若本轮新建文档 → 可在 bootstrap 分支提交，或并入本轮功能 PR 的第一批文件
- **禁止**修改已存在的 `docs/automate/goal.md`
- **禁止**创建或修改 `docs/automate/plan.md`

## 回传

```yaml
status: DONE
phase: doc-bootstrap
artifacts:
  - docs/automate/goal.md
  - docs/automate/prd.md
  - docs/automate/prd/
  - docs/automate/evolution-state.md
  # docs/automate/plan.md 仅当已存在且校验通过时列入
summary:
  - "prd: 12 功能项，薄弱项 Top3: AUTH-003(16), UI-002(18)"
  - "plan: 无 | 当前节 M4-2（只读）"
  - "state: 当前轮次/索引/卡住计数章节已就绪"
next: evolution-picker
```
