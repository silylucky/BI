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
import { Button } from "@/components/ui/button";

type UnsavedLeaveDialogProps = {
  open: boolean;
  saving?: boolean;
  entityLabel?: string;
  onStay: () => void;
  onDiscardLeave: () => void;
  onSaveAndLeave: () => void | Promise<void>;
};

export function UnsavedLeaveDialog({
  open,
  saving = false,
  entityLabel = "页面",
  onStay,
  onDiscardLeave,
  onSaveAndLeave,
}: UnsavedLeaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>未保存的更改</AlertDialogTitle>
          <AlertDialogDescription>
            {entityLabel}有未保存的修改，离开后将丢失。请先保存，或确认放弃更改。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel onClick={onStay}>留在此页</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={onDiscardLeave}>
            放弃更改并离开
          </AlertDialogAction>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={() => void onSaveAndLeave()}
          >
            {saving ? "保存中…" : "保存并离开"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
