import { Link } from "react-router";
import { Puzzle, Settings2 } from "lucide-react";
import { ChartEmbedShareActions } from "@/components/dashboard/ChartEmbedShareActions";
import { PublicShareLinkCard } from "@/components/dashboard/PublicShareLinkCard";
import { ShareDialogList, ShareDialogSection } from "@/components/dashboard/ShareDialogSection";
import { SHARE_DIALOG_STACK_CLASS } from "@/components/dashboard/sharePageUi";
import type { DashboardLayout, DashboardWidgetBase } from "@/components/dashboard/layoutUtils";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { Button } from "@/components/ui/button";

type DashboardBoardShareBodyProps = {
  dashboardId: string;
  name: string;
  layout: DashboardLayout;
  widgets: DashboardWidgetBase[];
};

function chartIdFromWidget(widget: DashboardWidgetBase): string | null {
  if (widget.type === "filter" || !widget.chartConfig) return null;
  const cfg = widget.chartConfig as ChartViewConfig;
  return cfg.chartId ?? widget.id;
}

export function DashboardBoardShareBody({
  dashboardId,
  name,
  layout: _layout,
  widgets,
}: DashboardBoardShareBodyProps) {
  const embeddableWidgets = widgets.filter((widget) => chartIdFromWidget(widget));

  return (
    <div className={SHARE_DIALOG_STACK_CLASS} data-share-layout="board">
      <PublicShareLinkCard dashboardId={dashboardId} name={name} density="compact" variant="dialog" />

      {embeddableWidgets.length > 0 ? (
        <ShareDialogSection
          icon={Puzzle}
          title="单组件嵌入"
          description="须签发 token 后方可匿名访问；每个图表可单独生成公开链接。"
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
                  title={widget.title}
                  layout="list"
                />
              );
            })}
          </ShareDialogList>
        </ShareDialogSection>
      ) : null}

      <ShareDialogSection
        icon={Settings2}
        title="高级嵌入"
        description="配置来源白名单并生成带校验的 iframe 链接。"
        trailing={
          <Button asChild variant="outline" size="sm">
            <Link to="/embed/share">打开配置</Link>
          </Button>
        }
      />
    </div>
  );
}
