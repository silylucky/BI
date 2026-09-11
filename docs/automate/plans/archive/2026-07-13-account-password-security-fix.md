# 账户修改密码安全与体验修复实施计划

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute

## 背景与目标

**问题描述**：`POST /api/v1/auth/change-password` 把“当前密码错误”作为 HTTP 401 返回，而通用 `apiFetch` 将所有 401 直接解释为会话失效，导致清 token、执行全局 logout 并丢失稳定业务错误码。与此同时，修改密码页面存在全宽卡片包裹窄表单的大面积空白，缺少字段级校验、密码显隐、完整可访问语义、真实提交测试与浏览器视觉证据，API 文档还把该能力错误追溯到“用户角色绑定” `AUTH-003`。

**契约来源**：

- `docs/automate/evolution-state.md` 当前需求契约（phase `A2_CONTRACT`）
- `docs/bugs/BUG-001_account-password-security_2026-07-13.md`
- `.cursor/rules/{common,fe-ui,backend-fastapi,prd-sync}.mdc`
- `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`，并按普通任务上限读取 3 份必要 reference：
  - `references/layout-patterns/form-composition.md`
  - `references/form-validation-logic-review-checklist.md`
  - `references/responsive-review-checklist.md`

**成功标准**：

1. 错误当前密码保持 API v1 既有契约：HTTP 401 + 稳定业务错误 `AUTH_INVALID_CURRENT_PASSWORD`；仅修改密码调用按端点级精确 allowlist 将该业务 401 映射到“当前密码”字段，原 token、AuthProvider 用户态与当前路由均保留。HTTP 422 只继续用于请求 schema、长度及 `AUTH_PASSWORD_UNCHANGED` 等既有校验，不做 401→422 迁移。
2. `apiFetch` 提供端点级、显式、按 401 错误码 allowlist 的“保留会话”契约；默认和未知/不可解析 401 仍清 token 并触发全局未授权处理，不弱化真实鉴权失败。
3. 修改密码设置页采用 TailAdmin/Radix 设置页组合：受控内容宽度、有效信息双列/单列响应式布局，无全宽空卡片；desktop/tablet/mobile 与 light/dark 均稳定。
4. 三个密码字段支持独立显示/隐藏；规则明确；确认密码即时匹配；字段错误具备 `aria-invalid`、`aria-describedby`；提交失败聚焦首个无效字段；按钮使用现有 `Button loading` 契约并阻止重复提交。
5. 前端覆盖成功、失败、payload、字段校验、loading、焦点、会话保留与真实 401 登出；后端覆盖状态边界、同 token 连续性、成功审计和失败不审计。
6. `AUTH-003` 错位形成当前契约内的可执行纠错闭环：由于 SRS 无账户资料/修改密码条款，本轮不新增任何 PRD 功能 ID；`PATCH /api/v1/me` 与 `POST /api/v1/auth/change-password` 均删除 AUTH-003 归属，改由 `BUG-001`、[`2026-07-08-account-self-service.md`](./2026-07-08-account-self-service.md) 和现有代码/测试锚点诚实追溯；PRD hub、F02 分片及分片 README 同步边界说明，但 feature_count=129、AUTH-001～008、评分和 SRS 均不变。
7. 前后端专项与全量门禁通过；取得 1440×1000、1024×768、390×844 三视口 × light/dark 共 6 张统一默认态基线截图，并额外取得 desktop dark 的错误+焦点态、desktop dark 的 loading 态、mobile dark 的密码显式态 3 张状态截图，无大面积空白、裁切、重叠、溢出、framing 错位或暗色对比度丢失。

**非目标（本次不做）**：

- 忘记密码/密码找回
- MFA
- 修改密码后的全局会话撤销或其他设备下线
- 密码复杂度策略扩展（本轮只对齐现有 8–128 字符及“不得与当前密码相同”契约）
- 生产发布
- 自动合并主分支

## 现状证据与范围判断

- `backend/app/auth/profile/service.py::change_password()` 在当前密码不匹配时返回 API v1 已公开的 401；成功时写 `password.change` 审计。
- `fe/src/lib/api.ts::apiFetch()` 在解析错误体前无差别处理所有 401。
- `ChangePasswordSection.tsx` 只有块级错误、无显隐/字段错误/焦点处理，且 section 全宽、form `max-w-md`。
- `ChangePasswordSection.smoke.test.tsx` 仅有三个渲染断言；当前没有 `apiFetch` 单测。
- `tests/test_auth_profile.py` 将错误当前密码的 401 固化为期望，未验证会话连续性和审计边界，并直接操作环境 admin；登录失败还会伪造 admin JWT。
- `docs/api/README.md` 将 `PATCH /api/v1/me` 与修改密码都错误挂到 `AUTH-003`；`F02-AUTH.md` 当前仅有 AUTH-001～008。
- `docs/srs/` 对“修改密码”“账户自服务”“用户资料”检索无权威需求条款；`F01-BOOT.md::BOOT-003` 只约束鉴权中间件、JWT 登录/守卫与 `GET /api/v1/me`，不能据此扩展出账户资料/凭证维护验收。因此本轮无权新增 `AUTH-009`，也不能把两条自服务写路由硬挂 BOOT-003。
- `docs/automate/plans/archive/2026-07-08-account-self-service.md:7-16` 已明确记录账户资料、`GET/PATCH /api/v1/me`、change-password、前端页面与测试的实施范围，可与 BUG-001 及现有代码/测试共同构成“已实现能力/缺陷修复”追溯，不冒充 SRS/PRD 功能 ID。
- `fe/src/lib/api.ts::registerUnauthorizedHandler()` 当前写入模块级单例且没有 reset/unsubscribe；`AuthProvider` effect 注册后也无 cleanup，真实集成测试会产生跨测试污染风险。
- `docs/features/` 未找到相关 feature-assessment；没有未完成 assessment 前置条件。
- Bug Case 关键词检索未命中相同 401/会话语义案例；修复完成后应新增可复用案例。
- 未发现本需求的 first-review 报告，因此不伪造“前置评审追溯”章节；本计划作为 path B 初稿进入独立 plan-review。

## 整体方案

保留后端 API v1 的 401 + `AUTH_INVALID_CURRENT_PASSWORD` 兼容契约，不修改 `profile/service.py` 的状态码；在前端通用请求层增加端点显式声明的 401 错误码 allowlist。`apiFetch` 先安全解析错误体：仅当响应码为 401、`code` 为字符串且与当前调用 allowlist 精确匹配时保留会话并抛出原始 `ApiRequestError`，其余 401 沿用清 token + 全局 logout 的默认行为。模块级 unauthorized handler 同时增加 identity-safe unsubscribe 和测试/应用 teardown 专用 reset，AuthProvider effect 必须清理注册。页面按简单设置表单重构为受控宽度的响应式信息布局，复用现有 Input、Button、IconButton 和 Label 基元，补全字段校验、可访问语义、loading 与错误码映射；所有显隐按钮显式 `type="button"`。后端测试改用独立临时 SQLite 元库与专用测试用户，绝不修改共享 admin。最后在不改变 SRS/PRD 功能计数的前提下，以 BUG-001 + 账户自服务实施计划 + 现有文档/代码/测试锚点闭合所有索引说明，并执行 6 张基线 + 3 张交互状态截图验收。

## 关键决策

| 决策点 | 选择 | 备选项 | 理由 |
|---|---|---|---|
| 错误当前密码 HTTP 状态 | 保持 API v1 既有 401 + `AUTH_INVALID_CURRENT_PASSWORD`；明确不迁移 422 | 改 422；升 v2 | `docs/api/README.md` 规定破坏性变更升 v2，仓库无法证明无外部消费者；端点精确 allowlist 已能消除误登出。422 继续只承载 schema/长度/`AUTH_PASSWORD_UNCHANGED` 等既有校验 |
| `apiFetch` 401 分类契约 | `ApiFetchOptions.preserveSessionOn401Codes?: readonly string[]`，端点显式传 `["AUTH_INVALID_CURRENT_PASSWORD"]` | 全局按固定错误码硬编码；布尔 `skipUnauthorizedHandler`；所有 401 先保留 | allowlist 可审计、端点可见且默认安全；未知码、空 body、非 JSON 仍走真实鉴权失效路径，避免布尔开关误吞任意 401 |
| 401 响应解析 | 读取错误体一次并复用；allowlist 命中时抛原业务 `ApiRequestError`，否则抛统一 `UNAUTHORIZED` | 先清会话再解析；clone response 二次解析 | 保留业务码且避免重复消费 response body；解析失败采取 fail-closed 登出 |
| 页面布局 | `AccountSecurityPage` 约束 `max-w-5xl`；`ChangePasswordSection` 在 `lg` 为表单 + 规则说明双列，`<lg` 单列 | 仅把全宽卡片改 `max-w-md`；继续全宽卡片 | 说明区承载真实密码规则，消除无意义空白；tablet/mobile 可自然重排，不制造过窄主内容 |
| 密码显隐 | 每字段独立 IconButton，动态 `aria-label` + `aria-pressed`，不改字段值和焦点顺序 | 一个开关控制全部字段；原生文本按钮 | 独立控制符合用户预期，并复用项目按钮焦点与 Token |
| 校验时机 | 必填/长度/新旧相同在 blur + submit；确认密码在用户开始输入后即时匹配，提交时总校验 | 仅浏览器原生校验；仅 submit | 对齐 B Design LOGIC-01，错误可行动且不会过早打扰 |
| 字段错误映射 | 页面内显式映射稳定码：当前密码错误→`currentPassword`，新旧相同→`newPassword`；其余保留区块错误 | 扩大全局 `mapApiError` | 字段归属是端点语义，不应污染通用错误映射 |
| 必填标签 | 在现有 `fe/src/components/ui/label.tsx` 增加并导出 `RequiredLabel`，同步组件索引 | 页面重复星号；继续普通 Label | 项目规则明确要求 RequiredLabel，公共基元当前缺失；一次补齐避免页面自造 |
| 审计边界 | 成功仅新增一条 `password.change` 且 detail 不含密码；所有失败不写审计 | 错误密码也写成功动作；新增失败审计类型 | 现有动作是成功变更审计；失败安全事件体系不在本轮范围，不能伪装成成功变更 |
| 文档追溯 | 不新增 AUTH-009；API 两条自服务写路由的 PRD 列改为 `—`，说明列固定引用 BUG-001 + `2026-07-08-account-self-service.md` + 代码/测试锚点；PRD hub/F02/README 同步“AUTH-003 明确不包含账户自服务”的非计数边界说明 | 改挂 BOOT-003；继续 AUTH-003；擅自新增 AUTH-009；留下“待人工”占位 | SRS 无对应条款；BOOT-003 只覆盖 JWT/鉴权骨架，AUTH-003 是角色绑定。用户已明确批准本轮只做诚实纠错且不新增 ID，故可在现有合同内闭环，不改变 129 项计数或评分 |
| unauthorized handler 生命周期 | `registerUnauthorizedHandler` 返回 identity-safe unsubscribe；新增 `resetUnauthorizedHandler()` 仅供测试隔离/应用 teardown；AuthProvider effect 返回 cleanup | 测试不清理；允许注册 null | 避免已卸载 provider 闭包残留；reset 用途明确且可在 `afterEach` 无条件恢复全局单例 |
| 方案路径（兼容修复） | 保留后端 v1 状态 + 通用客户端端点级显式分类 | 后端改 422；全局忽略业务 401 | 精确 allowlist 修复误登出且不破坏既有 HTTP 契约；默认真实鉴权处理不变 |

## 假设与依赖

- 使用独立 worktree `C:\Users\30381\Desktop\VitalSpan\.worktrees\fix-account-password-security`，不触碰主工作区 Dashboard A5 任务。
- 延续 React 19、TanStack Query、Vitest/Testing Library、FastAPI/Pydantic/pytest 与现有审计表；不引入新依赖。
- 当前 JWT 不与密码版本绑定；“会话撤销”是明确非目标，因此成功改密后当前 token 是否继续有效不作为撤销测试，错误当前密码后同 token 仍有效则必须验证。
- 浏览器验收可使用开发环境现有管理员账号/环境变量，但只做错误密码与前端状态验证，不执行成功改密；不把凭证写进计划、日志或截图。自动化后端成功改密只使用临时 SQLite 中的专用测试用户。
- 用户已明确批准本轮合同决策：不新增未经 SRS 授权的 PRD 功能 ID，也不留下“待人工”占位；以 BUG-001、账户自服务实施计划与现有文档/代码/测试锚点完成事实追溯。PRD 三处只补边界/索引说明，129 项计数、AUTH-001～008、八维评分及 SRS 均保持不变。
- `docs/ui/layout.md` 已登记 `/admin/account/security`，本轮不改路由或导航 IA；预期评估结果为无需修改。若执行中实际改变 IA，必须停止文档任务并把该文件纳入同轮同步。

## 风险与回退

| 风险 | 概率 | 影响 | 缓解/回退方案 |
|---|---|---|---|
| allowlist 配置过宽导致真实 401 不登出 | 中 | 高 | 只接受精确错误码数组；默认空数组；未知码/无 body/解析失败均 fail-closed；单测锁定四类分支 |
| 业务 401 与真实鉴权 401 共用 HTTP 状态 | 中 | 高 | 仅 change-password 调用传精确字符串 allowlist；未知码、数字码、缺 message、空/非法 body 均 fail-closed；集成测试锁定 AuthProvider/token/URL/用户态 |
| 读取 401 body 后错误体丢失或二次消费 | 中 | 中 | 抽取一次性安全解析 helper 并复用解析结果；测试 JSON、空 body、非法 JSON |
| 表单状态重构引入错误清理/焦点竞态 | 中 | 中 | 测试驱动字段 touched/errors 与 refs；字段修改只清对应服务端错误；提交失败断言首错聚焦 |
| 三个显隐按钮增加键盘噪声或遮挡输入文字 | 低 | 中 | 使用 IconButton、右侧 padding、动态 aria-label/pressed；键盘与 390px 截图验收 |
| 双列在 tablet 壳层内过窄 | 中 | 中 | 以实际可用内容宽度为准；`lg` 双列不通过截图则回退到 `xl` 双列，mobile/tablet 保持单列，不用固定像素强撑 |
| 后端测试污染共享开发管理员 | 低 | 高 | `tests/test_auth_profile.py` 每测使用 `tmp_path` 独立 SQLite 文件、唯一用户和已知密码；切换/恢复 `DATABASE_URL` 前后清理 settings/auth engine cache 并 dispose；禁止读取/修改 admin，禁止伪造 token；测试先断言数据库 URL 指向临时文件 |
| 测试异常后临时凭证残留 | 低 | 中 | 临时库由 fixture finalizer dispose 并由 `tmp_path` 回收；失败注入验证审计异常时事务不提交且旧密码仍可登录；清理/恢复动作必须断言，finalizer 无条件恢复环境与 cache |
| 无正式 PRD ID 时追溯再次漂移 | 中 | 中 | API 两条路由统一使用 PRD `—`，说明列强制引用 BUG-001 + 账户自服务实施计划；hub/F02/README 明确 AUTH-003 排除项与实现追溯，services/auth 和 Bug 索引同步，不留“待人工”文字 |
| unauthorized handler 跨测试残留 | 中 | 中 | 注册返回 identity-safe unsubscribe；AuthProvider cleanup 调用 unsubscribe；测试 `afterEach` 执行 reset、清 token、restore fetch/vi mocks，并用正反顺序与重复运行验证 |
| 截图环境无法启动或缺开发凭证 | 低 | 中 | 先记录具体阻塞，不以 RTL 代替浏览器验收；修复环境后重跑 6 张基线 + 3 张状态截图，未取齐不得宣称视觉通过 |

**整体回退顺序**：

1. UI 布局/文案可独立回退，但三个显隐按钮的 `type="button"` 与对应防意外提交测试属于安全修复，不随视觉回退。
2. 后端始终保持 v1 401 时，change-password 端点 allowlist 不得单独回退；若回退请求层实现，必须把页面调用与请求层一起原子回退到修复前并明确重新引入 BUG-001，不能宣称修复完成。
3. 只有未来经批准将端点升级为 v2/422 且客户端已迁移后，才可原子移除该端点 allowlist；先验证 422 客户端路径，再移除 allowlist，绝不出现“后端 401 + 无 allowlist”的中间态。
4. 每条回退路径均运行 Task 1/5 前端专项与 Task 2 后端专项，并同步 API/服务域/Bug Case 到最终运行契约。

## 精确改动文件

| 文件 | 动作 | 责任 |
|---|---|---|
| `fe/src/lib/api.test.ts` | 新增 | 401 默认登出、allowlist 保留、未知/非法响应 fail-closed、handler unsubscribe/reset 隔离 |
| `fe/src/lib/api.ts` | 修改 | `ApiFetchOptions`、一次性错误体解析、端点级 401 code allowlist、identity-safe unsubscribe 与测试/teardown reset |
| `fe/src/context/auth-context.tsx` | 修改 | effect 返回 unauthorized handler cleanup，卸载后不保留 logout 闭包 |
| `tests/test_auth_profile.py` | 修改 | 临时 SQLite/专用用户 fixture、既有 401、同 token 会话连续性、422 长度/未变化边界、审计成功/失败与异常回滚 |
| `fe/src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx` | 修改 | 从 smoke 升级为完整交互/可访问性测试 |
| `fe/src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx` | 新增 | 不 mock `apiFetch`，串联真实 AuthProvider/路由/请求层，验证业务 401 保留 token、用户态与 URL |
| `fe/src/pages/admin/account/components/changePasswordForm.test.ts` | 新增 | 纯校验、字段错误归属与服务端错误码映射单测 |
| `fe/src/pages/admin/account/components/changePasswordForm.ts` | 新增 | 纯校验与稳定错误映射，控制主组件低于 300 行 |
| `fe/src/pages/admin/account/components/ChangePasswordSection.tsx` | 修改 | 字段模型、错误映射、显隐、焦点、loading、规则说明、响应式布局 |
| `fe/src/pages/admin/account/AccountSecurityPage.tsx` | 修改 | 页面内容列宽约束 |
| `fe/src/components/ui/label.tsx` | 修改 | 新增 `RequiredLabel` |
| `fe/src/components/README.md` | 修改 | 登记 RequiredLabel 公共 API |
| `docs/automate/prd.md` | 修改 | hub 增加非计数纠错说明与修订记录：AUTH-003 不含账户自服务，追溯 BUG-001 + 账户自服务实施计划；feature_count/评分不变 |
| `docs/automate/prd/F02-AUTH.md` | 修改 | 在 AUTH 分片顶部增加边界说明：PATCH me/change-password 不属于 AUTH-003，不新增 ID；链接 BUG-001、实施计划与代码/测试 |
| `docs/automate/prd/README.md` | 修改 | 分片索引增加非计数实现追溯说明；保持 16 域、129 项、F02 8 项 |
| `docs/api/README.md` | 修改 | PATCH me 与 change-password 均移除错误 AUTH-003；PRD 列为 `—`，说明引用 BUG-001/账户自服务实施计划；明确 204/业务 401/鉴权 401/既有 422 |
| `docs/services/auth.md` | 修改 | 登记账户资料/凭证自服务事实职责与 profile/service 入口，引用 BUG-001/实施计划，不写 HTTP 契约、不挂新 PRD ID |
| `docs/bugs/BUG-001_account-password-security_2026-07-13.md` | 修改 | 根因状态、修复记录、前后对比、验证证据 |
| `docs/bugs/README.md` | 修改 | BUG-001 状态、已修根因数与证据入口同步 |
| `.agents/skills/bug-case-library/cases/auth-password-401-session-semantics.md` | 新增 | 沉淀业务 401 与全局会话副作用组合缺陷 |
| `.agents/skills/bug-case-library/SKILL.md` | 修改 | 新 Bug Case 索引 |
| `docs/bugs/artifacts/BUG-001/password-security-{1440x1000,1024x768,390x844}-{light,dark}-default.png` | 新增（6 张） | 三视口 light/dark 统一默认态视觉基线 |
| `docs/bugs/artifacts/BUG-001/password-security-1440x1000-dark-error-focus.png` | 新增 | desktop dark 错误+首错聚焦状态证据 |
| `docs/bugs/artifacts/BUG-001/password-security-1440x1000-dark-loading.png` | 新增 | desktop dark loading/disabled 状态证据 |
| `docs/bugs/artifacts/BUG-001/password-security-390x844-dark-password-visible.png` | 新增 | mobile dark 显隐按钮与明文态布局证据 |

**评估后不改**：

- `docs/ui/layout.md`：安全设置路由和导航 IA 已存在，本轮只调整页面内部布局与交互。
- `docs/arch.md`：不改目录、技术栈、环境变量或架构边界。
- `backend/app/auth/profile/service.py`、`backend/app/api/v1/auth.py`、`backend/app/auth/profile/schemas.py`：API v1 业务 401 保持兼容，错误映射已透传 `ProfileError.status`，现有 1/8/128 输入边界已满足；明确不做 422 状态迁移。
- `docs/srs/**`：无账户自服务权威条款且用户明确禁止扩展 SRS，本轮不修改。
- `docs/automate/plans/archive/2026-07-08-account-self-service.md`：作为已完成实施范围锚点引用，历史计划内容不改。

## 改动清单（严格 TDD）

### Task 1. 建立 `apiFetch` 401 分类契约

- **位置**：
  - 新增 `fe/src/lib/api.test.ts`
  - 修改 `fe/src/lib/api.ts` → `apiFetch()`、新增私有错误体解析 helper 与 `ApiFetchOptions`
  - 修改 `fe/src/context/auth-context.tsx` → `AuthProvider` unauthorized handler effect cleanup
- **RED**：
  1. 默认 401：已有 token 被清除、未授权 handler 调用一次、抛 `code=UNAUTHORIZED`。
  2. 401 + `preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"]` + 同码 JSON：token 保留、handler 不调用、抛原 message/code/fields。
  3. 配了 allowlist 但返回其他码：仍清 token、调用 handler、抛 `UNAUTHORIZED`。
  4. 401 空 body/非法 JSON：仍 fail-closed 清会话。
  5. 401 的 `code` 为数字、数组、对象或缺失，或 body 缺 `message`：均不得命中字符串 allowlist，仍 fail-closed 清会话。
  6. 非 401 错误继续保留原 body 解析行为，确保重构无回归。
  7. `registerUnauthorizedHandler(handler)` 返回 unsubscribe；unsubscribe 只在当前 handler 仍是同一引用时清空，旧 provider cleanup 不得移除后注册的新 handler。
  8. `resetUnauthorizedHandler()` 后真实 401 仍清 token，但不调用任何旧 handler；证明 reset 可无条件用于测试 teardown。
- **验证 RED**：`cd fe && pnpm exec vitest run src/lib/api.test.ts`，确认因缺少 options/分类逻辑而按预期失败。
- **GREEN**：
  - `ApiFetchOptions extends RequestInit`，新增只读错误码 allowlist；在调用原生 `fetch` 前解构掉自定义字段，禁止把它泄漏给 fetch。
  - 错误响应只解析一次；仅精确命中 allowlist 时保留会话并抛原业务错误。
  - 默认、未知、不可解析 401 保持现有破坏性鉴权失效处理。
  - `registerUnauthorizedHandler` 返回 identity-safe cleanup；新增导出 `resetUnauthorizedHandler(): void`，用途仅限测试隔离和应用 teardown，不作为业务请求逃生开关；`AuthProvider` effect 返回 cleanup。
- **REFACTOR**：解析 helper 保持私有；不建立全局业务错误码表，不增加跳过鉴权的布尔开关。
- **目标对应**：成功标准 1、2、5。
- **GREEN 验证**：同一专项命令全绿，再运行 `pnpm exec vitest run src/lib/api.test.ts src/routes.smoke.test.tsx`。

### Task 2. 隔离后端密码测试并锁定 v1 状态/会话/审计边界

- **位置**：
  - `tests/test_auth_profile.py`
- **RED**：
  1. 先增加 fixture 契约测试：每个测试的 `DATABASE_URL` 必须是 `tmp_path` 下唯一 SQLite 文件，用户名/密码为测试内唯一已知值，共享 admin UUID/username 不得存在；登录失败直接断言失败，禁止伪造 JWT。
  2. 错误当前密码继续断言 **401** + `AUTH_INVALID_CURRENT_PASSWORD`；使用同一 Authorization header 随即请求 `/api/v1/me` 必须 200，旧密码仍可登录。
  3. 新密码 7/129 字符分别 422；新旧相同 422 + `AUTH_PASSWORD_UNCHANGED`。这些是既有 422 边界，明确不代表当前密码错误迁移到 422。
  4. 失败前后直接查询隔离库 `password.change` total，必须不增加。
  5. 成功改密后 total 恰增 1，最新 action/actor/target 正确，detail 为 null/不含 current/new password；新密码可登录、旧密码不可登录。无需恢复共享凭证，因为只修改可销毁的临时用户。
  6. 失败注入：monkeypatch `audit_service.record_event` 抛异常，调用 service/端点后显式 rollback，断言旧密码仍可登录、新密码不可登录、审计为 0；证明异常不提交凭证变更。
- **隔离 fixture 实现约束**：
  - 使用 `tmp_path / "profile-<uuid>.db"`；fixture setup 保存原 `DATABASE_URL`，切换到临时 SQLite 后清理 `get_settings` 与 `app.auth.models.get_meta_engine` cache，`Base.metadata.create_all` 并 seed 唯一 `AuthUser` + admin role。
  - TestClient、登录、AuthMiddleware、`/me` 与 change-password 全部消费该临时 URL；不得依赖 conftest 的共享 admin fallback，不得读取 `VITALSPAN_DEV_ADMIN_PASSWORD`。
  - finalizer 必须关闭 TestClient、dispose 临时 engine、恢复原环境变量并再次 clear cache；每项清理都执行，即使测试断言/请求抛异常。
- **验证 RED**：先加入“数据库 URL 必须为 tmp_path、共享 admin 不存在、禁止登录 fallback”的契约测试，确认旧 fixture 不满足而失败。
- **GREEN**：只修改测试和 fixture；生产 `profile/service.py` 保持 401，不新增审计失败事件、不改 JWT 生命周期。
- **REFACTOR**：在测试内提取 seed、登录 header、审计查询最小 helper；fixture 保持文件内私有，不扩散到全局 conftest。
- **目标对应**：成功标准 1、5。
- **GREEN 验证**：`cd backend && python -m pytest ../tests/test_auth_profile.py -q` 全绿；再运行 `python -m ruff check ../tests/test_auth_profile.py`。额外读取测试日志，确认无 admin/共享数据库密码变更与 fallback token。

### Task 3. 先用交互测试定义安全表单契约

- **位置**：`fe/src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx`
- **RED 用例拆分**：
  1. 三个必填字段及规则文案渲染，输入具备 helper/error 描述关联。
  2. 每个显隐按钮独立切换对应 input 的 `password/text`，具备 `type="button"`、动态 accessible name、`aria-pressed`，不清值。
  3. blur/submit 校验空值、8–128 长度、新旧相同；确认密码开始输入后即时显示/清除“不一致”。
  4. 无效提交不调用 API，聚焦第一个无效字段，字段 `aria-invalid=true`。
  5. 合法提交 payload 只含 `currentPassword/newPassword`，调用端显式传 `preserveSessionOn401Codes`。
  6. pending 时 Button `aria-busy`、loading 文案且 disabled；连续点击只提交一次。
  7. 成功 toast、三个字段清空、错误清除。
  8. `AUTH_INVALID_CURRENT_PASSWORD` 落到当前密码字段并聚焦，保留三个字段值；本 mock 组件测试不对导航/logout 作恒真断言。
  9. `AUTH_PASSWORD_UNCHANGED` 落到新密码字段；未知错误显示区块级可行动中文并保留输入。
  10. 先填满合法表单，再逐一点击三个显隐按钮，逐次断言 `apiFetch` 调用次数仍为 0；最后单独点击提交按钮并断言只提交 1 次，锁定非提交按钮安全契约。
- **测试策略**：本文件只 mock 网络边界 `apiFetch` 与 toast，负责字段映射/输入保留/可访问状态；不在 mock 后声称证明 AuthProvider/logout/URL，会话组合证据由 Task 5 的真实请求层集成测试负责。渲染真实 ChangePasswordSection、TanStack Mutation、Input/Button/Label，避免测试 mock 自身。
- **验证 RED**：`cd fe && pnpm exec vitest run src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx`，逐个用例确认因行为缺失而失败。
- **目标对应**：成功标准 3、4、5。

### Task 4. 实现 TailAdmin/Radix 布局、字段交互与可访问状态

- **位置**：
  - `fe/src/components/ui/label.tsx`
  - `fe/src/components/README.md`
  - `fe/src/pages/admin/account/AccountSecurityPage.tsx`
  - 新增 `fe/src/pages/admin/account/components/changePasswordForm.ts`
  - 新增 `fe/src/pages/admin/account/components/changePasswordForm.test.ts`
  - `fe/src/pages/admin/account/components/ChangePasswordSection.tsx`
- **GREEN**：
  - `RequiredLabel` 复用 Label 样式，提供视觉星号并含屏幕阅读器“必填”语义；更新公共组件索引。
  - 页面内容约束 `w-full max-w-5xl`，section 使用语义 Token、rounded/border/dark 状态；`lg` 表单 + 规则说明双列，`<lg` 单列。
  - 规则说明明确“8–128 个字符”“不能与当前密码相同”；不虚构数字/大小写/特殊字符要求。
  - 在 `changePasswordForm.ts` 建立纯校验和稳定错误码→字段映射；`changePasswordForm.test.ts` 锁定必填、8/128 边界、新旧相同、确认不匹配、当前密码错误/密码未变化字段归属。
  - 主组件建立 `currentPassword/newPassword/confirmPassword` touched/错误状态；字段改动清对应服务端错误，确认匹配即时校验。
  - 每字段用相对容器 + 现有 IconButton/Lucide Eye/EyeOff；三个 IconButton 均显式设置 `type="button"`；输入预留右 padding，按钮具备动态中文 aria-label 与 pressed。
  - error/helper 分配稳定 id，Input 设置 `fieldState="error"`、`aria-invalid`、组合 `aria-describedby`；区块错误使用 `role="alert"`。
  - refs 聚焦首个前端错误或后端映射字段；失败保留输入。
  - mutation 调 `apiFetch` 时显式 allowlist `AUTH_INVALID_CURRENT_PASSWORD`；Button 使用 `loading={mutation.isPending}` + `loadingText="保存中…"`。
  - 成功 toast 后清空字段、错误、touched 和显隐态。
- **REFACTOR**：纯校验/错误映射固定放入上述 helper；`ChangePasswordSection.tsx` 必须低于 300 行，不再条件新增其他源文件。
- **目标对应**：成功标准 1、3、4、5。
- **验证方式**：`pnpm exec vitest run src/pages/admin/account/components/changePasswordForm.test.ts src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx` 全绿；`pnpm run check:design`；`pnpm run build`。

### Task 5. 做前端集成回归并证明会话语义未弱化

- **位置**：
  - `fe/src/lib/api.test.ts`
  - `fe/src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx`
  - 新增 `fe/src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
- **验证矩阵**：
  - 业务 401：组件字段错误、保留输入；端点 allowlist 精确命中。
  - 真实组合集成：不 mock `apiFetch`，使用 `MemoryRouter` + 真实 `AuthProvider` + 真实 `ChangePasswordSection`，只 stub 原生 `fetch`：先让 `/api/v1/me` 返回用户并建立 AuthProvider 用户态，再让 change-password 返回 401 + `AUTH_INVALID_CURRENT_PASSWORD`；断言 token 未清、未导航 `/login`、location 仍为 `/admin/account/security`、用户态仍为原用户、当前密码字段收到错误且输入保留。
  - 真实 401：默认调用、未知 code、非法 body 均清 token + handler。
  - 既有业务 422：`AUTH_PASSWORD_UNCHANGED` 映射新密码字段；明确无 HTTP 状态迁移。
  - 成功 204：成功反馈、表单复位。
  - 网络/未知服务错误：区块反馈、输入保留。
- **全局清理契约**：
  - `afterEach` 必须依次执行 Testing Library cleanup、`resetUnauthorizedHandler()`、`clearAuthToken()`、`vi.unstubAllGlobals()`/恢复原生 fetch、`vi.restoreAllMocks()`；不得依赖测试文件结束时进程销毁。
  - 显式 unmount AuthProvider 后触发一次默认 401，断言旧 logout 闭包不被调用、不发生卸载后导航/状态更新；随后注册新 handler，调用旧 unsubscribe，断言新 handler 仍有效。
- **目标对应**：成功标准 1、2、5。
- **验证命令**：
  - `cd fe && pnpm exec vitest run src/lib/api.test.ts src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
  - `cd fe && pnpm exec vitest run src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx src/lib/api.test.ts && pnpm exec vitest run src/lib/api.test.ts src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
  - 连续两次执行上一组正反顺序命令；每次均须 exit 0，证明无 handler/token/fetch 顺序污染。
  - `cd fe && pnpm test`

### Task 6. 在现有合同内闭合文档纠错并沉淀 Bug Case

- **位置**：
  - `docs/automate/prd.md`
  - `docs/automate/prd/F02-AUTH.md`
  - `docs/automate/prd/README.md`
  - `docs/api/README.md`
  - `docs/services/auth.md`
  - `docs/bugs/BUG-001_account-password-security_2026-07-13.md`
  - `docs/bugs/README.md`
  - `.agents/skills/bug-case-library/cases/auth-password-401-session-semantics.md`
  - `.agents/skills/bug-case-library/SKILL.md`
- **改动**：
  - **合同决策已由本轮用户明确给出**：不新增未经 SRS 授权的 PRD 功能 ID；不缩减“API/PRD 文档纠错”范围；不保留“待人工”占位；以 BUG-001 + `docs/automate/plans/archive/2026-07-08-account-self-service.md:7-16` + 当前代码/测试/页面文档锚点完成已实现能力与缺陷修复追溯。
  - `prd.md`：版本 `1.2.117→1.2.118`、`last_updated→2026-07-13` 并新增修订记录；在 F02 索引或执行范围旁增加“非计数实现纠错”说明，明确 AUTH-003 仅为用户角色绑定，不包含 profile/change-password；链接 F02、BUG-001 和账户自服务实施计划。`feature_count: 129`、评分表、F02 ID 范围均不变。
  - `F02-AUTH.md`：顶部增加“账户自服务实现追溯（非新增功能项）”边界块，明确 `PATCH /me` 与 change-password 不属于 AUTH-003；列出实施计划、BUG-001、`backend/app/auth/profile/`、两条 API 路由、前端账户页及专项测试锚点；不得新增 AUTH-009 或任何验收项到 AUTH-001～008。
  - `prd/README.md`：增加与 hub/F02 一致的非计数说明，保持“16 域 · 129 项”、AUTH-001～008、F02 项数 8；hub 版本同步为 `v1.2.118`。
  - `docs/api/README.md`：版本 `1.0.3→1.0.4`、`last_updated→2026-07-13`；`PATCH /api/v1/me`、`POST /api/v1/auth/change-password` 两行同时删除 AUTH-003，PRD 列统一写 `—`，说明列固定写“实现追溯：BUG-001 · Account Self-Service plan”，并保留现有代码锚点；新增版本记录。这是无 SRS/PRD ID 情况下的完成态事实追溯，不写“待人工/临时”。
  - change-password API 说明固定：204 成功；401 可能是稳定业务码 `AUTH_INVALID_CURRENT_PASSWORD` 或鉴权 `UNAUTHORIZED`，客户端按 code 精确区分；422 只保留 schema/长度/`AUTH_PASSWORD_UNCHANGED` 等既有校验，**明确不迁移当前密码错误状态**。
  - auth 服务域补当前已实现的 profile/password 职责与 `profile/service.py` 入口；元信息保留 AUTH-001～008/BOOT-003，并新增“实现追溯”字段指向 BUG-001 + Account Self-Service plan，不复制 path/method/JSON、不挂新 PRD ID。
  - `docs/ui/layout.md` 执行 IA 评估并记录“无需改动”于 Bug 修复记录；只有实际改 IA 才修改源文件。
  - BUG-001 五个根因逐项更新状态，记录前后状态、实施计划/PRD 边界说明、命令与截图证据；`docs/bugs/README.md` 同步 BUG-001 状态和已修根因数。
  - 新 Bug Case 记录“业务 401 + 通用清会话副作用”的复用原则、错误做法、allowlist 防线与测试矩阵，并更新索引。
- **目标对应**：成功标准 6。
- **验证方式**：
  - `rg -n "PATCH.*?/api/v1/me.*AUTH-003|change-password.*AUTH-003|AUTH-003.*change-password" docs/api/README.md docs/services/auth.md docs/automate/prd.md docs/automate/prd/F02-AUTH.md`
  - 上述命令必须零命中当前登记；历史计划/BUG 根因中的旧事实保留，不做全仓“清零式”篡改。
  - `rg -n "AUTH-009|待人工|待回流" docs/automate/prd.md docs/automate/prd/F02-AUTH.md docs/automate/prd/README.md docs/api/README.md docs/services/auth.md` 必须零命中，证明无未授权 ID 或延期占位。
  - `rg -n "BUG-001|2026-07-08-account-self-service|Account Self-Service|backend/app/auth/profile|test_auth_profile|ChangePasswordSection" docs/automate/prd.md docs/automate/prd/F02-AUTH.md docs/automate/prd/README.md docs/api/README.md docs/services/auth.md docs/bugs`
  - `rg -n "feature_count: 129|16 域 · 129 项|AUTH-001 ~ AUTH-008|\\| F02-AUTH.md .* \\| 8 \\|" docs/automate/prd.md docs/automate/prd/README.md docs/services/auth.md`，确认功能计数、ID 范围与 F02 项数未漂移。

### Task 7. 执行代码与文档整体验证门禁

- **后端专项**：
  - `cd backend && python -m ruff check ../tests/test_auth_profile.py`
  - `cd backend && python -m pytest ../tests/test_auth_profile.py ../tests/test_me.py -q`
- **后端全量**：
  - `cd backend && python -m ruff check app ../tests`
  - `cd backend && python -m pytest -q`
- **前端专项**：
  - `cd fe && pnpm exec vitest run src/lib/api.test.ts src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
- **前端全量**：
  - `cd fe && pnpm run check:design`
  - `cd fe && pnpm test`
  - `cd fe && pnpm run build`
- **判定**：所有命令必须读取本轮输出并为 exit 0；不得用“预计通过”代替证据。若全量出现与本分支无关的既有失败，先用基线/专项证据隔离并如实标记 concern，不得静默跳过。
- **目标对应**：成功标准 5、6、7。

### Task 8. 完成真实浏览器基线与交互状态验收

- **环境**：
  1. 后端：`cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
  2. 前端：`cd fe && pnpm dev --host 127.0.0.1 --port 5173`
  3. 使用浏览器打开 `http://127.0.0.1:5173/admin/account/security`，通过开发环境登录；不得在产物中记录凭证。浏览器阶段不执行成功改密，只用故意错误当前密码触发失败态，避免修改开发账户。
- **6 张统一默认态基线**（目录固定 `docs/bugs/artifacts/BUG-001/`）：
  - `password-security-1440x1000-light-default.png`
  - `password-security-1440x1000-dark-default.png`
  - `password-security-1024x768-light-default.png`
  - `password-security-1024x768-dark-default.png`
  - `password-security-390x844-light-default.png`
  - `password-security-390x844-dark-default.png`
- **3 张额外交互状态证据**：
  - `password-security-1440x1000-dark-error-focus.png`：提交错误当前密码后，字段内联错误可读，当前密码输入保持 focus-visible，URL/用户态不变。
  - `password-security-1440x1000-dark-loading.png`：通过浏览器网络延迟保持 mutation pending，按钮展示“保存中…”、`aria-busy`、disabled，dark 对比清楚。
  - `password-security-390x844-dark-password-visible.png`：只点击显隐按钮，不提交；至少一个输入为 text，按钮 pressed 状态明确，无遮挡/横滚。
- **每个默认态视口检查**：
  - 无全宽卡片包裹窄表单形成的右侧大面积空白。
  - desktop/tablet 的双列或降级断点比例合理；mobile 单列且无水平滚动。
  - 标题、规则、字段、显隐按钮、错误文案、提交按钮无裁切/遮挡/重叠。
  - light/dark 边框、文字、helper 与按钮对比可读。
- **交互状态逐项浏览器断言**：
  - 三个显隐按钮 DOM `type=button`；逐一点击均不产生 change-password 请求，只有提交按钮产生一次。
  - 错误当前密码实际响应保持 401 + `AUTH_INVALID_CURRENT_PASSWORD`；URL 不跳 `/login`、token 仍在、页面用户态仍存在、当前密码字段获得焦点。
  - loading 期间重复点击不产生第二次请求。
- **证据要求**：保留 9 张精确路径及逐项浏览器断言摘要，写入 BUG-001 修复记录；任何 B Design 截图红线或状态断言失败，结论为 fail 或 pass-with-concerns，回到 Task 4/5 修复后重拍，不能用 RTL 测试代替。
- **目标对应**：成功标准 3、4、7。

## 执行顺序

```text
Task 1 apiFetch RED→GREEN
  ↓
Task 2 后端测试隔离/v1 状态/会话/审计 RED→GREEN
  ↓
Task 3 UI 交互 RED
  ↓
Task 4 UI/布局 GREEN→REFACTOR
  ↓
Task 5 前端语义集成回归
  ↓
Task 6 PRD/API/services/Bug 索引纠错（计数不变）
  ↓
Task 7 前后端全量门禁
  ↓
Task 8 真实浏览器 6 基线 + 3 状态截图
```

顺序理由：先锁定最危险的会话副作用、handler 生命周期和 API v1 兼容契约，再用隔离数据库证明后端边界，让页面测试消费稳定接口；文档在同一执行计划内完成 PRD 边界、API、服务域与 Bug 索引闭环，不留下外部 gate；浏览器截图放在构建与设计门禁后，避免对未稳定 UI 反复取证。

## 整体验收矩阵

| 场景 | HTTP/API | 页面反馈 | 会话 | 审计 | 自动化证据 |
|---|---|---|---|---|---|
| 当前密码错误 | **保持 401** + `AUTH_INVALID_CURRENT_PASSWORD`，allowlist 命中 | 当前密码字段内联错误并聚焦 | token/用户/路由保留 | 不新增成功审计 | apiFetch + AuthProvider 集成 + RTL + 隔离 pytest + 浏览器 |
| token 真失效 | 401 + 未 allowlist/无效 body | 登录过期 | 清 token + handler | 不适用 | apiFetch 单测 |
| 新密码过短/过长 | 既有 422/前端拦截，不迁移 | 新密码字段错误 | 保留 | 不新增 | RTL + 隔离 pytest |
| 新旧密码相同 | 既有 422 + `AUTH_PASSWORD_UNCHANGED`，不迁移 | 新密码字段错误 | 保留 | 不新增 | RTL + 隔离 pytest |
| 确认不匹配 | 不发请求 | 确认字段即时错误 | 保留 | 不新增 | RTL |
| 成功修改 | 204 | toast + 表单复位 | 本轮不做撤销 | 恰新增一条、无秘密 | RTL + 隔离 pytest |
| 网络/未知错误 | 非业务错误 | 区块提示且保留输入 | 不主动清除（除真实 401） | 不新增 | RTL |

## 九维自审

| 维度 | 自评 | 备注 |
|---|---|---|
| 目标-实现一致性 | 🟢 | 七项成功标准均映射到精确 Task、文件与证据 |
| 必要性 | 🟢 | 仅处理 BUG-001 链路、账户自服务既有实施追溯、索引纠错与强制 Bug Case；未夹带 MFA/找回/撤销或新 PRD ID |
| 正确性 | 🟢 | 保持 v1 业务 401；端点 allowlist 精确匹配，未知 401 fail-closed；既有 422 不迁移 |
| 完整性 | 🟢 | 覆盖成功/字段/网络/业务 401/真实 401、handler 清理、隔离审计、PRD/API/服务/Bug 索引、响应式与 dark 状态证据 |
| 一致性 | 🟢 | PRD 三处仅补非计数边界说明；AUTH-003、129 项与评分不变；遵守 FastAPI/前端分层和 prd-sync |
| 副作用 | 🟢 | `apiFetch` 默认行为不变；新契约 opt-in；handler 可清理；后端状态码与错误码不变；密码测试不触碰共享 admin |
| 降级合理性 | 🟢 | 只对显式 allowlist 精确码保留会话；解析失败/未知码不隐藏异常而是走安全登出；截图失败不得降级为 RTL 通过 |
| 顺序依赖 | 🟢 | 危险语义与全局 handler 生命周期先锁测试，再实现 UI，文档闭环/全量/浏览器依次收口 |
| 可验证性 | 🟢 | 每个 Task 都有 RED/GREEN 或可执行命令；视觉有 6 张默认基线、3 张 dark 交互状态与精确产物名 |

## 下一步推荐

本计划跨前端、后端、文档与浏览器验收且风险为 medium，应先由 dev-autopilot A4 `plan-review` 做独立审核；审核通过后仅由 `dev-autopilot A5 plan-execute` 执行。不得点击 Cursor Build，不执行生产发布或自动合并。
