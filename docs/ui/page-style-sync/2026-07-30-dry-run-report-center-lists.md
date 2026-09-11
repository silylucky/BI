# page-style-sync Dry-Run — ReportCenterPage → 列表页

> **模式**：只读审计（Step 1）；**未改码**；**门禁 A 未批准**。  
> **Skill**：`~/.cursor/skills/page-style-sync/`  
> **日期**：2026-07-30

## Intake 摘要（模拟 Step 0）

| # | 项 | 值 |
|---|-----|-----|
| 1 | 模式 | **B** 参考页 → 目标页 |
| 2 | 金标准（用户指定） | `/admin/reports` → `ReportCenterPage` |
| 3 | 目标 | `DatasourceListPage`、`DatasetListPage` |
| 4 | 同步层（假设） | L1 + L3（默认）；L2 待用户勾选 |
| 5 | Out | DashboardEdit*、DataScreenEdit*、Embed*、Chart 画布 |
| 6 | 批次 | batch1 ≤ 2 页 |

## 页面清单

| 路由 | Page 组件 | 页面族 | 路径 |
|------|-----------|--------|------|
| `/admin/reports` | ReportCenterPage | **REV-01 Hub** | `fe/src/pages/admin/reports/ReportCenterPage.tsx` |
| `/admin/datasources` | DatasourceListPage | **REV-03 列表** | `fe/src/pages/admin/datasources/DatasourceListPage.tsx` |
| `/admin/datasets` | DatasetListPage | **REV-03 列表** | `fe/src/pages/admin/datasets/DatasetListPage.tsx` |

## 金标准 Pattern 提取（ReportCenterPage）

| 层 | 现状 |
|----|------|
| L1 | `AdminPageShell` **无** `layout="list"`；title + description；**无** header actions 区 |
| L2 | **无** ListPageSection / ListPageKit；Card 栅格 + QuickLink + section 标题 |
| L3 | 顶层 `PageErrorBanner`；无 DataTable loading/empty |
| L4 | `text-theme-sm`、`gap-3/6`、`Card` + brand 高亮块 |

## 页面族 WARN

**ReportCenterPage（REV-01 Hub）≠ 目标页（REV-03 列表）。**

按 `page-families.md`：

- **L2（ListPageToolbar / DataTable / Pagination）**：**SKIP — 不可强套**
- **L1**：可对齐 title/description 文案风格，但**不应**去掉目标的 `layout="list"`
- **L3**：可对齐 error banner 放置习惯（低风险）
- **L4**：token / spacing 可批量（低风险）

**建议**：若目标是列表壳层 L1–L3，金标准应改为 **`DatasourceListPage`**（或 `PrefabReportsPage`），而非 ReportCenterPage。

## 差距矩阵

| 目标页 | 页面族 | 参考页 | 差距项 | 建议动作 | 风险 | 判定 |
|--------|--------|--------|--------|----------|------|------|
| DatasourceListPage | REV-03 | ReportCenterPage | 已用 `layout="list"` + 全套 ListPageKit；Hub 无对等 L2 | **SKIP L2**；L4 可选对齐 section 间距 token | 低 | **已较完整** |
| DatasourceListPage | REV-03 | ReportCenterPage | L1：description 风格与 Hub 一致（长句说明） | 可选 L1 文案/间距，不改 actions | 低 | 可选 |
| DatasourceListPage | REV-03 | ReportCenterPage | L3：error 在 ListPageSection 内分 delete/list 两路 | 保持现状；勿照搬 Hub 顶层 banner 结构 | 中 | 不强制 |
| DatasetListPage | REV-03 | ReportCenterPage | L2：**缺** Toolbar `SearchField` / filters | 若改：以 **DatasourceListPage** 为标杆补 SearchField | 中 | **需换标杆** |
| DatasetListPage | REV-03 | ReportCenterPage | L3：`DataTable` **无** `loadingRows={5}` | 对齐 DatasourceListPage 加 `loadingRows` | 低 | **需换标杆** |
| DatasetListPage | REV-03 | ReportCenterPage | L3：error banner 在 toolbar 后 `ListPageBody`；Datasource 在 table frame 内 | 统一为 Datasource 模式（table 内 error） | 低 | **需换标杆** |
| DatasetListPage | REV-03 | ReportCenterPage | L2：无筛选结果计数文案 | 可选对齐 Datasource「筛选结果 N 条」 | 低 | 可选 |
| DatasetListPage | REV-03 | ReportCenterPage | L2 SKIP：不可引入 Hub Card 栅格 | 禁止 | 高 | **SKIP** |

## 若坚持 ReportCenterPage 为唯一金标准

| 批次 | 页 | 可执行层 | 动作 |
|------|-----|----------|------|
| — | 两列表页 | L2 | **不执行**（页面族 WARN） |
| batch1（备选） | DatasetListPage | L3 only | `loadingRows={5}` + error 位置（仍建议换标杆） |
| batch1（备选） | 两页 | L4 | token/className 微调 |

## 若采纳推荐标杆（DatasourceListPage → DatasetListPage）

| 批次 | 页 | 层 | 触及文件（预估） | 动作 |
|------|-----|-----|------------------|------|
| **batch1** | DatasetListPage | L2+L3 | `fe/src/pages/admin/datasets/DatasetListPage.tsx` | 补 Toolbar SearchField；`loadingRows={5}`；error 移入 table frame；可选筛选计数 |
| — | DatasourceListPage | — | — | **无改动**（作金标准） |

## Out（本 dry-run 未触及）

- `DashboardEditPage`、`DataScreenEdit*`、`Embed*`
- 表格列、API、RBAC、路由
- `ReportCenterPage` 本身

## 门禁 A — 待用户

请选择其一后回复「**批准 batch1**」或调整 scope：

1. **推荐**：金标准改为 `DatasourceListPage`，仅改 `DatasetListPage`（L2+L3）
2. **保守**：坚持 ReportCenterPage，仅 L4 token 或 L3 微项
3. **取消**：不改码

## 验证计划（批准后 Step 3）

```bash
cd fe && pnpm run check:design
```

若有相关 vitest/smoke，点名运行并读输出。
