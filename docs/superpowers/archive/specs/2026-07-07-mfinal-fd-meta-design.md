# M-FINAL F-D 语义层元数据收官（META-001~004）设计

```yaml
date: 2026-07-07
milestone: M-FINAL · F-D
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fd-meta.md
prd_ids: [META-001, META-002, META-003, META-004]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
base_branch: dev-auto
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:----:|------------|----------|
| 1 | 术语字典 CRUD 收官 + 写鉴权 | META-001 | `metadata/glossary/` | 1 | 用户价值 **82%**；安全性 **88%** | Admin 可增删改术语；viewer 写操作被拒；列表 P95 可控 |
| 2 | 业务主题树 CRUD + 术语关联 + 树导航 UI | META-002 | `metadata/themes/` + `fe/metadata/` | 2 | 用户价值 **84%**；安全性 **88%** | Admin 可维护层级主题并关联术语；树形浏览与移动 |
| 3 | 维度字典注册 + 主题关联校验 | META-003 | `metadata/dimensions/` | 3 | 性能 **88%**；用户价值 **84%** | 维度可注册并可选绑定主题节点；重复编码拦截 |
| 4 | Dataset 全量 CRUD + QUERY 链集成 | META-004 | `metadata/dataset/` + `query/` + `fe/datasets/` | 4 | 用户价值 **84%**；完整度 **90%** | Dataset 可创建/编辑/删除；绑定查询配置后可出数 |

**依赖链**：META-001 写守卫 → META-002 术语 FK 已有、补写守卫与树 UI → META-003 主题 FK + 写守卫 → META-004 PUT/DELETE + bind-config + 集成测 → `test_mfinal_fd_meta_r244.py` 全绿 → r243/r33 回归 → docs 同步 → plan F-D 四行可勾选。

**上轮已交付（本轮不重复 L1 骨架）**：

- r32/r33：`GlossaryTerm`/`ThemeNode` migration 0015、术语/主题 CRUD + r33 边界 pytest
- r38/r39：`DimensionDict` migration 0016、维度 values 校验链
- r59/r66：Dataset 内存 store list/create/get/validate + viewer ACL + perf probe
- r243：QUERY-007~009 `dataset_query` 存储→翻译→执行链（**未**串联 `/api/v1/datasets` 实体）
- FE：`MetadataHubPage` 只读列表、`DatasetListPage` 仅 create

**本轮性质**：F-D **批次 2 收官**（补缺 + companion 闭合 + Admin CRUD UI），非 ORM Dataset 四期全量、非物理字段映射、非 DESIGN/GOV。

## 2. 范围框定

### 2.1 模块（3）

| 模块 | 路径 | 职责 |
|------|------|------|
| metadata | `backend/app/metadata/` | 术语/主题/维度/Dataset 域服务与模型 |
| query | `backend/app/query/config_store/` | Dataset↔config 绑定校验（只读依赖 metadata） |
| fe 壳层 | `fe/src/pages/admin/metadata/` · `fe/src/pages/admin/datasets/` | 语义层 Admin CRUD UI |

### 2.2 文件列表（18）

| 文件 | 子项 | 变更 |
|------|------|------|
| `backend/app/metadata/glossary/service.py` | META-001 | 写 ACL（admin/analyst）、`probe_list_terms_budget_ms` |
| `backend/app/metadata/glossary/schemas.py` | META-001 | `META_TERM_FORBIDDEN` 错误码导出 |
| `backend/app/metadata/themes/service.py` | META-002 | 写 ACL、`probe_list_themes_budget_ms` |
| `backend/app/metadata/themes/schemas.py` | META-002 | `META_THEME_FORBIDDEN` |
| `backend/app/metadata/dimensions/models.py` | META-003 | 可选 `theme_node_id` FK → `theme_nodes.id` |
| `backend/app/metadata/dimensions/schemas.py` | META-003 | `themeNodeId` 入参/出参 |
| `backend/app/metadata/dimensions/service.py` | META-003 | 主题存在性校验、写 ACL、`probe_list_dimensions_budget_ms` |
| `backend/migrations/versions/0017_dimension_theme_node.py` | META-003 | Alembic：维度可选关联主题 |
| `backend/app/metadata/dataset/service.py` | META-004 | `update_dataset`/`delete_dataset`/`bind_query_config` |
| `backend/app/metadata/dataset/schemas.py` | META-004 | `boundConfigId`、Update DTO |
| `backend/app/api/v1/datasets.py` | META-004 | PUT/DELETE/`POST …/bind-query-config` |
| `backend/app/api/v1/metadata.py` | META-001~003 | 写路由注入 `UserContext` 并下传 service |
| `tests/test_mfinal_fd_meta_r244.py` | 全部 | 新建 ≥28 条 F-D 收官 pytest |
| `fe/src/pages/admin/metadata/MetadataHubPage.tsx` | META-001~003 | 拆分子面板、CRUD 对话框 |
| `fe/src/pages/admin/metadata/metadata-panels.tsx` | META-001~003 | 术语表/主题树/维度表可复用块（≤300 行） |
| `fe/src/pages/admin/datasets/DatasetListPage.tsx` | META-004 | 编辑/删除 + bind 提示 |
| `docs/api/README.md` | 全部 | 新路由登记 |
| `docs/services/metadata.md` | 全部 | 域边界、错误码、F-D 状态 |

**真理源优先级**：`round-target` > `prd.md` hub + `F11-META.md` > `docs/services/metadata.md` > `docs/api/README.md`。

### 2.3 非目标（明确不做）

- 术语→物理字段映射（PRD META-001 远期项）
- Dataset ORM/Alembic 持久化、DE/SS 全量对标、计算字段执行引擎（META-004 远期）
- M4/M5/M6 维度统一引用、GOV catalog 释放
- F-E 设计器（DESIGN-*）、F-G 连接器（CONN-023~027）、F-F NFR
- `query/translator` 方言扩展、`design/`、`gov/` 模块
- 修改 `docs/automate/goal.md` 或 `plan.md` 结构（P5 仅勾选 `- [ ] META-00x` 行）

## 3. 架构设计

### 3.1 共享写鉴权契约（META-001~003）

对齐 `physical/service.py` 与 `dataset/service.py` r66 模式：

| 角色 | 读 | 写（POST/PUT/DELETE/move/register values） |
|------|----|---------------------------------------------|
| admin, analyst | 允许 | 允许 |
| editor | 允许 | **拒绝** 403 `META_*_FORBIDDEN` |
| viewer | 允许 | **拒绝** 403 |
| enterprise | 允许 | **拒绝**（本轮不引入 enterprise 前缀 scope；维度/术语无租户字段） |

实现：`metadata/_acl.py` 私有模块（单函数 `_assert_meta_write(user: UserContext) -> None`），glossary/themes/dimensions service 写入口首行调用；**禁止**在 `api/v1/metadata.py` 复制逻辑。

列表性能探针（闭合 META-003 性能维）：

- `probe_list_terms_budget_ms` / `probe_list_themes_budget_ms` / `probe_list_dimensions_budget_ms`
- 预算 **≤50ms**（内存/SQLite 单测环境，与 r66 dataset probe 一致）

### 3.2 META-001 — 术语字典

#### 方案比选

| 方案 | 说明 | 结论 |
|------|------|------|
| A 巩固现有 ORM + 写 ACL + Admin 对话框 CRUD | 最小增量 | **采用** |
| B 新增术语分类/同义词子表 | 超 PRD plan 验收 | 否决 |
| C 租户隔离列 | 无 SRS 合同 | 否决 |

#### 增量要点

- `create_term`/`update_term`/`delete_term` 增加 `user: UserContext` 参数与写 ACL
- 既有校验保持：`META_TERM_INVALID_NAME`、`META_TERM_INVALID_STATUS`、`META_TERM_CODE_CONFLICT`、`META_TERM_IN_USE`（主题引用）
- API entry：POST/PUT/DELETE glossary 路由传入 `actor`
- **不新增** HTTP 路由

#### 可测试验收标准

1. admin POST 合法术语 → 201 + `code` 回显
2. viewer POST → 403 `META_TERM_FORBIDDEN`
3. 空白 `name` → 422 `META_TERM_INVALID_NAME`
4. 删除被主题引用的术语 → 409 `META_TERM_IN_USE`
5. `probe_list_terms_budget_ms().ok is True`
6. Admin UI：术语 Tab 可新建/编辑/删除；字段错误贴输入框；成功 toast

### 3.3 META-002 — 业务主题树

#### 方案比选

| 方案 | 树 UI | 结论 |
|------|-------|------|
| A 单页 Tabs + 左侧缩进列表（parent 过滤 + 展开） | 轻量，无新依赖 | **采用** — M-FINAL 预览密度 |
| B 专用 `/metadata/themes` 全屏树组件 + DnD | 体验好但超文件预算 | 否决（留 F-E） |
| C 仅 API 不测 UI | 违背 round-target Admin 感知 | 否决 |

#### 增量要点

- 写 ACL 覆盖 `create_theme_node`/`update_theme_node`/`delete_theme_node`/`move_theme_node`
- 术语关联：**保持** `term_id` FK；create/update 未知 term → 404（已有）
- pytest 边界（r33 补充）：空树 list、深度 8 拒绝、move 成环、删有子节点 409
- FE 主题 Tab：根节点 `?parent_id=null` 加载；子级点击行展开；「新建子节点」Dialog 含可选术语 Select（`GET /glossary` 前 100 条）；移动父节点用 Select

#### 可测试验收标准

1. 创建根节点 + 子节点 → GET list 按 parent 过滤正确
2. `term_id` 指向不存在术语 → 404
3. move 至子孙 → 422 `META_THEME_CYCLE`
4. viewer POST themes → 403 `META_THEME_FORBIDDEN`
5. Admin UI：主题 Tab 可浏览层级、新建、移动（Dialog）、删除叶节点

### 3.4 META-003 — 维度字典注册

#### 方案比选

| 方案 | 主题关联 | 结论 |
|------|----------|------|
| A 可选 `theme_node_id` FK（migration 0017） | 与 META-002 对称 | **采用** |
| B JSON `tags[]` 软关联 | 难测、无 FK | 否决 |
| C 仅文档声明关联 | 不满足 round-target「引用校验」 | 否决 |

#### 增量要点

- migration 0017：`dimension_dicts.theme_node_id` nullable FK `theme_nodes.id` ON DELETE SET NULL
- `DimensionCreate`/`DimensionUpdate` 增加可选 `themeNodeId`；非空时 `themes_service.get_theme_node` 校验
- 写 ACL + `probe_list_dimensions_budget_ms`
- values 注册链 **不变**（r39 已闭合）
- FE 维度 Tab：新建/编辑 Dialog 含可选「所属主题」Select；列表增加主题名列（无则「—」）

#### 可测试验收标准

1. 合法维度 + 合法 themeNodeId → 201
2. 非法 themeNodeId → 404 `META_THEME_NOT_FOUND`
3. 重复 code → 409 `META_DIM_CODE_CONFLICT`
4. list `limit=500` 边界与 r39 一致
5. viewer POST dimension → 403 `META_DIM_FORBIDDEN`
6. Admin UI：维度 CRUD + 枚举值注册入口（Dialog 批量粘贴 code/label，POST values）

### 3.5 META-004 — Dataset CRUD + QUERY 链

#### 方案比选

| 方案 | 持久化 | QUERY 衔接 | 结论 |
|------|--------|------------|------|
| A 内存 store + PUT/DELETE + `bind_query_config` | 延续 r59/r66 | configId 存于 dataset 记录 | **采用** |
| B Alembic Dataset 表 | 超本轮预算 | — | 否决 |
| C 仅文档声明衔接 | 无集成测 | 否决 |

#### 增量要点

**Dataset 服务**（`dataset/service.py`）：

- `update_dataset(dataset_id, payload, user)`：写 ACL + `_validate_body` + 409 冲突表名
- `delete_dataset(dataset_id, user)`：写 ACL；若 `boundConfigId` 非空仍允许删除（仅清绑定，不删 query config）
- `bind_query_config(dataset_id, config_id, user)`：
  - 断言 dataset 存在
  - 断言 `get_config_by_id(config_id)` 存在且 `config_type == "dataset_query"`
  - 写回 `boundConfigId` 至内存 record
- `DatasetItemOut` 增加 `boundConfigId: UUID | null`

**API**（`api/v1/datasets.py`）：

| Method | Path | 说明 |
|--------|------|------|
| PUT | `/api/v1/datasets/{dataset_id}` | 全量更新 |
| DELETE | `/api/v1/datasets/{dataset_id}` | 204 |
| POST | `/api/v1/datasets/{dataset_id}/bind-query-config` | body `{ "configId": "<uuid>" }` |

**QUERY 衔接**：不修改 translator/executor；集成测显式四步：

```
POST /api/v1/datasets          → datasetId
PUT  /api/v1/query/configs     → configId (dataset_query)
POST /api/v1/datasets/{id}/bind-query-config
POST /api/v1/query/dataset/execute (mock QueryExecutor) → rows 非空
```

**RLS/鉴权**：写操作复用 r66 `_assert_dataset_write_access`；execute 路径继续 `assert_config_readable` + DS ACL（r243 已测，r244 回归 1 条）。

#### 可测试验收标准

1. PUT 更新 displayName/tables → 200
2. DELETE 后 GET → 404 `META_DATASET_NOT_FOUND`
3. viewer PUT → 403 `META_DATASET_FORBIDDEN`
4. bind 非 dataset_query config → 422 `META_DATASET_CONFIG_TYPE_INVALID`
5. bind 后 record.`boundConfigId` 与请求一致
6. 全链集成测（mock execute）→ rowCount ≥ 1
7. Admin UI：列表行操作「编辑」「删除」；编辑 Dialog 含表名/计算字段 JSON 简表；删除走 `AlertDialog`

## 4. 测试策略

### 4.1 新套件 `tests/test_mfinal_fd_meta_r244.py`

| 区块 | 用例 ID 前缀 | 条数 | 覆盖 |
|------|-------------|------|------|
| META-001 | `T-META-R244-001-*` | ≥6 | ACL、CRUD、IN_USE、probe |
| META-002 | `T-META-R244-002-*` | ≥7 | 树 CRUD、move、depth、ACL |
| META-003 | `T-META-R244-003-*` | ≥7 | theme FK、values、ACL、probe |
| META-004 | `T-META-R244-004-*` | ≥8 | PUT/DELETE、bind、全链、ACL |

**夹具**：module-scoped SQLite（复用 r32/r243 模式）；`import app.metadata.glossary.models` 等确保 metadata 表；JWT `jwt_auth_headers()`；viewer/admin fixture override。

### 4.2 回归门控

- `test_mfinal_fd_meta_r244.py` 全绿
- `test_mfinal_fd_r243.py` 全量回归（QUERY 链不退化）
- `test_meta_design_r33.py` 抽样或全量（glossary/themes 边界）
- `cd backend && ruff check` 相关路径

## 5. PRD 8 维薄弱项对齐

| ID | 薄弱维 | 本轮闭合动作 | 验收信号 |
|----|--------|-------------|----------|
| META-001 | 用户价值 82%、安全 88% | Admin 术语 CRUD UI + viewer 写拒绝 + list probe | FE 可操作；403 + probe ≤50ms |
| META-002 | 用户价值 84%、安全 88% | 主题树层级 UI + 术语 Select + 写 ACL | 树浏览/移动；403 |
| META-003 | 性能 88%、用户价值 84% | theme FK + list probe + 维度 Admin CRUD | probe ≤50ms；可选主题绑定 |
| META-004 | 用户价值 84%、完整度 90% | PUT/DELETE + bind + 四步集成测 + Dataset 编辑 UI | plan 行可勾选；集成测绿 |

## 6. UI 设计交付

`ui_design_skill`: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 6.1 页面信息架构

| 路由 | 壳层 | 导航 | 主内容 |
|------|------|------|--------|
| `/admin/metadata` | `AdminPageShell` | 语义层 → 元数据 | Tabs：术语字典 / 业务主题 / 维度字典 |
| `/admin/metadata/glossary` | 同上 | 深链到术语 Tab | 与 hub 同页，默认 glossary Tab |
| `/admin/datasets` | `AdminPageShell` + 主操作区 | 语义层 → Dataset | 表格列表 + 新建/编辑 Dialog |

- 内容区宽度：`max-w-(--breakpoint-2xl)`（`AdminLayout` 既有）
- 密度：表格 `text-theme-sm`、表头 `bg-gray-50`、卡片 `rounded-xl border shadow-theme-sm`

### 6.2 状态覆盖

| 状态 | 术语/维度 | 主题树 | Dataset |
|------|-----------|--------|---------|
| 加载 | `Skeleton` 行 | 同上 | 同上 |
| 空 | 「暂无数据」居中 | 「暂无主题节点」 | 「暂无 Dataset」 |
| 错误 | `ErrorBanner` + 重试 | 同上 | 同上 |
| 权限 | `RequirePlatformAdmin` 路由守卫 | 同上 | 同上 |

### 6.3 视觉层级与组件映射

| 元素 | 组件 | 说明 |
|------|------|------|
| 主操作 | `Button variant="primary"` | 「新建术语/主题/维度/Dataset」置于 `AdminPageShell.actions` |
| 次操作 | `Button variant="outline" size="sm"` | 行内编辑、重试 |
| 表格 | 页内 `table` + `ui/table` 样式类 | **不**新建全局 DataTable；抽 `metadata-panels.tsx` 共享 `MetaDataTable` 薄封装 |
| 表单弹层 | `Dialog` + `Label` + `Input` + `Select` | 字段级 `aria-invalid`；提交中 disabled |
| 删除确认 | `AlertDialog` | 术语/主题/维度/Dataset 删除 |
| 状态标签 | `Badge variant="light"` | 术语/维度 status |
| 主题层级 | 缩进 `pl-{depth*4}` + `font-medium` | 不用大面积空白 Card 堆叠 |

**禁止**：页面内手写 `<button>`/原生表格样式；复制 RLS 页以外的新配色。

### 6.4 Token 与密度

- 语义色：`border-gray-200`/`dark:border-gray-800`、`text-gray-600` 表头、`text-error-*` 错误横幅
- 间距：Tab 内容 `mt-6 space-y-4`；Dialog 字段 `gap-4`
- 圆角：`rounded-xl` 表格外壳；`rounded-lg` 输入
- 字号：`text-theme-sm` 表体、`text-theme-xs font-mono` 编码列
- 图标：`lucide-react` `Plus`/`Pencil`/`Trash2` `size-4`

### 6.5 响应式与可访问性

- 表格 `overflow-x-auto` + `min-w-[640px]`
- Dialog 窄屏全宽 `sm:max-w-lg`
- 所有图标按钮 `aria-label`（「编辑术语」「删除 Dataset」）
- 主题树键盘：Tab 焦点顺序 过滤框 → 列表 → 操作按钮
- 长文本：`definition` 列 `max-w-xs truncate` + `title` 悬停全文

### 6.6 视觉 QA 清单（P3/P4）

- [ ] Desktop light：三 Tab 列表对齐、操作列不挤压
- [ ] Desktop dark：边框/表头对比度无漂移
- [ ] Mobile 375px：表格横滚、Dialog 不溢出视口
- [ ] 空/错/加载三态截图各 1
- [ ] `cd fe && pnpm run check:design` 通过

## 7. 文档同步（P3 执行，P5 对账 PRD）

| 文档 | 动作 |
|------|------|
| `docs/api/README.md` | 登记 PUT/DELETE datasets、`bind-query-config` |
| `docs/services/metadata.md` | F-D 收官状态、`*_FORBIDDEN` 错误码、`theme_node_id`、bind 契约 |
| `docs/automate/prd/F11-META.md` | **P5** 勾选 plan 对齐项、更新演化建议 |
| `docs/ui/layout.md` | 仅当新增子路由行为变化时评估（预计无需改 IA） |

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Dataset 内存 store 进程间不共享 | 文档注明 L1；集成测同进程；与 r66 一致 |
| `MetadataHubPage` 超 300 行 | 抽 `metadata-panels.tsx` |
| migration 0017 与现有库漂移 | pytest module fixture `create_all` + alembic 双路径注释 |
| config `refId` UUID 与 `datasetId` 字符串异构 | bind 端点显式关联，不要求 refId == datasetId |

## 9. Spec self-review

- [x] 覆盖 round-target 四子项全部验收标准
- [x] 18 文件范围内，未扩及 F-E/F-G
- [x] 无 TBD/TODO 占位
- [x] UI 设计交付完整，ui_design_skill 已声明
- [x] 架构与 PRD 部分实现状态一致（补缺非重写 L1）
