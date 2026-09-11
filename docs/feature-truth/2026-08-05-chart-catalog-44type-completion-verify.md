# Feature Truth Audit: 44 型逐型 DE 对齐 · 完成度复验

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | 计划 [`44型逐型de对齐`](../../.cursor/plans/44型逐型de对齐_a988a4a7.plan.md) 全部 Wave 0–10；44 活跃 `chartType` |
| 锚点 | `metadata.ts` · `perType/*.parity.test.ts` · `2026-08-05-chart-catalog-full-de-truth-audit.md` · walkthrough log |
| 总体判定 | **PARTIAL**（自动化门禁达标 ≠ 计划 REAL 完成） |
| **总分 / 档位** | **5.5/10 · C** |
| 状态 | draft |
| **sampling** | `full`（44 型全量；禁止抽样） |

> 用户问「每个表（chartType）是否完成？」→ **否（按计划 REAL 标准）**。  
> **506 vitest + 4 pytest 全绿** = 共享 L3/L2/L1 **CHAIN 门禁**已建立；**Wave 9 真机 BROWSER、Wave 1–8 逐型专属 diff、样式 Tab T7** 均未按计划完成。  
> Hub 文档 [`2026-08-05-chart-catalog-full-de-truth-audit.md`](./2026-08-05-chart-catalog-full-de-truth-audit.md) 标 **REAL 9/10** 与本次复验结论**冲突**，应回退为 PARTIAL 直至 BROWSER 44/44。

## 1. 核验标准与预期（来自计划 + 用户确认）

| ID | 期望（可观察） | 依据 |
|----|----------------|------|
| P0 | 44 活跃型 §3d depth≥CHAIN 且判定 REAL | 计划「完成定义」 |
| P1 | 每型 ≥1 **专属**代码 diff（render/plan/catalog/style） | 计划 SOP 铁律 |
| P2 | MULTI_DIM 8 维类别轴 + 解除笛卡尔 GAP-MAX-DIM | Wave 0.1 |
| P3 | 过滤→query 链式单测 | Wave 0.2 |
| P4 | `per-type/{chartType}.md` 深审结构（line 试点） | Wave 0.3 |
| P5 | MCP **真机** 44/44：palette → 绑 §2 夹具 → 数据 Tab → 预览 + **截图** | Wave 9 |
| P6 | 样式 Tab ≥1 控件改动能反映预览（p1-backlog 必做） | Wave 1–8 SOP 步 5 |
| P7 | `pnpm run test:chart-catalog` + pytest 全绿 | Wave 10 |

- **非目标**：5 项 MIG deprecated 型逐型 REAL（仅 migratesTo 门禁）

### 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 活跃 chartType | 44 | 0 | 44 | `BUILTIN_PLUGIN_DEFS` `!deprecated` |
| Wave 步（SOP×44） | 352 | 0 | 352 | 计划 8 步 × 44 |
| BROWSER 走查行 | 44 | 0 | 44 | walkthrough log |
| 真机截图文件 | 44 | 0 | 44 | `.dev/walkthrough/chart-catalog/` |

## 2. 链路建模与动态验证（Step 3 · 已读输出）

| 命令 | 结果 | 深度 | 说明 |
|------|------|------|------|
| `pnpm run test:chart-catalog` | **506 passed**（77 files） | CHAIN | 2026-08-05 复跑 |
| `pytest tests/test_viz_chart_catalog_parity.py -q` | **4 passed** | GATE | BE↔FE catalog |
| `.dev/walkthrough/chart-catalog/*.png` | **0 文件** | NONE | Glob 空 |

**perType 测试实质**：44 个 `*.parity.test.ts` 由 `fe/scripts/generate-per-type-artifacts.mjs` **同模板生成**，仅替换 `CHART_TYPE` 与 hint 文案；**非**逐型专属断言。

```22:38:fe/src/components/charts/perType/line.parity.test.ts
  it("L3: DE axis blueprint is registered", () => { ... });
  it("L2: buildPlan encodes §2 fixture (...)", () => {
    assertPlanMatchesFixture(item, plan);  // 共享断言
  });
  it("L1: render model ready for fixture rows", () => { ... });
```

**line 深审仍 PARTIAL**（6.5/10 · C），T7 MULTI_DIM / T8 BROWSER 未 REAL：[`2026-08-05-line-de-parity-truth-audit.md`](./2026-08-05-line-de-parity-truth-audit.md)。

## 3. Wave 完成度（计划 vs 实际）

| Wave | 计划交付 | 实际 | 判定 |
|------|----------|------|------|
| **0.1** MULTI_DIM | xDim multi · 编码 · resolveChartEncoding · 解除 waiver · 单测 | `builders.ts`/`buildDatasetEncoding.ts`/`catalog.ts` 已改；笛卡尔 waiver 已删；**缺** line 多 xAxis（1–8 字段）`resolveChartEncoding` 单测 | **PARTIAL** |
| **0.2** FILTER-CHAIN | 链式单测 + browser 模板 | `chartExecuteProbe.test.ts` 4 用例 ✅；walkthrough 有过滤模板 | **REAL**（自动化）；browser 未跑 |
| **0.3** 审计模板 | 44 份深审 + line 样板 | `_template.md` + 44 份**短模板**（非 line 深审结构） | **PARTIAL** |
| **1** trend | line/area/area-stack 专属 diff + browser | 共享 MULTI_DIM + 模板 parity；**无** area/area-stack 专属 render/plan diff | **PARTIAL** |
| **2** compare 14 | 逐型柱/瀑布/OHLC 等专属检查 | 部分型在 `chartCatalogPlanAssertions.ts` 有分支；**无** 14 个专属 render 单测/文件 | **PARTIAL** |
| **3** dual_axes | dual-line legend 修复 | `renderDualAxes.ts` + `renderDualAxes.test.ts` ✅ | **PARTIAL**（仅 dual-line 专属；mix×3 无增项） |
| **4–8** table/distribute/relation/map/quota | 逐型 REAL | 模板 parity + 共享 smoke | **STUB/PARTIAL** |
| **9** BROWSER 44/44 | MCP 真机 + 截图 REAL | walkthrough 用 vitest **代理**；截图 **0/44** | **UNVERIFIED** |
| **10** 收口 | hub REAL + §4 回写 | hub 已写 REAL **但与事实不符** | **PARTIAL**（门禁绿；文档过度） |

## 3d. 覆盖矩阵（44 型 · 按计划 REAL 标准）

图例：**深度** GATE / CHAIN / UI / BROWSER / NONE · **计划完成** = SOP 8 步是否满足

| 族 | chartType（数） | L3 | L2 | L1 | UI 槽位 | BROWSER | 专属 diff | 计划完成 |
|----|-----------------|----|----|-----|---------|---------|-----------|----------|
| quota | gauge, liquid, kpi (3) | CHAIN | CHAIN | CHAIN | UI | NONE | 共享 plan 分支 | **否** |
| table | table-info/normal/pivot, t-heatmap (4) | CHAIN | CHAIN | CHAIN | UI | NONE | 无 | **否** |
| trend | line, area, area-stack (3) | CHAIN | CHAIN | CHAIN | UI | NONE | 共享 MULTI_DIM 仅 | **否** |
| compare | bar 族等 (14) | CHAIN | CHAIN | CHAIN | UI | NONE | 部分 plan 分支 | **否** |
| dual_axes | chart-mix×4 (4) | CHAIN | CHAIN | CHAIN | UI | NONE | dual-line legend 仅 1 型 | **否** |
| distribute | pie 族等 (7) | CHAIN | CHAIN | CHAIN | UI | NONE | pie seriesGradient 仍 hidden | **否** |
| relation | sankey 等 (7) | CHAIN | CHAIN | CHAIN | UI | NONE | 部分 plan 分支 | **否** |
| map | map, map-3d (2) | CHAIN | CHAIN | CHAIN | UI | NONE | 无新增 | **否** |

**逐型一行结论（44/44 相同模式）**：

| 维度 | 44 型统计 |
|------|-----------|
| 共享 CHAIN 门禁（smoke + parity 模板 + deParity） | **44/44** |
| 专属代码 diff（计划铁律） | **≈1–5/44**（dual-line legend、encode/buildDatasetEncoding 为横切） |
| BROWSER + 截图 | **0/44** |
| 样式 Tab T7 userEvent/BROWSER | **0/44** |
| per-type 深审文档 | **1/44**（line 有独立深审；其余为生成短页） |
| **计划 SOP REAL** | **0/44** |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验 chartType | 44 |
| 自动化 CHAIN（L3+L2+L1 共享门禁） | 44 |
| GATE-only（若仅计 profile/metadata） | 0 |
| BROWSER REAL | **0** |
| 样式 UI/BROWSER | **0** |
| 计划 SOP 完全 REAL | **0/44** |
| 门禁测试全绿 | **是**（506 + 4 pytest） |
| **总体可否标计划 REAL** | **否** |

**逐一校验：否** — 44 型均有共享自动化 CHAIN，但 **0 型**完成计划要求的 BROWSER+截图+样式 T7+专属 diff；hub「44/44 REAL」不符合 `feature-truth-verify` 与计划 Wave 9。

## 4. 五维打分（scope = 计划全量 REAL）

| 维 | 分 | 说明 |
|----|-----|------|
| L 链路 | 2 | L3/L2/L1 vitest CHAIN 全型覆盖 |
| C 正确性 | 1 | 夹具级 encode 断言；无真机目视/样式正确性 |
| D 深度 | 1 | 无 BROWSER；GATE 冒充 REAL 已纠正 |
| E 预期符合 | 1 | 与计划 P5/P6 差距大 |
| F 可维护 | 1 | 模板 parity 易漂移；缺专属测试 |
| **总分** | **5.5/10 · C** | |

## 5. 打通但不对 / 偷懒模式

| 问题 | 严重度 | 证据 |
|------|--------|------|
| 模板 parity 标 REAL | P0 | `generate-per-type-artifacts.mjs`；44 文件结构相同 |
| walkthrough AUTO→REAL 无真机 | P0 | log L11「vitest 代理」；截图目录空 |
| hub 9/10 REAL 与 line 深审 PARTIAL 矛盾 | P0 | 两份 truth 文档冲突 |
| MULTI_DIM resolveChartEncoding 缺 cartesian 多 xAxis 测 | P1 | 仅 table-normal + 单 xAxis line |
| pie seriesGradient 未决策 | P2 | `chartStyleAuditMatrix.ts` hidden |

## 6. 修复优先级（须用户批准后再改代码）

| 优先级 | 动作 | 估工时 |
|--------|------|--------|
| **P0** | 回写 hub + walkthrough：**总体 PARTIAL**；BROWSER 列改 NONE/待验 | 0.5d |
| **P0** | Wave 9：按 walkthrough 路径 MCP 44 型 + `.dev/walkthrough/chart-catalog/{type}.png` | 5–8d |
| **P1** | 逐 Wave 补**专属** diff：每型至少 1 个 render/plan/style 改动 + 非模板单测 | 6–10 周（计划原估） |
| **P1** | `resolveChartEncoding`：line/bar multi xAxis 1–8 字段单测 | 0.5d |
| **P2** | 44 份 per-type 文档按 line 深审结构扩写 | 2–3d |
| **P2** | GAP-STYLE：样式 Tab T7 BROWSER 抽样→全量 | 2–4d |

---

**简报**

- **计划 REAL 完成？** **否**（0/44 满足 SOP 8 步 + BROWSER）
- **自动化门禁？** **是**（506 passed + 4 pytest）
- **能否合并宣称「44 型 DE 对齐完成」？** **否** — 仅「catalog 自动化回归 GREEN」
- **文档**：本复验；建议修正 [`2026-08-05-chart-catalog-full-de-truth-audit.md`](./2026-08-05-chart-catalog-full-de-truth-audit.md)

**下一步（请选一）**：① 批准 P0 文档回写 · ② 批准从 Wave 9 BROWSER（line 试点）起修 · ③ 仅保留本报告
