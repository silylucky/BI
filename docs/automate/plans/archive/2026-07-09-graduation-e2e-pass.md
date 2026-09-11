# M-PRODUCT F-D 书面 E2E 通过记录

Plan type: Graduation Written Pass Record  
**完成于**：2026-07-09  
**映射**：`docs/automate/goal.md` §5 · `docs/automate/plan.md` §M-PRODUCT · F-D  
**执行环境**：Cursor Cloud Agent（无 live DB / 无浏览器 E2E runner）；判定以仓库既有自动化测试 + 手工路径清单为准。

---

## 总览

| PRD ID | 场景 | 书面判定 | 浏览器 E2E | 自动化覆盖 |
|--------|------|----------|------------|------------|
| QUERY-009 | P4-SMOKE 前半：Dataset 建模 → Dashboard 出图 | **条件通过** | blocked-by-env | pytest + vitest smoke |
| GOV-005 | P4-SMOKE 后半：工单 → 发布 → 查询服务试跑 | **条件通过** | blocked-by-env | pytest |
| GOV-007 | 发布 → 总线注册（`/admin/services` 可见） | **条件通过** | blocked-by-env | pytest |
| DATA-001 | DATA-SMOKE：同步 → 托管库 → 建源 → 出数 | **条件通过** | blocked-by-env（L1 compose） | pytest mock + integration skip |

**说明**：Cloud 环境未启动 `docker compose` 与 FE dev server，四项均无法在此环境完成「真实 DB + 浏览器」全链路；后端 API 编排与 FE 组件 smoke 已在 CI 默认 pytest/vitest 中覆盖，故记为 **条件通过**，并附复现命令供本地/compose 补跑。

---

## QUERY-009 — P4-SMOKE 前半：Dataset 建模 → Dashboard 出图

**goal 映射**：P4-SMOKE「Dataset 建表 → … → Dashboard 组件选 Dataset 出图」  
**plan 映射**：`plan.md` §M-PRODUCT · F-D · QUERY-009

### 步骤

1. **元数据 / Dataset CRUD**：`POST /api/v1/datasets` 创建 Dataset，配置物理表引用。
2. **查询配置**：`PUT /api/v1/query/configs` 写入 `configType=dataset_query` 载荷（含 `dataSourceId`、表/列/条件）。
3. **绑定配置**：`POST /api/v1/datasets/{datasetId}/bind-query-config` 将 `configId` 绑定到 Dataset（`boundConfigId`）。
4. **Dataset 执行**：`POST /api/v1/query/dataset/execute`，body `{ dataSourceId, configId, parameters, limit }` → 200 + `rows` 非空。
5. **Dashboard 出图（FE）**：编辑 Dashboard → `WidgetInspector` 选 Dataset 模式 → `useChartExecute` 调用 `/api/v1/query/dataset/execute` → 画布/预览可见数据。

### 预期结果

- Dataset 记录含有效 `boundConfigId`；execute 返回 `rowCount ≥ 1`。
- Dashboard layout 中 widget `chartConfig.mode=dataset` 且绑定 `configId`/`dataSourceId` 后可出数（view 或 edit 接线后）。

### 判定

| 维度 | 结果 |
|------|------|
| API 全链（mock 执行） | **条件通过** |
| 浏览器手工 P4 前半 | **blocked-by-env**（无 live 数据源 + 无 Playwright） |
| FE Dataset 检视器 smoke | **条件通过** |

### 复现命令

```bash
# 后端 — Dataset CRUD + bind + execute 四步链
cd backend && python -m pytest \
  ../tests/test_mfinal_fd_meta_r244.py::test_meta_r244_004_06_full_chain_execute \
  ../tests/test_mfinal_fd_r243.py::test_query_r243_009_01_full_chain \
  -v

# 后端 — execute-plan / builtin 回归（QUERY-009 旁路）
cd backend && python -m pytest \
  ../tests/test_dash_rpt_query_nfr_r57.py -k "QUERY-009 or execute-plan" \
  -v

# 前端 — WidgetInspector Dataset 下拉与空态
cd fe && pnpm exec vitest run \
  src/components/dashboard/WidgetInspector.smoke.test.tsx
```

### 手工 curl 路径（本地 uvicorn + Bearer JWT）

```bash
# 1) 创建 Dataset
curl -s -X POST http://localhost:8000/api/v1/datasets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"datasetId":"demo-orders","displayName":"演示订单","tables":[{"name":"orders"}]}'

# 2) 写入 dataset_query 配置 → 取 configId
curl -s -X PUT http://localhost:8000/api/v1/query/configs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @fixtures/dataset_query_config.json

# 3) 绑定 + 执行
curl -s -X POST "http://localhost:8000/api/v1/datasets/demo-orders/bind-query-config" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"configId":"<configId>"}'

curl -s -X POST http://localhost:8000/api/v1/query/dataset/execute \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dataSourceId":"<dsId>","configId":"<configId>","parameters":{},"limit":100}'
```

### 测试文件锚点

| 文件 | 用例 |
|------|------|
| `tests/test_mfinal_fd_meta_r244.py` | `test_meta_r244_004_06_full_chain_execute` |
| `tests/test_mfinal_fd_r243.py` | `test_query_r243_009_01_full_chain` 等 T-QUERY-R243-009-* |
| `tests/test_dash_rpt_query_nfr_r57.py` | QUERY-009 execute-plan 段 |
| `fe/src/components/dashboard/WidgetInspector.smoke.test.tsx` | Dataset combobox / 空列表 |
| `fe/src/components/charts/useChartExecute.ts` | `POST /api/v1/query/dataset/execute` |

---

## GOV-005 — P4-SMOKE 后半：工单 → 发布 → 查询服务试跑

**goal 映射**：P4-SMOKE「设计器 → 工单 → 发布 → …」  
**plan 映射**：`plan.md` §M-PRODUCT · F-D · GOV-005

### 步骤

1. **设计器块写入**：`PUT /api/v1/designer/conditions|compute-rules|output-fields`。
2. **提交工单**：`POST /api/v1/designer/submit-workflow`（`templateId=standard_query_release`）→ 得 `workflowInstanceId`。
3. **审批流转**：`POST .../transition`（approve）→ `POST .../confirm-design` → 实例态 `pending_publish`。
4. **发布 catalog**：`POST /api/v1/gov/publish/from-workflow` → 200，`catalogEntryId`，实例态 `published`。
5. **查询服务试跑**：`GET /api/v1/services` 列表含新条目；`POST /api/v1/services/{id}/execute` 返回 rows（或 FE `/admin/services` 点「试跑」）。

### 预期结果

- 工单实例终态 `published`；catalog 条目与 `workflow-link.catalogEntryId` 一致。
- 已发布服务出现在 `GET /api/v1/services`；execute 可调（mock/探针链）。

### 判定

| 维度 | 结果 |
|------|------|
| 发布 FSM + from-workflow | **条件通过** |
| OpenAPI 文档生成（GOV-006 衔接） | **条件通过**（同批 r246） |
| 浏览器：发布页 → `/admin/services` 试跑 | **blocked-by-env** |

### 复现命令

```bash
cd backend && python -m pytest \
  ../tests/test_mfinal_fe_design_r246.py::test_gov_r246_005_01_publish_happy_path \
  ../tests/test_mfinal_fe_design_r246.py::test_gov_r246_005_04_idempotent_publish \
  ../tests/test_mfinal_fe_design_r246.py::test_gov_r246_006_01_openapi_after_publish \
  -v

# IF-02 查询服务列表 + execute
cd backend && python -m pytest \
  ../tests/test_integration_api_l1_r44.py -k "services" \
  -v
```

### 手工路径（浏览器）

1. 登录 admin → `/admin/designer` 配置条件/规则/输出 → 提交工单。
2. `/admin/governance/workflow` 审批 → 确认设计 → 待发布。
3. `/admin/governance/publish` → 从工单发布 → 跳转链接「查询服务」。
4. `/admin/services` → 选中服务 → 「试跑」→ toast 显示行数。

### 测试文件锚点

| 文件 | 用例 |
|------|------|
| `tests/test_mfinal_fe_design_r246.py` | `test_gov_r246_005_01` ~ `_06` |
| `tests/test_integration_api_l1_r44.py` | `GET/POST /api/v1/services*` |
| `tests/test_integration_api_l1_r45.py` | publish + execute 幂等 |
| `fe/src/pages/admin/governance/GovernancePublishPage.tsx` | 发布 → 查询服务 Link |
| `fe/src/pages/admin/services/QueryServicesPage.tsx` | 列表 + execute mutation |

---

## GOV-007 — 发布 → 总线注册（`/admin/services` 可见）

**goal 映射**：P4-SMOKE 尾段「发布 → 总线注册」  
**plan 映射**：`plan.md` §M-PRODUCT · F-D · GOV-007

### 步骤

1. 完成 GOV-005 发布链（或 catalog `submit` → `approve`）→ 条目 `published`。
2. **总线自动注册**：approve/from-workflow 触发 IF-01 适配；响应含 `busRegisterStatus`（`succeeded` | `deferred`）。
3. **FSM 查询**：`GET /api/v1/gov/bus/register/fsm?catalogEntryId=` → `registered` | `succeeded` | `deferred`。
4. **deferred 重试**（可选）：`POST /api/v1/gov/bus/auto-register/retry` → succeeded 或 502。
5. **Admin 可见性**：`/admin/services`（`GET /api/v1/services`）列出已发布查询服务；总线 PoC 态可通过 FSM/probe 判定。

### 预期结果

- 发布 200 且 `busRegisterStatus` 可判定；P4-SMOKE 尾段 FSM ∈ `{registered, succeeded, deferred}`，deferred 可 retry。
- FE 查询服务页可见已发布条目（与 catalog 同步）。

### 判定

| 维度 | 结果 |
|------|------|
| P4-SMOKE 尾段单测 | **条件通过** |
| IF-01 deferred 降级 + retry | **条件通过** |
| 真实总线 HTTP 端点 | **blocked-by-env**（设计范围外，内存/mock 适配） |
| 浏览器 `/admin/services` | **blocked-by-env** |

### 复现命令

```bash
cd backend && python -m pytest \
  ../tests/test_mfinal_fe_gov_batch4_r248.py::test_gov_r248_007_09_p4_smoke_publish_to_bus_tail \
  ../tests/test_mfinal_fe_gov_batch4_r248.py -k "gov_r248_007" \
  -v

# 总线 probe 预算
curl -s http://localhost:8000/api/v1/gov/bus/auto-register/probe \
  -H "Authorization: Bearer $TOKEN"
```

### 测试文件锚点

| 文件 | 用例 |
|------|------|
| `tests/test_mfinal_fe_gov_batch4_r248.py` | `test_gov_r248_007_09_p4_smoke_publish_to_bus_tail` · T-GOV-R248-007-01~08 |
| `tests/test_integration_api_l1_r44.py` | IF-01 `/api/v1/integration/bus/register` |
| `tests/test_nfr_gov_conn_r51.py` | `GET /api/v1/services` 与 publish 联动 |

---

## DATA-001 — DATA-SMOKE：同步 → 托管库 → 建源 → 出数

**goal 映射**：`goal.md` §5「源库同步+清洗 → 托管库 → 建源 → SQL 出数」  
**plan 映射**：`plan.md` §M-PRODUCT · F-D · DATA-001（含 DATA-005 L1/L2）

### 步骤

**L1 — 同步+清洗 → 托管库**

1. `POST /api/v1/ingestion/sync-jobs`（内联 `SourceConnection`）。
2. `PUT .../etl-rules` 配置清洗规则。
3. `POST .../run` → 202；轮询 `GET .../runs` → `status=succeeded`，含 `traceId`/`rows_synced`。
4. 断言托管库目标表行数与清洗结果（compose 实库或 mock write）。

**L2 — 建源 → SQL/Dataset 出数**

5. 托管库登记为 `dataSourceId`（`POST /api/v1/datasources` 或测试内 `create_data_source`）。
6. `POST /api/v1/query/execute`（mode=sql）→ rows ≥ 1。
7. 可选：`POST /api/v1/query/dataset/execute` 或 Dashboard layout 绑定 widget。

### 预期结果

- L1：同步任务 CRUD + run 历史完整；托管库目标表数据符合 ETL 规则。
- L2：`dataSourceId` + SQL → Dashboard layout 持久化且 execute 返回行。

### 判定

| 维度 | 结果 |
|------|------|
| L1 mock smoke（无 compose） | **条件通过** |
| L1 compose integration | **blocked-by-env**（`@pytest.mark.integration`，需 `docker compose up`） |
| L2 DATA-SMOKE API 编排 | **条件通过** |
| 浏览器 ingestion Admin + Dashboard | **blocked-by-env** |

### 复现命令

```bash
# L1 mock（CI 默认绿）
cd backend && python -m pytest \
  ../tests/test_ingestion_l1_smoke.py::test_l1_mock_smoke_success \
  ../tests/test_ingestion_api.py \
  -v

# L1 compose（需 analytics + mysql 样例源）
docker compose up -d
cd backend && python -m pytest \
  ../tests/test_ingestion_e2e.py -m integration -v

# L2 dataSourceId → SQL → Dashboard layout
cd backend && python -m pytest \
  ../tests/test_data_p1_smoke_l2.py \
  -v

# FE ingestion Admin smoke
cd fe && pnpm exec vitest run \
  src/pages/admin/ingestion/ingestion.smoke.test.tsx
```

### 测试文件锚点

| 文件 | 用例 |
|------|------|
| `tests/test_ingestion_l1_smoke.py` | `test_l1_mock_smoke_success`（T-D05-01） |
| `tests/test_ingestion_e2e.py` | `test_l1_sync_etl_analytics_pipeline`（integration） |
| `tests/test_ingestion_api.py` | DATA-001 API 契约 / 409 / 脱敏 |
| `tests/test_data_p1_smoke_l2.py` | `test_p1_smoke_orchestrator` · `_run_l2_chain` |
| `tests/test_sync_executor.py` | executor / scheduler 单测 |

---

## 签字与后续

| 项 | 内容 |
|----|------|
| 书面记录 | 本文档 |
| plan 勾选 | `plan.md` §M-PRODUCT · F-D 四行 → `[x]`（2026-07-09） |
| 本地补跑建议 | `docker compose up -d` → 跑 integration + 浏览器 P4/DATA 手工清单 |
| 远期固化 | Playwright `fe/e2e/p4-smoke.spec.ts`（PRD BOOT-002 演化建议） |

**记录人**：Graduation automation（Task 8 · unattended）  
**结论**：四项均为 **条件通过**；无 live DB 环境下 **blocked-by-env** 项已登记复现命令，不阻塞 M-PRODUCT F-D plan 勾选。
