# Finding Catalog（共性问题反模式）

技术栈无关。每节：**症状 → 为何致命 → 锚点（例）→ 修法**。  
搜法分诊见主 SKILL「扫描工具分诊」与 [code-scanning](../../code-scanning/SKILL.md)；词法 `rg` 模式按 [stack-detection.md](stack-detection.md) 改写后交给 subagent。表中 Go/运维平台例子仅为示意。

---

## §1 假绿 / Stub 零容忍 — 优先 P0

**政策**：非测试代码里**不允许**保留 stub/mock/假成功路径。`FORCE_STUB`、feature flag、`profile=dev`、Badge、诚实 `degraded` **一律不能**当「设计如此」放过——修法是删 stub 并接真实现，或撤入口与宣称。

**搜法**：结构性形状优先 [code-scanning](../../code-scanning/SKILL.md)（有 `ast-grep` → 规则包/临时 pattern，降注释与字符串误报）；词法 `rg` 作补漏。无 ast-grep 时不得把「rg 零命中」写成「无假绿」而不留 Blind spot。具体 `rg` 模式按 [stack-detection.md](stack-detection.md) 改写后交给 subagent。

| 反模式 | 为何致命 | 锚点（例） | 修法 |
|--------|----------|------------|------|
| 任意可激活 stub（含 env/flag 才开启） | 一开开关就假绿；评审以为「有门闩就安全」 | `FORCE_STUB`、`USE_MOCK`、`if stub { return ok }` | **删除** stub 分支；只留真实集成；本地用测试双或外部 sandbox，不进主路径 |
| 探测/集成 stub 返回成功态（connected/ok/healthy） | 运维以为外部系统已通 | probe 固定 true、假 health | 接真实探测；失败就失败，禁止占位成功 |
| Dry-run / stub 评估固定「命中」或假指标 | 规则/模型看似有效 | stub evaluator、mock samples | 无后端则拒绝请求；禁止固定命中 |
| 不足条件时塞 Mock 数据当正式结果 | 排障看假数据 | mock federation、fixture 当 API | empty + 引导配置；禁止当正式 payload |
| 后端/BFF stub，UI 无论有无 Badge | 「功能完成」假象 | mock provider、占位 handler | 删 stub；未就绪则撤路由/菜单 |
| 未实现却挂菜单/路由 | 点进去才挂或空白 | `NotImplemented`、501、空页 | 隐藏入口；文档勿写已交付 |

### §1.1 测试豁免的边界（豁免测试双，不豁免假绿背书）

**豁免（不报）**：`*_test.*` / `*.spec.*` / `__mocks__` / fixture 里的**边界 fake**——外部 HTTP/SDK/云厂商 client、时钟/随机数/UUID、DB/队列容器替身、鉴权旁路；以及**仅** Storybook/设计系统 demo 且未被产品路由挂上的 mock。判据是：**被测逻辑仍被真实执行**。

**不豁免（报 P1，类别写 `假绿·测试`）**：mock 的对象就是**被测对象本身**，该用例实际什么都没验证——它让「测试通过」变成假绿的背书。四种形态：

- 把被测 service/handler 整体 mock 后断言其返回值（mock 的符号与被测符号同名；断言值就是 stub 里写死的值）
- 恒真 / 空断言：`expect(true)`、`assert True`、只 `assert.NoError(nil)`、用例内无断言
- 快照 / 黄金文件与 fixture 逐字相同，无真实计算
- 整模块 patch 只剩壳：`jest.mock('<被测模块>')`、`patch('app.<被测模块>')` 覆盖被测本身

```bash
rg -n 'jest\.mock\(|vi\.mock\(|mock\.patch\(|monkeypatch\.setattr|gomock\.|expect\(true\)|assert\s+True\b|assertTrue\(true' \
  --glob '**/*test*' --glob '**/*spec*'
```

一句话区分线：**mock 的是「被测对象」→ 报；mock 的是「被测对象的外部依赖」→ 不报。** 误伤成本高于漏报，拿不准时降为 P2 并写清疑点。

---

## §2 硬编码 — 优先 P0/P1

| 反模式 | 级别 | 说明 | 修法 |
|--------|------|------|------|
| 生产可启动且使用仓库已知默认密钥/token，门禁缺失或未调用 | P0 | 密钥可预测 | 启动校验拒绝 dev 默认；prod 模板 CHANGE_ME |
| Live/生产路径写死内网 IP、默认 community/口令 | P1 | 打错目标或误报 | 必填配置，无危险默认 |
| KPI/图表硬编码演示数字 | P0 | 仪表假绿 | 无 API 不展示；或「示例」且默认关 |
| 默认指向 `/tmp/stub-*`、仓库 fixture、echo 成功脚本 | P1 | 空跑却绿 | 无有效资源则失败；UI 选择器 |
| 版本号写死 `*-dev` / `0.0.0` | P2 | 无法对版本；对外已发正式包仍如此可升 P1 | 构建注入版本元数据 |

**勿升 P0**：仅本地默认配置 + 有 prod 模板 + **进程门禁已接线** → 不报或 P2「勿拷贝 dev yaml」。  
**升 P0**：门禁缺失或 Validate 已写未调用（见 §6）。  
**勿报**：首次 seed 超管；测试双 / 纯 Storybook demo mock（见 SKILL「非问题」）。

---

## §3 可靠性 & 真实缺口 — 优先 P0/P1

| 反模式 | 级别 | 说明 | 修法 |
|--------|------|------|------|
| 进程内队列/memory broker、all-in-one 角色被安装文档当生产推荐 | P1–P0 | 扩不了、关停丢任务 | 生产门禁拒绝；文档改真实拓扑 |
| 清理/retention 默认 dry-run 且无告警 | P1 | 存储无限涨 | prod 关 dry-run；日志+指标 |
| 吞错（空 catch / Ignore / continue）且无指标 | P1 | 审计/出站静默丢 | metrics + 可查询失败 |
| 配置宣称某 Driver/引擎，启动未接线 | P0 | 架构承诺落空 | 接线或文档降级 |
| 无公开 liveness/readiness | P1 | 无法探活 | 与鉴权诊断分离的 `/health` 类探针 |
| 多租户/组织隔离查询漏边界条件 | P0 | 串数据 | 全路径带租户/org；补测 |
| 会话/缓存「规划中」却按多实例部署 | P1 | 状态不一致 | 限制单实例或落地共享存储；**宣称 HA 时升 P0 见 [§18](#§18-ha-可靠性与-ha-下性能--l11条件必开)** |

---

## §4 坏表单 UX（路径 / JSON / YAML）— 至少 P1

用户不应充当「配置文件编辑器」（Web / Desktop / 管理后台皆适用）。

| 反模式 | 例子 | 修法 |
|--------|------|------|
| 文本框填 **文件系统路径** | 脚本/playbook/证书路径、fixture | 资源选择器、上传、目录 API；自由路径仅高级折叠 |
| 大 Textarea / Monaco **贴 YAML/JSON** 作主配置 | 流水线、策略、IaC 片段、权限 JSON | 结构化表单或可视化；YAML 仅高级/导入导出 |
| 默认 `echo`/noop/示例配置一跑就成功 | 内置模板、fallback 配置 | 向导或真实脚手架；禁止无提示的假成功默认 |
| 仅服务端/引擎报错 | 提交后才 JSON/YAML 解析失败 | 客户端 schema + 行级错误 |

**验收**：主路径可不打开「高级 YAML/JSON」完成任务；路径字段对普通角色不可见或只读。  
**扩展**（必填标记、字段错误、复杂表单结构、CRUD 承载）→ [§13](finding-catalog.md#§13-表单校验复杂表单结构与-crud-承载--l4--p1)。

**无 UI 的仓**：本 lane 标跳过；若 CLI 强制手写大段 YAML 且无 `init`/向导，可记 P2「CLI UX」。

---

## §5 UI 风格不一致 — P1

对照**本仓**设计系统 / page-craft skill / 最完整的 1～2 个标杆页（框架不限：React/Vue/Svelte/原生）。

| 检查项 | 一致 | 不一致（报） |
|--------|------|--------------|
| 页头 | 统一 Header 模式（标题+说明+主操作） | 裸标题 / 操作散落 |
| 筛选与内容分层 | 工具区与主内容分层 | 控件与表糊一层 |
| 异步 | 统一 loading / empty / error | 半页空白、空态一行字、原始异常串 |
| 空态 | 说明 + 可行动 CTA | 「暂无数据」 |
| 密度与 Token | 同级页一致 | 混用无关间距/颜色体系 |
| CRUD 承载 | Dialog/抽屉/独立页有约定 | 同域无理由混用；详见 [§13.3](finding-catalog.md#133-crud-承载抽屉--模态--独立页) |

输出：「标杆文件」+「待改页」，供 batch-fix 按页拆 subagent。无 UI → 跳过。

---

## §6 开发便利 vs 生产危险

判定口径见 SKILL「门禁分流」与 [severity-rubric](severity-rubric.md)（stub 有开关也 P0、seed 超管勿报、Validate 已写未调用 = P0、CI/Helm 未拦但进程门禁已接线 = P1）。本节只补一条：

| 机制 | 判定 |
|------|------|
| `deploy_dev` / `compose.dev` 弱密钥 | 开发可接受；**被当准生产**且无轮换 → P0/P1 |

---

## §7 产品表面缺口（能力 vs 入口 vs 半成品）— 优先 P0/P1

对账三列：**服务端能力**（API/RPC/任务）× **全端入口**（Web / Desktop / Admin / CLI 若宣称）× **交互完整度**。

**「宣称」**（与 SKILL 一致，命中任一即算）：UI 交付语气文案；README/对外 docs/变更说明列为已交付；OpenAPI/SDK/对照表标 GA/shipped（非 experimental，且无「API only」限定）。

| 反模式 | 级别 | 为何致命 | 锚点（例） | 修法 |
|--------|------|----------|------------|------|
| 服务端已有完整能力，**已宣称**客户端**全端无入口**（无路由/菜单/命令） | P1 | 能力无法触达；交付幻觉在文档/API 层 | OpenAPI/路由清单有 handler，FE `routes`/`menu` 无对应；移动端/管理端同样缺失 | 补齐入口并接真 API；或**改宣称**为「仅 API / 未交付 UI」且对外材料同步 |
| 服务端有能力，**未宣称**且全端无入口 | P2 | 规划缺口，非假交付 | 无 README/UI 承诺 | 跟踪即可；勿当 P1 |
| 仅某一端有入口、其他**已宣称**端缺失 | P1 | 「全端一致」承诺落空 | 文档写 Desktop+Web，仅 Web 有页 | 补端或改宣称范围 |
| 有入口，但页常驻 **Skeleton / Loading**、永远 `loading=true`、或仅占位布局 | P0 | 用户以为功能在加载/已上线 | 无请求的 Skeleton、空 `useEffect`、TODO 注释旁的壳 | 接真实数据流；未就绪则撤入口 |
| 有入口，列表/详情/图表用 **假数据 / mockData / 写死数组** | P0 | 假绿表面 | `const data = [{id:1...}]`、faker 进主路径 | 接 API；无数据走空态+CTA |
| 有入口，**交互不完整**：按钮无 onClick、提交只 toast、CRUD 缺一截、表单不调 API、禁用「即将推出」却仍展示主 CTA | P0/P1 | 半成品当交付 | 空 handler、`console.log`、`alert('todo')`、只读假表单 | 补全主路径交互或隐藏入口 |
| 后端 501/NotImplemented，前端仍展示可点主流程 | P0 | 假绿 | FE 忽略错误码继续成功态 | 撤入口或接真实现 |

**扫法提示**：

1. 从后端列出「非 health/非内部」的业务路由或 use-case（GraphQL / 事件驱动用 query/mutation 或可触发 command 代替 REST 路由）。
2. 用宣称判据圈定「应对用户可见」的子集；再在**各端**搜路由表、菜单、深链、命令注册（宣称移动端则一并对账导航/Screen，勿只扫 Web）。
3. 对已有入口的页面：查是否有真实 fetch/mutation、空态/错误态、主 CTA 是否闭环。
4. 骨架组件若仅用于首屏请求中的短暂 loading → 正常；若无请求或失败后仍骨架 → 报。

---

## §8 隐式假通（外部契约从未真打）— L8 · 优先 P0/P1

**「反 stub」不等于「反假通」**。§1 抓的是**显式**假装（关键词、flag、假成功），改个名（`useMock` → `useProvider`）就能绕过；本节抓**隐式**：用标准 SDK 写出语法正确、endpoint / scope / 签名 / API 版本全错、**从未被真实调用过**的集成代码。类型检查过、单测（mock 掉外部）绿、关键词扫描零命中，直到联调或上线才炸——运行时表现为偶发失败、静默吞错、重复扣款。

| 反模式 | 级别 | 判定要点 | 修法 |
|--------|------|----------|------|
| 有仓外 SDK/HTTP 调用，但无 `contracts/<slug>.smoke.*`、`.evidence/` 无该依赖的 `--phase smoke` 工件 | **P0**（已宣称已对接）/ P1（未宣称） | 先列调用点，再对账工件；`gate-check smoke --slug <slug>` 非 0 等同缺失 | 补真实端点/厂商沙箱 smoke 并跑通；跑不通就撤入口与宣称 |
| smoke 打的是 localhost / 自建 mock server / 录制回放 | **P0** | 工件里的 URL 指向本机或仓内 mock | 打真实或沙箱端点（假通比 stub 更难发现） |
| 外部调用**无超时**、无重试/退避、429/5xx 不区分可重试 | P1（支付/扣费/下单 → **P0**） | client 构造处无 timeout；重试是裸 `for` 无 backoff | 显式超时 + 指数退避 + 次数上限 |
| 写操作会重试但**无幂等键** | **P0** | 重试路径上无 idempotency key / 去重表 / 唯一约束 | 幂等键透传到外部，或改「查询—确认」 |
| 错误被吞：catch 后只 log、返回零值/默认值继续 | **P0**（上游据此认为成功）/ P1（有指标且有 degraded 语义） | catch 块内无 rethrow、无 metric、无降级标记 | 上抛或显式降级，失败必须可观测 |
| endpoint / scope / API 版本 / 签名算法**硬编码且无出处**：既不在配置，也未在 `.dev` `integrations[].credential_env` 登记 | P1 | 字面量 URL / scope 串散落业务代码，无文档来源 | 收敛到配置 + `.dev` 登记，注明契约出处 |
| 凭据（AK/SK、token、私钥）写在代码里 | **P0** | 见下第 5 步 | 移到 env / 密钥库；轮换已泄露值 |

**检测清单（按序；1、2 必做）**

1. **列出仓外调用点**（命中里的 `localhost` / `127.0.0.1` / 仓内服务名手工剔除）：
   ```bash
   rg -n -i 'https?://[a-z0-9.-]+|fetch\(|axios\.|requests\.(get|post|put)|http\.(Get|Post|NewRequest)|HttpClient|OkHttp|reqwest::|new [A-Z][A-Za-z]*Client\(' \
     --glob '!**/node_modules/**' --glob '!**/vendor/**' --glob '!**/*_test.*' --glob '!**/*.spec.*'
   ```
2. **对账 smoke 工件**：`ls contracts/ 2>/dev/null`；`rg -l '"phase":\s*"smoke"' .evidence/ 2>/dev/null`；再 `rg -n 'localhost|127\.0\.0\.1|mockserver|wiremock' contracts/` 查假 smoke。调用点有、工件无 → **每个仓外依赖一条 finding**。
3. **失败语义**（对每个调用点看 client 构造与错误分支；**命中为空 = 没做**，不是「不需要」）：
   ```bash
   rg -n -i 'timeout|deadline|WithTimeout|AbortSignal|retry|backoff|Retry-After|idempot|Idempotency-Key' <适配器目录>
   rg -n -A4 'catch\s*\(|except\s+\w*(Error|Exception)|if err != nil' <适配器目录>   # 只 log 不上抛 → 吞错
   ```
4. **契约参数出处**：`rg -n -i "/v[0-9]+/|scope=|grant_type|X-[A-Za-z-]*Signature|api\.[a-z0-9-]+\.com" <适配器目录>`，逐条回溯配置文件与 `.dev` `integrations[]`；找不到出处即报。
5. **凭据入码**：
   ```bash
   rg -n -i 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|BEGIN [A-Z ]*PRIVATE KEY' \
     --glob '!**/*_test.*' --glob '!**/.evidence/**'
   ```

**不报 / 去重**：仓内服务间调用不算仓外契约；已 `park`、入口已撤且对外未宣称的依赖记 P2 跟踪。同一适配器既有显式 stub 又无 smoke → 合并为**一条 P0**，类别 `假绿·stub / 隐式假通`（见 SKILL「合并去重协议」）。

---

## §9 多数据库引擎与 SQL 可移植性 — L3 · P1（数据面错误可升 P0）

**何时开**：`docs/arch.md` / 配置 / ORM 层出现 **≥2 种 Driver**（如 sqlite+mysql、postgres+达梦/TiDB）、或 `dialect` / `database type` 可切换。

| 反模式 | 级别 | 判定要点 | 修法 |
|--------|------|----------|------|
| 架构宣称多库，SQL/迁移**只按一种方言写死** | P1 | 无 `switch dialect` / 无方言专用 migration；`LIMIT`/`OFFSET`/`::uuid`/`IFNULL`/`NVL`/`GETDATE` 等只出现一种写法 | 抽象方言层；迁移分目录或工具链支持；CI 至少跑 2 种方言测试 |
| 原生 SQL 字符串拼接表名/列名/排序字段 | **P0** | `fmt.Sprintf("SELECT … %s", col)`、`ORDER BY ` + userInput | 白名单列名；参数化占位符 |
| 分页/布尔/日期函数未做方言分支 | P1 | 仅 `LIMIT ? OFFSET ?` 或仅 `ROWNUM`/`TOP` | 按 Driver 分支或 ORM 抽象 |
| 迁移脚本只维护一种库，另一种启动即炸 | P1 | README 写支持 X+Y，只有 `*_mysql.sql` | 补迁移或诚实降级宣称 |
| SQLite 专用语法进「生产默认 MySQL」路径 | P1 | `AUTOINCREMENT`、`datetime('now')` 出现在默认 prod 配置链 | 分支或禁止该组合 |

**扫法**：

```bash
rg -n -i 'Driver:|dialect:|sqlite|postgres|mysql|tidb|dm8|kingbase|gorm\.Open|sqlx\.Open|create_engine|Type:\s*mysql' \
  --glob '!**/*_test.*'
rg -n -i 'LIMIT\s+\d|OFFSET\s+\d|::uuid|IFNULL\(|NVL\(|GETDATE\(\)|datetime\(' migrations/ internal/ dao/ --glob '!**/*_test.*'
```

**不报**：单库专用仓且文档未宣称多库；方言差异已在 ORM 层统一且 migration 有矩阵测试。

---

## §10 日志分类与可观测缺口 — L3 · P1（审计/合规场景可升 P0）

生产须能区分：**请求/access**、**进程/启动与生命周期**、**关键任务/作业/定时任务**、**审计/安全**（谁对谁做了什么）。不是要求「日志越多越好」，而是**关键路径缺类 = 排障与审计黑洞**。

| 反模式 | 级别 | 说明 | 修法 |
|--------|------|------|------|
| HTTP/RPC 入口无请求关联 ID（`request_id`/`trace_id`）贯穿 | P1 | 只有散落 `log.Println` | 中间件注入 correlation id；下游透传 |
| 仅有应用 debug 日志，无 access / 请求摘要 | P1 | 无法按用户/路由复盘 | 结构化 access log（方法、路径、状态、耗时、主体 id） |
| 后台 job/cron/worker **无独立作业日志**（开始/结束/失败/重试） | P1 | 任务静默失败 | job 级 logger + `job_id`/`run_id` |
| 进程启动/配置加载/优雅关停无日志 | P2 | 运维难判版本与配置 | 启动 banner：版本、profile、监听地址（**禁**打密钥） |
| 错误只 `console.log` / `print`，无级别与字段 | P1 | 无法告警聚合 | 结构化 JSON/键值；`error` 带 `code`/`route`/`user_id`（脱敏） |
| **敏感字段入日志**（密码、token、身份证、完整请求体） | **P0** | 合规与泄露 | 脱敏/哈希；禁止 log 明文 secret |

**扫法**：读 `middleware`/`filter`/`interceptor` 与 `worker`/`cron`/`celery`/`job` 包；`rg 'request_id|trace_id|access|audit|job.*log'`。无统一日志库 → 记 Blind spot 并抽读 3 个主 handler。

---

## §11 API 标准信封与错误暴露 — L9 · P0/P1

对照**本仓已有**约定（OpenAPI、`docs/api/`、标杆 handler、前端 `request` 封装）。禁止用别的项目的信封硬套。

| 反模式 | 级别 | 说明 | 修法 |
|--------|------|------|------|
| 直接 `return err.Error()` / `str(e)` / 堆栈 JSON 给客户端 | **P0** | SQL、路径、内部服务名泄露 | 统一错误码 + 用户向 `message`；细节仅 server log |
| 同一资源不同接口响应形状不一致（有的裸对象、有的包 `data`） | P1 | 前端与 SDK 难维护 | 对齐标杆 handler 信封 |
| HTTP 200 但 body 里是失败，且无统一 `code`/`success` 字段 | P1 | 调用方误判成功 | 业务错误用约定字段；或 HTTP 4xx/5xx + 信封 |
| 原始厂商/数据库错误码直传前端 | P1 | 不可读 + 信息泄露 | 映射为本域错误码 |
| GraphQL/gRPC 无 errors 扩展规范、BFF 把 upstream 原文转发 | P1 | 同上 | BFF 做错误翻译层 |

**验收**：抽 3 个标杆 API + 本次变更涉及的全部 handler，对照 OpenAPI/类型定义；失败路径必须有人话 `message`，原始异常仅日志。

---

## §12 用户向文案（人话）— L5 · P1

与 loop 环 **craft §8**、ui-ux-reviewer「状态人话」同尺。扫**用户可见**字符串：EmptyState、Alert、页头 description、按钮、表单 label/placeholder、toast、表格空态。

| 反模式 | 例子 | 修法 |
|--------|------|------|
| 字段名/查询参数当主文案 | 「请指定 ci_id」「缺少 user_id」 | 业务人话：「请选择配置项」「缺少用户信息」 |
| 研发/运维黑话上屏 | ADR、stub、worktree、gate、mock、500 Internal | 用户向说明 + 可选「联系管理员」 |
| 合同/招投标口吻 | 甲方、乙方、我方、贵方 | 中性产品语气 |
| PRD/ADR/内部编号上屏 | 「PRD-F12 未配置」「见 ADR-003」 | 删编号；写用户能懂的原因与下一步 |
| 保留内部函数/类名 | `UserService.create failed` | 泛化错误文案 |
| 中英文混杂无必要 | 状态列裸 `PENDING_APPROVAL` | 映射为「待审批」 |

```bash
rg -n -i 'ci_id|_id|PRD-|ADR-|甲方|乙方|我方|贵方|stub|worktree|Internal Server|NullPointer' \
  --glob '*.{tsx,vue,jsx,go,py}' --glob '!**/*_test.*' --glob '!**/locales/**'
```

**不报**：`locales/` 里开发者注释；仅日志里的技术字段；API 文档示例中的字段名（非 UI）。

---

## §13 表单校验、复杂表单结构与 CRUD 承载 — L4 · P1

在 §4「禁裸协议」之上，扫**主路径表单**与**对标标杆页**的承载方式。

### 13.1 校验与对齐

| 反模式 | 说明 | 修法 |
|--------|------|------|
| 必填项无 `*` / `required` 视觉标记 | 提交后才报错 | label 加必填；`aria-required` |
| 校验失败无**字段级**错误（仅顶部 toast / 控制台） | 用户不知改哪 | `Form.Item` `error` / `help`；滚动到首错 |
| 字段标签/输入框/帮助文案**未对齐**（栅格混乱） | 难扫读 | 统一 `labelCol`/`wrapperCol` 或设计系统 Form 模式 |
| 异步校验 loading 无反馈 | 重复提交 | 字段或按钮 loading |

### 13.2 复杂表单结构

字段 **>8～10** 或跨多主题时，主路径禁止「一页长滚动裸堆」：

| 应有结构 | 何时 |
|----------|------|
| 分组标题 + 分隔 | 2～3 个主题块 |
| **Tabs / 步骤条** | 多阶段向导、设置类 |
| **手风琴 / Collapse** | 高级项默认折叠 |
| **按钮组 / Segmented** | 互斥模式切换 |

无结构的长表单 → **P1**；仅「高级」折叠里 1～2 项可 P2。

### 13.3 CRUD 承载（抽屉 / 模态 / 独立页）

对照本仓**同域标杆**（见 `docs/ui/` 或最完整列表页）：

| 场景 | 业内惯例 | 不一致（报） |
|------|----------|--------------|
| 轻量编辑（≤5 字段） | 抽屉 Sheet / 侧栏 | 无理由全屏跳转 |
| 中等表单 | 抽屉或中等 Modal | 同列表有的用抽屉有的用新 Tab |
| 重表单 / 只读详情多 Tab | **独立页** / 全屏 Modal | 塞在过小 Modal 里滚动 |
| 破坏性删除 | 确认 Modal + 明确后果 | `window.confirm` 或无声删除 |

输出：标杆页路径 + 违规页路径。全仓无约定时 → 参考 ui-ux-reviewer 菜谱，记 P2「待建约定」。

---

## §14 嵌套边框与组件间距 — L5 · P1

与 ui-ux-reviewer **craft §6 反套卡**同尺；本 lane 做**代码/样式级**快扫。

| 反模式 | 说明 | 修法 |
|--------|------|------|
| Card/Panel **套** Card，内外都有 `border`，中间 **无 gap/margin** | 双描边重叠、视觉发闷 | 内层去边框或外层改 `borderless`；加 `gap` |
| 列表外卡再套「表+分页」内框 | 双 padding | 筛+表+分页同层（见 anti-patterns） |
| 表单项之间仅靠边框分隔、无垂直 rhythm | 挤 | 统一 `gap`/`margin-bottom` token |

**扫法**：抽读变更页 + 标杆页 JSX/模板；`rg 'border|Card|Panel'` 对照 class。像素级验收可交 browser-reviewer / ui-ux-reviewer。

---

## §15 安全、参数隐患与隐式 Bug — L10 · P0/P1

**不是**完整渗透测试；抓**代码里常见、上线必炸**类。与 §8 凭据、§9 SQL 拼接去重：同根因合并一条。

| 反模式 | 级别 | 锚点 | 修法 |
|--------|------|------|------|
| SQL/命令/模板注入 | **P0** | 拼接 SQL、shell、`eval`、未消毒 `innerHTML` | 参数化；转义；CSP |
| 路径遍历 / 任意文件读 | **P0** | 用户控 `path` 拼 `../` | 白名单根目录；`filepath.Clean` + 边界检查 |
| **越权 / IDOR** | **P0** | 只校验登录不校验资源 `org_id`/`owner` | 每条查询带租户/属主条件 |
| 质量/类型未校验（负数、超大 pageSize、空 UUID） | P1 | `BindJSON` 无 validate；`pageSize=999999` | schema 校验 + 上限 |
| 批量赋值 | P1 | `**req` / `Object.assign(user, body)` 含 `role`/`is_admin` | DTO 白名单字段 |
| 敏感操作无二次确认/无审计 | P1 | 删库/改权限无 audit log | 审计 + 确认（UI 见 §13） |
| 竞态 / 重复提交 | P1 | 双点击创建两条；无幂等 | 幂等键、按钮 debounce、DB 唯一约束 |
| CSRF（cookie 会话 + 无 token） | P1 | 表单 POST 无 CSRF | 框架 CSRF 中间件 |
| CORS `*` + credentials | **P0** | 配置明显过宽 | 收紧 origin |

**扫法**：变更面所有 **写接口** + **按 id 读接口** 逐条追 authz；`rg` 种子见 SKILL Phase 1。拿不准 → P2 + 写清疑点，勿假绿。

---

## §16 其他常见缺口（速查 · 按栈抽样）

整仓评审时在 Stack Card 勾选「已扫 / 跳过 / Blind spot」。**不强制每条都开 finding**，但应在报告「覆盖说明」里点名是否看过。

| 类别 | 典型缺口 | 默认级别 |
|------|----------|----------|
| 列表与分页 | 大列表无分页/虚拟滚动；导出无上限 | P1（细则 → [§17](#§17-大流量性能热点静态--l11--p1可升-p0)） |
| 限流与滥用 | 登录/短信/导出无限流 | P1（细则 → §17） |
| 文件上传 | 无类型/大小限制；路径用户可控 | P0/P1 |
| 时区与 locale | 时间存本地字符串；前后端格式不一致 | P1 |
| 缓存与一致性 | 写后读仍走旧缓存无失效 | P1（细则 → §17） |
| 特性开关泄漏 | 前端 bundle 暴露未发布功能 flag | P1 |
| 可访问性基础 | 图标按钮无 `aria-label`；仅颜色区分状态 | P2（上线前深扫交 ui-ux-reviewer） |
| i18n | 用户可见硬编码中文/英文混用且无 locale 键 | P2 |
| 迁移与回滚 | 破坏性 migration 无回滚说明 | P1 |
| 文档与实现 | OpenAPI 与 handler 字段不一致 | P1 |
| 深链与权限 | 路由可直链但菜单隐藏；未鉴权仍可访问 | P0/P1 |
| HA / 多实例 | 宣称 HA 但会话/锁/存储单机 | P0/P1（细则 → [§18](#§18-ha-可靠性与-ha-下性能--l11条件必开)） |

**与姊妹 skill 分工**：页级视觉密度、列表行操作、语义色、遮罩透明度 → [ui-ux-reviewer](../../ui-ux-reviewer/SKILL.md)；真机 Console/截图 → [browser-reviewer](../../browser-reviewer/SKILL.md)。本 catalog 覆盖**代码可读到的生产就绪缺口**；二者串联时不重复报同一像素问题。

---

## §17 大流量性能热点（静态）— L11 · P1（可升 P0）

**定位**：静态/代码结构评审，**不是**压测或 profiling。目标是找出「流量一上来几乎必炸或必拖垮」的热点反模式。禁止编造 QPS/延迟数字；无证据的「可能慢」→ 不报或最多 P2 疑点。

**何时开**：有服务端 API / worker / 批处理入口则**必开**（纯文档/纯静态页库可跳过并注明）。PR 变更面触及 handler/DAO/队列时必开。

| 反模式 | 级别 | 为何致命 | 锚点（例） | 修法 |
|--------|------|----------|------------|------|
| 列表/查询**无分页或无硬上限**（`pageSize` 可无限、`FindAll`、一次加载全表） | **P1**（主路径导出/管理列表可升 **P0**） | 大流量或大数据量时 OOM / DB 打满 | `LIMIT` 缺失、`Take(0)`、`pageSize` 无 max、FE 一次拉全量 | 强制分页 + 服务端 `maxPageSize`；导出走异步作业+上限 |
| **N+1** 查询（循环内逐条 `Get`/`Find`/`query`）挂在列表/聚合主路径 | P1 | 流量×N 放大 DB | for 内 repository 调用；GraphQL 无 DataLoader | 批量 IN / join / dataloader；补测 |
| 同步路径上的**无界 fan-out**（一次请求串行/并行打大量外部或下游） | P1 | 尾延迟与级联故障 | 循环 `http.Get`、无并发上限的 `errgroup` | 批量 API、并发上限、超时、熔断 |
| 热路径**持锁过久** / 全局互斥做 I/O | P1 | 吞吐塌方 | `mutex` 内调 DB/HTTP；进程内全局锁当分布式 | 缩小临界区；分布式锁+短租约；无锁结构 |
| 连接池 / 客户端**无上限或默认过小且写死**且文档当生产 | P1 | 连接耗尽或串行化 | `MaxOpenConns=0` 无文档、HTTP client 无 pool、无限 goroutine 打 DB | 显式池上限 + 超时；压测文档另议 |
| 热路径同步做**重计算/全量扫描/无索引暗示的过滤**（代码可见：全表 load 再 filter） | P1 | CPU/内存打满 | 先 `FindAll` 再内存 `filter`；正则扫大 blob | 下推过滤到 DB/索引；流式 |
| 写路径**无背压**（队列无限缓冲、丢弃无指标、同步阻塞调用方） | P1 | 内存膨胀或请求堆积 | `make(chan T, 1<<20)`、memory broker 当生产（与 §3 去重归可靠性若已报） | 有界队列+拒绝/降级策略+指标 |
| 缓存**无 TTL / 无失效**导致热点键或脏读放大 | P1 | 流量打到错误数据或击穿 | 写后不删 cache；永不过期本地 map | TTL + 写穿透失效；防击穿 |

**扫法（主路径优先）**：

1. 列高频入口：列表 GET、搜索、登录、上报、webhook、consumer handler（从路由/OpenAPI/菜单点名前 10 个）。
2. `rg` 种子见 SKILL L11；对命中向上追是否在 handler 主路径。
3. 有 codegraph → 对可疑 DAO 跑 callers，看是否被列表 handler 引用。
4. **与 §16 速查去重**：分页/限流/缓存同一根因只留一条，类别写 `性能热点`。

**不报**：

- 纯测试/脚本/一次性 migration 工具里的全表扫
- 管理端「高级诊断」且有明确危险确认 + 低 QPS 文档，且非默认入口 → 可 P2
- 「建议加索引」但迁移/schema 已有对应索引、代码侧只是 ORM 正常查询
- 没有代码锚点的容量猜测、未跑压测就断言「达不到 xxx QPS」

**验收**：每条 finding 必须有**入口（路由/consumer）+ 放大机制一句话 + 路径**；修法可验证（分页上限单测 / 批量查询替换循环）。

---

## §18 HA 可靠性与 HA 下性能 — L11（条件必开）

**触发（Stack Card `ha_mode`）**：下列**任一**成立 → `ha_mode: claimed`，**必须**跑本节；否则 `ha_mode: single|unknown`，本节跳过并写明，**仍跑 §17**。

| 信号 | 例 |
|------|----|
| 架构/文档宣称 | `docs/arch.md` H3 高可用、README「支持 HA/多实例/集群」 |
| 编排默认多副本 | Helm/Kustomize/`replicas: >1`、HPA、compose `deploy.replicas` |
| 配置集群语义 | `cluster`/`raft`/`leader-elect`/`ha.enabled`、角色拆分 `role=api|worker` 且文档允许多 api |
| 用户/调用方明示本仓按 HA 评审 | 写入 Stack Card |

**与 §3 关系**：§3 已有「memory broker / 会话规划中却多实例 / 水平扩展与单机存储矛盾」。本节补 **HA 专属**与 **HA×性能**；同一根因与 L3 去重为一条，类别写 `HA·可靠性` 或 `HA·性能`。

### 18.1 HA 可靠性

| 反模式 | 级别 | 为何致命 | 锚点（例） | 修法 |
|--------|------|----------|------------|------|
| 宣称 HA，但**会话/JWT 黑名单/登录态**仅进程内存 | **P0** | 多实例登录随机失败或踢不掉 | `sync.Map` session、内存 token 黑名单 | Redis/DB 等共享存储；或 sticky + 文档降级为非 HA |
| 宣称 HA，**本地磁盘**作唯一任务队列/上传/锁/leader 态 | **P0** | 脑裂或任务丢 | `/var/` 队列、文件锁当集群锁 | 共享存储或外置 MQ；去掉假 HA 宣称 |
| 选主/租约**无超时或无 fencing**，双主可写 | **P0** | 数据损坏 | leader 无 TTL；续约失败仍写 | 租约+fencing token；写前校验世代 |
| 多实例写**无幂等/无分布式锁**的关键互斥区（定时全量对账、唯一资源申请） | P1（资金/配额类 **P0**） | 重复执行 | 多副本 cron 同跑无锁 | 分布式锁或单 leader 调度 |
| 健康探针**只活不管 ready**（依赖未就绪仍接流量）或 ready 恒 true | P1 | 滚动发布打死实例 | `/health` 恒 200；无 readiness | 分 liveness/readiness；依赖探测诚实 |
| 优雅关停缺失（进行中请求/消费者直接杀） | P1 | 滚动更新丢请求 | 无 `Shutdown`/`preStop` | drain + 超时关停 |
| 文档/Helm 宣称 HA，实际 values **默认 replicas=1 且无切换说明** | P1 | 交付假 HA | chart 默认 1、无 HA values  overlay | 提供 `values-ha.yaml` + 共享依赖清单；或改宣称 |

### 18.2 HA 下性能瓶颈（静态）

| 反模式 | 级别 | 为何致命 | 锚点（例） | 修法 |
|--------|------|----------|------------|------|
| 每请求打**全局分布式锁**串行化本可并行的读/写 | P1 | HA 扩副本不增吞吐 | 热点 key 一把大锁包整段业务 | 细粒度锁/无锁；按租户分片 |
| 所有实例**同步全量复制**或每实例扫同一大表做调度 | P1 | 副本数↑ 负载↑ | 每 pod 全表 poll；无分片 | 分区消费 / leader 派发 / 队列认领 |
| 共享存储/DB **无连接上限治理**，副本水平扩展直接打爆连接 | P1 | 扩容致雪崩 | 每实例 `MaxOpenConns` 过大 × replicas | 池大小按拓扑预算；PgBouncer 等 |
| 跨实例**聊天式重试无抖动**，故障时重试风暴 | P1 | HA 故障放大 | 固定间隔重试；无 jitter/circuit | 退避+抖动+熔断；与 §8 去重 |
| Sticky 会话依赖却无会话亲和或共享会话，扩缩容时抖动 | P1 | 体验与负载不均 | 文档要求 sticky 但 Ingress 未配 | 共享会话或配亲和；写入部署文档 |

**扫法**：

1. Phase 0 定 `ha_mode`；`claimed` 则读 arch HA 节 + helm/compose replicas + 会话/锁/队列实现目录。
2. `rg`：`replicas|leader|lease|fencing|sticky|session.*(memory|sync\.Map)|filelock|local.*queue|ha\.|高可用|多实例`。
3. 对照 §17 热点入口：在多副本假设下是否「每实例重复全量工作」。
4. 拿不准（例如外部 K8s 清单不在仓内）→ Blind spot：`HA 编排在仓外，未核 replicas/亲和`，**禁止**写「HA 已验证」。

**不报**：

- 明确**仅单机**且无 HA 宣称（`ha_mode: single`）
- 测试双里的内存 session
- 「建议上 K8s」类空泛架构愿望且无代码/文档矛盾

**验收**：`ha_mode: claimed` 时报告须有「HA 专节」或明确「已扫 §18 无发现」+ 证据范围；不可因 L3 扫过队列就声称 HA 已覆盖。
