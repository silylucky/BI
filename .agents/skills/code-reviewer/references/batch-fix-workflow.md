# Batch Fix Workflow（批量修）

## 门闩

1. 已交付标准报告（含 Stack Card）
2. **确认**：
   - `mode: auto-fix`（默认）+ `fix_mode: confirm-batch`：用户明确「确认全量(P0+P1+P2)」或「指定 P0 / P0+P1」
   - `mode: auto-fix` + 用户**指定 `P0` 或 `P0+P1`**：`fix_mode: auto`，**跳过确认**直接进入修复
   - `fix_mode: auto`（`go-fast-unattended-fix`）视同确认全部**可修**且**落在调用方 `cr_fix_scope` 内**的 finding
3. `fix_mode: confirm-batch` 且未确认 → **只讨论方案，不写业务代码、不调 go-fast**
4. `auto` 下契约不明 / 需裁定 / 盲区不足 → **不**进真接批，记 `remaining`；可撤入口则优先撤入口
5. **扫描覆盖不全**（未消解 Blind spot）→ 照修已发现项，但**禁止**因本轮「无可修项」判 `no_fixable_items` 干净收工；盲区进 `coverage.blind_spots` 并按 SKILL 表降级 `status`
6. **禁止自动修 P2**（例外：`mode: auto-fix` 下用户明确「确认全量」视为含 P2；`mode: go-fast-unattended-fix` 下无 orchestrator / loop-polishing 默认 `all` 含 P2，按调用方 `cr_fix_scope`）

### `cr_fix_scope`（auto 下的范围闸 · 唯一口径）

| 调用来源 | 默认自动修 | 超范围项 |
|----------|-----------|----------|
| **`mode: auto-fix` + 用户确认全量** | P0+P1+P2 | — |
| **`mode: auto-fix` + 用户指定 `P0`** | **仅 P0** | P1/P2 进 `remaining` |
| **`mode: auto-fix` + 用户指定 `P0+P1`** | **仅 P0+P1** | P2 进 `remaining` |
| **单独** go-fast（无 `orchestrator`，`mode: go-fast-unattended-fix`） | P0+P1+P2 | — |
| `orchestrator` 为 loop-goal-prd / loop-goal-product（调用方未传或传 `P0+P1`） | **仅 P0+P1** | P2 进 `remaining` |
| `orchestrator` 为 loop-polishing（默认）或任意来源显式 `cr_fix_scope=all` | P0+P1+P2 | — |
| 任意来源显式 `cr_fix_scope=P0+P1` | **仅 P0+P1** | 覆盖环默认 |
| 任意来源显式 `cr_fix_scope=P0` | **仅 P0** | P1/P2 进 `remaining` |

prd/product 默认压到 P0+P1 防冲分震荡；**loop-polishing** 默认 `all`（编排契约 §8）。**禁止**忽略已传入的 `cr_fix_scope`。

## 调用 go-fast 路径（确认后）

`mode: auto-fix` 确认后（或指定 P0/P0+P1 跳过确认后）→ **必须**调 [go-fast](../../go-fast/SKILL.md) 执行批量修，不允许本 skill 自己起 subagent 改代码：

| 触发 | go-fast 入参 |
|------|-------------|
| 用户确认「全量 P0+P1+P2」 | `spec_ref` = 本 skill 落盘的报告路径（`docs/material/code-reviewer/<date>-<slug>.md`）；`attendance: attended`；`cr_fix_scope: all` |
| 用户指定 `P0` | 同上；`attendance: unattended`；`cr_fix_scope: P0` |
| 用户指定 `P0+P1` | 同上；`attendance: unattended`；`cr_fix_scope: P0+P1` |

**报告作为规格**：本 skill 的报告（含 Stack Card + finding 表 + 每条 finding 的 `path/line/severity/category/suggested_fix/xref`）即 go-fast 的 `spec_ref`，go-fast 走**路径 B**（出规格→规格门→拆工单→并发）。报告**必须**满足以下最小字段才能当 spec_ref：

| 字段 | 要求 |
|------|------|
| `id` | 稳定 finding ID（`P0-1`…） |
| `severity` | P0 / P1 / P2 |
| `category` | lane 类别（假绿 / 硬编码 / 可靠性 / 表单 / 风格 / 产品表面 / 假通 / API / 安全 / 性能 / HA） |
| `path` + `line` | 精确文件 + 行号区间 |
| `suggested_fix` | 一句话修法（删除 stub 接真 / 撤入口 / 加超时 / 抽公共件…） |
| `xref` | 同根因其它 finding ID 列表（同 xref 链 → go-fast 拆工单时合并进同一 subagent） |
| `unfixable_reason` | 仅当不可自动修：契约不明 / 需裁定 / 撤入口 vs 真接 的产品决策 |

落盘后把**绝对路径**回传给 go-fast；go-fast 据此出 `docs/specs/cr-<slug>.md` → 规格门 → 拆 tickets。

## 调度三阶段（确认后或 auto 必须）

```
前置串行（公共面） → 隔离并发（业务分片） → 后置串行（全仓校验）
```

| 阶段 | 何时 | 放什么 |
|------|------|--------|
| **前置串行** | 最先，不可与业务分片并行 | 根依赖（`go.mod`/`package.json`/`pom.xml`…）、全局配置、公共中间件/拦截器、共享模型/常量/统一返回体、公共工具包、**同一张表的 DDL**、生成代码入口契约（见栈附录）、**xref 链全组**（同一根因的多个 finding 必须同批处理） |
| **隔离并发** | 前置完成后 | 单模块、单类型问题；`target_file_scope` 两两无交集；同 xref 链内 finding **必须**进同一 subagent |
| **后置串行** | 全部并发分片结束后 | 全仓一致性扫、相关测试/构建、finding 关闭核对、冲突残留修补 |

**强制归入前置串行（禁止进并发队列）**：改公共 proto/共享类型、根配置、基础工具包、全局中间件、**同一数据表结构**、**xref 链跨多文件的根因组**。

**调度顺序**：同阶段内 **P0 先于 P1 先于 P2**。

## 拆分原则

| 批次类型 | 拆法 | 注意 |
|----------|------|------|
| 假绿 / stub | 按域/服务 + 对应 UI | **删除** stub/mock 分支并接真实现，或撤入口；禁止「加 flag / Badge」当完成 |
| 隐式假通（L8） | 一个外部依赖一个 subagent | 补 `contracts/<slug>.smoke.*` 并用 `evidence-run --phase smoke` 真打一次；补超时/退避/幂等**并留测**；跑不通 → 撤入口 + 记 `remaining`，**禁止**改成 stub 或本地 mock server |
| 产品表面 | 按能力域：补入口或撤半成品页 | API 契约与各端路由同一批验收 |
| 硬编码 / 门禁 | 启动校验、prod 模板、编排去 stub/dev 逃逸 | 小 diff；先验证「拒绝启动」 |
| 坏表单 | **一页或一域一个** subagent | 先定目标 UX，再删裸 path/YAML 主路径 |
| 风格对齐 | 按页面列表分批，对齐**本仓**标杆 | 禁止新引入 UI 库 |
| 可靠性 | health、队列门禁、隔离、retention | 补测；隔离类优先单测 |
| 性能热点（L11 §17） | 分页上限、N+1→批量、有界 fan-out、缩小锁 | 补测；禁改无关模块 |
| HA（L11 §18） | 共享会话/队列、租约 fencing、ready 探针、values-ha | 契约不明则**降宣称**进 remaining，禁止假接 Redis stub |
| **xref 链合并** | 同 `xref` 字段的多条 finding **必须**进同一 subagent（无论跨多少 lane） | 例：L4 报表单裸 path + L10 报同表单未校验 → 一片修完，不分两批 |

技术栈不同则验证命令不同（`go test` / `pnpm test` / `pytest` / `mvn test`…）——写进该任务完成定义。

## 并发分片硬约束

1. 每个并发任务只改 **一个业务模块** 内的 **一类** 问题；禁止跨多模块同批。
2. 各任务 `target_file_scope`（精确文件/目录路径）**两两无交集**——无共享文件、无重叠目录树、无「都改同一公共文件」。
3. 存量兼容：不破坏存量接口/数据/第三方调用；必要时新旧并存，禁止破坏性默切。
4. 每条任务绑定报告 **稳定 finding ID**（`P0-x` / `P1-y`），可反向追溯；勿重排已确认 ID。

### 分发前冲突预检（必做）

1. 列出全部并发任务的 `target_file_scope`，两两比对路径（含目录前缀包含关系）。
2. **无重叠** → 可分发多 subagent 并行。
3. **有重叠** → 拆成更小隔离分片，或把冲突文件并入**前置/后置串行**；更新 scope 后再预检，直至无冲突。
4. 向用户交任务表时可附一行结论：`并发安全` / `已拆分（原…→现…）`。

### 任务元数据（每条并发/串行任务）

| 字段 | 要求 |
|------|------|
| `task_id` | 本轮唯一编号 |
| `finding_ids` | 绑定的报告 ID |
| `phase` | `serial_pre` / `parallel` / `serial_post` |
| `risk` | P0 / P1 / P2 |
| `target_file_scope` | 仅本任务可改的精确路径列表 |
| `steps` | 分步改造（含自检点） |
| `compat_rollback` | 兼容要点 + 失败回滚 |
| `verify` | 本任务验证命令/标准（该栈） |

粒度：禁止「一整仓一类问题一个超大任务」；拆到可独立验证的最小隔离单元。

## Subagent 提示词要点

```
项目根：…
Stack：…（语言/包管理器/测试命令）
task_id / finding_ids / phase / risk：…
只改 target_file_scope（禁止触碰列表外文件）：…
目标行为：…
兼容与回滚：…
禁止：扩大范围、改无关模块、改公共面（应在 serial_pre）、把 seed 超管当 bug 删掉、
      引入本仓没有的 UI 库、用 flag/Badge「关掉」stub 冒充修复
完成定义：…
  - stub：非测试主路径无 stub/mock/FORCE_STUB 分支；未就绪则无入口
  - 外部依赖：有真实端点 smoke 工件（`gate-check smoke --slug <slug>` 退出 0）；超时/退避/幂等已写且有测试
  - 产品表面：宣称端均有入口；有入口页无常驻骨架/假数据；主 CTA 闭环调真 API
  - 表单：主路径无手填 path/YAML（或仅高级折叠）
  - 风格：对齐标杆页 …
验证：…（该栈测试/构建 + 下方回归关键词）
```

## 后置串行最小集

全部 `parallel` 完成后，主 agent（或单一收尾 agent）串行：

1. 再跑冲突预检逻辑：确认无意外改到他任务 scope / 公共面残留半改
2. 按 Stack Card 跑相关测试/构建 —— 经 `evidence-run --phase cr`（见「回归最小集」）
3. 跑下方回归搜法（假绿/半成品/隐式假通）
4. 汇总关闭的 finding ID + 未完成项

## 回归最小集

**测试/构建命令一律经证据层**（工件供编排方与下一轮 CR 复核；见 [evidence.md](../../go-fast/references/evidence.md)）：

```bash
~/.agents/skills/_bin/evidence-run --slice CR --phase cr --label "<变更面相关测>" -- <该栈测试命令>
```

退出码非 0 → 按 SKILL「提交隔离」回退该 CR commit 并把 finding 转 `remaining`；**禁止**绕过 `evidence-run` 直接跑了事，也**禁止**删工件重跑。工件路径填回传 `evidence.cr`。

再按 Stack Card 跑关键词回归（有 `ast-grep` 时先 `ast-grep scan --json=compact` 于变更面，再 rg 补漏）：

```bash
# stub / 假绿残留（按栈改路径；命中即未完成）
rg -n -i 'FORCE_STUB|USE_MOCK|mockData|fakeData|isDemo|NotImplemented|connected["\']?\s*:\s*true' \
  --glob '!**/node_modules/**' --glob '!**/*_test.*' --glob '!**/*.spec.*' --glob '!**/__mocks__/**'

# 半成品表面
rg -n -i 'coming soon|alert\([\'\"]todo|onClick=\{\(\)\s*=>\s*\{\s*\}\}' --glob '!**/node_modules/**'

# 门禁：用 prod 配置或 production env 试启动，应拒绝已知 dev 默认密钥
```

## 回写

向用户交批次完成摘要：阶段执行顺序、各 `task_id` 改动、验证方式、关闭的 finding ID（与报告稳定 ID 一致）。

若修复过程中发现报告未覆盖的同根因问题：以**新 ID**追加；`confirm` 模式征得用户确认后再扩批；`auto` 模式仅当与已批同根因且文件集合仍无冲突时可纳入本轮，否则写入 `remaining`，不要静默扩大到无关域。

## 栈附录：Go / go-zero（若 Stack Card 命中）

**绝对红线**（与 [go-fast/references/go-zero-goctl.md](../../go-fast/references/go-zero-goctl.md) 同尺）：

1. **一定要遵守 goctl 的使用规范**。
2. **严禁手动修改** goctl 产物 **`types.go`**、**`routes.go`**。
3. **不能给 goctl 的产物文件打补丁**（含脚本/sed hotfix）；改契约从 `*.api` → 重新 goctl；发现手改 → **P0**，回滚生成物并再生，禁止继续补丁。

- 优先走 **goctl** 生成脚手架，避免手建与生成物冲突的新文件。
- `*.api` 里 `service xx` → 服务入口与 `<service>/xx.go` 同名对齐。
- 其他栈无此条则跳过。
