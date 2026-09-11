import type {
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  WidgetType,
} from "@/components/dashboard/layoutUtils";

export type DashboardPreviewSummaryWidget = {
  id: string;
  order: number;
  type?: WidgetType;
  title?: string;
  chartType?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  colSpan?: number;
  rowSpan?: number;
};

export type DashboardPreviewSummary = {
  version: 1 | 2;
  canvas?: { width: number; height: number };
  widgets: DashboardPreviewSummaryWidget[];
  styleConfig?: { surfaceKind?: string };
};

/** 将列表 API 的 previewSummary 转为缩略图可用的最小 layout */
export function previewSummaryToLayout(summary?: DashboardPreviewSummary | null): DashboardLayout | undefined {
  if (!summary) return undefined;
  const widgets = summary.widgets.map((w) => ({
    id: w.id,
    type: (w.type ?? "chart") as WidgetType,
    title: w.title ?? "",
    order: w.order,
    ...(w.chartType ? { chartConfig: { chartType: w.chartType } } : {}),
    ...(summary.version === 2
      ? { x: w.x ?? 0, y: w.y ?? 0, width: w.width ?? 120, height: w.height ?? 80 }
      : { colSpan: w.colSpan ?? 6, rowSpan: w.rowSpan ?? 2 }),
  }));

  if (summary.version === 2) {
    return {
      version: 2,
      canvas: summary.canvas ?? { width: 1440, height: 900 },
      widgets: widgets as DashboardLayoutV2["widgets"],
      globalFilters: [],
      styleConfig: summary.styleConfig,
    };
  }

  return {
    version: 1,
    widgets: widgets as DashboardLayoutV1["widgets"],
    globalFilters: [],
    styleConfig: summary.styleConfig,
  };
}
