# Headless Automation Plan: 数据大屏编辑视口对标 DataEase

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute  
日期：2026-07-20

## 1. 问题陈述

大屏编辑态「空格拖动画布」多次修复仍不可用；W/H、标尺、缩放与 DataEase（DE）差距大。根因不是单点 bug，而是 **视口架构选错**：把「投放预览」的 `CanvasScaleViewport` 与「编辑视口」混用，且平移依赖 `scroll`，在 `fitHeight` 贴满时无溢出、滚不动。

## 2. DataEase vs VitalSpan 深度对比

| 维度 | DataEase 数据大屏编辑 | VitalSpan（修复前） | 根因 |
|------|----------------------|---------------------|------|
| 视口模型 | **独立 Viewport**：`pan(x,y)` + `zoom` + `fitMode` | `CanvasScaleViewport` + `overflow: scroll` | 编辑/投放未分层 |
| 空格平移 | 更新视口 `translate`，**不依赖 scroll** | `scrollLeft/Top` | 内容未溢出时 pan 无效 |
| 事件路由 | 空格模式 document 捕获，屏蔽组件交互 | 先绑在 scroll 容器，后被 PixelShape 吃掉 | 事件层未统一 |
| 标尺 | 与视口 `pan/zoom` 同步 | 仅绑 scrollOffset | 平移语义不一致 |
| 画布尺寸 | W/H 输入即时生效 | 受控输入无 onChange（已修） | 表单状态机缺失 |
| 组件布局 | 允许重叠，无推挤 | 已按 surfaceKind 分化 | ✅ |
| 对齐线 | 拖拽吸附 | 已开启（大屏常开） | ✅ |

DE 白皮书要点：**仪表板挤压排版 vs 大屏自由叠放**；编辑画布是「相机看设计稿」，不是「可滚动 div 套 scale」。

## 3. 目标架构（Phase 2.6）

```
DataScreenEditShell
├── CanvasRuler (H/V)     ← 读 viewPan + scale
├── DataScreenEditViewport
│   ├── viewState: { panX, panY, userZoom, presentationMode }
│   ├── transform: translate(pan) → scale(fit*zoom) → design canvas
│   └── spacePan: document capture + pointer-events-none on stage
└── PixelCanvas (designViewportLocked, engine 共用)
```

**投放/预览** 继续用 `DataScreenPresenter` + `CanvasScaleViewport`（只读、无 pan）。

## 4. 任务清单

### T1 · 视口平移改为 translate（P0）✅ 本轮

- `dataScreenViewportPan.ts`：`applyViewportPanTranslate`
- `DataScreenEditViewport`：`viewPan` state + `overflow-hidden`
- 标尺 `scrollOffsetPx = -viewPan`

**验收**：`fitHeight` 贴满时，空格+拖动画布仍可见平移。

### T2 · 视口状态机抽离（P1）✅ 2026-07-29

- 新建 `useDataScreenViewportState.ts`（pan/zoom/fit/reset）
- 单测覆盖 pan/zoom/标尺偏移公式
- `presentationMode` 写入 `styleConfig` 可选持久化（本轮未做 pan/zoom 持久化）

### T3 · DE 对齐增强（P2）✅ 2026-07-29

- 缩放百分比下拉（50%–200%）+ 重置视口
- 标尺十字线跟鼠标
- 中键拖动画布（可选）
- 缩放锚点：Ctrl+滚轮以指针为中心

### T4 · 文档与登记（P1）✅ 2026-07-29

- `docs/ui/layout.md`：大屏编辑视口 IA
- `fe/src/components/README.md`：登记 `DataScreenEditViewport`
- `evolution-state.md` 更新轮次

## 5. 验证方案

```bash
cd fe && npx vitest run src/components/dashboard/screen/dataScreenViewportPan.test.ts src/components/dashboard/screen/canvasRulerUtils.test.ts
cd fe && npx tsc --noEmit
```

手工：

1. 大屏编辑 → 默认高度贴满 → **按住空格拖动画布**，画布应随鼠标移动
2. Ctrl+滚轮缩放后空格平移仍有效
3. 标尺刻度随平移滚动
4. W/H 修改 Enter 确认后画布尺寸变化

## 6. 风险与不在范围

- **不做**无限画布（拖出边界自动扩图）——需改 `layout.canvas` 语义与持久化
- **不改**仪表板 `PixelCanvas` 内部 scale 路径
- 预览/embed 不引入编辑 pan（避免投放语义漂移）

## 7. 参考

- `docs/automate/plans/2026-07-17-data-screen-de-surface-phase1.md`
- DE 用户手册：面板基础功能 · 画布缩放与移动
- 代码：`fe/src/components/dashboard/screen/DataScreenEditViewport.tsx`
