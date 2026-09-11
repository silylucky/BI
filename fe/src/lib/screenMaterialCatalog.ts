import type { ScreenPresetInsertPayload } from "@/components/dashboard/createLayoutWidget";

export type ScreenMaterialCategory = "border" | "shape" | "icon";

export type ScreenMaterialCatalogItem = {
  id: string;
  label: string;
  category: ScreenMaterialCategory;
  payload: ScreenPresetInsertPayload;
};

export const SCREEN_MATERIAL_CATEGORIES: { id: ScreenMaterialCategory; label: string }[] = [
  { id: "border", label: "边框" },
  { id: "shape", label: "图形" },
  { id: "icon", label: "图标" },
];

export const SCREEN_SHAPE_OPTIONS = [
  { id: "rect", label: "矩形" },
  { id: "triangle", label: "三角形" },
  { id: "circle", label: "圆形" },
] as const;

export const SCREEN_ICON_CATALOG = [
  { name: "home", label: "主页" },
  { name: "search", label: "搜索" },
  { name: "plus", label: "加号" },
  { name: "minus", label: "减号" },
  { name: "star", label: "星标" },
  { name: "heart", label: "收藏" },
  { name: "bell", label: "通知" },
  { name: "user", label: "用户" },
  { name: "settings", label: "设置" },
  { name: "clock", label: "时钟" },
  { name: "calendar", label: "日历" },
  { name: "mail", label: "邮件" },
  { name: "phone", label: "电话" },
  { name: "map-pin", label: "定位" },
  { name: "camera", label: "相机" },
  { name: "image", label: "图片" },
  { name: "video", label: "视频" },
  { name: "music", label: "音乐" },
  { name: "download", label: "下载" },
  { name: "upload", label: "上传" },
  { name: "refresh-cw", label: "刷新" },
  { name: "check", label: "确认" },
  { name: "x", label: "关闭" },
  { name: "info", label: "信息" },
  { name: "alert-circle", label: "警告" },
  { name: "trash-2", label: "删除" },
  { name: "pencil", label: "编辑" },
  { name: "filter", label: "筛选" },
  { name: "eye", label: "查看" },
  { name: "lock", label: "锁定" },
  { name: "unlock", label: "解锁" },
  { name: "link", label: "链接" },
  { name: "share-2", label: "分享" },
  { name: "send", label: "发送" },
  { name: "message-circle", label: "消息" },
  { name: "headphones", label: "耳机" },
  { name: "compass", label: "指南针" },
  { name: "pie-chart", label: "饼图" },
  { name: "power", label: "电源" },
  { name: "sliders-horizontal", label: "调节" },
] as const;

const BORDER_VARIANTS: ScreenMaterialCatalogItem[] = Array.from({ length: 9 }, (_, index) => {
  const id = `border-${index + 1}`;
  return {
    id,
    label: `边框${index + 1}`,
    category: "border",
    payload: { insert: "screen-border", preset: id },
  };
});

const SHAPE_ITEMS: ScreenMaterialCatalogItem[] = SCREEN_SHAPE_OPTIONS.map((shape) => ({
  id: `shape-${shape.id}`,
  label: shape.label,
  category: "shape",
  payload: { insert: "screen-shape", preset: shape.id },
}));

const ICON_ITEMS: ScreenMaterialCatalogItem[] = SCREEN_ICON_CATALOG.map(({ name, label }) => ({
  id: `icon-${name}`,
  label,
  category: "icon",
  payload: { insert: "screen-icon", preset: name },
}));

/** 大屏「素材库」catalog（对标 DataEase 边框/图形/图标） */
export const SCREEN_MATERIAL_CATALOG: ScreenMaterialCatalogItem[] = [
  ...BORDER_VARIANTS,
  ...SHAPE_ITEMS,
  ...ICON_ITEMS,
];

export function getScreenMaterialByCategory(
  category: ScreenMaterialCategory,
): ScreenMaterialCatalogItem[] {
  return SCREEN_MATERIAL_CATALOG.filter((item) => item.category === category);
}

export function getScreenMaterialCatalogItem(
  id: string,
): ScreenMaterialCatalogItem | undefined {
  return SCREEN_MATERIAL_CATALOG.find((item) => item.id === id);
}

export function getScreenBorderCatalogItems(): ScreenMaterialCatalogItem[] {
  return getScreenMaterialByCategory("border");
}

export function getScreenIconCatalog(): readonly { name: string; label: string }[] {
  return SCREEN_ICON_CATALOG;
}
