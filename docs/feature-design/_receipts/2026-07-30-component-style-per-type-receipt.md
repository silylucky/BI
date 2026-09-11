# Land Design 实施收据: 组件专有样式 P0

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| 源 land-design | `docs/feature-design/2026-07-30-component-style-per-type-land-design.md` |
| 确认 G 范围 | G1, G2, G8, G9, G10, G14, G20 |
| 实施者 | Agent（试跑 land-design-implement 链路） |
| 状态 | **ready-for-truth-verify**（G14 门禁未绿） |

## 1. 范围冻结摘要

| G ID | 类型 | 标题 | 冻结触及文件 | 计划验收 |
|------|------|------|--------------|----------|
| G1 | add | treemapShape | profiles · sections · renderTreemap | vitest renderTreemap |
| G2 | add | circlePackingShape | profiles · sections · renderCirclePacking | 手动/ profile 断言 |
| G8 | optimize | sankey 样式链 | apply · renderSankey | renderSankey.test |
| G9 | optimize | wordCloud 样式链 | renderWordCloud | renderWordCloud.test |
| G10 | optimize | treemap labelFontSize | renderTreemap | renderTreemap.test |
| G14 | add | 44 型 profile 门禁 | chartTypeStyleProfiles.test | vitest G14 套件 |
| G20 | add | 大屏素材样式 | ScreenVisualEditRail | ScreenVisualEditRail.test |

**非目标 / 未做 G**：G3–G7, G11–G13, G15–G19（land-design §4.2 范围外）

## 2. 逐项实施结果

| G ID | 状态 | 改动摘要 | 证据 | 命令与结果 |
|------|------|----------|------|------------|
| G1 | PRE_EXISTING | treemapShape 已在 profile/section/render | `chartTypeStyleProfiles.ts:91` · `renderTreemap.ts:55-57` | renderTreemap.test → **pass** |
| G2 | PRE_EXISTING | circlePackingShape 已注册 | `chartTypeStyleProfiles.ts:103` · `ChartStyleSection.tsx:81` | profile 单测（见 G14） |
| G8 | PRE_EXISTING | sankey options 链 + 测试 | `renderSankey.test.ts` | **pass** (1) |
| G9 | PRE_EXISTING | wordCloud render 测试 | `renderWordCloud.test.ts` | **pass** (1) |
| G10 | PRE_EXISTING | labelFontSize 接 render | `renderTreemap.ts:44,161` | renderTreemap.test → **pass** |
| G14 | **BLOCKED** | 套件因 plugins↔profiles 循环无法加载 | vitest 输出见 §4 | chartTypeStyleProfiles.test → **FAIL** |
| G20 | PRE_EXISTING | 大屏样式 8 项回归 | `ScreenVisualEditRail.test.tsx` | **pass** (8) |

## 3. 触及文件清单（审计引用，本试跑未改码）

```
fe/src/lib/chartTypeStyleProfiles.ts
fe/src/lib/chartStyleSectionRegistry.ts
fe/src/components/dashboard/chartStyleSections/ChartStyleSection.tsx
fe/src/components/charts/engine/d3/hierarchy/renderTreemap.ts
fe/src/lib/chartTypeStyleProfiles.test.ts
```

## 4. 测试与命令日志

```text
# 2026-07-30 pilot
cd fe
npx vitest run src/lib/chartTypeStyleProfiles.test.ts \
  src/components/charts/engine/d3/flow/renderSankey.test.ts \
  src/components/charts/engine/d3/hierarchy/renderWordCloud.test.ts \
  src/components/charts/engine/d3/hierarchy/renderTreemap.test.ts \
  src/components/dashboard/screen/ScreenVisualEditRail.test.tsx

Test Files  1 failed | 4 passed (5)
Tests       11 passed (11)  # G14 文件在 collect 阶段失败，内部用例未执行
FAIL chartTypeStyleProfiles.test.ts — ReferenceError circular init
```

## 5. 文档 / 漂移待办

| 漂移类型 | 说明 | 建议动作 |
|----------|------|----------|
| CONFLICT (D1) | land-design 标「P0 已闭合」但 G14 红 | 见 `docs/doc-drift/2026-07-30-component-style-per-type-drift.md` |

## 6. 交接

- [x] **必须**：同范围 `feature-truth-verify` → 见 `docs/feature-truth/2026-07-30-component-style-per-type-truth-audit.md`
- [ ] G14 BLOCKED → `root-first-solve`（plugins 注册与 profile 测试解耦）
- [ ] 修后 → `verify-fix-loop`

**禁止在无 truth-verify 通过前宣称 P0 闭合。**
