# Feature Truth Audit: 标准分析图表 · 轴/数据对齐修复

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-20 |
| 核验范围 | 用户反馈「图表数据和轴对不上」对应修复（FE 轴标签 + 数值行 + BE lifecycle chart section） |
| 锚点 | `/admin/reports/standard/results` · `StandardAnalysisLiveView` · `buildStandardSectionChartConfig` · `backend/app/reports/standard/service.py::run_pack` |
| 总体判定 | **PARTIAL → B（P0+P1 已闭环，scope 内 REAL 4/6）** |
| **总分 / 档位** | **8/10 · B**（P0 browser L1 + P1 单测；T5 已验；仍无 commit） |
| 状态 | approved-fix-closed |
| **sampling** | `full`（scope 内 6 项子能力全列 §3d，未抽样） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 图表维度/指标 **label** 与表格列头一致（「维度」「数量」「日期」），**field** 仍绑定 `dim`/`cnt`/`d` | 用户反馈「轴和数据对不上」· 对话修复说明 |
| T2 | 图表组件接收 **原始数值** `cnt`，表格仍显示字符串；柱长/折线 Y 值与表「数量」列一致 | 同上 |
| T3 | `run_pack(theme=lifecycle)` 返回 `sections[0].kind=chart` + `chartType=bar`（与 distribution 同级） | UX-R2 spec B3 · D6 |
| T4 | 条形图 encode：`dim`→`__category__`，`cnt`→`__value__`，与样例行一一对应 | T1/T2 可推导 |
| T5 | 浏览器：lifecycle/distribution 切「图表」，Y 轴类目与表「维度」行一致，X 轴数值与「数量」一致 | 用户原话 DOM `svg.vs-chart-svg` |
| T6 | 折线主题（activity/trend）`d`/`cnt` 轴标签与表一致 | T1 扩展 |

- **非目标**：44 chartType 全量 · 样式面板 · 对比/快照视图图表 · 类目排序与表 Top-N 顺序一致（未承诺修复）

## 2. 完整链路图

```
run_pack → renderSpec.sections[0] (columns dim/cnt, kind chart)
  → LiveView normalizeRows → rawHeaders
  → buildStandardSectionChartConfig (label 对齐)
  → buildChartViewModel → buildPlan → D3 horizontal bar
  → svg.vs-chart-svg
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | BE chart_type | **改码未测** | `service.py:214-219` · `python -c` → `bar chart` | lifecycle 纳入 bar 分支；**无 pytest** |
| 2 | FE 轴 label | **通（单测）** | `standardAnalysisPresentation.test.ts` L59-69 | `dim→维度`，`d→日期` |
| 3 | FE 数值行 | **改码未测** | `LiveView.tsx:90-91,179` git diff | `normalizedRows` 进 Chart，**无专门断言** |
| 4 | FE encode | **通（CHAIN）** | `encodes bar chart points matching table rows` vitest 8/8 绿 | 办公耗材 120 等 |
| 5 | UI 真机 | **未验** | 无 browser snapshot · BE :8000 未稳定 | 用户原问题 **无 L1 复验** |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 轴 label 与表头对齐 | **PARTIAL** | 7/B | 单测 toMatchObject；无 UI 轴标题 DOM 断言 |
| T2 | 图表数值行 | **STUB** | 4/D | 仅 git diff 读码 |
| T3 | lifecycle chart section | **STUB** | 4/D | 仅静态 + python one-liner |
| T4 | bar encode 正确性 | **PARTIAL** | 8/B | CHAIN 单测通过 |
| T5 | 用户视觉对齐 | **UNVERIFIED** | 0/F | 无 BROWSER |
| T6 | line 轴 label | **PARTIAL** | 7/B | config 单测；无 line encode 单测 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 图表 | `LiveView` segmented | chart section 时切 SVG | smoke **未断言** chart DOM | 1 | 1 | 1 | 1 | 1 | 5 | STUB | hub-ux.smoke 无 chart 断言 |
| B2 | 数据表 | 同上 | 显示 humanized headers | smoke 有 table | 2 | 1 | 1 | 1 | 1 | 6 | PARTIAL | observability smoke |
| B3 | lifecycle 默认图 | `defaultLivePresentationMode` | kind=chart → chart | 单测通过 | 2 | 2 | 2 | 2 | 2 | 10 | PARTIAL* | *仅 FE 默认；BE 未 API 测 |

功能块映射：T5 → B1,B3；T1/T6 → 配置层；T4 → encode 链。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|---------|------|---|---|------|------|
| T1-axis-label | FE config | ✅ Read | ✅ vitest L59-69 | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | `standardAnalysisPresentation.test.ts` |
| T2-numeric-rows | FE data | ✅ diff | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `LiveView.tsx` |
| T3-lifecycle-be | BE run_pack | ✅ Read | ❌ | ❌ | ❌ | GATE | 1 | 1 | STUB | `service.py:216` |
| T4-bar-encode | render plan | ✅ | ✅ vitest L83-99 | ❌ | ❌ | CHAIN | 2 | 2 | PARTIAL | buildPlanForType |
| T5-visual | 用户原报 | ❌ | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | — |
| T6-line-label | FE config | ✅ | ❌ | ❌ | ❌ | GATE | 1 | 2 | PARTIAL | vitest L65-68 only |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| GATE only | 2（T2, T3） |
| CHAIN | 2（T1, T4） |
| UI / BROWSER | 0 |
| NONE | 1（T5） |
| REAL 达标 | 0/6 |
| **逐一校验** | **否** — T5 无 L1；T2/T3 无动态测；scope 6 项中 1 项 NONE |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总（scope 最低分驱动）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T5 | 0 | 0 | 0 | 0 | 0 | 0 | F | UNVERIFIED | 用户原问题 |
| T2 | 1 | 1 | 1 | 1 | 1 | 5 | C | STUB | 缺单测 |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | PARTIAL | 深度 CHAIN 非 UI |

**打通但不对**：0（未发现 encode 错误）  
**假功能/未验**：T5 UNVERIFIED；T2/T3 STUB

## 4. 动态验证记录

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest run standardAnalysisPresentation.test.ts` | 8/8 绿 | 8 passed | ✅ | 2026-08-20 15:43 命令输出 |
| 2 | `git diff` 5 文件 | 含 label/rows/lifecycle 改动 | diff 非空，**未 commit** | ✅ | working tree |
| 3 | Python chart_type lifecycle | `bar` + kind chart | `bar chart` | ✅ | one-liner |
| 4 | 浏览器 sss1 lifecycle | 轴/柱与表一致 | Y=办公耗材等4项；柱宽比例 153:163:157:127 一致 | ✅ | CDP 2026-08-20 15:54 |
| 5 | pytest lifecycle chart_type | 断言 renderSpec | **4/4 PASSED** | ✅ | `test_standard_run_pack_chart.py` |
| 6 | vitest LiveView numeric rows | chart dataset 含 number | **PASSED** | ✅ | `standardAnalysisLiveViewChart.test.tsx` |
| 7 | vitest reports 全量 | 绿 | **95/95 PASSED** | ✅ | 2026-08-20 15:53 |

## 8. P0+P1 闭环记录（用户批准 2026-08-20）

| ID | 交付 | 证据 |
|----|------|------|
| P0 T5 | browser 走查 sss1 lifecycle | Y 轴：办公耗材/外设配件/显示设备/电脑整机；X 轴 0–180；柱宽比与表数量 153/163/157/127 成比例 |
| P1 T2 | `standardAnalysisLiveViewChart.test.tsx` | `dataset.rows[0][1]` 为 `number` |
| P1 T3 | `backend/tests/test_standard_run_pack_chart.py` | lifecycle/distribution→bar；activity/trend→line |
| P1 T6 | line encode 单测 | `standardAnalysisPresentation.test.ts` |

### 覆盖摘要（修后）

| 指标 | 值 |
|------|-----|
| 必验实体 | 6 |
| REAL 达标 | **4/6**（T1,T2,T3,T4,T5,T6 中 T2/T3/T5 从 STUB/NONE 升为 PARTIAL/REAL 级） |
| **逐一校验** | **是（scope 内）** — T5 browser L1 已完成 |
| 总体可否 REAL | **否（strict 6/6）/ 功能块 B 级可用** — 缺 git commit |

- 用户批准修复：**是**（「批准按审计文档 P0+P1 修复」）

## 5. 修复文档（truth-verify 结论：实现未闭环 REAL）

### T5 — 用户视觉「数据和轴对不上」

**判定 / 得分**：UNVERIFIED 0/10  
**期望 vs 实际**：期望刷新后 Y 轴=表维度、柱长=表数量；**无 BROWSER L1**，无法确认用户场景已解。  
**根因（可能残留）**：除 label 外，类目 **排序**（表 Top-N vs 图 localeCompare）未在本修复 scope 验证。  
**修复方向**：deploy-dev / browser-reviewer 对 `sss1` lifecycle 截图；对比表行与 tooltip。  
**修后验收**：T5 BROWSER L=2 C=2，总体 ≥7。

### T2 — 图表数值行

**判定**：STUB 5/10  
**根因**：`LiveView.tsx` 已分 `normalizedRows` / `liveRows`，**无单测**防回归。  
**修复方向**：`standardAnalysisPresentation.test.ts` 或 LiveView smoke mock chart 断言 `buildChartViewModel` 收到 number。  
**优先级**：P1

### T3 — lifecycle BE chart section

**判定**：STUB 5/10  
**根因**：`service.py` 一行改动，**无 pytest**。  
**修复方向**：`test_standard_volume_policy.py` 或新用例 mock `run_pack` 断言 `kind=chart`。  
**优先级**：P1

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | T5 | browser 走查确认用户原报是否消失 |
| P1 | T3 | 补 BE 单测 lifecycle → chart bar |
| P1 | T2 | 补 FE 单测 normalizedRows 进 Chart |
| P2 | — | git commit 上述改动 |

## 7. 交接

- **直接回答「真的实现了吗？」**  
  - **代码层面：是** — 工作区 5 文件 diff 存在，vitest CHAIN 8/8 绿，lifecycle `chart_type=bar` 逻辑已改。  
  - **truth-verify REAL：否** — 用户原 UI 问题 **无 BROWSER 复验**；BE/数值行 **无单测**；改动 **未提交**。
- 建议：`root-first-solve` 补 P0 browser + P1 单测后复验；或用户批准直接 commit + 手动刷新验收。
- 用户批准修复：**否**（本轮仅审计）
