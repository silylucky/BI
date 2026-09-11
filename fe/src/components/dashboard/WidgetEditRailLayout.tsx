import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RailFoldHeader } from "./RailFoldTab";
import { useWidgetEditRailSplit } from "./useWidgetEditRailSplit";
import { WidgetEditRailResizeHandle } from "./WidgetEditRailResizeHandle";
import {
  WIDGET_EDIT_RAIL_LEFT_MIN_PX,
  WIDGET_EDIT_RAIL_RIGHT_MIN_PX,
} from "./widgetEditRailSplit";

type WidgetEditRailLayoutProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  leftSubtitle?: string;
  rightLabel?: string;
  className?: string;
};

function ExpandedRailPanel({
  label,
  subtitle,
  bordered,
  hideFoldHeader,
  children,
  style,
}: {
  label: string;
  subtitle?: string;
  bordered?: boolean;
  hideFoldHeader?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
        bordered && "border-l border-gray-200 dark:border-gray-800",
      )}
      style={style}
    >
      {hideFoldHeader ? null : (
        <RailFoldHeader label={label} subtitle={subtitle} />
      )}
      <div className="flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

/** 图表编辑双列：配置 + 数据集；列宽可拖拽调节并本地记忆。 */
export function WidgetEditRailLayout({
  left,
  right,
  leftLabel,
  leftSubtitle,
  rightLabel = "数据集",
  className,
}: WidgetEditRailLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { leftRatio, onResizePointerDown } = useWidgetEditRailSplit(containerRef);
  const rightRatio = 1 - leftRatio;

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full max-w-full overflow-hidden", className)}
      data-testid="widget-edit-rail-layout"
    >
      <ExpandedRailPanel
        label={leftLabel}
        subtitle={leftSubtitle}
        style={{ flex: `${leftRatio} 1 0%`, minWidth: WIDGET_EDIT_RAIL_LEFT_MIN_PX }}
      >
        {left}
      </ExpandedRailPanel>
      <WidgetEditRailResizeHandle
        onPointerDown={onResizePointerDown}
        className="w-1 shrink-0 -mx-px"
      />
      <ExpandedRailPanel
        label={rightLabel}
        bordered
        hideFoldHeader
        style={{ flex: `${rightRatio} 1 0%`, minWidth: WIDGET_EDIT_RAIL_RIGHT_MIN_PX }}
      >
        {right}
      </ExpandedRailPanel>
    </div>
  );
}
