import { useState } from "react";
import { Download, FileJson, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartInspectorSection } from "@/components/dashboard/inspectorCompact";
import { DeAttrForm } from "@/components/dashboard/dashboardInspectorUi";
import { PublishTemplateDialog } from "@/components/dashboard/templates/PublishTemplateDialog";
import { TEMPLATE_ACTIONS } from "@/components/dashboard/templates/templateLabels";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import { buildVizLayoutEnvelope } from "@/lib/dashboardTemplates";
import { downloadJsonFile, downloadLayoutJson } from "@/lib/exportLayoutJson";

type DashboardTemplateExtrasProps = {
  layout: DashboardLayout;
  styleConfig: DashboardStyleConfig;
  widgets: DashboardLayout["widgets"];
  name: string;
  canSave: boolean;
  dashboardId: string;
};

function buildExportLayout(
  layout: DashboardLayout,
  widgets: DashboardLayout["widgets"],
  styleConfig: DashboardStyleConfig,
): DashboardLayout {
  return {
    ...layout,
    widgets,
    styleConfig: { ...styleConfig, surfaceKind: "dashboard" },
    globalFilters: layout.globalFilters ?? [],
  };
}

export function DashboardTemplateExtras({
  layout,
  styleConfig,
  widgets,
  name,
  canSave,
  dashboardId,
}: DashboardTemplateExtrasProps) {
  const [publishOpen, setPublishOpen] = useState(false);
  const exportLayout = buildExportLayout(layout, widgets, styleConfig);

  return (
    <>
      <ChartInspectorSection title={TEMPLATE_ACTIONS.templateSection} defaultOpen>
        <DeAttrForm>
          <div data-testid="dashboard-template-actions">
            <p className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {TEMPLATE_ACTIONS.exportSection}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 text-[11px] font-medium"
                disabled={!canSave}
                onClick={() => {
                  downloadLayoutJson(exportLayout, name);
                  toast.success("布局 JSON 已下载");
                }}
              >
                <FileJson className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{TEMPLATE_ACTIONS.layoutJson}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 text-[11px] font-medium"
                disabled={!canSave}
                onClick={() => {
                  const payload = buildVizLayoutEnvelope(exportLayout, name, "dashboard");
                  downloadJsonFile(payload, `${name.trim() || "dashboard"}-template.json`);
                  toast.success("模板 JSON 已下载");
                }}
              >
                <Download className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{TEMPLATE_ACTIONS.exportTemplate}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 h-8 gap-1.5 px-2 text-[11px] font-medium"
                disabled={!canSave}
                onClick={() => setPublishOpen(true)}
              >
                <LayoutTemplate className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{TEMPLATE_ACTIONS.publishAsTemplate}</span>
              </Button>
            </div>
          </div>
        </DeAttrForm>
      </ChartInspectorSection>
      <PublishTemplateDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        dashboardId={dashboardId}
        defaultName={name}
        surfaceKind="dashboard"
      />
    </>
  );
}
