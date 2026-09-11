# VitalSpan 文档完整 · 可同步评审 · 2026-08-09

## 总览

| 项 | 内容 |
|----|------|
| 范围 | **整仓** |
| Docs Card | 见下；740+ `docs/` 文件；真理源分层完整 |
| 扫描方式 | 并行 lane D1–D8（subagent）+ 主 agent 汇总 |
| prd-sync | **needs_change**（路径映射与 docs-layer 不同步） |
| P0 / P1 / P2 | **0 / 14 / 12** |
| 建议 | **不可称「文档可毕业」**（API 不可消费、无 `docs/data/`、无 `docs/service/`）；修 P1 后可 **DONE_WITH_CONCERNS** |
| 回传 status | **DONE_WITH_CONCERNS** |

**一句话结论**：VitalSpan 文档体系**分层清晰**（SRS/PRD/services/api/arch/ui/mock 齐全），域附录与 mock 诚实性总体良好；**缺口**在 API 登记簿不可 Postman/网关直接消费、运维无 `docs/service/`、无 `docs/data/`、mock 索引未覆盖 code-reviewer 发现的 NFR/InMemory 总线假绿、以及 `layout.md`/`api/README` 多处漂移。

---

## Docs Card

| 探测 | 产出 |
|------|------|
| 文档根 | `docs/`（标准根）；无平行 `documentation/` |
| 项目化偏移 | `docs/services/` 代 `docs/domain/`；`docs/arch.md` 内嵌 ADR 代 `docs/adr/`；`docs/api/README.md` 单文件代 per-module |
| 现有类型 | api(1) · services(16) · ui(6) · mock(5) · arch.md · srs/ · automate/ · README.md |
| 缺失（taxonomy） | `docs/data/` · `docs/service/` · `docs/adr/` |
| 代码面 | FastAPI `backend/app/` 31 API 域；React `fe/`；Alembic head **0041** |
| 规则 | `prd-sync.mdc` ✅；`docs-layer.mdc` ⚠️ 缺 mock/anchor |
| 宣称材料 | `prd.md` 129/129；`README.md` |

### 标杆 UI / 设计锚

- `docs/ui/layout.md` — IA 真理源
- `docs/ui/anchor.md` — 存在，覆盖偏薄（3 块页面）

---

## 文档覆盖矩阵

| 域 | Lane | state | severity | consumable | 路径 |
|----|------|-------|----------|------------|------|
| api | D1 | **stale** | P1 | **fail** | `docs/api/README.md` |
| adr | D2 | non_compliant* | P2 | n/a | `docs/arch.md` §2 |
| domain | D3 | **ok** | P1 | n/a | `docs/services/*.md` |
| service | D4 | **missing** | P1 | n/a | 无；等价 `arch.md`+`README` |
| mock | D5 | **partial** | P1 | n/a | `docs/mock/` |
| ui | D6 | **drift** | P1 | n/a | `docs/ui/layout.md` |
| data | D7 | **missing** | P1 | n/a | 无 `docs/data/` |
| index+rule | D8 | **ok** | P2 | n/a | `docs/README.md` · prd-sync |

\* vs 通用 taxonomy 有意偏移；VitalSpan 内可接受，须在 prd-sync 声明。

---

## Blind spots

| Lane | 未覆盖 | 原因 |
|------|--------|------|
| D3 | Process Test Pack 深度 | `docs/services/` 为边界型附录，非可测流程文档（项目约定） |
| D7 | 表级 ERD 全文 | 无 `docs/data/`；仅 ADR 片段 |
| — | 用户手册质量 | `docs/user-guide/` 未做 user-guide-writer 深评 |

---

## P0 Findings

**无 P0**。mock 文档未把假能力写成正式交付；关键服务本地启动有 `README`+`arch`；API 有登记簿与 OpenAPI。

---

## P1 Findings

### P1-01 · API 可消费深度闸门整体 fail

| 字段 | 内容 |
|------|------|
| 类别 | api / 模板不合规 |
| 证据 | `docs/api/README.md` — 仅路由总表；缺 A1 环境表、A3 网关、A5 逐端点 JSON/curl、A7 冒烟清单 |
| 建议 | 拆 `docs/api/<域>.md` 或扩写 README；优先 auth → datasources → query |
| 可批量 | 是（批次 D3） |

### P1-02 · API 路由登记漂移（≥12 处）

| 字段 | 内容 |
|------|------|
| 证据 | 缺：`designer/workflow-link/validate`、`orgs/{id}` CRUD、`rls/dimensions/{id}`、`users/{id}/roles` GET、`viz-components/{id}/archive`、`reports/schedules/{id}/transition` 等 |
| 建议 | 批次 R1 补行 + bump `last_updated` |
| 可批量 | 是（批次 R1） |

### P1-03 · API 过期「规划」项误导

| 字段 | 内容 |
|------|------|
| 证据 | §9 `entities/types` 规划但已实现为 `metadata/entity-types`；`/governance/tickets*` 规划但能力在 `/gov/*` |
| 建议 | 删或标 deprecated + 替代路径 |
| 可批量 | 是（R1） |

### P1-04 · `docs/services/README.md` 索引状态漂移

| 字段 | 内容 |
|------|------|
| 证据 | datasources/query/reports/integration 索引状态落后于单文件 frontmatter |
| 建议 | 回写索引表 |
| 可批量 | 是（R0） |

### P1-05 · 无 `docs/service/` 运维专章

| 字段 | 内容 |
|------|------|
| 证据 | 无按部署单元文档；生产 runbook 仅链 deploy-dev skill |
| 建议 | 增 `docs/service/backend.md` 或扩 `arch.md` §10 |
| 可批量 | 是（批次 D4） |

### P1-06 · mock 索引不完整（与 code-reviewer P0 交叉）

| 字段 | 内容 |
|------|------|
| 证据 | 已登记：push mock、scheduler mock、dataset stub、lineage stub；**未登记**：NFR perf probe mock、InMemory 总线、`dispatch_push_mock` 与 scheduler 双轨 |
| 建议 | 扩 `docs/mock/nfr-push.md` 或增 `nfr-perf-probe.md`；扩 `governance.md` 写 InMemory bus |
| 可批量 | 是（批次 D5） |

### P1-07 · 无 `docs/data/` 集中 schema 文档

| 字段 | 内容 |
|------|------|
| 证据 | Alembic head **0041**（41 revisions）；`arch.md` 仅引用 0032/0034 |
| 建议 | `docs/data/README.md` revision→表→域映射；`arch.md` 登记 head |
| 可批量 | 是（批次 D7） |

### P1-08 · `layout.md` 与代码漂移

| 字段 | 内容 |
|------|------|
| 证据 | 分组名「数据」vs 代码「数据准备」；`ACTIVE_MILESTONES` 漏 M5；§273 与 §106 实体/主题表述矛盾 |
| 建议 | 对齐 `resolve-nav.ts`；修正矛盾节 |
| 可批量 | 是（批次 D6） |

### P1-09 · `layout.md` 二级路由未入 IA 树

| 字段 | 内容 |
|------|------|
| 证据 | `sync-jobs/{id/edit}`、`datasets/{new}`、`/export/*`、`/admin/system` 等 |
| 建议 | §3 补二级路由表 |
| 可批量 | 是（D6） |

### P1-10 · `docs/ui/anchor.md` 覆盖偏薄

| 字段 | 内容 |
|------|------|
| 证据 | 仅 3 块页面锚点；缺数据源、数据集、系统管理、Embed |
| 建议 | 按需扩展或链 `fe/src/components/README.md` |
| 可批量 | 是（P2 可降级） |

### P1-11 · readiness/liveness 未文档化

| 字段 | 内容 |
|------|------|
| 证据 | 仅 `GET /health`；code-reviewer L3 亦报 |
| 建议 | `arch.md` 补探针职责或标 M1 未拆分 |
| 可批量 | 是（D4） |

### P1-12 · API 无模块级错误码表

| 字段 | 内容 |
|------|------|
| 证据 | 仅全局 envelope；业务码散落说明列 |
| 建议 | 按域补错误码表（可先 auth/query） |
| 可批量 | 是（D3 子批） |

### P1-13 · `openapi/`、`sample_api/` 无域附录

| 字段 | 内容 |
|------|------|
| 证据 | `backend/app/openapi/`、`sample_api/` 无 `docs/services/` 登记 |
| 建议 | 在 `integration.md` 增锚点 |
| 可批量 | 是（P2 可合并） |

### P1-14 · prd-sync 相对通用 taxonomy 缺可消费深度条款

| 字段 | 内容 |
|------|------|
| 证据 | 无 api/domain 可消费闸门引用 |
| 建议 | R0 补一句或链 docs-reviewer consumable-depth |
| 可批量 | 是（R0） |

---

## P2 Findings（紧凑）

- `arch.md` §2 摘要表缺 ADR-19/20（详节已有）
- Dataset 双路径、OpenAPI version_policy、InMemory 总线无 ADR 编号
- `docs-layer.mdc` 缺 `mock/`、`ui/anchor.md`
- `docs/README.md` 主表未点明 ADR 在 arch §2
- `reports-dashboard-schedule-walkthrough.md` 未入 services 索引
- `artifact_store.py` 注释 S3 stub 与实现不符
- API README §9 重复编号、m11-probe 表格列对齐
- 域附录无 Process Test Pack（项目边界型约定，可跟踪）

---

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 无 `docs/adr/` | ADR 内嵌 `arch.md`，prd-sync 已指向 arch |
| 无 `docs/domain/` | 有意用 `docs/services/` |
| `docs/superpowers/` 等归档 | 演化产出，非交付文档缺口 |
| 测试 mock | 不要求进 `docs/mock/` |
| OpenAPI 为运行时真源 | README 链 `/openapi.json` 合理；但不能替代 A1–A7 |

---

## 与 code-reviewer 交叉

| code-reviewer | docs 状态 | 动作 |
|---------------|-----------|------|
| P0 NFR push mock | ✅ `mock/nfr-push.md` | 扩写双轨推送说明 |
| P0 InMemory bus | ⚠️ `governance.md` Out 有，mock 未索引 | **P1-06** |
| P0 dataset execute-plan | ✅ `mock/query-dataset.md` | — |
| P0 看板可用性 mock | ❌ mock 未登记 | **P1-06** |
| P1 `/sample-api` | ❌ 无 mock/域登记 | P2 补 integration 锚点 |

---

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| **R0** | prd-sync + docs-layer 路径对齐 | S | ADR 内嵌、data/service 替代、mock/anchor |
| **R1** | P1-02, P1-03 API 索引修补 | S | 只改 `docs/api/README.md` |
| **D5** | P1-06 mock 索引补全 | S | nfr-perf、InMemory bus |
| **D6** | P1-08, P1-09 layout 漂移 | S | `layout.md` |
| **D7** | P1-07 data 索引 | M | `docs/data/README.md` + arch head |
| **D4** | P1-05, P1-11 service/health | M | `docs/service/backend.md` 或 arch |
| **D3** | P1-01, P1-12 API 可消费 | L | per-domain api 文档 |

**confirm**：回复批次（如「R0+R1+D5+D6」）。确认前不改文档。

---

## 回传 YAML

```yaml
status: DONE_WITH_CONCERNS
phase: docs-reviewer
mode: review
fix_mode: confirm
scope: full_repo
report: docs/material/docs-reviewer/2026-08-09-full-repo-review.md
domains:
  - {domain: api, lane: D1, state: stale, severity: P1, findings: [P1-01..P1-03,P1-12], paths: [docs/api/README.md], consumable: fail}
  - {domain: adr, lane: D2, state: non_compliant, severity: P2, findings: [P2-adr], paths: [docs/arch.md], consumable: n/a, note: "内嵌 ADR 模式"}
  - {domain: domain, lane: D3, state: ok, severity: P1, findings: [P1-04,P1-13], paths: [docs/services/], consumable: n/a}
  - {domain: service, lane: D4, state: missing, severity: P1, findings: [P1-05,P1-11], paths: [], consumable: n/a}
  - {domain: mock, lane: D5, state: partial, severity: P1, findings: [P1-06], paths: [docs/mock/], consumable: n/a}
  - {domain: ui, lane: D6, state: drift, severity: P1, findings: [P1-08,P1-09,P1-10], paths: [docs/ui/layout.md, docs/ui/anchor.md], consumable: n/a}
  - {domain: data, lane: D7, state: missing, severity: P1, findings: [P1-07], paths: [], consumable: n/a}
  - {domain: index_rule, lane: D8, state: ok, severity: P2, findings: [P1-14], paths: [docs/README.md, .cursor/rules/prd-sync.mdc], consumable: n/a}
written: []
prd_sync: needs_change
remaining:
  - "API 可消费毕业（D3 大批）待产品/联调优先级"
  - "Process Test Pack 深度（项目 services 约定豁免）"
coverage:
  blind_spots:
    - "D3 | Process Test Pack | docs/services 边界型附录"
    - "D7 | 表级 ERD | 无 docs/data 全文"
  lanes_run: [D1,D2,D3,D4,D5,D6,D7,D8]
blockers: []
```

---

## 修复状态 · 2026-08-09（R0 + R1 + D5 + D6 已执行）

| 批次 | 状态 | 变更 |
|------|------|------|
| R0 | ✅ | `prd-sync.mdc` · `docs-layer.mdc` · `docs/README.md` |
| R1 | ✅ | `docs/api/README.md` v1.0.10 |
| D5 | ✅ | `docs/mock/*`（含新增 `nfr-perf-probe.md`） |
| D6 | ✅ | `docs/ui/layout.md` v1.3.5 |
