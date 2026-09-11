# 军团分派与生命周期（loop-goal Phase 3 / R）

每支军团 = 一次有界的 [loop-polishing](../../loop-polishing/SKILL.md) 运行，隔离在 **worktree + 独立分支**。

## 命名

| 项 | 约定 |
|----|------|
| `legion_id` | `L1`… 或短 slug（`auth-flow`） |
| 分支 | `loop-goal/<fleet-slug>/<legion_id>` |
| worktree | `.worktrees/loop-goal-<fleet-slug>-<legion_id>`（相对仓库根） |
| 子 ledger | `docs/material/loop-polishing/<date>-<legion-slug>-ledger.md` |

## 派发清单（每个军团）

1. `git worktree add <path> -b <branch> <base_ref>`（`base_ref` = 当前波要求的 base / 前波合入后的 tip）。  
2. 在该 worktree 上下文 **Read 并执行** loop-polishing Phase 0…，传入：

```yaml
orchestrator_parent: loop-goal
scope: "<有界 scope>"          # 禁止 整仓
scope_level: module | subsystem | flow
target_score: <fleet.target_score>
must_reach_target: <fleet.must_reach_target>   # 须与舰队一致；§10.6
max_rounds: <fleet.max_rounds>
min_rounds: <fleet.min_rounds>
fix_scope: <fleet.fix_scope>
attendance: <fleet.attendance>
integration_policy: <fleet.integration_policy>
cr_fix_scope: <fleet.cr_fix_scope>
stop_file: <fleet.stop_file>   # 仍查仓库根；worktree 内相对根可达
# lanes：约束 round-roster 焦点优先这些；composite 仍按 polishing 规则
lane_focus: [product, flow, arch, ui, ux]
force_large_scope: false       # 单军团禁止借舰队名义开整仓
skip_full_test: true           # **强制**：军团 Phase 5 禁止跑仓/FE 全量
full_suite_deferred_to: loop-goal   # 全量只在舰队收尾跑一次
full_suite_every: 0            # 禁止军团中途全量
```

军团内 go-fast 仍 `deferred_to_loop`（只相关测）。军团 polishing Phase 5：落 ledger / 残留 worktree，**跳过全量**，回传  
`full_suite.ran: false`，`full_suite.skipped_reason: deferred_to_fleet`。  
**禁止**军团以自跑全量冒充收尾；舰队 `fleet_met_target` / 干净 `DONE` 才要求全量绿。

3. 军团开始时舰队 ledger 行 → `running`；结束时写入 `status` / `final_total` / `met_target` / `stop_reason` / `legion_ledger`。  
4. **意外停机**（会话断、subagent 失败、无 ledger 更新超时）：标 `crashed` 或 `interrupted`，保留 worktree；**不要**删分支。续跑走舰队 Phase R → `loop-polishing-resume ledger=<legion_ledger>`（在对应 worktree；续跑仍带 `skip_full_test`）。

## 并行

- 同波多个军团：可同时跑（Task/subagent），主会话只维护舰队 ledger 与合回。  
- 每军团内部的 go-fast 舰队仍遵守编排契约（与本层 worktree 隔离正交）。  
- **禁止**两军团 `git checkout` 到同一 `base_branch` 上直接改文件。

## 合回

1. 军团 `done` / `done_with_concerns` 且用户/策略允许合入 → 按冲突图序 merge 进 `base_branch`。  
2. 合入冲突 → 记 `blocked`（合回），fleet concerns；**禁止**强推。  
3. `merge_policy=conflict_order`：有边指向未合入者 → 等待。  
4. **合入成功后立刻**做债务地图合并（契约 **§14.1**）：读子 ledger `debt_touches[]`（及分片若有）→ 串行更新主 `docs/material/debt-map.md` → 删分片 → 记 `debt_map_merged: true`。**下一军团合入前**须完成本步；禁止攒到舰队 Phase 5。  
5. 更新 `residual_worktrees`；已 `merged_cleaned` 可清理 worktree。

## 与 loop-polishing 的边界

| 事 | 谁做 |
|----|------|
| 选 lane / 评分 / dig / 过抛 / go-fast Fix | **军团内** polishing |
| 发现业务线 / 冲突波次 / 建 worktree / 合回序 / 舰队续跑 | **本 skill** |
| **仓/FE 整环全量** | **仅舰队** Phase 5（军团必须 `skip_full_test`） |
| 源报告回写 | 军团内 go-fast（契约 §3） |
| debt-map | 军团只记 `debt_touches[]` / 可选分片；**舰队**合入后按 §14.1 串行 merge 主文件；计数禁止清零 |

## 禁止

- 主会话在 base 上手改业务树「帮军团收尾」  
- 无子 ledger 却宣称军团 `done`  
- 并行军团共用同一 worktree 或同一功能分支  
- **军团 Phase 5 跑全量**（含 `full_suite_every` 中途全量）  
- 军团直接改主 `debt-map.md`，或两军团并行写同一主文件
