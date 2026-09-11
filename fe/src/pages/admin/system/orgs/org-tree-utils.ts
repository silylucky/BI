export type OrgOut = {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  level: number;
};

export function sortOrgsByPath(orgs: OrgOut[]): OrgOut[] {
  return [...orgs].sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}

export function buildOrgChildCounts(orgs: OrgOut[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const org of orgs) {
    if (!org.parent_id) continue;
    counts.set(org.parent_id, (counts.get(org.parent_id) ?? 0) + 1);
  }
  return counts;
}

export function filterVisibleOrgs(orgs: OrgOut[], collapsed: ReadonlySet<string>): OrgOut[] {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  return orgs.filter((org) => {
    let parentId = org.parent_id;
    while (parentId) {
      if (collapsed.has(parentId)) return false;
      parentId = byId.get(parentId)?.parent_id ?? null;
    }
    return true;
  });
}

export function orgLevelLabel(level: number): string {
  if (level <= 0) return "顶级";
  const labels = ["一级", "二级", "三级", "四级", "五级", "六级"];
  return labels[level - 1] ?? `${level} 级`;
}

export function shortOrgId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
}
