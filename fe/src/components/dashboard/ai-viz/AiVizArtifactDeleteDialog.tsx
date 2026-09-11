import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { DESTRUCTIVE_ALERT_ACTION_CLASS } from "@/components/layout/list-batch-delete";
import {
  buildAiVizArtifactDeleteConfirmMessage,
  deleteAiVizArtifact,
  fetchAiVizArtifactReferences,
  formatAiVizArtifactDeleteError,
  formatAiVizArtifactDeleteSuccess,
  type AiVizArtifactReference,
} from "@/lib/aiVizArtifacts";

export type AiVizArtifactDeleteTarget = {
  artifactId: string;
  label: string;
};

type AiVizArtifactDeleteDialogProps = {
  target: AiVizArtifactDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

/** 组件库 AI artifact 删除确认（含引用检测与 unlink） */
export function AiVizArtifactDeleteDialog({
  target,
  open,
  onOpenChange,
  onDeleted,
}: AiVizArtifactDeleteDialogProps) {
  const [references, setReferences] = useState<AiVizArtifactReference[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !target) {
      setReferences([]);
      return;
    }
    setLoadingRefs(true);
    void fetchAiVizArtifactReferences(target.artifactId)
      .then((payload) => setReferences(payload.references ?? []))
      .catch(() => setReferences([]))
      .finally(() => setLoadingRefs(false));
  }, [open, target?.artifactId]);

  const handleConfirm = () => {
    if (!target) return;
    setDeleting(true);
    void deleteAiVizArtifact(target.artifactId, { unlink: true })
      .then((result) => {
        toast.success(formatAiVizArtifactDeleteSuccess(target.label, result));
        onOpenChange(false);
        onDeleted?.();
      })
      .catch((err: unknown) => {
        toast.error(formatAiVizArtifactDeleteError(err));
      })
      .finally(() => setDeleting(false));
  };

  const description = target
    ? buildAiVizArtifactDeleteConfirmMessage(target.label, references)
    : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>从组件库移除？</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {loadingRefs ? "正在检查引用…" : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            className={DESTRUCTIVE_ALERT_ACTION_CLASS}
            disabled={deleting || loadingRefs}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {deleting ? "移除中…" : "移除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
