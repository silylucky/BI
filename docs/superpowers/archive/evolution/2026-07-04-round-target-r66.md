# 演化轮次选题 — 2026-07-04（跨域 companion 质量推分 r66）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**跨域 companion 质量推分**（r64 stub L1 已将 CAT-001/CAT-002 推至 **83.9**；r59/r60 L1 已将 DASH-005/RPT-001/META-004 推至 **84.0–84.2**；十三 ID STUCK 各 **1 轮** 均 **<90**；hub 薄弱项汇总 Top5 与本批完全重合；本轮聚焦 **性能 58%** + **完整度 74–76%** companion 闭合，目标加权总分 **≥90** 破 STUCK）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 薄弱项 Top5 — **CAT-001 83.9**、**CAT-002 83.9**、**DASH-005 84.0**、**RPT-001 84.2**、**META-004 84.2**；`evolution-state.md` **选题卡住计数：十三 ID 各连续 1 轮**（r64–r65 四 stub + 九远期 stub，均 83.9–84.4，未达 ≥3 硬标注阈值）；待办池空；`git log -5` G1 r66 bootstrap（sha 2edbbb7）+ r65 已 Squash merge #99（sha 0b5d8ff）
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；hub Top5 加权总分 83.9–84.2 均 <90，非评分饱和；待办池无未消化项）；对齐 r63→r65 companion 质量推分节奏（L1/stub kickoff 后次轮破 90）；五 ID 虽跨 CAT/DASH/RPT/META 四域，但同属 r59–r64 交付簇且共享 **性能 58%** 与 **完整度 74–76%** 薄弱维、perf probe ≤50ms + ACL/NOT_FOUND 边界 + smoke pytest 模式，单轮批处理质量推分；符合 `goal.md` **G3 BI 展现**（DASH-005/RPT-001）、**G4 可配置安全**（CAT-001/002 分类 ACL）、**G5 治理**（META-004 元数据 dataset）
- **范围框定**：
  - **模块**（≤3 后端域 + 薄 entry，合计 ≤20 文件）：`backend/app/governance/catalog/`（CAT-001/002 分类项 companion：scope ACL、tree CRUD/move 边界、perf probe）+ `backend/app/dashboards/` 或 `entity_overview` config_store（DASH-005 companion：entity overview 校验/ACL/probe）+ `backend/app/reports/`（RPT-001 companion：reports engine run ACL、非法参数/404、perf probe）+ `backend/app/metadata/dataset/`（META-004 companion：dataset validate+CRUD ACL、probe）+ `api/v1` 薄 entry + pytest（`test_cat_dash_rpt_meta_r66` 或同级）
  - **文件**（估 16–19，≤20）：五域 companion errors/validate/probe + 最小路由增量 + r66 新测 ≥32 断言 + r65 `test_cat_rpt_meta_r65` 32/32 + r64 `test_nfr_cat_r64` 33/33 + r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r59 `test_meta_cat_dash_conn_design_r59` 34/34 回归门控
  - **不含**：Admin 全量 fe 页面、真实 SLA metrics 生产采集、PDF 全链路渲染、M7 地域权限 fe、只读查询集成测、CONN-018 Kingbase 深化；DASH-004/NFR-001–004/RPT-003/GOV-007 等同分 STUCK 簇留 r67+ companion 轮
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub 薄弱项汇总 Top5）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| CAT-001 | 83.9 | **入选**（hub #1 并列最低，性能 58%，r64 stub L1 簇） |
| CAT-002 | 83.9 | **入选**（hub #2 并列最低，性能 58%，r64 stub L1 簇） |
| DASH-005 | 84.0 | **入选**（hub #3，性能 58%，r59 L1 簇） |
| RPT-001 | 84.2 | **入选**（hub #4，性能 58%，r60 L1 簇） |
| META-004 | 84.2 | **入选**（hub #5，性能 58%，r59 L1 簇） |
| DASH-004 | 84.2 | 与 RPT-001/META-004 同分，hub 排名 #6，本轮 Top5 已满 |
| NFR-001 | 84.2 | hub #7，NFR 横切五 ID 同分留 r67+ 专用批 |
| NFR-002 | 84.2 | hub #8，NFR 域 spread 留 r67+ |
| NFR-003 | 84.2 | hub #9，r62 已 companion 破 90，当前 84.2 为评分回落 concern 留后续 |
| NFR-004 | 84.2 | hub #10，r64 stub 簇，留 r67+ |
| CONN-018 | 84.2 | 连接器域，与本轮 CAT/DASH/RPT/META 簇异轨 |
| RPT-003 | 84.2 | RPT 域 RPT-001 分更低且 hub 排名靠前 |
| GOV-007 | 84.4 | hub 排名 #13，分高于 Top5 |

### STUCK 标注

- 五入选 ID 均在选题卡住计数表 **连续 1 轮 <90**（83.9–84.2）— **未达 ≥3 轮硬标注阈值**，summary 不标 `STUCK:` 硬阻塞
- 表中其余八 ID（DASH-004、NFR-001–004、CONN-018、RPT-003、GOV-007，各 1 轮 84.2–84.4）**本轮未入选**，companion 破 90 留 r67+

## 演化北极星自检

1. **用户感知**：分类项树 CRUD/移动边界更稳、实体总览配置可探测、报表引擎运行 ACL 闭合、元数据 dataset 校验链完整；各域 perf probe ≤50ms 可回归。
2. **补缺 or 创造**：补缺（五域 companion 质量推分，性能 58%→≥88%、完整度 74–76%→≥90%）；符合 `goal.md` G3/G4/G5。
3. **不做代价**：hub Top5 STUCK round 1 持续无法破 90，十三 ID 薄弱簇阻塞，后续 NFR/CONN/GOV 同分项与 fe companion 无法启动。
4. **能否批处理更小项**：已批处理为跨四域 companion（单轮 ≤20 文件、每项薄增量 perf/ACL/probe）。
5. **共几项/文件模块**：5 项；governance/catalog + dashboards + reports + metadata + tests，估 ≤19 文件、4 薄域。

---

### 子项 1：CAT-001 分类项

- **选题理由**：hub **#1 并列最低（83.9）**；**性能 58%**、**完整度 76%** 为簇内最薄弱；r64 已 stub L1 kickoff 分类项骨架，本轮 companion 深化 scope ACL、tree move 边界与 perf probe
- **选题时 PRD 加权总分**：83.9/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% probe_list/move ≤50ms）；完整度（76%→≥90% 分类项 CRUD/move 边界闭合）
- **用户感知**：分类项 API 越权被拦截，树节点移动循环/非法父节点返回结构化错误，列表/移动响应可探测
- **类型**：补缺（CAT 域 companion 质量推分，承接 r64 stub L1）
- **验收标准**（来源 hub · CAT-001 + r64/r65 CAT 域惯例）：
  - 分类项 scope ACL + move/cycle NOT_FOUND 深化
  - perf probe ≤50ms smoke pytest
  - 加权总分目标 **≥90**（破 STUCK）

### 子项 2：CAT-002 分类项

- **选题理由**：hub **#2 并列最低（83.9）**；**性能 58%**、**完整度 76%**；r64 已 stub L1 kickoff，与 CAT-001 同域批处理共享 catalog 夹具；本轮 companion 深化第二分类项变体 ACL 与 perf
- **选题时 PRD 加权总分**：83.9/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88%）；完整度（76%→≥90% 第二分类项边界与 CAT-001 不重复）
- **用户感知**：第二分类维度项 CRUD 与 scope 边界可验收，perf smoke 可回归
- **类型**：补缺（CAT 域 companion 质量推分，与 CAT-001 同批）
- **验收标准**（来源 hub · CAT-002 + r64 惯例）：
  - 分类项变体 ACL/validate 深化 + perf probe
  - viewer/enterprise scope smoke pytest
  - 加权总分目标 **≥90**

### 子项 3：DASH-005 仪表板项

- **选题理由**：hub **#3（84.0）**；**性能 58%**、**完整度 74%** 为五 ID 中完整度最低；r59 已 L1 kickoff entity_overview config_store，本轮 companion 深化校验链、ACL 与 perf probe
- **选题时 PRD 加权总分**：84.0/100（用户价值 **84%** · 完整度 **74%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% entity_overview probe ≤50ms）；完整度（74%→≥90% 配置校验与空态边界）
- **用户感知**：实体总览仪表板配置 API 非法字段被拦截，配置读取响应可探测
- **类型**：补缺（DASH 域 companion 质量推分）
- **验收标准**（来源 hub · DASH-005 + r59 惯例）：
  - entity_overview validate/ACL/probe 深化
  - 非法 config smoke pytest
  - 加权总分目标 **≥90**

### 子项 4：RPT-001 报表项

- **选题理由**：hub **#4（84.2）**；**性能 58%**、**完整度 76%**；r60 已 L1 kickoff reports engine run，本轮 companion 深化运行 ACL、非法参数/404 与 perf probe
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% engine run probe ≤50ms）；完整度（76%→≥90% run 边界与错误域上浮）
- **用户感知**：报表引擎运行 API 越权与非法 template/engine 参数被结构化拦截，运行探测 perf 可回归
- **类型**：补缺（RPT 域 companion 质量推分）
- **验收标准**（来源 hub · RPT-001 + r60/r58 报表域惯例）：
  - reports engine run ACL/NOT_FOUND 深化 + perf probe
  - 非法 run 参数 smoke pytest
  - 加权总分目标 **≥90**

### 子项 5：META-004 元数据项

- **选题理由**：hub **#5（84.2）**；**性能 58%**、**完整度 76%**；r59 已 L1 kickoff dataset validate+CRUD，本轮 companion 深化 dataset ACL、validate 链与 perf probe
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% dataset validate/list probe ≤50ms）；完整度（76%→≥90% CRUD+validate 链闭合）
- **用户感知**：元数据 dataset 校验与 CRUD 越权被拦截，非法 schema/列名返回可定位错误
- **类型**：补缺（META 域 companion 质量推分）
- **验收标准**（来源 hub · META-004 + r59/r65 metadata 域惯例）：
  - dataset validate+CRUD ACL/probe 深化
  - 非法 dataset smoke pytest
  - 加权总分目标 **≥90**
