# BUG-001：账户修改密码布局、交互与会话语义错位

> 最近更新 2026-07-13（修复合入）

| 字段 | 值 |
|------|-----|
| 状态 | ✅ 已修复（fixed）· 浏览器验收完成 |
| 优先级 | P0 |
| 发现日期 | 2026-07-13 |
| 修复分支 | `fix/account-password-security` |
| 影响范围 | `/admin/account/security` 修改密码完整链路 |
| 数据来源 | 源码、自动化测试、文档纠错；浏览器截图见 `artifacts/BUG-001/` |

## 问题总览

| # | 根因 | 状态 | 优先级 |
|---|------|------|--------|
| 1 | 业务校验失败复用全局 401 会话失效语义 | ✅ 已修复 | P0 |
| 2 | 表单仅提供块级错误，字段校验与可访问状态不完整 | ✅ 已修复 | P1 |
| 3 | 测试未覆盖提交、错误语义与会话连续性 | ✅ 已修复 | P1 |
| 4 | API 登记把自服务修改密码错误追溯到 AUTH-003 | ✅ 已修复 | P1 |
| 5 | 全宽卡片包裹窄表单，页面内容比例失衡 | ✅ 已修复 | P2 |

## 修复记录（2026-07-13）

| 项 | 修复前 | 修复后 |
|----|--------|--------|
| 401 语义 | 所有 401 清 token + logout | change-password 对 `AUTH_INVALID_CURRENT_PASSWORD` 保留会话；其余 401 fail-closed |
| 表单 UX | 块级错误、无显隐、无字段 aria | 双列布局、字段错误、`RequiredLabel`、独立显隐、loading 防重复提交 |
| 测试 | 3 条渲染断言 | `api.test.ts` 14 项；smoke 11 项；integration 会话保留；`test_auth_profile.py` 10 项 |
| 文档 | PATCH me / change-password 挂 AUTH-003 | PRD 列 `—`；追溯 BUG-001 + Account Self-Service plan |
| 布局 | 全宽 section + `max-w-md` 表单 | `max-w-5xl` + lg 双列（表单 + 密码规则） |

**验证命令**：

- `cd fe && pnpm exec vitest run src/lib/api.test.ts src/pages/admin/account/components/changePasswordForm.test.ts src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
- `cd backend && python -m pytest ../tests/test_auth_profile.py -q`

**浏览器验收（2026-07-13）**：`docs/bugs/artifacts/BUG-001/` 共 9 张截图（6 基线 + 3 交互态）。Playwright 断言：错误当前密码后 URL 仍为 `/admin/account/security`；loading 按钮显示「保存中…」；显隐后 `#current-password` 为 `type=text`。

**本地环境配置**：复制主工作区 `backend/.env` + `fe/.env`（注释 `VITE_API_BASE_URL` 以走 Vite proxy）；PostgreSQL 5432 已运行；admin 密码与 `.env` 对齐。

---

## 现象描述

- [用户反馈] 打开“安全设置”后，修改密码卡片占满内容区，但表单只位于左侧窄列，右侧出现大面积空白。
- [用户反馈] 字段交互与错误反馈不完整，难以明确哪个字段需要修正。
- [用户反馈] 输入错误当前密码后被退出登录；预期是保留会话并在当前密码字段附近提示错误。
- [代码确认] 前端现有 smoke 只确认三个 Label 可渲染，没有执行密码提交或错误分支。
- [代码确认] API 文档将修改密码登记为 `AUTH-003`，而 PRD 中 `AUTH-003` 的定义是“用户角色绑定”。

影响次数和线上发生率无法从当前材料量化：本轮没有运行日志、埋点、数据库事件或浏览器录屏。下文仅量化静态分支与测试覆盖，不把用户反馈次数推断为线上失败率。

---

## 失败过程还原

### 关键数据

- 后端已有 1 条错误当前密码测试，明确断言响应为 `401`。
- `apiFetch` 对 `401` 只有 1 个无差别分支，先清 token、调用未授权处理器，再抛统一 `UNAUTHORIZED`。
- `AuthProvider` 注册的未授权处理器就是 `logout`，会再次清 token、清空用户并跳转 `/login`。
- 前端修改密码组件仅有 1 条 smoke，包含 3 个渲染断言，提交与失败路径断言均为 0。

### 时序图

| Seq | 动作 | 输入/参数 | 结果 | 证据来源 | 说明 |
|-----|------|---------|------|---------|------|
| 1 | 用户提交修改密码 | 错误 `currentPassword` | 请求进入 `/api/v1/auth/change-password` | L1（代码） | `ChangePasswordSection.tsx:24-35` |
| 2 | 后端校验当前密码 | `bcrypt.checkpw(...) == false` | 抛出 `AUTH_INVALID_CURRENT_PASSWORD`，HTTP 401 | L1（代码） | `service.py:102-106` |
| 3 | API 路由映射域错误 | `ProfileError.status == 401` | 返回 `{code,message,detail}` | L1（代码） | `auth.py:64-68,71-88` |
| 4 | 前端通用请求层收到 401 | 任意 API 的 401 | 清 token，调用全局未授权处理器；响应体未解析 | L1（代码） | `api.ts:49-53` |
| 5 | AuthProvider 执行 logout | 已注册 handler | 清用户并跳转 `/login` | L1（代码） | `auth-context.tsx:38-42,68-71` |
| 6 | 组件收到异常 | 统一 `UNAUTHORIZED` | 原始“当前密码不正确”丢失；页面已发生导航 | L1（代码） | `ChangePasswordSection.tsx:42-44`、`apiError.ts:3-6,23-31` |

**关键转折点**：Seq 2 把“已认证用户的业务字段校验失败”编码成 401；Seq 4 又把所有 401 解释为“登录已过期”。两个局部约定组合后，形成错误登出。

**证据缺口**：未执行浏览器复现，因此“实际页面发生过几次跳转”仍属于 [用户反馈]；但在 `AuthProvider` 已挂载且请求走 `apiFetch` 的正常应用路径中，上述调用链由代码确定。

---

## 根因 1：业务校验失败复用全局 401 会话失效语义 🔲 待修复

**代码证据**：

`backend/app/auth/profile/service.py:102-108`

```python
user = user_service.get_user(session, user_id)
if not user.password_hash:
    raise ProfileError("AUTH_PASSWORD_NOT_SET", "Password is not configured for this account", 422)
if not bcrypt.checkpw(current_password.encode(), user.password_hash.encode()):
    raise ProfileError("AUTH_INVALID_CURRENT_PASSWORD", "当前密码不正确", 401)
if current_password == new_password:
    raise ProfileError("AUTH_PASSWORD_UNCHANGED", "新密码不能与当前密码相同", 422)
```

`fe/src/lib/api.ts:49-53`

```ts
if (response.status === 401) {
  clearAuthToken();
  onUnauthorized?.();
  throw new ApiRequestError("登录已过期，请重新登录", "UNAUTHORIZED");
}
```

`fe/src/context/auth-context.tsx:38-42,68-71`

```ts
const logout = useCallback(() => {
  clearAuthToken();
  setUser(null);
  navigate("/login", { replace: true });
}, [navigate]);

useEffect(() => {
  registerUnauthorizedHandler(logout);
  void refresh();
}, [logout, refresh]);
```

**数据流**：

```text
错误当前密码
→ profile.change_password 抛 AUTH_INVALID_CURRENT_PASSWORD/401
→ auth 路由原样返回 401
→ apiFetch 不解析错误体，清除 localStorage token
→ onUnauthorized 调用 AuthProvider.logout
→ user=null + navigate("/login")
→ 组件最多只能收到被替换后的 UNAUTHORIZED
```

**影响量化**：静态路径中，后端错误当前密码分支 1/1 返回 401；前端 401 分支 1/1 都执行 token 清理。只要该请求走正常 `AuthProvider + apiFetch` 路径，登出副作用是确定的。线上触发次数未知。

**根因关系**：这是用户被登出的直接根因；根因 3 没有覆盖会话连续性，使该冲突未被自动化测试阻断。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P0 | 将“当前密码错误”改为不会表示 token 失效的业务校验状态（建议 400 或 422），保留稳定错误码 `AUTH_INVALID_CURRENT_PASSWORD` | `backend/app/auth/profile/service.py:105-106`、`tests/test_auth_profile.py:118-126` | 低 |
| P0 | 前端按错误码把该错误落到当前密码字段；不得触发全局未授权处理 | `fe/src/pages/admin/account/components/ChangePasswordSection.tsx:42-44` | 中 |
| P1 | 明确通用请求层只在真正的认证失效响应上清会话；如仍需区分多类 401，应先解析契约错误码再决定副作用 | `fe/src/lib/api.ts:49-64` | 中 |

---

## 根因 2：表单仅提供块级错误，字段校验与可访问状态不完整 🔲 待修复

**代码证据**：

`fe/src/pages/admin/account/components/ChangePasswordSection.tsx:22-28,61-102`

```tsx
const [error, setError] = useState<string | null>(null);

if (form.newPassword !== form.confirmPassword) {
  throw new Error("两次输入的新密码不一致");
}

<Label htmlFor="current-password">当前密码</Label>
<Input id="current-password" type="password" required />
// ...
{error ? <p className="text-theme-xs text-error-600 dark:text-error-400">{error}</p> : null}
```

`backend/app/auth/profile/schemas.py:37-41`

```python
class ChangePasswordIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(min_length=1, alias="currentPassword")
    new_password: str = Field(min_length=8, max_length=128, alias="newPassword")
```

项目规则 `.cursor/rules/fe-ui.mdc:73-78` 要求必填项使用 `RequiredLabel`，字段错误紧贴输入框并设置 `aria-invalid`；当前组件三个必填 Label 均为普通 `Label`，三个 Input 均未设置 `aria-invalid`/`aria-describedby`，错误只在表单末尾渲染一个 `<p>`。

**数据流**：

```text
输入变化
→ 只更新 form 字符串
→ 浏览器仅处理 required/minLength
→ 确认密码不一致在 mutationFn 内抛普通 Error
→ mapApiError 转成单个 error 字符串
→ 表单底部块级展示，未关联具体 Input
```

**影响量化**：

- 3/3 密码字段没有字段级错误状态或错误描述关联。
- 3/3 必填字段未使用项目规定的 `RequiredLabel`。
- 1/1 确认密码不一致校验只进入块级错误。
- 前端对后端 `newPassword` 最大 128 字符约束覆盖为 0/1；超长值只能提交后由后端拒绝。
- 运行时用户失败次数未知。

**根因关系**：根因 1 丢弃原始后端错误码后，根因 2 更无法把“当前密码不正确”定位到对应字段。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P1 | 建立 `currentPassword/newPassword/confirmPassword` 字段错误模型，失焦或提交时校验；错误紧贴字段并设置 `aria-invalid`、`aria-describedby` | `ChangePasswordSection.tsx:16-108` | 中 |
| P1 | 对齐后端 1/8/128 长度契约，并校验确认密码一致、新密码不等于当前密码 | `ChangePasswordSection.tsx:24-35,61-100` | 低 |
| P1 | 使用项目必填 Label 模式，确保提交失败后焦点落到首个无效字段 | `ChangePasswordSection.tsx:61-100` | 中 |
| P2 | 评估密码显示/隐藏控件时，应按设计系统 Tooltip/IconButton 与键盘可访问规则实现；当前需求文档未明确要求，不能仅凭偏好认定为既有缺陷 | 设计与验收阶段 | 中 |

---

## 根因 3：测试未覆盖提交、错误语义与会话连续性 🔲 待修复

**代码证据**：

`fe/src/pages/admin/account/components/ChangePasswordSection.smoke.test.tsx:13-21`

```tsx
describe("ChangePasswordSection smoke", () => {
  afterEach(() => cleanup());

  it("renders password form fields", () => {
    render(wrap(<ChangePasswordSection />));
    expect(screen.getByLabelText("当前密码")).toBeInTheDocument();
    expect(screen.getByLabelText("新密码")).toBeInTheDocument();
    expect(screen.getByLabelText("确认新密码")).toBeInTheDocument();
  });
});
```

`tests/test_auth_profile.py:118-126`

```python
def test_change_password_wrong_current_returns_401(profile_client: TestClient):
    # ...
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_CURRENT_PASSWORD"
```

**数据流**：

```text
FE 测试 render
→ 只查询三个 Label
→ 从未触发 mutation/apiFetch/onError

BE 测试提交错误当前密码
→ 把 401 固化为期望
→ 不使用原 token 再请求 /api/v1/me
→ 无法验证“业务校验失败后会话仍有效”
```

**影响量化**：

- 前端 1 条测试、3 个断言；提交成功、确认密码不一致、错误当前密码、字段可访问性、pending、API payload、会话不登出覆盖均为 0。
- 后端修改密码有成功和错误当前密码测试各 1 条，但会话连续性断言为 0。
- 当前测试会把根因 1 的错误状态码视为正确行为。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P1 | 将 FE smoke 提升为交互测试，覆盖 payload、成功清空、确认不一致、字段错误、pending 与错误当前密码不触发全局 logout | `ChangePasswordSection.smoke.test.tsx` | 中 |
| P1 | 更新后端错误当前密码契约断言，并用同一 token 再请求 `/api/v1/me` 验证会话仍有效 | `tests/test_auth_profile.py:118-126` | 低 |
| P1 | 为 `apiFetch` 增加 401 分类测试：真实会话失效应清 token；业务错误不得误清 token | `fe/src/lib/api.ts` 对应测试文件 | 中 |
| P2 | 增加 desktop/tablet/mobile、light/dark 的浏览器视觉验收，防止布局空白回归 | 账户安全页浏览器验收 | 中 |

---

## 根因 4：API 登记把自服务修改密码错误追溯到 AUTH-003 🔲 待修复

**代码证据**：

`docs/api/README.md:47`

```markdown
| POST | `/api/v1/auth/change-password` | 自服务修改密码（`currentPassword`/`newPassword`；审计 `password.change`） | 内部 | 一期 | AUTH-003 | 已实现 | `backend/app/api/v1/auth.py` |
```

`docs/automate/prd/F02-AUTH.md:32-42`

```markdown
### [AUTH-003] 用户角色绑定

- **描述**：用户角色绑定（SRS 追溯项）。
- **验收标准**：
  - [x] 用户与角色多对多绑定
  - [x] 变更有审计记录
```

`docs/automate/plans/archive/2026-07-08-account-self-service.md:7-16` 把修改密码列为 Account Self-Service 实施任务，但没有给出对应 PRD ID。API 登记因此引用了语义不相干的 `AUTH-003`。

**数据流**：

```text
Account Self-Service 实施计划（无 PRD ID）
→ API README 登记 change-password
→ 复用 AUTH-003
→ PRD 查询落到“用户角色绑定”
→ 修改密码验收、测试与代码锚点无法从权威 PRD 分片追溯
```

**影响量化**：目标路由 1/1 的 PRD 追溯 ID 错位；`AUTH-003` 分片中与修改密码相关的验收标准和代码锚点为 0。此处只确认修改密码行，不据此推断其他 API 行的归属。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P1 | 先在 PRD hub/F02-AUTH 中定位或新增账户自服务的正式功能项，再把 change-password 路由改挂该 ID；不得继续借用 AUTH-003 | `docs/automate/prd.md`、`docs/automate/prd/F02-AUTH.md`、`docs/api/README.md:47` | 中 |
| P1 | 在正式功能项补入错误当前密码不终止有效会话、字段错误与测试锚点，保证修复验收可追溯 | 对应 PRD 分片 | 中 |
| P2 | 将 `2026-07-08-account-self-service.md` 的验证项与最终测试文件/用例对齐 | `docs/automate/plans/archive/2026-07-08-account-self-service.md:18-21` | 低 |

---

## 根因 5：全宽卡片包裹窄表单，页面内容比例失衡 🔲 待修复

**代码证据**：

`fe/src/pages/admin/account/AccountSecurityPage.tsx:4-11`

```tsx
<AdminPageShell
  title="安全设置"
  description="管理登录密码与账户安全偏好。"
>
  <ChangePasswordSection />
</AdminPageShell>
```

`fe/src/pages/admin/account/components/ChangePasswordSection.tsx:47-54`

```tsx
<section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
  <h2>修改密码</h2>
  <p>更新当前账号的登录密码。</p>
  <form className="mt-4 grid max-w-md gap-4">
```

`AdminPageShell` 默认只提供页面级 `grid gap-6`，没有约束子项宽度（`fe/src/components/layout/admin-page-shell.tsx:23-28,47`）。因此 section 按网格 stretch 占满内容区，而内部 form 被 `max-w-md` 限宽。设计系统 Skill `SKILL.md:128-139` 明确把“大面积无意义空白”和主内容列比例异常判为视觉失败。

**数据流**：

```text
AdminPageShell 默认全内容宽度
→ ChangePasswordSection 的 section 被 grid stretch
→ 内部 form 最大宽度 max-w-md
→ 宽屏下卡片继续扩张、表单不扩张
→ [用户反馈] 右侧形成大面积空白
```

**影响量化**：页面唯一 1 张业务卡片为全宽容器，唯一 1 个表单被限为 `max-w-md`；静态结构确认比例冲突。空白像素占比和各 viewport 视觉失败率尚无截图证据，不能量化。

### 待办

| 优先级 | 建议方案 | 位置 | 改动难度 |
|--------|---------|------|---------|
| P2 | 依据表单页面组合规范选择稳定布局：约束整个安全设置内容列，或使用有信息密度的响应式双列/说明区；不要只在全宽空卡片内放左侧窄表单 | `AccountSecurityPage.tsx:4-11`、`ChangePasswordSection.tsx:47-108` | 中 |
| P2 | 在 desktop/tablet/mobile 与 light/dark 下截图核验，量化内容宽度、空白和断点表现后再定稿 | 账户安全页 | 中 |

---

## 建议修复顺序

| 顺序 | 优先级 | 收口目标 |
|------|--------|----------|
| 1 | P0 | 先消除错误当前密码导致 token 清理和导航的会话语义冲突 |
| 2 | P1 | 补字段级校验、错误码映射与可访问状态 |
| 3 | P1 | 补前后端回归测试，覆盖会话连续性和 401 分类 |
| 4 | P1 | 修正 PRD/API 追溯关系与验收锚点 |
| 5 | P2 | 重构页面内容比例并完成多 viewport、双主题视觉验收 |

## 启示

1. HTTP 401 在前端具有清会话副作用时，后端不能再把普通业务校验失败编码成 401。
2. 通用请求层的破坏性副作用必须建立在可区分的认证失效语义上，不能只看状态码。
3. 安全表单不能以“字段能渲染”作为测试完成标准，至少应覆盖失败定位、会话连续性和契约边界。
4. API 登记必须先有正式 PRD 功能项，不能借用名称相近但业务含义不同的 ID。
5. 表单宽度应与承载容器共同设计；限制输入列宽不等于完成页面布局。
