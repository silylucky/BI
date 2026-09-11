---
description: 站内帮助（与 docs/ 工程文档职责分离 · 人话）
globs:
  - "{{HELP_GLOBS}}"
alwaysApply: false
---

# 站内帮助

| 目录 | 受众 |
|------|------|
| `docs/` | 研发 / Agent |
| `{{HELP_CONTENT_DIR}}` | 交付 / 运维 / 用户 |

- 用户操作说明变更 → 更新帮助正文；同步见 @.cursor/rules/prd-sync.mdc
- 文案口径：人话（见 @.cursor/rules/production.mdc）；禁 PRD 编号、甲乙方
- 禁止用平行静态站（如独立 Docusaurus）替代产品内帮助（除非 arch 明确例外）
