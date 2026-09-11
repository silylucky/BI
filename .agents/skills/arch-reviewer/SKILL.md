---
name: arch-reviewer
description: >
  架构重构审计（技术栈无关）：扫描加深机会（shallow→deep）、缝泄漏、测试 locality 差、
  适配器假缝；候选 3～7 张 + **摩擦证据池**（不限数，每条带 ≥2 个代码证据）；
  默认 mode=auto-fix：候选报告 → 停等确认 → go-fast 落地 polish_safe+local-deepen（含 ADR）；structural 不自动改；
  用户指定 P0-级（即 polish_safe）或 P0+P1（polish_safe+local-deepen）→ 跳确认直接修；
  output 带 before/after 可视化的 HTML 报告；用户点选 structural 候选后进入 grilling 深挖，
  再落 ADR / CONTEXT / 重构切片。Use when architecture review, refactoring audit, deepen modules,
  seam leakage, shallow modules, codebase architecture friction, module depth, locality/leverage,
  ports and adapters audit, or when the user asks for 架构审计 / 架构重构 / 加深模块 / 边界泄漏.
---

# Arch Reviewer（架构重构 · 加深机会）

技术栈无关的**架构摩擦审计**。Agent 已懂通用重构；本 Skill 补：**加深词汇（depth / seam / locality）**、**有机探索而非死清单**、**候选卡 3～7 + 摩擦证据池不限数**、**视觉 HTML 候选报告**、**默认 mode=auto-fix（polish_safe + local-deepen 自动修；structural 仍须点选 grilling）**、**点选后 grilling**、**ADR 冲突标注**。

目标：可测试性 + AI 可导航性。把 **shallow module** 加深为 **deep module**，而不是再堆一层 wrapper。

与姊妹 skill 分工：

| Skill | 管什么 | 不管什么 |
|-------|--------|----------|
| **本 Skill** | 模块深度、缝泄漏、加深机会、重构候选 | 假绿/stub 清扫、页级 UX、写完整 arch.md |
| [code-reviewer](../code-reviewer/SKILL.md) | 假绿·stub·硬编码·可靠性·半成品表面 | 模块加深设计 |
| [docs-reviewer](../docs-reviewer/SKILL.md) | docs 分类完整与漂移 | 架构方案本身 |
| [create-evolution-arch](../create-evolution-arch/SKILL.md) | 交互写/体检 `docs/arch.md` | 扫代码出加深候选 |

重叠时：发现「模块浅」用本 Skill；发现「stub 冒充实现」转 code-reviewer。

## 何时启用

| 场景 | 动作 |
|------|------|
| 「架构审计 / 重构机会 / 加深模块」 | 读域语境 → Explore → HTML 候选报告 + 摩擦证据池 → **默认 mode=auto-fix：polish_safe + local-deepen（含 ADR）自动交 go-fast；structural 等用户点选** |
| 大模块难测 / 改一处牵全身 | 范围=该域；找 shallow + 泄漏缝 |
| 准备大型重构前选型 | 出 **3～7** 张候选卡 + **摩擦证据池**（不限数）+ Top recommendation；先设计后动手 |
| 对照 ADR 是否过时 | 候选与 ADR 冲突时标注「是否重开」 |
| 用户指定 `polish_safe` | `mode: auto-fix` + `cr_fix_scope=polish_safe`；报告 → **跳过确认** → go-fast 修 polish_safe 候选 |
| 用户指定 `polish_safe + local-deepen` | 同上；`cr_fix_scope=polish_safe+local-deepen`；自动落 ADR 后修 |
| loop-polishing `arch` lane | `mode: loop-lane`；只 Explore+候选（标授权级），不停问、不改码 |

**不要**：未点选就大范围改目录结构；用「拆文件」冒充加深；把假绿/stub 当架构候选主战场；替代完整安全审计。

## 必读顺序（≤3 次）

1. 本文件「词汇」+「流程」+「推荐强度」+「硬规则」
2. [references/vocabulary.md](references/vocabulary.md) + [references/friction-catalog.md](references/friction-catalog.md)
3. HTML：[references/html-report.md](references/html-report.md)；探索：[references/scan-workflow.md](references/scan-workflow.md)；点选后：[references/grilling-loop.md](references/grilling-loop.md)

## 架构词汇（强制使用）

报告与对话中**只用**下列词（英文术语保持原样，勿换成 service/component/API/boundary）：

| 词 | 含义（一句话） |
|----|----------------|
| **module** | 有接口与实现的职责单元 |
| **interface** | 从外调用该 module 的表面（测试面） |
| **implementation** | interface 背后的细节 |
| **depth** | 实现复杂而接口简单 → deep；接口≈实现 → shallow |
| **seam** | 可替换一侧而不改另一侧的接缝 |
| **adapter** | 缝一侧的具体实现（HTTP / in-memory / 文件…） |
| **leverage** | 一处接口服务多处调用方 |
| **locality** | 相关行为/缺陷集中在同一 module |

原则（详见 vocabulary）：

1. **Deletion test**：删掉它是浓缩复杂度，还是只是搬家？浓缩 → 疑似 shallow 包装。
2. **Interface = test surface**：加深后测试应打在 deepened module 的 interface 上。
3. **Adapter 计数**：一个 adapter = 假想缝；两个及以上 = 真缝（值得保留）。

若仓内装有 `codebase-design` skill → 词汇与之对齐；无则只读本 Skill 的 vocabulary。

## 推荐强度（候选徽章）

| 强度 | 含义 | 何时 |
|------|------|------|
| **Strong** | 摩擦明确、加深路径清晰、测试/导航收益大 | 优先 Top recommendation |
| **Worth exploring** | 有摩擦，方案需 grilling 收窄 | 可进报告 |
| **Speculative** | 可能过早抽象或证据不足 | 每条须 ≥2 个代码证据；**数量上限取消**，但要求每条带证据 |

**候选卡 vs 摩擦证据池（两层结构 · 不再是单层「3～7」）**：

- **候选卡 3～7 张**（保持精简）：每张 = 一个值得做的加深方向，承载 Problem/Solution/Benefits/before-after。多了反而稀释注意力，让用户难选。
- **摩擦证据池（不限数）**：subagent 探索过程中发现的**所有**摩擦点全部回传，不归并、不吞。每条至少含：`{id: F-*, friction: F1~F6, path+line, evidence: ≥2 代码引用, candidate_ref: 关联候选卡 ID or unassigned}`。这些是候选卡的「证据原材料」，也供用户决定「先做哪个」时看。
- 候选卡必须 `evidence_refs: [F-*, …]` 挂多个摩擦点；无摩擦点的候选卡 → 删除（无证据支撑不算候选）。

**不是** code-reviewer 的 P0/P1/P2。架构候选默认不「必修」；只有用户点选并 grilling 收敛后才进重构切片（`local-deepen` 例外，见下）。

### 双层产出（反「只交 Top3」）

| 层 | 内容 | 数量纪律 |
|----|------|----------|
| **候选卡** | Strong / Worth exploring，带 before/after、授权级、`evidence_refs` | **3～7** 张（整仓/单模块同）；宁缺 Speculative 堆砌候选 |
| **摩擦证据池** | 探索发现的全部摩擦点（含可判 `polish_safe` 的泄漏 import、浅透传、测试 locality 小债…） | **不限数**：命中即列，禁止抽样；每条 ≥2 代码证据 |
| Speculative 备忘 | 证据弱的猜想 | ≤ 候选卡数的 1/3；勿占 HTML 主视觉 |

loop-lane / 批量打磨依赖摩擦证据池扩量；候选卡仍要硬、要可点选。

若加深机会同时掩盖了假绿/stub → 在卡片加一行「交叉：建议另跑 code-reviewer」，**不要**把 stub 清扫写成加深方案。

## 授权级别（三级 · 决定 unattended 能不能做）

强度徽章说「**值不值得**做」，授权级说「**谁能批准**做」。每张候选卡**必须**同时标出强度与授权级。

| 级别 | 范围 | unattended |
|------|------|-----------|
| `polish_safe` | 单 module 内部微调，不动 interface 与任何对外契约 | **可做**，无需 ADR |
| `local-deepen` | **模块内加深**：收敛重复抽象、浅模块做深、清 seam 泄漏、提高 locality；可改内部 interface 与调用形式 | **可做，但必须先落 ADR** |
| `structural` | 改对外契约 / 事件 / 表结构、跨 module 搬迁、影响面超出单模块 | **禁止**；仍须人点选 + grilling |

**判定标准（逐条可查。`local-deepen` 须 1–6 全部成立；命中 `structural` 任一条即降为 `structural`，不得自行放宽）**

| # | `polish_safe` | `local-deepen` |
|--:|---------------|----------------|
| 1 | 改动只在单个 module 的 implementation 内 | 改动 ⊆ 单个 module + 其**直接调用点**（调用点只改调用形式，不改业务语义） |
| 2 | 该 module 的 interface 签名 / 字段 / 错误码不变 | **允许**改内部 interface、合并浅包装、删假缝、迁内部文件 |
| 3 | 无调用方需同步改动 | 需改的调用点**可枚举**（`rg` 能列全），且全部落在本片白名单内 |
| 4 | 现有测试不改断言即绿 | 测试面可搬到新 interface，但**用例数不下降** `[gate: case-count]` |
| 5 | — | 回滚 = revert 本切片单次提交即可，**无**数据迁移 / 协议残留 |
| 6 | — | 白名单 glob 明确，且与本波其它片不相交 |

**`structural`（命中任一即是）**：改对外 HTTP/RPC 路由或消息体、事件名、DB 表结构或迁移、跨服务协议、配置键的对外语义；跨 module 搬迁或新建 / 删除 module 边界；影响面跨 ≥2 个白名单簇；需分阶段迁移 / 双写 / 灰度；回滚需数据修复；与现行 ADR 冲突须重开。

**为什么中间这级敢在无人值守放行**：影响面可枚举（白名单 + 有限调用点）、外部消费者无感（不动对外契约）、回滚是一次 revert、且有硬证据兜底（`case-count` 不降 + `gate-check batch`）与 ADR 留痕。放行的是**可回滚的模块内收敛**，不是「架构大改」——后者一律 `structural`，**禁止**用拆分 `local-deepen` 的方式蚂蚁搬家绕过。

## 非问题（勿报）

1. **测试双 / fixture / 仅测试 harness 的 mock adapter** — 可证明真缝存在，不算泄漏。
2. **已有 ADR 明确禁止且无新摩擦** — 勿复诉；有新摩擦才可「建议重开 ADR」。
3. **为加深而加深** — 删测不浓缩、调用方已清晰的 deep module，勿硬拆。
4. **纯风格/目录搬家** — 无 depth/locality/leverage 收益的 rename 不进报告。
5. **未宣称域的远期规划** — 除非当前摩擦已痛。

## 硬规则

1. **先读域语境**：`CONTEXT.md` / `docs/domain/` / `docs/arch.md` / `docs/adr/`（有则必读）；用域名词命名 module。
2. **有机探索 + 扫描底座**：默认 Task `explore` subagent；禁止只跑固定 rg 清单交差。派探前按 [code-scanning](../code-scanning/SKILL.md) **只探测不装**（`command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml`）。有新鲜 `.codegraph/` → 用 `codegraph` CLI 查扇入/扇出与跨层边作摩擦证据；无图则 explore+rg，报告写明 `scan_tools: rg-only`。**subagent 只用 CLI，勿写 MCP**。
3. **候选用加深词汇**：Problem / Solution / Wins 必须能落到 depth、seam、locality、leverage。
4. **先 HTML 报告，后点选**：HTML 写 OS temp，**不要**默认写进仓；打开给用户；问「想深挖哪一个？」。**Markdown 主报告必须**落 `docs/material/arch-reviewer/`（Phase 2.5）。`mode: loop-lane` → 跳过停问与改码，落盘后只回传候选。
5. **候选必标授权级**（`polish_safe` / `local-deepen` / `structural`），判定标准见「授权级别」；**禁止**只标强度不标授权级。
6. **点选前不写业务重构代码**；grilling 中可更新 `CONTEXT.md` / 提议 ADR，大重构仍须确认。`loop-lane` 下即使升格加深，本 skill 也只落 ADR + 出切片，**改码一律交 go-fast**。
7. **ADR 冲突必标注**：矛盾时仅在摩擦足够时出现，带 callout。
8. **Before/After 图承载论证**：图看不懂就重画，勿堆长文。
9. **禁止**用「再抽一层 service/wrapper」冒充 deepen（deletion test 不过就丢掉）。
10. **禁止**隐式安装扫描工具；缺图不得假装已用量测扇入扇出。
11. **穷尽盘点**：候选卡有 **3～7** 数量纪律，但 **摩擦证据池禁止抽样**；禁止只交 Top3 候选且池空交差。

---

## 流程（必须）

### Phase 0 · Arch Card（主 agent，短）

| 探测 | 产出 |
|------|------|
| 域语境 | `CONTEXT.md`、`docs/domain/*`、`docs/arch.md` 是否存在；关键名词 |
| ADR | `docs/adr/` 列表（主题一行）；已知禁区 |
| 栈与布局 | 语言/包边界/前后端根（摘要即可，细节不如 code-reviewer） |
| 扫描工具 | `ast-grep` / `codegraph` / `.codegraph/` 有无（只探测；写入 Arch Card `scan_tools`） |
| 范围 | 整仓 / 模块·包列表 / PR 变更面触及的 module |
| 已知痛点 | 用户口述「难测 / 改不动 / 看不懂」 |

写入后续报告 header。模板提示见 [scan-workflow.md](references/scan-workflow.md)。

### Phase 1 · Explore（有机摩擦）

用 `explore` subagent（可 2～3 路并行：调用热点 / 包边界 / 测试硬度），带着这些问题走代码：

- 理解一个概念是否要在多个小 module 间来回跳？
- 哪些 module **shallow**（interface ≈ implementation）？
- 纯函数是否仅为可测性抽出，而真 bug 在调用编排上（无 **locality**）？
- 哪些缝在泄漏（实现细节穿过 seam）？
- 哪些区域难测，或只能通过很宽的 interface 测？

对疑似 shallow 做 **deletion test**。摩擦类型清单见 [friction-catalog.md](references/friction-catalog.md)。

**产出**：**摩擦证据池（不限数）**：subagent 回传**全部**发现的摩擦点（不归并），每条 `{id: F-*, friction: F1~F6, path+line, evidence: ≥2 代码引用, candidate_ref: 候选 ID or unassigned}`；主 agent 后续合并成 3～7 张候选卡（每张挂多个 F-* 证据）。

**Lane 密度下限**：每路 explore subagent 回传摩擦点 ≥ 5；不足 5 时**必须**在回传末尾加 `EXHAUSTED` 段（列出实际查过的包/目录、codegraph 查询、跑过的 deletion test 数、主观信心）。无 `EXHAUSTED` 段且 < 5 → 视为未完成，进 Blind spot。

### Phase 2 · HTML 报告

1. 解析临时目录：unix `TMP=$(mktemp -d)`；Windows PowerShell `$env:TEMP`（**禁止**写死 `/tmp`）
2. 写入：`<tmpdir>/architecture-review-<timestamp>.html`
3. 按 [html-report.md](references/html-report.md) 渲染（Tailwind CDN + Mermaid CDN；每卡 before/after；**附摩擦证据池 F-\* 表**，每条点开见代码引用）
4. 打开：`open "$OUT"`（macOS）/ `xdg-open "$OUT"`（Linux）/ `start "" "$OUT"`（Windows PowerShell：`Start-Process $OUT`）
5. 对话里给出**绝对路径** + 一句 Top recommendation
6. **默认 mode=auto-fix 停问**（见下节）：`是否确认修全量 polish_safe + local-deepen（自动落 ADR）？structural 候选想点选深挖哪一个？或指定仅 polish_safe 跳确认？`

### Phase 2.5 · Markdown 主报告落盘（必须）

HTML 是给人看的候选画册（留在 temp，**不入库**）；**机器可读的主报告必须落盘**：

1. **自动落盘**（默认，不必等用户点名）：写入 `docs/material/arch-reviewer/<YYYY-MM-DD>-<slug>.md`（目录不存在则创建；`slug` = 范围短名，如 `order-domain`；再评加 `-r<N>`，**禁止**覆盖上轮文件）
2. 内容 = Arch Card + 候选表（ID · 标题 · 强度 · 授权级 · 文件集 · 簇 glob · Problem/Solution 各一句 · ADR 冲突）+ **摩擦证据池**（可紧凑）+ Top recommendation + Blind spots + **穷尽自检**（候选卡数 / 池条数）
3. 对话展示摘要 + **落盘绝对路径**；回传 `report` 填该路径，`html_report` 填 temp 路径
4. 用户明确说「勿落盘 / 只聊」→ 可跳过写文件，并在回传注明

每张候选卡必含：Files · Problem · Solution · Benefits（locality/leverage/测试）· Before/After · 强度徽章 ·（可选）ADR callout · 依赖类别标签（`in-process` / `local-substitutable` / `ports & adapters` / `mock`）· **`evidence_refs: [F-*, …]`**（必须挂摩擦证据池条目）。

此阶段 **不要**抛具体 interface 签名；grilling 再设计。

### mode=`auto-fix`（**默认** · 单独调用本 Skill）

**默认 mode**。HTML 报告 + Markdown 落盘 → 停问确认 → 按 `cr_fix_scope` 调 [go-fast](../go-fast/SKILL.md) 落地。

| 项 | 规则 |
|----|------|
| 触发 | 单独调用本 Skill 且未明示其它 mode |
| 范围 | 默认 **整仓**（除非用户明示模块/包列表） |
| `fix_mode` | `confirm-batch`（默认）/ `auto`（用户指定 `polish_safe` 或 `polish_safe+local-deepen` 时） |
| `cr_fix_scope` | 默认 `polish_safe+local-deepen`（用户确认全量）；用户指定 `polish_safe` → 收窄仅 `polish_safe` |
| 报告后动作 | HTML 打开 + Markdown 落盘 → **停问** |
| 用户确认全量（polish_safe + local-deepen）| → **调 go-fast**（见下「调用 go-fast 路径」）；`attendance: attended`；按授权级分批：polish_safe 立即修；local-deepen **先落 ADR** → go-fast 切片 |
| 用户指定 `polish_safe` | → **跳过确认直接调 go-fast**；`attendance: unattended`；`cr_fix_scope: polish_safe` |
| **structural 不自动改** | **任何模式下 structural 候选都不进 auto-fix 批次**；structural 必须人点选 → grilling → 切片（Phase 3） |
| 不可自动修（须进 `remaining`）| structural 候选；local-deepen 中命中 structural 任一条（跨 module、对外契约变更、需数据迁移）；与现行 ADR 冲突须重开者 |
| Blind spot | 有未消解盲区 → `status` 降级，盲区进 `coverage.blind_spots` |
| 回传 | 必填 `mode: auto-fix`、`fix_mode`、`cr_fix_scope`、`auto_fixed`（含候选 ID + ADR 路径）、`remaining` |

#### 调用 go-fast 路径（确认后）

| 触发 | go-fast 入参 |
|------|-------------|
| 用户确认 `polish_safe+local-deepen` | `spec_ref` = 本 skill Markdown 报告路径；`attendance: attended`；`cr_fix_scope: polish_safe+local-deepen`；go-fast 按「refactor-shared 片」规则对每个 local-deepen 候选独占一波 |
| 用户指定 `polish_safe` | 同上；`attendance: unattended`；`cr_fix_scope: polish_safe` |
| structural 候选（任何模式）| **不进 go-fast auto-fix 批次**；进 `remaining`，等用户 Phase 3 点选 |

**报告作为规格**：本 skill Markdown 报告（含候选卡 + 摩擦证据池 + ADR 模板）即 go-fast 的 `spec_ref`。每张候选卡必须含：`id / strength / authorization / files / cluster_glob / problem / solution / adr_conflict / evidence_refs`。go-fast 据此出 `docs/specs/arch-<slug>.md` → 规格门 → tickets。

**`local-deepen` 自动落地 ADR 流程**（与 loop-lane `escalated` 路径同尺，只是触发源不同）：候选 → 主 agent 按「ADR 最小内容」节落 `docs/adr/deepen-<簇slug>.md`（状态「提议中」）→ 交 go-fast 切片 → 合回后 ADR 改「已接受」+ 补「验证」节。**缺 ADR 不得开工**。

### mode=`loop-lane`（loop-polishing · 只扫不改）

由 [loop-polishing](../loop-polishing/SKILL.md) 调用。与默认差异：

| 项 | 规则 |
|----|------|
| 触发 | 调用方明示 `mode: loop-lane` |
| 流程 | Phase 0–1 Explore → **轻量候选摘要** → Phase 2.5 落盘 `docs/material/arch-reviewer/<YYYY-MM-DD>-<slug>.md`（HTML 报告**可选**，默认跳过渲染与打开浏览器）→ 回传候选列表后 **立即 DONE** |
| 禁止 | Phase 2 停问点选；Phase 3 grilling；Phase 4 改业务代码 |
| 强度 | 照常标 Strong / Worth exploring / Speculative |
| 授权级 | 每条候选**必须**按「授权级别」判定表标出；编排方据此决定可否自动做（见 loop-polishing finding-normalize） |
| 回传 | `mode: loop-lane`；候选含强度 + **授权级** + 文件集 + 簇 glob |

单独调用：仍走 HTML → 停问点选 → grilling。

#### `local-deepen` 在 loop-lane 下的执行路径

平时 loop-lane 只出候选。**仅当**编排方按编排契约 §14 报「该簇 `escalated`」时，才对命中该簇的候选走下列路径：

```text
候选（标授权级 + 簇 glob）
 → 归类：按「授权级别」判定表逐条查；落 structural → 回传 park 升人，unattended 到此为止
 → 落 ADR：docs/adr/deepen-<簇slug>.md（最小内容见下），先落盘、后开工
 → 交 go-fast 做加深切片（编排契约 §4「refactor-shared 片」：独占一波、不占 batch 名额、只搬不改行为）
 → 回写：ADR 状态改「已接受」+ 补「验证」节；编排方按 §14 置该簇 deepened、touch_count=0
```

**ADR 最小内容**（缺任一节 → **禁止**开工）：

| 节 | 必须写 |
|----|--------|
| 标题 / 状态 | `ADR-<n> · 加深 <簇名>`；「提议中」→ 合回后「已接受」，注明由 `<phase>-r<N>` 自动落 |
| 上下文 | 簇名 + glob + `touch_count` / `regression_count` + 前几轮补丁的 finding ID（**为什么**升格） |
| 决策 | 加深后的 module 名（域名词）+ interface 操作列表 + 缝后放什么；删掉哪些浅包装 |
| 不做什么 | **逐条列出未改的对外契约 / 事件 / 表结构** —— 这是「本次是 `local-deepen` 而非 `structural`」的证明 |
| 后果 | 正面（locality / leverage / 测试面）+ 负面 + **回滚点**（revert 哪个提交） |
| 验证 | 新 interface 上的测试路径 + `gate-check slice` 的 `run_id` + 加深前后用例数 |

### Phase 3 · Grilling（用户点选 **structural** 候选后）

仅 `structural` 候选需要走 grilling（`polish_safe` / `local-deepen` 已由 mode=auto-fix 自动落地）。按 [grilling-loop.md](references/grilling-loop.md)：约束 → 依赖 → deepened module 形状 → 缝后放什么 → 哪些测试留下。

结晶时的副作用（就地做，仍避免未确认的大改）：

| 信号 | 动作 |
|------|------|
| 加深 module 用了 `CONTEXT.md` 没有的概念名 | 补词条；无文件则懒创建 |
| 对话中锐化了模糊术语 | 更新 `CONTEXT.md` |
| 用户以**可复用理由**拒绝候选 | 提议写 ADR：「要不要记下来，避免以后架构审计再提？」短暂「现在不做」不写 ADR |
| 需要对比两种 interface | 设计两次（可并行 subagent），再收敛 |

Grilling 收敛后给出：**重构切片清单**（文件集、顺序、验收：测试打在新 interface 上）。**停等确认**再改业务代码。

### Phase 4 ·（确认后）执行切片

- 按切片小步提交式改动；先加深再删 shallow 包装（deletion test 方向）
- 同步：必要时最小补丁 `docs/arch.md` / ADR「后果」；大章修订交给 create-evolution-arch
- 不做无关目录大搬家

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: arch-reviewer
mode: auto-fix | loop-lane | review
fix_mode: confirm-batch | auto | none        # auto-fix 默认 confirm-batch；用户指定 polish_safe / polish_safe+local-deepen → auto
cr_fix_scope: polish_safe+local-deepen | polish_safe  # auto-fix 下：用户确认全量=polish_safe+local-deepen；指定时收窄
scope: ""                   # 整仓 / 模块列表 / 变更面
report: ""                  # 落盘路径 docs/material/arch-reviewer/<YYYY-MM-DD>-<slug>[-rN].md
html_report: ""             # temp 下 HTML 绝对路径；loop-lane 未渲染则空
candidates:                 # 刻意不用 P0/P1/P2：架构候选是「值不值得做」的推荐，不是必修缺陷；
  - id: C-1                 # 分级混用会让编排器把候选当 finding 强修，越过点选/ADR 门闩
    title: ""
    strength: Strong | Worth exploring | Speculative
    authorization: polish_safe | local-deepen | structural
    files: []
    cluster_glob: ""
    adr_conflict: ""        # none | ADR-xxx — 一句
    evidence_refs: []       # 关联的摩擦证据池 F-* ID 列表（必填，无证据 = 删除候选）
friction_pool:              # 摩擦证据池（不限数）；subagent 探索过程中发现的所有摩擦点
  - id: F-1
    friction: F1|F2|F3|F4|F5|F6   # 见 friction-catalog
    path: ""
    line: ""
    evidence: []            # ≥2 个代码引用
    candidate_ref: ""       # 关联候选卡 ID；unassigned 表示尚未归入候选
top_recommendation: ""      # 候选 ID
adrs: []                    # local-deepen 升格时已落的 ADR 路径
remaining: []               # 需人裁定 / structural 升人 / 盲区未修
coverage:
  blind_spots: []           # 未消解盲区：`lane | 未探区域 | 原因`；非空 → status 禁止 DONE
blockers:
  - ""
followups:
  - "grilling / go-fast / create-evolution-arch / code-reviewer"
```

**`status` 与覆盖度的绑定**：全 lane 已探（含写明理由的合理跳过）且无未消解盲区 → 可 `DONE`；盲区仅在边缘面（无对应技术栈的 lane、外围脚本目录…）→ 最多 `DONE_WITH_CONCERNS` 且盲区原样进 `remaining`；盲区覆盖**生产主路径 / 核心域 module / 本次变更面核心目录** → `BLOCKED`，此时「没发现加深机会」不成立。

## 禁止

（「硬规则」的逆否不再复述；此处只列硬规则未覆盖项）

- **HTML 候选报告**提交进 git / 写进 `docs/`（除非用户要求落档）；反之，**Markdown 主报告默认跳过落盘**（用户明示「勿落盘」除外）
- 把候选强度写成 P0/P1/P2，或回传里丢掉 `authorization`
- 把 stub/假绿主问题包装成架构加深（应转 code-reviewer）
- Speculative 刷屏超过 Strong/Worth exploring
- **抽样汇报**：只交 Top3 候选、丢弃摩擦证据池、或池写「等 N 处」
- **`loop-lane` 下停问点选、grilling 改码或执行重构切片**
- **把 `structural` 判成 `local-deepen`**（含拆成多个 `local-deepen` 分批绕过）以求 unattended 放行
- `local-deepen` 未落 ADR 就交切片开工

## 关联

- [vocabulary.md](references/vocabulary.md) · [friction-catalog.md](references/friction-catalog.md)
- [html-report.md](references/html-report.md) · [scan-workflow.md](references/scan-workflow.md)
- [grilling-loop.md](references/grilling-loop.md)
- 姊妹：[code-reviewer](../code-reviewer/SKILL.md) · [docs-reviewer](../docs-reviewer/SKILL.md) · [create-evolution-arch](../create-evolution-arch/SKILL.md) · [loop-polishing](../loop-polishing/SKILL.md)（`mode: loop-lane`）
- 灵感来源：加深机会扫描 + 视觉报告 + 点选 grilling（improve-codebase-architecture）
