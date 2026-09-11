import type { ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { getChartPlugin, listChartPlugins } from "@/components/charts/engine/plugins/registry";
import { CHART_TYPE_DISPLAY_NAMES } from "@/lib/chartTypeDisplayNames";

/** 对标 DataEase 组件库分区标题 */
export type DePaletteSectionDef = {
  id: string;
  label: string;
};

export const DE_PALETTE_CATEGORY_SECTIONS: readonly DePaletteSectionDef[] = [
  { id: "quota", label: "指标" },
  { id: "table", label: "表格" },
  { id: "trend", label: "线/面图" },
  { id: "compare", label: "柱/条图" },
  { id: "distribute", label: "分布图" },
  { id: "map", label: "地图" },
  { id: "relation", label: "关系图" },
  { id: "dual_axes", label: "双轴图" },
] as const;

export type DePaletteSection = {
  id: string;
  label: string;
  items: ChartTypeCatalogItem[];
};

function resolvePaletteCategory(item: ChartTypeCatalogItem): string {
  if (item.paletteCategory) return item.paletteCategory;
  return getChartPlugin(item.type)?.paletteCategory ?? "compare";
}

function isVisibleCatalogItem(item: ChartTypeCatalogItem): boolean {
  if (item.deprecated) return false;
  const plugin = getChartPlugin(item.type);
  if (plugin?.deprecated) return false;
  return true;
}

export function filterVisibleCatalogItems(items: ChartTypeCatalogItem[]): ChartTypeCatalogItem[] {
  return items.filter(isVisibleCatalogItem);
}

/** catalog / plugin 驱动 Picker 分区（paletteCategory） */
export function buildDeStylePaletteSections(
  items: ChartTypeCatalogItem[],
): DePaletteSection[] {
  const visible = items.filter(isVisibleCatalogItem);
  const byType = new Map(visible.map((item) => [item.type, item]));
  const used = new Set<string>();
  const sections: DePaletteSection[] = [];

  for (const section of DE_PALETTE_CATEGORY_SECTIONS) {
    const sectionItems = visible.filter(
      (item) => resolvePaletteCategory(item) === section.id,
    );
    for (const item of sectionItems) used.add(item.type);
    if (sectionItems.length > 0) {
      sections.push({ id: section.id, label: section.label, items: sectionItems });
    }
  }

  const orphans = visible.filter((item) => !used.has(item.type));
  if (orphans.length > 0) {
    sections.push({ id: "more", label: "更多", items: orphans });
  }

  return sections;
}

/** catalog 请求失败时从 FE plugin registry 构造 */
export function buildPluginCatalogFallback(): ChartTypeCatalogItem[] {
  return listChartPlugins()
    .filter((plugin) => !plugin.deprecated)
    .map((plugin) => ({
      type: plugin.type,
      displayName: CHART_TYPE_DISPLAY_NAMES[plugin.type] ?? plugin.type,
      category: plugin.paletteCategory,
      paletteCategory: plugin.paletteCategory,
      renderer: plugin.renderer,
      library: plugin.library,
      styleVariants: ["default"],
      fieldRule: {},
    }));
}

/** paletteCategory → 中文分区名（与 Picker 侧栏一致） */
export function paletteCategoryLabel(categoryId: string): string {
  const found = DE_PALETTE_CATEGORY_SECTIONS.find((section) => section.id === categoryId);
  return found?.label ?? categoryId;
}
