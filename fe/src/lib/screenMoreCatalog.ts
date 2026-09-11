import type { ScreenMaterialInsertType } from "@/lib/screenVisualAssets";

export type ScreenMoreCatalogItem = {
  id: string;
  label: string;
  insertType: ScreenMaterialInsertType;
};

/** 大屏「更多」面板：仅日期时间与网页 */
export const SCREEN_MORE_CATALOG: ScreenMoreCatalogItem[] = [
  { id: "datetime", label: "日期时间", insertType: "screen-datetime" },
  { id: "webpage", label: "网页", insertType: "screen-webpage" },
];
