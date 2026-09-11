import { Link2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LayoutWidget } from "./layoutUtils";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import { detachLinkedWidget } from "@/lib/resolveVizComponent";
import { isLinkedComponentRef } from "@/lib/vizComponents";

type VizComponentLinkBannerProps = {
  widget: LayoutWidget;
  componentMap: VizComponentMap;
  onDetach: (widget: LayoutWidget) => void;
  onPublish?: () => void;
};

export function VizComponentLinkBanner({
  widget,
  componentMap,
  onDetach,
  onPublish,
}: VizComponentLinkBannerProps) {
  if (!isLinkedComponentRef(widget.componentRef)) return null;
  const component = componentMap.get(widget.componentRef.componentId);
  const label = component
    ? `${component.name} · v${component.contentRevision}`
    : "组件已下架";

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-brand-500/20 bg-brand-500/5 px-3 py-2 dark:border-brand-400/20 dark:bg-brand-400/10"
      data-testid="viz-component-link-banner"
    >
      <Badge variant="light" color="primary" className="gap-1">
        <Link2 className="size-3" aria-hidden />
        已链接
      </Badge>
      <span className="min-w-0 flex-1 truncate text-theme-xs text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {onPublish ? (
        <Button type="button" size="sm" variant="outline" onClick={onPublish}>
          更新到库
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onDetach(detachLinkedWidget(widget, componentMap))}
      >
        <Unlink className="size-3.5" aria-hidden />
        断开链接
      </Button>
    </div>
  );
}
