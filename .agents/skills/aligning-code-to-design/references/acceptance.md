# 验收协议

## 证据层级

| 层级 | 能证明 | 不能证明 |
|---|---|---|
| Diff / 文件行号 | 修改发生、实现位置 | 行为正确、链路完整 |
| 单元测试 | 局部行为满足断言 | 跨层集成、真实厂商能力 |
| 集成测试 | 受控依赖间协作 | 生产配置、真实账号权限 |
| 本地链路验收 | 当前环境端到端可运行 | 外部厂商/生产环境已验收 |
| 外部真实验收 | 指定真实环境中的合同条件成立 | 未覆盖的环境与规模 |

高层证据不能由多个低层证据“凑出来”。一百个单测仍不是一次真实 OpenStack 验收。

## 机器门

```powershell
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
python '<suite-root>/skills/_bin/gate-check' batch --repo '<repo>' --run '<run-id>' `
  --slices '<slice-1>,<slice-2>' --strict-red --json

python '<skill-dir>/scripts/validate_alignment.py' snapshot --repo '<repo>' `
  --exclude 'docs/material/design-alignment/<run-id>' --exclude '.evidence' --json

python '<skill-dir>/scripts/validate_alignment.py' check `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' --json

python '<skill-dir>/scripts/validate_alignment.py' gate --level local `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' `
  --gate-check '<suite-root>/skills/_bin/gate-check' --json

python '<skill-dir>/scripts/validate_alignment.py' gate --level external `
  --contract '<run-dir>/contract.json' --ledger '<run-dir>/ledger.json' `
  --gate-check '<suite-root>/skills/_bin/gate-check' --json
```

| 退出码 | 含义 | 编排动作 |
|---:|---|---|
| 0 | 工件有效且目标门 PASS | 允许使用对应结论 |
| 1 | 工件有效，但完成条件未满足 | 保持 IN_PROGRESS/BLOCKED，重开相关项 |
| 2 | 契约、ledger 或文件无效 | 停止收口，先修复追踪工件 |

Windows/PowerShell 必须引用所有可能含空格的路径，并通过 `python` 调用 extensionless 的 `skills/_bin/gate-check`。命令必须显式绑定 repo、run 和完整且无重复的 slices；不能依赖 `CURRENT` 或复用旧 run。

先设置 `PYTHONUTF8=1` 和 `PYTHONIOENCODING=utf-8`，把 batch 的 `--json` stdout 以 UTF-8 保存到本 run 目录；ledger 记录 `output_ref` 与 SHA-256，并记录 suite sibling `gate-check` 的真实路径/哈希。Alignment gate 不只读报告，还会亲自用固定 sibling 工具重跑 batch，核对 `gate=batch`、`status=PASS`、run ID 及每个 slice 的 PASS；自制脚本、只手填 `exit_code: 0` 或手写 PASS JSON 均无效。

Alignment 结构门要求当前 Git HEAD、branch 和 tree state 与 ledger snapshot 一致，并要求 run 目录、`.evidence` 之外 clean。两个门必须都满足；alignment gate PASS 不能替代测试证据 gate，反之亦然。

启用只读 fan-out 时，结构门会核对 `audit_collectors[].requirement_ids` 与 `plan_collectors[].finding_ids` 都引用真实 ID、同类 scope 无重叠；local/external gate 还会核对 collector 与所有正式角色身份两两不同且 `read_only=true`。Collector 不进入正式 transition authority，因此不能写 `OPEN/PLANNED/BLOCKED`，也不能成为真实环境验收负责人。机器门只能核对这些声明的一致性；真实并行、身份来源、Git 基线一致和测试资源隔离仍需运行时任务日志与原始工具输出支持。

并行回归不是通过条件，只是固定 HEAD 后的可选调度优化。只有命令不写业务仓且端口、数据库、缓存、临时目录和外部环境完全隔离时才可并行；否则保持串行。无论调度方式如何，每个 slice 的 RED→GREEN 时序与 evidence 身份都独立受检，最终 `gate-check batch`、snapshot、正式 review merge 和 verifier verdict 仍串行执行。

Local 与 external gate 还要求独立只读 `code_reviewer` 的 `code-review.json`：报告 SHA-256、reviewer ID、contract SHA-256、snapshot HEAD、完整 REQ/Finding 顺序必须一致，且 `status=DONE`、`coverage.blind_spots=[]`、`coverage.evidence_read=true`、`remaining=[]`、`unresolved_finding_ids=[]`。写在 Skill 流程里但没有该机器工件，或把 `DONE_WITH_CONCERNS/BLOCKED` 另写成 PASS，不算执行通过。

本地 final check 与 finding test 的 evidence ref 也必须是 `.evidence/<run-id>/` 下真实存在的 `evidence/v1` JSON，并绑定该 REQ/Finding 自己的唯一 slice、当前 Git HEAD、PASS expectation 与 clean 状态。REQ evidence 还必须绑定 artifact SHA-256、实际 command 和冻结 local criterion；command 与仓库相对 cwd 必须逐字命中该 REQ 的 `local_verification_policy`。最终被引用的 PASS 必须在 snapshot 主仓的精确 cwd 执行。每一个被引用工件都必须有当前 run、同 slice、非空且完全相同 `argv`/`cmd`/仓库相对 cwd、顺序正确的 RED(nonzero)→GREEN(zero)；slice worktree、RED workdir 和最终 PASS workdir 都必须是 snapshot 主仓。无关 pair、换目录、foreign/linked worktree、旧 run、缺执行上下文或 smoke-only 不通过。Finding 只能使用关联 REQ allowlist 中可唯一解析 cwd 的命令；任意 exit-0 文件或计划附录中的无关命令不能充当证据。

## 外部证据门

`EXTERNAL_VERIFIED` 除真实环境 PASS 外，还必须满足：

- `evidence_ref` 位于 `.evidence/<run-id>/` 且文件真实存在；
- raw SHA-256 与 ledger 一致；artifact 为 evidence-run 原生 `schema=evidence/v1`、`phase=smoke`；
- artifact 的 run、slice、command、argv、cwd、workdir、exit code、expectation、Git SHA 和 clean 状态与本次验收一致；cwd 必须精确命中 frozen external policy，workdir 必须是 snapshot 主仓；
- 独立 `design-alignment/external-attestation/v1` 的 path/hash 存在，并绑定 raw evidence ref/SHA、run、slice、command、Git HEAD、environment、accepted_by、accepted_at；
- environment class 是 `real`，验收责任人不是任何本轮内部 alignment 角色。
- environment、验收责任人运行时 ID 与 smoke command 命中该 REQ 在冻结 contract 中的 allowlist policy。

缺任何一项都只能停在 `LOCALLY_VERIFIED` 或 `BLOCKED`。

状态完整性同样受检：任何 REQ/Finding 一旦写成 `EXTERNAL_VERIFIED`，即使本次只运行 local gate 且顶层仍是 `LOCALLY_VERIFIED`，raw smoke 与 attestation 也必须真实有效。

## 最终声明模板

```text
结论：LOCALLY_VERIFIED（不是全部完成）。
契约覆盖：12/12 已审计；本地通过 12；外部通过 7；外部待验收 5。
Findings：18 total；LOCAL_VERIFIED 13；EXTERNAL_VERIFIED 5；OPEN/BLOCKED 0/0。
机器门：alignment local=0；alignment external=1；evidence gate=0。
限制：真实 OpenStack/VMware 验收尚未完成，不能声称生产就绪。
产物：<contract>、<ledger>、<final-verification>。
```

`ACCEPTED_WITH_RISK` 必须逐项列出用户批准依据、影响和回滚/补验条件；它不计入 gate PASS，也不能换称 `FULLY_VERIFIED`。
