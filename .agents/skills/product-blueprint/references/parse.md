# 解析（product-blueprint）

## mode

| 触发语 / 线索 | mode |
|---------------|------|
| 业务蓝图 / 流程蓝图 / 一稿确认 / 对照 PRD / 偏航 | `blueprint` |
| 开工规格 / 交 go-fast / 出 specs / 可落地规格 | `spec` |
| 已有…再评 / 现状体检 / 蓝图 audit / 模块流程评审（非八维打分） | `audit` |
| 显式 `mode=…` | 以显式为准 |
| 未提 | 默认 `blueprint` |

## 其它参数

| 线索 | 参数 |
|------|------|
| `最多N问` / `max_questions=N` | `max_questions`（默认 3） |
| `零问` / `max_questions=0` | 不追问，全假设 |
| `无人值守` | 确认面不等人；硬决策耗尽仍不清 → `DONE_WITH_CONCERNS`；`domain_strength=weak` → 不得伪 `DONE` |
| `对照 prd …` / 分片路径 | `prd_refs[]` |
| `scope=…` / 模块名 / 流程名 | `scope` |
| `缩席` / 单页文案 | 尝试 [council.md](council.md) 缩席（领域席仍不可省） |
| `改 H1=…` / `改 F2=…` | 确认后修订 → [revision.md](revision.md) 分级 |

## 示例

```text
/product-blueprint 对照 docs/automate/prd/backup-*.md 出业务蓝图，确认有没有偏航
```

```yaml
mode: blueprint
scope: backup-dr
prd_refs: [docs/automate/prd/…]
max_questions: 3
```

```text
product-blueprint mode=spec scope=容灾切换执行 开工规格
```

```text
product-blueprint mode=audit scope=备份策略 对已有流程做蓝图再评
```
