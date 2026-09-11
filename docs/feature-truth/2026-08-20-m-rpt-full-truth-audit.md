# Feature Truth Audit: M-RPT 报表中心必做能力（F-A～F-C）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-20 |
| 核验范围 | **§M-RPT 必做 gate**（F-A 4 + F-B 3 + F-C 3 = 10 项）；不含 F-D 可选 |
| 锚点 | `docs/automate/plan.md` §M-RPT · `prd/F08-RPT.md` · `fe/src/pages/admin/reports/**` · `backend/app/reports/**` |
| 总体判定 | **PARTIAL（闭环完成）** |
| **总分 / 档位** | **8/10 · B+**（必做主路径 CHAIN/UI 已通；真机 SMTP/BROWSER 仍缺 L1） |
| 状态 | closed-loop |
| **sampling** | `full`（10 项必做全枚举；未缩 scope） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T-A1 | 标准分析 `sourceType=standard`：创建调度 → execute → 非 `mock_succeeded`；SMTP 未配则 `failed` + 人话错误 | F08 RPT-005 F-A · plan F-A |
| T-A2 | `GET /schedules`、`GET .../executions` 空库可调、不 500 | F08 RPT-005 F-A |
| T-A3 | 模板页 smoke 选择器与实现一致，vitest 全绿 | F08 RPT-003 F-A |
| T-A4 | 标准分析配置保存后出现「创建定时投递」CTA，跳转预填 packKey | F08 RPT-002 F-A |
| T-B1 | 快照超过 retention N 期后旧期被 prune，compare 不含已删期 | F08 RPT-002 F-B |
| T-B2 | 新建分析包默认 Dataset 绑定；物理表路径 deprecated 提示 | F08 RPT-002 F-B |
| T-B3 | Hub/结果页展示口径·快照·留存·投递可观测条（实时/对比一致） | F08 RPT-002 F-B |
| T-C1 | 绑定维度字典的列在 run 结果展示 label；失败旁注 | F08 RPT-001 F-C · META-003 |
| T-C2 | 导出 PDF/Excel 列值与 Web 展现共用翻译链 | F08 RPT-001 F-C |
| T-C3 | 模板首进：空态 seed-demo → 运行/导出 CTA；60s 内可完成首次导出（有数据源环境） | F08 RPT-003 F-C |

- **非目标**：F-D 交叉表/套打/另存为；库内 GROUP BY（F-B 可选）；组合调度粒度枚举；全量 F08 RPT-001～007 历史 companion 重验

## 2. 完整链路图（M-RPT 主路径）

```
模板首进: ReportTemplatesPage → POST seed-demo → catalog → ReportViewPage → run/export
标准分析: Hub → run/compare → 配置页 → schedules CTA → semi_real execute → SMTP/IM
治理: snapshot capture → retention prune → observability strip
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | 标准分析投递 | **通（SMTP 未配诚实失败）** | `test_report_schedule_trust_chain.py` 6/6（含 real delivery_adapter） |
| 2 | 调度探针 | **通** | 同上 list/executions |
| 3 | 快照 retention | **通** | `backend/tests/test_standard_snapshot_retention.py` 2/2 |
| 4 | 码值翻译 | **通** | `backend/tests/test_report_label_translation.py` 3/3；FieldMapping 绑定 |
| 5 | seed-demo | **通** | `tests/test_report_dev_seed.py` 5/5；含 seed→run→export <60s |
| 6 | 模板查看页 | **通** | `ReportViewPage.smoke` 3/3；import 已修 |
| 7 | 真实 SMTP 投递 | **未 L1** | unconfigured 走真实 adapter；成功路径仍无 MailHog |
| 8 | 浏览器 60s 首导出 | **未验** | API 链 <60s 有 pytest；无 browser-reviewer 截图 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T-A1 | 标准分析投递 e2e | PARTIAL | 7/B | CHAIN 绿；真实 adapter 验 unconfigured；成功 SMTP 无 MailHog |
| T-A2 | 调度 list/executions 探针 | REAL | 8/B | pytest 探针 200 结构 |
| T-A3 | 模板 smoke | REAL | 9/A | reports vitest **88/88** 全绿 |
| T-A4 | 配置页投递 CTA | REAL | 8/B | `standard-analysis-config-cta.smoke` 绿 |
| T-B1 | 快照 retention | REAL | 9/A | retention pytest 2/2 |
| T-B2 | Dataset 主叙事 | REAL | 8/B | ConfigForm smoke + UI 文案 |
| T-B3 | 可观测条 | REAL | 8/B | `standard-analysis-observability.smoke` 绿 |
| T-C1 | 展示层码值翻译 | REAL | 8/B | `standard_analysis_bindings` 读 FieldMapping + 单测 |
| T-C2 | 导出翻译 | REAL | 8/B | 共用 `label_translation`；空模板 export 422 诚实 |
| T-C3 | 模板首进 seed | PARTIAL | 7/B | API 链 seed→run→export <60s；无 BROWSER 工件 |

## 3d. 覆盖矩阵（必做 10 项）

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| T-A1 | 投递 e2e | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_report_schedule_trust_chain.py` |
| T-A2 | 调度探针 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 同上 list/executions |
| T-A3 | 模板 smoke | ❌ | ✅ | ✅ | UI | 2 | 2 | REAL | vitest reports 88/88 |
| T-A4 | 配置 CTA | ❌ | ✅ | ✅ | UI | 2 | 2 | REAL | config-cta smoke |
| T-B1 | retention | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `test_standard_snapshot_retention.py` |
| T-B2 | Dataset 叙事 | ❌ | ✅ | ✅ | UI | 2 | 2 | REAL | ConfigForm + MetaRow |
| T-B3 | 可观测条 | ❌ | ✅ | ✅ | UI | 2 | 2 | REAL | observability smoke |
| T-C1 | 码值翻译 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `test_report_label_translation.py` |
| T-C2 | 导出翻译 | ❌ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 同上 + export 422 诚实 |
| T-C3 | 首进 seed | ❌ | ✅ | ⚠️ | CHAIN | 2 | 2 | PARTIAL | `test_seed_run_export_chain_under_budget` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **10** |
| GATE only | **0** |
| CHAIN | **7** |
| UI / BROWSER | **4**（T-A3/A4/B2/B3 UI smoke；无真机 BROWSER） |
| NONE（未验） | **0**（10 项均有 pytest/vitest 触达） |
| REAL 达标 | **8 / 10** |
| **逐一校验** | **是** — 10 项逐条对照 PRD + 测试输出 |
| 总体可否 REAL | **否** — T-A1/T-C3 仍 PARTIAL（真机 SMTP/BROWSER 举证） |

## 3c. 五维评分汇总（范围级）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| M-RPT 必做 gate | 2 | 2 | 2 | 2 | 2 | **10→8** | B+ | **PARTIAL（闭环）** |

扣分：真实 SMTP 成功路径、浏览器 60s 首导出无 L1 工件。

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `pytest` M-RPT 后端集 | 全绿 | **21 passed** | ✅ | 2026-08-20 14:22 跑数 |
| 2 | `vitest run fe/src/pages/admin/reports` | 全绿 | **88 passed** | ✅ | 2026-08-20 14:22 |
| 3 | `test_report_schedule_trust_chain` | 非 mock_succeeded | status ∈ failed/degraded + real adapter | ✅ | 6/6 |
| 4 | 生产 seed-demo | 403 | 代码已门禁 | ✅ | `test_report_cr_truth_fixes.py` |
| 5 | 空模板 export | 422 | `RPT_ENGINE_EMPTY_TEMPLATE` | ✅ | 单测 |
| 6 | seed→run→export 链 | <60s 200 | pytest 绿 | ✅ | `test_seed_run_export_chain_under_budget` |
| 7 | FieldMapping 翻译 | 读 mapping | `test_standard_analysis_bindings_use_field_mapping` 绿 | ✅ | `label_translation.py` |

## 5. 修复文档（闭环记录）

### T-A3 / B-ViewPage — 模板查看页运行时错误 ✅

**状态**：已修复  
**改动**：`ReportViewPage.tsx` 补 `localizeTemplateReadiness` import  
**验收**：`ReportViewPage.smoke.test.tsx` 3/3；reports vitest 88/88

### T-C1 — 标准分析码值翻译范围 ✅

**状态**：已修复  
**改动**：`label_translation.standard_analysis_bindings` 读 pack `FieldMapping`（lifecycle→status、distribution→region）  
**验收**：`test_standard_analysis_bindings_use_field_mapping`

### T-C3 — 首进 60 秒导出 ⚠️

**状态**：API 链已闭环；BROWSER 举证待补  
**改动**：`test_seed_run_export_chain_under_budget`（seed→run→export <60s）  
**待办**：deploy-dev browser-reviewer 走查（不阻塞 dev CHAIN）

### T-A1 — 真实 SMTP 投递 ⚠️

**状态**：unconfigured 走真实 adapter；成功路径待 MailHog  
**改动**：`test_standard_schedule_smtp_unconfigured_real_delivery_adapter`  
**待办**：集成 smoke 打 MailHog（不阻塞 dev CHAIN）

## 6. 修复优先级汇总

| 优先级 | ID | 状态 |
|--------|-----|------|
| P0 | T-A3 | ✅ 已修 |
| P1 | T-C1 | ✅ 已修 |
| P1 | T-C3 | ⚠️ API 链已通；BROWSER 可选 |
| P1 | T-A1 | ⚠️ adapter 已验；MailHog 可选 |

## 7. 交接

- **闭环完成**：P0/P1 代码与测试均已落地；pytest 21 + vitest 88 全绿
- **可选后续**：deploy-dev + MailHog 补 T-A1/T-C3 真机 L1 举证
- 用户批准修复：**是**（2026-08-20 全程）

## 8. 对用户问题「功能全部打通了吗？」— 直接回答

| 口径 | 结论 |
|------|------|
| **M-RPT 必做 10 项（F-A～C）** | **开发/测试链路已闭环** — 8/10 REAL、2/10 PARTIAL（仅真机 SMTP 成功 + 浏览器 60s） |
| **PRD 勾选 vs 真通** | plan/PRD F-A/B/C 可勾选；truth 上缺 MailHog/BROWSER 工件 |
| **F08 全模块 RPT-001～007** | 基线早已实现；**未**在本审计逐条重验全部 7 域 |
| **F-D 可选** | **未做**（交叉表、套打、另存为）— 不阻塞 gate |
| **生产端到端** | 需 MySQL sample + SMTP/IM 台账；无则 seed partial、投递 failed（诚实，非假绿） |

**一句话**：M-RPT 必做能力在 **代码 + pytest/vitest 链路上已全部闭环**；若「全部打通」指 **REAL 满分 + 真机举证**，仍差 MailHog 成功投递与浏览器 60s 截图两项可选验收。
