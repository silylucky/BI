# VitalSpan 架构审计 · 全仓加深候选

```yaml
date: 2026-08-17
scope: 整仓（fe/charts · fe/dashboard · backend designer/export/query）
scan_tools: rg-only（codegraph CLI 可用，本轮未量测扇入）
status: DONE_WITH_CONCERNS
top_recommendation: C-1
```

## Arch Card

| 项 | 内容 |
|----|------|
| 域语境 | `docs/arch.md` · `docs/automate/goal.md`；无独立 `CONTEXT.md` / `docs/adr/` 目录（ADR 内嵌 arch §2） |
| 栈 | FastAPI `backend/app/` · React `fe/` · ChartEngine D3 单轨（ADR-03 文案仍写 AntV 生产） |
| 范围 | 图表引擎、看板像素画布、查询设计双 API、导出委托执行 |
| 已知痛点 | 图例双轨、grid/pixel 双管线、ADR-15 重复 validate/preview |

## 候选表

| ID | 标题 | 强度 | 授权级 | 簇 glob | ADR |
|----|------|------|--------|---------|-----|
| C-1 | Export 合成 admin 主体泄漏 | Strong | **structural** | `backend/app/dashboard/export*.py` | ADR-18 未禁止；与 R5 冲突需修 |
| C-2 | 图例 resolution 双轨（shell vs inline） | Strong | local-deepen | `fe/src/components/charts/engine/**` | — |
| C-3 | Query Design Kernel（ADR-15 收敛） | Strong | structural | `backend/app/designer/**` · `governance/query_design/**` | ADR-15 中期一致 |
| C-4 | PixelCanvas 几何层渗漏 | Strong | local-deepen | `fe/src/components/dashboard/pixelCanvas/**` | — |
| C-5 | Chart SceneCompiler 四段管线 | Strong | structural | `fe/src/components/charts/engine/**` | ADR-03/13 漂移 |
| C-6 | 看板插入 grid/pixel 双实现 | Worth exploring | local-deepen | `fe/src/pages/admin/dashboard/**` | — |

---

### C-1 · Export 合成 admin 主体泄漏

- **Files**: `export_snapshot.py`, `export_token.py`, `export_persistence.py`, `auth/middleware.py`, `api/v1/dashboards.py`；对照 `integration/embed_token.py`
- **Problem**: export token 校验后构造 `roles=["admin"]` 的 `UserContext` 调 `query_service.execute_query`，authorization seam 泄漏；embed 已从 token 还原签发者。
- **Solution**: 加深 `delegated_execute` module：`resolve_delegated_actor` + scoped datasource；token 持久化签发者快照。
- **Wins**: locality · leverage · 可测授权边界
- **Authorization**: structural（token 语义、middleware 公开路径、query 执行策略）

### C-2 · 图例 resolution 双轨

- **Files**: `legendSnapshot.ts`, `buildDatasetEncoding.ts`, `ChartRenderer.tsx`, `d3Legend.ts`, 各 `render*.ts`
- **Problem**: shell 图例从 rows+encoding 重算；inline 从 plan.data 分组上色，同一概念双 interface，seam 泄漏。
- **Solution**: `compileLegendItems(vm, plan, style)` 单真源；D3/React 只绘制。
- **Wins**: locality · 测试面统一 · 消最近图例遮挡类回归
- **Authorization**: local-deepen

### C-3 · Query Design Kernel

- **Files**: `designer/preview.py`, `designer/service.py`, `governance/query_design/service.py`, `api/v1/designer.py`, `gov.py`
- **Problem**: designer/gov 双 entry，gov preview-execute 与 designer translate 语义分叉；`service.py` 纯 re-export（shallow）。
- **Solution**: `designer/translator/` deep module；gov 降为 persistence+ACL adapter。
- **Wins**: leverage · ADR-15 落地 · DUP-01 单点修
- **Authorization**: structural

### C-4 · PixelCanvas 几何层渗漏

- **Files**: `PixelCanvas.tsx`, `layoutSanitize.ts`, `dashboardCanvasMode.ts`, `useDashboardCanvasState.ts`
- **Problem**: `fitCanvasHeightToContent` 住在 1105 行 UI 组件，save 管线 import UI 文件，domain↔UI 无 locality。
- **Solution**: 抽出 `canvasMetrics.ts` + `layoutPipeline.ts` 门面；PixelCanvas 仅渲染/交互。
- **Wins**: locality · 可单测 sanitize · 减循环依赖
- **Authorization**: local-deepen

### C-5 · Chart SceneCompiler

- **Files**: `buildChartViewModel.ts`, `buildChartRenderPlan.ts`, `applyChartStyleChain.ts`, `buildRenderConfig.ts`, `renderDispatch.ts`
- **Problem**: ViewModel→Plan→Style→Dispatch→render 四跳；`chartViewModelToRenderSpec` deprecated 仍大量使用；`antv/spec` 命名误导。
- **Solution**: `compileChartScene(vm, style) → { plan, dispatch, legend }`；合并重复 plotType 路由。
- **Wins**: depth · AI 可导航 · 测试打在 compiler interface
- **Authorization**: structural

### C-6 · 看板插入双管线

- **Files**: `DashboardEditPage.tsx`, `createLayoutWidget.ts`, `createPixelWidget.ts`, `tabInsertResolver.ts`
- **Problem**: `pixelEnabled=true` 下 grid 插入分支成死代码但仍维护；Tab 逻辑三处散射。
- **Solution**: `paletteInsert` use-case；编辑态仅 pixel；grid 限只读预览。
- **Wins**: locality · 减 761–838 行死分支
- **Authorization**: local-deepen（需确认 v1 是否仍可编辑）

## Top Recommendation

**C-1**：export 以合成 admin 执行查询是明确 authorization 泄漏，与 embed 对称模式已存在，优先修。

## Blind spots

- `reports/render/` 未深探
- `ingestion/` · M8 治理全链路未扫
- codegraph 扇入/扇出未量测（`scan_tools: rg-only`）

## 交叉

- `query/dataset/executor.py` stub → 建议另跑 **code-reviewer** 查假绿（并入 C-3/C-5 备注，非主战场）
