# F17-AIVIZ AI 可视化创作（VS-AI-SPEC）

> 模块：试点 · 混合方案 C  
> 状态：**部分**（规范 + 库源码 customViz + Base 主页面挂载 + manual 数据占位）

## 范围

| In | Out |
|----|-----|
| 对外 `docs/api/vs-ai-spec/` 规范包 | AI 自动生成 SQL / 智能问数 |
| 内置 chartType + `deStyle` 配置（L1/L2） | 动态注册第 50+ chartType 进 plugin catalog |
| 库中 HTML 源码 → 一个 Base 异步加载（L3） | 仓库为每个组件增加 tsx/py |
| `runtime` 仅 `html` \| `d3`；平台注入 `host.vsCv.d3` | 强制走内置 `renderD3Chart`；ECharts/AntV；iframe 沙箱 |
| `layoutJson` v2 混排 chart + customViz | `layout/orchestrate` 规则引擎（M2） |
| `dataBinding.status=manual` 占位保存 | 查询桥（M1：合成 table execute + payload 注入） |
| 同一 artifactId 覆盖更新 | 动态注册第 50+ chartType 进 plugin catalog |
| Payload v1 + `host.vsCv` | 查询桥以外的 Dataset 预绑 |

## 验收标准

- [x] AIVIZ-001：`docs/api/vs-ai-spec/` 含 README、PROTOCOL、schemas、examples
- [x] AIVIZ-002：`POST /api/v1/ai-viz/artifacts` 注册源码；`GET .../entry` 返回 HTML
- [x] AIVIZ-003：`layoutJson` 支持 `type: customViz` + `customVizConfig.artifactId`
- [x] AIVIZ-004：`POST /api/v1/charts/validate` 接受 `nativeBody.dataBinding.status=manual` 且无数据源
- [x] AIVIZ-005：FE `CustomVizWidget` 作为唯一 Base，将 entry HTML 挂进主页面宿主（与看板同页，注入 `--dashboard-*`）
- [x] AIVIZ-008：html/d3 规范 + `theme-tokens.json` + 官方示例；`runtime` 校验，`rendererHint` 仅兼容别名
- [x] AIVIZ-009：`PUT /api/v1/ai-viz/artifacts/{id}` 覆盖同一组件源码；引用方硬刷新或页签重新可见即新
- [x] AIVIZ-006：组件库入库 customViz（M2）
- [x] AIVIZ-007：平台向宿主喂 query 结果（后续）
- [x] AIVIZ-010：Payload v1（`protocolVersion` + `bindingStatus`）；Base 始终注入；bundle 仅监听 `vs-cv-payload-update`
- [x] AIVIZ-012：GET meta/entry 有 `dashboard:read` 即可（共享看板）；列表与 PUT 仍仅属主；官方示例宿主内 querySelector
- [x] AIVIZ-013：检查器「高级」单卡外壳走 `customVizConfig.widgetStyle`（与看板 `widgetStyle` 合并）；组件内视觉仅认 manifest `styleSchema` → payload `--vs-style-*`
- [x] AIVIZ-014：customViz 外壳与 `chrome`（加载提示/编辑条/右键外壳）跟随看板整体配置；组件内视觉仍只认 `styleSchema`；宿主透明底 + `--dashboard-*` / 字体 / 配色 token
- [x] AIVIZ-015：样式 Tab 固定六块（背景/图表配色/标题/备注/标签/提示）写入 `displayStyle` 并注入 payload；manifest `styleSchema` 仅承载组件专属扩展项
- [x] AIVIZ-016：Payload 增 `layout`/`truncated`/`rowCap`；`vsCv.onLayout` + `helpers.thinCategoryTickIndices`；Base capRows + 宿主尺寸监听（仍不调用 `renderD3Chart`）
- [x] AIVIZ-017：`vsCv.mount` 统一 lifecycle；Payload `axisPlan`；壳层 truncated 横幅；customViz 查看数据；d3 入库 lint；[PLATFORM-SLA.md](../../api/vs-ai-spec/guides/PLATFORM-SLA.md)
- [x] AIVIZ-018：`DELETE /api/v1/ai-viz/artifacts/{id}` 属主删库；`?unlink=true` 先从引用 layout 移除 widget 再删；CLI `delete-ai-viz-artifact.py --unlink`；5173 图表盘 / Agent `vitalspan_delete_artifact`（默认 unlink）

## 代码锚点

- 规范：`docs/api/vs-ai-spec/`
- 后端：`backend/app/ai_viz/` · `backend/app/api/v1/ai_viz.py`
- 布局：`backend/app/dashboard/schemas.py` · `fe/src/components/dashboard/CustomVizWidget.tsx` · `customVizHost.tsx`
- 校验：`backend/app/schemas/chart_view.py` · `scripts/export-vs-ai-spec.py`
