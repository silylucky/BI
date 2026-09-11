import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetRailCollapseButton } from "./widgetRailChrome";
import type { LayoutWidget } from "./layoutUtils";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import { isLinkedComponentRef } from "@/lib/vizComponents";
import { isPublishableWidgetType } from "@/lib/vizComponentEdit";

type VizComponentInspectorHeaderProps = {
  widget: LayoutWidget;
  resolvedWidget: LayoutWidget;
  componentMap: VizComponentMap;
  onDetach: (widget: LayoutWidget) => void;
  onRelink?: () => void;
  onPublish?: () => void;
  onPushToLibrary?: () => void;
  pushing?: boolean;
  onCollapse?: () => void;
};

export function VizComponentInspectorHeader({
  widget,
  resolvedWidget,
  componentMap,
  onDetach,
  onRelink,
  onPublish,
  onPushToLibrary,
  pushing,
  onCollapse,
}: VizComponentInspectorHeaderProps) {
  const linked = isLinkedComponentRef(widget.componentRef);
  const detached = Boolean(widget.componentRef?.detached);
  const publishable = isPublishableWidgetType(widget.type);

  if (!publishable) return null;

  if (detached) {
    return (
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/25 bg-amber-500/5 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-400/10"
        data-testid="viz-component-detached-banner"
      >
        <Badge variant="light" color="warning" className="gap-1">
          已断开链接
        </Badge>
        <span className="min-w-0 flex-1 text-theme-xs text-gray-600 dark:text-gray-400">
          当前为本地副本，修改不会同步到组件库
        </span>
        {onRelink ? (
          <Button type="button" size="sm" variant="outline" onClick={onRelink}>
            重新链接
          </Button>
        ) : null}
        {onPublish ? (
          <Button type="button" size="sm" onClick={onPublish}>
            发布为新组件
          </Button>
        ) : null}
        {onCollapse ? <WidgetRailCollapseButton onClick={onCollapse} /> : null}
      </div>
    );
  }

  if (linked) {
    return onCollapse ? (
      <div className="flex shrink-0 justify-end border-b border-gray-100 px-2 py-1 dark:border-white/[0.06]">
        <WidgetRailCollapseButton onClick={onCollapse} />
      </div>
    ) : null;
  }

  if (!onPublish) return null;

  return (
    <div className="flex shrink-0 items-center justify-end gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-white/[0.06]">
      <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onPublish}>
        <Upload className="size-3.5" aria-hidden />
        发布到组件库
      </Button>
      {onCollapse ? <WidgetRailCollapseButton onClick={onCollapse} /> : null}
    </div>
  );
}
