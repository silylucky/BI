import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardStyleConfig } from "@/components/dashboard/layoutUtils";
import { resolveWidgetShellPaintColor, pickChartPaletteDefaults } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { isEchartsChartType } from "@/lib/chartViewConfig";
import { fitPreviewSize, WidgetDialogShell } from "./WidgetDialogShell";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import { exportChartPngFromContainer } from "./exportChartImage";

const RESOLUTION_PRESETS = [
  { id: "1280x720", label: "1280 × 720", width: 1280, height: 720 },
  { id: "1920x1080", label: "1920 × 1080", width: 1920, height: 1080 },
  { id: "fit", label: "适应窗口", width: 1280, height: 720 },
] as const;

/** DE 放大弹窗内容区上限（16:9） */
const ENLARGE_PREVIEW_BOUNDS = { maxWidth: 1280, maxHeight: 720 };

type WidgetEnlargeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  title: string;
  chartConfig: ChartViewConfig;
  filterParameters?: Record<string, string>;
  executeKey?: string;
  styleConfig?: DashboardStyleConfig;
};

export function WidgetEnlargeDialog({
  open,
  onOpenChange,
  widgetId,
  title,
  chartConfig,
  filterParameters,
  executeKey,
  styleConfig,
}: WidgetEnlargeDialogProps) {
  const [resolutionId, setResolutionId] =
    useState<(typeof RESOLUTION_PRESETS)[number]["id"]>("1280x720");
  const previewRef = useRef<HTMLDivElement>(null);

  const canExportImage = useMemo(
    () => isEchartsChartType(chartConfig.chartType),
    [chartConfig.chartType],
  );

  const resolution = useMemo(
    () => RESOLUTION_PRESETS.find((item) => item.id === resolutionId) ?? RESOLUTION_PRESETS[0],
    [resolutionId],
  );

  const previewSize = useMemo(
    () => fitPreviewSize(resolution, ENLARGE_PREVIEW_BOUNDS),
    [resolution],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WidgetDialogShell
        testId="widget-enlarge-dialog"
        title={title}
        contentClassName="max-h-[min(90vh,860px)] w-[min(94vw,1360px)]"
        bodyClassName="flex items-center justify-center overflow-auto bg-gray-50/90 p-6 dark:bg-white/[0.02]"
        toolbar={
          <>
            <Select
              value={resolutionId}
              onValueChange={(value) =>
                setResolutionId(value as (typeof RESOLUTION_PRESETS)[number]["id"])
              }
            >
              <SelectTrigger className="h-9 w-[8.75rem]" aria-label="预览分辨率">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_PRESETS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden h-5 w-px bg-gray-200 sm:block dark:bg-gray-700" aria-hidden />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!canExportImage}
              onClick={() => {
                if (!previewRef.current) return;
                try {
                  exportChartPngFromContainer(previewRef.current, title);
                  toast.success("图片已下载");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "导出失败");
                }
              }}
            >
              <Download className="size-4" aria-hidden />
              导出图片
            </Button>
          </>
        }
      >
        <div
          ref={previewRef}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900"
          style={{ width: previewSize.width, height: previewSize.height }}
          data-testid="widget-enlarge-preview"
        >
          <ChartDrillProvider>
            <ChartRenderer
              embedded
              config={chartConfig}
              title={title}
              widgetId={widgetId}
              drillEnabled
              filterParameters={filterParameters}
              executeKey={executeKey}
              pixelSize={previewSize}
              paletteId={styleConfig?.paletteId}
              paletteColors={styleConfig?.paletteColors}
              dashboardColorDefaults={pickChartPaletteDefaults(styleConfig)}
              numberFormat={styleConfig?.numberFormat}
              colorScheme={styleConfig?.colorScheme ?? "light"}
              widgetShellColor={resolveWidgetShellPaintColor(styleConfig)}
            />
          </ChartDrillProvider>
        </div>
      </WidgetDialogShell>
    </Dialog>
  );
}
