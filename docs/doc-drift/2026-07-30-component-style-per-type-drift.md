# 文档/代码漂移审计: 组件专有样式 P0

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| 锚点 | `ChartStylePanel` / `chartTypeStyleProfiles` / `ScreenVisualEditRail` |
| 对照文档 | `docs/feature-design/2026-07-30-component-style-per-type-land-design.md` |
| 期望依据 | land-design §8 验收 + 成功标准（300ms 预览、Vitest 门禁） |
| 状态 | reviewed |

## 1. 审计范围

- **功能锚点**：图表样式 Tab、看板 widget 样式、大屏素材样式
- **文档清单**：component-style-per-type land-design（状态「P0 已闭合」）
- **代码扫描**：`fe/src/lib/chartTypeStyleProfiles.ts`、`chartStyleSectionRegistry.ts`、D3 renderers、相关 Vitest

## 2. 文档宣称摘要

| 来源 | 断言 | 引用 |
|------|------|------|
| land-design 状态 | P0 已闭合；Vitest 31 项全绿 | doc:frontmatter |
| §2 | 29 种 ChartStyleSectionId；treemap/circle-packing 专有块已实现 | doc:§2 |
| §10 | G1–G20 验收项全部 [x] | doc:§10 |
| G14 | 44 活跃 chartType profile 测试全绿 | doc:§8 P0 |

## 3. 代码实际摘要

| 区域 | 实际 | 证据 |
|------|------|------|
| treemapShape / circlePackingShape | 已注册于 profile 与 ChartStyleSection | `chartTypeStyleProfiles.ts:91-103` · `ChartStyleSection.tsx:79-81` |
| sankey / wordCloud 渲染链 | render 测试通过 | `renderSankey.test.ts` · `renderWordCloud.test.ts` |
| treemap 样式映射 | `__treemapPadding*` / labelFontSize 已消费 | `renderTreemap.ts:44-57` |
| G14 profile 门禁 | **当前失败**（循环依赖） | vitest 见 §3 命令 |
| ChartStyleSectionId 计数 | 类型联合 **28** 项（非 29） | `chartStyleSectionRegistry.ts:4-32` |
| G20 大屏素材 | ScreenVisualEditRail 8 项通过 | `ScreenVisualEditRail.test.tsx` |

**运行证据**（2026-07-30）：

```text
cd fe && npx vitest run \
  src/lib/chartTypeStyleProfiles.test.ts \
  src/components/charts/engine/d3/flow/renderSankey.test.ts \
  src/components/charts/engine/d3/hierarchy/renderWordCloud.test.ts \
  src/components/charts/engine/d3/hierarchy/renderTreemap.test.ts \
  src/components/dashboard/screen/ScreenVisualEditRail.test.tsx

# 结果：4 passed, 1 failed
# FAIL chartTypeStyleProfiles.test.ts
# ReferenceError: Cannot access '__vite_ssr_import_0__' before initialization
#   at resolveChartTypeStyleProfile → tableStyleSectionsForType → plugins 循环
```

## 4. 漂移清单

| ID | 类型 | 严重度 | 文档宣称 | 代码实际 | 期望 | 同步动作 |
|----|------|--------|----------|----------|------|----------|
| D1 | **CONFLICT** | P0 | §10 / 状态「P0 已闭合」、G14 全绿 | G14 套件 **红** | §8 须 vitest 绿 | 降 land-design 状态或修循环依赖后复验 |
| D2 | CODE_AHEAD | P2 | §2「29 种 SectionId」 | 类型联合 28 项 | — | 更新 §2 计数或补注册项 |
| D3 | ALIGNED | — | G1/G2 treemap/circle-packing UI+render | 代码与测试存在 | — | 无需改 |
| D4 | ALIGNED | — | G8/G9 sankey/wordCloud 测试 | 1+1 测试 pass | — | 无需改 |
| D5 | ALIGNED | — | G20 大屏标题样式 | 8 tests pass | — | 无需改 |

## 5. ALIGNED 项（摘要）

- G1/G2 专有 section 与 render 接线已落地
- G8/G9/G10/G20 对应单测文件存在且通过（不含 G14 套件）

## 6. prd-sync Must-update 清单

| 优先级 | 文档 | 动作 | 触发 drift |
|--------|------|------|------------|
| P0 | `docs/feature-design/2026-07-30-component-style-per-type-land-design.md` | 状态改为「实施完成待 truth 复验」或修复 G14 后恢复闭合 | D1 |
| P2 | 同上 §2 | SectionId 计数 29→28 或补类型 | D2 |
| — | PRD F06 | 行为未变，**暂不必改** | — |

## 7. 建议下一步

1. **以代码为准**：land-design 状态勿标「已闭合」直至 G14 vitest 绿
2. `/land-design-implement` 收据标 G14 **BLOCKED** → `/root-first-solve` 解 plugins↔profiles 循环
3. 修复后 `/feature-truth-verify` → `/verify-fix-loop` 对比分数
