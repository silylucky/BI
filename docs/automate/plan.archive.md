# VitalSpan — 演化里程碑归档（M1–M13）

> **归档层**：全量里程碑定义与 PRD ID 映射；**只读参考**，不随每轮演化自动改写。
> **活跃计划**：见 [`plan.md`](./plan.md)（可选；`create-evolution-plan` 人工维护当前节）。
> **来源**：[`docs/srs/`](../srs/README.md) SRS V3.7 §8 四期交付 + 附录 F 追溯矩阵 + PRD **124** 项（含 F16/M1B）。

```yaml
version: 1.0.0
last_updated: 2026-07-03
archive: true
milestone_range: M1-M13
prd_item_count: 124
srs_ref: docs/srs/全生命周期系统需求规格说明书.md#8-实施分期
```

## 分期对照

| 归档里程碑 | SRS 期次 | 核心交付 |
|------------|----------|----------|
| M1 | P0 | 工程基线 |
| M1B | P0+ | FR-DATA/FR-ETL 托管分析库、同步、轻量清洗 |
| M2–M6 | 一期 | 关系型直连查询闭环 + P1-SMOKE + 总线 PoC |
| M7–M10 | 二期 | OLAP 扩展 + 实体总览 + 主题/报表 + 角色视图 |
| M11–M12 | 三期 | 原生连接器 + 完整图表 + 调度与用户视图 |
| M13 | 四期 | Dataset 语义层 + 治理闭环 + 总线全自动 |

---

## M1 — P0 工程基线

**目标**：前后端可联调、鉴权与迁移骨架就绪。

**SRS**：P0-BOOTSTRAP · **验收**：附录 F P0

- [ ] BOOT-001: FastAPI 工程骨架
- [ ] BOOT-002: React 管理端壳层
- [ ] BOOT-003: 鉴权中间件骨架
- [ ] BOOT-004: 配置与日志基线
- [ ] BOOT-005: 数据库迁移框架
- [ ] BOOT-006: CI 与质量门禁

---

## M1B — 数据接入与清洗（FR-DATA / FR-ETL）

**目标**：L1 同步+清洗闭环（内联 SourceConnection → 托管分析库）；L2 dataSourceId 登记 + SQL 出数见 M3/M4。

**SRS**：FR-DATA · FR-ETL §3.6 · **验收**：DATA-SMOKE L1

- [x] DATA-004: 托管分析库与配置项
- [x] DATA-001: 同步任务模型与 API
- [x] DATA-002: 同步执行器
- [x] ETL-001: 清洗规则引擎（轻量）
- [x] DATA-003: Admin 配置台页面
- [x] DATA-005: 端到端验收与文档回写

---

## M2 — 权限地基（M7-RLS）

**目标**：可配置 RBAC + 多维 RLS 谓词注入链就绪。

**SRS**：FR-8.1、FR-1.6、M7-RLS · **验收**：越权 smoke test

- [ ] AUTH-001: RoleRegistry 角色注册
- [ ] AUTH-002: 组织树配置
- [ ] AUTH-003: 用户角色绑定
- [ ] AUTH-004: 资源授权绑定
- [ ] AUTH-005: 权限维度类型定义
- [ ] AUTH-006: 权限维度分组与角色关联
- [ ] AUTH-007: RLS 谓词生成与注入
- [ ] AUTH-008: 操作审计日志

---

## M3 — 数据源平台与关系型连接器（一期）

**目标**：MySQL/PostgreSQL 建源、连通性测试、元数据浏览。

**SRS**：FR-2.0 · **验收**：P1-SMOKE 前置

- [ ] DS-001: ConnectorRegistry 插件注册表
- [ ] DS-002: 数据源 CRUD API
- [ ] DS-003: 连通性测试
- [ ] DS-004: Schema 元数据浏览
- [ ] DS-005: 凭证加密存储
- [ ] DS-006: 连接池按 dataSourceId 隔离
- [ ] DS-007: 已注册类型清单 API
- [ ] DS-008: 数据源授权与 M7 集成
- [ ] CONN-001: MySQL 连接器
- [ ] CONN-002: PostgreSQL 连接器

---

## M4 — 轻量查询与图表直连（M3-LITE）

**目标**：SQL/表查询执行、RLS 注入、FR-2.0b 直连绑定。

**SRS**：M3-LITE、FR-2.0b · **验收**：查询可返回且越权失败

- [ ] QUERY-001: M3-LITE SQL 只读执行
- [ ] QUERY-002: 物理表 mode=table 查询
- [ ] QUERY-005: 图表直连绑定 FR-2.0b
- [ ] QUERY-006: RLS 注入执行链

---

## M5 — 最小图表与 Dashboard（M4-MIN / M5）

**目标**：表格/折线/柱可渲染；空 Dashboard 可创建展示。

**SRS**：M4-MIN、M5-DASHBOARD、FR-VIEW-1 · **验收**：组件可出数

- [ ] VIZ-001: ChartViewConfig 协议
- [ ] VIZ-002: 最小图表集 M4-MIN
- [ ] DASH-001: DashboardView 数据模型
- [ ] DASH-002: Dashboard 容器与布局引擎
- [ ] DASH-003: Dashboard 组件库
- [ ] VIEW-001: DashboardView 视图协议 FR-VIEW-1

---

## M6 — 一期集成验收与总线 PoC

**目标**：P1-SMOKE 端到端通过；附录 E 三分法 PoC + ≥2 API 注册。

**SRS**：P1-SMOKE、FR-1.1-PoC、NFR-01/03 · **验收**：§9.1 一期必过项

- [ ] API-001: IF-06 数据源管理 API
- [ ] API-002: IF-06 查询执行 API
- [ ] API-007: OpenAPI 规范与版本策略
- [ ] GOV-001: 查询接口分类 catalog 附录 E
- [ ] GOV-002: 总线 PoC 半自动注册 FR-1.1
- [ ] CAT-001: CAT-01 实体生命周期查询类
- [ ] CAT-002: CAT-02 统计分析聚合类
- [ ] CAT-003: CAT-03 地域维度查询类
- [ ] NFR-001: NFR-01 Dashboard 首屏性能
- [ ] NFR-004: NFR-03 HTTPS 脱敏审计

---

## M7 — 数据源类型扩展（二期·关系型/OLAP）

**目标**：扩展 MariaDB/SQL Server/Oracle/SQLite/ClickHouse 等连通 + 只读查询。

**SRS**：FR-2.0-EXT 二期 · **验收**：§9.1 二期 FR-2.0-EXT

- [ ] CONN-003: MariaDB 连接器
- [ ] CONN-004: SQL Server 连接器
- [ ] CONN-005: Oracle 连接器
- [ ] CONN-006: SQLite 连接器
- [ ] CONN-007: ClickHouse 连接器
- [ ] CONN-008: Apache Doris 连接器

---

## M8 — 实体元数据与总览页

**目标**：物理表/字段登记；实体总览统计/下钻/口径一致。

**SRS**：M1-ENTITY-MODEL、FR-6.2 · **验收**：附录 F FR-6.2

- [ ] META-005: 物理表元数据登记 M1-ENTITY
- [ ] META-006: 实体类型 schema 配置
- [ ] DASH-004: 全局筛选器联动
- [ ] DASH-005: 实体总览页 FR-6.2

---

## M9 — 主题分析与预制报表

**目标**：GIS/时间域主题分析；预制分析报表体系可查阅。

**SRS**：FR-4.1、FR-3.1 · **验收**：§9.1 二期 FR-3.1/4.1

- [ ] DASH-006: 可配置实体主题分析 FR-4.1
- [ ] RPT-001: 报表引擎渲染
- [ ] RPT-002: 预制分析报表体系 FR-3.1

---

## M10 — 报表模板与角色默认视图

**目标**：Word/Excel/PDF 模板与目录；角色默认 Dashboard/报表继承。

**SRS**：FR-3.2 首包、FR-VIEW-3、FR-6.3、M6 · **验收**：报表展现 + 角色模板

- [ ] RPT-003: Word/Excel/PDF 模板定义
- [ ] RPT-004: 模板树形目录管理
- [ ] RPT-006: 报表扩展配置 FR-6.3
- [ ] VIEW-002: 角色默认模板 FR-VIEW-3
- [ ] NFR-002: NFR-01 报表查询性能

---

## M11 — 原生连接器与完整图表插件

**目标**：时序/文档/搜索 native 出数；多类型图表与嵌入。

**SRS**：FR-2.0-EXT 三期、FR-2.1、NFR-07 · **验收**：§9.1 三期

- [ ] CONN-009: StarRocks 连接器
- [ ] CONN-010: Trino/Presto 连接器
- [ ] CONN-011: InfluxDB 连接器
- [ ] CONN-012: TDengine 连接器
- [ ] CONN-013: TimescaleDB 连接器
- [ ] CONN-014: MongoDB 连接器
- [ ] CONN-015: Elasticsearch 连接器
- [ ] CONN-016: OpenSearch 连接器
- [ ] QUERY-003: Native 查询双路径
- [ ] QUERY-004: SQL 方言适配器
- [ ] VIZ-003: 图表类型插件注册
- [ ] VIZ-004: 图表样式子类型
- [ ] VIZ-005: 维度指标筛选配置 UI
- [ ] VIZ-006: iframe 嵌入门户
- [ ] VIZ-007: SDK 嵌入门户
- [ ] VIZ-008: ECharts/AntV 渲染适配层
- [ ] CAT-004: CAT-04 时间序列分析类
- [ ] CAT-005: CAT-05 工单与业务受理类
- [ ] CAT-006: CAT-06 生产与销售统计类

---

## M12 — 报表调度与用户视图

**目标**：模板调度 + 批量报表；用户个人视图不突破 M7。

**SRS**：FR-3.2、FR-6.4、FR-VIEW-4、IF-03 · **验收**：§9.1 三期调度与视图

- [ ] RPT-005: 报表调度 FR-3.2
- [ ] RPT-007: 批量新增报表 FR-6.4
- [ ] VIEW-003: 用户视图覆盖 FR-VIEW-4
- [ ] API-005: IF-03 报表文档 API
- [ ] API-006: IF-04 门户嵌入 API
- [ ] NFR-006: NFR-05 浏览器与消息推送
- [ ] CAT-007: CAT-07 组织行为审计类

---

## M13 — 四期语义层与治理闭环

**目标**：M1 Dataset + M2 设计器 + M8 治理全流程 + 总线全自动 + 信创连接器。

**SRS**：§8.4 四期 Workstream、FR-1.2~1.6、FR-2.2、NFR-04/06/08 · **验收**：§8.4 端到端 + §9.1 四期

- [ ] CONN-017: 达梦 DM 连接器
- [ ] CONN-018: 人大金仓 连接器
- [ ] CONN-019: 南大通用 GBase 连接器
- [ ] CONN-020: OceanBase 连接器
- [ ] CONN-021: TiDB 连接器
- [ ] CONN-022: GaussDB 连接器
- [ ] QUERY-007: 配置元模型存储
- [ ] QUERY-008: 配置→SQL/API 翻译器
- [ ] QUERY-009: Dataset 查询路径
- [ ] META-001: 术语字典
- [ ] META-002: 业务主题树
- [ ] META-003: 维度字典注册
- [ ] META-004: Dataset CRUD M1-DATASET
- [ ] DESIGN-001: 拖拽查询条件配置
- [ ] DESIGN-002: 运算规则维护
- [ ] DESIGN-003: 输出字段与聚合配置
- [ ] DESIGN-004: 设计器与工单关联
- [ ] DESIGN-005: 传统 SQL 模式
- [ ] GOV-003: 工单流程模板 FR-1.2
- [ ] GOV-004: 可视化查询设计 FR-1.3
- [ ] GOV-005: 查询服务发布 FR-1.4
- [ ] GOV-006: 发布引擎 OpenAPI 映射
- [ ] GOV-007: 总线全自动注册 FR-1.1
- [ ] GOV-008: 治理权限联动 FR-1.6
- [ ] API-003: IF-02 查询服务 API
- [ ] API-004: IF-01 总线注册适配
- [ ] NFR-003: NFR-02 核心看板可用性
- [ ] NFR-005: NFR-04 连接器插件扩展性
- [ ] NFR-007: NFR-06 信创国产化
- [ ] NFR-008: NFR-08 自主可控零 DE/SS

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.1 | 2026-07-06 | PRD 计数 118→124（含 F16）；活跃执行见 plan.md v2.1 P1–P3 |
| 1.0.0 | 2026-07-03 | 初版：M1–M13 归档，124 项 PRD 全量映射 |
