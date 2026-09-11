# Feature Truth Audit: 仪表板辅助对齐网格与吸附配置

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| 核验范围 | `chrome.showAuxiliaryGrid` + `chrome.alignmentSnap`（重合阈值、边/中心吸附、网格步长吸附、网格步长、折叠 UI） |
| 锚点 | `DashboardOverallConfigPanel` → `styleConfig.chrome` → `PixelCanvas` / `PixelShape` / `DashboardGrid` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **6/10 · C** |
| 状态 | draft |
| sampling | `full`（scope 内 8 项配置能力 + 10 个控件全列） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 关「辅助对齐网格」→ 编辑画布无点阵 overlay | 对话 / 产品说明 |
| T2 | 开网格 + 拖组件靠近另一组件边/中心 → 在阈值内出现参考线并吸附落点 | 对话「重合阈值」 |
| T3 | 关「组件对齐吸附」→ 无组件间参考线/吸附（重叠模式除外） | `enableMarkLineSnap` |
| T4 | 关「边线」或「中心线」→ 对应方向不再吸附 | `snapEdges` / `snapCenters` |
| T5 | 开「网格步长吸附」→ 松手落点按 `gridCellPx` 取整 | `enableGridSnap` |
| T6 | 改「网格步长」→ 点阵密度同步变化；开步长吸附时落点间距同步 | `gridCellPx` |
| T7 | 配置写入 `styleConfig` 保存后刷新仍生效 | 持久化 |
| T8 | 像素布局：细项在「辅助对齐网格」下折叠，默认收起，可展开 | 对话「能收起」 |

**Out**：栅格看板上的组件对齐吸附（无 `PixelShape` 链路）；编辑区工具栏「更多」内仅网格开关、不含细项。

## 2. 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 配置能力 E1–E8 | 8 | 0 | 8 | `dashboardStyleConfig.ts` · `dashboardChromeConfig.ts` |
| 可交互控件 B1–B10 | 10 | 0 | 10 | `dashboardAlignmentSnapControls.tsx` · `CanvasEditToolbar.tsx` |

## 3. 完整链路图

```
仪表板配置面板 AlignmentSnapControls
  → patchChrome → styleConfig.chrome.{showAuxiliaryGrid, alignmentSnap}
  → onStyleChange / 保存 layout_json.styleConfig
  → resolveDashboardChrome / resolveDashboardAlignmentSnap
  → PixelCanvas（overlay、markLinesEnabled）
  → PixelShape.snapPointerRect（computeMarkLineSnap + snapRectToAuxiliaryGrid）
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | UI 配置写入 | **通** | `dashboardOverallConfigPanel.test.tsx` 5/5 绿 |
| 2 | resolve 归一化 | **通** | `dashboardChromeConfig.test.ts` alignment 用例 |
| 3 | 后端 schema | **通** | `DashboardChromeConfig` pydantic validate |
| 4 | PixelCanvas 消费 | **断** | `PixelCanvas.tsx:199` 与 `:284` 重复 `const chrome` → vitest esbuild 报错 |
| 5 | 拖拽吸附运行时 | **未验 L1** | 无 drag 集成测 / 无 BROWSER |
| 6 | 仅网格吸附路径 | **假通** | `PixelShape.tsx:535` 在 `!markLinesEnabled` 时提前 return，跳过网格吸附 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 辅助对齐网格 Switch（像素） | `patchChrome.showAuxiliaryGrid` | 写 chrome | patch 正确 | 2 | 2 | 1 | 2 | 2 | 9 | REAL | `dashboardOverallConfigPanel.test.tsx` |
| B2 | 展开/收起三角 | `Collapsible` local state | 默认收起，点击展开 | 默认 hidden；展开可见 | 2 | 2 | 0 | 2 | 2 | 8 | PARTIAL | 同上 + `not.toBeVisible` |
| B3 | 组件对齐吸附 | `alignmentSnap.enableMarkLineSnap` | patch + 拖拽生效 | patch 未测；运行时受 P0 阻断 | 1 | 1 | 1 | 2 | 2 | 7 | PARTIAL | 静态 `PixelCanvas:289` |
| B4 | 重合阈值 slider | `markLineThresholdPx` | patch + 吸附距离变 | patch 未测；`markLineThreshold` 单测有 | 1 | 1 | 1 | 2 | 1 | 6 | PARTIAL | `pixelMarkLine.test.ts` |
| B5 | 边线吸附 | `snapEdges` | 关后无边对齐 | 代码接线；无 snapEdges 单测 | 1 | 0 | 1 | 2 | 2 | 6 | PARTIAL | `pixelMarkLine.ts:35` GATE |
| B6 | 中心线吸附 | `snapCenters` | 关后无中心对齐 | 同上 | 1 | 0 | 1 | 2 | 2 | 6 | PARTIAL | GATE |
| B7 | 网格步长吸附 | `enableGridSnap` | patch + 落点取整 | patch 测 1 例；与 B3 互斥 bug | 2 | 0 | 1 | 2 | 2 | 7 | PARTIAL | `auxiliaryGridSnap.test.ts` + `PixelShape:535` |
| B8 | 网格步长 slider | `gridCellPx` | 点阵密度变 | `auxiliaryGridPatternStyle` CHAIN；PixelCanvas 测跑不起来 | 1 | 1 | 1 | 2 | 1 | 6 | PARTIAL | `dashboardChromeConfig.test.ts` |
| B9 | 辅助对齐网格（栅格） | 同 B1 | 仅开关 | 无细项、栅格 overlay 用 gridCellPx | 2 | 2 | 1 | 2 | 2 | 9 | REAL | `DashboardGrid.gap.test.tsx` |
| B10 | 工具栏「更多」网格 | `onAuxiliaryGridChange` | 与 chrome 联动 | 仅 `showAuxiliaryGrid`，无 alignmentSnap | 2 | 2 | 1 | 2 | 2 | 9 | REAL | `CanvasEditToolbar.tsx:274` |

**T 映射**：T1→B1,B9,B10 · T2→B3,B4 · T3→B3 · T4→B5,B6 · T5→B7 · T6→B8 · T7→全 patch · T8→B2

## 3d. 覆盖矩阵

| 实体 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|------|------|-------|-----|------|---|---|------|------|
| E1 showAuxiliaryGrid | ✅ resolve | ⚠️ PixelCanvas 测失败 | ✅ B1 | CHAIN* | 1 | 1 | PARTIAL | `PixelCanvas.test.tsx` esbuild 失败 |
| E2 enableMarkLineSnap | ✅ | ❌ | ✅ B3 patch 未单测 | GATE | 1 | 1 | STUB | 静态接线 |
| E3 markLineThresholdPx | ✅ clamp | ✅ `markLineThreshold` | ❌ | CHAIN | 1 | 1 | PARTIAL | 无拖拽 L1 |
| E4 snapEdges | ✅ 过滤函数 | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 snapEdges 用例 |
| E5 snapCenters | ✅ | ❌ | ❌ | GATE | 1 | 0 | STUB | 无 snapCenters 用例 |
| E6 enableGridSnap | ✅ | ✅ `snapRectToAuxiliaryGrid` | ✅ B7 toggle | CHAIN | 2 | 0 | PARTIAL | **关组件吸附时网格吸附不生效** |
| E7 gridCellPx | ✅ | ✅ pattern style | ❌ | CHAIN | 1 | 1 | PARTIAL | 未验 PixelCanvas overlay 变步长 |
| E8 折叠 UI | — | — | ✅ B2 | UI | 2 | 2 | REAL | `dashboardOverallConfigPanel.test.tsx` |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 8 |
| GATE only | 2（E4、E5） |
| CHAIN | 4（含 E1/E6/E7 带缺陷） |
| UI / BROWSER | 1（E8）；拖拽 0 |
| NONE | 0 |
| REAL 达标 | 1/8（仅 E8 UI 壳） |
| **逐一校验** | **否** — 已静态+单测 8/8，但仅 1 项 UI REAL；拖拽吸附 0/8 BROWSER；E6 逻辑错误 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总（T 主块）

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| T1 网格显示 | 2 | 2 | 1 | 2 | 2 | 9 | A | REAL |
| T2–T6 吸附行为 | 1 | 0 | 1 | 2 | 1 | 5 | D | PARTIAL |
| T7 持久化 | 1 | 1 | 1 | 2 | 2 | 7 | B | PARTIAL |
| T8 折叠 | 2 | 2 | 0 | 2 | 2 | 8 | B | PARTIAL |
| **综合 T** | — | — | — | — | — | **6** | **C** | **PARTIAL** |

**打通但不对**：E6（网格步长吸附在关闭组件对齐吸附时不生效，与文案「可独立开网格步长吸附」不符）

## 4. 动态验证记录

| 步骤 | 操作 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|------|--------|------|
| 1 | `pnpm vitest` 相关 5 文件 | 全绿 | `PixelCanvas.test.tsx` **Transform failed**：`chrome` 重复声明 | ❌ | 命令输出 2026-08-27 |
| 2 | `dashboardOverallConfigPanel.test.tsx` | 5 pass | 5 pass | ✅ | vitest |
| 3 | `auxiliaryGridSnap.test.ts` | 3 pass | 3 pass | ✅ | vitest |
| 4 | `dashboardChromeConfig.test.ts` alignment | resolve 正确 | pass | ✅ | vitest |
| 5 | Python schema roundtrip | 接受 alignmentSnap | dump 含字段 | ✅ | `schemas.py` validate |
| 6 | 浏览器拖拽吸附 | 阈值/边/中心/网格可感 | **未执行** | — | 无 BROWSER |

## 5. 修复文档

### P0 — PixelCanvas 重复声明（E1/E2 运行时阻断）

**判定**：BROKEN（vitest esbuild 无法编译 `PixelCanvas.tsx`）  
**期望 vs 实际**：应单一 `chrome` 变量；实际 `:199` 与 `:284` 各声明一次。  
**根因**：`fe/src/components/dashboard/pixelCanvas/PixelCanvas.tsx:284`  
**修复方向**：删除第二处 `const chrome = resolveDashboardChrome(styleConfig);`，保留 `:199` 或合并 `alignmentSnap` 到首段。  
**修后验收**：`PixelCanvas.test.tsx` 可运行；`toggles auxiliary grid overlay` 用例绿。

### P0 — 网格步长吸附依赖组件对齐吸附（E6）

**判定**：PARTIAL，C=0  
**期望 vs 实际**：仅开「网格步长吸附」也应取整；实际 `snapPointerRect` 在 `!markLinesEnabled` 时直接 `return raw`，从不调用 `snapRectToAuxiliaryGrid`。  
**根因**：`fe/src/components/dashboard/pixelCanvas/PixelShape.tsx:535-537`  
**修复方向**：将网格吸附分支提前，或在 early return 前单独处理 `shouldApplyAuxiliaryGridSnap`。  
**修后验收**：`enableMarkLineSnap:false` + `enableGridSnap:true` 时 move 落点仍按 `gridCellPx` 取整（新增单测）。

### P1 — snapEdges / snapCenters 无行为单测（E4/E5）

**判定**：STUB  
**修复方向**：`pixelMarkLine.test.ts` 增 2 例：`snapEdges:false` 不吸边、`snapCenters:false` 不吸中心。  
**修后验收**：CHAIN 深度，C≥2。

### P1 — 拖拽吸附无集成/BROWSER（T2–T6）

**判定**：UNVERIFIED @ 运行时  
**修复方向**：`PixelCanvas` 或 `PixelShape` pointer 集成测，或 MCP 编辑页拖两个矩形验参考线。  
**修后验收**：至少 1 条 L1「拖近 10px → 吸附」记录。

### P1 — 持久化无 save 回读测（T7）

**判定**：PARTIAL D=1  
**修复方向**：backend 或 fe API smoke：`layout_json.styleConfig.chrome.alignmentSnap` roundtrip。  

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P0 | PixelCanvas duplicate chrome | 删除重复声明，恢复编译与单测 |
| P0 | E6 grid-only snap | 组件吸附关时仍允许网格步长吸附 |
| P1 | E4/E5 | 补 pixelMarkLine 单测 |
| P1 | T2–T6 | 补拖拽集成或 BROWSER |
| P1 | T7 | 保存回读 smoke |

## 7. 交接

- 建议：先批 P0 两处再 `root-first-solve` 或本对话直接修  
- 用户批准修复：**否**（本次仅审计落盘）
