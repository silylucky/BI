# NFR 横切 + GOV-005 查询服务发布 + GBase 连接器 companion 质量推分 r51 设计

```yaml
date: 2026-07-04
milestone: NFR/GOV/CONN
round_target: docs/superpowers/evolution/2026-07-04-round-target.md
prd_ids: [NFR-006, NFR-007, NFR-005, GOV-005, CONN-019]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 模块 | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|------|:--------:|------------|----------|
| 1 | 浏览器兼容矩阵探测 + 推送通道 mock/降级链 | NFR-006 | `core/nfr/` | 1（簇最低 **79.2**） | 性能 **58%→≥86%**；架构 **68%→≥88%** | 部署侧可见主流浏览器支持矩阵；推送通道失败时有 mock 可测降级链与结构化指引 |
| 2 | 信创合规边界枚举 + 不合规拦截 + 非阻塞探测 | NFR-007 | `core/nfr/` | 2（**80.0**） | 性能 **58%→≥86%**；完整度 **76%→≥88%** | 不合规组件可枚举并附修复指引；合规探测不阻塞启动 |
| 3 | 插件扩展点 companion + registry 零侵入 + CONN-019 登记路径 | NFR-005 | `core/nfr/` | 3（**81.2**） | 性能 **58%→≥86%**；完整度 **76%→≥88%** | 新增 GBase 等方言仅需插件登记路径；核心 Registry 行为不变且可自动化验证 |
| 4 | 发布 FSM 审批通知钩子 + 并发/幂等 smoke | GOV-005 | `governance/publish/` | 4（**82.6**） | 性能 **58%→≥86%**；完整度 **78%→≥88%** | 查询服务发布具备审批通知契约；非法状态迁移与并发发布被结构化拦截 |
| 5 | GBase HTTP 4xx/502 链 + 空库/列 limit 边界 + 错误域上浮 | CONN-019 | `datasources/dialects/` | 5（**84.1**） | 性能 **58%→≥86%**；完整度 **78%→≥88%** | GBase 测试连接与元数据探测错误可定位；空库与超大列集有明确边界 |

**依赖链**：`browser_matrix` + `push_channels` 降级链 → `xinchuang` 修复指引与非阻塞 probe → `plugin_extension` 登记路径文档化 + registry probe → `publish/notifications` 钩子接入 `resolve_push_mode` 投递模式 → `gbase` metadata/HTTP 边界闭合 → `test_nfr_gov_conn_r51.py` companion → r46 `test_nfr_gov_conn_r46` 36/36 + r49 `test_design_conn_gov_query_r49` 35/35 回归 → P5 五 ID 加权总分 **≥90**（STUCK 清零）。

**上轮已交付（本轮不重复 L1 骨架）**：r46 `core/nfr/` 五文件、`governance/publish/` 四文件、`dialects/gbase.py`、`api/v1/nfr.py` 三路由、`test_nfr_gov_conn_r46.py` 36 条；推送 `resolve_push_mode`、信创 `build_compliance_report`、插件 `PLUGIN_EXTENSION_POINTS`、发布 FSM 四路由、GBase MySQL 委托与 `GBASE_*` 基础映射。

**STUCK 说明**：五 ID 各连续 1 轮（79.2–84.1）；本轮 companion 质量推分闭合 r46 修订记录明示的浏览器矩阵/真实推送通道 mock/审批通知/性能与完整度薄弱维，目标破 90。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §NFR/GOV/CONN；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `core/nfr/push_config.py` | `resolve_push_mode` disabled/degraded/active；**无**浏览器矩阵、**无**通道 mock 发送与降级链 |
| `core/nfr/xinchuang.py` | 4 项检查清单 + strict 守卫；**无** `remediation` 修复指引、**无**非阻塞 probe 性能 smoke |
| `core/nfr/plugin_extension.py` | 扩展点冻结清单 + `register_connector_plugin`；**无** CONN-019 登记路径文档化 API、**无** registry 探测性能 smoke |
| `governance/publish/service.py` | submit/approve/reject FSM；**无**审批通知钩子、**无**并发 approve 显式契约 |
| `dialects/gbase.py` | MySQL 委托 + `GBASE_MAX_COLUMNS=500`；**无**空库 `list_schemas` 边界巩固、**无** HTTP metadata 4xx/502 链测 |
| `dialects/errors.py` | `map_gbase_error` + 五 `GBASE_*`；**无** `GBASE_TIMEOUT`/`GBASE_UNKNOWN_DATABASE` 单测与 HTTP 链覆盖 |
| `api/v1/nfr.py` | push-config / compliance / extension-points；**无** browser-matrix、push-probe 路由 |
| `test_nfr_gov_conn_r46.py` | 36 条 L1；**无**浏览器矩阵、推送 mock 链、通知钩子、GBase metadata HTTP 失败链 |

**范围框定模块**（3）：

1. `backend/app/core/nfr/` — NFR-005/006/007 companion 域逻辑
2. `backend/app/governance/publish/` — GOV-005 通知钩子与 FSM 并发边界
3. `backend/app/datasources/dialects/` — CONN-019 GBase 边界闭合

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/core/nfr/browser_matrix.py` | NFR-006 | 新建：静态矩阵 + UA 探测 |
| `backend/app/core/nfr/push_channels.py` | NFR-006 | 新建：mock 发送 + 降级链 |
| `backend/app/core/nfr/push_config.py` | NFR-006 | 修改：与 push_channels 集成 |
| `backend/app/core/nfr/xinchuang.py` | NFR-007 | 修改：remediation + 非阻塞 probe |
| `backend/app/core/nfr/plugin_extension.py` | NFR-005 | 修改：登记路径文档 + registry probe |
| `backend/app/core/nfr/errors.py` | NFR 横切 | 修改：新增 `PUSH_CHANNEL_*` / `NFR_PROBE_TIMEOUT` 等常量 |
| `backend/app/core/nfr/__init__.py` | NFR 横切 | 修改：导出新符号 |
| `backend/app/governance/publish/notifications.py` | GOV-005 | 新建：内存通知钩子 + 事件 store |
| `backend/app/governance/publish/service.py` | GOV-005 | 修改：submit/approve/reject 触发通知 |
| `backend/app/governance/publish/schemas.py` | GOV-005 | 修改：`PublishNotificationOut` |
| `backend/app/governance/publish/__init__.py` | GOV-005 | 修改：导出 notifications |
| `backend/app/datasources/dialects/gbase.py` | CONN-019 | 修改：空库边界 + list_columns limit 巩固 |
| `backend/app/datasources/dialects/errors.py` | CONN-019 | 修改：`map_gbase_error` timeout/unknown_database 路径巩固 |
| `backend/app/api/v1/nfr.py` | NFR-006/007/005 | 修改（薄 entry）：browser-matrix、push-probe、registration-path |
| `backend/app/api/v1/gov.py` | GOV-005 | 修改（薄 entry）：GET publish notifications |
| `tests/test_nfr_gov_conn_r51.py` | 全部 | 新建（≥30 条 companion 断言） |
| `docs/services/nfr.md` | NFR-* | 修改：companion 边界登记 |
| `docs/services/governance.md` | GOV-005 | 修改：审批通知钩子登记 |

**跨模块薄 entry 说明**：`api/v1/nfr.py` 与 `gov.py` 各新增 1–2 路由，仅解析参数并调用域服务；业务逻辑留在三模块框定内。不计入「≤3 模块」计数，但计入 ≤20 文件总预算。

**真理源优先级**：`round-target` > `prd.md` hub + `F15-NFR.md` / `F10-GOV.md` / `F04-CONN.md` > `docs/services/` > `docs/api/README.md`。

**本轮性质**：r46 L1 后 **companion 质量推分**；**纯后端**；`ui_design_skill: none`；不含 `fe/`、Admin UI、真实企微/钉钉 SDK、信创全量认证、GBase 生产 HA、GOV BPM 全量工单、r49 L1 簇（DESIGN/GOV-003/QUERY-003/CONN-016）companion。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/core/nfr/
├── browser_matrix.py      # NFR-006：SUPPORTED_BROWSER_MATRIX + probe_browser_support
├── push_channels.py       # NFR-006：mock dispatch + fallback degradation chain
├── push_config.py         # + integrate delivery chain summary
├── xinchuang.py           # NFR-007：remediation + probe_compliance_non_blocking
├── plugin_extension.py    # NFR-005：describe_registration_path + probe_registry
└── errors.py              # + PUSH_CHANNEL_* / NFR_PROBE_TIMEOUT

backend/app/governance/publish/
├── notifications.py       # GOV-005：内存事件 store + emit hooks
├── service.py             # + on_submit/on_approve/on_reject 调用
└── schemas.py             # + PublishNotificationOut

backend/app/datasources/dialects/
├── gbase.py                 # 空库/列 limit 边界巩固
└── errors.py                # GBASE_TIMEOUT/UNKNOWN_DATABASE 映射巩固

backend/app/api/v1/
├── nfr.py                   # + GET browser-matrix, POST push-probe, GET registration-path/{type}
└── gov.py                   # + GET publish/entries/{id}/notifications

tests/
└── test_nfr_gov_conn_r51.py
```

**共享 companion 契约**（五子项均满足）：

| 契约项 | r46 已有 | r51 增量 |
|--------|----------|----------|
| 结构化 `code` | 基础 `GBASE_*` / `GOV_PUBLISH_*` | 补 `PUSH_CHANNEL_DEGRADED`、`PUSH_CHANNEL_ALL_FAILED` |
| 性能 smoke | 无 | 各域 probe 有 `max_ms` 预算断言（同进程，无真实网络） |
| 错误体 | `{code, message, detail}` | 推送/合规 probe 失败含 `detail.fields` 或 `detail.remediation` |
| 内存 store | plugin `_PLUGIN_META` | `_PUBLISH_NOTIFICATIONS`、`_PUSH_MOCK_LOG` 进程内；文档注明非生产持久化 |
| 回归 | r46 36/36 | r46 + r49 全量门控不删旧套件 |

### 3.2 NFR-006 — 浏览器矩阵与推送通道 mock/降级链

#### 3.2.1 方案比选

| 方案 | 浏览器矩阵 | 推送通道 | 结论 |
|------|------------|----------|------|
| A 静态矩阵 + UA 解析 + 内存 mock 发送链 | 政企主流四浏览器 + 最低版本 | wecom/dingtalk/browser 顺序 fallback | **采用** — 闭合架构解耦与性能 smoke |
| B 真实 WebPush + Service Worker | 完整兼容 | 真实 HTTP webhook | 否决 — round-target 明确不含 |
| C 仅扩展 push-config 字段无 mock | 静态列表 | 无发送链 | 否决 — 完整度/架构维不足 |

#### 3.2.2 域逻辑

**文件**：`browser_matrix.py`（新建）

- 常量 `SUPPORTED_BROWSER_MATRIX: tuple[BrowserMatrixEntry, ...]` ≥4 项：`chrome`/`edge`/`firefox`/`safari`，各含 `minVersion`、`status`（`supported`|`deprecated`|`unsupported`）、`notes`
- `probe_browser_support(user_agent: str | None = None) -> BrowserMatrixReport`：
  - `user_agent` 为空 → 返回全矩阵 + `detectedBrowser=null`、`overallStatus=unknown`
  - 非空 → 解析 major 版本（简单 regex，不引入新依赖），标注 `supported|unsupported|deprecated`
- `probe_browser_matrix_budget_ms: int = 50` — 单测断言 `elapsed_ms < 50`

**文件**：`push_channels.py`（新建）

- 通道顺序：`PUSH_CHANNEL_ORDER = ("browser", "wecom", "dingtalk")`
- `PushDispatchResult`：`status`（`delivered`|`degraded`|`failed`）、`channel`、`attemptedChannels`、`degradedReason`、`code`
- `dispatch_push_mock(payload: dict, settings: Settings) -> PushDispatchResult`：
  - 读取 `resolve_push_mode()`；`disabled` → 立即 `failed` + `PUSH_CHANNEL_ALL_FAILED`
  - 按顺序尝试内存 mock：browser 恒可投递（记录 `_PUSH_MOCK_LOG`）；wecom/dingtalk 当 webhook 配置且 env `PUSH_MOCK_FORCE_FAIL=wecom|dingtalk` 时模拟失败以触发 fallback
  - 全部失败 → `degraded` + `PUSH_CHANNEL_DEGRADED` + `degradedReason` 枚举失败通道
  - 任一成功 → `delivered` + 所用通道名
- `probe_push_dispatch_budget_ms: int = 100` — 单测性能 smoke

**文件**：`push_config.py`（修改）

- `PushConfigOut` 增可选字段 `channelProbeSummary: str | None`（仅 companion 内部/测试用，HTTP 经 push-probe 暴露，**不**污染 GET push-config 既有契约）

#### 3.2.3 路由（薄 entry）

**文件**：`api/v1/nfr.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/nfr/browser-matrix` | Query 可选 `userAgent`；返回矩阵 + 探测结果 |
| POST | `/api/v1/nfr/push-probe` | Body `{ "message": "..." }`；调用 `dispatch_push_mock`；不发送真实 HTTP |

#### 3.2.4 验收（可测试）

| ID | 断言 |
|----|------|
| T-NFR-R51-006-01 | `SUPPORTED_BROWSER_MATRIX` ≥4 浏览器 |
| T-NFR-R51-006-02 | UA `Chrome/120` → `detectedBrowser.supported=true` |
| T-NFR-R51-006-03 | UA `MSIE 6` → `unsupported` |
| T-NFR-R51-006-04 | `probe_browser_support` 耗时 < 50ms |
| T-NFR-R51-006-05 | 全未配置 push → `dispatch_push_mock` `failed` + `PUSH_CHANNEL_ALL_FAILED` |
| T-NFR-R51-006-06 | browser+wecom 配置 + mock wecom 失败 → `degraded` 且 `attemptedChannels` 含 wecom |
| T-NFR-R51-006-07 | browser+wecom 配置正常 → `delivered` channel=wecom 或 browser |
| T-NFR-R51-006-08 | HTTP GET browser-matrix 200 + items≥4 |
| T-NFR-R51-006-09 | HTTP POST push-probe 不泄露 webhook URL |

### 3.3 NFR-007 — 信创合规边界与不合规拦截

#### 3.3.1 方案比选

| 方案 | 修复指引 | 非阻塞 | 结论 |
|------|----------|--------|------|
| A 清单项增 `remediation` + `probe_compliance_non_blocking(max_ms)` | 每项 fail 附一行修复动作 | perf_counter 预算守卫 | **采用** |
| B 外部认证报告上传 | — | — | 否决 — 超范围 |
| C 仅 duplicate strict 422 测 | 无 | 无 | 否决 — 完整度不足 |

#### 3.3.2 域逻辑

**文件**：`xinchuang.py`（修改）

- `XinchuangChecklistItem` 增 `remediation: str | None`（fail 项必填，pass 为 null）
- 修复指引映射示例：
  - `xc-db-connector` fail → `"Register xinchuang dialect via register_connector_plugin (e.g. gbase, dm, gaussdb)"`
  - `xc-platform-db` fail → `"Set DATABASE_URL to postgresql:// or sqlite+ for dev"`
  - `xc-forbidden-runtime` fail → `"Remove superset/dataease from runtime dependencies"`
- `enumerate_non_compliant(report) -> list[XinchuangChecklistItem]`：过滤 `status=fail`
- `probe_compliance_non_blocking(settings, max_ms: int = 100) -> ComplianceProbeResult`：
  - 包装 `build_compliance_report`；超时 → `NFR_PROBE_TIMEOUT`（不抛，返回 `probeStatus=timeout`）
  - 正常 → `probeStatus=ok` + `elapsedMs`
- strict 模式 `assert_xinchuang_compliant` 行为不变；新增单测：permissive 下 fail 项仍 200 但 `items[].remediation` 非空

#### 3.3.3 验收（可测试）

| ID | 断言 |
|----|------|
| T-NFR-R51-007-01 | fail 项 `remediation` 非空 |
| T-NFR-R51-007-02 | `enumerate_non_compliant` 仅返回 fail |
| T-NFR-R51-007-03 | `probe_compliance_non_blocking` `elapsedMs` < 100 |
| T-NFR-R51-007-04 | mock 慢检查（patch sleep）→ `probeStatus=timeout` |
| T-NFR-R51-007-05 | GET compliance 200 且 gbase 在 `registeredXinchuangConnectors` |
| T-NFR-R51-007-06 | strict + mysql 平台库 → 422 `XINCHUANG_NON_COMPLIANT`（r46 回归） |

### 3.4 NFR-005 — 插件扩展 companion 与 CONN-019 登记路径

#### 3.4.1 方案比选

| 方案 | 零侵入验证 | CONN-019 路径 | 结论 |
|------|------------|---------------|------|
| A `describe_registration_path` + `probe_registry` 性能 smoke | inspect 源守卫保留 | 文档化 `gbase.py` + `register_connector_plugin` 两步 | **采用** |
| B 动态加载第三方 wheel | — | — | 否决 — NFR-04 L2 |
| C 仅重复 r46 扩展点 HTTP 测 | — | — | 否决 — 性能维无增量 |

#### 3.4.2 域逻辑

**文件**：`plugin_extension.py`（修改）

- `RegistrationPathDoc`：`connectorType`、`steps: list[str]`、`touchesCoreRegistry: bool`（恒 false）
- `describe_registration_path(connector_type: str) -> RegistrationPathDoc`：
  - `gbase` → `["Create dialects/gbase.py", "Call register_connector_plugin(GbaseConnector()) in datasources/__init__.py"]`
  - 未知 type → `steps=["Implement DialectConnector", "register_connector_plugin(connector)"]`
- `probe_registry(max_ms: int = 50) -> RegistryProbeResult`：`registry.list_types()` + `get("gbase")` 计时
- `verify_zero_invasion() -> bool`：复用 r46 inspect 守卫（`ConnectorRegistry.register/get` 无 `register_connector_plugin` 引用）

#### 3.4.3 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/nfr/registration-path/{connector_type}` | 返回 `RegistrationPathDoc` |

#### 3.4.4 验收（可测试）

| ID | 断言 |
|----|------|
| T-NFR-R51-005-01 | `describe_registration_path("gbase").touchesCoreRegistry is False` |
| T-NFR-R51-005-02 | gbase steps 含 `register_connector_plugin` |
| T-NFR-R51-005-03 | `probe_registry` < 50ms |
| T-NFR-R51-005-04 | `verify_zero_invasion()` True |
| T-NFR-R51-005-05 | HTTP registration-path/gbase 200 |
| T-NFR-R51-005-06 | `get_plugin_registration_meta("gbase")["registered_via"] == "plugin"`（r46 联动） |

### 3.5 GOV-005 — 审批通知钩子与并发/幂等

#### 3.5.1 方案比选

| 方案 | 通知 | 并发 | 结论 |
|------|------|------|------|
| A 内存 `_PUBLISH_NOTIFICATIONS` + submit/approve/reject 钩子 + push deliveryMode 透传 | 事件含 `deliveryMode`/`channelStatus` | 双线程 approve 幂等 | **采用** |
| B 真实邮件/IM | — | — | 否决 |
| C 仅日志 print | 无契约 | — | 否决 — GOV-005 PRD「通知申请人」需可测契约 |

#### 3.5.2 域逻辑

**文件**：`notifications.py`（新建）

- `PublishNotificationEvent`：`id`、`entryId`、`eventType`（`submitted`|`approved`|`rejected`）、`timestamp`、`deliveryMode`、`notificationStatus`（`queued`|`delivered`|`degraded`）、`message`
- 内存 store `_PUBLISH_NOTIFICATIONS: list[PublishNotificationEvent]` + `clear_notifications()` 测试钩子
- `emit_publish_notification(entry_id, event_type, *, actor: str | None = None) -> PublishNotificationEvent`：
  - 读取 `resolve_push_mode()` 与 `dispatch_push_mock({"text": f"publish {event_type} {entry_id}"})`
  - `deliveryMode=active` 且 mock 成功 → `notificationStatus=delivered`
  - `degraded/disabled` → `notificationStatus=degraded` + message 说明
- `list_notifications(entry_id) -> list[PublishNotificationEvent]`

**文件**：`publish/service.py`（修改）

- `submit_entry` 成功后 `emit_publish_notification(..., "submitted")`
- `approve_entry` 成功后 `emit_publish_notification(..., "approved")`（幂等 approve 已 published **不**重复发通知）
- `reject_entry` 成功后 `emit_publish_notification(..., "rejected")`

**并发契约**：

- `approve_entry` 对已 `published` 行保持幂等返回（r46 已有）
- 新增单测：连续两次 `approve` HTTP → 均 200，第二次 `list_notifications` 仅 1 条 `approved` 事件

#### 3.5.3 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/gov/publish/entries/{entry_id}/notifications` | 返回该 entry 通知事件列表 |

#### 3.5.4 验收（可测试）

| ID | 断言 |
|----|------|
| T-GOV-R51-005-01 | submit 后 notifications 含 `submitted` |
| T-GOV-R51-005-02 | approve 后含 `approved` 且 `deliveryMode` 字段存在 |
| T-GOV-R51-005-03 | reject 后含 `rejected` |
| T-GOV-R51-005-04 | 幂等 double approve 仅 1 条 approved 通知 |
| T-GOV-R51-005-05 | draft 直 approve → 400（r46 回归） |
| T-GOV-R51-005-06 | pending 双 submit → 409（r46 回归） |
| T-GOV-R51-005-07 | push disabled 时 `notificationStatus=degraded` |
| T-GOV-R51-005-08 | gov approve 后 integration list 含 entry（r46 回归） |

### 3.6 CONN-019 — GBase HTTP 链与元数据边界

#### 3.6.1 方案比选

| 方案 | 空库 | 列 limit | HTTP 链 | 结论 |
|------|------|----------|---------|------|
| A 巩固委托边界 + r41 式 HTTP metadata smoke | `list_schemas` mock `[]` | `list_columns` 501→500 切片 | test 4xx + connection 502 | **采用** |
| B 真实 GBase 实例 | — | — | — | 否决 |
| C 仅补 map_gbase_error 单测无 HTTP | — | — | — | 否决 — 完整度不足 |

#### 3.6.2 域逻辑

**文件**：`gbase.py`（修改）

- `list_schemas`：委托后若 mysql 返回 `[]` 保持 `[]`（显式文档化空库语义）
- `list_columns`：委托后 `cols[:GBASE_MAX_COLUMNS]`（已有，补 501 列 mock 单测）
- `test_connection`：`pymysql.err.OperationalError(2002, ...)` → `GBASE_TIMEOUT`（经 errors 映射）

**文件**：`errors.py`（修改）

- 巩固 `map_gbase_error`：`2002`/`timed out` → `GBASE_TIMEOUT`；`1049` → `GBASE_UNKNOWN_DATABASE`

**HTTP 链**（复用既有 datasources 路由，不新建 API 文件）：

- POST `/api/v1/datasources/test` mock OperationalError → 200 `ok=false` `code=GBASE_*` + `traceId`
- 创建 gbase 数据源后 GET `/{id}/tables` 无 `schema` → 400 `METADATA_INVALID_REQUEST`
- GET `/{id}/tables?schema=demo` mock 连接失败 → 502 `METADATA_CONNECTION_FAILED`

#### 3.6.3 验收（可测试）

| ID | 断言 |
|----|------|
| T-CONN-R51-019-01 | mock timeout → `GBASE_TIMEOUT` |
| T-CONN-R51-019-02 | mock unknown database → `GBASE_UNKNOWN_DATABASE` |
| T-CONN-R51-019-03 | mock 空库 `list_schemas` → `[]` |
| T-CONN-R51-019-04 | mock 501 columns → `len==500` |
| T-CONN-R51-019-05 | HTTP POST test auth fail → `GBASE_AUTH_FAILED` + traceId |
| T-CONN-R51-019-06 | HTTP GET tables 无 schema → 400 |
| T-CONN-R51-019-07 | HTTP GET tables 连接失败 → 502 |
| T-CONN-R51-019-08 | types catalog `gbase` `relational`（r46 回归） |

## 4. 测试策略

**新套件**：`tests/test_nfr_gov_conn_r51.py`（≥30 断言函数）

| 区块 | 覆盖 ID | 最少条数 |
|------|---------|:--------:|
| NFR-006 browser + push | NFR-006 | 9 |
| NFR-007 xinchuang | NFR-007 | 6 |
| NFR-005 plugin | NFR-005 | 6 |
| GOV-005 publish + notify | GOV-005 | 8 |
| CONN-019 gbase | CONN-019 | 8 |
| 跨项联动 | 005+007+019 | 3 |

**夹具**：复用 r46 `sqlite+pysqlite memory` module fixture 模式；独立 DB URL `file:nfr_gov_conn_r51?mode=memory` 避免与 r46 冲突；`AUTH = {"Authorization": "Bearer dev"}`。

**回归门控**（P4 必跑）：

- `tests/test_nfr_gov_conn_r46.py` **36/36**
- `tests/test_design_conn_gov_query_r49.py` **35/35**
- 全量 `cd backend && ruff check . && python3 -m pytest -q`

**P4 命令**：`cd backend && ruff check . && python3 -m pytest -q`

## 5. PRD 8 维薄弱项对齐

| PRD ID | 选题时总分 | 薄弱维 | companion 闭合策略 | 目标维 |
|--------|:----------:|--------|-------------------|--------|
| NFR-006 | 79.2 | 性能 58%、架构 68% | 浏览器矩阵 API + push mock 降级链 + <100ms dispatch smoke | 性能 ≥86%、架构 ≥88%、总分 ≥90 |
| NFR-007 | 80.0 | 性能 58%、完整度 76% | remediation 枚举 + 非阻塞 probe <100ms + gbase 联动 | 性能 ≥86%、完整度 ≥88%、总分 ≥90 |
| NFR-005 | 81.2 | 性能 58%、完整度 76% | 登记路径 REST + registry probe <50ms + 零侵入守卫 | 性能 ≥86%、完整度 ≥88%、总分 ≥90 |
| GOV-005 | 82.6 | 性能 58%、完整度 78% | 审批通知钩子 + 幂等/并发 smoke + integration 回归 | 性能 ≥86%、完整度 ≥88%、总分 ≥90 |
| CONN-019 | 84.1 | 性能 58%、完整度 78% | HTTP 4xx/502 链 + 空库/列 limit + GBASE_* 全路径 | 性能 ≥86%、完整度 ≥88%、总分 ≥90 |

**加权总分 companion 目标**：五 ID 均 **≥90**（STUCK 清零）。

## 6. 非目标（明确不做）

- Admin / `fe/` 推送配置 UI、信创合规仪表盘、浏览器矩阵可视化
- 企微/钉钉真实 HTTP 发送、WebPush 订阅与 Service Worker
- 信创全量认证报告、第三方测评对接
- GBase 8s Informix 协议、生产 HA/读写分离
- GOV BPM 全量工单、申请人邮件、发布自动 OpenAPI（→ GOV-006）
- 修改 `integration.publish_service` 快路径语义
- r49 L1 簇（DESIGN-005/003、CONN-016、GOV-003、QUERY-003）companion 推分
- Alembic migration、`plan.md`/`goal.md` 结构变更

## 7. 文档同步（P3/P5）

| 变更 | 文档 |
|------|------|
| browser-matrix / push-probe / registration-path | `docs/api/README.md` 登记 3 路由 |
| publish notifications | `docs/api/README.md` 登记 GET notifications |
| NFR companion | `docs/services/nfr.md` 更新职责与边界 Out |
| GOV-005 通知钩子 | `docs/services/governance.md` GOV-005 行 |
| GBase 边界 | `docs/services/datasources.md` CONN-019 companion 注记 |
| PRD 分片 | P5 回写 `F15-NFR.md`、`F10-GOV.md`、`F04-CONN.md` 验收勾选与锚点 |

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| push-probe 与 push-config 契约漂移 | push-config 响应字段不变；probe 独立路由 |
| 通知 store 进程内泄漏 | 测试 `clear_notifications()`；文档注明非持久化 |
| GBase HTTP 链需持久化数据源 | 复用 r46/r41 fixture 创建 datasource + patch connection |
| 性能 smoke 环境 flaky | 预算放宽至 100ms；仅同进程无 IO mock |
| gov 通知 + integration 双路径 | 测试矩阵显式覆盖 gov approve 与 integration fast path 各自通知/无通知语义（fast path 不发 gov 通知） |

## 9. Spec self-review

- [x] 覆盖 round-target 五子项
- [x] 18 文件 ≤20，三模块 + 薄 entry + 测试 + 文档
- [x] 无 TBD/TODO 占位
- [x] 纯后端，`ui_design_skill: none`
- [x] 验收标准可 pytest 断言（≥30 条 ID）
- [x] 8 维对齐表完整
- [x] r46/r49 回归门控明确
