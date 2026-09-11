# Feature Truth Audit: DataEase 风格图表出数链路（encoding + chart_sql）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-13 |
| 核验范围 | 计划 `de-style_chart_query`：WHERE→GROUP BY→LIMIT、encoding 请求、FE 发 encoding、文档 |
| 锚点 | `POST /api/v1/query/dataset/execute` · `chart_sql.py` · `chartExecuteProbe.ts` |
| 总体判定 | **PARTIAL**（P0 单测已闭合；仍缺 BROWSER） |
| **总分 / 档位** | **7.5/10 · B** |
| 状态 | approved-fix |
| **sampling** | `full`（计划 4 todo 全量，非 44 chartType） |

## 1. 核验标准与预期（来自计划）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 有 `encoding` 时 SQL 顺序：WHERE（汇总前）→ GROUP BY/聚合 → LIMIT（汇总后行数） | 计划 §查询形态 |
| T2 | 明细表 `table-info/table/table-normal`：WHERE + 最新 N 条，无 GROUP BY | 计划 §查询形态 |
| T3 | 无 `encoding` 时仍走旧 `translate_from_config_record`，不破兼容 | 计划 §后端-1 |
| T4 | FE `fetchChartExecuteResult` 发 `encoding`；不发无效 `filter_*` | 计划 §前端 |
| T5 | 折柱拒画阈值与 `queryLimit` 对齐 | 计划 §前端 |
| T6 | 文档 query/api/PRD 同步 | 计划 §文档 |
| T7 | 单测覆盖计划列出的 5+ 场景 | 计划 §单测 |

- **非目标（计划明确不做）**：Dataset 行范围、指标汇总下拉、看板查询组件外层 WHERE 重写。

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 计划交付项 T1–T7 | 7 | 0 | 7 | `de-style_chart_query_65dd61bc.plan.md` |
| 计划单测用例 | 6 | 0 | 6 | 计划 §单测 + KPI 补充 |
| FE 关键控件 | 4 | 0 | 4 | 过滤器三件套 + 结果条数 |

## 2. 完整链路图

```
ChartConfigPanel 过滤器/维指
  → buildChartExecuteEncoding (chartExecuteProbe.ts)
  → POST /query/dataset/execute { encoding, limit, parameters }
  → execute_dataset_from_config (encoding? chart_sql : translate)
  → QueryExecutor → rows
  → ChartRenderer 出图
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 组包 | 通 | `chartExecuteProbe.test.ts` 12 passed | 含 `encoding.filters` |
| 2 | API schema | 通 | `dataset/schemas.py` `encoding` 字段 | Pydantic 校验 |
| 3 | SQL 生成 | 通 | `test_dataset_chart_sql.py` 6 passed | 单元级 CHAIN |
| 4 | execute 接线 | 通（静态） | `execute_config.py:72` | 无 encoding 分支集成测缺失 |
| 5 | 真库执行+图表数值 | **未验** | 无 BROWSER/E2E | 过滤器是否改变出图未 L1 对比 |
| 6 | 报表/全局筛选路径 | **旧路径** | `reports/engine/execute.py` 无 encoding | 计划允许，非本 scope 缺陷 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 聚合图表 SQL 顺序 | PARTIAL | 7/B | `test_filter_lte_before_group_by` WHERE<GROUP BY |
| T2 | 明细表路径 | PARTIAL | 7/B | `test_detail_table_no_group_by` |
| T3 | 无 encoding 兼容 | PARTIAL | 7/B | `test_execute_without_encoding_uses_translate_not_chart_sql` |
| T4 | FE encoding 请求 | PARTIAL | 7/B | vitest 断言 body.encoding |
| T5 | queryLimit 拒画 | PARTIAL | 7/B | `cartesianRowLimit.test.ts` |
| T6 | 文档 | PARTIAL | 8/B | query.md / api README / F05 / F06 已写 |
| T7 | 单测清单 | PARTIAL | 8/B | 10 项 pytest + 19 vitest |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 过滤器·字段 | `ChartConfigPanel` FieldSelect | 编入 encoding.filters.field | 静态：写入 config.filters | 1 | 0 | — | — | — | 3 | STUB | 无 UI 测 |
| B2 | 过滤器·运算符 | Select operator | 编入 encoding.filters.operator | 静态存在 | 1 | 0 | — | — | — | 3 | STUB | 无 UI 测 |
| B3 | 过滤器·值 | value input | 过滤后行数/图变化 | **未验** | 0 | 0 | — | — | — | 2 | UNVERIFIED | 无 BROWSER |
| B4 | 结果展示 100/500/1000 | `ChartDataOptions` | limit 传入 execute | 静态接线 `resolveChartQueryLimit` | 1 | 0 | — | — | — | 3 | STUB | 无动态验 |
| B5 | 汇总前过滤文案 | `ChartConfigPanel` | 展示提示 | 已加文案 | 2 | 2 | — | — | 2 | 8 | PARTIAL | 仅文案，非行为 |

功能块映射：T4 → B1–B3；T5 → B4；T1 → B3（正确性依赖 B3）。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| M1 filter lte + GROUP BY | 单测 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_filter_lte_before_group_by` |
| M2 line SUM+LIMIT | 单测 | — | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | SQL 串断言，未验执行结果 |
| M3 detail no GROUP BY | 单测 | — | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | |
| M4 invalid field 422 | 单测 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | |
| M5 invalid operator 422 | 单测 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | |
| M6 KPI SUM | 单测 | — | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | |
| M7 no encoding legacy | 单测 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_execute_without_encoding_*` |
| M8 timeRange BETWEEN | 单测 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_time_range_between_before_group_by` |
| M9 FE encoding body | vitest | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 含 timeRange |
| M10 过滤器到达 executor | 集成 | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `test_execute_filter_encoding_reaches_executor_sql` |
| M11 docs 四份 | 静态 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | grep 已更新 |
| M12 queryLimit 拒画 | vitest | — | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `cartesianRowLimit.test.ts` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 12 |
| GATE only | 1 |
| CHAIN | 11 |
| UI / BROWSER | 0 |
| NONE（未验） | 0 |
| REAL 达标 | 0/12 |
| **逐一校验** | **否** — CHAIN 11/12；仍缺 BROWSER 真机验过滤器改图 |
| 总体可否 REAL | **否**（无 BROWSER） |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 1 | 1 | 1 | 6 | C | PARTIAL | SQL 对，未真库对比数值 |
| T3 | 1 | 0 | — | — | — | 4 | D | STUB | 缺单测 |
| T4 | 2 | 1 | — | — | 1 | 6 | C | PARTIAL | 请求对，未验后端吃到 |
| **总体** | — | — | — | — | — | **6.5** | **C** | **PARTIAL** | 实现大部完成，truth 未闭合 |

**打通但不对**：0（未验到「不对」）  
**假功能/未验**：M7、M8、M10

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `pytest tests/test_dataset_chart_sql.py` | 6 passed | 6 passed | ✅ | 2026-08-13 运行 |
| 2 | `vitest chartExecuteProbe.test.ts` | 12 passed | 12 passed | ✅ | 2026-08-13 运行 |
| 3 | 看板加 filter amount≤100 后折线数值变化 | 汇总前过滤生效 | **未执行** | ❌ | 无 BROWSER |

## 5. 修复文档（P0/P1）

### M7 — 无 encoding 兼容路径

**判定**：STUB 4/10  
**期望 vs 实际**：计划要求单测「无 encoding 旧 SELECT 仍可用」；实际 `execute_config` 有 else 分支但无测试。  
**根因**：`tests/test_dataset_chart_sql.py` 未覆盖 execute 层；`test_dataset_pandas_transform.py` 仍 mock 无 encoding。  
**修复方向**：补 `test_execute_config_without_encoding_uses_translate`（mock record + 断言未调 chart_sql）。  
**修后验收**：M7 CHAIN，C≥2。

### M8 — timeRange SQL

**判定**：STUB  
**期望 vs 实际**：计划要求 `field BETWEEN start AND end`；代码在 `_time_range_sql`，FE `buildChartTimeRangeEncoding` 已发 encoding.timeRange，**无单测**。  
**修复方向**：`test_time_range_between_in_where` + vitest `encoding.timeRange` 字段断言。  
**修后验收**：M8 CHAIN。

### M10 — 过滤器端到端正确性

**判定**：UNVERIFIED  
**期望 vs 实际**：用户设「amount ≤ 100」后图表应只含过滤后汇总；未在运行环境对比过滤前后 row/数值。  
**修复方向**：BROWSER 或集成测：同一 config 有/无 filter 对比 `rows` 或 render model。  
**修后验收**：M10 BROWSER/UI，C≥2，T1 可升 REAL。

### T5 — ChartRenderer queryLimit

**判定**：STUB  
**根因**：`cartesianRowLimit = queryLimit ?? CHART_EXECUTE_LIMIT` 无单测。  
**修复方向**：`ChartRenderer` 或 extract 纯函数单测：limit=1000 时 150 行不拒画。  
**优先级**：P1

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | M10 | 浏览器验过滤器真改变出图数值 |
| P0 | M7 | 补无 encoding 回归单测 |
| P1 | M8 | 补 timeRange BETWEEN 单测 |
| P1 | T5 | 补 queryLimit 拒画单测 |

## 7. 交接

- **结论**：**代码实现上计划 4 个 todo 已基本落地**（后端 chart_sql、execute 接线、FE encoding、文档），但 **feature-truth 视角尚未「全部完成」**——缺端到端正确性验证与 2 项计划单测。
- 建议：`root-first-solve` 先闭合 M7+M8 单测，再 BROWSER 验 M10。
- 用户批准修复：**是**（2026-08-13：闭合 M7/M8/M10/T5 单测与集成测）
