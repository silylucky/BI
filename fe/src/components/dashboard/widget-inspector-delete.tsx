import { useState } from "react";
import { Trash2 } from "lucide-react";
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

type WidgetInspectorDeleteProps = {
  widgetTitle: string;
  onDelete: () => void;
  embedded?: boolean;
};

export function WidgetInspectorDelete({
  widgetTitle,
  onDelete,
  embedded = false,
}: WidgetInspectorDeleteProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className={embedded ? undefined : "mt-6 border-t border-gray-100 pt-4 dark:border-white/[0.06]"}>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={() => setConfirmOpen(true)}
      >
          <Trash2 className="size-4" aria-hidden />
          删除组件
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除组件</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{widgetTitle}」？此操作在保存布局前仅影响当前编辑会话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
