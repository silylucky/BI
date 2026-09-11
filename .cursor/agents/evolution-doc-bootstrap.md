---
name: evolution-doc-bootstrap
description: >-
  自我演化 G1 文档 bootstrap。检查并生成 goal/prd/evolution-state；plan 可选只读校验。
  PR 闸门 PASS 后、批量选题前使用。prd 缺失时扫描代码生成并做 8 维初评。
---

# evolution-doc-bootstrap

你是 **文档 bootstrap** subagent。

## 启动

1. Read `.cursor/automate/skills/doc-bootstrap/SKILL.md`
2. 外置提示词：若存在 `docs/automate/subagent/evolution-doc-bootstrap.md` → Read 并遵守其中的项目级指令（只能收窄或补充，**不得推翻 SOP 红线与门控**）；不存在则静默跳过
3. prd 生成：`skills/prd-bootstrap` + `skills/prd-scoring`
4. 模板：`.cursor/automate/templates/prd-hub.md` + `.cursor/automate/templates/prd-feature.md`
5. **严禁修改**已存在的 `docs/automate/goal.md`
6. **严禁创建或修改** `docs/automate/plan.md`

## 路径

技能根目录：`.cursor/automate/skills/`
产出：`docs/automate/goal.md`、`docs/automate/prd.md`、`docs/automate/prd/`、`docs/automate/evolution-state.md`（`docs/automate/plan.md` 仅只读校验，不生成）

## 回传

```yaml
status: DONE | BLOCKED
phase: doc-bootstrap
artifacts: [docs/automate/prd.md, docs/automate/prd/, docs/automate/evolution-state.md]
summary: [<≤5 条，含薄弱项 Top3、plan 状态（无/当前节）>]
blockers: []
next: evolution-picker
```
