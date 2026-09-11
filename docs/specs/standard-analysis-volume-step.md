# 标准分析 · 步长与数据量规格

> 蓝图：`docs/material/blueprints/2026-08-19-standard-analysis-volume-step-blueprint.md`（H1–H4 已确认）

## 问题陈述

标准分析当前默认只抽 100 行明细再内存聚合，时间主题固定按天且趋势/活跃度截断不一致，区域分布无 Top N，结果页无数据口径说明，大表场景易误导用户。

## 方案

- **M1a**：统一查数上限（默认 5000）、分布/生命周期 Top N +「其他」、时间点数上限、`renderSpec.meta` + 前端说明条  
- **M1b**：时间步长跟分析包快照周期（日/周/月）对齐  
- **M2**（范围外）：库内 GROUP BY 全量聚合

## 用户故事

1. 作为分析师，我想在结果页看到区域 Top 20 柱图，以便快速识别重点城市而不被长尾淹没。  
2. 作为分析师，我想看到「基于 N 行样本、按周聚合」的说明，以便判断数据是否可信。  
3. 作为管理员，我设置每周快照后，趋势/活跃度应自动按周展示，以便与对比上期口径一致。

## 可观察验收

| # | 验收 |
|---|------|
| A1 | `POST .../run` 默认 `limit=5000`；`renderSpec.meta.sourceRowCount` 反映实际拉取行数 |
| A2 | 区域分布 >20 维时，结果含「其他」桶且 `meta.topNTruncated=true` |
| A3 | 周快照包的时间主题为周桶，点数 ≤52，取最近周期 |
| A4 | 结果页展示数据说明条（样本行数、步长、Top N 截断） |
| A5 | 无日期列时保存/运行仍被校验拦截（已有） |

## 实现决策

| # | 决策 |
|---|------|
| D1 | 常量：`DISTRIBUTION_TOP_N=20`，`LIFECYCLE_TOP_N=15`，`DEFAULT_QUERY_LIMIT=5000` |
| D2 | 步长 = `pack.snapshotCronPreset`（H1） |
| D3 | `meta` 挂在 `renderSpec.meta`，不破坏 section 契约 |
| D4 | M1 仍为样本聚合，必须在 UI 标明（H3） |
| D5 | 库内聚合留 M2（H4） |

## 测试决策

- 后端：`test_standard_volume_policy.py` — Top N、步长桶、点数 cap、meta 字段  
- 前端：`standardAnalysisDataMeta.test.ts` — 说明条文案  

## 范围外

- 用户手选步长、小时粒度  
- 包级 Top N 配置 UI  
- SQL 侧 GROUP BY（M2）  

## 补充说明

- PRD：RPT-002 companion 建议补「口径说明」「步长与快照一致」  
- 代码锚点：`volume_policy.py` · `theme_aggregate.py` · `StandardAnalysisLiveView.tsx`
