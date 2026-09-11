# 看板定时报告 — 管理员走查剧本

> 对应 PRD RPT-005 · 域附录 `reports.md` · 2026-08-06 IA 收敛

## 前置

- 依赖：`docker compose up -d postgres sample-mysql`（如需示例数据）
- 后端：`backend/` → `alembic upgrade head` → `uvicorn app.main:app --reload --port 8000`
- 前端：`fe/` → `pnpm dev` → http://localhost:5173/admin
- 可选：MailHog（SMTP 1025）用于邮件验真
- PDF 导出：`pip install playwright && playwright install chromium`

## 正常路径

1. **创建看板**：`/admin/dashboards` → 新建 → 添加至少 1 个图表组件 → 保存
2. **设置筛选**（可选）：编辑页配置全局筛选并保存（定时报告复用已保存状态，不在报告表单重复配 SQL/数据集）
3. **创建定时报告**：编辑页 → 分享 → 底部「定时报告」→ 确认「创建前检查」全绿 → 填写频率/收件人 → **创建定时报告**
4. **激活**：创建后点击「激活」横幅，或手动执行状态转换 `schedule`
5. **立即执行**：选中已激活调度 → **立即执行** / **试发邮件**
6. **查看结果**：
   - 分享页执行历史表格（状态、产物类型、错误信息）
   - `/admin/reports/schedules` 展开行查看历史
   - `/admin/reports/center` 近期失败面板（若有）
7. **下载 PDF**：执行成功且 `artifactKind=visual_snapshot` 时，邮件附件或 artifact API 可下载

## 失败注入与重试

| 场景 | 注入方式 | 期望 UI/API 行为 |
|------|----------|------------------|
| SMTP 未配置 | 清空 `RPT_SMTP_HOST` / `RPT_SMTP_FROM` | `delivery-health` → `unconfigured`；创建前检查警告；执行失败含可读原因 |
| Playwright 缺失 | 未安装 playwright/chromium | `export-health` → `unavailable`；创建按钮禁用；toast 提示修复指引 |
| 看板无组件 | 空看板打开分享页 | 前置检查「目标页面」失败；无法创建 |
| 投递失败 | MailHog 未启动 | 执行 `semi_real_failed`；历史显示错误；**重试** 可提交 |

## 回归检查

- [ ] 报表中心 Hub 默认展示看板定时报告，文档模板在折叠区
- [ ] 侧栏：报表中心 / 定时报告 / 预制报表 / 文档模板 命名正确
- [ ] 导出快照页含标题与生成时间（`/export/dashboard/:id?token=`）
- [ ] `make test` 或 `pytest tests/test_dashboard_visual_export.py` 绿
- [ ] FE smoke：`report-center.smoke.test.tsx` · `report-schedules.smoke.test.tsx` · `DashboardSharePage.smoke.test.tsx`
