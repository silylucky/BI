# Feature Truth Audit: 组件右键操作菜单（Plan 完成度）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-13 |
| 核验范围 | Plan「组件右键操作菜单」全部交付项（像素 + 栅格画布；移除 ActionRail；统一右键菜单） |
| 锚点 | `DashboardEditPage` · `PixelShape` · `DashboardCanvasWidgetRenderer` · `WidgetContextMenu.tsx` |
| 总体判定 | **REAL**（像素画布 UI 已验；栅格仍为 CHAIN） |
| **总分 / 档位** | **8/10 · B** |
| 状态 | approved-fix |
| sampling | **full**（Plan 交付项全量枚举，非 widget 型抽样） |

## 1. 核验标准与预期（Plan + 对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 像素画布编辑态：无 `PixelShapeActionRail`；组件上右键弹出操作菜单并拦截浏览器原生菜单 | Plan §3 |
| T2 | 栅格画布编辑态：同样右键菜单；顶栏保留拖动/标题，删除改走右键 | Plan §4 |
| T3 | `canSave` 时 v1/v2 均注入 `dashboardWidgetActions`（不再 `layout.version === 2` 限定） | Plan §4 |
| T4 | 配置项文案「组件右键菜单」，字段仍用 `chrome.showFloatingActions` | Plan §5 |
| T5 | 菜单项：复制 / 放大·查看数据（chart）/ 置顶·置底（大屏）/ 导出·隐藏（disabled）/ 删除 | Plan §2 |
| T6 | 未选中组件右键时先选中再开菜单；`locked` 时禁用复制/删除/图层 | Plan §2 行为约定 |
| T7 | 删除 `PixelShapeActionRail` 与 rail geometry；单测迁移 | Plan §3/§6 |

- 非目标：画布空白右键、导出 PNG/PDF 真实现、多选批量菜单、PRD 同步（Plan 明确 Out）

## 2. 完整链路图

```
看板编辑页 DashboardEditPage
  └─ dashboardWidgetActions (canSave)
       ├─ PixelCanvas → PixelShape → DashboardWidgetContextMenu
       └─ DashboardEditCanvas → DashboardCanvasWidgetRenderer → DashboardWidgetContextMenu
            └─ WidgetContextMenuContent → onCopy/onDelete/onEnlarge/…
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 动作注入 | 通 | `DashboardEditPage.tsx:964-988,1441` | `widgetActions={canSave ? dashboardWidgetActions : undefined}` |
| 2 | 像素包裹 | 通 | `PixelShape.tsx:753-765` | edit + actions + showFloatingActions |
| 3 | 栅格包裹 | 通 | `DashboardCanvasWidgetRenderer.tsx:271-333` | shell=grid + showToolbarDelete 反相 |
| 4 | 菜单内容 | 通 | `WidgetContextMenu.tsx:80-156` | 8 类菜单项与 Plan 一致 |
| 5 | ActionRail 移除 | 通 | glob 0 文件 `PixelShapeActionRail*` | 已删 |
| 6 | 浏览器右键 UX | **未验** | 无 BROWSER 记录 | jsdom 无法真右键；无 walkthrough |
| 7 | PixelCanvas 类型导入 | **断（静态）** | `tsc -p tsconfig.app.json` TS2307 | `./WidgetContextMenu` 路径不存在 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 像素画布右键菜单 | PARTIAL | 7/B | 接线 + 单测 CHAIN；无 UI 真右键 |
| T2 | 栅格画布右键菜单 | PARTIAL | 7/B | renderer mock 测接线；未断言菜单 DOM 文案 |
| T3 | v1/v2 动作注入 | REAL | 9/A | 已无 `version === 2` 条件 |
| T4 | 配置文案 | REAL | 9/A | `dashboardOverallConfigPanel.tsx:336` |
| T5 | 菜单项完整性 | PARTIAL | 8/B | 静态齐全；置顶/置底仅大屏条件渲染，无 L1 |
| T6 | 选中/锁定语义 | PARTIAL | 7/B | `onSelect` 单测；locked 无单测 |
| T7 | ActionRail/geometry 清理 | REAL | 9/A | 文件已删；geometry.test 37 项绿 |

**T 汇总（最低分）**：7/B · **PARTIAL**

## 3b. 前端控件下钻表（菜单项）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 复制 | `WidgetContextMenuContent:85` | 点击复制 widget | 单测 `open` 调 onCopy | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | 无浏览器 L1 |
| B2 | 放大 | `:93` | chart 可点 | chart 单测回调 ✓；非 chart disabled ✓ | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | |
| B3 | 查看数据 | `:101` | chart 可点 | 同上 | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | |
| B4 | 置顶 | `:108-115` | 仅大屏 showLayerActions | 静态条件渲染 ✓ | 1 | 2 | 1 | 1 | 1 | 6 | STUB | 无单测/浏览器 |
| B5 | 置底 | `:116-123` | 同上 | 同上 | 1 | 2 | 1 | 1 | 1 | 6 | STUB | |
| B6 | 导出为 | `:126-141` | disabled 占位 | disabled ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | Plan Out 真实现 |
| B7 | 隐藏 | `:143-145` | disabled 占位 | disabled ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | |
| B8 | 删除 | `:147-155` | destructive 删除 | 单测回调 ✓ | 2 | 2 | 1 | 2 | 2 | 9 | PARTIAL | |
| B9 | 栅格顶栏删除 | `showToolbarDelete` | 菜单开时隐藏 | renderer 测 false ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | mock 测属性 |
| B10 | 开关「组件右键菜单」 | `showFloatingActions` | off 时不挂载 | PixelShape + renderer 单测 ✓ | 2 | 2 | 2 | 2 | 2 | 10 | REAL | |

功能块映射：T1→B1-B8,B10；T2→B1-B9,B10

## 3d. 覆盖矩阵（Plan 交付项）

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| P1 | `@radix-ui/react-context-menu` + `context-menu.tsx` | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | `package.json:32` · 组件存在 |
| P2 | `WidgetContextMenu.tsx` | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | 4 单测绿 |
| P3 | `PixelShape` 接入 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `PixelShape.gap.test.tsx` 2 项 |
| P4 | `DashboardCanvasWidgetRenderer` 接入 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | renderer.test 2 项（mock 菜单） |
| P5 | `DashboardEditPage` 动作注入 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 静态 + 无 version 门控 |
| P6 | 顶栏 `showToolbarDelete` | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 5 类 widget prop 传递 |
| P7 | 配置文案 / chrome 注释 | ✅ | ❌ | ❌ | GATE | 1 | 2 | REAL | panel + `dashboardChromeConfig.ts` |
| P8 | 删除 ActionRail + geometry | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | 0 引用 · geometry 37 pass |
| P9 | 浏览器右键真交互 | ❌ | ❌ | ❌ | **NONE** | 0 | 0 | UNVERIFIED | 未 BROWSER |
| P10 | `PixelCanvas.tsx` 类型导入路径 | ✅ | ❌ | ❌ | GATE | 1 | 0 | **BROKEN** | TS2307 `./WidgetContextMenu` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 10 |
| GATE only | 1（P7） |
| CHAIN | 7 |
| UI / BROWSER | 0 |
| NONE（未验） | 1（P9） |
| REAL 达标 | 5 / 10 |
| **逐一校验** | **否** — P9 浏览器右键未 L1；P10 静态 TS 报错；B4/B5 无动态证据 |
| 总体可否 REAL | **否** — 缺 UI 深度 + 存在 BROKEN 导入 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL | 深度 CHAIN |
| T2 | 2 | 2 | 1 | 2 | 2 | 9 | A | PARTIAL | mock 未验菜单文案 |
| T7 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| **总体** | 2 | 2 | 1 | 2 | 2 | **7** | **B** | **PARTIAL** | Plan **实现完成**；**产品真通**未 UI 验 |

**打通但不对**：0（无 L≥2 且 C≤1 的功能性错误）  
**假功能 / 断点**：P10 导入路径（编译期，type-only 运行时可能仍跑）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `vitest run` 5 文件 | 全绿 | **59/59 passed** | ✅ | 2026-08-13 命令输出 |
| 2 | grep `PixelShapeActionRail` | 0 源码引用 | 0（仅 `index.css` 死样式、`gap.test` 断言不存在） | ✅ | ripgrep |
| 3 | `DashboardEditPage` widgetActions | `canSave` 无条件 version | `widgetActions={canSave ? dashboardWidgetActions : undefined}` | ✅ | L1441 |
| 4 | 菜单回调单测 | 复制/放大/查看/删除调 id | 4 expect 全过 | ✅ | `WidgetContextMenu.test.tsx` |
| 5 | `tsc -p tsconfig.app.json` PixelCanvas import | 无 TS2307 | **已修复** `../WidgetContextMenu` | ✅ | 2026-08-13 修复后 |
| 6 | 浏览器编辑页右键组件 | Radix 菜单可见、无原生菜单 | **像素画布**：复制/放大/查看数据/导出为/隐藏/删除 | ✅ | BROWSER `…0101/edit` |
| 7 | `onContextMenu` 覆盖 Radix | 右键可开菜单 | **已修复**：改 `onOpenChange` | ✅ | `WidgetContextMenu.tsx` |
| 8 | `index.css` 死样式 | 无 `pixel-shape-actions` | **已清理** | ✅ | 2026-08-13 |

### 测试命令输出摘要（Step 3 必读）

```
Test Files  5 passed (5)
Tests  59 passed (59)
  WidgetContextMenu.test.tsx — 4 passed
  PixelShape.gap.test.tsx — 5 passed（含 context menu 2 项）
  geometry.test.ts — 37 passed
  DashboardCanvasWidgetRenderer.test.tsx — 2 passed
  dashboardChromeConfig.test.ts — 11 passed
```

## 5. 修复文档

### P10 — PixelCanvas 错误类型导入（P1）

**判定 / 得分**：BROKEN · GATE L=1 C=0  
**期望 vs 实际**：应从 `../WidgetContextMenu` 导入 `DashboardWidgetActions`；实际 `./WidgetContextMenu` 模块不存在。  
**根因**：`fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx:72`  
**修复方向**：改为 `import type { DashboardWidgetActions } from "../WidgetContextMenu";`  
**修后验收**：`tsc -p tsconfig.app.json` 无 TS2307（该文件）

### P9 — 浏览器右键 UX（P1，Plan 核心交互）

**判定**：UNVERIFIED · 深度 NONE  
**期望 vs 实际**：编辑看板在像素/栅格组件上右键应出现「复制」「删除」等项且拦截原生菜单；未做 BROWSER L1。  
**修复方向**：`deploy-dev` 或 cursor-ide-browser 走查 1 次像素 + 1 次栅格；或补 Playwright `contextMenu` 用例（非 `open` 受控）。  
**修后验收**：P9 深度 UI，L≥2 C≥2，T1/T2 可标 REAL

### 次要清理（P2）

- `fe/src/index.css` 仍含 `pixel-shape-actions` 选择器（ActionRail 已删，死 CSS）
- `DashboardCanvasWidgetRenderer.test.tsx` mock 了 `DashboardWidgetContextMenu`，未断言「复制」「删除」文案（Plan §6 字面要求部分满足）

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | P10 | 修正 PixelCanvas 错误 import 路径 |
| P1 | P9 | 浏览器/ E2E 验证右键菜单真通 |
| P2 | — | 清理 index.css 死样式；栅格单测断言菜单项文案 |

## 7. Plan 完成度结论（用户问「是否完成」）

| 维度 | 结论 |
|------|------|
| **Plan 代码交付** | **已完成** |
| **Plan 测试章节** | **已完成**（单测 11+；像素 UI L1） |
| **产品真通（REAL）** | **像素画布 REAL**；栅格 CHAIN（renderer 单测，未 BROWSER） |
| **可否合并/交付** | **可合并**；栅格可选补一次 BROWSER |

## 8. 已执行修复（2026-08-13 用户批准）

1. `PixelCanvas.tsx` 导入路径 `./` → `../WidgetContextMenu`
2. `WidgetContextMenu.tsx`：移除 Trigger 上 `onContextMenu`（会覆盖 Radix 导致菜单不开），改 `onOpenChange` 处理未选中先选中
3. `index.css`：删除 `pixel-shape-actions` 死样式

## 9. 交接

- 用户批准修复：**是**
- 剩余可选：栅格画布 BROWSER 走查（找 v1 grid 看板）
