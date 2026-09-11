# G5 看板定时报告 ToB 完善 · UX Backlog · 2026-08-04

> 对应实施计划：G5 看板定时报告 — 完整 ToB 完善方案

## 已交付（Phase 1–4）

| 项 | 状态 | 说明 |
|----|------|------|
| 创建后激活引导 | ✅ | `ScheduleActivationBanner` · 看板/模板面板 |
| 独立定时推送入口 | ✅ | `DashboardEditPage` 工具栏 · `DashboardScheduleSheet` |
| 权限诚实 | ✅ | `dashboard:schedule` · owner ACL · 只读提示 |
| 草稿 PATCH | ✅ | `PATCH /api/v1/reports/schedules/{id}` |
| 附件单选语义 | ✅ | PDF 可视化 vs Excel 布局清单 |
| compact 错误列 | ✅ | `ScheduleHistoryTable` |
| 试发邮件 | ✅ | 「试发邮件」按钮 |
| 空看板校验 | ✅ | `DASHBOARD_EXPORT_EMPTY` |
| 多计划 | ✅ | 看板面板列表 + 新建多条 |
| 多格式执行 | ✅ | executor 遍历 attachment_formats |
| IM 通道 | ✅ | 企微/钉钉 webhook + 表单多选 |
| 分布式 cron | ✅ | DB tick lock |
| 持久化 ORM | ✅ | migration 0032 · store 抽象 |

## 后续（可选）

- 飞书 webhook
- 产物 signed URL 下载（IM 大附件）
- 模板 Jasper 真 PDF（ADR-09）
