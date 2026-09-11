# VitalSpan 报表中心 · 生产就绪 / 产品体验评审 · 2026-08-24

## 总览

| 项 | 内容 |
|----|------|
| 范围 | **模块专项**：`backend/app/reports/` + `fe/src/pages/admin/reports/`（上追 `app/api/v1/reports/`） |
| mode | auto-fix |
| fix_mode | confirm-batch |
| cr_fix_scope | （待用户确认） |
| Stack Card | FastAPI · SQLAlchemy · React 19/Vite · shadcn；报表三产品线（文档模板 / 标准分析 / 调度） |
| 扫描方式 | 主 agent 串行 lane（L1–L5、L7–L11）；`scan_tools: rg-only`（仓内有 `sgconfig.yml`，本机 `ast-grep` 不在 PATH） |
| 证据层 / 外部依赖 | **无** `.evidence/`（记 Blind spot）；SMTP/IM/Playwright 有超时，缺仓外 smoke 工件 |
| ha_mode | **single**（M1 单机；§18 跳过） |
| Blind spots | 无 `.evidence/`；L1 结构性扫描未跑 ast-grep；L6 CI/IaC 未深扫 |
| Lane 密度 | 各 lane 已穷尽关键词或 ≥5 候选（见文末 EXHAUSTED 摘要） |
| P0 / P1 / P2 | **1 / 8 / 5** |
| 建议 | **修完 P0 + 关键 P1 后再宣称交叉表/Web 预览就绪**；标准分析主路径与调度投递已较诚实 |
| 回传 status | **FIXED**（P0 + P1 + P2 已落地；报表域 vitest 102/102、pytest 子集绿） |
| 已排除非问题 | Word 模板已停用且前后端一致拦截；无扩展配置时的 placeholder 有「示例态」横幅；默认超管 seed；测试双 |

一句话结论：报表中心主链路（标准分析、模板扩展指标、调度 semi-real 执行）整体可用且多数空态诚实；**交叉表 MVP 与 Web 预览/静默失败**、**模板编辑裸 SQL/手填引用**、**导出校验吞错** 是当前最该优先修的产品与可靠性问题。

### Stack Card（摘要）

- **形态**：FastAPI `backend/app/reports/` + React `fe/src/pages/admin/reports/`
- **持久化**：`RPT_METADATA_STORE=db`（生产禁 memory）；调度/执行走 DB + `ScheduleTickLock`
- **外部依赖**：SMTP（`delivery_adapter` timeout=5）、IM webhook（httpx 5s）、看板导出 Playwright
- **跳过 lane**：L6（未深扫 CI 门禁接线）；L11 §18（`ha_mode: single`）
- **宣称材料**：`docs/services/reports.md` 标三产品线「均已可用」；PRD `F08-RPT` F-D 交叉表/套打仍为可选未勾选

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| Phase 2.5 | 无证据层 | `.evidence/` | 仓库无证据目录，无法 gate-check 验真 |
| L1 | rg-only | 全模块 | `ast-grep` 不在 PATH；结构性 stub 有误报/漏报风险 |
| L6 | 合理跳过 | CI/Helm | 未逐条核对报表域 CI 门禁 |
| L8 | 部分 | Playwright/SMTP 真机 | 有超时实现，无 `.evidence` smoke 工件 |

## P0 Findings

### P0-1 · 交叉表透视失败时静默回退为长表

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 可靠性 |
| 证据 | `backend/app/reports/engine/crosstab_apply.py:36-47` — `pivot_table` 抛 `ValueError` 时 `except` 直接 `out.append(section)`，不报错、不 meta 标记 |
| 为何致命 | 用户配置交叉表并运行后，界面/导出可能展示**未透视的原始长表**，与「交叉表」语义不符，属静默做错事 |
| 建议修法 | 失败时返回明确错误（422/section.error）或在 `renderSpec.meta` 标 `crosstabFailed`；禁止无声回退 |
| xref | [P1-1] |
| 可批量 | 是（批次 A） |

## P1 Findings

### P1-1 · Web 运行页不支持交叉表预览

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `fe/src/pages/admin/reports/ReportViewPage.tsx:174-186` — 仅渲染 `section.columns && section.rows`；`crosstab` kind 含 `matrix/colLabels/rowLabels`（见 `pdf_renderer.py:22-28`）会落入「暂不支持在此预览」 |
| 为何应修 | 模板块已提供「交叉表」入口且后端可 pivot；Web 运行主路径半成品 |
| 建议修法 | 增加 `CrosstabResultTable` 或复用矩阵渲染；与 PDF 列对齐 |
| xref | [P0-1] |
| 可批量 | 是（批次 B） |

### P1-2 · 模板块编辑：主路径裸 SQL 文本框

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 |
| 证据 | `fe/src/pages/admin/reports/components/TemplateBlockEditor.tsx:209-218` — `blockType===sql` 时大段 `Textarea` 手填 SQL |
| 为何应修 | 违反「表单禁裸协议」；易错、无字段级校验与数据源绑定提示 |
| 建议修法 | 改为指标/数据集选择器 + 可视化过滤，或至少 SQL 编辑器绑定数据源与语法校验 |
| 可批量 | 是（批次 C，范围较大） |

### P1-3 · 表/交叉表引用手填字符串，无与扩展指标联动

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 / 产品表面 |
| 证据 | `TemplateBlockEditor.tsx:221-228`、`CrosstabBlockFields.tsx:22-27` — `tableRef` 自由输入；后端 `crosstab_apply.py:33-34` 要求 `section.metricKey` 与 `tableRef` 一致 |
| 为何应修 | 用户易填 `fact_table` 默认值而与扩展指标 `key` 不一致，导致交叉表不生效或触发 P0-1 静默回退 |
| 建议修法 | `tableRef` 下拉选择已配置 metric key；表单项改人话「关联指标」 |
| xref | [P0-1, P1-1] |
| 可批量 | 是（批次 B） |

### P1-4 · 用户可见文案暴露内部字段名 tableRef

| 字段 | 内容 |
|------|------|
| 类别 | 文案 |
| 证据 | `CrosstabBlockFields.tsx:22` — `指标引用（tableRef）` |
| 建议修法 | 改为「关联指标」；帮助文案说明须与扩展配置中指标键一致 |
| 可批量 | 是（批次 B） |

### P1-5 · 导出前 blob 校验失败时吞错当作通过

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `fe/src/pages/admin/reports/components/ReportExportCard.tsx:97-109` — `verifyExportBlob` 的 `catch { return true }` |
| 为何应修 | 网络/鉴权失败时跳过魔数校验，可能误导用户以为导出成功 |
| 建议修法 | `catch` 返回 `false` 或 rethrow，并 toast 明确错误 |
| 可批量 | 是（批次 D） |

### P1-6 · 批量导入主路径裸 JSON 粘贴

| 字段 | 内容 |
|------|------|
| 类别 | 坏表单 |
| 证据 | `fe/src/pages/admin/reports/components/BatchImportPanel.tsx` — 主流程 `JSON.parse` 粘贴/上传（有 dry-run，但仍裸协议） |
| 为何应修 | 管理面主路径手填 JSON；M1 可接受为迁移工具，但应有模板下载/结构化表单或向导 |
| 建议修法 | 强化「下载样例 + 字段校验」或分步表单；保留 JSON 为高级折叠项 |
| 可批量 | 否（需产品裁定） |

### P1-7 · 调度执行状态仍用 semi_real_* 工程语义

| 字段 | 内容 |
|------|------|
| 类别 | 文案 / 产品表面 |
| 证据 | `backend/app/reports/scheduler/executor.py` 产出 `semi_real_succeeded` 等；`useReportSchedules.ts:213-215` 已映射中文但 API/日志仍为工程名 |
| 建议修法 | 对外稳定状态枚举（succeeded/failed/degraded）；semi_real 仅作内部实现细节 |
| 可批量 | 是（批次 E，需前后端契约同步） |

### P1-8 · 标准分析查数上限 5000 行内存聚合（热路径放大）

| 字段 | 内容 |
|------|------|
| 类别 | 性能热点 |
| 证据 | `volume_policy.py:11-12`、`theme_aggregate.py:38` — Dataset 拉取后 pandas 内存聚合；meta 有截断说明（M0 已修诚实横幅） |
| 为何应修 | 大表场景下单请求内存与延迟放大；已有 cap 但无推下推聚合 |
| 建议修法 | 中期推 SQL/GROUP BY；短期确保 UI 始终展示 `renderSpec.meta` 截断提示 |
| 可批量 | 否（架构项） |

## P2 Findings

- **P2-1** `docs/services/reports.md:23` 边界仍写「PDF/Excel/**Word** 真字节」，与 Word 停用不一致 → 文档漂移
- **P2-2** `docs/automate/prd/F08-RPT.md` F-D 交叉表仍 `[ ]`，代码/UI 已部分交付 → PRD 与实现不同步
- **P2-3** `TemplateBlockEditor` 新建块默认 `SELECT 1` / `fact_table` / `region` / `month` — 易误保存占位配置
- **P2-4** `artifact_store.py` 注释「optional S3 stub」但仅 memory/fs — 文档性残留，无运行路径
- **P2-5** 多副本部署时每进程 `BackgroundScheduler` 注册 cron（`jobs.py`）— M1 单机可接受；扩 HA 前须集中调度或 leader 选举

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| Word 模板 | 前后端明确停用并提示迁移 PDF/Excel |
| 无扩展时的 placeholder 表 | `ReportViewPage` 有「示例态展示」说明 |
| `semi_real_execute_schedule` 命名 | 实现为真实导出+SMTP/IM 投递，非 mock 返回成功 |
| 测试内 memory store | `rpt_metadata_store=memory` 仅测试；生产 config 拒绝 |
| Input `placeholder=` 文案 | HTML 占位符，非业务 stub |

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| A 交叉表正确性 | P0-1 | S | 失败显式化 + 单测 |
| B 交叉表体验 | P1-1, P1-3, P1-4 | M | Web 矩阵预览 + 指标下拉 |
| C 模板表单 | P1-2 | L | 需产品方案 |
| D 导出可靠性 | P1-5 | S | 单行修复 + 测 |
| E 调度状态 | P1-7 | M | API 枚举收敛 |
| F 文档 | P2-1, P2-2 | S | prd-sync |

## 集成研究建议

（无触发项 — SMTP/IM 已有适配器与超时，非契约不明 stub）

## Lane EXHAUSTED 摘要

| Lane | 关键词（次数） | 信心 |
|------|----------------|------|
| L1 | stub/NotImplemented/placeholder/mock（rg×3） | medium |
| L2 | password/secret/192.168（rg×2） | high |
| L3 | memory_stores/rpt_metadata_store/logger（rg+读配置×2） | high |
| L4 | queryRef/JSON/Textarea/tableRef（rg+读 FE×2） | high |
| L5 | tableRef/PRD/EmptyState（rg×2） | medium |
| L7 | crosstab/word/placeholder API×菜单（rg+读路由×2） | high |
| L8 | SMTP/httpx/playwright（rg×2） | medium |
| L9 | exception handler 读 `api/v1/reports`（rg×1） | high |
| L10 | raw SQL block + dataset binding（读 execute.py） | medium |
| L11 | LIMIT 5000/FindAll/APScheduler（rg×2） | high |
