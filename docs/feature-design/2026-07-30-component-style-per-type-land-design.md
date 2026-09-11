# Feature Land Design: 组件专有样式设置 · P0 闭环

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-30 |
| 调研对象 | 图表样式 Tab（`ChartEditRail` → `ChartStylePanel`）、看板 widget（`widgetRailStyleSections`）、大屏素材（`ScreenVisualEditRail`） |
| 状态 | **P0 已闭合**（2026-07-30 实施 + Vitest 31 项全绿） |
| **用户确认范围** | **G1, G2, G8, G9, G10, G14, G20**（默认 P0 包） |
| 成功标准 | 确认项样式字段写入 `deStyle`/`screenStyle` 后 300ms 内预览可见；44 活跃 chartType profile 自动化门禁；大屏素材样式 Vitest 回归 |
| 非目标 | G0 在线地图/瓦片/Key；G3–G7、G11–G13、G15–G19（P1/P2）；tooltip 轮播独立 section |
| 启用维度 | 无 |

## 1. 问题与意图

- **现有功能锚点**：`chartTypeStyleProfiles.ts` 已替代 metadata.properties 作为样式 Tab 分区真理源；`applyChartDeStyleBlocksToPlan` 负责 deStyle 块 → D3 plan.options 映射。
- **用户任务**：消除「样式 Tab 有控件但渲染未消费」的假绿，并为 treemap / circle-packing 补齐 DE 对标专有折叠块。
- **Must**：G1/G2 专有 section + 渲染接线；G8/G9 sankey/wordCloud 样式链端到端断言；G14 活跃类型 profile 全覆盖测试；G20 大屏素材样式回归。
- **Nice（P0 内）**：G10 treemap 标签字号接 `labelPresentation`。
- **Out**：在线地图样式、表格高级样式、双轴独立样式、笛卡尔字段矩阵补全。
- **约束**：GEO-IRON-01（地图样式仅离线中国项）。

## 2. 现状审计（P0 闭合后）

| 区域 | 已有 | 剩余缺口（P1+） | 证据 |
|------|------|----------------|------|
| 分区注册 | **33** 种 `ChartStyleSectionId`（P0 +treemap/circlePacking；P1 +quadrant/progressBar/bullet/stockLine） | chart-mix 双轴独立样式（G5） | `chartStyleSectionRegistry.ts` |
| treemap / circle-packing | `treemapShape` / `circlePackingShape` UI + render | 面包屑等 DE 高级项 | `chartTypeStyleProfiles.ts` · `renderTreemap.ts` |
| quadrant / compare 专有 shape | `quadrantShape` / `progressBarShape` / `bulletShape` / `stockLineShape` UI + apply + render | 坐标轴 DE 全量字段（G11） | `ChartCompareStyleSections.tsx` · `applyChartDeStyleBlocks.ts` |
| sankey / wordCloud 样式链 | UI → apply → render + 单测 | legend/label 能力仍 missing（门控隐藏） | `renderSankey.test.ts` · `renderWordCloud.test.ts` |
| treemap 标签 | `labelFontSize` 已接 render | — | `renderTreemap.ts` |
| profile 测试 | 44 活跃型 gated sections 全覆盖 | 逐字段 render 断言（compare 已 apply 单测） | `chartTypeStyleProfiles.test.ts` |
| 大屏素材测试 | 时钟/边框/图形/图标/标题/**datetime** | 字间距/发光等 DE 扩展（G19） | `ScreenVisualEditRail.test.tsx` |
| metadata.properties | **已镜像 profiles（G13）** | — | `plugins/register.ts` · `catalogParity.test.ts` |

## 3. 外部调研（DE 对标摘要）

| 对标点 | 参考 | 可观察行为 | 启示 | 不采纳 |
|--------|------|------------|------|--------|
| 矩形树图样式 | DE attr-style treemap | 内外间距、圆角、标签 | `treemapShape`：paddingInner/Outer/cellRadius | 面包屑导航（P2） |
| 圆形填充图 | DE circle-packing | 层级 padding、标签阈值 | `circlePackingShape`：layoutPadding/labelMinRadius | 力导向物理参数（已有 physics 模块） |
| 桑基图 | DE sankey | 节点宽/间距/链接透明度 | 已有 UI，补测试闭环 | legend（matrix missing，门控隐藏） |
| 词云 | DE word-cloud | 字号区间/间距 | 已有接线，补 render 测试 | 形状 mask（P3） |

## 4. 候选清单与确认记录

### 4.1 曾提出的候选

| ID | 类型 | 标题 | 优先级建议 | 用户确认 |
|----|------|------|------------|----------|
| G1 | add | treemap 专有 `treemapShape` | P0 | ✅ |
| G2 | add | circle-packing 专有 `circlePackingShape` | P0 | ✅ |
| G8 | optimize | sankeyShape → D3 渲染消费 | P0 | ✅ |
| G9 | optimize | wordCloudShape → D3 渲染消费 | P0 | ✅ |
| G10 | optimize | treemap/radar 标签接线 | P1 | ✅（P0 内仅 treemap labelFontSize） |
| G14 | add | 活跃型 profile 自动化门禁 | P1 | ✅ |
| G20 | add | 大屏素材样式 render 回归测试 | P1 | ✅ |
| G3–G7 | add/align | 象限/compare/玫瑰/双轴/表高级 | P1/P2 | ❌ |
| G11–G13, G15 | optimize | 笛卡尔矩阵/三源收敛/文档 | P1/P2 | ❌ |
| G16–G19 | align | widget/大屏 DE 扩展 | P2 | ❌ |
| G0 | out | 在线地图样式 | — | ❌ 违反 GEO-IRON-01 |

**确认时间 / 用户原话摘要**：2026-07-30 — 用户指令「Implement the plan as specified」+ 附门禁 A 调研 plan；未另选 ID，采用 plan §4 默认 P0 包并含 G10 离线 geo 项。

### 4.2 范围外（未做）

- G3–G7、G11–G13、G15–G19：留 P1/P2 backlog。
- G0：在线瓦片/Key 样式。

## 5. 方案比选（仅确认项）

### 推荐

- **做法**：扩展 `ChartDeStyleBlocks`（`treemap` / `circlePacking`）→ 新增 section 组件 → 更新 profile → `applyChartDeStyleBlocksToPlan` 映射 → D3 renderer 读 options → Vitest 门禁。
- **覆盖 ID**：G1, G2, G8, G9, G10, G14, G20

### 备选

- 复用 `cartesianShape` 承载 treemap 字段 — 拒绝（语义不符 DE attr-style）。
- 仅补测试不改 render — 拒绝（G1/G2 缺 UI 块）。

## 6. 架构与边界

- **落点**：`fe/src/lib/chartDeStyleBlocks.ts`、`chartTypeStyleProfiles.ts`、`ChartTypeStyleSections.tsx`、`applyChartDeStyleBlocks.ts`、D3 hierarchy/flow renderers、测试文件。
- **依赖**：`patchChartDeStyleNested`、`ChartStylePanel` 现有折叠框架。
- **不碰**：后端 schema、Dataset/SQL 数据 Tab。

## 7. 数据与契约

### deStyle 新增块

```typescript
treemap?: { paddingInner?: number; paddingOuter?: number; cellRadius?: number };
circlePacking?: { layoutPadding?: number; labelMinRadius?: number };
```

### plan.options 映射

| deStyle 块 | plan.options 键 |
|-----------|----------------|
| treemap.paddingInner | `__treemapPaddingInner` |
| treemap.paddingOuter | `__treemapPaddingOuter` |
| treemap.cellRadius | `__treemapCellRadius` |
| circlePacking.layoutPadding | `__circlePackingPadding` |
| circlePacking.labelMinRadius | `__circlePackingLabelMinRadius` |
| sankey.* | `__sankeyNodeWidth/Gap/LinkOpacity`（已有） |
| wordCloud.* | `__wordCloudFontMin/Max/Spacing`（已有） |

## 8. 分期落地（仅确认项）

| 期 | ID | 范围 | 可验收结果 |
|----|-----|------|------------|
| P0 | G1 | treemapShape UI + render | 改间距/圆角预览变化 |
| P0 | G2 | circlePackingShape UI + render | 改 padding/标签阈值预览变化 |
| P0 | G8 | sankey 样式链测试 | applyChain 断言 sankey options |
| P0 | G9 | wordCloud render 测试 | render 读 __wordCloud* |
| P0 | G10 | treemap labelFontSize | 标签 section 改字号生效 |
| P0 | G14 | profile 44 型测试 | vitest 全绿 |
| P0 | G20 | 大屏标题样式测试 | ScreenVisualEditRail 断言 screenStyle |

## 9. 风险与回滚

| 风险 | 缓解 |
|------|------|
| treemap padding 过大导致空图 | slider clamp + 默认与现硬编码一致 |
| circle-packing 改 padding 破坏 physics 布局 | 仅影响 d3.pack 初始布局，physics 仍 enforce bounds |
| 测试过严导致 deprecated 型失败 | G14 仅扫 `!deprecated` 活跃型 |

## 10. 验收清单（仅确认项）

- [x] G1：treemap 样式 Tab 出现「矩形树图样式」；改内间距预览变化
- [x] G2：circle-packing 出现「圆形填充样式」；改布局间距预览变化
- [x] G8：`applyChartStyleChain` / `applyChartDeStyleBlocks` sankey 字段断言
- [x] G9：`renderWordCloud` 消费 __wordCloud* 单元测试
- [x] G10：treemap 标签字号跟随 label section
- [x] G14：44 活跃 chartType 均有非空 profile sections
- [x] G20：大屏标题 screenStyle 写入测试

## 11. 审批与交接

- **决策**：批准（用户 2026-07-30「Implement the plan」视为门禁 B 通过）
- **交接**：P2 backlog — G5 双轴样式、G6 玫瑰专有控件、G11 笛卡尔字段矩阵、G16–G19 widget/大屏 DE 扩展。审计批次（2026-07-30）已闭合 G3/G4/G13/G15 + renderCirclePacking/datetime 测试。
