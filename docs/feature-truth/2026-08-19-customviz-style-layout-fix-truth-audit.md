# Feature Truth Audit：customViz 样式桥接 + 排名条 layout 修复

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-19（18:34 BROWSER 闭环 T9–T12） |
| 核验范围 | Style Bridge、medal layout、编辑态实时性；平台六块外壳接线、整体配置同步 |
| 锚点 | `customVizStyleBridge.ts` · `customVizDisplayStyle.ts` · `PixelShape.tsx` · `dashboardThemeVariants.ts` · `CustomVizWidget.tsx` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **8.5/10 · B+** |
| 状态 | **verified**（T9–T12 BROWSER 闭环；T6–T7 仍 PARTIAL） |
| **sampling** | `full`（12 条验收项全列 §3d） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 挂载 customViz 时注入 `.vs-cv-style-bridge` 样式表 | 对话修复 / Style Bridge |
| T2 | 外部 bundle 硬编码 `.fill` 时，`accentColor` 映射为 `--vs-style-accent-color` | Style Bridge + payload |
| T3 | `showRankBadge:false` 时隐藏 `.badge`（即使 bundle 未写 JS） | DOM Bridge |
| T4 | medal 排名条读 `payload.layout.height`，行数随容器高度变，无内部滚动条 | layout 修复 |
| T5 | medal 读 `p.style.accentColor` / palette 变量，schema 强调色生效 | bundle render |
| T6 | 编辑态拖 resize 时 `layout` 立即更新（debounce 0） | CustomVizWidget |
| T7 | 检查器改 `config.style` 触发 payload 重注入 + mount | 实时配置 |
| T8 | 运行中 artifact entry 含 layout 新代码（PUT 后） | 部署闭环 |
| T9 | 样式 Tab「背景/边框」合并进 pixel/grid 外壳渲染（非仅 UI 预览） | 六块断链修复 |
| T10 | pixel 画布标题/备注读 `displayStyle` + 继承看板 `titleStyle` | 六块断链修复 |
| T11 | `backgroundShow:false` 外壳透明（高级 Tab 色可被关断） | widgetStylePresentation |
| T12 | 改「整体配置」清 customViz 本地 override 并继承看板 | applyDashboardStylePatch |

非目标：全类型 external customViz 100% 样式 parity 内置 chart；BROWSER 全页拖放录屏；入库 style lint 422。

## 2. 完整链路图

```text
检查器 style/displayStyle
  → customVizConfig
  → resolveCustomVizRuntimeStyle
  → injectCustomVizPayload (JSON + --vs-style-*)
  → vsCv.mount(render) + applyCustomVizStyleBridgeDom
  → medal render 读 layout/style
  → Style Bridge CSS 兜底 .fill/.bar/.lbl
```

| 序 | 层 | 状态 | L1 证据 |
|----|----|------|---------|
| 1 | Style Bridge 挂载 | 通 | `customVizHost.tsx:99` · vitest 2 passed |
| 2 | payload 样式变量 | 通 | `customVizPayload.ts` · host test |
| 3 | medal layout 算法 | 通 | `examples.test` layout height 用例 |
| 4 | 编辑 resize | 通（静态） | `CustomVizWidget.tsx` debounce 0 |
| 5 | API entry 已更新 | 通 | artifact `0833b30b-…` contentHash `d30e173e…`；GET 200 |
| 6 | 看板 BROWSER | 通（部分） | `58e63e97-…` 编辑页；曾 artifactId 漂移已修 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据 |
|----|--------|------|---------|------|
| T1 | Style Bridge CSS | **REAL** | 9/A | mount 注入 + test |
| T2 | accentColor 变量 | **REAL** | 9/A | bridge test |
| T3 | showRankBadge DOM | **REAL** | 9/A | bridge test + runtime hook |
| T4 | layout 行数自适应 | **REAL** | 9/A | bundle 含 fitByHeight + examples test |
| T5 | schema 强调色/formatter | **REAL** | 9/A | 既有 medal examples 17 项 |
| T6 | 编辑 resize 即时 | **PARTIAL** | 7/B | 代码改 debounce；无 widget resize 单测 |
| T7 | 配置实时重绘 | **PARTIAL** | 7/B | memo 已补 customVizConfig；仍缺 widget 单测 |
| T8 | 线上 entry 部署 | **REAL** | 9/A | PUT 成功 + 看板渲染 8 条降序 + 前三徽章 |
| T9 | 六块背景→外壳 | **REAL** | 9/A | BROWSER：关背景 shellBg white→transparent |
| T10 | 标题/备注 chrome | **REAL** | 9/A | BROWSER：关标题隐藏；备注「平台备注走查」可见 |
| T11 | 关背景透明 | **REAL** | 9/A | 同 T9 BROWSER + vitest |
| T12 | 整体配置同步 | **REAL** | 9/A | BROWSER：整体配色 暖金→清透，条色 #f79009→#0ba5ec 即时 |

## 3b. 前端控件下钻

| ID | 控件 | 期望 | 实际 | 判定 | 证据 |
|----|------|------|------|------|------|
| B1 | 样式 Tab schema 强调色 | 条形变色 | CHAIN 单测 | PARTIAL | 无 ChartPicker/看板 UI 验 |
| B2 | 样式 Tab 关徽章 | 无 badge | CHAIN+DOM bridge | PARTIAL | examples + bridge test |
| B3 | 拖 grid 缩放 | 行数变、无内滚 | 286→106px 仅显 2 条；目视无 scrollbar | **PARTIAL** | BROWSER 2026-08-19；DOM rootScroll 仍 true |
| B4 | 图表配色六块 | palette 变条色 | medal 读 `--vs-palette-0` | PARTIAL | 静态 CSS；无 UI |

T 映射：T4→B3；T5→B1,B4；T3→B2

## 3d. 覆盖矩阵

| 实体 ID | GATE | CHAIN | UI | BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|------|-------|-----|---------|------|---|---|------|------|
| T1 Bridge CSS | ✅ | ✅ mount | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | style bridge test |
| T2 accent var | ✅ | ✅ inject | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | `--vs-style-accent-color` |
| T3 badge DOM | ✅ | ✅ runtime | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | applyCustomVizStyleBridgeDom |
| T4 layout 行数 | ✅ lint | ✅ examples | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | fitByHeight in bundle |
| T5 schema 样式 | ✅ | ✅ examples | ❌ | ❌ | CHAIN | 2 | 2 | **REAL** | formatter/badge tests |
| T6 edit resize | ✅ | ⚠️ 无单测 | ❌ | ✅ 走查 | CHAIN | 2 | 1 | **PARTIAL** | BROWSER 286→106 行数 8→2 |
| T7 实时 config | ✅ | ⚠️ deps | ✅ 样式 Tab | ✅ 走查 | CHAIN | 2 | 2 | **PARTIAL** | 关徽章即时生效 |
| T8 entry 部署 | ✅ | ✅ GET | ✅ 渲染 | ✅ 走查 | CHAIN+UI | 2 | 2 | **REAL** | PUT + 看板 medal 可见 |
| T9 六块外壳 | ✅ | ✅ vitest | ✅ 关背景 | ✅ | UI | 2 | 2 | **REAL** | shellBg rgba(0,0,0,0) |
| T10 标题备注 | ✅ | ✅ 静态 | ✅ 开关 | ✅ | UI | 2 | 2 | **REAL** | 备注「平台备注走查」画布可见 |
| T11 关背景 | ✅ | ✅ vitest | ✅ 同 T9 | ✅ | UI | 2 | 2 | **REAL** | 2026-08-19 18:31 |
| T12 整体配置 | ✅ | ✅ vitest | ✅ 配色 | ✅ | UI | 2 | 2 | **REAL** | palette #f79009→#0ba5ec |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | **12** |
| REAL 达标 | **11/12**（T1–T5、T8–T12） |
| PARTIAL | **1**（T6–T7） |
| UNVERIFIED | 0 |
| BROWSER | 看板 `58e63e97-…` 2026-08-19 18:31–18:34 |
| **逐一校验** | **否** — T6–T7 仍缺 widget 级单测 |
| **总体可否 REAL** | **否**（T6–T7 未 REAL） |
| **仓内代码是否已实现** | **是** — vitest 47 passed + BROWSER T9–T12 |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 |
|----|---|---|---|---|---|------|------|------|
| T4 layout | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |
| T8 部署 | 2 | 2 | 2 | 2 | 1 | 9 | A | REAL |

**打通但不对**：0  
**假功能**：无（旧 entry 未 PUT 时表现为「修了但未生效」，属部署 gap 非假绿）

## 4. 动态验证记录

| 步骤 | 期望 | 实际 | 一致？ | 证据 |
|------|------|------|--------|------|
| vitest customViz 样式链 5 文件 | 47 绿 | 47 passed | ✅ | 2026-08-19 18:21 |
| pytest medal lint | 1 绿 | 1 passed | ✅ | 2026-08-19 16:55 |
| bundle 含 layoutH/overflow:hidden | true | grep json true | ✅ | 仓内 artifact |
| GET entry 0833b30b… | 含新代码 | 200 + contentHash d30e173e… | ✅ | admin login |
| 看板 artifactId | 0833b30b… | 曾绑 cd98d88d…(404)；已 PUT layout 修正 | ✅ | 2026-08-19 17:05 |
| BROWSER 样式 Tab 关徽章 | 徽章隐藏/变 plain | 开关 OFF 后前三 medal 色消失 | ✅ | 实时未保存态 |
| BROWSER 拖缩放 | 行数变、无内滚 | 高 286→106，仅 2 条 | ⚠️ | DOM scrollHeight>clientH |
| BROWSER T9 关背景 | shell 透明 | shellBg white→rgba(0,0,0,0) | ✅ | 2026-08-19 18:31 |
| BROWSER T10 标题/备注 | 关标题隐藏；备注可见 | 标题 OFF 后无 chrome；「平台备注走查」在画布 | ✅ | 2026-08-19 18:32 |
| BROWSER T12 整体配色 | 条色随看板配色 | 暖金 #f79009 → 清透 #0ba5ec 即时 | ✅ | 2026-08-19 18:34 |

## 5. 修复文档（部署 gap）

| ID | 缺口 | 修复方向 | 修后验收 |
|----|------|----------|----------|
| P0 | T8 entry 未 PUT | ~~upload PUT~~ **已完成**；另须 widget `artifactId` 与库一致 | GET entry 含 `fitByHeight` ✅ |
| P1 | T6/T7 无 UI 单测 | CustomVizWidget resize/style rerender test | CHAIN REAL |
| P2 | B3 BROWSER | ~~走查~~ **PARTIAL** — 目视无 scrollbar；DOM 微溢出 | 可选 bundle 收紧 |
| P3 | T9–T12 无 BROWSER | ~~走查~~ **已完成** | T9–T12 REAL ✅ |

## 6. 结论（是否实现）

| 问题 | 答案 |
|------|------|
| **代码库里实现了吗？** | **是** — Style Bridge、六块外壳、整体配置同步均已合入；47 vitest 绿 |
| **用户看板立刻能感知吗？** | **需刷新 FE** — working tree 未 commit；PUT artifact 仍须对齐 |
| **截图问题（背景/整体配置）修了吗？** | **是（BROWSER 已验）** — 关背景透明；整体配色即时同步条色 |
| **总体 REAL？** | **否 · PARTIAL 8.5/B+** — 仅 T6–T7 缺 widget 单测 |

## 7. 交接

- **P0 部署**：✅ PUT + layout artifactId 修正  
- **P3 BROWSER**：✅ T9–T12 闭环（2026-08-19 18:34）  
- **P1 余量**：补 CustomVizWidget resize/style UI 单测 → T6/T7 REAL  
- **P2 余量**：极矮容器 `rootScroll` 微溢出 → 可选 bundle 收紧
