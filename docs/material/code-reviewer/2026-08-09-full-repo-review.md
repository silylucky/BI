# VitalSpan 生产就绪 / 产品体验评审 · 2026-08-09

## 总览

| 项 | 内容 |
|----|------|
| 范围 | **整仓** |
| Stack Card | Python FastAPI + SQLAlchemy/Alembic · React 19 Vite SPA (`fe/`) · docker-compose · GitHub Actions CI |
| 扫描方式 | 并行 lane：L1–L5、L7、L8（subagent）+ ast-grep scan + codegraph status；L6 主 agent 快扫 |
| 证据层 / 外部依赖 | **无** `.evidence/`（Blind spot）；仓外依赖 10+，缺 live smoke 工件多数 |
| Blind spots | 无证据层；L7 无运行时走查；L1 全仓宽 rg 部分超时（backend/fe 已深扫） |
| P0 / P1 / P2 | **8 / 18 / 12**（合并去重后） |
| 建议 | **暂缓上线** — 修完 P0 后再评估；PRD「129 项全交付」与治理/NFR 假绿叙事冲突 |
| 回传 status | **BLOCKED** |
| 已排除非问题 | 默认超管 seed、测试双、离线地图 Geo placeholder、治理 FE 诚实横幅、dev-only 路由 |

**一句话结论**：主分析路径（连接→看板/大屏→报表→嵌入）表面基本可用；**NFR 推送/可用性探针、治理总线 InMemory、dataset execute-plan stub** 构成严重假绿；对外宣称与 H1 治理隐藏、元数据无菜单等存在产品表面张力。

### Stack Card（摘要）

- 形态：单仓 · 后端 `backend/app/` · 前端 `fe/src/`
- scan_tools: **ast-grep + codegraph + rg**
- 标杆 UI：`DashboardListPage` / `DatasourceListPage` / `VizComponentsHubPage` + `list-page-kit`
- 宣称材料：`docs/automate/prd.md`（129/129）、`docs/api/README.md`、`README.md`
- 宣称客户端：Web Admin SPA + embed/export 路由
- 跳过 lane：L6 仅快扫 CI（无 Helm/K8s 全量 IaC）

---

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| 证据层 | 未读 | `.evidence/` | 目录不存在；无法 gate-check 验真 |
| L7 | 静态对账 | 运行时角色走查、权限矩阵实测 | 未登录 admin/analyst/viewer 验证 |
| L1 | 部分 | 全仓宽模式 rg 超时 | `backend/app` + `fe/src` 已深扫；`scripts/` `.tmp/` 浅扫 |
| L6 | 快扫 | Helm/charts 全量 | 仅有 `docker-compose.yml` + `.github/workflows/ci.yml` |

---

## P0 Findings

### P0-1 · NFR 推送 `dispatch_push_mock` 配置 webhook 仍假成功

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / **隐式假通** |
| 证据 | `backend/app/core/nfr/push_channels.py` L29–57 — `_mock_send` 仅校验 URL 格式，写日志后 `return True` → `delivered`；调用链：`nfr.py`、`governance/publish/notifications.py`、`core/nfr/notifications.py` |
| 为何致命 | 配置企微/钉钉 webhook 后监控/治理显示「已投递」，实际零 HTTP 外发 |
| 建议修法 | 删除 mock 主路径；未配通道返回 `failed`；已配走 `reports/scheduler/channels/dispatch.py` 同款 httpx |
| 可批量 | 是（批次 A） |

### P0-2 · 治理总线默认 `InMemoryBusAdapter` 假注册成功

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / 产品表面 |
| 证据 | `integration/bus_adapter_factory.py` L21–22 → `InMemoryBusAdapter`；`governance/bus/adapter.py` 返回 `status=succeeded`；`governance/bus/pipeline.py` `trigger_auto_bus_register` |
| 为何致命 | 目录发布 API 可对客户返回「总线注册成功」，无真实外部总线 |
| 建议修法 | 无真实适配器时返回 `deferred/unconfigured`；InMemory 限测试夹具 |
| 可批量 | 是（批次 A） |

### P0-3 · 看板可用性 API 基于硬编码 mock 返回 `available`

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub |
| 证据 | `core/nfr/dashboard_sla.py` 固定 uptime 99.7%；`dashboard_first_screen.py` 固定 elapsed；`dashboard_availability.py` `within_fs` 比预算阈值而非实测；`api/v1/nfr.py` GET smoke/report → `allAvailable` |
| 为何致命 | SLA/首屏探针可被验收脚本当真实 SLO |
| 建议修法 | 接真实指标；未就绪 501/degraded；修复 `within_fs` 逻辑 |
| 可批量 | 是（批次 A） |

### P0-4 · PRD「129 项全交付」vs 治理域 H1 隐藏 + 诚实横幅

| 字段 | 内容 |
|------|------|
| 类别 | 产品表面 / 假绿·stub |
| 证据 | `prd.md` 129/129；`nav-manifest.tsx` `requiresGovNav` + `gov-nav.ts` 恒 `false`；`GovernanceHonestyBanner`「未对接真实总线」；路由仍可达 |
| 为何致命 | 对外宣称与客户端可达性/诚实文案冲突，交付验收易争议 |
| 建议修法 | 客户交付：接真实总线并恢复侧栏；或 PRD/README 降级为 companion/工程探查 |
| 可批量 | 否（需产品裁定） |

### P0-5 · `dataset/execute-plan` 四步全 pass + stub 文案（与 L3 合并）

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub |
| 证据 | `query/dataset/executor.py` L23–28 `detail="stub plan ready"`；`api/v1/query.py` POST `/dataset/execute-plan` |
| 为何致命 | 契约像完整执行计划校验，不触达 SQL/ACL |
| 建议修法 | 删除 stub 或 HTTP 501 + `status: stub`；与 execute 合并 |
| 可批量 | 是（批次 A） |

### P0-6 · REST OAuth2 schema 占位无 token 流（L8 升级）

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 |
| 证据 | `datasources/schemas.py` 声明 `oauth2`；`rest_api.py` 对 oauth2 不设 Authorization |
| 为何致命 | 契约暗示 OAuth2 可用，运行时等同无认证 |
| 建议修法 | 未实现前从 schema/UI 移除或标 `planned` |
| 可批量 | 是（批次 A2） |

### P0-7 · S3 制品存储 docstring 承诺 stub 无实现

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 |
| 证据 | `reports/artifact_store.py` 注释 "optional S3 stub"；仅 fs/memory；`raise NotImplementedError` 于抽象基类 |
| 为何致命 | 运维按注释配置 S3 预期会 silent 落本地 |
| 建议修法 | 删除注释或实现；health 返回 `unconfigured` |
| 可批量 | 是（批次 A2） |

### P0-8 · 双轨推送：调度 httpx 真发 vs NFR mock 假发

| 字段 | 内容 |
|------|------|
| 类别 | 隐式假通 |
| 证据 | `reports/scheduler/channels/dispatch.py` 真实 httpx；`push_channels.dispatch_push_mock` 同名 env 变量语义不同 |
| 为何致命 | 同一 `PUSH_WECOM_WEBHOOK` 在两路径行为分裂，集成方易误判 |
| 建议修法 | 收敛为同一 HTTP 出站层或 NFR 探针显式 `mode: mock` |
| 可批量 | 是（批次 A，与 P0-1 同批） |

---

## P1 Findings（精选合并）

### P1-1 · 生产门禁未拦截弱口令 `changeme` + demo 种子默认开
- **证据**：`core/config.py` `enforce_production_safety` 不检查 `vitalspan_dev_admin_password`；`ensure_official_demo_datasource/workspace_instances` 默认 True
- **建议**：production 拒绝 changeme；默认关闭 demo/workspace 种子

### P1-2 · `/sample-api` 全环境绕过鉴权
- **证据**：`auth/middleware.py` L163；`sample_api/internal.py` 内存订单样例
- **建议**：production/staging 不挂载或 env 门禁

### P1-3 · 仅 `/health` 静态 ok，无 readiness 分离
- **证据**：`main.py` GET `/health`；无 `/ready`/`/live`
- **建议**：新增 readiness 探测元库/调度器

### P1-4 · 同步拉数 / Hive/CH/Influx 缺查询级超时
- **证据**：`ingestion/sync_fetch_*.py`；`dialects/hive.py` 等
- **建议**：透传 `connect_timeout_sec`/`statement_timeout`

### P1-5 · RLS 降级为 `1=0` 空集 vs 登录 DB 故障映射 401
- **证据**：`query/rls/guard.py`；`auth/login/service.py`
- **建议**：生产 fail-fast 503；区分 AUTH_UNAVAILABLE

### P1-6 · 物理表血缘 API 永久 `lineage_stub`
- **证据**：`metadata/physical/gov_refs.py` `stub: True`；`api/v1/metadata.py`
- **建议**：501 + 文档标明非交付

### P1-7 · 元数据 Hub / 实体总览 / 主题分析无侧栏入口
- **证据**：`MetadataHubPage` 路由存在；`layout.md` 移出侧栏；`EntityOverviewPage` 深链 only
- **建议**：恢复「语义层」入口或客户手册写深链

### P1-8 · RLS dimension-values API 无 FE
- **证据**：API `PUT /roles/{id}/dimension-values`；`RlsRoleBindingPanel` 仅 groups
- **建议**：补直绑 UI 或文档声明仅分组

### P1-9 · 报表批量导出 API 无 FE
- **证据**：`POST /reports/batch/export`；无 jobs 轮询 UI
- **建议**：报表中心补批量导出任务面板

### P1-10 · 坏表单：文件数据源手填服务端 path（L4-01）
- **证据**：`FileSourceConnectionFields.tsx` required 绝对路径
- **建议**：上传 API + 自动回填 path

### P1-11 · JSON 导入主路径三处 JSON.parse（L4-05~07）
- **证据**：`BatchImportPanel`、`VizTemplatesHubPage`、`DataScreenListPage`
- **建议**：导入向导 + schema 校验

### P1-12 · 报表/治理/同步页未对齐 list-page-kit（L5 合并 5 项）
- **证据**：`ReportCenterPage`、`GovernancePublishPage`、`SyncJobsPage` 等 vs `DashboardListPage`
- **建议**：套 `ListPageSection` + `ListPageToolbar`

### P1-13 · 企微/钉钉 scheduler 通道无 live webhook smoke
- **证据**：`channels/dispatch.py` 有 httpx；测试全 patch
- **建议**：补 `@pytest.mark.integration` live smoke

### P1-14 · 30+ DB 连接器 CI 可全绿零外部触达
- **证据**：compose live 测试 port 不可达即 skip
- **建议**：contracts 登记 + 门禁核对 smoke 非 none

### P1-15 · ingestion 进程内调度无持久队列
- **证据**：`ingestion/scheduler.py` APScheduler + BackgroundTasks
- **建议**：持久作业表 + worker claim

### P1-16 · 信创报告 `accepted` 含 `status: stub` 组件
- **证据**：`core/nfr/xinchuang.py`；`api/v1/nfr.py`
- **建议**：stub 组件 → conditional

### P1-17 · 报表引擎 API `ready` + `placeholder: true` 并存
- **证据**：`reports/engine/service.py`；`ReportViewPage` 有诚实 UI 但 API 可误导集成
- **建议**：无数据时顶层 `incomplete/degraded`

### P1-18 · `contracts/` 缺失，仓外依赖无强制对账
- **证据**：无 `contracts/` 目录
- **建议**：建立 `contracts/external-deps.yaml`

---

## P2 Findings（紧凑列表）

- 开发国密密钥在 `.env.example`（有 production 门禁）— 文档提醒
- `scripts/repair_dashboard_datasource_ids.py` 硬编码 admin/changeme
- `.tmp/` 部署脚本明文 SSH（仓库卫生）
- 设计器/报表 SQL Textarea 主配置（power-user 可接受，建议降为高级 Tab）
- `AccountLandingPage` 卡片风格 vs 列表域分裂（可文档化第二标杆）
- `DevChartsPage` 裸 h1（dev 路由可豁免）
- NFR 全域无 Admin UI（运维向，预期）
- `auth/logout` API 规划、FE 仅清 token（P2 规划缺口）
- Playwright live 非 `$HOME/.dev` 台账驱动

---

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 默认超管 seed + changeme 开发默认 | 首次启动预期；production 应强制改密（见 P1-1） |
| 离线中国地图 Geo placeholder | ADR-12 设计如此，有 hint |
| 治理 FE `GovernanceHonestyBanner` | 诚实失败，非假绿 |
| `vi.stubGlobal` / `*.test.*` mock | 测试双 |
| 调度 mock 需 `X-Rpt-Execute-Mock` header | 显式测试门闩 |
| KPI 来自 sample_db SQL 绑定 | 非前端硬编码假数；风险在 demo 种子默认开（P1-1） |

---

## 建议修复批次（待确认）

| 批次 | 含 finding | 预估 | 说明 |
|------|------------|------|------|
| **A 假绿/stub 清零** | P0-1,2,3,5,8 | M | 删 mock + 接真实现或撤路由 |
| **A2 隐式假通** | P0-6,7 + P1-13,14,18 | M | smoke 工件 + OAuth/S3 诚实化 |
| **B 产品表面** | P0-4 + P1-6,7,8,9 | M | 话术统一 + 补入口或撤宣称 |
| **C 门禁与可靠性** | P1-1,2,3,4,5,15 | M | production safety + health + 超时 |
| **D 坏表单** | P1-10,11 | M | 上传向导 + JSON 导入向导 |
| **E 风格对齐** | P1-12 | M | list-page-kit 对齐 |
| **F P2** | P2 列表 | S | 能安全修则修 |

**请回复要执行的批次**（如「做 A+C」或「全部 P0」）。确认前不改代码。

---

## 集成研究建议

- **P0-2, P0-4**（治理总线 / 外部 ESB）→ `integration-research`；本批可选：撤治理侧栏入口直至研究完成
- **P0-6**（OAuth2 REST 连接器）→ `integration-research`；或从 schema 移除 oauth2
- **P0-1, P0-8**（企微/钉钉推送）→ 可优先收敛到已有 `dispatch.py` httpx 路径，无需外部研究

---

## 回传 YAML

```yaml
status: BLOCKED
phase: code-reviewer
mode: review
fix_mode: confirm
scope: full_repo
report: docs/material/code-reviewer/2026-08-09-full-repo-review.md
auto_fixed: []
remaining: [P0-4, P1-7, P1-8, P1-9]
coverage:
  blind_spots:
    - "证据层 | .evidence/ 不存在 | 无法 gate-check"
    - "L7 | 运行时角色走查 | 仅静态对账"
    - "L1 | scripts/.tmp 浅扫 | 宽 rg 超时"
  evidence_read: false
external_deps:
  - {name: NFR推送mock, smoke: none, finding: P0-1}
  - {name: 企微钉钉scheduler, smoke: patch-only, finding: P1-13}
  - {name: SMTP, smoke: test_g5_live_export.py, finding: ""}
  - {name: S3制品, smoke: none, finding: P0-7}
  - {name: REST OAuth2, smoke: none, finding: P0-6}
  - {name: 治理总线, smoke: in-memory-only, finding: P0-2}
  - {name: 30+DB连接器, smoke: optional-compose-skip, finding: P1-14}
evidence:
  cr: ""
  gate_findings: []
blockers:
  - "8 项 P0 假绿/隐式假通未修"
  - "无证据层无法验真宣称 vs 事实"
  - "PRD 129/129 与治理/NFR 表面冲突需产品裁定"
```
