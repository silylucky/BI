# 报表中心模块 — 产品体验待优化 · 2026-07-31（post UI 对齐复评）

> **Skill**：`product-experience-critique`  
> **触发**：报表中心 UI 全模块对齐（Design System + G1/G2/G5 功能闭环）落地后复评  
> **Persona**：IT 数据管理员（`report:manage`）+ 业务分析师（`report:read`）  
> **范围**：`/admin/reports/center` · `/admin/reports` · `/admin/reports/view/:id` · `/admin/reports/templates` · `/admin/reports/schedules` · 看板/大屏分享 Dialog（`/admin/dashboards/:id/share` · `/admin/data-screens/:id/share`）

---

## 第四轮修复 · 2026-07-31（post-align backlog 打磨）

| ID | 状态 | 改动摘要 |
|----|------|----------|
| ISSUE-016 | ✅ | `DashboardShareDialog` 挂载 `DashboardSchedulePanel` |
| ISSUE-017 | ✅ | 调度页 CTA「在看板分享页新建」→ `/admin/dashboards`；看板 Tab 空态文案 |
| ISSUE-018 | ✅ | 调度列表 `ListPageToolbar` 搜索 |
| ISSUE-019 | ✅ | 模板调度激活后只读 +「取消后重建」引导 |
| ISSUE-020 | ✅ | `SchedulePanel` 开启附件格式 |
| ISSUE-023 | ✅ | 主列表换 shadcn `Table`（`ScheduleListTable`） |
| ISSUE-024 | ✅ | 时区下拉中文标签 |
| ISSUE-025 | ✅ | 接收人用户行增加用户名搜索 |
| ISSUE-009 | 开放 | Hub 卡片 vs ListKit（产品确认） |
| ISSUE-013 | 开放 | Hub 预制 pinning（产品确认） |

**综合分预估**：raw **8.0+**（仍无 browser，cap 适用）

---

## 总览

| 项 | 内容 |
|----|------|
| Persona | IT 数据管理员 · 业务分析师 |
| 范围 | 报表中心全模块 + 看板分享定时 |
| 主任务 | ① 浏览/运行报表 ② 模板定时调度 ③ 看板 PDF 定时推送 ④ 调度列表运维 |
| 综合分 | **7.0 / 10**（**capped ≤7.0**；未走查 raw **7.5**） |
| P0 / P1 / P2 / P3 | 0 / 0 / 6 / 3 |
| Blind spots | 无 `.dev` + browser；导出下载、邮件投递真实感、Dialog 内滚动与长表单未实测 |
| 评审方式 | 读码 + 对照 UI 对齐计划验收项；**未** browser 走查 |

一句话：消费侧与模板调度 UI 对齐明显进步，但**看板定时报告创建主路径在分享 Dialog 中断**——组件已写却未挂载，调度页 CTA/空态也与计划意图不一致。

---

## 维度得分

| 维度 | 权重 | 得分 | Δ（vs 2026-07-30 二轮） | 一句话（绑 ISSUE） |
|------|------|------|-------------------------|-------------------|
| 任务可完成度 | 20% | 7 | -2 | 看板定时只能在列表看，分享页无法创建（ISSUE-016） |
| 操作效率 | 15% | 7 | -1 | 看板新建需多跳；调度列表无搜索（ISSUE-017/018） |
| 按钮与布局 | 15% | 8 | 0 | 表单 h-11 统一；调度页双 CTA 主次不清（ISSUE-017） |
| 视觉与舒适度 | 15% | 8 | 0 | shadcn Table 结果区、Badge 列到位 |
| 反馈与容错 | 15% | 8 | 0 | 接收人校验、执行历史中文化保留 |
| 信息架构与文案 | 10% | 7 | -1 | 看板 Tab 空态/CTA 文案误导（ISSUE-017） |
| 一致性与可预期 | 10% | 7 | 0 | Hub 卡片 vs 调度 ListKit 仍分裂（ISSUE-009）；列表 raw table（ISSUE-023） |

**加权 raw**：7.5 → **cap 7.0**（无 browser P0 路径证据）

---

## 用户旅程痛点

### 任务：为销售看板配置每周一 PDF 邮件推送

1. Hub →「看板定时报告」→ 调度列表 Tab「看板/大屏」✅  
2. 空态提示去「报表中心看板定时报告」——**只能看列表，不能在此创建** ⚠️ ISSUE-017  
3. 点「在报表中心新建」→ 跳到**预制报表页** `/admin/reports`，与看板无关 ❌ ISSUE-017  
4. 计划路径：看板列表 → 分享页 → 底部「定时报告」——**分享 Dialog 无该区块** ❌ ISSUE-016  

### 任务：模板 Word 报表 + 多接收人定时

1. 模板详情 → 调度 Tab → `ScheduleFormFields` + 多行接收人 ✅  
2. 创建后表单只读，**无法改接收人/频率**（非 draft）⚠️ ISSUE-019  
3. 模板调度**无附件格式选项**（看板组件有 `showAttachments` 但未接入）⚠️ ISSUE-020  

### 任务：分析师 Hub 找常用预制

1. 预制区 6 条 + 展开全部 ✅（ISSUE-013 部分缓解）  
2. 仍无法钉选常用 ⚠️ ISSUE-013  

---

## 问题清单

| ID | 严重度 | 维度 | 用户场景 | 问题描述 | 建议优化 | 证据 | 置信度 |
|----|--------|------|----------|----------|----------|------|--------|
| ISSUE-016 | P2（未走查，原 P0 级） | 任务 | 管理员在看板分享页配定时 PDF | 「分享弹窗里只有公开链接和嵌入，根本没有定时报告卡片——组件写了但没放进来」 | 在 `DashboardShareDialog` 或 `DashboardBoardShareBody` / `DataScreenSharePanel` 底部挂载 `DashboardSchedulePanel`； smoke 改为断言存在 | `DashboardSchedulePanel.tsx` 无 import；`DashboardShareDialog.tsx` 无 Schedule；`DashboardSharePage.smoke.test.tsx` G5 断言**不存在**定时报告 | 高 |
| ISSUE-017 | P2 | 任务/文案 | 调度页看板 Tab 空态 | 「空态说去报表中心，主按钮却是『在报表中心新建』跳到预制页，跟看板半毛钱关系没有」 | 主 CTA 改为「去看板列表」→ `/admin/dashboards`（附说明：进入分享 → 定时报告）；看板 Tab 空态同步；次按钮保留「在模板中新建」 | `ReportSchedulesPage.tsx:242-244` · `:98-99` | 高 |
| ISSUE-018 | P2 | 效率 | 调度任务 >20 条 | 「列表只能 Tab 筛源类型，搜不到接收人或模板名」 | 增加 `ListPageToolbar` 搜索（sourceLabel / 接收人摘要 client filter） | `ReportSchedulesPage.tsx` 无 search state | 中 |
| ISSUE-019 | P2 | 任务 | 模板调度已激活后要加邮箱 | 「创建时配了角色，后来想加外部邮箱——表单灰掉只能取消重建」 | 产品确认：若后端无 PATCH，至少只读摘要 +「取消后重建」引导；有 API 则开放编辑 | `SchedulePanel.tsx:189` `disabled={readOnly \|\| schedule.status !== "draft"}` | 高 |
| ISSUE-020 | P2 | 一致 | 模板 vs 看板调度 | 「看板表单能选 PDF/Excel，模板调度 Tab 却没有附件格式」 | `SchedulePanel` 创建/编辑区传 `showAttachments`；与看板对齐 | `ScheduleFormFields` `showAttachments` 仅 `DashboardSchedulePanel` 使用；`SchedulePanel` 未传 | 高 |
| ISSUE-023 | P3 | 一致 | 调度列表页表格 | 「执行历史已是 shadcn Table，主列表还是 raw `<table>`」 | 主列表换 shadcn `Table` 或抽 `ScheduleListTable` | `ReportSchedulesPage.tsx:279-313` vs `ScheduleHistoryTable.tsx` | 中 |
| ISSUE-024 | P3 | 文案 | 非技术管理员配时区 | 「时区下拉写 Asia/Shanghai，不如写中国标准时间」 | Select 展示中文标签，值仍 IANA | `ScheduleFormFields.tsx:102-103` | 中 |
| ISSUE-025 | P3 | 效率 | 用户 >200 人 | 「选用户只能滚下拉，人多时找不到」 | Combobox 搜索或分页拉取 | `ScheduleRecipientsField.tsx:50` `limit=200` 无 filter | 中 |
| ISSUE-009 | P2 | 一致 | 跨页维护 | 「调度是 ListKit，Hub 还是卡片栅格——像两个产品」 | Hub 保持 hub 模式可接受；或预制/模板区加「列表视图」切换 | 延续 2026-07-30 backlog | 中 |
| ISSUE-013 | P3 | 效率 | Hub 快捷触达 | 「常用预制仍不能钉选」 | 产品确认后做 pinning | `ReportCenterPage.tsx` `PREFAB_HUB_PREVIEW` | 低 |

---

## 待优化 backlog

| 优先级 | ISSUE | 用户价值 | 建议改什么 | 建议不改什么 | **实施 skill** |
|--------|-------|----------|------------|--------------|----------------|
| 1 | ISSUE-016 | 看板定时报告主路径闭环 | 分享 Dialog 挂载 `DashboardSchedulePanel`；更新 smoke | 不改后端 schedule API | 功能需求 / 手动 |
| 2 | ISSUE-017 | 降低创建看板调度迷路 | 调度页 CTA + 看板 Tab 空态文案 | 不做 Sheet 选看板（计划可选） | **page-style-sync** + 文案 |
| 3 | ISSUE-020 | 模板/看板调度能力一致 | `SchedulePanel` 开启附件格式 | 不扩新格式 | 功能需求 |
| 4 | ISSUE-019 | 运维改接收人 | 只读摘要 + 引导或 PATCH 编辑 | 不在本 skill 改后端 | 功能需求 |
| 5 | ISSUE-018 | 调度列表可检索 | Toolbar 搜索 | — | **page-style-sync** |
| 6 | ISSUE-023/024/025 |  polish | 表格统一、时区中文、用户 Combobox | — | **page-style-sync** / 手动 |
| 7 | ISSUE-009/013 | 体验增强 | Hub 列表视图 / pinning | IA 大改 | 产品确认 |

**实施 skill 说明**：本 skill **不改 `fe/`**；用户说「按 backlog 修壳层」→ **`/page-style-sync`**。

---

## 对齐计划验收对照

| 计划验收项 | 读码结论 |
|------------|----------|
| 1. 角色+用户+邮箱组合创建，列表可见摘要 | ✅ 模板路径 + 列表列；❌ 看板创建路径未挂载 |
| 2. 列表区分模板/看板/大屏，大屏链接正确 | ✅ `scheduleSourceMeta` + Tab |
| 3. 频率中文、高级 Cron 折叠 | ✅ |
| 4. 壳层密度一致、无工程文案 | ✅ 大体达成；时区/entityTypeCode 仍有工程感 |
| 5. vitest smoke 全绿 | ✅（但 G5 测试与计划意图**相反**——断言无定时报告） |

---

## 相邻 skill 交接

| 发现 | 建议 skill |
|------|------------|
| ISSUE-016 功能断链 | 功能 PR + 手动接线 `DashboardSchedulePanel` |
| ISSUE-017/018/023 壳层 | **`/page-style-sync`** |
| 补 P0 browser 证据 | `browser-reviewer` + `.dev` |
| REAL/STUB 调度执行 | `feature-truth-verify` |
| Token/反模式毕业 | 仓内 `ui-ux-reviewer` |

---

## 上一轮遗留（2026-07-30）

| ID | 本轮状态 |
|----|----------|
| ISSUE-009 | 仍开放（Hub vs ListKit） |
| ISSUE-013 | 部分（6 条预览） |
| ISSUE-015 | ✅ 已修复（placeholder / RPT-005） |

---

## 下一轮

- [ ] browser 走查：分享 Dialog + 调度列表 + 模板调度 Tab（解除 Blind spot，ISSUE-016 可升级定级）
- [ ] 用户：「按 backlog 修 ISSUE-016/017」→ 实施接线 + CTA 修正
- [ ] 用户：「按 backlog 修壳层」→ **`/page-style-sync`**（ISSUE-017/018/023）
