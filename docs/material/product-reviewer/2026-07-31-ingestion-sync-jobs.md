# 刁钻产品评审 · 同步任务（数据接入）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-31 |
| 级别 | module |
| 范围 | `/admin/ingestion/sync-jobs` 及子路由（新建/编辑、运行历史、ETL 规则）；后端 `ingestion` 域 |
| 角色假设 | 数据平台管理员（`ingestion:manage`）；只读运维/审计（`ingestion:read`） |
| 证据 | 代码走查（FE 页面 + BE API/executor/scheduler）+ PRD `F16-DATA.md` + `docs/services/ingestion.md` |
| 轮次 | r1 |
| 上轮报告 | — |
| 总分 | **69** / 100（硬门槛封顶） |
| 较上轮 Δ | — |
| 结论 | **M1B 可交付**（主链路 + 数据源引用 + 增量 upsert + 出图引导；复合 PK / 增量删除留二期） |
| 硬门槛 | B-1（只读角色可见管理动作且可点，API 403） |

## Review Card

- **主 JTBD**：数据管理员把业务源库（MySQL）表**全量**同步到托管分析库，可选 ETL 清洗与 Cron 调度，供仪表板/SQL 查询消费。
- **成功长什么样**：任务配置一次即可；手动或定时跑完后，目标表数据与历史记录（行数、trace、失败原因）一致；只读同事能看状态但不能误触写操作。
- **最贵失败**：运维以为同步已完成（或以为点了就能跑），实际目标表被全量 TRUNCATE 后写入失败/空表，下游报表 silently 错数；或只读账号满屏「运行/删除」全 403，信任崩塌。
- **未真机**：是（无 browser 走查；MySQL/托管库连通、503、异步 run 完成态未实测）

## 执行摘要（刁钻口吻，短）

- **最锋利的三刺**：① 列表页对 `ingestion:read` 仍展示运行/编辑/删除，点了才 403（B-1，硬门槛）；② 列表不展示「最近运行结果」，异步 202 后用户得自己进历史找（B-2）；③ 每次全量同步会 TRUNCATE 目标表，确认框只写「全量同步」不交代**覆盖风险**（B-3）。
- **唯一值得先修的主线**：**权责诚实（按 capability 藏/禁管理动作）+ 列表级运行态/最近结果**，让「配→跑→信」闭环在列表一眼可见。
- **不该再加的功能**：PostgreSQL 源、增量同步 UI、可视化 ETL 设计器——在 L1 全量链路的信任与运维面未立住前都是堆能力。

## 八维得分

| 维 | 分 | 一句话证据 |
|----|----|------------|
| 1 任务价值 | 78 | JTBD 清晰（源库→托管分析库→BI）；空态三步引导到位；但与「连接管理」重复填连接、未复用 `dataSourceId`（L2 字段在模型有、UI 无） |
| 2 主路径锋利 | 76 | 列表→新建→保存→手动运行→历史，步数合理；ETL 独立页可接受；缺列表快捷启停、缺运行完成回列表的自动刷新 |
| 3 例外与逆操作 | 68 | 删除/批量删有确认、并发 run 409；无取消运行中任务、无失败一键重跑、无效 Cron 在 scheduler 静默跳过、全量覆盖无风险明示 |
| 4 角色与权责 | 38 | **硬门槛**：路由已分 `ingestion:read`/`manage`，但 `SyncJobsTable` 对所有能进列表的人展示 Run/Edit/Delete（`fe/src/pages/admin/ingestion/components/SyncJobsTable.tsx`） |
| 5 认知与决策点 | 74 | 表单已固定 MySQL 并说明 M1B；Cron 无格式校验/下次执行预览；运行确认未强调「覆盖目标表」；空态仍写「MySQL 等」略超前 |
| 6 状态与信任 | 72 | POST run 202 + toast「已开始同步」较诚实；列表无 per-job 最近状态/失败摘要；历史最多拉 100 条，超长无「仅展示最近」说明 |
| 7 可发现与采用 | 77 | 侧栏「数据连接→同步任务」+ 空态 CTA 清晰；托管库 `ANALYTICS_DATABASE_URL` 未配置时缺产品内开通引导（503 文案未专项映射） |
| 8 可运营与可度量 | 70 | 历史含 trace_id/retry_count 利于排障；列表 metrics 仅计数（启用/调度），无失败队列、无「上次成功时间」、配置变更无审计入口 |
| **总分** | **69** | 算术平均 69.1；硬门槛 B-1 触发维 4 ≤40，总分封顶 ≤69 |

## 硬门槛

- [x] **B-1**：`ingestion:read` 可访问列表（`fe/src/routes.tsx` L107），但表格仍渲染「手动运行同步」「编辑任务」「删除任务」（`SyncJobsTable.tsx` L118–155）→ **能点但不能成**，表面不诚实

## 刺点清单

| ID | 维 | 优先级 | 硬门槛 | 视觉债 | 现象 | 刁钻解读 | 证据（须含路径） |
|----|----|--------|--------|--------|------|----------|------------------|
| B-1 | 4 | P0 | 是 | 否 | 只读用户见全套写操作按钮 | 「我能跑为什么不能跑？」→ 以为是 bug 或系统坏了 | `fe/src/routes.tsx` · `fe/src/pages/admin/ingestion/components/SyncJobsTable.tsx` · BE `ingestion:manage` on POST/PUT/DELETE |
| B-2 | 6 | P1 | 否 | 否 | 列表无最近 run 状态/行数/失败摘要 | 点完「运行」toast 消失后，列表跟没事一样，还得进历史考古 | `SyncJobsPage.tsx` · `SyncJobsTable.tsx`（无 last_run 列）· API 仅有 `GET .../runs` |
| B-3 | 3 | P1 | 否 | 否 | 全量同步每次 TRUNCATE 目标表 | 确认框只说「全量同步」，不警告覆盖；误点对生产分析表是事故 | `backend/app/ingestion/sync_executor.py` `_write_analytics` L60–62 · `SyncJobsPage.tsx` run AlertDialog |
| B-4 | 1 | P1 | 否 | 否 | 同步任务内联源连接，与数据源注册重复 | 同一 MySQL 填两遍，改密码要改两处，L2 `source_data_source_id` 未接线 | `SyncJobFormPage.tsx` · `DatasourceListPage` · `ingestion/models.py` `source_data_source_id` |
| B-5 | 7 | P1 | 否 | 否 | 托管分析库未配置时 run 503 | 用户只会看到泛化错误，不知道要配 docker/`.env` | `backend/app/api/v1/ingestion/sync.py` L316–324 · `fe/src/lib/apiError.ts` 无 `ANALYTICS_DB_NOT_CONFIGURED` |
| B-6 | 3 | P2 | 否 | 否 | 非法 Cron 调度注册失败被吞 | 用户以为定时生效，实际从未跑过 | `backend/app/ingestion/scheduler.py` L37–38 `except: pass` |
| B-7 | 6 | P2 | 否 | 否 | 历史页 fetch limit=100 | 老任务运行记录「消失」，运维以为被删 | `SyncJobHistoryPage.tsx` `RUNS_FETCH_LIMIT=100` |
| B-8 | 3 | P1 | 否 | 否 | 失败 run 无「从此记录重试」 | 只能回列表再手动 run，丢失失败上下文 | `SyncJobHistoryPage.tsx` · API 无 retry endpoint |
| B-9 | 5 | P2 | 否 | 否 | Cron 输入无校验/示例/下次执行 | 填 `0 2 * * *` 靠记忆，填错靠猜 | `SyncJobFormPage.tsx` schedule_cron 字段 |

## 处理清单（修复回写）

| ID | 优先级 | 硬门槛 | 视觉债 | 状态 | 本轮动作 | 改动摘要（路径/行为） | 验证 | 规格/工单 | 更新于 |
|----|--------|--------|--------|------|----------|----------------------|------|-----------|--------|
| B-1 | P0 | 是 | 否 | done | FE 按 ingestion:manage 隐藏写操作 | `SyncJobsPage.tsx` · `SyncJobsTable.tsx` | vitest 35/35 | — | 2026-08-03 |
| B-2 | P1 | 否 | 否 | done | 列表 API last_run + 列展示 + run 后轮询刷新 | `sync.py` · `SyncJobsTable.tsx` | pytest + vitest | — | 2026-08-03 |
| B-3 | P1 | 否 | 否 | done | 运行确认框明示 TRUNCATE 覆盖目标表 | `SyncJobsPage.tsx` | vitest | — | 2026-08-03 |
| B-4 | P1 | 否 | 否 | done | 表单双模式 + source_resolver 快照 | `SyncJobFormPage.tsx` · `source_resolver.py` · `sync.py` | pytest + vitest | — | 2026-08-03 |
| B-5 | P1 | 否 | 否 | done | apiError 映射 ANALYTICS_DB_NOT_CONFIGURED 等 | `fe/src/lib/apiError.ts` | — | — | 2026-08-03 |
| B-6 | P2 | 否 | 否 | done | Cron 创建/更新 422；scheduler 逐 job 跳过非法 cron | `cron_validate.py` · `sync.py` · `scheduler.py` | pytest | — | 2026-08-03 |
| B-7 | P2 | 否 | 否 | done | 历史页 description 明示最多 100 条 | `SyncJobHistoryPage.tsx` | vitest | — | 2026-08-03 |
| B-8 | P1 | 否 | 否 | done | 历史页「重新同步」按钮（manage 权限） | `SyncJobHistoryPage.tsx` | vitest | — | 2026-08-03 |
| B-9 | P2 | 否 | 否 | done | 表单 Cron 快捷预设按钮 | `SyncJobFormPage.tsx` · `sync-job-types.ts` | — | — | 2026-08-03 |

## 改进建议与方案

### P0

#### B-1 · 按 capability 诚实渲染列表写操作

| 项 | 内容 |
|----|------|
| 刺点 | 只读用户可见 Run/Edit/Delete 且点击 403 |
| 产品改法 | **权责**：列表页读取 `hasCapability(ingestion:manage)`；无 manage 时隐藏或禁用写操作，只保留「查看历史」；禁用时 tooltip 说明「需数据集成管理权限」 |
| 第一刀切片 | 只读账号打开列表只见历史入口；manage 账号行为不变。验收：mock `ingestion:read` 用户无 Run/Delete/Edit 按钮 |
| 证据路径 | `SyncJobsPage.tsx` · `SyncJobsTable.tsx` · `fe/src/lib/capabilities.ts` |
| 不做 | 不改后端 RBAC 模型 |
| 预期提分 | 维 4 → 75+；解除硬门槛后总分可至 ~74 |

### P1

#### B-2 · 列表展示最近运行摘要

| 项 | 内容 |
|----|------|
| 刺点 | 异步 run 后列表无状态反馈 |
| 产品改法 | **状态机**：列表 API 扩展 `last_run`（status/started_at/rows_synced）或在 FE 轮询最近 run；运行中显示「同步中」badge |
| 第一刀切片 | 新增列「最近运行」：成功/失败/运行中 + 时间；手动 run 后 5s 内自动 refresh |
| 证据路径 | `backend/app/api/v1/ingestion/sync.py` list response · `SyncJobsTable.tsx` |
| 不做 | 不做全链路实时推送 |
| 预期提分 | 维 2 → 82；维 6 → 80 |

#### B-3 · 全量覆盖风险明示

| 项 | 内容 |
|----|------|
| 刺点 | TRUNCATE 目标表无产品警告 |
| 产品改法 | **例外**：运行确认文案增加「将清空并覆盖目标表 `{target_table}` 的全部数据」；可选二次输入表名（高风险租户） |
| 第一刀切片 | AlertDialog 描述含目标表名 + 覆盖说明 |
| 证据路径 | `SyncJobsPage.tsx` · `sync_executor.py` |
| 不做 | 不改增量同步策略（远期） |
| 预期提分 | 维 3 → 75 |

#### B-5 · 托管库未配置专态

| 项 | 内容 |
|----|------|
| 刺点 | 503 无行动指引 |
| 产品改法 | **可发现**：`apiError` 映射 `ANALYTICS_DB_NOT_CONFIGURED`；列表顶栏检测（或首次 run 失败）展示「开通托管分析库」步骤链到 `docs`/compose |
| 第一刀切片 | 错误 banner 含「请配置 ANALYTICS_DATABASE_URL 并启动 compose 分析库」 |
| 证据路径 | `fe/src/lib/apiError.ts` · `SyncJobsPage.tsx` |
| 不做 | 不在 FE 内嵌 docker 启动 |
| 预期提分 | 维 7 → 82 |

#### B-8 · 失败 run 快捷重试

| 项 | 内容 |
|----|------|
| 刺点 | 失败只能回列表重跑 |
| 产品改法 | **主路径**：历史失败行增加「重试同步」→ 等同 POST run（需 manage 权限） |
| 第一刀切片 | 历史页 failed 行操作按钮 + 409 冲突提示 |
| 证据路径 | `SyncJobHistoryPage.tsx` · `sync.py` POST run |
| 不做 | 不做断点续传 |
| 预期提分 | 维 3 → 72 |

#### B-4 · 与连接管理复用（L2 切片）

| 项 | 内容 |
|----|------|
| 刺点 | 源连接重复配置 |
| 产品改法 | **任务价值**：新建任务可选「已有数据源」或「内联连接」；选已有则只填源表/目标表 |
| 第一刀切片 | 表单增加数据源下拉（`GET /api/v1/datasources`），写入 `source_data_source_id` |
| 证据路径 | `SyncJobFormPage.tsx` · `ingestion/models.py` · PRD DATA-005 L2 |
| 不做 | 不做双向自动同步密码 |
| 预期提分 | 维 1 → 85 |

### P2

#### B-6 · Cron 无效可感知

| 项 | 内容 |
|----|------|
| 产品改法 | 保存时校验 Cron；refresh 失败写 job 级 warning 或在详情展示「调度未生效：格式无效」 |
| 证据路径 | `scheduler.py` · `SyncJobFormPage.tsx` |
| 预期提分 | 维 3 → 78 |

#### B-7 · 历史分页诚实

| 项 | 内容 |
|----|------|
| 产品改法 | API 增 offset/total；或 UI 明示「仅展示最近 100 次」 |
| 证据路径 | `SyncJobHistoryPage.tsx` · `sync.py` list_runs |
| 预期提分 | 维 6 → 76 |

#### B-9 · Cron 输入助手

| 项 | 内容 |
|----|------|
| 产品改法 | 常用模板（每日 2:00）+ 下次执行时间预览（调用后端或 cronstrue） |
| 证据路径 | `SyncJobFormPage.tsx` |
| 预期提分 | 维 5 → 80 |

## 完整方案包（路线图）

| 阶段 | 目标 | 切片 | 依赖 | 验收 |
|------|------|------|------|------|
| 还债 | 权责诚实 + 运行可感知 | B-1 + B-2 + B-3 | 无 | 只读无写按钮；列表见最近状态；运行确认含覆盖警告 |
| 锐化 | 例外与采用 | B-5 + B-8 + B-6 | 还债完成 | 503 有指引；失败可重试；非法 cron 有反馈 |
| 增长 | L2 连接复用 + 运营 | B-4 + 列表失败队列 | M3 datasources 稳定 | 可选已有数据源；失败任务可筛选 |

## 明确不改 / 非问题

- M1B **仅 MySQL 全量** 与 PRD/executor 一致，非本模块 product 债（postgres 在 API schema 保留属技术债，UI 已隐藏）
- 35 项 smoke 与 28 项 API 测试通过——证明工程可用，不替代任务价值评分
- 子页 AdminPageShell/返回列表——近期已补齐，不再记刺点
- 纯表格密度/图标对齐若需统一 → 交 ui-ux-reviewer（视觉债）

## 开放问题（待产品裁定）

1. **只读角色**是否应能「手动运行」？若业务需要「运维可跑不可改配置」，需拆 `ingestion:run` 权限而非全归 `manage`。
2. **全量 TRUNCATE** 是否为 M1B 永久策略？若否，需在 UI 明确「增量即将支持」避免用户建立错误心智。
3. **L2 dataSourceId** 与内联连接是否长期并存，还是最终废弃内联？

## 下一步

- [x] 报告已落盘 `docs/material/product-reviewer/2026-07-31-ingestion-sync-jobs.md`
- [ ] 仅采纳报告（不改仓）
- [ ] P0 B-1 写入 PRD 或 go-fast 切片
- [ ] 真机补证 → scenario-playbook（L1：MySQL sample → run → 历史 succeeded）
- [ ] loop-goal-product 冲分（先 B-1/B-2/B-3）
