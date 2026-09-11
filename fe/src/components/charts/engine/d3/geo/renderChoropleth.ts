import * as d3 from "d3";
import {
  formatGeoTooltipValue,
  getOfflineGeoMap,
  joinOfflineMapFeatures,
} from "@/components/charts/engine/geo/OfflineGeoPort";
import { fitChinaGeoProjection } from "@/components/charts/engine/geo/geoProjection";
import { mountGeoChoroplethAtmosphere, paintGeoSilhouetteGlow } from "@/components/charts/engine/geo/geoChoroplethVisual";
import { GEO_MAP_SCALE_LIMIT, resolveEmbeddedGeoRoam, VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";
import {
  buildGeoSurfacePalette,
  colorForGeoHover,
  colorForGeoValue,
  resolveGeoMapOpacity,
} from "@/components/charts/engine/geo/geoSurfaceColors";
import {
  resolveGeoRegionBorder,
  resolveGeoRegionStrokeWidth,
} from "@/components/charts/engine/geo/geoRegionBorderStyle";
import {
  resolveGeoRegionLabelColorHex,
  resolveGeoRegionLabelFontSize,
} from "@/components/charts/engine/geo/geoRegionLabelStyle";
import { resolveGeoMapBubbleEffect } from "@/components/charts/engine/geo/geoMapBubbleEffectStyle";
import { mountGeoMapBubbleRippleLayer } from "@/components/charts/engine/geo/geoMapBubbleRippleLayer";
import { mountGeoZoomControls } from "@/components/charts/engine/geo/geoZoomControls";
import { createTooltipLayer, hideTooltip, showMergedTooltip } from "@/components/charts/engine/d3/core/tooltipLayer";
import { resolveAxisFontSize } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { chartTransition, prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import type { D3GeoRenderConfig } from "@/components/charts/engine/d3/types";
import {
  isIdentityGeoViewTransform,
  isValidGeoViewTransform,
  type ChartGeoViewTransform,
} from "@/lib/chartGeoViewState";

function toZoomTransform(transform: ChartGeoViewTransform): d3.ZoomTransform {
  return d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k);
}

function fromZoomTransform(transform: d3.ZoomTransform): ChartGeoViewTransform {
  return { x: transform.x, y: transform.y, k: transform.k };
}

export function renderD3ChoroplethChart(container: HTMLElement, config: D3GeoRenderConfig): () => void {
  const {
    width,
    height,
    rows,
    columns,
    regionField,
    metricField,
    theme,
    showTooltip,
    tooltipPresentation,
    valueFormat,
    knownRegionNames,
    mapId: mapIdRaw = VS_REGIONS_MAP_ID,
    isDark = false,
    geoStyle = {},
    onPointClick,
    onDrillClick,
    drillDepth = 0,
    areaMapping,
    onViewTransformChange,
    onRefresh,
  } = config;

  const mapId = mapIdRaw?.trim() || VS_REGIONS_MAP_ID;

  const roam = resolveEmbeddedGeoRoam(geoStyle.roam);
  const showZoomControl = geoStyle.showZoomControl === true;
  const mapOpacity = resolveGeoMapOpacity(geoStyle.mapOpacity);
  const showRegionLabel = geoStyle.showRegionLabel === true;
  const showVisualMap = geoStyle.visualMap !== false && config.renderTier !== "thumbnail";
  const regionBorder = resolveGeoRegionBorder(geoStyle, isDark);
  const strokeWidth = resolveGeoRegionStrokeWidth(geoStyle, width);
  const regionLabelColor = resolveGeoRegionLabelColorHex(geoStyle, theme);
  const regionLabelFontSize = resolveGeoRegionLabelFontSize(geoStyle, {
    chartWidth: width,
    chartHeight: height,
    visualScale: config.visualScale,
    renderTier: config.renderTier,
  });

  if (width <= 0 || height <= 0) {
    container.replaceChildren();
    return () => undefined;
  }

  const geo = getOfflineGeoMap(mapId);
  if (!geo?.features?.length) {
    container.replaceChildren();
    const msg = document.createElement("div");
    msg.className =
      "flex h-full items-center justify-center px-3 text-center text-theme-sm text-error-600 dark:text-error-400";
    msg.setAttribute("role", "alert");
    msg.textContent = "离线地图资产缺失，无法渲染";
    container.appendChild(msg);
    return () => container.replaceChildren();
  }

  const features = joinOfflineMapFeatures(
    rows,
    columns,
    regionField,
    metricField,
    mapId,
    knownRegionNames,
    drillDepth,
    areaMapping,
  ).filter((f) => f.geometry != null);
  if (features.length === 0) {
    container.replaceChildren();
    const msg = document.createElement("div");
    msg.className =
      "flex h-full items-center justify-center px-3 text-center text-theme-sm text-warning-600 dark:text-warning-400";
    msg.setAttribute("role", "status");
    msg.textContent = "无有效地图区域可渲染，请检查地区维度与数据";
    container.appendChild(msg);
    return () => container.replaceChildren();
  }

  container.replaceChildren();

  const surface = buildGeoSurfacePalette(isDark, {
    colors: config.colors,
    regionFillColor: geoStyle.regionFillColor,
  });
  const margin = { top: 8, right: 12, bottom: 24, left: 12 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const featureCollection = {
    type: "FeatureCollection" as const,
    features: features.map((f) => ({ type: "Feature" as const, properties: { name: f.name }, geometry: f.geometry! })),
  };
  const projection = fitChinaGeoProjection(
    d3.geoMercator(),
    innerW,
    innerH,
    featureCollection,
  );
  const pathGen = d3.geoPath().projection(projection);

  const positiveValues = features.map((f) => f.value).filter((v) => v > 0);
  const maxVal = positiveValues.length ? (d3.max(positiveValues) ?? 0) : 0;
  const minVal = positiveValues.length ? (d3.min(positiveValues) ?? 0) : 0;

  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("data-vs-embedded-fit", "viewport")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img")
    .attr("data-region-count", String(features.length))
    .style("display", "block")
    .style("overflow", "visible");

  root
    .append("rect")
    .attr("class", "map-plot-bg")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .attr("pointer-events", "none");

  const visualUid = `geo-2d-${Math.random().toString(36).slice(2, 9)}`;
  const filters = mountGeoChoroplethAtmosphere(root, {
    uid: visualUid,
    width,
    height,
    isDark,
    surface,
    plotBackground: false,
  });

  const g = root.append("g").attr("class", "map-zoom-root");
  const chartG = g.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const mapLayer = chartG.append("g").attr("class", "map-layer");
  const tooltip = showTooltip ? createTooltipLayer(container, theme, tooltipPresentation) : null;

  paintGeoSilhouetteGlow(mapLayer, featureCollection, pathGen, surface, filters.mapShadow);

  const regions = mapLayer
    .selectAll("path.region")
    .data(features)
    .join("path")
    .attr("class", "region")
    .attr("d", (d) => pathGen({ type: "Feature", properties: {}, geometry: d.geometry! }) ?? "")
    .attr("fill", (d) => colorForGeoValue(d.value, minVal, maxVal, surface))
    .attr("fill-opacity", (d) => ((d.value > 0 ? 0.96 : 0.88) * mapOpacity))
    .attr("fill-rule", "evenodd")
    .attr("stroke", regionBorder.show ? regionBorder.colorCss : "none")
    .attr("stroke-width", regionBorder.show ? strokeWidth : 0)
    .attr("stroke-linejoin", "round")
    .attr("cursor", onPointClick || onDrillClick ? "pointer" : "default")
    .attr("opacity", prefersReducedMotion() ? 1 : 0);

  if (!prefersReducedMotion()) {
    chartTransition(regions)
      .delay((_, index) => index * 14)
      .duration(520)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);
  }

  const hoverLayer = mapLayer.append("g").attr("class", "map-hover-layer").attr("pointer-events", "none");
  const hoverPath = hoverLayer
    .append("path")
    .attr("class", "region-hover")
    .attr("fill-rule", "evenodd")
    .attr("stroke-linejoin", "round")
    .style("display", "none");

  const featurePath = (geometry: GeoJSON.Geometry) =>
    pathGen({ type: "Feature", properties: {}, geometry }) ?? "";

  const showRegionHover = (d: (typeof features)[number]) => {
    hoverPath
      .style("display", null)
      .attr("d", featurePath(d.geometry!))
      .attr("fill", colorForGeoHover(d.value, minVal, maxVal, surface))
      .attr("fill-opacity", mapOpacity)
      .attr("stroke", regionBorder.show ? regionBorder.hoverColorCss : "none")
      .attr("stroke-width", regionBorder.show ? strokeWidth * 1.55 : 0)
      .attr("stroke-opacity", 0.95);
  };

  const clearRegionHover = () => {
    hoverPath.style("display", "none").attr("d", null);
  };

  regions
    .on("mouseenter", function (_event, d) {
      showRegionHover(d);
      if (!tooltip) return;
      showMergedTooltip(
        tooltip,
        container,
        _event,
        d.name,
        [{ name: metricField || "值", color: surface.rangePeak, value: d.value }],
        valueFormat,
        width,
      );
    })
    .on("mousemove", (event, d) => {
      if (!tooltip) return;
      showMergedTooltip(
        tooltip,
        container,
        event,
        d.name,
        [{ name: metricField || "值", color: surface.rangePeak, value: d.value }],
        valueFormat,
        width,
      );
    })
    .on("mouseleave", () => {
      clearRegionHover();
      hideTooltip(tooltip);
    });

  if (onPointClick && onDrillClick) {
    regions.on("click", (event, d) => {
      event.stopPropagation();
      onPointClick({ name: d.name, value: d.value, adcode: d.adcode });
    });
  }

  if (onDrillClick) {
    regions.on("dblclick", (event, d) => {
      event.stopPropagation();
      onDrillClick({ name: d.name, value: d.value, adcode: d.adcode });
    });
  } else if (onPointClick) {
    regions.on("dblclick", (event, d) => {
      event.stopPropagation();
      onPointClick({ name: d.name, value: d.value, adcode: d.adcode });
    });
  }

  mapLayer.on("mouseleave", () => {
    clearRegionHover();
    hideTooltip(tooltip);
  });

  const bubbleEffect = resolveGeoMapBubbleEffect(geoStyle, {
    accentColor: config.colors?.[0],
  });
  const detachBubbleLayer = mountGeoMapBubbleRippleLayer({
    mapLayer,
    features,
    pathGen,
    effect: bubbleEffect,
    maxVal,
  });

  if (showRegionLabel) {
    mapLayer
      .selectAll("text.region-label")
      .data(features)
      .join("text")
      .attr("class", "region-label")
      .attr("transform", (d) => {
        const centroid = pathGen.centroid({ type: "Feature", properties: {}, geometry: d.geometry! });
        return `translate(${centroid[0]},${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", regionLabelColor)
      .style("font-size", `${regionLabelFontSize}px`)
      .style("pointer-events", "none")
      .text((d) => d.name);
  }

  if (showVisualMap) {
    const legendW = 100;
    const legendH = 8;
    const legendX = width - margin.right - legendW;
    const legendY = height - margin.bottom + 4;
    const legendG = root.append("g").attr("transform", `translate(${legendX},${legendY})`);
    const defs = root.append("defs");
    const gradId = `d3-choropleth-legend-${Math.random().toString(36).slice(2, 9)}`;
    const grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
    const legendStops = [0, 0.35, 0.7, 1];
    for (const t of legendStops) {
      grad
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorForGeoValue(minVal + t * (maxVal - minVal || 1), minVal, maxVal, surface));
    }
    legendG
      .append("rect")
      .attr("width", legendW)
      .attr("height", legendH)
      .attr("rx", 3)
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.5)")
      .attr("stroke-width", 0.75);
    legendG
      .append("text")
      .attr("y", legendH + 12)
      .attr("fill", theme.axisLabel)
      .style("font-size", `${resolveAxisFontSize()}px`)
      .text(formatGeoTooltipValue(minVal, valueFormat));
    legendG
      .append("text")
      .attr("x", legendW)
      .attr("y", legendH + 12)
      .attr("text-anchor", "end")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${resolveAxisFontSize()}px`)
      .text(formatGeoTooltipValue(maxVal, valueFormat));
  }

  let detachZoom = () => undefined;
  let detachZoomControls = () => undefined;
  if (roam || showZoomControl) {
    const savedTransform = geoStyle.viewTransform;
    const resolvedTransform =
      savedTransform
      && !isIdentityGeoViewTransform(savedTransform)
      && isValidGeoViewTransform(savedTransform, width, height)
        ? savedTransform
        : undefined;
    if (savedTransform && !resolvedTransform && onViewTransformChange) {
      queueMicrotask(() => onViewTransformChange(undefined));
    }
    const initialTransform = resolvedTransform
      ? toZoomTransform(resolvedTransform)
      : d3.zoomIdentity;
    let persistTimer: ReturnType<typeof setTimeout> | null = null;

    const notifyViewTransform = (transform: d3.ZoomTransform) => {
      if (!onViewTransformChange) return;
      const next = fromZoomTransform(transform);
      if (!isValidGeoViewTransform(next, width, height)) return;
      onViewTransformChange(isIdentityGeoViewTransform(next) ? undefined : next);
    };

    const schedulePersistViewTransform = (transform: d3.ZoomTransform) => {
      if (!onViewTransformChange) return;
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        persistTimer = null;
        notifyViewTransform(transform);
      }, 150);
    };

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([GEO_MAP_SCALE_LIMIT.min, GEO_MAP_SCALE_LIMIT.max])
      .extent([
        [0, 0],
        [width, height],
      ])
      .filter((event) => {
        if (event.type === "wheel" || event.type === "mousedown" || event.type.startsWith("touch")) {
          return roam;
        }
        return true;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      })
      .on("end", (event) => {
        schedulePersistViewTransform(event.transform);
      });
    root.call(zoom);
    try {
      root.call(zoom.transform, initialTransform);
      g.attr("transform", initialTransform.toString());
    } catch {
      // jsdom 无 layout，跳过初始 transform
    }
    if (roam) {
      root.on("dblclick.zoom", () => {
        root
          .transition()
          .duration(300)
          .call(zoom.transform, d3.zoomIdentity)
          .on("end", () => {
            notifyViewTransform(d3.zoomIdentity);
          });
      });
    }
    if (showZoomControl) {
      detachZoomControls = mountGeoZoomControls({
        container,
        svg: root.node()!,
        zoom,
        zoomRoot: g,
        onRefresh: () => {
          notifyViewTransform(d3.zoomIdentity);
          onRefresh?.();
        },
      });
    }
    detachZoom = () => {
      if (persistTimer) clearTimeout(persistTimer);
      root.on(".zoom", null);
      root.on("dblclick.zoom", null);
      detachZoomControls();
    };
  }

  return () => {
    detachZoom();
    detachBubbleLayer();
    container.replaceChildren();
  };
}
