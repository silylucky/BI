import { apiFetch } from "@/lib/api";
import "@/components/charts/engine/plugins/index";
import { getChartPlugin, listChartPlugins } from "@/components/charts/engine/plugins/registry";
import { CHART_TYPE_DISPLAY_NAMES } from "@/lib/chartTypeDisplayNames";

export type ChartTypeCatalogItem = {
  type: string;
  displayName: string;
  category: string;
  renderer: string;
  styleVariants: string[];
  fieldRule: {
    minDimensions?: number;
    maxDimensions?: number;
    minMetrics?: number;
    maxMetrics?: number;
    note?: string;
  };
  library?: string;
  paletteCategory?: string;
  deprecated?: boolean;
  migratesTo?: string | null;
  /** API 原始 renderer（契约登记，可能与运行时不同） */
  catalogRenderer?: string;
  /** API 原始 library（历史 AntV 分包登记，可能与运行时不同） */
  catalogLibrary?: string;
};

let cache: ChartTypeCatalogItem[] | null = null;

export function resetChartTypeCatalogCache(): void {
  cache = null;
}

const FALLBACK_TYPES = [
  "table-info",
  "line",
  "bar",
  "bar-stack",
  "pie",
  "pie-donut",
  "scatter",
  "chart-mix",
  "gauge",
  "liquid",
  "map",
  "t-heatmap",
  "kpi",
  "area",
  "sankey",
  "funnel",
  "graph",
  "word-cloud",
  "bidirectional-bar",
  "waterfall",
  "table-pivot",
  "radar",
  "treemap",
] as const;

export function getCachedCatalog(): ChartTypeCatalogItem[] | null {
  return cache;
}

export function isKnownChartType(type: string): boolean {
  if (cache) return cache.some((c) => c.type === type);
  if (listChartPlugins().some((p) => p.type === type)) return true;
  return (FALLBACK_TYPES as readonly string[]).includes(type);
}

export async function fetchChartTypeCatalog(): Promise<ChartTypeCatalogItem[]> {
  const body = await apiFetch<ChartTypeCatalogItem[]>("/api/v1/charts/types");
  if (!Array.isArray(body)) {
    cache = null;
    throw new Error("Invalid chart type catalog response");
  }
  cache = body;
  return body;
}

export function enrichChartCatalogItems(items: ChartTypeCatalogItem[]): ChartTypeCatalogItem[] {
  return items.map((item) => {
    const plugin = getChartPlugin(item.type);
    return {
      ...item,
      displayName: item.displayName || CHART_TYPE_DISPLAY_NAMES[item.type] || item.type,
      paletteCategory: item.paletteCategory || plugin?.paletteCategory || item.category,
      deprecated: item.deprecated ?? plugin?.deprecated,
      migratesTo: item.migratesTo ?? plugin?.migratesTo ?? null,
      catalogRenderer: item.renderer,
      catalogLibrary: item.library,
      library: plugin?.library ?? item.library,
      renderer: plugin?.renderer ?? item.renderer,
    };
  });
}

export function buildFallbackCatalogItems(): ChartTypeCatalogItem[] {
  return listChartPlugins()
    .filter((plugin) => !plugin.deprecated)
    .map((plugin) => ({
      type: plugin.type,
      displayName: getChartTypeDisplayName(plugin.type),
      category: plugin.paletteCategory,
      paletteCategory: plugin.paletteCategory,
      renderer: plugin.renderer,
      library: plugin.library,
      styleVariants: ["default"],
      fieldRule: {},
    }));
}

/** 优先 API catalog，回退 FE 中文名表 */
export function getChartTypeDisplayName(type: string): string {
  const cached = cache?.find((item) => item.type === type)?.displayName;
  if (cached) return cached;
  return CHART_TYPE_DISPLAY_NAMES[type] ?? type;
}
