import type { LayoutTemplateSlot } from "./layoutTemplates";
/** 模板槽位 → 内置图 deStyle：避免壳层标题重复、矮槽裁切、关系图越界 */
export declare function applySlotAwareChartStyle(chartConfig: Record<string, unknown>, slot: Pick<LayoutTemplateSlot, "width" | "height" | "defaultChartType">): Record<string, unknown>;
