# M-FINAL F-E 设计器奠基 + 工单模板（批次 1）设计

```yaml
date: 2026-07-07
milestone: M-FINAL · F-E
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fe-design.md
prd_ids: [DESIGN-001, DESIGN-002, DESIGN-003, GOV-003, DESIGN-004]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
base_branch: dev-auto
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:----:|------------|----------|
| 1 | 拖拽查询条件配置 + SQL 预览 | DESIGN-001 | `designer/` + `fe/designer/` | 1 | 用户价值 **82%**；性能 **88%** | 无需手写 WHERE；改条件即见 SQL 片段 |
| 2 | 运算规则维护 UI | DESIGN-002 | `designer/` + `fe/designer/` | 2 | 用户价值 **82%**；性能 **88%** | 可视化维护计算字段，与条件联动预览 |
| 3 | 输出字段与聚合配置 + META 联动 | DESIGN-003 | `designer/` + `metadata/` + `fe/designer/` | 3 | 用户价值 **84%**；完整度 **90%** | 可选输出列、聚合与排序；术语/Dataset 字段可选引用 |
| 4 | 工单流程模板可配置 CRUD | GOV-003 | `governance/workflow/` | 4 | 用户价值 **84%**；架构健康 **88%** | 管理员维护模板节点与审批角色 |
| 5 | 设计器配置 ↔ 工单关联 + 快照提交 | DESIGN-004 | `designer/` + `governance/workflow/` + `fe/designer/` | 5 | 用户价值 **84%**；架构健康 **88%**；安全 **92%** | 保存配置后一键提交工单；工单详情可回看快照 |

**依赖链**：DESIGN-001 条件面板 → DESIGN-002 规则面板（共享 `designerItemId`/`refId`）→ DESIGN-003 输出面板（共享预览链）→ GOV-003 可提交模板 → DESIGN-004 `submit` 携带快照并写 workflow-link → `test_mfinal_fe_design_r245.py` 全绿 → docs 同步 → plan F-E 首批五行可勾选。

**上轮已交付（本轮不重复 L1 骨架）**：

- r32/r33：`conditions`/`compute_rules` validate/save/get + revision 乐观锁
- r49/r52：`output_fields`/`sql_mode` 白名单校验 + probe
- r59/r63：`workflow-link` validate/save/get + `publishReady` + catalog mismatch 守卫
- r49/r52 GOV-003：内置 `standard_query_release` 五态 FSM + `node-roles` 只读描述
- FE：`DesignerPage` 仅展示 SQL 能力契约；`GovernanceWorkflowPage` 只读模板浏览

**本轮性质**：F-E **批次 1 奠基**（Admin 设计器三面板 + 模板 CRUD + 工单快照关联），非 DESIGN-005 SQL Lab、非 GOV-004~008 发布/总线全链。

## 2. 范围框定

### 2.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| designer | `backend/app/designer/` | 条件/规则/输出校验、预览翻译、配置快照、工单 link |
| governance/workflow | `backend/app/governance/workflow/` | 工单模板持久化 CRUD、节点角色可配置、实例创建扩展 |
| fe 设计器 | `fe/src/pages/admin/designer/` · `fe/src/pages/admin/governance/` | 查询设计器工作区；治理工单模板编辑 |

> **路径说明**：round-target 写作 `design/`、`gov/` 为 PRD 简称；实现真理源为 `designer/`、`governance/`（与现有代码锚点一致）。

### 2.2 文件列表（18）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/designer/schemas.py` | 001~004 | `FieldRegistryOut`、`PreviewTranslateIn`、`DesignerSnapshotOut` |
| `backend/app/designer/service.py` | 001~003 | `list_designer_fields()`、`build_preview_translate_request()` |
| `backend/app/designer/snapshot.py` | 004 | **新建** 快照采集/读取（conditions+rules+output revisions） |
| `backend/app/designer/workflow.py` | 004 | `submit_with_snapshot()` 编排 link + snapshot |
| `backend/app/api/v1/designer.py` | 001~004 | `GET /fields`、`POST /preview/translate`、`POST /submit-workflow` |
| `backend/app/governance/workflow/service.py` | GOV-003 | 自定义模板 CRUD（config_store）；内置模板只读 |
| `backend/app/governance/workflow/schemas.py` | GOV-003 | `WorkflowTemplateCreateIn`/`UpdateIn` |
| `backend/app/governance/workflow/node_roles.py` | GOV-003 | 从持久化模板解析角色（非仅 `_BUILTIN`） |
| `backend/app/api/v1/gov.py` | GOV-003、004 | `POST/PUT/DELETE /workflow/templates`；实例创建 body 扩展 `designerItemId` |
| `backend/app/query/config_store/schemas.py` | GOV-003、004 | `ALLOWED_CONFIG_TYPES` 增加 `workflow_template`、`designer_snapshot` |
| `tests/test_mfinal_fe_design_r245.py` | 全部 | **新建** ≥30 条 F-E 批次 1 pytest |
| `fe/src/pages/admin/designer/DesignerPage.tsx` | 001~004 | 重构为三区工作区 + 提交工单 |
| `fe/src/pages/admin/designer/designer-panels.tsx` | 001~003 | **新建** 条件/规则/输出三面板（≤300 行） |
| `fe/src/pages/admin/designer/useDesignerWorkspace.ts` | 001~004 | **新建** 状态、校验、保存、预览、提交编排 |
| `fe/src/pages/admin/designer/designer.smoke.test.tsx` | 001~004 | **新建** RTL smoke ≥6 条 |
| `fe/src/pages/admin/governance/components/WorkflowTemplateDetail.tsx` | GOV-003 | 自定义模板「复制并编辑」Dialog（节点角色 Select） |
| `fe/src/lib/queryKeys.ts` | FE | `designer.conditions`/`computeRules`/`outputFields`/`preview`/`fields` |
| `docs/api/README.md` · `docs/services/designer.md` · `docs/services/governance.md` | 全部 | 新路由与 F-E 状态 |

**真理源优先级**：`round-target` > `prd.md` hub + `F12-DESIGN.md`/`F10-GOV.md` > `docs/services/designer.md`/`governance.md` > `docs/api/README.md`。

### 2.3 非目标（明确不做）

- DESIGN-005 传统 SQL Lab、语法高亮编辑器、SQL 执行链
- GOV-004 可视化查询设计聚合 UI、GOV-005~008 发布/总线/权限全链路 UI
- 完整 BPM 审批工作台、企微/邮件通知、双向状态 Webhook
- 修改 FSM 节点 id 集合（仍固定五态：`draft`→`published`）
- 画布级 Dashboard/图表拖拽设计器
- Dataset ORM 全量、物理字段自动发现引擎
- 新增 npm 拖拽依赖（采用 HTML5 DnD + 键盘 reorder 兜底）
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构（P5 仅勾选五行）

## 3. 架构设计

### 3.1 设计器工作区标识（共享）

| 概念 | 约定 |
|------|------|
| `designerItemId` | UUID v4；页面首次进入或「新建设计」时生成，存于 `useDesignerWorkspace` state + `sessionStorage` |
| `refType` | 固定 `design_draft`（与 r32 一致） |
| `refId` | 等于 `designerItemId` |
| Dataset 上下文 | 可选 `datasetId`；用于 preview translate 取首表名与列清单 |

三配置块（conditions / compute_rules / output_fields）共享同一 `refId`，分别 `PUT` 各自端点；保存成功后刷新 `expectedRevision` 用于乐观锁。

### 3.2 DESIGN-001 — 拖拽查询条件配置

#### 方案比选

| 方案 | 拖拽 | 预览 | 结论 |
|------|------|------|------|
| A HTML5 DnD + 结构化行表单 + `POST /preview/translate` | 原生、零依赖 | 合并三块配置翻译 SQL | **采用** |
| B 引入 `@dnd-kit` | 体验好 | 同上 | 否决（新依赖、超范围） |
| C 仅结构化表单无 DnD | 满足最低验收 | 有 | 备选兜底（若 DnD 冒烟不稳则降级，仍勾选 plan） |

#### 后端增量

- `GET /api/v1/designer/fields?datasetId=` → `{ registry: string[], glossary: string[], datasetFields: string[] }`
  - `registry` = `DESIGNER_FIELD_REGISTRY`
  - `glossary` = 术语 `code` 前 200（与 DESIGN-003 META 联动）
  - `datasetFields` = 选中 Dataset 的 `tables[].name` + `computedFields[].name`（无 datasetId 时 `[]`）
- `POST /api/v1/designer/preview/translate`：校验三块配置后组装 `TranslateRequest`（connector 默认 `postgresql`，schema `public`，table 取 Dataset 首表或 `design_preview`），委托 `translate_config_to_sql`；**不落库**
- `probe_preview_translate_budget_ms` ≤ **50ms**（smoke 夹具）

#### 前端增量（条件面板）

- 条件列表：每行 `GripVertical` 拖拽把手 + `Select`（字段/运算符/值类型）+ `Input`（值）
- HTML5 `draggable` + `onDragStart/onDragOver/onDrop` 重排 `conditions[]`；窄屏提供「上移/下移」图标按钮（`aria-label`）
- 「添加条件」追加行；行内删除需 `AlertDialog` 确认（仅当 >1 条）
- `logic`：`Select` AND/OR
- 失焦或点击「校验」→ `POST /conditions/validate`；字段错误映射 `detail.fields` 至行内 `aria-invalid`
- 「保存条件」→ `PUT /conditions`（带 `expectedRevision`）
- 右栏预览区：debounce 400ms 调用 preview translate，展示 `sql` + `parameters` 只读 `Textarea`（mono）

#### 可测试验收标准

1. 合法条件 PUT → GET 往返 revision 递增
2. 空 conditions validate → 422 `DESIGN_EMPTY_CONDITIONS` + `detail.fields`
3. unknown fieldId → 422 `DESIGN_UNKNOWN_FIELD`
4. preview translate 合法 payload → 200 含 `sql` 字符串
5. preview probe ≤50ms
6. viewer PUT conditions → 403（若路由挂 dataset 写 ACL；否则沿用 config_store owner 链，集成测断言非 owner 409/403）
7. FE smoke：添加条件、拖拽重排（或上移）、校验错误展示、预览 SQL 非空

### 3.3 DESIGN-002 — 运算规则维护

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 表格式规则编辑器 + 依赖图只读提示 | 复用 metadata 表格模式 | **采用** |
| B 节点画布连线编辑 dependsOn | 超文件预算 | 否决 |
| C 仅 API 不测 UI | 违背 round-target Admin 感知 | 否决 |

#### 后端增量

- **不新增** HTTP 路由；巩固 `validate` 在 preview 链中的合并（rules 转译 L1：preview 仅展示 conditions+output 列，规则表达式附注在 SQL 注释行 `-- rule: {id}={expression}`，不执行计算引擎）
- `probe_validate_compute_rules` 保持 r33 行为

#### 前端增量

- Tab「运算规则」：`MetaDataTable` 风格表格（id、名称、类型、目标字段、表达式、依赖）
- 新建/编辑 `Dialog`：`ruleType` Select（sum/avg/add/sub/mul/div/format）、`targetField`/`expression` Input、`dependsOn` 多选（已有规则 id）
- 保存前 `POST` 无独立 validate 端点时直接 `PUT /compute-rules`；422 映射至 Dialog 字段
- 保存后 invalidate preview query

#### 可测试验收标准

1. 规则 PUT → GET 往返
2. `ruleType=sum` + `expression=avg(x)` → 422 `DESIGN_RULE_TYPE_MISMATCH`
3. dependsOn 环 → 422 `DESIGN_RULE_CYCLE`
4. broken chain → 422 `DESIGN_RULE_BROKEN_CHAIN`
5. FE smoke：新增规则、非法表达式行内错误、保存成功 toast

### 3.4 DESIGN-003 — 输出字段与聚合配置

#### 后端增量（META-004 联动）

- `output_fields.py`：`metaFieldRef` 校验扩展——若不在 registry 则查 glossary（**已有**）；新增：若传 `datasetId` 查询参数于 validate，允许 `fieldId` 命中 Dataset `computedFields[].name`
- `GET /designer/fields` 已合并 dataset 字段（见 §3.2）

#### 前端增量

- Tab「输出字段」：字段列表（fieldId、别名、排序 handle）；聚合子区（fn/groupBy/orderBy）
- `metaFieldRef` 可选 Select（glossary codes）
- `sortOrder` 数字输入；聚合 `fn` 白名单 Select（sum/count/avg/min/max）
- 保存 `PUT /output-fields`；预览刷新列清单

#### 可测试验收标准

1. 空 fields → 422 `DESIGN_EMPTY_OUTPUT_FIELDS`
2. 重复 fieldId → 422 `DESIGN_DUPLICATE_OUTPUT_FIELD`
3. 非法 aggregate → 422 `DESIGN_INVALID_AGGREGATE`
4. `metaFieldRef` 合法 glossary code → 200
5. dataset computed field 作 fieldId（带 datasetId 上下文）→ 200
6. FE smoke：添加输出列 + 聚合行、保存、预览 columns 变化

### 3.5 GOV-003 — 工单流程模板 FR-1.2

#### 方案比选

| 方案 | 模板存储 | 节点角色 | 结论 |
|------|----------|----------|------|
| A config_store `workflow_template` + 内存索引 | 与 instance 一致 | 五节点 id 固定，role 可编辑（白名单） | **采用** |
| B Alembic 新表 | 过重 | — | 否决 |
| C 仅 validate 不落库 | 不满足 CRUD 验收 | — | 否决 |

#### 增量要点

**角色白名单**：`requester` | `approver` | `designer` | `publisher` | `admin`

**内置模板**：`standard_query_release` 保留 `_BUILTIN_TEMPLATES`，**禁止** DELETE/PUT 覆盖

**自定义模板 API**：

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/gov/workflow/templates` | 创建；body `WorkflowTemplateCreateIn`；id 服务端生成 slug 或 UUID |
| PUT | `/api/v1/gov/workflow/templates/{id}` | 更新 name/nodes（内置 id → 403 `GOV_WORKFLOW_BUILTIN_READONLY`） |
| DELETE | `/api/v1/gov/workflow/templates/{id}` | 删除自定义模板；有活跃 instance 引用 → 409 |
| GET | `/api/v1/gov/workflow/templates` | 合并 builtin + custom |

校验复用 `validate_template()`：节点 id 必须覆盖五态；`draft`/`published` 节点必须存在；role 非空且在白名单。

`node_roles.describe_node_roles` 改为从 `get_template(template_id)` 读取（builtin 或 custom）。

`create_instance`：`template_id` 可指向自定义模板；FSM `_TRANSITIONS` **不变**（仍按 status 节点 id 迁移）。

#### 可测试验收标准

1. POST 合法自定义模板 → 201；GET list 可见
2. 缺 `published` 节点 validate → 422 `GOV_WORKFLOW_INVALID_TEMPLATE` + `missingNodes`
3. PUT 改节点 role `approver`→`admin` → 200；node-roles GET 反映新 role
4. DELETE builtin → 403
5. DELETE 被 instance 引用 → 409
6. FSM happy path + 双 submit 409 + terminal 409（r52 回归）
7. `probe_transition_path` ≤50ms
8. FE：治理工单页「基于标准模板创建」Dialog 可编辑五节点角色并 POST 成功

### 3.6 DESIGN-004 — 设计器与工单关联

#### 方案比选

| 方案 | 快照 | 关联 | 结论 |
|------|------|------|------|
| A 独立 `designer_snapshot` config + workflow-link + 扩展 instance payload | 不可变副本 | 双向 id | **采用** |
| B 仅 revision 指针无 payload | 轻但工单回看弱 | 部分满足 | 否决 |
| C 嵌入 instance JSON 单条超大 payload | 超 256KB 风险 | — | 否决 |

#### 增量要点

**`designer/snapshot.py`**：

```text
capture_snapshot(session, designer_item_id, owner_id) ->
  designer_snapshot config:
    conditions, computeRules, outputFields  # 各块 payload 深拷贝
    revisions: { query_conditions: n, compute_rules: n, output_fields: n }
    capturedAt: ISO8601
```

**`POST /api/v1/designer/submit-workflow`**（admin/analyst）：

Request:

```json
{
  "designerItemId": "<uuid>",
  "templateId": "standard_query_release",
  "designType": "query",
  "catalogEntryId": null
}
```

流程：

1. 断言三块配置均已持久化（任一缺失 → 422 `DESIGN_SUBMIT_INCOMPLETE`）
2. `capture_snapshot`
3. `POST` 等价 `create_instance(templateId, refId=designerItemId)`
4. instance payload 写入 `designSnapshotId`、`snapshotRevision`
5. `save_workflow_link(designerItemId, workflowInstanceId, designType=query)`
6. 自动 `transition submit`（actor_role=requester）→ `pending_approval`
7. Response：`{ workflowInstanceId, designSnapshotId, status, publishReady: false }`

**读取**：

- `GET /api/v1/gov/workflow/instances/{id}` 增加可选 `designSnapshot`（只读，viewer 可看同 org）
- `GET /api/v1/designer/workflow-link?refId=` 保持；工单详情页后续批次展示快照 JSON（本轮 FE：提交成功 Dialog 展示 instanceId +「前往治理工单」链接）

**越权**：非 owner 且非 admin submit → 403 `DESIGN_SUBMIT_FORBIDDEN`；跨用户读 snapshot → 403

**GOV-004~005 预留**：Response 含 `workflowInstanceId` + `designSnapshotId` 供发布链 `refId` 挂载；不调用 publish API。

#### 可测试验收标准

1. 完整三块配置 submit → 201；workflow-link GET 双向一致
2. 缺 output_fields submit → 422 `DESIGN_SUBMIT_INCOMPLETE`
3. viewer submit → 403
4. snapshot GET 与提交时 conditions 内容一致（immutable）
5. query designType + catalogEntryId → 422 `DESIGN_WORKFLOW_CATALOG_MISMATCH`（r63 回归）
6. FE smoke：保存三块 → 点击「提交查询服务申请」→ 成功 Dialog + 链接 `/admin/governance/tickets`

## 4. 测试策略

### 4.1 新套件 `tests/test_mfinal_fe_design_r245.py`

| 区块 | 用例 ID 前缀 | 条数 | 覆盖 |
|------|-------------|------|------|
| DESIGN-001 | `T-DESIGN-R245-001-*` | ≥8 | fields API、preview translate、conditions ACL、probe |
| DESIGN-002 | `T-DESIGN-R245-002-*` | ≥5 | rules 边界 + preview 注释回归 |
| DESIGN-003 | `T-DESIGN-R245-003-*` | ≥6 | output META/dataset 联动、aggregate 边界 |
| GOV-003 | `T-GOV-R245-003-*` | ≥8 | 模板 CRUD、role 配置、builtin 守卫、FSM 回归 |
| DESIGN-004 | `T-DESIGN-R245-004-*` | ≥8 | submit、snapshot、link、越权、incomplete |

**夹具**：module-scoped SQLite；`jwt_auth_headers()` admin/viewer；复用 r52 workflow instance 模式。

### 4.2 回归门控

- `test_mfinal_fe_design_r245.py` 全绿
- `test_design_conn_gov_query_r52.py` GOV-003 / DESIGN-003/005 抽样全绿
- `test_viz_view_design_cat_r63.py` DESIGN-004 全绿
- `test_mfinal_fd_meta_r244.py` META-004 抽样（Dataset API 不退化）
- `cd backend && ruff check` 相关路径
- `cd fe && pnpm run check:design` + vitest smoke

## 5. PRD 8 维薄弱项对齐

| ID | 薄弱维 | 本轮闭合动作 | 验收信号 |
|----|--------|-------------|----------|
| DESIGN-001 | 用户价值 82%、性能 88% | Admin 拖拽条件 + debounce 预览 + probe | FE 可操作；preview ≤50ms |
| DESIGN-002 | 用户价值 82%、性能 88% | 规则表格式 UI + 与预览联动 | 规则 CRUD UI；环/链 422 回归 |
| DESIGN-003 | 用户价值 84%、完整度 90% | 输出/聚合 UI + glossary/dataset 字段源 | META 联动 pytest；端到端保存 |
| GOV-003 | 用户价值 84%、架构 88% | 模板 CRUD + 节点 role Select | 自定义模板可创建；builtin 不可删 |
| DESIGN-004 | 用户价值 84%、架构 88%、安全 92% | submit-workflow + snapshot 不可变 + 越权守卫 | 集成测绿；工单可携 snapshotId |

## 6. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 6.1 页面信息架构

| 路由 | 壳层 | 导航 | 主内容 |
|------|------|------|--------|
| `/admin/designer` | `AdminPageShell` | 分析 → 查询设计器 | 工作区：顶栏 Dataset 选择 + Tabs（条件/规则/输出）+ 右栏 SQL 预览 |
| `/admin/governance/tickets` | `AdminPageShell` | 治理 → 治理工单 | 既有 master-detail；详情区增加「创建自定义模板」入口 |

- 内容区宽度：`max-w-(--breakpoint-2xl)`（`AdminLayout` 既有）
- 密度：设计器采用 **form-composition**（`layout.md` §查询设计器）：左主表单 + 右固定预览栏（`lg:grid-cols-[1fr_360px]`）

### 6.2 状态覆盖

| 状态 | 设计器工作区 | 治理模板 |
|------|-------------|----------|
| 加载 | 各 Tab `Skeleton`；预览区 `Skeleton` 高 120px | 既有 |
| 空 | 条件「暂无过滤条件，点击添加」；规则/输出同理 | 既有 `WorkflowEmptyState` |
| 错误 | `ErrorBanner` + 重试；字段级贴输入框 | 同上 |
| 权限 | `capability: dashboard:edit`（nav 既有）；提交工单仅 admin/analyst | `RequirePlatformAdmin` |
| 提交中 | 主按钮 `disabled` + loading；预览区显示「生成中…」 | Dialog 提交 disabled |

### 6.3 视觉层级与组件映射

| 元素 | 组件 | 说明 |
|------|------|------|
| 主操作 | `Button variant="primary"` | 「保存」「提交查询服务申请」置于 `AdminPageShell.actions` 或底栏 sticky |
| 次操作 | `Button variant="outline" size="sm"` | 「校验」「添加条件/规则」 |
| 条件行 | `div` + `GripVertical` + `Select` + `Input` | 拖拽把手 `cursor-grab`；**不**新建全局 DnD 组件 |
| Tabs | `Tabs`/`TabsList`/`TabsTrigger` | 条件 / 运算规则 / 输出字段 |
| 预览卡 | `rounded-xl border bg-gray-50/80 p-4` | SQL `Textarea` `readOnly` `font-mono text-theme-xs` |
| 表格 | 页内 `table` 样式（对齐 `WorkflowTemplateDetail`） | 规则表、输出表 |
| 表单弹层 | `Dialog` + `Label` + `Select` + `Input` | 模板节点角色编辑 |
| 删除确认 | `AlertDialog` | 删除条件行、删除自定义模板 |
| 成功反馈 | `sonner` toast + `Dialog` | 提交工单成功展示 instanceId |

**禁止**：页面内手写 `<button>`；复制 SQL Lab 编辑器；新建未登记的全局 DataTable。

### 6.4 Token 与密度

- 语义色：`border-gray-200`/`dark:border-gray-800`、预览区 `bg-gray-50/80 dark:bg-white/[0.02]`
- 间距：工作区 `gap-6`；条件行 `gap-2 py-2`；预览栏 `p-4`
- 圆角：外壳 `rounded-2xl`；行内 `rounded-lg`
- 字号：预览 SQL `text-theme-xs font-mono`；表体 `text-theme-sm`
- 图标：`lucide-react` `GripVertical`/`Plus`/`Trash2`/`Send` `size-4`

### 6.5 响应式与可访问性

- `lg` 以上双栏；`<lg` 预览折叠为 Tabs 内「SQL 预览」子 Tab
- 条件列表 `overflow-x-auto`；运算符 Select `min-w-[120px]`
- 拖拽备选：每条条件「上移/下移」`aria-label`
- 预览区 `aria-live="polite"`  announce SQL 更新
- 提交 Dialog 焦点陷阱（Radix Dialog 默认）

### 6.6 视觉 QA 清单（P3/P4）

- [ ] Desktop light：双栏对齐、预览不挤压 Tabs
- [ ] Desktop dark：预览区边框/背景无漂移
- [ ] Mobile 375px：预览改子 Tab；条件行横滚
- [ ] 空/错/加载/提交中四态各 1
- [ ] 治理页自定义模板 Dialog desktop + mobile
- [ ] `cd fe && pnpm run check:design` 通过

## 7. 文档同步（P3 执行，P5 对账 PRD）

| 变更 | 文档 |
|------|------|
| 新 designer/gov 路由 | `docs/api/README.md` |
| 域边界/快照/模板 CRUD | `docs/services/designer.md`、`docs/services/governance.md` |
| DESIGN-001~004、GOV-003 验收勾选 | `docs/automate/prd/F12-DESIGN.md`、`F10-GOV.md`（P5） |
| plan F-E 五行 | `docs/automate/plan.md`（P5） |

## 8. Self-review 清单

- [x] 覆盖 round-target 五子项，无 TBD/TODO
- [x] 文件列表 18，模块 3，未引入 DESIGN-005 / GOV-004~008
- [x] 路径与代码锚点 `designer/`、`governance/` 一致
- [x] UI 设计交付完整；`ui_design_skill` 已登记
- [x] 每项含可测试验收标准
- [x] 非目标明确
