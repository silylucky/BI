# VitalSpan 全栈功能 DE/SS 对标审视与优化方案（v3 · 全栈）

Plan type: Headless Automation Plan
Cursor Build: disabled
Execution trigger: dev-autopilot A5 plan-execute
日期：2026-07-10（v3 全栈重订，覆盖前端 v2）
真理源：`goal.md`（G1–G5）· `docs/api/README.md` v1.0.3 · `docs/services/README.md` · **`plan.md` §M-DEPTH（v3.0.0 · 当前节）**

> **v3 定位**：从「前端 IA」扩展到**全栈功能审视**。核心判断：本项目**不缺功能广度，甚至过剩**；真正矛盾是 **① 后端广度大但深度停在 L1/mock ② 前后端消费落差 ③ 少数域职责重叠**。对标 DE/SS 的**用户级能力**仍有硬缺口。

---

## 0. 全栈能力全景（对标 DE/SS 核心链路）

| 链路 | DE/SS | VitalSpan 后端 | VitalSpan 前端 | 落差判断 |
|------|-------|----------------|----------------|----------|
| 数据源接入 | 有 | ✅ **强**：多方言 + 信创 5 型 + 文件/API（超 DE） | ✅ 完整表单 | **领先** |
| 数据同步/ETL | Superset 无 | ✅ ingestion sync + 轻量清洗 | ✅ 同步任务页 | **领先** |
| 数据集/语义层 | 有（可视化） | ⚠️ **内存 store L1**（`datasets.py` 重启丢数据） | ⚠️ JSON 文本框编辑 | **深度不足** |
| 图表建模 | Explore 即席 | ⚠️ charts 骨架（9 类型注册 + render-spec） | ✅ ECharts 渲染 + Inspector | **广度够、探索弱** |
| 仪表板 | 有（拖拽+筛选器） | ✅ layout + global-filters + theme | ⚠️ widget 仅 `chart`，筛选器纯文本框 | **组件缺** |
| SQL 即席 | Superset SQL Lab | ⚠️ query/execute（API，非交互） | ❌ 无 SQL 工作台 | **缺**（goal 未立项完整 SQL Lab） |
| 分享/嵌入 | 公开链接 | ⚠️ embed token 骨架 | ⚠️ sdk-demo（已限 DEV） | **深度不足** |
| 调度/告警 | 有 | ✅ reports schedules（semi-real FSM） | ⚠️ 页面浅 | **后端够、前端浅** |
| RBAC/RLS | 有（RBAC） | ✅✅ **强**：多维 RLS + 组织 + 审计（超 DE/SS） | ⚠️ 部分未接入 UI | **领先、未消费** |
| 治理/发布/总线 | **均无** | ✅✅ **差异化**：工单 FSM + 发布 + 总线 + OpenAPI 映射 | ⚠️ 3 页半接入 | **独有、L1** |

**一句话**：数据源/同步/RLS/治理 **领先** DE/SS；**数据集、仪表板筛选器、分享** 是对标硬缺口；治理/RLS 后端能力**前端消费不足**。

---

## 1. 少什么（用户级缺口 · 代码证据）

### P0 — 对标 DE/SS 硬缺口

| ID | 缺口 | 证据 | 影响 |
|----|------|------|------|
| **GAP-01** | Dataset 无持久化 | `api/README.md` L290「内存 store L1」 | 生产不可用，重启丢数据集 |
| **GAP-02** | Dataset 编辑工程化 | `DatasetListPage.tsx` tableNames textarea + JSON | 非数据人员无法建模 |
| **GAP-03** | 仪表板无筛选器/文本组件 | `layoutUtils.ts` widget 仅 `type:"chart"` | 交互式看板缺核心件 |
| **GAP-04** | 全局筛选器只是纯文本框 | `GlobalFilterBar.tsx` 仅 `<Input>` | 无下拉/日期/多选 |
| **GAP-05** | 公开分享链接未落地 | `embed.py`「已实现（骨架）」 | 无匿名/公开看板 |

### P1 — 消费落差（后端有、前端无/弱）

| ID | 缺口 | 后端已有 | 前端现状 |
|----|------|----------|----------|
| **GAP-06** | RLS 维度分组管理 UI | `/rls/groups*` `/roles/{id}/dimension-groups` 全实现 | 无可视化配置面 |
| **GAP-07** | 审计事件查询 UI | `/audit/events` 全实现（时间窗+脱敏） | 无审计浏览页 |
| **GAP-08** | 调度执行历史/重试 UI | `/schedules/{id}/executions` `/retry` 全实现 | 页面浅 |
| **GAP-09** | 已发布查询服务目录 UI | `/services*` companion 实现 | 无服务消费页 |

### 明确不做（goal Out of Scope）

AI/SQL 问数（SQLBot）· 完整 SQL Lab · fork DE/SS · 场景包自动加载 · 一至三期 Dataset。

---

## 2. 多什么 / 冗余（全栈）

### 2a. 后端广度过剩（L1/mock 未消费 — 保留但**不再加投入**）

| 项 | 现状 | 处置 |
|----|------|------|
| 30+ `nfr/*` probe 接口 | 工程验收 mock，非产品功能 | **保留**（NFR 门禁用），不进前端 |
| `execute-plan` 四步链（dataset/theme） | 「非真实 SQL execute」companion | **冻结**：优先做真实 execute（见 B1） |
| CAT-001~007 大量 `m11/m12-probe` | 里程碑集成占位 | **保留只读**，不扩展 |

### 2b. 职责重叠（可合并）

| ID | 重叠 | 说明 | 建议 |
|----|------|------|------|
| **DUP-01** | designer vs gov/query-design | `/designer/*`（DESIGN-001~005）与 `/gov/query-design`（GOV-004）均为可视化查询设计 | 评估收敛为单一设计器内核，gov 复用 designer |
| **DUP-02** | `/metadata/entity-types`（已实现） vs `/entities/types`（规划） | 同能力两路径 | 删「规划」路径，文档去重 |
| **DUP-03** | `/datasets/migrate-binding`（规划）+ 直连绑定 | 一至三期直连 vs 四期 dataset 双路径 | 明确迁移策略或删规划项 |

### 2c. 前端可精简（沿用 v2）

| ID | 项 | 建议 |
|----|-----|------|
| MERGE-FE-01 | `ChartExplorePage` 独立路由 | 降级为 Palette Drawer，删 `charts/types` 路由 |
| MERGE-FE-02 | `AdminHomePage` 空跳转 | 登录直达默认落地 |
| MERGE-FE-03 | `/dashboards/:id/preview` 文档规划无实现 | 文档删该行（已标注） |

### 已完成的减法（本轮，勿重复）

侧栏删「图表类型目录/实体与主题/独立数据接入」；数据接入并入同步任务；analyst 报表收敛；sdk-demo 仅 DEV；capability 路由守卫。测试全绿。

---

## 3. 分阶段计划（全栈）

### Wave A — Dataset 打穿（P0 · 后端 + 前端，5–6 人日）

> 让「数据集」从骨架变成 DE 对标的真实能力，这是当前最大价值洼地。

| Task | 层 | 文件 | 验收 |
|------|----|------|------|
| A-1 Dataset 持久化落库 | BE | `datasets.py` 内存 → ORM + Alembic | 重启不丢；pytest CRUD |
| A-2 Dataset 真实 execute | BE | `dataset/execute` 打通真实 SQL（替 execute-plan mock） | 出真实 rows |
| A-3 可视化编辑器 | FE | 拆 `DatasetEditorDialog` + `SchemaBrowser` 选表/字段 | 无裸 JSON |
| A-4 计算字段行编辑 | FE | `DatasetComputedFieldsEditor.tsx` | name+expr 行编辑 |
| 验收 | — | — | 建 Dataset → QuickCreate 选它 → 出图 |

### Wave B — 仪表板筛选器组件（P0 · 主要前端 + BE schema，4–5 人日）

| Task | 层 | 文件 | 验收 |
|------|----|------|------|
| B-1 widget 类型扩展 `filter` | FE+BE | `layoutUtils.ts` + `dashboard/schemas.py` | round-trip 兼容旧 layout |
| B-2 筛选器 widget（下拉/日期/文本） | FE | `FilterWidget.tsx` + Palette 项 | 拖入配置字段+控件 |
| B-3 筛选值驱动 execute | FE | `dashboardFilterUtils` + `useChartExecute` | 改筛选 → 关联 chart 重查 |
| 验收 | — | — | dashboard.smoke + pytest layout |

### Wave C — 消费落差补齐（P1 · 前端接后端已有 API，3–4 人日）

| Task | 接入 API | 页面 |
|------|----------|------|
| C-1 RLS 维度分组配置面 | `/rls/groups*` `/roles/{id}/dimension-groups` | 权限页新 Tab |
| C-2 审计事件浏览 | `/audit/events` | 系统 → 审计页 |
| C-3 调度历史/重试 | `/schedules/{id}/executions` `/retry` | 报表调度页增强 |
| C-4 已发布服务目录 | `/services*` | 治理 → 服务页 |

### Wave D — 后端去重（P2 · 后端，2–3 人日，需评审）

| Task | 说明 |
|------|------|
| D-1 DUP-01 designer/gov 设计器内核收敛 | 抽公共 translator，gov 复用（**先出 ADR**） |
| D-2 DUP-02/03 删规划重复路径 | 更新 `api/README.md` |

### Wave E — 分享 + 前端精简（P2 · 可选，2–3 人日）

| Task | 说明 |
|------|------|
| E-1 公开分享链接落地 | embed token 骨架 → 真实匿名看板路由 |
| E-2 MERGE-FE-01/02 前端精简 | ChartExplore Drawer 化、删空跳转 |

---

## 4. 执行顺序建议

1. **先提交** 当前本地改动（减法 + 加厚基建）
2. **Wave A**（Dataset 打穿）— 最大价值，且是 QuickCreate/筛选器的地基
3. **Wave B**（筛选器）— 对标 DE/SS 最明显的仪表板差距
4. **Wave C**（消费落差）— 低成本高显示度，让已有后端能力「可见」
5. **Wave D/E** — 有余力再做

---

## 5. 决策点（需产品确认）

**Q1. Dataset 持久化优先级** — Wave A 是否作为下一个执行目标？（推荐：是）

**Q2. designer / gov 设计器收敛（DUP-01）** — 是否立项 ADR 评审后端去重？（影响面大，推荐：先 ADR 不急改）

**Q3. analyst 是否开放 Dataset 只读浏览？** — 开 = 更像 DataEase 自助分析

**Q4. 公开分享链接（Wave E）** — 政企场景是否需要匿名看板？（涉及安全面）

---

## 6. 八维度自审

| 维度 | 结论 |
|------|------|
| 范围 | A 前后端；B 前端为主 + schema；C 纯前端接既有 API；D 纯后端 |
| 依赖 | A-1→A-2→A-3；B 依赖 A（好 Dataset 才有意义）；C 无阻塞 |
| 风险 | A-1 需迁移内存数据；B widget 类型需兼容旧 layout（Optional 默认 chart）；D 影响面大先 ADR |
| 回退 | 各 Wave 独立；筛选器/服务页为增量 |
| 测试 | A pytest+dataset.smoke；B dashboard.smoke+pytest；C 各页 smoke；D 全域回归 |
| 文档 | A 更新 `services/metadata.md`+`F11-META`；B `F07-DASH`+`layout.md`；C `layout.md`；D `api/README.md`+ADR |
| 体量 | 新组件 <300 行；Dataset 编辑器拆子模块；datasets.py 落库拆 service |
| 安全 | C 审计/RLS 走既有 admin 守卫；E 分享需 origin 白名单 + token 校验 |

---

## 7. 工期与模型

| Wave | 工期 | 模型 |
|------|------|------|
| A Dataset 打穿 | 5–6 人日 | composer-2.5（前后端） |
| B 筛选器 | 4–5 人日 | composer-2.5 |
| C 消费落差 | 3–4 人日 | composer-2.5 |
| D 后端去重 | 2–3 人日 | 需 ADR + 评审 |
| E 分享+精简 | 2–3 人日 | 可选 |
