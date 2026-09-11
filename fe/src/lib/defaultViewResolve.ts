import { apiFetch } from "@/lib/api";

type DefaultViews = {
  dashboardId: string | null;
  reportTemplateNodeId?: string | null;
  inheritFromRoleId?: string | null;
};

type UserViewItem = {
  name?: string;
  dashboardId?: string | null;
  isDefault?: boolean;
};

type UserViewsResponse = {
  items: UserViewItem[];
};

const MAX_INHERIT_DEPTH = 8;

async function verifyDashboardPath(dashboardId: string): Promise<string | null> {
  try {
    await apiFetch(`/api/v1/dashboards/${dashboardId}`);
    return `/admin/dashboards/${dashboardId}`;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "DASH_NOT_FOUND") {
      console.warn("defaultViewResolve: stale dashboardId ignored", dashboardId);
      return null;
    }
    console.warn("defaultViewResolve: dashboard verify failed", dashboardId, err);
    return null;
  }
}

async function fetchUserOverridePath(): Promise<string | null> {
  try {
    const data = await apiFetch<UserViewsResponse>("/api/v1/users/me/views");
    const items = data.items ?? [];
    if (items.length === 0) return null;
    const preferred =
      items.find((item) => item.isDefault) ??
      items.find((item) => item.name === "默认") ??
      items[0];
    if (preferred.dashboardId) {
      return verifyDashboardPath(preferred.dashboardId);
    }
    return null;
  } catch (err) {
    console.warn("defaultViewResolve: user views fetch failed", err);
    return null;
  }
}

async function fetchRoleDefaults(roleKey: string): Promise<DefaultViews | null> {
  try {
    return await apiFetch<DefaultViews>(`/api/v1/roles/${encodeURIComponent(roleKey)}/default-views`);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "VIEW_DEFAULT_FORBIDDEN" || code === "ROLE_NOT_FOUND") return null;
    console.warn("defaultViewResolve: fetch failed", roleKey, err);
    return null;
  }
}

function reportViewPath(nodeId: string): string {
  return `/admin/reports/view/${nodeId}`;
}

async function resolveInheritedReportNodeId(
  roleKey: string,
  depth: number,
  visited: Set<string>,
): Promise<string | null> {
  if (depth > MAX_INHERIT_DEPTH || visited.has(roleKey)) return null;
  visited.add(roleKey);
  const data = await fetchRoleDefaults(roleKey);
  if (!data) return null;
  if (data.reportTemplateNodeId) return data.reportTemplateNodeId;
  if (data.inheritFromRoleId) {
    return resolveInheritedReportNodeId(data.inheritFromRoleId, depth + 1, visited);
  }
  return null;
}

export async function resolveDefaultReportTemplateNodeId(roleCodes: string[]): Promise<string | null> {
  for (const code of roleCodes) {
    const nodeId = await resolveInheritedReportNodeId(code, 0, new Set());
    if (nodeId) return nodeId;
  }
  return null;
}

async function resolveInheritedLanding(
  roleKey: string,
  depth: number,
  visited: Set<string>,
): Promise<string | null> {
  if (depth > MAX_INHERIT_DEPTH || visited.has(roleKey)) return null;
  visited.add(roleKey);
  const data = await fetchRoleDefaults(roleKey);
  if (!data) return null;
  if (data.dashboardId) {
    const path = await verifyDashboardPath(data.dashboardId);
    if (path) return path;
  }
  if (data.reportTemplateNodeId) {
    return reportViewPath(data.reportTemplateNodeId);
  }
  if (data.inheritFromRoleId) {
    return resolveInheritedLanding(data.inheritFromRoleId, depth + 1, visited);
  }
  return null;
}

export async function resolveDefaultLandingPath(roleCodes: string[]): Promise<string | null> {
  const userPath = await fetchUserOverridePath();
  if (userPath) return userPath;
  for (const code of roleCodes) {
    const path = await resolveInheritedLanding(code, 0, new Set());
    if (path) return path;
  }
  return null;
}

export async function resolveDefaultDashboardPath(roleCodes: string[]): Promise<string | null> {
  return resolveDefaultLandingPath(roleCodes);
}
