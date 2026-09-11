# LDAP / OIDC 认证集成规格（Spec Gate）

> **状态**：Phase C5 骨架已落地（管理入口 + OIDC 回调占位 + 本规格文档）。  
> **完整实现**：须在本规格评审通过后方可开发 LDAP 绑定与 OIDC token 交换。

## 1. 目标

- 支持企业目录（LDAP/AD）与 OIDC IdP 作为可选登录来源
- 本地账户（用户名密码 + 国密 SM3）保持为兜底路径
- IdP 失败 **不得** 静默放行或自动创建弱权限账户

## 2. 非目标（本阶段）

- SAML 2.0、SCIM 自动同步
- 多租户 IdP 隔离
- MFA 组合策略

## 3. 架构锚点

| 组件 | 路径 |
|------|------|
| OIDC 回调占位 | `backend/app/auth/login/oidc.py` |
| 集成状态 API | `GET /api/v1/auth-integration/status` |
| OIDC 回调 API | `POST /api/v1/auth-integration/oidc/callback` |
| 管理页 | `fe/src/pages/admin/system/auth-integration/AuthIntegrationPage.tsx` |

## 4. OIDC 流程（目标态）

1. 用户点击「OIDC 登录」→ 重定向至 IdP `authorize` 端点（`state` + `nonce` 入库）
2. IdP 回调 `POST /api/v1/auth-integration/oidc/callback`，携带 `code`
3. 后端换 token、校验 `id_token`（JWKS）、映射 `sub` → 本地 `auth_users`
4. 签发平台 JWT（SM2，`tokenVersion` 与本地用户一致）
5. 审计：`auth.login.oidc`（成功/失败均记录）

## 5. LDAP 流程（目标态）

1. 管理员在「认证集成」配置 host、bind DN、搜索 base、组映射规则
2. 登录时 `bind` 验证用户密码（LDAPS 优先）
3. 组 → 角色映射表写入 `auth_user_roles`（幂等）
4. 禁止将 LDAP 密码哈希落库

## 6. 配置与密钥

- 配置存储：平台元库 + 管理面（`system:platform_connect.manage` 或专用权限分期）
- 客户端密钥：SM4 加密，经 `CREDENTIAL_SM4_KEY`
- **禁止** env 开关启用 LDAP/OIDC（`VITALSPAN_ENV` 仅部署标识）

## 7. 验收门禁（实现前 checklist）

- [ ] integration-research 简报：`docs/integrations/oauth-oidc.md`（或 LDAP 等价）
- [ ] `$HOME/.dev` 登记 IdP 沙箱端点
- [ ] 失败语义单测：IdP 超时、无效 `state`、未绑定用户
- [ ] 审计事件可在「审计日志」筛选 `auth.login.oidc` / `auth.login.ldap`

## 8. Phase C 已交付（骨架）

- 权限目录无新增登录权限（登录仍为公开 `/api/v1/auth/login`）
- `handle_oidc_callback` 返回 `501 AUTH_EXTERNAL_NOT_CONFIGURED`
- 前端「认证集成」导航项与状态页
