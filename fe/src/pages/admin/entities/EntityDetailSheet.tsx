import { Button } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { EntityTypeOut, PhysicalTableOut } from "./useEntityOverview";

type EntityDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PhysicalTableOut | null;
  entityType: EntityTypeOut | null;
  drillTargetId: string | null;
  onDrill: () => void;
  loading?: boolean;
};

export function EntityDetailSheet({
  open,
  onOpenChange,
  row,
  entityType,
  drillTargetId,
  onDrill,
  loading = false,
}: EntityDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg" aria-labelledby="entity-detail-title">
        <SheetHeader>
          <SheetTitle id="entity-detail-title" className="text-title-sm">
            {row?.displayName ?? "实体详情"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {loading || !row ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">tableFqn</p>
                <TruncateHint
                  title={row.tableFqn}
                  as="p"
                  className="font-mono text-theme-sm text-gray-800 dark:text-white/90"
                >
                  {row.tableFqn}
                </TruncateHint>
              </div>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">dataSourceId</p>
                <TruncateHint
                  title={row.dataSourceId}
                  as="p"
                  className="font-mono text-theme-sm text-gray-800 dark:text-white/90"
                >
                  {row.dataSourceId}
                </TruncateHint>
              </div>
              <div>
                <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">字段列</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  {row.columns.length === 0 ? (
                    <li className="text-theme-sm text-gray-500">暂无列信息</li>
                  ) : (
                    row.columns.map((c) => (
                      <li key={c.name} className="font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                        {c.name} <span className="text-gray-400">({c.dataType})</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              {entityType ? (
                <div>
                  <p className="mb-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">类型属性</p>
                  <ul className="space-y-1 text-theme-sm text-gray-600 dark:text-gray-400">
                    {entityType.attributes.length === 0 ? (
                      <li>暂无属性定义</li>
                    ) : (
                      entityType.attributes.map((a) => (
                        <li key={a.name}>
                          {a.name} ({a.dataType})
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter className="border-t border-gray-200 p-4 dark:border-gray-800">
          <Button
            type="button"
            disabled={!drillTargetId}
            tooltip={drillTargetId ? undefined : "请先在仪表板配置实体总览下钻目标"}
            onClick={onDrill}
          >
            下钻至仪表板
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
