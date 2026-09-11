import { Download } from "lucide-react";
import { useChartExecute } from "@/components/charts/useChartExecute";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import { resolveChartQueryLimit } from "@/lib/chartDeDisplay";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { downloadChartTableCsv } from "./exportChartTable";
import { WidgetDialogShell } from "./WidgetDialogShell";

type WidgetViewDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  chartConfig: ChartViewConfig;
  filterParameters?: Record<string, string>;
  executeKey?: string;
  dashboardStyle?: DashboardStyleConfig;
};

export function WidgetViewDataDialog({
  open,
  onOpenChange,
  title,
  chartConfig,
  filterParameters,
  executeKey,
  dashboardStyle,
}: WidgetViewDataDialogProps) {
  const queryLimit = resolveChartQueryLimit(chartConfig, dashboardStyle ?? {});
  const { columns, rows, loading, error } = useChartExecute(chartConfig, {
    filterParameters,
    executeKey,
    limit: queryLimit,
  });

  const exportCsv = (raw: boolean) => {
    const suffix = raw ? "原始明细" : "数据";
    downloadChartTableCsv(`${title}-${suffix}`, columns, rows);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WidgetDialogShell
        testId="widget-view-data-dialog"
        title={title}
        contentClassName="max-h-[min(88vh,720px)] w-[min(92vw,960px)]"
        bodyClassName="overflow-auto px-5 py-4"
        toolbar={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={loading || Boolean(error) || rows.length === 0}
              onClick={() => exportCsv(false)}
            >
              <Download className="size-4" aria-hidden />
              导出 Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={loading || Boolean(error) || rows.length === 0}
              onClick={() => exportCsv(true)}
            >
              <Download className="size-4" aria-hidden />
              导出原始明细
            </Button>
          </>
        }
      >
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : error ? (
          <p className="text-theme-sm text-error-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-theme-sm text-gray-500">暂无数据</p>
        ) : (
          <table className="w-full min-w-[320px] border-collapse text-left text-theme-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-theme-xs font-medium text-gray-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={`${rowIndex}-${col}`}
                      className="px-3 py-2 text-gray-800 dark:text-gray-200"
                    >
                      {String(row[colIndex] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </WidgetDialogShell>
    </Dialog>
  );
}
