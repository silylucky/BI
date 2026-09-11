import { useState } from "react";
import { MonitorPlay, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { ChartEmbedShareActions } from "@/components/dashboard/ChartEmbedShareActions";
import { PublicShareLinkCard } from "@/components/dashboard/PublicShareLinkCard";
import { ShareIssuedUrlPanel } from "@/components/dashboard/ShareIssuedUrlPanel";
import { ShareDialogList, ShareDialogSection } from "@/components/dashboard/ShareDialogSection";
import { SHARE_DIALOG_STACK_CLASS } from "@/components/dashboard/sharePageUi";
import type { DashboardLayout, DashboardWidgetBase } from "@/components/dashboard/layoutUtils";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { apiFetch } from "@/lib/api";
import { buildEmbedShareUrl } from "@/lib/appBasePath";
import { mapApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";

type DataScreenSharePanelProps = {
  dashboardId: string;
  name: string;
  layout: DashboardLayout;
};

function chartIdFromWidget(widget: DashboardWidgetBase): string | null {
  if (widget.type === "filter" || !widget.chartConfig) return null;
  const cfg = widget.chartConfig as ChartViewConfig;
  return cfg.chartId ?? widget.id;
}

export function DataScreenSharePanel({ dashboardId, name, layout }: DataScreenSharePanelProps) {
  const [issuing, setIssuing] = useState(false);
  const [screenEmbedUrl, setScreenEmbedUrl] = useState<string | null>(null);
  const widgets = layout.widgets ?? [];
  const embeddableWidgets = widgets.filter((widget) => chartIdFromWidget(widget));

  const issueScreenEmbed = async () => {
    setIssuing(true);
    try {
      const tokenResp = await apiFetch<{ embedUrl: string }>("/api/v1/embed/token", {
        method: "POST",
        body: JSON.stringify({
          dashboardId,
          allowedOrigins: [window.location.origin],
          theme: "dark",
        }),
      });
      setScreenEmbedUrl(buildEmbedShareUrl(tokenResp.embedUrl));
      toast.success("整屏嵌入链接已生成");
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setIssuing(false);
    }
  };

  const screenEmbedAction = screenEmbedUrl ? null : (
    <Button
      type="button"
      size="sm"
      variant="primary"
      disabled={issuing}
      onClick={() => void issueScreenEmbed()}
    >
      {issuing ? "签发中…" : "签发整屏嵌入"}
    </Button>
  );

  return (
    <div className={SHARE_DIALOG_STACK_CLASS} data-share-layout="screen">
      <PublicShareLinkCard
        dashboardId={dashboardId}
        name={name}
        theme="dark"
        density="compact"
        variant="dialog"
      />

      <ShareDialogSection
        icon={MonitorPlay}
        title="整屏嵌入"
        description={<>生成 iframe 链接，用于 OA / 指挥墙等外部页面嵌入「{name}」。</>}
        trailing={screenEmbedAction}
      >
        {screenEmbedUrl ? <ShareIssuedUrlPanel url={screenEmbedUrl} /> : null}
      </ShareDialogSection>

      {embeddableWidgets.length > 0 ? (
        <ShareDialogSection
          icon={Puzzle}
          title="单组件嵌入"
          description="须签发 token 后方可匿名访问；每个组件可单独生成公开链接。"
        >
          <ShareDialogList>
            {embeddableWidgets.map((widget) => {
              const chartId = chartIdFromWidget(widget);
              if (!chartId) return null;
              return (
                <ChartEmbedShareActions
                  key={widget.id}
                  chartId={chartId}
                  mode="public"
                  theme="dark"
                  title={widget.title}
                  layout="list"
                />
              );
            })}
          </ShareDialogList>
        </ShareDialogSection>
      ) : null}
    </div>
  );
}
