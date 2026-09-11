# VitalSpan M-RPT 报表中心「真实可用」评审 · 2026-08-20

## 总览

| 项 | 内容 |
|----|------|
| 范围 | **变更面** — M-RPT F-A～F-C：`backend/app/reports/**`、`fe/src/pages/admin/reports/**`、相关 tests/docs |
| mode | auto-fix |
| fix_mode | confirm-batch |
| cr_fix_scope | （待用户确认） |
| Stack Card | FastAPI + SQLAlchemy · React 19 Vite (`fe/`) · 多库元库 ADR-07 · 单机 compose 交付 |
| 扫描方式 | 并行 lane：L1+L7、L8+L9（subagent）+ 主 agent 验证；L4/L5/L11 主 agent 补扫；L6 跳过 |
| scan_tools | **rg-only**（无 ast-grep；L1 结构性假绿保留词法盲区） |
| 证据层 / 外部依赖 | **无** `.evidence/`（Blind spot）；SMTP / MySQL sample / Playwright PDF 为仓外依赖 |
| ha_mode | **single**（M1 单机；§18 跳过） |
| Blind spots | 无证据层 gate-check；L1 无 ast-grep；L7 无浏览器真机走查；L5 页级视觉未深扫 |
| Lane 密度 | L1+L7 ≥8；L8+L9 ≥8；L4/L11 主 agent ≥5 |
| P0 / P1 / P2 | **3 / 9 / 4** |
| 建议 | **M-RPT 必做能力主路径可用，但不宜宣称「生产全真实可用」** — 修完 P0 后再对外承诺 seed/导出/投递诚实语义 |
| 回传 status | **DONE_WITH_CONCERNS** |
| 已排除非问题 | 默认超管 seed；测试双 mock 外部依赖；F-D 交叉表/套打（PRD 标可选且无入口）；artifact_store 默认 filesystem（非 S3 stub 激活）；`placeholder` 字段在 execute 成功路径为 `False` 的诚实标记 |

**一句话结论**：F-A 信任链、F-B 可观测/留存、F-C 字典翻译与首进种子在**有 demo 数据源环境**下可验收（后端 13 测绿）；但 **seed-demo 无生产门禁**、**模板 run/export 对无数据仍返回 ready**、**调度 Excel 格式与 SMTP 未配置语义** 等问题说明「文档勾选完成 ≠ 端到端生产真实可用」。

### Stack Card（摘要）

- 形态：单仓 · 报表域 `backend/app/reports/` · 管理端 `fe/src/pages/admin/reports/`
- 后端：FastAPI `/api/v1/reports/*`；调度 semi_real 默认路径
- 前端：ReportTemplatesPage · StandardAnalysisPage · ReportSchedulesPage
- 宣称材料：`docs/automate/prd/F08-RPT.md` F-A/B/C `[x]`；`plan.md` M-RPT 必做 gate
- 仓外依赖：Sample MySQL（seed）、平台 SMTP（投递）、Playwright（看板 PDF 调度）
- 跳过 lane：L6（无 Helm 全量；CI 未深扫报表专用门禁）

---

## 测试实证（本批已跑）

| 套件 | 结果 |
|------|------|
| `tests/test_report_label_translation.py` | 绿 |
| `tests/test_report_schedule_trust_chain.py` | 绿（4） |
| `tests/test_standard_snapshot_retention.py` | 绿 |
| `tests/test_report_dev_seed.py` | 绿（4） |

**注意**：信任链 e2e **mock 了** `dispatch_artifact` 返回 `unconfigured`，允许 `semi_real_failed | semi_real_delivery_degraded`；真实 SMTP 未配置路径返回 `degraded`（见 P1-5），测试未覆盖真实 adapter。

---

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 证据层 | 未读 | `.evidence/` | 目录不存在；无法 gate-check 验真 |
| L1 | rg-only | 结构性 stub 形状 | 无 ast-grep；注释/字符串误报风险未消除 |
| L5 | 浅扫 | 报表页壳层/空态/双描边 | 未跑 ui-ux-reviewer 页级深扫 |
| L6 | 跳过 | CI 报表 prod 门禁 | 仅知 GitHub Actions 存在，未验 seed-demo/mock 头拦截 |
| L7 | 静态 | 浏览器真机 60s 首导出 | PRD F-C 宣称依赖人工走查 |

---

## P0 Findings

### P0-1 · `seed-demo` 无生产环境门禁

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 产品表面 |
| 证据 | `backend/app/api/v1/reports/center.py` L22–34 — 任意 `report:manage` 可调 `seed_dev_reports`；`fe/.../ReportTemplatesPage.tsx` L109–118 空态 CTA 无环境判断 |
| 为何致命 | 生产可写入演示数据源、模板、调度；与 dev seed 语义冲突，且 PRD F-C 写「首进体验」易被当成生产能力 |
| 建议修法 | `vitalspan_env != production` 或专用 `dev_report_seed` 开关 + 启动门禁；生产隐藏 CTA 并 403 |
| xref | [P1-6] |
| 可批量 | 是（批次 A） |

### P0-2 · 模板 `run` 无数据仍 `status: ready`

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 产品表面 |
| 证据 | `backend/app/reports/engine/service.py` L145–160 — `placeholder: True` section；L160 `return RenderRunOut(status="ready", ...)` |
| 为何致命 | UI/集成认为运行成功，PDF 仅 `(no data)`（`render/pdf_renderer.py` L65–66）；与 RPT-001「模板+数据→展现」宣称冲突 |
| 建议修法 | placeholder 路径返回 `degraded`/`empty` 或 422；或 section 级 `placeholder` 汇总到 run status |
| xref | [P0-3, P1-1] |
| 可批量 | 是（批次 A） |

### P0-3 · 模板导出复用 placeholder run 仍提供下载

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub |
| 证据 | `engine/service.py` L163–180 `export_template_bytes` → `run_template` → `render_document`；无指标/数据源时生成空 PDF |
| 为何致命 | 「导出成功」但产物无业务数据；F-C「60 秒首导出」在空配环境仍绿 |
| 建议修法 | 与 P0-2 同链：导出前校验可执行指标；否则 422 + FE 禁用导出 |
| xref | [P0-2, P1-1] |
| 可批量 | 是（批次 A） |

---

## P1 Findings

### P1-1 · `exportHook.placeholder` 恒为 `false`

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `engine/service.py` L50–56 `_build_export_hook` |
| 建议修法 | 与 renderSpec 占位态同步 |
| xref | [P0-2, P0-3] |
| 可批量 | 是 |

### P1-2 · 调度 mock 请求头生产可用

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub |
| 证据 | `api/v1/reports/__init__.py` L470–482 — `X-Rpt-Execute-Mock: 1` → `mock_succeeded`；`X-Rpt-Delivery-Mock` 无 env 限制 |
| 建议修法 | 仅 dev/test 或 admin probe 权限；生产忽略并审计 |
| 可批量 | 是（批次 E） |

### P1-3 · 标准分析调度静默跳过 Excel 附件

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 可靠性 |
| 证据 | `scheduler/schemas.py` L25–26 允许 `excel`；`scheduler/standard_export.py` L36–38 `if fmt != "pdf": continue` |
| 建议修法 | 实现 excel 导出或创建/执行时校验拒绝非 PDF |
| 可批量 | 是（批次 B） |

### P1-4 · 码值翻译绑定硬编码且演示数据不匹配

| 字段 | 内容 |
|------|------|
| 类别 | 真实缺口 / 产品表面 |
| 证据 | `label_translation.py` L17–20 忽略 `FieldMapping`；`dev_seed.py` L86–89 equipment.region 存「华东/华北」中文，维表 `region` lookup 按 code |
| 建议修法 | `standard_analysis_bindings` 读 pack mapping；seed 写 region code；失败写明确 `translationNote` |
| xref | PRD RPT-001 F-C「resolve 失败旁注」部分满足 |
| 可批量 | 是（批次 B） |

### P1-5 · SMTP 未配置映射为 `degraded` 而非 `failed`

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 / 隐式假通 |
| 证据 | `delivery_adapter.py` L66–74 step `failed`；L214 `overall = "degraded"`；`executor.py` L448–454 仅 `unconfigured` → `semi_real_failed` |
| 建议修法 | SMTP 未配置时 delivery `status: unconfigured` 或 executor 将 email step failed 升为 `semi_real_failed` |
| xref | 信任链测试 mock 与真实路径不一致 |
| 可批量 | 是（批次 E） |

### P1-6 · seed 部分失败仍返回「示例报表已就绪」

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 |
| 证据 | `dev_seed.py` L326–329 无 datasource 仍 `code: ok`；`ReportTemplatesPage` toast 无条件成功 |
| 建议修法 | 按 counts 返回 `partial`/`degraded`；FE 区分全量/部分种子 |
| xref | [P0-1] |
| 可批量 | 是（批次 B） |

### P1-7 · 调度/导出错误暴露 `str(exc)`

| 字段 | 内容 |
|------|------|
| 类别 | API 信封与错误面 |
| 证据 | `scheduler/executor.py` L268–269；`standard_export.py` L29–30；`channels/dispatch.py` L57 |
| 建议修法 | 映射 `RPT_*` 用户向 message；detail 仅运维可见 |
| 可批量 | 是（批次 E） |

### P1-8 · 维度字典 lookup 硬顶 500 无分页

| 字段 | 内容 |
|------|------|
| 类别 | 可靠性 |
| 证据 | `label_translation.py` L42；`metadata/dimensions/service.py` cap 500 |
| 建议修法 | 按本次 codes 批量查询或分页直至覆盖 |
| 可批量 | 是（批次 B） |

### P1-9 · Playwright 调度 PDF `browser.launch` 无超时

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 / 性能热点 |
| 证据 | `dashboard/export_render.py` L228 vs L97–99 健康探针有 timeout |
| 建议修法 | 与 `HEALTH_BROWSER_TIMEOUT_MS` 对齐 |
| 可批量 | 是（批次 G） |

---

## P2 Findings

- **P2-1** · `center/preferences` PUT 使用 `PERM_READ` 写收藏（`center.py` L44–47）— 权限语义漂移
- **P2-2** · F-B 可选「库内 GROUP BY」未做（`F08-RPT.md` 已标可选）— 大表样本聚合上限需 meta 诚实标注
- **P2-3** · F-D 交叉表/套打/另存为未做 — PRD 可选 backlog，无菜单宣称
- **P2-4** · `scheduler/executor.py` `_record_delivery_attempts` 吞异常 — 投递审计缺口

---

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| artifact_store S3 类注释 stub | 默认 `filesystem`；`get_artifact_store` 未接 S3 后端 |
| 信任链测试 mock 外部 SMTP | 测试双 mock `dispatch_artifact`，验证非 mock_succeeded |
| 默认管理员与平台种子 | 首次启动预期 |
| TemplateBlockEditor SQL 文本域 | M-RPT 前既有；非本批新宣称 |
| F-D 规划缺口 | PRD 标可选且无入口 |

---

## 「真实可用」判定（对用户问题）

| 场景 | 判定 |
|------|------|
| **开发机**（MySQL sample + 调 seed-demo + 配扩展指标） | **可用** — 模板 run/导出、标准分析 run/compare/快照、调度创建与 semi_real 执行可验收 |
| **无数据源** 仅点「加载示例报表」 | **部分可用** — 标准分析 pack 可种子，模板/调度可能缺失却 toast 成功（P1-6） |
| **码值翻译 F-C** | **部分可用** — 模板 extension `dimensionDictCode` 链可用；标准分析 lifecycle/distribution 硬编码列；演示 region 中文不匹配（P1-4） |
| **定时投递邮件** | **依赖 SMTP** — 未配置应为失败语义，当前多为 degraded（P1-5） |
| **生产环境** | **不建议宣称可用** — seed-demo 可写演示数据（P0-1）；mock 头可假成功（P1-2） |

---

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 |
|------|------------|------|
| A 假绿清零 | P0-1～P0-3, P1-1, P1-2 | M |
| B 产品诚实语义 | P1-3, P1-4, P1-6, P1-8 | M |
| E 投递与错误面 | P1-5, P1-7, P2-4 | S–M |
| G 性能/超时 | P1-9 | S |
| F P2 | P2-1～P2-3 | S（可选） |

**请确认**：修全量 (P0+P1+P2)？或仅 **P0** / **P0+P1**？

---

## 集成研究建议

- **P1-5（SMTP 未配置语义）** → 若需对接客户邮件网关，可先跑 integration-research 确认 slot/凭证契约；本批可选：统一 `unconfigured` 状态文案。

---

## 回传 YAML

```yaml
status: DONE_WITH_CONCERNS
phase: code-reviewer
mode: auto-fix
fix_mode: confirm-batch
cr_fix_scope: null
scope: change_surface
report: docs/material/code-reviewer/2026-08-20-m-rpt-truth-usability-review.md
auto_fixed: []
remaining: []
coverage:
  blind_spots:
    - "证据层 | .evidence/ | 目录不存在，未 gate-check"
    - "L1 | 结构性假绿 | 无 ast-grep，rg-only"
    - "L7 | 浏览器走查 | 未真机验证 60s 首导出"
  evidence_read: false
external_deps:
  - name: smtp
    smoke: none
    finding: P1-5
  - name: sample-mysql
    smoke: none
    finding: P1-6
  - name: playwright-pdf
    smoke: none
    finding: P1-9
evidence:
  cr: ""
  gate_findings: []
blockers: []
```
