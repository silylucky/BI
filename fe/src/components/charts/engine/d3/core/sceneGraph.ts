import * as d3 from "d3";
import {
  applyRotatedCategoryLabels,
  applyRotatedLeftCategoryLabels,
  axisCategoryDisplayText,
  categoryAxisEdgePad,
  categoryBottomAxisTickPadding,
  categoryBottomAxisTickSize,
  drawCategoryBandAxisBottom,
  drawCategoryBandAxisLeft,
  formatAxisCategoryLabel,
  formatHorizontalBandAxisLabel,
  planCategoryAxisLayout,
  planNumericAxisTicks,
  distinctFormattedNumericTickValues,
  resolveBandAxisFontSize,
  resolveHorizontalCategoryAxisLayout,
  resolveRotatedAxisExtraSpan,
  styleAxis,
  type CategoryAxisLayout,
} from "@/components/charts/engine/d3/core/axes";
import { VCDS, getDepthVisual, resolveAxisFontSize } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { depthExtrudePx } from "@/components/charts/engine/d3/core/depthEngine";
import { DATA_ZOOM_SLIDER_RESERVE } from "@/components/charts/engine/d3/core/dataZoomWindow";
import { cartesianMargin } from "@/components/charts/engine/d3/core/margin";
import {
  reserveLegendMargin,
  type D3LegendItem,
  type D3LegendLayout,
} from "@/components/charts/engine/d3/core/d3Legend";
import type { D3Theme } from "@/components/charts/engine/d3/core/themeEngine";
import { formatChartValue } from "@/lib/chartValueFormat";
import type { AxisLabelRotate, ChartAxisStyle } from "@/lib/chartDeStyleBlocks";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  drawHierarchicalCategoryAxis,
  planHierarchicalCategoryAxis,
  resolveHierarchicalCategoryAxisRotate,
} from "@/components/charts/engine/d3/core/hierarchicalAxis";

function buildHierarchicalCategoryXLayout(
  categories: string[],
  innerW: number,
  hierPlan: NonNullable<ReturnType<typeof planHierarchicalCategoryAxis>>,
  labelRotate?: AxisLabelRotate,
): CategoryAxisLayout {
  const rotateDeg = resolveHierarchicalCategoryAxisRotate(
    categories,
    innerW,
    labelRotate,
    hierPlan.structuralLevelCount,
  );
  return {
    ticks: categories,
    rotateDeg,
    slotSpan: innerW / Math.max(1, categories.length),
    extraBottom: hierPlan.extraBottom + resolveRotatedAxisExtraSpan(rotateDeg),
  };
}

function numericTickValues(
  scale: d3.ScaleLinear<number, number>,
  innerSpan: number,
  format: (value: d3.NumberValue) => string,
): number[] {
  return distinctFormattedNumericTickValues(scale, innerSpan, format);
}

export type CartesianScene = {
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  margin: ReturnType<typeof cartesianMargin>;
  innerW: number;
  innerH: number;
  clipId: string;
};

export type InlineLegendMarginOpts = {
  showLegend?: boolean;
  legendLayout?: D3LegendLayout;
  legendItems?: D3LegendItem[];
};

function applyInlineLegendMargin(
  margin: ReturnType<typeof cartesianMargin>,
  width: number,
  height: number,
  legend?: InlineLegendMarginOpts,
): ReturnType<typeof cartesianMargin> {
  if (!legend?.showLegend) return margin;
  return reserveLegendMargin(
    margin,
    width,
    height,
    legend.legendLayout,
    legend.legendItems ?? [],
  );
}

type BuildCartesianSceneOptions = {
  container: HTMLElement;
  width: number;
  height: number;
  showLegend: boolean;
  legendLayout?: D3LegendLayout;
  legendItems?: D3LegendItem[];
  clipId?: string;
  incremental?: boolean;
  /** 用于小组件下预估横轴旋转并加大 bottom 边距 */
  categories?: string[];
  categoryLevelCount?: number;
  axisStyle?: ChartAxisStyle;
  /** 为底部类目缩略轴预留下边距 */
  dataZoom?: boolean;
};

export type ChartSvgLayout = {
  margin: ReturnType<typeof cartesianMargin>;
  innerW: number;
  innerH: number;
};

export type CategoryCartesianLayout = ChartSvgLayout & {
  xLayout: CategoryAxisLayout;
};

export type HorizontalCategoryCartesianLayout = ChartSvgLayout & {
  yLayout: ReturnType<typeof resolveHorizontalCategoryAxisLayout>;
};

/** 固定坐标系 SVG 随容器 CSS 拉伸（paintMaxEdge / visualScale 降采样后仍填满 widget） */
export function applyScalableChartSvgDisplay(
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  coordWidth: number,
  coordHeight: number,
): void {
  root
    .attr("viewBox", `0 0 ${coordWidth} ${coordHeight}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("display", "block")
    .style("overflow", "visible");
}

/** 按 SVG 实际绘制 bbox（含轴外标签、图例）等比缩小，嵌入 widget 内完整显示 */
export function fitSvgContentToScalableDisplay(
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  pad = 6,
): void {
  const node = root.node();
  if (!node) return;
  let bbox: DOMRect;
  try {
    bbox = node.getBBox();
  } catch {
    return;
  }
  if (bbox.width <= 0 || bbox.height <= 0) return;
  const x = bbox.x - pad;
  const y = bbox.y - pad;
  const w = bbox.width + pad * 2;
  const h = bbox.height + pad * 2;
  root
    .attr("viewBox", `${x} ${y} ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("display", "block")
    .style("overflow", "visible");
}

/** @deprecated 使用 fitSvgContentToScalableDisplay（svg 根节点 bbox 含图例） */
export function fitPlotGroupToScalableSvg(
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  pad = 6,
): void {
  const plotNode = plot.node();
  if (!plotNode) return;
  let bbox: DOMRect;
  try {
    bbox = plotNode.getBBox();
  } catch {
    return;
  }
  if (bbox.width <= 0 || bbox.height <= 0) return;
  const x = bbox.x - pad;
  const y = bbox.y - pad;
  const w = bbox.width + pad * 2;
  const h = bbox.height + pad * 2;
  root
    .attr("viewBox", `${x} ${y} ${w} ${h}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("display", "block")
    .style("overflow", "visible");
}

/** 补齐未走 appendChartSvg 的渲染器（饼图/漏斗等） */
export function normalizeEmbeddedChartSvgs(container: HTMLElement): void {
  container.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
    if (svg.getAttribute("width") === "100%" && svg.hasAttribute("viewBox")) return;
    const rawWidth = svg.getAttribute("width");
    const rawHeight = svg.getAttribute("height");
    if (!rawWidth || !rawHeight || rawWidth.includes("%")) return;
    const coordWidth = Number.parseFloat(rawWidth);
    const coordHeight = Number.parseFloat(rawHeight);
    if (!(coordWidth > 0 && coordHeight > 0)) return;
    applyScalableChartSvgDisplay(d3.select(svg), coordWidth, coordHeight);
  });
}

/** 嵌入看板 SVG 缩放策略：viewport=固定画布等比 contain；content=按绘制 bbox 收缩（桑基/漏斗等） */
export type EmbeddedChartSvgFitMode = "viewport" | "content";

export function resolveEmbeddedChartSvgFitMode(svg: SVGSVGElement): EmbeddedChartSvgFitMode {
  const explicit = svg.dataset.vsEmbeddedFit;
  if (explicit === "viewport" || explicit === "content") return explicit;
  return svg.classList.contains("vs-chart-svg") ? "viewport" : "content";
}

/** 嵌入看板：先升级 legacy SVG，再按策略等比 contain（非拉伸填满） */
export function finalizeEmbeddedChartSvgs(container: HTMLElement): void {
  normalizeEmbeddedChartSvgs(container);
  container.querySelectorAll<SVGSVGElement>("svg").forEach((svgEl) => {
    if (svgEl.dataset.vsChartScalable === "false") return;
    const mode = resolveEmbeddedChartSvgFitMode(svgEl);
    if (mode === "content") {
      fitSvgContentToScalableDisplay(d3.select(svgEl));
    }
  });
}

/** 与 buildCartesianScene 一致：标准 SVG 根节点 + 允许轴标签溢出 */
export function appendChartSvg(
  container: HTMLElement,
  width: number,
  height: number,
): d3.Selection<SVGSVGElement, unknown, null, undefined> {
  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("role", "img");
  applyScalableChartSvgDisplay(root, width, height);
  return root;
}

/** 纵轴类目图：抽稀横轴刻度 + 为旋转标签预留 bottom 边距 */
export function resolveCategoryCartesianLayout(
  width: number,
  height: number,
  categories: string[],
  options?: {
    showLegend?: boolean;
    legendLayout?: D3LegendLayout;
    legendItems?: D3LegendItem[];
    axisStyle?: ChartAxisStyle;
    marginOverrides?: Partial<ReturnType<typeof cartesianMargin>>;
    categoryLevelCount?: number;
  },
): CategoryCartesianLayout {
  let margin = cartesianMargin(false, options?.marginOverrides);
  const provisionalInnerW = Math.max(0, width - margin.left - margin.right);
  const hierPlan = planHierarchicalCategoryAxis(categories, provisionalInnerW, {
    structuralLevelCount: options?.categoryLevelCount,
  });
  const xLayout = hierPlan
    ? buildHierarchicalCategoryXLayout(
        categories,
        provisionalInnerW,
        hierPlan,
        options?.axisStyle?.x?.labelRotate,
      )
    : planCategoryAxisLayout(
        categories,
        provisionalInnerW,
        options?.axisStyle?.x?.labelRotate,
      );
  const edgePad = categoryAxisEdgePad(xLayout.ticks, xLayout.rotateDeg);
  const depthPad = depthExtrudePx(getDepthVisual());
  margin = {
    ...margin,
    left: margin.left + edgePad.left,
    right: margin.right + edgePad.right,
    bottom: margin.bottom + xLayout.extraBottom + depthPad,
  };
  margin = applyInlineLegendMargin(margin, width, height, {
    showLegend: options?.showLegend,
    legendLayout: options?.legendLayout,
    legendItems: options?.legendItems,
  });
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const fittedXLayout = hierPlan
    ? buildHierarchicalCategoryXLayout(
        categories,
        innerW,
        hierPlan,
        options?.axisStyle?.x?.labelRotate,
      )
    : planCategoryAxisLayout(categories, innerW, options?.axisStyle?.x?.labelRotate);
  return { margin, innerW, innerH, xLayout: fittedXLayout };
}

/** 横轴类目图：抽稀纵轴刻度 + 按最长标签扩展 left 边距 */
export function resolveHorizontalCategoryCartesianLayout(
  width: number,
  height: number,
  categories: string[],
  options?: {
    showLegend?: boolean;
    legendLayout?: D3LegendLayout;
    legendItems?: D3LegendItem[];
    marginOverrides?: Partial<ReturnType<typeof cartesianMargin>>;
    axisStyle?: ChartAxisStyle;
  },
): HorizontalCategoryCartesianLayout {
  const baseMargin = cartesianMargin(false, options?.marginOverrides);
  const provisionalInnerH = Math.max(0, height - baseMargin.top - baseMargin.bottom);
  const yLayout = resolveHorizontalCategoryAxisLayout(
    categories,
    provisionalInnerH,
    undefined,
    options?.axisStyle?.y?.labelRotate,
  );
  let margin = {
    ...baseMargin,
    left: Math.max(baseMargin.left, yLayout.leftMargin, options?.marginOverrides?.left ?? 0),
  };
  margin = applyInlineLegendMargin(margin, width, height, {
    showLegend: options?.showLegend,
    legendLayout: options?.legendLayout,
    legendItems: options?.legendItems,
  });
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  return { margin, innerW, innerH, yLayout };
}

function dataZoomBottomOverride(enabled?: boolean) {
  if (!enabled) return undefined;
  return { bottom: cartesianMargin().bottom + DATA_ZOOM_SLIDER_RESERVE };
}

export function buildCartesianScene(opts: BuildCartesianSceneOptions): CartesianScene {
  const legendOpts: InlineLegendMarginOpts = {
    showLegend: opts.showLegend,
    legendLayout: opts.legendLayout,
    legendItems: opts.legendItems,
  };
  const zoomMargin = dataZoomBottomOverride(opts.dataZoom);
  const { margin, innerW, innerH } =
    opts.categories && opts.categories.length > 0
      ? resolveCategoryCartesianLayout(opts.width, opts.height, opts.categories, {
          showLegend: opts.showLegend,
          legendLayout: opts.legendLayout,
          legendItems: opts.legendItems,
          axisStyle: opts.axisStyle,
          categoryLevelCount: opts.categoryLevelCount,
          marginOverrides: zoomMargin,
        })
      : (() => {
          let baseMargin = cartesianMargin(false, zoomMargin);
          baseMargin = applyInlineLegendMargin(baseMargin, opts.width, opts.height, legendOpts);
          return {
            margin: baseMargin,
            innerW: Math.max(0, opts.width - baseMargin.left - baseMargin.right),
            innerH: Math.max(0, opts.height - baseMargin.top - baseMargin.bottom),
          };
        })();
  const clipId = opts.clipId ?? `vs-clip-${Math.random().toString(36).slice(2, 9)}`;

  let root = d3.select(opts.container).select<SVGSVGElement>("svg.vs-chart-svg");
  if (root.empty() || !opts.incremental) {
    opts.container.replaceChildren();
    root = d3
      .select(opts.container)
      .append("svg")
      .attr("class", "vs-chart-svg")
      .attr("role", "img");
  }
  applyScalableChartSvgDisplay(root, opts.width, opts.height);

  let defs = root.select<SVGDefsElement>("defs");
  if (defs.empty()) defs = root.append("defs");

  let g = root.select<SVGGElement>("g.vs-chart-plot-root");
  if (g.empty()) {
    g = root.append("g").attr("class", "vs-chart-plot-root").attr("transform", `translate(${margin.left},${margin.top})`);
  } else {
    g.attr("transform", `translate(${margin.left},${margin.top})`);
  }

  let clip = defs.select(`#${clipId}`);
  if (clip.empty()) {
    clip = defs.append("clipPath").attr("id", clipId);
    clip.append("rect").attr("rx", 4);
  }
  clip.select("rect").attr("width", innerW).attr("height", innerH);
  applyPlotClipPadding(clip, innerW, innerH);

  let plot = g.select<SVGGElement>("g.vs-chart-plot");
  if (plot.empty()) {
    plot = g.append("g").attr("class", "vs-chart-plot").attr("clip-path", `url(#${clipId})`);
  } else {
    plot.attr("clip-path", `url(#${clipId})`);
  }

  return { root, defs, g, plot, margin, innerW, innerH, clipId };
}

/** 横轴数值图：clip 与纵轴图一致，边距按纵轴类目标签扩展 */
export function buildHorizontalCartesianScene(
  opts: BuildCartesianSceneOptions & { categories: string[] },
): CartesianScene {
  const { margin, innerW, innerH } = resolveHorizontalCategoryCartesianLayout(
    opts.width,
    opts.height,
    opts.categories,
    {
      showLegend: opts.showLegend,
      legendLayout: opts.legendLayout,
      legendItems: opts.legendItems,
      axisStyle: opts.axisStyle,
      marginOverrides: dataZoomBottomOverride(opts.dataZoom),
    },
  );
  const clipId = opts.clipId ?? `vs-clip-h-${Math.random().toString(36).slice(2, 9)}`;

  let root = d3.select(opts.container).select<SVGSVGElement>("svg.vs-chart-svg");
  if (root.empty() || !opts.incremental) {
    opts.container.replaceChildren();
    root = d3
      .select(opts.container)
      .append("svg")
      .attr("class", "vs-chart-svg")
      .attr("role", "img");
  }
  applyScalableChartSvgDisplay(root, opts.width, opts.height);

  let defs = root.select<SVGDefsElement>("defs");
  if (defs.empty()) defs = root.append("defs");

  let g = root.select<SVGGElement>("g.vs-chart-plot-root");
  if (g.empty()) {
    g = root.append("g").attr("class", "vs-chart-plot-root").attr("transform", `translate(${margin.left},${margin.top})`);
  } else {
    g.attr("transform", `translate(${margin.left},${margin.top})`);
  }

  let clip = defs.select(`#${clipId}`);
  if (clip.empty()) {
    clip = defs.append("clipPath").attr("id", clipId);
    clip.append("rect").attr("rx", 4);
  }
  clip.select("rect").attr("width", innerW).attr("height", innerH);
  applyPlotClipPadding(clip, innerW, innerH);

  let plot = g.select<SVGGElement>("g.vs-chart-plot");
  if (plot.empty()) {
    plot = g.append("g").attr("class", "vs-chart-plot").attr("clip-path", `url(#${clipId})`);
  } else {
    plot.attr("clip-path", `url(#${clipId})`);
  }

  return { root, defs, g, plot, margin, innerW, innerH, clipId };
}

function applyPlotClipPadding(
  clip: d3.Selection<d3.BaseType, unknown, null, undefined>,
  innerW: number,
  innerH: number,
): void {
  const level = getDepthVisual();
  const pad = level !== "off" ? depthExtrudePx(level) + 1 : 0;
  if (pad <= 0) {
    clip.select("rect").attr("x", 0).attr("y", 0);
    return;
  }
  // 纵柱：顶/右挤出；横柱：底/右挤出 — 四向留白避免 clip 裁切 2.5D 面
  clip.select("rect")
    .attr("x", 0)
    .attr("y", -pad)
    .attr("width", innerW + pad)
    .attr("height", innerH + 2 * pad);
}

type GridOptions = {
  yScale: d3.ScaleLinear<number, number>;
  innerW: number;
  theme: D3Theme;
};

export function drawHorizontalGrid(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  { yScale, innerW, theme }: GridOptions,
): void {
  plot.selectAll("g.vs-grid").remove();
  plot
    .append("g")
    .attr("class", "vs-grid")
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickSize(-innerW)
        .tickFormat(() => ""),
    )
    .call((sel) => sel.select(".domain").remove())
    .call((sel) =>
      sel
        .selectAll(".tick line")
        .attr("stroke", theme.gridLine)
        .attr("stroke-opacity", VCDS.grid.opacity)
        .attr("stroke-dasharray", VCDS.grid.dash),
    );
}

type BandAxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleBand<string>;
  yScale: d3.ScaleLinear<number, number>;
  categories: string[];
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
  categoryLevelCount?: number;
};

function hierarchicalAxisNameY(innerH: number, hierPlan: ReturnType<typeof planHierarchicalCategoryAxis>, rotateDeg: number): number {
  if (hierPlan) return innerH + hierPlan.activeLevels.length * 16 + 12;
  return innerH + (rotateDeg ? 42 : 32);
}

export function drawCartesianBandAxes(opts: BandAxesOptions): { rotateX: number } {
  const hierPlan = planHierarchicalCategoryAxis(opts.categories, opts.innerW, {
    structuralLevelCount: opts.categoryLevelCount,
  });
  const xLayout = hierPlan
    ? buildHierarchicalCategoryXLayout(
        opts.categories,
        opts.innerW,
        hierPlan,
        opts.axisStyle?.x?.labelRotate,
      )
    : planCategoryAxisLayout(
        opts.categories,
        opts.innerW,
        opts.axisStyle?.x?.labelRotate,
        48,
        opts.xScale.bandwidth(),
      );

  opts.g.selectAll("g.vs-axis-x, g.vs-axis-y, text.vs-axis-name, text.vs-axis-name-y").remove();

  if (opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-y")
      .call(
        d3
          .axisLeft(opts.yScale)
          .tickValues(
            numericTickValues(opts.yScale, opts.innerH, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.y);
  }

  if (opts.axisStyle?.x?.show !== false) {
    if (hierPlan) {
      drawHierarchicalCategoryAxis({
        g: opts.g,
        xScale: opts.xScale,
        categories: opts.categories,
        innerH: opts.innerH,
        innerW: opts.innerW,
        theme: opts.theme,
        axisStyle: opts.axisStyle,
        plan: hierPlan,
      });
    } else {
      opts.g
        .append("g")
        .attr("class", "vs-axis-x")
        .attr("transform", `translate(0,${opts.innerH})`)
        .call((sel) =>
          drawCategoryBandAxisBottom(
            sel,
            opts.xScale,
            opts.innerW,
            xLayout.ticks,
            xLayout.rotateDeg,
            opts.theme,
            opts.axisStyle?.x,
          ),
        );
    }

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", hierarchicalAxisNameY(opts.innerH, hierPlan, xLayout.rotateDeg))
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("transform", "rotate(-90)")
      .attr("x", -opts.innerH / 2)
      .attr("y", -44)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }

  return { rotateX: xLayout.rotateDeg };
}

type AxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScalePoint<string>;
  yScale: d3.ScaleLinear<number, number>;
  categories: string[];
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
  categoryLevelCount?: number;
};

export function drawCartesianAxes(opts: AxesOptions): { rotateX: number } {
  const hierPlan = planHierarchicalCategoryAxis(opts.categories, opts.innerW, {
    structuralLevelCount: opts.categoryLevelCount,
  });
  const xLayout = hierPlan
    ? buildHierarchicalCategoryXLayout(
        opts.categories,
        opts.innerW,
        hierPlan,
        opts.axisStyle?.x?.labelRotate,
      )
    : planCategoryAxisLayout(opts.categories, opts.innerW, opts.axisStyle?.x?.labelRotate);

  opts.g.selectAll("g.vs-axis-x, g.vs-axis-y, text.vs-axis-name, text.vs-axis-name-y").remove();

  if (opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-y")
      .call(
        d3
          .axisLeft(opts.yScale)
          .tickValues(
            numericTickValues(opts.yScale, opts.innerH, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.y);
  }

  if (opts.axisStyle?.x?.show !== false) {
    if (hierPlan) {
      drawHierarchicalCategoryAxis({
        g: opts.g,
        xScale: opts.xScale,
        categories: opts.categories,
        innerH: opts.innerH,
        innerW: opts.innerW,
        theme: opts.theme,
        axisStyle: opts.axisStyle,
        plan: hierPlan,
      });
    } else {
      opts.g
        .append("g")
        .attr("class", "vs-axis-x")
        .attr("transform", `translate(0,${opts.innerH})`)
        .call(
          d3
            .axisBottom(opts.xScale)
            .tickSizeInner(categoryBottomAxisTickSize())
            .tickPadding(categoryBottomAxisTickPadding())
            .tickValues(xLayout.ticks)
            .tickFormat((d) => axisCategoryDisplayText(String(d))),
        )
        .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.x)
        .call((sel) => applyRotatedCategoryLabels(sel, xLayout.rotateDeg));
    }

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", hierarchicalAxisNameY(opts.innerH, hierPlan, xLayout.rotateDeg))
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("transform", "rotate(-90)")
      .attr("x", -opts.innerH / 2)
      .attr("y", -44)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }

  return { rotateX: xLayout.rotateDeg };
}

type HorizontalBandAxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleBand<string>;
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
  /** 覆盖横轴刻度文案（如进度条 0–1 轴显示为百分比） */
  xTickFormat?: (value: d3.NumberValue) => string;
};

/** 横向柱图：x=数值轴，y=类目 band 轴 */
export function drawCartesianHorizontalBandAxes(opts: HorizontalBandAxesOptions): void {
  opts.g.selectAll("g.vs-axis-x, g.vs-axis-y, text.vs-axis-name, text.vs-axis-name-y").remove();

  const categories = opts.yScale.domain();
  const yLayout = resolveHorizontalCategoryAxisLayout(
    categories,
    opts.innerH,
    undefined,
    opts.axisStyle?.y?.labelRotate,
  );
  const yAxisFontSize = resolveBandAxisFontSize(yLayout.bandHeight);

  if (opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-y")
      .call((sel) =>
        drawCategoryBandAxisLeft(
          sel,
          opts.yScale,
          opts.innerH,
          yLayout.ticks,
          yLayout.labelMaxWidth,
          opts.theme,
          yAxisFontSize,
          opts.axisStyle?.y,
          yLayout.rotateDeg,
        ),
      );
  }

  if (opts.axisStyle?.x?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-x")
      .attr("transform", `translate(0,${opts.innerH})`)
      .call(
        d3
          .axisBottom(opts.xScale)
          .tickSizeInner(categoryBottomAxisTickSize())
          .tickPadding(categoryBottomAxisTickPadding())
          .tickValues(
            numericTickValues(opts.xScale, opts.innerW, (d) =>
              opts.xTickFormat ? opts.xTickFormat(d) : formatChartValue(d, opts.valueFormat),
            ),
          )
          .tickFormat((d) =>
            opts.xTickFormat ? opts.xTickFormat(d) : formatChartValue(d, opts.valueFormat),
          ),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.x);

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", opts.innerH + 32)
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("transform", "rotate(-90)")
      .attr("x", -opts.innerH / 2)
      .attr("y", -44)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }
}

type LinearAxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
};

/** 散点/象限：双数值轴 */
export function drawLinearCartesianAxes(opts: LinearAxesOptions): void {
  opts.g.selectAll("g.vs-axis-x, g.vs-axis-y, text.vs-axis-name, text.vs-axis-name-y").remove();

  if (opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-y")
      .call(
        d3
          .axisLeft(opts.yScale)
          .tickValues(
            numericTickValues(opts.yScale, opts.innerH, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.y);
  }

  if (opts.axisStyle?.x?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-x")
      .attr("transform", `translate(0,${opts.innerH})`)
      .call(
        d3
          .axisBottom(opts.xScale)
          .tickSizeInner(categoryBottomAxisTickSize())
          .tickPadding(categoryBottomAxisTickPadding())
          .tickValues(
            numericTickValues(opts.xScale, opts.innerW, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.x);

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", opts.innerH + 32)
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("transform", "rotate(-90)")
      .attr("x", -opts.innerH / 2)
      .attr("y", -44)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }
}

type DualAxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScalePoint<string>;
  yLeft: d3.ScaleLinear<number, number>;
  yRight: d3.ScaleLinear<number, number>;
  categories: string[];
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
  categoryLevelCount?: number;
};

/** 双轴图：左/右数值轴 + 类目横轴 */
export function drawDualAxesAxes(opts: DualAxesOptions): void {
  const hierPlan = planHierarchicalCategoryAxis(opts.categories, opts.innerW, {
    structuralLevelCount: opts.categoryLevelCount,
  });
  const xLayout = hierPlan
    ? buildHierarchicalCategoryXLayout(
        opts.categories,
        opts.innerW,
        hierPlan,
        opts.axisStyle?.x?.labelRotate,
      )
    : planCategoryAxisLayout(opts.categories, opts.innerW, opts.axisStyle?.x?.labelRotate);

  opts.g
    .selectAll("g.vs-axis-x, g.vs-axis-y, g.vs-axis-y-right, text.vs-axis-name, text.vs-axis-name-y")
    .remove();

  if (opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("g")
      .attr("class", "vs-axis-y")
      .call(
        d3
          .axisLeft(opts.yLeft)
          .tickValues(
            numericTickValues(opts.yLeft, opts.innerH, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.y);
    opts.g
      .append("g")
      .attr("class", "vs-axis-y-right")
      .attr("transform", `translate(${opts.innerW},0)`)
      .call(
        d3
          .axisRight(opts.yRight)
          .tickValues(
            numericTickValues(opts.yRight, opts.innerH, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.y);
  }

  if (opts.axisStyle?.x?.show !== false) {
    if (hierPlan) {
      drawHierarchicalCategoryAxis({
        g: opts.g,
        xScale: opts.xScale,
        categories: opts.categories,
        innerH: opts.innerH,
        innerW: opts.innerW,
        theme: opts.theme,
        axisStyle: opts.axisStyle,
        plan: hierPlan,
      });
    } else {
      opts.g
        .append("g")
        .attr("class", "vs-axis-x")
        .attr("transform", `translate(0,${opts.innerH})`)
        .call(
          d3
            .axisBottom(opts.xScale)
            .tickSizeInner(categoryBottomAxisTickSize())
            .tickPadding(categoryBottomAxisTickPadding())
            .tickValues(xLayout.ticks)
            .tickFormat((d) => axisCategoryDisplayText(String(d))),
        )
        .call(styleAxis, opts.theme, resolveAxisFontSize(), opts.axisStyle?.x)
        .call((sel) => applyRotatedCategoryLabels(sel, xLayout.rotateDeg));
    }

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", hierarchicalAxisNameY(opts.innerH, hierPlan, xLayout.rotateDeg))
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("transform", "rotate(-90)")
      .attr("x", -opts.innerH / 2)
      .attr("y", -44)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }
}

type BidirectionalAxesOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  yScale: d3.ScaleBand<string>;
  xLeftScale: d3.ScaleLinear<number, number>;
  xRightScale: d3.ScaleLinear<number, number>;
  centerX: number;
  innerW: number;
  innerH: number;
  theme: D3Theme;
  valueFormat?: NumberFormatConfig;
  axisStyle?: ChartAxisStyle;
};

/** 双向柱图：中轴类目 + 左右独立数值轴（对标 DataEase G2Plot BidirectionalBar） */
export function drawBidirectionalBandAxes(opts: BidirectionalAxesOptions): void {
  opts.g.selectAll(
    "g.vs-axis-x-left, g.vs-axis-x-right, g.vs-axis-y, text.vs-axis-y-center, text.vs-axis-name, text.vs-axis-name-y",
  ).remove();

  const categories = opts.yScale.domain();
  const yLayout = resolveHorizontalCategoryAxisLayout(
    categories,
    opts.innerH,
    undefined,
    opts.axisStyle?.y?.labelRotate,
  );
  const yAxisFontSize = resolveBandAxisFontSize(yLayout.bandHeight);
  const labelMaxWidth = Math.min(opts.centerX, opts.innerW - opts.centerX) * 1.75;

  if (opts.axisStyle?.y?.show !== false) {
    const centerLabels = opts.g.append("g").attr("class", "vs-axis-y-center");
    for (const tick of yLayout.ticks) {
      const label = formatHorizontalBandAxisLabel(String(tick), labelMaxWidth, yLayout.rotateDeg);
      if (!label) continue;
      centerLabels
        .append("text")
        .attr("x", opts.centerX)
        .attr("y", (opts.yScale(tick) ?? 0) + opts.yScale.bandwidth() / 2)
        .attr("dy", "0.32em")
        .attr("text-anchor", "middle")
        .attr("fill", opts.theme.axisLabel)
        .style("font-size", `${yAxisFontSize}px`)
        .text(label)
        .call((sel) => applyRotatedLeftCategoryLabels(sel, yLayout.rotateDeg));
    }
  }

  if (opts.axisStyle?.x?.show !== false) {
    const axisFontSize = resolveAxisFontSize();
    opts.g
      .append("g")
      .attr("class", "vs-axis-x-left")
      .attr("transform", `translate(0,${opts.innerH})`)
      .call(
          d3
          .axisBottom(opts.xLeftScale)
          .tickSizeInner(categoryBottomAxisTickSize())
          .tickPadding(categoryBottomAxisTickPadding())
          .tickValues(
            numericTickValues(opts.xLeftScale, opts.centerX, (d) => formatChartValue(d, opts.valueFormat)),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, axisFontSize, opts.axisStyle?.x);

    opts.g
      .append("g")
      .attr("class", "vs-axis-x-right")
      .attr("transform", `translate(0,${opts.innerH})`)
      .call(
          d3
          .axisBottom(opts.xRightScale)
          .tickSizeInner(categoryBottomAxisTickSize())
          .tickPadding(categoryBottomAxisTickPadding())
          .tickValues(
            numericTickValues(
              opts.xRightScale,
              opts.innerW - opts.centerX,
              (d) => formatChartValue(d, opts.valueFormat),
            ),
          )
          .tickFormat((d) => formatChartValue(d, opts.valueFormat)),
      )
      .call(styleAxis, opts.theme, axisFontSize, opts.axisStyle?.x);

    const xName = opts.axisStyle?.x?.name?.trim();
    if (xName) {
      opts.g
        .append("text")
        .attr("class", "vs-axis-name")
        .attr("x", opts.innerW / 2)
        .attr("y", opts.innerH + 32)
        .attr("fill", opts.theme.axisLabel)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(xName);
    }
  }

  const yName = opts.axisStyle?.y?.name?.trim();
  if (yName && opts.axisStyle?.y?.show !== false) {
    opts.g
      .append("text")
      .attr("class", "vs-axis-name-y")
      .attr("x", opts.centerX)
      .attr("y", -8)
      .attr("fill", opts.theme.axisLabel)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .text(yName);
  }
}
