# 冻结契约

## 目的

把讨论、PRD、蓝图、spec 或 ADR 中已经批准的目标转成稳定、可哈希、可逐项验收的真源。契约描述“应当是什么”，不描述当前代码，也不把修复方案伪装成需求。

## JSON 结构

```json
{
  "schema_version": "1.0",
  "contract_id": "resource-model-v1",
  "title": "资源模型目标设计",
  "approval": {
    "status": "FROZEN",
    "authority": "user",
    "approved_by": "user",
    "approved_at": "2026-08-04T10:00:00+08:00"
  },
  "source_refs": [
    "conversation:message-id",
    "docs/specs/resource-model.md@commit"
  ],
  "source_coverage": [
    {
      "id": "SRC-001",
      "source_ref": "conversation:message-id",
      "source_item": "租户不感知底层云厂商",
      "disposition": "INCLUDED",
      "requirement_ids": ["REQ-001", "REQ-002"]
    },
    {
      "id": "SRC-002",
      "source_ref": "docs/specs/resource-model.md@commit",
      "source_item": "OpenStack Project 真实隔离",
      "disposition": "INCLUDED",
      "requirement_ids": ["REQ-003"]
    }
  ],
  "items": [
    {
      "id": "REQ-001",
      "statement": "用户申请资源时不需要选择或理解底层云厂商。",
      "acceptance_criteria": [
        "租户侧 API 不要求 provider_type。"
      ],
      "required_verification": "local",
      "local_verification_policy": {
        "criterion": "租户侧 API 不要求 provider_type。",
        "cwd": ".",
        "commands": ["go test ./adapter/..."]
      }
    },
    {
      "id": "REQ-002",
      "statement": "租户侧调度错误保持平台统一语义。",
      "acceptance_criteria": [
        "调度失败响应不泄漏厂商内部标识。"
      ],
      "required_verification": "local",
      "local_verification_policy": {
        "criterion": "调度失败响应不泄漏厂商内部标识。",
        "cwd": ".",
        "commands": ["go test ./service/..."]
      }
    },
    {
      "id": "REQ-003",
      "statement": "OpenStack Project 映射必须在真实接入环境中保持租户隔离。",
      "acceptance_criteria": [
        "真实 Project 凭据创建的资源只能在对应映射范围查询。"
      ],
      "required_verification": "external",
      "local_verification_policy": {
        "criterion": "OpenStack Project 映射的本地契约测试通过。",
        "cwd": ".",
        "commands": ["go test ./adapter/..."]
      },
      "external_acceptance_policy": {
        "environment": "openstack-staging",
        "authority_ids": ["environment-owner"],
        "smoke_command": "python contracts/openstack_smoke.py",
        "cwd": "."
      }
    }
  ]
}
```

## 规则

- 用 `REQ-###` 稳定编号；版本内不得重排或复用已删除 ID。
- 用 `SRC-###` 逐项登记原始来源；每个 REQ 至少由一个 `INCLUDED` source item 导出。原始条目若 `OUT_OF_SCOPE`，必须记录用户批准、消息引用和理由。
- 每项只表达一个可判定不变量，并且 `acceptance_criteria` 恰好一条；复合目标拆成多个 REQ。
- `acceptance_criteria` 必须描述可观察结果，禁止“代码已完成”“接口已提供”这类实现陈述。
- 每个 REQ 必须冻结 `local_verification_policy`：一个本地可判定 criterion、一个明确的仓库相对 `cwd` 与一组精确、唯一的命令。`cwd` 不得是绝对路径或包含 `..`；`.` 表示仓库根。Local REQ 的 criterion 必须逐字等于 `acceptance_criteria[0]`；external REQ 可使用明确的本地前置验证 criterion，但最终条件仍只能由 external policy 证明。
- 命令必须直接验证该 REQ 的行为。把 `python -c pass`、文件存在检查或别的 REQ 测试写进计划任意位置，不会获得验证资格；变更命令必须升版并重新批准 contract。
- 需要真实数据库、云厂商、硬件、消息系统或跨服务协同时使用 `external`。
- 每个 external REQ 必须在用户冻结契约时同时批准 `external_acceptance_policy`：真实环境标识、环境负责人运行时 ID 白名单、精确 smoke command 及其仓库相对 `cwd`；执行时临时自造的负责人或临时换目录无效。
- `evidence-run` raw smoke 保持原样；环境负责人用独立 `design-alignment/external-attestation/v1` 绑定 raw path/SHA 与冻结 policy。Attestation 是身份信任边界，运行时日志仍需留存。
- 用户只确认部分内容时，先保留未决项，不得把推断写成 `FROZEN`。
- `approval.authority` 必须是 `user`；Agent 或项目经理的进度要求不能替代用户批准。
- 批准后运行 `validate_alignment.py hash`；ledger 保存整个文件的 SHA-256。
- 变更目标时创建 `contract-v2.json`，记录新批准依据；不要原地覆盖 v1 后沿用旧哈希。
