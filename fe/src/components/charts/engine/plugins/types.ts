import type { ComponentType } from "react";
import type { EngineCapabilities } from "@/components/charts/engine/capabilities";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";
import type { ChartStyleSectionId } from "@/lib/chartStyleSectionRegistry";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type ChartLibrary = "d3" | "react" | "maplibre";

export type DePaletteCategory =
  | "quota"
  | "table"
  | "trend"
  | "compare"
  | "distribute"
  | "map"
  | "relation"
  | "dual_axes";

export type ChartViewPlugin = {
  type: string;
  library: ChartLibrary;
  paletteCategory: DePaletteCategory;
  renderer: "antv" | "table";
  properties: ChartStyleSectionId[];
  engineCapabilities: EngineCapabilities;
  deprecated?: boolean;
  migratesTo?: string;
  buildRenderPlan: (vm: ChartViewModel) => ChartRenderPlan;
  setupDefaultConfig?: (cfg: ChartViewConfig) => ChartViewConfig;
};

export type ChartPluginDef = Omit<ChartViewPlugin, "buildRenderPlan"> & {
  planKind?: "column" | "line" | "pie" | "dual" | "geo" | "graph" | "table" | "kpi" | "custom";
};

export type ChartInspectorDef = {
  styleSections?: ChartStyleSectionId[];
};

export type ChartPluginPackage = ChartViewPlugin & {
  inspector?: ChartInspectorDef;
  demo?: ComponentType;
};
