import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import type { LayoutWidget } from "./layoutUtils";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { useChartInspector } from "./chartInspectorContext";
import { ChartEditorColumn } from "./ChartEditorColumn";
import { DatasetPickerPanel } from "./DatasetPickerPanel";
import { FieldBankPlaceholder } from "./DatasetFieldBank";
import { WidgetEditRailLayout } from "./WidgetEditRailLayout";

type ChartEditRailChromeProps = {
  onDelete?: () => void;
  onDataRefresh?: () => void;
  className?: string;
};

export type ChartEditRailProps = ChartEditRailChromeProps & {
  widget: LayoutWidget;
  onChange: (chartConfig: ChartViewConfig) => void;
  onTitleChange?: (title: string) => void;
  dashboardStyle?: DashboardStyleConfig;
  dashboardId?: string;
  dashboardWidgets?: LayoutWidget[];
};

function ChartEditRailInner({
  onDelete,
  onDataRefresh,
  className,
}: ChartEditRailChromeProps) {
  const {
    widget,
    cfg,
    catalog,
    datasetsLoading,
    datasetsError,
    datasetItems,
    datasetsEmpty,
    handleDatasetSelect,
    datasetBindingError,
    columnKindOverrides,
    columns,
    columnsLoading,
    columnsReady,
    assignField,
    refreshColumns,
  } = useChartInspector();

  const typeLabel =
    catalog.find((item) => item.type === cfg.chartType)?.displayName ?? cfg.chartType;
  const leftSubtitle =
    widget.title && widget.title !== typeLabel ? widget.title : undefined;
  const hasChartConfig = Boolean(widget.chartConfig);

  return (
    <WidgetEditRailLayout
      className={cn("h-full min-h-0", className)}
      leftLabel={typeLabel}
      leftSubtitle={leftSubtitle}
      rightLabel="数据集"
      left={
        <ChartEditorColumn
          onDelete={onDelete}
          onDataRefresh={onDataRefresh}
          className="min-w-0"
        />
      }
      right={
        hasChartConfig ? (
          <DatasetPickerPanel
            widgetId={widget.id}
            datasetId={cfg.datasetId}
            datasetsLoading={datasetsLoading}
            datasetsError={datasetsError}
            datasetsEmpty={datasetsEmpty}
            datasetItems={datasetItems}
            columns={columns}
            columnsLoading={columnsLoading}
            columnsReady={columnsReady}
            columnKindOverrides={columnKindOverrides}
            onDatasetSelect={handleDatasetSelect}
            datasetBindingError={datasetBindingError}
            onFieldClick={(field) => assignField(field)}
            onRefreshFields={refreshColumns}
          />
        ) : (
          <FieldBankPlaceholder />
        )
      }
    />
  );
}

/** 图表右栏（自带 ChartInspectorProvider，单入口避免漏包 Context）。 */
export function ChartEditRail({
  widget,
  onChange,
  onTitleChange,
  dashboardStyle,
  dashboardId,
  dashboardWidgets,
  ...chromeProps
}: ChartEditRailProps) {
  return (
    <ChartInspectorProvider
      widget={widget}
      onChange={onChange}
      onTitleChange={onTitleChange}
      dashboardStyle={dashboardStyle}
      dashboardId={dashboardId}
      dashboardWidgets={dashboardWidgets}
    >
      <ChartEditRailInner {...chromeProps} />
    </ChartInspectorProvider>
  );
}

/** @deprecated 使用 `ChartEditRail`（已内置 Provider） */
export const ChartEditRailWithProvider = ChartEditRail;

export function ChartEditRailEmpty({ message, className }: { message: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center px-4 py-10 text-center",
        className,
      )}
    >
      {message}
    </div>
  );
}

export { FieldBankPlaceholder };
