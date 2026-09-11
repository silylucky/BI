# API · 认证与会话

| 字段 | 值 |
|------|-----|
| consumers | postman · apisix · 控制台联调 |
| 路由索引 | [README.md §1](./README.md#1-认证与会话) |
| 域附录 | [services/auth.md](../services/auth.md) |
| OpenAPI | `/openapi.json` tag `auth` |

## 概述

登录签发 **SM2 JWT**（`alg: SM2`）；业务 API 默认 `Authorization: Bearer <token>`。开发环境支持 `Bearer dev` 与 `POST /auth/dev-switch`（仅 `VITALSPAN_ENV=development`）。

## 环境与 Base URL

| 环境 | Base URL | 说明 |
|------|----------|------|
| local | `http://localhost:8000` | 与 `fe` Vite proxy 对齐 |
| staging | 见 `.dev/config.yaml` | 演示机登记 |
| prod | 客户部署域名 | HTTPS 强制 |

Postman 环境变量：`baseUrl`、`token`（登录后写入）。

## 鉴权

| 项 | 值 |
|----|-----|
| 认证方式 | Bearer JWT（SM2 签名） |
| 获取 token | `POST /api/v1/auth/login`（**免鉴权**） |
| 必要 Header | `Authorization: Bearer {{token}}` |
| 开发快捷 | `Authorization: Bearer dev`（仅 development） |

### AUTH-01 · POST `/api/v1/auth/login`

| 项 | 内容 |
|----|------|
| 鉴权 | 否 |
| 幂等 | 否 |
| 成功 | 200 + `accessToken` / `tokenType` / `expiresIn` |
| 主要错误 | 401 `AUTH_INVALID_CREDENTIALS` |

**请求示例**

```json
{
  "username": "admin",
  "password": "changeme"
}
```

**成功响应示例**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "bearer",
  "expiresIn": 3600
}
```

**curl**

```bash
curl -sS -X POST "$baseUrl/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'
```

### AUTH-02 · GET `/api/v1/me`

| 项 | 内容 |
|----|------|
| 鉴权 | 是 |
| 成功 | 200 用户资料（`id` / `username` / `displayName` / `roles`） |

```bash
curl -sS "$baseUrl/api/v1/me" -H "Authorization: Bearer $token"
```

### AUTH-03 · POST `/api/v1/auth/change-password`

| 项 | 内容 |
|----|------|
| 鉴权 | 是 |
| 成功 | 204 无 body |
| 错误 | 401 `AUTH_INVALID_CURRENT_PASSWORD` · 422 校验失败 |

## 网关 / APISix

| 项 | 内容 |
|----|------|
| 路由前缀 | `/api/v1/auth/*` · `/api/v1/me` |
| 插件建议 | `jwt-auth` 或上游 FastAPI 鉴权；login 路径放行 |
| 超时 | 与全局 API 一致（建议 ≤30s） |

直连服务，无独立 API 网关时由 FastAPI `AuthMiddleware` 统一鉴权。

## 冒烟清单

1. `GET /health` → `status=ok`
2. `POST /api/v1/auth/login` → 获得 `accessToken`
3. `GET /api/v1/me` 无 token → 401
4. `GET /api/v1/me` 带 token → 200 且 `username` 匹配

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-08-09 | 初版可消费：login/me/change-password + 冒烟 |
