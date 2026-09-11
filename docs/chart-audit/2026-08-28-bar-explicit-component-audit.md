# 图表组件审计 — explicit: bar（样例 · 含 §3b）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `chart-component-audit` |
| Scope | explicit: `bar` |
| 采样 | explicit（全量 R=50 见 §0 对照） |
| 三柱 | 能不能用 · 全不全 · 对不对 |
| 控件核对 | §3b 全量（bar 单型） |
| **审计报告** | **已落盘** |
| **修复报告** | [`2026-08-28-bar-explicit-fix-report.md`](2026-08-28-bar-explicit-fix-report.md) |

---

## 0. Catalog 发现摘要（对照）

| 来源 | 数量 |
|------|------|
| FE 注册 N | 50 |
| 本次审计 | **1**（`bar`） |

---

## 0b. Onboarding

无（`bar` 为 AUDITABLE）。

---

## 1. 覆盖矩阵

| chartType | 状态 | WORKS | COMPLETE | CORRECT | 判定 | parity | 控件数 | 控件FAIL | 逐一校验 |
|-----------|------|-------|----------|---------|------|--------|--------|----------|----------|
| bar | AUDITABLE | 8.5 | 9 | 9 | **PARTIAL** | L1-L3 | 18 | 1 | 是 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| scope 类型数 | 1 |
| §3b 控件总行数 | 18 |
| 控件 FAIL 合计 | 1 |
| **逐一校验** | 是 |

> WORKS 因 §3b 有 P1 FAIL，最高 PARTIAL（见 rubric）。

---

## 2. 三柱汇总

| 柱 | 分 | 说明 |
|----|-----|------|
| WORKS | 8.5 | parity L1-L3 绿；1 控件未达 BROWSER 深度 |
| COMPLETE | 9 | CARTESIAN_CORE 全 section 在 profile+Panel |
| CORRECT | 9 | L3 blueprint；fieldAssignment 用例覆盖 |

---

## 3. 字段/维指

| 槽位 | DE 期望 | UI | 校验 | 结论 |
|------|---------|-----|------|------|
| xAxis/0 dimension | 1 维 | ✓ | ✓ | PASS |
| yAxis multi metrics | 多指 | ✓ | ✓ | PASS |

---

## 3b. 配置控件矩阵（bar）

| ID | 区域 | 控件 | 期望 | 实际 | 生效 | 逻辑 | 判定 |
|----|------|------|------|------|------|------|------|
| bar-D-01 | 数据 | 横轴维字段槽 | 绑定维度参与 encode | 可绑 region 等 | ✅ | ✅ | PASS |
| bar-D-02 | 数据 | 纵轴指标槽（+添加） | 可多指 | uiMode multi | ✅ | ✅ | PASS |
| bar-D-03 | 数据 | 清空槽位 | 清除字段 | onChange 更新 config | ✅ | ✅ | PASS |
| bar-S-axis-01 | 样式·axis | 显示横轴 | 切换隐藏 X | Switch + patch axis | ✅ | ✅ | PASS |
| bar-S-axis-02 | 样式·axis | 显示纵轴 | 切换隐藏 Y | Switch + patch axis | ✅ | ✅ | PASS |
| bar-S-axis-03 | 样式·axis | 横轴标签方向 | 改 labelRotate | Select → onChange 测 `ChartAxisStyleSection.test` | ✅ | ✅ | PASS |
| bar-S-shape-01 | 样式·cartesianShape | 柱宽比例 | 改 barWidthRatio | Slider → `cartesian.barWidthRatio` → plan | ✅ | ✅ | PASS |
| bar-S-shape-02 | 样式·cartesianShape | 圆角 | 改 barRadius | Slider → renderer 读 | ✅ | ✅ | PASS |
| bar-S-legend-01 | 样式·legend | 显示图例 | 关后 hide legend | Switch；`ChartLegendStyleSection.test` 绿 | ✅ | ⚠️ BROWSER 未复测 | PARTIAL |
| bar-S-label-01 | 样式·label | 显示数据标签 | 开关+位置 | onStyleChange → label.* | ✅ | ✅ | PASS |
| bar-S-title-01 | 样式·title | 图表标题 | 文本写入 style.title | ✓ | ✅ | ✅ | PASS |
| bar-S-palette-01 | 样式·palette | 配色方案 | 改 palette 影响 series 色 | applyChartStyleChain | ✅ | ✅ | PASS |
| bar-S-bg-01 | 样式·background | 背景色/透明 | 写入 background | ✓ | ✅ | ✅ | PASS |
| bar-S-tooltip-01 | 样式·tooltip | 提示框开关/触发 | 写入 tooltip | grep renderer 读 | ✅ | ✅ | PASS |
| bar-S-remark-01 | 样式·remark | 备注文案 | remark 字段 | ✓ | ✅ | ✅ | PASS |
| bar-A-01 | 高级 | 结果行数限制 | limit 写入 config | ChartResultLimitField | ✅ | ✅ | PASS |
| bar-A-02 | 高级 | 条件格式（若 capability 开） | 规则匹配变色 | chartDeFeatures 路径 | ✅ | ✅ | PASS |
| bar-A-03 | 高级 | 辅助线（若 capability 开） | markLine 写入 | inspector cap gated | ✅ | ✅ | PASS |

---

## 4. 样式（摘要）

`chartTypeStyleProfiles.bar` = CARTESIAN_CORE（axis, cartesianShape, background, palette, title, remark, legend, label, tooltip）。Panel 分区与 profile 一致。

---

## 5. 渲染与其它

| 项 | 结果 |
|----|------|
| `bar.parity.test.ts` | 3/3 绿 |
| `buildChartRenderModel` | ready |
| styleVariant | default（bar 无 variantBasic） |

---

## 6. 问题摘要

| P0 | P1 | P2 |
|----|----|-----|
| 0 | 0 | 1 |

详见 [`2026-08-28-bar-explicit-fix-report.md`](2026-08-28-bar-explicit-fix-report.md)（FIX-P2-001 图例 BROWSER 复验）。

---

## 7. 验证命令

```bash
cd fe && npx vitest run src/components/charts/perType/bar.parity.test.ts --reporter=dot
cd fe && npx vitest run src/components/dashboard/chartStyleSections/ChartLegendStyleSection.test.tsx --reporter=dot
```

| 命令 | 结果 |
|------|------|
| bar.parity | ✅ 3 passed |
| ChartLegendStyleSection | ✅ 3 passed |

---

## 8. 交接

- 修 P2 → 可选 Playwright 图例关断快照
- 全 catalog → `/chart-component-audit catalog 全量`
- 产品 REAL → `feature-truth-verify`
