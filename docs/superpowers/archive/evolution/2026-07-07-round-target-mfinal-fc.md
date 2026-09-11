# 本轮演化目标（共 5 项）

> 日期：2026-07-07 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-FINAL · F-C 信创连接器 companion 收官（当前节；F-A/F-B 已收官 2026-07-07）

---

## 选题决策

- **批量主题**：M-FINAL · F-C — 信创国产化连接器 companion 收官（达梦/金仓/GBase/OceanBase/TiDB）
- **来源**：`plan.md §M-FINAL · F-C`（当前节，第一个含未完成 `[ ]` 的子批）— 6 项 PRD ID，本轮取 plan 顺序前 5 项
- **合并理由**：五型均属 `goal.md` **G2** 信创国产化连接器子集；plan 注明后端 L1 dialect 已注册，缺口为「数据源表单 UI 可选类型」与「只读查询集成测」companion；共享 `ConnectorRegistry` + `DatasourceFormPage` + compose 探针模式，与 M11 batch1（CONN-009~013）同批处理范式
- **范围框定**：
  - **模块**（≤3）：`backend/app/datasources/dialects/`（既有 dialect 补测/探针）+ `backend/tests/`（集成测）+ `fe/src/`（数据源表单类型字段与 hints）
  - **文件**（估 ≤18）：每连接器 ~2–3 文件增量（test/probe + FE form hints）×5 + 共享 compose fixture + `docs/api/README.md` / `docs/services/datasources.md` 锚点
  - **不含**：F-C 余项 CONN-022（GaussDB，留批次 2）；F-G（CONN-023~027，hub 最低 85.4–85.6，plan 标注 F-F 后）；F-D 语义层；Dataset 路径
- **不足 5 项原因**：不适用 — plan F-C 含 6 项，取顺序前 5 项达批量上限；CONN-022 留 F-C 批次 2（单 ID 快速收官轮）

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| CONN-017 | 90.4 | **入选**（F-C plan #1；达梦 DM；hub F-C 域最低分并列） |
| CONN-018 | 90.0 | **入选**（F-C plan #2；人大金仓；hub 薄弱项 #9） |
| CONN-019 | 90.4 | **入选**（F-C plan #3；南大通用 GBase） |
| CONN-020 | 90.4 | **入选**（F-C plan #4；OceanBase） |
| CONN-021 | 90.1 | **入选**（F-C plan #5；TiDB） |
| CONN-022 | 90.1 | F-C plan #6，留批次 2（GaussDB 单 ID 收官） |
| CONN-023 | 85.6 | hub 最低分；F-G P1 API 源；与 F-C 信创域分专批 |
| CONN-024 | 85.6 | 同上（F-G 文件源） |
| QUERY-007 | 91.7 | F-D 语义层；非当前节 |

---

## STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 均为 F-C 首次入选，无连续未过轮次记录

---

## 演化北极星自检

1. **用户感知**：Admin 新建数据源时可选择达梦/金仓/GBase/OceanBase/TiDB 类型；连通性测试与只读 SQL 查询可走通；政企信创部署常见库型不再缺 UI/验收缺口
2. **补缺 or 创造**：补缺（后端 L1 已注册，PRD 分片未勾 UI 与集成测 companion）
3. **不做代价**：信创五型仍停留在「后端注册但不可浏览器验收」；NFR-007 信创国产化收官受阻；F-C 无法勾选 plan
4. **能否批处理更小项**：五连接器共享 dialect 探针 + DatasourceForm 动态字段 + compose skip 模式；逐型增量 pytest
5. **共几项/文件模块**：5 项；`datasources` + `tests` + `fe`，估 ≤18 文件、3 模块

---

## 子项 1：CONN-017 达梦 DM 连接器

- **选题理由**：F-C plan **顺序 #1**；hub 总分 90.4、用户价值 84% 为连接器域共性薄弱；plan 背景明确 `dialects/dm.py` 等 L1 已存在
- **选题时 PRD 加权总分 = 90.4/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（84%→Admin 可选 DM 类型建源）；性能（88%→只读查询探针 P95）
- **用户感知**：数据源类型列表含「达梦 DM」；表单展示主机/端口/库/schema 等字段；连通性测试成功
- **类型**：补缺（信创 companion：UI + 集成测）
- **验收标准**（来源 plan §F-C · CONN-017）：
  - `GET /datasources/types` 含 dm 类型；DatasourceForm 可选并提交
  - 只读 SQL 集成测（compose 或 mock/skip 无环境）
  - 凭证加密、RLS 链路与既有 DS 一致
  - PRD 分片「UI 可选」「只读查询集成测」可勾选

---

## 子项 2：CONN-018 人大金仓 连接器

- **选题理由**：F-C plan **#2**；hub 总分 90.0（F-C 域最低）；政企/信创 Kingbase 高频场景
- **选题时 PRD 加权总分 = 90.0/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性88%）
- **主攻薄弱维**：用户价值（84%→金仓可浏览器建源）；安全性（88%→凭证不落日志）
- **用户感知**：可选择人大金仓类型；schema/表元数据浏览与连通性测试可用
- **类型**：补缺
- **验收标准**（来源 plan §F-C · CONN-018）：
  - Kingbase dialect 类型在 Admin 表单可选
  - 连通性 + schema 元数据探测 pytest
  - 只读查询路径集成测通过或 skip 注明理由

---

## 子项 3：CONN-019 南大通用 GBase 连接器

- **选题理由**：F-C plan **#3**；hub 总分 90.4；与 DM/金仓同属国产关系型信创栈
- **选题时 PRD 加权总分 = 90.4/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（84%→GBase 可接入）；完整度（90%→分片验收可勾）
- **用户感知**：GBase 数据源类型可在 Admin 新建并测试连通
- **类型**：补缺
- **验收标准**（来源 plan §F-C · CONN-019）：
  - GBase 类型注册与表单字段完整
  - 只读查询集成测 + 连通性 pytest
  - 不扩 scope 至写入/同步路径

---

## 子项 4：CONN-020 OceanBase 连接器

- **选题理由**：F-C plan **#4**；hub 总分 90.4；分布式国产库；与 TiDB 互补
- **选题时 PRD 加权总分 = 90.4/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（84%→OceanBase 可建源）；性能（88%→分布式只读探针）
- **用户感知**：OceanBase 类型可选；租户/集群连接参数表单清晰
- **类型**：补缺
- **验收标准**（来源 plan §F-C · CONN-020）：
  - OceanBase dialect UI 字段与 types API 对齐
  - 连通性 + 只读 SQL 集成测
  - 与 MySQL 兼容模式差异在表单 hints 说明

---

## 子项 5：CONN-021 TiDB 连接器

- **选题理由**：F-C plan **#5**；hub 总分 90.1；MySQL 协议兼容但独立类型登记；与 OceanBase 同批收官
- **选题时 PRD 加权总分 = 90.1/100**（用户价值84%·完整度90%·可靠性94%·架构健康90%·测试覆盖98%·性能88%·安全性88%）
- **主攻薄弱维**：用户价值（84%→TiDB 可浏览器验收）；完整度（90%→PRD 分片全勾）
- **用户感知**：TiDB 数据源类型独立可选；连通性与元数据浏览可用
- **类型**：补缺
- **验收标准**（来源 plan §F-C · CONN-021）：
  - TiDB 类型在 ConnectorRegistry 与 Admin 表单可见
  - 只读查询集成测 + 连通性 pytest
  - 不与 CONN-001 MySQL 类型混淆

---

## F-C 批次 1 整体验收信号

```
GET /datasources/types     — 含 dm/kingbase/gbase/oceanbase/tidb（或等价 type key）
DatasourceFormPage         — 五型字段与 hints 可选可提交
pytest integration         — 每型连通性 + 只读 SQL（compose 或 skip）
docs/api + services        — 锚点与状态同步
```

> **下轮建议**：F-C 批次 2 → CONN-022（GaussDB，单 ID 快速收官）→ F-D 语义层（QUERY-007~009、META-001~004）或并行 F-G（CONN-023~027，hub 最低 85.4–85.6）。
