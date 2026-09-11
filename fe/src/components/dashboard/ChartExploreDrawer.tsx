import { ExternalLink } from "lucide-react";
import { ChartExploreContent } from "@/components/dashboard/ChartExploreContent";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ChartExploreDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChartExploreDrawer({ open, onOpenChange }: ChartExploreDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay className="z-[100001]" />
        <SheetContent
          side="right"
          showOverlay={false}
          className="z-[100001] flex w-full max-w-5xl flex-col gap-0 p-0 sm:max-w-5xl"
          aria-describedby="chart-explore-drawer-desc"
        >
        <SheetHeader className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <SheetTitle>图表类型目录</SheetTitle>
          <SheetDescription id="chart-explore-drawer-desc">
            浏览平台已注册的图表类型、渲染器与字段绑定规则（VIZ-003）。
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          <ChartExploreContent embedded />
        </div>
      </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}

type ChartExploreCatalogTriggerProps = {
  onOpen: () => void;
  dense?: boolean;
  className?: string;
};

export function ChartExploreCatalogTrigger({
  onOpen,
  dense = false,
  className,
}: ChartExploreCatalogTriggerProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg font-medium text-brand-600 transition-colors",
        "hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/10",
        dense
          ? "px-1 py-1 text-[11px]"
          : "px-3 py-2 text-theme-xs",
        className,
      )}
    >
      <ExternalLink className={cn("shrink-0", dense ? "size-3.5" : "size-3.5")} aria-hidden />
      查看全部类型与字段规则
    </button>
  );
}
