# 证据袋 · VS-AI 添加新组件与大屏

```yaml
scope: VS-AI 混合方案 — 人类 + 外部 AI 添加新组件（customViz/内置 chart）与看板/数据大屏
scanned_at: 2026-08-12
domain_strength: strong
selection_constraints:
  - id: S1
    topic: 混合方案 C（内置 chart + customViz 沙箱 + layoutJson 混排）
    hard_reverse: true
    status: anchored
    evidence: [E1, E2, E3]
    blocks_flows: [F1, F2, F3]
    action: none
  - id: S2
    topic: customViz 使用 iframe sandbox（非主 DOM、非后端执行 JS）
    hard_reverse: true
    status: anchored
    evidence: [E4, E5, E6]
    blocks_flows: [F1]
    action: none
  - id: S3
    topic: 数据绑定由用户手动完成（AI 不自动生成 SQL）
    hard_reverse: true
    status: anchored
    evidence: [E1, E7]
    blocks_flows: [F1, F4]
    action: none
  - id: S4
    topic: M2 postMessage 查询桥协议（vs:query / vs:result）
    hard_reverse: true
    status: open
    evidence: [E1, E8]
    blocks_flows: [F4]
    action: research
  - id: S5
    topic: customViz 主题注入 vs bundle 手动 token
    hard_reverse: false
    status: assumed
    evidence: [E9, E10]
    blocks_flows: [F5]
    action: assume
  - id: S6
    topic: SM2 artifact 验签（官方组件市场）
    hard_reverse: true
    status: open
    evidence: []
    blocks_flows: [A2]
    action: research
items:
  - id: E1
    path: docs/automate/prd/F17-AIVIZ.md
    kind: prd
    note: M1 已交付项；M2 AIVIZ-006/007 未做
  - id: E2
    path: docs/api/vs-ai-spec/README.md
    kind: api-spec
    note: 三条创作路径 L1/L2/L3 + editor-save
  - id: E3
    path: docs/api/vs-ai-spec/examples/e2e-mixed-screen.json
    kind: example
    note: chart + customViz 混排样例
  - id: E4
    path: fe/src/components/dashboard/CustomVizWidget.tsx
    kind: code
    note: srcDoc iframe sandbox=allow-scripts
  - id: E5
    path: backend/app/ai_viz/models.py
    kind: code
    note: validate_bundle_files 512KB / 禁外链 script
  - id: E6
    path: backend/app/api/v1/ai_viz.py
    kind: code
    note: POST artifacts / GET entry + CSP
  - id: E7
    path: backend/app/schemas/chart_view.py
    kind: code
    note: is_manual_data_binding()
  - id: E8
    path: docs/api/vs-ai-spec/PROTOCOL.md
    kind: api-spec
    note: M2 postMessage 占位
  - id: E9
    path: docs/api/vs-ai-spec/theme-tokens.json
    kind: api-spec
    note: M1 推荐手动对齐
  - id: E10
    path: docs/api/vs-ai-spec/guides/D3-OPTIONAL.md
    kind: api-spec
    note: M2 平台注入 planned
  - id: E11
    path: fe/src/pages/admin/dashboard/DashboardEditPage.tsx
    kind: code
    note: 看板/大屏共用编辑保存
  - id: E12
    path: fe/src/lib/vizComponents.ts
    kind: code
    note: 组件库仅 chart/filter/text/media
  - id: E13
    path: backend/app/dashboard/service.py
    kind: code
    note: editor-save 事务
  - id: E14
    path: tests/test_ai_viz_hybrid.py
    kind: test
    note: API + layout + manual 校验
  - id: E15
    path: docs/automate/goal.md
    kind: goal
    note: AI 智能问数 Out of Scope；VS-AI 可视化创作独立试点
gaps:
  - 编辑器 UI 无 customViz 入口 / Inspector
  - viz-components 不支持 customViz 发布复用
  - postMessage / 主题注入未实现
  - layout/orchestrate 未立项实现
```
