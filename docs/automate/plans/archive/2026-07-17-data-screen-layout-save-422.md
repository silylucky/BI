# Headless Automation Plan: 数据大屏布局保存 422 根治

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute
- Date: 2026-07-17
- Status: implemented (wave-1)

## 1. 问题陈述

数据大屏编辑页配置组件后点击「保存」，PUT `/api/v1/dashboards/{id}/layout` 返回 **422**，前端仅提示「操作失败，请稍后重试」，用户无法定位原因。

## 2. 现象还原（L1 证据）

| 证据源 | 内容 |
|--------|------|
| 终端日志 | 连续 `PUT .../layout` → `422 Unprocessable Entity` |
| 浏览器抓包 | 请求体 `canvas.height: 583`；响应 `detail[0].loc = body.layoutJson.canvas.height`，`msg = greater than or equal to 900` |
| 后端 schema | `DashboardCanvas.height` 约束 `ge=900`（`backend/app/dashboard/schemas.py`） |
| 前端保存链 | `handleSave` → `persistDashboardLayout` → `buildDashboardLayoutForSave` → `fitCanvasHeightToContent` |

典型场景：1920 宽画布上两个并排组件（804+768），高度 583；`fitCanvasHeightToContent` 用 `PIXEL_CANVAS_MIN_HEIGHT=320` 将画布从 1080 **收缩** 到 583，触发后端校验失败。

## 3. 根因分层

### RC-1 契约漂移（主因）✅ 已修

- **FE 编辑态** 用 `PIXEL_CANVAS_MIN_HEIGHT=320` 做视口/内容贴合
- **BE 持久化** 要求 `canvas.height >= 900`
- **大屏产品** 固定 16:9 基线 `1920×1080`
- 保存时 `fitCanvasHeightToContent` 按内容收缩，未区分 `surfaceKind`

### RC-2 保存路径未显式传入 surface 策略（加重）✅ 已修

`resolvePersistedCanvasMinHeight` 依赖 `layout.styleConfig`，而 `buildDashboardLayoutForSave` 的 `styleConfig` 与 `layout` 合并时序易导致误判；应从 **liveStyle** 显式计算 `minCanvasHeight`。

### RC-3 模块循环依赖风险（潜在）✅ 已修

`surfacePreset` → `PixelCanvas` → `dataScreenLayout` → `surfacePreset`。策略常量抽到 `fe/src/lib/canvasPersistPolicy.ts`（零业务环）。

### RC-4 422 错误被吞（体验）✅ 已修

FastAPI 校验错误 `detail` 为 **数组**，`api.ts` 的 `parseErrorBody` 只处理对象形态，导致 `mapApiError` 永远回落到「操作失败，请稍后重试」。

## 4. 方案（已实施）

### Wave 1 — 保存契约收口

| 任务 | 文件 | 动作 |
|------|------|------|
| T1 | `fe/src/lib/canvasPersistPolicy.ts` | 单一真理源：`resolvePersistedCanvasMinHeight` / `clampCanvasHeightForPersist` |
| T2 | `fe/src/components/dashboard/dashboardCanvasMode.ts` | 保存时显式 `minCanvasHeight` + 最终 `clampCanvasHeightForPersist` |
| T3 | `fe/src/components/dashboard/pixelCanvas/constants.ts` | 拆开 `PIXEL_CANVAS_MIN_HEIGHT`，打断循环依赖 |
| T4 | `fe/src/lib/api.ts` | 解析 FastAPI `detail[]` 校验错误 |
| T5 | 单测 | `canvasPersistPolicy.test.ts`、`dataScreenPersist.test.ts`、后端 `test_data_screen_rejects_canvas_height_below_backend_min` |

### Wave 2 — 防御纵深（建议后续）

| 任务 | 说明 |
|------|------|
| B1 | 后端 `DashboardCanvas` 按 `styleConfig.surfaceKind=data-screen` 校验 `height >= 1080` |
| B2 | 编辑态 `PixelCanvas` 对大屏禁止将 `layout.canvas.height` 写入低于 1080 |
| B3 | 保存前客户端预校验 + 字段级 toast（`layoutJson.canvas.height`） |
| B4 | E2E：大屏添加组件 → 保存 → 刷新 → 组件仍在 |

## 5. 验收标准

- [x] 大屏双组件（高 583）经 `persistDashboardLayout` 后 `canvas.height >= 1080`
- [x] PUT 相同布局 `canvas.height=1080` 返回 200
- [x] PUT `canvas.height=583` 返回 422（回归）
- [x] FastAPI 422 在前端显示「布局校验失败」而非泛化文案
- [ ] 用户浏览器硬刷新后编辑页保存成功（需人工确认 HMR）

## 6. 验证命令

```bash
cd fe && npx vitest run src/lib/canvasPersistPolicy.test.ts src/components/dashboard/dataScreenPersist.test.ts src/lib/dataScreenLayout.test.ts
cd backend && pytest tests/test_dashboard_pixel_layout.py -k data_screen -q
```

## 7. 风险与回滚

- 普通看板最低高度从 320 变为 900：与后端一致，属 **修复** 而非回归
- 大屏内容超出 1080 时仍允许 `fitCanvasHeightToContent` 撑高（与 DE 一致）
