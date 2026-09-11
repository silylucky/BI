---
name: aligning-code-to-design
description: Use when an approved design, PRD, architecture decision, audit baseline, or prior discussion must be reconciled with an existing repository, especially after an agent claimed everything was fixed but scope drift, missing findings, self-verification, test-only confidence, or unverified external integrations may exist.
---

# Aligning Code to Design

## Overview

把用户批准的目标冻结成不可静默改写的契约，贯穿只读审计、计划、实施、证据门和 fresh-context 独立终验。一个 Skill 负责编排，多个隔离角色互相制约；**过程状态、TODO 和测试全绿都不是业务验收。**

## 铁律

1. 契约 `FROZEN` 前禁止修改业务代码。
2. 只有用户可以冻结/变更契约、批准 `N/A` 或接受风险；Agent 不得降低验收标准。
3. Orchestrator、正式 auditor、正式 planner、每个 collector/implementer、code_reviewer、verifier 的运行时身份必须全部不同；collector/auditor/planner/code_reviewer/verifier 只读，verifier 还必须 fresh-context。
4. Implementer 最多写到 `IMPLEMENTED`。只有 verifier 可写 `LOCAL_VERIFIED`、`EXTERNAL_VERIFIED` 或 `REOPENED`。
5. 每个 `REQ-###` 只含一个可观察验收条件；每条需求与 finding 必须双向、无遗漏追踪。
6. Diff、测试、mock、文档和进度勾选不能替代真实外部环境验收。
7. 缺 PostgreSQL、OpenStack、VMware 或其他必需真实环境时，最多声明 `LOCALLY_VERIFIED`；禁止说“全部完成”或“生产就绪”。
8. 机器门非 0、仓库快照漂移、计划/证据不存在时必须停止收口。

违反任一条即保持 `IN_PROGRESS` 或 `BLOCKED`，不要包装成完成。

## 前置依赖

启动时确认同一 Skill suite 中存在：`product-blueprint`、`plan-reviewer`、`go-fast`、`code-reviewer`、`skills/_bin/evidence-run`、`skills/_bin/gate-check`。缺少所需依赖时报告 `BLOCKED`，不得自行虚构替代命令或缩水流程。

`requirement-fit` 只适用于外部招标/RFP 等它能忠实消费的需求文档，可作为额外审计；内部讨论冻结出的 contract 使用本 Skill 的专用 auditor 提示，不能强套 `requirement-fit`。

## 输入模式

| 模式 | 输入 | 动作 |
|---|---|---|
| `from-discussion` | 当前对话中已确认方案 | 只提取用户明确决定；推断标为 open decision；用户确认后冻结 |
| `from-document` | 已批准 blueprint、PRD、spec、ADR | 记录精确路径、Git 版本和批准依据；不拼接未批准草稿 |
| `from-audit` | 已有审计报告 | finding 必须先回溯到冻结契约；无法回溯的只算候选项 |
| `verify` | contract、ledger、当前仓库 | 全程只读，从原始契约重新验收，不继承旧完成判断 |

目标仍在探索时，**REQUIRED SUB-SKILL:** 使用 `product-blueprint` 的 `mode=blueprint` 收敛方案；其输出仍须由用户明确批准后才能写成 `FROZEN`。

## 产物

```text
docs/material/design-alignment/<run-id>/
├── contract.json
├── audit.md
├── ledger.json
├── code-review.json
└── final-verification.md

docs/specs/<slug>-alignment.md      # go-fast Path A 的唯一实施计划
.evidence/<run-id>/                 # 原始机器证据
```

不得在 run 目录另建会与 `docs/specs/**` 竞争的 `plan.md`。`ledger.plan` 指向唯一真实实施计划。计划必须在 `<!-- ALIGNMENT-MATRIX-BEGIN -->` / `<!-- ALIGNMENT-MATRIX-END -->` 间嵌入 `design-alignment/plan-matrix/v1` JSON，逐 REQ 精确绑定 contract SHA-256、acceptance/local criterion、仓库相对 cwd、command allowlist、finding edges，并逐 finding 绑定 requirement edges 与同名 heading anchor。Heading 必须整行只有 `## ALN-###`（可有尾随空白），否则 GFM anchor 不同。全文 token、一级/三级标题或无关附录不算矩阵；每个 `plan_ref` 必须精确指向同一文件的 `#ALN-###` 章节。

开工前完整读取 [contract.md](references/contract.md)、[ledger.md](references/ledger.md)、[roles.md](references/roles.md) 和 [acceptance.md](references/acceptance.md)。

## 工作流

### 并行边界

这里的“业务修复阶段”是 verification slice，不是可以各自推进状态机的独立流水线。默认仍可单 auditor、单 planner 串行执行；仅在冻结目标较大且 scope 可拆分时启用以下只读 fan-out：

- **审计采集可并行：** contract 已 `FROZEN` 且所有 collector 绑定同一 repo、branch、HEAD、status 基线后，编排器可创建多个 `audit_collectors`，按互不重叠的 `REQ-###` 范围读取代码并返回草稿。Collector 不得改业务文件、`audit.md`、ledger 或正式状态，也不得分配最终 `ALN-###`。唯一正式 auditor 负责核对基线未漂移、合并、去重、处理跨范围影响、全量覆盖 REQ，并且是唯一可创建 `OPEN` 的角色。
- **计划草拟可并行：** 正式 auditor 完成合并、稳定全部 finding 后，编排器可创建多个 `plan_collectors`，按互不重叠的 `ALN-###` 范围返回计划草稿。唯一正式 planner 负责合并跨 slice 依赖、冲突、回退与验证矩阵，写唯一 `docs/specs/**`，并且是唯一可写 `PLANNED` 的角色。晚期审计期间可预读并形成明确标记的临时草稿，但不得写正式 plan/ledger；审计合并后必须丢弃或重新核对，不能据此提前进入 `PLANNED`。
- **实施与状态串行：** 业务代码、测试代码、迁移和配置保持主工作树单写者；每个 slice 的 RED→GREEN、状态迁移及依赖顺序保持串行。Collector 没有任何 finding 状态写权限，包括 `BLOCKED`。
- **只读回归可受控并行：** 全部业务写入停止并固定待测 HEAD 后，互不共享端口、数据库、缓存目录、临时目录或外部环境的回归命令可以并行；每条 evidence 仍绑定自己的 run/slice/cwd/command。只要共享可变资源、测试会写仓库、或隔离性无法证明，就必须串行。
- **汇合门串行：** 正式 audit merge、正式 plan merge、`gate-check batch`、最终 snapshot、code-review 汇总、fresh verifier 状态写入和最终 verdict 均由各自唯一责任角色串行完成。不得把 collector 数量、并行测试数量或草稿完成度当成正式阶段完成。

### 0. 冻结目标

1. 记录 repo root、branch、HEAD、`git status --short`、输入来源和用户消息/文档引用。
2. 按 [contract.md](references/contract.md) 先建立 `SRC-###` 来源覆盖矩阵，再拆成原子 `REQ-###`；每项恰好一个验收条件，并标记 `local|external`。每个 REQ 还必须冻结 `local_verification_policy.criterion`、仓库相对 `cwd` 与精确 command allowlist，防止用计划里无关的 exit-0 命令或换目录缩小范围冒充验证。每个 REQ 必须回溯到来源；排除来源条目需用户明确批准。External REQ 还要冻结真实环境 ID、允许的环境负责人 ID、smoke command 和它的仓库相对 `cwd`。
3. 让用户裁定新增或仍歧义的产品语义。已有明确批准时引用原消息，不重复提问。
4. 用户批准后写入 `approval.authority=user`，运行：

```powershell
python '<skill-dir>/scripts/validate_alignment.py' hash --contract '<run-dir>/contract.json'
```

5. 把哈希写入 ledger。契约任何字节变化都必须升版、重新批准、重新哈希并重开受影响项。

### 1. Fresh-context 只读审计

创建独立正式 auditor，传入 contract、repo path 和原始 Git 快照，不传旧“已完成”结论。使用 [roles.md](references/roles.md) 的 auditor 提示，从 `REQ-001` 全量检查 DB/API/Service/Adapter/异步任务/权限/UI/测试/外部验收链路。若启用 `audit_collectors`，先由它们在互斥 REQ scope 内并行采集，再由正式 auditor 读取全部草稿并执行唯一正式合并；collector 结果本身不是 `audit.md` 或 ledger finding。

- 每个 REQ 恰好一条 ledger trace，结果只能为 `FULL|PARTIAL|MISSING|PROXY|UNKNOWN|N/A`。
- `PARTIAL|MISSING|PROXY|UNKNOWN` 必须产生稳定 `ALN-###`。
- `N/A` 必须引用用户批准记录；auditor 无权删需求。
- 只读角色可写本次 alignment 产物，不得改业务代码、测试、迁移或配置。

### 2. 计划与独立计划复核

审计正式合并完成后，创建独立只读正式 planner，将所有 `ALN-###` 写入 `docs/specs/<slug>-alignment.md`；每项包含修改层、依赖、回退、RED/GREEN/回归命令、外部验收和唯一 slice 归属。若启用 `plan_collectors`，它们只返回互斥 finding scope 的草稿；正式 planner 必须重新解析跨项依赖并完成唯一正式合并。

**REQUIRED SUB-SKILL:** 使用 `plan-reviewer` 复核该 spec。仅在以下条件全部满足时写 `PLANNED`：

- contract 中每个 REQ 都进入验证矩阵，finding 100% 覆盖且 REQ↔finding 双向一致；
- contract SHA-256 和每个 ALN ID 均出现在实际计划文件；
- 每个 REQ 的冻结 local criterion 与全部允许命令均出现在其验证矩阵；命令出现在无关附录不构成授权；
- 机器矩阵与 contract/ledger 的顺序、字段和 REQ↔finding edges 完全一致，每个 finding 存在精确 `## ALN-###` heading；
- 验收标准未缩水，测试验证行为而非文件存在；
- 契约外产品决策已标 `decision_required` 并交给用户。

### 3. Attended 分片实施

**REQUIRED SUB-SKILL:** 使用 `go-fast` 的 attended/人工监督方式执行 `docs/specs/**` 计划，遵循其 TDD、单写者和 evidence 规则。此 Skill 必须走 go-fast 的合法串行降级并记录 `zero_reason: degrade`：实现只在 `snapshot.repo_root` 主工作树进行，禁止 linked worktree。原因是当前 `evidence-run` 工件没有不可伪造的仓库 identity，而 go-fast 会在 alignment 终验前清理 linked worktree，届时无法证明历史 RED 来自同一仓库。禁止 unattended 自动 code-review 修复，因为那会绕过 finding 归属和 verifier 权限。

Implementer 必须：

- 只处理分配的 ALN IDs；多个实现任务按依赖顺序串行，任一时刻只有一个业务代码写者。审计/计划 collector 只增加读取吞吐，不改变正式状态所有权，也不用于并发修改同一业务仓；
- 通过 suite 的 `evidence-run` 保存 RED、GREEN、回归及适用的外部命令证据；每个 slice 的 `worktree` 必须逐字解析为 `snapshot.repo_root`。每一个被 REQ final evidence 或 Finding test 实际引用的本地工件，都必须有当前 run、同 slice、非空且完全相同 `argv`、`cmd` 与仓库相对 `cwd`、顺序正确的 expectation-met RED(nonzero)→GREEN(zero)。RED 与最终被引用的 PASS 都必须来自 snapshot 主仓；PASS 还必须匹配冻结 `cwd`、当前 HEAD 和 clean 状态。一个无关 pair 不能替整片背书，复制旧 run、foreign/linked worktree、缺执行上下文或 smoke-only 无效；
- 回写实际文件/行号/commit/命令/exit code/evidence ref；
- 只执行 `PLANNED → IMPLEMENTED`；范围外问题上报候选 finding，不静默改 contract。

`go-fast complete` 只映射为 `IMPLEMENTED`，不能映射为 verified；单测 PASS 只增加证据，不改变 finding 状态。

### 4. 编排方重跑证据门并绑定当前 Git

1. 先确保计划、代码、测试和稳定的 alignment 基线已形成可复核提交；最终 evidence 之后不得再改业务代码。
2. 编排方亲自重跑精确 slice 集合，不接受实施者粘贴的 PASS。Windows/PowerShell 必须显式用 Python 调 extensionless 工具：

```powershell
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
python '<suite-root>/skills/_bin/gate-check' batch --repo '<repo>' --run '<run-id>' --slices '<slice-1>,<slice-2>' --strict-red --json
```

3. 将 `--json` stdout 以 UTF-8 保存为 `<run-dir>/gate-check-batch.json`，记录 SHA-256；非 0 退出码必须保留且阻断。再写入 `evidence_gate.command/run_id/slice_ids/exit_code/checked_by/checked_at/output_ref/output_sha256/tool_path/tool_sha256`。`tool_path` 必须是本 Skill 同一 suite 下不可替换的 sibling `skills/_bin/gate-check`，自制同名脚本即使哈希匹配也无效。每个 REQ 和 finding 必须恰好属于一个 verification slice；没有修复 finding 的 `FULL` 需求也要建立验证 slice。
4. 在最终代码提交后生成当前快照；run 目录与 `.evidence` 可排除，其他路径必须 clean：

```powershell
python '<skill-dir>/scripts/validate_alignment.py' snapshot --repo '<repo>' `
  --exclude 'docs/material/design-alignment/<run-id>' --exclude '.evidence' --json
```

5. 将返回的 repo root、branch、HEAD、state SHA-256 写入 `ledger.snapshot`，再运行结构门：

```powershell
python '<skill-dir>/scripts/validate_alignment.py' check `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' --json
```

退出码 `2` 表示工件无效；`gate-check` 的 `1/2` 都是失败。不得继续终验。

### 5. Fresh-context 只读终验

实现结束后创建一个此前未参与本轮工作的 verifier。若运行时不能提供真正独立上下文，保存工件并要求新会话用 `mode=verify` 接续；当前会话不得宣称验收完成。

Verifier 只接收 contract、当前 repo/snapshot、ledger、diff 和原始 evidence refs，把所有既有状态视作待证声明。使用 [roles.md](references/roles.md) 的 verifier 提示逐 REQ 重建矩阵。

**REQUIRED SUB-SKILL:** 使用一个与其他角色 ID 不同、`read_only=true` 的 `code-reviewer` 做生产风险复审。它必须输出 `<run-dir>/code-review.json`，绑定 contract SHA-256、当前 Git HEAD、全部 REQ/Finding、reviewer 运行时 ID 和未解决 finding 列表；ledger 记录报告路径与哈希。机器门按 suite 原语只接受 `status=DONE`、`coverage.blind_spots=[]`、`coverage.evidence_read=true`、`remaining=[]`、`unresolved_finding_ids=[]`；`DONE_WITH_CONCERNS/BLOCKED` 不能改写成 PASS。发现问题只写入报告的 unresolved 列表，由 fresh verifier 正式写 `REOPENED`；不能在终验上下文自动修代码。修复必须回到计划与 implementer，再创建新的 fresh verifier 和 code-review 工件。

Verifier 可执行：

- `IMPLEMENTED → LOCAL_VERIFIED`
- `LOCAL_VERIFIED → EXTERNAL_VERIFIED`
- 已验证项 `→ REOPENED`

然后运行：

```powershell
python '<skill-dir>/scripts/validate_alignment.py' gate --level local `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' `
  --gate-check '<suite-root>/skills/_bin/gate-check' --json

python '<skill-dir>/scripts/validate_alignment.py' gate --level external `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' `
  --gate-check '<suite-root>/skills/_bin/gate-check' --json
```

Alignment gate 会亲自执行固定路径与哈希的 sibling `gate-check batch`，并逐个引用工件强制当前 run 的同 argv/cmd/仓库相对 cwd RED→GREEN；手写 PASS、不同命令 RED、换目录 RED、foreign/linked worktree、无关 pair、smoke-only 都不能替代。本地 REQ evidence 只接受 green/full/merge/cr，必须记录 path、SHA-256、实际 command 和原样 local criterion；command 与执行 cwd 必须来自该 REQ 在冻结 contract 中的 policy，并匹配唯一 slice、snapshot 主仓、当前 HEAD 和 clean 状态。Finding test 只能使用其关联 REQ allowlist 中可唯一解析 cwd 的命令。外部 smoke 保持 `evidence-run` 原始 `evidence/v1` 不改写，其 cwd/workdir 也必须精确匹配 external policy 与 snapshot 主仓；真实环境负责人另产 `design-alignment/external-attestation/v1`，绑定 raw evidence ref/SHA、run、slice、command、HEAD、environment、accepted_by 与 accepted_at。凡状态已经写成 `EXTERNAL_VERIFIED`，local gate 也会立即验证两份工件；不能把伪外部状态藏在 `LOCALLY_VERIFIED` 顶层结论下。

### 6. 诚实收口

| 结论 | 必要条件 |
|---|---|
| `FULLY_VERIFIED` | external gate=0；所有 REQ/Finding 完整；真实外部证据有效 |
| `LOCALLY_VERIFIED` | local gate=0；明确列出仍待真实环境验收项 |
| `BLOCKED` | 环境、权限、凭据、依赖或用户决策阻断 |
| `ACCEPTED_WITH_RISK` | 用户逐项明确接受；不等于 PASS |
| `IN_PROGRESS` | 仍有 OPEN/PLANNED/IMPLEMENTED/REOPENED 或门失败 |

最终回复先给结论，再给 REQ 覆盖数、finding 状态数、两道 alignment gate 与 evidence gate 的命令/退出码、外部缺口和产物路径。只有 `FULLY_VERIFIED` 可说“全部完成”。

## 状态适配

Item/Finding 状态使用 `LOCAL_VERIFIED`；顶层最终结论使用 `LOCALLY_VERIFIED`。两者是不同枚举，不接受别名。

| 上游结果 | Ledger 允许动作 |
|---|---|
| auditor 发现差距 | 创建 `OPEN` |
| plan-reviewer 通过实际 spec | `OPEN/REOPENED → PLANNED` |
| go-fast/implementer 完成 | `PLANNED → IMPLEMENTED` |
| evidence-run 或 gate-check PASS | 只登记证据，不改 verified 状态 |
| verifier 本地复核通过 | `IMPLEMENTED → LOCAL_VERIFIED` |
| verifier 校验真实外部 artifact | `LOCAL_VERIFIED → EXTERNAL_VERIFIED` |
| code-reviewer 报告缺口，verifier 判定成立 | verifier 写 `→ REOPENED` |

## 能力边界

验证器能阻止常见误关、错链、旧快照、无关 exit-0、手写 gate PASS 和未授权环境负责人，但不能对抗能同时伪造用户批准、白名单身份及运行时日志的恶意参与者。编排器必须把运行时真实返回的 session/task IDs、用户消息引用和工具原始输出写入工件。没有可信运行时审计日志时，应说明这是过程完整性校验，不是密码学证明。

## 红旗

- contract 未冻结/哈希漂移；REQ 或 finding 非 100% 双向覆盖
- `plan_ref` 不在真实 `docs/specs/**`，或不含 contract hash / ALN ID
- Implementer 自写 verified；verifier 复用旧上下文或修改代码
- gate 未绑定明确 repo、run 和 slices；snapshot 与当前 Git 不符
- external 只有字符串 PASS、mock、单测、文档，或 artifact 不存在/不匹配
- 任一门非 0 仍准备说“全部完成”

出现红旗，立即停止收口。
