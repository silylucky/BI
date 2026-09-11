# 与姊妹 skill 分工 · 接力顺序

| Skill | 本 Skill 边界 |
|-------|----------------|
| [create-evolution-prd](../../create-evolution-prd/SKILL.md) | PRD 真理源；本 Skill 只产**待确认**验收草案，**默认不改**分片 |
| [create-evolution-arch](../../create-evolution-arch/SKILL.md) | 简报确认后回填 §8；本 Skill 不整篇重写 arch |
| [create-evolution-plan](../../create-evolution-plan/SKILL.md) | 有契约/沙箱后再排里程碑；本 Skill 标 BLOCKED 时禁止 mock 顶替 |
| [code-reviewer](../../code-reviewer/SKILL.md) | 抓假绿；命中外部 stub/契约不明时**条件提示**本 Skill |
| [go-fast](../../go-fast/SKILL.md) / [loop-goal-prd](../../loop-goal-prd/SKILL.md) / [loop-goal-product](../../loop-goal-product/SKILL.md) | 契约不明门：本 Skill 出简报+候选+八维表；`auto_best` 时调用方选定后真接（三方**同一口径**） |
| [plan-reviewer](../../plan-reviewer/SKILL.md) | 八维同尺；本 Skill 出候选与证据，择优可嵌简报或由 go-fast `auto_best` 执行 |
| [docs-reviewer](../../docs-reviewer/SKILL.md) | 正式 api/adr；简报可链出去，勿把未确认简报抄成已交付 api |
| [create-dev-config](../../create-dev-config/SKILL.md) | 凭据归属地：`.dev` `integrations[]` 登记服务/端点/**env 变量名**/状态/smoke 路径。本 Skill **只读变量名**，**永不**写凭据值 |

接力顺序（推荐）：

```text
缺口发现（PRD/arch/reviewer / go-fast / loop）
  → integration-research（简报 + 候选）
  → 分支：
      attended / 单独研究：用户确认 → 回填 arch/PRD → go-fast 真接
      unattended + auto_best（go-fast / loop-goal-prd / loop-goal-product）：
        八维择优选定 → 写入 specs（必要时最小 arch 依赖句）→ 直接 go-fast 真接
        → 难回退选型可事后稀疏 ADR（ledger 注明 needs_adr / auto_best）
```

`unattended` + `auto_best` 不等人的完整口径见 [phases.md](phases.md) Phase 4；**禁止** loop-goal-product 另写「契约不明一律 BLOCKED」而跳过本 Skill。
