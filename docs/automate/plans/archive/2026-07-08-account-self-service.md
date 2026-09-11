# Account Self-Service

Plan type: Headless Automation Plan  
Cursor Build: disabled  
Execution trigger: dev-autopilot A5 plan-execute

## 目标

补齐用户菜单「个人资料 / 账号设置」后端与前端闭环。

## 任务

1. Migration `0020`：`auth_users.display_name`、`auth_users.email`
2. `auth/profile/` 域服务 + `GET/PATCH /api/v1/me` + `POST /api/v1/auth/change-password`
3. FE：`AccountProfilePage` 可编辑；`ChangePasswordSection`；`/me/views` 重定向
4. 测试与 `docs/api/README.md` 登记

## 验证

- `pytest tests/test_auth_profile.py tests/test_me.py`
- `vitest run fe/src/pages/admin/account`
