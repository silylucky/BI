/**
 * Session role helpers. User identity comes from AuthProvider / GET /api/v1/me.
 */
import { hasCapability } from "@/lib/capabilities";

export type SessionRole = "admin" | "analyst" | "viewer";

export type SessionUser = {
  name: string;
  email: string;
  roles: SessionRole[];
  permissions?: string[];
  isRoot?: boolean;
};

export function sessionUserFromAuth(
  username: string,
  roles: SessionRole[],
  profile?: { displayName?: string; email?: string },
): SessionUser {
  return {
    name: profile?.displayName?.trim() || username,
    email: profile?.email?.trim() || `${username}@vitalspan.local`,
    roles,
  };
}

export function sessionUserFromMe(user: {
  username: string;
  displayName?: string;
  email?: string;
  roles: SessionRole[];
  permissions?: string[];
  isRoot?: boolean;
}): SessionUser {
  return {
    ...sessionUserFromAuth(user.username, user.roles, {
      displayName: user.displayName,
      email: user.email,
    }),
    permissions: user.permissions,
    isRoot: user.isRoot,
  };
}

export function canManagePlatform(user: SessionUser): boolean {
  return hasCapability(user, "system:*");
}

export function canEditDashboards(user: SessionUser): boolean {
  return hasCapability(user, "dashboard:edit");
}

export function canShareDashboards(user: SessionUser): boolean {
  return hasCapability(user, "dashboard:share");
}

const ROLE_LABELS: Record<SessionRole, string> = {
  admin: "管理员",
  analyst: "分析师",
  viewer: "查看者",
};

export function primaryRoleCode(roles: string[]): string {
  const sessionRoles = roles as SessionRole[];
  if (sessionRoles.includes("admin")) return "admin";
  if (sessionRoles.includes("analyst")) return "analyst";
  if (sessionRoles.includes("viewer")) return "viewer";
  return roles[0] ?? "viewer";
}

export function primaryRoleLabel(roles: SessionRole[]): string {
  const code = primaryRoleCode(roles) as SessionRole;
  return ROLE_LABELS[code] ?? code;
}
