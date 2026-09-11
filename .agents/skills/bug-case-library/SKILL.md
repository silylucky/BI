---
name: bug-case-library
description: >-
  项目 Bug Case 知识库：记录已踩坑、症状、根因与修复方式。修复 bug 前先检索 cases/ 是否有类似问题；
  确认并修复 bug 后必须新增或更新 case。适用于前端/后端/UI 交互/部署等一切缺陷排查与预防。
---

# Bug Case 知识库

## 何时使用

| 场景 | 动作 |
|------|------|
| **开始修 bug** | 先读 `cases/` 目录，按症状/模块关键词检索是否有类似 case |
| **根因确认并合入修复** | 新增或更新对应 case 文件 |
| **新增弹窗/portal/全局 DOM 副作用** | 读 `cases/fe-modal-portal-cleanup.md` |

## 修 Bug 工作流

```
1. 用户报告 / 测试失败
2. 打开 .agents/skills/bug-case-library/cases/ 检索（症状、文件路径、库名）
3. 若命中类似 case → 优先验证同一根因，避免重复踩坑
4. 若无命中 → 正常 debug（假设 → 运行时证据 → 最小修复）
5. 修复验证通过后 → 新增/更新 case（见下方模板）
6. PR 描述中可链接 case 文件名
```

## Case 文件命名

```
cases/<域>-<简短主题>.md
```

示例：`fe-modal-portal-cleanup.md`、`api-stream-finish-reason.md`

## Case 模板（新建时复制）

```markdown
# [标题]

- **ID**: CASE-YYYY-MM-DD-001
- **状态**: 已修复 | 已知限制 | 进行中
- **影响**: fe | be | admin-ui | 部署
- **首次发现**: YYYY-MM-DD

## 症状

- 用户可见现象（一步一说）

## 根因

- 技术根因（含库/生命周期/时序）

## 错误做法（避免）

- 列具体反模式

## 修复方式

- 文件路径 + 原则（非仅贴 diff）

## 验证

- 如何确认已修好

## 关联

- 相关文件、PR、规则
```

## Case 索引

| ID | 文件 | 关键词 |
|----|------|--------|
| CASE-2026-06-09-001 | [fe-modal-portal-cleanup.md](./cases/fe-modal-portal-cleanup.md) | modal, AlertDialog, Radix, portal, inert, pointer-events, 整页不可点 |
| CASE-2026-06-10-001 | [gateway-ark-coding-json-object.md](./cases/gateway-ark-coding-json-object.md) | ark_coding, json_object, DeepSeek, upstream_error, BUG-28 |
| CASE-2026-06-12-001 | [auth-legacy-admin-password.md](./cases/auth-legacy-admin-password.md) | login, invalid credentials, admin, seed, admin-change-me, 激活后登录 |
| CASE-2026-06-12-002 | [fe-api-null-items-list.md](./cases/fe-api-null-items-list.md) | items null, length, ChatEndpointsPage, 白屏, 空列表 |
| CASE-2026-06-17-001 | [user-last-super-admin-demote-race.md](./cases/user-last-super-admin-demote-race.md) | user, super_admin, demote, race, atomic update |
| CASE-2026-07-09-001 | [fe-dashboard-zombie-edit-flicker.md](./cases/fe-dashboard-zombie-edit-flicker.md) | dashboard, 404, zombie edit, RGL isDroppable, 闪烁, 无法保存 |
| CASE-2026-07-13-001 | [auth-password-401-session-semantics.md](./cases/auth-password-401-session-semantics.md) | change-password, 401, apiFetch, logout, preserveSessionOn401Codes, AUTH_INVALID_CURRENT_PASSWORD |
| CASE-2026-07-15-001 | [fe-dashboard-theme-variant-hydration.md](./cases/fe-dashboard-theme-variant-hydration.md) | dashboard, themeVariants, hydrate, 浅/深主题, 仪表板风格, styleConfig |
| CASE-2026-07-15-002 | [fe-color-field-picker-jump.md](./cases/fe-color-field-picker-jump.md) | ColorField, 取色器, react-colorful, 跳色, widgetStyle background |
| CASE-2026-07-16-001 | [fe-dashboard-pixel-drag-collision-squeeze.md](./cases/fe-dashboard-pixel-drag-collision-squeeze.md) | pixel canvas, drag, collision, 挤叠, 重叠, vacate, skipVerticalCompact |
| CASE-2026-07-16-002 | [fe-dashboard-pixel-canvas-scroll-chain.md](./cases/fe-dashboard-pixel-canvas-scroll-chain.md) | pixel canvas, scroll, wheel, overscroll, 表格, 滚不动 |
| CASE-2026-07-27-001 | [fe-geo-drill-map-registry-desync.md](./cases/fe-geo-drill-map-registry-desync.md) | 下钻, vs-geo-630000, OfflineGeoPort, HMR, 资产未就绪 |
| CASE-2026-07-27-002 | [fe-dashboard-save-style-strip.md](./cases/fe-dashboard-save-style-strip.md) | 保存, styleConfig, 静默剥离, 关联组件, pack |
| CASE-2026-08-06-003 | [fe-hub-card-preview-not-wysiwyg.md](./cases/fe-hub-card-preview-not-wysiwyg.md) | 缩略图, 卡片预览, 标题字号巨大, chrome-scale 补偿, presentationMode fill, 拉伸, geo3d thumbnail 降级, 卫星地形 |
| CASE-2026-08-07-001 | [fe-hub-list-preview-static-thumb.md](./cases/fe-hub-list-preview-static-thumb.md) | 列表预览, 灰块 Skeleton, live 并发, 轻量真实预览, card profile, 测试环境卡顿, sample_db |
| CASE-2026-08-06-004 | [fe-table-style-tests-unwired.md](./cases/fe-table-style-tests-unwired.md) | 表格样式, table-info, 透明度, 表头分页, headerFontSize, tablePaletteId, 快速配色, 测试未接线 |
| CASE-2026-08-07-001 | [fe-richtext-blank-line-collapse.md](./cases/fe-richtext-blank-line-collapse.md) | 富文本, 换行, 空行, TipTap, ProseMirror-trailingBreak, stripEditorArtifacts |
| CASE-2026-08-07-002 | [fe-export-snapshot-401-login-redirect.md](./cases/fe-export-snapshot-401-login-redirect.md) | 导出, PDF, data-export-ready, 401, 登录页, export-query, dataset/execute |
| CASE-2026-08-14-002 | [fe-dashboard-thumbnail-empty-blob.md](./cases/fe-dashboard-thumbnail-empty-blob.md) | 封面截图, 0字节 PNG, html-to-image, thumbnail, 加载失败 |
| CASE-2026-08-14-004 | [fe-chart-axis-font-layout-scale.md](./cases/fe-chart-axis-font-layout-scale.md) | 轴标签, 重叠, CHAR_PX, visualScale, 放大组件, cartesianMargin |
| CASE-2026-08-14-005 | [fe-schedule-history-smtp-dump.md](./cases/fe-schedule-history-smtp-dump.md) | 执行历史, SMTP, 550, ScheduleHistoryTable, 弹窗表格 |
| CASE-2026-08-14-006 | [fe-chart-axis-cjk-overlap.md](./cases/fe-chart-axis-cjk-overlap.md) | X轴, 中文, 省名, 抽稀, CHAR_PX, 分组柱状图 |
| CASE-2026-08-14-008 | [fe-funnel-empty-legend-pad.md](./cases/fe-funnel-empty-legend-pad.md) | 漏斗, 图例, 空白, reserveLegendMargin |
| CASE-2026-08-14-009 | [fe-funnel-fake-3d-offset.md](./cases/fe-funnel-fake-3d-offset.md) | 漏斗, 3D, 挤出, 顶面, 侧面 |
| CASE-2026-08-14-007 | [fe-chart-result-limit-stale-execute.md](./cases/fe-chart-result-limit-stale-execute.md) | 结果展示, 自定义N, 超过N行, 拒画, queryLimit, useChartExecute |
| CASE-2026-08-14-011 | [fe-chart-jump-removed.md](./cases/fe-chart-jump-removed.md) | 图表跳转已下线, 勿再接入 onJumpClick / 跳转设置 |
| CASE-2026-08-14-012 | [fe-chart-palette-trigger-label-center.md](./cases/fe-chart-palette-trigger-label-center.md) | 配色方案, 品牌, 左对齐, SelectValue |
| CASE-2026-08-14-013 | [fe-chart-datazoom-svg-transform.md](./cases/fe-chart-datazoom-svg-transform.md) | 缩略轴, dataZoom, d3.zoom, 跳动, 类目窗口 |
| CASE-2026-08-17-001 | [fe-pie-outside-label-clip.md](./cases/fe-pie-outside-label-clip.md) | 饼图, 玫瑰图, 外标签, 裁切, 叠字, capPieRadiusForOutsideLabels |

## 维护规则

- 一个根因一个 case；同一根因多次复发则 **更新** 原 case 的「验证」「关联」
- case 写 **可复用的原则**，不要只写「改了某行」
- 修复与 case 同步提交（或同一 PR）
