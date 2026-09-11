# 图表组件问题修复报告 — explicit: bar

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `chart-component-audit` |
| 关联审计 | [`2026-08-28-bar-explicit-component-audit.md`](2026-08-28-bar-explicit-component-audit.md) |
| Scope | explicit: `bar` |
| 控件逐一校验 | 是（18/18 行） |
| 待修合计 | P0 **0** · P1 **0** · P2 **1** |

---

## 1. 执行摘要

- **Verdict**：**有条件可交付**（图表域 bar 单型；无 P0/P1 阻塞）
- **阻塞项**：无
- **建议**：P2 为验证深度缺口，非功能断链；扩 catalog 全量前可先接受

---

## 2. 问题清单

### FIX-P2-001

| 项 | 内容 |
|----|------|
| chartType | bar |
| 区域 | 样式 · legend |
| 控件 ID | bar-S-legend-01 |
| 问题类型 | 验证深度不足 |
| 期望 | 关闭「显示图例」后画布图例不可见 |
| 实际 | vitest 覆盖 Switch + onChange；**未** Playwright 像素断言 |
| 柱 | WORKS |
| 证据 | `ChartLegendStyleSection.test.tsx` 3/3 绿；无 e2e 图例关断 |
| **修复方向** | （可选）`chart-visual-snapshots` 或 dashboard e2e 加 bar 图例 off 快照 |
| **验收** | Playwright 截图 diff 或 manual truth BROWSER 一行 |
| 状态 | OPEN |

---

## 3. 按 chartType 汇总

| chartType | P0 | P1 | P2 | 控件 FAIL |
|-----------|----|----|-----|-----------|
| bar | 0 | 0 | 1 | 1（PARTIAL 计 1） |

---

## 4. 建议修复批次

| 批次 | 范围 | 说明 |
|------|------|------|
| — | 无必须批次 | P2 可并入 catalog 全量 deep 审计时补 |

---

## 5. 复验命令

```bash
cd fe && npx vitest run src/components/charts/perType/bar.parity.test.ts
cd fe && npx vitest run src/components/dashboard/chartStyleSections/ChartLegendStyleSection.test.tsx
```

---

## 6. 交接

- 无用户批准修码项（P2 观察）
- catalog 全量 → `/chart-component-audit catalog 全量`
