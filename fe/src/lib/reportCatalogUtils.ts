import { apiFetch } from "@/lib/api";

export type ReportCatalogNode = {
  id: string;
  name: string;
  parentId: string | null;
  nodeType: "folder" | "template";
  templateKind: "excel" | "pdf" | null;
  templateKey: string | null;
  sortOrder: number;
};

type CatalogNodesResponse = ReportCatalogNode[] | { items: ReportCatalogNode[] };

export function normalizeCatalogNodes(data: CatalogNodesResponse): ReportCatalogNode[] {
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

async function listCatalogChildren(parentId: string | null): Promise<ReportCatalogNode[]> {
  const q = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
  const raw = await apiFetch<CatalogNodesResponse>(`/api/v1/reports/catalog/nodes${q}`);
  return normalizeCatalogNodes(raw);
}

/** 递归收集目录下全部 template 节点（报表中心列表用）；按层级并行 BFS，避免串行 walk。 */
export async function fetchAllCatalogTemplates(): Promise<ReportCatalogNode[]> {
  const templates: ReportCatalogNode[] = [];
  let frontier: (string | null)[] = [null];

  while (frontier.length > 0) {
    const nodesByParent = await Promise.all(
      frontier.map((parentId) => listCatalogChildren(parentId)),
    );
    const nextFrontier: string[] = [];
    for (const nodes of nodesByParent) {
      for (const node of nodes) {
        if (node.nodeType === "template") {
          templates.push(node);
        } else {
          nextFrontier.push(node.id);
        }
      }
    }
    frontier = nextFrontier;
  }

  return templates.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

/** 递归收集目录下全部节点（模板页移动、移动端选择用）。 */
export async function fetchAllCatalogNodes(): Promise<ReportCatalogNode[]> {
  const nodes: ReportCatalogNode[] = [];
  let frontier: (string | null)[] = [null];

  while (frontier.length > 0) {
    const nodesByParent = await Promise.all(
      frontier.map((parentId) => listCatalogChildren(parentId)),
    );
    const nextFrontier: string[] = [];
    for (const children of nodesByParent) {
      for (const node of children) {
        nodes.push(node);
        if (node.nodeType === "folder") nextFrontier.push(node.id);
      }
    }
    frontier = nextFrontier;
  }

  return nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

export function catalogNodePath(
  node: ReportCatalogNode,
  allNodes: ReportCatalogNode[],
): string {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const parts = [node.name];
  let cur = node.parentId;
  while (cur) {
    const parent = byId.get(cur);
    if (!parent) break;
    parts.unshift(parent.name);
    cur = parent.parentId;
  }
  return parts.join(" / ");
}

export function isCatalogDescendant(
  ancestorId: string,
  nodeId: string | null,
  allNodes: ReportCatalogNode[],
): boolean {
  if (!nodeId) return false;
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let cur: string | null = nodeId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

export type CatalogMoveTarget = { id: string | null; label: string };

export function catalogAncestorFolderIds(
  nodeId: string | null,
  allNodes: ReportCatalogNode[],
): string[] {
  if (!nodeId) return [];
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const ids: string[] = [];
  let cur = byId.get(nodeId)?.parentId ?? null;
  while (cur) {
    ids.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return ids;
}

export function buildCatalogMoveTargets(
  nodeId: string,
  allNodes: ReportCatalogNode[],
): CatalogMoveTarget[] {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return [{ id: null, label: "根目录" }];
  const currentParentId = node.parentId ?? null;
  const targets: CatalogMoveTarget[] = [];
  if (currentParentId !== null) {
    targets.push({ id: null, label: "根目录" });
  }
  for (const folder of allNodes.filter((n) => n.nodeType === "folder")) {
    if (folder.id === nodeId) continue;
    if (isCatalogDescendant(nodeId, folder.id, allNodes)) continue;
    if (folder.id === currentParentId) continue;
    targets.push({ id: folder.id, label: catalogNodePath(folder, allNodes) });
  }
  return targets;
}

export type CatalogRecentEntry = {
  resourceType: string;
  resourceId: string;
};

/** 进页默认选中：最近访问的 template → 第一份 template → 任意首项。 */
export function pickDefaultCatalogNodeId(
  allNodes: ReportCatalogNode[],
  recent: CatalogRecentEntry[] = [],
): string | null {
  if (allNodes.length === 0) return null;
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  for (const entry of recent) {
    if (entry.resourceType !== "template") continue;
    const node = nodeById.get(entry.resourceId);
    if (node?.nodeType === "template") return node.id;
  }
  const firstTemplate = allNodes.find((n) => n.nodeType === "template");
  if (firstTemplate) return firstTemplate.id;
  return allNodes[0]?.id ?? null;
}

export function filterCatalogTemplates(
  templates: ReportCatalogNode[],
  query: string,
  kind: "all" | "excel" | "pdf",
): ReportCatalogNode[] {
  const q = query.trim().toLowerCase();
  return templates.filter((node) => {
    if (kind !== "all" && node.templateKind !== kind) return false;
    if (!q) return true;
    return (
      node.name.toLowerCase().includes(q) ||
      (node.templateKey?.toLowerCase().includes(q) ?? false)
    );
  });
}
