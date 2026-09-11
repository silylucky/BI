# 演化轮次选题 — 2026-07-04（跨域 STUCK 簇 companion 质量推分 r67）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**跨域 STUCK 簇 companion 质量推分**（r66 已将 CAT-001/CAT-002/DASH-005/RPT-001/META-004 推至 **90.0–90.4** 并 STUCK 清零；hub 薄弱项汇总 Top8 与本批八 ID 完全重合，均 **84.2–84.4**、**性能 58%** + **完整度 76%**；本轮聚焦 perf probe ≤50ms + ACL/NOT_FOUND/validate 边界闭合，目标加权总分 **≥90** 破 STUCK）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 薄弱项 Top5 — **DASH-004 84.2**、**NFR-001 84.2**、**NFR-002 84.2**、**NFR-003 84.2**、**NFR-004 84.2**（本轮从八 ID STUCK 簇中择优跨域 spread，非机械取 Top5 全 NFR）；`evolution-state.md` **选题卡住计数：八 ID 各连续 1 轮**（CONN-018/DASH-004/GOV-007/NFR-001–004/RPT-003，均 84.2–84.4，未达 ≥3 硬标注阈值）；待办池空；`git log -5` G1 r67 bootstrap（sha b6b8208）+ r66 已 Squash merge #101（sha 1a56314）
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；hub Top5 加权总分 84.2 均 <90，非评分饱和；待办池无未消化项）；对齐 r66 companion 质量推分节奏（r66 明确将 DASH-004/NFR/CONN/RPT/GOV 八 ID 留 r67+）；五 ID 跨 DASH/NFR/CONN/RPT 四域、同属 r59–r64 L1/stub 交付簇且共享 **性能 58%** 与 **完整度 76%** 薄弱维，单轮批处理 companion 推分；符合 `goal.md` **G2 多源接入**（CONN-018）、**G3 BI 展现**（DASH-004/RPT-003）、**G5 治理**（NFR-001/002 横切 perf 基线）
- **范围框定**：
  - **模块**（≤3 后端域 + 薄 entry，合计 ≤20 文件）：`backend/app/dashboards/` 或 `global_filters` config_store（DASH-004 companion：global_filter_linkage 校验/ACL/probe）+ `backend/app/core/nfr/` 或同级横切模块（NFR-001 dashboard-first-screen、NFR-002 report-perf mock probe companion：ACL/边界/probe）+ `backend/app/datasources/dialects/kingbase/`（CONN-018 companion：PG 委托 HTTP 链/错误域/probe）+ `backend/app/reports/` templates 子模块（RPT-003 companion：template blocks ACL/validate/probe）+ `api/v1` 薄 entry + pytest（`test_dash_nfr_conn_rpt_r67` 或同级）
  - **文件**（估 16–19，≤20）：五域 companion errors/validate/probe + 最小路由增量 + r67 新测 ≥32 断言 + r66 `test_cat_dash_rpt_meta_r66` 33/33 + r65 `test_cat_rpt_meta_r65` 32/32 + r64 `test_nfr_cat_r64` 33/33 + r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r59 `test_meta_cat_dash_conn_design_r59` 34/34 回归门控
  - **不含**：Admin 全量 fe 页面、真实 SLA metrics 生产采集、PDF 全链路渲染、M7 地域权限 fe、只读查询集成测；NFR-003/NFR-004/GOV-007 等同分 STUCK 簇留 r68+ companion 轮；fe 首屏/IF-02 查询/生产 TLS 深化
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub 薄弱项汇总八 ID 择优跨域 spread）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| DASH-004 | 84.2 | **入选**（hub #1，性能 58%，r61 L1 global_filters 簇） |
| NFR-001 | 84.2 | **入选**（hub #2，性能 58%，r64 stub dashboard-first-screen 簇） |
| NFR-002 | 84.2 | **入选**（hub #3，性能 58%，r61 report-perf mock probe 簇） |
| NFR-003 | 84.2 | hub #4，NFR 五 ID 同分，本轮已选 NFR-001/002 代表横切 perf，留 r68+ |
| NFR-004 | 84.2 | hub #5，r64 stub 簇，与 NFR-001 同质 spread 留 r68+ |
| CONN-018 | 84.2 | **入选**（hub #6，性能 58%，r59 Kingbase L1 簇，连接器域代表） |
| RPT-003 | 84.2 | **入选**（hub #7，性能 58%，r62 template blocks L1 簇） |
| GOV-007 | 84.4 | hub #8，分略高于 84.2 簇，治理域与本轮 DASH/NFR/CONN/RPT spread 异轨留 r68+ |

### STUCK 标注

- 五入选 ID 均在选题卡住计数表 **连续 1 轮 <90**（84.2）— **未达 ≥3 轮硬标注阈值**，summary 不标 `STUCK:` 硬阻塞
- 表中其余三 ID（NFR-003、NFR-004、GOV-007，各 1 轮 84.2–84.4）**本轮未入选**，companion 破 90 留 r68+

## 演化北极星自检

1. **用户感知**：仪表板全局筛选联动配置更稳、首屏/报表 perf 探测可回归、Kingbase 连接器 HTTP 链闭合、报表模板块 ACL 边界明确；各域 perf probe ≤50ms 可 smoke 验收。
2. **补缺 or 创造**：补缺（五域 companion 质量推分，性能 58%→≥88%、完整度 76%→≥90%）；符合 `goal.md` G2/G3/G5。
3. **不做代价**：hub 八 ID STUCK round 1 持续无法破 90，同分 NFR/GOV 簇阻塞，后续 fe companion 与 M7 RLS 深化无法启动。
4. **能否批处理更小项**：已批处理为跨四域 companion（单轮 ≤20 文件、每项薄增量 perf/ACL/probe）。
5. **共几项/文件模块**：5 项；dashboards + core/nfr + datasources/kingbase + reports/templates + tests，估 ≤19 文件、4 薄域。

---

### 子项 1：DASH-004 仪表板项

- **选题理由**：hub **#1（84.2）**；**性能 58%**、**完整度 76%** 为八 ID 簇最薄弱之一；r61 已 L1 kickoff `global_filter_linkage` config_store，本轮 companion 深化校验链、ACL 与 perf probe
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% global_filters probe ≤50ms）；完整度（76%→≥90% 筛选联动配置校验与空态边界）
- **用户感知**：仪表板全局筛选联动 API 非法字段被拦截，配置读取响应可探测
- **类型**：补缺（DASH 域 companion 质量推分，承接 r61 L1）
- **验收标准**（来源 hub · DASH-004 + r61 惯例）：
  - global_filter_linkage validate/ACL/probe 深化
  - 非法 config smoke pytest
  - 加权总分目标 **≥90**（破 STUCK）

### 子项 2：NFR-001 非功能项

- **选题理由**：hub **#2（84.2）**；**性能 58%**、**完整度 76%**；r64 已 stub L1 kickoff dashboard-first-screen，本轮 companion 深化首屏 perf 探测、边界与 ACL
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% first-screen probe ≤50ms）；完整度（76%→≥90% 首屏指标契约与错误域上浮）
- **用户感知**：仪表板首屏 perf 探测 API 可回归，非法 dashboardId/scope 被结构化拦截
- **类型**：补缺（NFR 横切 companion 质量推分，承接 r64 stub L1）
- **验收标准**（来源 hub · NFR-001 + r64 惯例）：
  - dashboard-first-screen ACL/probe 深化
  - 非法 scope smoke pytest
  - 加权总分目标 **≥90**

### 子项 3：NFR-002 非功能项

- **选题理由**：hub **#3（84.2）**；**性能 58%**、**完整度 76%**；r61 已 L1 kickoff report-perf mock probe，本轮 companion 深化报表 perf 探测链、边界与降级
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% report-perf probe ≤50ms）；完整度（76%→≥90% mock probe 契约与参数校验闭合）
- **用户感知**：报表 perf 探测 API 响应可探测，非法 report/template 参数被拦截
- **类型**：补缺（NFR 横切 companion 质量推分，承接 r61 L1）
- **验收标准**（来源 hub · NFR-002 + r61 惯例）：
  - report-perf mock probe ACL/validate 深化
  - 非法 probe 参数 smoke pytest
  - 加权总分目标 **≥90**

### 子项 4：CONN-018 连接器项

- **选题理由**：hub **#6（84.2）**；**性能 58%**、**完整度 76%**；r59 已 L1 kickoff Kingbase PG 委托+HTTP 链，本轮 companion 深化方言错误域、连接探测与 perf probe
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% kingbase probe ≤50ms）；完整度（76%→≥90% PG 委托链与 HTTP 错误域上浮）
- **用户感知**：Kingbase 连接器测试/探测 API 越权被拦截，非法连接参数返回可定位错误
- **类型**：补缺（CONN 域 companion 质量推分，承接 r59 L1）
- **验收标准**（来源 hub · CONN-018 + r59 连接器域惯例）：
  - kingbase PG 委托 HTTP 链 ACL/probe 深化
  - 非法连接参数 smoke pytest
  - 加权总分目标 **≥90**

### 子项 5：RPT-003 报表项

- **选题理由**：hub **#7（84.2）**；**性能 58%**、**完整度 76%**；r62 已 L1 kickoff template blocks，本轮 companion 深化模板块 ACL、validate 与 perf probe
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% template blocks probe ≤50ms）；完整度（76%→≥90% 模板块 CRUD/validate 边界闭合）
- **用户感知**：报表模板块 API 越权与非法 block 类型被结构化拦截，列表/读取 perf 可回归
- **类型**：补缺（RPT 域 companion 质量推分，承接 r62 L1）
- **验收标准**（来源 hub · RPT-003 + r62 报表域惯例）：
  - template blocks ACL/validate/probe 深化
  - 非法 block smoke pytest
  - 加权总分目标 **≥90**
