import type { DragEvent } from "react";
import { cn } from "@/lib/utils";
import { readPaletteDragPayload, type PaletteDragPayload } from "@/lib/dashboardDnd";
import type { PixelLayoutWidget } from "../layoutUtils";
import { widgetRect } from "./collisionLayout";

type TabPaletteDropZonesProps = {
  tabs: PixelLayoutWidget[];
  /** 命中检测外扩（逻辑区，可大于视觉区） */
  hitBufferPx: number;
  /** 虚线高亮外扩（仅绘制，默认 0 = 贴 Tab 外框） */
  visualBufferPx?: number;
  activeTabsId: string | null;
  onTabDrop: (tabsWidgetId: string, payload: PaletteDragPayload) => void;
  onTabHover?: (tabsWidgetId: string) => void;
};

function expandedZones(
  widget: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  hitBufferPx: number,
  visualBufferPx: number,
) {
  const inner = widgetRect(widget);
  const hit = Math.max(0, hitBufferPx);
  const visual = Math.max(0, visualBufferPx);
  return {
    inner,
    hit: {
      x: inner.x - hit,
      y: inner.y - hit,
      width: inner.width + hit * 2,
      height: inner.height + hit * 2,
    },
    visual: {
      x: inner.x - visual,
      y: inner.y - visual,
      width: inner.width + visual * 2,
      height: inner.height + visual * 2,
    },
    hitPadding: hit,
    visualPadding: visual,
  };
}

/** Tab 专用投放区：外扩缓冲命中 + 贴近外框虚线高亮 */
export function TabPaletteDropZones({
  tabs,
  hitBufferPx,
  visualBufferPx = 0,
  activeTabsId,
  onTabDrop,
  onTabHover,
}: TabPaletteDropZonesProps) {
  if (tabs.length === 0 || hitBufferPx <= 0) return null;

  const handleDragOver = (tabsWidgetId: string) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    onTabHover?.(tabsWidgetId);
  };

  const handleDrop = (tabsWidgetId: string) => (event: DragEvent) => {
    const payload = readPaletteDragPayload(event.nativeEvent);
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    onTabDrop(tabsWidgetId, payload);
  };

  return (
    <>
      {tabs.map((tab) => {
        const { inner, hit, visual, hitPadding, visualPadding } = expandedZones(
          tab,
          hitBufferPx,
          visualBufferPx,
        );
        const active = tab.id === activeTabsId;
        const ringInset = hitPadding - visualPadding;
        return (
          <div
            key={tab.id}
            data-testid={`tab-palette-drop-zone-${tab.id}`}
            className="absolute z-[200]"
            style={{
              left: hit.x,
              top: hit.y,
              width: hit.width,
              height: hit.height,
            }}
            onDragEnter={handleDragOver(tab.id)}
            onDragOver={handleDragOver(tab.id)}
            onDrop={handleDrop(tab.id)}
          >
            <div
              className={cn(
                "tab-palette-buffer-ring pointer-events-none absolute rounded-sm border-2 border-dashed transition-colors",
                active
                  ? "border-brand-500 bg-brand-50/20 dark:border-brand-400 dark:bg-brand-500/8"
                  : "border-brand-400/35 bg-transparent dark:border-brand-500/25",
              )}
              style={{
                left: ringInset,
                top: ringInset,
                width: visual.width,
                height: visual.height,
              }}
              aria-hidden
            />
            {visualPadding > 0 ? (
              <div
                className="pointer-events-none absolute rounded-sm border border-dashed border-brand-300/30 dark:border-brand-500/20"
                style={{
                  left: ringInset + visualPadding,
                  top: ringInset + visualPadding,
                  width: inner.width,
                  height: inner.height,
                }}
                aria-hidden
              />
            ) : null}
            {active ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
                <span className="tab-palette-buffer-label rounded-md bg-white/95 px-2 py-0.5 text-theme-xs font-medium text-brand-600 shadow-theme-xs dark:bg-gray-900/95 dark:text-brand-400">
                  释放加入页签
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
