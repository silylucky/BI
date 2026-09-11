import type { ChartFieldRef } from "@/lib/chartViewConfig";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import { VitalSpanTable } from "@/components/charts/engine/d3/table/VitalSpanTable";

type EmbeddedChartTableProps = {
  columns: string[];
  displayCols: string[];
  rows: unknown[][];
  page: number;
  onPageChange: (page: number) => void;
  panel?: boolean;
  tableStyle?: ChartDeTableStyle;
  themeVars?: Record<string, string>;
  surfaceScheme?: ColorScheme;
  valueFormat?: NumberFormatConfig;
  drillField?: string;
  onDrillCellClick?: (field: string, value: string) => void;
  metricFields?: string[];
  embedded?: boolean;
  layoutInteractive?: boolean;
  onTableStylePatch?: (patch: ChartDeTableStyle extends object ? Partial<ChartDeTableStyle> : never) => void;
};

/**
 * 看板内嵌表格（legacy `table` 类型）：复用 D3 自研 VitalSpanTable
 */
export function EmbeddedChartTable({
  columns,
  displayCols,
  rows,
  page,
  onPageChange,
  panel = false,
  tableStyle,
  themeVars,
  surfaceScheme,
  valueFormat,
  drillField,
  onDrillCellClick,
  metricFields,
  embedded = false,
  layoutInteractive = true,
  onTableStylePatch,
}: EmbeddedChartTableProps) {
  const columnMeta = displayCols.map((field) => ({ field, label: field }));
  return (
    <VitalSpanTable
      columns={columns}
      columnMeta={columnMeta}
      displayCols={displayCols}
      rows={rows}
      page={page}
      onPageChange={onPageChange}
      panel={panel}
      tableStyle={tableStyle}
      themeVars={themeVars}
      surfaceScheme={surfaceScheme}
      valueFormat={valueFormat}
      drillField={drillField}
      onDrillCellClick={onDrillCellClick}
      metricFields={metricFields}
      embedded={embedded}
      layoutInteractive={layoutInteractive}
      onTableStylePatch={onTableStylePatch}
      testId="embedded-chart-table"
    />
  );
}
