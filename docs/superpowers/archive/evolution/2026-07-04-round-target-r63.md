# 演化轮次选题 — 2026-07-04（跨域 companion 质量推分 r63）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**跨域 companion 质量推分**（r59–r62 四轮 L1 kickoff 已将二十 ID 推至 **82.9–84.4** 且均 **<90 STUCK round 1**；hub 已实现簇最低分 **82.9** 三并列 VIZ-007/VIEW-002/DESIGN-004；本轮聚焦 **性能 58%** + **完整度 74–76%** companion 闭合，目标加权总分 **≥90** 破 STUCK）
- **来源**：`docs/automate/plan.md` §M1 + §M1B 勾选 **12/12 已完成**，无含 `[ ]` 的活跃节（已知 concern，回落纯 8 维选题）；`prd.md` hub 已实现簇最低 **VIZ-007/VIEW-002/DESIGN-004 82.9**；`evolution-state.md` **选题卡住计数：二十 ID 各连续 1 轮**（r59–r62 companion 簇，均 82.9–84.4，未达 ≥3 硬标注阈值）；待办池空；`git log -5` G1 r63 bootstrap（sha ee099a3）+ r62 已 Squash merge #95/#96
- **合并理由**：饱和熔断未触发（plan 无未完成 `[ ]` 故执行熔断检查；hub Top5 含 13.1–82.9 均 ≪90，非评分饱和；待办池无未消化项）；四枚远期 stub（NFR-001/CAT-001/NFR-004/CAT-002，13.1–13.9）留 **r64 专用 stub 批**；本轮优先破 **82.9 三并列** companion 瓶颈，与 r58 DASH/RPT companion 推分模式一致；跨五域但每项 companion 体量可控（perf probe/mock suite/ACL 边界 + smoke），合计 ≤20 文件；对齐 `goal.md` **G3 BI 展现**（VIZ-007/VIEW-002/003）、**G5 治理**（DESIGN-004 workflow-link）、**G4 可配置安全**（CAT-005 分类 ACL）
- **范围框定**：
  - **模块**（5 域 companion 薄增量，每项 ≤4 文件，合计 ≤20）：`backend/app/viz/`（VIZ-007 sdk_portal 深化）+ `backend/app/views/`（VIEW-002/003 role/default-views 深化）+ `backend/app/designer/`（DESIGN-004 workflow-link perf/ACL）+ `backend/app/catalog/`（CAT-005 ticket stats/ACL 深化）+ `api/v1` 薄 entry + pytest（`test_viz_view_design_cat_r63` 或同级）
  - **文件**（估 16–19，≤20）：五域 companion errors/validate/probe + 最小路由增量 + r63 新测 ≥32 断言 + r62 `test_cat_nfr_rpt_meta_r62` 32/32 + r61 `test_cat_dash_viz_nfr_r61` 32/32 + r60 `test_rpt_view_cat_gov_r60` 34/34 回归门控
  - **不含**：Admin 全量 fe 页面、真实 SLA metrics 生产采集、PDF 全链路渲染、M7 地域权限 fe、OpenSearch 只读查询集成测；四枚远期 stub（NFR-001/CAT-001/NFR-004/CAT-002）L1 kickoff 留 r64
- **不足 5 项原因**：不适用 — 本轮满 5 项（hub 已实现簇最低 82.9 三并列 + 次低 83.3/84.2 各一）

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| VIZ-007 | 82.9 | **入选**（hub 已实现簇最低并列 #1，性能 58%） |
| VIEW-002 | 82.9 | **入选**（hub 已实现簇最低并列 #1，性能 58%） |
| DESIGN-004 | 82.9 | **入选**（hub 已实现簇最低并列 #1，性能 58%） |
| CAT-005 | 83.3 | **入选**（次低 STUCK 1 轮，性能 58%，与 CAT-007 同分取 r61 已 kickoff 项深化） |
| VIEW-003 | 84.2 | **入选**（VIEW 域批处理，与 VIEW-002 共享 views 夹具） |
| NFR-001 | 13.1 | hub 绝对最低 stub，留 r64 专用四 stub 批（本轮 companion 优先） |
| CAT-001 | 13.5 | hub stub #2，留 r64 |
| NFR-004 | 13.5 | hub stub #3，留 r64 |
| CAT-002 | 13.9 | hub stub #4，留 r64 |
| CAT-007 | 83.3 | 与 CAT-005 同分，CAT-005 r61 已 kickoff 优先 companion |
| DASH-005 | 84.0 | 本轮 VIEW/CAT 域已占 3 项，域 spread 优先 VIEW-003 |

### STUCK 标注

- 五入选 ID 均在选题卡住计数表 **连续 1 轮 <90**（82.9–84.2）— **未达 ≥3 轮硬标注阈值**，summary 不标 STUCK 硬阻塞
- 表中其余十五 ID（r59–r62 其他 companion 簇）**本轮未入选**，破 90 留 r64+ companion 轮

## 演化北极星自检

1. **用户感知**：SDK 门户生命周期更稳、角色默认视图边界可探测、设计器 workflow-link 发布就绪探测、分类工单统计 ACL 闭合；perf mock suite 可回归。
2. **补缺 or 创造**：补缺（五域 companion 质量推分，性能 58%→≥88%）；符合 `goal.md` G3/G4/G5。
3. **不做代价**：二十 ID STUCK round 1 持续无法破 90，演化节奏停滞，后续 stub 批与 fe companion 阻塞。
4. **能否批处理更小项**：已批处理为跨五域 companion（单轮 ≤20 文件、每项薄增量）。
5. **共几项/文件模块**：5 项；viz + views + designer + catalog + tests，估 ≤19 文件、4–5 薄域。

---

### 子项 1：VIZ-007 可视化项（SDK 门户 companion）

- **选题理由**：hub **已实现簇最低并列 #1（82.9）**；**性能 58%**、**完整度 74%** 为簇内最薄弱；r61 已 L1 kickoff sdk_portal lifecycle，本轮 companion 深化 perf probe 与 ACL 边界
- **选题时 PRD 加权总分**：82.9/100（用户价值 **84%** · 完整度 **74%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% mock perf probe + P95 断言）；完整度（74%→≥85% sdk portal 边界闭合）
- **用户感知**：SDK 嵌入门户注册/吊销/生命周期 API 响应可预测，perf smoke 可回归
- **类型**：补缺（VIZ 域 companion 质量推分）
- **验收标准**（来源 hub · VIZ-007 + r61 惯例）：
  - sdk_portal perf probe / lifecycle ACL 深化
  - mock P95 smoke pytest
  - 加权总分目标 **≥90**（破 STUCK）

### 子项 2：VIEW-002 视图项（角色默认视图 companion）

- **选题理由**：hub **已实现簇最低并列 #1（82.9）**；**性能 58%**、**完整度 74%**；r60 已 L1 kickoff role default-views，本轮 companion 深化 bounds 与 perf
- **选题时 PRD 加权总分**：82.9/100（用户价值 **84%** · 完整度 **74%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88%）；完整度（74%→≥85% default-views 边界）
- **用户感知**：角色默认视图 CRUD 与越权拦截更完整，响应时延可探测
- **类型**：补缺（VIEW 域 companion 质量推分）
- **验收标准**（来源 hub · VIEW-002 + r60 惯例）：
  - role default-views ACL/bounds 深化
  - perf + 404 smoke pytest
  - 加权总分目标 **≥90**

### 子项 3：DESIGN-004 设计器项（workflow-link companion）

- **选题理由**：hub **已实现簇最低并列 #1（82.9）**；**性能 58%**、**完整度 74%**；r59 已 L1 kickoff workflow-link publishReady，本轮 companion 深化 perf 与联动校验
- **选题时 PRD 加权总分**：82.9/100（用户价值 **84%** · 完整度 **74%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88% render-spec probe）；完整度（74%→≥85% publishReady 链闭合）
- **用户感知**：设计器 workflow-link 发布就绪状态可探测，非法联动被结构化拦截
- **类型**：补缺（DESIGN 域 companion 质量推分）
- **验收标准**（来源 hub · DESIGN-004 + r59 惯例）：
  - workflow-link publishReady/perf probe 深化
  - 非法联动 smoke pytest
  - 加权总分目标 **≥90**

### 子项 4：CAT-005 分类项（工单统计 companion）

- **选题理由**：hub **次低（83.3）** STUCK 1 轮；**性能 58%**、**完整度 76%**；r61 已 L1 kickoff ticket stats，本轮 companion 深化 ACL 与 perf mock
- **选题时 PRD 加权总分**：83.3/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **92%** · 架构 **88%** · 测试覆盖 **96%** · 性能 **58%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88%）；完整度（76%→≥88% ticket stats ACL）
- **用户感知**：分类工单统计 API 越权被拦截，统计查询 perf 可回归
- **类型**：补缺（CAT 域 companion 质量推分）
- **验收标准**（来源 hub · CAT-005 + r61 惯例）：
  - ticket stats ACL/perf probe 深化
  - 越权 smoke pytest
  - 加权总分目标 **≥90**

### 子项 5：VIEW-003 视图项（用户 me/views bounds companion）

- **选题理由**：hub **84.2** STUCK 1 轮；**性能 58%**；r60 已 L1 kickoff user me/views bounds，与 VIEW-002 同域批处理共享 views 夹具
- **选题时 PRD 加权总分**：84.2/100（用户价值 **84%** · 完整度 **76%** · 可靠性 **94%** · 架构 **90%** · 测试覆盖 **98%** · 性能 **58%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：性能（58%→≥88%）；完整度（76%→≥88% me/views bounds cycle 检测）
- **用户感知**：用户视图覆盖边界与循环检测更完整，perf smoke 可回归
- **类型**：补缺（VIEW 域 companion 质量推分，与 VIEW-002 同批）
- **验收标准**（来源 hub · VIEW-003 + r60 惯例）：
  - me/views bounds/cycle 深化 + perf probe
  - cycle/404 smoke pytest
  - 加权总分目标 **≥90**
