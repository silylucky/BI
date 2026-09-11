# 演化轮次选题 — 2026-07-06（M5 Dashboard 组件库与视图协议）

## 本轮演化目标（共 3 项）

### 选题决策

- **批量主题**：**M5 最小图表与 Dashboard 收官** — 扩展 Dashboard 组件库（地图/热力/KPI/时间轴）+ 落地 DashboardView 视图协议 FR-VIEW-1 + Dashboard 首屏性能基线验收；对齐 `goal.md` **G3 BI 展现** 与 plan §M5「组件可出数」
- **来源**：`docs/automate/plan.md` §**M5**（第一个含未完成 `[ ]` 的节，**2 项** DASH-003/VIEW-001；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M5 含 2 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` 849741b（G1 r212 idle reset）+ 513ebb4（M-FE-3 #208）+ 2427627（M-FE-3 #207）+ ce725cc（M-FE-2 #206）+ c39cabf（M-FE-1 #205）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **合并理由**：plan 推荐 M5 顺序 DASH-003 → VIEW-001；VIEW-001 协议为扩展 widget 类型（DASH-003）的序列化/校验契约；NFR-001 为 hub 薄弱项 #4（90.0）且与 Dashboard 消费路径直接相关，作为 M6 前置小项 companion 纳入同轮批处理（perf smoke 不扩 M6 总线/CAT 范围）
- **范围框定**：
  - **模块**（≤3）：`backend/app/`（viz/dashboard 域 widget 类型 + view 协议）+ `fe/`（map/heatmap/KPI/timeline 渲染组件）+ `tests/`（widget 出数 + view 协议 + 首屏 perf smoke）
  - **文件**（估 ≤18，≤20）：`backend/app/viz/*` 或 `dashboard/*`（四类 chart type handler）、view 协议 schema/validator、`fe/src/components/charts/*`（map/heatmap/kpi/timeline）、dashboard widget 注册、`tests/test_dash_*` / `test_nfr_001*`、薄 `docs/api/README.md` + `prd` 回写锚点
  - **不含**：M13 冻结项、Dataset 语义层（QUERY-009）、VIZ-005 维度指标筛选 UI（M11 排队）、GOV/CAT 总线分类（M6 其余项）、角色默认视图 FE（VIEW-003 已在 M-FE-3 完成）、新增连接器（M7）
- **不足 5 项原因**：plan §M5 勾选清单**仅定义 2 项未完成 PRD ID**；同节无第三 plan 项；待办池空；hub Top10 均 ≥90（饱和态）— 仅从执行范围内下一节 M6 择 **NFR-001**（Dashboard 首屏）作最小 companion 达 G2 下限 3 项，不强行跨节凑 CAT/GOV 第五项

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| DASH-003 | 90.7 | **入选**（plan M5 #1，组件库扩展） |
| VIEW-001 | 90.2 | **入选**（plan M5 #2，FR-VIEW-1 视图协议） |
| NFR-001 | 90.0 | **入选**（hub #4，Dashboard 首屏 perf companion） |
| CAT-001 | 90.0 | hub #1 饱和 ≥90；属 M6 总线分类，与本节 widget 主题弱相关 |
| CAT-002 | 90.0 | hub #2，同上 |
| CONN-004 | 90.0 | hub #3，连接器属 M7 排队 |
| QUERY-009 | 90.0 | hub #5，Dataset 路径属 M13 冻结 |
| VIZ-005 | 90.0 | hub #6，维度筛选 UI 属 M11 排队 |
| GOV-001 | 90.2 | M6 排队；catalog 附录与本节无直接依赖 |
| DASH-004 | 92.1 | M-FE-3 已交付 FE companion；plan M8 未勾为 BE L2，非 M5 阻塞 |

### STUCK 标注

- 选题卡住计数表**空** — 三入选 ID 无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：Dashboard 可添加地图/热力/KPI/时间轴 widget 并出数；视图配置符合 FR-VIEW-1 协议可序列化/校验；Dashboard view 模式首屏加载有可判定 perf 基线
2. **补缺 or 创造**：补缺（M5 plan 未勾 2 项 + NFR 远期 stub 推分）；符合 `goal.md` **G3** 与一期 Dashboard 展现闭环
3. **不做代价**：M5 无法勾选完成；M6 一期集成验收无 Dashboard 组件与 perf 前置；P1-SMOKE 扩展图表类型阻塞
4. **能否批处理更小项**：DASH-003 四类 widget 同域批处理；VIEW-001 协议与 widget 注册同轮；NFR-001 仅首屏 smoke 不测全站 NFR
5. **共几项/文件模块**：3 项；`backend` viz/dashboard + `fe` charts + `tests`，估 ≤18 文件、3 模块

---

### 子项 1：DASH-003 Dashboard 组件库

- **选题理由**：plan M5 **#1**；VIZ-003 插件注册与 VIZ-002 最小集已交付，分片待补地图/热力/KPI/时间轴四类 widget
- **选题时 PRD 加权总分**：90.7/100（用户价值 **84%** · 完整度 **94%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→管理员可配置四类扩展图表）；架构健康（88%→widget 类型注册与 VIZ 插件对齐）
- **用户感知**：Dashboard 编辑模式可选地图/热力/KPI/时间轴 widget；view 模式可见真实数据（绑定 dataSourceId + SQL）
- **类型**：补缺（DASH 域 widget 库扩展）
- **验收标准**（来源 plan §M5 · DASH-003）：
  - 地图/热力/KPI/时间轴四类 widget 类型可注册与渲染
  - 对接既有查询执行链（不经 Dataset）
  - 分片验收项可勾选；组件可出数

### 子项 2：VIEW-001 DashboardView 视图协议 FR-VIEW-1

- **选题理由**：plan M5 **#2**；DashboardView 数据模型（DASH-001）已交付，缺 FR-VIEW-1 视图协议正式化（序列化/校验/版本策略）
- **选题时 PRD 加权总分**：90.2/100（用户价值 **82%** · 完整度 **94%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **96%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→视图配置可互操作、可校验）；测试覆盖（96%→协议边缘与破坏性输入用例）
- **用户感知**：Dashboard 保存/加载视图配置结构稳定；非法配置有结构化错误而非静默失败
- **类型**：补缺（VIEW 域协议落地）
- **验收标准**（来源 plan §M5 · VIEW-001）：
  - FR-VIEW-1 DashboardView 视图协议 schema 与校验
  - 与 DASH-001 模型及 DASH-003 扩展 widget 兼容
  - API/存储序列化 round-trip 测试通过

### 子项 3：NFR-001 NFR-01 Dashboard 首屏性能

- **选题理由**：hub 薄弱项 **#4**（90.0）；M6 排队项中与本轮 Dashboard 扩展最直接相关；作为 perf 基线 companion 避免 M5 组件增多后首屏退化无据可判
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（88%→Dashboard view 首屏 P95 可测）；用户价值（84%→消费端可感知加载体验）
- **用户感知**：Dashboard view 模式首屏在约定阈值内完成（含扩展 widget 场景 smoke）
- **类型**：补缺（NFR stub → 可判定基线）
- **验收标准**（来源 plan §M6 · NFR-001，范围收窄为本轮 companion）：
  - Dashboard view 首屏 perf smoke（P95 阈值 + pytest 或基准脚本）
  - 覆盖含 DASH-003 扩展 widget 的最小 Dashboard fixture
  - 不扩 scope 至报表/全站 NFR-02 或生产 TLS（留 M6 后续）
