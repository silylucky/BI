# BUG 登记簿

> 最近更新：2026-08-07

| ID | 文档 | 状态 | 优先级 | 摘要 |
|----|------|------|--------|------|
| BUG-15 | [BUG-15_schedule-dialog-select-dismiss_2026-08-07.md](./BUG-15_schedule-dialog-select-dismiss_2026-08-07.md) | fixed | P1 | 定时推送弹窗 Select 误关弹窗；Portal + guard 竞态 + onOpenChange 防线 |
| BUG-14 | [BUG-14_embed-share-no-data_2026-08-07.md](./BUG-14_embed-share-no-data_2026-08-07.md) | fixing | P0 | 公开分享大屏 Dataset 图表无数据；运行中后端缺 embed dataset 路由 |
| BUG-13 | [BUG-13_map-texture-misalign_2026-07-23.md](./BUG-13_map-texture-misalign_2026-07-23.md) | fixing | P0 | 3D 地图卫星纹理与省界错位；R1 WM UV 对齐构建期瓦片裁切 |
| BUG-12 | [BUG-12_data-screen-resize-content-vanish_2026-07-20.md](./BUG-12_data-screen-resize-content-vanish_2026-07-20.md) | fixing | P0 | 大屏 edit resize 后内容消失；R4 仪表板方案无效，二次收口几何+测量管线 |
| BUG-9 | [BUG-9_dashboard-pixel-canvas-jitter_2026-07-15.md](./BUG-9_dashboard-pixel-canvas-jitter_2026-07-15.md) | qa_pending | P0 | 画布持续抖动；R1 切断视口反馈环+RO 合帧 |
| BUG-8 | [BUG-8_chart-inspector-provider-boundary_2026-07-15.md](./BUG-8_chart-inspector-provider-boundary_2026-07-15.md) | qa_pending | P0 | 点击图表白屏；Provider 提升至编辑页 |
| BUG-7 | [BUG-7_dashboard-resize-no-collision_2026-07-15.md](./BUG-7_dashboard-resize-no-collision_2026-07-15.md) | qa_pending | P0 | resize 不走 onPreview；R1 已接入碰撞 preview |
| BUG-6 | [BUG-6_dashboard-layout-roundtrip-drift_2026-07-15.md](./BUG-6_dashboard-layout-roundtrip-drift_2026-07-15.md) | fixed | P0 | 保存/重载后像素布局漂移；移除 hydrate auto-pack |
| BUG-001 | [BUG-001_account-password-security_2026-07-13.md](./BUG-001_account-password-security_2026-07-13.md) | fixed | P0 | 修改密码误登出、布局与字段交互；已合并 fix/account-password-security |
| BUG-1 | [BUG-1_dashboard-chart-clipped_2026-07-13.md](./BUG-1_dashboard-chart-clipped_2026-07-13.md) | fixing | P1 | 看板 widget 内折线/柱状图被裁切 |
| BUG-2 | [BUG-2_dashboard-drag-resize-unusable_2026-07-13.md](./BUG-2_dashboard-drag-resize-unusable_2026-07-13.md) | qa_pending | P0 | Phase A 失败后切像素画布；代码完成，待真实 Pointer QA |
| BUG-3 | [BUG-3_dashboard-field-render-white-screen_2026-07-14.md](./BUG-3_dashboard-field-render-white-screen_2026-07-14.md) | fixed | P0 | 字段拖放白屏 + 图表渲染契约失配 |
| BUG-4 | [BUG-4_navigation-white-screen_2026-07-14.md](./BUG-4_navigation-white-screen_2026-07-14.md) | fixed | P0 | 切换页面整页白屏（路由 Error Boundary） |
| BUG-5 | [BUG-5_dashboard-style-overrides-background_2026-07-14.md](./BUG-5_dashboard-style-overrides-background_2026-07-14.md) | qa_pending | P1 | 仪表板主题覆盖自定义背景；样式分层修复 |

BUG-001 浏览器证据：`artifacts/BUG-001/`（9 张截图）。
