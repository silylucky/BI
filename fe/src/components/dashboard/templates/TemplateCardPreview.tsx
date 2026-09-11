import { LayoutDashboard } from "lucide-react";
import { ComponentPreviewShell } from "@/components/dashboard/viz-components/ComponentCardPreview";
import type { DashboardTemplateListItem } from "@/lib/dashboardTemplates";
import { cn } from "@/lib/utils";

type TemplateCardPreviewProps = {
  templateId: string;
  surfaceKind: DashboardTemplateListItem["surfaceKind"];
  className?: string;
  eager?: boolean;
  /** 静态缩略图（内置 SVG 或上传封面） */
  thumbnailSrc?: string | null;
};

/** 模板卡片预览区：仅展示静态缩略图，不在列表页 live 渲染布局。 */
export function TemplateCardPreview({
  surfaceKind,
  className,
  eager = false,
  thumbnailSrc = null,
}: TemplateCardPreviewProps) {
  const isScreen = surfaceKind === "data-screen";
  const resolvedSrc = thumbnailSrc?.trim();

  const content = resolvedSrc ? (
    <img
      src={resolvedSrc}
      alt=""
      className="h-full w-full object-cover object-center"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  ) : (
    <div
      className={cn(
        "flex h-full items-center justify-center",
        isScreen ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-900/60",
      )}
    >
      <LayoutDashboard
        className={cn("size-10", isScreen ? "text-slate-600" : "text-gray-300 dark:text-gray-600")}
        aria-hidden
      />
    </div>
  );

  return (
    <div
      className={cn("h-full", className)}
      data-testid="template-card-preview"
      data-live="false"
      aria-hidden
    >
      <ComponentPreviewShell className="h-full">{content}</ComponentPreviewShell>
    </div>
  );
}
