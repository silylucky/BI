import { FilePlus, FileSpreadsheet, FileText, FileType2, Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogNodePath, type ReportCatalogNode } from "@/lib/reportCatalogUtils";
import { type CatalogNode } from "../useReportTemplates";
import { CatalogNodeMetaPanel } from "./CatalogNodeMetaPanel";
import { CatalogNodeDeleteButton } from "./CatalogNodeDeleteButton";

const KIND_ICONS: Record<string, typeof FileSpreadsheet> = { excel: FileSpreadsheet, pdf: FileType2 };

export function CatalogFolderPanel({
  node,
  allNodes,
  readOnly,
  onCreate,
  isCreating,
  onSelectChild,
  onDeleted,
}: {
  node: CatalogNode;
  allNodes: ReportCatalogNode[];
  readOnly: boolean;
  onCreate: (nodeType: "folder" | "template") => void;
  isCreating: boolean;
  onSelectChild: (id: string) => void;
  onDeleted: () => void;
}) {
  const children = allNodes.filter((n) => n.parentId === node.id);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Folder className="size-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
              <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white">{node.name}</h2>
            </div>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              文件夹 · {children.length} 个子项
            </p>
          </div>
          {!readOnly ? <CatalogNodeDeleteButton node={node} onDeleted={onDeleted} /> : null}
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <CatalogNodeMetaPanel node={node} allNodes={allNodes} readOnly={readOnly} />
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={isCreating} onClick={() => onCreate("folder")}>
              <FolderPlus className="size-4" aria-hidden />
              新建子文件夹
            </Button>
            <Button type="button" variant="primary" disabled={isCreating} onClick={() => onCreate("template")}>
              <FilePlus className="size-4" aria-hidden />
              在此新建模板
            </Button>
          </div>
        ) : null}
        {children.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-gray-200 p-2 dark:border-gray-800">
            {children.map((child) => {
              const Icon =
                child.nodeType === "folder"
                  ? Folder
                  : KIND_ICONS[child.templateKind ?? "pdf"] ?? FileType2;
              return (
                <li key={child.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-sm hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    onClick={() => onSelectChild(child.id)}
                  >
                    <Icon className="size-4 shrink-0 text-gray-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-white/90">
                      {child.name}
                    </span>
                    <span className="text-theme-xs text-gray-400">
                      {child.nodeType === "folder" ? "文件夹" : child.templateKind?.toUpperCase()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">此文件夹暂无子项。</p>
        )}
        {children.length > 0 ? (
          <p className="text-theme-xs text-gray-400">
            路径示例：{catalogNodePath(children[0]!, allNodes)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
