---
name: model-reviewer
description: >
  业务数据库表模型审计（引擎无关：MySQL/TiDB · PostgreSQL · SQLite · Oracle/达梦）：从 migrations/DDL/ORM
  取模型真源，按八维评审建模合理性与演化灵活性——概念完整性、键与身份、关系与基数、时间与审计、类型与精度、
  约束与完整性、演化与扩展性、访问路径与容量。逐条 finding 给**最小代价修法**与**长期演化最优修法**两案，
  按架构/长期维护/可靠性/迁移风险/性能/合规多维给出推荐与原因、代价、置信度；改表结构属 structural，
  一律停等确认，落地交 go-fast（expand→backfill→switch→contract + ADR + 回滚点），禁止无人值守改表。
  Use when reviewing database schema or data model design, auditing table structure reasonableness,
  ER/normalization review, primary-key & unique-key design, soft-delete and unique-constraint conflicts,
  multi-tenant column layout, JSON column boundaries, money/decimal precision, enum evolution,
  audit/temporal columns, index & access-path fit, partitioning or sharding key choice, schema migration
  safety, or when the user asks 审核数据模型 / 表结构评审 / 建模合理性 / 数据库设计规范 / 库表设计审计 /
  模型演化灵活性 / 加字段还是加表 / 分表键怎么选.
---

# Model Reviewer（业务库表模型审计）

引擎无关的**数据模型合理性与演化灵活性审计**。Agent 已懂 SQL 与三大范式；本 Skill 补的是：**从哪儿取模型真源**、
**八维评审骨架**、**反模式目录与检测线索**、**每条 finding 强制双修法（最小代价 / 长期最优）+ 多维推荐**、
**改表的安全迁移剧本与 structural 门闩**。

目标不是「挑出不规范的列名」，而是回答一个问题：**这套模型能不能承住未来两年的业务变化，而不需要停机改表或写一堆
补偿代码**。模型是全仓最难回滚的一层——代码可以 revert，数据回不来，所以这里的评审比别处更保守。

## 与姊妹 skill 分工

| Skill | 管什么 | 不管什么 |
|-------|--------|----------|
| **本 Skill** | 模型本身：范式与冗余、键与身份、基数与完整性、类型精度、演化扩展性、访问路径匹配、迁移安全；**并把文档规则与代码用法拿来对账**（读代码是为了判模型，不是为了改代码） | 改代码修假绿、写 `docs/data/` 正文、模块深度 |
| [code-reviewer](../code-reviewer/SKILL.md) | SQL 方言可移植性、N+1、无分页、注入与参数校验、ORM 用法 | 表该怎么建 |
| [arch-reviewer](../arch-reviewer/SKILL.md) | module 深度、缝泄漏；表结构改动在其体系里判 `structural` | 字段级建模 |
| [docs-reviewer](../docs-reviewer/SKILL.md) | `docs/data/` 是否缺失/漂移 | 模型是否设计得好 |
| [create-evolution-arch](../create-evolution-arch/SKILL.md) | 交互确认引擎选型、migrations/seed/表定义**目录能力** | 扫现有表出 finding |
| [product-reviewer](../product-reviewer/SKILL.md) | 业务规则该是什么 | 规则如何落到约束 |

重叠时：**「这张表这样建将来会疼」→ 本 Skill；「这条 SQL 写错了」→ code-reviewer；「业务规则本身没定」→ 先
product-reviewer / grilling，规则未定就动模型是赌博。**

## 何时启用

| 场景 | 动作 |
|------|------|
| 「审核数据模型 / 表结构评审 / 建模合理性」 | 全流程：取真源 → 八维扫 → 分级 finding → 双修法 + 推荐 → **停等确认** → go-fast |
| 新库开建前评审 DDL 草案 | 范围=草案；重点压 D1/D2/D7（概念、键、演化），此时改动最便宜 |
| 已上线库要加能力（加字段还是加表 / 拆表 / 分区键） | 范围=相关表族；必出 expand/contract 剧本与回滚点 |
| **ADR 定了目标态但现网像是没跟上** / 怀疑两套结构并存 | 范围=相关实体族；重点跑 S4 步 5（通路清单 + 迁移收口）→ 出「目标态 vs 现网」对照 + I 组 finding |
| **现状就是多通路乱局，且从来没有目标态**（无 ADR/arch 可依）；用户要「合理的表设计方案 + 业务改造方案」 | **`mode=redesign`**：扫出现状后再综合——统一身份 → 唯一合法通路 → 落约束 → 目标 DDL 草案 → 业务改造方案 → ADR 草稿 → 硬决策 ≤5 条。见 [target-design.md](references/target-design.md) |
| 迁移前安全审查 | 只跑 D8 + 迁移安全节；产出锁风险与在线 DDL 方案 |
| **go-fast 本批要新建表** | `mode: slice-gate`：只对新增表跑 11 条 checklist，出 `pass/block` + 必修清单；unattended 可跑 |
| loop-polishing `model` lane | `mode: loop-lane`；只评不修不停问 |
| 用户要「顺手把表改了」 | **拒绝直接改**：先出卡，确认后交 go-fast；见「structural 门闩」 |

**不要**：无 migrations 真源就凭猜想报表结构问题；把方言差异写成建模缺陷；把「加索引」当模型评审主产出；
在规则未定时替产品决定状态机；把报表宽表的合理反范式报成范式违规。

## 必读顺序（≤3 次）

1. 本文件「八维」+「structural 门闩」+「流程」+「硬规则」
2. [references/modeling-principles.md](references/modeling-principles.md)（规范与方法论真源）+ [references/antipatterns.md](references/antipatterns.md)（反模式与检测线索）
3. 需要时：[references/scan-workflow.md](references/scan-workflow.md)（取真源与 lane 派工）· [references/fix-options.md](references/fix-options.md)（双修法 + 迁移剧本 + go-fast 交接）· [references/target-design.md](references/target-design.md)（`mode=redesign`：目标态 + 业务改造方案）· [references/report-template.md](references/report-template.md)

## 通用口径（与姊妹 reviewer 同尺）

**未扫到 ≠ 没问题。** 回传必须有 `coverage.blind_spots[]`，并按下表定 `status`：无未消解盲区（含写明理由的
合理跳过）→ 可 `DONE`；盲区仅在边缘面（字典小表、已下线表、外围脚本库）→ 最多 `DONE_WITH_CONCERNS`
且盲区进 `remaining`；盲区覆盖**核心事务表 / 金额与权限相关表 / 本次变更面** → **`BLOCKED`**，
此时「没发现 P0」不成立。

| 级 | 口径 |
|----|------|
| **P0** | 脏数据能进来、金额或权限可错、不可追溯、需停机才能修、真源不可信 |
| **P1** | 上线前应修：完整性缺口、演化成本已显著、主路径性能悬崖、审计不全 |
| **P2** | 债与口味：冗余索引、命名不一致、可后补的收敛 |

评分刻度：90+ 可作为下游稳定输入；80–89 可用有少量待确认；70–79 能启动但该维易漂移；<70 先改再往下走。
**禁止整行同分**（无有效对象 → `BLOCKED`，不打分）。硬门槛命中 → 对应维 ≤40 且总分上限 69。

`fix_mode`：`none` 只评不修（`mode: loop-lane` 恒为此值）；`confirm` 出报告后停等确认。**本 skill 无 `auto`**，
理由见「structural 门闩」。报告统一落 `docs/material/model-reviewer/<YYYY-MM-DD>-<slug>.md`。

## 八维评审骨架（D1–D8）

每维独立打分并各自计数 finding，**禁止**把所有问题都塞进一两维交差。子项与打分锚点见
[modeling-principles.md](references/modeling-principles.md)。

### 三方对账（贯穿八维的证据方法 · 强制）

**只读 DDL 评不出好模型。** 同一件事有三个声音，差异本身就是 finding：

| 声音 | 从哪读 | 它能证明什么 |
|------|--------|--------------|
| **应然**（文档/规则） | `docs/domain/`、`docs/automate/prd*`、`docs/data/`、ADR、需求/招标条目 | 业务要求的唯一性、精度、状态流转、保留期、租户隔离 |
| **实然**（代码用法） | DAO/Repository/Service/ORM 查询、事务、校验 | 真实访问路径、真实值域、代码在替库做什么保护 |
| **落地**（库里约束） | migrations / DDL / ORM 定义 | 库实际能挡住什么 |

**「应然」不等于「正确」——ADR 也要被评审。** 文档与 ADR 只是**声称的**应然：它可能当年就定错，
也可能当年对、如今业务/量级/引擎/合规变了而失效。**禁止**把 ADR 当真源直接据以判「现网未收口」，
必须先独立评审 ADR 本身的模型与架构合理性，出三态结论。详见「ADR 复核」。

**三类差异各自是 finding**（归入对应维，并在 finding 标 `source`）：

| 差异 | 含义 | 归维 | 例 |
|------|------|------|----|
| 应然有、落地无 | 规则只写在文档里，库不设防 | D6 / D2 | PRD 写「同租户编码唯一」，库里 `UNIQUE(code)` 或无唯一键 |
| 实然有、落地无 | **代码在替库兜底** —— 最强的模型缺陷信号 | D2 / D5 / D6 | 手写「先查后插」防重、代码里跑状态机、对 JSON 键 where |
| 落地有、实然/应然无 | 库里有没人用的结构或已漂移的语义 | D1 / D7 | 无引用的列与表、枚举值域代码与库不一致 |

**代码替库兜底为什么算 P0/P1 而不是「已经解决了」**：应用层校验挡不住并发、挡不住第二个服务、
挡不住运维脚本和数据修复 SQL。库不设防就意味着脏数据只是还没进来。

**D8 的访问路径必须来自代码实证**：从真实查询里归纳「按什么查/排/聚合」，再对照索引。
拿不到代码证据时该维标 `unverified` 并降置信度，**不得**凭 DDL 猜访问路径。

| 维 | 名称 | 核心问句 | 典型 P0 信号 |
|----|------|----------|--------------|
| **D1** | 概念完整性与粒度 | 每张表是否只表达一个实体/一件事实？粒度是否一致（明细混汇总）？缺哪些业务实体 | 上帝表；一表混两个生命周期不同的实体 |
| **D2** | 键与身份 | 主键选型；**业务自然键有没有唯一约束**；代理键是否单调；重复业务数据靠什么拦 | 无业务唯一键 → 重复下单/重复用户可落库 |
| **D3** | 关系与基数 | 1:1 / 1:N / M:N 是否表达正确；**两实体间是否只有一条合法通路**；`0..1`「唯一主」等基数契约是否落约束；多态外键与 EAV 是否滥用 | 逗号分隔存 id 列表；多态 FK 无法约束；**同一关系有多条并行通路**；「主绑」无唯一索引 |
| **D4** | 时间与审计 | 审计四列；时区类型；状态变更是否可追溯；事件表 vs 状态表 | 金额/状态可改而无历史；`datetime` 存跨时区时刻 |
| **D5** | 类型与精度 | 金额精度；枚举承载方式；JSON 边界；字符集与长度；跨表同义列类型一致 | `float`/`double` 存钱；join 两侧类型不一致 |
| **D6** | 约束与完整性 | NOT NULL/默认值/CHECK/唯一/FK 落库或应用层+对账；软删对唯一约束的破坏 | 软删后唯一索引失效导致脏重复；哨兵值当空 |
| **D7** | 演化与扩展性 | 加需求时是加列还是改列？扩展点在哪；破坏性变更策略；**历史迁移是否收口**（目标态是否已落地、旧通路是否仍在写）；租户与分片键前瞻 | 枚举写死 DB enum；**ADR 定的目标态与现网并存两套、旧路径仍被写入** |
| **D8** | 访问路径与容量 | 索引是否匹配真实查询（最左前缀/覆盖）；FK 列有无索引；行宽与大字段；分区/归档策略 | 主查询全表扫；无界增长表无归档方案 |

**评分**：八维各 0–100 + 总分（加权见 principles §9）。字段名一律带前缀 **`model_scores.*`**，
禁用裸 `scores.*`——各 reviewer 的「八维」维度不同而键名相近，编排层按裸 `scores` 做门禁会误读。

**硬门槛（一票压分：对应维 ≤40 且总分上限 69，不得标「可开建 / 可上量」）**


1. 金额或计量用二进制浮点存储
2. 业务自然键无唯一约束（靠应用层「查了再插」防重）
3. 软删除与唯一约束冲突未解（删后不能重建同名，或删后能建出脏重复）
4. 关键状态/金额变更无历史与审计，事后无法归因
5. 多租户表缺租户隔离列或隔离列不在唯一/索引前缀，存在跨租户读写风险
6. 无版本化 migrations（靠运行时建表或手改生产库）
7. 破坏性变更无 expand/contract 与回滚点，需停机
8. **文档/PRD 明确的关键业务约束未落库**（唯一性、精度、保留期、租户隔离），且代码是唯一防线
9. **同一关系存在多条并行通路且旧通路仍被写入**（ADR 定了目标态但迁移未收口，两套模型并存）

## ADR 复核（有 ADR 时也必须做）

历史架构决策可能本来就错。若不复核就照着收口，等于把一个错误决策用迁移成本焊死——
**收口到错误的目标态比两套并存更贵**，因为并存至少还留着退路。

**每份相关 ADR / arch 目标态给一个 verdict**：

| verdict | 含义 | 后续 |
|---------|------|------|
| `adr_sound` | 模型与架构均站得住，只是没落地 | 现网差异照判 I1 未收口，推荐收口 |
| `adr_outdated` | 当年合理，前提已变（业务量级、多租户、引擎能力、合规、已被后续 ADR 部分推翻） | I1 **降级**为「需重开 ADR」；先更新目标态再谈收口 |
| `adr_wrong` | 决策本身违反建模底线（见下） | **不得**据其判未收口；出「重开 ADR + 新目标态」建议，走 `mode=redesign` |

**判 `adr_wrong` 的判据（模型角度）**：ADR 定的形状本身命中硬门槛或 A/B/D/E 组反模式——
例如把统一身份定成多态 `(type, id)` 二元组、把「唯一主」交给应用层维护、把可变值集定成 DB `ENUM`、
把需查询字段定进 JSON、多租户唯一键不带租户前缀、金额用浮点。**用八维重打一遍它，尤其 D2/D3/D6/D7。**

**判据（架构角度）**：表结构被跨模块直接共享导致改一处牵全身（缝泄漏）；把实现细节写进对外契约；
决策不可回滚（无过渡形态）；与宣称的高可用/多租户/分库要求矛盾；把配置与关系混在一张表。

**最强的证据是现网自己给的**：如果目标态是对的，为什么大家绕开它？代码里普遍存在的绕过与补偿
（新结构建了却没人写、写入仍走旧通路、为适配目标态写了大量转换层）通常说明**目标态难以落地**，
而非「团队不自觉」。这类证据出现时倾向 `adr_outdated` / `adr_wrong`，并把绕过位置作为证据挂上。

**纪律**：`adr_outdated` / `adr_wrong` 时**不许自己改 ADR 结论就往下走**——出「重开」建议 +
新目标态候选 + 硬决策清单交用户；`verdict` 与理由必须进回传 `adr_review` 与报告。
架构层面的重开若超出模型范围（涉及跨服务契约、模块搬迁）→ 转 [arch-reviewer](../arch-reviewer/SKILL.md) 或
[create-evolution-arch](../create-evolution-arch/SKILL.md)，本 skill 只出模型侧结论。

## structural 门闩（本 Skill 最硬的一条）

**改表结构在本体系里一律是 `structural`**（见 arch-reviewer 授权级与 README 红线）：不可回滚、要迁移数据、
外部消费者可感。因此本 Skill：

| 允许 | 禁止 |
|------|------|
| 出 finding、出双修法、出迁移剧本、出 ADR 草稿 | **自行执行 DDL / 改 migrations / 跑回填脚本** |
| `fix_mode: confirm`（停等确认）或 `none`（只评） | `fix_mode: auto`；**本 skill 自己**在 unattended 下推动 T3 改表 |
| 确认后把方案交 [go-fast](../go-fast/SKILL.md) 落地 | 在 loop-lane 里改码；把 T3 拆成多个 T2 分批绕过点闸 |

注意区分主体：**本 skill 任何模式都不改库**；而 go-fast 在无人值守下能做到哪一步，由下面的三档决定
（`mode=review` / `redesign` 本身没有无人值守子集，被误调即 `BLOCKED · requires_attended`）。

即使用户开场说「发现问题直接修」，也要**先贴决策卡摘要**再交 go-fast——因为最小代价修法与长期最优修法在
模型这层经常指向完全不同的两张表，选错的代价是二次迁移。

### 变更风险三档（`structural` 的粒度真源 · go-fast 与本 skill 共用）

「改表一律不许无人值守」按字面会把「给既有表加个索引」也拦掉，那是过度保守。按**回滚代价**分三档：

| 档 | 包含哪些动作 | 回滚方式 | `unattended` |
|----|--------------|----------|-------------|
| **T1 向后兼容 · 无回填** | 新建表；加**可空**列；加索引；加 CHECK / 唯一约束**且已用查询验证存量无违规**；加注释 | revert 迁移即可，无数据残留 | **可做** |
| **T2 扩展 + 回填 · 旧结构仍是唯一读源** | 加新列/新表 + 分批回填 + 双写；读仍走旧结构，未切换未删除 | 停回填任务 + revert（新结构没人读） | **可做 expand + backfill**；**禁止 switch / contract** |
| **T3 破坏性** | switch（读切新）· contract（删列/删表/停写旧）· 改主键或唯一键语义 · 改列类型 · 改字段语义 · 拆表合表 · 分区/分片改造 · 大表加 FK · 任何需窗口或不可逆的动作 | 需数据修复或已不可逆 | **一律 park 升人** |

分档判据只有一条：**出错时能不能靠 revert 一次提交回到原状。** 能 → T1/T2；要动数据才能救 → T3。

T1/T2 在无人值守下仍须：版本化 migrations（禁手改库）+ 证据工件（存量校验查询、迁移可从零重放、回滚已验）。
**T3 禁止拆成多个 T2 分批绕过**——这是最容易被合理化的越线方式。

## 非问题（勿报）

1. **有意反范式且写明理由**：报表/读模型宽表、缓存列、`docs/data/` 或 ADR 已记录的冗余 —— 除非对账缺失。
2. **方言差异**：`LIMIT`/`IFNULL`/`::uuid` 之类可移植性问题归 code-reviewer。
3. **分库分表下不落 FK**：这是常规取舍；只有**连应用层对账/孤儿清理都没有**才报。
4. **小表缺索引**：数据量与增长可忽略的字典表不必报 D8。
5. **框架/codegen 产物**：ORM 生成的 model 文件风格、迁移工具自建的元数据表。
6. **未宣称的远期需求**：「以后可能要多语言」不构成现在就上翻译表；除非 PRD/goal 已写。
7. **命名风格**：单复数、下划线偏好等，除非**同一概念跨表命名或类型不一致**（那是 D5 真问题）。

## 硬规则

1. **先取模型真源，无源不报**：按 [scan-workflow.md](references/scan-workflow.md) 依次找 migrations → DDL/`schema.prisma`/ORM model → 线上库自省（有 `.dev` 且用户授权只读时）。三者不一致本身就是 P0 finding（真源分裂）。
2. **每条 finding 挂可解析证据**：`文件:行` 或 `表.列`，并写清「什么业务操作会因此出错」。纯口味无证据 → 不进报告。
3. **每条 finding 必给双修法**：`min_cost`（最小代价）+ `long_term`（长期演化最优），两者相同时须显式写 `same` 并说明为何没有更彻底的做法。只给一个 → 视为未完成。
4. **推荐必须多维论证**：架构与边界、长期维护、可靠性与正确性、迁移风险与回滚、性能与容量、合规与运维、开发体验。逐维给结论 + 依据；不适用写「不适用」及原因。格式见 [fix-options.md](references/fix-options.md) §2。
5. **破坏性变更必带剧本**：expand → backfill → switch → contract 四步 + 每步回滚点 + 在线 DDL/锁风险评估 + 存量数据体量。缺剧本的改表建议不得进推荐项。
6. **扫描服从 [code-scanning](../code-scanning/SKILL.md)**：三层分诊选工具——rg 找列名/类型/约束与迁移文件；**ast-grep 找代码形状**（「查后插」防重、状态 switch、JSON 取值，这是 H 组避免误报的关键）；codegraph 查读写方与 `blast_radius`。**隐式入口只探测不安装**，缺则 rg 降级并写 `scan_tools: rg-only` + Blind spot；无人值守查图前先过**索引新鲜度门**（`codegraph status`，pending 在范围内先 sync，失败则降级）；**不得用图的「没找到」证明「不存在」**——删列删表的无引用证明必须 rg 复核。命令与配方见 [scan-workflow.md](references/scan-workflow.md) §0。
7. **改动影响面要查消费方**：建议改列/改语义前，用 codegraph/rg 列出读写该表的代码位置数量，写进 finding 的 `blast_radius`。查不到就标「未验证」，不得假装可控。
8. **三方对账不可省**：文档里可检验的业务约束逐条进 `rule_reconciliation`（`ok | gap | drift`）；发现「代码替库兜底」一律成 finding；每条 finding 必填 `source`。**只交 `schema_only` 类 finding 的报告视为未完成**——那说明只读了 DDL。
9. **穷尽盘点**：范围内每张表都要过一遍并留勾选痕迹（表清单 + 每表状态）。合并后若盲区为空且 P0+P1 少于阈值（整库 <10 / 表族 <8 / 单表或变更面 <5）→ 须二次 sweep，或在总览写「穷尽自检：二次 sweep 无新增」。
10. **规则未定时停手**：业务规则本身不清（状态如何流转、金额如何取整、是否允许同名）→ 出问题但**不给推荐**，标 `needs_product_decision`，转 product-reviewer / grilling。
11. **禁止自行改表**：见「structural 门闩」。

---

## 流程（必须）

复制进度：

```
Model-Review Progress:
- [ ] 1 Model Card：引擎/真源/范围/表清单/量级/规则来源
- [ ] 2 四路并行扫（S1 结构 · S2 字段约束 · S3 演化容量 · S4 语义对账 + 通路/ADR 复核）+ 反模式对照 + 消费方影响面
- [ ] 3 finding 分级 + 每条双修法 + 多维推荐 + 置信度
- [ ] 4 报告落盘 + 八维评分 → 停等确认（loop-lane：落盘即完）
- [ ] 5 确认后交 go-fast（含 ADR + 迁移剧本 + 证据）
```

### Phase 1 · Model Card（主 agent，短）

| 探测 | 产出 |
|------|------|
| 引擎与版本 | MySQL/TiDB · PG · SQLite · 国产库；影响可用手法（在线 DDL、部分索引、CHECK 支持） |
| 真源 | migrations 路径 + DDL/ORM 真源 + 是否一致；无 migrations → 直接一条 P0 |
| 范围 | 整库 / 表族（如订单域）/ 本次变更触及表 |
| **表清单** | 逐表列出，作为穷尽勾选底表；标注「核心事务 / 字典 / 日志流水 / 报表」 |
| 量级与增长 | 行数量级、日增、无界增长表（有则 D8 必查归档） |
| 多租户与分片 | 是否多租；隔离方式；现有分片/分区键 |
| **规则来源（应然）** | `docs/domain/`、`docs/automate/prd*`、`docs/data/`、ADR、需求条目——摘出可检验的业务约束（唯一性/精度/流转/保留期/隔离）**以及结构目标态与基数契约**，逐条进对账矩阵；已定取舍另记，避免复诉 |
| **目标态与迁移状态** | ADR/arch 定的关系形状；已发生的结构迁移各停在 expand/backfill/switch/contract 哪一步；旧通路是否仍被写入 |
| **代码入口（实然）** | DAO/Repository/model 目录位置；主要查询与写入路径的落点 |
| 扫描工具 | `ast-grep` / `codegraph` 有无（只探测不装） |

### Phase 2 · 八维并行扫

用 Task subagent 并行，四组：**S1 结构**（D1–D3）/ **S2 字段与约束**（D4–D6）/ **S3 演化与容量**（D7–D8）/
**S4 语义对账**（贯穿八维，出「三方差异」类 finding 并为 D8 提供真实访问路径）。每组带
[antipatterns.md](references/antipatterns.md) 对照检测；S4 的检索式与产出格式见 [scan-workflow.md](references/scan-workflow.md) §2。

**S4 不可省**：S1–S3 只看得见「库里写了什么」，看不见「业务要求什么」和「代码在替库做什么」。
跳过 S4 → 该轮进 `coverage.blind_spots`，且 D8 分数标 `unverified`。

**S4 含「通路与迁移收口」检查**（scan-workflow §2.1 步 5）：逐对核心实体列出现网**所有**关联通路，
与 ADR 定的目标态对照。这一步专治**逐表体检查不出的病**——两套模型并存时每张表单看都合格，
只有把通路连起来才发现写入走哪条取决于入口。命中即 I 组，报告必须给「目标态 vs 现网」对照图。

**Lane 密度下限**：每组回传 finding ≥5，不足时**必须**附 `EXHAUSTED` 段（列出实际读过的迁移文件与表、
用过的检索式、逐表结论），否则视为未完成并进 Blind spot。

### Phase 3 · finding + 双修法 + 推荐

每条 finding 的必填字段见 [report-template.md](references/report-template.md)。核心是这三段：

- **`min_cost`**：能止痛的最小改动（常见：加唯一索引、加 CHECK、加影子列、应用层对账、加归档任务）
- **`long_term`**：模型层面真正正确的形状（常见：拆表、提取实体、改键、引入事件表、状态机落约束）
- **`recommend`**：选一个 + 六维理由 + 代价 + 置信度；**允许推荐 `min_cost` 现在做 + `long_term` 挂号排期**，
  这在模型层往往才是诚实答案（正在跑的库不该为完美形状停机）

### Phase 4 · 报告 + 评分 + 停问

1. 落盘 `docs/material/model-reviewer/<YYYY-MM-DD>-<slug>.md`（`slug` = 库或域短名；再评加 `-rN`，**禁止**覆盖）
2. 内容 = Model Card + **表清单勾选** + 八维评分 + 硬门槛命中 + finding 表（含双修法与推荐）+ 迁移剧本 + Blind spots + 穷尽自检
3. 对话给摘要 + 绝对路径 + 一句 Top recommendation
4. **停问**：

> 是否修复？请选：①只做最小代价止痛项（P0 的 `min_cost`）②按推荐执行（含必要迁移）③做长期最优形状（大迁移，需 ADR + 灰度）④只要报告不改库

### mode=`slice-gate`（go-fast 开工前的轻量前置门）

由 [go-fast](../go-fast/SKILL.md) 开工前调用，用于**本批要新建表**的片。不是完整审计——完整八维每片跑一次
既贵又慢；这里只做「别把一眼可见的错固化进去」的 checklist。**新建表是最便宜的时刻**：还没有存量数据，
改一行 DDL 就完事；等上线后同样的问题要 expand/backfill/switch/contract 四步走。

| 项 | 规则 |
|----|------|
| 触发 | go-fast 判定本批有 DDL/迁移**新增**（见 go-fast「开工前」4.5） |
| 范围 | **只看本批将新增/修改的表**，不扫全库 |
| 产出 | `verdict: pass | block` + 必修清单（每条：问题 + 应该怎么建 + 出处），**不打八维分、不落长报告** |
| unattended | **可跑**（只读扫描 + 出清单，不改任何东西） |
| `block` 的效力 | 按**前门失败**处理，不是「建议」：go-fast 须先修 DDL 再开工 |
| 禁止 | 借机做全库审计；扫本批范围外的表；自己改 migrations |

**checklist（只查这些，命中即 `block`）**

1. 金额/计量用浮点
2. 业务自然键无唯一约束（含多租户漏租户前缀）
3. 无主键，或主键用可变业务字段
4. 缺审计列（`created_at`/`created_by`/`updated_at`/`updated_by`）
5. 有软删设计但唯一约束未相应处理
6. 关键状态/金额可变而无历史表或流水
7. 需查询的字段塞进 JSON
8. 时间列语义混乱（时刻用无时区语义类型、日历日塞时刻）
9. 与既有表同义列类型/字符集不一致（join 会隐式转换）
10. 表结构靠运行时建表而非版本化迁移
11. **与既有表构成第二条通路**（同一关系已有承载结构 → I2，最该在这一刻拦住）

第 11 条是这个门最大的价值：新表往往就是并行通路的起点，此刻拦住只需改一版 DDL。

**防环**：`slice-gate` **不得**调 go-fast，也不得触发 `mode=redesign`。发现超出 checklist 的深层问题 →
写进 `followups` 建议另跑完整 review，本次只拦 checklist 命中项。

#### 完全无人值守时会不会被拦住升人

**`block` ≠ 升人。** 两者是不同机制，分清很重要，否则无人值守要么该停时不停，要么一遇门就停摆：

| 情形 | 无人值守行为 | 会升人吗 |
|------|--------------|---------|
| T1 新建表，`slice-gate` 判 `block` | **前门失败 = 回炉**：go-fast 按 `must_fix` 改 DDL，再跑一次 gate 后开工 | **不会**。这些都是「该怎么建」有唯一正确答案的项（加唯一约束、改 decimal、补审计列），无需裁定 |
| 同一片连续 **2 次** 仍 `block` | 停止重试，park 升人 | 会。反复撞同一堵墙说明 checklist 判据与本片意图冲突，需人裁定——继续重试只烧轮次 |
| T2 扩展 + 回填 | 做 expand + backfill 并留证据；`switch` 挂 `remaining` | 不会（但该条目**不算完成**，切换那步等人） |
| **T3 破坏性** | **park 升人** | 会。这是体系红线：改键/删列/改语义不可回滚，数据回不来 |
| `mode=review` / `redesign` 被误在 unattended 下调用 | 直接 `BLOCKED`，`reason: requires_attended` | 会。这两档要停等确认与硬决策，本就没有无人值守子集 |

**park 不等于整环 BLOCKED。** 命中 T3 时：该片 skip → 挂 `remaining` + `needs_human` → **编排方继续做本批其它片**，
并且**该片不得进入后续轮次的候选**（否则每轮重撞一次，把轮次全烧在同一堵墙上）。
把「一个片需要人」升级成「整个 loop 停机」，是无人值守最常见的自伤。

**为什么 T3 不给自动放行的口子**：代码写错可以 revert，删掉的列回不来。无人值守能省的是人的时间，
不能替人承担不可逆的风险——这条不因为「loop 正在冲刺」而放宽。真要在无人值守里推进模型改造，
正确做法是**提前**用 attended 跑一次完整 review 定好迁移剧本，把 T3 拆成「已批准的 T1/T2 步骤」再交给 loop。

### mode=`redesign`（无目标态可依时的综合产出）

默认 `mode=review` 逐条出 finding + 双修法；但当现状是**多通路乱局且没有任何 ADR/arch 钉死过目标态**
（反模式 I8）时，逐条 finding 是不够的——用户要的是「那到底该长什么样、怎么搬过去」。

| 项 | 规则 |
|----|------|
| 触发 | 用户要「合理的表设计方案 / 业务改造方案」；Phase 2 命中 I8（无目标态）；或 **ADR 复核判 `adr_outdated` / `adr_wrong`**（旧目标态不能用了，需要新的） |
| 流程 | Phase 1–3 照跑 → **增加综合阶段**（[target-design.md](references/target-design.md) S1–S8）→ Phase 4 停问 |
| 顺序铁律 | 先定唯一身份 → 再定唯一合法通路 → 再落约束 → 最后索引。颠倒会在错误形状上做功 |
| 额外产出 | 现状通路图 + 目标态图（Mermaid）· 目标 DDL 草案 · **业务改造方案**（入口收敛/写路径统一/读兼容/数据合并与冲突裁定/波次/对外契约影响/验收/回滚）· ADR 草稿 · **硬决策清单 ≤5** |
| 不许做的 | 自造业务语义；目标态塞用户没要求的新能力；机械合并通路却不处理语义差异；硬决策未答就出「最终」DDL |
| 仍然适用 | structural 门闩不变：只出方案，确认后交 go-fast |

**为什么必须问硬决策**：代码只能告诉你「现在怎么跑」，说不清「本该怎样」。两条通路是**本来就该不同**
还是历史重复、「主绑」到底唯一还是可多条、能否有损合并——这些只有业务能答。一次问完，≤5 条。

### Phase 5 · 确认后交 go-fast

按 [fix-options.md](references/fix-options.md) §4：报告即 `spec_ref` → go-fast 路径 B → `docs/specs/model-<slug>.md`
→ 规格门 → tickets。纪律：

- 每张表族一片，**同一表结构禁止并发**（编排契约「不可同波」已含此条）
- 有回填/双写的片 `attendance: attended`，不得 unattended
- 验收必须含：迁移可顺序重放、回滚脚本已验、存量数据校验查询、`case-count` 不降、`gate-check batch`
- `long_term` 未做的部分进 `remaining` 并落 ADR「已知延期」，不许悄悄消失

---

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: model-reviewer
mode: review | redesign | slice-gate | loop-lane
verdict: pass | block                # 仅 mode=slice-gate；block 按前门失败处理
must_fix: []                         # 仅 slice-gate：{ table, issue, should_be, evidence }
fix_mode: confirm | none        # 禁 auto —— 改表属 structural，见「structural 门闩」
scope: ""                       # 整库 / 表族 / 变更面
engine: ""                      # mysql | tidb | postgres | sqlite | 其它
source_of_truth: ""             # migrations 路径；分裂时写明三源差异
report: ""                      # docs/material/model-reviewer/<YYYY-MM-DD>-<slug>[-rN].md
model_scores:                   # 必须带前缀；禁裸 scores.*（各 reviewer 维度不同会撞名）
  d1_concept: 0
  d2_identity: 0
  d3_relation: 0
  d4_temporal: 0
  d5_type: 0
  d6_constraint: 0
  d7_evolution: 0
  d8_access: 0
  total: 0
hard_gates_hit: []              # 命中的硬门槛编号 + 对应 finding ID
adr_review:                     # 有 ADR/arch 目标态时必填；空 = 未复核，禁止据 ADR 判「未收口」
  - adr: ""                     # 路径或编号
    verdict: adr_sound | adr_outdated | adr_wrong
    why: ""                     # 模型角度（八维重打结论）+ 架构角度 + 时效前提是否已变
    bypass_evidence: []         # 现网绕开它的位置（新结构无写入 / 转换层 / 仍走旧通路）
    action: 收口 | 重开ADR | 转arch-reviewer
scan_tools: ""                  # rg-only | +ast-grep | +codegraph（新鲜度：clean/synced/stale）
rule_reconciliation:            # 三方对账矩阵（S4 产出）；空 = 未做对账，视为盲区
  - rule: ""                    # 文档/规则条目一句话 + 出处
    doc_ref: ""                 # 文件:行 或 PRD 条目号；来源为代码归纳时写 code-inferred
    enforced_in_db: yes | no | partial
    enforced_in_code: yes | no
    verdict: ok | gap | drift   # gap=库不设防；drift=三方语义不一致
    finding: ""                 # gap/drift 必须挂 finding ID
tables_reviewed:                # 穷尽勾选底表；禁抽样
  - name: ""
    verdict: ok | findings | skipped
    reason: ""                  # skipped 必填
findings:
  - id: M-1
    dim: D1|D2|D3|D4|D5|D6|D7|D8
    severity: P0 | P1 | P2
    title: ""
    evidence: []                # 文件:行 或 表.列，≥1
    source: schema_only | code_cross | doc_cross   # 证据来源：仅库内 / 与代码用法对账 / 与文档规则对账
    business_impact: ""         # 什么业务操作会因此出错
    blast_radius: ""            # 消费该表的代码位置数量；未验证须写 unverified
    min_cost: ""                # 最小代价修法
    long_term: ""               # 长期演化最优修法；与 min_cost 相同写 same + 原因
    recommend: min_cost | long_term | min_cost_then_long_term | needs_product_decision
    recommend_why: ""           # 六维理由摘要，全文在报告
    confidence: high | medium | low
    migration_playbook: ""      # 破坏性变更必填：expand/backfill/switch/contract + 回滚点
target_design:                  # 仅 mode=redesign 必填
  identity: ""                  # 「本域统一身份是 <表>.<列>」一句话
  canonical_paths: []           # 每对实体的唯一合法通路 + 目标形态
  ddl_draft: ""                 # 目标 DDL 草案落盘路径或报告内小节锚点
  lossy_points: []              # 合并中无处安放的旧字段 → 须确认
refactor_plan:                  # 仅 mode=redesign 必填；缺任一节视为方案不完整
  entry_convergence: []         # 写入口：保留/下线/谁改
  write_path: ""                # 统一后的唯一写入路径
  read_compat: ""               # 过渡期旧读法怎么活 + 何时撤除
  merge_rules: ""               # 通路映射 + 冲突裁定规则 + 谁审核
  waves: []                     # 波次与依赖顺序（先身份、再关系、最后删旧）
  contract_impact: ""           # 对外 API/枚举/ID 语义影响
  acceptance: []                # 每波可观察验收
  rollback: ""                  # 每波回滚点；哪步之后不可逆
adr_draft: ""                   # redesign 下已落的 ADR 提议路径
open_decisions:                 # 硬决策清单 ≤5；未答前不得出「最终」DDL
  - question: ""
    options: []
    recommend: ""
    why: ""
remaining: []                   # 需产品裁定 / 已挂号延期的 long_term / 盲区未查
coverage:
  blind_spots: []               # `维或表 | 未覆盖原因`；非空 → status 禁止 DONE
  scanned: []                   # 实际读过的真源文件
blockers:
  - ""
followups:
  - "go-fast / product-reviewer / grilling / docs-reviewer / code-reviewer"
```

## 禁止

（硬规则的逆否不复述；此处只列未覆盖项）

- **自行执行 DDL、改 migrations、跑回填**——一律交 go-fast，见 structural 门闩
- 只给一种修法，或把「加索引」当成所有 D8 finding 的万能答案
- 把方言可移植性、N+1、SQL 注入写成本 skill 的 finding（转 code-reviewer）
- 抽样报告：只挑几张核心表，`tables_reviewed` 缺表或写「其余同理」
- 无量级信息就断言性能问题（「这样会慢」须挂行数量级或查询证据）
- **只读 DDL 就出报告**：`rule_reconciliation` 为空、H 组为 0 且无解释、或全部 finding 都是 `schema_only`
- **只做逐表体检**：未列实体通路清单就宣称模型合理（两套并存时逐表全合格）
- **把 ADR 当真源**：未复核就据其判「现网未收口」，或机械收口到已过时/本就错误的目标态
- 自行改写 ADR 结论后继续往下走（应出「重开」建议 + 新目标态候选 + 硬决策，交用户）
- 只用 rg 出 H 组 finding（形状类须 ast-grep 复核）；用图的「没找到」当作删列删表的依据
- 把「代码已经校验过了」当作库无需约束的理由（并发、运维 SQL、第二个服务都会绕过）
- 因为读了代码就顺手报代码缺陷（属 code-reviewer）；本 skill 读代码只为判模型
- 在 `loop-lane` 下停问、改码或落 ADR
- 用「符合三范式」当结论——范式是手段，业务约束与演化成本才是目标

## 关联

- [modeling-principles.md](references/modeling-principles.md) · [antipatterns.md](references/antipatterns.md)
- [scan-workflow.md](references/scan-workflow.md) · [fix-options.md](references/fix-options.md) · [target-design.md](references/target-design.md) · [report-template.md](references/report-template.md)
- 姊妹：[code-reviewer](../code-reviewer/SKILL.md) · [arch-reviewer](../arch-reviewer/SKILL.md) · [docs-reviewer](../docs-reviewer/SKILL.md) · [create-evolution-arch](../create-evolution-arch/SKILL.md)
- [go-fast](../go-fast/SKILL.md) 双向关系：**它调本 skill** 只有 `mode=slice-gate` 一档（开工前 4.5，新增表时）；
  **本 skill 调它**用于落地改表（路径 B）。`slice-gate` 禁止反向调 go-fast，`spec_ref` 来自本 skill 时 go-fast 禁止回调——两侧各设一道闸，防止 A→B→A 成环。
