# 角色隔离与交接

## 权限矩阵

| 角色 | 可写业务代码 | 可改契约 | 可写 verified | 主要输入 |
|---|---:|---:|---:|---|
| Orchestrator | 否 | 否 | 否 | 原始契约、所有回传、机器门结果 |
| Auditor | 否 | 否 | 否 | 契约、仓库当前快照 |
| Audit collector（可选） | 否 | 否 | 否 | 契约、固定 Git 基线、分配的 REQ IDs |
| Planner | 否 | 否 | 否 | 契约、findings、代码证据 |
| Plan collector（可选） | 否 | 否 | 否 | 契约、正式 findings、分配的 ALN IDs |
| Implementer | 是 | 否 | 否 | 已批准计划、分配的 finding IDs |
| Code reviewer | 否 | 否 | 否 | 契约、当前 HEAD、完整 diff、原始证据 |
| Verifier | 否 | 否 | 是 | 契约、当前仓库、原始 evidence refs |
| User | 不适用 | 是 | 可接受风险 | 决策面与真实业务目标 |

角色隔离是权限隔离，不要求所有 Agent 并行。Orchestrator、auditor、planner、每个 collector/implementer、code_reviewer、verifier 必须使用两两不同的会话或 subagent identity；collector/auditor/planner/code_reviewer/verifier 只读，verifier 必须 fresh-context。`roles.*.id` 使用编排运行时真实返回的 task/session ID，禁止自行编造“session-a”作为隔离证明。

Auditor、planner、verifier 的“只读”是指不得修改业务代码、测试、迁移和配置；它们可以写各自负责的 alignment 报告、ledger 状态或 `docs/specs/**` 计划。Collector 更严格：只返回分配范围的草稿，不得写共享正式工件或任何 finding 状态。若终验发现代码缺口，verifier 只写 `REOPENED`，修复必须回到 implementer 并重新创建 fresh verifier。

正式状态所有权保持单一：只有 auditor 可创建 `OPEN`，只有 planner 可写 `PLANNED`，collector 甚至不能写 `BLOCKED`。Collector scope 必须互不重叠；跨 scope 影响由正式 auditor/planner 统一处理，不得让两个 collector 竞争同一个 REQ/Finding 的正式归属。

## Read-only collector 交接提示

Audit collector：

```text
只读采集，不是正式 auditor。只检查分配的 REQ IDs，并绑定编排器给出的同一 contract SHA-256 与 repo/branch/HEAD/status 基线。
返回每个 REQ 的候选判定、代码路径/行号、链路缺口和候选 finding 描述；不得分配最终 ALN ID，不得修改 audit.md、ledger、业务代码、测试、迁移或配置，不得写 OPEN/BLOCKED。
发现跨 scope 影响时只上报给正式 auditor，不扩大自己的正式归属。基线漂移时停止并报告，不能把不同时点的仓库证据拼成一次审计。
```

Plan collector：

```text
只读草拟，不是正式 planner。只消费正式 auditor 已稳定的、分配给你的 ALN IDs，返回修改层、依赖、回退、RED/GREEN/回归、cwd、外部验收和 slice 建议。
不得修改 docs/specs/**、ledger 或业务文件，不得写 PLANNED/BLOCKED。发现跨 ALN 依赖或冲突时上报给正式 planner，由其统一合并。
若输入仍是晚期审计草稿，输出必须标记 non-authoritative；正式 audit merge 后必须重新核对，不能直接进入正式计划。
```

## Auditor 交接提示

```text
只读审计。以 contract.json 为唯一目标真源，从 REQ-001 开始逐项检查当前仓库。不得把 `local_verification_policy` 中的命令本身当作需求已满足的证据；先判断该命令是否直接覆盖冻结 criterion，再读取真实工件。
每项必须返回 FULL/PARTIAL/MISSING/PROXY/UNKNOWN/N/A、文件行号证据和 finding IDs。若使用 audit collectors，读取全部 collector 草稿，核对同一 Git 基线，处理跨 scope 影响并由你独占分配最终 ALN IDs。
不要读取或相信旧的完成声明，不要修改文件，不要提出契约替代方案。
输出必须覆盖 contract 中每一个 ID，不能只报告有问题的项。
```

## Planner 交接提示

```text
只读制定修复与测试计划。输入是冻结 contract、ledger findings 和仓库证据。
每个 ALN ID 必须唯一映射到修改层、依赖、回退、RED/GREEN/回归命令、仓库相对 cwd 和外部验收。若使用 plan collectors，读取全部草稿后重新合并跨项依赖、冲突、回退和 slice 顺序；只有你能写唯一正式 plan 和 PLANNED。
在唯一 plan 内生成 design-alignment/plan-matrix/v1 标记块，逐 REQ/Finding 精确绑定字段；Finding heading 整行只能是二级标题 `## ALN-###`，不能靠全文 token、错误标题层级、后缀 heading 或附录凑覆盖。
不得降低 acceptance criteria；需要新产品决策时输出 decision_required 并停止该项。
不要修改代码，不要把“测试通过”写成业务验收。
```

## Implementer 交接提示

```text
只实现分配的 ALN IDs，使用 go-fast attended 的串行降级模式，遵循批准计划和 TDD/evidence 规则。所有 slice 的 worktree 都必须是 snapshot 主工作树；不得创建 linked worktree，也不得用另一个仓库生成 RED。多个 implementer ID 可以按批次接力，但任一时刻只能有一个业务代码写者。
每个被 ledger 引用的本地 evidence 都必须由当前 run、同 slice、非空且相同 argv/cmd 的前置 RED 覆盖；不得用一个无关 pair 给整片背书，也不得用旧 run、缺 argv 或 smoke-only 代替 TDD。
回传实际 diff、commit、测试命令、exit code、evidence refs 和未覆盖风险。
最多把状态更新到 IMPLEMENTED；禁止写 LOCAL_VERIFIED/EXTERNAL_VERIFIED。
禁止 unattended 自动 code-review 修复或替 verifier 关闭 finding。
发现契约外问题时新增候选 finding，不得静默改需求。
```

## Code reviewer 交接提示

```text
独立、只读生产风险复审。输入冻结 contract、当前 snapshot HEAD、完整 diff、全部 REQ/Finding 和原始 evidence。
使用 code-reviewer，但禁止进入自动修复阶段；新问题只写入报告的 unresolved finding 列表，由 fresh verifier 判定并正式写 REOPENED。
输出 design-alignment/code-review/v1 JSON，逐字绑定 contract SHA-256、HEAD、你的运行时 ID、完整 REQ/Finding 顺序和 unresolved_finding_ids，并原样保留 coverage 与 remaining。
只有 suite 结论为 DONE、blind_spots/remaining/unresolved 均为空且 evidence_read=true 时写 status=DONE；不能把 DONE_WITH_CONCERNS/BLOCKED 改写成 PASS，也不能以测试绿替代生产风险判断。
```

## Verifier 交接提示

```text
Fresh-context、全程只读终验。把 ledger 中所有完成状态当作待证声明。
从 contract.json 的 REQ-001 重新建立全覆盖矩阵，读取当前代码、Git diff 和原始 evidence；必要时重跑验证。逐项核对 evidence command 是否属于该 REQ 的冻结 allowlist，拒绝计划附录中的无关 exit-0 命令和非 suite sibling 的自制 gate-check。
逐项判定当前是否满足 acceptance criteria，并检查 finding 是否贯穿受影响层。
只有你可以写 LOCAL_VERIFIED、EXTERNAL_VERIFIED 或 REOPENED。
真实外部环境不可用时明确停在 LOCALLY_VERIFIED/BLOCKED，禁止声称全部完成或生产就绪。
外部 PASS 必须同时读取 raw evidence-run smoke 与环境负责人 external-attestation，核对 raw hash 和冻结 policy；禁止修改 raw evidence 后补标签。
```

若不能创建独立 verifier，不要在同一上下文模拟“换帽子”。保存产物并要求新会话以 `mode=verify` 接续。
