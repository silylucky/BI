# 客户主路径可交付毕业设计（M-DEPTH · A/A1/H1 · 四轨并行）

```yaml
date: 2026-07-10
status: draft-for-review
decisions:
  honesty_bar: A          # 客户主路径零假；工程 probe 可保留
  main_path_scope: A1     # 不含 G5 真实总线；治理不挡交付
  gov_nav: H1             # 治理侧栏默认隐藏
  execution: approach-1   # 四 worktree 并行
plan_ref: docs/automate/plan.md#M-DEPTH
assessment_ref: docs/automate/plans/2026-07-10-fe-de-ss-ia-optimization.md
goal_ref: docs/automate/goal.md
```

> Brainstorming 确认：A → A1 → H1 → 方案 1；设计 §1–§4 均已 OK。  
> 本文件批准后 → `writing-plans` 产出可执行计划 → 再开 worktree / subagent。

---

## 1. 问题与目标

合同 PRD 129 项已勾「已实现」，但客户主路径仍存在 **内存 Dataset、假筛选控件、mock 导出/投递、治理总线冒充** 等假能力。目标：按 goal G1–G5 将 **可交付成熟度** 从约 **5.6** 提升到 **≥8.0**，使政企客户可直接部署使用主路径。

### 1.1 决策摘要

| 代号 | 含义 |
|------|------|
| **A** | 客户主路径零假；`nfr/probe`、测试 mock、未挂导航的规划路由可保留 |
| **A1** | 主路径 = 连库 → Dataset → Dashboard（真筛选）→ 报表（真导出/可配 SMTP）→ RBAC/RLS UI；治理/总线不挡交付 |
| **H1** | 「治理」侧栏默认隐藏（`VITALSPAN_GOV_NAV=0` 或等价 capability）；深链须标明未对接真实总线 |
| **方案 1** | Phase0 后四轨 worktree 并行，Phase M 合并闸 + 假能力门禁 |

### 1.2 非目标

真实总线 HTTP、完整 SQL Lab、AI 问数、CAT IF-02 全开、NFR 生产告警集成、文本/图片积木（未立项）。

---

## 2. 可交付打分（§1）

口径：政企客户能否直接使用主路径（非合同勾选率）。单项 **&lt;6 阻断**；综合 **≥8 可交付**。

| 维度 | 现状 | 目标 | 阻断条件 |
|------|-----:|-----:|----------|
| G1 自研 BI 主路径 | 5.5 | 8.5 | Dataset 内存；筛选器假控件；主路径 mock |
| G2 多源接入 | 7.5 | 8.0 | 主路径 MySQL/PG 建源→出数稳定 |
| G3 展现闭环 | 5.0 | 8.5 | Dataset 真出数 + 真筛选 + 报表真导出 |
| G4 安全可配 | 6.5 | 8.0 | RLS 分组/审计 Admin UI |
| G5 治理差异化 | 5.0 | 6.0* | *A1 不阻断*；H1 隐藏，不冒充总线 |
| 诚实度（反假） | 4.0 | 9.0 | 可见面无 `mock://`、无静默假成功 |
| **综合** | **~5.6** | **≥8.0** | G1/G3/诚实度任一项 &lt;6 → 不可交付 |

### 毕业可判定信号

1. P1-SMOKE：建源 → Dataset（重启仍在）→ Dashboard 出图 + 筛选改值重查  
2. 报表导出非 `mock://`；SMTP 可配置；未配置不得静默「投递成功」  
3. Admin 可配 RLS 分组 + 查审计  
4. 治理侧栏默认隐藏（H1）  
5. 假能力门禁测试绿  

---

## 3. 阶段编排与 worktree（§2）

```
Phase 0（主仓串行）  假能力门禁脚手架 + H1 治理默认隐藏
        │
        ├─ T1 Dataset 打穿
        ├─ T2 Dashboard 筛选器
        ├─ T3 报表去 mock
        └─ T4 RLS/审计 UI + H1 收尾
        │
Phase M  按序合入 + honesty gate + 主路径 smoke
Phase G  打分复评 ≥8；勾 plan；PRD companion 回写
```

### 3.1 轨边界

| 轨 | 分支建议 | 独占路径 | plan / PRD |
|----|----------|----------|------------|
| **T1** | `depth/t1-dataset` | `backend/app/metadata/dataset/**` · `query/dataset/**` · `api/v1/datasets.py` · `fe/.../datasets/**` · Alembic | F-A · META-004 · QUERY-009 |
| **T2** | `depth/t2-filters` | `layoutUtils` · `FilterWidget*` · `GlobalFilterBar` · `dashboard/schemas` · `global_filters/**` | F-B · DASH-002 · DASH-004 |
| **T3** | `depth/t3-reports` | `backend/app/reports/**` · `integration/reports_export.py` · `api/v1/reports/**` | **F-E 报表诚实化**（plan 增补）· RPT-001/005 |
| **T4** | `depth/t4-auth-ia` | `fe/.../system/**`（RLS/审计）· `nav-manifest` 治理隐藏 · `layout.md` | F-C + H1 · AUTH-006/008 · BOOT-002 |

**共享文件**（`routes.tsx` / `capabilities.ts`）：仅 T4 或 Phase M 修改；他轨用深链/feature flag。

### 3.2 并行纪律

1. 每轨独立 git worktree + 分支；禁止改他轨独占路径  
2. 轨内测试绿才申请合入  
3. Phase M 合入顺序建议：**T4 → T1 → T2 → T3**  
4. Subagent：4× implementer 并行；1× gatekeeper；1× verifier（honesty gate）

### 3.3 Plan 增补

在 `plan.md` §M-DEPTH 增加：

```markdown
### F-E — 报表诚实化【必做】
- [ ] RPT-001: 导出/模板存储去 mock://（真文件或显式 501）
- [ ] RPT-005: 未配 SMTP 不得静默 delivered；可配后真投递
```

---

## 4. 假能力清单与门禁（§3）

### 4.1 必须消灭或降级

| ID | 假能力 | 处置 | 轨 |
|----|--------|------|-----|
| FAKE-01 | Dataset `_store` 内存 | ORM + Alembic | T1 |
| FAKE-02 | execute-plan 冒充主路径 | 主路径真实 execute；plan 标内部 | T1 |
| FAKE-03 | GlobalFilterBar 纯 Input | 下拉/日期/多选 + filter widget | T2 |
| FAKE-04 | `mock://templates/`、假 PDF 字节 | 真存储或 501；禁静默假文件 | T3 |
| FAKE-05 | `rpt_delivery_mode=mock` 假成功 | 未配 → 失败/未配置；配了才发 | T3 |
| FAKE-06 | 治理/总线 InMemory 冒充 | H1 隐藏 + 深链角标 | T4 |

### 4.2 允许保留

- `/api/v1/nfr/*/probe`（不进侧栏；可 `x-internal`）  
- pytest / 方言 probe 的 unittest.mock  
- SQL 参数 placeholder（真机制）  
- API「规划」路由（不挂产品导航）

### 4.3 Honesty gate（Phase M 必绿）

`tests/test_delivery_honesty_gate.py`（+ 少量 FE smoke）：

1. Dataset create → 模拟重启 → 仍存在  
2. 导出无 `mock://`；或明确 4xx/501  
3. 未配 SMTP 时客户 API 不得默认 `delivered`+mock 成功  
4. 改筛选值触发 chart execute 参数变化  
5. 默认无「治理」导航分组（除非 `VITALSPAN_GOV_NAV=1`）

### 4.4 错误处理

| 场景 | 行为 |
|------|------|
| 存储/SMTP/总线未就绪 | 显式失败或禁用 + 中文原因；禁止假成功 toast |
| 查询/绑定失败 | 沿用 ChartPanel 错误覆盖 |
| 筛选无枚举 | 空下拉 + 提示 |
| 治理深链且开关关 | 403 或回工作台 + 说明 |

---

## 5. 测试 / 文档 / 合并（§4）

### 5.1 测试

- 轨内：本轨 pytest/vitest  
- Phase M：honesty gate + Dataset/筛选/导出/nav smoke  
- 毕业：P1-SMOKE 书面签收  

### 5.2 文档（合入后）

| 轨 | 同步 |
|----|------|
| T1 | `prd/F11-META` · `F05-QUERY` · `services/metadata.md` · `api/README.md` |
| T2 | `prd/F07-DASH` · `ui/layout.md` |
| T3 | `prd/F08-RPT` · `api/README.md` · `services/reports.md` |
| T4 | `prd/F01-BOOT` · `F02-AUTH` · `layout.md` · `arch.md`（环境变量） |
| 全 | `plan.md` §M-DEPTH 勾选；hub `last_updated` |

### 5.3 合并

```
Phase0 → main
T1..T4 并行 PR（路径越界检查）
Phase M: T4 → T1 → T2 → T3
honesty gate 红 → 修复轨，禁止毕业宣称
gate 绿 → 打分 ≥8 → 勾 plan → Phase G
```

---

## 6. 组件与数据流（实现要点）

### T1 Dataset

- 表：`datasets`（及 tables/computed_fields 关联或 JSONB，与现有 API schema 对齐）  
- `service.py` 去掉模块级 `_store`；迁移可空（无生产数据）  
- `POST /query/dataset/execute` 出真实 rows；Dashboard/QuickCreate 不变入口  

### T2 Filters

- `LayoutWidget.type: "chart" | "filter"`；旧 layout 缺省 chart  
- `FilterWidget` + Palette；`GlobalFilterBar` 控件类型  
- 参数注入复用 `dashboardFilterUtils` / `useChartExecute`  

### T3 Reports

- 去掉客户路径 `_generate_mock_bytes` 静默成功  
- `rpt_delivery_mode`：未配 SMTP → 明确错误；文档默认推荐生产配 SMTP  

### T4 Auth IA

- RLS groups 页 + 审计页  
- `nav-manifest` 治理 `iaTier`/`capability`/`env` 默认不可见  

---

## 7. 风险

| 风险 | 缓解 |
|------|------|
| 四轨合并冲突 | 独占路径表 + gatekeeper；共享文件单写者 |
| T1 未完演示断 | Phase M 前不宣称毕业；T2 不依赖持久化 Dataset 做 schema |
| 报表真 SMTP 环境差 | 允许「未配置」失败态；MailHog 仅 dev |
| 范围膨胀到总线 | A1 硬边界；F-D/真实总线不进本轮 |

---

## 8. Spec 自检

- [x] 无 TBD/TODO 占位  
- [x] A/A1/H1/方案1 与 §1–§4 一致  
- [x] 范围聚焦客户主路径；G5 不阻断  
- [x] FAKE 处置与轨映射明确  
- [x] plan F-E 增补已写明，避免无 PRD 映射任务  

---

## 9. 下一步

1. **用户审阅本 spec**（本文件）  
2. 批准后调用 **writing-plans** 生成 `docs/automate/plans/2026-07-10-customer-delivery-graduation.md`（含 Phase0 + T1–T4 任务拆解）  
3. 再启动 git worktree + 多 subagent 并行实施  

**不在本步**：写业务代码、开 worktree、宣称毕业。
