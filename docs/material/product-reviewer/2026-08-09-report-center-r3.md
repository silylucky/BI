# 刁钻产品评审 · 报表中心（叙事还债后再评）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-09 |
| 级别 | module |
| 范围 | 报表中心全模块：`/admin/reports/center` · `/admin/reports` · `/admin/reports/view/:id` · `/admin/reports/templates` · `/admin/reports/schedules` · 看板/大屏定时推送 |
| 角色假设 | 业务分析师（`report:read`）；IT 数据管理员（`report:manage`）；运维（关注投递失败） |
| 证据 | 代码走查 + 已确认蓝图 `2026-08-09-report-center.md` + vitest 47 passed；**未真机** |
| 轮次 | **r3** |
| 上轮报告 | `docs/material/product-reviewer/2026-08-09-report-center-r2.md` |
| 总分 | **80** / 100（本轮独立评分） |
| 较上轮 Δ | +3（r2 为 77） |
| 结论 | **可用**（主链叙事与 Hub 闭环已成立；r3 开放项 B-2/5/7/12 已 verified；B-6 视觉债 wontfix） |
| 硬门槛 | 无 |

## Review Card

- **主 JTBD**：分析师在统一工作台找到预制/模板、运行并导出；管理员维护文档模板、配置定时生成与多通道投递；运维处理失败执行并重试。
- **成功长什么样**：侧栏只进「报表中心」即可运维定时失败、点最近访问回到上下文；两条产品线（看板定时 vs 文档套版）一眼可分；产物类型诚实。
- **最贵失败**：能点重试却 403；或文档仍写「后续能力」而 UI 已宣称可用——信任再次分裂。
- **未真机**：是（未浏览器走查分享 Dialog、邮件附件、Playwright 真 PDF）

## 执行摘要（刁钻口吻，短）

- **最锋利的两刺**：① Hub「近期失败」对**所有**登录用户展示重试按钮，但 API 要求 `report:manage` 或 `dashboard:schedule`+owner（B-20）；② `docs/services/reports.md` / `layout.md` / 演示手册仍写「后续能力」与四入口，与已确认蓝图和 UI **打架**（B-21）。
- **本轮明显变好**：B-13～B-17 在 `fe/` 已 verified；侧栏单入口、最近访问 `Link`+中文类型、`reportCenterNav.ts` 双线文案；grep `fe/src` 无「后续能力」。
- **唯一值得先修的主线**：**权限诚实（Hub 重试门控）+ 文档债 sync**；批量 dry-run（B-18）可跟 go-fast 小 PR。
- **不该再加的功能**：Hub 再加卡片、新导出格式——先把文档与按钮说真话。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 85 | Hub 描述「统一工作台」与双线产品线（`reportCenterNav.ts`）一致；定时/失败/预制/模板聚合成立 |
| 2 主路径锋利 | 83 | 侧栏仅 `nav-manifest`「报表中心」；深链 schedules/templates 保留；最近访问可点通（smoke） |
| 3 例外与逆操作 | 80 | 失败重试链通；batch 仍无 dry-run（B-18）；复制配置新建仍在 |
| 4 角色与权责 | 75 | Hub 重试未按 `canManage`/`dashboard:schedule` 门控（B-20）；viewer 仍可读全域 schedule（已知） |
| 5 认知与决策点 | 79 | UI 叙事已统一；`docs/services/reports.md` L38-47 仍「后续能力」；模板折叠区副标题仍写「非当前默认主路径」 |
| 6 状态与信任 | 78 | `artifactKind` 诚实；Hub 重试假入口风险；G5 创建态未前置说明（B-19） |
| 7 可发现与采用 | 81 | 单入口降低迷路；manage 用户页头有定时/模板快捷链；文档模板默认折叠但可展开 |
| 8 可运营与可度量 | 82 | 近期失败 API + delivery-health + 执行历史下载；M1 无 SLA 大盘可接受 |
| **总分** | **80** | 算术平均 |

## 硬门槛

- [ ] 无命中

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 6 | P0 | 否 | 否 | 看板定时 PDF 曾为 layout 清单 | （r1）已标注产物类型 | `scheduleArtifactMeta.ts` · `ScheduleHistoryTable.tsx` |
| B-2 | 1 | P1 | 否 | 否 | 模板无数据源时 placeholder | 业务用户仍可能误判「坏了」 | `ReportViewPage.tsx` · readiness Badge |
| B-3 | 3 | P1 | 否 | 否 | 激活后不可 PATCH | （r1）已提供复制新建 | `SchedulePanel.tsx` |
| B-4 | 8 | P1 | 否 | 否 | SMTP 未配导致投递失败 | （r1）已有健康检查 | `ScheduleDeliveryHealthAlert.tsx` |
| B-5 | 7 | P1 | 否 | 否 | 空库预制未就绪 | onboarding 仍在 | `PrefabReportsEmptyPreview.tsx` |
| B-6 | 5 | P2 | 否 | 是 | Hub 卡片 vs 调度 ListKit 分裂 | 两套列表范式 | `ReportCenterPage.tsx` · `ReportSchedulesPage.tsx` |
| B-7 | 5 | P2 | 否 | 否 | 报表模板 vs 可视化模板分菜单 | viz-templates 仍独立域 | `nav-manifest.tsx` · `docs/ui/layout.md` |
| B-8 | 8 | P1 | 否 | 否 | 无集中失败队列 | （r1）Hub 失败面板 | `ScheduleRecentFailuresPanel.tsx` |
| B-9 | 6 | P2 | 否 | 否 | 导出下载无 L1 | （r1）smoke 已补 | `ReportExportCard.smoke.test.tsx` |
| B-10 | 7 | P2 | 否 | 否 | Hub 无法钉选预制 | （r1）已支持 Pin | `useReportCenterPrefs.ts` |
| B-11 | 4 | P2 | 否 | 否 | 浏览页编辑门控 | （r1）已改 capability | `ReportViewPage.tsx` |
| B-12 | 7 | P2 | 否 | 否 | 批量 JSON 专家路径 | 迁目录仍像运维脚本 | `BatchImportPanel.tsx` |
| B-13 | 5 | P0 | 否 | 否 | 收官 REAL vs UI「后续能力」 | （r2）UI 已还债 | `reportCenterNav.ts` · grep `fe/src` 无残留 |
| B-14 | 2 | P1 | 否 | 否 | 最近访问不可点击 | （r2）已 Link+深链 | `ReportCenterPage.tsx:213-223` · smoke |
| B-15 | 2 | P1 | 否 | 否 | 四入口 vs 统一工作台 | （r2）侧栏单入口 | `nav-manifest.tsx` L121-130 |
| B-16 | 6 | P2 | 否 | 否 | 预制 Pin 双写 | （r2）仅服务端 prefs | `ReportCenterPage.tsx` |
| B-17 | 5 | P1 | 否 | 否 | 模板调度空态写「后续」 | （r2）`DOC_TEMPLATE_SCHEDULE_HINT` | `ReportSchedulesPage.tsx` |
| B-18 | 3 | P1 | 否 | 否 | 批量导入无 dry-run | 蓝图 A1/S6 open | `BatchImportPanel.tsx` · `batch/service.py` |
| B-19 | 6 | P2 | 否 | 否 | G5 创建时未说明快照 vs 摘要 | 历史诚实但创建时只写 PDF | `DashboardSchedulePanel.tsx` |
| B-20 | 4 | P1 | 否 | 否 | Hub 重试未门控 | `report:read` 看见重试却可能 403 | `ReportCenterPage.tsx:195-205` · `scheduler/acl.py` `assert_schedule_write` |
| B-21 | 5 | P1 | 否 | 否 | 域文档/手册仍「后续能力」 | UI 说可用、文档说非主路径 | `docs/services/reports.md` L38-47 · `docs/ui/layout.md` L130-136 · `vitalspan-internal-demo-handbook.md` L323 |
| B-22 | 5 | P2 | 否 | 否 | 模板折叠区副标题自贬 | 「非当前默认定时报告主路径」仍劝退 | `ReportCenterPage.tsx:250-252` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要 | 验证 | 更新于 |
|----|--------|--------|--------|------|----------|----------|------|--------|
| B-1 | P0 | 是→否 | 否 | verified | r3 复核 | 产物类型 Badge | vitest | 2026-08-09 |
| B-2 | P1 | 否 | 否 | verified | placeholder Alert | readiness Badge + 示例态 Alert + 编辑链 | ReportView smoke | 2026-08-09 |
| B-3 | P1 | 否 | 否 | verified | r3 复核 | 复制配置新建 | SchedulePanel smoke | 2026-08-09 |
| B-4 | P1 | 否 | 否 | verified | r3 复核 | delivery-health | PrecheckPanel test | 2026-08-09 |
| B-5 | P1 | 否 | 否 | verified | 空态回链 | PrefabReportsEmptyPreview 返回报表中心 | prefab empty action | 2026-08-09 |
| B-6 | P2 | 否 | 是 | wontfix | 视觉债 | Hub 卡片 vs ListKit 分裂交 ui-ux-reviewer | — | 2026-08-09 |
| B-7 | P2 | 否 | 否 | verified | 双线说明 | `VIZ_VS_DOC_TEMPLATE_HINT` on ReportTemplatesPage | ReportTemplatesPage | 2026-08-09 |
| B-8 | P1 | 否 | 否 | verified | r3 复核 | Hub 失败面板 | report-center smoke | 2026-08-09 |
| B-9 | P2 | 否 | 否 | verified | r3 复核 | 导出 smoke | vitest | 2026-08-09 |
| B-10 | P2 | 否 | 否 | verified | r3 复核 | 服务端收藏 | center prefs | 2026-08-09 |
| B-11 | P2 | 否 | 否 | verified | r3 复核 | capability 门控 | ReportView smoke | 2026-08-09 |
| B-12 | P2 | 否 | 否 | verified | dry-run 向导 | JSON 上传 + 预检冲突高亮 | BatchImport smoke + pytest | 2026-08-09 |
| B-13 | P0 | 否 | 否 | verified | r3 复核 | UI 无「后续能力」 | grep + vitest 47 | 2026-08-09 |
| B-14 | P1 | 否 | 否 | verified | r3 复核 | Link+中文 type | report-center smoke | 2026-08-09 |
| B-15 | P1 | 否 | 否 | verified | r3 复核 | 侧栏单入口 | nav-manifest + AdminLayout smoke | 2026-08-09 |
| B-16 | P2 | 否 | 否 | verified | r3 复核 | 服务端真源 | report-center smoke | 2026-08-09 |
| B-17 | P1 | 否 | 否 | verified | r3 复核 | 调度空态对齐 | ReportSchedules smoke | 2026-08-09 |
| B-18 | P1 | 否 | 否 | verified | dry-run | `POST /batch/dry-run` + BatchImportPanel 预检表 | pytest + vitest 3/3 | 2026-08-09 |
| B-19 | P2 | 否 | 否 | verified | G5 创建说明 | `VISUAL_SNAPSHOT_CREATE_NOTICE` in ScheduleFormFields | ScheduleFormFields | 2026-08-09 |
| B-20 | P1 | 否 | 否 | verified | Hub 重试门控 | `canRetrySchedules` 条件传 `onRetry` | report-center-retry-gate smoke | 2026-08-09 |
| B-21 | P1 | 否 | 否 | verified | 文档 sync | reports.md · layout.md · handbook | grep docs 无后续能力 | 2026-08-09 |
| B-22 | P2 | 否 | 否 | verified | 折叠副标题 | `DOC_TEMPLATE_PRODUCT_LINE` | ReportCenterPage | 2026-08-09 |

## 改进建议与方案

### P1

#### B-20 · Hub 重试按钮与 API 门控对齐

| 项 | 内容 |
|----|------|
| 刺点 | `ScheduleRecentFailuresPanel` 在 Hub 对全员展示「重试」，但 `assert_schedule_write` 要求 manage 或 dashboard:schedule+owner |
| 产品改法 | 仅 `canManage` 或具备 `dashboard:schedule` 且为来源看板 owner 时展示重试；只读用户仅「查看调度」 |
| 第一刀切片 | `ReportCenterPage` 按 capability 条件传入 `onRetry` |
| 证据路径 | `fe/src/pages/admin/reports/ReportCenterPage.tsx` · `ScheduleRecentFailuresPanel.tsx` |
| 不做 | 不改后端 ACL 模型 |
| 预期提分 | 权责 75→82 · 信任 78→82 |

#### B-21 · 文档债 sync（双线叙事）

| 项 | 内容 |
|----|------|
| 刺点 | `docs/services/reports.md` 仍四入口 +「后续能力」；演示手册 L323 同 |
| 产品改法 | 与已确认蓝图对齐：侧栏单入口、两条产品线并列、深链表 |
| 第一刀切片 | 改 `reports.md` §前端消费 IA + `layout.md` §报表导航 + handbook 一句 |
| 证据路径 | `docs/services/reports.md` · `docs/ui/layout.md` · `docs/user-guide/vitalspan-internal-demo-handbook.md` |
| 不做 | 不改 PRD 除非点名 |
| 预期提分 | 认知 79→85 |

#### B-18 · 批量 dry-run（继承 r2）

| 项 | 内容 |
|----|------|
| 产品改法 | `POST /batch?dryRun=1` 预览冲突行 |
| 第一刀切片 | `BatchImportPanel` 预览步调 dry-run API |
| 证据路径 | `BatchImportPanel.tsx` · `backend/app/reports/batch/service.py` |
| 预期提分 | 例外 80→85 |

### P2

#### B-22 · 模板折叠区副标题

| 项 | 内容 |
|----|------|
| 产品改法 | 副标题改用 `DOC_TEMPLATE_PRODUCT_LINE` 或「适用固定版式月报/台账」 |
| 证据路径 | `ReportCenterPage.tsx:250-252` |
| 预期提分 | 认知 79→82 |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 验收 |
|------|------|------|------|
| 权限诚实 | 消除假入口 | B-20 | report:read 无重试按钮；manage 可重试 |
| 文档对齐 | UI 与 docs 一致 | B-21 + B-22 | grep docs 无「后续能力」 |
| 企业化批量 | dry-run | B-18 | pytest + 冲突行 UI |
| 抛光 | 视觉统一 | B-6 | ui-ux-reviewer |

## 明确不改 / 非问题

- G5 Playwright 真渲染环境依赖——`artifactKind` 已诚实，不重复硬门槛
- B-6 纯视觉 → ui-ux-reviewer
- viewer 全域读 schedule——分期 ACL 收紧，非本轮 P0

## 开放问题（待产品裁定）

1. 文档模板是否升格并列主路径（蓝图 H1 已确认：次路径但可用）
2. analyst `report:manage` 子集（蓝图 H3）

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-08-09-report-center-r3.md`
- [x] P1 B-20 重试门控（go-fast 小 PR）
- [x] P1 B-21 文档 sync（docs-only PR）
- [x] P1 B-18 dry-run（后端+FE 切片）
- [ ] 真机 → browser-reviewer
