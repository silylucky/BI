import type { SessionRole, SessionUser } from "@/lib/session";

const BUILTIN_ROLE_CAPABILITIES: Record<SessionRole, readonly string[]> = {
  admin: [
    "system:*",
    "datasource:*",
    "ingestion:read",
    "ingestion:manage",
    "dashboard:read",
    "dashboard:edit",
    "dashboard:share",
    "dashboard:template.manage",
    "viz:component.manage",
    "report:*",
    "governance:*",
    "theme:*",
    "metadata:*",
    "dataset:*",
  ],
  /** analyst 可消费报表、管理本人看板定时推送，并维护组织可视化模板 */
  analyst: [
    "dashboard:edit",
    "dashboard:share",
    "dashboard:schedule",
    "dashboard:template.manage",
    "report:read",
    "theme:*",
  ],
  viewer: ["dashboard:read", "report:read"],
};

/** 测试或二期可注入自定义 role → capability 映射 */
export const OPTIONAL_ROLE_CAPABILITY_MAP: Record<string, readonly string[]> = {};

export function resolveUserCapabilities(roles: string[]): Set<string> {
  const caps = new Set<string>();
  for (const role of roles) {
    const builtin = BUILTIN_ROLE_CAPABILITIES[role as SessionRole];
    if (builtin) {
      builtin.forEach((c) => caps.add(c));
      continue;
    }
    const custom = OPTIONAL_ROLE_CAPABILITY_MAP[role];
    if (custom) custom.forEach((c) => caps.add(c));
  }
  return caps;
}

/** 合并内置角色能力与后端精确权限码（AUTHZ 矩阵）；root 视为全通配 */
export function resolveEffectiveCapabilities(user: SessionUser): Set<string> {
  if (user.isRoot) {
    return new Set(["*"]);
  }
  const caps = new Set<string>();
  const perms = user.permissions ?? [];
  if (perms.length > 0) {
    for (const permission of perms) {
      caps.add(permission);
    }
    return caps;
  }
  if (import.meta.env.DEV) {
    return resolveUserCapabilities(user.roles);
  }
  return caps;
}

export function matchesCapability(userCaps: Set<string>, required: string): boolean {
  if (userCaps.has("*")) return true;
  if (userCaps.has(required)) return true;
  const colon = required.indexOf(":");
  if (colon === -1) return false;
  const prefix = required.slice(0, colon);
  if (userCaps.has(`${prefix}:*`)) return true;
  if (required.endsWith(":read")) {
    const manage = `${prefix}:manage`;
    const edit = `${prefix}:edit`;
    if (userCaps.has(manage) || userCaps.has(edit)) return true;
  }
  if (!required.endsWith(":*")) return false;
  for (const cap of userCaps) {
    if (cap === required) return true;
    if (cap.startsWith(`${prefix}:`)) return true;
  }
  return false;
}

export function hasCapability(user: SessionUser, required: string): boolean {
  return matchesCapability(resolveEffectiveCapabilities(user), required);
}
