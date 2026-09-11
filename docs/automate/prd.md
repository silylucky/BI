# VitalSpan — 产品需求文档（PRD · Hub）

```yaml
version: 1.2.126
last_updated: 2026-09-01
truth_source: true
evolution_hub: true
goal_ref: docs/automate/goal.md
features_ref: docs/automate/prd/
scoring_ref: .cursor/automate/skills/prd-scoring/SKILL.md
feature_count: 130
domain_count: 16
```

> **本文件是索引层（hub）**：8 维评分、薄弱项汇总、功能索引**仅在本文件**维护。
> 验收标准、代码锚点、逐条说明在 [`prd/`](./prd/) 分片（**16 域 · 130 项**（129 合同 + CONN-028 companion）），按 ID 按需加载。

## 系统薄弱项汇总（按总分升序，供选题）

> 更新：2026-07-08 · 规范见 `prd-scoring` · 本轮重评：CONN-023/024、BOOT-002、VIZ-002、DESIGN-004（M-PRODUCT F-A/F-C companion IA）

> **Doc sync 注记（2026-07-29）**：M-DEPTH 必做 F-A/B/C/E 叙事已与代码对齐（见 [project master](../feature-design/2026-07-29-vitalspan-project-master-gap-fill.md)）。分片内剩余 `[ ]` 多为 **演化建议 / 可选 / 发版 QA**，不等同于 129 项合同未交付。

> **Doc sync 注记（2026-07-30）**：M-DEPTH **F-D 三项已闭合**（API-006 公开分享 · BOOT-002 Palette Drawer · DESIGN-001 ADR-15）；plan.md F-D 3/3 `[x]`。

| 排名 | ID | 功能 | 总分 | 最薄弱维度 | 建议优先级 |
|------|-----|------|------|------------|------------|
| 1 | CONN-027 | 连接器项 | 90.1 | 性能 | M-FINAL 已收官 |
| 2 | API-002 | 集成项 | 90.2 | 性能 | 见期次 |
| 3 | API-005 | 集成项 | 90.2 | 用户价值 | 见期次 |
| 4 | VIZ-006 | 可视化项 | 90.2 | 性能 | 见期次 |
| 5 | API-003 | 集成项 | 90.4 | 用户价值 | 见期次 |
| 6 | API-001 | 集成项 | 90.6 | 用户价值 | 见期次 |
| 7 | API-006 | 集成项 | 90.6 | 用户价值 | 见期次 |
| 8 | BOOT-005 | 启动项 | 90.7 | 用户价值 | 见期次 |
| 9 | API-004 | 集成项 | 90.7 | 用户价值 | 见期次 |
| 10 | AUTH-006 | 鉴权项 | 90.8 | 用户价值 | 见期次 |

---

## 功能项 8 维评分总表

> 各列存**维度分%**；末列加权总分（高×3/中×2）。完整 **129** 行 — 详见分片。

| ID | 用户价值 | 完整度 | 可靠性 | 交互体验 | 架构健康 | 测试覆盖 | 性能 | 安全性 | 加权总分 | 薄弱项 |
|----|:--------:|:------:|:------:|:--------:|:--------:|:--------:|:----:|:------:|:--------:|--------|
| BOOT-001 | 84 | 98 | 92 | N/A | 88 | 98 | 88 | 88 | 91.0 | 用户价值 |
| BOOT-002 | 98 | 100 | 94 | 98 | 98 | 100 | 90 | 94 | 96.6 | 性能 |
| BOOT-003 | 92 | 100 | 94 | 90 | 90 | 100 | 88 | 94 | 93.8 | 性能 |
| BOOT-004 | 84 | 98 | 92 | N/A | 90 | 98 | 88 | 88 | 91.2 | 用户价值 |
| BOOT-005 | 84 | 96 | 90 | N/A | 88 | 100 | 88 | 90 | 90.7 | 用户价值 |
| BOOT-006 | 84 | 96 | 92 | N/A | 90 | 100 | 88 | 90 | 91.3 | 用户价值 |
| AUTH-001 | 90 | 100 | 98 | 86 | 90 | 100 | 86 | 90 | 93.1 | 性能 |
| AUTH-002 | 84 | 98 | 96 | N/A | 90 | 100 | 86 | 88 | 92.1 | 用户价值 |
| AUTH-003 | 90 | 100 | 98 | 86 | 90 | 100 | 86 | 90 | 93.1 | 性能 |
| AUTH-004 | 92 | 100 | 96 | 90 | 92 | 100 | 88 | 92 | 94.1 | 性能 |
| AUTH-005 | 82 | 96 | 96 | N/A | 90 | 100 | 88 | 90 | 91.6 | 用户价值 |
| AUTH-006 | 82 | 96 | 94 | N/A | 90 | 100 | 86 | 88 | 90.8 | 用户价值 |
| AUTH-007 | 82 | 96 | 94 | N/A | 90 | 100 | 86 | 90 | 91.1 | 用户价值 |
| AUTH-008 | 84 | 96 | 94 | N/A | 90 | 100 | 90 | 92 | 92.1 | 用户价值 |
| DS-001 | 82 | 94 | 94 | N/A | 94 | 100 | 86 | 88 | 90.9 | 用户价值 |
| DS-002 | 92 | 100 | 96 | 88 | 92 | 100 | 88 | 90 | 93.7 | 性能 |
| DS-003 | 90 | 100 | 98 | 88 | 90 | 100 | 86 | 90 | 93.3 | 性能 |
| DS-004 | 90 | 100 | 94 | 86 | 90 | 100 | 86 | 90 | 92.4 | 性能 |
| DS-005 | 82 | 96 | 96 | N/A | 90 | 100 | 86 | 96 | 92.1 | 用户价值 |
| DS-006 | 82 | 96 | 96 | N/A | 92 | 100 | 88 | 88 | 91.6 | 用户价值 |
| DS-007 | 94 | 100 | 94 | 96 | 92 | 100 | 86 | 88 | 94.1 | 性能 |
| DS-008 | 84 | 94 | 96 | N/A | 90 | 100 | 86 | 92 | 91.6 | 用户价值 |
| CONN-001 | 88 | 96 | 96 | N/A | 90 | 100 | 86 | 90 | 92.5 | 性能 |
| CONN-002 | 88 | 96 | 96 | N/A | 90 | 100 | 86 | 90 | 92.5 | 性能 |
| CONN-003 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 90 | 92.4 | 性能 |
| CONN-004 | 86 | 94 | 94 | N/A | 90 | 100 | 88 | 92 | 91.9 | 用户价值 |
| CONN-005 | 86 | 94 | 94 | N/A | 90 | 100 | 90 | 92 | 92.1 | 用户价值 |
| CONN-006 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 92 | 92.4 | 性能 |
| CONN-007 | 88 | 96 | 96 | N/A | 90 | 100 | 92 | 90 | 93.2 | 用户价值 |
| CONN-008 | 88 | 96 | 96 | N/A | 90 | 100 | 90 | 90 | 92.9 | 用户价值 |
| CONN-009 | 88 | 96 | 96 | N/A | 90 | 100 | 90 | 88 | 92.6 | 用户价值 |
| CONN-010 | 88 | 94 | 94 | N/A | 90 | 100 | 90 | 88 | 91.9 | 性能 |
| CONN-011 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 88 | 91.9 | 性能 |
| CONN-012 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 88 | 91.9 | 用户价值 |
| CONN-013 | 86 | 96 | 96 | N/A | 92 | 100 | 88 | 90 | 92.6 | 用户价值 |
| CONN-014 | 88 | 96 | 96 | N/A | 90 | 100 | 90 | 90 | 93.0 | 用户价值 |
| CONN-015 | 88 | 96 | 96 | N/A | 90 | 100 | 90 | 90 | 93.0 | 用户价值 |
| CONN-016 | 88 | 94 | 94 | N/A | 90 | 100 | 90 | 90 | 92.2 | 用户价值 |
| CONN-017 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 90 | 92.6 | 架构健康 |
| CONN-018 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 88 | 92.4 | 安全性 |
| CONN-019 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 90 | 92.6 | 架构健康 |
| CONN-020 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 90 | 92.6 | 架构健康 |
| CONN-021 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 88 | 92.4 | 安全性 |
| CONN-022 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 88 | 92.4 | 用户价值 |
| CONN-023 | 92 | 100 | 94 | 90 | 90 | 100 | 90 | 90 | 93.6 | 性能 |
| CONN-024 | 92 | 100 | 94 | 88 | 90 | 100 | 88 | 90 | 93.2 | 性能 |
| CONN-025 | 88 | 96 | 94 | N/A | 90 | 98 | 88 | 90 | 92.4 | 性能 |
| CONN-026 | 88 | 94 | 92 | N/A | 90 | 96 | 88 | 88 | 91.0 | 安全性 |
| CONN-027 | 88 | 92 | 92 | N/A | 90 | 92 | 86 | 90 | 90.1 | 性能 |
| QUERY-001 | 86 | 96 | 96 | N/A | 90 | 100 | 90 | 92 | 92.8 | 架构健康 |
| QUERY-002 | 86 | 96 | 96 | N/A | 90 | 100 | 90 | 88 | 92.4 | 安全性 |
| QUERY-003 | 88 | 94 | 96 | N/A | 90 | 100 | 90 | 90 | 92.6 | 用户价值 |
| QUERY-004 | 82 | 94 | 94 | N/A | 92 | 100 | 90 | 90 | 91.4 | 用户价值 |
| QUERY-005 | 84 | 98 | 96 | N/A | 90 | 100 | 90 | 90 | 92.6 | 用户价值 |
| QUERY-006 | 86 | 96 | 96 | N/A | 90 | 100 | 86 | 94 | 92.6 | 性能 |
| QUERY-007 | 88 | 96 | 96 | N/A | 92 | 100 | 90 | 90 | 93.2 | 用户价值 |
| QUERY-008 | 86 | 94 | 94 | N/A | 90 | 100 | 90 | 92 | 92.2 | 用户价值 |
| QUERY-009 | 88 | 96 | 94 | N/A | 90 | 98 | 90 | 90 | 92.6 | 用户价值 |
| VIZ-001 | 84 | 98 | 96 | N/A | 90 | 100 | 88 | 90 | 92.4 | 用户价值 |
| VIZ-002 | 94 | 100 | 94 | 92 | 90 | 100 | 90 | 90 | 94.1 | 性能 |
| VIZ-003 | 86 | 92 | 96 | N/A | 90 | 100 | 88 | 88 | 91.4 | 用户价值 |
| VIZ-004 | 86 | 92 | 96 | N/A | 90 | 100 | 88 | 88 | 91.4 | 用户价值 |
| VIZ-005 | 88 | 98 | 96 | N/A | 90 | 100 | 88 | 88 | 93.0 | 用户价值 |
| VIZ-006 | 84 | 90 | 94 | N/A | 88 | 98 | 86 | 90 | 90.2 | 性能 |
| VIZ-007 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 90 | 92.4 | 用户价值 |
| VIZ-008 | 86 | 92 | 96 | N/A | 90 | 100 | 88 | 88 | 91.4 | 用户价值 |
| DASH-001 | 84 | 98 | 96 | N/A | 90 | 100 | 88 | 90 | 92.4 | 用户价值 |
| DASH-002 | 92 | 100 | 94 | 88 | 90 | 100 | 88 | 88 | 92.9 | 安全性 |
| DASH-003 | 88 | 98 | 94 | N/A | 90 | 100 | 88 | 88 | 92.5 | 用户价值 |
| DASH-004 | 90 | 100 | 96 | 86 | 90 | 100 | 88 | 90 | 93.0 | 性能 |
| DASH-005 | 88 | 98 | 94 | 90 | 90 | 100 | 88 | 90 | 92.4 | 性能 |
| DASH-006 | 88 | 96 | 96 | 88 | 90 | 100 | 90 | 90 | 92.4 | 用户价值 |
| RPT-001 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 88 | 92.4 | 用户价值 |
| RPT-002 | 90 | 96 | 94 | 88 | 90 | 100 | 90 | 88 | 92.2 | 安全性 |
| RPT-003 | 88 | 96 | 96 | 88 | 90 | 100 | 90 | 88 | 92.2 | 安全性 |
| RPT-004 | 88 | 96 | 96 | 88 | 90 | 100 | 90 | 90 | 92.4 | 用户价值 |
| RPT-005 | 90 | 96 | 96 | 88 | 90 | 100 | 90 | 90 | 92.7 | 性能 |
| RPT-006 | 88 | 96 | 94 | 88 | 90 | 100 | 90 | 90 | 92.1 | 可靠性 |
| RPT-007 | 90 | 96 | 96 | 88 | 90 | 100 | 90 | 92 | 92.8 | 性能 |
| VIEW-001 | 88 | 98 | 96 | N/A | 90 | 100 | 88 | 88 | 92.8 | 用户价值 |
| VIEW-002 | 88 | 96 | 94 | 90 | 90 | 100 | 88 | 90 | 92.4 | 性能 |
| VIEW-003 | 94 | 98 | 94 | 92 | 90 | 100 | 90 | 92 | 93.9 | 架构健康 |
| GOV-001 | 86 | 96 | 94 | N/A | 90 | 100 | 92 | 90 | 92.5 | 用户价值 |
| GOV-002 | 86 | 96 | 94 | N/A | 90 | 100 | 88 | 90 | 92.0 | 性能 |
| GOV-003 | 88 | 94 | 96 | 86 | 90 | 100 | 90 | 90 | 91.9 | 交互体验 |
| GOV-004 | 88 | 94 | 96 | 86 | 90 | 100 | 88 | 90 | 91.7 | 交互体验 |
| GOV-005 | 88 | 96 | 96 | 88 | 90 | 100 | 88 | 90 | 92.2 | 用户价值 |
| GOV-006 | 88 | 94 | 94 | 88 | 90 | 100 | 88 | 90 | 91.6 | 用户价值 |
| GOV-007 | 89 | 93 | 94 | N/A | 91 | 100 | 88 | 91 | 92.2 | 用户价值 |
| GOV-008 | 88 | 92 | 94 | N/A | 91 | 100 | 88 | 94 | 92.2 | 用户价值 |
| META-001 | 88 | 96 | 94 | 86 | 92 | 100 | 92 | 92 | 92.3 | 交互体验 |
| META-002 | 90 | 98 | 96 | 88 | 92 | 100 | 92 | 92 | 93.7 | 交互体验 |
| META-003 | 88 | 94 | 96 | 86 | 92 | 100 | 90 | 92 | 92.3 | 交互体验 |
| META-004 | 90 | 96 | 96 | 88 | 92 | 100 | 90 | 92 | 93.2 | 交互体验 |
| META-005 | 88 | 98 | 96 | N/A | 90 | 100 | 88 | 90 | 93.1 | 性能 |
| META-006 | 88 | 98 | 96 | N/A | 90 | 100 | 88 | 90 | 93.1 | 性能 |
| DESIGN-001 | 88 | 94 | 94 | 86 | 92 | 100 | 90 | 90 | 92.1 | 交互体验 |
| DESIGN-002 | 88 | 94 | 96 | 86 | 92 | 100 | 90 | 90 | 92.1 | 交互体验 |
| DESIGN-003 | 88 | 94 | 94 | 88 | 92 | 100 | 90 | 90 | 92.0 | 用户价值 |
| DESIGN-004 | 94 | 94 | 96 | 92 | 90 | 100 | 90 | 94 | 94.8 | 用户价值 |
| DESIGN-005 | 88 | 92 | 96 | 86 | 90 | 100 | 90 | 90 | 91.6 | 交互体验 |
| API-001 | 84 | 92 | 92 | N/A | 90 | 98 | 92 | 88 | 90.6 | 用户价值 |
| API-002 | 82 | 90 | 92 | N/A | 88 | 96 | 86 | 88 | 90.2 | 性能 |
| API-003 | 84 | 90 | 94 | N/A | 90 | 98 | 88 | 90 | 90.4 | 用户价值 |
| API-004 | 84 | 90 | 96 | N/A | 90 | 98 | 88 | 90 | 90.7 | 用户价值 |
| API-005 | 84 | 88 | 94 | N/A | 90 | 98 | 88 | 92 | 90.2 | 用户价值 |
| API-006 | 84 | 90 | 94 | N/A | 90 | 98 | 88 | 92 | 90.6 | 用户价值 |
| API-007 | 84 | 90 | 94 | N/A | 92 | 100 | 88 | 90 | 90.8 | 用户价值 |
| CAT-001 | 88 | 94 | 94 | N/A | 88 | 100 | 88 | 88 | 91.5 | 架构健康 |
| CAT-002 | 88 | 94 | 94 | N/A | 88 | 100 | 88 | 88 | 91.5 | 架构健康 |
| CAT-003 | 88 | 94 | 94 | N/A | 88 | 100 | 88 | 88 | 91.5 | 架构健康 |
| CAT-004 | 88 | 94 | 94 | N/A | 90 | 100 | 88 | 88 | 91.8 | 用户价值 |
| CAT-005 | 86 | 94 | 94 | N/A | 90 | 100 | 88 | 92 | 92.1 | 用户价值 |
| CAT-006 | 88 | 94 | 94 | N/A | 90 | 100 | 88 | 88 | 91.8 | 用户价值 |
| CAT-007 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 90 | 92.4 | 用户价值 |
| NFR-001 | 88 | 96 | 94 | N/A | 90 | 100 | 92 | 88 | 92.6 | 用户价值 |
| NFR-002 | 88 | 96 | 94 | N/A | 90 | 100 | 90 | 88 | 92.4 | 安全性 |
| NFR-003 | 87 | 94 | 94 | N/A | 90 | 100 | 90 | 90 | 92.1 | 用户价值 |
| NFR-004 | 88 | 94 | 94 | N/A | 92 | 100 | 90 | 90 | 92.4 | 用户价值 |
| NFR-005 | 87 | 94 | 94 | N/A | 91 | 100 | 88 | 90 | 91.9 | 用户价值 |
| NFR-006 | 88 | 96 | 94 | N/A | 90 | 100 | 88 | 90 | 92.4 | 用户价值 |
| NFR-007 | 89 | 96 | 94 | N/A | 91 | 100 | 88 | 92 | 92.9 | 用户价值 |
| NFR-008 | 90 | 98 | 96 | N/A | 92 | 100 | 90 | 92 | 94.1 | 性能 |
| DATA-004 | 80 | 96 | 95 | N/A | 88 | 100 | 86 | 94 | 91.1 | 用户价值 |
| DATA-001 | 82 | 96 | 94 | N/A | 88 | 100 | 88 | 92 | 91.3 | 用户价值 |
| DATA-002 | 84 | 94 | 96 | N/A | 86 | 100 | 90 | 86 | 91.0 | 用户价值 |
| ETL-001 | 84 | 96 | 94 | N/A | 88 | 100 | 88 | 90 | 91.4 | 用户价值 |
| DATA-003 | 84 | 96 | 92 | 95 | 87 | 100 | 88 | 90 | 91.5 | 用户价值 |
| DATA-005 | 92 | 100 | 94 | N/A | 90 | 100 | 88 | 88 | 93.5 | 性能 |

---

## 功能索引（明细见 `prd/` 分片）

> **G2 选题**：只读本文件（hub），**禁止加载分片**。
> **P1 / P3 / P5**：按入选 ID 只读对应分片单文件。

| 分片 | 功能 ID 域 | 明细路径 |
|------|------------|----------|
| F01-BOOT.md | BOOT-001 ~ BOOT-006 | `prd/F01-BOOT.md` |
| F02-AUTH.md | AUTH-001 ~ AUTH-008 | `prd/F02-AUTH.md` |

> **非计数实现纠错（2026-07-13）**：`AUTH-003` 仅指用户角色绑定，**不包含**账户资料自服务（`PATCH /api/v1/me`）与修改密码（`POST /api/v1/auth/change-password`）。上述能力无独立 SRS/PRD 功能 ID；实现与缺陷修复追溯见 [BUG-001](../bugs/BUG-001_account-password-security_2026-07-13.md)、[`plans/archive/2026-07-08-account-self-service.md`](./plans/archive/2026-07-08-account-self-service.md) 与 [`F02-AUTH.md`](./prd/F02-AUTH.md) 边界说明。`feature_count: 129` 不变。
| F03-DS.md | DS-001 ~ DS-008 | `prd/F03-DS.md` |
| F04-CONN.md | CONN-001 ~ CONN-028 | `prd/F04-CONN.md` |
| F05-QUERY.md | QUERY-001 ~ QUERY-009 | `prd/F05-QUERY.md` |
| F06-VIZ.md | VIZ-001 ~ VIZ-008 | `prd/F06-VIZ.md` |
| F07-DASH.md | DASH-001 ~ DASH-006 | `prd/F07-DASH.md` |
| F08-RPT.md | RPT-001 ~ RPT-007 | `prd/F08-RPT.md` |
| F09-VIEW.md | VIEW-001 ~ VIEW-003 | `prd/F09-VIEW.md` |
| F10-GOV.md | GOV-001 ~ GOV-008 | `prd/F10-GOV.md` |
| F11-META.md | META-001 ~ META-006 | `prd/F11-META.md` |
| F12-DESIGN.md | DESIGN-001 ~ DESIGN-005 | `prd/F12-DESIGN.md` |
| F13-API.md | API-001 ~ API-007 | `prd/F13-API.md` |
| F14-CAT.md | CAT-001 ~ CAT-007 | `prd/F14-CAT.md` |
| F15-NFR.md | NFR-001 ~ NFR-008 | `prd/F15-NFR.md` |
| F16-DATA.md | DATA-001 ~ DATA-005 · ETL-001 | `prd/F16-DATA.md` |
| F17-AIVIZ.md | AIVIZ-001 ~ AIVIZ-011 | `prd/F17-AIVIZ.md` |

---

## 执行范围（与 plan 对齐）

> 更新：2026-08-20 · 来源 [`plan.md`](./plan.md) v3.1.0 · hub **v1.2.120**

| 字段 | 值 |
|------|-----|
| 已冻结 | **M-FINAL**（129/129 PRD 合同项） |
| 当前执行 | **§M-RPT 必做收官**（F-A~F-C 已闭合）；F-D 可选 backlog |
| 排队 | F-D 交叉表/套打/另存为〔可选 · 人工点名〕 |
| PRD 合同 | **129** 已实现 · **0** 合同未实现 |
| companion（plan） | **0** 必做待办 + **4** 可选（F-B GROUP BY + F-D 三项） |
| 当前节 | **M-RPT gate 已满足** |
| G2 选题 | 每轮 3–5 项；F-C 必做全勾前不跳 F-D；禁止积木/Jimu/AJ-Report 运行时 |

**说明**：M-DEPTH 已于 2026-07-29 收官。2026-08-20 依据 [报表中心 holistic audit](../material/blueprints/2026-08-20-report-center-holistic-audit.md) 插入 **§M-RPT** companion 深化（不扩合同 ID 面）。细则见 [`plan.md`](./plan.md) §M-RPT。

**里程碑状态**：

| 里程碑 | 状态 |
|--------|------|
| M-DASH-UX F-A~D | **已收官** |
| M-PRODUCT F-A~F | **已收官** |
| M-DEPTH F-A~E | **已收官** |
| **M-RPT F-A** | **已收官**（2026-08-20） |
| **M-RPT F-B** | **已收官**（2026-08-20） |
| **M-RPT F-C** | **已收官**（2026-08-20） |
| **M-RPT gate** | **必做已满足**（F-D 可选 backlog） |

---

## 里程碑

- **归档**：[`plan.archive.md`](./plan.archive.md)（M1–M12 全量映射）
- **已冻结**：[`plan.md`](./plan.md) §M-FINAL（129/129 合同）
- **已收官**：[`plan.md`](./plan.md) §**M-DASH-UX** + §**M-PRODUCT** + §**M-DEPTH**
- **当前节**：[`plan.md`](./plan.md) §**M-RPT**（v3.1.0 · 2026-08-20）

---

## 修订记录（最近 10 条）

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.2.120 | 2026-08-20 | 人工 PRD 修订（M-RPT）：`F08-RPT` RPT-001~005 + `F11-META` META-003 补 **M-RPT F-A~D** companion `[ ]`（13 条必做 + 4 可选）；hub 执行范围/里程碑对齐 plan v3.1.0；依据 [report-center holistic audit](../material/blueprints/2026-08-20-report-center-holistic-audit.md) |
| 1.2.119 | 2026-07-20 | 文档卫生：`feature_count` 与正文 129 项对齐；数据大屏 companion 执行见 `plans/` 与 `evolution-state.md`（不扩合同 ID） |
| 1.2.118 | 2026-07-13 | 非计数文档纠错：明确 AUTH-003 不含账户自服务 profile/change-password；追溯 BUG-001 + Account Self-Service plan；`feature_count`/评分/F02 ID 范围不变 |
| 1.2.117 | 2026-07-10 | PRD 分片同步 §M-DEPTH：META-004/QUERY-009/DASH-002·004/AUTH-006·008/RPT-005/API-003 补深度 companion `[ ]`；BOOT-002/DASH-001 勾 F-0；API-006/DESIGN-001/BOOT-002 标 F-D 可选；`prd/README` 对齐 |
| 1.2.126 | 2026-08-30 | CONN-028 RoAPI 独立连接器（M1B companion）：`dialects/roapi.py` + Admin `RoapiConnectionFields` + compose optional profile + pytest/vitest smoke；F04 扩展至 CONN-028（130 项 = 129 合同 + 1 companion） |
| 1.2.116 | 2026-07-10 | 人工 plan 干预：插入 §M-DEPTH（Dataset 打穿 / 筛选器 / 消费落差）；执行范围对齐 plan v3.0.0；G2 解除饱和 |
| 1.2.115 | 2026-07-09 | F-F 全量 companion 收官：plan 20 项全勾；五轨 worktree merge；hub 执行范围→整体毕业 |
| 1.2.114 | 2026-07-09 | 毕业收官：M-DASH-UX 必做全勾 + M-PRODUCT F-D 书面 E2E；执行范围更新；剩余 F-F 18 + 可选 2 |
| 1.2.113 | 2026-07-09 | 人工 plan 对账：§M-DASH-UX 对齐代码（F-A 加 QUERY-005、接线优先；F-C 稳定性勾选；F-C/F-D 拆必做/可选；F-F gate）；执行范围对齐 plan v2.8.0 |
| 1.2.112 | 2026-07-09 | 人工 plan 干预：§M-DASH-UX 升为当前节（方案 A）；§M-PRODUCT 排队；执行范围/里程碑指针对齐 plan v2.7.0 |
| 1.2.112 | 2026-07-09 | DS-007 产品收缩：移除 `/admin/connectors` 只读页与侧栏「连接器类型」；`数据连接` 直达 `/admin/datasources`；旧路由重定向；保留 `GET /types` + 新建向导 taxonomy；同步 `F03-DS` DS-007、`layout.md` |
| 1.2.111 | 2026-07-08 | P5 重评 CONN-023/024、BOOT-002、VIZ-002、DESIGN-004（M-PRODUCT F-A/F-C companion IA）；pytest 2311/29 skipped + vitest 269/269 + check:design 220 files + build PASS；CONN-023 RestApiConnectionFields + CONN-024 FileSourceConnectionFields Tabs；BOOT-002/VIZ-002 iaTier/iaPriority 过滤 + DESIGN-004 治理分组 Badge；用户价值 88–92%→92–98%、完整度 96%→100%、交互 N/A→88–98%；总分 92.4–95.9→93.2–96.6（五 ID ≥90 STUCK 空；plan F-A CONN-023/024 + F-C 三行勾选） |
| 1.2.110 | 2026-07-08 | P5 DS-007 重评（M-PRODUCT F-B displayGroup taxonomy companion）；pytest test_datasources_display_group_fb 8/8 + vitest ConnectorsPage+datasource-form 19/19 + check:design 212 files；displayGroup/categoryLabel API + ConnectorsPage Tabs + DatasourceFormPage 三步向导；用户价值 92%→94%、交互体验 94%→96%、架构健康 94%→92%（DatasourceFormPage 530 行超 fe-ui 软约束）；总分 93.8→94.1（≥90 STUCK 空；plan F-B 三行勾选） |
| 1.2.109 | 2026-07-08 | 人工 PRD 同步（M-PRODUCT · plan v2.6.0）：hub 执行范围/里程碑节对齐 M-PRODUCT；`prd/README` 129 合同 + companion 语义；分片 F01/F03/F05/F07/F10/F11/F13 补记 2026-07-08 成品清扫 companion 验收（BOOT-002 壳层、QUERY-009 Dashboard Dataset、DS-007 语义建模 nav、DASH-002 分享、API-003/005 Admin FE、GOV-005 发布链）；锚点 `admin-nav`→`nav-manifest` |
| 1.2.108 | 2026-07-07 | P5 r250 重评 CONN-027、API-001、VIZ-003/004/008（M-FINAL F-G 收官 + hub companion）；r250 13/13 + fe vitest 37/37 + ruff 0 + check:design 201 files；CONN-027 RedshiftConnector PG 委托 + REDSHIFT_* 错误域 + probe_readonly_sql + 7 backend + 2 FE smoke；API-001 P95≤500ms + traceId + structured error；VIZ-003 fallback/isKnownChartType；VIZ-004 buildBarOption/buildPieOption；VIZ-008 empty data 防护 + AdvancedEchartsChart 空态覆盖；CONN-027: 85.4→90.1（未实现→已实现）；API-001: 90.0→90.6；VIZ-003/004/008: 90.1→91.4（五 ID ≥90 STUCK 空；plan F-G CONN-027 勾选；M-FINAL 全 PRD 已实现）|
| 1.2.107 | 2026-07-07 | P5 r249 重评 NFR-008、CONN-023~026（M-FINAL F-F 收官 + F-G 首批四型）；pytest 2284/32 skipped + test_mfinal_ff_fg_batch1_r249 30/30 + r242/r248 回归 58/58；NFR-008 compose 禁入 + Markdown 部署报告；CONN-023 REST API + CONN-024 Excel/CSV + CONN-025 Db2 + CONN-026 Impala 方言注册/连通/native 或 SQL 链；用户价值 86%→88–90%、完整度 84–90%→94–98%、测试覆盖 84–98%→96–100%；总分 85.4–91.3→91.0–94.1（五 ID ≥90 STUCK 空；plan F-F NFR-008 + F-G 四 ID 勾选；F-F 收官） |
| 1.2.106 | 2026-07-07 | P5 r248 重评 GOV-007~008、NFR-003/005/007（M-FINAL F-E 收官 + F-F 首批三 ID）；pytest 2252/34 skipped + test_mfinal_fe_gov_batch4_r248 28/28 + r247 36/36 regression；IF-01 工厂 + publish deferred 降级 + busRegisterStatus、ACL self-approve/workflow publish、dashboard smoke、plugin drill 连通/只读、xinchuang Markdown；用户价值 86–88%→87–89%、完整度 90–94%→92–96%、架构健康 90%→91%、性能 88%→90%（NFR-003）；总分 91.2–91.6→91.9–92.9（五 ID ≥90 STUCK 空；plan F-E 二 ID + F-F 三 ID 勾选） |
| 1.2.105 | 2026-07-07 | P5 r247 重评 GOV-007~008、NFR-003/005/007（M-FINAL F-E/F-F 批次 3）；pytest 2224/34 skipped + test_mfinal_fe_gov_batch3_r247 36/36 + r246 32/32 regression；bus pipeline+retry/audit、ACL matrix+role guards、dashboard availability、plugin drill、xinchuang deployment-report；用户价值 82–84%→86–88%、完整度 88–90%→90–94%、测试覆盖 98%→100%；总分 90.0–90.4→91.2–91.6（五 ID ≥90 STUCK 空；plan 留部分实现未勾选） |
| 1.2.104 | 2026-07-07 | P5 r246 重评 DESIGN-004~005、GOV-004~006（M-FINAL F-E 批次 2）；pytest 2190/32 skipped + test_mfinal_fe_design_r246 32/32 + r245 34/34 regression；fe check:design 201 files + vitest 227/227 + designer/gov batch2 smoke；快照 ACL/双向 link/SQL 模式/审批态设计/from-workflow 发布/OpenAPI 3.1；用户价值 84–88%→88–90%、完整度 90–94%→92–96%、交互 N/A→86–88%、测试覆盖 98%→100%；总分 90.1–91.2→91.6–92.8（五 ID ≥90 STUCK 空；plan M-FINAL F-E 五 ID 勾选） |
| 1.2.103 | 2026-07-07 | P5 r245 重评 DESIGN-001~003、GOV-003、DESIGN-004（M-FINAL F-E 批次 1）；pytest 2158/32 skipped + test_mfinal_fe_design_r245 34/34；fe check:design 197 files + vitest 220/220 + designer.smoke 6/6；设计器三面板+预览+快照提交+工单模板 CRUD；用户价值 82–84%→88%、完整度 90–92%→90–94%、交互 N/A→86–88%、测试覆盖 98%→100%；总分 90.1–90.4→91.2–92.1（五 ID ≥90 STUCK 空；plan M-FINAL F-E 四 ID 勾选；DESIGN-004 留批次 2） |
| 1.2.102 | 2026-07-07 | P5 r244 重评 META-001~004（M-FINAL F-D 语义层收官）；pytest 2124/31 skipped + test_mfinal_fd_meta_r244 28/28；fe check:design 193 files + vitest 214/214 + metadata-panels + DatasetListPage CRUD；写 ACL + theme FK migration 0019 + Dataset PUT/DELETE/bind + QUERY 四步集成测；用户价值 82–84%→88–90%、完整度 90–94%→94–98%、交互 N/A→86–88%、测试覆盖 98%→100%、安全性 88%→92%；总分 90.0–91.1→92.3–93.7（四 ID ≥90 STUCK 空；plan M-FINAL F-D 四 ID 勾选；F-D 收官） |
| 1.2.101 | 2026-07-07 | P5 r243 重评 CONN-022 + QUERY-007~009（M-FINAL F-C2 GaussDB 收官 + F-D 查询链 kickoff）；pytest 2096/31 skipped + test_mfinal_fc_r242 022 + test_mfinal_fd_r243 14/14；fe check:design 188 files + vitest 214/214 + datasource-form.smoke T-CONN-R243-FE-01~02；GaussDB probe_readonly_sql + dataset_query ACL + translate-from-config + dataset/execute 链；用户价值 84%→86–88%、完整度 88–90%→94–96%、测试覆盖 98%→100%、安全性 88–90%→90–92%；总分 90.0–91.7→92.2–93.2（四 ID ≥90 STUCK 空；plan M-FINAL F-C CONN-022 + F-D QUERY-007~009 勾选；F-C 收官） |
| 1.2.100 | 2026-07-07 | P5 r242 重评 CONN-017~021（M-FINAL F-C 批次 1 信创 companion 收官）；pytest 2077/31 skipped + test_mfinal_fc_r242 25/25；fe check:design 188 files + vitest 212/212 + datasource-form.smoke T-CONN-R242-FE-01~04；五型 probe_readonly_sql + CONNECTOR_FIELD_HINTS + readonly-guard；用户价值 84%→88%、完整度 90%→96%、测试覆盖 98%→100%、性能 88%→90%；总分 90.0–90.4→92.4–92.6（五 ID ≥90 STUCK 空；plan M-FINAL F-C 五 ID 勾选） |
| 1.2.99 | 2026-07-07 | P5 r241 重评 AUTH-004 + BOOT-002（M-FINAL F-B RBAC grants + capability-nav 收官）；fe check:design 187 files + vitest 208/208 + build PASS；GrantsPage 列表/表单 + capabilities.ts + manifest capability + T-NAV-CAP-01~04 + T-FE-SMFB-01~03 + T-RT-GRANTS-01；AUTH-004 用户价值 84%→92%、交互 N/A→90%、总分 92.1→94.1；BOOT-002 架构健康 96%→98%、安全性 92%→94%、总分 95.3→95.9（两 ID ≥90 STUCK 空；plan M-FINAL F-B 二 ID 勾选；F-B 收官） |
