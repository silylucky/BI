# 演化轮次选题 — 2026-07-06（M6 一期集成验收收官）

## 本轮演化目标（共 5 项）

### 选题决策

- **批量主题**：**M6 一期集成验收与总线 PoC 收官** — 总线半自动注册 PoC（GOV-002）+ 附录 E 三类查询分类 L1（CAT-001/002/003）+ HTTPS 脱敏审计 companion（NFR-004）；对齐 `goal.md` **G5 查询服务治理与总线对接** 与 plan §M6「P1-SMOKE / FR-1.1-PoC / NFR-01/03」验收主线
- **来源**：`docs/automate/plan.md` §**M6**（第一个含未完成 `[ ]` 的节，**5 项** GOV-002/CAT-001/002/003/NFR-004；plan frontmatter `current_milestone: M-FE-1` 与 hub「当前节 M-FE-1」为**已知漂移**，以勾选清单为准）；饱和熔断**已跳过**（plan 存在且 M6 含 5 项 `[ ]`）；`prd.md` hub 8 维总表映射分数；`evolution-state.md` **待办池空**、**选题卡住计数表空**；`git log -5` fd57ee4（G1 idle reset）+ 0a069cd（M5 VIEW-001 + M6 NFR-001/GOV-001 #210）+ ff5544b（M5 DASH-003 #209）+ 513ebb4（M-FE-3 #208）+ 2427627（M-FE-3 #207）；上游 G0 PASS · G1 DONE · base_branch=dev-auto
- **合并理由**：上轮 r217–r219 已交付 VIEW-001 协议收官 + NFR-001 首屏 perf + GOV-001 catalog 附录 E，M6 仍余 5 项 `[ ]`；GOV-002/CAT-001~003/NFR-004 同属 M6 集成验收节、域边界相邻（治理 catalog → 分类 probe → 总线 PoC stub → HTTPS 审计 guard），可批处理为 companion L1 推分并勾 plan；不扩 M13 全自动总线（GOV-007）或 CAT-004~007
- **范围框定**：
  - **模块**（≤3）：`backend/app/`（governance 总线 PoC stub + query catalog 分类 handler）+ `backend/app/core/`（HTTPS/脱敏审计 guard）+ `tests/`（GOV-002 FSM/probe + CAT-001~003 scope ACL + NFR-004 audit probe）
  - **文件**（估 ≤18，≤20）：gov bus-register PoC adapter、cat lifecycle/aggregate/region handlers + probe、`core` https-audit middleware/guard、`tests/test_gov_002*` / `test_cat_00*` / `test_nfr_004*`、薄 `docs/api/README.md` + `prd` 回写锚点；**不新增** migration 除非审计字段缺口
  - **不含**：M13 冻结项、GOV-007 全自动总线、生产全站 TLS 终止（仅 NFR-03 审计 companion）、M7 连接器（CONN-004 等）、CAT-004~007、Dataset（QUERY-009）
- **5 项说明**：plan §M6 **恰好余 5 项** `[ ]`，同节 batch 无需 hub/待办池补足；hub Top10 均 ≥90（饱和态）但以 plan 执行顺序为准

### 候选对比

| 候选 prd ID | 加权总分 | 未选原因 |
|-------------|:--------:|----------|
| GOV-002 | 90.4 | **入选**（M6 plan #1 未完成；总线 PoC 半自动注册） |
| CAT-001 | 90.0 | **入选**（M6 plan #2；CAT-01 实体生命周期查询类） |
| CAT-002 | 90.0 | **入选**（M6 plan #3；CAT-02 统计分析聚合类） |
| CAT-003 | 90.1 | **入选**（M6 plan #4；CAT-03 地域维度查询类） |
| NFR-004 | 90.2 | **入选**（M6 plan #5；NFR-03 HTTPS 脱敏审计） |
| CONN-004 | 90.0 | hub #3，连接器属 M7 排队 |
| QUERY-009 | 90.0 | hub #5，Dataset 属 M13 冻结 |
| GOV-007 | 90.2 | 全自动总线注册属 M13/四期，超出 M6 PoC 范围 |
| NFR-001 | 92.6 | M6 已勾；上轮 companion 收官 |
| GOV-001 | 92.5 | M6 已勾；上轮 catalog 附录 E 收官 |

### STUCK 标注

- 选题卡住计数表**空** — 五入选 ID 加权总分均 ≥90，无 STUCK 硬标注

## 演化北极星自检

1. **用户感知**：查询可按附录 E 三类（生命周期/聚合/地域）分类探测与 ACL 校验；总线半自动注册 PoC 可演示 FSM 路径；HTTPS 请求/响应脱敏审计有可判定 guard
2. **补缺 or 创造**：补缺（M6 plan 末 5 项未勾）；符合 `goal.md` **G5** 治理前置与 SRS P1-SMOKE 集成验收
3. **不做代价**：M6 无法勾选完成、无法宣告一期集成验收通过；分类 catalog 无 L1 导致附录 E 验收缺口；总线对接无 PoC 锚点
4. **能否批处理更小项**：CAT-001~003 同 catalog 域共享 handler 骨架；GOV-002 仅 PoC stub + FSM；NFR-004 仅 audit guard + probe
5. **共几项/文件模块**：5 项；`backend` gov+cat+core + `tests`，估 ≤18 文件、3 模块

---

### 子项 1：GOV-002 总线 PoC 半自动注册 FR-1.1

- **选题理由**：M6 plan **顺序 #1 未完成**；hub 用户价值 82%、性能 86% 为 governance 域薄弱；半自动注册 PoC 为 FR-1.1 一期验收锚点，不扩 GOV-007 全自动
- **选题时 PRD 加权总分**：90.4/100（用户价值 **82%** · 完整度 **92%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **96%** · 性能 **86%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（82%→总线注册路径可演示）；性能（86%→PoC probe ≤50ms）
- **用户感知**：平台可将查询服务半自动注册至数据交换总线 PoC 端点；注册状态 FSM 可查询
- **类型**：补缺（GOV 域总线 PoC L1）
- **验收标准**（来源 plan §M6 · GOV-002）：
  - 总线半自动注册 PoC adapter + FSM（pending/registered/failed）
  - 注册路径 scope/ACL guard + probe 测试 exit 0
  - 不扩 scope 至 GOV-007 全自动注册或真实总线 HTTP 生产联调

### 子项 2：CAT-001 CAT-01 实体生命周期查询类

- **选题理由**：M6 plan **#2**；hub 总分 90.0、用户价值 84% 为薄弱项 Top1；附录 E CAT-01 分类 L1 与 GOV-001 catalog 衔接
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→生命周期类查询可分类发现）；完整度（90%→分片验收可勾）
- **用户感知**：平台可枚举/探测「实体生命周期」类查询接口；越权访问返回结构化拒绝
- **类型**：补缺（CAT 域 L1 kickoff）
- **验收标准**（来源 plan §M6 · CAT-001）：
  - CAT-01 lifecycle 分类 handler + catalog probe
  - scope/ACL guard + 边界输入测试
  - 不扩 scope 至 CAT-004~007 或 IF-02 查询服务全链路

### 子项 3：CAT-002 CAT-02 统计分析聚合类

- **选题理由**：M6 plan **#3**；hub 总分 90.0、用户价值 84%；与 CAT-001 共享 catalog 骨架，批处理成本低
- **选题时 PRD 加权总分**：90.0/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→聚合统计类查询可分类发现）；完整度（90%→分片验收可勾）
- **用户感知**：平台可枚举/探测「统计分析聚合」类查询接口
- **类型**：补缺（CAT 域 L1 kickoff）
- **验收标准**（来源 plan §M6 · CAT-002）：
  - CAT-02 aggregate 分类 handler + catalog probe
  - scope/ACL guard + 聚合边界测试
  - 不扩 scope 至复杂 OLAP 方言或 M11 CAT-004 时序类

### 子项 4：CAT-003 CAT-03 地域维度查询类

- **选题理由**：M6 plan **#4**；hub 总分 90.1；完成附录 E 前三类 catalog 闭环，与 CAT-001/002 同轮收官
- **选题时 PRD 加权总分**：90.1/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **88%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **88%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→地域维度类查询可分类发现）；完整度（90%→分片验收可勾）
- **用户感知**：平台可枚举/探测「地域维度」类查询接口；地域 scope 校验生效
- **类型**：补缺（CAT 域 L1 kickoff）
- **验收标准**（来源 plan §M6 · CAT-003）：
  - CAT-03 region 分类 handler + catalog probe
  - 地域 scope/ACL guard + 空/非法地域输入测试
  - 不扩 scope 至地图可视化或 M8 实体总览页（DASH-005）

### 子项 5：NFR-004 NFR-03 HTTPS 脱敏审计

- **选题理由**：M6 plan **#5 末项**；hub 总分 90.2、用户价值 84%；HTTPS 脱敏审计为 NFR-03 一期验收 companion，不扩生产 TLS 终止基础设施
- **选题时 PRD 加权总分**：90.2/100（用户价值 **84%** · 完整度 **90%** · 可靠性 **94%** · 架构健康 **90%** · 测试覆盖 **98%** · 性能 **88%** · 安全性 **90%** · 交互 N/A）
- **主攻薄弱维**：用户价值（84%→敏感字段脱敏可审计）；性能（88%→audit probe 低开销）
- **用户感知**：API 响应/日志中敏感字段按策略脱敏；审计记录可探测且不含明文凭证
- **类型**：补缺（NFR 域安全 companion）
- **验收标准**（来源 plan §M6 · NFR-004）：
  - HTTPS/响应脱敏 audit guard + 结构化审计 probe
  - 凭证/Token 类字段不出现在 audit 输出；pytest exit 0
  - 不扩 scope 至全站生产 TLS 证书管理或 NFR-006 浏览器推送
