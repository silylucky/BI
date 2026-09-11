# 项目锚定方案评审 — 像素画布「松手仅宽高补测」收口方向

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `~/.cursor/skills/project-grounded-review/` |
| 模式 | crystallize |
| 问题 | code-reviewer 判「未完成」后，该怎么做才能真正收口用户规则？ |
| 选项 / 候选方向 | A 全量 CR 清零 · B 关广播旁路+主路径验收 · C 全引擎对齐 · S0 维持现状 |
| 裁决 | **RECOMMEND_B**（HYBRID：吸收 A 的 P0/部分 P1，拒 C 扩面、拒 S0） |
| 方向纠正强度 | **改道**（从「修完 CR 清单」→「关总线旁路 + 用户规则可验收」） |
| 置信度 | **HIGH** |
| **交付** | 读(§0) + 判(§1–6) + 纠(§7) + 给(§8–§9) |

---

## 0. 对话上下文与第三方读法

**已共识**（对话）：

- 未碰到的组件，松手也不应刷新/重绘。
- 碰撞推位 alone 不应重绘。
- **只有宽/高变了**才应 remasure / redraw。
- 背景点阵/decor 应为展示层；松手不应消失（此前已有 materialize 修复）。
- `collectGeometryChangedWidgetIds` 只比 w/h；空 `widgetIds` 不派发；cancel 不广播 —— 主路径方向正确。

**仍摇摆**：

- 「完成」的边界：仅 D3/表格像素画布主路径，还是含 GisMap / CustomViz / 栅格 / 图例？
- code-reviewer 全量（P0+P1+P2）是否本批必清？用户尚未确认修哪些级。

**隐含假设**：

- 用户体感里的「全图刷新」≈ 图表引擎重绘 / 视觉闪一下，不只 React 重渲染。
- 像素编辑画布是当前痛点主战场（碰撞 + 拖移场景），栅格看板非本轮焦点。
- 对标 DataEase `isPlayer` 单轨几何（仓内已有 plan/注释），但 **禁止** 引入 DataEase 运行时（arch NFR-08）。

**已排除**：

- 未要求整仓 code-reviewer 或上线门禁级扫盘。
- 未要求本批改后端 / API / PRD 新功能。
- 对话明确：碰撞推位不应触发重绘（不是「推了也要重绘」）。

**第三方读法**（不站队用户/Cursor）：

> 作为外部顾问，我认为当前真正的问题不是「CR 清单还剩几条」，而是 **geometry-committed 总线仍存在「省略 widgetIds = 全画布」的兼容旁路**，图例等消费者在解析失败时会把它重新打开——于是用户规则在主路径修好后仍会被旁路打穿。  
> 与项目约束的张力是：Cursor 容易把「引擎对齐 + P2 decor 边角」捆进同一批，而里程碑与 feature-truth 已把 customViz/GIS 标为独立引擎 Out；用户要的是 **可感知的松手安静**。  
> 建议把力集中在：**关死全画布广播 → 主路径 fail-closed → 手测/单测验收四条规则**；GisMap/CustomViz 另开小批，勿与本批混装。

**Review Progress**: [✅]0问询 [✅]0b对话 [✅]1真理源 [✅]2选项 [✅]3–5证据裁决 [✅]6§7 [✅]7–8方案 [✅]9落盘

---

## 1. 项目约束摘录

| ID | 来源 | 约束/现状 | 对方案的影响 |
|----|------|-----------|--------------|
| C-01 | `docs/arch.md` NFR-08 | BI 层零 Superset/DataEase **运行时**依赖；可对标设计 | 可学 isPlayer 语义，禁止搬 DE 运行时 |
| C-02 | `docs/automate/goal.md` G3 | 仪表板为 BI 展现主链 | 编辑体验卡顿/乱刷直接影响 G3 体感，值得收口 |
| C-03 | `docs/feature-truth/2026-08-27-dashboard-collision-chart-zoom-truth-audit.md` | 碰撞+缩放 PARTIAL；**Out**：customViz HTML、GIS MapLibre | 本批勿把 Out 引擎当「完成」必要条件 |
| C-04 | `docs/automate/plans/2026-07-20-data-screen-resize-geometry-pipeline.md` | 对标 isPlayer：交互期跟手，commit 后 layout 权威 + 广播 remeasure | 与「仅宽高广播」一致；需收窄广播范围 |
| C-05 | `docs/reviews/code-reviewer/2026-08-28-pixel-size-only-remeasure-change-surface.md` | P0 Legend 全广播；P1 引擎缺口/force/假绿测 | 真理源级「未完成」证据；修批须对账 P0 |
| C-06 | 现码 `pixelShapeLiveResize.ts` | `[]` 不派发；省略 ids = 全画布兼容 | 兼容广播是旁路根因，须产品化收紧 |
| C-07 | 现码 `PixelCanvas` handleCommit/Cancel | 仅 changedIds；cancel 不 notify | 主路径已对齐用户规则，勿重写 |

---

## 2. 问题重述

**用户问题**：code-reviewer 说没完成，那要怎么做？

**纠正后问题**：在 **不扩引擎面** 的前提下，如何让像素画布编辑满足四条用户规则，并堵住会打穿规则的 **geometry 总线旁路**，使「完成」可验收？

---

## 3. 选项归一

| ID | 名称 | 一句话 |
|----|------|--------|
| **A** | 全量 CR 清零 | 一次修完报告 P0+P1+P2（含 GisMap/CustomViz/decor 边角）再宣称完成 |
| **B** | 关旁路 + 主路径验收 | 先关 Legend/fail-closed/D3 force + 测；引擎对齐另批 |
| **C** | 全引擎对齐优先 | 先把 GisMap/CustomViz/Grid 全部接入同一管线，再谈旁路 |
| **S0** | 维持现状 | 主路径已够，旁路「少见」可接受 |

---

## 4. 证据与假设

| 证据 | 锚点 | 支持 |
|------|------|------|
| E1 主 commit 仅 w/h | `collectGeometryChangedWidgetIds` + 单测 | B、拒 S0 部分「已完美」 |
| E2 Legend `dispatch(undefined)` | `EmbeddedChartLegend.tsx:252` | 否决 S0；A/B 必含 |
| E3 `!widgetId → true` | `pixelShapeLiveResize.ts:48` | B 必含 fail-closed |
| E4 feature-truth Out GIS/customViz | 2026-08-27 审计 §1 Out | 否决 C 作为本批完成条件；弱化 A 的 P1-1 紧迫性 |
| E5 D3 commit force | D3CanvasView/GeoMapView | B 应收；否则旁路仍无差重绘 |
| E6 decor 主路径已 materialize | stylePipeline + canvasBackground 测 | P2 decor 非本批阻塞 |

**假设（标置信）**：

- H1：用户近期复现主要在像素画布拖移/碰撞（HIGH）
- H2：图例 RO 在编辑态会实际触发（MEDIUM；CR 静态成立，缺浏览器复现）
- H3：GisMap/CustomViz 本周非主编辑对象（MEDIUM；与 feature-truth Out 一致）

---

## 5. 多维打分

| 维 | A 全量 CR | B 关旁路验收 | C 全引擎 | S0 |
|----|-----------|--------------|----------|-----|
| 对用户四条规则命中 | 高（慢） | **最高（快）** | 中（易拖） | 低 |
| 与 C-03 Out 一致 | 低 | **高** | 低 | 中 |
| 实现成本/风险 | 高 | **低–中** | 高 | 零 |
| 可验收性 | 清单绿≠体感 | **规则探针清晰** | 难一次验完 | 无 |
| 假绿风险 | 测可补 | **须含测** | 面大测薄 | 高 |

**加权倾向**：B ≫ A（A 可作 Phase 2）> S0；C 作后续里程碑，不作本批 North Star。

---

## 6. 裁决

**RECOMMEND_B**（合成吸收：A 的 P0 + P1-2/3/4/5；**推迟** A 的 P1-1 与全部 P2；**拒绝** C 作为完成定义；**拒绝** S0）。

| 否决 | 理由 |
|------|------|
| A 一次清零 | 把 Out 引擎与 decor 边角捆进「完成」，扩大失败面，延误用户规则验收 |
| C 全引擎优先 | 与 feature-truth Out 冲突；不解决 Legend 全广播则主路径仍会炸 |
| S0 | P0 旁路与用户原话直接矛盾 |

置信度 **HIGH**：主路径代码与 P0 证据均可定位；H2 缺浏览器 → Phase 1 验收须含手测。

---

## 7. 规划方向纠正

**第三方一句话**：先把 geometry 总线改成「默认不广播、解析失败不响应」，再验收「未碰不刷」；别用「修完所有 CR」定义完成。

**原方向错在哪**：

- 对话与实现一度停在「commit 过滤 widgetIds」，但 **省略 ids 的全画布兼容** 仍被 Legend 等调用方使用。
- Cursor/CR 把「完成」扩成引擎对齐 + P2，偏离用户四条可观察规则。
- 与 C-03：GIS/customViz 本就标 Out，不应阻塞本批宣称。

**纠正后目标（一句话）**：

> 像素画布编辑：松手仅对 **宽/高实际变化** 的组件触发图表补测重绘；任何旁路不得全画布广播；以手测+单测可证伪。

**应停止**：

- 以「GisMap/CustomViz 未接入」否定本批主路径交付。
- 未关 P0 前宣称「已完成」。
- 同批塞 decor 清空/主题 rematerialize 等 P2。

**应优先**：

1. Legend + `geometryCommitAffectsWidget` fail-closed（P0 / P1-2）
2. D3 commit 尺寸守卫 + ChartRenderer 松手 remeasure 收紧（P1-3 / P1-5）
3. move vs resize 集成断言（P1-4）
4. 浏览器手测四条规则

**与里程碑对齐**：

| 对齐项 | 当前倾向 | 项目 | 纠正建议 |
|--------|----------|------|----------|
| 范围 | CR 全引擎 | feature-truth Out GIS/customViz | 本批仅像素画布主引擎 |
| 语义 | 省略=广播 | isPlayer plan 要 commit 广播 | **改为** 省略禁止或仅显式 `broadcast: true` |
| 完成定义 | 清单全绿 | G3 编辑体感 | 用户规则手测通过 = 完成 |

**建议回写（供确认，勿自动改）**：

- plan/PRD：可不新开功能 ID；若回写，建议一句：「像素画布 geometry-committed 仅 scoped；禁止无 ids 广播。」

---

## 8. 推荐解决方案（合成）

### 8.1 方案摘要

**名称**：Geometry Bus Fail-Closed · 主路径验收  
**类型**：HYBRID（主路径已有 size-only + 关旁路 + 测）  
**一句话**：关死全画布 geometry 广播，收紧 D3/ChartRenderer 松手补测，用四条用户规则验收；引擎对齐另批。

### 8.2 目标与非目标

| 目标（Phase 1） | 非目标（本期不做） |
|-----------------|-------------------|
| P0 Legend 不再 `dispatch(undefined)` | GisMap / CustomViz 管线对齐（Phase 2） |
| scoped 事件下 `!widgetId → false` | DashboardGrid 统一 geometry bus |
| D3 commit 无尺寸差不强制全量重绘 | decor 清空/主题 rematerialize（P2） |
| 单测：move-only 0 派发 / resize 仅目标 id | 浏览器自动化全覆盖（手测可先） |
| 手测：拖移、碰撞、缩放、decor | 整仓 code-reviewer 再扫 |

### 8.3 架构与触及面

| 层 | 动作 | 路径/模块 | 复用 |
|----|------|-----------|------|
| shared 事件 | fail-closed + 禁止省略广播（或显式 flag） | `pixelShapeLiveResize.ts` | 现有 `dispatch`/`geometryCommitAffectsWidget` |
| entry 图例 | RO delta + 仅 scoped；无 id 不派发 | `EmbeddedChartLegend.tsx` | `resolvePixelWidgetIdFromElement` |
| chart engine | commit 尺寸守卫 | `D3CanvasView` · `D3GeoMapView` | `embeddedSizeChanged` |
| chart shell | 松手 remeasure 条件化 | `ChartRenderer.tsx` | `useElementSize` 相等短路 |
| test | move vs resize | `pixelShapeLiveResize.test.ts` + 轻量 hook/集成 | 现有工具测 |

### 8.4 实施步骤（有序）

| 步 | 内容 | 依赖 | 验收 |
|----|------|------|------|
| 1 | `dispatch`：省略 ids 改为不派发或要求 `broadcast:true`；更新注释/测试 | — | 单测：omit 不触发 handler；empty 仍早退 |
| 2 | `geometryCommitAffectsWidget`：有 `widgetIds` 且 `!widgetId` → false | 1 | 单测 fail-closed |
| 3 | Legend：无 widgetId 不派发；RO 比 w/h delta | 1–2 | 静态审 + 单测 mock RO 可选 |
| 4 | D3 `onCommitResize`：无 `embeddedSizeChanged` 则 skip（或 force 仅脏） | — | 现有 D3 测不回归；可加断言 |
| 5 | ChartRenderer：去掉或收紧 playing→false 无条件 `remeasureBody` | — | 拖移手测无闪 |
| 6 | 补「move-only → 不 dispatch / resize → 仅 id」测试 | 1 | `pnpm exec vitest run …pixelShapeLiveResize…` |
| 7 | 手测四条规则（硬刷新） | 1–6 | 见 §10 |

### 8.5 风险与回退

| 风险 | 缓解 | 回退 |
|------|------|------|
| 某处仍依赖「省略=全广播」 | rg `dispatchPixelLayoutGeometryCommitted(`；逐步改 scoped | 临时加 `broadcast: true` 显式 API，默认关 |
| 图例分页后图表区需补测但无 id | 栅格补 `data-component-id` 或局部 callback | 仅本 widget 内 remeasure，仍禁止全局 |
| H2 旁路实际很少触发 | 仍修 P0（正确性）；手测验证体感 | — |

### 8.6 对 Cursor 原方案的具体纠正

| 原建议 | 问题 | 纠正后做法 |
|--------|------|------------|
| 修全量 P0+P1+P2 才算完成 | 完成定义过宽 | Phase 1 = B；P1-1/P2 → Phase 2 |
| 先对齐 GisMap/CustomViz | 与 feature-truth Out 冲突 | 另开小批，不阻塞宣称 |
| 主路径 size-only 已够 | Legend 旁路可打穿 | 总线 fail-closed 优先于扩引擎 |
| cancel 也 notify 当前组件 | 用户要「仅宽高」 | 保持 cancel 不广播（现码） |

---

## 9. 规划提纲（交 plan-create）

**背景与目标**：关死像素画布 geometry 全广播旁路，使松手仅宽高变化组件补测，四条用户规则可验收。  

**硬约束**：C-01（无 DE 运行时）、C-03（本批不含 GIS/customViz 完成条件）、C-06/C-07（复用现有 size-only 主路径）。  

**改动清单草案**：

1. `pixelShapeLiveResize.ts` — 省略 ids 行为收紧 + fail-closed  
2. `pixelShapeLiveResize.test.ts` — 覆盖 omit/empty/scoped/`!widgetId`  
3. `EmbeddedChartLegend.tsx` — 无 id 不派发 + RO delta  
4. `D3CanvasView.tsx` / `D3GeoMapView.tsx` — commit 尺寸守卫  
5. `ChartRenderer.tsx` — 收紧松手 remeasure  
6. （可选）栅格 widget 补 `data-component-id` 若 Legend 仍解析失败  
7. 手测清单写入计划验收节  

**验证方案**：见 §10。  

**非目标**：GisMap/CustomViz/Grid 统一管线；decor P2；整仓 CR。  

**待验证 spike**：浏览器确认 Legend RO 是否在拖移场景触发（不阻塞 P0 修复）。  

**Phase 2（另计划）**：GisMap + CustomViz 接入 `useEmbeddedChartLiveResize`；decor 清空不 wipe。

---

## 10. 验证命令

```bash
# 工具与回归（在 fe/）
pnpm exec vitest run src/components/dashboard/pixelCanvas/pixelShapeLiveResize.test.ts
pnpm exec vitest run src/components/dashboard/pixelCanvas/PixelCanvas.test.tsx
pnpm exec vitest run src/components/charts/engine/d3/views/D3CanvasView.test.tsx
```

**手测（硬刷新后）**：

1. 纯拖移 A：B/C 图表不闪、不重绘；decor 仍在  
2. 拖移致碰撞推 B：B 仅位移，图表不重绘  
3. 缩放 A：仅 A 重绘  
4. 带图例图表：改图例分页/方位后，**其它**组件不重绘  

---

## 11. 交接与下一步

1. 用户确认本裁决（RECOMMEND_B）→ `/plan-create` 消费本报告 §9，或直接按 §8.4 执行。  
2. 若坚持「引擎也要齐」→ 开 **Phase 2** 计划，勿并入 Phase 1 完成定义。  
3. 修完后可用 feature-truth 或短 CR 变更面复检，焦点仅四条规则 + P0 关闭。

---

## 简报

1. 落盘：`docs/reviews/grounded/2026-08-28-pixel-size-only-remeasure-adjudication.md`  
2. 模式：crystallize · 裁决：RECOMMEND_B · 置信度 HIGH  
3. 第三方结论：先关 geometry 全广播旁路并验收「未碰不刷」，勿用 CR 全量清单定义完成。  
4. 纠正：原方向「修完所有 finding」→ North Star「总线 fail-closed + 四条规则可证」。  
5. 推荐：Phase1 Legend/fail-closed/D3 守卫/测 → 下一步 `/plan-create` §9 或直接执行 §8.4。  
6. 验收：vitest 上述文件 + 手测拖移/碰撞/缩放/图例旁路。
