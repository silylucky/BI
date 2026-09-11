# 演化轮次选题 — 2026-07-06（M5 VIEW-001 收官 + M6 集成前置）

## 本轮演化目标（共 3 项）

### 选题决策

- **批量主题**：**M5 VIEW-001 FR-VIEW-1 视图协议收官** + **M6 一期集成前置 companion**（Dashboard 首屏 perf 收官 + 查询 catalog 附录 E L1）；对齐 `goal.md` **G3 BI 展现** 与 plan §M5 末项勾选后衔接 §M6「一期集成验收」
- **来源**：`docs/automate/plan.md` §**M5**（第一个含未完成 `[ ]` 的节，**1 项** VIEW-001；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M5 含 1 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` 1ced4f1（G1 idle reset）+ ff5544b（M5 DASH-003/VIEW-001/NFR-001 #209）+ 513ebb4（M-FE-3 #208）+ 2427627（M-FE-3 #207）+ ce725cc（M-FE-2 #206）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **合并理由**：上轮 r212–r216 已交付 DASH-003 四类 widget + VIEW-001 `protocolVersion` round-trip + NFR-001 首屏 smoke，但 plan **M5 VIEW-001** 与 **M6 NFR-001** 仍 `[ ]`（分片验收未全勾）；本轮以 VIEW-001 剩余 FR-VIEW-1 契约（全 widget 类型校验、破坏性输入、存储 round-trip）为主项；NFR-001 扩 perf 覆盖至 DASH-003 扩展 widget fixture 并勾 plan；GOV-001 为 M6 plan 顺序 #1 最小 L1 companion，不扩总线全自动（GOV-007）或 CAT 分类 burst
- **范围框定**：
  - **模块**（≤3）：`backend/app/`（view/dashboard 协议校验 + governance catalog stub）+ `fe/`（NFR 首屏 perf smoke fixture，若需）+ `tests/`（VIEW-001 协议边缘 + NFR-001 perf + GOV-001 catalog probe）
  - **文件**（估 ≤16，≤20）：`backend/app/` view 协议 validator/schema、gov catalog 附录 E stub、`tests/test_view_*` / `test_nfr_001*` / `test_gov_001*`、薄 `docs/api/README.md` + `prd` 回写锚点；**不新增** migration 除非协议字段缺口
  - **不含**：M13 冻结项、Dataset（QUERY-009）、M7 连接器（CONN-004 等）、CAT-001~007 分类 burst、GOV-002 总线 PoC 全链路、生产 TLS/全站 NFR（NFR-004）、VIZ-005 筛选 UI（M11）
- **不足 5 项原因**：plan §M5 **仅余 1 项** VIEW-001；同节无第二 plan 项；待办池空；hub Top10 均 ≥90（饱和态）— 仅从执行范围内下一节 M6 择 **NFR-001**（上轮 companion 未勾 plan）+ **GOV-001**（plan 顺序 #1）达 G2 下限 3 项；GOV-002/CAT-001 留 M6 专项轮避免跨 4 域超 20 文件

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIEW-001 | 91.2 | **入选**（plan M5 唯一 `[ ]`，FR-VIEW-1 收官） |
| NFR-001 | 91.3 | **入选**（M6 plan 未勾；上轮 companion 首屏 smoke 待收官） |
| GOV-001 | 90.2 | **入选**（M6 plan #1；catalog 附录 E L1 companion） |
| CAT-001 | 90.0 | hub #1 饱和 ≥90；属 M6 分类 burst，与本节 VIEW 协议弱相关 |
| CAT-002 | 90.0 | hub #2，同上 |
| CONN-004 | 90.0 | hub #3，连接器属 M7 排队 |
| GOV-002 | 90.4 | M6 plan #2；总线 PoC 范围大于本轮 companion 预算 |
| QUERY-009 | 90.0 | hub #5，Dataset 属 M13 冻结 |
| VIZ-005 | 90.0 | hub #6，维度筛选 UI 属 M11 排队 |
| API-001 | 90.0 | M6 已勾 API-001/002；IF-06 与本节无新增缺口 |

### STUCK 标注

- 选题卡住计数表**空** — 三入选 ID 加权总分均 ≥90，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：Dashboard 视图配置全 widget 类型可校验、非法配置有结构化错误；扩展 widget Dashboard 首屏 perf 有可判定基线；查询接口 catalog 附录 E 可探测
2. **补缺 or 创造**：补缺（M5/M6 plan 未勾项 + 上轮 partial 收官）；符合 `goal.md` **G3** 与 **G5** 治理前置
3. **不做代价**：M5 无法勾选完成、无法进入 M6 集成验收主线；VIEW 协议边缘无测导致生产配置损坏风险；首屏 perf 无据可判
4. **能否批处理更小项**：VIEW-001 协议校验与 round-trip 同域；NFR-001 仅 smoke 扩 fixture；GOV-001 仅 catalog stub + probe
5. **共几项/文件模块**：3 项；`backend` view+gov + `tests`（+ 薄 `fe` perf fixture），估 ≤16 文件、3 模块

---

### 子项 1：VIEW-001 DashboardView 视图协议 FR-VIEW-1

- **选题理由**：plan M5 **唯一未完成项**；上轮已交付 `protocolVersion` round-trip 与 DASH-003 widget 兼容骨架，分片验收仍 `[ ]` — 需补全 FR-VIEW-1 schema 校验（含 heatmap/kpi/timeline/map）、破坏性输入与存储/API round-trip
- **选题时 PRD 加权总分**：91.2/100（用户价值 **84%** · 完整度 **96%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→视图配置可互操作、非法配置可感知）；完整度（96%→分片验收全勾）
- **用户感知**：Dashboard 保存/加载任意 widget 组合配置稳定；非法 widget 配置返回结构化校验错误
- **类型**：补缺（VIEW 域协议收官）
- **验收标准**（来源 plan §M5 · VIEW-001）：
  - FR-VIEW-1 全 widget 类型（含 DASH-003 扩展）schema 校验与版本策略
  - API/存储序列化 round-trip 与破坏性输入测试通过
  - plan M5 VIEW-001 可勾选；分片验收项全绿

### 子项 2：NFR-001 NFR-01 Dashboard 首屏性能

- **选题理由**：M6 plan **未勾**；上轮 r216 companion 已交付基础首屏 P95 smoke，需扩覆盖至含 DASH-003 扩展 widget 的 Dashboard fixture 并勾 plan
- **选题时 PRD 加权总分**：91.3/100（用户价值 **86%** · 完整度 **92%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **100%** · 性能 **90%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：完整度（92%→plan 勾选 + fixture 覆盖扩展 widget）；性能（90%→P95 阈值含扩展场景）
- **用户感知**：含地图/热力/KPI/时间轴的 Dashboard view 首屏在约定阈值内
- **类型**：补缺（NFR companion 收官）
- **验收标准**（来源 plan §M6 · NFR-001，范围收窄）：
  - Dashboard view 首屏 perf smoke 覆盖 DASH-003 扩展 widget fixture
  - P95 阈值可判定；pytest/基准脚本 exit 0
  - plan M6 NFR-001 可勾选；不扩 scope 至报表 NFR-002 或生产 TLS（NFR-004）

### 子项 3：GOV-001 查询接口分类 catalog 附录 E

- **选题理由**：M6 plan **顺序 #1**；hub 总分 90.2、用户价值 82% 为 governance 域最薄弱；L1 catalog 附录 E stub + probe 为 M6 集成验收前置，与 VIEW-001 无冲突
- **选题时 PRD 加权总分**：90.2/100（用户价值 **82%** · 完整度 **92%** · 可靠性 **92%** · 架构健康 **90%** · 测试覆盖 **96%** · 性能 **86%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→查询分类 catalog 可发现）；性能（86%→catalog probe ≤50ms）
- **用户感知**：平台可枚举查询接口分类（附录 E catalog）；OpenAPI/治理文档有锚点
- **类型**：补缺（GOV 域 L1 kickoff）
- **验收标准**（来源 plan §M6 · GOV-001）：
  - 查询接口分类 catalog 附录 E L1（枚举 + 结构化 schema）
  - catalog probe 测试 + ACL/scope guard（若适用）
  - 不扩 scope 至 GOV-002 总线 PoC 或 GOV-007 全自动注册
