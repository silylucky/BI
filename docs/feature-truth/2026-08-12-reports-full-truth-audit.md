# Feature Truth Audit: 报表子系统全功能（RPT-001～007）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-12 |
| 核验范围 | F08-RPT 全部 PRD 项 + 标准分析定时投递扩展 + 报表中心 FE 主路径 |
| 锚点 | `docs/automate/prd/F08-RPT.md` · `fe/src/pages/admin/reports/*` · `/api/v1/reports/*` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6.8 / 10 · C** |
| 状态 | draft |
| **sampling** | `full`（按 RPT 功能块 + 主 FE 页枚举，非逐按钮） |

## 1. 核验标准与预期（来自 PRD / 对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 模板/扩展配置可 CRUD，引擎 run/export 返回真实字节或显式失败 | F08-RPT RPT-001/003/006 |
| T2 | 标准分析包可配置、运行、对比、快照；配置页可设定时投递 | F08-RPT RPT-002 + 扩展投递 |
| T3 | 目录树可增删改移，模板关联 templateKey | F08-RPT RPT-004 |
| T4 | 看板/模板调度可创建、执行、历史可查、SMTP 真投递（无 mock header） | F08-RPT RPT-005 |
| T5 | 批量导入 dry-run + 导入 + 异步导出轮询 | F08-RPT RPT-007 |
| T6 | 报表中心四入口（工作台/标准分析/我的报表/调度）可加载且 API 可用 | `nav-manifest.tsx` |

- 非目标：RPT-004「另存为/手工执行」、RPT-005「组合调度粒度枚举」（PRD 标 companion · 非阻塞）
- 非目标：逐按钮全量下钻（本审计按 **功能块** 枚举，见 §3d）

## 2. 完整链路图（摘要）

```
侧栏入口 → FE 页 useQuery → /api/v1/reports/* → 域 service/store → DB/导出/SMTP → 列表/历史/下载
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 报表中心 | 通 | vitest `report-center.smoke` 3/3 绿 | 工作台可渲染 |
| 2 | FE 调度页 | **断** | live `GET /schedules` → **500** | 列表 API 崩溃 |
| 3 | FE 标准分析投递 | **假** | `POST /schedules` sourceType=standard → **422** | schema 未接纳 |
| 4 | BE 模板/目录 | 通 | live templates 200 · m10 pytest 绿 | 3 个模板可列 |
| 5 | BE 标准分析核心 | 通 | live packs 200 · FE smoke 绿 | 不含投递 |
| 6 | SMTP 投递 | 未就绪 | delivery-health `unreachable` | MailHog 未启动（运维） |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | RPT-001/003/006 引擎+模板+扩展 | PARTIAL | 7/B | ff_rpt+m10 45 passed；FE 扩展 Tab 3 smoke 失败 |
| T2 | RPT-002 标准分析核心 | PARTIAL | 7/B | live packs OK；`test_standard_analysis.py` mock 路径失效 |
| T2b | 标准分析定时投递 | **BROKEN** | 2/F | schema 无 `standard`/`sourceKey`；executor 无分支；列表 500 |
| T3 | RPT-004 目录树 | REAL | 8/B | m10 + catalog API 200 |
| T4 | RPT-005 看板/模板调度 | PARTIAL | 6/C | 核心 pytest 绿；**列表 API 500**；SMTP 需 MailHog |
| T5 | RPT-007 批量导入 | PARTIAL | 7/B | BatchImport smoke 3/3；batch export poll 1 失败 |
| T6 | 报表中心 IA | PARTIAL | 7/B | 3 页 smoke 绿；调度页依赖坏掉的 list API |

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| RPT-001 | PRD 功能块 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | `test_ff_rpt_companion_e95d.py` · `ReportExportCard.smoke` |
| RPT-002-core | PRD 功能块 | ✅ | ⚠️ | ✅ | UI | 2 | 1 | PARTIAL | live packs 200；`test_standard_analysis.py` 2 fail（mock 路径） |
| RPT-002-delivery | 扩展 | ✅ | ❌ | ✅ | UI | 1 | 0 | **BROKEN** | `schemas.py:18` 无 standard；`POST /schedules` 422；list 500 |
| RPT-003 | PRD 功能块 | ✅ | ✅ | ⚠️ | CHAIN | 2 | 2 | PARTIAL | m10 绿；`report-templates.smoke` 3/8 fail |
| RPT-004 | PRD 功能块 | ✅ | ✅ | ✅ | UI | 2 | 2 | REAL | m10 catalog 测 · smoke 树加载 |
| RPT-005-dash | PRD 功能块 | ✅ | ✅ | ✅ | UI | 2 | 1 | PARTIAL | `SchedulePanel.smoke` 绿；list API 500 阻断调度页 |
| RPT-005-smtp | 投递链 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `test_g5_live` template 路径可通；当前 MailHog 未启 |
| RPT-006 | PRD 功能块 | ✅ | ✅ | ⚠️ | UI | 2 | 1 | PARTIAL | extension 保存 smoke 失败（label 变更） |
| RPT-007 | PRD 功能块 | ✅ | ✅ | ✅ | UI | 2 | 2 | PARTIAL | BatchImport 3/3；`test_rpt007_batch_export_job_poll` fail |
| FE-center | 页面 | — | — | ✅ | UI | 2 | 2 | REAL | `report-center.smoke` 3/3 |
| FE-standard | 页面 | — | — | ✅ | UI | 2 | 1 | PARTIAL | `standard-analysis.smoke` 绿；投递面板 API 不可用 |
| FE-schedules | 页面 | — | — | ⚠️ | UI | 1 | 0 | **BROKEN** | smoke 本地 mock 绿；live list 500 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 12 |
| GATE only | 0 |
| CHAIN | 4 |
| UI / BROWSER | 8 |
| NONE（未验） | 0 |
| REAL 达标 | 3 / 12 |
| **逐一校验** | **是** — 12 行均有动态或静态证据 |
| 总体可否 REAL | **否** — RPT-002-delivery BROKEN、FE-schedules BROKEN |

## 3b. 前端主路径控件（抽样 · P0）

| ID | 文案/位置 | 期望 | 实际 | L | C | 判定 |
|----|-----------|------|------|---|---|------|
| B1 | 调度页列表加载 | 显示已有调度 | live API 500，永久 loading/错态 | 1 | 0 | BROKEN |
| B2 | 标准分析配置页「投递设置」 | 可创建 standard 调度 | API 422 `sourceType` 不接受 standard | 1 | 0 | BROKEN |
| B3 | 模板页「扩展配置」保存 | 保存成功 toast | smoke 找不到 `查数模式` label | 2 | 0 | PARTIAL |
| B4 | 批量导入 dry-run | 冲突行高亮 | smoke 3/3 绿 | 2 | 2 | REAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| T2 | 2 | 1 | 2 | 2 | 2 | 9 | A | PARTIAL |
| T2b | 1 | 0 | 1 | 1 | 0 | 3 | D | BROKEN |
| T3 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL |
| T4 | 2 | 1 | 2 | 1 | 2 | 8 | B | PARTIAL |
| T5 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL |
| T6 | 2 | 1 | 2 | 1 | 2 | 8 | B | PARTIAL |
| **总体** | — | — | — | — | — | **6.8** | **C** | **PARTIAL** |

**打通但不对**（L≥2 且 C≤1）：T2、T4、T6、B3  
**假功能 / 断链**：T2b、B1、B2

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `GET /api/v1/reports/templates` | 200 + items | 200，3 模板 | ✅ | live probe |
| 2 | `GET /api/v1/reports/standard/packs` | 200 + ≥1 pack | 200，total=1 | ✅ | live probe |
| 3 | `GET /api/v1/reports/schedules` | 200 + 列表 | **500** ValidationError sourceId=None | ❌ | terminal 42 traceback |
| 4 | `POST /schedules` sourceType=standard | 201 | **422** literal_error standard | ❌ | pytest + live |
| 5 | pytest 核心 RPT 集 | 全绿 | 45 passed / 3 failed | ⚠️ | ff_rpt+m10+dash_schedule |
| 6 | vitest reports/ | 全绿 | 40 passed / 3 failed | ⚠️ | report-templates.smoke |
| 7 | `test_standard_schedule_smtp_live` | PASSED | **FAILED** 422 on create | ❌ | 与评估文档 R3 声明矛盾 |

## 5. 修复文档（P0）

### T2b — 标准分析定时投递

**判定 / 得分**：BROKEN 3/10，C=0  
**期望 vs 实际**：配置页可创建 `sourceType=standard` + `sourceKey` 调度并执行 PDF 投递；实际 schema 拒绝 standard，executor 无 standard 分支，DB 已有 `source_key` 列但 API 层未贯通。  
**根因**：
- `backend/app/reports/scheduler/schemas.py:18` — `sourceType` Literal 缺 `standard`，无 `sourceKey` 字段
- `backend/app/reports/scheduler/service.py` — `_assert_source_exists` / `_out` 未处理 standard
- `backend/app/reports/scheduler/executor.py` — 无 `standard_export` 调用
- `standard_export.py` 存在但未接线

**修复方向**：补 schema/service/executor/API 全链；`ScheduleStatusOut.sourceId` 改 Optional；补 `delivery_adapter` `standard_render` 文案  
**修后验收**：`test_standard_schedule_delivery.py` 5/5 绿 + live list 200 + `test_standard_schedule_smtp_live` 绿  
**优先级**：**P0**

### T4 / B1 — 调度列表 API 500

**判定**：BROKEN（阻断调度页）  
**期望 vs 实际**：`GET /api/v1/reports/schedules` 返回列表；实际 Pydantic ValidationError：`sourceId` 为 None（standard 或脏数据行）。  
**根因**：`service.py:83` `sourceId=row.get("source_id") or row["catalog_node_id"]` 在两者皆 None 时崩溃；`ScheduleStatusOut.source_id` 非 Optional。  
**修复方向**：`sourceId: UUID | None`；`_out` 对 standard 填 `sourceKey`；列表过滤兼容  
**优先级**：**P0**

### T1 / B3 — 模板扩展配置 smoke 失败

**判定**：PARTIAL 5/10，C=0  
**期望 vs 实际**：扩展 Tab 可编辑「查数模式」并保存；实际 smoke 找不到 `getByLabelText("查数模式")`（UI 文案/结构漂移）。  
**根因**：`report-templates.smoke.test.tsx:285` 与 `TemplateDetailPanel` 当前 label 不一致  
**优先级**：P1（功能可能仍可用，测与 UI 漂移）

### T2 — 标准分析单测 mock 路径失效

**判定**：PARTIAL（测债，不阻断 live）  
**根因**：`test_standard_analysis.py` patch `app.reports.engine.execute.execute_query` 已不存在  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| **P0** | T2b | 标准分析定时投递 schema/service/executor 未贯通 |
| **P0** | T4/B1 | `GET /schedules` 500 阻断调度中心 |
| P1 | B3 | 模板扩展 smoke 与 UI label 漂移 |
| P2 | T2 | 标准分析 pytest mock 路径更新 |
| 运维 | T4-smtp | 开发环境需 `docker compose up -d mailhog` |

## 7. 结论与 PRD 对账

| 维度 | 结论 |
|------|------|
| PRD 勾选状态 | RPT-001～007 均标「已实现」 |
| **真实性结论** | **不能认定「全部完成」** — 2 条 P0 断链，多条 PARTIAL |
| 与 feature-assessment 矛盾 | `standard-analysis-scheduled-delivery` R3 宣称 DG6 已签收，**当前代码复验失败**（422/500） |
| 可交付范围 | 模板/目录/批量导入/标准分析**核心**可本地验收；**调度列表 + 标准分析投递不可** |

## 8. 交接

- 建议：批准 P0 修复后走 `root-first-solve` 补全 T2b + 调度 list
- 用户批准修复：**否**（仅审计报告）
- 文档路径：`docs/feature-truth/2026-08-12-reports-full-truth-audit.md`
