# F-F Companion 全量收官设计

> 日期：2026-07-09 · 无人值守 · plan 剩余 20 项

## 范围

| 来源 | 项数 | ID |
|------|------|-----|
| M-DASH-UX 可选 | 2 | DASH-002 多选/对齐、DASH-004 联动配置 |
| M-PRODUCT F-F | 18 | META×6、RPT×5、CAT×2、DASH×2、VIEW×2、NFR×2 |

**完成定义**：companion 可测 + plan `[x]` + PRD 分片对应 `[ ]`→`[x]` + 必要 API 登记。

## 方案（选定）：五轨 worktree + 三波并行

| 轨 | 分支 | 项 |
|----|------|-----|
| A | `cursor/ff-track-a-dash-e95d` | DASH-002†、DASH-004† |
| B | `cursor/ff-track-b-meta-e95d` | META-001~006 |
| C | `cursor/ff-track-c-rpt-e95d` | RPT-001,002,003,005,007 |
| D | `cursor/ff-track-d-cat-e95d` | CAT-002,003,DASH-005,006 |
| E | `cursor/ff-track-e-view-nfr-e95d` | VIEW-001,VIEW-003*,NFR-003*,NFR-005* |

\* plan ID 与 PRD 行对齐：VIEW-003→VIEW-002 companion；NFR-003→NFR-001；NFR-005→NFR-002。

## 非目标

- SQLBot/AI、Monaco、AntV L7、Celery、真实 SMTP 生产、全量 DE WYSIWYG

## 验收

- 各轨 pytest/vitest 绿
- `plan.md` 20 行全勾
- `prd.md` hub + 相关分片 companion 同步
