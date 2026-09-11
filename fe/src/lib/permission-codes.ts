/** Backend permission catalog mirror — single source for routes/nav/tests. */

export const PERM_DATASOURCE_READ = "datasource:read";
export const PERM_DATASOURCE_MANAGE = "datasource:manage";

export const PERM_DASHBOARD_READ = "dashboard:read";
export const PERM_DASHBOARD_EDIT = "dashboard:edit";
export const PERM_DASHBOARD_SHARE = "dashboard:share";
export const PERM_DASHBOARD_SCHEDULE = "dashboard:schedule";

export const PERM_REPORT_READ = "report:read";
export const PERM_REPORT_MANAGE = "report:manage";
export const PERM_REPORT_EXPORT = "report:export";

export const PERM_VIZ_COMPONENT_READ = "viz:component.read";
export const PERM_VIZ_COMPONENT_MANAGE = "viz:component.manage";

export const PERM_THEME_READ = "theme:read";
export const PERM_THEME_MANAGE = "theme:manage";

export const PERM_SYSTEM_ROLE_READ = "system:role.read";
export const PERM_SYSTEM_USER_READ = "system:user.read";
export const PERM_SYSTEM_GRANT_READ = "system:grant.read";
export const PERM_SYSTEM_ORG_READ = "system:org.read";
export const PERM_SYSTEM_RLS_READ = "system:rls.read";
export const PERM_SYSTEM_AUDIT_READ = "system:audit.read";
export const PERM_SYSTEM_PLATFORM_CONNECT_READ = "system:platform_connect.read";
export const PERM_SYSTEM_ORG_SCOPED_MANAGE = "system:org_scoped.manage";

/** Route path → minimum capability (admin shell). */
export const ROUTE_PERMISSION_MATRIX: Record<string, string> = {
  "/admin/datasources": PERM_DATASOURCE_READ,
  "/admin/datasources/new": PERM_DATASOURCE_MANAGE,
  "/admin/dashboards": PERM_DASHBOARD_READ,
  "/admin/reports/center": PERM_REPORT_READ,
  "/admin/system": PERM_SYSTEM_ROLE_READ,
  "/admin/system/orgs": PERM_SYSTEM_ORG_READ,
  "/admin/system/users": PERM_SYSTEM_USER_READ,
  "/admin/system/roles": PERM_SYSTEM_ROLE_READ,
  "/admin/system/grants": PERM_SYSTEM_GRANT_READ,
  "/admin/system/platform-connect": PERM_SYSTEM_PLATFORM_CONNECT_READ,
  "/admin/system/auth-integration": PERM_SYSTEM_PLATFORM_CONNECT_READ,
  "/admin/system/rls": PERM_SYSTEM_RLS_READ,
  "/admin/system/audit": PERM_SYSTEM_AUDIT_READ,
};

/** System admin sidebar item path → capability. */
export const SYSTEM_ADMIN_NAV_CAPABILITIES: Record<string, string> = {
  "/admin/system": PERM_SYSTEM_ROLE_READ,
  "/admin/system/orgs": PERM_SYSTEM_ORG_READ,
  "/admin/system/users": PERM_SYSTEM_USER_READ,
  "/admin/system/roles": PERM_SYSTEM_ROLE_READ,
  "/admin/system/grants": PERM_SYSTEM_GRANT_READ,
  "/admin/system/platform-connect": PERM_SYSTEM_PLATFORM_CONNECT_READ,
  "/admin/system/auth-integration": PERM_SYSTEM_PLATFORM_CONNECT_READ,
  "/admin/system/rls": PERM_SYSTEM_RLS_READ,
  "/admin/system/audit": PERM_SYSTEM_AUDIT_READ,
};

export function systemAdminEntryCapability(path: string): string | undefined {
  return SYSTEM_ADMIN_NAV_CAPABILITIES[path];
}
