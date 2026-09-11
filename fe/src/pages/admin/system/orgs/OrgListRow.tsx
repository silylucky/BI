import { Building2, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { ListRowCheckbox, listTableSelectCellClass } from "@/components/layout/list-batch-delete";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { orgLevelLabel, shortOrgId, type OrgOut } from "./org-tree-utils";

export type { OrgOut };

type OrgListRowProps = {
  org: OrgOut;
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onEdit: (org: OrgOut) => void;
  onAddChild: (org: OrgOut) => void;
  onDelete: (org: OrgOut) => void;
  showTreeChrome?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function OrgListRow({
  org,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onAddChild,
  onDelete,
  showTreeChrome = true,
  hasChildren = false,
  childCount = 0,
  isCollapsed = false,
  onToggleCollapse,
}: OrgListRowProps) {
  const indent = showTreeChrome ? org.level * 20 : 0;

  return (
    <tr className="border-b border-gray-100 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-white/[0.02]">
      {batchMode ? (
        <td className={listTableSelectCellClass}>
          {onToggleSelect ? (
            <ListRowCheckbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect()}
              ariaLabel={`选择组织 ${org.name}`}
            />
          ) : null}
        </td>
      ) : null}
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: indent }}>
          {showTreeChrome ? (
            hasChildren ? (
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
                aria-label={isCollapsed ? `展开 ${org.name}` : `收起 ${org.name}`}
                onClick={onToggleCollapse}
              >
                <ChevronRight
                  className={cn("size-4 transition-transform", !isCollapsed && "rotate-90")}
                  aria-hidden
                />
              </button>
            ) : (
              <span className="inline-flex size-7 shrink-0" aria-hidden />
            )
          ) : null}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {org.name}
              </p>
              {hasChildren && childCount > 0 ? (
                <Badge variant="light" color="light" size="sm">
                  {childCount} 个子级
                </Badge>
              ) : null}
            </div>
            <HintTooltip label={`节点 ID：${org.id}`}>
              <p className="truncate font-mono text-theme-xs text-gray-400 dark:text-gray-500">
                {shortOrgId(org.id)}
              </p>
            </HintTooltip>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Badge variant="light" color={org.level === 0 ? "primary" : "light"} size="sm">
          {orgLevelLabel(org.level)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {!batchMode ? (
          <div className="inline-flex items-center justify-end gap-0.5">
            <HintTooltip label="添加子组织">
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="size-8"
                aria-label={`为 ${org.name} 添加子组织`}
                onClick={() => onAddChild(org)}
              >
                <Plus className="size-4" />
              </IconButton>
            </HintTooltip>
            <HintTooltip label="编辑">
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="size-8"
                aria-label={`编辑 ${org.name}`}
                onClick={() => onEdit(org)}
              >
                <Pencil className="size-4" />
              </IconButton>
            </HintTooltip>
            <HintTooltip label="删除">
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
                aria-label={`删除 ${org.name}`}
                onClick={() => onDelete(org)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </HintTooltip>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
