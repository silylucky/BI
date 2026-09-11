---
name: code-scanning
description: >
  代码扫描与代码理解的工具底座（技术栈无关）：给出三层检索分诊（rg 词法 → ast-grep 结构 →
  codegraph 图）、已验证规则包、索引新鲜度门与 subagent 使用约定；用户显式要求时才在仓库内
  安装并初始化 ast-grep（AST 结构搜索/重写）与 codegraph（符号调用图 / blast radius）。
  任何 skill 要扫仓找假绿/stub/硬编码/坏表单、判断模块深度与缝泄漏、算改动影响面、
  定位符号与调用链时，先读本 Skill 选对工具，不要默认只用 rg 正则。
  被顺带命中时只探测已装工具、不装任何东西。
  Use when scanning a repository for code patterns, structural search, codemod, call graph, impact analysis,
  "who calls this", blast radius, symbol lookup, module coupling, or when setting up / bootstrapping
  ast-grep or codegraph in a repo; also when a rg-based scan is producing false positives from comments,
  strings or test files. Triggers: 代码扫描 / 结构搜索 / AST 搜索 / 调用图 / 影响面 / 装 ast-grep /
  装 codegraph / 初始化扫描工具 / grep 误报太多.
---

# Code Scanning（扫描工具底座）

Agent 已会写 rg 正则；本 Skill 补三件它没有的：**什么时候不该用 rg**、**两个工具的落地安装与初始化**、**索引可能骗你时怎么办**。

不假设仓库语言。不替代任何 reviewer skill 的判断，只提供它们的检索底座。

## 三层分诊（先选层，再动手）

| 问题形态 | 用 | 为什么不是别的 |
|---|---|---|
| "哪里出现了字符串 X" / 找配置项、找文案、找 env 名 | **rg** | AST 工具在这类查询上是纯开销 |
| "哪里有这个**代码形状**" —— 空 error 处理、空 handler、`panic("not implemented")`、缺 timeout 的调用、裸 `<input>` 表单 | **ast-grep** | rg 会命中注释和字符串；形状跨行时正则不可靠 |
| "**谁**调用了它 / 改它会炸到哪 / 这个符号定义在哪" | **codegraph** | rg 和 ast-grep 都不解析跨文件的名字绑定 |
| "找一下处理重试逻辑的代码"（说不出符号名） | **rg + 读文件**，或让 explore subagent 读 | 两个工具都不做语义相似检索，别指望它们 |

**默认组合**：结构性 finding 用 ast-grep 出候选 → codegraph 确认调用方与影响面 → rg 兜底补漏。

一句话判据：**能写出代码长什么样 → ast-grep；只能说出符号名要顺藤摸瓜 → codegraph；只知道一个字符串 → rg。**

## 为什么值得（实测对照）

同一段 Go 代码，三处含 "not implemented / TODO: implement"，其中**只有一处是真 stub**，另两处在注释和字符串常量里：

```bash
rg -n -i 'TODO:\s*implement|not implemented' c.go   # 3 条，2 条误报
ast-grep scan c.go                                   # 1 条，就是那个真的
```

这就是接入 ast-grep 的全部理由：**降误报，不是提速**。假绿零容忍的评审里，误报会把 reviewer 的注意力和信誉一起消耗掉。

## 规则包是配角，不是主角

ast-grep 的主要用法是**临时 pattern**，不是维护规则库。三层分工里只有第一层有维护成本：

| 层 | 用途 | 维护 |
|---|---|---|
| 规则包（`.ast-grep/rules/`，入库） | 只固化**形状确定、判据几年不变**的假绿信号 | 低，写完基本不动 |
| 临时 pattern（不入库） | 按当次任务现写 `ast-grep run -p '...'`，用完即弃 | 零 |
| agent 判断 | 语义层面的问题，规则表达不了 | — |

**别为了覆盖率往规则包里塞东西。** 判据：这个形状下次还会遇到吗、判据会不会随业务变、误报能不能压到接近零。三个都是「是」才入库，否则用临时 pattern。

新规则应当**从真实发生过的 CR finding 长出来**，不是预先想象。凭空加的规则误报率高，结局是整个规则包被关掉。

规则包只覆盖机械可判的部分。「这个页面看着做完了其实没有」是语义问题，AST 表达不了——那是 [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) 看路由勾选、[browser-reviewer](../browser-reviewer/SKILL.md) 看截图的活。

### 起步包覆盖范围

Go / Python / TypeScript / TSX / JavaScript / JSX / Vue，共 10 个文件 28 条规则。bootstrap **按仓库实际语言拷贝**，所以单个仓库落地的通常只有 3-6 个文件。

**Vue 只覆盖一半**：ast-grep 不内置 Vue，靠 `sgconfig.yml` 的 `languageGlobs` 把 `.vue` 按 TypeScript 解析，`<script>` 段能扫到，`<template>` 段不是合法 TS、解析成垃圾节点，扫不到。模板层的问题交给 ui-ux-reviewer / browser-reviewer。

其他语言没有起步规则，按 [references/ast-grep-rules.md](references/ast-grep-rules.md) 现写。

## 入口分流（先判这一步）

本 Skill 会被自动触发。**自动触发 ≠ 允许装软件。** 先判断用户是哪种意图：

| 入口 | 判据 | 动作 |
|---|---|---|
| **显式** | 用户说了「初始化扫描工具 / 装 ast-grep / 装 codegraph / 配一下扫描环境」之类，或明确要求跑 bootstrap | 走下面的 Bootstrap，装 + 初始化 |
| **隐式** | 用户要的是别的（扫 stub、查调用链、做 review），只是本 Skill 被顺带命中 | **只探测，不安装**。用已装的工具；没装就用 rg 完成任务，**结尾提一句**缺什么、装了能好在哪，由用户决定 |

隐式入口下的探测：

```bash
command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml 2>/dev/null
```

隐式入口下**禁止**执行 `brew install` / `npm install -g` / `curl | sh` / `codegraph init`——在别人的机器或 CI 上装全局软件、建索引都是有副作用的操作，必须用户点头。提示写成一句话即可，例如：「本次用 rg 扫的，注释里的 TODO 有 3 条误报；装 ast-grep 可以消掉这类，要装的话说一声。」

## Bootstrap（仅显式入口）

**第 1 步 — 探测**。先看装没装，别盲目安装（命令同上）。

**第 2 步 — 安装 + 初始化**。跑本 Skill 自带的脚本（幂等，可重复执行）：

```bash
# macOS / Linux
bash ~/.agents/skills/code-scanning/scripts/bootstrap.sh

# Windows PowerShell
pwsh -File ~/.agents/skills/code-scanning/scripts/bootstrap.ps1
```

脚本做四件事：按平台装 ast-grep → 装 codegraph CLI → 在仓库落 `sgconfig.yml` + `.ast-grep/rules/`（按检测到的语言放起步规则）→ 跑 `codegraph init` 建图。

常用参数（两个脚本同名）：

| 参数 | 作用 |
|---|---|
| `--no-codegraph` | 只装 ast-grep。小仓（< 100 文件）默认就该这样 |
| `--mcp` | 额外跑 `codegraph install --yes`，把 MCP server 接进当前 agent。**默认不做**，见下 |
| `--check` | 只探测与报告，不安装不写文件 |
| `--force-index` | 强制重建 codegraph 索引 |

**第 3 步 — 汇报**。告诉用户装了什么、索引了多少符号、起步规则覆盖哪些语言、以及 `.codegraph/` 和 `.ast-grep/` 是否需要进 `.gitignore`（索引产物**不应**提交；规则包**应该**提交）。

### 关于 `--mcp`：默认关，是有意的

`codegraph install` 会改写 agent 的 MCP 配置和 `AGENTS.md`/`CLAUDE.md`。两个理由让它默认关：

1. **subagent 拿不到 MCP。** 你的 reviewer skill 都是派 `explore` subagent 跑 shell，MCP 工具只对主 agent 可见。CLI（`codegraph explore` / `callers` / `impact`）在哪都能跑，是唯一可靠的接法。
2. 改用户的 agent 配置是有副作用的操作，应当显式同意。

只有用户明确要在主对话里用 `codegraph_explore` MCP 工具时，才加 `--mcp`。

## 索引新鲜度门（无人值守必须做）

codegraph 的答案来自快照。**过期的图 = 一次带权威感的错误**，这对假绿零容忍的流程是新的风险源，不是免费的加速。

任何 loop / unattended 场景下，查图之前先验：

```bash
codegraph status          # 有 "Pending sync:" 段 = 索引落后于工作树
```

处置规则：

| 状态 | 动作 |
|---|---|
| 干净 | 正常用图 |
| 有 pending，且 pending 文件与本次扫描范围**无关** | 可用图，报告里注明 |
| 有 pending，且落在扫描范围内 | 先 `codegraph sync`；同步失败 → **降级回 rg/ast-grep 并标 Blind spot**，不得用图的结论 |
| 无 `.codegraph/` | 直接走 rg/ast-grep，不要临时建索引拖慢流程 |

刚做过大规模改动（batch-fix、merge、切分支）之后，**先 sync 再查图**。

## 与 reviewer / loop skill 的挂载点

本 Skill 是底座，不改变各 skill 的判断标准。挂法（消费者侧已回链）：

| Skill | 换成什么 | 收益 |
|---|---|---|
| [bug-fix](../bug-fix/SKILL.md) | 根因定位 + 点线面/同类发散：步骤 2–3 **必读本 Skill 分诊**；堆栈→codegraph，同构→ast-grep，串→rg；缺工具 Blind spot | 降误报、定因果链、防只修一页 |
| [code-reviewer](../code-reviewer/SKILL.md) L1 假绿 / L2 硬编码 / L3 可靠性 | Phase 0.5 探测 → 有则 ast-grep 规则包，否则 rg + Blind spot | 注释、字符串、测试文件天然不命中 |
| code-reviewer L7 产品表面 | 有新鲜图则 `codegraph callers`；结论须 rg 复核 | rg 判不了可达性 |
| [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) anti-patterns | 空 handler、缺 loading、裸 input → 有则 ast-grep JSX | 跨行 JSX 正则本来就不可靠 |
| [model-reviewer](../model-reviewer/SKILL.md) 三方对账 / 通路检查 | 「查后插」防重、状态 switch、JSON 取值 → ast-grep（形状类）；谁读写这张表、`blast_radius`、删列前的无引用证明 → codegraph + **rg 复核** | H 组误报主要来自注释与字符串；删列删表结论错一次即数据丢失 |
| [arch-reviewer](../arch-reviewer/SKILL.md) 模块深度 / 缝泄漏 | 有新鲜图则扇入扇出 + 跨层调用边 | 把「读几十个文件后的印象」换成事实 |
| [go-fast](../go-fast/SKILL.md) 并行波次编排 | 白名单 glob 不相交 **+** 有图则 impact 不相交（[parallel.md](../go-fast/references/parallel.md) §1.4） | 补上「glob 不相交但调用图相交」的漏判 |
| [loop-goal-prd](../loop-goal-prd/SKILL.md) / [loop-goal-product](../loop-goal-product/SKILL.md) / [loop-polishing](../loop-polishing/SKILL.md) | Phase 0 **只探测**写入 `scan_tools`；缺工具进 `blockers`（不装、不整环 BLOCKED） | 无人值守可见降级，不静默假全量扫描 |
| [requirement-fit](../requirement-fit/SKILL.md) 锚点定位 | 已写「有 codegraph 则按符号探索」，本 Skill 提供落地命令 | 兑现既有约定 |

## 硬规则

0. **隐式入口不装任何东西**，也不建索引。安装是有副作用的操作，只在用户显式要求时做。
1. **subagent 一律用 CLI**，不要在 subagent 提示词里写「调用 codegraph MCP 工具」——它看不见。
2. **不要用图的"没找到"证明"不存在"**。动态分发、反射、字符串拼出来的路由，图都可能漏。要下 `MISSING` 结论必须 rg 复核。
3. **ast-grep 一条规则一种语言**，规则里的 `language` 必须显式写。
4. **不提交索引**：`.codegraph/` 进 `.gitignore`；`sgconfig.yml` 与 `.ast-grep/rules/` 提交。
5. **小仓不上 codegraph**。< 100 文件时索引维护成本高于收益，只用 ast-grep。
6. 别把 `ast-grep scan` 的 exit code 当作"扫描失败"：**有 error 级 finding 时退出码为 1**，这是正常结果。脚本里要用 `--json` 判内容，不要 `set -e` 直接炸。
7. **规则目录是整体加载的**：任何一个规则文件解析失败，整次 scan **一条规则都不跑**，且不会明显提示哪里坏了。改完规则必须跑一次加载冒烟（bootstrap 末尾已内置）。

## 延伸阅读

- 规则怎么写、已验证规则包、常见坑（JSX 属性、字符串内容匹配）：[references/ast-grep-rules.md](references/ast-grep-rules.md)
- codegraph 命令速查、图查询配方、故障处理：[references/codegraph-usage.md](references/codegraph-usage.md)
- 起步规则包源文件：[rules/](rules/)
