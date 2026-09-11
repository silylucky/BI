# 本轮演化目标（共 5 项）

> 日期：2026-07-07 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-FINAL · F-F 收官 + F-G kickoff

---

## 选题决策

- **批量主题**：M-FINAL · F-F 收官（NFR-08 自主可控零 DE/SS 部署验证）+ F-G 缺口连接器首批（REST API / Excel·CSV 文件源 / Db2 / Impala）
- **来源**：`plan.md §M-FINAL` — 当前节首个含 `[ ]` 子批 **F-F** 余 **NFR-008** 一项；**F-G** 五型 CONN-023~027 全部 `[ ]` 未实现；`prd.md` hub v1.2.106 薄弱项 Top5 均为 F-G（最低 CONN-026/027 85.4）；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` 65c5f38（G1 r248 docs）+ dd697f4（#235 F-E/F-F batch4 merge）+ 193e921（#234 batch3）
- **合并理由**：沿 plan 推荐顺序 F-F #6（NFR-008）→ F-G #1~#4（CONN-023~026）；NFR-008 为部署清单/probe 类交付，与四型连接器共享 `datasources/dialects` + `nfr` 探针 + compose smoke 测试夹具，单批估 ≤18 文件、≤3 模块；批次 4（r248）已收官 F-E 与 F-F 首批三 NFR，本批闭合 F-F 并启动 hub 最低分域
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/dialects/`（rest_api、excel/csv、db2、impala 方言）+ `backend/app/nfr/` 或等价部署验证探针 + `tests/` 集成测 `test_mfinal_ff_fg_batch1_r249`
  - **文件**（估 ≤18）：NFR-008 零 DE/SS 部署报告/probe + 四型 dialect 注册/probe_readonly_sql/连通链 + ConnectorRegistry 类型枚举 + 可选 `DatasourceForm` hints + `docs/api/README.md` · `docs/services/datasources.md` 锚点
  - **不含**：CONN-027 Redshift（F-G 批次 2 单独立项）；Admin 全量新页（文件/API 源以表单 hints + smoke 为主）；AI/SQL 问数（plan G2 禁止选题）
- **不足 5 项原因**：不适用 — 本批满 5 项；CONN-027 留 F-G 批次 2

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| NFR-008 | 91.3 | **入选**（F-F plan 唯一 `[ ]`；NFR-08 零 DE/SS 收官） |
| CONN-023 | 85.6 | **入选**（hub #1；F-G P1 REST API 数据源） |
| CONN-024 | 85.6 | **入选**（hub #2；F-G P1 Excel/CSV 文件源） |
| CONN-025 | 85.6 | **入选**（hub #3；F-G P2 IBM Db2） |
| CONN-026 | 85.4 | **入选**（hub #4；F-G P3 Apache Impala） |
| CONN-027 | 85.4 | F-G 批次 2（Redshift）；本批四型 + NFR 已触 20 文件上限边缘 |
| API-001 | 90.0 | 已实现；非 plan 当前节 `[ ]` |
| NFR-003 | 92.1 | F-F 已于 batch4 勾选 |
| GOV-007 | 92.2 | F-E 已于 batch4 收官 |

---

## STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 无连续未过轮次记录；CONN-023~026 为 hub 初评未实现项（非 STUCK 重试）

---

## 演化北极星自检

1. **用户感知**：运维可验证生产部署零 Superset/DataEase 运行时；管理员可新建 REST API、Excel/CSV、Db2、Impala 四类数据源并完成连通性测试；`GET /datasources/types` 含四新类型
2. **补缺 or 创造**：五 ID 均为补缺（F-F 末项部分实现 + F-G 五型立项未实现）；对齐 `goal.md` G1 零 DE/SS、G2 多源接入与 §5 M-FINAL 连接器收官指标
3. **不做代价**：F-F 无法收官；129 项 PRD 合同卡在 33 待办；政企对标 DataEase 缺口类型（API/文件/Db2/Impala）无法建源出数；零 DE/SS 成功指标无法判定
4. **能否批处理更小项**：NFR-008 deployment probe → CONN-023 API dialect → CONN-024 file dialect → CONN-025 Db2 → CONN-026 Impala；共享 dialect 插件骨架与 compose smoke fixture
5. **共几项/文件模块**：5 项；`datasources/dialects` + `nfr` + `tests/docs`，估 ≤18 文件、3 模块

---

## 子项 1：NFR-008 NFR-08 自主可控零 DE/SS

- **选题理由**：F-F **顺序 #6**（plan 当前节首个 `[ ]`）；批次 4 已交付 NFR-003/005/007，本项为 F-F 收官唯一余项
- **选题时 PRD 加权总分 = 91.3/100**（用户价值86%·完整度90%·可靠性96%·架构健康90%·测试覆盖98%·性能88%·安全性92%）
- **主攻薄弱维**：用户价值（86%→生产部署零第三方 BI 运行时可直接判定）；完整度（90%→部署清单与运行时探针验收全绿）
- **用户感知**：交付/运维团队可执行一键探针或查阅部署报告，确认无 Superset/DataEase 容器或进程
- **类型**：补缺（F-F companion 收官）
- **验收标准**（来源 plan §F-F · NFR-008）：
  - 部署清单与运行时进程检查通过（对齐 `goal.md` §5「生产部署无 Superset/DataEase」）
  - 结构化部署验证报告或 probe 端点/脚本可 CI 执行
  - pytest 覆盖通过/失败路径
  - plan F-F 可勾选 `[x]`（与四期 NFR 收官信号对齐）

---

## 子项 2：CONN-023 REST API 数据源连接器

- **选题理由**：F-G **#1** P1；hub 薄弱项 **#1**（总分 85.6）；对标 DataEase API 数据源
- **选题时 PRD 加权总分 = 85.6/100**（用户价值86%·完整度84%·可靠性84%·架构健康88%·测试覆盖84%·性能86%·安全性88%）
- **主攻薄弱维**：完整度（84%→方言注册+建源+只读查询链落地）；测试覆盖（84%→连通/只读集成测）
- **用户感知**：管理员可选择「REST API」类型配置端点与认证，完成连通性测试并用于查询
- **类型**：补缺（F-G 立项未实现）
- **验收标准**（来源 plan §F-G · CONN-023）：
  - `rest_api` 类型注册于 ConnectorRegistry；`GET /datasources/types` 可见
  - dialect 实现连通探测与只读查询路径
  - compose smoke 可建源并 test 成功
  - `docs/api/README.md` 登记（若新增路由）

---

## 子项 3：CONN-024 Excel/CSV 文件源连接器

- **选题理由**：F-G **#2** P1；hub 薄弱项 **#2**；对标 DataEase 本地 Excel/CSV、远程文件
- **选题时 PRD 加权总分 = 85.6/100**（用户价值86%·完整度84%·可靠性84%·架构健康88%·测试覆盖84%·性能86%·安全性88%）
- **主攻薄弱维**：完整度（84%→文件解析+元数据浏览+只读查询）；可靠性（84%→非法路径/格式拦截）
- **用户感知**：管理员可上传或指定 Excel/CSV 文件作为数据源，浏览 sheet/列并完成连通测试
- **类型**：补缺
- **验收标准**（来源 plan §F-G · CONN-024）：
  - `excel` / `csv`（或统一 `file` 子类型）注册；types API 可见
  - 本地/远程文件路径校验与结构化错误
  - 只读查询或表模式探测 pytest 覆盖
  - 与既有 DS CRUD/test API 衔接

---

## 子项 4：CONN-025 IBM Db2 连接器

- **选题理由**：F-G **#3** P2；hub 薄弱项 **#3**；OLTP 缺口类型
- **选题时 PRD 加权总分 = 85.6/100**（用户价值86%·完整度84%·可靠性84%·架构健康88%·测试覆盖84%·性能86%·安全性88%）
- **主攻薄弱维**：完整度（84%→db2 方言+probe_readonly_sql）；测试覆盖（84%→集成测）
- **用户感知**：管理员可新建 Db2 数据源，连通性测试与 schema 浏览可用
- **类型**：补缺
- **验收标准**（来源 plan §F-G · CONN-025）：
  - `db2` dialect 注册；`probe_readonly_sql` 与只读守卫
  - compose 或 mock 集成测覆盖连通/只读路径
  - `DatasourceForm` 字段 hints（若 FE 触及）
  - types API 与文档锚点更新

---

## 子项 5：CONN-026 Apache Impala 连接器

- **选题理由**：F-G **#4** P3；hub 薄弱项 **#4**（总分 85.4，本批连接器最低）；OLAP 缺口类型
- **选题时 PRD 加权总分 = 85.4/100**（用户价值86%·完整度84%·可靠性84%·架构健康88%·测试覆盖84%·性能86%·安全性86%）
- **主攻薄弱维**：完整度（84%→impala 方言落地）；安全性（86%→凭证与只读 SQL 守卫）
- **用户感知**：管理员可新建 Impala 数据源并完成连通性测试
- **类型**：补缺
- **验收标准**（来源 plan §F-G · CONN-026）：
  - `impala` dialect 注册；Hive/Impala 兼容连接串与 probe
  - pytest 覆盖连通与只读查询链
  - `GET /datasources/types` 含 impala
  - CONN-027 Redshift 留批次 2，本批不合并
