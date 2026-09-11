# Stack Detection（识栈与按栈搜法）

主 agent Phase 0 产出 **Stack Card**，并据此给每个扫描 subagent 下达**匹配扩展名/目录**的搜法。禁止假设一定是 Go + React。

## Stack Card 模板

```markdown
## Stack Card
- 根路径：…
- 范围模式：整仓 / PR·变更面（主根：…；上追：路由/菜单/调用方） / 多仓对比
- 形态：单仓 / monorepo（apps: …）
- 后端：语言 + 框架（例：Go go-zero / Node Nest / Python FastAPI / Java Spring）
- 前端：…（无则写「无 SPA」）
- Worker/Agent/边车：…
- 配置：…（yaml/env/helm）
- 数据：…（sqlite/pg/migrate/seed；**多 Driver 则 L3 必查 §9**）
- 交付：…（docker/k8s/systemd）
- 建议 lane：L1–L5、L7（+L6 若有 IaC/CI；**+L8** 若有仓外依赖；**+L9** 若有 HTTP/API 层；**+L10** 若有鉴权/写接口/用户输入；**+L11** 若有服务端 API/worker——含 §17；`ha_mode: claimed` 时 L11 含 §18）
- 仓外依赖清单（L8 用）：…（协议/厂商 × 适配器目录 × 有无 `contracts/*.smoke.*`）
- **ha_mode**：claimed / single / unknown（判据见 finding-catalog §18；读 docs/arch.md H3、README、Helm replicas）
- 证据层：有 / 无 `.evidence/`（有 → Phase 2.5 必读）
- 跳过 lane：…（原因）
- 本仓标杆 UI（若有）：path…
- 宣称客户端：Web / Desktop / Admin / CLI …（用于 L7 对账）
- 宣称材料：README / docs / OpenAPI …
- 排除：node_modules, dist, build, vendor, .git, 生成物, *_test.*, *.spec.*, __mocks__…
```

## 指纹 → 结论

| 发现 | 推断 |
|------|------|
| `go.mod` + `*.go` | Go；再看 go-zero/`cmd/`/`internal/` |
| `package.json` + `src/` 或 `app/` | Node/TS；Next vs Vite vs Nest 看依赖 |
| `pyproject.toml` / `requirements.txt` / `manage.py` | Python；Django/FastAPI/Flask |
| `pom.xml` / `build.gradle*` | JVM |
| `Cargo.toml` | Rust |
| `*.csproj` / `Program.cs` | .NET |
| `fe/` + `vite.config.*` | 独立 SPA 前端子树 |
| `android/` / `ios/` / `*.gradle` + Kotlin / `Package.swift` | 移动端（L7 按宣称对账 Screen/导航） |
| `docker-compose*.yml` / `Dockerfile` / `charts/` | 交付与默认值风险面 |
| 多 `apps/*` + 根 `pnpm-workspace` / `nx.json` / `turbo.json` | monorepo → **按 app 拆 subagent** |

不确定时：列目录 2 层 + 读 README/AGENTS/CONTEXT 前 80 行，仍不清就开一个 **explore**「只回答技术栈与目录地图」。

## 按栈：搜法种子（给 subagent）

### 通用（所有 lane 可先跑）

```text
stub|FORCE_STUB|USE_MOCK|isDemo|mockData|fakeData|FIXME|NotImplemented|not implemented|coming soon|hardcoded|placeholder|TODO implement
password|secret|api.key|apikey|192.168.|10.0.|localhost|CHANGE_ME
skeleton|Skeleton|lorem ipsum|fakeSuccess|alert\(['\"]todo
```

排除：`node_modules`, `vendor`, `dist`, `build`, `.git`, `coverage`, 锁文件大目录，以及 **`*_test.*` / `*.test.*` / `*.spec.*` / `__mocks__` / fixture 测试目录**。  
**注意**：命中 `FORCE_STUB` / flag 包起来的 stub → **仍报 P0**，不要标 skipped。  
测试双命中 → 放入 `Skipped (non-issue/test)`，**不要**进 P0/P1/P2 列表。

### Go

- 假绿：`Connected:\s*true`、`FORCE_STUB`、`ErrNotImplemented`、`panic("todo`、`return nil, nil` 在逻辑层——**有 flag 也报**
- 硬编码：`etc/**/*.yaml`、`AccessSecret`、`EncryptionKey`、启动 `main` 是否 `Validate`
- 可靠性：`Driver: memory`、`role=all`、`Ignore(`、无 `/healthz`
- 产品表面：列出 `handler`/`routes` 业务 API，对照 FE/各端菜单是否有入口
- 测试排除：`*_test.go`

### TypeScript / JavaScript（Node + FE）

- 假绿：`mockData`、`faker`、`isDemo`、`useMock`、`connected: true` 常量、空 `catch` 后 toast success——**有 flag 也报**
- 半成品：无请求的 `<Skeleton>`、写死数组当列表、`onClick={() => {}}`、`console.log('todo')`、主按钮 `disabled` +「即将推出」却仍挂路由
- 坏表单：`textarea` + yaml/json、Monaco 作主配置、`JSON.parse` 用户输入为主路径
- 风格：搜本仓 PageHeader/Layout/Empty 组件名；对比 `pages/` 下裸 `h1`
- 产品表面：`routes`/`menu`/`sidebar` 配置 vs 后端 OpenAPI/router；多端则每端对账
- 测试排除：`*.test.*`、`*.spec.*`、`__mocks__`

### Python

- 假绿：`pass  # TODO`、`NotImplementedError` 被 API 吞掉、`return {"status": "ok"}` 占位、`if settings.USE_MOCK`——**有开关也报**
- 硬编码：`os.environ.get("X", "dev-secret")`、settings 默认值
- 可靠性：`except: pass`、Celery eager、无 readiness
- 产品表面：FastAPI/Django urls 对账前端路由

### Java / Kotlin

- 假绿：`UnsupportedOperationException` 映到 200、`@Profile("dev")` mock bean——**进主代码即报，不因 profile 放过**
- 硬编码：`application.yml` / `application-prod` 是否分离；默认密码
- 产品表面：Controller 映射 vs 前端菜单

### Rust / .NET / 其他

- 用通用关键词 + 该生态配置惯例（`appsettings.Development.json`、`config/*.toml`）
- Subagent 提示写：「先找入口与 config load，再查默认值是否可进 release 构建」

### 隐式假通（L8 · 所有栈通用）

搜法与判定要点**以 [finding-catalog §8](finding-catalog.md) 的「检测清单」为准**（列调用点 → 对账 smoke 工件 → 失败语义 → 契约参数出处 → 凭据入码），subagent 提示里原样粘贴该清单，不要另编关键词。按栈补调用惯例即可：Go `http.Client{Timeout}` / `context.WithTimeout`；TS `AbortSignal.timeout` / axios `timeout`；Python `requests(timeout=)` / `httpx.Timeout`；Java `OkHttpClient.Builder().callTimeout`；Rust `reqwest::ClientBuilder::timeout`。**默认值缺失即 finding**，不要默认「框架会兜」。

### IaC / CI（L6）

```text
FORCE_STUB|ALLOW_DEV|RejectDevDefaults|NODE_ENV|values-dev|image: .*latest|USE_MOCK
```

看 Helm values、compose `environment:`、GitHub Actions 是否注入 stub/mock 开关或把 dev 密钥打进部署。  
**发现生产/默认编排带 stub 开关 → P0**（应删除开关与 stub 代码，而非仅改默认值为 false）。

## Subagent 划分示例

**中型全栈（后端 + SPA）** — 一次并行 8～11 个 explore：

1. 后端假绿 + stub 零容忍（含 flag 包裹）
2. 配置/启动硬编码+进程门禁  
3. 可靠性（队列、health、隔离）+ **多库 SQL** + **日志分类**  
4. FE 表单 UX（path/json + **校验/结构/承载**）  
5. FE 风格 + **文案** + **嵌套边框** vs 标杆页  
6. **L7 产品表面**：API/能力清单 × 各端路由/菜单；有入口页查骨架/假数据/残交互  
7. **L8 隐式假通**（有仓外依赖时必开）
8. **L9 API 信封与错误面**（有 BFF/handler 时必开）
9. **L10 安全与参数隐患**（有写接口/鉴权时必开）
10. **L11 性能热点 + HA**：§17 必开（有服务端）；Stack Card `ha_mode: claimed` 时加 §18

**纯前端库**：L4+L5+L7 为主；L2 看 demo 密钥；调三方 SDK 则加 L8；无后端则 L9/L10/L11 跳过。  
**纯后端服务**：L1–L3 + L6 + L8 + **L9 + L10 + L11**；L4/L5 标「无 UI，跳过」；若文档宣称有客户端则 L7 对账外部仓或记 P1「宣称端未纳入本仓」。  
**PR/变更面**：主根 = diff 目录；L1/L2/L7 提示中写明「上追路由表/菜单/调用方一层」；diff 触及适配器/client → L8 必开；diff 触及 handler/DAO/队列 → L11 必开。  
**双仓对比**：每个仓一套 Stack Card，同 lane 并行两个 agent，主 agent 合并对照表。  
**无 Task / 极小仓**：主 agent 按 lane 串行，仍用下方回传格式自检。

## 扫描 Subagent 提示词模板（Phase 1 复制改写）

```text
你是只读 code-review 扫描 agent。不要改代码。

项目根：{ROOT}
范围模式：{整仓 | PR·变更面}；主扫路径：{PATHS}；若为变更面：上追路由/菜单/调用方一层。
Stack Card 摘要：{语言/框架/前端/排除目录/ha_mode}
scan_tools：{ast-grep|codegraph|rg-only 组合；主 agent Phase 0.5 已探测}
Lane：{L1|L2|…|L11} — 只查这一类问题，不要扩到其他 lane。
宣称判据（L7/假绿升级）：UI「已支持/已具备」；README/对外 docs 已交付；OpenAPI/SDK 标 GA/shipped。
ha_mode（L11）：claimed → 必须覆盖 finding-catalog §18；single/unknown → 只做 §17，§18 写跳过。
搜法提示（按本栈，勿抄错语言）：{从本文「按栈：搜法种子」粘贴对应段落}
扫描工具（L1/L7）：有 ast-grep → 先 `ast-grep scan --json=compact` / 临时 pattern，再用 rg 补漏；有新鲜 codegraph → L7 可用 `codegraph callers`（「没找到」须 rg 复核路由）；仅 rg → 词法种子 + Blind spot 注明结构性扫描不可用。**只用 CLI，禁止写 MCP。**
排除：node_modules/dist/vendor/生成物；*_test.* / *.test.* / *.spec.* / __mocks__ / fixture → 命中放入 Skipped，不进 findings。
L11 禁令：禁止编造 QPS/延迟；每条 finding 必须有入口+放大机制+路径。Stub 政策：非测试主路径 stub/mock/假成功 → P0；有 env/flag/Badge/degraded 也不能降级或标 non-issue。
覆盖度诚实：**没扫到 ≠ 没问题**。跑不动/读不了/超范围的部分一律写进 Blind spots（含未覆盖路径与原因），
**禁止**为了交差把未覆盖范围写成「无发现」。宁可交「扫了 60% + Blind spots + 已覆盖范围内**全部** finding」也不要交「全绿」或「举 3 个例子交差」。
穷尽盘点：本 lane 命中即**全部列出**（每条一行）；禁止 Top N / 代表样例；回传须含 `hits=N listed=N`（listed 必须等于 hits）。
不同 path 默认可各成一条；仅同一改动点能修完时才合并，且证据列齐全部 path。

按以下格式回传（不要长篇叙事）：
### Lane Lx 结果
- Stack assumed: …
- Covered: …（实际扫到的目录/文件模式）
- hits / listed: N / N
- P0: …
- P1: …
- P2: …
- Skipped (non-issue/test): …
- Blind spots: …（未覆盖路径 + 原因：权限不够、生成代码未读、子模块未拉、超时）

每条 finding 一行：`[Px] 标题 — path:hint — 行为 — 建议`
（同根因多 path 时：主行 + 缩进实例表，path 列齐，禁止「等 N 处」）
```

## 回传格式（要求 subagent 遵守）

同上模板（`Stack assumed` / `Covered` / `hits/listed` / `P0-P2` / `Skipped` / `Blind spots`）。**Blind spots 为空只有在真的全覆盖时才能写「无」。`listed < hits` 视为 lane 失败。**

每条 finding：`[Px] 标题 — path:hint — 行为 — 建议`

主 agent 合并时遵守 SKILL「合并去重协议」：同证据取严、L1∩L7 / L3∩L11 合并为一条、稳定 ID。
