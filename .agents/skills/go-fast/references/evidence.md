# 证据层（evidence layer）

> 本体系此前所有的门都是 **LLM 声称 → LLM 校验 → LLM 自填 YAML**。
> 证据层的唯一目的：让「已验证」这句话绑定到一份 **agent 不是随手就能编出来的工件** 上。

两个脚本，放在 skills 仓 `_bin/`：

| 脚本 | 干什么 |
|------|--------|
| `evidence-run` | 包住一条验证命令跑，把 exit code / git sha / 时长 / 用例统计 / 输出尾部落成 JSON 工件 |
| `gate-check` | 读工件，判定各道门是否**事实上**成立，退出码 0=PASS / 1=FAIL / 2=环境错误 |

调用（skills 仓默认在 `~/.agents/skills`）：

```bash
EVIDENCE=~/.agents/skills/_bin/evidence-run
GATE=~/.agents/skills/_bin/gate-check
```

工件落在**目标业务仓**的 `.evidence/<run_id>/`（脚本会自动写进 `.gitignore`，不入库）。

**入口再闸（强制）**：三环 / loop-goal / go-fast 开工前仍须跑编排契约 **§0.5 证据目录门**（ignore + 未跟踪）。脚本自动 ignore ≠ 可跳过：若文件已被 `git add` 跟踪，脚本补 ignore **救不了**，必须 `BLOCKED` 后 `git rm -r --cached .evidence`。

---

## 1. 用法

```bash
# 开工时建一次 run。幂等，且**可以省略**：任何一次 exec 若读不到
# .evidence/CURRENT 会自动建 run。显式 init 的意义是让整批共用一个 run id。
$EVIDENCE init

# 红阶段：期望失败
$EVIDENCE --slice S1 --phase red --expect-fail --label "user login 401" \
  -- pnpm exec vitest run src/auth/login.test.ts

# 绿阶段：同范围应通过
$EVIDENCE --slice S1 --phase green --label "user login" \
  -- pnpm exec vitest run src/auth/login.test.ts

# 外部契约真实请求
$EVIDENCE --slice INT-oss --phase smoke --label "oss put object" \
  -- ./contracts/oss.smoke.sh

# 在 worktree 里跑（片 agent 传 --cwd，或直接在该目录内执行）
$EVIDENCE --slice S3 --phase green --cwd /abs/path/.worktrees/go-fast-s3 -- <cmd>
```

**worktree 语义**：证据永远落在**主仓**的 `.evidence/`，不落在 linked worktree
里 —— 否则 `git worktree remove` 会把证据一起删掉，主编排也读不到。因此各片
agent 无需 init、无需协调路径，天然共用主仓的同一个 run；工件里的
`git_sha` / `git_branch` / `workdir` 仍记录该片实际所在的 worktree。

原命令的 stdout / stderr **原样透传**，退出码**原样返回** —— 可以无缝包住任何既有命令，不改变任何现有行为。

`--phase` 取值与语义：

| phase | 何时 | 期望 |
|-------|------|------|
| `red` | 写完失败测试、实现之前 | 配 `--expect-fail`，退出码应 ≠ 0 |
| `green` | 最小实现之后，同一范围 | 退出码 = 0 |
| `slice` | 片收尾自测 | 退出码 = 0 |
| `merge` | 波次合并门（本波相关测） | 退出码 = 0，且此时应已 commit |
| `full` | 全量（整环结束 / 单独 go-fast 收尾） | 退出码 = 0 |
| `cr` | code-reviewer 自动修后的回归 | 退出码 = 0 |
| `smoke` | 外部契约打真实端点 | 退出码 = 0 |
| `screenshot` | 视觉证据采集 | 退出码 = 0 |

脱敏：默认遮蔽 Bearer / api_key / password / AKIA / sk- / URL 内联凭据等常见形态，可用 `--redact <regex>` 追加。**smoke 工件一定会碰到凭据，不要关掉脱敏。**

---

## 2. 各道门

```bash
$GATE red-green  --slice S1            # 有红工件 + 先红后绿 + sha 在仓内真实存在
$GATE case-count --slice S1            # 用例数不得随轮次下降（防缩白名单换绿）
$GATE slice      --slice S1 [--strict-red]   # 片级综合
$GATE batch      [--slices a,b,c] [--strict-red]  # 本批全部切片
$GATE smoke      --slug oss            # 外部契约真打通过
$GATE verify     --slice S1            # 重跑该片最后一条绿命令（最硬，最慢）
$GATE report     --out docs/material/<...>.md
```

判定要点：

- **`red-green`**：必须存在 `--phase red` 且退出码 ≠ 0 的工件；红的 seq 必须早于绿。「红工件存在但退出码是 0」直接判 FAIL —— 那说明测试从一开始就是绿的，不构成先见红。
- **`case-count`**：同一切片的用例数只允许持平或上升，`red` 阶段也计入对照 —— 最典型的造假就是「红时 12 个失败 → 删掉 9 个 → 绿时 3 个通过」。只在**同一条命令**之间比较（跑全量与跑单文件本就不可比，混比会制造噪音）；红绿命令不一致时给告警。样本不足 2 条时跳过，不算失败。
- **`slice`**：红绿 + 用例数 + 合并门后不得 dirty。**片内边改边测的 dirty 不算问题**，只有 `merge`/`full`/`cr` 阶段要求工作区干净。纯 smoke / 截图片自动跳过红绿门。
- **查无工件 = FAIL，不是 PASS**。`--strict-red` 只降级「缺红阶段」这一类「没做」（无测试基建的产品向片走可观察验收）；假红、缺绿、红绿顺序倒置、sha 对不上属于「做了但对不上」，任何模式下都阻断。切片查不到任何工件时一律不放行并提示排查 slice-id 拼写与执行位置 —— 「查不到证据」恰恰是最常见的失效模式，静默放行会让整层证据形同虚设。**区分两种「查不到」**：切片有 run 但无该片工件 → `FAIL`（退出码 1）；整个 run 不存在 / `.evidence/CURRENT` 缺失 / 工件损坏 → `ENV_ERROR`（退出码 **2**）。两者**都按前门失败处理**，编排方不得把 2 当作「无事发生」。
- **`verify`**：真的把命令再跑一遍比对退出码。这是**全流程唯一不可伪造**的门，代价是慢。用在 Phase 5、发布门、以及对存疑切片的抽查。
- 所有门都支持 `--json`，编排方机读。

`--strict-red`：有测试基建的仓应当开启，红绿留证缺失即硬失败；没有自动测基建的产品向片不开，红绿缺失降级为告警（见 §5）。

---

## 3. 谁必须留什么证据

| 角色 | 时机 | 必须留 |
|------|------|--------|
| 实现 subagent（片内） | 每一刀 | `red`（`--expect-fail`）+ `green`，同一 `--slice` |
| 实现 subagent | 片收尾 | `slice` |
| 主编排 | 波次合并门 | `merge`（本波相关测） |
| 主编排 | 合回 base 后 | 单独 go-fast：`full`；三环内：留给整环结束 |
| go-fast | CR 自动修后 | `cr`（变更面相关测） |
| integration-research / go-fast | 宣称「已对接」前 | `smoke`，真实端点 |
| go-fast（含前端改动时） | 收尾 | `screenshot` |
| browser-reviewer | 真机走查每个路由 | `screenshot`（新页同时收候选金样） |
| ui-ux-reviewer | 出可毕业报告前 | `screenshot`（关键路由） |
| code-reviewer | 自动修后回归 | `cr` |
| 编排方 | 前门 | 不留证据，**跑 `gate-check batch` 读证据** |

---

## 4. 回传字段

go-fast 与各 reviewer 回传里，`commands_run` 的自由文本改为绑定工件：

```yaml
evidence:
  run_id: ""              # .evidence/<run_id>
  gate:                   # gate-check batch 的结果，原样贴
    status: PASS | FAIL
    reasons: []
  slices:                 # 每片一行
    - slice: ""
      red: ""             # 工件相对路径；无测试基建时填 "" 并写 degraded_reason
      green: ""
      cases: 0
  smoke: []               # 外部契约 smoke 工件路径
  screenshots: []
  degraded: []            # 走 §5 降级的片 + 理由
```

**编排方前门不再只看字段是否填了，而是自己跑一次 `gate-check batch --slices <本批>` 并以其退出码为准。** 字段与 gate 结论不一致 → 以 gate 为准，且记为回传失真。

---

## 5. 降级（诚实的例外，不是后门）

有些片确实没有自动测基建（纯视觉调整、无 headless 环境的产品向改动、外部沙箱不可得）。这些片：

1. 仍必须建工件 —— 用 `--phase slice` 记录你实际跑过的东西（构建、类型检查、启动、手工路径的脚本化片段）。
2. 在 `evidence.degraded[]` 里写清 **哪一片、为什么没有红绿、你用什么代替**。
3. 不得填假的 red/green 路径。

`gate-check` 不开 `--strict-red` 时，红绿缺失只出告警。**告警必须原样进回传，不许静默吞掉。**

---

## 6. 这层挡得住什么、挡不住什么

诚实边界，不要对外宣称超出这个范围：

**挡得住**：顺手声称「已验证」；先写绿测试再宣称走过红绿；缩小测试范围换绿；外部契约从没打通就标已对接；合并门后留脏树；CR 自动修后不回归。

**挡不住**：蓄意手写伪造 JSON 工件。

对此的设计回应不是加密，而是**让真跑一次比编一份工件更省事** —— 编一份带合理 stdout 尾部、时长、用例统计、真实 git sha 的工件，比在命令前面加个前缀贵得多。真要防蓄意伪造，只有 `gate-check verify`（重跑）。

---

## 7. 反模式

| 反模式 | 为什么不行 |
|--------|-----------|
| 跑完测试再补一条 `evidence-run echo ok` | 工件里 cmd 与实际验证无关，等于伪造 |
| 所有片共用 `--slice main` | 红绿配对与用例数比较全部失效 |
| 红阶段不加 `--expect-fail` | 门会认为你在期望它成功，`expectation_met` 失真 |
| 把 smoke 指向本地 mock server | 那是假通，比 stub 更难发现；smoke 必须打真实/沙箱端点 |
| 前门只读回传里的 `evidence.gate` 字段不自己跑 | 又退回自证闭环，等于没做 |
| 因为 gate FAIL 就删工件重跑 | 证据可以追加，不可以销毁；FAIL 要么修要么如实上报 |
