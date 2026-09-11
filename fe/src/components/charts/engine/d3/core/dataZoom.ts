import * as d3 from "d3";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import {
  DATA_ZOOM_SLIDER_H,
  DATA_ZOOM_SLIDER_RESERVE,
  brushSelectionFromWindow,
  panDataZoomWindow,
  readStoredDataZoomWindow,
  sliceByDataZoomWindow,
  sparklineByCategory,
  windowFromBrushSelection,
  writeStoredDataZoomWindow,
  zoomDataZoomWindow,
  type DataZoomWindow,
} from "@/components/charts/engine/d3/core/dataZoomWindow";

export {
  DATA_ZOOM_SLIDER_RESERVE,
  sliceByDataZoomWindow,
  sparklineByCategory,
  readStoredDataZoomWindow,
  rowsInCategories,
} from "@/components/charts/engine/d3/core/dataZoomWindow";

type AttachOpts = {
  host: HTMLElement;
  plotRoot: d3.Selection<SVGGElement, unknown, null, undefined>;
  innerW: number;
  innerH: number;
  marginBottom: number;
  categories: readonly string[];
  sparkline: readonly number[];
  theme?: AntvThemeTokens;
  redraw: () => void;
};

export function visibleDataZoomCategories(
  host: HTMLElement,
  enabled: boolean,
  categories: string[],
): string[] {
  if (!enabled || categories.length === 0) return categories;
  return sliceByDataZoomWindow(categories, readStoredDataZoomWindow(host, categories.length));
}

export function isLiveDataZoomRedraw(host: HTMLElement): boolean {
  return host.dataset.vsDataZoomLive === "1";
}

export function withLiveDataZoomRedraw(host: HTMLElement, redraw: () => void): void {
  const prevIncremental = host.dataset.vsIncremental;
  host.dataset.vsIncremental = "true";
  host.dataset.vsDataZoomLive = "1";
  try {
    redraw();
  } finally {
    delete host.dataset.vsDataZoomLive;
    if (prevIncremental === undefined) delete host.dataset.vsIncremental;
    else host.dataset.vsIncremental = prevIncremental;
  }
}

/** ECharts/DataEase 式类目窗口：底部总览条 + 主图只画选中区间，禁止整图 d3.zoom */
export function attachCartesianDataZoom(opts: AttachOpts): () => void {
  if (isLiveDataZoomRedraw(opts.host)) return () => undefined;

  const { host, plotRoot, innerW, innerH, marginBottom, categories, sparkline, theme, redraw } = opts;
  if (categories.length === 0 || innerW < 48) return () => undefined;

  const sliderY = innerH + Math.max(0, marginBottom - DATA_ZOOM_SLIDER_RESERVE) + 8;
  const window = readStoredDataZoomWindow(host, categories.length);
  const accent = theme?.accent ?? "#465fff";
  const track = theme?.gridLine ?? "#e4e7ec";

  plotRoot.selectAll("g.data-zoom-slider").remove();

  const slider = plotRoot.append("g").attr("class", "data-zoom-slider").attr("transform", `translate(0,${sliderY})`);
  slider.append("rect").attr("width", innerW).attr("height", DATA_ZOOM_SLIDER_H).attr("rx", 3).attr("fill", track).attr("opacity", 0.28);

  const maxVal = Math.max(1, d3.max(sparkline) ?? 1);
  const x = d3.scaleLinear().domain([0, Math.max(1, sparkline.length - 1)]).range([0, innerW]);
  const y = d3.scaleLinear().domain([0, maxVal]).range([DATA_ZOOM_SLIDER_H - 2, 2]);
  const area = d3
    .area<number>()
    .x((_, i) => x(i))
    .y0(DATA_ZOOM_SLIDER_H - 2)
    .y1((value) => y(value));
  if (sparkline.length > 0) {
    slider
      .append("path")
      .attr("d", area(sparkline as number[]) ?? "")
      .attr("fill", accent)
      .attr("opacity", 0.28)
      .attr("pointer-events", "none");
  }

  let frame = 0;
  const commitWindow = (next: DataZoomWindow, live: boolean) => {
    writeStoredDataZoomWindow(host, next);
    const apply = () => withLiveDataZoomRedraw(host, redraw);
    if (live) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
      return;
    }
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    apply();
  };

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [innerW, DATA_ZOOM_SLIDER_H],
    ])
    .handleSize(8)
    .on("brush", (event) => {
      if (event.sourceEvent == null) return;
      commitWindow(
        windowFromBrushSelection(
          event.selection as [number, number] | null,
          innerW,
          categories.length,
          readStoredDataZoomWindow(host, categories.length),
        ),
        true,
      );
    })
    .on("end", (event) => {
      if (event.sourceEvent == null) return;
      commitWindow(
        windowFromBrushSelection(
          event.selection as [number, number] | null,
          innerW,
          categories.length,
          readStoredDataZoomWindow(host, categories.length),
        ),
        false,
      );
    });

  slider.call(brush);
  slider.call(brush.move, brushSelectionFromWindow(window, innerW));
  slider.selectAll(".overlay").attr("cursor", "crosshair");
  slider
    .selectAll(".selection")
    .attr("fill", accent)
    .attr("fill-opacity", 0.22)
    .attr("stroke", accent)
    .attr("stroke-opacity", 0.45)
    .attr("cursor", "grab");
  const sliderNode = slider.node();
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const current = readStoredDataZoomWindow(host, categories.length);
    const span = current.end - current.start;
    const [pointerX] = sliderNode ? d3.pointer(event, sliderNode) : [innerW / 2];
    const next =
      event.ctrlKey || event.metaKey
        ? zoomDataZoomWindow(
            current,
            event.deltaY > 0 ? 1.18 : 1 / 1.18,
            innerW > 0 ? pointerX / innerW : 0.5,
            categories.length,
          )
        : panDataZoomWindow(
            current,
            Math.sign(event.deltaX !== 0 ? event.deltaX : event.deltaY) *
              Math.max(span * 0.2, 1 / Math.max(categories.length, 1)),
            categories.length,
          );
    if (next.start === current.start && next.end === current.end) return;
    commitWindow(next, false);
  };
  sliderNode?.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    if (frame) cancelAnimationFrame(frame);
    sliderNode?.removeEventListener("wheel", onWheel);
    slider.remove();
  };
}

export function cartesianSparkline(
  categories: readonly string[],
  rows: readonly { __category__?: unknown; __value__?: unknown }[],
): number[] {
  return sparklineByCategory(
    categories,
    rows.map((row) => ({ category: String(row.__category__ ?? ""), value: Number(row.__value__ ?? 0) })),
  );
}
