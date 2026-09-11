import {
  TEMPLATE_CATEGORIES,
  type DashboardTemplateListItem,
  type VizSurfaceKind,
} from "@/lib/dashboardTemplates";

export const VIZ_TEMPLATES_HUB = {
  title: "可视化模板",
  description:
    "企业看板与大屏布局模板库。内置模板预览将自动绑定「示例数据」演示源。",
  importJson: "导入 JSON",
  searchPlaceholder: "搜索模板名称…",
  searchAriaLabel: "搜索模板",
  allCategories: "全部分类",
  filterSurfaceLabel: "类型",
  filterCategoryLabel: "分类",
  filterSurfaceAriaLabel: "模板类型",
  filterCategoryAriaLabel: "模板分类",
  emptyTitle: "暂无模板",
  emptyDescription: "当前筛选条件下没有可用模板，可尝试切换分类或导入 JSON 创建。",
  toastPublished: "模板已发布",
  toastArchived: "模板已下架，已从模板市场移除",
  toastDeleted: "模板已删除",
  toastImported: "模板导入成功",
  toastExportFailed: "导出失败",
  toastExported: "模板 JSON 已下载",
  invalidJson: "无法解析 JSON 文件",
  deleteTitle: "删除模板",
  deleteDescription: (name: string) => `确定删除「${name}」？删除后无法恢复。`,
} as const;

export const TEMPLATE_EDIT_SESSION = {
  builtinReadOnlyHint:
    "内置模板仅管理员可修改；当前保存仅作用于临时看板副本。",
  writableHint: (name: string) =>
    `保存将同步更新模板「${name}」的布局（模板市场预览与「使用模板」均生效）。`,
  savedWithTemplate: (name: string) => `看板与模板「${name}」布局已保存`,
  templateSyncFailed: "看板已保存，但模板布局同步失败",
} as const;

export const TEMPLATE_ACTIONS = {
  use: "使用模板",
  preview: "预览",
  edit: "编辑",
  editLayout: "编辑布局",
  templateSettings: "模板设置",
  export: "导出",
  publish: "发布",
  archive: "下架",
  delete: "删除",
  exportTemplate: "导出模板",
  publishAsTemplate: "发布为模板",
  layoutJson: "布局 JSON",
  templateSection: "模板",
  exportSection: "导出",
} as const;

/** 内置模板仅管理员可改元数据 */
export function canEditTemplateMeta(
  item: DashboardTemplateListItem,
  canManage: boolean,
): boolean {
  void item;
  return canManage;
}

/** 非内置模板：管理员或创建者可删除 */
export function canDeleteTemplate(
  item: DashboardTemplateListItem,
  canManage: boolean,
  currentUserId?: string | null,
): boolean {
  if (item.visibility === "builtin") return false;
  if (canManage) return true;
  return Boolean(currentUserId && item.ownerUserId && item.ownerUserId === currentUserId);
}

/** 已发布模板可下架（含内置，管理员） */
export function canArchiveTemplate(
  item: DashboardTemplateListItem,
  canManage: boolean,
): boolean {
  return canManage && item.status === "published";
}

export const TEMPLATE_BUILTIN_READONLY_HINT = "内置模板不可删除，请使用「下架」";

export const GOV_SECTION_LABELS = {
  dataScreen: "数据大屏",
  dashboard: "仪表板",
  hint: "政务模板含数据大屏与仪表板，已按类型分段展示。",
} as const;

export const SURFACE_TABS: { key: VizSurfaceKind; label: string }[] = [
  { key: "dashboard", label: "仪表板" },
  { key: "data-screen", label: "数据大屏" },
];

export function surfaceLabel(kind: VizSurfaceKind): string {
  return kind === "data-screen" ? "数据大屏" : "仪表板";
}

export function statusLabel(status: DashboardTemplateListItem["status"]): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

export function visibilityLabel(
  visibility: DashboardTemplateListItem["visibility"],
): string | null {
  switch (visibility) {
    case "builtin":
      return "内置";
    case "org":
      return "组织";
    case "private":
      return "私有";
    default:
      return null;
  }
}

export function categoryLabel(key: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function templatePreviewAspectRatio(_surfaceKind: VizSurfaceKind): string {
  /** Hub 卡片与组件库、看板列表缩略图统一 16:10，避免 minHeight 把预览区撑过高 */
  return "16 / 10";
}

/** 内置模板缩略图（当前工作区看板/大屏截图） */
export const BUILTIN_TEMPLATE_THUMBS: Record<string, string> = {
  "builtin-gov-industrial-park": "/template-assets/instance-thumbs/builtin-gov-industrial-park.jpg",
  "builtin-gov-smart-city": "/template-assets/instance-thumbs/builtin-gov-smart-city.jpg",
  "builtin-gov-digital-cockpit": "/template-assets/instance-thumbs/builtin-gov-digital-cockpit.png",
  "builtin-gov-emergency-command": "/template-assets/instance-thumbs/builtin-gov-emergency-command.png",
  "builtin-gov-eco-monitor": "/template-assets/instance-thumbs/builtin-gov-eco-monitor.jpg",
  "builtin-gov-community": "/template-assets/instance-thumbs/builtin-gov-community.jpg",
  "builtin-gov-efficiency": "/template-assets/instance-thumbs/builtin-gov-efficiency.jpg",
  "builtin-gov-satisfaction": "/template-assets/instance-thumbs/builtin-gov-satisfaction.jpg",
  "builtin-gov-finance": "/template-assets/instance-thumbs/builtin-gov-finance.jpg",
  "builtin-gov-grid": "/template-assets/instance-thumbs/builtin-gov-grid.jpg",
};

export const CATEGORY_ACCENT: Record<string, string> = {
  general: "from-brand-500/80 to-brand-400/40",
  monitoring: "from-cyan-500/80 to-sky-400/40",
  government: "from-indigo-500/80 to-violet-400/40",
  analytics: "from-violet-500/80 to-purple-400/40",
};

export function resolveTemplateThumbnail(
  templateKey: string,
  thumbnailRef?: string | null,
): string | null {
  return thumbnailRef ?? BUILTIN_TEMPLATE_THUMBS[templateKey] ?? null;
}
