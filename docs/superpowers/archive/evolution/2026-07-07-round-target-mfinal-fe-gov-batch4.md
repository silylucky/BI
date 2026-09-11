# 本轮演化目标（共 5 项）

> 日期：2026-07-07 · 轮次来源：cron G2 · phase G2_DONE  
> 来源：plan §M-FINAL · F-E 收官 + F-F 首批 companion

---

## 选题决策

- **批量主题**：M-FINAL · F-E 治理收官（总线全自动注册 + 权限联动）+ F-F 四期 NFR companion 首批（看板可用性 / 插件扩展性 / 信创国产化）
- **来源**：`plan.md §M-FINAL · F-E` — 当前节唯一含 `[ ]` 的子批余 **GOV-007~008** 二项；`plan.md §F-F` 首批三 NFR 与批次 3 同轨待勾；`prd.md` hub v1.2.105 8 维总表；`evolution-state.md` 待办池空、STUCK 表空；`git log -5` a279a03（G1）+ 8584502（G0 #234 merge）+ 193e921（r247 batch3）
- **合并理由**：五 ID 沿 plan 推荐顺序 F-E #10~#11 → F-F NFR-003/005/007；批次 3（r247）已交付 bus pipeline/ACL matrix/NFR probes 骨架但 plan 仍标「部分实现」— 本批聚焦**验收缺口补全**与 plan 可勾选；单批 `gov` + `nfr` + 薄 `api` 登记，估 ≤16 文件、≤3 模块；为 P4-SMOKE 尾段（发布→总线注册）与 F-F 收官奠基
- **范围框定**：
  - **模块**（≤3）：`backend/app/gov/`（bus auto-register + governance ACL matrix）+ `backend/app/nfr/` 或等价 probe/report 模块 + `docs/api/` · `docs/services/gov.md` 锚点
  - **文件**（估 ≤16）：GOV-007 全自动注册（retry/audit/幂等/失败降级）+ GOV-008 治理权限联动（role×resource×workflow 矩阵守卫）+ NFR-003 dashboard availability probe + NFR-005 connector plugin drill + NFR-007 xinchuang deployment-report + 集成测 `test_mfinal_fe_gov_batch4_r248` + API/域文档
  - **不含**：NFR-008 零 DE/SS 部署报告（F-F 批次 2 单独立项）；F-G CONN-023~027（hub 最低 85.4–85.6，专批留 F-F 后）；Admin 全量 FE 新页（本批以后端验收与 probe 为主）
- **不足 5 项原因**：不适用 — 本批满 5 项；F-E 余 0 项（本批收官）；F-F 余 NFR-008 留下轮

---

## 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|---------|---------|
| GOV-007 | 91.6 | **入选**（F-E plan #10；总线全自动注册 FR-1.1；批次 3 部分实现待收官） |
| GOV-008 | 91.2 | **入选**（F-E plan #11；治理权限联动 FR-1.6；本批最低分之一） |
| NFR-003 | 91.2 | **入选**（F-F；NFR-02 核心看板可用性 probe） |
| NFR-005 | 91.2 | **入选**（F-F；NFR-04 连接器插件扩展性 drill） |
| NFR-007 | 91.6 | **入选**（F-F；NFR-06 信创国产化 deployment-report） |
| NFR-008 | 91.3 | F-F 批次 2 单独立项（NFR-08 零 DE/SS）；本批不合并 |
| CONN-023 | 85.6 | hub 最低；F-G 专批；plan 顺序 F-E→F-F→F-G |
| CONN-024 | 85.6 | 同上（F-G 文件源） |
| CONN-025 | 85.6 | 同上（F-G Db2） |
| API-001 | 90.0 | 已实现；非 plan 当前节 `[ ]` |

---

## STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 批次 3 重评后加权总分 91.2–91.6 均 ≥90，无连续未过轮次记录；本批为批次 3 companion 收官而非 STUCK 重试

---

## 演化北极星自检

1. **用户感知**：已发布查询服务可全自动注册至数据交换总线；治理工单/发布/总线操作受角色权限矩阵约束；运维可一键探针验证核心看板可用性、连接器插件扩展性与信创部署合规报告
2. **补缺 or 创造**：五 ID 均为补缺（PRD 分片部分实现，plan F-E/F-F 未勾；对齐 goal G5 治理闭环与 §5 P4-SMOKE / 四期 NFR 验收）
3. **不做代价**：P4-SMOKE 无法闭环「发布→总线注册」；F-E 无法收官、F-F 四期 NFR 无法推进；M-FINAL 收官阻塞于 F-G 前最后一道治理/NFR 门槛
4. **能否批处理更小项**：GOV-007 bus auto-register → GOV-008 ACL matrix → NFR-003 availability → NFR-005 plugin drill → NFR-007 xinchuang report；共享 gov 域测试 fixture
5. **共几项/文件模块**：5 项；`gov` + `nfr` + `api/docs`，估 ≤16 文件、3 模块

---

## 子项 1：GOV-007 总线全自动注册 FR-1.1

- **选题理由**：F-E **顺序 #10**；hub 总分 91.6、用户价值 88% 为相对薄弱维；批次 3 已交付 pipeline 骨架，plan 仍 `[ ]` 部分实现
- **选题时 PRD 加权总分 = 91.6/100**（用户价值88%·完整度92%·可靠性94%·架构健康90%·测试覆盖100%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（88%→发布成功即全自动总线注册，无需半手动）；完整度（92%→重试/审计/失败降级全绿）
- **用户感知**：查询服务发布后自动向数据交换总线注册，失败可重试并留审计轨迹
- **类型**：补缺（批次 3 companion 收官）
- **验收标准**（来源 plan §F-E · GOV-007）：
  - 发布成功触发全自动总线注册（对接 IF-01 适配层）
  - 失败重试、幂等与审计日志完备
  - pytest 覆盖成功/失败/重试/越权路径
  - plan 可勾选 `[x]`；P4-SMOKE 尾段可执行

---

## 子项 2：GOV-008 治理权限联动 FR-1.6

- **选题理由**：F-E **#11**；hub 总分 **91.2**（本批最低之一）、用户价值 86%；与 GOV-007 同批收官 F-E
- **选题时 PRD 加权总分 = 91.2/100**（用户价值86%·完整度90%·可靠性94%·架构健康90%·测试覆盖100%·性能88%·安全性92%）
- **主攻薄弱维**：用户价值（86%→工单/发布/总线操作受治理角色矩阵约束）；完整度（90%→role×workflow×resource 守卫全场景）
- **用户感知**：不同治理角色对工单审批、查询发布、总线注册的操作权限清晰隔离，越权被结构化拒绝
- **类型**：补缺
- **验收标准**（来源 plan §F-E · GOV-008）：
  - 治理 ACL 矩阵：角色×资源类型×操作（审批/发布/注册）守卫
  - 与 AUTH RLS/资源授权不冲突；pytest 覆盖水平/垂直越权
  - `docs/services/gov.md` 边界与依赖更新
  - plan F-E 收官可勾选

---

## 子项 3：NFR-003 NFR-02 核心看板可用性

- **选题理由**：F-F 首批；hub 总分 91.2、用户价值 86%；批次 3 已探针骨架，plan 仍 `[ ]`
- **选题时 PRD 加权总分 = 91.2/100**（用户价值86%·完整度92%·可靠性94%·架构健康90%·测试覆盖100%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（86%→可量化看板可用性 SLA 探针）；性能（88%→P95 阈值断言）
- **用户感知**：运维/CI 可一键验证核心 Dashboard 视图可用且响应在约定阈值内
- **类型**：补缺（四期 NFR companion）
- **验收标准**（来源 plan §F-F · NFR-003）：
  - availability probe：核心看板路由/数据加载 smoke
  - P95 或等价阈值断言（对齐 NFR-02）
  - pytest 或集成脚本可 CI 执行
  - plan F-F 可勾选

---

## 子项 4：NFR-005 NFR-04 连接器插件扩展性

- **选题理由**：F-F；hub 总分 91.2、用户价值 86%；验证 goal §5「新增连接器不改核心框架」
- **选题时 PRD 加权总分 = 91.2/100**（用户价值86%·完整度92%·可靠性94%·架构健康90%·测试覆盖100%·性能88%·安全性90%）
- **主攻薄弱维**：用户价值（86%→插件 drill 可证明扩展性）；架构健康（90%→ConnectorRegistry 边界不变）
- **用户感知**：新增连接器类型演练通过，核心 `datasources/` 框架无侵入修改
- **类型**：补缺
- **验收标准**（来源 plan §F-F · NFR-005）：
  - plugin drill：注册 stub/minimal 连接器类型并走连通性/只读查询链
  - 断言核心模块 diff 或契约测试边界
  - pytest 绿；对齐 NFR-04

---

## 子项 5：NFR-007 NFR-06 信创国产化

- **选题理由**：F-F；hub 总分 91.6；与 F-C 信创连接器收官衔接，交付部署合规报告
- **选题时 PRD 加权总分 = 91.6/100**（用户价值88%·完整度94%·可靠性94%·架构健康90%·测试覆盖100%·性能88%·安全性92%）
- **主攻薄弱维**：用户价值（88%→信创部署可审计报告）；完整度（94%→国产化栈清单与探针结果一致）
- **用户感知**：政企交付可获得信创国产化合规探测报告（国产 OS/DB/中间件栈登记）
- **类型**：补缺
- **验收标准**（来源 plan §F-F · NFR-007）：
  - deployment-report 或等价 probe 输出结构化 JSON/Markdown
  - 与 F-C CONN-017~022 信创方言登记一致
  - pytest 覆盖报告生成与关键字段
  - plan F-F 首批三 ID 可勾选

---

## F-E/F-F 批次 4 整体验收信号

```
GOV-007                — 全自动总线注册 retry/audit/幂等 pytest 绿；F-E 可收官
GOV-008                — 治理 ACL 矩阵越权 pytest 绿；F-E 可收官
NFR-003                — 核心看板 availability probe pytest/CI 绿
NFR-005                — 连接器 plugin drill pytest 绿
NFR-007                — 信创 deployment-report pytest 绿
docs/api + services    — gov/nfr 域锚点与状态同步
plan                   — F-E 二 ID + F-F 三 ID 可勾选；余 NFR-008 留 F-F 批次 2
P4-SMOKE               — Dataset→设计器→工单→发布→总线注册 尾段可执行
```

> **下轮建议**：F-F 批次 2 — NFR-008（NFR-08 零 DE/SS 部署报告）；随后 F-G 专批 CONN-023~025（hub 最低 85.6，API/文件/Db2 优先）。
