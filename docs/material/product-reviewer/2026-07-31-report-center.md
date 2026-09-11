# 刁钻产品评审 · 报表中心

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | 报表中心全模块：`/admin/reports/center` · `/admin/reports` · `/admin/reports/view/:id` · `/admin/reports/templates` · `/admin/reports/schedules` · 看板/大屏分享 Dialog 定时报告 |
| 角色假设 | 业务分析师（`report:read`）；IT 数据管理员（`report:manage`） |
| 证据 | 代码走查 + `docs/user-guide/report-center-how-to.md` + `docs/feature-truth/2026-07-31-report-center-full-truth-audit.md` + `docs/ux-critique/2026-07-31-report-center-post-align-backlog.md` |
| 轮次 | r1 |
| 上轮报告 | — |
| 总分 | **69** / 100（硬门槛封顶） |
| 较上轮 Δ | — |
| 结论 | **勿扩功能先还债**（消费侧可用；看板定时投递与附件信任未达业务承诺） |
| 硬门槛 | B-1（看板定时 PDF 附件与产品承诺不一致） |

## Review Card

- **主 JTBD**：分析师在 Hub 找到授权报表/预制分析并运行、导出；管理员维护模板目录、配置定时生成与邮件投递（含看板 PDF 推送）。
- **成功长什么样**：业务用户打开即见真实数据或诚实空态；管理员配好调度后收件人按时收到**可读报表文件**，失败可在列表里定位并重试。
- **最贵失败**：定时任务显示「成功/已投递」，收件人打开却是 widget 清单 PDF 或空示例数据——组织失去对平台的信任。
- **未真机**：是（无 browser 走查；导出下载、邮件真实感、分享 Dialog 长表单滚动未实测）

## 执行摘要（刁钻口吻，短）

- **最锋利的三刺**：① 看板定时报告承诺 PDF，产物却是 layout 文字清单（B-1，硬门槛）；② 模板 Web 运行大量 placeholder，业务用户易误判「系统坏了」（B-2）；③ 调度激活后只能取消重建，真实运维改收件人成本高（B-3）。
- **唯一值得先修的主线**：**G5 看板定时 → 真实可交付附件 + 执行历史诚实标注产物类型**，再谈 SMTP 环境与批量导入。
- **不该再加的功能**：Hub 预制 pinning、更多模板格式、统一导出中心——在附件信任与投递闭环未立住前都是堆菜单。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 79 | Hub/浏览/预制/模板/调度任务包完整，用户指南与 RBAC 清晰；placeholder 与 inventory PDF 拉低业务兑现感 |
| 2 主路径锋利 | 77 | `ReportViewPage` 进入即 auto-run；Hub 卡片→浏览/预制深链通；看板定时需 Hub→看板列表→分享→面板，步数仍多但已接线 |
| 3 例外与逆操作 | 73 | 执行失败可重试、预制 `RPT_PREFAB_ENTITY_NOT_READY` 专态；激活后调度不可 PATCH，只能「取消后重建」 |
| 4 角色与权责 | 80 | `nav-manifest.tsx` `report:read`/`report:manage` 分入口；预制 `allowedRoles`；浏览页「编辑模板」用 admin/analyst 角色而非 capability，边界略糊 |
| 5 认知与决策点 | 75 | 「报表模板」vs 侧栏「可视化模板」需读指南才懂；Hub 卡片区与调度 ListKit 两套视觉语言并存 |
| 6 状态与信任 | 38 | **硬门槛**：`build_dashboard_pdf` 输出 widget inventory 文本 PDF，与用户指南「PDF 定时推送」心智不符；模板 placeholder 文案诚实但仍易误解 |
| 7 可发现与采用 | 78 | 空租户 Hub/ListGhost 空态、预制管理员 onboarding、`report-center-how-to.md`；空库预制仍依赖 seed/物理表 |
| 8 可运营与可度量 | 72 | 调度列表 Tab/搜索/历史/重试到位；无「投递失败」集中队列，SMTP 靠环境变量，批量导入偏 JSON 专家路径 |
| **总分** | **69** | 算术平均 71.4，硬门槛封顶 ≤69 |

## 硬门槛

- [x] **B-1**：看板定时报告执行成功/投递成功，但附件 PDF 为 layout 组件清单而非可视化看板——**成功反馈与业务结果不一致**（`backend/app/dashboard/export_layout.py:65-106` · `docs/user-guide/report-center-how-to.md` L101-109）

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 状态与信任 | P0 | 是 | 否 | 看板定时 PDF 附件为 widget 文字清单 | 「我配了销售看板周报，收件人收到一页 Helvetica 目录？」 | `backend/app/dashboard/export_layout.py` · `backend/app/dashboard/export_jobs.py` · `DashboardSchedulePanel.tsx` |
| B-2 | 任务价值 | P1 | 否 | 否 | 模板 Web 运行常返回 placeholder 表 | 业务用户：「报表中心就是示例数据？」 | `fe/src/pages/admin/reports/ReportViewPage.tsx:131-136` · truth audit T5/T2 |
| B-3 | 例外与逆操作 | P1 | 否 | 否 | 调度激活后表单只读，改接收人须取消重建 | 「改个邮箱要删任务重来，谁设计的？」 | `fe/src/pages/admin/reports/components/SchedulePanel.tsx:199-206` |
| B-4 | 状态与信任 | P1 | 否 | 否 | SMTP 未配/MailHog 未启时投递失败 | 「本地 demo 跑通调度列表，邮件永远失败」 | `backend/app/reports/scheduler/delivery_adapter.py:12-22` · `.env.example` |
| B-5 | 可发现与采用 | P1 | 否 | 否 | 空库预制 run 404/实体未就绪 | 新租户点开预制：「产品半成品？」 | `PrefabReportsPage.tsx` `runEntityNotReady` · `prefab/run.py` · truth audit T3 |
| B-6 | 认知与决策点 | P2 | 否 | 是 | Hub 模板卡片 vs 调度页 ListKit 分裂 | 同一模块两套列表范式，像两个产品拼盘 | `ReportCenterPage.tsx` · `ReportSchedulesPage.tsx` · UX ISSUE-009 |
| B-7 | 认知与决策点 | P2 | 否 | 否 | 「报表模板」与「可视化模板」分属不同菜单 | 管理员：「我到底在哪建看板报表？」 | `docs/user-guide/report-center-how-to.md` L21 · `nav-manifest.tsx` |
| B-8 | 可运营与可度量 | P1 | 否 | 否 | 无跨调度「投递失败」运维视图 | 运维要逐条展开历史找失败，规模化不可运营 | `ReportSchedulesPage.tsx` · `ScheduleListTable.tsx` |
| B-9 | 状态与信任 | P2 | 否 | 否 | 同步导出 companion FE 无下载 L1 校验 | 用户点导出后是否真能下到文件，靠运气 | `ReportExportCard.tsx` · truth audit T10 |
| B-10 | 可发现与采用 | P2 | 否 | 否 | Hub 预制无法钉选常用 | 分析师每天跑同一预制，每次还要搜/进子页 | `ReportCenterPage.tsx` PREFAB_HUB_PREVIEW · UX ISSUE-013 |
| B-11 | 角色与权责 | P2 | 否 | 否 | 浏览页「编辑模板」门控用角色非 capability | analyst 能点编辑但未必有 manage，或反之 | `ReportViewPage.tsx:36-38` |
| B-12 | 可运营与可度量 | P2 | 否 | 否 | 批量导入 JSON 粘贴，失败 rollback 用户难感知 | 大规模迁目录靠手工 JSON，不像企业 BI | `components/BatchImportPanel.tsx` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | done | 诚实标注第一刀 | `artifactKind` + PDF/邮件文案 + FE Alert/Badge | vitest 31/31 · pytest | — | 2026-07-31 |
| B-2 | P1 | 否 | 否 | done | Hub 模板就绪 Badge | `defaultDataSourceId` · `POST /catalog/templates/readiness` · `ReportCenterPage` | vitest + pytest | — | 2026-07-31 |
| B-3 | P1 | 否 | 否 | done | 复制配置新建 | `SchedulePanel.tsx` · `DashboardSchedulePanel.tsx` | vitest 31/31 | — | 2026-07-31 |
| B-4 | P1 | 否 | 否 | done | SMTP 健康检查 | `GET /schedules/delivery-health` · `ScheduleDeliveryHealthAlert.tsx` | pytest + vitest | — | 2026-07-31 |
| B-5 | P1 | 否 | 否 | done | 预制 onboarding | `PrefabReportsEmptyPreview` DEV_REPORT_SEED 步骤 | vitest | — | 2026-07-31 |
| B-6 | P2 | 否 | 是 | open | — | — | — | — | 2026-07-31 |
| B-7 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |
| B-8 | P1 | 否 | 否 | done | 近期失败面板 | `ScheduleRecentFailuresPanel.tsx` | vitest | — | 2026-07-31 |
| B-9 | P2 | 否 | 否 | done | 导出下载 smoke | `ReportExportCard.smoke.test.tsx` | vitest | — | 2026-07-31 |
| B-10 | P2 | 否 | 否 | done | Hub 预制 pinning | `reportCenterPrefs.ts` · Hub Pin 按钮 | vitest | — | 2026-07-31 |
| B-11 | P2 | 否 | 否 | done | 浏览页编辑门控 | `ReportViewPage` 使用 `report:manage` | vitest | — | 2026-07-31 |
| B-12 | P2 | 否 | 否 | open | — | — | — | — | 2026-07-31 |

## 改进建议与方案

### P0

#### B-1 · 看板定时 PDF 须兑现「可读报表」承诺

| 项 | 内容 |
|----|------|
| 刺点 | 定时邮件附件是 widget 清单 PDF，不是看板可视化导出 |
| 产品改法 | 将 G5 产物定义为两档：**MVP 诚实档**（历史/邮件明确标注「布局清单预览，非图表渲染」）与 **交付档**（layout→图表渲染→PDF/截图）；默认用户路径必须进交付档或诚实档二选一，禁止 silent stub |
| 第一刀切片 | 执行历史与邮件主题增加「产物类型：布局清单」Badge；Hub/分享页定时区加一句「当前附件为布局摘要 PDF，图表渲染规划中」——若短期无法渲染，先诚实再还债 |
| 证据路径 | `backend/app/dashboard/export_layout.py` · `export_jobs.py` · `DashboardSchedulePanel.tsx` · `ScheduleHistoryTable.tsx` |
| 不做 | 不引入在线地图/外部 SaaS 渲染；不接 G4 真 Word 排版 |
| 预期提分 | 状态与信任 38→65+（诚实档）或 75+（真渲染） |

### P1

#### B-3 · 激活后调度变更路径

| 项 | 内容 |
|----|------|
| 刺点 | 改接收人/频率只能取消重建 |
| 产品改法 | 产品裁定：若 FSM 不允许 PATCH → 提供「复制为新草稿」一键克隆配置；若允许 → 草稿态可编辑字段白名单（接收人/频率） |
| 第一刀切片 | 只读态增加「复制配置新建」按钮，预填当前 cron/recipients |
| 证据路径 | `SchedulePanel.tsx` · `/api/v1/reports/schedules` PATCH（若新增） |
| 不做 | 不重写整套调度引擎 |
| 预期提分 | 例外 73→80 |

#### B-4 · SMTP/投递环境闭环

| 项 | 内容 |
|----|------|
| 刺点 | 未配 SMTP 时调度「看起来配好了」但永远失败 |
| 产品改法 | 管理端增加「投递通道健康」指示（未配置/可达/上次探测）；创建调度前检查并阻断或降级为「仅生成不投递」 |
| 第一刀切片 | 调度创建页顶部 Alert：SMTP 未配置时禁止激活并链到 `.env` 文档 |
| 证据路径 | `delivery_adapter.py` · `ScheduleFormFields.tsx` · settings 健康 API |
| 不做 | 不做 IM webhook |
| 预期提分 | 可运营 72→78 |

#### B-5 · 空租户预制上路

| 项 | 内容 |
|----|------|
| 刺点 | 无 seed/无 physical 表时预制不可用 |
| 产品改法 | 空态区分「无绑定」与「实体未就绪」；管理员 onboarding 明确 DEV_REPORT_SEED / 样例库一步 |
| 第一刀切片 | `PrefabReportsEmptyPreview` 步骤 2 增加「确认样例库已导入」链到数据源文档 |
| 证据路径 | `PrefabReportsPage.tsx` · `PrefabReportsEmptyPreview.tsx` · `dev_seed.py` |
| 不做 | 不伪造 SQL 结果 |
| 预期提分 | 可发现 78→83 |

#### B-8 · 投递失败运维队列

| 项 | 内容 |
|----|------|
| 刺点 | 失败分散在各调度历史里 |
| 产品改法 | 调度页增加「近期失败」子 Tab 或 Hub 管理员卡片，聚合 failed executions + errorMessage |
| 第一刀切片 | `ReportSchedulesPage` 顶部 Overview 点击跳转筛选 status=failed |
| 证据路径 | `SchedulePageOverview.tsx` · `useReportSchedules.ts` |
| 不做 | 不做全平台告警中心 |
| 预期提分 | 可运营 72→80 |

#### B-2 · 模板 placeholder 与业务价值

| 项 | 内容 |
|----|------|
| 刺点 | 浏览页常显示示例数据 |
| 产品改法 | Hub 卡片标注「需配置数据源」；管理员保存扩展时强制 dataSource 校验门槛 |
| 第一刀切片 | 模板卡片 Badge：`已接数据源` / `示例态` |
| 证据路径 | `ReportCenterPage.tsx` · `engine/execute.py` |
| 不做 | 不在无数据时伪造 KPI |
| 预期提分 | 任务价值 79→85 |

### P2

#### B-6 · Hub 与调度列表视觉统一

| 项 | 内容 |
|----|------|
| 刺点 | 卡片 vs ListKit 分裂 |
| 产品改法 | 视觉债 → 委托 ui-ux-reviewer 出 Hub 模板区 ListKit 化或调度页卡片化方案 |
| 第一刀切片 | 产品确认 IA 后改一屏 |
| 证据路径 | `ReportCenterPage.tsx` · `ReportSchedulesPage.tsx` |
| 不做 | 不改 RBAC |
| 预期提分 | 认知 75→80 |

#### B-10 · 预制常用钉选

| 项 | 内容 |
|----|------|
| 刺点 | 无法固定常用预制 |
| 产品改法 | Hub 预制区支持用户级 pin（localStorage 或 `/users/me/views` 扩展） |
| 第一刀切片 | Hub 预制行加「固定到顶部」 |
| 证据路径 | `ReportCenterPage.tsx` · `defaultViewResolve.ts` |
| 不做 | 不做全站收藏中心 |
| 预期提分 | 可发现 78→82 |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 依赖 | 验收 |
|------|------|------|------|------|
| 还债 | 附件与投递信任 | B-1 诚实标注或真 PDF；B-4 SMTP 健康 | 渲染链或产品裁定 | 手测：定时执行后用户能解释附件是什么；未配 SMTP 不能 silent 激活 |
| 锐化 | 运维与例外 | B-3 复制草稿；B-8 失败聚合 | 还债完成 | 管理员改收件人 ≤2 步；失败任务 1 屏可见 |
| 增长 | 采用与认知 | B-5 空租户；B-10 pinning；B-6 视觉统一 | 锐化 | 新租户 30min 内跑通预制；分析师常用预制 1 点击 |

## 明确不改 / 非问题

- G4 真 Word/PDF 排版、G7 WYSIWYG、G8 统一导出中心——scope 外，不在本模块还债期做。
- ISSUE-016~025 已修复项（分享 Dialog 调度面板、调度搜索、附件格式、时区中文等）——本轮不重复开刺点。
- B-6 纯视觉统一 → ui-ux-reviewer，非 go-fast 产品主线。

## 开放问题（待产品裁定）

1. 看板定时 PDF：**短期诚实标注** vs **必须等 chart 渲染上线**才开放激活？
2. 调度 FSM：**永久取消重建** vs **允许 PATCH 接收人**？
3. Hub 模板区：**保持卡片**（消费友好）还是 **ListKit 统一**（管理友好）？

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-07-31-report-center.md`
- [ ] 仅采纳报告（不改仓）
- [ ] P0 B-1 写入 PRD/plan（create-evolution-prd）
- [ ] B-6 → ui-ux-reviewer
- [ ] 真机补证 → scenario-playbook / browser-reviewer
- [ ] loop-goal-product / go-fast 修复 B-1→B-5
