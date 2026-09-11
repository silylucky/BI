---
id: 2026-07-07-mfinal-fg-finish
phase: P1_DONE
prd_ids: [CONN-027, API-001, VIZ-003, VIZ-004, VIZ-008]
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fg-finish.md
batch_theme: M-FINAL F-G 收官（CONN-027 AWS Redshift）+ companion 补强（API-001 性能、VIZ-003/004/008 渲染层）
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
created_at: 2026-07-07
---

# 设计文档：M-FINAL F-G 收官 + VIZ/API companion 补强

> **批量主题**：F-G #5 闭合（CONN-027 AWS Redshift，M-FINAL 最后一项 plan `[ ]`）+ hub 薄弱项 companion 补强（API-001 性能、VIZ-003/004/008 渲染层质量）

---

## 一、批量主题与子项映射

| # | PRD ID | 类型 | 主题 | 主攻薄弱维 |
|---|--------|------|------|-----------|
| 1 | CONN-027 | 补缺（新实现） | AWS Redshift 方言注册 + 连通链 + 只读守卫 | 完整度 84%→实现 |
| 2 | API-001 | companion 补强 | 数据源 API P95 基准断言 + 结构化错误可定位 | 性能 86%→≥88% |
| 3 | VIZ-003 | companion 补强 | 图表类型插件发现路径 + 未知 chartType 降级 | 用户价值 84%→≥88% |
| 4 | VIZ-004 | companion 补强 | 样式子类型 smoke 覆盖至少 2 变体切换 | 用户价值 84%→≥88% |
| 5 | VIZ-008 | companion 补强 | ECharts 渲染适配层空数据/异常态 | 用户价值 84%→≥88% |

---

## 二、范围框定文件列表（≤18 文件）

### 新建文件（3 个）

| 文件 | 用途 |
|------|------|
| `backend/app/datasources/dialects/redshift.py` | RedshiftConnector 方言实现（委托 psycopg，category=olap，SSL 推荐） |
| `tests/test_mfinal_fg_r250.py` | r250 批次集成测试（CONN-027 7 断言 + API-001 性能 4 断言 + VIZ smoke 6 断言） |
| （以下修改文件内新增测试夹具或代码，不独立建文件） | — |

### 修改文件（10 个）

| 文件 | 修改要点 |
|------|----------|
| `backend/app/datasources/dialects/errors.py` | 追加 REDSHIFT_* 错误常量（AUTH_FAILED / CONN_REFUSED / SSL_REQUIRED / TIMEOUT / UNKNOWN）+ `map_redshift_error` + `__all__` 导出 |
| `backend/app/datasources/dialects/__init__.py` | import RedshiftConnector + `__all__` 追加 |
| `backend/app/datasources/__init__.py` | 追加 `from ...redshift import RedshiftConnector` + `register_dialect(RedshiftConnector())` |
| `tests/test_connectors_gov_r40.py` | catalog count 29→30（Redshift 注册后回归断言） |
| `tests/test_connectors_gov_r41.py` | catalog count 29→30（同上） |
| `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | `CONNECTOR_FIELD_HINTS` 追加 `redshift: { port: "5439", databaseLabel: "数据库", usernameLabel: "用户名" }` |
| `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | 追加 T-CONN-R250-FE-01~02：redshift 类型可选、port hint 注入 |
| `fe/src/components/charts/adapters/renderFromSpec.ts` | 追加 `UNKNOWN_CHART_FALLBACK`：未知/undefined chartType → 返回 table spec 降级 + 空数据集安全处理（VIZ-003/008） |
| `docs/api/README.md` | 在 datasources/types 行注 Redshift 已注册 |
| `docs/services/datasources.md` | 更新已实现连接器列表，标注 redshift category=olap |

**总计**：3 新建 + 10 修改 = 13 文件，≤18 上限。

---

## 三、子项设计详述

### 3.1 CONN-027 AWS Redshift 连接器

#### 方言实现策略

Redshift 在网络协议层与 PostgreSQL 高度兼容（psycopg3 可直连），但在 SQL 方言、系统表与行为上有差异：
- **连接参数**：host（集群端点）、port（默认 5439）、database、username/password、ssl_mode（默认 `required` 推荐）
- **委托模式**：`RedshiftConnector` 持有 `PostgresConnector` 实例作 `_delegate`，复用 `open_connection` + `list_schemas/tables/columns`（信息模式兼容），但覆盖 `test_connection` 以使用 `map_redshift_error` 映射 Redshift 特有错误
- **category**：`olap`（区别于 PostgreSQL 的 `relational`）
- **`probe_readonly_sql`**：执行 `SELECT 1`，与其他 PG 兼容型一致
- **SSL 处理**：默认 ssl_mode=`required`；`REDSHIFT_SSL_REQUIRED` 专用错误码映射 SSL 握手失败

#### 错误码设计（`errors.py` 追加）

```python
REDSHIFT_AUTH_FAILED = "REDSHIFT_AUTH_FAILED"
REDSHIFT_CONN_REFUSED = "REDSHIFT_CONN_REFUSED"
REDSHIFT_SSL_REQUIRED = "REDSHIFT_SSL_REQUIRED"
REDSHIFT_TIMEOUT = "REDSHIFT_TIMEOUT"
REDSHIFT_UNKNOWN_DATABASE = "REDSHIFT_UNKNOWN_DATABASE"
REDSHIFT_UNKNOWN = "REDSHIFT_UNKNOWN"

_REDSHIFT_FROM_PG = {
    PG_CONN_REFUSED: REDSHIFT_CONN_REFUSED,
    PG_AUTH_FAILED: REDSHIFT_AUTH_FAILED,
    PG_TIMEOUT: REDSHIFT_TIMEOUT,
    PG_UNKNOWN_DATABASE: REDSHIFT_UNKNOWN_DATABASE,
    PG_SSL_ERROR: REDSHIFT_SSL_REQUIRED,
    PG_UNKNOWN: REDSHIFT_UNKNOWN,
}

def map_redshift_error(exc: Exception) -> tuple[str, str]:
    # 先走 PG 通用路径，再映射至 REDSHIFT_ 前缀
    ...
```

`map_redshift_error` 对 psycopg.OperationalError 走 `map_postgres_operational_error` 再重映射；对 SSL 错误优先匹配 `REDSHIFT_SSL_REQUIRED`。

#### 注册

`register_dialect(RedshiftConnector())` 追加于 `backend/app/datasources/__init__.py`，catalog count 29→30，触发 r40/r41 更新。

#### 测试覆盖（r250 · CONN-027）

| 断言 ID | 内容 |
|---------|------|
| T-CONN-R250-027-01 | type=`redshift` 已在 export_type_catalog；category=`olap`；catalog count == 30 |
| T-CONN-R250-027-02 | `GET /api/v1/datasources/types` 返回 redshift（mock 环境） |
| T-CONN-R250-027-03 | `map_redshift_error(PG_AUTH_FAILED exc)` → `REDSHIFT_AUTH_FAILED` |
| T-CONN-R250-027-04 | `map_redshift_error(PG_SSL_ERROR exc)` → `REDSHIFT_SSL_REQUIRED` |
| T-CONN-R250-027-05 | `test_connection` mock 连接成功 → `ok=True, latency_ms>0` |
| T-CONN-R250-027-06 | `probe_readonly_sql` mock 连接 → 返回 True |
| T-CONN-R250-027-07 | API 响应无明文密码（凭证脱敏守卫） |

---

### 3.2 API-001 性能 + 结构化错误补强

#### 当前分析

`backend/app/api/v1/datasources.py` 数据源 CRUD 主路径：
- `GET /datasources`（list，含 limit/offset/q/type 过滤）
- `POST /datasources`（create）
- `POST /datasources/{id}/test-connection`（test）

性能维 86% 薄弱点：缺乏 P95 可测量断言；入参非法时错误体无明确 traceId 可定位说明。

#### 设计决策

1. **P95 基准测试**：在 r250 test 文件中使用 `time.perf_counter()` 对 list/create/test 各执行 5 次，断言 95th percentile ≤ 500ms（SQLite 内存测，不含网络时延，验证无 N+1 或序列化阻塞）
2. **结构化错误**：补充非法 UUID 入参测试（`GET /datasources/invalid-uuid` → 422 + `{ "code", "message", "detail" }` 含可定位错误描述）；duplicate-code create → 409 + 结构化 `code=DS_CODE_CONFLICT`
3. **traceId 验证**：请求带 `X-Trace-Id: test-trace-001` → 响应 `X-Trace-Id` 透传验证

#### 测试覆盖（r250 · API-001）

| 断言 ID | 内容 |
|---------|------|
| T-API-R250-001-01 | `GET /datasources` P95 ≤ 500ms（5次重复，内存 SQLite） |
| T-API-R250-001-02 | `POST /datasources` create P95 ≤ 500ms |
| T-API-R250-001-03 | 非法 UUID path → 422 + 结构化 `{ code, message, detail }` |
| T-API-R250-001-04 | `X-Trace-Id` 透传：请求头 → 响应头一致 |

---

### 3.3 VIZ-003 图表类型插件注册 — 未知类型降级

#### 当前状态

`fe/src/lib/chartRegistry.ts`：`isKnownChartType(type)` 已有 fallback 列表；`fetchChartTypeCatalog` 可失败。

`fe/src/components/charts/adapters/renderFromSpec.ts`：`renderFromSpec` 按 chartType 分发到各 builder 函数，但对未知 chartType 当前无明确 fallback 路径（未覆盖分支可能静默返回空 option）。

#### 设计决策

**在 `renderFromSpec.ts` 内**追加：
- `FALLBACK_CHART_TYPE = "table"` 常量
- 在 switch/if 分发未匹配时，显式 `return buildTableOption(spec, rows, columns)` — 保证任何未知 chartType 降级为表格渲染（数据可见，无白屏）
- 追加 `getFallbackChartType(type: string): string` 工具函数（供 ChartConfigPanel 高亮未识别类型时调用）

#### 测试覆盖（r250 · VIZ-003，vitest）

| 断言 ID | 内容 |
|---------|------|
| T-VIZ-R250-003-01 | `isKnownChartType("line")` → true；`isKnownChartType("unknown_xyz")` → false |
| T-VIZ-R250-003-02 | `renderFromSpec` 传入 chartType="unknown_xyz" → 返回 table fallback option（含 columns 字段） |

---

### 3.4 VIZ-004 图表样式子类型 — 变体切换 smoke

#### 当前状态

`backend/app/viz/builtin.py`：bar 含 `("default", "stacked", "grouped", "horizontal")`；line 含 `("default", "area", "smooth")`；pie 含 `("default", "donut")`。

`fe/src/components/charts/adapters/renderFromSpec.ts`：各 buildXxxOption 函数已读取 `spec.styleVariant` 分支渲染。

`fe/src/components/charts/ChartConfigPanel.tsx`：styleVariant 已用 `<Select>` 展示，onChange 触发 config 更新。

#### 缺口

vitest smoke 仅覆盖注册，未断言 `renderFromSpec` 对 `stacked` / `donut` 实际生成的 ECharts option 字段正确性。

#### 设计决策

在 r250 vitest 测试（`fe/` 目录的 smoke 测试文件或追加至现有文件）中追加：
- bar stacked → `series[0].stack` 字段存在
- pie donut → `series[0].radius` 为数组（内外径）

#### 测试覆盖（r250 · VIZ-004，vitest）

| 断言 ID | 内容 |
|---------|------|
| T-VIZ-R250-004-01 | `buildBarOption` styleVariant="stacked" → option.series[0].stack 非空 |
| T-VIZ-R250-004-02 | `buildPieOption` styleVariant="donut" → option.series[0].radius 为长度 2 数组 |

---

### 3.5 VIZ-008 ECharts/AntV 渲染适配层 — 空数据 + 异常态

#### 当前状态

`renderFromSpec.ts`：各 builder 函数直接操作 `rows`/`columns`，未对空数组或 null 字段索引做防护（`colIndex` 返回 -1 时 `r[-1]` 为 undefined，可能导致 `NaN`/`null` 渗入 series data）。

`AdvancedEchartsChart.tsx`：接收 `option` 后直接 `echarts.setOption`，无空 option 检测，空 series 时白屏。

#### 设计决策

**`renderFromSpec.ts` 改动**（与 VIZ-003 改动合并于同一文件）：
- 追加 `safeColIndex(columns: string[], field: string): number | null`：返回 null 表示列不存在
- 各 builder 函数在 `rows.length === 0` 时返回 `{ series: [], dataset: { source: [] } }` 空 spec（让 ECharts 渲染空白图而非抛错）
- `colIndex` 返回 -1 时的行数据读取由 `r[idx] ?? null` 替换为 `idx >= 0 ? r[idx] : null`

**`AdvancedEchartsChart.tsx` 改动**：
- 在 `useEffect` 内追加 `if (!option || (Array.isArray(option.series) && option.series.length === 0))` 分支渲染 `<EmptyState label="暂无数据" />` 覆盖层，避免空白屏

#### 测试覆盖（r250 · VIZ-008，vitest）

| 断言 ID | 内容 |
|---------|------|
| T-VIZ-R250-008-01 | `renderFromSpec` 传入 rows=[] → 返回 `{ series: [] }` 不抛错 |
| T-VIZ-R250-008-02 | `renderFromSpec` bar 类型正常数据 → option.series[0].type == "bar"（ECharts 主路径回归） |

---

## 四、UI 设计交付

> **ui_design_skill**: `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（本批 CONN-027 触及 `DatasourceFormPage.tsx`）

### 4.1 页面信息架构（DatasourceFormPage — redshift 新增）

- **导航**：Admin 壳层 > 数据源管理 > 新建/编辑数据源（路由不变：`/admin/datasources/new`、`/admin/datasources/:id/edit`）
- **改动范围**：`CONNECTOR_FIELD_HINTS` 常量追加一项，无新组件、无布局变更
- **端口 hint**：`redshift: { port: "5439", databaseLabel: "数据库", usernameLabel: "用户名" }`
- **空/加载/错误**：沿用现有 `typesQuery` loading 态（Skeleton）+ 错误态（mapApiError 文案），无新场景

### 4.2 视觉层级

- redshift 在类型下拉 `<SelectItem>` 中按字母排序注入（displayName 来自 ConnectorRegistry `"AWS Redshift"`），无新的主操作/次操作按钮变化
- port 字段在选择 redshift 后自动填充 5439（现有 useEffect 联动 CONNECTOR_FIELD_HINTS，零 UI 改动量）

### 4.3 组件映射

- 复用现有 `<Select>` / `<Input>` / `<Label>` / `<Button>` / `<Skeleton>`
- 无需新封装组件

### 4.4 Token 与密度

- 无 Token 变化；`check:design` 扫描不受影响（仅 `CONNECTOR_FIELD_HINTS` 纯 JS 常量变更）

### 4.5 响应式与可访问性

- 无新增交互；现有 `aria-label`、焦点、键盘导航不受影响

### 4.6 视觉 QA 清单

| 检查项 | 方式 |
|--------|------|
| 类型下拉含 `AWS Redshift` | vitest smoke T-CONN-R250-FE-01 断言 |
| 选中 redshift 后 port 自动填充 5439 | vitest smoke T-CONN-R250-FE-02 断言 |
| `check:design` 无 Token 漂移 | CI 门禁（`pnpm run check:design`） |

---

## 五、非目标（明确不做）

| 不做项 | 原因 |
|--------|------|
| Redshift Serverless / IAM 认证 | PRD 演化建议中已标注 companion，超出本批范围 |
| UNLOAD 外链 / 跨 S3 导出 | 超出本批范围 |
| compose 真机 Redshift 集成测（非 mock） | 无官方 Redshift 兼容容器满足 CI 要求；分层 skip |
| AntV 适配器分支实现 | VIZ-008 演化建议，本批仅补空数据防护；AntV 留 companion |
| 新 PRD ID 立项 | 本批 round-target 已固定 5 项 |
| Dataset/语义层 | F-D 已收官，本批 F-G |
| AI/问数路径 | plan G2 禁止 |

---

## 六、与 PRD 8 维薄弱项对齐说明

| ID | 薄弱维度（选题时） | 本批补强动作 | 预期分数走势 |
|----|-----------------|------------|-------------|
| CONN-027 | 完整度 84%（未实现） | 实现 redshift dialect + 注册 + 连通链 + 只读守卫 + compose 分层 skip | 完整度 84%→94%；总分 85.4→92+ |
| API-001 | 性能 86% | P95 ≤500ms 基准断言 + traceId 透传验证 + 结构化错误覆盖 | 性能 86%→88%；总分 90.0→90.8+ |
| VIZ-003 | 用户价值 84% | 未知 chartType 降级 fallback（非白屏）+ vitest 枚举回归 | 用户价值 84%→88%；总分 90.1→90.7+ |
| VIZ-004 | 用户价值 84% | bar-stacked / pie-donut vitest smoke 断言 | 用户价值 84%→88%；总分 90.1→90.7+ |
| VIZ-008 | 用户价值 84% | 空数据/异常态安全处理 + ECharts 主路径回归 smoke | 用户价值 84%→88%；总分 90.1→90.7+ |

---

## 七、实现顺序建议（供 P2 planner 参考）

1. **Task 1**（后端 CONN-027）：`errors.py` → `redshift.py` → `dialects/__init__.py` → `datasources/__init__.py`（顺序依赖）
2. **Task 2**（后端 catalog count 修正）：`test_connectors_gov_r40.py` + `test_connectors_gov_r41.py`（29→30）
3. **Task 3**（前端 CONN-027 UI hint）：`DatasourceFormPage.tsx` + `datasource-form.smoke.test.tsx`（独立，可并行 Task 1）
4. **Task 4**（后端 API-001 性能测试）：`test_mfinal_fg_r250.py` CONN-027 + API-001 段（需 Task 1 完成后验证）
5. **Task 5**（前端 VIZ-003/004/008）：`renderFromSpec.ts` + `AdvancedEchartsChart.tsx` + vitest smoke（可与 Task 3/4 并行）
6. **Task 6**（文档同步）：`docs/api/README.md` + `docs/services/datasources.md`

**执行模式**：subagent-driven-development（Tasks 3+5 可并行；Task 4 依赖 Task 1）

---

## 八、self-review 检查

- [x] 覆盖 round-target 全部 5 子项（CONN-027 / API-001 / VIZ-003 / VIZ-004 / VIZ-008）
- [x] 未超出范围框定（13 文件 ≤ 18 上限；≤3 模块：datasources/dialects + api/tests + fe/viz）
- [x] 无 TBD / TODO 残留
- [x] 前端 UI 触及点（DatasourceFormPage）已读取 ui_design_skill 并写入「UI 设计交付」
- [x] 禁止写生产代码（本文档为 design-only 产出）
- [x] 验收标准均可测试（pytest 断言 / vitest 断言 / check:design CI）
- [x] 非目标明确标注，无范围漂移
- [x] catalog count 回归（r40/r41 29→30）已纳入范围，防止 P4 BLOCKED 重演
