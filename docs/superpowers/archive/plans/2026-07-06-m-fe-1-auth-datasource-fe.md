# M-FE-1 认证与数据源 FE companion 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `fe/`（login、api 客户端、datasources/connectors 页）+ `backend/app/auth/`（JWT/login）+ `backend/app/api/v1/auth.py` + 相关 pytest/fe smoke + `docs/api/README.md`
> **子项：** BOOT-003, BOOT-002, DS-002, DS-003, DS-007
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `fe/**` 匹配 `fe-ui.mdc`，`backend/**/*.py` 匹配 `backend-fastapi.mdc`）

**Goal:** 交付浏览器可感知的正式 JWT 登录、TanStack Query API 客户端，以及数据源 CRUD / 连通性测试 / 连接器类型只读页；移除 `Bearer dev` 与 `session.ts` 硬编码。

**Architecture:** 后端 PyJWT + bcrypt 登录链替换 middleware `dev` 分支；前端 `localStorage` token + `RequireAuth` 守卫 + `AuthProvider` 拉 `/me`；新业务页统一 `apiFetch` + TanStack Query + `mapApiError`；数据源页复用 `AdminPageShell` 与 SyncJobs 表格/错误条模式。

**Tech Stack:** FastAPI · PyJWT · bcrypt · SQLAlchemy · Alembic · React 19 · Vite · TanStack Query · Vitest · pytest · ruff

## Global Constraints

- 真理源：`docs/superpowers/evolution/2026-07-06-round-target.md` > `docs/superpowers/specs/2026-07-06-m-fe-1-auth-datasource-fe-design.md`
- 禁止修改 `docs/automate/goal.md`；P5 前不改 `plan.md` 结构
- 非目标：DS-004 Schema 浏览器、Dashboard 出数、用户/角色 Admin UI、OAuth/刷新 token、全面迁移既有页到 Query
- 错误体：`{"code": "<SNAKE>", "message": "...", "detail": null}`
- JWT 存储 key：`vitalspan:access_token`（localStorage）
- 开发默认管理员：`admin` / `VITALSPAN_DEV_ADMIN_PASSWORD`（默认 `changeme`，仅 development 迁移写入）
- 文件预算：新建 16 + 修改 12 = **28**（含测试/文档；业务源文件 ≤20，测试与 `docs/api` 登记不计入 round-target 业务上限）
- 后端验证：`cd backend && python3 -m ruff check . && python3 -m pytest -v`
- 前端验证：`cd fe && pnpm install && pnpm run check:design && pnpm test && pnpm build`

---

### Task 1: 后端 JWT 登录与鉴权中间件（BOOT-003）

**Files:**
- Create: `backend/app/auth/jwt.py`
- Create: `backend/app/auth/login/__init__.py`
- Create: `backend/app/auth/login/service.py`
- Create: `backend/app/api/v1/auth.py`
- Create: `backend/migrations/versions/0017_auth_user_password.py`
- Create: `tests/test_auth_login.py`
- Modify: `backend/app/auth/models.py`
- Modify: `backend/app/auth/middleware.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`
- Modify: `tests/conftest.py`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

**UI skill:** none

**Interfaces:**
- Consumes: `Settings.secret_key`, `Settings.vitalspan_dev_admin_password`, `user_service.resolve_role_codes_for_user`
- Produces: `create_access_token(user_id, username) -> str`; `decode_access_token(token) -> dict`; `authenticate(session, username, password) -> AuthUser`; `POST /api/v1/auth/login` → `{accessToken, tokenType, expiresIn}`; migration `0017`；`auth_headers` fixture 改为 JWT

- [ ] **Step 1: 在 `backend/pyproject.toml` dependencies 追加**

```toml
    "PyJWT>=2.9.0",
    "bcrypt>=4.2.0",
```

- [ ] **Step 2: 在 `backend/app/core/config.py` Settings 增加字段**

```python
    vitalspan_dev_admin_password: str = "changeme"
```

在 `backend/.env.example` 末尾追加：

```env
VITALSPAN_DEV_ADMIN_PASSWORD=changeme
```

- [ ] **Step 3: `backend/app/auth/models.py` — `AuthUser` 增加 `password_hash`**

```python
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, server_default="")
```

（新列由迁移填充；ORM 字段与迁移一致。）

- [ ] **Step 4: 创建 `backend/app/auth/jwt.py`**

```python
from __future__ import annotations

import time
from typing import Any

import jwt

from app.core.config import get_settings

ALGORITHM = "HS256"
DEFAULT_EXPIRES_MINUTES = 480


class JwtError(Exception):
    pass


def create_access_token(user_id: str, username: str, *, expires_minutes: int = DEFAULT_EXPIRES_MINUTES) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + expires_minutes * 60,
    }
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise JwtError("invalid token") from exc
```

- [ ] **Step 5: 创建 `backend/app/auth/login/service.py`**

```python
from __future__ import annotations

import uuid

import bcrypt
from sqlalchemy.orm import Session

from app.auth.models import AuthUser
from app.auth.users import service as user_service


class LoginError(Exception):
    def __init__(self, code: str, message: str, status: int = 401) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def authenticate(session: Session, username: str, password: str) -> AuthUser:
    user = user_service.get_user_by_username(session, username)
    if user is None or not user.password_hash:
        raise LoginError("AUTH_INVALID_CREDENTIALS", "用户名或密码错误", 401)
    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        raise LoginError("AUTH_INVALID_CREDENTIALS", "用户名或密码错误", 401)
    return user


def resolve_role_codes(session: Session, user_id: uuid.UUID) -> list[str]:
    return user_service.resolve_role_codes_for_user(session, user_id)
```

- [ ] **Step 6: 创建 `backend/migrations/versions/0017_auth_user_password.py`**

```python
"""auth user password_hash + dev admin seed

Revision ID: 0017
Revises: 0016
"""

from __future__ import annotations

import os
import uuid
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auth_users",
        sa.Column("password_hash", sa.String(255), nullable=False, server_default=""),
    )
    bind = op.get_bind()
    env = os.environ.get("VITALSPAN_ENV", "development")
    if env != "development":
        return
    password = os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    admin = bind.execute(
        sa.text("SELECT id FROM auth_users WHERE username = :u LIMIT 1"),
        {"u": "admin"},
    ).first()
    if admin:
        bind.execute(
            sa.text("UPDATE auth_users SET password_hash = :h WHERE username = 'admin'"),
            {"h": hashed},
        )
    else:
        user_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO auth_users (id, username, password_hash) VALUES (:id, 'admin', :h)"
            ),
            {"id": str(user_id), "h": hashed},
        )
        role = bind.execute(
            sa.text("SELECT id FROM auth_roles WHERE code = 'admin' LIMIT 1")
        ).first()
        if role:
            bind.execute(
                sa.text(
                    "INSERT INTO auth_user_roles (user_id, role_id) VALUES (:uid, :rid) "
                    "ON CONFLICT DO NOTHING"
                ),
                {"uid": str(user_id), "rid": str(role[0])},
            )


def downgrade() -> None:
    op.drop_column("auth_users", "password_hash")
```

- [ ] **Step 7: 创建 `backend/app/api/v1/auth.py`**

```python
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.login import service as login_service
from app.auth.jwt import create_access_token, DEFAULT_EXPIRES_MINUTES
from app.auth.models import get_meta_session

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")
    expires_in: int = Field(serialization_alias="expiresIn")

    model_config = {"populate_by_name": True}


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(_db)]) -> LoginResponse | JSONResponse:
    try:
        user = login_service.authenticate(db, payload.username, payload.password)
    except login_service.LoginError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )
    token = create_access_token(str(user.id), user.username)
    return LoginResponse(
        access_token=token,
        expires_in=DEFAULT_EXPIRES_MINUTES * 60,
    )
```

- [ ] **Step 8: `backend/app/api/v1/router.py` 挂载 auth**

```python
from app.api.v1.auth import router as auth_router
# ...
api_v1_router.include_router(auth_router)
```

（放在 `me_router` 之后。）

- [ ] **Step 9: 修改 `backend/app/auth/middleware.py`**

```python
PUBLIC_PATHS: frozenset[str] = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
})
```

删除 `token == "dev"` 整段；替换为：

```python
        from app.auth.jwt import JwtError, decode_access_token

        try:
            claims = decode_access_token(token)
            user_id = claims.get("sub")
            username = claims.get("username", "")
            if not user_id:
                return _unauthorized_response()
        except JwtError:
            return _unauthorized_response()

        session = get_meta_session()
        try:
            db_roles = user_service.resolve_role_codes_for_user(session, uuid.UUID(str(user_id)))
        except (OperationalError, ProgrammingError, ValueError):
            db_roles = []
        finally:
            try:
                session.close()
            except (OperationalError, ProgrammingError):
                pass
        request.state.user = UserContext(id=str(user_id), username=str(username), roles=db_roles or ["admin"])
        return await call_next(request)
```

文件顶部增加 `import uuid`。

- [ ] **Step 10: 创建 `tests/test_auth_login.py`**

```python
import pytest

from app.auth.jwt import create_access_token


def test_login_success_returns_access_token(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "changeme"},
    )
    if response.status_code == 401:
        pytest.skip("admin user not seeded; run migration 0017 in test DB")
    assert response.status_code == 200
    body = response.json()
    assert body["accessToken"]
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] > 0


def test_login_invalid_credentials_401(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_CREDENTIALS"


def test_me_with_jwt_returns_user(client, auth_headers):
    response = client.get("/api/v1/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert "admin" in body["roles"]
    assert body["id"] != "dev"


def test_bearer_dev_rejected(client):
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 401


def test_login_public_without_auth(client):
    response = client.post("/api/v1/auth/login", json={"username": "x", "password": "y"})
    assert response.status_code == 401
```

- [ ] **Step 11: 修改 `tests/conftest.py` `auth_headers` fixture**

```python
@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")},
    )
    if response.status_code == 200:
        token = response.json()["accessToken"]
        return {"Authorization": f"Bearer {token}"}
    # CI DB 未迁移时回退：直接签发 JWT（仍拒绝 Bearer dev）
    from app.auth.jwt import create_access_token

    token = create_access_token("00000000-0000-0000-0000-000000000001", "admin")
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 12: 运行验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_auth_login.py tests/test_me.py -v`

Expected: PASS（`test_me_with_bearer_dev_returns_200` 等依赖 `id=="dev"` 的用例在本 Task 一并改为 JWT 断言或删除 dev 专用用例）

- [ ] **Step 13: Commit**

```bash
git add backend/app/auth backend/app/api/v1/auth.py backend/migrations/versions/0017_auth_user_password.py backend/pyproject.toml backend/app/core/config.py backend/.env.example tests/test_auth_login.py tests/conftest.py tests/test_me.py
git commit -m "feat(auth): JWT login endpoint and middleware (BOOT-003)"
```

---

### Task 2: 前端登录、Token 与路由守卫（BOOT-003 FE）

**Files:**
- Create: `fe/src/lib/auth-token.ts`
- Create: `fe/src/context/auth-context.tsx`
- Create: `fe/src/components/auth/require-auth.tsx`
- Create: `fe/src/pages/login/LoginPage.tsx`
- Modify: `fe/src/lib/session.ts`
- Modify: `fe/src/lib/api.ts`（仅 token 头与 401 钩子骨架）
- Modify: `fe/src/components/layout/user-dropdown.tsx`
- Modify: `fe/src/layouts/AdminLayout.tsx`
- Modify: `fe/src/routes.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin 居中单卡登录（`form-composition`）；`Card` + `Button variant=primary` + `Input h-11`
- desktop 与 mobile 375px 登录页无溢出；错误态使用 `border-error-500` 提示条（同 SyncJobs `ErrorBanner` 语义类）
- 按钮 loading / 字段 `autoFocus` / 密码 `autoComplete=current-password`
- 无硬编码 hex；图标 `lucide-react` `size-4`

**Interfaces:**
- Consumes: Task 1 `POST /api/v1/auth/login`、`GET /api/v1/me`
- Produces: `getAuthToken()` / `setAuthToken()` / `clearAuthToken()`；`useAuth()` → `{user, isLoading, isAuthenticated, logout}`；`RequireAuth` 包裹 `/admin`；`api.ts` 不再含字面量 `Bearer dev`

- [ ] **Step 1: 创建 `fe/src/lib/auth-token.ts`**

```typescript
const STORAGE_KEY = "vitalspan:access_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: 修改 `fe/src/lib/api.ts` — 移除硬编码 dev token**

```typescript
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401) {
    clearAuthToken();
    onUnauthorized?.();
    throw new ApiRequestError("登录已过期，请重新登录", "UNAUTHORIZED");
  }
  // ...保留现有 ok / 204 / ApiRequestError 逻辑
}
```

- [ ] **Step 3: 创建 `fe/src/context/auth-context.tsx`**

```typescript
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { apiFetch, registerUnauthorizedHandler } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";
import type { SessionRole } from "@/lib/session";

export type AuthUser = {
  id: string;
  username: string;
  roles: SessionRole[];
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getAuthToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const me = await apiFetch<AuthUser>("/api/v1/me");
      setUser({ ...me, roles: me.roles as SessionRole[] });
    } catch {
      clearAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(logout);
    void refresh();
  }, [logout, refresh]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      logout,
      refresh,
    }),
    [user, isLoading, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 4: 修改 `fe/src/lib/session.ts`**

删除 `M1_SESSION` 与 `getSessionUser` 静态实现；保留：

```typescript
export type SessionRole = "admin" | "analyst" | "viewer";

export type SessionUser = {
  name: string;
  email: string;
  roles: SessionRole[];
};

export function sessionUserFromAuth(username: string, roles: SessionRole[]): SessionUser {
  return {
    name: username,
    email: `${username}@vitalspan.local`,
    roles,
  };
}

export function canManagePlatform(user: SessionUser): boolean {
  return user.roles.includes("admin");
}

export function canEditDashboards(user: SessionUser): boolean {
  return user.roles.includes("admin") || user.roles.includes("analyst");
}
```

- [ ] **Step 5: 创建 `fe/src/components/auth/require-auth.tsx`**

```typescript
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/context/auth-context";
import { getAuthToken } from "@/lib/auth-token";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const hasToken = Boolean(getAuthToken());

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
```

- [ ] **Step 6: 创建 `fe/src/pages/login/LoginPage.tsx`**

核心行为：已登录跳转 `/admin`；提交 `POST /api/v1/auth/login` → `setAuthToken` → `navigate(from || '/admin')`；错误用 `mapApiError`（Task 3 前可内联 `err instanceof Error ? err.message : '操作失败'`）。

布局：`min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4`；`Card` `max-w-md w-full`；字段用户名/密码；主按钮 `variant=primary` `disabled={submitting}`。

- [ ] **Step 7: 修改 `fe/src/routes.tsx`**

```typescript
import { RequireAuth } from "@/components/auth/require-auth";
import { LoginPage } from "@/pages/login/LoginPage";

// ...
<Route path="/login" element={<LoginPage />} />
<Route path="/admin" element={<RequireAuth />}>
  <Route element={<AdminLayout />}>
    <Route index element={<AdminHomePage />} />
    {/* 既有子路由保持不变 */}
  </Route>
</Route>
```

- [ ] **Step 8: 修改 `AdminLayout.tsx` 与 `user-dropdown.tsx` 使用 `useAuth()` + `sessionUserFromAuth`；退出调用 `logout()` 而非 `Link /login`**

- [ ] **Step 9: 修改 `fe/src/App.tsx` 包裹 `AuthProvider`（在 `BrowserRouter` 内）**

- [ ] **Step 10: 验证**

Run: `cd fe && pnpm run build`

Expected: 编译通过；`grep -r "Bearer dev" fe/src/lib/api.ts` 无匹配

- [ ] **Step 11: Commit**

```bash
git add fe/src/lib/auth-token.ts fe/src/context/auth-context.tsx fe/src/components/auth fe/src/pages/login fe/src/lib/session.ts fe/src/lib/api.ts fe/src/routes.tsx fe/src/layouts/AdminLayout.tsx fe/src/components/layout/user-dropdown.tsx fe/src/App.tsx
git commit -m "feat(fe): login page, JWT token storage and route guard (BOOT-003)"
```

---

### Task 3: API 客户端、mapApiError 与 TanStack Query（BOOT-002）

**Files:**
- Create: `fe/src/lib/apiError.ts`
- Create: `fe/src/lib/queryKeys.ts`
- Modify: `fe/src/lib/api.ts`（envelope 解析完善）
- Modify: `fe/src/App.tsx`（`QueryClientProvider`）
- Modify: `fe/package.json`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`（错误文案规范）

**UI skill:** none（基座层；页面在 Task 4–6）

**Interfaces:**
- Produces: `mapApiError(err: unknown): string`；`queryKeys` 注册表；`QueryClient` defaultOptions `{ queries: { retry: 1, staleTime: 30_000 } }`

- [ ] **Step 1: `fe/package.json` dependencies 增加**

```json
    "@tanstack/react-query": "^5.64.0",
```

Run: `cd fe && pnpm install`

- [ ] **Step 2: 创建 `fe/src/lib/apiError.ts`**

```typescript
import { ApiRequestError } from "@/lib/api";

const CODE_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "用户名或密码错误",
  UNAUTHORIZED: "登录已过期，请重新登录",
  DATASOURCE_IN_USE: "数据源正在被引用，无法删除",
  DATASOURCE_NOT_FOUND: "数据源不存在",
  DATASOURCE_TEST_INFLIGHT: "已有测试进行中，请稍候",
  VALIDATION_ERROR: "请检查表单填写是否正确",
};

export function mapApiError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code];
    if (err.message && !err.message.includes("traceId")) return err.message;
  }
  if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
    return err.message;
  }
  return "操作失败，请稍后重试";
}
```

- [ ] **Step 3: 创建 `fe/src/lib/queryKeys.ts`**

```typescript
export const queryKeys = {
  me: ["me"] as const,
  datasources: {
    all: ["datasources"] as const,
    list: (params?: { q?: string; type?: string }) => ["datasources", "list", params] as const,
    detail: (id: string) => ["datasources", "detail", id] as const,
  },
  connectorTypes: ["connectorTypes"] as const,
};
```

- [ ] **Step 4: `fe/src/App.tsx` 增加 QueryClientProvider**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: LoginPage 改用 `mapApiError`**

- [ ] **Step 6: 验证**

Run: `cd fe && pnpm test && pnpm build`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/package.json fe/pnpm-lock.yaml fe/src/lib/apiError.ts fe/src/lib/queryKeys.ts fe/src/App.tsx fe/src/pages/login/LoginPage.tsx
git commit -m "feat(fe): TanStack Query, mapApiError and API client base (BOOT-002)"
```

---

### Task 4: 连接器类型只读页（DS-007）

**Files:**
- Create: `fe/src/pages/admin/connectors/ConnectorsPage.tsx`
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/config/admin-nav.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- `AdminPageShell` + 只读 `Table`；`Badge` 展示 capabilities
- loading：`Skeleton` 行；empty：「暂无已注册连接器类型」；error：`ErrorBanner`+重试
- desktop 表格 `min-w-[720px]` 横向滚动；mobile 工具栏不重叠
- `pnpm run check:design` 无新增硬编码色

**Interfaces:**
- Consumes: `queryKeys.connectorTypes`, `GET /api/v1/datasources/types` → `{ items: [{ type, displayName, category, capabilities }] }`

- [ ] **Step 1: 创建 `ConnectorsPage.tsx`**

使用 `useQuery({ queryKey: queryKeys.connectorTypes, queryFn: () => apiFetch('/api/v1/datasources/types') })`；表格列：显示名称、类型标识、分类、能力 Badge。

- [ ] **Step 2: `admin-nav.tsx`「数据」分组**

```typescript
import { Cable, Database, ArrowLeftRight, LayoutDashboard, Settings } from "lucide-react";
// 数据源 path: '/admin/datasources'
// 新增连接器:
{
  name: "连接器",
  icon: <Cable className="size-6" aria-hidden />,
  path: "/admin/connectors",
},
```

- [ ] **Step 3: `routes.tsx` 注册**

```typescript
<Route path="connectors" element={<ConnectorsPage />} />
```

- [ ] **Step 4: 验证**

Run: `cd fe && pnpm run check:design && pnpm test:smoke`

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/connectors fe/src/routes.tsx fe/src/config/admin-nav.tsx
git commit -m "feat(fe): read-only connectors type list page (DS-007)"
```

---

### Task 5: 数据源列表与表单 CRUD（DS-002）

**Files:**
- Create: `fe/src/pages/admin/datasources/DatasourceListPage.tsx`
- Create: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`
- Modify: `fe/src/routes.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 列表 `crud-flow`：搜索 debounce 300ms、主按钮「新建数据源」、表格 skeleton/empty/error 三态
- 表单 `max-w-2xl` 单卡；`Select` 类型来自 `connectorTypes`；高级 `connectionOptions` 默认折叠（Radix Collapsible）
- 删除 `AlertDialog` 确认；409 展示 `mapApiError`
- 侧栏「数据源」高亮 `/admin/datasources`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /api/v1/datasources`；`DataSourceCreate` 字段对齐后端 camelCase `connectionOptions`

- [ ] **Step 1: `DatasourceListPage.tsx`**

`useQuery(queryKeys.datasources.list({ q }))`；删除 `useMutation` + `invalidateQueries(queryKeys.datasources.all)`。

- [ ] **Step 2: `DatasourceFormPage.tsx`**

`mode` 由路由区分：`/new` create、`/:id/edit` edit（code 只读）；create `POST`，edit `GET` 预填 + `PATCH`（password 空不传）。

- [ ] **Step 3: 路由注册**

```typescript
<Route path="datasources" element={<DatasourceListPage />} />
<Route path="datasources/new" element={<DatasourceFormPage mode="create" />} />
<Route path="datasources/:id/edit" element={<DatasourceFormPage mode="edit" />} />
```

- [ ] **Step 4: 验证**

Run: `cd fe && pnpm build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/datasources fe/src/routes.tsx
git commit -m "feat(fe): datasource list and create/edit forms (DS-002)"
```

---

### Task 6: 数据源详情与连通性测试（DS-003）

**Files:**
- Create: `fe/src/pages/admin/datasources/DatasourceDetailPage.tsx`
- Modify: `fe/src/routes.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 详情描述列表 Card；主操作「测试连接」`variant=primary`；次操作「编辑」outline
- 成功：`border-success` 风格提示 + `latencyMs`；失败：error 风格 + 错误码行；`traceId` 在 `<details>` 折叠
- 测试中按钮 disabled + 文案「测试中…」；429 映射「已有测试进行中，请稍候」
- 404 展示「数据源不存在」空态

**Interfaces:**
- Consumes: `GET /api/v1/datasources/{id}`；`POST /api/v1/datasources/{id}/test` → `{ ok, message, latencyMs, code?, traceId? }`

- [ ] **Step 1: 创建 `DatasourceDetailPage.tsx`**

`useQuery(queryKeys.datasources.detail(id))`；`useMutation` 调 test API；结果区用 semantic error/success 边框 div（与 SyncJobs ErrorBanner 同类 token）。

- [ ] **Step 2: 路由**

```typescript
<Route path="datasources/:id" element={<DatasourceDetailPage />} />
```

（放在 `datasources/:id/edit` **之前**或之后需注意 React Router 顺序：更具体的 `edit` 路由须先于 `:id`。）

正确顺序：

```typescript
<Route path="datasources" element={<DatasourceListPage />} />
<Route path="datasources/new" element={<DatasourceFormPage mode="create" />} />
<Route path="datasources/:id/edit" element={<DatasourceFormPage mode="edit" />} />
<Route path="datasources/:id" element={<DatasourceDetailPage />} />
```

- [ ] **Step 3: 列表页行操作增加「查看」链接到详情**

- [ ] **Step 4: 验证**

Run: `cd fe && pnpm test && pnpm run check:design`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/datasources/DatasourceDetailPage.tsx fe/src/routes.tsx fe/src/pages/admin/datasources/DatasourceListPage.tsx
git commit -m "feat(fe): datasource detail and connection test UI (DS-003)"
```

---

### Task 7: Smoke 测试、API 文档与 test_me 对齐

**Files:**
- Modify: `fe/src/routes.smoke.test.tsx`
- Modify: `tests/test_me.py`
- Modify: `docs/api/README.md`

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

**UI skill:** none

- [ ] **Step 1: 更新 `routes.smoke.test.tsx`**

新增用例（mock `useAuth` 或 mock token + apiFetch）：
- `/login` 渲染「登录」按钮
- 无 token 访问 `/admin/datasources` 重定向 `/login`（mock `getAuthToken` 返回 null）
- `/admin/connectors` 路由挂载（mock 认证 + types API）
- 更新 T-FE-08：`数据源` href 为 `/admin/datasources`

- [ ] **Step 2: 更新 `tests/test_me.py`**

将 `test_me_with_bearer_dev_returns_200` 改为断言 JWT `auth_headers` 且 `id != "dev"`；删除或改写 `test_me_bearer_dev_rejected_in_production` 为 JWT 在 production 仍有效（若 secret 一致）；保留 `test_me_concurrent_requests_stable` 但断言 username 来自 admin。

- [ ] **Step 3: `docs/api/README.md` login 行状态改为「已实现」**

- [ ] **Step 4: 全量验证**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest -v`

Run: `cd fe && pnpm run check:design && pnpm test && pnpm build`

Expected: 全部 exit 0

- [ ] **Step 5: Commit**

```bash
git add fe/src/routes.smoke.test.tsx tests/test_me.py docs/api/README.md
git commit -m "test(docs): smoke routes, JWT me tests and API registry (M-FE-1)"
```

---

## Spec Coverage Self-Review

| 子项 | 任务 |
|------|------|
| BOOT-003 登录/JWT/守卫 | Task 1–2 |
| BOOT-002 Query/apiError | Task 3 |
| DS-007 连接器只读 | Task 4 |
| DS-002 CRUD 页 | Task 5 |
| DS-003 连通性测试 UI | Task 6 |
| 测试与文档 | Task 7 |

## P3/P4 指针

- P3 每 Task 完成后执行 design §8.7 截图 QA（desktop + mobile 375px）与 `pnpm run check:design`
- P4 集成：docker compose 下 `admin/changeme` 登录 → 新建 PG 或 MySQL 源 → 详情页测试连接成功
- 文档同步评估：`docs/services/auth.md` JWT In/Out；`plan.md` M-FE-1 五行勾选留 P5
