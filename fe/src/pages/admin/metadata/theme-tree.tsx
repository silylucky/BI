import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, GripVertical, Plus } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { ListRowCheckbox } from "@/components/layout/list-batch-delete";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { RowActions } from "./metadata-shared";

export type ThemeNode = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  sortOrder?: number;
};

type TreeNode = ThemeNode & { children: TreeNode[] };

function buildTree(nodes: ThemeNode[]): TreeNode[] {
  const byParent = new Map<string | null, ThemeNode[]>();
  for (const node of nodes) {
    const key = node.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(node);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }
  const walk = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId) ?? []).map((n) => ({ ...n, children: walk(n.id) }));
  return walk(null);
}

function flattenTree(nodes: TreeNode[], depth = 0, out: Array<TreeNode & { depth: number }> = []) {
  for (const node of nodes) {
    out.push({ ...node, depth });
    flattenTree(node.children, depth + 1, out);
  }
  return out;
}

export function ThemeTree({
  nodes,
  onCreateChild,
  onDelete,
  selectedIds,
  onToggleSelect,
}: {
  nodes: ThemeNode[];
  onCreateChild: (parentId: string) => void;
  onDelete: (node: ThemeNode) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const moveMut = useMutation({
    mutationFn: ({ id, parentId, sortOrder }: { id: string; parentId: string | null; sortOrder: number }) =>
      apiFetch(`/api/v1/metadata/themes/${id}/move`, {
        method: "POST",
        body: JSON.stringify({ parentId, sortOrder }),
      }),
    onSuccess: () => {
      toast.success("主题节点已移动");
      void qc.invalidateQueries({ queryKey: ["metadata", "themes"] });
    },
    onError: (e) => toast.error(mapApiError(e)),
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDrop = (target: ThemeNode & { depth: number }, e: DragEvent) => {
    e.preventDefault();
    if (!dragId || dragId === target.id) return;
    const siblings = flat.filter((n) => n.parentId === target.parentId && n.id !== dragId);
    const targetIdx = siblings.findIndex((s) => s.id === target.id);
    moveMut.mutate({
      id: dragId,
      parentId: target.parentId,
      sortOrder: Math.max(0, targetIdx),
    });
    setDragId(null);
  };

  const visible = flat.filter((n) => {
    if (n.depth === 0) return true;
    let parentId = n.parentId;
    while (parentId) {
      if (!expanded.has(parentId)) return false;
      const parent = flat.find((x) => x.id === parentId);
      parentId = parent?.parentId ?? null;
    }
    return true;
  });

  return (
    <ul className="divide-y divide-gray-100 dark:divide-white/10">
      {visible.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const isLeaf = !hasChildren;
        return (
          <li
            key={node.id}
            draggable
            onDragStart={() => setDragId(node.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(node, e)}
            className="flex items-center gap-2 py-2.5"
            style={{ paddingLeft: 8 + node.depth * 20 }}
          >
            {isLeaf && onToggleSelect ? (
              <ListRowCheckbox
                checked={selectedIds?.has(node.id) ?? false}
                onCheckedChange={() => onToggleSelect(node.id)}
                ariaLabel={`选择主题节点 ${node.name}`}
              />
            ) : null}
            <GripVertical className="size-4 shrink-0 cursor-grab text-gray-400" aria-hidden />
            {hasChildren ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-gray-900 dark:text-white/90"
                onClick={() => toggle(node.id)}
                aria-expanded={isExpanded}
              >
                <ChevronRight
                  className={cn("size-4 text-gray-400 transition-transform", isExpanded && "rotate-90")}
                />
                {node.name}
              </button>
            ) : (
              <span className="pl-5 font-medium text-gray-800 dark:text-white/90">{node.name}</span>
            )}
            <code className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10">
              {node.code ?? "—"}
            </code>
            <div className="ml-auto">
              <RowActions>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`新建子节点 ${node.name}`}
                  onClick={() => onCreateChild(node.id)}
                >
                  <Plus className="size-4" />
                </IconButton>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(node)}>
                  删除
                </Button>
              </RowActions>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
