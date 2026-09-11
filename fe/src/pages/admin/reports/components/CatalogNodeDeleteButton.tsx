import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mapApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { type CatalogNode, useReportTemplates } from "../useReportTemplates";

export function CatalogNodeDeleteButton({
  node,
  onDeleted,
  className,
}: {
  node: CatalogNode;
  onDeleted?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { deleteNode } = useReportTemplates(null);
  const label = node.nodeType === "folder" ? "删除文件夹" : "删除模板";

  const handleDelete = () => {
    deleteNode.mutate(node.id, {
      onSuccess: () => {
        toast.success("已删除");
        setOpen(false);
        onDeleted?.();
      },
      onError: (err) => toast.error(mapApiError(err)),
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-9 border-error-200 text-error-600 hover:bg-error-50 hover:text-error-700 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10",
          className,
        )}
        disabled={deleteNode.isPending}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {label}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{node.name}」？删除后无法恢复。
              {node.nodeType === "folder" ? "（须为空文件夹）" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNode.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteNode.isPending}
              className="bg-error-500 text-white hover:bg-error-600 dark:bg-error-500 dark:hover:bg-error-600"
              onClick={handleDelete}
            >
              {deleteNode.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
