# M11 批次 2 — NoSQL/搜索连接器只读查询 + Native 执行链 + 维度指标筛选 UI

```yaml
date: 2026-07-07
milestone: M11
round_target: docs/superpowers/evolution/2026-07-07-round-target-m11-batch2.md
prd_ids: [CONN-014, CONN-015, CONN-016, QUERY-003, VIZ-005]
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
status: design
base_branch: dev-auto
```

## 1. 批量主题与子项映射

本轮为 **M11 batch1（CONN-009~013）之后的批次 2**：在已有 MongoDB/Elasticsearch/OpenSearch **L1 连通 + 元数据**（r40/r41/r34/r35/r49/r52）与 QUERY-003 **路由/守卫 L1**（r49/r52）基础上，闭合 **只读查询探测 + Native 执行出数 + Admin 图表筛选配置 UI** 三条用户可感知链路。

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | MongoDB 只读查询探测 + Native 出数 | CONN-014 | `datasources/dialects/mongodb.py` | 1 | 用户价值 **84%→≥90%**；完整度 **90%→可勾** | Admin 可选 MongoDB 建源；连通与 collection 浏览后，只读 `find` 探测与查询 API 可返回文档行 |
| 2 | Elasticsearch 只读查询探测 + Native 出数 | CONN-015 | `datasources/dialects/elasticsearch.py` | 2 | 用户价值 **84%→≥90%**；性能 **88%→只读路径** | ES 索引 mapping 可浏览；`match_all` 规模受限搜索可出数 |
| 3 | OpenSearch 只读查询探测 + Native 出数 | CONN-016 | `datasources/dialects/opensearch.py` | 3 | 用户价值 **84%→≥90%**；完整度 **90%→可勾** | OpenSearch 与 ES 独立可选；认证/版本差异不阻塞 registry |
| 4 | Native 查询双路径执行链 | QUERY-003 | `query/native/` + `query/service.py` | 4 | 用户价值 **84%→≥90%**；完整度 **90%→可勾** | `POST /query/execute` 支持 `mode=native`；与 sql/table 并列；鉴权/ACL 与 QUERY-006 一致 |
| 5 | 维度/指标/筛选配置 UI | VIZ-005 | `fe/src/components/charts/` + `chartViewConfig.ts` | 5 | 完整度 **88%→≥92%**；用户价值 **84%→≥88%** | 图表配置面板可多字段绑定维度/指标、增删筛选行；`ChartViewConfig` round-trip；Dashboard 执行链可消费 filters（sql 参数注入） |

**依赖链**：三连接器 `probe_readonly_*` + `execute_native_query` → `query/native/executor.py` 统一编排（委托 `validate_native_spec` + `pool_manager`）→ `ExecuteRequest`/`ChartViewConfig` 扩展 `mode=native` → `ChartConfigPanel` 筛选 UI + `useChartExecute` native 分支 → `tests/test_m11_batch2_r236.py` + FE vitest → r235/r52/r49 回归不删旧套件 → P5 plan §M11 五 ID 勾选 + PRD 8 维重评。

**上轮已交付（本轮不重复）**：CONN-014~016 注册、连通、元数据、错误域（r40~r52）；QUERY-003 路由/validate/readonly-guard（r49/r52）；VIZ-005 单维度/单度量 + styleVariant（r43）；batch1 CONN-009~013 只读探测范式（Influx Flux / Timescale `SELECT 1`）。

**PRD 分片锚点注记**（真理源：`round-target` > `prd.md` hub > 分片）：

| 项 | hub / round-target | 分片（部分陈旧） | 本轮处理 |
|----|-------------------|-----------------|----------|
| CONN-014~016「UI 可选」 | types catalog 已含三 type | `[ ] UI 可选` | `DatasourceFormPage` 类型切换默认端口/字段文案；catalog API 已驱动 Select，验收以 vitest smoke + 三 type 出现在 types 响应为准 |
| CONN-014~016「只读查询通过」 | batch2 闭合 | `[ ] 只读查询通过` | 连接器级 `probe_readonly_*` + `execute_native_query` + pytest mock |
| QUERY-003 | 守卫 L1 已勾 | 缺 native 执行器 | 新增 `native/executor.py` + execute API 扩展 |
| VIZ-005 | 维度/指标已勾 | `[ ] 时间范围选择` | **不纳入**（round-target + PRD 演化建议明确留后续） |
| VIZ-005 filters | round-target 要求筛选器 UI | r43 未做 filters | 本轮闭合 `filters[]` 配置 UI + sql 模式 `injectSqlParameters` 联动 |

**plan.md 状态**：M11 含 9 项 `[ ]`；本轮取前 5 项；**禁止**修改 `plan.md` / `goal.md` 结构（P5 仅勾选已有行）。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `mongodb.py` / `elasticsearch.py` / `opensearch.py` | L1 连通 + schema 浏览完整；**无**只读查询探测与出数方法 |
| `influxdb.py` / `timescaledb.py` | batch1 范式：`_probe_readonly_flux` / `probe_readonly_sql`（r235 验收参考） |
| `query/native/guard.py` | `resolve_query_mode`、`validate_native_spec`、`assert_readonly_route_guard` 完整 |
| `query/service.py` / `executor.py` | 仅 `sql` / `table` 执行；cursor/SQL 假设不适用于 document/search |
| `query/schemas.py` `ExecuteRequest` | `mode: Literal["sql","table"]`；无 native body |
| `schemas/chart_view.py` | `mode: sql|table`；`filters` 字段存在但 FE 无编辑 UI |
| `ChartConfigPanel.tsx` | 单维度/单度量 Select；无 filters；无 FieldRule 驱动的多行 |
| `useChartExecute.ts` | 仅 sql/table execute；filters 仅 sql 参数注入 |
| `DatasourceFormPage.tsx` | types 来自 API；无 type 切换默认端口/标签 |
| `docs/api/README.md` | execute 登记为 sql/table；native 仅 validate/routing |

**范围框定模块**（3）：`backend/app/datasources/` + `backend/app/query/` + `fe/src/`（图表配置 + 数据源表单）。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/datasources/dialects/mongodb.py` | CONN-014 | 修改：`probe_readonly_find` + `execute_native_query` |
| `backend/app/datasources/dialects/elasticsearch.py` | CONN-015 | 修改：`probe_readonly_search` + `execute_native_query` |
| `backend/app/datasources/dialects/opensearch.py` | CONN-016 | 修改：`probe_readonly_search` + `execute_native_query` |
| `backend/app/query/native/executor.py` | QUERY-003 | 新建：`NativeQueryExecutor.execute` |
| `backend/app/query/native/__init__.py` | QUERY-003 | 修改：导出 executor |
| `backend/app/query/schemas.py` | QUERY-003 | 修改：`ExecuteRequest` 增 `mode=native`、`nativeBody`、`index` |
| `backend/app/query/service.py` | QUERY-003 | 修改：native 分支调度 |
| `backend/app/schemas/chart_view.py` | VIZ-005 / QUERY-003 | 修改：`mode` 含 `native`；native 字段校验 |
| `fe/src/lib/chartViewConfig.ts` | VIZ-005 | 修改：`mode` + `nativeBody` + `index` 类型 |
| `fe/src/components/charts/ChartConfigPanel.tsx` | VIZ-005 | 修改：多维度/指标行 + 筛选器编辑区 |
| `fe/src/components/charts/useChartExecute.ts` | VIZ-005 / QUERY-003 | 修改：native execute body；filters 注入 |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | CONN-014~016 | 修改：type 切换默认端口与字段标签 hint |
| `tests/test_m11_batch2_r236.py` | 全部 | 新建（≥28 条断言，CONN+QUERY 合一套件） |
| `fe/src/components/charts/charts.advanced.smoke.test.tsx` | VIZ-005 | 修改：filters + 多字段 vitest |
| `fe/src/lib/chartViewConfig.test.ts` | VIZ-005 | 修改：native mode + filters round-trip |
| `docs/api/README.md` | QUERY-003 | 修改：execute 登记 native 模式 |
| `docs/services/datasources.md` | CONN-014~016 | 修改：只读探测 + native 出数笔记 |
| `docs/services/query.md` | QUERY-003 | 修改：native 执行链 In/Out 边界更新 |

**真理源优先级**：`round-target` > `prd.md` hub + 分片 > `docs/services/` > `docs/api/README.md`。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/datasources/dialects/
├── mongodb.py          # +probe_readonly_find, +execute_native_query
├── elasticsearch.py    # +probe_readonly_search, +execute_native_query
└── opensearch.py       # +probe_readonly_search, +execute_native_query

backend/app/query/
├── native/
│   ├── guard.py        # 只读（回归）
│   └── executor.py     # 新建：NativeQueryExecutor
├── schemas.py          # ExecuteRequest.mode=native
└── service.py          # dispatch native

fe/src/
├── lib/chartViewConfig.ts
├── components/charts/
│   ├── ChartConfigPanel.tsx    # 多字段 + filters
│   └── useChartExecute.ts      # native + filter inject
└── pages/admin/datasources/DatasourceFormPage.tsx

tests/test_m11_batch2_r236.py
```

### 3.2 方案比选（QUERY-003 执行链）

| 方案 | 描述 | 结论 |
|------|------|------|
| **A 集中 NativeQueryExecutor + 连接器钩子** | `executor.py` 校验 → 取连接 → `connector.execute_native_query(conn, spec, limit)` | **采用** — 与 batch1 `probe_readonly_*` 对称；guard 复用；易 mock 单测 |
| B 执行逻辑散落各 dialect | 无集中 executor，service 直接调 dialect | 否决 — 重复 ACL/限额/序列化 |
| C 通用 DSL 翻译层 | body→中间计划→出数 | 否决 — 超出 L1；触犯 M13 DESIGN-* 边界 |

### 3.3 CONN-014 — MongoDB 只读查询

**文件**：`mongodb.py`（修改）

| 方法 | 契约 |
|------|------|
| `probe_readonly_find(connection, *, database: str, collection: str) -> bool` | `find({}, projection={"_id":1}).limit(1)`；空库/collection 名非法 → `False`（不 500） |
| `execute_native_query(connection, *, body: dict, limit: int) -> tuple[list[str], list[list]]` | body 必填键：`collection`（str）；可选 `database`（默认 datasource.database）、`filter`（dict，默认 `{}`）、`projection`（dict，默认排除 `_id` 外顶层键或 `{}`） |
| 列推导 | 首行文档 keys 排序为 columns；嵌套 dict/list → `json` 字符串序列化（复用 `_serialize_cell` 语义） |
| 限额 | `min(limit, settings.query_default_limit)`；`find().limit(limit+1)` 判 `truncated` |
| 守卫 | 拒绝 body 含 `$where`、`mapReduce`、`$out`、`$merge` 键（委托 `guard_native_injection` 扩展或本地前缀检查） |

**错误码**：复用 `MONGODB_*`；未知 collection → `QUERY_TABLE_NOT_FOUND`；执行失败 → `QUERY_EXECUTION_ERROR`。

**pytest（mock pymongo）**：`T-CONN-R236-014-01` catalog 含 mongodb；`02` probe True；`03` probe 空 collection False；`04` execute 返回列行；`05` `$where` body → 422。

### 3.4 CONN-015 — Elasticsearch 只读查询

**文件**：`elasticsearch.py`（修改）

| 方法 | 契约 |
|------|------|
| `probe_readonly_search(connection, *, index: str) -> bool` | `search(index, body={"query":{"match_all":{}},"size":1})`；空 index → False |
| `execute_native_query(connection, *, body: dict, index: str \| None, limit: int)` | `index` 优先参数 `index`，其次 body.index；`body` 必须含 `query` 对象；合并 `size=min(limit+1, cap)` |
| 列推导 | hits[0]._source 顶层 keys；无 hit → 空 columns/rows |
| 凭证 | 日志/API 响应不泄露 password（回归 r35） |

**pytest**：`T-CONN-R236-015-01~05` 对称 ES；多索引 index 参数；401 → `ES_AUTH_FAILED` 映射不变。

### 3.5 CONN-016 — OpenSearch 只读查询

**文件**：`opensearch.py`（修改）

与 CONN-015 **共享搜索 API 模式**；差异：

| 差异点 | 处理 |
|--------|------|
| 客户端 | `opensearchpy.OpenSearch`；`http_auth` 非 `basic_auth` |
| 错误映射 | 继续 `map_opensearch_error` |
| registry | `type=opensearch` 与 `elasticsearch` 并存，无冲突 |

**pytest**：`T-CONN-R236-016-01~05`；`06` 与 ES 同 body 时 opensearch connector 独立 type。

### 3.6 QUERY-003 — Native 执行链

**新建**：`backend/app/query/native/executor.py`

```python
class NativeQueryExecutor:
    def execute(
        self, session, user, data_source_id, *,
        body: dict, index: str | None, limit: int, offset: int = 0,
    ) -> QueryResult: ...
```

**执行步骤**（可测试）：

1. `_load_row` + `assert_visible`（与 sql 路径一致）
2. `resolve_query_mode(row.type)` 必须为 `native`，否则 `QUERY_NATIVE_WRONG_MODE`
3. 构造 `NativeQuerySpec(connector_type=row.type, body=body, index=index)` → `validate_native_spec`
4. `pool_manager.pooled_connection` → 按 type 分派：
   - `mongodb` → `MongodbConnector.execute_native_query`
   - `elasticsearch` → `ElasticsearchConnector.execute_native_query`
   - `opensearch` → `OpensearchConnector.execute_native_query`
   - 其他 native category（influx/tdengine 等）→ **本轮不实现 execute**，返回 `QUERY_NATIVE_EXECUTE_UNSUPPORTED`（422）；仅闭合本批三连接器，避免 scope 膨胀
5. 序列化 cells；`offset` L1 **仅对 mongodb skip 实现**（`skip(offset).limit`）；ES/OS 忽略 offset 或返回 `QUERY_NATIVE_OFFSET_UNSUPPORTED`（422）— **显式选后者**，避免静默错误
6. RLS：native L1 **不注入 SQL RLS**；仅数据源 ACL（与 `docs/services/query.md` r49 注记一致）；`apply_rls=false` 时 development 可关（沿用现有 `RlsOptions`）

**`ExecuteRequest` 扩展**：

```python
mode: Literal["sql", "table", "native"] | None = None
native_body: dict[str, Any] | None = Field(default=None, alias="nativeBody")
index: str | None = None  # ES/OS
```

校验：`mode=native` 时要求 `dataSourceId` + 非空 `nativeBody`；禁止同时传 `sql`/`schema`/`table`（`QUERY_NATIVE_SQL_DISGUISE` 对称错误）。

**API**：`POST /api/v1/query/execute` 行为扩展；`docs/api/README.md` 更新描述为「sql/table/native」。

**pytest**：`T-QUERY-R236-003-01` opensearch native execute mock 200 列行；`02` mysql native → 422；`03` empty body → 422；`04` sql+nativeBody → 422；`05` ACL 403 回归；`06` probe routing <50ms 回归；`07` chart binding 不受影响。

### 3.7 VIZ-005 — 维度/指标/筛选配置 UI

**类型扩展**（`chartViewConfig.ts` + `schemas/chart_view.py`）：

```typescript
mode?: "sql" | "table" | "native";
nativeBody?: Record<string, unknown>;
index?: string;
// filters 已有 ChartFilterRef[]
```

后端 `ChartViewConfig`：`mode=native` 时要求 `nativeBody`；禁止 `sql`；`index` 对 search category 可选推荐。

**ChartConfigPanel 改造**：

| 区块 | 行为 |
|------|------|
| 维度 | 按 `fieldRule.minDimensions..maxDimensions` 渲染 N 行 Select；不足 min 显示 inline hint；「添加维度」按钮至 max |
| 指标 | 同上（metrics） |
| 筛选器 | 可增删行：字段 Select + 运算符 Select（eq/neq/gt/gte/lt/lte/in）+ 值 Input；`in` 用逗号分隔；最多 16 行 |
| 查询模式提示 | 当 `columns` 来自 search/document 源，展示只读文案「该数据源使用 Native 查询模式」（不强制切换 mode，由 Widget 绑定方设置） |
| 校验 | 保留「校验配置」→ `POST /charts/validate`；字段级错误贴控件下 |

**useChartExecute**：

- `mode=native`：`POST /query/execute` body 含 `mode:"native"`, `nativeBody`, `index`
- `mode=sql` 且 `config.filters.length`：将 filters 转为 `filterParameters` 注入 SQL（扩展现有 `injectSqlParameters` 或新增 `buildFilterParameters`）；运算符映射为命名参数
- native 模式 filters L1：**写入 config 但不传给 execute**（文档注明；避免未定义的 ES query DSL 拼接）；验收以 config round-trip + sql 模式 filter 注入为准

**DatasourceFormPage**（CONN UI 可选闭合）：

```typescript
const CONNECTOR_FIELD_HINTS: Record<string, { port: string; databaseLabel: string; usernameLabel: string }> = {
  mongodb: { port: "27017", databaseLabel: "认证库", usernameLabel: "用户名" },
  elasticsearch: { port: "9200", databaseLabel: "默认索引（可选）", usernameLabel: "用户名" },
  opensearch: { port: "9200", databaseLabel: "默认索引（可选）", usernameLabel: "用户名" },
};
```

`onValueChange(type)` 时若 hints 存在则更新默认 port 与 Label 文案（不覆盖用户已填 host）。

## 4. UI 设计交付

**ui_design_skill**: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### 4.1 页面信息架构

| 表面 | 导航 | 主内容区 | 状态 |
|------|------|----------|------|
| 图表配置（`ChartRenderer` config 模式） | Admin → Dashboard 编辑 → Widget 配置侧栏 | `lg:grid-cols-2`：左配置卡片、右预览；卡片 `max-w` 随栅格，非全屏空白 | 空 columns → Select 禁用 +「请先执行查询或选择数据源」；校验中按钮 loading |
| 数据源表单 | Admin → 数据源 → 新建/编辑 | `AdminPageShell` + `Card max-w-2xl` 居中 | 类型加载 Skeleton；保存失败 `border-error` alert |

### 4.2 视觉层级

- **主操作**：「校验配置」「保存数据源」— `Button variant="primary" h-11 rounded-lg`
- **次操作**：「添加维度/指标/筛选」「删除行」— `Button variant="outline" size="sm"` 或 `ghost` + `Trash2` icon
- **承载**：筛选器各行 `rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2` 子卡片，避免与主卡片竞争
- **错误**：字段下 `text-theme-sm text-error-600`；全局 `role="alert"` 保留 r43 模式

### 4.3 组件映射

| 需求 | 复用 | 新建/扩展 |
|------|------|-----------|
| 字段选择 | `@/components/ui/select` | — |
| 筛选值输入 | `@/components/ui/input` + `Label` | — |
| 增删行 | `@/components/ui/button` | `ChartConfigPanel` 内局部 `FilterRow` 子块（不单独文件，≤300 行纪律） |
| 页面壳 | `AdminPageShell`、`Card` | — |
| 禁止 | 手写 `<button>`/`<input>` | — |

### 4.4 Token 与密度

- 间距：`space-y-4` 区块、`gap-2` 表单项（对齐 r43 `ChartConfigPanel`）
- 圆角：`rounded-lg` 输入/按钮、`rounded-xl` 外卡片
- 字号：`text-theme-sm` 辅助说明、`Label` 默认
- 色：错误 `error-600`/`error-50`；禁用 Select `opacity-50`
- 图标：`lucide-react` `Plus`/`Trash2` `size-4`

### 4.5 响应式与可访问性

- 筛选行：`sm:grid-cols-3` 字段/运算符/值；窄屏堆叠
- 每 Select `aria-label` 含序号（「筛选字段 1」）
- 删除按钮 `aria-label="删除筛选条件 1"`
- 长字段名 Select：`truncate` + `title` tooltip

### 4.6 视觉 QA 清单

| 检查项 | desktop | mobile |
|--------|---------|--------|
| 配置面板双列变单列 | 1280px 截图 | 375px 截图 |
| 3 条筛选行对齐 | 是 | 堆叠无重叠 |
| 校验错误贴字段 | 是 | 是 |
| dark 模式边框对比 | `dark:border-gray-800` | 同左 |
| MongoDB 类型默认端口 27017 | 表单截图 | — |

P4：`check:design` PASS + vitest smoke；headless 截图可选，不可运行须记录原因。

## 5. 验收标准（可测试）

### CONN-014

- [ ] `probe_readonly_find` mock 返回 True；空 collection False
- [ ] `execute_native_query` mock 返回 ≥1 列 ≥0 行；`limit`  respected
- [ ] `$where` / 写操作键拒绝
- [ ] types catalog + HTTP test_connection 回归 r41 不回归

### CONN-015

- [ ] `probe_readonly_search` mock True
- [ ] `execute_native_query` mock hits 转置为 columns/rows
- [ ] 凭证不出现在 test 响应日志

### CONN-016

- [ ] 与 015 对称；`opensearch` type 独立
- [ ] `map_opensearch_error` 回归 r52

### QUERY-003

- [ ] `POST /query/execute` `mode=native` opensearch/mongodb/elasticsearch 各 1 条 mock 200
- [ ] mysql + native → 422 `QUERY_NATIVE_WRONG_MODE`
- [ ] `validate_native_spec` / `readonly-guard` / `routing/modes` r52 回归全绿
- [ ] `docs/api/README.md` execute 行更新

### VIZ-005

- [ ] `ChartConfigPanel` 可添加/删除筛选行；`onChange` 产出含 `filters`
- [ ] FieldRule 驱动维度行数（funnel min metrics 校验文案回归）
- [ ] `chartViewConfig.test.ts` native + filters 类型守卫
- [ ] `pnpm run check:design` PASS
- [ ] vitest `charts.advanced.smoke.test.tsx` 新增 ≥2 用例 PASS

## 6. 非目标（明确不做）

- VIZ-007 SDK 嵌入、CAT-004~006 分类 handler（批次 3）
- M13 冻结：CONN-017~022、QUERY-009 Dataset 路径、DESIGN-* 设计器
- GridFS、ES 集群管理/ILM、OpenSearch Dashboards 嵌入
- GraphQL / 自定义 DSL 设计器
- Native 模式 RLS SQL 注入、ES query DSL 自动拼接 filters
- Influx/TDengine native **execute**（仅本批三连接器；其余保持 validate-only）
- 时间范围选择器（VIZ-005 PRD 留后续）
- Alembic 迁移（无新表）
- compose 全量 E2E（可 `@pytest.mark.integration` skip）

## 7. PRD 8 维薄弱项对齐

| ID | 本轮闭合 | 验证方式 |
|----|----------|----------|
| CONN-014~016 | 用户价值：三源可建可测可查；完整度：只读查询勾选项 | pytest + Admin types Select vitest |
| QUERY-003 | 用户价值：NoSQL 出数；完整度：双路径执行勾选项 | execute API mock + service 单测 |
| VIZ-005 | 完整度：筛选器 UI；用户价值：配置可感知保存 | vitest + validate API round-trip |

## 8. 测试策略

- **套件**：`tests/test_m11_batch2_r236.py`（CONN `T-CONN-R236-*` + QUERY `T-QUERY-R236-*`）
- **FE**：`charts.advanced.smoke.test.tsx`、`chartViewConfig.test.ts`
- **回归**：`test_connectors_m11_r235.py`、`test_design_conn_gov_query_r52.py`、`test_design_conn_gov_query_r49.py` 全绿
- **性能 smoke**：`probe_list_routing_modes` <50ms；`probe_opensearch_metadata_budget_ms` 回归

## 9. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| native execute | `docs/api/README.md`、`docs/services/query.md` |
| 三连接器只读 | `docs/services/datasources.md` |
| VIZ filters UI | `docs/automate/prd/F06-VIZ.md` 验收勾选（P5） |
| plan M11 五项 | `docs/automate/plan.md` 勾选（P5） |

## 10. Spec self-review

- [x] 覆盖 round-target 五 ID
- [x] 文件列表 18 ≤ 20
- [x] 无 TBD/TODO 占位
- [x] UI 设计交付完整；`ui_design_skill` 已声明
- [x] 非目标与 batch3/M13 边界清晰
- [x] native offset/RLS/filter 语义无歧义
