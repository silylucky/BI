# Headless Automation Plan: 大屏 resize 几何与测量管线收口

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-20  
关联 BUG: [`BUG-12_data-screen-resize-content-vanish_2026-07-20.md`](../../bugs/BUG-12_data-screen-resize-content-vanish_2026-07-20.md)

## 背景与目标

**问题描述**：数据大屏编辑态拖组件手柄微调尺寸后，所有组件视觉内容消失。R1/R2 针对 preview 竞态与 React/imperative 双轨几何的补丁不足，Vitest 假绿。

**成功标准**：

1. 真机：`/admin/data-screens/:id/edit` 拖手柄 resize 后，图表/边框/时钟/筛选内容仍可见（非仅 DOM 文本）
2. `pnpm exec playwright test e2e/data-screen-resize-content.spec.ts` 通过（含 `transform: scale` 包裹）
3. `pnpm exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx` 通过
4. BUG-12 根因 RC3–RC5 标记为已修复

**非目标**：

- 右侧改画布 W/H 的独立问题（仅回归不恶化）
- 看板非 data-screen 栅格/RGL 路径重构
- Phase 3 多屏播放

## 整体方案

对标 DataEase **isPlayer 单轨几何**：交互期仅 imperative 跟手；**commit 后 layout 为唯一权威**，一次原子同步外框 + 广播 remeasure。大屏 **visualScale 由 `DataScreenEditViewport` 注入**，`PixelCanvas` 不再从 stage bbox 反推。删除 `layoutGeometryKey` 上的全局 `previewRegistry.reset` 副作用，改由 commit/cancel 单点收口。补 Playwright 门控填补 Vitest 盲区。

## 关键决策

| 决策点 | 选择 | 备选项 | 理由 |
|--------|------|--------|------|
| 几何权威 | layout commit + imperative 镜像 | 继续 React `style` 双轨 | R2 已证双轨不足；DE 模型为 DOM 跟手 + 状态提交 |
| scale 来源 | Context 自 `DataScreenEditViewport` | 维持 `resolveStageVisualScale` | 双 transform 下反推易漂移（RC4） |
| 图表恢复 | commit 总线 `dispatchPixelLayoutGeometryCommitted` | 仅依赖 ResizeObserver | RO 在 flex 重排瞬间常读到 0（RC3） |
| preview reset | 移除 `layoutGeometryKey` effect 全局 reset | 继续 ref 竞态修补 | 根因是多处写 DOM（RC2） |
| 验证 | Playwright 优先 | 仅 Vitest | RC5 假绿 |

## 假设与依赖

- 用户复现场景为 **拖组件手柄**（非画布 W/H 输入）
- 本地 `pnpm dev` + `uvicorn` 可用；Playwright 可 mock 登录（沿用 `e2e/login-default-dashboard.spec.ts` 模式）
- `allowsPixelWidgetOverlap` 对 data-screen 保持 true

## 风险与回退

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 看板非大屏 resize 回归 | 中 | 仪表板编辑 | 改动限定 `designViewportLocked`/`viewportFit=data-screen` 分支；跑 PixelCanvas 全量测 |
| remeasure 总线性能 | 低 | 大画布卡顿 | rAF 合帧；仅 commit 触发 |
| scale 注入遗漏预览页 | 低 | 预览坐标偏 | 预览仍用 presenter scale，不共用编辑 context |

## 改动清单

### T1 · 失败用例先行（Playwright + 诊断脚本）

- **位置**：`fe/e2e/data-screen-resize-content.spec.ts`（新建）
- **改动**：登录 → 打开含模板大屏 edit → 选中 chart widget → pointer resize 20px → 断言 `.pixel-shape-outer` 的 `width/height>80` 且 `canvas` 或 `[data-screen-border]` 可见区域 `>0`
- **验证**：本地先跑应 **失败**（复现用户问题）

### T2 · visualScale 注入

- **位置**：`DataScreenEditViewport.tsx` · `fe/src/components/dashboard/screen/dataScreenVisualScaleContext.tsx`（新建）· `PixelCanvas.tsx`
- **改动**：`DataScreenEditViewport` 提供 `visualScale={scale}`；`designViewportLocked` 时 `PixelShape` 的 `screenDeltaToCanvas` 用注入值，fallback 才 `resolveStageVisualScale`
- **目标对应**：RC4
- **验证**：`geometry.test.ts` 增「注入 scale 优先」单测

### T3 · commit 几何总线 + 移除全局 reset

- **位置**：`pixelShapeLiveResize.ts`（或 `pixelLayoutGeometryBus.ts`）· `PixelCanvas.tsx` · `PixelShape.tsx`
- **改动**：
  1. `handleCommit`/`handleCancel` 末尾 `dispatchPixelLayoutGeometryCommitted(layoutRevision)`
  2. 删除 `useEffect([layoutGeometryKey])` 内 `previewRegistry.reset`；保留 `clearPreviewChrome(nextLayout)` 单点 reset
  3. `PixelShape` 仅在 `registerPreviewSync` 回调与 `useLayoutEffect([widget geom])` 写外框
- **目标对应**：RC1、RC2
- **验证**：Vitest 增「commit 后邻块 style 不变 + 无二次 reset」

### T4 · 嵌入式图表 remeasure 链

- **位置**：`useElementSize.ts` · `ChartRenderer.tsx` · `useEmbeddedChartLiveResize.ts` · `DashboardCanvasWidgetRenderer.tsx`
- **改动**：
  1. 新 hook `usePixelLayoutGeometryCommit(enabled, remeasure)` 订阅 T3 总线
  2. `ChartRenderer` embedded 模式在 commit 后强制 `apply()` 一次（即使 `paused` 刚结束）
  3. `rendererPropsEqual` 增加 `chartRefreshKeys` 或专用 `layoutGeometryRevision` prop（来自 `PixelCanvas` context），避免 memo 挡住 remeasure
- **目标对应**：RC3
- **验证**：`ChartRenderer` 集成测：模拟 paused→commit→`bodySize` 恢复

### T5 · Vitest 补强（transform 包裹）

- **位置**：`PixelCanvas.test.tsx` · `fe/src/components/dashboard/screen/DataScreenEditViewport.test.tsx`
- **改动**：resize 用例外包一层 `transform: scale(0.588)` 的 wrapper，断言 commit 尺寸换算正确
- **目标对应**：RC5

### T6 · 文档与 case 回流

- **位置**：`docs/bugs/BUG-12_*.md` · `.agents/skills/bug-case-library/cases/fe-data-screen-resize-content-vanish.md`（新建）· `docs/automate/evolution-state.md`
- **改动**：状态 → fixed；登记 case 供后续检索

## 执行顺序

```
T1(失败 E2E) → T2(scale) → T3(几何总线) → T4(remeasure) → T5(Vitest) → T6(文档)
```

T3 与 T4 可并行开发，但合并前须 T3 总线 API 稳定。

## 整体验证方案

```bash
cd fe
pnpm exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
pnpm exec vitest run src/components/dashboard/pixelCanvas/geometry.test.ts
pnpm exec playwright test e2e/data-screen-resize-content.spec.ts
```

手测：大屏 edit 拖手柄 resize；Ctrl+Shift+R 后重复；确认图表/边框/时钟可见。

## 八维度自审

| 维度 | 评级 | 备注 |
|------|------|------|
| 目标-实现一致性 | 🟢 | T1–T6 覆盖全部成功标准 |
| 必要性 | 🟢 | 无无关重构 |
| 正确性 | 🟢 | scale 注入与 DE 相机模型一致 |
| 完整性 | 🟢 | 含 E2E、单测、文档、case |
| 一致性 | 🟢 | 沿用 pixel canvas 模块边界 |
| 副作用 | 🟡 | 需跑非大屏 PixelCanvas 全量测 |
| 降级合理性 | 🟢 | 无静默 fallback |
| 顺序依赖 | 🟢 | T1 先行 |
| 可验证性 | 🟢 | 命令可执行 |

**plan-review state: PASS**（2026-07-20，dev-autopilot 自审）

**execution state: PARTIAL → superseded by viz-inspector plan**（T2/T3/T4 核心已并入 viz-inspector 闭环；T1 E2E 与 T5 Vitest 同上）

## 推荐执行模型

`inherit`（默认）；T1 Playwright 探针可用 `composer-2.5-fast` 加速迭代。
