# 演化轮次选题 — 2026-07-08（M-PRODUCT F-A 收尾 + F-C IA 主路径收敛）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M-PRODUCT F-A 收官（API/文件建源 companion 表单）+ F-C 首批（IA 主路径收敛）** — 补齐 REST API / Excel·CSV 建源专用表单项（当前仅 host 标签占位）；收敛 analyst/viewer 侧栏、图表探索与设计器入口，单故事线「连库 → Dataset → Dashboard」
- **来源**：`docs/automate/plan.md` §**M-PRODUCT · F-A**（首未完成节，余 **CONN-023/024** 共 2 项 `[ ]`）；F-B 已全勾；按 plan 推荐顺序接续 **§F-C**（3 项 `[ ]`）凑满 5 项；饱和熔断**已跳过**（plan 当前节含未完成项）；`prd.md` hub 8 维映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` 8f074b2（G1 reset）+ 08a49dc（#246 F-B DS-007）+ cab36c4（饱和 BLOCKED）+ a3daf40 + ac350e1；上游 G0 PASS · base_branch=dev-auto
- **合并理由**：CONN-023/024 同属 `DatasourceFormPage` 连接器表单域，共享 `displayGroup` 向导（F-B 已交付）；F-C 三项均属 `fe/` 导航与 IA（`nav-manifest` / `resolve-nav` / `layout.md`），与 F-A 表单无文件冲突，可同轮批处理；hub 薄弱项 Top3（CONN-027 90.1、API-002 90.2、API-005 90.2）均 ≥90 且不在 plan `[ ]` 范围，不抢 plan 顺序
- **范围框定**：
  - **模块**（≤3）：`fe/`（`DatasourceFormPage`、连接器字段组件、`nav-manifest`/`resolve-nav`、图表探索/设计器路由入口）+ `docs/ui/layout.md`（IA 文案同步）
  - **文件**（估 ≤18，≤20）：`fe/src/pages/admin/datasources/DatasourceFormPage.tsx` 及子组件、`fe/src/config/nav-manifest.ts`、`fe/src/lib/resolve-nav.ts`、相关 vitest smoke、`docs/ui/layout.md` §3/§6
  - **不含**：F-D E2E 固化、F-E API auth 文档债、F-F companion 深度、后端新连接器方言（CONN-023/024 后端 L1 已交付）、DataEase SQLBot / AI 问数
- **不足 5 项原因**：不适用 — F-A 2 项 + F-C 3 项 = 5 项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CONN-023 | 92.4 | **入选**（plan F-A #1，REST API 建源表单） |
| CONN-024 | 92.4 | **入选**（plan F-A #2，Excel/CSV 上传/远程文件表单） |
| BOOT-002 | 95.9 | **入选**（plan F-C #1，analyst/viewer 默认隐藏治理/数据工程分组） |
| VIZ-002 | 93.2 | **入选**（plan F-C #2，图表探索降权或并入 Dashboard 向导） |
| DESIGN-004 | 92.8 | **入选**（plan F-C #3，查询设计器标注治理专用并移入治理分组） |
| CONN-027 | 90.1 | hub #1 薄弱项；M-FINAL F-G 已勾，无 plan `[ ]` 行 |
| API-002 | 90.2 | hub #2；M6 已交付，非 M-PRODUCT companion |
| API-005 | 90.2 | hub #3；plan F-A 已 `[x]`（ReportExportCard 已交付） |
| QUERY-009 | 92.6 | 属 F-D E2E，plan 顺序在 F-C 之后 |
| API-007 | 90.8 | 属 F-E 文档对账，可并行但不抢 F-C 首批 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 无 STUCK 标注

## 演化北极星自检

1. **用户感知**：新建 API 源可配 OAuth/探测路径；Excel/CSV 可上传或填远程文件 URL；analyst/viewer 侧栏更精简；图表探索/设计器不再干扰「连库→Dataset→出图」主路径
2. **补缺 or 创造**：补缺（CONN companion 表单 + IA 收敛）；符合 `goal.md` **G2 多源接入** 与 **G3 BI 展现全链路** 成品感
3. **不做代价**：API/文件源仍仅 host 标签，对标 DataEase 建源体验断层；侧栏治理/探索项过多，新用户找不到主路径
4. **能否批处理更小项**：已按 plan F-A 收尾 + F-C 首批批为 5 项（表单域 + 导航域，模块不交叉）
5. **共几项/文件模块**：5 项；`fe/` + `docs/ui/`，估 ≤18 文件、2 模块

---

### 子项 1：CONN-023 REST API 数据源连接器

- **选题理由**：plan §M-PRODUCT **F-A** 余 2 项之首；后端 REST API 方言已注册（M-FINAL F-G），PRD companion 未勾「OAuth/探测路径专用表单项」；当前 `DatasourceFormPage` 对 api 类型仅 host 标签
- **选题时 PRD 加权总分**：92.4/100（用户价值 **88%** · 完整度 **96%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（96%→分片 companion 验收可勾）；性能（88%→探测请求 loading/超时反馈）；交互体验（N/A→本轮 FE 实评）
- **用户感知**：新建数据源选「API」大类后，出现 base URL、认证方式（Bearer/OAuth 占位或基础字段）、探测/健康检查路径等专用字段，而非通用 host
- **类型**：补缺（CONN FE companion 表单）
- **验收标准**（来源 plan §M-PRODUCT F-A · CONN-023）：
  - `DatasourceFormPage` 对 `api` 类型渲染专用表单项（含 OAuth/探测路径 companion）
  - 与 F-B `displayGroup=api` 三步向导衔接
  - vitest datasource-form smoke 覆盖 api 字段渲染
  - 手动或 smoke：可保存 API 类型数据源配置

### 子项 2：CONN-024 Excel/CSV 文件源连接器

- **选题理由**：plan §M-PRODUCT **F-A** 收官项；后端 Excel/CSV 方言已交付；分片未勾「上传与远程文件 companion」；当前仅 host 标签
- **选题时 PRD 加权总分**：92.4/100（用户价值 **88%** · 完整度 **96%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：完整度（96%→上传/远程 URL 验收可勾）；交互体验（N/A→文件选择与进度反馈）；性能（88%→大文件上传边界提示）
- **用户感知**：新建数据源选「文件」大类后，可上传本地 Excel/CSV 或填写远程文件 URL，而非看到无意义的 host 字段
- **类型**：补缺（CONN FE companion 表单）
- **验收标准**（来源 plan §M-PRODUCT F-A · CONN-024）：
  - 本地文件上传控件 + 远程文件 URL 字段（二选一或分 tab）
  - 与 `displayGroup=file` 向导衔接
  - vitest smoke 覆盖 file 类型字段
  - F-A 验收信号：F-A 全勾后成品感 demo 可演示 API+文件建源

### 子项 3：BOOT-002 React 管理端壳层

- **选题理由**：plan §M-PRODUCT **F-C** #1；能力驱动导航已有（F-B），缺 analyst/viewer **默认 IA** — 治理与数据工程分组应对非 admin 默认隐藏；对齐 `layout.md` §6 里程碑可见性
- **选题时 PRD 加权总分**：95.9/100（用户价值 **96%** · 完整度 **100%** · 可靠性 **94%** · 交互体验 **96%** · 架构 **98%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **94%**）
- **主攻薄弱维**：性能（88%→侧栏项减少后的渲染路径）；用户价值（维持 96%，IA 收敛强化主路径感知）
- **用户感知**：以 analyst/viewer 登录后，侧栏默认不展示治理、数据工程等高级分组；admin 仍可见全部能力项
- **类型**：补缺（壳层 IA companion）
- **验收标准**（来源 plan §M-PRODUCT F-C · BOOT-002）：
  - `nav-manifest` / `resolve-nav` 对 analyst/viewer 默认隐藏治理与数据工程分组
  - `resolve-nav.test.ts` / `AdminLayout.smoke.test.tsx` 覆盖三档角色默认可见性
  - 同步 `docs/ui/layout.md` §3 分组表与默认 IA 说明

### 子项 4：VIZ-002 最小图表集 M4-MIN

- **选题理由**：plan §M-PRODUCT **F-C** #2；「图表探索」独立顶栏入口干扰主路径；须降为高级入口或并入 Dashboard 新建图表向导（二选一，更新 layout）
- **选题时 PRD 加权总分**：93.2/100（用户价值 **92%** · 完整度 **100%** · 可靠性 **94%** · 交互体验 **88%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **90%**）
- **主攻薄弱维**：交互体验（88%→主路径步骤收敛）；性能（88%→减少平行探索入口）
- **用户感知**：新用户不再被「图表探索」分散注意力；从 Dashboard 即可进入建图/选图表类型，或探索入口移入高级/折叠区
- **类型**：补缺（IA 收敛，不删 API）
- **验收标准**（来源 plan §M-PRODUCT F-C · VIZ-002）：
  - 实施方案二选一：侧栏降权 **或** Dashboard 内嵌新建图表向导
  - 路由/API 保留，仅调整入口与文案
  - `layout.md` 更新图表探索定位
  - vitest routes/nav smoke 无死链

### 子项 5：DESIGN-004 设计器与工单关联

- **选题理由**：plan §M-PRODUCT **F-C** #3；查询设计器面向治理闭环，应对普通 analyst 侧栏降权 — 标注「治理专用」并移入治理分组或折叠
- **选题时 PRD 加权总分**：92.8/100（用户价值 **90%** · 完整度 **94%** · 可靠性 **96%** · 交互体验 **88%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **90%** · 安全性 **94%**）
- **主攻薄弱维**：用户价值（90%→治理入口语义清晰）；交互体验（88%→侧栏分组合理）
- **用户感知**：侧栏「查询设计器」出现在治理上下文（或折叠内），带「治理专用」标注；普通分析用户主路径不被设计器打断
- **类型**：补缺（IA 收敛）
- **验收标准**（来源 plan §M-PRODUCT F-C · DESIGN-004）：
  - 设计器 nav 项移入治理分组或默认折叠
  - 文案/Tooltip 标注治理专用
  - admin 仍可访问完整设计器功能
  - F-C 验收信号：新用户 3 次点击内完成建源→Dataset→出图（与 BOOT-002/VIZ-002 联动验证）
