# Pilot：component-style-per-type 完整 Skill 链路试跑

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| land-design | `2026-07-30-component-style-per-type-land-design.md` |
| 目的 | 验证 doc-code-drift → land-design-implement → truth-verify → verify-fix-loop 文档与门禁 |

## 链路执行记录

| 步骤 | Skill | 产出 | 结果 |
|------|-------|------|------|
| 1 | doc-code-drift-audit | `docs/doc-drift/2026-07-30-component-style-per-type-drift.md` | 发现 D1 CONFLICT：文档标闭合 vs G14 红 |
| 2 | land-design-implement | `docs/feature-design/_receipts/…-receipt.md` | G1–G10/G20 PRE_EXISTING；G14 BLOCKED |
| 3 | feature-truth-verify | `docs/feature-truth/…-truth-audit.md` | PARTIAL 6/C；禁止宣称 REAL |
| 4 | verify-fix-loop | `docs/feature-truth/…-reverify.md` | OPEN 占位（无修复轮次） |

## 对 Skill 文案的迭代结论

| Skill | 试跑发现 | 文案调整 |
|-------|----------|----------|
| land-design-implement | 大量 G 项可能 PRE_EXISTING | 已含 PRE_EXISTING 状态与「实施前 drift」建议 |
| doc-code-drift-audit | land-design「已闭合」与测试红冲突 | CONFLICT 类型覆盖「状态字段 vs 命令输出」 |
| verify-fix-loop | 无修复时不应 CLOSED | 已含 OPEN 占位与跳过 Round 2 说明 |
| feature-truth-verify | G14 失败拉低整包 | 收据/truth 须单独评 B-G14 |

## 命令（可复跑）

```powershell
Set-Location fe
npx vitest run src/lib/chartTypeStyleProfiles.test.ts `
  src/components/charts/engine/d3/flow/renderSankey.test.ts `
  src/components/charts/engine/d3/hierarchy/renderWordCloud.test.ts `
  src/components/charts/engine/d3/hierarchy/renderTreemap.test.ts `
  src/components/dashboard/screen/ScreenVisualEditRail.test.tsx
```

## 后续

1. root-first-solve：解 `chartTypeStyleProfiles.test.ts` ↔ `plugins/index.ts` 循环
2. verify-fix-loop 复验至 CLOSED
3. doc-code-drift 同步 land-design 状态字段
