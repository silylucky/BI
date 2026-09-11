# 频繁被踢回登录页（瞬时故障误清 token）

- **ID**: CASE-2026-07-17-002
- **状态**: 已修复
- **影响**: fe · auth · 管理端全局
- **首次发现**: 2026-07-17

## 症状

- 开发或使用中「总是退出登录」：刷新页面、后端 `uvicorn --reload` 重启、网络抖动后回到 `/login`
- `localStorage` 里 `vitalspan:access_token` 被清空
- 后端 JWT 有效期 8h，并非真正过期

## 根因

1. **`AuthProvider.refresh()`  fail-open 反了**：`GET /api/v1/me` 任意失败（`REQUEST_TIMEOUT`、连接拒绝、503）都 `clearAuthToken()`，把仍有效的 token 删掉
2. **`RequireAuth` 二次踢出**：有 token 但 `user===null` 且 `isAuthenticated===false` 时仍跳转登录（与 1 叠加）
3. **开发环境放大**：`uvicorn --reload` 重启窗口内 `/me` 失败极常见

## 错误做法（避免）

- 在 `refresh()` 的 `catch` 里无差别 `clearAuthToken()`
- `isAuthenticated` 仅 `Boolean(user)`，忽略本地仍有效的 token

## 修复方式

- `fe/src/lib/auth-session.ts`：`shouldClearAuthSession()` 仅 `UNAUTHORIZED` / `TOKEN_REVOKED` / 账户禁用/锁定 时清会话
- `fe/src/context/auth-context.tsx`：`refresh` 按上表清 token；`isAuthenticated = Boolean(user) || Boolean(getAuthToken())`
- 测试：`auth-session.test.ts`、`auth-context.session.test.tsx`

## 验证

```bash
cd fe && pnpm vitest run src/lib/auth-session.test.ts src/context/auth-context.session.test.tsx
```

- 登录后重启 uvicorn，硬刷新页面应仍在管理端（或短暂 loading 后恢复），不应清 token

## 关联

- `.agents/skills/bug-case-library/cases/auth-password-401-session-semantics.md`（业务 401 allowlist，不同层）
- `fe/src/context/auth-context.tsx`
- `fe/src/components/auth/require-auth.tsx`
