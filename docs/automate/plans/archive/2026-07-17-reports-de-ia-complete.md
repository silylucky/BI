# 报表模块 DataEase IA 对标补齐

> **状态：已实现**（2026-07-17 归档）。侧栏四入口 + 报表中心/调度重试 FE 已交付。

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-17

> 已走契约编译路径：用户指定侧栏「报表」分组四入口对标 DataEase 并全部完成；后端 RPT-001~007 已实现，本轮聚焦 FE 消费落差（`2026-07-10-fe-de-ss-ia-optimization.md` GAP-08）。

## 目标

侧栏「报表」分组下预制报表 / 报表模板 / 报表调度具备 DataEase 级可交付体验：报表中心可浏览运行、调度页可管理状态与执行历史重试。

## 范围

| In | Out |
|----|-----|
| `fe/src/pages/admin/reports/*` 新页与增强 | 真实 PDF/Word 排版引擎 |
| `fe/src/config/nav-manifest.tsx` + `routes.tsx` | APScheduler 生产级 / DB 持久化 |
| 共享 hook `useReportSchedules`、catalog 工具 | 另存为/手工执行 companion |

## 验收

- [ ] `/admin/reports/center` 展示可访问模板与预制报表入口卡片
- [ ] `/admin/reports/view/:nodeId` 可运行模板并展示结果区
- [ ] `/admin/reports/schedules` 展示 cron/状态/操作；展开执行历史；失败可重试
- [ ] `ReportSchedulesPage` 使用 API 字段 `cron`（非错误字段 `cronExpression`）
- [ ] vitest：`report-center.smoke.test.tsx`、`report-schedules.smoke.test.tsx`、既有 reports smoke 全绿
- [ ] `resolve-nav.test.ts` 导航项含「全部报表」

## 改动清单

| Task | 文件 | 说明 |
|------|------|------|
| T1 | `fe/src/lib/reportCatalogUtils.ts` | 规范化 catalog 响应、递归收集 template 节点 |
| T2 | `fe/src/pages/admin/reports/useReportSchedules.ts` | 调度列表/历史/transition/execute/retry |
| T3 | `fe/src/pages/admin/reports/ReportCenterPage.tsx` | DE 风格 hub：统计卡片 + 模板网格 |
| T4 | `fe/src/pages/admin/reports/ReportViewPage.tsx` | 模板运行与结果展示 + 导出 |
| T5 | `fe/src/pages/admin/reports/ReportSchedulesPage.tsx` | 重写：主表 + 历史抽屉/展开 |
| T6 | `SchedulePanel.tsx` | 复用 `useReportSchedules`（减重复） |
| T7 | `nav-manifest.tsx` / `routes.tsx` | 路由与「全部报表」导航 |
| T8 | smoke tests + `resolve-nav.test.ts` | 回归 |

## 验证

```bash
cd fe; npx vitest run src/pages/admin/reports src/lib/resolve-nav.test.ts
```

## 八维度自审（摘要）

| 维度 | 结论 |
|------|------|
| 范围 | 仅 FE reports 域，无后端契约变更 |
| 风险 | 低，可逆 |
| 依赖 | 已有 `/api/v1/reports/*` |
| 测试 | smoke 覆盖新页与调度重试 |
| 文档 | 行为对齐 `docs/ui/layout.md`，本轮不改 PRD（消费已有能力） |
