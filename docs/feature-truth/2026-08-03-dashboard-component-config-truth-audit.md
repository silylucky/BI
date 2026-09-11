# Feature Truth Audit: 全组件配置功能真实性（S1–S5）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-03 |
| 核验范围 | **5 配置壳层**：S1 看板编辑 · S2 大屏 · S3 可视化组件 · S4 查询设计器 · S5 报表模板块 |
| 锚点 | `DashboardEditPage` · `ScreenVisualEditRail` · `VizComponentEditPage` · `DesignerPage` · `TemplateBlockEditor` |
| 总体判定 | **PARTIAL**（GATE/CHAIN 广覆盖；浏览器主验 S1 原型 + kpi 增量；44 型样式 T7 未全量 BROWSER） |
| **总分 / 档位** | **7/10 · C+** |
| 状态 | **draft**（待用户批准 P0 修复或交接） |
| sampling | **none**（计划要求全量枚举 §3d；浏览器按「切换图表」单 widget 扫型 + 交叉面） |
| 差分基线 | [2026-07-30 样式 truth](2026-07-30-component-style-per-type-truth-audit.md) · [2026-08-03 GATE 矩阵](../material/chart-style-audit/2026-08-03-full-matrix.md) |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T-Data | 数据 Tab：绑数据集 → 字段槽可拖入 → 校验通过 → 画布预览有数据/合理空态 | DE chart-edit 对标 |
| T-Style | 样式 Tab：profile 内 section 控件改值 → **300ms 内预览可见变化** | land-design G1–G14、07-30 T7 |
| T-Adv | 高级 Tab：缩略轴/辅助线/条件样式/跳转 开关与保存后预览或配置持久 | `ChartAdvancedPanel` caps |
| T-Widget | 四类 widget inspector 字段写入 widget 配置并影响画布 | widget rails |
| T-Screen | 大屏素材 clock/border/shape/icon/title/datetime 写入 `screenStyle` | G20 |
| T-Dash | 无选中时看板级样式影响子 chart 继承项 | `DashboardContextInspector` |
| T-Viz | S3 与 S1 同一 `ChartEditRail` 行为一致 | `ChartEditorColumn` |
| T-Designer | 设计器各面板改值后 SQL 预览/执行结果符合 | `DesignerPage` |
| T-Report | 模板块增删改排序保存成功且导出链路可读 | `TemplateBlockEditor` |

**Out（登记不计必验 REAL）**：deprecated 5 chartType（`table`/`timeline`/`wordCloud`/`heatmap`/`combo`）、Embed 只读、报表查看页消费态。

**2026-08-03 增量必复验（不得沿用 07-30 STUB）**：
- **kpi**：单槽「指标」、维度→计数/数值→求和、数值在上/标签在下、样式「对齐 左/中/右」→ `renderKpi.ts`

---

## 2. 范围清单（Step 0b）

| 实体类型 | 总数 | Out | 必验 | 清单来源 |
|----------|------|-----|------|----------|
| 活跃 chartType | 44 | 0 | 44 | `BUILTIN_PLUGIN_DEFS` 非 deprecated |
| chart 配置域 × 3 Tab | 132 | ~12 advanced-out | **132** | `chartHasAdvancedTab` + `chartStyleAuditMatrix.ts` |
| 看板 widget | 4 | 0 | 4 | filter / text / media / tabs |
| 大屏素材样式 | 6 | 0 | 6 | clock / border / titleBar / dateTime / shape / icon |
| 看板级配置 | 3 | 0 | 3 | dashboard-style / widget-style / context |
| 查询设计器面板 | 4 | 0 | 4 | SQL / Conditions / OutputFields / ComputeRules |
| 报表模板块编辑 | 1 | 0 | 1 | blockType + queryRef |
| **合计 §3d 主行** | **154** | 5 deprecated 另表 | **154** | 压缩表见 [`_generated-2026-08-03-3d-table.md`](_generated-2026-08-03-3d-table.md) |

---

## 3. 子能力判定（T 级）

| ID | 子能力 | 判定 | 总分/档 | 证据 |
|----|--------|------|---------|------|
| T-Data | 44 型字段槽 + 数据集绑定 | **PARTIAL** | 8/B | `catalog.test.ts` 7/7 CHAIN · BROWSER bar/kpi 槽文案 ✓ · 未全型拖字段 |
| T-Style | 样式 Tab → 预览 T7 | **PARTIAL** | 6/C | GATE 44/44 · BROWSER bar 20+ 控件挂载 · kpi 指标样式 REAL · 其余型未 L1 |
| T-Adv | 高级 Tab caps | **PARTIAL** | 7/C+ | BROWSER bar 高级 Tab 存在 · kpi/map-3d 无高级 Tab ✓ |
| T-Widget | 四类 widget | **REAL** | 8/B | `widgetRailStyleSections.test.tsx` 3/3 userEvent |
| T-Screen | 大屏素材 G20 | **REAL** | 9/A | `ScreenVisualEditRail.test.tsx` 8/8 · BROWSER S2 1920 画布+图层列表 |
| T-Dash | 看板级配置 | **REAL** | 8/B | BROWSER 无选中时「仪表板配置」7 section 可见 |
| T-Viz | S3 ChartEditRail 一致 | **UNVERIFIED** | — | 页面 `/admin/viz-components` 可达 · 未深验编辑页 |
| T-Designer | 查询设计器 4 面板 | **PARTIAL** | 5/D | 代码实装 `DesignerPage`+panels · 浏览器首屏未完整快照 |
| T-Report | 模板块编辑 | **UNVERIFIED** | — | `/admin/reports/templates` 可达 · 块编辑未 BROWSER |

**T 汇总（最低分）**：7/C+ · **PARTIAL**

---

## 3b. 前端控件下钻（摘要）

> 完整 33 section 控件表继承 [07-30 §3b-ext](2026-07-30-component-style-per-type-truth-audit.md)；本节仅 **2026-08-03 BROWSER 增量** 与 **新发现 BROKEN**。

### S1 · ChartEditRail（BROWSER 主验）

| Bx | 控件 | handler | 期望 | 实际 | L | C | D | E | F | 判定 | 证据 |
|----|------|---------|------|------|---|---|---|---|---|------|------|
| B-S1-01 | 切换图表 combobox | `ChartEditorColumn` | 列出 44 活跃型 | listbox 44 option ✓ | 2 | 2 | 2 | 2 | 2 | **REAL** | BROWSER 2026-08-03 |
| B-S1-02 | bar·类别轴/值轴槽 | `ChartDataSlots` | DE 文案 | 「类别轴/维度」「值轴/指标」✓ | 2 | 2 | 2 | 2 | 2 | **REAL** | BROWSER |
| B-S1-03 | kpi·单指标槽 | `ChartDataSlots` | 仅「指标」 | 「指标，拖动字段至此处」✓ | 2 | 2 | 2 | 2 | 2 | **REAL** | BROWSER 重验 |
| B-S1-04 | kpi·指标样式·字号 | `ChartTypeStyleSections` | 默认 40 | slider value=40 ✓ | 2 | 2 | 1 | 2 | 2 | **REAL** | BROWSER |
| B-S1-05 | kpi·指标对齐 | `ChartTypeStyleSections` | 左/中/右 | combobox「指标对齐」✓ | 2 | 2 | 1 | 2 | 1 | **PARTIAL** | UI 有；预览对齐需有数据后复验 |
| B-S1-06 | bar·背景不透明度 | `ChartStylePanel` | 改值→预览 | slider 可交互 ✓ | 2 | 1 | 1 | 2 | 1 | **PARTIAL** | 挂载 REAL；300ms 视觉未截图 |
| B-S1-07 | bar·图例/标签/提示 | 各 section | 改值→预览 | 20+ 控件挂载 ✓ | 2 | 1 | 1 | 2 | 1 | **PARTIAL** | GATE+UI；T7 单点 |

### S2 · 大屏素材（BROWSER + CHAIN）

| Bx | 控件 | 判定 | 证据 |
|----|------|------|------|
| B-S2-01 | 1920 画布 + 大屏配置 | **REAL** | BROWSER 指挥台三栏 demo |
| B-S2-02 | 图层列表 clock/border/title | **REAL** | BROWSER 9 层枚举 |
| B-S2-03 | clock·样式面板 | **REAL** | `ScreenVisualEditRail.test.tsx` userEvent |

### S4 · 设计器（代码 + 待 BROWSER）

| Bx | 面板 | 判定 | 证据 |
|----|------|------|------|
| B-S4-01 | SQL | **PARTIAL** | `DesignerSqlPanel` 实装 · BROWSER 未跑通 |
| B-S4-02 | Conditions | **PARTIAL** | `ConditionsPanel` |
| B-S4-03 | OutputFields | **PARTIAL** | `OutputFieldsPanel` |
| B-S4-04 | ComputeRules | **PARTIAL** | `ComputeRulesPanel` |

---

## 3d. 覆盖矩阵

> **完整 110 行压缩表**：[`_generated-2026-08-03-3d-table.md`](_generated-2026-08-03-3d-table.md)  
> **机器可读 JSON**：[`_generated-2026-08-03-matrix.json`](_generated-2026-08-03-matrix.json)

### Phase A · GATE 静态（2026-08-03）

| 命令 | 结果 |
|------|------|
| `chartTypeStyleProfiles.test.ts` | **10/10** ✅ |
| `chartStyleSectionRegistry.test.ts` | **4/4** ✅ |
| `catalogParity.test.ts` | **4/4** ✅ |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体（§3d 主行） | **154** |
| GATE 覆盖 | **154/154** ✅ |
| CHAIN 覆盖（data 槽 + 部分 style/render） | **~120/154** |
| BROWSER 覆盖（L1 真机） | **~18/154**（S1 bar/kpi 深验 + S2 壳层 + 看板级） |
| REAL 达标（L1 且 C≥2） | **~25/154** |
| **逐一校验** | **否** — 44 型 × 样式 section 未全量 BROWSER T7 |
| 总体可否 REAL | **否** — 大量样式仍为 GATE/CHAIN-only |

### HARD-GATE-COVERAGE

| 检查项 | 结果 |
|--------|------|
| §3d 行数 = 必验实体数 | ✅ 154（+ 压缩表 110 行） |
| GATE-only 标 REAL | ❌ 无违规（GATE-only 最高 STUB/PARTIAL） |
| §3b 有「代表性」省略 | ⚠️ 33 section 继承 07-30；本轮补 BROWSER 增量行 |
| kpi 增量重验 | ✅ 2026-08-03 BROWSER |

---

## 3c. 五维评分汇总

| 维度 | 分 | 说明 |
|------|-----|------|
| L 可达性 | 2 | 配置壳层均可路由到达 |
| C 正确性 | 1 | 多数样式 GATE-only；kpi 增量已 REAL |
| D 深度 | 1 | BROWSER 仅 ~12% 实体 |
| E 异常 | 2 | 空态/校验中文提示可见 |
| F 反馈 | 1 | 未保存拦截 ✓；部分 vitest 红 |

**档位**：C+（7/10）

---

## 4. 动态验证记录（BROWSER）

| 时间 | 表面 | 操作 | 期望 | 实际 | 截图/备注 |
|------|------|------|------|------|-----------|
| 16:12 | S1 | 选中 bar·数据 Tab | 类别/值轴槽 | ✓ 渠道+销售额已绑 | demo 看板 `…0001` |
| 16:13 | S1 | bar·样式 Tab | section 控件 | ✓ 背景/标题/图例/标签/提示 | 20+ 控件 |
| 16:13 | S1 | 切换图表 listbox | 44 型 | ✓ 44 option | 含柱线组合 4 型 |
| 16:14 | S1 | 切 kpi·数据 | 单「指标」槽 | ✓ | **2026-08-03 重验** |
| 16:14 | S1 | kpi·指标样式 | 字号40+对齐 | ✓ combobox | align 预览待有数据 |
| 16:17 | S2 | 指挥台大屏 | 1920 画布 | ✓ | demo `…0002` |
| 16:17 | S2 | 图层管理 | clock/border | ✓ 9 层 | |
| 16:18 | S1 | 看板级 | 仪表板风格 | ✓ 浅/深主题 | 无选中 widget |

**环境**：`http://localhost:5174/admin` · admin/changeme · FE `pnpm dev` · BE uvicorn:8000

---

## 5. 修复建议（§5 · 无批准不改代码）

| P | 项 | 根因 | 建议 |
|---|-----|------|------|
| **P0** | kpi 对齐 BROWSER C=1 | 无指标数据时空态无法目视对齐 | 绑 demo 数据集后补 1 条 BROWSER 截图 |
| **P1** | `ChartStylePanel.test.tsx` deprecated table | 测期望「图表配色」与 profile 移除 palette 不一致 | 更新测例或标 Out |
| **P1** | `MediaEditRail.test.tsx` TooltipProvider | 缺 Provider 包裹 | 测 setup 补 Provider |
| **P1** | 44 型 T7 样式预览 | 07-30 以来无 BROWSER 批量 | 脚本化「切换图表」+ 每型 1 slider 截图 |
| **P2** | S3 viz 编辑交叉复验 | 本轮未进编辑页 | bar/line/map/kpi/table 五原型 S3 复验 |
| **P2** | S4 Designer BROWSER | 首屏快照空 | 绑 dataset 后跑 SQL 预览走查 |
| **P2** | S5 模板块 | 未 BROWSER | 打开演示模板块增删 |

---

## 6. Phase C · 辅助 vitest（CHAIN）

| 批次 | 结果 | 备注 |
|------|------|------|
| GATE 三包 | **18/18** ✅ | Phase A |
| 样式 bundle（14 files） | **66/68** | 2 FAIL：`ChartStylePanel` deprecated · `MediaEditRail` Tooltip |
| kpi + catalog + screen + widget | **21/21** ✅ | 增量关键路径 |
| `renderKpi.test.ts` | **3/3** ✅ | 对齐/布局 CHAIN |

---

## 7. 交接

- **文档路径**：本文件 + [`_generated-2026-08-03-3d-table.md`](_generated-2026-08-03-3d-table.md)
- **下一步（需用户选择）**：
  1. 批准修 P0/P1 测例与 kpi 对齐目视复验
  2. 交接 `root-first-solve` 批量 T7 BROWSER
  3. 仅报告，不改代码

---

## 附录 · 与 07-30 差分

| 项 | 07-30 | 08-03 |
|----|-------|-------|
| BROWSER | 无 | S1 原型 + kpi 增量 |
| kpi 判定 | STUB/GATE | **REAL**（数据槽+样式 UI） |
| 范围 | 86 样式实体 | **154** 全配置壳层 |
| 总分 | 8/B | **7/C+**（范围扩大后诚实降档） |
