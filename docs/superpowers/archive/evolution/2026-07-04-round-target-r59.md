# 演化轮次选题 — 2026-07-04（跨域远期薄弱项 L1 kickoff r59）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**跨域远期薄弱项 L1 kickoff**（r58 已完成 DASH-006/RPT-004/005/006/007 companion 质量推分并破 90 STUCK 清零；hub 已实现簇最低分升至 **90.0+**；本轮回落 hub 薄弱项汇总 **Top5 远期 stub**（12.0–12.1），为 META/CAT/DASH/CONN/DESIGN 五域交付 L1 骨架与 smoke 测试，闭合完整度 5%、可靠性 0%、测试覆盖 0% 共性缺口）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 薄弱项汇总 Top5 **META-004 12.0** / **CAT-004 12.0** / **DASH-005 12.1** / **CONN-018 12.1** / **DESIGN-004 12.1**；`evolution-state.md` **选题卡住计数表空**（r58 P5 五 ID 破 90 清零）；待办池空；`git log -5` r59 G1 bootstrap（sha a8280a9）+ r58 已 Squash merge #90（sha a9d5f41）
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；Top5 汇总 12.0–12.1 均 ≪90，非评分饱和；待办池无未消化项）；五 ID 为 hub 加权总分绝对最低档且均为 **完整度 5%** 远期未 kickoff stub，按 8 维升序批量 L1 优于继续打磨 ≥90 已实现簇；跨五域但每项 L1 体量可控（方言/域骨架 + errors + smoke），合计 ≤20 文件；对齐 `goal.md` **G2 多类别数据源**（CONN-018 信创 Kingbase）、**G3 BI 展现**（DASH-005）、**G5 治理**（META/CAT 元数据与分类）
- **范围框定**：
  - **模块**（5 域薄骨架，每项 ≤4 文件，合计 ≤20）：`backend/app/metadata/`（META-004）+ `backend/app/catalog/` 或分类子域（CAT-004）+ `backend/app/dashboards/` 远期项（DASH-005）+ `backend/app/datasources/dialects/kingbase/`（CONN-018）+ `backend/app/designer/` 远期项（DESIGN-004）+ `api/v1` 薄 entry + pytest（`test_meta_cat_dash_conn_design_r59` 或同级）
  - **文件**（估 16–19，≤20）：五域 errors/scaffold + registry 或 CRUD 最小路由 + Kingbase dialect mock smoke + r59 新测 ≥30 断言 + r58 `test_dash_rpt_r58` 38/38 + r57 37/37 回归门控
  - **不含**：Admin 全量 UI、生产级 Kingbase 集群联调、仪表板/设计器 fe 页面、META/CAT 全量治理 UI、DASH-005 与 DASH-006 重复大改（DASH-006 已 ≥91）
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub Top5 远期 stub）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-004 | 12.0 | **入选**（hub #1，元数据远期 stub） |
| CAT-004 | 12.0 | **入选**（hub #2，分类远期 stub） |
| DASH-005 | 12.1 | **入选**（hub #3，仪表板远期 stub） |
| CONN-018 | 12.1 | **入选**（hub #4，人大金仓连接器 stub） |
| DESIGN-004 | 12.1 | **入选**（hub #5，设计器远期 stub） |
| RPT-001 | 12.2 | hub #6，本轮 Top5 已满 |
| VIEW-002 | 12.2 | hub #7，视图远期 stub，下轮候选 |
| VIEW-003 | 12.2 | hub #8，视图远期 stub，下轮候选 |
| CAT-007 | 12.2 | 同 CAT 域，CAT-004 分更低优先 |
| GOV-007 | 12.4 | 治理远期 stub，总分高于 Top5 |
| DASH-006 | 91.2 | r58 已破 90，非薄弱 |
| RPT-004 | 91.3 | r58 已破 90，非薄弱 |

### STUCK 标注

- **选题卡住计数表空** — 五 ID 均为远期 stub **首次入选**，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：元数据/分类/仪表板/设计器/API 面出现可调用 L1 端点；Kingbase 连接器可 test-connection mock smoke；错误响应结构化可定位。
2. **补缺 or 创造**：补缺（五域完整度 5%→L1 可验收骨架）；符合 `goal.md` G2/G3/G5。
3. **不做代价**：hub Top5 持续停留 12 分档，远期功能轨道阻塞，后续 companion 轮无法启动。
4. **能否批处理更小项**：已批处理为跨五域 L1 kickoff（单轮 ≤20 文件、每项薄骨架）。
5. **共几项/文件模块**：5 项；metadata + catalog + dashboards + kingbase dialect + designer + tests，估 ≤19 文件、5 薄域。

---

### 子项 1：META-004 元数据项

- **选题理由**：hub **全表最低分并列 #1（12.0）**；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%**；F11-META 域远期未 kickoff，r55 已交付 META-006 实体 schema companion，META-004 为同域更低分 stub
- **选题时 PRD 加权总分**：12.0/100（用户价值 **47%** · 完整度 **5%** · 可靠性 **0%** · 架构 **12%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥70% L1 骨架）；可靠性（0%→≥70% 非法输入拦截）；测试覆盖（0%→≥90% smoke pytest）
- **用户感知**：元数据项 CRUD 或 validate 最小 API 可调用，未实现路径返回结构化错误
- **类型**：补缺（META 域远期 L1 kickoff）
- **验收标准**（来源 hub · META-004）：
  - metadata 域 scaffold + 最小路由/errors
  - validate 或 items 列表 smoke pytest
  - 加权总分目标 L1 ≥80（破 12 分 stub）

### 子项 2：CAT-004 分类项

- **选题理由**：hub **全表最低分并列 #1（12.0）**；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%**；F14-CAT 域远期未 kickoff，M7 目录 ACL 已在 r53/r57 companion 部分闭合，CAT-004 为分类本体 stub
- **选题时 PRD 加权总分**：12.0/100（用户价值 **49%** · 完整度 **5%** · 可靠性 **0%** · 架构 **9%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥70% 分类树/项 L1）；可靠性（0%→≥70%）；测试覆盖（0%→≥90%）
- **用户感知**：分类项最小 CRUD 或 tree 节点 API 可调用，循环/非法父节点被拦截
- **类型**：补缺（CAT 域远期 L1 kickoff）
- **验收标准**（来源 hub · CAT-004）：
  - catalog/分类子域 scaffold + tree/item 最小路由
  - 非法 move/cycle smoke pytest
  - 加权总分目标 L1 ≥80

### 子项 3：DASH-005 仪表板项

- **选题理由**：hub **#3（12.1）**；**完整度 5%**、**可靠性 0%**；F07-DASH 域远期 stub，DASH-006 主题分析已 ≥91，DASH-005 为仪表板本体远期项
- **选题时 PRD 加权总分**：12.1/100（用户价值 **48%** · 完整度 **5%** · 可靠性 **0%** · 架构 **10%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **13%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥70% dashboard item L1）；可靠性（0%→≥70%）；架构（10%→≥70% 与 DASH-001~003 边界清晰）
- **用户感知**：仪表板项最小 CRUD 或 publish 状态 API 可探测，与已有 dashboards 域不冲突
- **类型**：补缺（DASH 域远期 L1 kickoff）
- **验收标准**（来源 hub · DASH-005）：
  - dashboards 远期项 scaffold + item 最小路由
  - ACL/404 smoke pytest
  - 加权总分目标 L1 ≥80；不重复 DASH-006 主题分析大改

### 子项 4：CONN-018 人大金仓连接器

- **选题理由**：hub **#4（12.1）**；**完整度 5%**、**可靠性 0%**、**测试覆盖 0%**；F04-CONN 信创 Kingbase 方言远期未 kickoff，对齐 `goal.md` G2 多类别数据源与 NFR-04 插件模式
- **选题时 PRD 加权总分**：12.1/100（用户价值 **48%** · 完整度 **5%** · 可靠性 **0%** · 架构 **12%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **11%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥70% dialect 注册 + test-connection）；可靠性（0%→≥70% HTTP 4xx/502 结构化）；测试覆盖（0%→≥90% mock smoke）
- **用户感知**：数据源类型列表含 kingbase；test-connection mock 成功/失败可验收
- **类型**：补缺（M11 信创连接器 L1 kickoff）
- **验收标准**（来源 hub · CONN-018 + CONN 域惯例）：
  - `dialects/kingbase/` scaffold + registry 登记 + errors
  - test-connection mock HTTP smoke pytest（对齐 r41/r40 连接器 L1 模式）
  - 加权总分目标 L1 ≥80

### 子项 5：DESIGN-004 设计器项

- **选题理由**：hub **#5（12.1）**；**完整度 5%**、**可靠性 0%**；F12-DESIGN 域远期 stub，r49/r52 已交付 DESIGN-003/005 sql_mode/output_fields companion ≥90，DESIGN-004 为设计器本体远期项
- **选题时 PRD 加权总分**：12.1/100（用户价值 **48%** · 完整度 **5%** · 可靠性 **0%** · 架构 **11%** · 测试覆盖 **0%** · 性能 **0%** · 安全性 **12%** · 交互 N/A）
- **主攻薄弱维**：完整度（5%→≥70% designer item L1）；可靠性（0%→≥70%）；测试覆盖（0%→≥90%）
- **用户感知**：设计器项最小 save/load 或 validate API 可调用，与 DESIGN-003/005 模式/字段不重复
- **类型**：补缺（M13 设计器远期 L1 kickoff）
- **验收标准**（来源 hub · DESIGN-004）：
  - designer 远期项 scaffold + item 最小路由/errors
  - validate smoke pytest
  - 加权总分目标 L1 ≥80；不重复 DESIGN-003/005 已闭合面
