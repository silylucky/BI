import type { DashboardTemplateListItem } from "@/lib/dashboardTemplates";
import { LayoutDashboard, Monitor } from "lucide-react";
import {
  categoryLabel,
  statusLabel,
  surfaceLabel,
  visibilityLabel,
} from "@/components/dashboard/templates/templateLabels";

type TemplatePreviewFooterProps = {
  surfaceKind: DashboardTemplateListItem["surfaceKind"];
  categoryKey: string;
  visibility: DashboardTemplateListItem["visibility"];
  status: DashboardTemplateListItem["status"];
};

function buildTrailing({
  categoryKey,
  visibility,
  status,
}: Pick<TemplatePreviewFooterProps, "categoryKey" | "visibility" | "status">): string {
  const parts: string[] = [categoryLabel(categoryKey)];
  const vis = visibilityLabel(visibility);
  if (vis) parts.push(vis);
  if (status !== "published") parts.push(statusLabel(status));
  return parts.join(" · ");
}

/** 模板卡片元信息：单行紧凑，避免 Badge 换行撑高 */
export function TemplatePreviewFooter({
  surfaceKind,
  categoryKey,
  visibility,
  status,
}: TemplatePreviewFooterProps) {
  const Icon = surfaceKind === "data-screen" ? Monitor : LayoutDashboard;

  return (
    <div className="flex items-center justify-between gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
      <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-gray-600 dark:text-gray-400">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{surfaceLabel(surfaceKind)}</span>
      </span>
      <span className="shrink-0 truncate">{buildTrailing({ categoryKey, visibility, status })}</span>
    </div>
  );
}
