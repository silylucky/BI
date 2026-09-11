import { useEffect, useState } from "react";
import { FolderInput, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapApiError } from "@/lib/apiError";
import {
  buildCatalogMoveTargets,
  catalogNodePath,
  type ReportCatalogNode,
} from "@/lib/reportCatalogUtils";
import { TemplateField, TemplatePanelSection } from "./templatePanelUi";
import { type CatalogNode, useReportTemplates } from "../useReportTemplates";

export function CatalogNodeMetaPanel({
  node,
  allNodes,
  readOnly,
  onRenamed,
  onMoved,
}: {
  node: CatalogNode;
  allNodes: ReportCatalogNode[];
  readOnly: boolean;
  onRenamed?: () => void;
  onMoved?: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [moveTarget, setMoveTarget] = useState<string>("__keep__");
  const { updateNode, moveNode } = useReportTemplates(null);
  const moveTargets = buildCatalogMoveTargets(node.id, allNodes);
  const parentPath = node.parentId
    ? catalogNodePath(
        allNodes.find((n) => n.id === node.parentId) ?? { ...node, name: "…", parentId: null },
        allNodes,
      )
    : "根目录";

  useEffect(() => {
    setName(node.name);
    setMoveTarget("__keep__");
  }, [node.id, node.name]);

  if (readOnly) {
    return (
      <TemplatePanelSection title="目录信息" icon={Pencil}>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          所在目录：<span className="font-medium text-gray-800 dark:text-white/90">{parentPath}</span>
        </p>
      </TemplatePanelSection>
    );
  }

  const handleRename = () => {
    const next = name.trim();
    if (!next || next === node.name) return;
    updateNode.mutate(
      { id: node.id, body: { name: next } },
      {
        onSuccess: () => {
          toast.success("名称已更新");
          onRenamed?.();
        },
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  const handleMove = () => {
    if (moveTarget === "__keep__") return;
    const parentId = moveTarget === "__root__" ? null : moveTarget;
    moveNode.mutate(
      { id: node.id, parentId },
      {
        onSuccess: () => {
          toast.success("已移动");
          setMoveTarget("__keep__");
          onMoved?.();
        },
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  return (
    <TemplateTabSections
      node={node}
      name={name}
      setName={setName}
      parentPath={parentPath}
      moveTarget={moveTarget}
      setMoveTarget={setMoveTarget}
      moveTargets={moveTargets}
      updatePending={updateNode.isPending}
      movePending={moveNode.isPending}
      onRename={handleRename}
      onMove={handleMove}
    />
  );
}

function TemplateTabSections({
  node,
  name,
  setName,
  parentPath,
  moveTarget,
  setMoveTarget,
  moveTargets,
  updatePending,
  movePending,
  onRename,
  onMove,
}: {
  node: CatalogNode;
  name: string;
  setName: (v: string) => void;
  parentPath: string;
  moveTarget: string;
  setMoveTarget: (v: string) => void;
  moveTargets: Array<{ id: string | null; label: string }>;
  updatePending: boolean;
  movePending: boolean;
  onRename: () => void;
  onMove: () => void;
}) {
  return (
    <>
      <TemplatePanelSection
        title="显示名称"
        description="在目录树与导出记录中展示的名称。"
        icon={Pencil}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TemplateField id={`node-name-${node.id}`} label="名称" className="min-w-0 flex-1">
            <Input
              id={`node-name-${node.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </TemplateField>
          <Button
            type="button"
            variant="primary"
            className="h-11 shrink-0"
            disabled={updatePending || !name.trim() || name.trim() === node.name}
            onClick={onRename}
          >
            保存名称
          </Button>
        </div>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          所在目录：{parentPath}
          {node.templateKey ? (
            <>
              {" "}
              · 模板键：<span className="font-mono">{node.templateKey}</span>
            </>
          ) : null}
        </p>
      </TemplatePanelSection>

      {moveTargets.length > 0 ? (
        <TemplatePanelSection
          title="移动位置"
          description="将模板或文件夹移动到目标目录。"
          icon={FolderInput}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TemplateField id={`move-${node.id}`} label="目标目录" className="min-w-0 flex-1">
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger id={`move-${node.id}`} className="h-11">
                  <SelectValue placeholder="选择目标目录" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">选择目标…</SelectItem>
                  {moveTargets.map((t) => (
                    <SelectItem key={t.id ?? "root"} value={t.id ?? "__root__"}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TemplateField>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              disabled={movePending || moveTarget === "__keep__"}
              onClick={onMove}
            >
              确认移动
            </Button>
          </div>
        </TemplatePanelSection>
      ) : null}
    </>
  );
}
