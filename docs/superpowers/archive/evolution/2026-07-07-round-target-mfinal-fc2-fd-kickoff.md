# 本轮演化目标（共 4 项）

> 日期：2026-07-07 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-FINAL · F-C 收官（CONN-022）+ §F-D 语义层查询路径首批（QUERY-007~009）

---

## 选题决策

- **批量主题**：M-FINAL · F-C 收官（GaussDB companion）+ F-D 语义层查询路径奠基（配置存储 → 翻译器 → Dataset 查询）
- **来源**：`plan.md §M-FINAL` — 当前节 F-C 仅剩 1 项 `[ ]`（CONN-022）；F-D 为 plan 顺序下一子批，取查询路径依赖链前三项补足批量
- **合并理由**：CONN-022 与 r242 五型信创 companion 同范式（probe_readonly_sql + DatasourceForm hints + 集成测），可复用 `test_mfinal_fc_r242` 模式；QUERY-007→008→009 为 F-D 端到端前置链（P4-SMOKE「Dataset 建表 → 设计器」依赖配置元模型与翻译路径），与 GaussDB 收官无模块冲突（`datasources` + `query` + `fe` ≤3 模块）
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/`（GaussDB dialect 探针/测）+ `backend/app/query/`（配置元模型、翻译器、Dataset 查询路径）+ `fe/src/`（GaussDB 表单 hints/smoke）
  - **文件**（估 ≤18）：CONN-022 ~3–4 文件增量 + QUERY-007~009 ~12–14 文件（models/migration/service/API/tests）+ `docs/api/README.md` / `docs/services/` 锚点
  - **不含**：F-D 余项 META-001~004（引入 `meta` 第四域，留 F-D 批次 2）；F-E 设计器/治理；F-G CONN-023~027（hub 最低 85.4–85.6，专批）；F-F NFR
- **不足 5 项原因**：F-C 仅余 CONN-022 单行；与 F-D 查询链三件套同批已达 ~16–18 文件与 3 模块上限；再纳入 META-001 将超模块预算，且 META 与 QUERY 可并行于下轮 F-D 批次 2

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| CONN-022 | 90.1 | **入选**（F-C plan 唯一余项；GaussDB 信创收官） |
| QUERY-007 | 91.7 | **入选**（F-D plan #1；配置元模型存储奠基） |
| QUERY-008 | 90.4 | **入选**（F-D plan #2；依赖 QUERY-007） |
| QUERY-009 | 90.0 | **入选**（F-D plan #3；hub F-D 查询域最低；Dataset 路径） |
| META-001 | 90.0 | F-D plan #4；引入 meta 域第四模块，留批次 2 |
| META-002 | 91.1 | F-D 后续项；非查询路径依赖链 |
| CONN-023 | 85.6 | hub 最低分；F-G P1 API 源；与 F-C/F-D 分专批 |
| CONN-024 | 85.6 | 同上（F-G 文件源） |
| CONN-025 | 85.6 | 同上（F-G Db2） |
| NFR-007 | 90.4 | F-F 四期 NFR；非当前 plan 子批顺序 |

---

## STUCK 标注

- 选题卡住计数表**空** — 四入选 ID 均为本轮首次入选（CONN-022 上轮留批未实施），无连续未过轮次记录

---

## 演化北极星自检

1. **用户感知**：Admin 可选 GaussDB 建源并连通性测试；平台具备 Dataset 配置元模型存储、配置→SQL 翻译与 Dataset 查询 API 骨架，为四期语义层与设计器铺路
2. **补缺 or 创造**：CONN-022 补缺（信创 companion，同 F-C 批次 1）；QUERY-007~009 补缺（PRD 分片部分实现，plan F-D 未勾）
3. **不做代价**：F-C 无法收官、NFR-007 信创国产化仍缺 GaussDB UI/验收；F-D 查询链断裂，P4-SMOKE 与 Dataset 路径无法启动
4. **能否批处理更小项**：GaussDB 复用 r242 五型探针/表单模式；QUERY 链按 007 存储 → 008 翻译 → 009 查询分层增量 pytest
5. **共几项/文件模块**：4 项；`datasources` + `query` + `fe`，估 ≤18 文件、3 模块

---

## 子项 1：CONN-022 GaussDB 连接器

- **选题理由**：F-C plan **唯一余项**；上轮 r242 留批 2 收官；hub 总分 90.1、用户价值 84% 为连接器域共性薄弱；plan 背景同批次 1（L1 dialect 已注册，缺口 UI + 集成测）
- **选题时 PRD 加权总分 = 90.1/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性88%）
- **主攻薄弱维**：用户价值（84%→GaussDB 可浏览器建源）；性能（88%→只读查询探针 P95）
- **用户感知**：数据源类型列表含「GaussDB」；表单展示主机/端口/库/schema 等字段；连通性测试成功
- **类型**：补缺（信创 companion：UI + 集成测）
- **验收标准**（来源 plan §F-C · CONN-022）：
  - `GET /datasources/types` 含 gaussdb（或等价 type key）；DatasourceForm 可选并提交
  - 只读 SQL 集成测（compose 或 mock/skip 无环境）
  - 凭证加密、RLS 链路与既有 DS 一致
  - PRD 分片「UI 可选」「只读查询集成测」可勾选；plan F-C 可勾选

---

## 子项 2：QUERY-007 配置元模型存储

- **选题理由**：F-D plan **顺序 #1**；语义层 Dataset 配置的结构化存储奠基；hub 总分 91.7、安全性 88% 为相对薄弱维
- **选题时 PRD 加权总分 = 91.7/100**（用户价值84%·完整度94%·可靠性96%·架构健康92%·测试覆盖98%·性能90%·安全性88%）
- **主攻薄弱维**：用户价值（84%→配置可持久化支撑 Dataset）；安全性（88%→配置访问与租户隔离）
- **用户感知**：平台可保存 Dataset/查询配置的元模型定义（非裸 SQL 字符串散落）；为设计器与翻译器提供单一真理源
- **类型**：补缺（F-D 语义层存储层）
- **验收标准**（来源 plan §F-D · QUERY-007）：
  - 配置元模型 schema 落库（migration + ORM）
  - CRUD API 或域服务可读写配置定义
  - pytest 覆盖主流程与非法输入拦截
  - `docs/api/README.md` / `docs/services/query.md` 锚点登记

---

## 子项 3：QUERY-008 配置→SQL/API 翻译器

- **选题理由**：F-D plan **#2**；依赖 QUERY-007 存储的配置产出可执行 SQL 或 API 调用；hub 总分 90.4
- **选题时 PRD 加权总分 = 90.4/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（84%→配置可翻译为可执行查询）；性能（88%→翻译路径 P95）
- **用户感知**：保存的 Dataset 配置可经翻译器生成方言 SQL 或等价查询计划，无需手写 SQL
- **类型**：补缺
- **验收标准**（来源 plan §F-D · QUERY-008）：
  - 翻译器接受 QUERY-007 元模型输入，输出结构化 SQL/API 请求
  - 单元/集成测覆盖至少一种方言（如 PostgreSQL/MySQL）与边界配置
  - 非法/不完整配置返回结构化错误
  - 与既有 `query/` 执行路径衔接点明确

---

## 子项 4：QUERY-009 Dataset 查询路径

- **选题理由**：F-D plan **#3**；hub 总分 90.0（F-D 查询域最低）；P4-SMOKE 依赖 Dataset 经配置路径出数
- **选题时 PRD 加权总分 = 90.0/100**（用户价值84%·完整度88%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（84%→Dataset 可查询出数）；完整度（88%→端到端路径可验收）
- **用户感知**：已注册 Dataset 可通过平台查询 API 获取结果集（经 007 存储 + 008 翻译），替代一至三期纯 SQL 直连模式
- **类型**：补缺
- **验收标准**（来源 plan §F-D · QUERY-009）：
  - Dataset 查询 API（`dataSourceId` + Dataset 配置）可走通主流程
  - RLS/鉴权与既有 query 域一致
  - 集成测：配置 → 翻译 → 执行 → 结果集
  - 为 F-E 设计器与 P4-SMOKE 预留稳定入口

---

## F-C 收官 + F-D 查询链 整体验收信号

```
GET /datasources/types     — 含 gaussdb（或等价 type key）
DatasourceFormPage         — GaussDB 字段与 hints 可选可提交
pytest CONN-022            — 连通性 + 只读 SQL（compose 或 skip）
QUERY-007~009              — 元模型 CRUD + 翻译器 + Dataset 查询 API pytest 绿
docs/api + services        — 锚点与状态同步
plan                       — F-C CONN-022 可勾选；F-D 前三项可部分勾选
```

> **下轮建议**：F-D 批次 2 → META-001~004（术语/主题树/维度/Dataset CRUD）或并行 F-G 首批 CONN-023~024（hub 最低 85.6，API + 文件源）。
