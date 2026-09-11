import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { chartViewModelToRenderSpec } from "@/components/charts/engine/buildChartViewModel";
import { VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";
import { findMapDrillFilterValue } from "@/lib/geoMapLevels";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import type { D3DispatchPayload } from "@/components/charts/engine/d3/renderDispatch";
import {
  scaleD3PresentationProps,
  applyHubThumbnailStyleOverrides,
  type ChartPresentationPaintContext,
} from "@/components/charts/engine/d3/core/chartPresentationScale";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { buildD3StyleProps } from "@/components/charts/engine/d3/views/buildStyleProps";
import { extractDrillValue, buildCartesianRenderConfig } from "@/components/charts/engine/d3/views/buildCartesianConfig";
import { readCartesianStyleFromPlanOptions, readCompareStyleFromPlanOptions } from "@/lib/applyChartDeStyleBlocks";
import { readChartDeStyle, readChartGeoStyle, readChartGeo3dStyle } from "@/lib/chartDeStyle";
import { readChartGeoAreaMappingLookup } from "@/lib/chartGeoAreaMapping";
import {
  defaultGeo3dRenderTier,
  resolveTerrainTextureEnabled,
} from "@/components/charts/engine/three/geo3dRuntime";
import type {
  D3BarRangeDatum,
  D3BidirectionalBarDatum,
  D3BulletDatum,
  D3CartesianDatum,
  D3MatrixCell,
  D3ProgressBarDatum,
  D3StockDatum,
  D3WaterfallDatum,
} from "@/components/charts/engine/d3/types";

function onDatumClick(
  props: ChartEngineViewProps,
  xField: string,
): ((datum: D3CartesianDatum) => void) | undefined {
  const { onInteraction } = props;
  if (!onInteraction) return undefined;
  return (datum) => {
    const value = extractDrillValue(datum, xField);
    if (value) onInteraction({ kind: "drill", value, label: value });
  };
}

export function buildD3DispatchPayload(
  props: ChartEngineViewProps,
  plan: ChartRenderPlan,
  chartWidth: number,
  chartHeight: number,
  paintContext?: { visualScale?: number; renderTier?: Geo3dRenderTier },
): D3DispatchPayload | null {
  if (plan.kind !== "d3" || plan.empty) return null;
  const visualScale = paintContext?.visualScale;
  const renderTier = paintContext?.renderTier ?? props.geo3dRenderTier;
  const paint: ChartPresentationPaintContext = {
    chartWidth,
    chartHeight,
    visualScale,
    renderTier,
  };
  const styleProps = applyHubThumbnailStyleOverrides(
    scaleD3PresentationProps(buildD3StyleProps(props, plan), paint),
    renderTier,
  );
  const options = plan.options;
  const plotType = plan.plotType;
  const cartesianStyle = readCartesianStyleFromPlanOptions(options);
  const compareStyle = readCompareStyleFromPlanOptions(options);

  const presentation = {
    labelFontSize: styleProps.labelFontSize,
    labelColor: styleProps.labelColor,
    seriesGradient: styleProps.seriesGradient,
    depthVisual: styleProps.depthVisual,
    tooltipPresentation: styleProps.tooltipPresentation,
  };

  if (plotType === "Choropleth") {
    const spec = chartViewModelToRenderSpec(props.viewModel);
    const regionField = spec.encoding.dimensions[0]?.field ?? "";
    const metricField = spec.encoding.metrics[0]?.field ?? "";
    const rows = (options.rows as unknown[][]) ?? [];
    const columns = (options.columns as string[]) ?? [];
    const geoStyle = props.chartConfig ? readChartGeoStyle(readChartDeStyle(props.chartConfig)) : {};
    const deStyle = props.chartConfig ? readChartDeStyle(props.chartConfig) : {};
    const areaMapping = readChartGeoAreaMappingLookup(deStyle);
    const isMap3d = props.viewModel.chartType === "map-3d";
    const geo3dStyleRaw = props.chartConfig ? readChartGeo3dStyle(readChartDeStyle(props.chartConfig)) : {};
    const renderTier = props.geo3dRenderTier ?? "full";
    const geo3dStyle = {
      ...geo3dStyleRaw,
      terrainTexture: resolveTerrainTextureEnabled(renderTier, geo3dStyleRaw),
    };
    const mapId = (options.mapId as string | undefined) ?? VS_REGIONS_MAP_ID;
    const viewTransform = geoStyle.viewTransforms?.[mapId];
    return {
      kind: "geo",
      config: {
        width: chartWidth,
        height: chartHeight,
        rows,
        columns,
        regionField,
        metricField,
        knownRegionNames: options.knownRegionNames as string[] | undefined,
        mapId: (options.mapId as string | undefined) ?? VS_REGIONS_MAP_ID,
        drillDepth: (options.drillDepth as number | undefined) ?? 0,
        areaMapping,
        isDark: props.isDark ?? props.style.scheme === "dark",
        geoStyle: {
          roam: geoStyle.roam,
          showRegionLabel: geoStyle.showRegionLabel,
          visualMap: geoStyle.visualMap !== false && renderTier !== "thumbnail",
          showRegionBorder: geoStyle.showRegionBorder,
          regionBorderColor: geoStyle.regionBorderColor,
          regionFillColor: geoStyle.regionFillColor,
          showZoomControl: geoStyle.showZoomControl,
          mapOpacity: props.style.paletteOpacity ?? deStyle.paletteOpacity,
          bubbleEffect: geoStyle.bubbleEffect,
          bubbleEffectType: geoStyle.bubbleEffectType,
          bubbleEffectSpeed: geoStyle.bubbleEffectSpeed,
          bubbleEffectRingCount: geoStyle.bubbleEffectRingCount,
          bubbleEffectColor: geoStyle.bubbleEffectColor,
          regionLabelColor: geoStyle.regionLabelColor,
          regionLabelFontSize: geoStyle.regionLabelFontSize,
          regionBorderWidth: geoStyle.regionBorderWidth,
          viewTransform,
        },
        geo3dStyle,
        renderTier,
        visualScale: paintContext?.visualScale,
        instanceKey: props.instanceKey,
        colors: styleProps.colors,
        theme: styleProps.theme,
        showTooltip: styleProps.showTooltip,
        tooltipPresentation: styleProps.tooltipPresentation,
        valueFormat: styleProps.valueFormat,
        onPointClick:
          props.onLinkageClick
            ? (datum) => {
                props.onLinkageClick?.({
                  name: datum.name,
                  value: String(
                    findMapDrillFilterValue(
                      datum.name,
                      props.drillClickField ?? regionField,
                      props.drillLookupRows ?? rows,
                      columns,
                      (options.knownRegionNames as string[] | undefined) ?? [],
                      areaMapping,
                    ) || datum.name,
                  ),
                });
              }
            : undefined,
        onDrillClick: props.onInteraction
          ? (datum) => {
              const clickField = props.drillClickField ?? regionField;
              const lookupRows = props.drillLookupRows ?? rows;
              const known = (options.knownRegionNames as string[] | undefined) ?? [];
              const value = clickField
                ? findMapDrillFilterValue(
                    datum.name,
                    clickField,
                    lookupRows,
                    columns,
                    known,
                    areaMapping,
                  )
                : datum.name;
              props.onInteraction?.({ kind: "drill", value, label: datum.name });
            }
          : undefined,
        onViewTransformChange: props.onGeoViewTransformChange
          ? (transform) => props.onGeoViewTransformChange?.(mapId, transform)
          : undefined,
        onOrbitViewChange: props.onGeo3dOrbitViewChange
          ? (view) => props.onGeo3dOrbitViewChange?.(mapId, view)
          : undefined,
        onRefresh: props.onChartRefresh,
        depthVisual: styleProps.depthVisual,
      },
    };
  }

  if (plotType === "Heatmap") {
    const data = (options.data as D3MatrixCell[]) ?? [];
    const geoStyle = props.chartConfig ? readChartGeoStyle(readChartDeStyle(props.chartConfig)) : {};
    const isThumbnail = renderTier === "thumbnail";
    return {
      kind: "matrix",
      config: {
        width: chartWidth,
        height: chartHeight,
        data,
        colors: styleProps.colors,
        theme: styleProps.theme,
        showTooltip: styleProps.showTooltip,
        tooltipPresentation: styleProps.tooltipPresentation,
        valueFormat: styleProps.valueFormat,
        conditionalRules: styleProps.conditionalRules,
        showCellLabel: geoStyle.showCellLabel === true && !isThumbnail,
        showVisualMap: geoStyle.visualMap !== false && !isThumbnail,
        labelFontSize: styleProps.labelFontSize,
        labelColor: styleProps.labelColor,
        depthVisual: styleProps.depthVisual,
        visualScale,
        renderTier,
        onPointClick:
          props.onInteraction
            ? (datum) => {
                props.onInteraction?.({
                  kind: "drill",
                  value: datum.x,
                  label: `${datum.x}/${datum.y}`,
                });
              }
            : undefined,
      },
    };
  }

  if (plotType === "DualAxes") {
    const data = options.data as [D3CartesianDatum[], D3CartesianDatum[]];
    const xField = String(options.xField ?? "__category__");
    const yField = options.yField as [string, string];
    return {
      kind: "dualAxes",
      config: {
        width: chartWidth,
        height: chartHeight,
        data,
        xField,
        yField,
        geometryOptions: (options.geometryOptions ?? []) as [
          { geometry: "line" },
          { geometry: "column"; isGroup?: boolean; isStack?: boolean },
        ],
        lineLabels: options.lineLabels as [string, string] | undefined,
        columnSeriesField: options.columnSeriesField as string | undefined,
        lineSeriesField: options.lineSeriesField as string | undefined,
        leftLineSeriesField: options.leftLineSeriesField as string | undefined,
        showLabel: styleProps.showLabel,
        labelFontSize: styleProps.labelFontSize,
        labelColor: styleProps.labelColor,
        seriesGradient: styleProps.seriesGradient,
        tooltipPresentation: styleProps.tooltipPresentation,
        dataZoom: Boolean(options.__dataZoom),
        colors: styleProps.colors,
        theme: styleProps.theme,
        showTooltip: styleProps.showTooltip,
        showLegend: styleProps.showLegend,
        valueFormat: styleProps.valueFormat,
        labelContent: styleProps.labelContent,
        markLines: styleProps.markLines,
        conditionalRules: styleProps.conditionalRules,
        legendLayout: styleProps.legendLayout,
        ...cartesianStyle,
        categoryLevelCount: options.categoryLevelCount as number | undefined,
        visualScale,
        renderTier,
        onPointClick: onDatumClick(props, xField),
      },
    };
  }

  if (plotType === "Waterfall") {
    const data = (options.data as D3WaterfallDatum[]) ?? [];
    return {
      kind: "waterfall",
      config: {
        width: chartWidth,
        height: chartHeight,
        data,
        colors: styleProps.colors,
        theme: styleProps.theme,
        showTooltip: styleProps.showTooltip,
        showLabel: styleProps.showLabel,
        showLegend: styleProps.showLegend,
        legendLayout: styleProps.legendLayout,
        ...presentation,
        valueFormat: styleProps.valueFormat,
        labelContent: styleProps.labelContent,
        ...cartesianStyle,
        conditionalRules: styleProps.conditionalRules,
        onPointClick:
          props.onInteraction
            ? (datum) => {
                props.onInteraction?.({ kind: "drill", value: datum.type, label: datum.type });
              }
            : undefined,
      },
    };
  }

  if (plotType === "BidirectionalBar") {
    const raw = (options.data as D3BidirectionalBarDatum[]) ?? [];
    return {
      kind: "bidirectional",
      config: {
        width: chartWidth,
        height: chartHeight,
        data: raw,
        colors: styleProps.colors,
        theme: styleProps.theme,
        showTooltip: styleProps.showTooltip,
        showLabel: styleProps.showLabel,
        showLegend: styleProps.showLegend,
        legendLayout: styleProps.legendLayout,
        ...presentation,
        valueFormat: styleProps.valueFormat,
        labelContent: styleProps.labelContent,
        ...cartesianStyle,
        conditionalRules: styleProps.conditionalRules,
      },
    };
  }

  const specialPlot = new Set(["BarRange", "ProgressBar", "Bullet", "Stock"]);
  if (specialPlot.has(plotType)) {
    const data = (options.data as D3BarRangeDatum[] | D3ProgressBarDatum[] | D3BulletDatum[] | D3StockDatum[]) ?? [];
    const base = {
      width: chartWidth,
      height: chartHeight,
      data,
      colors: styleProps.colors,
      theme: styleProps.theme,
      showTooltip: styleProps.showTooltip,
      showLabel: styleProps.showLabel,
      labelContent: styleProps.labelContent,
      ...presentation,
      valueFormat: styleProps.valueFormat,
      ...cartesianStyle,
      ...compareStyle,
      conditionalRules: styleProps.conditionalRules,
      onPointClick:
        props.onInteraction
          ? (datum: { type: string; value?: number; progress?: number; target?: number }) => {
              props.onInteraction?.({ kind: "drill", value: datum.type, label: datum.type });
            }
          : undefined,
    };
    if (plotType === "BarRange") return { kind: "barRange", config: base as never };
    if (plotType === "ProgressBar") return { kind: "progressBar", config: base as never };
    if (plotType === "Bullet") return { kind: "bullet", config: base as never };
    return { kind: "stock", config: base as never };
  }

  const cartesianTypes = new Set(["Line", "Column", "Bar"]);
  if (cartesianTypes.has(plotType)) {
    const cartesian = buildCartesianRenderConfig(
      props,
      plan,
      chartWidth,
      chartHeight,
      paintContext,
    );
    if (cartesian) return { kind: "cartesian", config: cartesian };
  }

  return {
    kind: "generic",
    config: {
      width: chartWidth,
      height: chartHeight,
      visualScale,
      renderTier,
      options,
      colors: styleProps.colors,
      theme: styleProps.theme,
      showLabel: styleProps.showLabel,
      showTooltip: styleProps.showTooltip,
      showLegend: styleProps.showLegend,
      labelContent: styleProps.labelContent,
      ...presentation,
      valueFormat: styleProps.valueFormat,
      conditionalRules: styleProps.conditionalRules,
      markLines: styleProps.markLines,
      legendLayout: styleProps.legendLayout,
      ...cartesianStyle,
      ...compareStyle,
      instanceKey: props.instanceKey,
      onPointClick:
        props.onInteraction
          ? (datum) => {
              const label = String(datum.type ?? datum.stage ?? datum.name ?? datum.word ?? "");
              if (!label) return;
              props.onInteraction?.({ kind: "drill", value: label, label });
            }
          : undefined,
    },
  };
}
