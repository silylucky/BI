import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileSpreadsheet, FileText, FileType2, Folder, MoreHorizontal, Trash2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  buildCatalogMoveTargets,
  type ReportCatalogNode,
} from "@/lib/reportCatalogUtils";
import { cn } from "@/lib/utils";
import { type CatalogNode, useReportTemplates } from "../useReportTemplates";

const TEMPLATE_ICONS: Record<string, typeof FileText> = {
  excel: FileSpreadsheet,
  pdf: FileType2,
};

function TemplateIcon({ kind }: { kind: CatalogNode["templateKind"] | string | null }) {
  const Icon = (kind && TEMPLATE_ICONS[kind]) ?? FileText;
  return <Icon className="size-4 shrink-0" aria-hidden />;
}

function treeItemClass(selected: boolean) {
  return cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-theme-sm transition-colors",
    "hover:bg-gray-100 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/10",
    "dark:hover:bg-white/[0.03]",
    selected && "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  );
}

function CatalogNodeActions({
  node,
  allNodes,
  readOnly,
  selected,
  onMove,
  onDelete,
}: {
  node: CatalogNode;
  allNodes: ReportCatalogNode[];
  readOnly: boolean;
  selected: boolean;
  onMove: (nodeId: string, parentId: string | null) => void;
  onDelete: (nodeId: string) => void;
}) {
  if (readOnly) return null;
  const targets = buildCatalogMoveTargets(node.id, allNodes);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "size-7 shrink-0",
            selected ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-gray-400",
          )}
          aria-label={`${node.name} 操作`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
        {targets.length > 0 ? (
          <>
            <DropdownMenuLabel>移动到</DropdownMenuLabel>
            {targets.map((target) => (
              <DropdownMenuItem key={target.id ?? "root"} onClick={() => onMove(node.id, target.id)}>
                {target.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          className="text-error-600 focus:text-error-600 dark:text-error-400"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="size-4" aria-hidden />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CatalogTreeNode({
  node,
  selectedId,
  onSelect,
  allNodes,
  allNodesLoaded = false,
  readOnly,
  onMove,
  onDelete,
  expandFolderIds,
  depth = 0,
  onPrefetch,
}: {
  node: CatalogNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  allNodes: ReportCatalogNode[];
  allNodesLoaded?: boolean;
  readOnly: boolean;
  onMove: (nodeId: string, parentId: string | null) => void;
  onDelete: (nodeId: string) => void;
  expandFolderIds: Set<string>;
  depth?: number;
  onPrefetch?: (nodeId: string) => void;
}) {
  const shouldExpand = expandFolderIds.has(node.id);
  const [open, setOpen] = useState(depth < 1 || shouldExpand);
  const isFolder = node.nodeType === "folder";
  const childrenFromAll = useMemo(
    () =>
      allNodes
        .filter((n) => n.parentId === node.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN")),
    [allNodes, node.id],
  );
  const useFlatCatalog = allNodesLoaded && allNodes.length > 0;
  const { nodesQuery } = useReportTemplates(isFolder && open && !useFlatCatalog ? node.id : null);
  const children = useFlatCatalog ? childrenFromAll : (nodesQuery.data?.items ?? []);
  const selected = selectedId === node.id;
  const indent = { paddingLeft: `${depth * 14 + 6}px` };

  useEffect(() => {
    if (shouldExpand) setOpen(true);
  }, [shouldExpand]);

  if (!isFolder) {
    return (
      <div className="group flex items-center gap-0.5 pr-1" style={indent}>
        <button
          type="button"
          className={treeItemClass(selected)}
          onClick={() => onSelect(node.id)}
          onMouseEnter={() => onPrefetch?.(node.id)}
          onFocus={() => onPrefetch?.(node.id)}
          aria-current={selected ? "true" : undefined}
        >
          <TemplateIcon kind={node.templateKind} />
          <TruncateHint title={node.name}>{node.name}</TruncateHint>
        </button>
        <CatalogNodeActions
          node={node}
          allNodes={allNodes}
          readOnly={readOnly}
          selected={selected}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-0.5 pr-1" style={indent}>
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.03]"
          aria-label={open ? `收起 ${node.name}` : `展开 ${node.name}`}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden />
        </button>
        <button
          type="button"
          className={cn(treeItemClass(selected), "font-medium text-gray-700 dark:text-gray-300")}
          onClick={() => onSelect(node.id)}
          aria-current={selected ? "true" : undefined}
        >
          <Folder className="size-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
          <TruncateHint title={node.name}>{node.name}</TruncateHint>
        </button>
        <CatalogNodeActions
          node={node}
          allNodes={allNodes}
          readOnly={readOnly}
          selected={selected}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
      <CollapsibleContent className="space-y-0.5">
        {nodesQuery.isLoading && !useFlatCatalog ? (
          <Skeleton className="mx-3 my-1 h-8 w-[calc(100%-1.5rem)] rounded-lg" />
        ) : null}
        {children.map((child) => (
          <CatalogTreeNode
            key={child.id}
            node={child}
            selectedId={selectedId}
            onSelect={onSelect}
            allNodes={allNodes}
            allNodesLoaded={allNodesLoaded}
            readOnly={readOnly}
            onMove={onMove}
            onDelete={onDelete}
            expandFolderIds={expandFolderIds}
            depth={depth + 1}
            onPrefetch={onPrefetch}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
