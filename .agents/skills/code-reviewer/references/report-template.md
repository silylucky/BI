# Report Template（标准报告）

评审结束必须按此结构输出（Markdown）。标题含项目名与日期。

```markdown
# [项目] 生产就绪 / 产品体验评审 · YYYY-MM-DD

## 总览

| 项 | 内容 |
|----|------|
| 范围 | 整仓 / PR·变更面（主根…） / 模块 X / 多仓… |
| mode | auto-fix（默认）/ go-fast-unattended-fix / loop-lane / review |
| fix_mode | confirm-batch（默认）/ auto |
| cr_fix_scope | all / P0+P1 / P0（auto-fix 下用户确认后填；loop-lane 留空） |
| Stack Card | 后端… / 前端… / 配置… / 交付…（见下或附件） |
| 扫描方式 | 并行 lane：L1…L11（subagent） / 主 agent 串行 lane（降级） |
| 证据层 / 外部依赖 | 已读 `.evidence/`（gate: PASS/FAIL…）；仓外依赖 n 个，缺 smoke 工件 m 个 / 无证据层（记 Blind spot） |
| ha_mode | claimed（已扫 §18） / single（§18 跳过） / unknown（…） |
| Blind spots | 无 / Lx：未覆盖路径 + 原因… |
| Lane 密度 | 全 lane ≥5 finding 或附 EXHAUSTED 段（少则记 Blind spot） |
| P0 / P1 / P2 | n / n / n |
| 建议 | 可上线（仅剩 P2） / 修完 P0 再上 / 暂缓（含未扫净 lane 时不得写可上线） |
| 回传 status | DONE / DONE_WITH_CONCERNS / BLOCKED（**有未消解 Blind spot 时禁止 DONE**） |
| 已排除非问题 | 默认管理员种子、测试双**边界 fake**、无 UI 跳过 L4/L5…（**不含**带开关的 stub、**不含** mock 掉被测对象的用例） |

一句话结论：…

### Stack Card（摘要）

- 形态 / 语言 / 框架：…
- 有无 SPA：…；标杆 UI：…
- 跳过的 lane：…（原因）
- 宣称材料 / 宣称客户端：…

## Blind spots / 未完成 lane

| Lane | 状态 | 未覆盖范围 | 说明 |
|------|------|------------|------|
| … | 合理跳过 / 失败后补扫仍不足 | path… | … |

**判定（不可绕过）**：**未扫到 ≠ 没问题**。存在未消解 Blind spot 时，总览「建议」不得写「可上线 / 本批干净」，`status` 不得为 `DONE`；盲区落在生产主路径 / 外部集成 / 变更面核心目录 → `BLOCKED`，仅边缘面 → `DONE_WITH_CONCERNS` 且盲区原样进 `remaining`。「合理跳过」（无 UI 跳 L4/L5、无 IaC 跳 L6、无仓外依赖跳 L8）须写明理由，不计入未消解盲区。

## P0 Findings

### P0-1 · [短标题]

| 字段 | 内容 |
|------|------|
| 类别 | 假绿·stub / **隐式假通** / **假绿·测试** / 硬编码 / 可靠性 / **性能热点** / **HA·可靠性** / **HA·性能** / 真实缺口 / 产品表面 / 坏表单 / 风格 |
| 证据 | `path/to/file` — 行为一句话 |
| 为何致命 | … |
| 建议修法 | … |
| xref | [其它 finding-id, …]（同根因/同代码热点；修复批次据此合并到同一 subagent） |
| 可批量 | 是（批次 A）/ 否（需设计决策） |

（按需继续 P0-2…）

## P1 Findings

### P1-1 · …

（同上表；坏表单与风格不一致优先写清「目标 UX / 标杆页」）

## P2 Findings

- …（可改用紧凑列表）

## 非问题（已排除）

| 项 | 原因 |
|----|------|
| 默认超管 seed | 首次启动预期；假定改密 |
| … | … |

## 建议修复批次（待确认 / auto 时改为自动执行）

| 批次 | 含 finding | 预估 | Subagent 建议 |
|------|------------|------|----------------|
| A 假绿/stub 清零 | P0-1, P0-2 | S–M | 删 stub 分支+接真实现或撤入口；禁止只加 flag |
| A2 隐式假通 | P0/P1 外部依赖 | M | 一依赖一 agent：补真实端点 smoke + 超时/退避/幂等并留测；跑不通则撤入口 |
| B 产品表面 | P0/P1 入口与半成品 | M | API×各端对账；补入口或撤壳/假数据 |
| C 坏表单 | P1-x | M | 每页/每域一个 agent |
| D 风格对齐 | P1-y | M | 对齐本仓标杆，按页面列表 |
| E 门禁与可靠性 | P0/P1 | S–M | 启动校验、health、队列/拓扑 |
| G 性能热点 / HA | P0/P1 | M | 分页上限、N+1 批量化、假 HA 改共享存储或降宣称；HA 锁/连接池按拓扑 |
| F 其它 P2 | P2-… | S | 能安全修则修；否则 remaining |

**mode=auto-fix（默认）+ fix_mode=confirm-batch**：回复要执行的批次或级别（如「做 A+B」/「全部 P0+P1+P2」/「仅 P0」/「仅 P0+P1」）。  
- 用户确认全量（P0+P1+P2）→ 本 skill 调 [go-fast](../../go-fast/SKILL.md)（attended），按批次拆工单落地。  
- 用户指定 `P0` 或 `P0+P1` → **跳过确认**，本 skill 直接调 go-fast unattended 修指定级别。  
- **绝不自动修 P2**（用户明示「全量」含 P2 时除外）。  
- 同 `xref` 链的 finding → go-fast 拆工单时合并进同一 subagent。  
**mode=go-fast-unattended-fix**：不等人；执行全部可修且落在 `cr_fix_scope` 内的 finding（单独/polishing 默认 P0+P1+P2；prd/product 默认仅 P0+P1）；契约不明项进 remaining。  
**mode=loop-lane**：仅出报告，不修不停等。

## 确认后 / auto 计划（预填）

1. 前置串行公共面 → 拆隔离分片 → 冲突预检 → 并行 subagent（见 batch-fix-workflow）
2. 后置串行：全仓校验 + 假绿回归搜法 + 相关测试
3. 回写本报告「修复状态」列（可选）；auto 回传 `auto_fixed` / `remaining`
```

## 语气

- 直接、短句；每条 finding 先写危害再写位置。
- 不把「非问题」再写成建议「删除 seed」。
- 中文报告（用户规则要求简体中文时）。
