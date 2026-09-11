---
description: 前端 SPA 规范（路由 · 信封 · 复用 · 性能 · a11y · docs/ui）
globs:
  - "{{FE_ROOT}}/**/*.tsx"
  - "{{FE_ROOT}}/**/*.ts"
  - "{{FE_ROOT}}/**/*.css"
alwaysApply: false
---

# 前端规范

> `docs/ui/` · 设计系统 skill · 文案 production · 体量/信封 engineering

## 硬约束

- 先读 `docs/ui/`；无基准先补 create-ui-docs
- 文案人话；禁 PRD 编号、甲乙方
- 业务参数来自后端库内配置；禁散落 env 拼开关

## 路由与 API

| 视图 | 路由 | API |
|------|------|-----|
| {{SURFACE_ROWS}} |

- 主业务禁直调仅管理 API
- 解析 `{ code, msg, data }`，`code === 0` 成功；错误映射人话

## 复用

改前读 `components/README.md`。≥2 页同模式上浮 `components/`；禁复制表格壳/空态。

## 性能 · 体验 · a11y（P1）

- 列表/提交：明确加载与失败态；禁无文案死转圈
- 大列表分页；禁无界全量拉（与后端 page/page_size 一致）
- 表单错误关联字段 + `aria-invalid`；图标按钮有可达名称；对话框可键盘关闭
- 破坏性操作二次确认（前端）；高危仍以后端确认为准

## 体量

单文件 ≤300 行；有 `check:design`/lint 则提交前执行。
