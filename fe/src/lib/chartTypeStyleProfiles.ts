import type { ChartType } from "@/lib/chartViewConfig";
import { tableStyleSectionsForType } from "@/lib/chartTableInspector";
import type { ChartStyleSectionId } from "@/lib/chartStyleSectionRegistry";
import {
  chartTypeHasTooltipSection,
  resolveCartesianShapeFields,
} from "@/lib/chartStyleCartesianFields";

/** catalog 多 styleVariant 时才展示 variantBasic */
const VARIANT_BASIC_TYPES = new Set<string>(["line", "gauge", "graph"]);

const SHELL: ChartStyleSectionId[] = ["background", "palette", "title"];

const CARTESIAN_CORE: ChartStyleSectionId[] = [
  "axis",
  "cartesianShape",
  ...SHELL,
  "remark",
  "legend",
  "label",
  "tooltip",
];

const CARTESIAN_NO_LEGEND: ChartStyleSectionId[] = [
  "axis",
  "cartesianShape",
  ...SHELL,
  "remark",
  "label",
];

const QUADRANT_STYLE: ChartStyleSectionId[] = [
  "axis",
  "cartesianShape",
  "quadrantShape",
  ...SHELL,
  "remark",
  "legend",
  "label",
  "tooltip",
];

const PIE_STYLE: ChartStyleSectionId[] = [
  "pieShape",
  "background",
  "title",
  "remark",
  "legend",
  "label",
  "tooltip",
];

const MAP_2D_STYLE: ChartStyleSectionId[] = ["background", "mapBasic", "title", "geo", "remark"];

const MAP_3D_STYLE: ChartStyleSectionId[] = ["background", "title", "geo", "remark"];

const GIS_MAP_STYLE: ChartStyleSectionId[] = [
  "gisProject",
  "gisAtmosphere",
  "gisSun",
  "gisOverlay",
  "gisLayers",
  "background",
  "title",
  "remark",
];

const MINIMAL: ChartStyleSectionId[] = [...SHELL];

export type ChartTypeStyleProfile = {
  sections: ChartStyleSectionId[];
  fields?: Partial<Record<ChartStyleSectionId, string[]>>;
};

const PROFILE_BY_TYPE: Record<string, ChartStyleSectionId[]> = {
  gauge: [...MINIMAL, "label", "gaugeShape"],
  liquid: [...MINIMAL, "label", "liquidShape"],
  kpi: [...MINIMAL, "label", "kpiIndicator"],

  line: CARTESIAN_CORE,
  area: CARTESIAN_CORE,
  "area-stack": CARTESIAN_CORE,
  timeline: CARTESIAN_CORE,

  bar: CARTESIAN_CORE,
  "bar-stack": CARTESIAN_CORE,
  "percentage-bar-stack": CARTESIAN_CORE,
  "bar-group": CARTESIAN_CORE,
  "bar-group-stack": CARTESIAN_CORE,
  waterfall: CARTESIAN_CORE,
  "bar-horizontal": CARTESIAN_CORE,
  "bar-stack-horizontal": CARTESIAN_CORE,
  "percentage-bar-stack-horizontal": CARTESIAN_CORE,
  "bar-range": CARTESIAN_NO_LEGEND,
  "bidirectional-bar": CARTESIAN_CORE,
  "progress-bar": ["axis", "cartesianShape", "progressBarShape", ...SHELL, "remark", "label"],
  "stock-line": ["axis", "stockLineShape", ...SHELL, "remark", "label"],
  "bullet-graph": ["axis", "cartesianShape", "bulletShape", ...SHELL, "remark", "label"],

  pie: PIE_STYLE,
  "pie-donut": PIE_STYLE,
  "pie-rose": PIE_STYLE,
  "pie-donut-rose": PIE_STYLE,
  radar: [...SHELL, "remark", "label", "radarShape"],
  treemap: [...SHELL, "remark", "label", "treemapShape"],
  "word-cloud": [...MINIMAL, "wordCloudShape"],
  wordCloud: [...MINIMAL, "wordCloudShape"],

  map: MAP_2D_STYLE,
  "map-3d": MAP_3D_STYLE,
  "gis-map": GIS_MAP_STYLE,
  heatmap: ["axis", ...SHELL, "label"],

  scatter: CARTESIAN_CORE,
  quadrant: QUADRANT_STYLE,
  funnel: [...SHELL, "legend", "label", "funnelShape"],
  sankey: [...MINIMAL, "label", "sankeyShape"],
  "circle-packing": [...MINIMAL, "label", "circlePackingShape"],
  "multi-scatter": CARTESIAN_CORE,
  graph: [...MINIMAL, "label", "graphShape"],

  combo: CARTESIAN_CORE,
  "chart-mix": CARTESIAN_CORE,
  "chart-mix-group": CARTESIAN_CORE,
  "chart-mix-stack": CARTESIAN_CORE,
  "chart-mix-dual-line": CARTESIAN_CORE,

  "t-heatmap": [...SHELL, "geo"],
};

const CARTESIAN_SHAPE_FIELDS: Record<string, string[]> = {
  bar: ["barWidthRatio", "barRadius"],
  line: ["lineSmooth", "lineWidth", "pointSize", "areaOpacity"],
  area: ["lineSmooth", "lineWidth", "pointSize", "areaOpacity"],
  waterfall: ["barRadius"],
  "stock-line": [],
};

export function resolveChartTypeStyleProfile(chartType: ChartType): ChartTypeStyleProfile {
  const tableSections = tableStyleSectionsForType(chartType);
  if (tableSections.length > 0) {
    return { sections: tableSections };
  }

  let base = PROFILE_BY_TYPE[chartType] ?? CARTESIAN_CORE;
  if (!chartTypeHasTooltipSection(chartType)) {
    base = base.filter((id) => id !== "tooltip");
  } else if (!base.includes("tooltip")) {
    const labelIdx = base.indexOf("label");
    base =
      labelIdx >= 0
        ? [...base.slice(0, labelIdx + 1), "tooltip", ...base.slice(labelIdx + 1)]
        : [...base, "tooltip"];
  }
  const sections = VARIANT_BASIC_TYPES.has(chartType) ? ["variantBasic", ...base] : base;
  const cartesianFields =
    resolveCartesianShapeFields(chartType) ?? CARTESIAN_SHAPE_FIELDS[chartType];
  const fields = cartesianFields ? { cartesianShape: cartesianFields } : undefined;

  return { sections, fields };
}

/** 样式 Tab 分区真理源（替代 metadata.properties 分叉） */
export function chartStyleSectionsFromProfile(chartType: ChartType): ChartStyleSectionId[] {
  return resolveChartTypeStyleProfile(chartType).sections;
}
