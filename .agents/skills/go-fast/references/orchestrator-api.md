# go-fast 编排接口（三环 Phase 0 必读 · Fix 时戴实现帽）

**给谁看**：`loop-goal-prd` / `loop-goal-product` / `loop-polishing` 的**编排方**。  
- **Phase 0 / Review / 前门**：只需要「怎么调、传什么、回什么、什么算过关」→ 读本文 + 契约 + [card](loop-orchestrator-card.md)，**不必**啃 go-fast 全文。  
- **Phase 3 Fix**：编排方必须**戴上 go-fast 实现帽**（或派出等价 Task），按 §1.1 加载最小必读集后再开工——**禁止**只凭本文「心想舰队」。

不变量（前门 / 回写 / Path A / 契约门 / 全量 / Resume）真源仍是 [loop-orchestrator-contract.md](loop-orchestrator-contract.md)；本文讲**调用面 + Fix 动作**。

---

## 1. 调用方式

每轮 Fix：**执行** go-fast（见 §1.1），传入下表参数。

| 传入 | 值 | 说明 |
|------|----|------|
| `orchestrator` | `loop-goal-prd` \| `loop-goal-product` \| `loop-polishing` | **必传**。决定 CR 范围、全量推迟、回写目标 |
| `attendance` | `unattended`（默认）\| `attended` | 三环未写 attended 时 go-fast 按 `unattended` |
| `integration_policy` | `auto_best_require_adr`（三环默认）\| `auto_best` \| `park` | 契约 §2 |
| `cr_fix_scope` | polishing=`all`；prd/product=`P0+P1`；可显式覆盖 | 契约 §8 |
| `source_report` | 本批发起时的源报告 / 源 Inventory 路径 | 回写目标，**必传** |
| `batch` | 本轮 ID 列表（≤ `batch_size`） | 选批序见 card |
| `spec_ref` / `spec_reuse` | 命中契约 §6.1 时传已有 `docs/specs/<slug>.md` | 否则留空走路径 B |

**不传** `model`：go-fast 及其一切 subagent 继承当前会话模型（go-fast 硬规则）。

### 1.1 执行 go-fast（动作 · 唯一口径）

「执行 go-fast」= 下列二选一，**必须落一种**；口头「走 go-fast」不算。

| 模式 | 动作 |
|------|------|
| **A. 同会话戴帽（默认）** | 主会话切换为 go-fast 主编排：按本表加载必读 → 分叉 / 派实现 subagent / 合回 / 回写 / CR；业务树仍只经实现 subagent（合法降级填 `zero_reason`） |
| **B. Task 委派** | 派一个 Task/subagent，提示词**显式要求** Read 并遵守 `~/.agents/skills/go-fast/SKILL.md`（含下表最小集）+ 传入上表参数；回传字段须满足本文 §3 |

**最小必读集**（模式 A/B 均适用）：

| 时机 | 必须 Read |
|------|-----------|
| **本会话首次 Fix**；或 **Resume / 新会话 marathon 后首次 Fix** | [go-fast/SKILL.md](../SKILL.md) 至少这些节：**主流程分叉**、**开工前**、**并行加速**、**红绿循环**、**验证纪律**、**收尾**、**回传格式**、**红线**；若本会话未读过则加 [evidence.md](evidence.md)。派片前再读 [implementer-prompt.md](implementer-prompt.md)（可只在派发当轮读） |
| **同会话后续 Fix 轮** | **不**强制重读全文；必读 [card](loop-orchestrator-card.md)；命中下表触发条件则补读对应节 |
| **整环从未加载上表最小集** | **禁止**宣称已执行舰队 Fix / 填 `wave_size` 假装派过 |

**后续轮回读触发**（命中任一 → 补读 go-fast 对应节或全文）：`evidence_mismatch`；`gate_fail_streak ≥ 1`；连续 `zero_reason: degrade`；用户点名改 go-fast 行为；本文与实测冲突。

Phase 0「不读 go-fast」**只**省 Review 前的 token；**不**授权 Fix 零读。

---

## 2. go-fast 内部会自己做的事（编排方不必指挥细节）

1. 主流程分叉 → 路径 A（已有规格直接干）或路径 B（出 `docs/specs` → plan-reviewer 规格门 → tickets）。
2. 记录 `base_branch` / `integrate_branch`；建 worktree + 派实现 subagent（上限 20）。
3. 波次合并门 → 合回 `base_branch` → **只跑相关测**（三环内**禁**全量）。
4. 合回且验证门绿后：清理本批 worktree / 片分支。
5. **回写源报告 / PRD+plan / 打磨报告**（契约 §3：go-fast 是**唯一写者**）。
6. `unattended` 收尾强制 code-reviewer（`go-fast-unattended-fix`），按 `cr_fix_scope` 自动修。

**「不代劳」的边界（旧表述「只校验结果、不代劳任何一步」曾被读成「编排方不许跑任何命令」，那正是自证闭环的来源）**：

| 编排方**不**代劳 | 编排方**必须**亲自做 |
|------------------|----------------------|
| 写实现 / 改业务树 / 修 finding / 决定切片与测试命令 / 抢先回写 | 在目标仓执行 `gate-check`（`batch` / `case-count` / `smoke`，必要时 `verify`）做**事实校验**，以退出码为准 |

`gate-check` 是**只读**判定，不改任何业务文件，不属于代劳。**禁止**以「不代劳」为由跳过 B 层（契约 §5.1）。

---

## 3. 回传里编排方必须看的字段

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
merged_to_base: false        # 前门第 1 条
summary: []                  # 已回写 ID；有可完成项时禁止空（前门第 3 条）
wave_size: 0
zero_reason: degrade | no_fixable_items | blocked_upstream | ""
degrade_reason: ""
path: A_direct | B_spec_tickets | skipped
spec_reuse: false
tickets_dir: ""
slices:                      # batch↔slice 强制映射；`--slices` 的唯一来源（契约 §5.1 B 层）
  - id: ""                   # 与 evidence-run --slice 用过的值完全一致
    finding_ids: []          # 本片消化的 batch 项；refactor-shared / S0 写 []
    kind: impl | s0_shell | refactor_shared
    status: DONE | BLOCKED
source_report: ""
full_suite: { deferred_to_loop: true, ran: false }   # 三环内必须如此
cleanup: { remaining: [] }   # 残留 worktree，结构见契约 §5.3.1
code_review:
  ran: true|false
  status: DONE | DONE_WITH_CONCERNS | BLOCKED | skipped
  fix_scope: P0+P1 | all
  remaining: []              # concerns 时须仅裁定/契约/需人批类
  product_surface_touched: false   # 触及主任务/入口/权责 → 编排方记 code_review_delta
integration_decisions: []
external_deps: []            # {name, credential: have|need|blocked, smoke}；前门按契约 §5.1 B 层校验
evidence:                    # 证据层工件索引；结构见 evidence.md §4
  run_id: ""
  gate: { status: PASS | FAIL, reasons: [] }   # **仅参考**：以编排方自跑的 gate-check 为准
  slices: []
  smoke: []
  degraded: []
```

完整字段表见契约 §11；公共回传骨架见 §11.1。

---

## 4. 编排方判定速查

| 回传 | 编排方动作 |
|------|------------|
| **任何**声称完成的回传 | 先自跑 `gate-check batch --slices <回传 slices[].id 全集> [--strict-red]`；退出码 ≠ 0 → 前门失败（§5.2），**不看**回传怎么写。`2` = ENV_ERROR，同样按失败处理 |
| 回传缺 `slices[]` / `finding_ids` 未覆盖全部 batch 项 | A 层失败：要求 go-fast 补齐映射；**禁止**自己编 slice-id 去跑（查无工件 → exit 2） |
| `evidence.gate.status` 与自跑结论不符 | 以**自跑**为准；记 `evidence_mismatch: true`；下轮强制 `--strict-red` + 抽查 `verify`（§5.1.1） |
| `external_deps[]` 有 `credential: have` 却 `smoke: ""` 且已标实现 | 假通 = 假绿 → 前门失败；`need` / `blocked` 只能 park / concerns，禁进 `summary` |
| `DONE` + `merged_to_base: true` + `summary` 非空 + B 层 PASS | 过前门 → 再评/再盘点（契约 §5.1） |
| `DONE_WITH_CONCERNS` 且 `code_review.remaining` 仅裁定/契约/需人批类 | **同样过前门**，ledger 记 concerns |
| `DONE_WITH_CONCERNS` 但仍有可修 P0/P1 未修 | 前门失败 → §5.2，`gate_fail_streak++` |
| `skipped` + `no_fixable_items` | **不是失败** → §5.2.1 无 Fix 推进，`gate_fail_streak` 不变 |
| `skipped` / `BLOCKED` + `blocked_upstream` | 不推进 → 停机表 `blocked` / `pending_human_integration` |
| `summary` 空却称有完成项 | 要求补写或编排方按 §3 补写并记 `writeback_repaired: true` |
| `full_suite.ran: true`（三环内） | **违规**：单轮不得跑全量，记 ledger 并纠正 |
| `wave_size: 0` 且 `zero_reason: degrade` | 合法降级，须有 `degrade_reason`；仍算本轮 Fix |

---

## 5. 编排方禁止代劳（≠ 禁止校验 · ≠ 禁止戴实现帽）

- 主会话在**未**按 §1.1 执行 go-fast 时直接改业务实现树（合法降级由 **go-fast 内部**判定并填 `zero_reason`）
- 抢在 go-fast 回写前勾选 / 标 `done`
- 跳过 §1.1 最小必读集、不派实现 subagent，却把多项揉进一次手改
- 在单轮内要求跑仓 / FE 全量

**反向禁止**：

- **禁止**以「不代劳」为由不跑 `gate-check`（只读校验是编排方本职）
- **禁止**以「Phase 0 不读 go-fast / 省 token」为由在 Fix 阶段零读最小必读集

其余共用红线见契约 §13。
