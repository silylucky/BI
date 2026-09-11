# 实施计划：Dashboard 画布拖拽/缩放 — 最后一次 RGL 修复 + 失败切像素画布

> Plan type: Headless Automation Plan  
> Cursor Build: disabled  
> Execution trigger: dev-autopilot A5 plan-execute  
> 计划文件：`docs/automate/plans/2026-07-13-dashboard-canvas-drag-last-attempt.md`  
> 契约：`docs/automate/evolution-state.md`（Q1=A / Q2=A / Q3=C）  
> BUG：`docs/bugs/BUG-2_dashboard-drag-resize-unusable_2026-07-13.md`  
> Spec：`docs/superpowers/specs/2026-07-13-dashboard-de-canvas-design.md`（契约覆盖其「暂不换库」结论）

## 背景与目标

**问题描述**：编辑页画布拖拽/缩放被用户判定为完全不可用。已修交互中 compact 打架，但仍缺坐标持久化与 UX 入口。契约要求：**最后一次**在现有 RGL 上修到可用；人工手测仍失败则**同一计划内**切换到像素画布（x/y/width/height）。

**成功标准**：
- **Phase A 通过（优先）**：编辑页硬刷后，拖标题栏可稳定移动 widget；选中后边缘/角手柄可稳定改大小；保存并刷新后位置与尺寸保持。
- **Phase A 失败门控（Q2=A）**：上述任一项仍失败 → 进入 Phase B，不得再堆 RGL 补丁。
- **Phase B 通过（仅门控触发后）**：像素坐标布局可拖可缩可保存；旧 `colSpan/rowSpan/gridX/gridY` 看板可迁移读取；NFR-08 仍零 DE/Superset 运行时。

**非目标（本次不做）**：
- Phase A 不做 mark-line / 多选对齐工具栏（可后续 P1）。
- Phase A 不换 gridstack / moveable。
- Phase B 不做旋转/倾斜；不引入 DataEase 运行时。
- 不自动 merge 主分支；生产数据迁移需 Maintainer 批准（见风险）。

## 整体方案

分两段履约：Phase A 用最短路径打通「能拖、能缩、能存」——重点补后端 `gridX`/`gridY`（当前保存 `model_dump` 剥离坐标）并收口拖动手柄 UX；完成后由人工按 Q2=A 验收。若失败，Phase B 将布局真理源从 12 列栅格改为像素矩形，重写画布引擎与 `layoutJson` version=2，并提供 v1→v2 只读迁移；RGL 仅保留为可选只读预览或删除。

## 关键决策

| 决策点 | 选择 | 备选项 | 理由 |
|--------|------|--------|------|
| 方案路径（治标 vs 治本） | Phase A 治根因（坐标契约+UX）后人工门控；失败则 Phase B 治本像素画布 | 直接换库 / 只改 CSS | 契约 Q1=A+Q3=C；先验证 RGL 是否本可工作 |
| 失败换什么 | 像素画布 `x/y/width/height` | gridstack / RGL+moveable | 用户 Q3=C |
| Phase A 是否改 layout 契约 | **是**：schema 增加 `gridX`/`gridY`（仍 version=1） | 仅前端 localStorage | 不改则保存必丢坐标（L1） |
| Phase B layout 版本 | `version: 2` + 迁移器 | 原地改字段名 | 可回退、可并行读旧数据 |
| 验收权威 | **人工手测 Q2=A** | 仅 vitest | 契约明确；自动化为辅 |

## 假设与依赖

- 假设：用户能在本机打开 Dashboard 编辑页完成手测；dev-autopilot 在 Phase A 完成后进入 `NEEDS_DECISION` 等待「通过/失败」一句确认，再决定是否执行 Phase B。
- 假设：现有 `layoutJson` 为 version=1；`DashboardLayout.widgets` 经 Pydantic dump 写库。
- 依赖：`fe/src/components/dashboard/*`、`backend/app/dashboard/schemas.py` + `service.py`、`docs/api/README.md`、PRD DASH-002 分片（Phase B 时同步）。
- 已跳过 first-review（bug 路径 + 契约已齐）；本 plan path B。

## 风险与回退

| 风险 | 概率 | 影响 | 缓解/回退方案 |
|------|------|------|---------------|
| Phase A 修完仍「手感差」被判失败 | 中 | 进入昂贵 Phase B | 门控清单写清「稳定移动/缩放/保存保持」；避免主观美学否决 |
| Phase B 改 schema 破坏旧看板 | 高 | 线上布局错乱 | version 双读；迁移脚本；失败回退 version=1 + RGL |
| 像素碰撞/吸附自研工期膨胀 | 高 | 超 3 轮 repair | Phase B MVP：拖放+八向缩放+保存；mark-line 列为 B+ 非阻塞 |
| 生产 DB 批量迁移 | 中 | 需审批 | `NEEDS_APPROVAL`；默认仅代码侧双读，不强制写回 |

---

## 改动清单

### Phase A — 最后一次 RGL 修复（必须先做）

#### A1. 后端贯通 `gridX` / `gridY` + 对齐行高上限

- **位置**：`backend/app/dashboard/schemas.py` → `LayoutWidget`；`fe/.../gridLayoutAdapter.ts` clamp；新增 `tests/test_dashboard_layout_grid_xy.py`；保存失败提示见 `apiError.ts` / EditPage
- **改动**：
  1. widget 增加可选 `gridX`/`gridY`（alias 驼峰）；缺省兼容旧数据；`model_dump` 后坐标仍在
  2. 校验 `gridX`∈[0,11]、`gridY`≥0，且 `gridX+colSpan≤12`
  3. **对齐边界**：将 BE `rowSpan` 上限从 `le=8` 调整为与 FE `MAX_CHART_ROWS`（24）一致；FE clamp 不得高于 BE
  4. layout PUT 若 422 bounds，前端须展示明确错误（非静默）
- **目标对应**：成功标准「保存并刷新后位置保持」；避免缩放到 >8 行被误判为缩放损坏
- **验证方式**：`pytest tests/test_dashboard_layout_grid_xy.py -q`：PUT 含 gridX/Y → GET 原样；rowSpan=12 可保存；越界 422

#### A2. FE 保存往返断言 + 缺坐标兜底不变

- **位置**：`fe/src/components/dashboard/layoutUtils.ts`、`gridLayoutAdapter.ts`；dashboard smoke / 单测
- **改动**：确认序列化始终写出 `gridX`/`gridY`；缺坐标仍 `packFlowLayout`；补测「toGrid → toWidgets → toGrid」坐标不变
- **目标对应**：与 A1 闭环
- **验证方式**：vitest `gridSnapUtils` / adapter / smoke

#### A3. 拖拽/缩放 UX 收口（不换引擎）

- **位置**：`fe/src/index.css`、`DashboardWidget.tsx`、`FilterWidget.tsx`、必要时 `dashboardGridRgl.tsx`
- **改动**：
  1. 选中 widget 时缩放手柄 **常显且可点**（修 `:has(.dashboard-widget-selected)` 生效路径）
  2. 标题栏增加可见拖拽提示（文案或 aria）
  3. 保持 `draggableCancel=".dashboard-no-drag"`，图表区不可误拖
  4. 复核 `applyLiveLayout` 无 compact；`onDragStop`/`onResizeStop` 才 `normalizeGridLayout`
- **目标对应**：「能拖、能缩」手感
- **验证方式**：vitest 不回归；**人工**硬刷手测清单（见整体验证）

#### A4. Phase A 完成门控（人工）

- **位置**：`docs/automate/evolution-state.md` 写入 `phase_a_gate`
- **改动**：执行模型跑完 A1–A3 验证命令后 **停止**，状态 `NEEDS_DECISION`，等待用户回复：`PhaseA=PASS` 或 `PhaseA=FAIL`
- **目标对应**：契约 Q2=A
- **验证方式**：用户一句确认；`PASS` → A8 收尾（可简化）；`FAIL` → 执行 Phase B

---

### Phase B — 像素画布（仅 `PhaseA=FAIL`）

#### B1. 布局契约 version=2

- **位置**：`backend/app/dashboard/schemas.py`、`backend/app/dashboard/service.py`、`backend/app/views/{schemas,validate,adapter}.py`、`tests/test_dashboard_pixel_layout.py`、`docs/api/README.md`
- **改动**：
  1. `DashboardLayout` 保持统一入口，但新增 `version: Literal[1,2]`、可选 `canvas`；layout 级 validator 按版本禁止混用字段：v1 只允许 `colSpan/rowSpan/gridX/gridY`，v2 只允许 `x/y/width/height`
  2. v2 `canvas={width:1440,height:int>=900}` 为持久化的规范坐标空间；widget 像素字段均为非负整数，`width/height` 有最小值且不得越出 canvas
  3. v1/v2 都保留 `globalFilters` 与 `id/type/title/chartConfig/filterConfig/order`
  4. `service.update_layout → views.validate → model_dump → DB` 全链路保留 v2 字段；错误映射继续返回 `DASH_INVALID_LAYOUT` / bounds 类可行动错误
  5. 提供纯函数 `migrate_v1_to_v2(layout, canvas={1440,900})`：12 列换算为 120px/列，纵向按现有 rowHeight+margin 换算；canvas height 自动容纳最底部 widget
- **目标对应**：Phase B 成功标准
- **验证方式**：`pytest tests/test_dashboard_pixel_layout.py -q` 覆盖 v1/v2 API+View 往返、禁止字段混用、globalFilters 保留、迁移确定性与 bounds

#### B2. 前端像素画布引擎 + DataEase shape 交互壳

- **位置**：新建 `fe/src/components/dashboard/pixelCanvas/`；`layoutUtils.ts`、`useLayoutHistory`、`DashboardGrid.tsx`、`DashboardEditPage.tsx`、新增 widget 工厂与相关测试
- **改动**：
  1. FE 定义 `DashboardLayoutV1 | DashboardLayoutV2` 判别联合；编辑状态保留 `version/canvas/widgets/globalFilters`，undo/redo 与 dirty fingerprint 不得丢像素字段
  2. 绝对定位容器按持久化的 1440px 规范画布渲染，并按宿主宽度等比缩放；Pointer Events 将屏幕位移除以 scale 后写回规范坐标
  3. Pointer Capture 驱动拖移与八向 resize；`pointerup/pointercancel/lostpointercapture` 都收口交互；松手写回 layout；**碰撞策略钉死：允许重叠，`zIndex = order`**
  4. 编辑态结构一比一映射 DE 心智：外层 `pixel-shape-outer`（1px brand 选中描边）、内层 `pixel-shape-inner`（12px padding/现有主题背景）、左侧居中 `pixel-shape-edit-bar`
  5. 选中后八向控制点常显：视觉 12px、命中区 20px，使用对应方向 resize cursor；左侧工具条宽 32px，含拖动入口与“更多”菜单入口；内容交互区通过 `data-pixel-no-drag` 不误触拖动
  6. 新增 chart/filter 时在视口可见区域生成 v2 像素位置和默认尺寸；预览模式复用只读像素引擎但不显示 edit-bar、选中描边和控制点
- **目标对应**：可拖可缩可存；落实用户选择 A 的 DE `shape-outer / edit-bar / shape-inner` 一比一交互
- **验证方式**：vitest 覆盖缩放坐标换算、八向 resize、pointer cancel、内容区不触发拖动、新增 widget、undo/redo、编辑/预览 chrome 差异；浏览器真实 Pointer QA + 人工清单

#### B3. 编辑页接线与回退开关

- **位置**：`DashboardEditPage.tsx`、`DashboardEditWorkspace.tsx`、`vite-env.d.ts`、预览/分享页接线
- **改动**：
  1. `VITE_DASHBOARD_PIXEL_CANVAS` 默认开启；仅显式 `"false"` 关闭，并在 `vite-env.d.ts` 声明
  2. 启用矩阵钉死：
     - pixel on + v1：加载时在内存迁移 v2，首次保存写 v2
     - pixel on + v2：直接编辑/保存 v2
     - pixel off + v1：回退 RGL 编辑（仅紧急回滚）
     - pixel off + v2：像素只读预览并禁用保存，绝不降回 v1
  3. `DashboardEditPage` 不再硬编码 `{version:1}`；保存完整当前 layout；预览/分享按 version 选择只读引擎
- **目标对应**：风险回退
- **验证方式**：四象限单测；flag off + v2 不出现可保存编辑态；v1 首次保存实际写 v2

#### B4. Phase B 文档与 BUG 收口

- **位置**：BUG-2、design spec、`docs/api/README.md`、DASH PRD 分片、dashboard 服务域附录、`fe/src/components/README.md`
- **改动**：
  1. 标记根因与迁移状态；spec 状态改为「像素画布已实现」
  2. 同步 `DashboardPreviewThumb.tsx`、`dashboardLayoutToView.ts`、分享页/视图协议等 v2 消费面，禁止继续假设只有 `colSpan`
  3. 登记 pixelCanvas 公共组件边界与回退策略
- **验证方式**：文档索引无矛盾；消费面测试覆盖 v1/v2

---

## 执行顺序

```text
A1 → A2 → A3 → 自动化验证 → A4 人工门控
         ├─ PhaseA=PASS → Close（不执行 B*）
         └─ PhaseA=FAIL → B1 → B2 → B3 → B4 → 验证 → Close
```

理由：A1 是「拖了没用」的 L1 根因；无 A1 则 UX 再好也会在保存后失败。B* 仅在契约门控失败后启动，避免过早重写。

## 整体验证方案

**自动化（Phase A）**：
- `cd backend && python -m pytest tests/test_dashboard_layout_grid_xy.py tests/test_viz_dash_l1_r28.py -q`
- `cd fe && npx pnpm@9.15.0 exec vitest run src/components/dashboard/gridSnapUtils.test.ts src/pages/admin/dashboard/dashboard.smoke.test.tsx`

**人工门控清单（Q2=A，Phase A 与 Phase B 通用）**：
1. 硬刷编辑页
2. 拖 **标题栏** 移动 widget ≥ 1 格，松手后位置停留
3. 点选 widget，用角/边手柄改大小，松手后尺寸停留
4. 选中态具有 DE 对应结构：外部选中壳、左侧 edit-bar、带内边距内容区、八向控制点；预览态不显示编辑 chrome
5. 点保存（或自动保存若已有），刷新页面，位置与尺寸仍保持
6. 任一步失败 → Phase B 未通过

## 自审结果

| 维度 | 自评 | 备注 |
|------|------|------|
| 目标-实现一致性 | 🟢 | A1–A4 / B1–B4 覆盖契约 |
| 必要性 | 🟢 | Phase B 有门控，不默认执行 |
| 正确性 | 🟢 | Phase B 碰撞钉死允许重叠；rowSpan FE/BE 对齐列入 A1 |
| 完整性 | 🟢 | mark-line 显式非目标；pytest 文件已钉死 |
| 一致性 | 🟢 | 循 arch / prd-sync |
| 副作用 | 🟢 | A1 回归用例覆盖 bounds |
| 降级合理性 | 🟢 | 双版本与 flag |
| 顺序依赖 | 🟢 | A 后门控再 B |
| 可验证性 | 🟢 | 自动化 + 人工清单 |

已按 plan-review WARN 修订（2026-07-13）：rowSpan 对齐；B2 碰撞策略钉死；pytest 路径钉死。生产强制写回迁移仍 `NEEDS_APPROVAL`。

## 下一步推荐

交 `plan-review` 独立审核；PASS 后 A5 `plan-execute` 仅执行 Phase A，至 A4 停等用户。
