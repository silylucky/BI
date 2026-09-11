export type {
  ChartAxesConfig,
  DeAxisFieldType,
  DeAxisId,
  DeAxisSlot,
  DeAxisSpec,
  ResolvedChartEncoding,
} from "./types";
export {
  cartesianTrendAxes,
  deAxis,
  expandAxisSpecs,
} from "./builders";
export {
  DE_AXIS_CATALOG,
  deriveFieldRuleFromDeCatalog,
  getDeAxisBlueprint,
  getDeAxisLegacyMap,
  getDeAxisSpecs,
} from "./catalog";
