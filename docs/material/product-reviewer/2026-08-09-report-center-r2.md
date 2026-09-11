# 刁钻产品评审 · 报表中心（收官后再评）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-09 |
| 级别 | module |
| 范围 | 报表中心全模块：`/admin/reports/center` · `/admin/reports` · `/admin/reports/view/:id` · `/admin/reports/templates` · `/admin/reports/schedules` · 看板/大屏定时推送 |
| 角色假设 | 业务分析师（`report:read`）；IT 数据管理员（`report:manage`）；运维（关注投递失败） |
| 证据 | 代码走查 + truth audit `2026-08-05` / `2026-08-07-report-center-final-signoff.md` + pytest/vitest 绿；**未真机** |
| 轮次 | r2 |
| 上轮报告 | `docs/material/product-reviewer/2026-07-31-report-center.md` |
| 总分 | **77** / 100（本轮独立评分） |
| 较上轮 Δ | +8（上轮 69，硬门槛封顶） |
| 结论 | **小改后可用**（主链可跑通；叙事分裂与导航碎片化阻碍「统一工作台」心智） |
| 硬门槛 | 无 |

## Review Card

- **主 JTBD**：分析师在统一工作台找到预制/模板、运行并导出；管理员维护文档模板、配置定时生成与多通道投递；运维处理失败执行并重试。
- **成功长什么样**：打开报表中心即知「今天该跑什么、昨天哪封邮件失败了」；配好调度后产物类型诚实、可下载；文档模板与看板定时两条线边界清晰但不互相打脸。
- **最贵失败**：工作台宣称「最终形态」，页面却满屏「后续能力」——用户不敢押生产；或最近访问/收藏点了没反应，信任归零。
- **未真机**：是（未浏览器走查分享 Dialog、邮件附件、Playwright PDF 真渲染）

## 执行摘要（刁钻口吻，短）

- **最锋利的三刺**：① 收官文档写 REAL，UI 仍大面积「后续能力 · 非主路径」（B-13）；② 「统一工作台」口号下导航仍四散入口 + 最近访问只展示不可点（B-14、B-15）；③ 批量导入仍是 JSON 专家路径，缺 dry-run/冲突预检（B-18，收官方案未完全产品化）。
- **唯一值得先修的主线**：**收敛产品叙事 + 工作台闭环**（删掉/改写「后续能力」、最近访问可跳转、侧栏收拢为「报表中心」单入口），再谈模板设计器抛光。
- **不该再加的功能**：更多 Hub 卡片、新导出格式、WYSIWYG——先把已有能力在 UI 上说人话、点得通。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 81 | Hub 聚合调度/失败/预制/模板；`ReportCenterPage` 描述「统一工作台」成立；但模板页自贬「后续能力」削弱价值感 |
| 2 主路径锋利 | 77 | 调度优先 Hub + 失败重试入口通；文档模板默认折叠、预制仍独立 `/admin/reports` 路由，成功路径要记 4 个菜单 |
| 3 例外与逆操作 | 81 | `ScheduleRecentFailuresPanel` 一键重试；调度「复制配置新建」；batch 部分失败回滚；schedule revision API 已存在 |
| 4 角色与权责 | 78 | `report:read`/`report:manage` 分菜单与 Hub 按钮；analyst 可看 Hub 但无 manage 时管理入口隐藏，边界基本诚实 |
| 5 认知与决策点 | 71 | 同一产品内「最终形态」文档 vs「后续能力」Alert 并存；最近访问展示英文 `resourceType`；模板调度 Tab 已有但列表空态仍写「后续能力」 |
| 6 状态与信任 | 76 | 执行历史 `artifactKind` 区分「布局摘要/可视化快照」；placeholder 文案诚实；G5 仍依赖 FE+Playwright，fallback 有标注但创建时未前置说明 |
| 7 可发现与采用 | 75 | 空态与 onboarding 有；首次用户仍要在 center/schedules/prefab/templates 间跳转；模板区需手动展开 |
| 8 可运营与可度量 | 80 | Hub 近期失败队列 + `delivery-health` 预检 + 执行产物下载；仍缺跨租户投递 SLA 视图（可接受 M1） |
| **总分** | **77** | 算术平均 |

## 硬门槛

- [ ] 无命中（B-1 已通过产物类型标注与诚历史史降级，不再 silent 假成功）

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 否 | 否 | 看板定时 PDF 曾为 layout 清单 | （r1）已标注产物类型 | `scheduleArtifactMeta.ts` · `ScheduleHistoryTable.tsx` |
| B-2 | 1 | P1 | 否 | 否 | 模板无数据源时 placeholder | 业务用户仍可能误判「坏了」 | `ReportViewPage.tsx:142-146` · readiness Badge 已部分缓解 |
| B-3 | 3 | P1 | 否 | 否 | 激活后不可 PATCH | （r1）已提供复制新建 | `SchedulePanel.tsx:286-299` |
| B-4 | 8 | P1 | 否 | 否 | SMTP 未配导致投递失败 | （r1）已有健康检查 | `ScheduleDeliveryHealthAlert.tsx` |
| B-5 | 7 | P1 | 否 | 否 | 空库预制未就绪 | onboarding 仍在 | `PrefabReportsEmptyPreview.tsx` |
| B-6 | 5 | P2 | 否 | 是 | Hub 卡片 vs 调度 ListKit 分裂 | 两套列表范式 | `ReportCenterPage.tsx` · `ReportSchedulesPage.tsx` |
| B-7 | 5 | P2 | 否 | 否 | 报表模板 vs 可视化模板分菜单 | 需读指南才懂 | `nav-manifest.tsx` L128-133 |
| B-8 | 8 | P1 | 否 | 否 | 无集中失败队列 | （r1）Hub 失败面板 | `ScheduleRecentFailuresPanel.tsx` · `ReportCenterPage.tsx:199-208` |
| B-9 | 6 | P2 | 否 | 否 | 导出下载无 L1 | （r1）smoke 已补 | `ReportExportCard.smoke.test.tsx` |
| B-10 | 7 | P2 | 否 | 否 | Hub 无法钉选预制 | （r1）已支持 Pin + 服务端收藏 | `useReportCenterPrefs.ts` · `ReportCenterPage.tsx:139-148` |
| B-11 | 4 | P2 | 否 | 否 | 浏览页编辑门控 | （r1）已改 capability | `ReportViewPage.tsx:122-126` |
| B-12 | 7 | P2 | 否 | 否 | 批量 JSON 专家路径 | 迁目录仍像运维脚本 | `BatchImportPanel.tsx` |
| B-13 | 5 | P0 | 否 | 否 | 收官 REAL vs UI「后续能力」 | 「到底能不能上生产？」文档和界面打架 | `ReportTemplatesPage.tsx:282-290` · `ReportSchedulesPage.tsx:54` · `ReportCenterScheduleHub.tsx:148` |
| B-14 | 2 | P1 | 否 | 否 | 最近访问不可点击 | 记了最近却不让回去——像半成品 | `ReportCenterPage.tsx:211-222` |
| B-15 | 2 | P1 | 否 | 否 | 四入口 vs 统一工作台 | 口号是 Hub，导航还是四散 | `nav-manifest.tsx` L128-133 |
| B-16 | 6 | P2 | 否 | 否 | 预制 Pin 双写 local+server | 换设备/清缓存后置顶乱序 | `ReportCenterPage.tsx:139-148` · `reportCenterPrefs.ts` |
| B-17 | 5 | P1 | 否 | 否 | 模板调度 Tab 存在但列表空态写「后续」 | 功能有了文案还在劝退 | `TemplateDetailPanel.tsx:227` vs `ReportSchedulesPage.tsx:54` |
| B-18 | 3 | P1 | 否 | 否 | 批量导入无 dry-run/冲突预检 | 收官方案承诺的向导差最后一截 | `BatchImportPanel.tsx`（仅 upload→preview→import） |
| B-19 | 6 | P2 | 否 | 否 | G5 创建时未说明快照 vs 摘要 | 执行历史诚实但创建时仍只写「PDF」 | `DashboardSchedulePanel.tsx` · `ScheduleFormFields.tsx` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要 | 验证 | 更新于 |
|----|--------|--------|--------|------|----------|----------|------|--------|
| B-1 | P0 | 是→否 | 否 | verified | r2 复核 | 产物类型 Badge + legacy notice | vitest `scheduleArtifactMeta` | 2026-08-09 |
| B-2 | P1 | 否 | 否 | open | — | readiness 有；placeholder 仍在 | pytest template readiness | 2026-08-09 |
| B-3 | P1 | 否 | 否 | verified | r2 复核 | 复制配置新建 | SchedulePanel smoke | 2026-08-09 |
| B-4 | P1 | 否 | 否 | verified | r2 复核 | delivery-health | SchedulePrecheckPanel test | 2026-08-09 |
| B-5 | P1 | 否 | 否 | open | — | 空库仍依赖 seed | prefab smoke | 2026-08-09 |
| B-6 | P2 | 否 | 是 | open | — | — | — | 2026-07-31 |
| B-7 | P2 | 否 | 否 | open | — | — | — | 2026-07-31 |
| B-8 | P1 | 否 | 否 | verified | r2 复核 | Hub 失败面板 | report-center smoke | 2026-08-09 |
| B-9 | P2 | 否 | 否 | verified | r2 复核 | 导出 smoke | vitest | 2026-08-09 |
| B-10 | P2 | 否 | 否 | verified | r2 复核 | 服务端收藏 | center prefs API test | 2026-08-09 |
| B-11 | P2 | 否 | 否 | verified | r2 复核 | capability 门控 | ReportView smoke | 2026-08-09 |
| B-12 | P2 | 否 | 否 | open | — | 向导有，仍 JSON | BatchImport smoke | 2026-08-09 |
| B-13 | P0 | 否 | 否 | verified | 叙事还债 | `reportCenterNav.ts` 两条产品线文案；删「后续能力」 | vitest 47 passed · grep 无残留 | 2026-08-09 |
| B-14 | P1 | 否 | 否 | verified | 工作台闭环 | 最近访问 `Link` + 中文 type + 深链 | report-center smoke | 2026-08-09 |
| B-15 | P1 | 否 | 否 | verified | 导航收拢 | 侧栏仅「报表中心」单入口 | AdminLayout smoke | 2026-08-09 |
| B-16 | P2 | 否 | 否 | verified | 收藏真源 | 仅服务端 `center/preferences` | report-center smoke | 2026-08-09 |
| B-17 | P1 | 否 | 否 | verified | 调度空态 | `DOC_TEMPLATE_SCHEDULE_HINT` 对齐 Tab 能力 | ReportSchedules smoke | 2026-08-09 |
| B-18 | P1 | 否 | 否 | open | r2 新增 | — | — | 2026-08-09 |
| B-19 | P2 | 否 | 否 | open | r2 新增 | — | — | 2026-08-09 |

## 改进建议与方案

### P0

#### B-13 · 统一产品叙事（删掉「后续能力」自贬）

| 项 | 内容 |
|----|------|
| 刺点 | 文档签收 REAL，页面仍 Alert「后续能力 · 非主路径」 |
| 产品改法 | 定义两条**并列产品线**文案：① 看板/大屏「可视化定时 PDF」（主路径）；② 文档模板「固定版式填数导出」（次路径但**已可用**）。删除「后续能力」字样，改为「适用场景」对比表 |
| 第一刀切片 | `ReportTemplatesPage` / `ReportSchedulesPage` 空态与页头改写；模板 Tab 调度空态与 `SchedulePanel` 能力对齐 |
| 证据路径 | `fe/src/pages/admin/reports/ReportTemplatesPage.tsx` · `ReportSchedulesPage.tsx` · `components/ReportCenterScheduleHub.tsx` |
| 不做 | 不宣称 Jasper 级 WYSIWYG |
| 预期提分 | 认知 71→82 |

### P1

#### B-14 · 最近访问可点击闭环

| 项 | 内容 |
|----|------|
| 刺点 | 最近访问只展示 label + 英文 type |
| 产品改法 | 每条映射到路由：`template`→view，`prefab`→binding 深链，`schedule`→schedules expand；type 改中文标签 |
| 第一刀切片 | `ReportCenterPage` 最近列表改 `Link` + `localizeResourceType()` |
| 证据路径 | `fe/src/pages/admin/reports/ReportCenterPage.tsx` · `useReportCenterPrefs.ts` |
| 不做 | 不做跨用户最近 |
| 预期提分 | 主路径 77→82 |

#### B-15 · 导航收拢为「报表中心」单入口

| 项 | 内容 |
|----|------|
| 刺点 | 侧栏 4 项 vs Hub 统一工作台 |
| 产品改法 | 侧栏保留「报表中心」；schedules/templates/prefab 降为 Hub 内二级 Tab 或 Hub 快捷区（管理角色可见） |
| 第一刀切片 | `nav-manifest.tsx` 合并子项为 Hub 锚点；保留深链 redirect |
| 证据路径 | `fe/src/config/nav-manifest.tsx` · `docs/ui/layout.md` |
| 不做 | 不改 RBAC 模型 |
| 预期提分 | 可发现 75→82 |

#### B-17 · 模板调度空态与真实能力对齐

| 项 | 内容 |
|----|------|
| 刺点 | `SchedulePanel` 已挂在模板详情，列表仍写「后续能力」 |
| 产品改法 | 空态 CTA：「前往某模板 → 调度 Tab 创建」带深链；删除「后续能力」 |
| 第一刀切片 | `ReportSchedulesPage.emptyDescription` template 分支改写 + 链到 `templates/:id?tab=schedule` |
| 证据路径 | `ReportSchedulesPage.tsx:51-55` · `TemplateDetailPanel.tsx` |
| 不做 | — |
| 预期提分 | 认知 71→78 |

#### B-18 · 批量导入 dry-run 与冲突预检

| 项 | 内容 |
|----|------|
| 刺点 | 仅 JSON 上传→确认，无冲突预览 |
| 产品改法 | 预览步调用 `POST /batch?dryRun=1`（或等价），展示将创建/跳过/冲突行；确认后再提交 |
| 第一刀切片 | `BatchImportPanel` 增加 preview API 结果表 + 冲突行高亮 |
| 证据路径 | `BatchImportPanel.tsx` · `backend/app/reports/batch/service.py` |
| 不做 | 不做 Excel 粘贴导入 |
| 预期提分 | 例外 81→86 |

### P2

#### B-16 · 收藏单一真源

| 项 | 内容 |
|----|------|
| 产品改法 | 登录态仅以服务端 `center/preferences` 为准；localStorage 仅作离线缓存或删除 |
| 证据路径 | `ReportCenterPage.tsx` · `reportCenterPrefs.ts` |
| 预期提分 | 状态与信任 76→80 |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 验收 |
|------|------|------|------|
| 叙事还债 | 消除「后续能力」与 REAL 文档冲突 | B-13 + B-17 | 新用户 5 分钟内能说出两条产品线区别 |
| 工作台闭环 | Hub 真正成为唯一入口 | B-14 + B-15 | 最近访问可点通；侧栏单入口 |
| 企业化批量 | 批量可运维 | B-18 | dry-run 展示冲突行；pytest 覆盖 |
| 抛光 | 视觉统一 | B-6 → ui-ux-reviewer | 列表范式一致 |

## 明确不改 / 非问题

- G5 Playwright 真渲染依赖部署环境——产品已用 `artifactKind` 诚实标注，不重复判硬门槛
- 纯 Hub 卡片圆角/间距 → `视觉债` 交 ui-ux-reviewer（B-6）
- API 契约假绿 → code-reviewer

## 开放问题（待产品裁定）

1. 文档模板是否升格为与看板定时**并列主路径**（改导航 IA），还是长期次路径仅诚实曝光？
2. analyst 是否需要 `report:manage` 子集（仅能管自己的模板调度）？

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-08-09-report-center-r2.md`
- [x] P0 B-13 文案还债（go-fast 小 PR）
- [x] P1 B-14/B-15 工作台闭环
- [ ] 真机补证 → browser-reviewer（分享 Dialog、邮件附件）
