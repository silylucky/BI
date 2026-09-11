# Headless Automation Plan: 仪表板组件间隙全面修复

- **Plan type:** Headless Automation Plan
- **Cursor Build:** disabled
- **Execution trigger:** dev-autopilot A5 plan-execute

## 目标

修复间隙功能审计中的 P0/P1 问题：数据归一化、双通道一致、加载/保存对称、栅格透明 CSS、死 prop 清理、后端校验、测试补齐。

## 任务

1. 重写 `normalizeDashboardGapConfig` + 修复 `resolveWidgetGap`/`resolvePixelGutter`/`buildDashboardGapPatch`
2. `bootstrapDashboardStyleConfig` 加载时归一化 gap
3. CSS：栅格 gap shell 透明
4. 移除 `PixelCanvas.pixelGutter` 死 prop
5. 修复 `DashboardStyleDialog` 遗留写入
6. 后端 `DashboardStyleConfig` gap 一致性 validator
7. 测试：normalize legacy、保存 round-trip、栅格 shell

## 验收

- `npx vitest run` gap 相关测试通过
- `tsc --noEmit` 通过
- 后端 gap validator 单测通过
