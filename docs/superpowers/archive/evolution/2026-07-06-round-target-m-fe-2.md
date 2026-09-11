# 演化轮次选题 — 2026-07-06（M-FE-2 P1 最小出数闭环）

## 本轮演化目标（共 4 项）

### 选题决策

- **批量主题**：**M-FE-2 P1 最小出数闭环** — 浏览器端 Schema 浏览 → 图表 SQL 配置 → Dashboard 网格布局出数 → DATA-SMOKE L2 全链路验收；对齐 `goal.md` §5 **P1-SMOKE** 与 plan §M1B DATA-005 L2
- **来源**：`docs/automate/plan.md` §**M-FE-2**（第一个含未完成 `[ ]` 的节，**4 项**；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M-FE-2 含 4 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` c39cabf（M-FE-1 #205 merge）+ ba9cbdd（G1 r190 #204）+ 4514d5f（plan v2.1）+ 267f1fe（G1 r189 #203）+ 7236981（G1 r188 #202）；上游 G0 PASS · G1 DONE_WITH_CONCERNS · base_branch=dev-auto
- **合并理由**：plan 推荐顺序 `DS-004 → VIZ-002 → DASH-002 → DATA-005`；Schema 浏览为图表 SQL 选表前置；VIZ-002 与 DASH-002 共享 Dashboard 消费域；DATA-005 L2 为同节集成验收收口；M-FE-1（登录+建源）已 merge，本轮 **FE companion 补缺** 打通 P1-SMOKE
- **范围框定**：
  - **模块**（≤3）：`fe/`（schema 浏览器、chart widget 渲染、dashboard 网格布局）+ `tests/`（P1-SMOKE / DATA-SMOKE L2 用例）+ `docs/`（prd/api 回写，DATA-005）
  - **文件**（估 ≤18，≤20）：`fe/src/pages/admin/datasources/*`（schema 树）、`fe/src/components/charts/*` 或 dashboard widget、`fe/src/pages/admin/dashboards/*`（网格拖拽）、`routes.tsx`、相关 vitest/Playwright smoke、`tests/test_*_p1_smoke*`、`docs/automate/prd/F16-DATA.md` L2 勾选项
  - **不含**：角色/用户 Admin UI（AUTH-001/003 · M-FE-3）、全局筛选器 FE（DASH-004 · M-FE-3）、MySQL/PG 连接器新实现（CONN-001/002 · M3）、地图/热力/KPI 扩展图表（DASH-003）、M13 冻结项、Dataset 语义层
- **不足 5 项原因**：plan §M-FE-2 勾选清单**仅定义 4 项未完成 PRD ID**，同节无第五 plan 项；四项已覆盖 P1-SMOKE + DATA-SMOKE L2 全链路，估 6–15 主文件，不强行从 hub 饱和项（均 ≥90）或跨节凑第五项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| DS-004 | 90.7 | **入选**（plan M-FE-2 #1，Schema 浏览 FE） |
| VIZ-002 | 91.6 | **入选**（plan M-FE-2 #2，最小图表 FE 渲染） |
| DASH-002 | 90.7 | **入选**（plan M-FE-2 #3，网格拖拽布局 FE） |
| DATA-005 | 90.8 | **入选**（plan M-FE-2 #4，DATA-SMOKE L2 验收） |
| CAT-001 | 90.0 | hub #1 饱和 ≥90；非 M-FE-2 plan 范围 |
| CAT-002 | 90.0 | hub #2，同上 |
| CONN-004 | 90.0 | hub #3，连接器属 M7 排队 |
| DASH-004 | 90.0 | hub #4，属 M-FE-3 排队 |
| NFR-001 | 90.0 | hub #5，属 M6 排队 |
| VIEW-001 | 90.2 | M5 排队；DASH-002 已含 view 模式消费，不重复扩 scope |

### STUCK 标注

- 选题卡住计数表**空** — 四入选 ID 无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：数据源详情可浏览 schema/table/column；Dashboard 编辑模式可拖拽网格、view 模式可见表格/折线/柱图出数；托管库登记 dataSourceId 后 SQL 查询可在 Dashboard 展示
2. **补缺 or 创造**：补缺（后端 DS-004/VIZ-002/DASH-002 API 与协议已交付，分片验收未勾 FE 项）；符合 `goal.md` **G3 BI 展现** 与 **P1-SMOKE / DATA-SMOKE** 成功指标
3. **不做代价**：无法浏览器验收一期核心闭环；P1-SMOKE 阻塞；M-FE-3 与 M6 集成验收无前置
4. **能否批处理更小项**：已按 plan M-FE-2 批处理为 4 项同节（schema → chart → layout → E2E）
5. **共几项/文件模块**：4 项；`fe/` + `tests/` + 薄 `docs/`，估 ≤18 文件、3 模块

---

### 子项 1：DS-004 Schema 元数据浏览

- **选题理由**：plan M-FE-2 **#1**；后端 schemas/tables/columns API 已实现（M3），缺浏览器三级浏览 UI，为图表 SQL 选表前置
- **选题时 PRD 加权总分**：90.7/100（用户价值 **82%** · 完整度 **94%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **86%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：交互体验（整维 N/A→本轮 FE 实评）；用户价值（82%→管理员可浏览器探查元数据）
- **用户感知**：数据源详情页可展开 schema → 表 → 列；选表可复制/引用到 SQL 配置
- **类型**：补缺（DS 域 FE companion）
- **验收标准**（来源 plan §M-FE-2 · DS-004）：
  - schemas/tables/columns 三级浏览 UI
  - 对接已有 DS 元数据 API
  - 与 `/admin/datasources` 详情页集成

### 子项 2：VIZ-002 最小图表集 M4-MIN

- **选题理由**：plan M-FE-2 **#2**；ChartViewConfig 协议与后端查询链已交付，缺 Dashboard 内表格/折线/柱图 FE 渲染
- **选题时 PRD 加权总分**：91.6/100（用户价值 **84%** · 完整度 **96%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：交互体验（N/A→实评 loading/空态/错误态）；用户价值（84%→用户可见图表出数）
- **用户感知**：Dashboard view 模式 widget 展示表格、折线图、柱状图真实数据
- **类型**：补缺（VIZ 域 FE companion）
- **验收标准**（来源 plan §M-FE-2 · VIZ-002）：
  - 表格/折线/柱三种 chart type FE 渲染
  - 绑定 `dataSourceId` + SQL（不经 Dataset）
  - 对接查询执行 API，展示结构化错误

### 子项 3：DASH-002 Dashboard 容器与布局引擎

- **选题理由**：plan M-FE-2 **#3**；Dashboard 数据模型已实现，分片未勾「网格布局可拖拽」FE 验收项
- **选题时 PRD 加权总分**：90.7/100（用户价值 **84%** · 完整度 **92%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：交互体验（N/A→网格拖拽、编辑/查看模式切换）；完整度（92%→分片拖拽验收可勾选）
- **用户感知**：Dashboard 编辑模式可拖拽调整 widget 网格；保存后 view 模式布局持久
- **类型**：补缺（DASH 域 FE companion）
- **验收标准**（来源 plan §M-FE-2 · DASH-002）：
  - 网格布局可拖拽（分片未勾项）
  - 编辑/查看模式切换
  - widget 容纳 VIZ-002 图表组件

### 子项 4：DATA-005 端到端验收与文档回写

- **选题理由**：plan M-FE-2 **#4**；M1B L1 已完成，本轮交付 **DATA-SMOKE L2**：托管库登记 `dataSourceId` → SQL 查询出数 + prd 回写
- **选题时 PRD 加权总分**：90.8/100（用户价值 **82%** · 完整度 **98%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→L2 全链路可判定成功指标）；完整度（98%→L2 验收与文档对齐）
- **用户感知**：平台托管分析库数据经登记后可于 Dashboard SQL 出数；运行手册/验收记录可审计
- **类型**：补缺（集成验收 + 文档收口）
- **验收标准**（来源 plan §M-FE-2 · DATA-005 / M1B L2 表）：
  - 托管库登记为 `dataSourceId`（DS-002）→ FR-2.0b SQL 查询出数
  - P1-SMOKE 手工或自动化用例：建源 → SQL → Dashboard view 可见数据
  - `prd/F16-DATA.md` L2 验收补录；`prd/F07-DASH.md` DASH-002 拖拽项可勾选
