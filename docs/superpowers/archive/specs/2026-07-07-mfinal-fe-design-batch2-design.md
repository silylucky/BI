# M-FINAL F-E 设计器收官 + 治理发布链前半段（批次 2）设计

```yaml
date: 2026-07-07
milestone: M-FINAL · F-E
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fe-design-batch2.md
prd_ids: [DESIGN-004, DESIGN-005, GOV-004, GOV-005, GOV-006]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
base_branch: dev-auto
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:----:|------------|----------|
| 1 | 设计器与工单关联补全 | DESIGN-004 | `designer/` + `governance/workflow/` + `fe/designer/` + `fe/governance/` | 1 | 完整度 **90%**；交互体验 **86%** | 工单详情稳定回看配置快照与版本；双向关联与撤回边界清晰 |
| 2 | 传统 SQL 模式 | DESIGN-005 | `designer/` + `fe/designer/` | 2 | 用户价值 **84%**；架构健康 **88%** | 可视化 / SQL 模式显式切换，直写 SQL 校验保存，共享 `designerItemId` |
| 3 | 可视化查询设计（审批态） | GOV-004 | `governance/query_design/` + `governance/workflow/` | 3 | 用户价值 **84%**；完整度 **90%** | 审批通过后治理侧可查看/确认设计器快照，作为发布前置 |
| 4 | 查询服务发布 | GOV-005 | `governance/publish/` + `governance/catalog/` | 4 | 架构健康 **88%**；用户价值 **84%** | 已批准设计一键发布为 catalog 查询服务，含版本骨架 |
| 5 | 发布引擎 OpenAPI 映射 | GOV-006 | `governance/openapi/` + `integration/query_services` | 5 | 用户价值 **84%**；架构健康 **88%** | 发布后自动生成 OpenAPI 3.x 文档片段，供集成方消费 |

**依赖链**：DESIGN-004 快照/关联补全 → DESIGN-005 SQL 模式 UI（共享 `refId`）→ GOV-004 从工单快照读取已批设计 → GOV-005 `from-workflow` 发布 catalog 条目 → GOV-006 发布成功后 OpenAPI 生成与 GET 聚合 → `test_mfinal_fe_design_r246.py` 全绿 → docs 同步 → plan F-E 批次 2 五行可勾选。

**上轮已交付（本轮不重复 L1 骨架）**：

- r245：`capture_snapshot` + `POST /submit-workflow` + workflow-link validate/save/get + 设计器三面板 FE
- r49/r52：`sql_mode` validate/save/get + 只读 SQL 守卫 + `CHART_SQL_NOT_READONLY` 联动
- r34/r35：`visual_query_design` validate/save/get + ACL
- r46/r51：`publish` FSM submit/approve/reject + 审批通知
- r54/r55：openapi mapping validate/register/deactivate + companion 边界

**本轮性质**：F-E **批次 2**（关联补全 + SQL 模式 Admin UI + 审批态设计确认 + 发布流水线 + OpenAPI 文档生成）。**不含** GOV-007 总线全自动注册、GOV-008 治理权限联动（批次 3）。

## 2. 范围框定

### 2.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| designer | `backend/app/designer/` | 快照 ACL/读取、workflow-link 反向查询与撤回守卫、SQL 模式与可视化共享 ref |
| governance | `backend/app/governance/` | 审批态设计确认、from-workflow 发布、OpenAPI 文档生成 |
| fe 设计器/治理 | `fe/src/pages/admin/designer/` · `fe/src/pages/admin/governance/` | SQL 模式切换、工单实例列表与快照回看、发布操作与 OpenAPI 预览 |

> **路径说明**：round-target 写作 `design/`、`gov/` 为 PRD 简称；实现真理源为 `designer/`、`governance/`（与批次 1 一致）。

### 2.2 文件列表（18）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/designer/snapshot.py` | 004 | `get_snapshot_for_actor()` ACL；`assert_snapshot_readable` |
| `backend/app/designer/workflow.py` | 004 | `get_link_by_instance()`；`delete_workflow_link()` 撤回守卫；submit 写入 `snapshotRevision` |
| `backend/app/designer/sql_mode.py` | 005 | `get_design_mode()` / `set_design_mode()`（`design_mode` config_type，值 `visual`/`sql`） |
| `backend/app/api/v1/designer.py` | 004、005 | `GET /snapshots/{id}`；`GET /workflow-link?workflowInstanceId=`；`DELETE /workflow-link`；`GET/PUT /design-mode` |
| `backend/app/governance/query_design/service.py` | 004 | `load_design_from_workflow()`；`confirm_approved_design()` |
| `backend/app/governance/publish/service.py` | 005 | `publish_from_workflow()`；`rollback_entry_skeleton()`；版本字段 `publishVersion` |
| `backend/app/governance/openapi/service.py` | 006 | `generate_openapi_document()`；`redact_openapi_fields()`；发布钩子自动 register |
| `backend/app/api/v1/gov.py` | 004~006 | 实例列表；`GET .../approved-design`；`POST .../confirm-design`；`POST /publish/from-workflow`；`GET .../openapi` |
| `tests/test_mfinal_fe_design_r246.py` | 全部 | **新建** ≥30 条 F-E 批次 2 pytest |
| `fe/src/pages/admin/designer/DesignerPage.tsx` | 005 | 模式切换 Segmented；SQL / 可视化互斥 Tab 区 |
| `fe/src/pages/admin/designer/designer-sql-panel.tsx` | 005 | **新建** 数据源选择 + SQL Textarea + 校验/保存 |
| `fe/src/pages/admin/designer/useDesignerWorkspace.ts` | 004、005 | `designMode` state；sql-mode load/save；提交后 invalidate link |
| `fe/src/pages/admin/governance/GovernanceWorkflowPage.tsx` | 004、005 | 实例 master-detail Tab；快照只读面板；审批/发布操作 |
| `fe/src/pages/admin/governance/GovernancePublishPage.tsx` | 005、006 | submit/approve 行操作；OpenAPI Sheet 预览 |
| `fe/src/lib/queryKeys.ts` | FE | `designer.snapshot`/`designMode`/`sqlMode`；`gov.workflowInstances`/`publishOpenapi` |
| `docs/api/README.md` | 全部 | 新路由登记 |
| `docs/services/designer.md` | 004、005 | 快照 ACL、设计模式、SQL UI 锚点 |
| `docs/services/governance.md` | 004~006 | 审批态设计、from-workflow 发布、OpenAPI GET |

**真理源优先级**：`round-target` > `prd.md` hub + `F12-DESIGN.md`/`F10-GOV.md` > `docs/services/designer.md`/`governance.md` > `docs/api/README.md`。

### 2.3 非目标（明确不做）

- GOV-007 总线全自动注册、GOV-008 治理权限联动 UI（F-E 批次 3）
- Monaco/CodeMirror 语法高亮、SQL 执行/结果网格（`highlightSupported` 保持 false）
- 完整 BPM 审批工作台、企微/邮件通知、双向 Webhook 状态推送
- 修改五态 FSM 节点 id 集合（仍固定 `draft`→`published`）
- Dataset ORM 全量、物理字段自动发现引擎
- 新增 npm 拖拽或 SQL 编辑器依赖
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构（P5 仅勾选五行）

## 3. 架构设计

### 3.1 共享标识（延续批次 1）

| 概念 | 约定 |
|------|------|
| `designerItemId` | UUID v4；`sessionStorage` + `useDesignerWorkspace` |
| `refType` | 固定 `design_draft` |
| `refId` | 等于 `designerItemId` |
| `design_mode` | 新 config_type；payload `{ mode: "visual" \| "sql" }`，默认 `visual` |
| 配置块 | visual：`query_conditions` / `compute_rules` / `output_fields`；sql：`sql_mode` |

可视化与 SQL **显式切换**（Segmented Control）；同一 `refId` 下两块配置可并存，但 UI 同时只编辑一种；提交工单时按当前 `design_mode` 校验对应块已保存。

### 3.2 DESIGN-004 — 设计器与工单关联（补全）

#### 方案比选

| 方案 | 快照回看 | 双向关联 | 撤回 | 结论 |
|------|---------|---------|------|------|
| A 专用 GET snapshot + 实例列表 FE + link 反向查询 | 强 | 完备 | draft 态可删 link | **采用** |
| B 仅扩展 instance `includeDesignSnapshot` 无独立路由 | 弱（无 snapshotId 直链） | 部分 | 无 | 否决 |
| C 快照嵌入 instance payload | 超大风险 | — | — | 否决 |

#### 后端增量

**`designer/snapshot.py`**：

```text
get_snapshot_for_actor(session, snapshot_id, actor) -> dict
  - admin：可读
  - owner（config_store owner_id 匹配 actor.id）：可读
  - 其他：403 DESIGN_SNAPSHOT_FORBIDDEN
```

**`GET /api/v1/designer/snapshots/{snapshotId}`**：返回 `{ conditions, computeRules, outputFields, revisions, capturedAt }`。

**`designer/workflow.py`** 增量：

- `get_link_by_instance(session, workflow_instance_id)` → `DesignerWorkflowLinkOut`
- `GET /workflow-link` 增加可选 query `workflowInstanceId`（与 `designerItemId` 二选一）
- `DELETE /workflow-link?designerItemId=`：仅当关联 instance `status == "draft"` 且 actor 为 admin/owner → 204；否则 409 `DESIGN_WORKFLOW_LINK_NOT_REVOKABLE`
- `submit_with_snapshot`：instance payload 增加 `snapshotRevision`（三块 revision 之和或 dict 原样）

**`GET /api/v1/gov/workflow/instances`**（新建）：`limit`/`offset`/`status` 过滤；返回 `{ items: WorkflowInstanceOut[], total }`（扫描 `workflow_instance` config_store，按 `capturedAt`/`history` 降序）。

**越权**：跨租户/非 owner 读 snapshot → 403；viewer 可读同 org 实例列表但不可 DELETE link。

#### 前端增量

**`GovernanceWorkflowPage`** 重构为双 Tab：

1. **流程模板**（既有 master-detail）
2. **工单实例**（新建）：左栏实例列表（`refId` 截断 + status Badge）；右栏详情
   - `GET /workflow/instances/{id}?includeDesignSnapshot=true`
   - 快照区：只读 `ConditionsPanel`/`ComputeRulesPanel`/`OutputFieldsPanel`（`readOnly` prop）
   - 显示 `revisions` 与 `capturedAt`
   - 操作按钮按 `allowedActions`：审批人 `approve`/`reject`；设计完成后 `complete_design`

**设计器**：提交成功 Dialog 保留；增加复制 `designSnapshotId` 链接。

#### 可测试验收标准

1. submit 后 `GET /snapshots/{id}` 与 capture 内容一致（immutable）
2. 非 owner viewer `GET /snapshots/{id}` → 403
3. `GET /workflow-link?workflowInstanceId=` 与 designerItemId 方向一致
4. instance `draft` 态 DELETE link → 204；`pending_approval` 态 → 409
5. `GET /workflow/instances` 含刚提交实例；`includeDesignSnapshot=true` 含三块配置
6. submit 写入 `snapshotRevision` 与 revisions dict 一致
7. FE smoke：实例 Tab 选中工单 → 快照条件列表非空

### 3.3 DESIGN-005 — 传统 SQL 模式

#### 方案比选

| 方案 | 切换 | 存储 | 预览 | 结论 |
|------|------|------|------|------|
| A Segmented + 独立 SQL 面板 + 既有 sql_mode API | 显式 | 共享 refId | SQL 模式显示编辑器内容 | **采用** |
| B 第三 Tab「SQL」与可视化并列 | 弱互斥 | 共享 | 仍走 translate | 备选 |
| C 新页面 `/admin/designer/sql` | 割裂 | — | — | 否决 |

#### 后端增量

- **不新增** SQL 校验逻辑；巩固 `PUT/GET /sql-mode` 与 `design_mode` 联动
- `PUT /design-mode` body `{ refId, mode: "visual"|"sql" }`；切换不删除另一模式配置
- `submit-workflow`：当 `design_mode=sql` 时 `_assert_design_complete` 改为断言 `sql_mode` 已持久化（visual 三块可跳过）

#### 前端增量（`designer-sql-panel.tsx`）

- 顶栏 `Select` 数据源（`GET /api/v1/datasources`）
- `Textarea` `font-mono min-h-[280px]` 编辑 SQL；`aria-label="SQL 查询语句"`
- 「校验 SQL」→ `POST /sql-mode/validate`；行内错误 `aria-invalid`
- 「保存 SQL」→ `PUT /sql-mode`（body 含 `dataSourceId`, `sql`, `refId`, `refType: design_draft`）
- 右栏预览：SQL 模式下显示编辑器内容（不调用 translate）
- `DesignerPage` 顶栏增加 `Tabs` 同级 Segmented：`可视化` | `传统 SQL`（`Button variant` 切换，对齐 TailAdmin segmented 模式）

#### 可测试验收标准

1. 合法 SQL PUT → GET 往返
2. DML SQL validate → 422 `DESIGN_SQL_NOT_READONLY` + `detail.remediation`
3. 空 SQL → 422 `DESIGN_SQL_EMPTY`
4. `design_mode=sql` 且无 sql_mode 配置 submit → 422 `DESIGN_SUBMIT_INCOMPLETE`
5. `design_mode=visual` 缺 output submit → 422（回归 r245）
6. `probe_validate_sql_mode` ≤50ms（回归 r52）
7. FE smoke：切 SQL 模式 → 输入 `SELECT 1` → 保存成功 toast

### 3.4 GOV-004 — 可视化查询设计（审批态）

#### 方案比选

| 方案 | 数据源 | 状态机 | 结论 |
|------|--------|--------|------|
| A 从 workflow snapshot 投影为 `VisualQueryDesignOut` | 与 DESIGN-004 衔接 | 映射 workflow status | **采用** |
| B 独立 gov 存一份审批副本 | 重复 | 双写 | 否决 |
| C 仅只读 GET 无 confirm | 弱 | — | 否决 |

#### 状态映射

| workflow instance status | 治理可读状态 | 可确认发布 |
|--------------------------|-------------|-----------|
| `draft`, `pending_approval` | 不可查询（404） | 否 |
| `designing` | `approved`（待确认） | 是（approver/admin） |
| `pending_publish`, `published` | `ready` | 否（已确认） |

#### 后端增量

**`governance/query_design/service.py`**：

```text
load_design_from_workflow(session, instance_id, actor) -> VisualQueryDesignOut
  - instance status in (designing, pending_publish, published)
  - 读 designSnapshot → 组装 title（refId 前 8 位）、conditions、computeRules
  - status 字段按上表映射

confirm_approved_design(session, instance_id, actor) -> WorkflowInstanceOut
  - 断言 status == designing；actor_role == approver 或 admin
  - transition complete_design → pending_publish
  - 写 visual_query_design config（ref_id = designerItemId）status=ready
```

**路由**：

- `GET /api/v1/gov/workflow/instances/{id}/approved-design`
- `POST /api/v1/gov/workflow/instances/{id}/confirm-design`

#### 可测试验收标准

1. `pending_approval` 实例 GET approved-design → 404 `GOV_QUERY_DESIGN_NOT_APPROVED`
2. approve 至 `designing` 后 GET → 200 含 conditions
3. viewer confirm → 403 `GOV_WORKFLOW_FORBIDDEN_ROLE`
4. approver confirm → `pending_publish`；二次 confirm → 409
5. confirm 后 `GET /gov/query-design?refId=` 可读
6. 越权读他人工单 snapshot → 403

### 3.5 GOV-005 — 查询服务发布

#### 方案比选

| 方案 | 输入 | 输出 | 版本 | 结论 |
|------|------|------|------|------|
| A `publish_from_workflow` 创建 catalog entry + 链式 publish FSM | workflowInstanceId | CatalogEntry + link.catalogEntryId | `publishVersion` 递增 | **采用** |
| B 手动创建 entry 再关联 | 两步 | 弱 UX | — | 否决 |
| C 跳过 FSM 直接 published | 快但不合规 | — | — | 否决 |

#### 后端增量

**`governance/publish/service.py`**：

```text
publish_from_workflow(db, workflow_instance_id, actor) -> PublishFromWorkflowOut
  1. instance.status == pending_publish（否则 400）
  2. 读 snapshot + designerItemId
  3. catalog_service.create_entry(name, path=/api/v1/services/{slug}, category=query, ...)
  4. workflow-link 更新 catalogEntryId
  5. submit_entry → approve_entry（admin 路径；analyst 仅 submit 留 pending）
  6. publishVersion = 1（回滚骨架：rollback_entry_skeleton → draft + version 保留历史数组）
  7. 触发 GOV-006 openapi 生成（见 3.6）
```

**`POST /api/v1/gov/publish/from-workflow`** body `{ workflowInstanceId }`。

**幂等**：同一 instance 二次发布 → 200 返回既有 entry（`GOV_PUBLISH_IDEMPOTENT` 或返回已有 id）。

#### 前端增量（`GovernancePublishPage`）

- 表格增加「操作」列：`提交发布` / `批准` / `驳回`（按 `allowedActions` 调既有 publish API）
- 工单实例详情「发布服务」按钮 → `POST /publish/from-workflow`；成功 toast + invalidate catalog

#### 可测试验收标准

1. happy path：confirm → publish_from_workflow → catalog entry `published`
2. 非 `pending_publish` 发布 → 400
3. viewer 发布 → 403
4. 二次发布幂等 → 200 同 entry id
5. workflow-link `catalogEntryId` 已填充；`publishReady=true`
6. `rollback_entry_skeleton` → draft；历史版本数组 +1
7. FE smoke：发布页点击批准 → Badge 变 `published`

### 3.6 GOV-006 — 发布引擎 OpenAPI 映射

#### 方案比选

| 方案 | 生成时机 | 格式 | 脱敏 | 结论 |
|------|---------|------|------|------|
| A publish 钩子 + `GET .../openapi` 聚合 IF-02 fragment | 自动 | OpenAPI 3.1 paths | 去除 credential 类字段 | **采用** |
| B 仅 mapping store 手填 | 手动 | 弱 | — | 否决 |
| C 完整 Swagger UI 托管 | 超范围 | — | — | 否决 |

#### 后端增量

**`governance/openapi/service.py`**：

```text
generate_openapi_document(db, catalog_entry_id) -> dict
  - 读 catalog entry（须 published）
  - 委托 integration.query_services.get_service_openapi_fragment 结构
  - 合并 parameters schema（来自 snapshot output fields，仅 name/type）
  - redact_openapi_fields: 剔除 password/secret/token/credential 关键词属性
  - 写入内存 store + 可选 register_mapping（operationId 自动生成 `query_{slug}`）

GET /api/v1/gov/publish/entries/{entry_id}/openapi -> OpenAPI 3.1 文档 JSON
```

与 **IF-02** 对齐：`info.version` = `publishVersion`；`paths` 键为 entry.path；`operationId` 满足 r55 正则。

#### 可测试验收标准

1. 发布后 `GET .../openapi` → 200 含 `openapi: 3.1.0` 与 `paths`
2. draft entry GET openapi → 422 `GOV_OPENAPI_DOC_NOT_PUBLISHED`
3. snapshot 含字段 `password_hash` → schema 不含该属性（脱敏）
4. `probe_openapi_validate_budget_ms` ≤50ms（回归 r55）
5. 生成后 `GET /gov/openapi-mappings?catalogEntryId=` 至少 1 条
6. FE smoke：发布页行内「OpenAPI」打开 Sheet 显示 JSON 预览

## 4. 测试策略

### 4.1 新套件 `tests/test_mfinal_fe_design_r246.py`

| 区块 | 用例 ID 前缀 | 条数 | 覆盖 |
|------|-------------|------|------|
| DESIGN-004 | `T-DESIGN-R246-004-*` | ≥8 | snapshot ACL、link 反向、撤回、instances 列表、snapshotRevision |
| DESIGN-005 | `T-DESIGN-R246-005-*` | ≥6 | design_mode、sql submit 路径、非法 SQL、mode 切换 |
| GOV-004 | `T-GOV-R246-004-*` | ≥6 | approved-design、confirm、状态映射、越权 |
| GOV-005 | `T-GOV-R246-005-*` | ≥6 | from-workflow、幂等、rollback 骨架、publishReady |
| GOV-006 | `T-GOV-R246-006-*` | ≥6 | openapi 生成、脱敏、未发布 422、mapping 联动 |

**夹具**：module-scoped SQLite；`jwt_auth_headers()` admin/analyst/viewer；复用 r245 workflow + catalog 模式。

### 4.2 回归门控

- `test_mfinal_fe_design_r246.py` 全绿
- `test_mfinal_fe_design_r245.py` 全绿（批次 1 不退化）
- `test_design_conn_gov_query_r52.py` DESIGN-005 抽样全绿
- `test_rpt_gov_meta_conn_r55.py` GOV-006 抽样全绿
- `cd backend && ruff check` 相关路径
- `cd fe && pnpm run check:design` + vitest smoke（designer + governance）

## 5. PRD 8 维薄弱项对齐

| ID | 薄弱维 | 本轮闭合动作 | 验收信号 |
|----|--------|-------------|----------|
| DESIGN-004 | 完整度 90%、交互 86%、安全 92% | snapshot GET ACL + 实例 FE 回看 + 双向 link + 撤回守卫 | pytest ≥8；工单实例 Tab 快照可见 |
| DESIGN-005 | 用户价值 84%、架构 88% | Admin SQL 模式 Segmented + sql_mode 共享 ref + submit 分支 | pytest ≥6；FE 保存 SQL 绿 |
| GOV-004 | 用户价值 84%、完整度 90% | workflow→approved-design 投影 + confirm 流转 | pytest ≥6；designing 态可确认 |
| GOV-005 | 架构 88%、用户价值 84% | from-workflow 发布 + 版本/回滚骨架 + FE 发布操作 | pytest ≥6；catalog published |
| GOV-006 | 用户价值 84%、架构 88% | 自动 OpenAPI 3.1 生成 + GET 聚合 + 脱敏 | pytest ≥6；IF-02 结构对齐 |

## 6. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 6.1 页面信息架构

| 路由 | 壳层 | 导航 | 主内容 |
|------|------|------|--------|
| `/admin/designer` | `AdminPageShell` | 分析 → 查询设计器 | Segmented（可视化/SQL）+ 既有三面板或 SQL 面板 + 右栏预览 |
| `/admin/governance/tickets` | `AdminPageShell` | 治理 → 治理工单 | Tab：流程模板 \| 工单实例；实例 master-detail + 快照回看 |
| `/admin/governance/publish` | `AdminPageShell` | 治理 → 发布流水线 | catalog 表 + 行内发布操作 + OpenAPI Sheet |

- 内容区宽度：`max-w-(--breakpoint-2xl)`（`AdminLayout` 既有）
- 密度：设计器 **form-composition**；治理实例 **list-detail**（`lg:grid-cols-[300px_1fr]`，对齐 `GovernanceWorkflowPage` 模板 Tab）

### 6.2 状态覆盖

| 状态 | 设计器 SQL 模式 | 工单实例 | 发布流水线 |
|------|----------------|---------|-----------|
| 加载 | SQL Textarea `Skeleton` | 实例列表 `Skeleton` | 表格行 `Skeleton` |
| 空 | 「请输入 SELECT 语句」placeholder | 「暂无工单实例」 | 「暂无 catalog 条目」 |
| 错误 | 字段贴 `aria-invalid`；表单级 Alert | `ErrorBanner` + 重试 | `ErrorBanner` |
| 权限 | analyst 可编辑；viewer 只读（nav 既有） | admin/approver 可 confirm/publish | admin 可 approve |
| 提交中 | 保存/校验 `disabled` | transition 按钮 loading | publish 操作 loading |

### 6.3 视觉层级与组件映射

| 元素 | 组件 | 说明 |
|------|------|------|
| 模式切换 | `Button` group / `Tabs` variant | 「可视化」「传统 SQL」；primary 为当前模式 |
| SQL 编辑 | `Textarea` `font-mono` | 无高亮；`min-h-[280px]` |
| 主操作 | `Button variant="primary"` | 保存 SQL、确认设计、发布服务 |
| 次操作 | `Button variant="outline" size="sm"` | 校验 SQL、查看 OpenAPI |
| 实例列表 | 复用 `WorkflowTemplateList` 样式 | status `Badge` |
| 快照回看 | `designer-panels` + `readOnly` | 禁用输入；灰底 `bg-gray-50/50` |
| OpenAPI 预览 | `Sheet` + `Textarea` readOnly | JSON `font-mono text-theme-xs` |
| 确认发布 | `AlertDialog` | 「确认发布后将生成对外 API」 |

**禁止**：页面内手写 `<button>`；引入 Monaco/CodeMirror；新建未登记全局 DataTable。

### 6.4 Token 与密度

- 语义色：SQL 面板 `border-gray-200 dark:border-gray-800`；错误 `border-error-500`
- 间距：模式切换 `mb-4`；SQL 面板 `space-y-4`；实例详情 `gap-6`
- 圆角：卡片 `rounded-xl`；Sheet `rounded-2xl`
- 字号：SQL / OpenAPI `text-theme-xs font-mono`；表体 `text-theme-sm`
- 图标：`Code2`（SQL 模式）、`FileJson`（OpenAPI）、`CheckCircle`（确认）`size-4`

### 6.5 响应式与可访问性

- 设计器 `<lg`：SQL 预览并入 Tabs「预览」子 Tab（与批次 1 一致）
- 实例 master-detail `<lg`：列表全宽，选中后详情折叠手风琴
- SQL Textarea `spellCheck={false}`；校验错误 `aria-describedby`
- OpenAPI Sheet `aria-label="OpenAPI 文档预览"`
- 模式切换按钮 `aria-pressed` 标识当前模式

### 6.6 视觉 QA 清单

- [ ] Desktop：设计器 SQL 模式保存流程截图（light/dark）
- [ ] Desktop：工单实例快照回看截图
- [ ] Desktop：发布页 approve + OpenAPI Sheet 截图
- [ ] Mobile：设计器 Segmented + SQL 面板无横向溢出
- [ ] Mobile：实例列表/详情堆叠可读
- [ ] 检查：按钮对齐、Badge 色彩、mono 文本不撑破布局、loading 态无控件重叠

## 7. Self-review 记录

- 无 TBD/TODO 占位
- 18 文件与 round-target 三模块一致，未含 GOV-007/008
- 五 PRD ID 均有可测试验收标准
- UI 设计交付已引用 `b-design-system-tailadmin-radix`
- 与批次 1 design spec 依赖链衔接明确
