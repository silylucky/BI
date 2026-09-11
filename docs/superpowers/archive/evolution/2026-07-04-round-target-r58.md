# 演化轮次选题 — 2026-07-04（M9/M10/M12 仪表板与报表 companion 质量推分 r58）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M9 主题分析 + M10/M12 报表 companion 质量推分续轮**（r53/r57 已交付 DASH-006/RPT-004/005/QUERY-009/NFR-008 簇 L1 + 首轮 companion 并推分至 88.2–91.3；本轮聚焦 **r57 STUCK 三 ID 破 90**（DASH-006 88.2、RPT-004 89.6、RPT-005 89.5），并巩固同域 RPT-006/007 报表扩展面，闭合 r57 修订记录明示的同比环比/GIS 契约后端面、调度执行器 companion、报表产物投递与安全性 86% 共性薄弱维）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 薄弱项汇总 Top3 为远期未 kickoff 项 **META-004 12.0** / **CAT-004 12.0** / **DASH-005 12.1**；**已实现 companion 簇最低**为 **DASH-006 88.2**；`evolution-state.md` **选题卡住计数：DASH-006/RPT-004/RPT-005 各连续 2 轮**（最近总分 88.2–89.6）；待办池空；`git log -5` r58 G1 bootstrap（sha a2c7e73）+ r57 已 Squash merge #89（sha 8d2a392）
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；Top5 薄弱汇总 12.0–12.1 均 ≪90，非评分饱和；待办池无未消化项）；**STUCK 优先于远期 12 分 stub**（三 ID 距 90 仅 0.4–1.8 分，续轮 ROI 高于 META/CAT 远期 kickoff）；对齐 r53→r57→**r58** companion 质量推分节奏；五 ID 跨 `theme_analysis`/`dashboards`/`reports` 两模块（≤3），共享 r57 `test_dash_rpt_query_nfr_r57` companion 模式、M7 ACL 与报表 extension 契约；符合 `goal.md` **G3 BI 展现全链路**（仪表板、主题分析、报表）
- **范围框定**：
  - **模块**（≤3）：`backend/app/theme_analysis/` + `backend/app/dashboards/`（DASH-006 主题分析配置、chart-bindings、调度 companion）+ `backend/app/reports/`（RPT-004/005/006/007 extension、同比环比 API、产物投递 mock 链）
  - **文件**（合计约 16–19，≤20）：theme config_store 执行链 companion、dashboard catalog M7 ACL 回归、schedule mock→semi-real executor 边界、reports extension render-spec/revisions/snapshot/delivery companion、pytest（`test_dash_rpt_r58` 或同级）+ r57 `test_dash_rpt_query_nfr_r57` 37/37 + r55 35/35 + r53 38/38 + r52 52/52 回归门控
  - **不含**：Admin 全量 UI、GIS/fe 前端地图组件、生产级调度 HA、真实 SMTP/对象存储产物投递、META-004/CAT-004 远期 kickoff；QUERY-009/NFR-008（r57 已破 90）重复大改
- **不足 5 项原因**：不适用 — 本轮满 5 项（r57 STUCK 三 ID + 同域 RPT-006/007 巩固）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| META-004 | 12.0 | hub 汇总 #1，元数据远期未 kickoff，非 r57 簇 |
| CAT-004 | 12.0 | hub 汇总 #2，分类远期未 kickoff |
| DASH-005 | 12.1 | hub 汇总 #3，仪表板远期未 kickoff |
| DASH-006 | 88.2 | **入选**（r57 STUCK；簇内最低） |
| RPT-004 | 89.6 | **入选**（r57 STUCK） |
| RPT-005 | 89.5 | **入选**（r57 STUCK） |
| RPT-006 | 90.0 | **入选**（同域巩固；用户价值 84%、安全性 86%） |
| RPT-007 | 90.4 | **入选**（同域巩固；安全性 86%） |
| QUERY-009 | 90.0 | r57 已破 90 STUCK 清零，非本轮主攻 |
| NFR-008 | 91.3 | r57 已破 90，非薄弱 |

### STUCK 标注

- **DASH-006 / RPT-004 / RPT-005** 均在选题卡住计数表（各连续 **2** 轮，最近总分 88.2–89.6）— **未达 ≥3 轮硬标注阈值**，本轮作为 r57 簇 companion 质量推分主攻项纳入，不单独标 `STUCK:` 硬阻塞；若本轮仍未破 90，下轮达 3 轮时建议人工 `create-evolution-goal` / `create-evolution-plan` 复核验收标准

## 演化北极星自检

1. **用户感知**：主题分析配置与仪表板 chart-bindings 联动更完整；报表 extension 支持同比环比与产物投递 mock 可验收；调度从 mock 执行器向 semi-real 边界推进；错误与 ACL 拦截可定位。
2. **补缺 or 创造**：补缺（完整度 84–88%、安全性 86%、r57 修订记录明示 companion 遗留项）；符合 `goal.md` G3。
3. **不做代价**：DASH/RPT r57 簇停留 88–89 分，同比环比/产物投递/调度执行器缺口持续，STUCK 轮次累加，阻碍下一演化轨道。
4. **能否批处理更小项**：已批处理为 r57 跨域五 ID companion 质量推分（单轮 ≤20 文件、≤3 模块）。
5. **共几项/文件模块**：5 项；theme_analysis + dashboards + reports + tests，估 ≤19 文件、3 模块。

---

### 子项 1：DASH-006 主题分析项

- **选题理由**：hub **r57 簇最低分（88.2）**；**完整度 84%**、**安全性 86%**；r53/r57 已交付主题分析 config_store + chart-bindings L1，调度 mock 执行器与 M7 catalog ACL companion 未充分闭合；STUCK **连续 2 轮**
- **选题时 PRD 加权总分**：88.2/100（用户价值 **82%** · 完整度 **84%** · 可靠性 **94%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：完整度（84%→≥90% chart-bindings 执行链 + 调度 semi-real 边界）；安全性（86%→≥90% M7 ACL 回归）
- **用户感知**：主题分析配置保存后可稳定绑定图表与目录 ACL；调度触发具备可验收执行状态回执
- **类型**：补缺（闭合 r57 L1 遗留主题分析 companion 缺口）
- **验收标准**（来源 hub · DASH-006 + r57 基线）：
  - theme config_store + chart-bindings 联动 companion + schedule executor semi-real smoke
  - catalog M7 ACL 拦截 pytest
  - 加权总分目标 ≥90

### 子项 2：RPT-004 报表项

- **选题理由**：hub **89.6**（r57 STUCK）；**用户价值 84%**、**架构 88%**、**安全性 86%**；r53/r57 已交付报表 extension L1，同比环比 API 与 render-spec 联动 companion 未充分闭合；STUCK **连续 2 轮**
- **选题时 PRD 加权总分**：89.6/100（用户价值 **84%** · 完整度 **88%** · 可靠性 **96%** · 架构 **88%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→≥88% 同比环比契约可感知）；安全性（86%→≥90% extension ACL 回归）
- **用户感知**：报表 extension 支持同比/环比指标配置并可渲染预览；未授权访问被结构化拦截
- **类型**：补缺
- **验收标准**（来源 hub · RPT-004 + r57 基线）：
  - 同比环比 API + render-spec 联动 companion pytest
  - extension ACL 4xx/`ok=false` smoke
  - 加权总分目标 ≥90

### 子项 3：RPT-005 报表项

- **选题理由**：hub **89.5**（r57 STUCK）；**完整度 86%**、**安全性 86%**；r53/r57 已交付报表 revisions/snapshot L1，产物投递 mock 链与 batch 部分失败 detail companion 未充分闭合；STUCK **连续 2 轮**
- **选题时 PRD 加权总分**：89.5/100（用户价值 **84%** · 完整度 **86%** · 可靠性 **96%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：完整度（86%→≥90% revisions/snapshot/delivery mock 链）；安全性（86%→≥90% 产物访问守卫）
- **用户感知**：报表修订与快照可追踪；产物投递 mock 具备成功/失败/重试可感知回执
- **类型**：补缺
- **验收标准**（来源 hub · RPT-005 + r57 基线）：
  - revisions/snapshot + delivery mock companion pytest
  - batch 部分失败 structured detail smoke
  - 加权总分目标 ≥90

### 子项 4：RPT-006 报表项

- **选题理由**：hub **90.0**（边界分）；**用户价值 84%**、**架构 88%**、**安全性 86%**；r54/r55 已破 90，但与 RPT-004/005 同 extension 簇，本轮巩固防止 STUCK 邻域回退；同比环比与 render-spec 共享契约
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构 **88%** · 测试覆盖 **100%** · 性能 **88%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→≥88% extension 指标可感知）；安全性（86%→≥90%）
- **用户感知**：报表 extension 批量操作与指标配置错误可定位，与 RPT-004 同比环比面一致
- **类型**：补缺（同簇巩固）
- **验收标准**（来源 hub · RPT-006 + r55 基线）：
  - extension batch + render-spec 联动回归 companion
  - pytest + r55 `test_rpt_gov_meta_conn_r55` 回归门控
  - 加权总分巩固 ≥90

### 子项 5：RPT-007 报表项

- **选题理由**：hub **90.4**；**安全性 86%** 为簇内共性薄弱维；r54/r55 已交付 gov openapi 联动，本轮与 RPT-004/005 产物投递/发布面闭合，防止报表域安全性回退
- **选题时 PRD 加权总分**：90.4/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **96%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **86%** · 交互 N/A）
- **主攻薄弱维**：安全性（86%→≥90% 发布/产物访问守卫）；性能（88%→≥90% extension 批量 smoke）
- **用户感知**：报表发布与 openapi 映射变更具备 ACL 守卫；批量 extension 操作性能可探测
- **类型**：补缺（同簇巩固）
- **验收标准**（来源 hub · RPT-007 + r55 基线）：
  - publish/openapi-mappings ACL companion pytest
  - extension 批量性能 smoke
  - 加权总分巩固 ≥90
