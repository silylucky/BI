---
name: code-reviewer
description: >
  生产就绪 / 产品体验 code review（技术栈无关）：先识别栈再拆 subagent 并行扫描假绿·stub 零容忍、
  隐式假通（外部契约从未真打 / 无失败语义）、硬编码、可靠性缺口、多库 SQL 可移植性、日志分类缺口、
  API 信封与原始错误暴露、安全与参数隐患、路径/JSON/YAML 裸表单、表单校验与复杂表单结构、
  用户向文案（禁字段名/甲乙方/PRD 编号上屏）、UI 风格与嵌套边框间距、产品表面（能力无入口 / 有入口半成品）；
  静态大流量性能热点（无分页/N+1/无界 fan-out/热路径锁）；宣称 HA 时扫多实例可靠性与 HA 下性能瓶颈；
  读 .evidence/ 与 gate-check 结果作为假绿实证；未扫到 ≠ 没问题，盲区阻断 DONE；输出标准分级报告；
  默认 mode=auto-fix：扫完报告 → 停等用户确认 → 确认后调 go-fast 修全量(P0+P1+P2)；
  用户指定 P0 或 P0+P1 → 跳过确认直接修指定级别；go-fast unattended 用 mode=go-fast-unattended-fix 按 cr_fix_scope 自动修；
  三环用 mode=loop-lane 只评不修；lane 密度下限：每 lane ≥5 候选或声明穷尽附搜索关键词清单。
  深扫页级视觉/菜谱见 ui-ux-reviewer。
  Use when reviewing any repo for production readiness, fake-green stubs, never-executed external integrations,
  missing timeout/backoff/idempotency, multi-DB SQL portability, logging taxonomy gaps, non-standard API envelopes,
  raw error leakage, security/param hazards, bad form UX, non-human copy, UI border overlap, complex form structure,
  missing client entry points, skeleton shells, hot-path performance anti-patterns under load, HA multi-instance
  reliability/perf risks, or batch-fixing those findings — any stack.
---

# Code Reviewer（生产就绪 · 产品体验）

技术栈无关的专项评审。Agent 已懂通用 code review；本 Skill 补：**易漏检的共性问题**、**先识栈再扫**、**标准报告**、**确认后 subagent 批量修**。  
例外：`mode: auto-fix`（默认）：报告落盘 → 停等用户确认 → 确认后调 [go-fast](../go-fast/SKILL.md) 批量修**全量**（P0+P1+P2）；用户指定 `P0` 或 `P0+P1` → 跳过确认直接修指定级别。
`mode: go-fast-unattended-fix`（由 [go-fast](../go-fast/SKILL.md) unattended 收尾调用）时报告后**不等人**，对可修 finding 按调用方 `cr_fix_scope` 直接 batch-fix。

不假设仓库是 Go / React / Ark / Nex。先分析技术栈与目录布局，再按栈选择搜法与并行 subagent。

## 何时启用

| 场景 | 动作 |
|------|------|
| 任意仓上线前 / 里程碑就绪评审 | 范围=整仓；识栈 → 并行扫描（每 lane ≥5 候选或声明穷尽） → 标准报告 → **停等确认** → go-fast 全量修 |
| PR / 改动涉及 stub、默认配置、表单、新页面 | 范围=PR·变更面（主根+上追一层）；按发现目录扫 |
| 「批量修假绿 / 硬编码 / 表单 / 风格」 | 报告 → **等确认** → go-fast 批量修 |
| 用户指定 `P0` 或 `P0+P1` | `mode: auto-fix` 且 `cr_fix_scope=P0` 或 `P0+P1`；报告 → **跳过确认** → 直接修指定级别 |
| go-fast `unattended` 收尾 | `mode: go-fast-unattended-fix`；变更面 → 报告 → **自动**修可修项（按 `cr_fix_scope`） |
| loop-polishing `code` lane | `mode: loop-lane`；范围=scope → 报告 → **不修不停等** |
| 多仓对比共性问题 | 同一 rubric，分仓 Stack Card + 对照表 |

**不要**：替代完整安全审计或**压测/profiling**（L11 只做静态热点与 HA 结构风险）、在**默认 confirm 模式**未确认时大范围改代码、把单栈搜法硬套到所有语言。

## 必读顺序（≤3 次）

1. 本文件「识栈 → 并行扫」+「严重度」+「非问题」+「宣称判据」+「穷尽盘点」+「合并去重」+「扫描工具分诊」
2. [references/stack-detection.md](references/stack-detection.md)（含 Phase 1 提示词模板）+ [references/finding-catalog.md](references/finding-catalog.md)；分级边界见 [severity-rubric.md](references/severity-rubric.md)；结构性假绿种子优先走 [code-scanning](../code-scanning/SKILL.md)（有工具时）
3. 报告用 [references/report-template.md](references/report-template.md)；批量修用 [references/batch-fix-workflow.md](references/batch-fix-workflow.md)；格式样例 [references/examples.md](references/examples.md)

## 严重度总则

| 级 | 含义 | 典型 |
|----|------|------|
| **P0** | 生产误导或必炸 | **假绿 / 任何可激活 stub**、**已宣称对接的外部依赖无真实端点 smoke 工件**（隐式假通）、生产硬编码密钥/假数据、**密钥/dev 默认门禁已写未调用或缺失**、宣称可用实未实现、静默做错事、**有入口的半成品**（骨架/假数据/残交互）、**宣称 HA 但会话/锁/队列仅单机内存或本地盘**、主路径无界全表导出致必炸 |
| **P1** | 上线前应修 | 危险可靠性默认值、**外部调用无超时/退避/幂等**、**测试 mock 掉被测主路径**、**裸 path/JSON/YAML 表单**、**表单缺必填/错误提示/对齐**、**复杂表单无分区/折叠/标签**、**API 无标准信封或原始异常上屏**、**日志缺请求/进程/任务分类**、**多库架构下 SQL 方言不兼容**、**文案研发口吻/字段名/甲乙方上屏**、**嵌套边框无间距重叠**、同产品 UI 风格严重不一致、无健康探针、**CI/部署门禁未接线**、**服务端有能力但宣称端全无入口**、**热路径无分页/N+1/无界 fan-out**、**HA 下全局锁串行/每副本全量扫/连接池×副本打爆** |
| **P2** | 技术债 | 未引用的死代码、文档漂移、版本元数据无意义、**CRUD 承载与标杆页不一致但主路径可用**、未宣称可用且无入口的规划缺口、无锚点的性能疑点 |

**更致命（优先报、优先修）**：**假绿/stub** · **隐式假通** · **安全/参数隐患** · 可靠性 / **HA 假高可用** · **热路径性能放大** · **API 信封/错误暴露** · 真实缺口 · 硬编码 · **半成品表面** · **坏表单 UX** · **非人话文案** · **风格/布局微缺陷**。

**门禁分流**：拒绝已知 dev 密钥 / stub 逃逸进进程 → 缺失或未调用 = **P0**；仅 CI/Helm 未拦 dev values → **P1**（除非默认编排已把 stub/密钥打进准生产 → P0）。

## 非问题（勿报 / 勿进 findings）

1. **默认管理员 + 部分种子数据**：首次启动写超管与平台种子为预期；假定首次登录后改密。可作 P2「文档写清必改密」，勿当漏洞标题。
2. **测试双**：`*_test.*`、`*.spec.*`、`__mocks__`、fixture、**仅** Storybook/设计系统 demo 中的 mock → **不进报告**。**非测试主路径** stub/mock 一律要报，哪怕挂在 env/flag/`profile=dev` 后面。
   **豁免不覆盖**：测试把**被测对象本身**换成 mock，导致该用例什么都没验证（断言 mock 的返回值 / 恒真断言 / 快照全是 mock 数据）→ **报 P1**，它是假绿的背书者。区分线：mock 的是**被测对象** → 报；mock 的是**被测对象的外部依赖**（HTTP/SDK/时钟/随机数/容器替身）→ 仍豁免。判定要点与 rg 见 [catalog §1.1](references/finding-catalog.md)。
3. **未宣称可用、且全端无入口的规划缺口** → P2；已挂菜单/路由/按钮，或已「宣称」→ 升 P0/P1（见下）。
4. **无代码锚点的性能臆测**（未指出入口与放大机制就断言「扛不住大流量」）→ 勿报；L11 只报可定位反模式。未跑压测 ≠ finding。

### 「宣称」判据（L7 / 假绿升级用）

下列**任一**成立即视为已宣称可用（用于升 P0/P1，勿凭感觉）：

1. UI 文案 / 空态 / CTA：写「已支持」「已具备」「可用」等交付语气（非「即将推出」且入口仍可点主流程 → 仍按半成品报）
2. 仓库 README / 对外 docs / 变更说明列出该能力为已交付
3. OpenAPI/SDK/产品对照表将该能力标为 GA / shipped（非 experimental 且无「API only」限定）

未命中以上且全端无入口 → P2 规划缺口；命中宣称但无入口 → P1；有入口但不完整 → P0/P1。

## 硬规则

1. **Stub 零容忍（非测试）**：业务/BFF/前端主路径只要存在 stub/mock/假成功/占位实现 → **必报**。显式 env/flag、Badge、`degraded`、诚实失败 **都不能**当「设计如此」降级放过；修法是删除 stub 并接真实实现，或撤掉入口与宣称，而不是加开关。
2. **假绿必报**：stub/mock 返回成功态、或 UI 用假数据/骨架冒充已交付 → P0。
3. **产品表面必对账**：服务端已有能力但宣称客户端**全端无入口** → 至少 P1；有入口但骨架屏常驻、假数据、按钮无动作、CRUD/提交流程残缺 → P0/P1（见 catalog §7）。
4. **硬编码分场景**：启动默认密钥 + 门禁缺失/未调用 → **P0**；live 写死内网 IP、假 KPI → P0/P1；仅本地默认 + 有 prod 模板且门禁已接线 → 不单开「弱口令种子」P0（可 P2 文档提醒）。
5. **表单禁裸协议**：主路径手填 **文件系统路径** 或 **原始 JSON/YAML** → 至少 P1；改为选择器、结构化表单、模板库、上传或可视化编排。必填项缺 `*`、字段级错误提示、对齐混乱、复杂表单无分区 → 见 [catalog §13](references/finding-catalog.md)。
6. **风格与体验一致**：同级页面页头/筛选壳/空态/异步态混用 → P1；嵌套带边框组件缺间距导致双描边重叠 → P1；对齐**本仓**标杆页或设计系统。页级深扫可交 [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md)。
7. **API 与错误面**：对外接口应返回本仓约定的标准信封（`code`/`message`/`data` 或等价）；原始堆栈、SQL、内部路径、厂商原始 JSON 直出 → P0/P1（见 catalog §11）。
8. **文案给人看**：用户可见文案禁字段名/查询参数名/PRD·ADR 编号/内部函数名/工程黑话/甲乙方口吻上屏 → P1（见 catalog §12；与 loop 环 craft §8 同尺）。
9. **先识栈，再扫，优先 subagent 并行**：见下文；禁止用单一 Go/React 搜法扫完就交差。结构性形状**优先** [code-scanning](../code-scanning/SKILL.md) 三层分诊，禁止默认只用 rg 交差。
10. **先报告后改代码**：默认 `mode: auto-fix` + `fix_mode: confirm-batch`，报告落盘后**停等用户确认** → 确认后调 [go-fast](../go-fast/SKILL.md) 批量修**全量**（P0+P1+P2）；用户指定 `P0` 或 `P0+P1` → `cr_fix_scope` 限缩且**跳过确认**直接修；`mode: go-fast-unattended-fix` 见下节；`mode: loop-lane` 只报告不修。
11. **证据可定位**：路径 + 行为；区分「测试双」vs「生产路径 stub」。
12. **未扫到 ≠ 没问题**：lane 失败/超时/权限不足/子模块未拉 → 该范围记 **Blind spot**。存在**未消解** Blind spot 时：报告**禁止**写「干净 / 可上线」，回传 `status` **禁止** `DONE`（分级见「回传格式」），`fix_mode: auto` 下**禁止**因「没发现可修项」判 `no_fixable_items` 收工。「没扫到」与「没问题」不是同一件事。
13. **Lane 密度下限**：每条 lane subagent 回传 finding ≥ 5 条候选；不足 5 条时**必须**在 lane 回传末尾加 `EXHAUSTED` 段：列出实际跑过的搜索关键词清单（rg pattern / ast-grep pattern / 路径 glob）+ 跑过几次 + 主观信心（high/medium/low）。无 `EXHAUSTED` 段且 finding < 5 → 视为该 lane **未完成**，进 Blind spot（不得记「无发现」）。
14. **契约验真（反假通）**：**「反 stub」不等于「反假通」**——有仓外调用却无真实端点 smoke 工件、或无超时/退避/幂等/失败语义 → 按 [catalog §8](references/finding-catalog.md) 报（L8）。
15. **扫描工具只探测不擅自安装**：隐式入口禁止 `brew install` / bootstrap；缺 ast-grep/codegraph → 用 rg 完成任务，报告「扫描方式」写明降级，L1 结构性误报风险记 Blind spot（见「扫描工具分诊」）。
16. **性能/HA 静态边界**：L11 不替代压测；禁止编造 QPS。`ha_mode: claimed` 时 §18 **必扫**；仅单机宣称则跳过 §18 仍扫 §17（有服务端时）。

---

## 识栈 → 并行扫（必须）

### Phase 0 · 技术栈与边界（主 agent，短）

用根目录清单 + 锁文件 + 入口，写出 **Stack Card**（写入报告总览）：

| 探测 | 看什么 |
|------|--------|
| 语言/运行时 | `go.mod`、`package.json`、`pyproject.toml`/`requirements.txt`、`pom.xml`/`build.gradle`、`Cargo.toml`、`*.csproj`、`Gemfile`… |
| 前端 | `fe/`/`web/`/`apps/*`、Vite/Next/Webpack、UI 库痕迹 |
| 后端形态 | REST/gRPC/GraphQL、worker/agent/sidecar、monorepo packages |
| 配置与密钥 | `etc/`、`.env*`、`values.yaml`、`docker-compose*`、IaC |
| 数据 | migrations、seed、ORM；**多 Driver / dialect 配置**（L3） |
| 交付 | Dockerfile、Helm、systemd、Makefile、CI |
| 宣称材料 | README / docs / OpenAPI 标签（供 L7「宣称」判据） |
| **HA 模式** | `docs/arch.md` / README / Helm `replicas` / 集群配置 → Stack Card `ha_mode: claimed\|single\|unknown`（判据见 [catalog §18](references/finding-catalog.md)） |

细节与按栈搜法：[references/stack-detection.md](references/stack-detection.md)。

### Phase 0.5 · 扫描工具分诊（主 agent，只探测不装）

派 L1/L2/L7 前先探测（约定真源：[code-scanning](../code-scanning/SKILL.md)）：

```bash
command -v ast-grep; command -v codegraph; ls -d .codegraph sgconfig.yml 2>/dev/null
```

| 有什么 | L1 / 结构性假绿 | L7 可达性 |
|--------|-----------------|-----------|
| `ast-grep` + `sgconfig.yml`（或可 `ast-grep run`） | **优先** `ast-grep scan --json=compact`（规则包）+ 按栈临时 pattern；rg 只做补漏 | — |
| 仅 `codegraph` + 新鲜 `.codegraph/` | rg / 临时 pattern | 对 handler 跑 `codegraph callers`；**「没找到」须 rg 复核路由表**，不得单独证 MISSING |
| 都没有 | 下方 rg 种子；报告「扫描方式」写 `rg-only`；L1 记 Blind spot：`结构性假绿依赖词法，注释/字符串误报与漏报风险未消除` | 纯 rg + 读路由/菜单 |

有 `.codegraph/` 时先 `codegraph status`：pending 落在扫描范围 → `sync`；失败 → 当无图用，Blind spot 写明。**禁止**本 Skill 隐式跑 bootstrap 安装。

**产出**：Stack Card 增加一行 `scan_tools: ast-grep|codegraph|rg-only`（可组合）。

**范围模式**（写入 Stack Card「范围」）：

| 模式 | 何时 | 扫法 |
|------|------|------|
| **整仓** | 上线前 / 里程碑 | 全 lane；根路径 = 仓根 |
| **PR / 变更面** | 用户指定 PR、分支 diff、模块 | 以 diff 触及目录为**主根**；L1/L2/L7 仍向上追 1 层调用方/路由表/菜单（防只改 stub 周围漏报）；diff 触及适配器/client → L8 必开；无关 app 可跳过并写明 |
| **多仓对比** | 用户点名多仓 | 每仓独立 Stack Card + 同 lane 并行，主 agent 出对照表 |

**产出**：范围模式、栈列表、建议并行 lane（通常 **6～11** 条，含 L7；有仓外依赖必含 L8；有 API 层必含 L9；有用户输入/鉴权必含 L10；**有服务端必含 L11**；`ha_mode: claimed` 时 L11 含 §18）、`ha_mode`、仓外依赖清单、有无 `.evidence/`、本仓「非问题」补充（**勿**把 stub+flag 列入非问题）。

### Phase 1 · 并行扫描（默认用 Task/subagent）

主 agent **不要**在有多 lane 时独自串行扫整仓。按 lane **同时**起多个 `explore`（readonly）subagent，每条 lane 只领一类 finding + 明确根路径/扩展名。

| Lane | 查什么 | 典型指派 |
|------|--------|----------|
| L1 假绿 / stub | 任意非测试 stub/mock/占位（含 env/flag）、假成功、NotImplemented 挂菜单；**有 ast-grep 则先规则包/形状扫描，再 rg 补漏** | 后端 + BFF + 前端 |
| L2 硬编码 | 密钥默认值、内网 IP、假 KPI、**进程门禁是否调用** | 配置 + 启动入口 |
| L3 可靠性·多库·日志 | MQ/队列默认、吞错、无 health、租户/隔离、未接线 Driver；**多 DB 引擎与 SQL 方言**；**请求/进程/任务日志分类** | 服务端核心 + migrations/DAO |
| L4 表单 UX | path/JSON/YAML 主路径；**必填 `*`、字段错误提示、对齐**；**复杂表单分区/手风琴/标签**；**CRUD 抽屉/模态/独立页承载** | **前端**（有则必开） |
| L5 风格·文案·布局 | 页头/壳/空态不一致；**用户向文案**；**嵌套边框间距/双描边** | 前端；对照本仓标杆 |
| L6 可选 | IaC/CI 把 dev 逃逸打进 prod | deploy/ci；无 IaC/CI 则跳过并注明 |
| L7 产品表面 | API/能力 vs 宣称端入口对账；有入口的骨架/假数据/残交互；**有 codegraph 则 callers 辅助** | 后端路由清单 × 各端路由/菜单 |
| **L8 隐式假通** | 仓外 SDK/HTTP 无 smoke、无超时/退避/幂等、吞错、契约参数硬编码 | 适配器/client × `.evidence/`；有仓外依赖则**必开** |
| **L9 API 信封与错误面** | 非标准响应体、原始异常/SQL/堆栈上屏、HTTP 200 包业务错误无统一码 | handler/BFF/中间件 + OpenAPI |
| **L10 安全与参数隐患** | 注入、未校验参数、越权/IDOR、敏感信息入日志、CSRF/CORS 明显误配、批量赋值 | handler + DAO + 鉴权中间件 |
| **L11 性能热点 · HA** | **§17** 热路径无分页/N+1/无界 fan-out/锁内 I/O/无界队列；**`ha_mode: claimed` 时必加 §18**（假 HA、双主、每副本全量扫、连接池×副本） | 服务端 handler/DAO/worker + 编排；纯前端无 BFF 可跳过并注明 |

**并行降级**（仍须按 lane 勾选进度清单，禁止「只用 Go 搜法交差」）：

- 无 Task/subagent，或仓极小（约少于 30 源文件且单包）→ 主 agent 可按 lane **顺序**自扫，报告「扫描方式」写明 `主 agent 串行 lane`。
- 某 lane subagent **失败/超时**，按序处理：① 重试 1 次 → ② 缩小范围补扫（关键目录 + 入口文件 + 该 lane 核心关键词）→ ③ 仍不足则**如实降级**：记 **Blind spot**（写清未覆盖路径 + 原因 + 已做到哪一步），该 lane **禁止**记为「无发现」，并按「硬规则 10」阻断 `DONE`。其余 lane 照常汇总。
- **无 ast-grep** 时 L1 **禁止**因「rg 零命中」写「无假绿」——须保留 Phase 0.5 的结构性 Blind spot，或人工抽读关键入口后再消解。

**Subagent 提示**：必须用 [stack-detection.md](references/stack-detection.md) 中的提示词模板；含项目根、范围模式、栈 Card、lane ID、搜法、排除测试、回传格式；**写明本仓 `scan_tools` 与 CLI 用法**（有 ast-grep/codegraph 则命令行，禁止写「调用 MCP」）。**每条 lane 提示词必须包含密度下限段**：

```text
【密度下限（硬约束）】
- 本 lane finding ≥ 5 条候选；不足 5 条时**必须**在回传末尾追加 EXHAUSTED 段：
  - 实际跑过的搜索关键词清单（rg pattern / ast-grep pattern / 路径 glob）
  - 跑过几次（每条关键词跑了多少次）
  - 主观信心：high | medium | low
- 禁止「找到几条就返回」；禁止把不同类别的问题相互顶替凑数
- 无 EXHAUSTED 段且 finding < 5 → 视为未完成，进 Blind spot
```

多仓或 monorepo 多 app：**按仓/app 再拆一层**，同 lane 可并行。

### Phase 2 · 汇总报告

1. 收集各 lane 结果 + Blind spots  
2. **合并去重**（见下）→ 分配稳定 ID  
3. 套 [report-template.md](references/report-template.md)  
4. **门闩**：默认 → **停等确认**；`mode: go-fast-unattended-fix` → **不等人**，进入 Phase 3（见下节）；`mode: loop-lane` → **不等人、不修**，报告后结束

#### 合并去重协议

> **设计取舍**：合并是为了消除「同一处代码被多 lane 重复列出」的噪音；但**为合并而合并会吞掉证据**，导致扫出来少。规则收紧到「**同文件 + 同根因一句话**完全重叠才合并」；跨 lane 命中同一现象但证据角度不同 → **保留为主 finding + 交叉引用**，不再吞成一条。

| 规则 | 做法 |
|------|------|
| 去重键（**唯一可合并条件**）| `主证据路径（文件 + 行号区间）` + `同一根因一句话` **两者完全相同** → 可合并；缺一项不可合并 |
| 级别冲突 | 同一路径/根因不同 lane 给出不同级别 → **取更严**（P0 优先于 P1 优先于 P2） |
| L1 ∩ L7 | 同一 stub 既假绿又挂入口：**默认保留为一条 P0**（两证据角度完全同根因），类别写 `假绿·stub / 产品表面`，证据两边都留 |
| L1 ∩ L2 ∩ L8 | 假 KPI / 固定成功**既是硬编码又是假绿又是假通** → 三证据角度不同：**保留主 finding 为假绿 P0**，**另两条降为交叉引用**（`xref: L2-finding-id / L8-finding-id`，不另开编号但保留 lane 证据） |
| L3 ∩ L11 | 同一「memory broker / 本地盘队列 / 多实例会话」根因：HA 与性能两侧**证据角度不同** → **保留为一条**（根因相同），类别写 `HA·可靠性`（若 `ha_mode: claimed`）或 `可靠性`；保留 HA 与性能两侧证据 |
| L11 ∩ L8 | 重试风暴既是假通失败语义也是 HA 性能：**保留为一条**（根因相同），类别写 `隐式假通 / HA·性能` |
| **跨 lane 表述不同** | **不再自动并入**。两条 finding 各保留独立编号；在主 finding 加 `xref: <其它 finding-id>`，便于修复时一并处理 |
| 稳定 ID | 按最终列表编号 `P0-1…` `P1-1…`；报告内一经发出，确认修复时**勿重排**已确认 ID（追加新发现用新号） |
| 交叉引用字段 | `xref: [<finding-id>, …]`：列出与本 finding 同根因或同代码热点但保留独立编号的其它 finding；修复批次据此**合并任务**（同 xref 链尽量进同一 subagent） |

**反例（禁止）**：
- L1 报了某 stub 假绿、L7 报了同 stub 挂菜单 → **不可**只留 L1 一条；L7 的入口证据必须保留（要么并入 L1 证据、要么独立编号 + xref）
- L4 报表单裸 path、L10 报同表单未校验 → **不可**任吞一条；保留两条 + 互填 xref，修复批次合并

合并后执行穷尽盘点「二次 sweep」门槛（见上）。

### Phase 2.5 · 读证据（假绿的直接实证）

仓内有 `.evidence/` 时（[证据层](../go-fast/references/evidence.md)）**必须**读——它是唯一能实证「声称 vs 事实」的输入，比通读代码便宜。`gate-check` 的 FAIL **本身就是 finding**（走同一去重与稳定 ID 流程），不是背景信息。

```bash
GATE=~/.agents/skills/_bin/gate-check
$GATE batch --json                 # 本批总判定；FAIL 的 reasons 逐条转 finding
$GATE slice --slice <id> --json    # 存疑片；$GATE smoke --slug <slug>  # 声称已对接的依赖
```

| 观察 | finding | 级别 |
|------|---------|------|
| 某片被宣称完成，`gate slice`/`batch` FAIL | 声称与证据矛盾 | P0 |
| 声称已对接的外部依赖无 `--phase smoke` 工件，或 smoke 打 localhost/mock server | 隐式假通（§8） | P0 |
| 同片用例数较前轮下降（`case-count` FAIL） | 缩小验证范围换绿 | P0 |
| 有测试基建却缺红绿工件，且未登记 `evidence.degraded[]` | 未走红绿却宣称已验证 | P1 |

无 `.evidence/` → 本节跳过，报告「扫描方式」写 `无证据层`，并记为 Blind spot（本批无证据可读）；**不得**据此认定干净。

### Phase 3 · 批量修

见 [batch-fix-workflow.md](references/batch-fix-workflow.md)。修完的回归**一律**走 `evidence-run --phase cr`（见 batch-fix-workflow「回归最小集」）。

调度硬规则：**前置串行（公共面）→ 隔离并发（文件集合无交集 + 分发前冲突预检）→ 后置串行校验**；任务绑定报告稳定 finding ID；同表 DDL / 根依赖 / 共享模型禁止进并发队列。

### mode=`auto-fix`（**默认** · 单独调用本 Skill）

**默认 mode**。扫完 → 报告落盘 → 停等用户确认 → 确认后调 [go-fast](../go-fast/SKILL.md) 批量修。

| 项 | 规则 |
|----|------|
| 触发 | 单独调用本 Skill 且未明示其它 mode |
| 范围 | 默认 **整仓**（除非用户明示 PR/变更面） |
| `fix_mode` | `confirm-batch`（默认）/ `auto`（用户指定 `P0` 或 `P0+P1` 时） |
| 报告后动作 | **落盘报告 + 给出 finding 总览** → **停问**：「确认修全量(P0+P1+P2)？或指定 P0 / P0+P1？」 |
| 用户确认全量 | → **调 go-fast**（路径见 batch-fix-workflow「调用 go-fast 路径」），`cr_fix_scope: all`，**attended** 模式 |
| 用户指定 P0 或 P0+P1 | → **跳过确认直接调 go-fast**，`cr_fix_scope: P0` 或 `P0+P1`，**unattended** 模式 |
| **绝不自动修 P2** | 即使用户指定 `all`，P2 也须先经确认才进修复队列；`all` 视同「确认全量含 P2」 |
| 不可自动修（须进 `remaining`）| 外部契约不明（integration-research / 优先撤入口）；需产品裁定；Blind spot 不足以安全改；**任何 P0 涉及外部协议 / DB schema / 安全密钥的删除/回滚动作** |
| Blind spot | 有未消解盲区 → 照修已发现项，但 `status` 降级，盲区进 `coverage.blind_spots`；**禁止**判 `no_fixable_items` |
| 回传 | 必填 `mode: auto-fix`、`fix_mode`、`auto_fixed`、`remaining`、`coverage` |

### mode=`go-fast-unattended-fix`（go-fast 无人值守收尾）

由 [go-fast](../go-fast/SKILL.md) 在合回 `base_branch` 且全量绿后调用。与默认差异：

| 项 | 规则 |
|----|------|
| 触发 | 仅调用方明示本 mode（通常 go-fast `attendance=unattended`） |
| 范围 | 默认 **PR/变更面**（本批相对 `base_branch` 的 diff 主根 + 上追一层）；非整仓除非用户/调用方明示 |
| `fix_mode` | `auto` |
| 自动修范围 | 调用方 `cr_fix_scope`：无 orchestrator / **loop-polishing** → 默认 **可修 P0+P1+P2**；**prd/product** → 默认 **仅 P0+P1**（除非显式 `all`） |
| 流程 | Phase 0–2 → 落盘报告 → **立即** Phase 3 batch-fix（视同已确认「全部可修 finding」）→ 相关测 + 全量 |
| 不可自动修 | 外部契约不明（integration-research / 优先撤入口）；需产品裁定；Blind spot 不足以安全改 → 写入 `remaining`/`blockers`，**禁止**瞎真接 |
| 覆盖不全 | 有未消解 Blind spot → **禁止**判 `no_fixable_items`、**禁止** `status: DONE`；盲区原样进 `remaining`（分级见「回传格式」） |
| 停问 | **不**停等用户确认 |
| 回传 | 必填 `fix_mode: auto`、`auto_fixed`、`remaining`、`coverage` |

单独调用本 Skill 时默认 `mode: auto-fix`；go-fast `attended` 模式下若想走 auto-fix 全量修，用户须明示。

### mode=`loop-lane`（loop-polishing 焦点 lane · 只评不修）

由 [loop-polishing](../loop-polishing/SKILL.md) 调用。与默认 / `go-fast-unattended-fix` 差异：

| 项 | 规则 |
|----|------|
| 触发 | 调用方明示 `mode: loop-lane` |
| 范围 | 编排方 `scope`（模块/变更面）；非整仓除非明示 |
| `fix_mode` | `none`（**禁止** Phase 3 batch-fix） |
| 流程 | Phase 0–2.5 → 落盘报告 → **立即结束**；不停等、不修 |
| 回传 | `mode: loop-lane`；`fix_mode: none`；`auto_fixed: []`；`status` 仍按覆盖度定（有未消解盲区**禁止** `DONE`） |

修复由编排方交 [go-fast](../go-fast/SKILL.md)。**不要**与 `go-fast-unattended-fix` 混淆（后者是 go-fast 收尾自动修）。

---

## 扫描进度清单

```
- [ ] 0. 识栈 → Stack Card + 范围模式 + lane 划分 + **ha_mode**
- [ ] 0.5 扫描工具探测（ast-grep / codegraph / rg-only；只探测不装）→ 写入 Stack Card `scan_tools`
- [ ] 1. 并行（或降级串行）lane：L1–L5、L7–L11（+可选 L6）；见 Stack Card 跳过说明；`ha_mode: claimed` 时 L11 含 §18
- [ ] 1a. **每 lane finding ≥ 5 或 EXHAUSTED 段**（无 EXHAUSTED 段且 finding<5 → 视为未完成 → Blind spot）
- [ ] 1b. 失败 lane 已重试 → 缩范围补扫 → 仍不足则标 Blind spot（不得记「无发现」）
- [ ] 1c. 读 `.evidence/` + `gate-check`（无证据层则写明并记 Blind spot）
- [ ] 2. 合并去重（**仅同文件+同根因才合并**；跨 lane 表述不同 → 保留独立 ID + xref 交叉引用）+ 稳定 ID；应用「非问题」过滤（**勿**把带开关的 stub 当非问题）
- [ ] 3. 标准报告（含 Blind spots / 跳过 lane）；有未消解盲区 → 结论与 `status` 双双降级
- [ ] 4. 建议修复批次；**mode=auto-fix（默认）**：停问「确认全量 or 指定 P0/P0+P1」→ go-fast；**用户指定 P0/P0+P1**：跳确认直接修；**go-fast-unattended-fix**：跳确认按 `cr_fix_scope`
- [ ] 5. （确认后或 auto）调 go-fast：前置串行 → 冲突预检 → 隔离并发修 → 后置校验 + 回归（evidence-run --phase cr）
```

通用搜法种子（**必须按栈改写**；完整表见 stack-detection；**一律排除测试双**）。**L1 顺序强制**：有 ast-grep → 先结构性扫描，再用下方 rg **补漏**；无 ast-grep → 只用 rg，并保留 Phase 0.5 Blind spot。

```bash
# —— L1 优先（有工具时）——
# 规则包（exit 1 = 有 error 级命中，属正常；用 --json 判内容，勿 set -e 当失败）
ast-grep scan --json=compact
# 临时形状（示例；按栈改 language / pattern，见 code-scanning/references/ast-grep-rules.md）
# ast-grep run -p 'panic("not implemented")' -l go
# ast-grep run -p 'throw new Error("TODO")' -l ts

# —— L1 补漏 / 无 ast-grep 时的词法种子 ——
rg -n -i 'stub|FORCE_STUB|TODO:\s*implement|NotImplemented|not implemented|coming soon|mockData|fakeSuccess|placeholder|isDemo|useMock' \
  --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/vendor/**' \
  --glob '!**/*_test.*' --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/__mocks__/**'

# L7 可达性辅助（有新鲜图时；「没找到」须 rg 复核）
# codegraph callers <HandlerFunc>

# L8 隐式假通：先列仓外调用点（命中后逐个对账 smoke 工件 / 超时 / 退避 / 幂等；完整清单见 catalog §8）
rg -n -i 'https?://[a-z0-9.-]+|fetch\(|axios\.|requests\.(get|post)|http\.(Get|Post|NewRequest)|HttpClient|new [A-Z][A-Za-z]*Client\(' \
  --glob '!**/node_modules/**' --glob '!**/vendor/**' --glob '!**/*_test.*' --glob '!**/*.spec.*'
ls contracts/ 2>/dev/null; rg -l '"phase":\s*"smoke"' .evidence/ 2>/dev/null   # 有调用无工件 → finding

# L9 API 信封：对照本仓 OpenAPI/中间件/现有标杆 handler
rg -n -i 'stacktrace|traceback|SQLException|pq:|mysql\.|errno|internal server error|err\.Error\(\)|str\(e\)|detail.*exception' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**' --glob '!**/vendor/**'
rg -n -i 'res\.(json|send)\([^)]*err|ctx\.JSON\(.*err|return.*exception|writeError' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**'

# L10 安全：注入 / 未校验 / 越权（按栈深入读，rg 仅种子）
rg -n -i 'fmt\.Sprintf\(.*SELECT|String\.format\(.*SELECT|\+.*WHERE|raw\(|execute\(.*%|Query\(.*\+|eval\(|innerHTML\s*=' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**'
rg -n -i 'BindJSON|ShouldBind|@RequestBody|req\.body|z\.object\(|validate\(|class Validator' \
  --glob '!**/*_test.*'   # 有入参处向上追是否真校验

# L11 性能热点（§17；有服务端必开；禁止无锚点臆测）
rg -n -i 'FindAll|findAll|pageSize|PageSize|LIMIT\s*$|Take\(0\)|noLimit|select \*|\.all\(\)|loadAll|for .+ (Get|Find|query|fetch)\(' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**' --glob '!**/vendor/**'
rg -n -i 'Mutex|sync\.Mutex|flock|SETNX|distributed.?lock|MaxOpenConns|pool.?size|errgroup|WaitGroup' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**'
# L11 HA（仅 ha_mode:claimed；§18）
rg -n -i 'replicas:|ha\.|高可用|多实例|leader.?elect|lease|fencing|sticky|session|raft|cluster.?mode' \
  --glob '!**/node_modules/**' --glob '!**/*_test.*'
# 对照 docs/arch.md / charts/*/values*.yaml / docker-compose*

# L4/L5 表单与文案（前端）
rg -n -i 'ci_id|_id|PRD-|ADR-|甲方|乙方|我方|贵方|stub|worktree|EmptyState|required.*false|rules=\{\}' \
  --glob '*.{tsx,vue,jsx}' --glob '!**/*_test.*' --glob '!**/*.spec.*'
rg -n 'border|outline|ring-' --glob '*.{tsx,vue,css,scss}' | head -40   # 抽样读嵌套 Card/Panel 间距

# 硬编码密钥/内网（L2）
rg -n -i 'password\s*=\s*['\''"]|secret|api[_-]?key|192\.168\.|CHANGE_ME|dev-only' \
  --glob '!**/node_modules/**' --glob '!**/*_test.*' --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/__mocks__/**'

# L3 多库 / 日志
rg -n -i 'Driver:|dialect:|sqlite|postgres|mysql|tidb|dm8|kingbase|gorm\.Open|sqlx\.Open|create_engine' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**'
rg -n -i 'LIMIT\s+\?|OFFSET\s+\?|::uuid|IFNULL\(|NVL\(|GETDATE\(\)|NOW\(\)' \
  --glob '!**/*_test.*'   # 多库仓内对照 dialect 分支是否齐全
rg -n -i 'request_id|trace_id|correlation|access.?log|job.?log|audit.?log|logger\.(info|error)' \
  --glob '!**/*_test.*' --glob '!**/node_modules/**'
```

## 标准报告（必须）

含 **Stack Card** + P0→P2 findings + 非问题已排除 + 待确认批次（`auto` 时改为「自动修批次」）。模板见 report-template。

## 批量修复门闩

报告已交 → 确认（**confirm** 由用户点批次；**auto** 视同确认全部可修且落在 `cr_fix_scope` 内的 finding）→ 才动手，且必须按 [batch-fix-workflow](references/batch-fix-workflow.md) 的三阶段调度。门闩细则见该文件「门闩」，此处不重复。

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: code-reviewer
mode: auto-fix | go-fast-unattended-fix | loop-lane | review
fix_mode: confirm-batch | auto | none       # auto-fix 默认 confirm-batch；用户指定 P0/P0+P1 → auto
cr_fix_scope: all | P0+P1 | P0               # auto-fix 下：用户确认全量=all；指定级别时收窄
scope: full_repo | change_surface
report: ""                  # 落盘路径
auto_fixed: []              # auto 时已修 finding ID；confirm-batch/loop-lane 未修前 []
remaining: []               # 契约不明 / 需裁定 / 盲区未修
coverage:
  blind_spots: []           # 未消解盲区：`lane | 未覆盖路径 | 原因`；非空 → status 禁止 DONE
  evidence_read: true|false # 是否读过 .evidence/；false 须在 blind_spots 写明原因
external_deps: []           # L8 对账结果，与 go-fast 同名段对齐：{name, smoke: 路径|none, finding: ID|""}
evidence:
  cr: ""                    # 自动修后回归的 --phase cr 工件路径（未修则空）
  gate_findings: []         # 由 gate-check FAIL 直接生成的 finding ID
blockers:
  - ""
# 每条 finding 在报告里附 `xref: [<finding-id>, …]`，列出同根因/同代码热点但保留独立编号的其它 finding
```

**`status` 与覆盖度的绑定**（硬规则 10 的落地）：全 lane 已扫（含写明理由的合理跳过）且无未消解盲区 → 可 `DONE`；盲区仅在边缘面（无 UI 仓的 L5、无 IaC 的 L6…）→ 最多 `DONE_WITH_CONCERNS` 且盲区原样进 `remaining`；盲区覆盖**生产主路径 / 外部集成 / 变更面核心目录** → `BLOCKED`，此时「没发现 P0」不成立。

## 禁止

- 有多 lane 且可用 subagent 时仍整仓单线程死扫（极小仓/无 Task 的降级除外，且须按 lane 勾选）
- 把默认管理员种子写成安全漏洞标题
- 把「有 env/flag 的 stub」写成非问题或设计如此
- **confirm-batch 模式（auto-fix 默认）未确认就调 go-fast 修代码**；例外：用户指定 `P0` 或 `P0+P1` → 跳确认直接修（仍禁止自动修 P2）；`go-fast-unattended-fix` / `fix_mode: auto` 不受此限
- **`loop-lane` 下停等确认或进入 Phase 3 改代码**
- `fix_mode: auto` 下对契约不明 finding 瞎「真接」而不撤入口 / 不记 `remaining`
- **`fix_mode: auto` 下自动修任何 P2**（用户显式 `all` 含 P2 时除外）
- 为「统一风格」引入本仓没有的新 UI 库
- 把边界 fake（外部 HTTP/SDK/时钟）或纯 Storybook demo 计入生产假绿；反之，把**mock 掉被测对象**的空壳用例当测试双放过
- 只扫后端 stub、不对账「能力 vs 宣称端入口 / 有入口的半成品」
- **扫描覆盖不全（lane 失败 / 未读 `.evidence/` / 范围被截断）却宣称本批干净、写「可上线」、判 `no_fixable_items` 或回传 `DONE`**
- **抽样汇报**：只交 Top N / 代表样例 / 「等多处」省略证据；`listed < hits`；未做二次 sweep 却在大 scope 交极少 P0+P1
- **有仓外调用却无真实端点 smoke 工件时，把该集成当「已对接」不报**；把 localhost/mock server 的 smoke 当有效证据
- 把 `gate-check` FAIL 当背景信息不写进 findings；因 gate FAIL 就删工件重跑

## 集成研究 followup（条件触发）

报告末尾**不要**无条件广告外部研究技能。仅当 finding 同时像「外部集成」且「契约/真接路径不明」时，在报告加一小节 **集成研究建议**：

| 命中信号（示例） | 动作 |
|------------------|------|
| stub/假绿位于 OAuth/OIDC/LDAP/SMTP/短信/对象存储/云或 HCI 适配器 | 提示先跑 [integration-research](../integration-research/SKILL.md)，确认简报前勿盲目「真接」batch-fix |
| 宣称已对接某厂商/协议，但无真实外部调用或仅有假成功 | 同上；或本批次直接**撤入口**，研究完成后再开实现 |
| L8 隐式假通：契约参数无出处、smoke 跑不通、失败语义不明 | 同上；smoke 能补则补 smoke，不能则撤宣称 |
| 普通业务 stub（自有 DB/API、无仓外依赖） | **不**提示 integration-research；按真接或撤入口修 |

格式：一行一条 `finding ID（一句话）→ integration-research；本批可选：撤入口`。

## 关联

- [stack-detection.md](references/stack-detection.md) · [finding-catalog.md](references/finding-catalog.md)
- [severity-rubric.md](references/severity-rubric.md) · [report-template.md](references/report-template.md)
- [batch-fix-workflow.md](references/batch-fix-workflow.md) · [examples.md](references/examples.md)
- [证据层 evidence.md](../go-fast/references/evidence.md)（Phase 2.5 读 `.evidence/`；自动修回归走 `--phase cr`）
- 姊妹 skill：[go-fast](../go-fast/SKILL.md)（unattended 收尾 `go-fast-unattended-fix`）· [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md)（**页级**视觉·CRUD·空态·菜谱·遮罩深扫；本 Skill L4/L5 为变更面/PR 轻量版，二者可串联）· [browser-reviewer](../browser-reviewer/SKILL.md)（`.dev` 真机截图走查 + Console）· [integration-research](../integration-research/SKILL.md)（外部协议/厂商对接研究简报；仅上表条件触发）· [loop-polishing](../loop-polishing/SKILL.md)（`mode: loop-lane`）· [create-evolution-arch](../create-evolution-arch/SKILL.md)（H3 高可用写入 arch；本 Skill L11/§18 消费宣称）
- 若仓内有 page-craft / design-system skill → 风格 lane 叠加使用；深扫可改用 ui-ux-reviewer
- **L11 不做**：真实压测、火焰图、容量数字背书；那些属专门性能工程，本 Skill 只报可定位的静态放大与假 HA
