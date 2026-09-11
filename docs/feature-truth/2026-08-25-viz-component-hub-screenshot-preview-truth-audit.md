# Feature Truth Audit: 组件库 Hub 截图预览（替代实时渲染）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-25 |
| 核验范围 | 组件库列表卡片预览改为静态封面截图（对齐看板/大屏列表），编辑页仍实时预览；保存时生成封面 |
| 锚点 | `/admin/viz-components` · `VizComponentsHubPage` · `ComponentPayloadPreview` · `PUT/GET /api/v1/viz-components/{id}/thumbnail` |
| 总体判定 | **PARTIAL**（主链路已编码，缺发布路径、API 集成测、真机截图证据；工作区未提交） |
| **总分 / 档位** | **6/10 · C** |
| 状态 | draft |
| **sampling** | `full`（本需求 8 项子能力全量枚举，非 chartType 抽样） |

## 1. 核验标准与预期（来自用户/对话）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 组件库 Hub 卡片**不再实时渲染**图表/customViz（无「正在加载…」、无 GIS/SQL 报错叠在卡片上） | 用户：「组件库这个预览也不要实时的了」 |
| T2 | Hub 卡片预览展示**静态封面截图**，交互与看板/大屏列表一致（鉴权 blob 拉图、`object-cover`） | 用户：「参考大屏和仪表板的预览，用截图方式」 |
| T3 | 组件**编辑页保存**后生成并上传封面，列表刷新可见截图 | 对齐 `persistDashboardThumbnailBestEffort` 模式 |
| T4 | Hub 列表**不再 batch-resolve** 全量 payload 仅为缩略图服务（性能） | 实现侧推论 + 用户截图痛点（41 卡同时 live 渲染） |

- 非目标：44 chartType 逐一验封面像素；Hub 全部按钮（插入/发布/归档等）全量下钻；DeepTalk 插件侧预览。

## 2. 完整链路图

```
[编辑页保存]
  useVizComponentEditor.save
    → PUT /api/v1/viz-components/{id}
    → persistVizComponentThumbnailBestEffort
      → findVizComponentThumbnailCaptureRoot ([data-viz-component-thumbnail-capture])
      → captureDashboardThumbnailBlob
      → PUT /api/v1/viz-components/{id}/thumbnail
    → invalidate vizComponents list

[Hub 列表]
  GET /api/v1/viz-components → thumbnailUrl
    → VizComponentCard → ComponentPayloadPreview
      → VizComponentThumbnailPreview
        → useAuthenticatedBlobUrl → GET .../thumbnail
        → <img> 或占位「保存后将生成封面截图」
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | Hub 去 live 预览 | **通（静态）** | `ComponentPayloadPreview.tsx` 仅引 `VizComponentThumbnailPreview` | 已移除 `VizComponentLivePreview` |
| 2 | Hub 去 batch-resolve | **通（静态）** | `VizComponentsHubPage.tsx` 无 `batchResolveVizComponents` | payload 不再批量拉取 |
| 3 | 列表 thumbnailUrl | **通（静态）** | `service.py:_thumbnail_url` → schema `thumbnailUrl` | 无 API 集成测 |
| 4 | 上传封面 API | **通（静态）** | `viz_components.py` PUT thumbnail · `save_component_thumbnail` | 无 pytest |
| 5 | 下载封面 API | **通（静态）** | `viz_components.py` GET thumbnail · `get_component_thumbnail` | 无 pytest |
| 6 | 编辑保存触发截图 | **部分通** | `useVizComponentEditor.ts:70-71` + `uploadVizComponentThumbnail.test.ts` | 单测 mock 捕获，无 E2E |
| 7 | 看板「发布到组件库」 | **断** | `PublishVizComponentDialog.tsx` 仅 create+publish | **未**调用截图上传 |
| 8 | Hub 真机见截图 | **未验** | 用户截图仍为 live 加载态 | 可能未部署/无 thumbnailUrl/未提交 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | Hub 不实时渲染 | **PARTIAL** | 7/B | 代码已改；smoke 仅挂载；无 DOM 断言无 ChartRenderer |
| T2 | 静态截图展示 | **PARTIAL** | 6/C | `VizComponentThumbnailPreview` 对齐看板模式；无 blob 集成测/浏览器 |
| T3 | 保存生成封面 | **PARTIAL** | 6/C | 接线完成；capture 全 mock |
| T4 | 列表性能（无 resolve） | **REAL** | 8/B | 静态删除 resolve 查询；smoke 通过 |

## 3b. 前端控件下钻表（预览相关）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | Hub 卡片预览区 | 无（展示） | 显示静态 `<img>` 或占位，不挂载 live 图表 | 代码路径正确；用户截图仍见 live 加载（部署/数据态未确认） | 2 | 1 | 1 | 2 | 2 | 8 | PARTIAL | `VizComponentCard.tsx:83-86` |
| B2 | 编辑页「保存」 | `useVizComponentEditor.save` | 保存后上传 thumbnail，列表可见封面 | 已 `await persistVizComponentThumbnailBestEffort`；失败仅 console.warn | 2 | 1 | 1 | 1 | 2 | 7 | PARTIAL | `useVizComponentEditor.ts:60-72` |

Out：Hub 筛选/分页/插入/发布菜单（非本需求预览链）。

## 3d. 覆盖矩阵

| 实体 ID | 子能力 | GATE | CHAIN | UI/BROWSER | 深度 | L | C | 判定 | 证据 |
|---------|--------|------|-------|------------|------|---|---|------|------|
| E1 | Hub 卡片静态预览组件 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `ComponentPayloadPreview.tsx`；单测 mock 子组件 |
| E2 | Hub 移除 batch-resolve | ✅ | ❌ | ✅ | UI | 2 | 2 | REAL | `VizComponentsHubPage.tsx`；smoke 1 test |
| E3 | 列表 API thumbnailUrl | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `service.py:_thumbnail_url` |
| E4 | PUT /thumbnail 存盘 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `viz_components.py` + `write_viz_component_thumbnail` |
| E5 | GET /thumbnail 鉴权下载 | ✅ | ❌ | ❌ | GATE | 1 | 1 | STUB | `get_component_thumbnail` |
| E6 | 编辑保存→截图上传 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | `uploadVizComponentThumbnail.test.ts`（全 mock） |
| E7 | 无封面占位文案 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | PARTIAL | `VizComponentThumbnailPreview.tsx`；单测经 mock |
| E8 | 看板发布到库带封面 | ❌ | ❌ | ❌ | NONE | 0 | 0 | **BROKEN** | `PublishVizComponentDialog.tsx` 无截图 |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 8 |
| GATE only | 3（E3,E4,E5） |
| CHAIN | 3（E1,E6,E7） |
| UI / BROWSER | 1（E2 smoke only） |
| NONE / 断链 | 1（E8） |
| REAL 达标 | 1/8（仅 E2） |
| **逐一校验** | **否** — 已验 7/8 行有静态或单测证据，E8 断链；无 BROWSER 真机 |
| 总体可否 REAL | **否** |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | Hub 代码对，真机未确认 |
| T2 | 2 | 1 | 1 | 2 | 2 | 8 | B | PARTIAL | 同 T1 |
| T3 | 2 | 1 | 1 | 1 | 2 | 7 | B | PARTIAL | 截图失败不阻断保存 |
| T4 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | 去 resolve |
| **总体** | — | — | — | — | — | **6** | **C** | **PARTIAL** | T 加权；E8 拉低 |

**打通但不对**（L≥2 且 C≤1）：T1、T2、T3（缺真机/E8 发布路径）  
**假功能/断链**：E8 看板发布到库无封面

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `vitest` 组件库相关 3 文件 | 6 tests pass | 6 passed（13s） | ✅ | 2026-08-25 17:23 命令输出 |
| 2 | `git status` 截图功能文件 | 已提交可部署 | **未提交**（M/?? 多文件） | ❌ | `git status` 2026-08-25 |
| 3 | 读 Hub 页源码 | 无 `VizComponentLivePreview` / 无 batch-resolve | 符合 | ✅ | 静态 Read |
| 4 | 读 Publish 对话框 | 发布后可进库带封面或占位可接受 | **无截图上传** | ❌ | `PublishVizComponentDialog.tsx` |
| 5 | 用户 Hub 截图（会话） | 卡片为静态图 | 仍见「正在加载自定义组件…」等 live 态 | ❌ | 用户附图（或旧构建/无 thumbnail） |

## 5. 修复文档（P0）

### E8 / T3 — 看板「发布到组件库」无封面

**判定**：BROKEN · C=0  
**期望 vs 实际**：发布新组件后 Hub 应能显示封面或明确占位；实际 create+publish 不产生 `thumbnail_ref`，依赖用户再进编辑页保存。  
**根因**：`PublishVizComponentDialog.tsx` 未调用 `persistVizComponentThumbnailBestEffort`（且发布时不在编辑预览 DOM 内，需另定捕获面或接受「首次编辑保存才出图」并在 UX 文案写清）。  
**修复方向**（二选一，需产品确认）：  
- A：发布流程跳转组件编辑页并提示保存生成封面；  
- B：发布时从看板 widget 画布区域截取（需传入 capture root）。  
**修后验收**：E8 深度 ≥ CHAIN，C≥2，发布后即可在 Hub 见封面或统一占位文案。

### T1/T2 — 缺 BROWSER 真机验收

**判定**：PARTIAL · C=1  
**期望 vs 实际**：Hub 41 张卡均为 `<img>` 或占位，无 ChartRenderer；需 MCP/手动刷新 `/admin/viz-components` 验证。  
**修复方向**：补 `VizComponentThumbnailPreview.test.tsx`（mock `useAuthenticatedBlobUrl`）+ 可选 browser-reviewer 走查。  
**修后验收**：§3d E1 深度 UI/BROWSER，C≥2。

### P0 — 工作区未提交

**期望**：功能可部署验证。  
**实际**：仅上轮图例分页已 commit `6d6d37fc`；截图预览改动仍在 working tree。  
**修复**：用户批准后 `git add` + commit 截图预览相关文件。

### P1 — 后端 API 无集成测

**期望**：PUT/GET thumbnail 与 `dashboard-thumbnails` 同级可靠。  
**实际**：仅 `test_dashboard_thumbnails.py` 验通用校验；无 `test_viz_component_thumbnails.py`。  
**修复**：仿 `test_dashboard_thumbnails` + 路由 smoke。

## 6. 结论与交接

| 问题 | 答案 |
|------|------|
| **是否完成？** | **未完成（PARTIAL）** — 核心编码到位，未达 REAL 交付 |
| 能否宣称「已对齐看板截图预览」？ | **仅编辑保存路径部分对齐**；Hub 展示链路与 API 静态完整，**缺真机证据 + 发布路径 + 提交** |
| 用户截图 live 加载 | 与目标不符；需部署新 FE + 各组件至少保存一次生成 `thumbnailUrl`，或仍为旧构建 |

**建议下一步**（需用户批准）：  
1. 提交当前截图预览改动  
2. 补 E8 发布路径或明确产品接受「仅编辑保存出图」  
3. 浏览器走查 Hub + 单组件保存后封面回显  
4. 补后端 thumbnail 路由测试  

---

*核验人：feature-truth-verify · 未改业务代码*
