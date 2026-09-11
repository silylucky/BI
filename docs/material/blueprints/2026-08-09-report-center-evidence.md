# 证据袋 · 报表中心

```yaml
scope: 报表中心全模块（Hub / 预制 / 文档模板 / 定时报告 / 看板定时推送）
scanned_at: 2026-08-09
domain_strength: strong
selection_constraints:
  - id: S1
    topic: 自研 RenderSpec 统一 Web/PDF/Excel/Word（禁 Jasper）
    hard_reverse: true
    status: anchored
    evidence: [E1, E4, E8]
    blocks_flows: [F4]
    action: none
  - id: S2
    topic: 调度持久化 + 多通道投递（SMTP/企微/钉钉）
    hard_reverse: true
    status: anchored
    evidence: [E1, E5, E9]
    blocks_flows: [F1, F2]
    action: none
  - id: S3
    topic: 报表元数据 DB 持久化（RPT_METADATA_STORE=db 默认）
    hard_reverse: true
    status: anchored
    evidence: [E1, E5]
    blocks_flows: [F3, F4, F5]
    action: none
  - id: S4
    topic: 看板 G5 可视化 PDF（Playwright）vs 布局摘要降级
    hard_reverse: true
    status: anchored
    evidence: [E5, E10, E11]
    blocks_flows: [F1]
    action: none
  - id: S5
    topic: 两条产品线并列叙事（可视化定时主路径 + 文档模板次路径但已可用）
    hard_reverse: false
    status: assumed
    evidence: [E12, E13]
    blocks_flows: [F2, F4]
    action: assume
  - id: S6
    topic: 批量导入 dry-run / 冲突预检 API
    hard_reverse: true
    status: open
    evidence: [E14]
    blocks_flows: [A1]
    action: research
items:
  - id: E1
    path: docs/arch.md
    kind: arch
    note: ADR-09/19/20 已定；G5 export_render 锚点
  - id: E2
    path: docs/automate/prd/F08-RPT.md
    kind: prd
    note: RPT-001~007 验收与代码锚点
  - id: E3
    path: docs/services/reports.md
    kind: domain
    note: 域 In/Out、IA、DataEase 对标（注：nav 四入口描述待与代码同步）
  - id: E4
    path: backend/app/reports/contract.py
    kind: code
    note: RenderSpec 契约 engineVersion=1.0
  - id: E5
    path: docs/feature-truth/2026-08-07-report-center-final-signoff.md
    kind: spec
    note: REAL 签收 9.0/10；77 pytest + 44 vitest
  - id: E6
    path: docs/ui/layout.md
    kind: ui
    note: §报表路由与页面范式（侧栏描述待同步单入口）
  - id: E7
    path: fe/src/pages/admin/reports/
    kind: code
    note: ReportCenterPage、SchedulePanel、TemplateDetailPanel 等
  - id: E8
    path: backend/app/reports/render/
    kind: code
    note: reportlab/openpyxl/OOXML 真渲染 + CJK 字体
  - id: E9
    path: backend/app/reports/scheduler/
    kind: code
    note: FSM、executor、channels、artifact_store
  - id: E10
    path: backend/app/dashboard/export_render.py
    kind: code
    note: Playwright PDF 快照链
  - id: E11
    path: fe/src/pages/export/DashboardExportSnapshotPage.tsx
    kind: code
    note: G5 FE 导出页 token 消费
  - id: E12
    path: docs/material/product-reviewer/2026-08-09-report-center-r2.md
    kind: spec
    note: 77 分；B-13~B-18 刺点；B-13/14/15/17 已 verified
  - id: E13
    path: fe/src/lib/reportCenterNav.ts
    kind: code
    note: 两条产品线文案 + 最近访问深链
  - id: E14
    path: fe/src/pages/admin/reports/components/BatchImportPanel.tsx
    kind: code
    note: JSON 向导；无 dry-run API
  - id: E15
    path: fe/src/config/nav-manifest.tsx
    kind: code
    note: 侧栏仅「报表中心」单入口（2026-08-09）
  - id: E16
    path: docs/api/README.md
    kind: api
    note: /api/v1/reports/* 契约索引
gaps:
  - docs/services/reports.md、docs/ui/layout.md 侧栏仍写四入口，与 nav-manifest 单入口不一致（文档债 · 蓝图已确认待 sync）
  - B-18 批量 dry-run 未实现（S6 open）
  - MailHog/企微/钉钉 staging 真机未跑（签收 UNVERIFIED 项）
  - Playwright E2E 依赖本机 Chromium
```
