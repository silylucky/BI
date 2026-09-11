# 追踪 Ledger

## 状态机与授权

```text
OPEN → PLANNED → IMPLEMENTED → LOCAL_VERIFIED → EXTERNAL_VERIFIED
  ↘ BLOCKED ↗             ↘ REOPENED ↗
  ↘ ACCEPTED_RISK → REOPENED
```

| 目标状态 | 授权角色 |
|---|---|
| `OPEN` | auditor |
| `PLANNED` | planner |
| `IMPLEMENTED` | implementer |
| `LOCAL_VERIFIED / EXTERNAL_VERIFIED / REOPENED` | fresh verifier |
| `BLOCKED` | 任一正式已登记角色（collector 除外） |
| `ACCEPTED_RISK` | user，且有显式批准记录 |

`REOPENED` 必须先回到 planner 形成新一轮 `PLANNED`，不得直接跳回 `IMPLEMENTED`。

## 顶层结构

```json
{
  "schema_version": "1.0",
  "run_id": "20260804-resource-model",
  "contract": {"path": "contract.json", "sha256": "<contract-sha256>"},
  "plan": {
    "path": "docs/specs/resource-model-alignment.md",
    "contract_sha256": "<contract-sha256>"
  },
  "snapshot": {
    "repo_root": "C:/repo",
    "branch": "feature/resource-model",
    "head": "<git-sha>",
    "status_porcelain": "",
    "state_sha256": "<current-tree-sha256>"
  },
  "roles": {
    "orchestrator": {"id": "runtime-session-a"},
    "auditor": {"id": "runtime-session-b", "read_only": true},
    "audit_collectors": [
      {"id": "runtime-session-b1", "read_only": true, "requirement_ids": ["REQ-001", "REQ-002"]}
    ],
    "planner": {"id": "runtime-session-c", "read_only": true},
    "plan_collectors": [
      {"id": "runtime-session-c1", "read_only": true, "finding_ids": ["ALN-001"]}
    ],
    "implementers": [{"id": "runtime-session-d"}],
    "code_reviewer": {"id": "runtime-session-e", "read_only": true},
    "verifier": {"id": "runtime-session-f", "read_only": true, "fresh_context": true}
  },
  "requirements": [],
  "findings": [],
  "slices": [
    {
      "id": "align-001",
      "worktree": "C:/repo",
      "requirement_ids": ["REQ-001", "REQ-002", "REQ-003"],
      "finding_ids": ["ALN-001"]
    }
  ],
  "evidence_gate": {
    "command": "python 'C:/suite/skills/_bin/gate-check' batch --repo 'C:/repo' --run '20260804-resource-model' --slices 'align-001' --strict-red --json",
    "exit_code": 0,
    "checked_by": "runtime-session-a",
    "checked_at": "2026-08-04T11:50:00+08:00",
    "run_id": "20260804-resource-model",
    "slice_ids": ["align-001"],
    "output_ref": "docs/material/design-alignment/20260804-resource-model/gate-check-batch.json",
    "output_sha256": "<raw-json-sha256>",
    "tool_path": "C:/suite/skills/_bin/gate-check",
    "tool_sha256": "<gate-check-sha256>"
  },
  "code_review": {
    "status": "DONE",
    "reviewer_id": "runtime-session-e",
    "checked_at": "2026-08-04T11:58:00+08:00",
    "report_ref": "docs/material/design-alignment/20260804-resource-model/code-review.json",
    "report_sha256": "<code-review-sha256>"
  },
  "final_verdict": {
    "status": "IN_PROGRESS",
    "declared_by": "runtime-session-f",
    "declared_at": "2026-08-04T12:00:00+08:00",
    "summary": "仍有未验证项。"
  }
}
```

`snapshot` 是终验时的当前提交与树摘要，不是开工前 baseline。使用验证器 `snapshot` 子命令生成；除本 run 目录和 `.evidence` 外必须 clean。实现或计划改变后旧 snapshot 立即失效。

`contract.json` 与 `ledger.json` 必须共同位于 `docs/material/design-alignment/<run_id>/`。`evidence_gate.tool_path` 只能指向当前 Skill suite 的 sibling `skills/_bin/gate-check`；记录相同 SHA-256 的仓内自制脚本也不会被 validator 接受。Batch JSON 必须以 UTF-8 保存。

角色 ID 必须来自运行时真实返回的 task/session 标识，不能由 Agent 自行起名冒充隔离上下文；所有正式角色和 collector（含每个 implementer 与 code_reviewer）必须两两不同，collector/auditor/planner/code_reviewer/verifier 必须 `read_only=true`。验证器只做一致性检查，运行时日志才是身份依据。

`audit_collectors` 与 `plan_collectors` 是可选数组；未启用 fan-out 时可省略或写空数组。每个 audit collector 必须登记一个或多个真实 `requirement_ids`，每个 plan collector 必须登记一个或多个真实 `finding_ids`；同类 collector 的 scope 必须互不重叠。Collector 只证明“谁在什么只读范围内提供草稿”，不获得正式状态授权：不得作为 history actor 写 `OPEN`、`PLANNED`、`BLOCKED` 或其他状态，也不得充当 external acceptance authority。唯一 `roles.auditor` 负责正式审计合并和 `OPEN`，唯一 `roles.planner` 负责正式计划合并和 `PLANNED`。

并行只允许发生在共享正式工件之外：audit collector 不写 `audit.md` 或 ledger，plan collector 不写 `docs/specs/**` 或 ledger。所有 collector 回传后，正式 owner 串行合并；若 repo/branch/HEAD/status 审计基线漂移，受影响草稿必须重做。计划 collector 的正式输入是 auditor 已合并稳定的 finding 集；审计尾声产生的预读草稿只能标为 non-authoritative，不能提前迁移状态。

`docs/specs/**` 必须包含唯一 `design-alignment/plan-matrix/v1` JSON 标记块。矩阵逐 REQ 精确记录 acceptance criterion、local criterion、仓库相对 cwd、commands、finding IDs，逐 finding 记录 requirement IDs 与精确 heading anchor；它必须与 contract/ledger 顺序和值完全相等。Heading 整行只允许二级标题 `## ALN-###` 和尾随空白。全文 substring、相似 ID、一级/三级标题、heading 后缀或错误 fragment 不能替代矩阵。

```text
<!-- ALIGNMENT-MATRIX-BEGIN -->
{"schema":"design-alignment/plan-matrix/v1","contract_sha256":"<sha>","requirements":[{"id":"REQ-003","acceptance_criterion":"真实 Project 凭据创建的资源只能在对应映射范围查询。","local_criterion":"OpenStack Project 映射的本地契约测试通过。","cwd":".","commands":["go test ./adapter/..."],"finding_ids":["ALN-001"]}],"findings":[{"id":"ALN-001","requirement_ids":["REQ-003"],"anchor":"ALN-001"}]}
<!-- ALIGNMENT-MATRIX-END -->

## ALN-001
```

`code-review.json` 使用 `schema=design-alignment/code-review/v1`，必须绑定 reviewer ID、`read_only=true`、contract SHA-256、snapshot HEAD、按 ledger 顺序排列的完整 REQ/Finding ID，并保留 suite 结果 `status=DONE`、`coverage.blind_spots=[]`、`coverage.evidence_read=true`、`remaining=[]`、`unresolved_finding_ids=[]`。缺报告、`DONE_WITH_CONCERNS/BLOCKED`、哈希漂移或复用 verifier/implementer 身份都会阻断 local 与 external gate。

```json
{
  "schema": "design-alignment/code-review/v1",
  "status": "DONE",
  "reviewer_id": "runtime-session-e",
  "read_only": true,
  "contract_sha256": "<contract-sha256>",
  "git_head": "<snapshot-head>",
  "requirement_ids": ["REQ-003"],
  "finding_ids": ["ALN-001"],
  "unresolved_finding_ids": [],
  "coverage": {"blind_spots": [], "evidence_read": true},
  "remaining": []
}
```

## Requirement trace

```json
{
  "id": "REQ-003",
  "audit_result": "PARTIAL",
  "finding_ids": ["ALN-001"],
  "audit_evidence": [
    {"path": "adapter/openstack.go", "line": 42, "claim": "已有映射，但没有真实环境证据。"}
  ],
  "final_check": {
    "status": "LOCAL_VERIFIED",
    "verifier_id": "runtime-session-f",
    "evidence": [
      {
        "path": ".evidence/20260804-resource-model/req-003-local.json",
        "sha256": "<artifact-sha256>",
        "command": "go test ./adapter/...",
        "acceptance_criterion": "OpenStack Project 映射的本地契约测试通过。"
      }
    ],
    "external_acceptance": []
  }
}
```

`N/A` 不能由 auditor 自行决定，必须同时记录：

```json
{
  "audit_result": "N/A",
  "na_approval": {
    "authority": "user",
    "approved_by": "user",
    "source_ref": "conversation:<real-message-id>",
    "reason": "该能力明确不属于本合同范围"
  }
}
```

## Finding

```json
{
  "id": "ALN-001",
  "requirement_ids": ["REQ-003"],
  "summary": "缺少真实 OpenStack Project 隔离验收。",
  "severity": "P1",
  "status": "LOCAL_VERIFIED",
  "plan_ref": "docs/specs/resource-model-alignment.md#ALN-001",
  "implementation_evidence": [
    {"path": "adapter/openstack.go", "line": 42, "commit": "<sha>"}
  ],
  "tests": [
    {
      "command": "go test ./adapter/...",
      "exit_code": 0,
      "evidence_ref": ".evidence/20260804-resource-model/aln-001.json",
      "environment": "local"
    }
  ],
  "external_acceptance": [],
  "history": [
    {"from": null, "to": "OPEN", "actor_role": "auditor", "actor_id": "runtime-session-b"},
    {"from": "OPEN", "to": "PLANNED", "actor_role": "planner", "actor_id": "runtime-session-c"},
    {"from": "PLANNED", "to": "IMPLEMENTED", "actor_role": "implementer", "actor_id": "runtime-session-d"},
    {"from": "IMPLEMENTED", "to": "LOCAL_VERIFIED", "actor_role": "verifier", "actor_id": "runtime-session-f"}
  ]
}
```

REQ 的 `finding_ids` 与 finding 的 `requirement_ids` 必须形成完全相同的边集合；“都引用过”但边对应错误也不通过。`plan_ref` 必须指向 repo 内真实存在的 `docs/specs/**`，正文包含当前 contract hash 和 finding ID。

每个 REQ 和 finding 必须恰好映射到一个 slice；即使审计结果是 `FULL`、没有 finding，也要有验证 slice 和原始证据，避免“无问题”变成跳过验收。

每个 slice 的 `worktree` 必须是绝对路径，且规范化后精确等于 `snapshot.repo_root`。本 Skill 强制 go-fast 串行降级，不接受 linked worktree：后者会在 alignment 终验前被 go-fast 清理，而当前 evidence artifact 无法在路径消失后可信证明 Git common-dir。这样 `--repo A --cwd B` 即使把 B 写进 ledger，也会在结构门被拒绝。

REQ 本地 evidence 的 `acceptance_criterion` 与 `command` 必须逐字命中该 REQ 冻结的 `local_verification_policy`，artifact 的 `cmd` 也必须一致。RED 与最终引用的 PASS artifact 都必须在 snapshot 主仓执行；PASS 还必须匹配 policy 指定的仓库相对 cwd、当前 HEAD 和 clean 状态。每个 REQ/Finding 实际引用的工件都必须有当前 run、同 slice、非空且相同 argv/cmd/仓库相对 cwd 的前置 RED；一个无关、换目录或 foreign/linked worktree 的 RED→GREEN pair 不能替其他 evidence 背书。Finding 的测试命令只能来自其关联 REQ 的 allowlist，并且该命令必须唯一解析到一个 policy cwd；计划正文中偶然出现的其他命令不构成授权。

## 外部验收

外部条目不能只是字符串 PASS，必须同时绑定真实 `evidence-run` smoke artifact 与环境负责人 attestation：

```json
{
  "kind": "real-environment",
  "environment": "openstack-staging",
  "environment_class": "real",
  "result": "PASS",
  "command": "python contracts/openstack_smoke.py",
  "exit_code": 0,
  "run_id": "20260804-resource-model",
  "slice_id": "align-001",
  "evidence_ref": ".evidence/20260804-resource-model/001-align-001-smoke-openstack.json",
  "evidence_sha256": "<artifact-sha256>",
  "attestation_ref": ".evidence/20260804-resource-model/900-align-001-external-attestation.json",
  "attestation_sha256": "<attestation-sha256>",
  "git_head": "<same-as-snapshot-head>",
  "accepted_by": "environment-owner",
  "accepted_at": "2026-08-04T11:55:00+08:00"
}
```

Raw artifact 必须保持 `evidence-run` 原样，且 `schema/run_id/slice/phase=smoke/cmd/cwd/workdir/exit_code/expectation_met/git_sha/git_dirty` 与 ledger、冻结 external policy 和当前 snapshot 一致；不要事后向 raw evidence 写入工具本来不产出的字段。

```json
{
  "schema": "evidence/v1",
  "run_id": "20260804-resource-model",
  "slice": "align-001",
  "phase": "smoke",
  "cmd": "python contracts/openstack_smoke.py",
  "argv": ["python", "contracts/openstack_smoke.py"],
  "cwd": "C:/repo",
  "workdir": "C:/repo",
  "exit_code": 0,
  "expectation_met": true,
  "git_sha": "<same-as-snapshot-head>",
  "git_dirty": false
}
```

环境负责人另产并授权以下 attestation；其 hash 写入 ledger，且 `accepted_by` 不得是任何本轮内部 alignment 角色：

```json
{
  "schema": "design-alignment/external-attestation/v1",
  "raw_evidence_ref": ".evidence/20260804-resource-model/001-align-001-smoke-openstack.json",
  "raw_evidence_sha256": "<artifact-sha256>",
  "run_id": "20260804-resource-model",
  "slice_id": "align-001",
  "command": "python contracts/openstack_smoke.py",
  "git_head": "<same-as-snapshot-head>",
  "environment": "openstack-staging",
  "environment_class": "real",
  "result": "PASS",
  "accepted_by": "environment-owner",
  "accepted_at": "2026-08-04T11:55:00+08:00"
}
```

任何条目一旦标为 `EXTERNAL_VERIFIED`，local 与 external gate 都会验证 raw smoke、attestation、hash 和 policy；只有仍为 `LOCAL_VERIFIED` 的外部需求可在 local gate 下暂不要求外部工件。

## 阻断与风险

`BLOCKED` 在 finding 和 requirement `final_check` 中记录：

```json
{"blocker": {"reason": "缺少真实 OpenStack 凭据", "next_action": "环境负责人提供 staging project 后重跑验收"}}
```

`ACCEPTED_RISK` 必须在两处引用用户真实授权，且状态历史最后一步由 `user` 执行：

```json
{
  "accepted_risk": {
    "authority": "user",
    "approved_by": "user",
    "source_ref": "conversation:<real-message-id>",
    "reason": "明确接受本次不交付该能力"
  }
}
```
