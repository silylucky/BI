import { GripVertical } from "lucide-react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { dwShapeTitle, shapeRemarkChromeStyle, shapeTitleChromeStyle } from "../dashboardWidgetTypography";
import { WidgetInlineTitle } from "../WidgetInlineTitle";

export type WidgetShapeChromeProps = {
  title: string;
  titleStyle: CSSProperties;
  showTitle: boolean;
  remark?: { show: boolean; text: string };
  mode: "edit" | "view";
  selected: boolean;
  widgetId: string;
  /** 画布缩放，用于标题区抓手图标尺寸 */
  canvasScale?: number;
  onTitleChange?: (widgetId: string, title: string) => void;
  onSelectPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onDragPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onDragKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** 未做 canvas scale 补偿的标题样式，用于计算标题区高度/间隙 */
  titleMetricsStyle?: CSSProperties;
};

/**
 * DE `.shape` 内标题区：无独立 chrome 条/边框，与组件内容同属 shape 内边距。
 */
export function WidgetShapeChrome({
  title,
  titleStyle,
  showTitle,
  remark,
  mode,
  selected,
  widgetId,
  canvasScale = 1,
  onTitleChange,
  onSelectPointerDown,
  onDragPointerDown,
  onDragKeyDown,
  titleMetricsStyle,
}: WidgetShapeChromeProps) {
  if (!showTitle) {
    return (
      <span className="sr-only" data-testid={`pixel-shape-title-sr-${widgetId}`}>
        {title}
      </span>
    );
  }

  const isEdit = mode === "edit";
  const canDrag = isEdit && selected && Boolean(onDragPointerDown);
  const canEditTitle = isEdit && selected && Boolean(onTitleChange);
  const showRemark = Boolean(remark?.show && remark.text);
  const gripPx = 16 / (canvasScale > 0 ? canvasScale : 1);

  const handleChromePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (canDrag) {
      onDragPointerDown?.(event);
      return;
    }
    if (isEdit) {
      onSelectPointerDown?.(event);
    }
  };

  return (
    <>
      <div
        data-testid={`pixel-shape-chrome-${widgetId}`}
        className={cn(
          "shape-title shrink-0",
          canDrag && "cursor-grab active:cursor-grabbing",
          canDrag && "pixel-shape-title-drag",
        )}
        style={shapeTitleChromeStyle(titleMetricsStyle ?? titleStyle, canvasScale)}
        onPointerDown={isEdit ? handleChromePointerDown : undefined}
        onKeyDown={canDrag ? onDragKeyDown : undefined}
        role={canDrag ? "group" : undefined}
        aria-label={canDrag ? "拖动组件标题区" : undefined}
        tabIndex={canDrag ? 0 : undefined}
      >
        {canDrag ? (
          <GripVertical
            aria-hidden
            className="shrink-0 text-[var(--dashboard-text-muted,#98a2b3)]"
            style={{ width: gripPx, height: gripPx }}
          />
        ) : null}
        <WidgetInlineTitle
          value={title}
          editable={canEditTitle}
          onChange={canEditTitle ? (next) => onTitleChange?.(widgetId, next) : undefined}
          titleStyle={titleStyle}
          className={dwShapeTitle}
          testId={`pixel-shape-title-${widgetId}`}
        />
      </div>
      {showRemark ? (
        <p
          className="shape-remark dw-hint shrink-0 text-[var(--dashboard-text-muted,#667085)]"
          data-testid={`pixel-shape-remark-${widgetId}`}
          style={shapeRemarkChromeStyle(titleMetricsStyle ?? titleStyle, canvasScale)}
        >
          {remark!.text}
        </p>
      ) : null}
    </>
  );
}
