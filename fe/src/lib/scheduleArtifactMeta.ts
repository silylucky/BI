export type ScheduleArtifactKind = "layout_inventory" | "visual_snapshot" | "template_render" | (string & {});

const ARTIFACT_KIND_LABELS: Record<string, string> = {
  layout_inventory: "布局摘要",
  visual_snapshot: "可视化快照",
  visual_snapshot_full_page: "高清整页快照",
  visual_snapshot_per_widget: "按组件分页",
  visual_snapshot_combined: "总览 + 组件放大",
  visual_snapshot_bundle: "整页长图 + 按组件分页",
  template_render: "报表渲染",
};

export function localizeArtifactKind(kind: string | null | undefined): string | null {
  if (!kind) return null;
  return ARTIFACT_KIND_LABELS[kind] ?? kind;
}

export function isLayoutInventoryArtifact(kind: string | null | undefined): boolean {
  return kind === "layout_inventory";
}

export const LAYOUT_INVENTORY_NOTICE =
  "历史记录为布局摘要附件（升级前产物）；新执行的看板定时报告将投递可视化快照 PDF。";

export const VISUAL_SNAPSHOT_CREATE_NOTICE =
  "新建定时报告将生成一份高清整页 PDF 快照。若环境未就绪，预检会阻断创建。";
