import type { ReactNode } from "react";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type WidgetDialogShellProps = {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
  testId?: string;
  contentClassName?: string;
  bodyClassName?: string;
};

/** 看板组件弹窗壳：标题左、工具右、为关闭钮预留 pr-14，避免与操作重叠 */
export function WidgetDialogShell({
  title,
  toolbar,
  children,
  testId,
  contentClassName,
  bodyClassName,
}: WidgetDialogShellProps) {
  return (
    <DialogContent
      className={cn(
        "flex w-[min(94vw,calc(100%-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
        contentClassName,
      )}
      data-testid={testId}
      data-dashboard-dialog=""
    >
      <div className="flex shrink-0 items-center gap-4 border-b border-gray-100 px-5 py-3.5 pr-14 dark:border-gray-800">
        <DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold">{title}</DialogTitle>
        {toolbar ? (
          <div className="flex shrink-0 items-center gap-2">{toolbar}</div>
        ) : null}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </DialogContent>
  );
}

export function fitPreviewSize(
  target: { width: number; height: number },
  bounds: { maxWidth: number; maxHeight: number },
): { width: number; height: number } {
  const safeW = target.width > 0 ? target.width : 1;
  const safeH = target.height > 0 ? target.height : 1;
  const scale = Math.min(bounds.maxWidth / safeW, bounds.maxHeight / safeH, 1);
  return {
    width: Math.round(safeW * scale),
    height: Math.round(safeH * scale),
  };
}
