# F15-NFR 非功能需求

> 模块：NFR · 8 维评分见 [`../prd.md`](../prd.md)

### [NFR-001] NFR-01 Dashboard 首屏性能

- **状态**：已实现（M6 extended widget perf companion）
- **goal_ref**：goal.md §2.1（G1）
- **期次**：一期
- **描述**：NFR-01 Dashboard 首屏性能（SRS 追溯项）。
- **验收标准**：
  - [x] 首屏 ≤ 5s（r64 L1：`POST validate` + `POST /api/v1/nfr/dashboard-first-screen/probe` mock elapsedMs=800 + budgetMs default 5000 + `DASHBOARD_FIRST_SCREEN_*` 错误域 + simulateSlow breach）
  - [x] companion ACL/probe 边界（r67：enterprise 越权 dashboardId 403、dashboardId 含空格 422；`probe_validate_first_screen_budget_ms`/`probe_first_screen_probe_budget_ms` ≤50ms）
  - [x] fe 首屏 P95 smoke（M5：`dashboard-first-screen.perf.smoke.test.tsx` 四类扩展 widget 首屏 P95 ≤3000ms + `test_nfr_001_first_screen_smoke.py`）
  - [x] M5 extended widget `fixtureProfile` on first-screen probe（M6 r219：`M5_EXTENDED_WIDGET_FIXTURE` map/heatmap/kpi/timeline + per-chartType render-spec mock）
  - [x] 并发压测报告（F-F companion：`tests/perf/nfr01_dashboard/` concurrent GET probe + `report.stub.md`；`tests/test_ff_track_e_view_nfr_e95d.py` T-NFR-E95D-001）
- **代码锚点**：`backend/app/core/nfr/dashboard_first_screen.py` · `backend/app/api/v1/nfr.py` · `tests/perf/nfr01_dashboard/` · `fe/src/pages/admin/dashboard/dashboard-first-screen.perf.smoke.test.tsx` · `tests/test_nfr_cat_r64.py` T-NFR-R64-001-01~06 · `tests/test_nfr_001_first_screen_smoke.py` · `tests/test_dash_nfr_conn_rpt_r67.py` T-NFR-R67-001-01~06 · `tests/test_ff_track_e_view_nfr_e95d.py`
- **演化建议**：M6 companion 已闭合 extended widget fixtureProfile 与 fe 首屏 P95 smoke；后续补真实首屏 perf suite 与并发压测报告
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [NFR-002] NFR-01 报表查询性能

- **状态**：已实现（M10 r234）
- **goal_ref**：goal.md §2.1（G1）
- **期次**：二期
- **描述**：NFR-01 报表查询性能（SRS 追溯项）。
- **验收标准**：
  - [x] 报表查询 ≤ 10s（r61 L1：`POST validate` + `POST /api/v1/nfr/report-perf/probe` + mock elapsedMs=120 + budgetMs default 10000 + `REPORT_PERF_*` 错误域）
  - [x] companion ACL/probe 边界（r67：enterprise 越权 reportId 403、非法 sampleQueryId 422、simulateFailure 降级；`probe_validate_report_perf_budget_ms`/`probe_report_perf_probe_budget_ms` ≤50ms）
  - [x] M10 REPORT_QUERY_FIXTURE + CI smoke（r234：`REPORT_QUERY_FIXTURE` + `fixtureProfile` 出参；`test_nfr_002_report_query_smoke.py` 2/2；`report-templates.smoke.test.tsx` mock run P95 ≤3000ms）
  - [x] `tests/perf/nfr01_report/` 全量并发压测与抽样门禁（F-F companion：`concurrent_probe.py` template run 探针；`tests/test_ff_track_e_view_nfr_e95d.py` T-NFR-E95D-002）
- **代码锚点**：`backend/app/core/nfr/report_perf.py` · `tests/perf/nfr01_report/` · `tests/test_nfr_002_report_query_smoke.py` · `fe/src/pages/admin/reports/report-templates.smoke.test.tsx` · `tests/test_cat_dash_viz_nfr_r61.py` T-NFR-R61-002-01~06 · `tests/test_dash_nfr_conn_rpt_r67.py` T-NFR-R67-002-01~06 · `tests/test_ff_track_e_view_nfr_e95d.py`
- **演化建议**：r234 闭合 REPORT_QUERY_FIXTURE、pytest smoke 与 FE P95 回归；全量并发压测 suite 留 companion
- **里程碑对齐**：M10 · 已完成 · 2026-07-07
### [NFR-003] NFR-02 核心看板可用性

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：二期
- **描述**：NFR-02 核心看板可用性（SRS 追溯项）。
- **验收标准**：
  - [x] SLA ≥ 99.5%（r62 L1：`POST /api/v1/nfr/dashboard-sla/probe` mock uptime 99.7% + breach 模拟 + `withinSla` 判定）
  - [x] 监控告警配置（r62 L1：`GET /api/v1/nfr/dashboard-sla/alerts` channels/threshold stub）
  - [x] companion enterprise ACL + dashboardId 校验 + alerts threshold + perf probe（r68：`set_user_dashboard_sla_scope` + `NFR_SLA_DASHBOARD_ID_INVALID`/`NFR_SLA_ALERTS_THRESHOLD_OUT_OF_RANGE` 422；enterprise scope 403；`probe_dashboard_sla_validate_budget_ms`/`probe_dashboard_sla_budget_ms` ≤50ms）
  - [x] 可用性复合报告 + strict 503（r247：`GET /api/v1/nfr/dashboard-availability/report` composite SLA+首屏 P95；`simulate_breach`；`docs/nfr/dashboard-availability.md`；T-NFR-R247-003-01~05）
  - [x] 核心看板批量 smoke + P95 阈值（r248：`GET /api/v1/nfr/dashboard-availability/smoke` `CORE_DASHBOARD_IDS`；strict breach 503；probe ≤50ms；T-NFR-R248-003-01~05）
  - [ ] 生产级 SLA 采集与 ops 告警联动（无真实 metrics store 与 PagerDuty 集成）
- **代码锚点**：`backend/app/core/nfr/dashboard_availability.py` · `docs/nfr/dashboard-availability.md` · `backend/app/api/v1/nfr.py` · `tests/test_mfinal_fe_gov_batch4_r248.py` T-NFR-R248-003-01~05 · `tests/test_mfinal_fe_gov_batch3_r247.py` T-NFR-R247-003-01~05
- **演化建议**：r248 闭合核心看板批量 smoke 与 P95 阈值断言；后续补生产 metrics 采集与 ops 告警全链路
- **里程碑对齐**：M-FINAL · F-F · 已完成 · 2026-07-07
### [NFR-004] NFR-03 HTTPS 脱敏审计

- **状态**：已实现（M6 audit guard L1）
- **goal_ref**：goal.md §2.1（G1）
- **期次**：一期
- **描述**：NFR-03 HTTPS 脱敏审计（SRS 追溯项）。
- **验收标准**：
  - [x] 全站 HTTPS（r64 L1：`GET /api/v1/nfr/https-audit/status` httpsEnforced/webhookHttpsOnly/tlsMinVersion stub）
  - [x] 敏感字段脱敏+审计（r64 L1：`POST /api/v1/nfr/https-audit/mask-probe` password/apiKey/token 脱敏 + maskedFields + auditLogged mock）
  - [x] companion auditScope ACL + simulateAuditFailure + perf probe（r68：`set_user_https_audit_scope` + `NFR_HTTPS_AUDIT_SCOPE_INVALID` 422；enterprise scope 403；`simulateAuditFailure` 503；`probe_https_audit_mask_budget_ms`/`probe_https_audit_status_budget_ms` ≤50ms）
  - [x] M6 HTTPS audit guard middleware + `GET /api/v1/nfr/https-audit/audit-probe` 响应脱敏无明文泄漏（`core/middleware/https_audit_guard.py` · `test_nfr_004_https_audit.py` T-NFR-004-M6-01~05）
  - [x] 国密应用层：SM4 凭证 + SM3 登录密码 + SM2 JWT（代码写死，无 env 切换）（`core/crypto/` · ADR-06/16/17 · `tests/test_crypto_sm4.py` · `tests/test_crypto_password_sm3.py` · `tests/test_crypto_jwt_sm2.py`）
  - [ ] 生产 TLS 终止与全链路审计 store（无 ingress 强制与持久化审计写入）
- **代码锚点**：`backend/app/core/nfr/https_audit.py` · `backend/app/core/crypto/` · `backend/app/core/middleware/https_audit_guard.py` · `backend/app/api/v1/nfr.py` · `tests/test_nfr_cat_r64.py` T-NFR-R64-004-01~06 · `tests/test_nfr_gov_rpt_view_r68.py` T-NFR-R68-004-01~09 · `tests/test_nfr_004_https_audit.py` · `tests/test_crypto_sm4.py` · `tests/test_crypto_password_sm3.py`
- **演化建议**：M6 L1 已闭合 audit guard middleware + audit-probe 无泄漏回归；后续补生产 TLS 强制与审计 store 全链路
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [NFR-005] NFR-04 连接器插件扩展性

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：四期
- **描述**：NFR-04 连接器插件扩展性（SRS 追溯项）。
- **验收标准**：
  - [x] 新增连接器不改核心（`register_connector_plugin` + ConnectorRegistry 零侵入守卫，r46 L1）
  - [x] GBase 登记路径 companion（`verify_zero_invasion` + `gbase_registration_path`，r51 companion）
  - [x] 扩展演练 API（r247：`GET /api/v1/nfr/plugin-extension/drill` drill_stub 注册 + zeroInvasion + teardown；T-NFR-R247-005-01~05）
  - [x] drill 连通/只读链 + core 模块不变断言（r248：`connectivityPassed`/`readonlyQueryPassed`；`assert_core_module_unchanged`；teardown 无 stub；probe ≤50ms；T-NFR-R248-005-01~04）
  - [ ] 第三方插件样例 PR（真实连接器扩展仓库演练）
- **代码锚点**：`backend/app/core/nfr/plugin_extension.py` · `backend/app/api/v1/nfr.py` · `tests/test_mfinal_fe_gov_batch4_r248.py` T-NFR-R248-005-01~04 · `tests/test_mfinal_fe_gov_batch3_r247.py` T-NFR-R247-005-01~05
- **演化建议**：r248 闭合 plugin drill 连通/只读链与 core 不变断言；后续补第三方插件样例 PR
- **里程碑对齐**：M-FINAL · F-F · 已完成 · 2026-07-07
### [NFR-006] NFR-05 浏览器与消息推送

- **状态**：已实现（M12 r238）
- **goal_ref**：goal.md §2.1（G1）
- **期次**：三期
- **描述**：NFR-05 浏览器与消息推送（SRS 追溯项）。
- **验收标准**：
  - [x] 主流浏览器兼容矩阵（`browser_matrix` ≥4 浏览器 + probe budget，r51 companion）
  - [x] 钉钉推送配置契约 + 降级路径（`push_config` + `push_channels` mock/降级，r46 L1 + r51 companion；企业微信 mock 通道已下线）
  - [x] 消息推送 API 骨架（r238：`POST/GET /api/v1/nfr/notifications` + 状态流转 + 404）
  - [x] 浏览器兼容矩阵文档（r238：`docs/nfr/browser-compatibility.md`）
  - [x] FE browserCompat smoke（r238：`browserCompat.ts` + `browserCompat.test.ts`）
  - [ ] 真实 SMS/邮件供应商集成（companion）
- **代码锚点**：`backend/app/core/nfr/push_config.py` · `backend/app/core/nfr/browser_matrix.py` · `backend/app/core/nfr/push_channels.py` · `backend/app/core/nfr/notifications.py` · `docs/nfr/browser-compatibility.md` · `fe/src/lib/browserCompat.ts` · `backend/app/api/v1/nfr.py` · `tests/test_m12_batch1_r238.py` T-NFR-R238-* · `tests/test_nfr_gov_conn_r51.py`
- **演化建议**：r238 闭合 notifications API、浏览器兼容文档与 FE smoke；真实 SMS/邮件供应商与 Admin UI 留 companion
- **里程碑对齐**：M12 · 已完成 · 2026-07-07
### [NFR-007] NFR-06 信创国产化

- **状态**：已实现
- **goal_ref**：goal.md §2.2（G2）
- **期次**：四期
- **描述**：NFR-06 信创国产化（SRS 追溯项）。
- **验收标准**：
  - [x] 信创 DB 按需连通（合规清单含 `registeredXinchuangConnectors` 含 gbase，r46 L1）
  - [x] 不合规项枚举与修复指引（`enumerate_non_compliant` + remediation，r51 companion）
  - [x] 部署验收报告（r247：`GET /api/v1/nfr/xinchuang/deployment-report` compose 服务清单 + 方言 readonly smoke；`docs/nfr/xinchuang-deployment.md`；T-NFR-R247-007-01~05）
  - [x] Markdown 格式 + EXPECTED_TYPES 对账（r248：`format=markdown`；`EXPECTED_XINCHUANG_TYPES` 与 F-C CONN-017~022 一致；schema 字段；probe budget；T-NFR-R248-007-01~04）
  - [ ] 全量信创认证与生产部署签收
- **代码锚点**：`backend/app/core/nfr/xinchuang.py` · `docs/nfr/xinchuang-deployment.md` · `backend/app/api/v1/nfr.py` · `tests/test_mfinal_fe_gov_batch4_r248.py` T-NFR-R248-007-01~04 · `tests/test_mfinal_fe_gov_batch3_r247.py` T-NFR-R247-007-01~05
- **演化建议**：r248 闭合 Markdown deployment-report 与 EXPECTED_TYPES 对账；后续补全量信创认证与生产签收
- **里程碑对齐**：M-FINAL · F-F · 已完成 · 2026-07-07
### [NFR-008] NFR-08 自主可控零 DE/SS

- **状态**：已实现
- **goal_ref**：goal.md §2.1（G1）
- **期次**：四期
- **描述**：NFR-08 自主可控零 DE/SS（SRS 追溯项）。
- **验收标准**：
  - [x] 生产无 Superset/DataEase 进程（r53 L1：`GET /api/v1/nfr/runtime-compliance` loaded-modules + pyproject 依赖扫描；非 OS 进程枚举）
  - [x] 依赖审计通过（pyproject-dependencies item + remediation；strict/permissive `POST assert`）
  - [x] 部署验收报告（r57 companion：`GET /api/v1/nfr/deployment-report` accepted/conditional/rejected + remediation_index；≤100ms）
  - [x] compose 禁入扫描（r249：`forbiddenComposeHits` 命中 superset/dataease 镜像 → `rejected`；始终 strict，无 permissive env）
  - [x] Markdown 部署报告（r249：`format=markdown` `text/markdown` 含 `## 零第三方 BI`；`docs/nfr/zero-de-ss-deployment.md`）
  - [x] 性能预算与 strict assert（r249：`probe_deployment_report_budget_ms` ≤100ms；`POST assert` strict 违规 → 503 `NFR_RUNTIME_VIOLATION`）
- **代码锚点**：`backend/app/core/nfr/runtime_guard.py` · `backend/app/core/nfr/deployment_report.py` · `backend/app/api/v1/nfr.py` · `docs/nfr/zero-de-ss-deployment.md` · `tests/test_dash_rpt_query_nfr_r53.py` T-NFR-R53-008-01~06 · `tests/test_dash_rpt_query_nfr_r57.py` T-NFR-R57-008-01~05 · `tests/test_mfinal_ff_fg_batch1_r249.py` T-NFR-R249-008-01~06
- **演化建议**：r249 闭合 compose 禁入、Markdown 报告与 strict 门禁链；后续补 CI 门禁集成与生产签收流程
- **里程碑对齐**：M-FINAL · F-F · 已完成 · 2026-07-07
