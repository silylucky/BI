# 业务 401 与全局清会话副作用

- **ID**: CASE-2026-07-13-001
- **状态**: 已修复
- **影响**: fe · admin-ui · auth
- **首次发现**: 2026-07-13

## 症状

- 用户在「安全设置」输入错误当前密码后，被退出登录并跳转 `/login`。
- 页面无法在当前密码字段展示「当前密码不正确」。
- 后端返回的是带 `AUTH_INVALID_CURRENT_PASSWORD` 的业务 401，而非 token 失效。

## 根因

HTTP 401 在前端 `apiFetch` 中被无差别解释为「会话失效」：清 token → 调用 `registerUnauthorizedHandler`（AuthProvider 的 logout）→ 抛统一 `UNAUTHORIZED`。后端把「当前密码错误」编码为 401 + 稳定业务码，两者语义冲突。

## 错误做法（避免）

- 在通用请求层对所有 401 一律 `clearAuthToken()` + 全局 logout。
- 用布尔 `skipUnauthorizedHandler` 让业务页面绕过鉴权失败处理（过宽，易误吞真实 401）。
- 在未解析错误体前抛统一错误，丢失 `code`/`message`。
- 把 PATCH me / change-password 挂到 AUTH-003（用户角色绑定）做 PRD 追溯。

## 修复方式

1. **`apiFetch` 端点级 allowlist**：`preserveSessionOn401Codes?: readonly string[]`；仅当 401 响应 JSON 的 `code` 字符串与 allowlist **精确匹配**时保留 token、不调用 unauthorized handler，并抛原 `ApiRequestError`。
2. **change-password 调用**传 `preserveSessionOn401Codes: ["AUTH_INVALID_CURRENT_PASSWORD"]`。
3. **默认 fail-closed**：未知码、空 body、非法 JSON、缺 `message` 仍清 token + handler。
4. **`registerUnauthorizedHandler` 返回 unsubscribe**；测试/卸载用 `resetUnauthorizedHandler()`；AuthProvider effect cleanup。
5. **页面字段映射**：`AUTH_INVALID_CURRENT_PASSWORD` → 当前密码字段；`AUTH_PASSWORD_UNCHANGED` → 新密码字段。
6. **测试矩阵**：`api.test.ts` 四类 401；`ChangePasswordSession.integration.test.tsx` 真实 AuthProvider + stub fetch；`test_auth_profile.py` 同 token 连续 `/me`。

## 验证

- `cd fe && pnpm exec vitest run src/lib/api.test.ts src/pages/admin/account/components/ChangePasswordSession.integration.test.tsx`
- `cd backend && python -m pytest ../tests/test_auth_profile.py -q`
- 错误当前密码后 `localStorage` token 仍在，URL 仍为 `/admin/account/security`。

## 关联

- [BUG-001](../../../docs/bugs/BUG-001_account-password-security_2026-07-13.md)
- `fe/src/lib/api.ts` · `fe/src/pages/admin/account/components/ChangePasswordSection.tsx`
- `backend/app/auth/profile/service.py`
- `tests/test_auth_profile.py`
