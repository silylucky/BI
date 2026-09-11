import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type {
  DashboardStyleConfig,
  FilterWidgetConfig,
  MediaWidgetConfig,
  TabsWidgetConfig,
  TextWidgetConfig,
  WidgetType,
} from "./layoutUtils";

export type VizComponentRef = {
  componentId: string;
  pinnedRevision?: number;
  detached?: boolean;
};

export type DashboardWidgetBase = {
  id: string;
  type: WidgetType;
  title: string;
  order: number;
  /** 图层隐藏（大屏投放不渲染） */
  hidden?: boolean;
  /** 图层锁定（编辑态禁止拖动/缩放） */
  locked?: boolean;
  parentTabsId?: string;
  tabPaneId?: string;
  componentRef?: VizComponentRef;
  chartConfig?: ChartViewConfig;
  filterConfig?: FilterWidgetConfig;
  textConfig?: TextWidgetConfig;
  mediaConfig?: MediaWidgetConfig;
  tabsConfig?: TabsWidgetConfig;
  customVizConfig?: CustomVizWidgetConfig;
};

export type LayoutWidget = DashboardWidgetBase & {
  colSpan: number;
  rowSpan: number;
  gridX?: number;
  gridY?: number;
};

export type PixelLayoutWidget = DashboardWidgetBase & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DashboardCanvas = {
  width: 1440;
  height: number;
};

export type DashboardLayoutV1 = {
  version: 1;
  widgets: LayoutWidget[];
  globalFilters: unknown[];
  styleConfig?: DashboardStyleConfig;
  demoPackage?: DemoPackageLayoutMeta;
};

export type DemoPackageLayoutMeta = {
  seed?: boolean;
  sourceTemplateKey?: string;
};

export type DashboardLayoutV2 = {
  version: 2;
  canvas: DashboardCanvas;
  widgets: PixelLayoutWidget[];
  globalFilters: unknown[];
  styleConfig?: DashboardStyleConfig;
  demoPackage?: DemoPackageLayoutMeta;
};

export type DashboardLayout = DashboardLayoutV1 | DashboardLayoutV2;
