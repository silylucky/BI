import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChartLegendIconShape, ChartLegendStyle } from "@/lib/chartDeStyle";
import {
  EMBEDDED_SIDE_LEGEND_MAX_WIDTH,
  legendMarkerStyle,
  legendSideAlignClass,
  legendStripJustifyClass,
  readChartLegendHAlign,
  readChartLegendIcon,
  readChartLegendIconSize,
  readChartLegendOrient,
  readChartLegendVAlign,
  resolveEmbeddedLegendOrient,
  type ChartLegendHAlign,
  type ChartLegendVAlign,
} from "@/lib/chartLegendPresentation";
import {
  dispatchPixelLayoutGeometryCommitted,
  resolvePixelWidgetIdFromElement,
} from "@/components/dashboard/pixelCanvas/pixelShapeLiveResize";
import { cn } from "@/lib/utils";

export type ChartLegendItem = { name: string; color: string };

/** 横向图例最多可见行数，超出分页 */
const HORIZONTAL_LEGEND_MAX_ROWS = 3;

/** 横向图例每页最多展示项数 */
export const HORIZONTAL_LEGEND_ITEMS_PER_PAGE = 8;

/** 纵向图例测量前的保守默认每页项数 */
export const VERTICAL_LEGEND_ITEMS_PER_PAGE_FALLBACK = 8;

export const LEGEND_PAGER_HEIGHT_PX = 24;
const VERTICAL_LEGEND_LIST_PADDING_Y = 8;

/** 按字号估算横向图例最大高度（px） */
export function legendShellMaxHeightPx(fontSize: number, maxRows = HORIZONTAL_LEGEND_MAX_ROWS): number {
  const lineHeight = 1.3;
  const rowGap = 4;
  const paddingY = 8;
  return Math.ceil(fontSize * lineHeight * maxRows + rowGap * (maxRows - 1) + paddingY);
}

export function legendRowHeightPx(fontSize: number): number {
  return Math.ceil(fontSize * 1.35 + 2);
}

/** 根据纵向图例容器高度估算每页可展示项数 */
export function resolveVerticalLegendPageSize(
  containerHeight: number,
  fontSize: number,
  itemCount: number,
): number {
  if (containerHeight <= 0) return VERTICAL_LEGEND_ITEMS_PER_PAGE_FALLBACK;
  const rowH = legendRowHeightPx(fontSize);
  let fit = Math.max(1, Math.floor((containerHeight - VERTICAL_LEGEND_LIST_PADDING_Y) / rowH));
  if (itemCount > fit) {
    fit = Math.max(
      1,
      Math.floor(
        (containerHeight - VERTICAL_LEGEND_LIST_PADDING_Y - LEGEND_PAGER_HEIGHT_PX) / rowH,
      ),
    );
  }
  return fit;
}

type LegendPagerProps = {
  safePage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

function LegendPager({ safePage, pageCount, onPageChange }: LegendPagerProps) {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center justify-center gap-1 px-1.5 pb-1 text-[10px] text-gray-500 dark:text-gray-400">
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
        disabled={safePage <= 0}
        aria-label="上一页图例"
        onClick={() => onPageChange(Math.max(0, safePage - 1))}
      >
        <ChevronLeft className="size-3" aria-hidden />
      </button>
      <span className="tabular-nums">
        {safePage + 1}/{pageCount}
      </span>
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
        disabled={safePage >= pageCount - 1}
        aria-label="下一页图例"
        onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
      >
        <ChevronRight className="size-3" aria-hidden />
      </button>
    </div>
  );
}

type EmbeddedChartLegendProps = {
  items: ChartLegendItem[];
  fontSize?: number;
  position: NonNullable<ChartLegendStyle["position"]>;
  orient?: NonNullable<ChartLegendStyle["orient"]>;
  hAlign?: ChartLegendHAlign;
  vAlign?: ChartLegendVAlign;
  icon?: ChartLegendIconShape;
  iconSize?: number;
  textColor?: string;
  page: number;
  onPageChange: (page: number) => void;
};

function EmbeddedChartLegend({
  items,
  fontSize = 12,
  position,
  orient = "horizontal",
  hAlign = "center",
  vAlign = "bottom",
  icon = "triangle",
  iconSize = 6,
  textColor,
  page,
  onPageChange,
}: EmbeddedChartLegendProps) {
  const layoutOrient = resolveEmbeddedLegendOrient(position, orient);
  const horizontal = layoutOrient === "horizontal";
  const sideSlot = position === "left" || position === "right";
  const rootRef = useRef<HTMLDivElement>(null);
  const [verticalPageSize, setVerticalPageSize] = useState(VERTICAL_LEGEND_ITEMS_PER_PAGE_FALLBACK);

  useEffect(() => {
    if (horizontal) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      setVerticalPageSize(resolveVerticalLegendPageSize(root.clientHeight, fontSize, items.length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [horizontal, fontSize, items.length]);

  const pageSize = horizontal ? HORIZONTAL_LEGEND_ITEMS_PER_PAGE : verticalPageSize;
  const pageCount = Math.max(1, Math.ceil(items.length / Math.max(1, pageSize)));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page > pageCount - 1) onPageChange(Math.max(0, pageCount - 1));
  }, [page, pageCount, onPageChange]);

  if (items.length === 0) return null;

  const visibleItems = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div
      ref={rootRef}
      className={cn("flex min-h-0 min-w-0 flex-col", sideSlot ? "h-full flex-1" : "shrink-0")}
    >
      <ul
        className={cn(
          "dashboard-chart-legend pointer-events-none min-h-0 gap-x-2 gap-y-0.5 px-1.5 py-1",
          horizontal
            ? cn(
                "flex w-full shrink-0 flex-row flex-wrap items-center overflow-x-auto overflow-y-auto",
                legendStripJustifyClass(hAlign),
              )
            : cn("flex w-full flex-1 flex-col overflow-hidden", sideSlot && legendSideAlignClass(vAlign)),
        )}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.35,
          ...(horizontal
            ? { maxHeight: `${legendShellMaxHeightPx(fontSize)}px` }
            : undefined),
        }}
        aria-label="图例"
      >
        {visibleItems.map((item) => (
          <li key={item.name} className="flex max-w-full min-w-0 shrink-0 items-center gap-1.5">
            <span
              className="inline-flex shrink-0 items-center justify-center"
              style={legendMarkerStyle(icon, item.color, iconSize)}
              aria-hidden
            />
            <span
              className="max-w-[7rem] truncate leading-tight"
              title={item.name}
              style={{ color: textColor ?? "var(--dashboard-text-muted,#667085)" }}
            >
              {item.name}
            </span>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <LegendPager safePage={safePage} pageCount={pageCount} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}

type EmbeddedChartLegendShellProps = {
  position: NonNullable<ChartLegendStyle["position"]>;
  fontSize?: number;
  orient?: NonNullable<ChartLegendStyle["orient"]>;
  hAlign?: ChartLegendHAlign;
  vAlign?: ChartLegendVAlign;
  icon?: ChartLegendIconShape;
  iconSize?: number;
  textColor?: string;
  items: ChartLegendItem[];
  children: ReactNode;
  /** false：编辑预览等场景，避免 overflow-hidden 裁切轴标签 */
  clipChart?: boolean;
};

/** 看板内嵌：图例贴在组件外框 pixel-shape-inner（含标题区），flex 分区不叠在图表上 */
export function EmbeddedChartLegendShell({
  position,
  fontSize,
  orient,
  hAlign = "center",
  vAlign = "bottom",
  icon,
  iconSize,
  textColor,
  items,
  children,
  clipChart = true,
}: EmbeddedChartLegendShellProps) {
  const [page, setPage] = useState(0);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const itemsKey = useMemo(() => items.map((item) => item.name).join("\0"), [items]);

  useEffect(() => {
    setPage(0);
  }, [itemsKey, position, orient]);

  useEffect(() => {
    const node = chartAreaRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    // 仅 chartArea 宽高变化且能解析 widgetId 时 scoped 补测；禁止全画布广播
    let last = { width: node.clientWidth, height: node.clientHeight };
    const notify = () => {
      const widgetId = resolvePixelWidgetIdFromElement(node);
      if (!widgetId) return;
      const next = { width: node.clientWidth, height: node.clientHeight };
      if (next.width === last.width && next.height === last.height) return;
      last = next;
      dispatchPixelLayoutGeometryCommitted([widgetId]);
    };
    const observer = new ResizeObserver(notify);
    observer.observe(node);
    return () => observer.disconnect();
  }, [itemsKey, position, orient]);

  const sideSlot = position === "left" || position === "right";
  const stackSlot = position === "top" || position === "bottom";

  const legend = (
    <EmbeddedChartLegend
      items={items}
      fontSize={fontSize}
      position={position}
      orient={orient}
      hAlign={hAlign}
      vAlign={vAlign}
      icon={icon}
      iconSize={iconSize}
      textColor={textColor}
      page={page}
      onPageChange={setPage}
    />
  );

  const legendSlot = sideSlot ? (
    <div
      className={cn(
        "z-0 flex h-full min-h-0 shrink-0 flex-col overflow-hidden",
        legendSideAlignClass(vAlign),
      )}
      style={{ maxWidth: EMBEDDED_SIDE_LEGEND_MAX_WIDTH }}
      data-legend-slot="side"
    >
      {legend}
    </div>
  ) : (
    <div className="z-0 shrink-0">{legend}</div>
  );

  const chartArea = (
    <div
      ref={chartAreaRef}
      className={cn(
        "relative z-[1] min-h-0 min-w-0 flex flex-1 basis-0 flex-col",
        clipChart ? "overflow-hidden" : "overflow-visible",
      )}
    >
      {children}
    </div>
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0",
        clipChart ? "overflow-hidden" : "overflow-visible",
        stackSlot ? "flex-col" : "flex-row",
      )}
      data-legend-position={position}
    >
      {position === "top" || position === "left" ? legendSlot : null}
      {chartArea}
      {position === "bottom" || position === "right" ? legendSlot : null}
    </div>
  );
}

export {
  readChartLegendIcon,
  readChartLegendIconSize,
  readChartLegendOrient,
  readChartLegendHAlign,
  readChartLegendVAlign,
  resolveEmbeddedLegendOrient,
};
