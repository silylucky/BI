# VitalSpan Rules 体检报告（create-project-rules）

| 项 | 内容 |
|----|------|
| 日期 | 2026-08-31 |
| 模式 | 已有 rules 体检（非新建） |
| 栈判定 | FastAPI · React 19 · `fe/` · Alembic · 国密 SM2/SM3/SM4 · 单租户 BI |
| 质量档位 | **可毕业**（P0 齐全） |
| 修订状态 | **批次 A + B 已落盘** |

---

## Stack Card

| 项 | 判定 |
|----|------|
| 后端 | FastAPI + SQLAlchemy 2 + Alembic → `backend-fastapi.mdc` ✅ |
| 前端 | React 19 / Vite / shadcn → `fe-ui.mdc` ✅ |
| 必产 6 件套 | 见下表 |
| 扩展规则 | `vitalspan-project` · `common` · `docs-layer` · `geo-map` · `deeptalk`（合理，非 catalog 冲突） |
| `fe-help.mdc` | 未建（catalog 为可选 ±） |

---

## 必产清单

| 文件 | 状态 | 备注 |
|------|------|------|
| `project.mdc` | ✅ | 会话启动、栈、任务路由完整 |
| `production.mdc` | ✅ | R2–R7、R9–R10、R15–R17、R19–R26 均有落点 |
| `engineering.mdc` | ✅ | R11–R13、R16 代码侧；信封为 `code/message/detail` |
| `delivery.mdc` | ✅ | 薄指针；双 `.dev` 指针齐全 |
| `prd-sync.mdc` | ✅ | + `docs-layer.mdc` 补强 taxonomy |
| `AGENTS.md` | ✅ | 批次 A 已修图表路径与技能索引 |
| `backend-fastapi.mdc` | ✅ | 栈专项 |
| `vitalspan-project.mdc` | ✅ | 批次 B 已补数据源选型指针 |

---

## R1–R26 覆盖矩阵（摘要）

| 红线 | 落点 | 状态 |
|------|------|------|
| R1 会话必读 | project + AGENTS | ✅ |
| R2 日志 | production + backend-fastapi | ✅ |
| R3 HA | production（M1 单机诚实表述） | ✅ |
| R4 多库 | production + arch ADR-07 | ✅ |
| R5 认证 | production（LDAP/OIDC 分期） | ✅ |
| R6 热改 | production | ✅ |
| R7–R8 文案/UI | production + fe-ui | ✅ |
| R9 迁移/种子 | production + Alembic + `docs/data/` | ✅ |
| R10 质量 | production | ✅ |
| R11 体量 | engineering | ✅ |
| R12 信封 | engineering（`message/detail`） | ✅ |
| R13 分层 | engineering + common | ✅ |
| R14 文档深度 | prd-sync + docs-layer | ✅ |
| R15–R20 国密/密钥 | production | ✅ |
| R16–R17 弹性/观测 | production + engineering | ✅ |
| R18 交付 | delivery + AGENTS | ✅ |
| R19–R23 RBAC/测试/备份 | production | ✅ |
| R24 FE/a11y | fe-ui + production | ✅ |
| R25–R26 合规 | production | ✅ |

**P0 块（R15–R18）**：全部有硬落点，未软化。

---

## 修订执行记录

### 批次 A（2026-08-31）— `AGENTS.md`

1. 图表出数路径：改为数据集绑定 + `POST /api/v1/query/dataset/execute`；`/query/execute` 仅管理探针。
2. 技能索引：补 `code-reviewer` · `go-fast` · `release-package`。

### 批次 B（2026-08-31）

1. `vitalspan-project.mdc`：新增「数据源选型」节，指针 `docs/services/datasources.md`。
2. `docs/data/README.md`：DDL 真源补 `arch.md` §4 交叉引用。

---

## 信息性备注（无需改 rules）

| 项 | 说明 |
|----|------|
| R12 模板 `msg/data` vs 仓内 `message/detail` | 以 engineering.mdc + 实现为准 |
| `docs/data/README.md` frontmatter `alembic_head` | 可能与运行时 head 漂移；以 `alembic current` 为准，arch-inspect 时同步 |
| M1 未上 LDAP/OIDC | production 已写 PRD 分期，非规则缺口 |

---

## 结论

VitalSpan `.cursor/rules` + `AGENTS.md` 已达 **create-project-rules 可毕业** 标准：必产齐全、国密/弹性/观测在 production、delivery 保持薄指针、双 `.dev` 选源完整、栈与 FastAPI 一致。本轮体检与 A+B 修订已闭合。
