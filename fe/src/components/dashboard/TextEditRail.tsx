import { cn } from "@/lib/utils";
import type { LayoutWidget, TextWidgetConfig } from "./layoutUtils";
import { INSPECTOR_HINT } from "./inspectorCompact";
import { textConfigToHtml } from "./richTextHtml";
import { WidgetInspectorDelete } from "./widget-inspector-delete";
import { TextWidgetStylePanel } from "./widgetRailStyleSections";
import { WidgetRailPanelHeader } from "./widgetRailChrome";

export type TextEditRailProps = {
  widget: LayoutWidget & { textConfig: TextWidgetConfig };
  onTitleChange?: (title: string) => void;
  onConfigChange?: (config: TextWidgetConfig) => void;
  onDelete?: () => void;
  onRailCollapse?: () => void;
  highlightUrls?: string[];
  className?: string;
};

export function TextEditRail({
  widget,
  onTitleChange,
  onConfigChange,
  onDelete,
  onRailCollapse,
  highlightUrls,
  className,
}: TextEditRailProps) {
  const textConfig = widget.textConfig;
  const html = textConfigToHtml(textConfig);
  const document = new DOMParser().parseFromString(html, "text/html");
  const characters = (document.body.textContent ?? "").trim().length;

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-white dark:bg-gray-900", className)}>
      <WidgetRailPanelHeader
        title={widget.title || "富文本"}
        subtitle="富文本"
        onCollapse={onRailCollapse}
        collapseAriaLabel="收起配置"
      />

      <p className={cn(INSPECTOR_HINT, "shrink-0 border-b border-gray-100 px-3 py-2 dark:border-white/[0.06]")}>
        在画布双击编辑正文；样式见下方配置。
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TextWidgetStylePanel
          widget={widget}
          characters={characters}
          widgetStyle={textConfig.widgetStyle ?? {}}
          highlightUrls={highlightUrls}
          onTitleChange={onTitleChange}
          onWidgetStyleChange={(patch) =>
            onConfigChange?.({
              ...textConfig,
              widgetStyle: { ...(textConfig.widgetStyle ?? {}), ...patch },
            })
          }
        />
      </div>

      {onDelete ? (
        <div className="shrink-0 border-t border-gray-200 px-3 py-2 dark:border-gray-800">
          <WidgetInspectorDelete widgetTitle={widget.title} onDelete={onDelete} embedded />
        </div>
      ) : null}
    </div>
  );
}
