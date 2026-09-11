# 证据袋 · 文档模板管理

```yaml
scope: 文档模板管理（/admin/reports/templates · catalog 树 + 详情）
scanned_at: 2026-08-14
domain_strength: mixed
selection_constraints:
  - id: S1
    topic: 文档套版渲染底座用自研 RenderSpec，不引入 Jasper/FineReport 设计器
    hard_reverse: true
    status: anchored
    evidence: [E1]
    blocks_flows: [F3]
    action: none
  - id: S2
    topic: 报表保持两条产品线并列——看板可视化 PDF vs 文档模板套版；不把文档模板并进看板
    hard_reverse: true
    status: anchored
    evidence: [E2, E3]
    blocks_flows: [F1, F4]
    action: none
  - id: S3
    topic: 模板元数据 of record 为 catalog 节点（DB），扩展/块/调度挂同一 nodeId
    hard_reverse: true
    status: anchored
    evidence: [E1, E4, E8]
    blocks_flows: [F2, F3, F4]
    action: none
items:
  - id: E1
    path: docs/arch.md
    kind: adr
    note: ADR-09 RenderSpec；ADR-20 元数据持久化与真导出；明确不引入 Jasper
  - id: E2
    path: docs/services/reports.md
    kind: domain
    note: 两条产品线并列；文档模板入口 /admin/reports/templates；创建主路径推荐看板定时
  - id: E3
    path: docs/automate/prd/F08-RPT.md
    kind: prd
    note: RPT-003 模板定义；RPT-004 树 CRUD；另存为/手工执行未做；RPT-001 引擎 run
  - id: E4
    path: fe/src/pages/admin/reports/ReportTemplatesPage.tsx
    kind: code
    note: 未选中节点时右侧空态「从目录选择模板」；树操作 hover 才显「…」；无自动选中
  - id: E5
    path: fe/src/pages/admin/reports/components/CatalogTreeNode.tsx
    kind: code
    note: 删除/移动在 opacity-0 group-hover 的 MoreHorizontal 菜单；截图中不可见属 as-is
  - id: E6
    path: fe/src/pages/admin/reports/components/TemplateDetailPanel.tsx
    kind: code
    note: 选中模板后 6 Tab：基本信息/模板块/扩展/预览/调度/批量导入
  - id: E7
    path: docs/ui/layout.md
    kind: ui
    note: 菜谱 master-detail；侧栏「我的报表」深链 templates；可视化模板 ≠ 文档模板
  - id: E8
    path: backend/app/reports/catalog/service.py
    kind: code
    note: 节点 CRUD/move；空文件夹才可删；RPT_TEMPLATE_IN_USE 409
  - id: E9
    path: fe/src/config/nav-manifest.tsx
    kind: ui
    note: 子项名为「我的报表」指向 templates；页标题为「文档模板」——名词漂移
  - id: E10
    path: https://dataease.io/docs/v2/xpack/sys_management_report/
    kind: public
    note: DataEase 定时报告专页（仪表板/大屏推送）。FineReport 套版导出见成稿场景表。检索日 2026-08-14
  - id: E11
    path: fe/src/lib/reportCenterNav.ts
    kind: code
    note: DOC_TEMPLATE_PRODUCT_LINE 文案；调度提示走模板右侧调度 Tab
gaps:
  - 打开页不自动选中任何节点 → 目录有数据右侧仍空（用户截图）已进缺口 G1
  - 树操作仅 hover 可见，截图观感「没有删除」已进 G2
  - 侧栏「我的报表」vs 页标题「文档模板」名词漂移已进 H1
  - PRD 另存为/手工执行未做；主路径导出在详情 Tab，非独立「运行」入口
```
