# 定时投递执行历史把 SMTP 原文塞进宽表

- **ID**: CASE-2026-08-14-005
- **状态**: 已修复
- **影响**: fe | admin-ui
- **首次发现**: 2026-08-14

## 症状

- 调度弹窗「执行历史」是六列表格，状态纯文本、SMTP 550 整段挤在单元格里，下载/详情/重试挤成一行。

## 根因

- compact/embedded 仍复用全宽 Table，没有按弹窗宽度改卡片信息架构；错误列直接 `localizeApiMessage` 全文。

## 错误做法（避免）

- 在弹窗里硬塞多列表格 + 协议层错误原文当主文案。

## 修复方式

- compact：卡片行（状态 Badge + 产物 + 时间 / 收件 / 人话错误摘要 + 图标操作）。
- SMTP 550 等映射为「邮件投递失败，请核对收件地址」；原文进详情 Dialog。

## 验证

- `pnpm exec vitest run src/pages/admin/reports/scheduleHistoryPresentation.test.ts`

## 关联

- `fe/src/pages/admin/reports/components/ScheduleHistoryTable.tsx`
- `fe/src/pages/admin/reports/scheduleHistoryPresentation.ts`
