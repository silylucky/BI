# PRD 分片索引

> **16 域 · 130 项**（合同 **129** 已实现 + **CONN-028** M1B companion）· hub **v1.2.126**  
> 来源 SRS V3.7 + 附录 E/F + FR-DATA/FR-ETL（F16）+ M-FINAL 连接器扩展（CONN-023~027）+ M1B RoAPI（CONN-028）  
> Hub 索引：[`../prd.md`](../prd.md) · 执行范围：[`../plan.md`](../plan.md)（**§M-RPT 报表中心深度收官**）

> **非计数实现追溯（2026-07-13）**：F02 仍 **8 项**（AUTH-001～008）。账户资料与修改密码无独立 PRD ID；见 hub/F02 边界说明、[BUG-001](../../bugs/BUG-001_account-password-security_2026-07-13.md) 与 [`plans/archive/2026-07-08-account-self-service.md`](../plans/archive/2026-07-08-account-self-service.md)。

| 分片 | ID 域 | 模块 | 期次 | 项数 |
|------|-------|------|------|------|
| [F01-BOOT.md](./F01-BOOT.md) | BOOT-001 ~ BOOT-006 | P0 | P0 | 6 |
| [F02-AUTH.md](./F02-AUTH.md) | AUTH-001 ~ AUTH-008 | M7-RLS | 一期 | 8 |
| [F03-DS.md](./F03-DS.md) | DS-001 ~ DS-008 | 连接层 | 一期 | 8 |
| [F04-CONN.md](./F04-CONN.md) | CONN-001 ~ CONN-028 | 连接层 | 一～四期 + 收官 + M1B | 28 |
| [F05-QUERY.md](./F05-QUERY.md) | QUERY-001 ~ QUERY-009 | M3 | 一/三/四期 | 9 |
| [F06-VIZ.md](./F06-VIZ.md) | VIZ-001 ~ VIZ-008 | M4 | 一/三期 | 8 |
| [F07-DASH.md](./F07-DASH.md) | DASH-001 ~ DASH-006 | M5 | 一/二期 | 6 |
| [F08-RPT.md](./F08-RPT.md) | RPT-001 ~ RPT-007 | M6 | 二/三期 | 7 |
| [F09-VIEW.md](./F09-VIEW.md) | VIEW-001 ~ VIEW-003 | FR-VIEW | 一/二/三期 | 3 |
| [F10-GOV.md](./F10-GOV.md) | GOV-001 ~ GOV-008 | M8 | 一/四期 | 8 |
| [F11-META.md](./F11-META.md) | META-001 ~ META-006 | 语义层/实体 | 二/四期 | 6 |
| [F12-DESIGN.md](./F12-DESIGN.md) | DESIGN-001 ~ DESIGN-005 | M2 设计器 | **四期** | 5 |
| [F13-API.md](./F13-API.md) | API-001 ~ API-007 | IF | 一/三/四期 | 7 |
| [F14-CAT.md](./F14-CAT.md) | CAT-001 ~ CAT-007 | 附录 E | 一～三期 | 7 |
| [F15-NFR.md](./F15-NFR.md) | NFR-001 ~ NFR-008 | NFR | 一～四期 | 8 |
| [F16-DATA.md](./F16-DATA.md) | DATA-001 ~ DATA-005 · ETL-001 | M1B 接入 | P0+ | 6 |

**状态语义**：分片「**状态：已实现**」= PRD 合同交付；验收标准内 `[ ]` = **companion 远期/深度**（不计入 129 合同计数）。  
**当前 companion**：plan §**M-RPT**（F-A 信任链 / F-B 标准分析 / F-C 字典与模板；F-D 可选）。依据 [report-center holistic audit](../../material/blueprints/2026-08-20-report-center-holistic-audit.md)。  
**收官说明**：M-DEPTH 已收官（2026-07-29）；M-PRODUCT / M-DASH-UX 已收官。
