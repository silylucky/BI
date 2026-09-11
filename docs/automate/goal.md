# VitalSpan — 产品目标

> 功能真理源见 prd.md；本文件低频人工修订（create-evolution-goal），演化 agent 只读。

## 1. 产品定义

VitalSpan 是面向**政企/行业客户 IT 与数据团队**的自研可配置 BI 分析平台，在能力与交互上对标 DataEase / Apache Superset，解决三类核心问题：

- 生产环境**依赖第三方 BI 产品**，难以深度定制权限、治理与行业扩展能力
- 多类别外部数据源（关系型、OLAP、时序、文档、搜索、**API、文件**等）**缺乏统一接入与分析入口**
- 查询服务发布、审批与数据交换总线对接**缺乏平台化闭环**

平台由租户管理员在部署侧完成角色、权限、视图与流程配置；附录 S（户户通）等仅为需求参考文档，**不提供场景包自动加载**。

## 2. 终极目标

编号一经写入不复用；PRD 功能项通过 `goal_ref` 引用本节编号。

1. **G1 — 自研 BI 平台对标交付**：生产环境具备对标 DataEase/Superset 的核心 BI 能力，**零 Superset/DataEase 运行时依赖**。
2. **G2 — 多类别数据源可配置接入**：关系型、OLAP、时序、文档、搜索、**API、文件（Excel/CSV）**等通过连接器插件接入，**新增类型不改核心框架**（NFR-04）；支持**库表级同步入平台托管分析库**与**轻量清洗**（FR-DATA/FR-ETL，里程碑 M1B）；**收官阶段**补齐 DataEase 对标缺口类型（CONN-023~027，见 plan §M-FINAL · F-G）。
3. **G3 — BI 展现全链路**：仪表板、主题分析、报表、即席查询形成可配置闭环；一至三期图表**直连数据源查询**，四期补齐 **Dataset 语义层**（M1）。
4. **G4 — 可配置安全与多租户差异**：RBAC + 多维行级权限（M7）；角色、组织、视图均由租户管理员配置，**不预置业务角色与场景包**。
5. **G5 — 查询服务治理与总线对接**：工单 BPM + 发布流水线 + 数据交换总线注册（M8），形成平台差异化能力。

## 3. 核心价值

| 价值 | 说明 |
|------|------|
| 自研可控 | BI 层全部自研，无 GPL 源码复用与第三方 BI 运行时绑定，满足政企交付与长期演进需求 |
| 多源统一接入 | 连接器插件（含 API/文件源收官扩展）+ 可选同步/清洗入托管分析库（M1B），再经 `dataSourceId` 查询 |
| 完整 BI 展现 | Dashboard、主题分析、报表、即席查询覆盖从管理驾驶舱到自助分析的全场景 |
| 可配置权限 | 管理员定义角色、多维 RLS、默认视图与用户覆盖，适配不同行业部署差异 |
| 查询治理差异化 | 申请→审批→设计→发布→总线注册全流程，补齐 DataEase/Superset 无完整对标的能力 |

## 4. 边界范围

### In Scope

- 自研 M1~M8 全模块及 **M-FINAL 收官**（四期语义层、治理闭环、壳层 IA/RBAC FE、信创与缺口连接器；里程碑细节见 `plan.md` §M-FINAL）
- 多数据库外部数据源连接器（FR-2.0 / FR-2.0-EXT）及图表直连查询绑定（FR-2.0b，一至三期）
- **收官连接器扩展**（M-FINAL · F-G · CONN-023~027）：REST API、Excel/CSV 文件源、Db2、Apache Impala、AWS Redshift
- **数据同步与轻量 ETL**（FR-DATA / FR-ETL）：源库 → 平台托管分析库 → 注册为 `dataSourceId`（见 `plan.md` M1B）
- Web 门户与开放 API（只读查询类，OpenAPI 描述）
- 可配置 RBAC、多维行级权限、角色默认视图与用户视图覆盖（FR-VIEW）

### Out of Scope

| 非目标 | 原因 |
|--------|------|
| 嵌入或 fork Superset / DataEase 作为生产组件 | 建设原则：运行时零依赖 |
| GPL 源码复用（DataEase） | 许可证风险（SRS 附录 B.1） |
| 预置业务角色 / 场景包自动加载 | 平台机制：管理员手工配置（SRS §2） |
| 一至三期 Dataset 语义层 | 范围裁剪：四期交付 M1-DATASET（SRS §1.1） |
| AI / SQL 智能问数（如 DataEase SQLBot） | 无 SRS/PRD 立项；非当期对标项，不纳入 M-FINAL |

## 5. 成功指标

| 指标 | 判定方式 | 类型 |
|------|----------|------|
| DATA-SMOKE 通过：源库同步+清洗 → 托管库 → 建源 → SQL 出数 | M1B 端到端验收用例通过 | 可判定 |
| P1-SMOKE 通过：MySQL/PG 建源 → SQL → Dashboard 出数 | 自动化或手工 smoke test 用例全部通过 | 可判定 |
| 越权查询被阻断（RLS 生效） | 测试账号访问未授权数据源返回 403 或空结果集 | 可判定 |
| 生产部署无 Superset/DataEase 容器或进程 | 部署清单与运行时进程检查通过 | 可判定 |
| 新增连接器类型不改 ConnectorRegistry 以外核心代码 | 插件演练 PR 通过代码审查（NFR-04） | 可判定 |
| P3-SMOKE 通过：调度 + 嵌入 SDK + 完整图表消费路径 | 自动化或手工 smoke test 用例全部通过 | 可判定 |
| P4-SMOKE 通过：Dataset → 设计器 → 工单 → 发布 → 总线注册 | M-FINAL F-D~F-E 端到端验收用例通过 | 可判定 |
| M-FINAL 连接器收官：API/文件/Db2/Impala/Redshift 可建源出数 | `GET /datasources/types` 含 CONN-023~027 类型 + compose smoke 通过 | 可判定 |
| 四期末治理端到端验收（FR-1.2→1.6→1.1） | 集成测试用例全部通过 | 可判定 |
| 政企客户新数据源类型快速上线 | 依赖实施团队效率与运维流程 | （方向性） |

## 6. 文档层级

```
docs/arch.md                       ← 技术决策、目录、配置
docs/srs/                          ← 需求权威（SRS + 附录；人工修订，演化只读）
docs/api/README.md                 ← HTTP 路由索引
docs/services/                     ← 域服务附录（随实现补充）
docs/ui/layout.md                  ← 壳层与 IA（单应用 + Embed · `.cursor/rules/fe-ui.mdc` · b-design-system）
docs/automate/goal.md              ← 方向与边界（人工低频修订，create-evolution-goal）
docs/automate/prd.md               ← PRD hub：8 维评分、薄弱项、功能索引（G2 只读）
docs/automate/prd/                 ← 功能明细分片（16 域 · 129 项，按 ID 按需读）
docs/automate/plan.archive.md      ← 里程碑归档 M1–M12（只读参考）
docs/automate/plan.md              ← 活跃里程碑 M-FINAL 收官（create-evolution-plan；演化 agent 只读）
docs/automate/evolution-state.md   ← 当前轮次、待办池、模块地图、项目 skill/rule 索引、STUCK 计数
docs/superpowers/                  ← 演化轮次 design/plan 产出（G2–P3；见 superpowers/README.md）
docs/automate/subagent/            ← subagent 外置提示词（可选，人工维护）
```
