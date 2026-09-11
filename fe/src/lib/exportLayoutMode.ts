export type ExportLayoutMode = "full_page" | "per_widget" | "combined";

export const EXPORT_LAYOUT_MODE_LABELS: Record<
  ExportLayoutMode,
  { badge: string; title: string; hint: string }
> = {
  full_page: {
    badge: "高清整页",
    title: "【导出模式：高清整页快照】",
    hint: "单页连续展示完整看板画布（高分辨率）；仅当内容超出引擎上限时才分页。",
  },
  per_widget: {
    badge: "按组件分页",
    title: "【导出模式：按组件分页】",
    hint: "每个看板组件单独一页，避免图表被拦腰切断。",
  },
  combined: {
    badge: "总览+组件放大",
    title: "【导出模式：总览 + 组件放大】",
    hint: "前半整页总览，后半每个组件放大分页，便于阅读数据细节。",
  },
};

export const EXPORT_SECTION_LABELS = {
  overview: {
    title: "第一部分：整页总览",
    hint: "完整看板画布一览，用于把握整体布局与组件分布。",
  },
  enlarged: {
    title: "第二部分：组件放大明细",
    hint: "每个组件单独放大占满页面，数据标签与图例更清晰可读。",
  },
} as const;

export function parseExportLayoutMode(raw: string | null): ExportLayoutMode {
  if (raw === "per_widget") return "per_widget";
  if (raw === "combined") return "combined";
  return "full_page";
}
