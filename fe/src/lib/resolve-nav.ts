import { NAV_MANIFEST } from "@/config/nav-manifest";
import { ACCOUNT_NAV_SECTIONS } from "@/config/account-nav";
import { SYSTEM_ADMIN_NAV_SECTIONS } from "@/config/system-admin-nav";
import { matchesCapability, resolveEffectiveCapabilities } from "@/lib/capabilities";
import { SYSTEM_ADMIN_NAV_CAPABILITIES } from "@/lib/permission-codes";
import {
  isAccountManagementPath,
  isSystemAdminPath,
} from "@/lib/workspace";
import type { NavSection, NavItem, NavSubItem } from "@/components/layout/app-sidebar";
import type { SessionUser, SessionRole } from "@/lib/session";

export const ACTIVE_MILESTONES = new Set(["M1", "M5", "M7", "M11", "M13"]);

export type ResolveNavOptions = {
  activeMilestones?: Set<string>;
  userCapabilities?: Set<string>;
  /** 测试专用：显式启用治理分组 */
  govNavEnabled?: boolean;
};

function isAdmin(user: SessionUser): boolean {
  return Boolean(user.isRoot) || user.roles.includes("admin");
}

function inferNavCapability(item: ManifestItem, section: ManifestSection): string | undefined {
  const explicit = item.capability ?? section.capability;
  if (explicit) return explicit;
  if (item.path?.startsWith("/admin/dashboards")) return "dashboard:read";
  if (item.path?.startsWith("/admin/data-screens")) return "dashboard:read";
  if (item.path?.startsWith("/admin/reports")) return "report:read";
  return undefined;
}

function canAccessByRoleOrCapability(
  user: SessionUser,
  roles: SessionRole[],
  capability: string | undefined,
  userCaps: Set<string>,
): boolean {
  if (isAdmin(user)) return true;
  if (capability && matchesCapability(userCaps, capability)) return true;
  if (hasRole(user, roles)) return true;
  return false;
}

function hasRole(user: SessionUser, roles: SessionRole[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

type ManifestItem = (typeof NAV_MANIFEST)[0]["items"][0];
type ManifestSection = (typeof NAV_MANIFEST)[0];

function filterSubItem(
  sub: NonNullable<ManifestItem["subItems"]>[0],
  sectionCap: string | undefined,
  userCaps: Set<string>,
  activeMilestones: Set<string>,
  user: SessionUser,
): NavSubItem | null {
  const requiredCap = sub.capability ?? sectionCap;
  if (requiredCap && !matchesCapability(userCaps, requiredCap)) return null;
  if (sub.milestone && !activeMilestones.has(sub.milestone) && !isAdmin(user)) return null;
  return { name: sub.name, path: sub.path };
}

function filterItemForRole(
  item: ManifestItem,
  section: ManifestSection,
  user: SessionUser,
  userCaps: Set<string>,
  activeMilestones: Set<string>,
): NavItem | null {
  if (!isAdmin(user) && item.iaPriority === "advanced") return null;

  const sectionCap = section.capability;
  const requiredCap = item.capability ?? sectionCap;
  const implicitCap = requiredCap ?? inferNavCapability(item, section);

  if (implicitCap) {
    if (!matchesCapability(userCaps, implicitCap)) return null;
  } else if (!item.subItems?.length) {
    const effectiveRoles = (item.roles as SessionRole[] | undefined) ?? section.roles;
    if (!canAccessByRoleOrCapability(user, effectiveRoles, undefined, userCaps)) return null;
  }

  const isInactive = Boolean(item.milestone && !activeMilestones.has(item.milestone));
  if (isInactive && !isAdmin(user)) return null;
  const addPreview = isInactive && isAdmin(user);

  let filteredSubItems: NavSubItem[] | undefined;
  if (item.subItems) {
    filteredSubItems = item.subItems
      .map((sub) => filterSubItem(sub, requiredCap ?? sectionCap, userCaps, activeMilestones, user))
      .filter((s): s is NavSubItem => s !== null);
    if (filteredSubItems.length === 0) return null;
  }

  return {
    name: item.name,
    icon: item.icon,
    ...(item.path ? { path: item.path } : {}),
    ...(addPreview ? { preview: true } : {}),
    ...(filteredSubItems ? { subItems: filteredSubItems } : {}),
    ...(item.badgeLabel ? { badgeLabel: item.badgeLabel } : {}),
  };
}

export function resolveNavGroups(
  user: SessionUser,
  options?: ResolveNavOptions,
): NavSection[] {
  const activeMilestones = options?.activeMilestones ?? ACTIVE_MILESTONES;
  const userCaps = options?.userCapabilities ?? resolveEffectiveCapabilities(user);
  const govNavEnabled = options?.govNavEnabled ?? false;
  const result: NavSection[] = [];

  for (const section of NAV_MANIFEST) {
    if (section.requiresGovNav && !govNavEnabled) continue;

    const sectionCap = section.capability;
    if (sectionCap) {
      if (!matchesCapability(userCaps, sectionCap)) continue;
    } else if (!canAccessByRoleOrCapability(user, section.roles, undefined, userCaps)) {
      const sectionAllowed = section.items.some((item) => {
        if (item.subItems?.length) {
          return item.subItems.some((sub) => {
            const subCap = sub.capability ?? section.capability ?? inferNavCapability(item, section);
            return subCap ? matchesCapability(userCaps, subCap) : false;
          });
        }
        const itemCap = inferNavCapability(item, section);
        return itemCap ? matchesCapability(userCaps, itemCap) : false;
      });
      if (!sectionAllowed) continue;
    }

    if (!isAdmin(user) && section.iaTier === "engineering") continue;

    const items: NavItem[] = [];
    for (const item of section.items) {
      const navItem = filterItemForRole(item, section, user, userCaps, activeMilestones);
      if (navItem) items.push(navItem);
    }
    if (items.length > 0) {
      result.push({
        title: section.title,
        items,
        ...(section.defaultCollapsed ? { defaultCollapsed: true } : {}),
      });
    }
  }
  return result;
}

export function resolveSidebarSections(
  user: SessionUser,
  pathname: string,
  options?: ResolveNavOptions,
): NavSection[] {
  if (isAccountManagementPath(pathname)) {
    return ACCOUNT_NAV_SECTIONS;
  }
  if (isSystemAdminPath(pathname)) {
    const userCaps = options?.userCapabilities ?? resolveEffectiveCapabilities(user);
    const filtered: NavSection[] = [];
    for (const section of SYSTEM_ADMIN_NAV_SECTIONS) {
      const items = section.items.filter((item) => {
        const required = SYSTEM_ADMIN_NAV_CAPABILITIES[item.path];
        if (!required) return matchesCapability(userCaps, "system:*");
        return matchesCapability(userCaps, required) || matchesCapability(userCaps, "system:*");
      });
      if (items.length > 0) {
        filtered.push({ ...section, items });
      }
    }
    return filtered;
  }
  return resolveNavGroups(user, options);
}
