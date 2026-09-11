import * as d3 from "d3";
import type { ZoomBehavior } from "d3";
import { GEO_MAP_SCALE_LIMIT } from "@/components/charts/engine/geo/geoConstants";

type GeoZoomMount = {
  container: HTMLElement;
  svg: SVGSVGElement;
  zoom: ZoomBehavior<SVGSVGElement, unknown>;
  zoomRoot: d3.Selection<SVGGElement, unknown, null, undefined>;
  onRefresh?: () => void;
};

function applyZoomStep(mount: GeoZoomMount, factor: number) {
  const { svg, zoom, zoomRoot } = mount;
  const selection = d3.select(svg);
  selection
    .transition()
    .duration(180)
    .call(zoom.scaleBy, factor)
    .on("end", () => {
      const transform = d3.zoomTransform(svg);
      zoomRoot.attr("transform", transform.toString());
    });
}

function refreshGeoMap(mount: GeoZoomMount) {
  const { svg, zoom } = mount;
  d3.select(svg)
    .transition()
    .duration(180)
    .call(zoom.transform, d3.zoomIdentity)
    .on("end", () => {
      mount.onRefresh?.();
    });
}

/** 地图右下角 +/- 缩放与刷新按钮（对标 DataEase「显示缩放按钮」） */
export function mountGeoZoomControls(mount: GeoZoomMount): () => void {
  const host = mount.container;
  const prevPosition = host.style.position;
  if (!prevPosition || prevPosition === "static") {
    host.style.position = "relative";
  }

  const bar = document.createElement("div");
  bar.className =
    "pointer-events-auto absolute bottom-2 right-2 z-[4] flex flex-col overflow-hidden rounded-md border border-gray-200/80 bg-white/90 shadow-theme-xs dark:border-white/10 dark:bg-gray-900/85";
  bar.setAttribute("data-testid", "geo-zoom-controls");

  const mkBtn = (label: string, factor: number) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "flex h-7 w-7 items-center justify-center text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10";
    btn.setAttribute("aria-label", label);
    btn.textContent = label === "放大" ? "+" : "−";
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      applyZoomStep(mount, factor);
    });
    return btn;
  };

  bar.appendChild(mkBtn("放大", 1.25));
  bar.appendChild(
    (() => {
      const sep = document.createElement("div");
      sep.className = "h-px bg-gray-200 dark:bg-white/10";
      return sep;
    })(),
  );
  bar.appendChild(mkBtn("缩小", 1 / 1.25));
  bar.appendChild(
    (() => {
      const sep = document.createElement("div");
      sep.className = "h-px bg-gray-200 dark:bg-white/10";
      return sep;
    })(),
  );
  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className =
    "flex h-7 w-7 items-center justify-center text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10";
  refreshBtn.setAttribute("aria-label", "刷新");
  refreshBtn.title = "刷新";
  refreshBtn.textContent = "↻";
  refreshBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    refreshGeoMap(mount);
  });
  bar.appendChild(refreshBtn);
  host.appendChild(bar);

  return () => {
    bar.remove();
    if (!prevPosition || prevPosition === "static") {
      host.style.position = prevPosition;
    }
  };
}

export function clampGeoZoomScale(scale: number): number {
  return Math.max(GEO_MAP_SCALE_LIMIT.min, Math.min(GEO_MAP_SCALE_LIMIT.max, scale));
}
