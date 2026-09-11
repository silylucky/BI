# VitalSpan — 技术架构

> **定位**：技术决策、目录约定、配置与环境变量；行为需求见 [SRS](srs/全生命周期系统需求规格说明书.md)，功能验收见 [PRD hub](automate/prd.md)。
> **维护**：架构或路由分层变更时同步本文件（见 `.cursor/rules/prd-sync.mdc` 文档同步总表）。

```yaml
version: 1.0.1
last_updated: 2026-08-17
status: bootstrap
srs_ref: docs/srs/全生命周期系统需求规格说明书.md
prd_ref: docs/automate/prd.md
```

---

## 1. 架构总览

```mermaid
flowchart TB
    subgraph client [客户端]
        WebApp[单应用 React /admin]
        EmbedUI[嵌入 iframe/SDK /embed]
    end
    subgraph api [FastAPI /api/v1]
        AuthMW[鉴权中间件]
        DSAPI[数据源 IF-06]
        QueryAPI[查询执行 M3-LITE]
        DashAPI[Dashboard/视图]
        GovAPI[治理 M8 四期]
    end
    subgraph platform [平台自研层]
        M7[M7 权限 RBAC+RLS]
        Conn[ConnectorRegistry]
        Engine[查询引擎 SQL+Native]
        Meta[M1 语义层 四期]
    end
    subgraph external [外部]
        DB[(多类别数据源)]
        Bus[数据交换总线]
    end
    WebApp --> AuthMW
    EmbedUI --> AuthMW
    AuthMW --> DSAPI
    AuthMW --> QueryAPI
    AuthMW --> DashAPI
    DSAPI --> M7
    QueryAPI --> M7
    QueryAPI --> Engine
    DSAPI --> Conn
    Conn --> DB
    Engine --> Conn
    GovAPI --> Bus
    Meta --> Engine
```

**建设原则**（摘自 goal / SRS）：

- BI 层全部自研；**零** Superset / DataEase 运行时依赖（NFR-08）
- 一至三期图表直连已废弃；**出图/出报表唯一路径**为 Dataset + `POST /query/dataset/execute`（见 §6.2）
- 四期：补齐 M1 Dataset 全量语义层、M2 设计器、M8 治理全自动

---

## 2. 技术决策（ADR 摘要）

| ID | 决策 | 理由 | 状态 |
|----|------|------|------|
| ADR-01 | 后端 **FastAPI** + OpenAPI 自动生成 | 与 FR-1.1 总线 OpenAPI 对齐；Python 生态适合 SQL/连接器 | 已定 |
| ADR-02 | 前端 **React + shadcn/ui + Radix + Tailwind v4** | SRS 已定目标栈；单应用主壳层 + Embed | 已定 |
| ADR-11 | 前端 **单应用 + RBAC 菜单**（非 `/portal` 双 URL） | 对标 DE/SS 权限模型；M1 兼容 `/admin/*`；见 `layout.md` ADR | 已定 |
| ADR-03 | 图表 **ChartEngine 抽象**；生产 **AntV**（G2Plot/G6/G2）；GIS 见 **ADR-12** | 业务层与具体库解耦；`buildEchartsOption` 仅测试/兼容 | 已定 |
| ADR-12 | **地图仅离线中国 GeoJSON**（GEO-IRON-01） | 政企内网/合规；零瓦片 CDN、零地图 Key；禁止境外与在线底图 | 已定 |
| ADR-13 | 前端 **`fe/src/components/charts/engine/`** 引擎端口 + registry | `CanvasChartHost` → `ChartEngineView`；`@antv/*` 仅 `engine/antv/**`；地图经 `GeoEnginePort`/`OfflineGeoPort` | 已定 |
| ADR-04 | **ConnectorRegistry** 插件式数据源 | NFR-04：新增类型不改核心服务与查询执行器 | 已定 |
| ADR-05 | 查询双路径：**SqlCapable** + **NativeQuery** | 关系型/OLAP 走 SQL；时序/文档/搜索走原生 DSL | 已定 |
| ADR-06 | 凭证 **SM4** 固定读写（纯国密） | NFR-03；无运行时算法切换；API 不返回明文密码 | 已定 |
| ADR-16 | 登录密码 **SM3** 哈希（纯国密） | 政企国密应用层 | 已定 |
| ADR-17 | 会话 JWT **SM2** 签名（废止 HS256） | `alg: SM2`；部署后须重新登录 | 已定 |
| ADR-07 | 平台元数据 **PostgreSQL / MySQL 8+ / SQLite** | 生产推荐 PG 或 MySQL（对标 DataEase）；SQLite 用于开发单文件；与业务分析库分离 | 已定 |
| ADR-08 | M8 工作流 **Flowable / Camunda** 二选一 | 四期治理 BPM；具体选型待 M13 前锁定 | 待定 |
| ADR-09 | M6 报表 **自研 RenderSpec** 统一 Web/PDF/Excel/Word 渲染 | 不引入 JasperReports；`reports/render/` + `reports/contract.py` | 已定 |
| ADR-10 | 演化指导库 **`.automate` submodule** | SOP/skills/agents 与产品代码分离；`install.sh` 同步至 `.cursor/` | 已部署 |
| ADR-14 | **组织组件库 `componentRef` 引用模式** | 单 widget 级复用；layout 仅存引用，payload 在 `viz_components`；保存时剥离内联配置 | 已定 |
| ADR-15 | **designer / gov query-design 双 API 收敛策略** | 短期保持双路由；中期抽取 `designer/translator` 公共模块；gov 委托 validate/preview | 已定 |
| ADR-18 | **看板定时 PDF 可视化导出（Playwright）** | G5 交付：BE 无头 Chromium 打开 FE `/export/*?token=` → `page.pdf()`；`artifactKind=visual_snapshot`；Playwright 为 optional 运行时依赖，非 Superset/DE 运行时 | 已定 |
| ADR-19 | **报表调度持久化与多通道投递** | `report_schedules` 等 ORM（rev 0032）；email 走邮箱；飞书按人工作通知；**钉钉走群机器人 webhook**；飞书 `notifyGroup` 才额外发群。企业微信通道已下线（Alembic `0063`） | 已定 |
| ADR-20 | **报表元数据持久化与真导出** | catalog/extension/prefab/templates ORM（rev 0034）；RenderSpec 真 PDF/Excel/Word | 已定 |

### ADR-15 · 查询设计器内核收敛（DESIGN-001 F-D）

**背景**：`/api/v1/designer/*`（四期查询设计器 + 快照/工单提交）与 `/api/v1/gov/query-design`（治理域可视化查询配置）在 validate / translate / preview 语义上重叠（DUP-01）。

| 维度 | `/api/v1/designer/*` | `/gov/query-design` |
|------|----------------------|---------------------|
| 用途 | Admin 设计器三面板 + 提交工单 | 治理 catalog 内可视化查询配置 |
| 存储 | designer snapshots / conditions / compute-rules | gov ref + `visual_query_design` |
| FE 入口 | `/admin/designer` | 治理工单链深链 |

**决策**：

- **短期（当前）**：保持双 API 与双 FE 页；不合并路由、不删 gov 端点。
- **中期（Phase 4）**：抽取 `backend/app/designer/translator/`；gov `query_design/service.py` 委托 designer validate + preview。
- **不做**：本里程碑不改动运行时行为；仅登记 ADR 供后续里程碑引用。

**代码锚点**：`backend/app/designer/` · `backend/app/governance/query_design/` · `fe/src/pages/admin/designer/DesignerPage.tsx` · `docs/automate/prd/F12-DESIGN.md` · `F10-GOV.md`

### ADR-18 · 看板/大屏可视化 PDF 导出（RPT-005 G5）

**背景**：定时报告附件原先为 `layout_inventory` 文字清单 PDF，不满足生产交付。

**决策**：

- BE `export_render.py` 使用 **Playwright Chromium** 访问 FE 无壳层路由 `/export/dashboard/:id?token=`（或 data-screen 对称路径），等待 `data-export-ready` 后 `page.pdf()`。
- 短期鉴权：`export_token`（5min TTL，内存签发）；公开 `GET .../export-layout?token=` 与 `POST .../export-query/execute`（`X-Export-Token` 头）。
- 产物枚举：`visual_snapshot`（默认）· `layout_inventory`（Excel 或 `RPT_EXPORT_FALLBACK=1` 降级）。
- **环境**：`FE_BASE_URL`（默认 `http://127.0.0.1:5173`，Windows 避免 `localhost` 命中其他 Vite）；可选 `FE_BASE_PATH`（Vite 子路径部署）；`docker compose up -d mailhog`（SMTP 1025 / UI 8025）；`pip install playwright && playwright install chromium`。
- **投递**：`delivery_adapter.py` 对 `visual_snapshot` 使用 `EmailMessage.add_attachment` 发送 PDF bytes（非 JWT 下载链接）。

**代码锚点**：`backend/app/dashboard/export_render.py` · `export_token.py` · `fe/src/pages/export/DashboardExportSnapshotPage.tsx` · `docs/feature-design/2026-08-03-report-center-delivery-closure.md`

### ADR-19 · 报表调度持久化与多通道投递（RPT-005 ToB）

**背景**：调度/执行/导出 job 原进程内内存，重启丢失；投递仅 SMTP 单附件。

**决策**：

- ORM 表：`report_schedules` · `report_schedule_executions` · `dashboard_export_jobs` · `export_tokens` · `report_schedule_tick_locks`（Alembic `0032`）。
- 存储切换：`RPT_SCHEDULE_STORE=memory|db`（**默认 `db`**；`memory` 仅测试显式注入；production/staging 启动时拒绝 `memory`）。
- 产物：`ARTIFACT_STORAGE_BACKEND=fs|memory`；`ARTIFACT_STORAGE_PATH` 本地卷。
- 权限：新增 `dashboard:schedule`；看板 owner + ACL `owner_id` 可管理本人定时计划。
- 投递：`delivery_channels` 支持 `email` · `dingtalk` · `feishu`（历史 `wecom` 调度执行时记 `skipped`）。邮件发给用户邮箱；**钉钉**发到平台对接保存的自定义机器人 webhook（`deliveryMode=group_webhook`，Alembic `0062`）；飞书发给 `user_im_bindings` 中该用户绑的账号（未绑号该通道失败，**禁止**回落到群 webhook）。飞书 `notify_group` 为真时才额外发 `PUSH_FEISHU_WEBHOOK`。Alembic `0047`；企业微信已删除（`0063`）。
- API：`PATCH /api/v1/reports/schedules/{id}`（仅 draft）。

**代码锚点**：`backend/app/reports/models.py` · `scheduler/store.py` · `artifact_store.py` · `scheduler/channels/`

### ADR-20 · 报表元数据持久化与真导出（RPT P3-SMOKE）

**背景**：catalog / extension / prefab / templates 原进程内 dict，重启丢失；IF-03 导出为最小占位 PDF。

**决策**：

- ORM 表：`report_catalog_nodes` · `report_catalog_owners` · `report_extension_configs` · `report_extension_revisions` · `report_prefab_bindings` · `report_template_definitions` · `report_integration_exports`（Alembic `0034`）。
- 存储切换：`RPT_METADATA_STORE=memory|db`（**默认 `db`**；`memory` 仅测试显式注入；production/staging 拒绝 `memory`）。
- 真导出：`reports/render/` RenderSpec → PDF（reportlab）/ Excel（openpyxl）/ Word（OOXML）；IF-03 与模板调度走 `export_template_bytes`。
- Dataset 桥接：extension metric 可选 `queryMode=dataset` + `datasetId` + `boundConfigId`，执行复用 `query/dataset/execute_config`。

**代码锚点**：`backend/app/reports/persistence/` · `backend/app/reports/render/` · `backend/app/reports/engine/execute.py`

### ADR-14 · 组织组件库（DASH-010）

- **引用**：`LayoutWidget.componentRef = { componentId, pinnedRevision?, detached? }`；运行时经 `resolveLayoutWidget` 合并 `payloadJson`
- **持久化**：已链接 widget 保存时剥离 `chartConfig` / `filterConfig` / `textConfig` / `mediaConfig`（`stripLinkedWidgetForPersist`）
- **编辑**：Inspector 修改链接组件写回 `PUT /api/v1/viz-components/{id}`；断链后本地化副本（`detached: true`）
- **与模板区分**：`viz-templates` 为整页 layout 信封；`viz-components` 为单 widget 级组织库
- **代码锚点**：`backend/app/viz/components/` · `fe/src/lib/resolveVizComponent.ts` · `fe/src/components/dashboard/VizReuseDialog.tsx`

### ADR-12 · GEO-IRON-01（地图铁律 · 双路径）

#### A. Choropleth（`map` / `map-3d`）

- **仅中国**：省级行政区（可省→市下钻，资产仍为离线 GeoJSON）
- **仅离线**：`GeoEnginePort` / `OfflineGeoPort` + 仓库内或平台分发的 `.json`；**禁止**运行时拉取瓦片 CDN
- **3D 地形纹理**（仅 `map-3d`）：离线 hillshade WebP 贴 Extrude 顶面；`pnpm run build:geo-terrain` → `fe/src/assets/geo/terrain/`；详见 [ui/map-texture.md](ui/map-texture.md)
- **禁止**：MapLibre / 瓦片底图 / 地图 Key（本路径）

#### B. GIS 图（`gis-map` · chartType）

- **引擎**：平台内 **薄 MapLibre**（`GisMapView` 懒加载 `maplibre-gl`）；**不做** iframe / sandbox / GeoLibre 整应用
- **底图**：**仅**管理员登记的全球 PMTiles（`basemap: "pmtiles"` + `tileServiceId`）；默认 `planet-z15`（本地演示登记 id）；**禁止**离线省界/空白底图、OpenFreeMap / 高德 / 天地图 / Cesium Ion
- **部署**：PMTiles 与 **glyphs/sprite** 由同一外部 HTTP 服务提供（`/basemaps-assets/`，见 `docker/pmtiles-tile-server/` · [pmtiles-tile-server.md](services/pmtiles-tile-server.md)）；**不**默认打公网字体 CDN。未选择全球底图时前端不请求该服务。`GET /api/v1/tile-services/{id}/resolve` 返回同机 URL。
- **配置**：layout 存 `nativeBody.gisProject`（`basemap` · `view` · 可选 `tileServiceId` · `labelLang` · `projection` · `fog` · `halo` · `layers[]` · legacy `overlay`）；加载时兼容读取旧 `geolibreProject`
- **纯底图模式**：不绑 Dataset 也可出图；Dataset 绑定为**可选叠加层**（经/纬字段 → 点位 GeoJSON）
- **AI**：vs-ai-spec **L1/L2** 产出 `gisProject` 补丁；禁止 L3 customViz 内嵌 MapLibre。L3 仅 `html`/`d3` runtime，使用平台注入的 `host.vsCv.d3`（d3@7.9.0），禁止内联 d3 整库
- **出数**：Dataset 查询在父页完成；引擎不持有 JWT（MapLibre `transformRequest` 不得带 `Authorization` / Cookie）
- **导出**：Playwright PDF 对 WebGL 不稳定 → 允许空白/静态降级（见 ADR-18 补充）
- **代码锚点**：`fe/src/components/charts/engine/maplibre/` · `backend/app/viz/tile_services/` · `backend/app/api/v1/tile_services.py` · `backend/app/viz/builtin/map.py`

#### 共用禁止

- 高德/天地图/腾讯/Mapbox/OSM 在线瓦片、AntV L7 在线 Scene、世界地图/境外行政区默认底图、地图 Key 配置项（`gis-map` 未登记服务时）
- **执行规则**：`.cursor/rules/geo-map-offline-china.mdc`（`alwaysApply: true`）

### ADR-17 · JWT SM2 签名（废止 HS256）

- **算法**：JWT Header `alg: SM2`；签名输入 `base64url(header).base64url(payload)`；SM3 摘要 + SM2 签名（`gmssl` `sign_with_sm3`）
- **密钥**：`JWT_SM2_PRIVATE_KEY`（64 hex）· `JWT_SM2_PUBLIC_KEY`（128 hex，须与私钥匹配）
- **废止**：`SECRET_KEY` + PyJWT HS256；部署切换后**所有旧 token 失效**，用户须重新登录
- **代码锚点**：`backend/app/core/crypto/sm2.py` · `backend/app/auth/jwt.py` · `scripts/generate-jwt-sm2-keys.py`

---

## 3. 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端 UI | React · shadcn/ui · Radix · Tailwind CSS v4 | 单应用主壳层（`/admin/*`） |
| 前端图表 | ChartEngine（生产 AntV） | `fe/src/components/charts/engine/`；registry 全 canvas→antv；地图见 ADR-12 |
| 后端 API | FastAPI · Pydantic v2 · Uvicorn | REST `/api/v1/*` |
| 平台库 | SQLAlchemy 2 · Alembic | 元数据 ORM + 迁移；`DATABASE_URL` 支持 PostgreSQL / MySQL 8+ / SQLite |
| 连接层 | ConnectorRegistry · SQLAlchemy 连接池 | 按 `dataSourceId` 隔离 |
| SQL 方言 | 每连接器 dialect 模块 | RLS 注入、LIMIT、转义 |
| Native 驱动 | influxdb-client · pymongo · elasticsearch | `mode=native` |
| 鉴权 | 自建 RBAC + RLS（M7） | 不照搬 Superset FAB |
| 调度 | Quartz / XXL-JOB（待定） | M6 三期 |
| 参考产品 | DataEase · Superset | **仅设计走查**，不部署 |

---

## 4. 仓库目录

### 4.1 顶层（现状 · 2026-07-03）

```
VitalSpan/
├── backend/                 # FastAPI 应用（骨架）
│   └── app/
│       ├── core/            # 配置、鉴权、日志；nfr/ 横切（插件扩展/推送/信创）
│       ├── datasources/     # 连接层 + ConnectorRegistry
│       │   └── dialects/  # 按 type 分目录（CONN-*）
│       └── query/           # M3-LITE 查询执行
├── fe/                      # React 单应用前端（M1 Admin 壳层已实现）
├── docs/
│   ├── arch.md              # 本文件
│   ├── api/                 # OpenAPI 端点索引 + 域可消费附录（auth/datasources/query）
│   ├── data/                # Alembic revision → 域表导航（head 0041）
│   ├── service/             # 后端运维：健康探针、配置、启动
│   ├── services/            # 域服务附录（随实现补充）
│   ├── srs/                 # 需求权威（SRS + 附录）
│   ├── automate/            # 演化文档 goal/prd/plan
├── tests/                   # 单元 / smoke（M1：health + me）
├── .automate/               # submodule：演化 SOP/skills/agents
├── .cursor/                 # 运行时：automate 同步 + 项目 rules
│   └── rules/               # vitalspan-project · fe-ui · backend-fastapi …
└── .agents/skills/          # 项目级 agent skills
```

### 4.2 后端目标布局（对齐 PRD 代码锚点）

```
backend/
├── app/
│   ├── main.py
│   ├── core/           # config, logging, TraceIdMiddleware；core/nfr/ 横切 NFR；鉴权委托 auth/
│   ├── api/v1/         # 路由聚合：datasources, query, dashboard, reports…
│   ├── auth/           # M7：roles, org, rls, audit
│   ├── datasources/    # registry, credentials, pool, metadata, dialects/*
│   ├── query/          # executor, binding, rls, dialects, dataset（四期）
│   ├── schemas/        # Pydantic：ChartViewConfig, QueryRequest…
│   ├── dashboard/      # M5 DashboardView
│   ├── views/          # FR-VIEW role/user templates
│   ├── reports/        # M6 engine, templates, scheduler
│   ├── metadata/       # M1 四期
│   ├── governance/     # M8 catalog, workflow, publish, bus
│   ├── ingestion/      # FR-DATA/FR-ETL：同步、清洗、调度（M1B）
│   └── designer/       # M2 四期
├── migrations/         # Alembic（当前 head **0064**，见 docs/data/README.md）
└── pyproject.toml      # （待建）依赖与工具配置
```

### 4.3 前端目标布局

> 壳层与 IA 见 [ui/layout.md](../ui/layout.md)；源码目录 **`fe/`**（见 fe-ui.mdc）。

```
fe/
├── src/
│   ├── app/            # 路由、布局壳层
│   ├── pages/          # dashboard, explore, entity-overview, theme-analysis
│   ├── components/
│   │   ├── ui/         # shadcn 基元
│   │   ├── charts/     # M4 图表 + registry + adapters
│   │   └── dashboard/  # M5 组件库
│   ├── embed/          # iframe
│   ├── sdk/            # 门户 JS SDK
│   └── lib/            # api client, theme
├── package.json
└── vite.config.ts      # （建议）Vite + React
```

> **M1 过渡布局（2026-07-03）**：Admin 壳层已落地于 `fe/src/layouts/AdminLayout.tsx` +
> `fe/src/routes.tsx`（`/admin` 路由）。目标态目录 `src/app/` 在二期壳层统一时迁移；
> 详见 `prd/F01-BOOT.md` BOOT-002 与 `docs/ui/layout.md`。

### 4.4 演化与 Agent 资产

| 路径 | 角色 |
|------|------|
| `.automate/` | submodule **源**；改 skills/SOP/agents 后执行 `install.sh` |
| `.cursor/automate/` | 运行时 Read 路径（skills、sop、templates） |
| `.cursor/agents/` | evolution-* subagent 定义 |
| `docs/automate/` | goal · prd · plan · evolution-state |

---

## 5. API 约定

### 5.1 通用规则

- 前缀：`/api/v1/`
- 认证：Bearer Token / Session（一期 BOOT-003 落地后细化）
- 只读查询：禁止经查询 API 写入外部数据源
- 破坏性变更：升 `v2`，旧版保留过渡期

### 5.2 一期核心端点（IF-06 + 查询）

| 方法 | 路径 | 模块 | PRD |
|------|------|------|-----|
| GET | `/api/v1/datasources/types` | 连接层 | DS-007 |
| GET/POST/PUT/DELETE | `/api/v1/datasources` | 连接层 | DS-002 |
| POST | `/api/v1/datasources/test` | 连接层 | DS-003 |
| POST | `/api/v1/datasources/{id}/test` | 连接层 | DS-003 |
| GET | `/api/v1/datasources/{id}/schemas` | 元数据 | DS-004 |
| GET | `/api/v1/datasources/{id}/tables` | 元数据 | DS-004 |
| GET | `/api/v1/datasources/{id}/columns` | 元数据 | DS-004 |
| POST | `/api/v1/query/execute` | M3-LITE | QUERY-001 |
| GET | `/health` | 运维 | BOOT-001 |

> 完整路由索引维护于 [`docs/api/README.md`](../api/README.md)（按域分表；实现后更新状态列）。

### 5.3 查询请求体（一至三期）

```json
{
  "dataSourceId": "uuid",
  "mode": "sql | table | native",
  "querySql": "SELECT …",
  "tableName": "schema.table",
  "nativeQuery": { },
  "params": { },
  "limit": 1000
}
```

执行链：`鉴权 → M7 数据源授权 → RLS 谓词注入 → 方言/Native 执行 → QueryResult`。

---

## 6. 领域模型（摘要）

### 6.1 外部数据源

```
DataSourceCategory → DataSourceType → ConnectionConfig → dataSourceId
```

类别：`relational | olap | timeseries | document | search | lake | api`

类型全量枚举见 SRS §3.2 FR-2.0 与 PRD `F04-CONN`。

### 6.2 查询与展现

**唯一出图/出报表路径 — Dataset execute（META-004 + QUERY-009）**

```
Dataset CRUD（ORM `datasets` 表）
  → bind-query-config（dataset_query 配置）
  → POST /query/dataset/execute（QueryExecutor 出数）
  → pandas 清洗（ingestion/etl_rules + datasets.transform_rules）
  → 图表 ChartViewConfig(mode=dataset, datasetId, configId) / 报表扩展指标
```

**pandas 落点**：同步写托管库前（`ingestion/sync_executor`）；**每次** Dataset execute 出数后在内存过 pandas（`query/dataset/pandas_transform.py`）。

**`POST /query/execute`（sql/table/native）**：仅保留给管理面表预览、连接器探针、集成 smoke 等非图表/报表业务；**禁止**图表与报表扩展指标调用。

**已废弃**：图表 `mode=sql|table|native`、`chart_query_bindings` 出图路径（QUERY-005 直连绑定 deprecated）。

### 6.3 权限（M7）

```
权限维度 → 维度分组 → 角色 → 用户
资源：数据源 / Dashboard / 报表 / 工单节点
```

---

## 7. 配置与环境变量

### 7.1 配置文件约定

| 文件 | 用途 | 提交 Git |
|------|------|----------|
| `backend/.env.example` | 环境变量模板 | ✅ |
| `backend/.env` | 本地/部署秘密 | ❌ |
| `fe/.env.example` | 前端 `VITE_*` 模板 | ✅ |
| `docker-compose.yml` | 本地平台库 + 托管分析库 + 样例连接器库（见 §9） | ✅ |

### 7.2 后端环境变量

> **无运行时功能开关**：算法（SM4/SM3）、NFR strict、报表 SMTP、信创门禁等行为在代码中写死；环境变量仅承载密钥、连接串与运营参数值。

| 变量 | 必填 | 说明 | 默认 |
|------|:----:|------|------|
| `VITALSPAN_ENV` | | 部署标识：`development` / `staging` / `production`（非功能开关） | `development` |
| `DATABASE_URL` | ✅ | 平台元数据库（PostgreSQL / MySQL 8+ / SQLite） | — |
| `JWT_SM2_PRIVATE_KEY` | ✅ | 国密 SM2 JWT 签名私钥（32 字节 hex） | — |
| `JWT_SM2_PUBLIC_KEY` | ✅ | 国密 SM2 JWT 验签公钥（64 字节 hex，未压缩点） | — |
| `CREDENTIAL_SM4_KEY` | ✅ | 国密 SM4 凭证加密 | — |
| `CORS_ORIGINS` | | 前端源，逗号分隔 | `http://localhost:5173` |
| `LOG_LEVEL` | | 日志级别 | `INFO` |
| `QUERY_DEFAULT_LIMIT` | | 查询硬上限 | `1000` |
| `QUERY_TIMEOUT_SECONDS` | | 单次查询超时 | `30` |
| `ANALYTICS_DATABASE_URL` | | 平台托管分析库（M1B 同步/清洗目标库） | — |
| `RPT_SMTP_HOST` | ✅* | 报表 SMTP 主机（`*` 生产 `VITALSPAN_ENV=production` 必填） | `localhost` |
| `RPT_SMTP_PORT` | | SMTP 端口 | `1025` |
| `RPT_SMTP_FROM` | ✅* | 发件人地址（生产必填） | `reports@vitalspan.local` |
| `RPT_SMTP_USER` | | SMTP 用户名（可选） | — |
| `RPT_SMTP_PASSWORD` | | SMTP 密码（可选） | — |
| `PUSH_DINGTALK_WEBHOOK` | | 钉钉**群** webhook（调度勾选钉钉，或 NFR mock 推送） | — |
| `PUSH_FEISHU_WEBHOOK` | | 飞书**群** webhook（仅调度勾选「同时发到群」） | — |
| `DINGTALK_APP_KEY` / `DINGTALK_APP_SECRET` / `DINGTALK_AGENT_ID` | | 遗留钉钉应用凭证（主路径已改为群机器人 webhook） | — |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | | 飞书应用消息（按人投递） | — |

### 7.3 前端环境变量

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 后端 API 根（生产 build）；本地 dev 走 Vite proxy 可不设 |

**写死的产品行为（无 env 开关）**：治理侧栏隐藏；看板像素画布始终开启；NFR/信创/compose 门禁始终 strict。

---

## 8. 安全与合规

| 项 | 实现要点 | NFR |
|----|----------|-----|
| 传输 | 生产全站 HTTPS | NFR-03 |
| 凭证 | SM4 加密存储（固定）；响应脱敏 | NFR-03 / ADR-06 |
| 登录密码 | SM3 哈希 | ADR-16 |
| 会话 JWT | SM2 签名 | ADR-17 |
| 查询 | 强制 LIMIT；参数化；RLS 注入 | M7 |
| 审计 | 权限变更、敏感操作写审计日志 | AUTH-008 |
| 依赖 | 禁止 GPL BI 运行时；信创连接器按需打包 | NFR-06/08 |

---

## 9. 本地开发

### 9.1 Compose 服务矩阵

| 服务 | 宿主机端口 | 库/用途 |
|------|-----------|---------|
| `postgres` | 5432 | 平台元库 `vitalspan`（`DATABASE_URL` 默认） |
| `meta-mysql` | 3309 | 平台元库 MySQL 8 备选（`DATABASE_URL=mysql://…@localhost:3309/vitalspan`） |
| `analytics-postgres` | 5433 | 托管分析库 `analytics`（`ANALYTICS_DATABASE_URL`；ingestion 同步目标） |
| `sample-mysql` | 3307 | 样例 OLTP `sample_db`（启动增量迁移 `vs_official_*`；元库 code **`demo`** / 「示例数据」） |
| `sample-mariadb` | 3308 | MariaDB 连接器集成测 |
| `sample-clickhouse` | 8124 | ClickHouse 连接器集成测 |
| `sample-timescaledb` | **5434** | 运维时序样例 **`ops_tsdb`**（TimescaleDB；CONN-013 演示，**非** 5433） |

> **端口分工**：`5433` = 托管分析库；`5434` = TimescaleDB 专用样例源。详见 `docker/sample-timescaledb/README.md`。

### 9.3 数据库备份

```powershell
# Windows：备份 compose 全部数据服务 → data/backups/<timestamp>/
python scripts/backup-databases.py
# 或 .\scripts\backup-databases.ps1
```

恢复须同时保管 `keys-checklist.txt` 中列出的密钥（含 `JWT_SM2_*` / `CREDENTIAL_SM4_KEY`）。

### 9.2 启动步骤
```bash
# 1. 平台依赖（按需启子集，如仅 mysql + analytics）
docker compose up -d

# 可选：运维时序样例库 + 灌数（约 7 天 ~160 万行）
docker compose up -d sample-timescaledb
python scripts/seed-ops-timescaledb.py   # 或 .\scripts\seed-ops-timescaledb.ps1

# 2. 后端
cd backend
cp .env.example .env
# 生成 SM4 密钥: python -c "import secrets; print(secrets.token_hex(16))"
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. 前端
cd fe
cp .env.example .env
pnpm dev            # 默认 :5173
```

一期冒烟（P1-SMOKE）：MySQL/PG 建源 → SQL → Dashboard 出数 + 越权失败。  
三期冒烟（P3-SMOKE）：TimescaleDB `sample-timescaledb:5434` 建源 → hypertable 元数据浏览 → 图表出数。

### 9.4 健康检查与探针

| 路径 | 鉴权 | 说明 |
|------|------|------|
| `GET /health` | 免鉴权 | 进程存活；返回 `{"status":"ok"}` |
| `GET /sample-api/health` | 样例 API 配置 | REST 连接器联调（见 `integration.md`） |

**无独立 readiness 端点**：`/health` 不探测元库连通性。编排建议 liveness 用 `/health`；readiness 另做迁移门禁 + 带 token 冒烟（详见 [service/backend.md](service/backend.md)）。

---

## 10. 文档索引

| 文档 | 内容 |
|------|------|
| [srs/README.md](srs/README.md) | 需求权威（SRS + 附录） |
| [全生命周期系统需求规格说明书.md](srs/全生命周期系统需求规格说明书.md) | SRS 主文档 |
| [automate/goal.md](automate/goal.md) | 产品方向与边界 |
| [automate/prd.md](automate/prd.md) | 功能真理源 hub（129 项） |
| [automate/plan.archive.md](automate/plan.archive.md) | 里程碑 M1–M13 |
| [automate/plan.md](automate/plan.md) | 活跃里程碑（当前 **P1–P3**；节 **M-FE-1**） |
| [api/README.md](api/README.md) | API 端点一行索引 |
| [api/auth.md](api/auth.md) · [datasources.md](api/datasources.md) · [query.md](api/query.md) | 联调可消费附录（Postman/网关） |
| [data/README.md](data/README.md) | 平台元库 Alembic head 与域 ↔ 表 |
| [service/backend.md](service/backend.md) | 后端运维：配置、健康、本地启动 |
| [services/README.md](services/README.md) | 域服务附录（随实现补充） |
| [ui/layout.md](ui/layout.md) | 壳层与信息架构（单应用 + Embed） |
| [ui/map-texture.md](ui/map-texture.md) | 3D 地图离线 hillshade 纹理管线（`map-3d`） |
| [superpowers/README.md](superpowers/README.md) | 演化轮次 design/plan 产出（G2–P3） |
| [README.md](README.md) | 文档总索引（分层与快速跳转） |
| `AGENTS.md` | 代理协作与环境选源（仓库根） |
| `.dev/config.yaml` | 本项目环境地图与走查配置（密钥见 `.dev/secrets.env`） |
| `.cursor/rules/` | Cursor 项目规则（见下表） |

### Agent 规则索引

| 规则 | 职责 |
|------|------|
| `project.mdc` | 会话启动、任务路由、目录铁律 |
| `production.mdc` | 生产红线：国密、观测、弹性、RBAC、迁移、测试 |
| `engineering.mdc` | 体量、API 信封、分层依赖 |
| `delivery.mdc` | 打包/部署门禁；`.dev` 与 `$HOME/.dev` 分工 |
| `vitalspan-project.mdc` | 项目身份摘要 |
| `common.mdc` | 公共复用清单 |
| `backend-fastapi.mdc` · `fe-ui.mdc` | 栈专项 |
| `prd-sync.mdc` · `docs-layer.mdc` | 文档同步与编辑边界 |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.3 | 2026-08-09 | ADR-19/20 入 §2 摘要表；§9.4 健康探针；登记 `docs/data` · `docs/service` · API 可消费附录 |
| 1.0.2 | 2026-07-03 | FR-DATA/FR-ETL 纳入 M1B；增 ingestion 域与 ANALYTICS_DATABASE_URL |
| 1.0.3 | 2026-07-03 | ADR-11 单应用 + RBAC；架构图 WebApp + Embed；废止双 URL 双端 |
| 1.0.4 | 2026-07-17 | §9 compose 六服务；§6.2 双查询路径（直连 + Dataset）；Dataset 已落地说明 |
| 1.0.5 | 2026-07-30 | ADR-15 designer/gov query-design 收敛策略（DESIGN-001 F-D） |
| 1.0.6 | 2026-07-31 | §10 增文档总索引、`.dev`、Agent 规则索引 |
| 1.0.7 | 2026-07-31 | ADR-17 JWT SM2；废止 Fernet/bcrypt/HS256；§7.2 环境变量国密化 |
