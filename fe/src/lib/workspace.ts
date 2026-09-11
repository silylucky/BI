/** 用户工作台默认入口（消费态 Dashboard 列表） */
export const WORKSPACE_HOME_PATH = "/admin/dashboards";

export const ACCOUNT_PROFILE_PATH = "/admin/account/profile";
export const ACCOUNT_THEME_PATH = "/admin/account/theme";
export const ACCOUNT_LANDING_PATH = "/admin/account/landing";
export const ACCOUNT_SECURITY_PATH = "/admin/account/security";
/** @deprecated 兼容旧链接，路由重定向至 landing */
export const ACCOUNT_PREFERENCES_PATH = "/admin/account/preferences";
/** @deprecated 兼容旧链接，路由重定向至 landing */
export const ACCOUNT_SETTINGS_PATH = "/admin/account/settings";

/** 个人中心入口（与 profile 同路径） */
export const ACCOUNT_CENTER_PATH = ACCOUNT_PROFILE_PATH;

/** 后台管理默认入口（用户菜单进入） */
export const SYSTEM_ADMIN_HOME_PATH = "/admin/system";

/** 登录后离开工作台进入独立管理区时，用于恢复导航的快照 key */
export const WORKSPACE_RETURN_PATH_KEY = "workspace:returnPath";

/** 用户菜单内的账号管理页 */
export function isAccountManagementPath(pathname: string): boolean {
  return pathname.startsWith("/admin/account/");
}

/** 后台管理区（权限、组织、审计等） */
export function isSystemAdminPath(pathname: string): boolean {
  return (
    pathname === SYSTEM_ADMIN_HOME_PATH ||
    pathname.startsWith(`${SYSTEM_ADMIN_HOME_PATH}/`)
  );
}

/** 脱离工作台主 IA 的壳层（个人中心 / 后台管理） */
export function isDetachedFromWorkspacePath(pathname: string): boolean {
  return isAccountManagementPath(pathname) || isSystemAdminPath(pathname);
}

/** 工作台路由：Dashboard 列表与查看态 */
export function isWorkspacePath(pathname: string): boolean {
  if (pathname === WORKSPACE_HOME_PATH) return true;
  if (/^\/admin\/dashboards\/[^/]+$/.test(pathname)) return true;
  return false;
}

/** 编辑态属于建设区，不算工作台 */
export function isWorkspaceViewPath(pathname: string): boolean {
  if (pathname === WORKSPACE_HOME_PATH) return true;
  return /^\/admin\/dashboards\/[^/]+$/.test(pathname) && !pathname.endsWith("/edit");
}

export function resolveWorkspaceReturnPath(
  path: string | null | undefined,
): string {
  if (path && isWorkspacePath(path)) return path;
  return WORKSPACE_HOME_PATH;
}
