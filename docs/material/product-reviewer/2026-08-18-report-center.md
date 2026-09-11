# 刁钻产品评审 · 报表中心

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 级别 | module |
| 范围 | 报表中心多入口域：`/admin/reports/*`（工作台、标准分析、配置深链、文档模板、调度与投递） |
| 角色假设 | **主角色**：数据分析师（`report:read`，看数/对比）；**管理角色**：报表管理员（`report:manage`，套版/调度/配置）；**运维**：关注失败与重试 |
| 证据 | 代码走查 + `docs/material/blueprints/2026-08-17-report-center-industry-audit.md` + 近期修复 diff 对照 |
| 轮次 | r1 |
| 上轮报告 | —（独立新评；历史 `2026-08-09-report-center-r3.md` 仅作域背景，**未**锚定分数） |
| 总分 | **79** / 100 |
| 较上轮 Δ | — |
| 结论 | **小改后可用** — 三条产品线 IA 已立住，近期 G4–G7 显著还债；仍欠「命名一致、配置可发现、看板定时主路径指路」三刀，暂不宜宣称可规模化推广 |
| 硬门槛 | 无 |

## Review Card

- **主 JTBD**：业务/数据团队要把「固定口径的分析结果、套版文档、定时 PDF/邮件」稳定产出并运维，而不是在多个菜单里猜哪里配什么。
- **成功长什么样**：分析师打开标准分析能看本期并与上期对比；管理员绑好数据集与快照策略后，投递任务在调度页可管、失败可重试；看板负责人能从分享页建 PDF 定时并在调度页统一看见。
- **最贵失败**：快照与投递概念混淆导致「以为在发邮件其实在抓数」；配置藏在深链新人找不到；投递失败无人知、列表与真实状态不一致。
- **未真机**：是（本轮以代码/文档取证；SMTP 实发、长周期快照 job 未走真机）

## 执行摘要（刁钻口吻，短）

- **最锋利的三刺**：① 侧栏叫「调度与投递」，页头却写「定时报告」；②「标准分析配置」无侧栏入口，全靠记忆或二级按钮；③ 行业主路径「看板分享建 PDF 定时」在工作台卡片里几乎隐身。
- **唯一值得先修的主线**：**统一命名 + 把「配置」与「看板定时」写进可发现面**（侧栏或 Hub 卡片二选一），再谈模板页抛光。
- **不该再加的功能**：不要再加第五个 Hub Tab 或合并单页；多入口 IA 已确认，应补「指路」而非「收口子」。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 83 | 三条产品线（标准分析 / 文档模板 / 看板定时）与域边界在 `reports.md`、蓝图 audit 已对齐，任务不是填表 |
| 2 主路径锋利 | 77 | 标准分析消费路径短（`StandardAnalysisPage` 选包即看）；管理侧配置→投递仍 3 跳且配置无菜单 |
| 3 例外与逆操作 | 78 | 调度失败面板 + 重试（`ScheduleRecentFailuresPanel`）；快照保留期已可配；无上期对比仅页脚一句 |
| 4 角色与权责 | 81 | `report:read` 仅工作台+标准分析；`report:manage` 管模板/调度/配置路由 — 边界清楚 |
| 5 认知与决策点 | 73 | 快照 vs 投递分层文案已改善；「定时报告」vs「调度与投递」打架；配置页名与入口分裂 |
| 6 状态与信任 | 80 | 新建分析包列表即时刷新已修；retention 落库+清理；调度状态 Badge 与 cron 摘要可见 |
| 7 可发现与采用 | 72 | Hub 三卡片不含看板定时；配置深链；viewer 只见 1 张卡片 |
| 8 可运营与可度量 | 85 | 工作台失败摘要 + 调度页分 Tab（看板/标准/模板）+ 执行历史 — 运维面较完整 |
| **总分** | **79** | 算术平均 |

## 硬门槛

均未命中（主任务均有可达页面；无假成功硬证据；关键删除有确认框）。

- [ ] B-*：无

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 认知 | P1 | 否 | 否 | 侧栏「调度与投递」，页面标题「定时报告」 | 用户会骂：「我到底在定时还是在投递？两个词是不是一回事？」 | `fe/src/config/nav-manifest.tsx:149` · `fe/src/pages/admin/reports/ReportSchedulesPage.tsx:229` |
| B-2 | 可发现 | P1 | 否 | 否 | 「标准分析配置」无侧栏项，仅深链 `/admin/reports/standard/config` | 新人：「文档说要绑数据集，菜单在哪？」只能先找到标准分析再点配置 | `fe/src/config/nav-manifest.tsx:129-154` · `fe/src/routes.tsx:218` · `StandardAnalysisPage.tsx:75-78` |
| B-3 | 主路径 | P1 | 否 | 否 | 工作台 Hub 卡片仅标准分析/模板/调度，无「看板定时 PDF」入口或说明 | 蓝图认定主路径在分享页，但 Hub 不指路 → 报表中心像「只有标准分析的家」 | `fe/src/pages/admin/reports/components/ReportCenterHubEntryCards.tsx:76-99` · 蓝图 audit E5 |
| B-4 | 认知 | P2 | 否 | 否 | 对比视图无上期快照时表格空态，仅页脚「暂无上期快照」 | 用户切到「对比」看到空表，以为坏了或没权限 | `fe/src/pages/admin/reports/components/StandardAnalysisResultPanel.tsx:190-223` |
| B-5 | 可发现 | P2 | 否 | 否 | viewer 在工作台只见标准分析一张卡片 | 只读用户不知道还有「看板分享里的报告」这条线（若其有看板权限） | `ReportCenterHubEntryCards.tsx:84-100`（`canManage` 门闸） |
| B-6 | 信任 | P2 | 否 | 否 | 演示 seed 仍可能走物理表绑定，与「数据集为主路径」叙事不完全一致 | 跟文档学配置的人，看到旧包会怀疑「我到底该绑表还是数据集」 | `docs/material/blueprints/2026-08-17-report-center-industry-audit.md` G7 · `StandardAnalysisConfigForm` 文案已强调 Dataset |
| B-7 | 主路径 | P2 | 否 | 否 | 调度页「标准分析」Tab 空态引导回配置页，而非「带 pack 创建调度」一步到位 | 已保存的包还要回配置页找投递区，心智绕路 | `fe/src/pages/admin/reports/ReportSchedulesPage.tsx:66-91` |
| B-8 | 认知 | P2 | 否 | 是 | 文档模板 master-detail 信息密度高，操作（删/移）依赖树节点交互 | 像后台工程工具，不像业务套版工作台 | `fe/src/pages/admin/reports/ReportTemplatesPage.tsx` · `TemplateDetailPanel` |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P1 | 否 | 否 | done | 页头与概览对齐「调度与投递」 | `ReportSchedulesPage.tsx` · `SchedulePageOverview.tsx` · `ReportCenterScheduleHub.tsx` | `pnpm test report-center` · `report-schedules` | — | 2026-08-18 |
| B-2 | P1 | 否 | 否 | wontfix | 配置收归标准分析域，不单独占侧栏 | `nav-manifest.tsx`（移除独立项）· `StandardAnalysisPage` 主按钮 | 侧栏仅四子项；配置从标准分析进入 | 产品裁定：职责不分散 | 2026-08-18 |
| B-3 | P1 | 否 | 否 | done | Hub 主栏看板定时指路卡片 | `ReportCenterDashboardScheduleHint.tsx` · `ReportCenterPage.tsx` | `pnpm test report-center` | — | 2026-08-18 |
| B-4 | P2 | 否 | 否 | open | — | — | — | — | 2026-08-18 |
| B-5 | P2 | 否 | 否 | open | — | — | — | — | 2026-08-18 |
| B-6 | P2 | 否 | 否 | open | — | — | — | — | 2026-08-18 |
| B-7 | P2 | 否 | 否 | open | — | — | — | — | 2026-08-18 |
| B-8 | P2 | 否 | 是 | open | — | — | — | ui-ux-reviewer | 2026-08-18 |

## 改进建议与方案

### P1

#### B-1 · 统一「调度与投递」命名

| 项 | 内容 |
|----|------|
| 刺点 | 导航与页头用词不一致 |
| 产品改法 | 以侧栏「调度与投递」为对外唯一名词；页头、空态、面包屑全部对齐 |
| 第一刀切片 | `ReportSchedulesPage` `title` 改为「调度与投递」；副标题保留「定时生成与邮件投递」 |
| 证据路径 | `fe/src/pages/admin/reports/ReportSchedulesPage.tsx` |
| 不做 | 不改路由、不合并页面 |
| 预期提分 | 认知 73 → 80 |

#### B-2 · 让「标准分析配置」可发现

| 项 | 内容 |
|----|------|
| 刺点 | 管理主任务入口藏在深链 |
| 产品改法 | **二选一**：A) 侧栏在「标准分析」下增加子项「配置」；B) Hub 增加第四张「分析包配置」卡片（仅 manage）。推荐 A，与「消费/配置分离」一致 |
| 第一刀切片 | `nav-manifest` 增加 `标准分析配置` → `/admin/reports/standard/config`，`capability: report:manage` |
| 证据路径 | `fe/src/config/nav-manifest.tsx` · `fe/src/lib/reportCenterNav.ts` |
| 不做 | 不把配置表单塞回标准分析列表页 |
| 预期提分 | 可发现 72 → 80 |

#### B-3 · Hub 明示看板定时主路径

| 项 | 内容 |
|----|------|
| 刺点 | 报表中心像只有标准分析 |
| 产品改法 | 工作台增加「指路」区块（非 CRUD）：「看板/大屏 PDF 定时：请在看板 → 分享 → 定时导出创建；创建后在此调度页统一管理」+ 链到调度 Tab=dashboard |
| 第一刀切片 | `ReportCenterPage` 或 `ReportCenterQuickAside` 增加只读说明 + CTA |
| 证据路径 | `fe/src/pages/admin/reports/ReportCenterPage.tsx` · `components/ReportCenterScheduleHub.tsx` |
| 不做 | 不把看板分享表单搬进报表中心 |
| 预期提分 | 主路径 77 → 83 · 可发现 72 → 78 |

### P2

#### B-4 · 对比模式空态产品化

| 项 | 内容 |
|----|------|
| 刺点 | 无上期快照时用户以为故障 |
| 产品改法 | 对比 Tab 禁用或空态卡片：「需至少两期周期快照，请确认已保存配置且快照 job 已跑」+ 链配置页 |
| 第一刀切片 | `StandardAnalysisResultPanel` 在 `compare` 且无 `previousPeriodKey` 时显示 `PanelEmptyState` |
| 证据路径 | `fe/src/pages/admin/reports/components/StandardAnalysisResultPanel.tsx` |
| 不做 | 不自动伪造对比数据 |
| 预期提分 | 例外 78 → 82 |

#### B-7 · 调度页标准分析 Tab 直达创建

| 项 | 内容 |
|----|------|
| 刺点 | 空态只让回配置 |
| 产品改法 | 空态主按钮「选择分析包创建调度」→ 弹层选 pack → 带 `sourceKey` 打开创建抽屉（与 G5 配置页 CTA 对称） |
| 第一刀切片 | `ReportSchedulesPage` standard tab empty action |
| 证据路径 | `fe/src/pages/admin/reports/ReportSchedulesPage.tsx` · `standardScheduleHubPath()` |
| 不做 | 不在调度页重做完整配置表单 |
| 预期提分 | 主路径 77 → 81 |

#### B-6 · 演示包 Dataset 化

| 项 | 内容 |
|----|------|
| 刺点 | seed 与主叙事不一致 |
| 产品改法 | 官方 demo 分析包改为 `datasetId` 绑定；物理表仅保留迁移说明 |
| 第一刀切片 | `backend` seed / demo 数据一条包 |
| 证据路径 | `backend/app/reports/` seed · `StandardAnalysisConfigForm` |
| 不做 | 不删除物理表兼容 API |
| 预期提分 | 信任 80 → 84 |

#### B-8 · 文档模板页视觉债

| 项 | 内容 |
|----|------|
| 刺点 | master-detail 密度与可发现操作 |
| 产品改法 | 交给 ui-ux-reviewer：树操作外露、详情 Tab 信息架构 |
| 第一刀切片 | — |
| 证据路径 | `ReportTemplatesPage.tsx` |
| 不做 | 本评审不展开视觉方案 |
| 预期提分 | 认知 +2（次要） |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 依赖 | 验收 |
|------|------|------|------|------|
| 还债 | 命名 + 配置可发现 + Hub 指路 | B-1、B-2、B-3 | 无 | 新管理员 5 分钟内能找到配置页并理解看板定时在哪建 |
| 锐化 | 对比空态 + 调度创建闭环 | B-4、B-7 | 还债完成 | 无上期时有明确下一步；调度页可不从配置绕路 |
| 增长 | 演示数据与模板 UX | B-6、B-8 | seed 数据 | demo 包全 Dataset；模板页 ui-ux 毕业 |

## 本轮已改善（不计入 open 刺点，供对照）

| 项 | 状态 | 证据 |
|----|------|------|
| 多入口 IA 恢复 | verified | `nav-manifest.tsx` 四子项 |
| 快照保留 N 期 | verified | migration 0050 · 配置 UI |
| 配置页 → 调度 CTA | verified | `standardScheduleHubPath` · `StandardAnalysisConfigForm` |
| Dataset 主叙事文案 | verified | `StandardAnalysisConfigForm` |
| 模板默认选中/骨架 | verified | `ReportTemplatesPage` `pendingAutoSelect` |
| 新建分析包列表即时出现 | verified | `useStandardPackMutations` `setQueryData` |

## 明确不改 / 非问题

- **不恢复**单入口 Tab 合并页 — 用户已确认多入口为长期 IA（蓝图 audit §5）。
- **不把**看板分享定时表单迁入报表中心 — 与蓝图 E5 一致，只补指路。
- B-8 纯视觉 — 交 ui-ux-reviewer，非 go-fast 产品主线。
- API 契约 / 假绿 — 交 code-reviewer。

## 开放问题（待产品裁定）

1. 「标准分析配置」进侧栏子项，还是 Hub 第四卡片？（推荐侧栏子项，manage 权限）
2. viewer 是否需要在 Hub 看到「看板定时说明」（只读、链到看板列表）？
3. 物理表兼容路径何时标「遗留」并限制新建？

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-08-18-report-center.md`
- [ ] 采纳 P1（B-1～B-3）→ go-fast 或人工
- [ ] B-8 → ui-ux-reviewer
- [ ] 真机 SMTP + 长周期快照 → scenario-playbook
