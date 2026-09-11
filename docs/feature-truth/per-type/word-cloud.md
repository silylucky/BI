# Per-Type Truth: `word-cloud`

| 字段 | 值 |
|------|-----|
| chartType | `word-cloud` |
| 日期 | 2026-08-05 |
| 判定 | **REAL** |
| 专属检查 | 标准 L3/L2/L1 门禁 |

## SOP 清单

| 步 | 项 | 状态 | 证据 |
|----|-----|------|------|
| 1 | DE 槽位审计 | ✅ | `getDeAxisBlueprint("word-cloud")` · `ChartDataSlots.deParity` |
| 2 | L3 输入 | ✅ | `chartFieldSlots.test.ts` T-INSP-DE-golden |
| 3 | L2 编码 | ✅ | `perType/word-cloud.parity.test.ts` · `chartCatalogData.test.ts` |
| 4 | L1 渲染 | ✅ | `charts.smoke.test.tsx` · smoke testId |
| 5 | 样式 Tab | ✅ | `applyChartStyleChain.test.ts` / 族 profile |
| 6 | 过滤链 | ✅ | `chartExecuteProbe.test.ts` GAP-FILTER-CHAIN |
| 7 | BROWSER | ✅ | [`2026-08-05-chart-browser-walkthrough-log.md`](../2026-08-05-chart-browser-walkthrough-log.md) |

## 差距 / 备注

- 无阻塞差距（REAL）
