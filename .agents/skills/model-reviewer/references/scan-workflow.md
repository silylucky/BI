# 取模型真源 · lane 派工 · 穷尽纪律

---

## 0. 扫描底座：服从 code-scanning 分诊

检索一律按 [code-scanning](../../code-scanning/SKILL.md) 的三层分诊选工具，**不要默认只用 rg 正则**。
本 skill 的常见任务对应：

| 任务 | 用 | 为什么不是 rg |
|------|-----|--------------|
| 找列名/类型/约束关键词、定位迁移文件、找配置项 | **rg** | 字符串级检索，AST 工具是纯开销 |
| **代码形状**：「先 count/find 再 insert」防重、状态流转 switch、事务包裹、对 JSON 键取值 | **ast-grep** | rg 会命中注释与字符串；形状跨行时正则不可靠——H 组误报主要来源 |
| **谁读写这张表 / 改这列会炸到哪 / `blast_radius`** | **codegraph** | rg 与 ast-grep 都不解析跨文件名字绑定 |
| 说不清符号，只知道「处理绑定的那段逻辑」 | rg + explore 读文件 | 两者都不做语义相似检索 |

**纪律（照抄 code-scanning 硬规则，此处只列与本 skill 相关的）**

1. **隐式入口不装任何东西**：本 skill 触发时只探测 `command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml`，
   缺则 rg 降级并写 `scan_tools: rg-only` + Blind spot。要装由用户显式决定。
2. **索引新鲜度门**（无人值守/loop 必做）：查图前先 `codegraph status`；pending 落在本次范围内 → 先 `sync`，
   同步失败则降级回 rg/ast-grep 并标 Blind spot，**不得**采信图的结论。刚做过 merge/批量改动后先 sync。
3. **subagent 只用 CLI**，不要在 subagent 提示词里写 MCP 工具名——它看不见。
4. **不能用图的「没找到」证明「不存在」**：动态 SQL、字符串拼表名、反射 ORM 都可能漏。
   `H9 僵尸列/表` 与 `contract 步的无引用证明` 必须 rg 复核后才能下结论——**删列删表的结论错一次就是数据丢失**。

---

## 1. 找模型真源（顺序固定，无源不报）

按序找，找到即记入 Model Card 的 `source_of_truth`：

| 优先 | 来源 | 常见路径 |
|:--:|------|----------|
| 1 | **版本化 migrations** | `migrations/`、`db/migrations/`、`prisma/migrations/`、`alembic/versions/`、`<app>/migrations/` |
| 2 | DDL / schema 真源 | `db/ddl/*.sql`、`schema.prisma`、`*.dbml`、`docs/data/*.md` 附 DDL |
| 3 | ORM 模型定义 | `models/`、`entity/`、`internal/model/`、`*_model.go`、SQLAlchemy/GORM/TypeORM 类 |
| 4 | 线上库自省 | **仅**在有 `.dev` 且用户明确授权只读时；用 `information_schema` 查询，禁写 |

**三源比对是必做动作**：migrations 重放后的结构、DDL 真源、ORM 定义三者列集合/类型/约束不一致 →
**P0 真源分裂**（反模式 F2），因为「按哪个评审」都不可信。先报它，再按最可信源继续。

无 migrations 且 ORM `AutoMigrate`/`create_all` 是唯一真源 → P0（F1），并在报告开头声明
「本次评审基于 ORM 定义，与生产实际结构可能已漂移」。

### 定位命令（示例，按仓调整）

```bash
# 迁移与 DDL 真源
fd -t f -e sql . migrations db 2>/dev/null | head -50
rg -n -i 'CREATE TABLE|ALTER TABLE' --glob '!**/node_modules/**' -l

# ORM 模型（先 rg 定位，再 ast-grep 取结构）
rg -n -i 'gorm:"|@Entity|class .*\(Base\)|@Column|model .* \{' -l

# 运行时建表反模式
rg -n 'AutoMigrate|create_all|synchronize:\s*true|db\.Sync'
```

有新鲜 `.codegraph/` 时用 codegraph 查「谁读写这张表」，作为 `blast_radius` 依据；
无图则 rg 表名/模型名并在报告写 `scan_tools: rg-only`。**subagent 只用 CLI，勿写 MCP**。

---

## 2. lane 派工（三组并行）

| 组 | 覆盖维 | 主要动作 |
|----|--------|----------|
| **S1 结构组** | D1 概念粒度 · D2 键与身份 · D3 关系基数 | 逐表判「一表一事实」；列出主键/唯一键/外键矩阵；对照反模式 A/B 组 |
| **S2 字段与约束组** | D4 时间审计 · D5 类型精度 · D6 约束完整性 | 扫金额/枚举/JSON/时间列；列出 NOT NULL/CHECK/UNIQUE 覆盖率；对照 C/D/E 组 |
| **S3 演化与容量组** | D7 演化扩展 · D8 访问路径容量 | 读迁移历史看改动模式；估量级与增长；索引↔查询路径对照；对照 F/G 组 |
| **S4 语义对账组** | 贯穿八维 + 为 D8 供访问路径 | 文档规则 ↔ 代码用法 ↔ 库约束三方拉齐；对照 H 组；产出 `rule_reconciliation` 矩阵 |

### 2.1 S4 语义对账（本 skill 最容易被跳过、也最出货的一路）

**步 1 · 从文档抽「应然」**：读 `docs/domain/`、`docs/automate/prd*`、`docs/data/`、ADR、需求或招标条目，
只抽**可检验的**业务约束，逐条记出处：

| 抽什么 | 关键词线索 |
|--------|-----------|
| 唯一性 | 唯一、不可重复、同一租户下、同名、幂等、防重 |
| 精度与口径 | 保留 N 位、四舍五入、单位、币种、含税 |
| 状态与流转 | 状态机、只能从…到…、不可回退、审批通过后不可改 |
| 时效与保留 | 有效期、生效时间、保留 N 天、归档、可追溯、审计 |
| 隔离与权限 | 租户隔离、跨租户不可见、数据权限、脱敏 |
| **结构目标态** | ADR/arch 定的关系形状：共享哪张表的主键作统一身份、谁引用谁、哪条通路是唯一合法通路、哪些旧结构应下线 |
| **基数契约** | `0..1`、`1..N`、唯一主（主绑/主联系人/默认项）、必填关系、是否允许多条 |

**结构目标态与基数契约是最常被漏抽的两类**，也正是 I 组（迁移未收口）与 D3 的判据来源。
ADR 里一句「成员、采集、看图共用 `x.id`」或「Asset `0..1` 主绑」都必须成为矩阵里的一行——
前者会暴露多态表把统一身份分叉（I5），后者会暴露「唯一主」只靠代码维护（I6）。

文档缺失或只有散文 → 不阻塞，改从代码归纳并标 `doc_ref: code-inferred`，同时进 Blind spot。

**步 2 · 从代码抽「实然」**（重点找**代码在替库兜底**的痕迹）：

```bash
# 代码手写防重 → 库很可能缺唯一约束（对应 H1）
rg -n -i 'exist|duplicate|已存在|重复' --glob '!**/*_test.*' -C2 | rg -i 'count|first|find|select'
rg -n -i 'FOR UPDATE|SELECT .* LOCK|pessimistic'

# 状态流转只活在代码里（H2）
rg -n -i 'allowed_transitions|canTransit|switch .*status|if .*status ==' -C1

# 对 JSON 键做查询/排序（H3）
rg -n -i "json_extract|->>|jsonb_path|data\['|JSON_CONTAINS"

# 真实访问路径（供 D8：按什么查/排/聚合）
rg -n -i 'Where\(|filter\(|find_by|ORDER BY|GROUP BY' --glob '!**/*_test.*'

# 枚举值域漂移（H5）：代码常量 vs 库 CHECK/字典表
rg -n -i 'const .*Status|enum .*Status|STATUS_[A-Z]+\s*='

# 软删语义被绕过（H8）
rg -n -i 'deleted_at|is_deleted' --glob '!**/migrations/**' -C1
```

有新鲜 `.codegraph/` 时用它列该表的写入方，比 rg 更全；无图则 rg + 读文件，并写明 `scan_tools: rg-only`。

**步 3 · 三方比对出结论**：每条规则填 `enforced_in_db` / `enforced_in_code` → 定 `verdict`：

| db | code | verdict | 处理 |
|----|------|---------|------|
| yes | 任意 | `ok` | 不报（除非语义不一致 → `drift`） |
| no | yes | **`gap`** | 报 finding：代码替库兜底，`source: code_cross`。并发/脚本/第二服务会绕过 |
| no | no | **`gap` P0 候选** | 规则完全无人执行——先确认规则是否仍有效，再定级 |
| partial | 任意 | `gap` | 写清哪部分没落（如唯一键漏租户前缀） |
| 语义不一致 | — | **`drift`** | 库/代码/文档说法不同（枚举值域、字段含义、精度）→ 先澄清真源 |

**步 4 · 反向查冗余**：库里有而代码从不读写的列/表 → `source: schema_only`，归 D1/D7，
建议确认后清理（走 contract 步，先证明无引用）。

**步 5 · 画通路、查迁移收口（对应 I 组）**：前四步逐条看规则，这一步看**连起来的形状**。

1. **列通路**：对每一对核心实体，列出现网**所有**能把它们关联起来的路径（直接外键 / 关联表 /
   多态 `type+id` 表 / 「选择器」类间接表 / 冗余列）。**≥2 条 → I2 候选**，写入哪条取决于入口。
2. **比目标态**：读 ADR / `docs/arch.md` 里定的目标形状，与步 1 的通路清单对照。
   目标态只认一条而现网有多条 → **I1**（未收口）。
   **查无任何目标态定义**（`docs/adr/`、`docs/arch.md`、`docs/data/` 都没约定）→ **I8 P0**：
   没有真源意味着谁都可以再加第四条通路。此时不要硬凑一个「目标态」来比对，
   而是转 [target-design.md](target-design.md) 走 `mode=redesign` 综合产出目标态。
2.5 **复核目标态本身**（有 ADR 时必做，见 SKILL.md「ADR 复核」）：用八维重打 ADR 定的形状，
   并查现网是否普遍绕开它（新结构无写入、大量转换层、写入仍走旧通路 → I10）。定出
   `adr_sound | adr_outdated | adr_wrong`：

```bash
# 目标态结构建了但没人写 → 目标态难落地的强证据
rg -n -i 'INSERT INTO <target_table>|<TargetModel>\{' --glob '!**/*_test.*' --glob '!**/migrations/**'
# 为适配目标态写的转换层
rg -n -i 'adapt|convert|toLegacy|fromLegacy|compat' -g '!**/*_test.*' -l
```

   `adr_wrong` / `adr_outdated` → **不得**据其判「未收口」，转「重开 ADR + 新目标态候选」。

3. **判收口状态**（仅 `adr_sound` 时才谈收口）：对每条非目标通路查「最近是否仍被写入」：

```bash
# 旧通路是否仍在被写（表名替换为实际旧表）
rg -n -i 'INSERT INTO <old_table>|<OldModel>\{|save\(.*<OldModel>|update.*<old_table>' --glob '!**/*_test.*'
# 迁移历史里有加无删：expand 有、contract 无
rg -n -i 'CREATE TABLE <new>|ADD COLUMN' migrations/ ; rg -n -i 'DROP TABLE <old>|DROP COLUMN' migrations/
```

   仍被写入 → **I3 P0**（每天都在生产不一致数据）；已停写只剩结构 → I3 降 P1/P2 走清理。

4. **产出目标态对照**（命中 I 组必须给，见 antipatterns I 组末）：两张关系图或两张表，
   逐条差异标 `未收口` / `已漂移` / `目标态需重开 ADR`。

**这一步为什么单列**：I 组的病灶不在任何单张表上，逐表体检每张都合格，只有把通路连起来看才暴露。
跳过步 5 的报告会把「两套模型并存」漏成几条零散的多态外键 P1。

**S4 密度下限**：`rule_reconciliation` 至少覆盖文档里抽出的全部可检验规则；若文档为空，
至少给出 5 条从代码归纳的规则条目，否则视为未做对账。

**每组回传必须含**：

```yaml
lane: S1 | S2 | S3 | S4
tables_checked: []        # 逐表；与 Model Card 表清单对齐
findings: []              # 每条带 pattern 编号 + 证据(文件:行 / 表.列) + business_impact + source
blast_radius_notes: []    # 消费方查询结果；查不到写 unverified
rule_reconciliation: []   # S4 必填：rule / doc_ref / enforced_in_db / enforced_in_code / verdict / finding
access_paths: []          # S4 必填：从代码归纳的「按什么查/排/聚合」+ 出处，供 D8 对照索引
exhausted: ""             # findings < 5 时必填
```

**Lane 密度下限**：每组 ≥5 条 finding；不足 5 时**必须**附 `EXHAUSTED` 段（实际读过的迁移文件与表清单、
用过的检索式、逐表结论、主观信心）。无 `EXHAUSTED` 且 <5 → 视为未完成，进 `coverage.blind_spots`。

---

## 3. 穷尽纪律（反抽样）

1. **表清单是底表**：Model Card 里逐表列出，每表最终必须有 `ok | findings | skipped`（`skipped` 写原因）。
   报告里缺表或写「其余同理」= 未完成。
2. **同构问题**：多表同病（如十张表都缺 `created_by`）→ 一条 finding + **完整表实例表**，
   禁止「等 N 张表」。
3. **二次 sweep**：盲区为空且 P0+P1 低于阈值（整库 <10 / 表族 <8 / 单表或变更面 <5）→ 必须再扫一遍；
   未触发也要在总览写「穷尽自检：二次 sweep 无新增」。
4. **量级必须有出处**：说「这表会很大」要挂日增估算或现有行数；查不到就写 `unverified` 并降置信度。

---

## 4. 只读安全（涉及线上库时）

| 允许 | 禁止 |
|------|------|
| `information_schema` / `pg_catalog` 结构查询 | 任何 DDL / DML |
| `COUNT(*)`、抽样 `LIMIT` 校验查询（注意大表代价） | 无 where 的大表全量扫描、`SELECT *` 导出业务数据 |
| 读 `.dev` 里非生产环境凭据 | 默认连生产；把生产密码写进报告或工件 |

生产库只在用户明确点名时连，且先说明将执行哪些查询。报告与证据工件里**禁止**出现真实业务数据样本
（脱敏或只写列名与统计量）。
