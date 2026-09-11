# 报表中心模块 — 产品体验待优化 · 2026-07-30

> **Skill**：`~/.cursor/skills/product-experience-critique/`  
> **Persona**：业务分析师 / 报表消费者（`report:read`）；管理员子路径（模板/调度）顺带评审  
> **范围**：`/admin/reports/center` · `/admin/reports` · `/admin/reports/view/:nodeId` · `/admin/reports/templates` · `/admin/reports/schedules`

---

## 第三轮修复 · 2026-07-30

| ID | 状态 | 改动摘要 |
|----|------|----------|
| ISSUE-009 | ✅ | `PrefabReportsPage` 列表对齐 `ListPageSection` + `ListPageToolbar` + 表格 |
| ISSUE-013 | ✅ | Hub 预制区支持「展开全部 (N) / 收起」，链接改「进入预制报表」 |
| ISSUE-015 | ✅ | Hub 搜索 placeholder 去 templateKey；调度页 description 去 RPT-005 |

**残留**：无（本 backlog 条目已全部落地；browser 走查仍为 Blind spot）

---

## 第二轮复评 · 2026-07-30（post-fix）

| 项 | 内容 |
|----|------|
| 触发 | 用户「修复问题」后复跑 critique；范围沿用首轮 |
| 综合分 | **7.0 / 10 (+0.5)**（**capped ≤7.0**；未加权 raw **7.9**） |
| P0 / P1 / P2 / P3 | 0 / 0 / 1 / 2 |
| Blind spots | 仍无 `.dev` + browser；导出下载、占位数据真实感未实测 |
| 评审方式 | 读码验证首轮 12 项修复 + 残留项扫描 |

一句话：消费侧「内部工具感」已明显收敛——命名、导出、预制效率、状态中文均到位；**壳层不一致（ISSUE-009）** 与少量工程文案是主要残留。

### 维度得分（第二轮）

| 维度 | 权重 | 得分 | Δ | 一句话 |
|------|------|------|---|--------|
| 任务可完成度 | 20% | 9 | +1 | 浏览页导出免 UUID；默认报表有 loading/兜底（ISSUE-004/008 ✅） |
| 操作效率 | 15% | 8 | +2 | 预制搜索、单行运行禁用、Hub 预览 6 条（ISSUE-003/005/013 部分 ✅） |
| 按钮与布局 | 15% | 8 | +2 | 导出后置、预制/浏览页返回链（ISSUE-006/014 ✅） |
| 视觉与舒适度 | 15% | 8 | +1 | 卡片副标题改格式标签；Hub 搜索 placeholder 仍含 templateKey（ISSUE-015） |
| 反馈与容错 | 15% | 8 | +2 | 占位分层文案；调度/执行 status 中文化（ISSUE-007/012 ✅） |
| 信息架构与文案 | 10% | 8 | +3 | 页标题「全部报表」对齐侧栏；调度页仍含 RPT-005（ISSUE-015） |
| 一致性与可预期 | 10% | 7 | +1 | 「打开并运行」对齐 auto-run；Hub/预制 vs 调度 ListKit 仍分裂（ISSUE-009） |

**加权 raw**：7.9 → **cap 7.0**

### 已修复（首轮 ISSUE）

| ID | 状态 | 验证锚点 |
|----|------|----------|
| ISSUE-001 | ✅ | `ReportCenterPage.tsx` title=`全部报表` |
| ISSUE-002 | ✅ | 用户向 description，无 DataEase |
| ISSUE-003 | ✅ | `PrefabReportsPage` SearchField + 加高 ScrollArea |
| ISSUE-004 | ✅ | `ReportExportCard` 消费侧隐藏 UUID；浏览页 `defaultTemplateId` |
| ISSUE-005 | ✅ | `disabled={runningKey === binding.bindingKey}` |
| ISSUE-006 | ✅ | 导出 Card 在运行结果之后 |
| ISSUE-007 | ✅ | 分析师/管理员占位文案分层 |
| ISSUE-008 | ✅ | 默认报表 Skeleton + 未同步兜底 Card |
| ISSUE-010 | ✅ | Hub 按钮「打开并运行」 |
| ISSUE-011 | ✅ | 副标题 `PDF/Word/Excel 报表` |
| ISSUE-012 | ✅ | `localizeScheduleStatus` / `localizeExecutionStatus` |
| ISSUE-014 | ✅ | 预制页「返回全部报表」 |

### 残留问题清单

| ID | 严重度 | 维度 | 用户场景 | 问题描述 | 建议优化 | 证据 | 置信度 |
|----|--------|------|----------|----------|----------|------|--------|
| ISSUE-009 | P2 | 一致 | 管理员跨页维护 | 「调度是 ListKit 列表，Hub/预制还是卡片堆，切换时像两个产品」 | 预制列表对齐 `ListPageKit` Toolbar（`page-style-sync` 批次） | `ReportSchedulesPage` ListPageKit vs `PrefabReportsPage` Card | 中 |
| ISSUE-013 | P3 | 效率 | Hub 找常用预制 | 「预览从 4 条加到 6 条了，但还不能钉选常用」 | 常用 pinning 或「显示全部」内联展开 | `ReportCenterPage.tsx` `slice(0, 6)` | 中 |
| ISSUE-015 | P3 | 文案 | 业务用户读搜索/调度说明 | 「搜索框 placeholder 写 templateKey；调度页描述带 RPT-005」 | placeholder 改「报表名称」；调度 description 去内部编号 | `ReportCenterPage.tsx:281` · `ReportSchedulesPage.tsx:236` | 高 |

### 待优化 backlog（第二轮）

| 优先级 | ISSUE | 用户价值 | 建议改什么 |
|--------|-------|----------|------------|
| 1 | ISSUE-015 | 降低工程术语暴露 | 两处文案中文化 |
| 2 | ISSUE-009 | 管理端壳层一致 | 交 `page-style-sync`（预制列表） |
| 3 | ISSUE-013 | Hub 快捷触达 | 产品确认后再做 pinning |

### 下一轮

- [ ] browser 走查解除 Blind spot，raw 分有望 >7.0
- [ ] ISSUE-009 单独立项 `page-style-sync`
- [ ] ISSUE-015 可随下一批文案小修一并落地

---

## 第一轮 · 2026-07-30（baseline，已归档）

| 项 | 内容 |
|----|------|
| 综合分 | **6.5 / 10**（capped ≤7.0） |
| P0 / P1 / P2 / P3 | 0 / 0 / 12 / 2 |

一句话：主路径工程闭环，但消费侧像内部工具——导航命名、导出 UUID、英文 status 是主痛点。

<details>
<summary>首轮完整 ISSUE 表（12 项已修复，点击展开）</summary>

| ID | 严重度 | 摘要 | 第二轮状态 |
|----|--------|------|------------|
| ISSUE-001 | P2 | 全部报表 vs 报表中心命名 | ✅ |
| ISSUE-002 | P2 | DataEase 对内描述 | ✅ |
| ISSUE-003 | P2 | 预制无搜索 | ✅ |
| ISSUE-004 | P2 | 导出要填 UUID | ✅ |
| ISSUE-005 | P2 | 运行按钮全禁用 | ✅ |
| ISSUE-006 | P2 | 导出顺序 | ✅ |
| ISSUE-007 | P2 | 占位文案 | ✅ |
| ISSUE-008 | P2 | 默认报表静默 | ✅ |
| ISSUE-009 | P2 | ListKit 壳不一致 | 未修复 |
| ISSUE-010 | P2 | 查看 vs auto-run | ✅ |
| ISSUE-011 | P2 | 卡片 templateKey | ✅ |
| ISSUE-012 | P2 | status 英文 | ✅ |
| ISSUE-013 | P3 | Hub 只显 4 条预制 | 部分（→6） |
| ISSUE-014 | P3 | 预制无返回 | ✅ |

</details>

## 相邻 skill 交接

| 发现 | 建议 skill |
|------|------------|
| 功能 REAL 复验 | `feature-truth-verify` |
| ISSUE-009 壳层 | `page-style-sync` |
| 补 browser 证据 | `browser-reviewer` + `.dev` |
| admin 反模式 | 仓内 `ui-ux-reviewer` |
