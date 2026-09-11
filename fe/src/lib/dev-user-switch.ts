import { apiFetch, ApiRequestError } from "@/lib/api";
import { resolveApiBaseUrl } from "@/lib/appBasePath";
import { getAuthToken, setAuthToken } from "@/lib/auth-token";
import { resolveDefaultLandingPath } from "@/lib/defaultViewResolve";
import type { SessionRole } from "@/lib/session";

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

type UserOut = { id: string; username: string };
type UserListResponse = { items: UserOut[]; total: number };
type UserRolesResponse = { items: { id: string; code: string; name: string }[] };

export type DevSwitchableUser = UserOut & { roles: SessionRole[] };

const API_BASE = resolveApiBaseUrl();

/** 开发演示账号共用密码，与 backend `VITALSPAN_DEV_ADMIN_PASSWORD` 对齐 */
const DEV_USER_PASSWORD =
  import.meta.env.VITE_DEV_USER_PASSWORD ?? "changeme";

export function isDevUserSwitchEnabled(): boolean {
  return import.meta.env.DEV;
}

export async function fetchDevSwitchableUsers(): Promise<DevSwitchableUser[]> {
  const list = await apiFetch<UserListResponse>("/api/v1/users?limit=50&offset=0");
  const withRoles = await Promise.all(
    list.items.map(async (user) => {
      try {
        const rolesRes = await apiFetch<UserRolesResponse>(`/api/v1/users/${user.id}/roles`);
        const roles = rolesRes.items.map((r) => r.code as SessionRole);
        return { ...user, roles: roles.length ? roles : (["viewer"] as SessionRole[]) };
      } catch {
        return { ...user, roles: ["viewer"] as SessionRole[] };
      }
    }),
  );
  return withRoles;
}

async function loginAsDevUser(username: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: DEV_USER_PASSWORD }),
  });
  const body = (await response.json().catch(() => ({}))) as LoginResponse & {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ApiRequestError(
      body.message ?? "切换失败：该用户未设置开发密码",
      body.code,
    );
  }
  return body.accessToken;
}

async function switchViaDevEndpoint(username: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/api/v1/auth/dev-switch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
    body: JSON.stringify({ username }),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiRequestError(body.message ?? "切换用户失败", body.code);
  }
  const body = (await response.json()) as LoginResponse;
  return body.accessToken;
}

export async function switchDevUser(username: string): Promise<string | null> {
  const token =
    (await switchViaDevEndpoint(username)) ?? (await loginAsDevUser(username));
  setAuthToken(token);
  const me = await apiFetch<{ roles: string[] }>("/api/v1/me");
  return resolveDefaultLandingPath((me.roles ?? []) as SessionRole[]);
}
