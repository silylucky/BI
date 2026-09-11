# F13-API 开放接口

> 模块：IF · 8 维评分见 [`../prd.md`](../prd.md)

### [API-001] IF-06 数据源管理 API

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：一期
- **描述**：IF-06 数据源管理 API（SRS 追溯项）。
- **验收标准**：
  - [x] datasources CRUD+test+metadata
  - [x] OpenAPI IF-06 tag/示例（`openapi/extensions.py`）
  - [x] path 参数与 POST/GET response example + 401 smoke（r31）
- **代码锚点**：`backend/app/api/v1/datasources.py` · `backend/app/openapi/extensions.py`
- **演化建议**：r31 IF-06 datasources path/response 示例与鉴权 smoke（T-API-R31-001~004）；r250 补 P95≤500ms 验证（T-API-R250-001-01~02）、invalid UUID 结构化错误（T-API-R250-001-03）、X-Trace-Id 透传（T-API-R250-001-04）；后续可补对外 alias 与只读/管理分离策略文档
- **里程碑对齐**：
### [API-002] IF-06 查询执行 API

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：IF-06 查询执行 API（SRS 追溯项）。
- **验收标准**：
  - [x] POST query/execute
  - [x] 只读约束（复用 r27 readonly guard + RLS 链）
  - [x] IF-06 execute OpenAPI 200 example + 401/403/只读拒绝 pytest（r31）
- **代码锚点**：`backend/app/api/v1/query.py` · `backend/app/openapi/extensions.py`
- **演化建议**：r31 execute response example 与越权/多语句拒绝回归（T-API-R31-002~004）；后续可补对外限流与 catalog 联动
- **里程碑对齐**：
### [API-003] IF-02 查询服务 API

- **状态**：已实现（**M-DEPTH F-C 深度 companion 已闭合** · 2026-07-29）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：IF-02 查询服务 API（SRS 追溯项）。
- **验收标准**：
  - [x] GET `/api/v1/services` 已发布查询服务列表 + 分页/分类过滤（r44 L1）
  - [x] GET `/api/v1/services/{id}` + POST `/{id}/execute` 鉴权与 draft 拒绝（r44）
  - [x] 配置生成的标准查询接口（publish 路由 + `;requires=` 参数校验 + Idempotency-Key，r45 companion）
  - [x] 版本 v1 前缀（`/api/v1/services`）
  - [x] `/admin/services` 查询服务 Admin 列表页（M-PRODUCT F-A；`QueryServicesPage` · manifest 治理分组）
  - [x] **M-DEPTH F-C**：已发布服务目录消费增强（试跑入口 + OpenAPI 片段可见；失败态可读）（完成于 2026-07-29 · `QueryServiceTrialSheet.tsx` · `QueryServicesPage.smoke.test.tsx`）
- **代码锚点**：`backend/app/api/v1/services.py` · `backend/app/integration/query_services.py` · `fe/src/pages/admin/services/QueryServicesPage.tsx` · `fe/src/pages/admin/services/QueryServiceTrialSheet.tsx` · `fe/src/pages/admin/services/queryServicePathUtils.ts` · `fe/src/routes.tsx` · `fe/src/config/nav-manifest.tsx`
- **演化建议**：真实查询执行链路可继续加固；生产级限流留远期
- **里程碑对齐**：M-PRODUCT F-A · 服务页 FE · 2026-07-08；**M-DEPTH F-C · 已闭合 · 2026-07-29**
### [API-004] IF-01 总线注册适配

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：IF-01 总线注册适配（SRS 追溯项）。
- **验收标准**：
  - [x] POST `/api/v1/integration/bus/register` 注册 payload + 鉴权（r44 L1）
  - [x] 注册失败可重试（`maxAttempts` + `/retry` + timeout 模拟，r44）
  - [x] 幂等重复注册（r44）
  - [x] 已发布接口自动注册总线（`publish_service` → `register_on_publish`，r45 companion）
- **代码锚点**：`backend/app/api/v1/integration_bus.py` · `backend/app/integration/bus_register.py` · `backend/app/governance/bus/adapter.py`
- **演化建议**：r45 发布钩子自动总线登记 + nil UUID payload 校验（T-API-R45-004-01~06）；后续可补生产级总线 SDK 对接与失败告警
- **里程碑对齐**：
### [API-005] IF-03 报表文档 API

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：IF-03 报表文档 API（SRS 追溯项）。
- **验收标准**：
  - [x] GET `/api/v1/reports/export` 元数据契约 + templateId/format/from/to 校验（r44 L1）
  - [x] 鉴权 401/403 + `X-RateLimit-*` 头与限流拒绝（r44）
  - [x] 按模板/时间提取 Word/PDF/Excel（mock 同步生成 + download 路由，r45 companion）
  - [x] 预制报表页嵌入导出卡片（M-PRODUCT F-A；`ReportExportCard` · `PrefabReportsPage`）
- **代码锚点**：`backend/app/api/v1/reports/export.py` · `backend/app/integration/reports_export.py` · `fe/src/pages/admin/reports/components/ReportExportCard.tsx` · `fe/src/pages/admin/reports/PrefabReportsPage.tsx`
- **演化建议**：M-PRODUCT F-F 真实 PDF/Word 渲染留 companion；r45 报表 mock 生成/download/MIME/502 错误域已闭合
- **里程碑对齐**：
### [API-006] IF-04 门户嵌入 API

- **状态**：已实现（**M-DEPTH F-D 已闭合 · 2026-07-30**）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：IF-04 门户嵌入 API（SRS 追溯项）。token/sdk-params 已实现；公开/匿名分享链接为可选加深。
- **验收标准**：
  - [x] POST `/api/v1/embed/token` embed token 签发（r44 L1）
  - [x] GET `/api/v1/embed/sdk-params` SDK 初始化参数解析（r44）
  - [x] Origin 守卫 + 角色拒绝 smoke（r44）
  - [x] token 过期与非法 origin 拦截（`expiresAt` + `EMBED_ORIGIN_DENIED`，r45 companion）
  - [x] **M-DEPTH F-D〔可选〕**：公开/匿名分享链接落地（`shareMode: public` + `PublicShareLinkCard` + middleware 放行 `dashboard-layout` · 2026-07-30）
- **代码锚点**：`backend/app/api/v1/embed.py` · `backend/app/integration/embed_token.py`
- **演化建议**：JWT 轮换与前端 Embed SDK 联动；政企禁匿名可通过 capability 开关
- **里程碑对齐**：r45 · 已完成；**M-DEPTH F-D · 2026-07-30**
### [API-007] OpenAPI 规范与版本策略

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：一期
- **描述**：OpenAPI 规范与版本策略（SRS 追溯项）。
- **验收标准**：
  - [x] `/api/v1/` 前缀统一 + `x-unversioned-paths` 空列表校验（r44 L1）
  - [x] IF-01~04 tag 分组 + `operationId` 前缀（r44）
  - [x] `x-api-version-policy` / `x-breaking-change-policy` 扩展（r44）
  - [x] 破坏性变更升 v2 文档（`inject_v2_documentation_paths` + `x-supported-versions` v1/v2，r45 companion）
  - [x] **M-PRODUCT F-E**：`docs/api/README.md` 鉴权公开路径与 `AuthMiddleware.PUBLIC_PATHS` 对账（`/health` · `/docs` · `/redoc` · `/openapi.json` · login；2026-07-09）
- **代码锚点**：`backend/app/openapi/version_policy.py` · `backend/app/openapi/extensions.py` · `backend/app/auth/middleware.py` · `backend/app/main.py` · `docs/api/README.md`
- **演化建议**：r45 v2 文档面 + schema stability + IF export example（T-API-R45-007-01~05）；arch-inspect `api.auth` P0 复检
- **里程碑对齐**：M-PRODUCT · F-E · 文档对账 · 2026-07-09
