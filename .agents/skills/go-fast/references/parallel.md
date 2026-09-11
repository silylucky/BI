# 并行：舰队 · worktree + subagent

主 Skill「并行加速」的细则。目标是**缩短墙钟时间**：分派图 → 波次洪水派发（上限 20）→ 合并门 → 合回 `base_branch`。不是多开几个互踩的 agent。

派发提示词模板：[implementer-prompt.md](implementer-prompt.md)；证据层见 [evidence.md](evidence.md)。

## 1. 分派图（DAG + 白名单）

每片写清：

| 字段 | 内容 |
|------|------|
| id | `S1` / `auth-login` … |
| 行为 | 一句话可观察结果 |
| 路径白名单 | 允许改的目录/文件 glob（产品刺点优先用证据路径） |
| 依赖 | 无 / 依赖 `S0` 的导出类型 **或** 产品语义前置（共享壳/RBAC/状态机） |
| seam | 本片测试边界 |

**可同波**：依赖边指向的前置片均已 DONE（或无依赖），本波内白名单两两不相交，**且**通过 §1.4 impact 门（有图时）。  
**不可同波**：同一文件、同一 schema、后片要 import 前片尚未合并的 API、白名单 glob 相交、impact 相交、**同 flow/module 共享壳/布局/RBAC/同一状态机且未先合并契约片** → 串行，或先单独一片「契约/共享类型/共享壳」完成后再并行。

**前沿**：无未完成阻塞者，可与同波已选片白名单不相交，且（跳过或通过）impact 的集合。取前沿时**尽量填满**，最多 **20**（`fleet_cap`）。  
**路径不交 ≠ 可并行**：产品语义边未解除前禁止同波硬并；glob 不交但调用图相交亦禁止同波。

路径相交检测（最低要求）：

1. 展开每片白名单为路径前缀/文件集合（粗估即可：同目录写权限冲突算相交）。  
2. 两片共享任一将被改写的路径 → 不相交失败。  
3. 只读调研可共享路径；实现片之间必须不相交。  
4. 产品报告来源：检查两片是否同改壳层/权限模型/同一状态机文案真源 → 有则加阻塞边（即使 glob 不交）。  
5. 路径过关后 → 走 §1.4（有图才做）。

### 1.4 codegraph impact 门（补「glob 不交但语义相交」）

工具约定见 [code-scanning](../../code-scanning/SKILL.md)；配方见其 [codegraph-usage.md](../../code-scanning/references/codegraph-usage.md)。**subagent 一律用 CLI**，勿写 MCP。

| 仓内状态 | 动作 |
|----------|------|
| 无 `codegraph` CLI，或无 `.codegraph/`，或源文件 < 100（小仓） | **跳过** impact；回传 `impact_check: skipped` + 原因；**不**临时 `init` 拖慢流水 |
| 有 `.codegraph/` | 先 `codegraph status`；有 pending 且落在本批白名单 → `codegraph sync`；sync 失败 → **降级跳过** + `impact_check: skipped`（不得拿过期图下「不相交」结论） |
| 索引新鲜 | 对候选同波每片取 **1 个核心符号**（工单/规格里的主入口、handler、核心类型），跑 `codegraph impact <符号> --json`；两片影响面文件/符号集合有交集 → **不可同波** |

```bash
command -v codegraph >/dev/null && [ -d .codegraph ] || echo "skip impact"
codegraph status   # Pending sync → sync；失败则 skip
codegraph impact <片A核心符号> --json > /tmp/impact-a.json
codegraph impact <片B核心符号> --json > /tmp/impact-b.json
# 影响面有交集 → 串行；写不清核心符号 → 该对候选串行或缩白名单，禁止假装已验 impact
```

**禁止**：有可用新鲜图却只靠白名单洪水派发；用图的「没找到」证明无耦合（动态路由/反射须 rg 复核，疑则串行）。

### 1.1 白名单的反向激励（编排方必须知道）

白名单要求「两两不相交」，于是片 agent 的最优策略永远是**复制**：把公共逻辑提取到共享位置 → 白名单相交 → 不能同波 → 该片被退回或串行；在自己片内复制一份 → 白名单干净 → 并行、片内测绿、合并门过、DONE。**并行度越高、架构越碎**——这是机制在奖励堆补丁，不是片 agent 偷懒，片 agent 也无法自救。对冲只能由主编排承担：

| 时机 | 主编排动作 |
|------|-----------|
| 划分派图时 | 扫一遍各片工单，凡 **≥2 片会碰同类逻辑**（表单校验、错误处理、请求封装、权限判断、列表分页、时间/金额格式化…）→ 先插 `refactor-shared`；**禁止**让它们并行各写各的 |
| 片回传 `NEEDS_CONTEXT` 且理由为「建议提取共享」 | **禁止**简单回一句「就地实现」了事——那正是堆补丁的来源。要么插 `refactor-shared`，要么把「本次确不提取」的理由写进 `summary` |

### 1.2 S0 壳层波次（前端批次强制前置）

**触发**：本批含 **≥2 个前端页面片** → **必须**先串行完成 S0 壳层片，合回集成区后才允许铺页。S0 **禁止**与页面片同波。

S0 内容边界（只做壳，不做业务页）：

| 类别 | 产出 |
|------|------|
| 应用壳 / 布局 | 导航、侧栏、面包屑、内容区容器 |
| 页模板 | 列表页 / 详情页 / 表单页骨架（对应 `docs/ui` 菜谱） |
| 共享 UI 组件 | PageHeader / DataTable / FormSection / EmptyState / Dialog / 分页 / toast |
| 设计 token | 颜色、间距、字号、密度（来源为 `docs/ui` 设计锚，**禁止**自造） |
| 导航与权限表面 | 菜单注册点、操作可见性判断入口 |

**闭环（漏了等于白做）**：S0 合回后，主编排**必须**把 S0 产出的**组件实际路径**写进后续每个页面片 implementer-prompt 的「UI 契约·必须复用」段。只做 S0 不回填路径 = 后续片照样各造一套。

**跳过**（须把理由写进 `summary`）：

| 条件 | 判定方法 |
|------|---------|
| 本批只有 1 个页面片 | 数分派图里的前端页面片 |
| 仓内壳层已成熟 | 上表中壳/页模板/共享组件三类都能指出仓内实际路径，且抽查 2 个既有页确实在用它们 |

壳层只部分成熟 → **不跳过**，S0 缩为「补齐缺的那几类」。

**跳过 ≠ 免锚**：两条跳过条件都只免 S0 这一波，**不免** `docs/ui/anchor.md`。缺设计锚时哪怕只有 1 个页面片也会即兴发挥——按 go-fast「开工前」第 4 步先落最小基准（6 项）再铺页。

### 1.3 `refactor-shared` 片型（对冲复制）

**触发**（任一即插片）：

| 触发 | 判定 |
|------|------|
| 分派图里 **≥2 片**的工单要实现相似逻辑 | 划图时按 §1.1 扫描 |
| 某片回传 `NEEDS_CONTEXT` 建议提取 | 见 implementer-prompt 状态表 |
| debt-map 中某模块 `touch_count >= 3` | debt-map 定义见 [loop-orchestrator-contract.md](loop-orchestrator-contract.md) §14 |

**授权兜底（编排方漏判时这里拦）**：由 debt-map 升格触发的提取属于架构加深，须先按 [arch-reviewer](../../arch-reviewer/SKILL.md) 归级——
`local-deepen` **必须 ADR 已落盘**才可开工（缺 ADR → 本片不派，记 `blockers`）；实属 `structural` → **park 升人**，**禁止**拆成多个 `local-deepen` 蚂蚁搬家绕过。

**执行**：

- **独占一波**，不与任何其它片同波；
- **允许跨白名单**——这正是它存在的意义，它是唯一被允许改公共路径的片型；
- **只搬不改行为**：提取 + 改调用点，**禁止**顺手加功能、改接口语义；
- 合回集成区后再刷新前沿派下一波；后续片 implementer-prompt 的「仓内已有抽象」段必须写上新路径。

**完成判定**（结构性，不是「消掉几个 finding」）：

| 判据 | 检查 |
|------|------|
| N 处重复收敛到 1 处 | 原 N 个位置不再各自实现 |
| 原调用点全部改指过来 | 搜不到旧实现的残留引用 |
| 相关测绿 | `gate-check slice --slice <id>` PASS，且用例数**不得**下降 |

三条缺一 → 不算 DONE，**禁止**合回后继续铺波。

## 2. Worktree

### 检测

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
# 若已在 linked worktree（且非 submodule）→ 不要再套一层；在该隔离区串行或只派读-only
git rev-parse --show-superproject-working-tree 2>/dev/null
```

### 目录优先级

1. 用户指定目录  
2. 已有 `.worktrees/`（优先于 `worktrees/`）  
3. 已有 `worktrees/`  
4. 新建 `.worktrees/`（**必须**被 gitignore）

```bash
git check-ignore -q .worktrees || git check-ignore -q worktrees
# 项目本地目录未被忽略 → 写入 .gitignore 对应行后再建（是否提交听用户）
```

### 创建（无原生 worktree 工具时用 git）

```bash
git check-ignore -q .worktrees || echo ".worktrees/" >> .gitignore
git worktree add ".worktrees/go-fast-S1" -b "go-fast/S1"
# subagent 的 cwd = 该路径的绝对路径
```

分支名：`go-fast/<slice-id>` 或用户约定前缀。片分支从**当前集成锚点**（通常 `integrate_branch` 或 `base_branch` 最新 tip）分出，避免片与片基线漂移过大。

有 Cursor/平台原生「进入 worktree」能力时，**优先原生**，避免 git 与 IDE 状态不一致。

### 依赖安装（可选、跟仓）

新建 worktree 后，若仓需要独立 `node_modules` / vendor，按仓文件自动装（有则跑、无则跳过）：

- `package.json` → 仓内惯用包管理器 install  
- `go.mod` → `go mod download`  
- `Cargo.toml` / `pyproject.toml` / `requirements.txt` → 仓内惯用命令  

不强制全量测基线（洪水模式墙钟优先）；片内验证仍须绿（**仅白名单**；禁各树同时 FE 全量，见主 Skill「验证纪律」）。

### 失败降级

沙箱拒绝 `worktree add` 或资源不足 → **缩小波宽或本工作区串行**，写入回传 `summary`/`blockers`，不假装并行。

### 清理（合回成功后必须）

触发条件：本批已 `merge` 回 `base_branch` **且**本批验证门绿（单独：相关+全量，除非 skip；loop 轮次：相关即可）。  
范围：本批创建的 **全部** 片 worktree、片/开发分支，以及已并入且 ≠ `base_branch` 的 `integrate_branch`。串行单开发分支同理。

```bash
# 对每个已并入的片（示例 S1）；integrate 分支同样处理
git worktree remove --force ".worktrees/go-fast-S1"   # 目录仍在则 remove；已不在则 skip
git branch -d "go-fast/S1"                            # 仅已合并；未合并用 -D 禁止默认走
# 若 integrate_branch 已并入 base_branch：
git branch -d "go-fast/integrate"
```

规则：

| 情况 | 动作 |
|------|------|
| 合回且本批验证门绿 | **必须**清干净；回传 `cleanup.done: true` + `removed_*` |
| 用户开工前/合回前明示保留 | 可留对应项，写入 `cleanup.kept`；其余仍清 |
| 未合并 / 验证门红 / BLOCKED | **禁止**删；列入 `cleanup.remaining` |
| 仅主工作区改 `base_branch`、未建隔离区 | `cleanup.done: true`，列表可空 |

**禁止**：验证门绿后「听用户是否保留」再拖着不删；禁止把清理推到 followups 才算 DONE。

## 3. 波次循环（洪水派发）

```text
记录 base_branch + integrate_branch
建分派图（按 §1.1 扫同类逻辑 → 需要则插 refactor-shared）
若本批 ≥2 前端页面片 → 先串行 S0 壳层片，合回后把组件实际路径回填各页面片 UI 契约（§1.2）
loop:
  frontier = 可同波前沿（≤ fleet_cap 20）；含 refactor-shared 时本波只派它（§1.3）
  if frontier empty and unfinished remain → 等依赖 / 串行解阻 / BLOCKED
  if frontier empty and all done → 跳出
  为 frontier 建 worktree+分支
  同一轮派出 |frontier| 个 implementer（见 implementer-prompt）
  等齐 → 合并门（§5）
  刷新分派图状态
合回 base_branch（§6）
按全量时机验证（单独≤1 次全量；loop 轮次仅相关）
清理本批 worktree + 片/开发/集成分支（§2）
unattended：收尾 code-reviewer 变更面 + cr_fix_scope 内可修项自动修（单独=all；polishing 默认 all；prd/product 默认 P0+P1）
           → 自动修单独 commit → 相关测（红则 revert 该 commit）→ 全量跟时机
```

要点：

- **一次回复里**发起多个 Task/subagent，才会并行。一个接一个派 = 串行，丢掉加速。  
- **模型锁定**：所有 go-fast Task/subagent **省略 `model`**，继承主会话模型；禁止为「更强 / 更快 / 更便宜」另指定模型。  
- 主编排只做：划片、相交检测、派发、合并门、合回、按全量时机验证、**合回后清理**、**unattended 收尾 code-reviewer 自动修**。  
- 实现 subagent **不**每片再派规格/质量双审；深审放合并门轻量检查 + 收尾 code-reviewer（`unattended` 强制 `go-fast-unattended-fix`；`attended` 建议且修前确认）。

## 4. Subagent 提示词

必须自包含；**完整模板**见 [implementer-prompt.md](implementer-prompt.md)。最低字段：

- worktree 绝对路径、分支名  
- 规格摘要 + **本工单/切片全文**  
- seam、路径白名单、红绿纪律、验证命令  
- 回传四态：`DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED`  
- 禁止：假绿、越白名单、push、无依据停问「是否继续」

只读调研 / 分文件排障：可无 worktree，仍要范围与产出格式。

### 状态处理（主编排）

| 状态 | 动作 |
|------|------|
| DONE | 进合并门 |
| DONE_WITH_CONCERNS | 读 concerns；正确性/范围问题先处理再合并，观察性备注可记入 summary 后合并 |
| NEEDS_CONTEXT | 补上下文后**重派同一片**（勿盲改别片） |
| BLOCKED | 拆更小片 / 补上下文 / 升给人；**禁止**换模型；**禁止**无改动重试同一提示 |

## 5. 合并门（每波）

1. 各片自测绿；`git diff` 相对白名单无越界（`refactor-shared` 片按 §1.3 例外）。合并前对每片跑 `gate-check slice --slice <id>`：**FAIL 的片不许合并**——回传 `DONE` 但 gate FAIL，一律按 FAIL 处理。  
2. 集成点：主 worktree 的 `integrate_branch`（缺则从 `base_branch` 建 `go-fast/integrate`）。  
3. 按依赖序 `merge`（或 rebase，跟仓惯例）各片分支进集成区。  
4. 冲突 → **停并行**，主编排解决或再派**单** agent 修冲突片；勿继续派新波盖住冲突。  
5. 集成后跑**本波相关测试**（触及目录/包），一律用 `evidence-run --phase merge` 包裹（此时工作区应已 commit）；**禁止**此步 FE 全量、禁止多 worktree 同时全量。红则只修冲突/失败片，复测相关后再续波。  
6. 任一片未进合并门（BLOCKED / NEEDS_CONTEXT 未解决）→ 不得把该片算入 DONE；未全绿前禁止合回 `base_branch` 并宣称整批完成。  
7. **全量**：单独 go-fast → 合回后 ≤1 次；`orchestrator=loop-goal-product|loop-goal-prd|loop-polishing` → **本轮禁止全量**（polishing 显式中途除外），留给 loop 整环结束（见主 Skill「验证纪律」与 [loop-orchestrator-contract.md](loop-orchestrator-contract.md) §5）。

## 6. 合回初始分支

全部切片/工单进入集成且合并门全绿后：

| attendance | 动作 |
|------------|------|
| unattended | `checkout base_branch` → merge `integrate_branch` → **相关测**（单独再按需全量；loop 轮次禁全量）→ **绿则立即清理**本批 worktree + 片/开发/集成分支 |
| attended | 停问是否合回 `base_branch`；同意后 merge + 同上测序 → **绿则立即清理**（合回确认 ≠ 保留分支；保留须另说） |

规则：

- **禁止**跳过合回后**相关测**；单独调用未 `skip_full_test` 时禁止跳过收尾全量；loop 轮次禁止本轮全量。  
- 验证门红 → 停在可复现状态，`status: BLOCKED` 或 `DONE_WITH_CONCERNS`，不删证据分支。  
- 验证门绿后 → **必须**执行 §2「清理」；未清理不得宣称整批 `DONE`（用户明示 `kept` 除外）。  
- 推送/PR 仍仅用户明确要求。  
- `base_branch` 为 main/master 时：仍按上表合回（本地 merge）；**不**擅自 push。

## 7. 反模式

- 未建 worktree 却让两 agent 写同一 checkout（必互踩）  
- 未做白名单相交检测就「洪水」硬派（典型：两 agent 改同一 `types.ts` / 同一路由文件）  
- 有新鲜 `.codegraph/` 却跳过 §1.4，导致 glob 不交、调用图相交的两片同波互踩  
- 同波超过 20 且无用户预先授权  
- 并行片里横批写完所有测试再实现  
- 合并前不跑测试、或 `gate-check slice` FAIL 仍宣称 DONE  
- 舰队并发时片内 `pnpm test` / 裸 `vitest`（watch）/ 无路径全量；波次合并门再跑 FE 全量  
- 为并行而把本可一条竖切的行为拆成共享状态的碎片  
- 一批里 N 个前端页面片仅因 glob 不交就同波铺页（未先做 S0），各造一套页头/空态/表格壳  
- 做了 S0 却不把组件实际路径回填进各页面片的「UI 契约·必须复用」段  
- 片回传「建议提取共享」，主编排答「就地实现」了事  
- `refactor-shared` 与其它片同波，或借提取之机夹带功能改动  
- 套用外部「禁止并行实现 subagent」流程抵消本舰队模型  
- 派发时传 `model` 或片 BLOCKED 后换更强模型重试
