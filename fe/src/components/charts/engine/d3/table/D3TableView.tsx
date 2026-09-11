import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { buildChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { chartViewModelToRenderSpec } from "@/components/charts/engine/buildChartViewModel";
import { buildTableModel } from "@/components/charts/engine/d3/table/buildTableModel";
import { TablePivotGrid } from "@/components/charts/engine/d3/table/TablePivotGrid";
import { VitalSpanTable } from "@/components/charts/engine/d3/table/VitalSpanTable";
import {
  mergeChartTableStyle,
  readChartDeTableStyle,
} from "@/lib/chartDeTableStyle";
import { tableInspectorProfile } from "@/lib/chartTableInspector";
import { resolveTableThemeVars } from "@/lib/chartSurfaceTheme";
import { cn } from "@/lib/utils";

const TABLE_TYPES = new Set(["table-info", "table-normal", "table-pivot"]);

export function isD3TableChartType(type: string): boolean {
  return TABLE_TYPES.has(type);
}

function D3TableViewInner(props: ChartEngineViewProps) {
  const {
    viewModel,
    style,
    chartConfig,
    fill = false,
    height = 180,
    width,
    ariaLabel,
    onInteraction,
    drillClickField,
    onTableStylePatch,
  } = props;

  const [page, setPage] = useState(1);
  const plan = useMemo(() => buildChartRenderPlan(viewModel), [viewModel]);
  const spec = useMemo(() => chartViewModelToRenderSpec(viewModel), [viewModel]);
  const profile = tableInspectorProfile(viewModel.chartType);

  const tableStyle = useMemo(
    () =>
      mergeChartTableStyle(
        readChartDeTableStyle(chartConfig ?? { chartType: viewModel.chartType }),
        style.tableColorStyle,
        style.scheme,
      ),
    [chartConfig, style.tableColorStyle, style.scheme, viewModel.chartType],
  );

  const allRows = useMemo(
    () => (plan.options.rows as unknown[][]) ?? viewModel.dataset.rows,
    [plan.options.rows, viewModel.dataset.rows],
  );
  const allColumns = useMemo(
    () => (plan.options.columns as string[]) ?? viewModel.dataset.columns,
    [plan.options.columns, viewModel.dataset.columns],
  );

  useEffect(() => {
    setPage(1);
  }, [allRows, tableStyle.pageSize, tableStyle.paginationMode, viewModel.chartType]);

  const tableModel = useMemo(() => {
    const base = buildTableModel({
      plotType: viewModel.chartType,
      rows: allRows,
      columns: allColumns,
      spec,
    });
    if (base.kind !== "pivot") return base;
    const summaryOn = tableStyle.showSummary !== false;
    return {
      ...base,
      showRowTotal: tableStyle.showRowTotal ?? (summaryOn && base.showRowTotal),
      showColTotal: tableStyle.showColTotal ?? (summaryOn && base.showColTotal),
    };
  }, [allColumns, allRows, spec, tableStyle.showColTotal, tableStyle.showRowTotal, tableStyle.showSummary, viewModel.chartType]);

  const themeVars = useMemo(
    () =>
      resolveTableThemeVars(tableStyle, {
        colorScheme: style.scheme,
        widgetShellBg: style.widgetShellBg,
      }),
    [style.scheme, style.widgetShellBg, tableStyle],
  );

  const handleDrillCellClick = (field: string, value: string) => {
    if (!onInteraction) return;
    if (drillClickField && drillClickField !== field) return;
    onInteraction({ kind: "drill", value, label: value });
  };

  if (plan.empty || viewModel.dataset.rows.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-theme-sm text-gray-400 dark:text-gray-500",
          fill ? "absolute inset-0" : "min-h-[180px]",
        )}
        role="status"
        aria-label="暂无数据"
        style={themeVars as CSSProperties}
        data-testid="d3-table-chart"
      >
        暂无数据
      </div>
    );
  }

  const shellStyle: CSSProperties = {
    ...(themeVars as CSSProperties),
    height: fill ? undefined : height,
    width: width ?? "100%",
  };

  if (tableModel.kind === "pivot") {
    return (
      <div
        className={cn("flex w-full flex-col", fill ? "absolute inset-0 min-h-0" : "min-h-[120px]")}
        aria-label={ariaLabel}
        style={shellStyle}
      >
        <TablePivotGrid
          model={tableModel}
          tableStyle={tableStyle}
          themeVars={themeVars}
          valueFormat={style.valueFormat}
          embedded={fill}
          layoutInteractive={Boolean(onTableStylePatch)}
          page={page}
          onPageChange={setPage}
          drillField={drillClickField}
          onDrillCellClick={onInteraction ? handleDrillCellClick : undefined}
          onTableStylePatch={onTableStylePatch}
          depthVisual={style.depthVisual}
        />
      </div>
    );
  }

  const metricFields = viewModel.encoding.metrics.map((m) => m.field).filter(Boolean);

  return (
    <div
      className={cn("flex w-full flex-col", fill ? "absolute inset-0 min-h-0" : "min-h-[120px]")}
      aria-label={ariaLabel}
      style={shellStyle}
    >
      <VitalSpanTable
        columns={allColumns}
        columnMeta={tableModel.columnMeta}
        displayCols={tableModel.columns}
        rows={allRows}
        page={page}
        onPageChange={setPage}
        tableStyle={tableStyle}
        themeVars={themeVars}
        valueFormat={style.valueFormat}
        drillField={drillClickField}
        onDrillCellClick={onInteraction ? handleDrillCellClick : undefined}
        metricFields={metricFields}
        embedded={fill}
        showSeriesNumber={
          profile?.showSeriesNumber ? (tableStyle.showSeriesNumber ?? true) : false
        }
        layoutInteractive={Boolean(onTableStylePatch)}
        onTableStylePatch={onTableStylePatch}
        depthVisual={style.depthVisual}
      />
    </div>
  );
}

export const D3TableView = memo(D3TableViewInner);
