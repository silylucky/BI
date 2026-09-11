import * as d3 from "d3";
import { applyCellBevel, resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { motionDuration } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabelLines } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import {
  appendMultilineSvgLabel,
  multilineLabelMinHeight,
} from "@/components/charts/engine/d3/core/multilineLabel";
import {
  pickTreemapVisibleLabelKeys,
  treemapLeafLabelKey,
} from "@/components/charts/engine/d3/core/nodeLabelThinning";
import { formatChartValue } from "@/lib/chartValueFormat";
import {
  TREEMAP_CELL_HOVER_STROKE_WIDTH,
  TREEMAP_CELL_STROKE_WIDTH,
  treemapCellBaseTransform,
  treemapCellHoverTransform,
} from "./treemapCellTransform";
import {
  DEFAULT_TREEMAP_CELL_RADIUS,
  DEFAULT_TREEMAP_PADDING_INNER,
  DEFAULT_TREEMAP_PADDING_OUTER,
} from "@/lib/chartDeStyleBlocks";

type TreemapDatum = { name: string; value: number };
type TreeNode = { name: string; value?: number; children?: TreeNode[] };

function positionTooltip(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  event: MouseEvent,
  container: HTMLElement,
  width: number,
) {
  const rect = container.getBoundingClientRect();
  tooltip
    .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
    .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
}

export function renderD3TreemapChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();
  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    valueFormat,
    options,
    onPointClick,
    conditionalRules = [],
    depthVisual,
    labelFontSize = 11,
    labelContent,
  } = config;
  const depthLevel = resolveEffectiveDepth(depthVisual);
  const data = (options.data as TreemapDatum[]) ?? [];
  if (width <= 0 || height <= 0 || data.length === 0) return () => undefined;

  const root = d3
    .hierarchy<TreeNode>({ name: "root", children: data })
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const paddingInner = Number(options.__treemapPaddingInner ?? DEFAULT_TREEMAP_PADDING_INNER);
  const paddingOuter = Number(options.__treemapPaddingOuter ?? DEFAULT_TREEMAP_PADDING_OUTER);
  const cellRadius = Number(options.__treemapCellRadius ?? DEFAULT_TREEMAP_CELL_RADIUS);
  const gaplessInner = paddingInner <= 0;
  const cellStroke =
    gaplessInner ? "none" : theme.background === "transparent" ? "#fff" : theme.background;
  const cellStrokeWidth = gaplessInner ? 0 : TREEMAP_CELL_STROKE_WIDTH;

  d3.treemap<TreeNode>()
    .size([width, height])
    .paddingInner(paddingInner)
    .paddingOuter(paddingOuter)
    .round(!gaplessInner)(root);

  const leaves = root.leaves() as d3.HierarchyRectangularNode<TreeNode>[];
  const labelTotal = d3.sum(leaves, (d) => d.value ?? 0);
  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(leaves.map((d) => d.data.name))
    .range(colors);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img");

  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;
  const cells = svg
    .selectAll<SVGGElement, d3.HierarchyRectangularNode<TreeNode>>("g.cell")
    .data(leaves)
    .join("g")
    .attr("class", "cell")
    .attr("transform", (d) => treemapCellBaseTransform(d.x0, d.y0))
    .style("cursor", onPointClick ? "pointer" : "default");

  cells
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", cellRadius)
    .attr("fill", (d) => {
      const base = colorScale(d.data.name) ?? colors[0] ?? "#465fff";
      return conditionalRules.length > 0
        ? resolveDatumColor(d.value ?? 0, base, conditionalRules)
        : base;
    })
    .attr("opacity", 0.92)
    .attr("stroke", cellStroke)
    .attr("stroke-width", cellStrokeWidth)
    .each(function () {
      if (!gaplessInner) applyCellBevel(d3.select(this), depthLevel);
    });

  cells
    .on("mouseenter", function (_event, d) {
      const cell = d3.select(this);
      const width = Math.max(0, d.x1 - d.x0);
      const height = Math.max(0, d.y1 - d.y0);
      cell.raise();
      cell
        .transition()
        .duration(motionDuration("hover"))
        .attr("transform", treemapCellHoverTransform(d.x0, d.y0, width, height));
      cell
        .select("rect")
        .transition()
        .duration(motionDuration("hover"))
        .attr("opacity", 1);
      if (!gaplessInner) {
        cell
          .select("rect")
          .transition()
          .duration(motionDuration("hover"))
          .attr("stroke-width", TREEMAP_CELL_HOVER_STROKE_WIDTH);
      }
      if (!tooltip) return;
      tooltip
        .style("opacity", "1")
        .html(
          `<div style="font-weight:600;margin-bottom:2px">${d.data.name}</div>` +
            `<div><strong>${formatChartValue(d.value ?? 0, valueFormat)}</strong></div>`,
        );
    })
    .on("mousemove", (event, d) => {
      if (!tooltip) return;
      tooltip
        .style("opacity", "1")
        .html(
          `<div style="font-weight:600;margin-bottom:2px">${d.data.name}</div>` +
            `<div><strong>${formatChartValue(d.value ?? 0, valueFormat)}</strong></div>`,
        );
      positionTooltip(tooltip, event, container, width);
    })
    .on("mouseleave", function (_event, d) {
      const cell = d3.select(this);
      cell
        .transition()
        .duration(motionDuration("hover"))
        .attr("transform", treemapCellBaseTransform(d.x0, d.y0));
      cell
        .select("rect")
        .transition()
        .duration(motionDuration("hover"))
        .attr("opacity", 0.92);
      if (!gaplessInner) {
        cell
          .select("rect")
          .transition()
          .duration(motionDuration("hover"))
          .attr("stroke-width", TREEMAP_CELL_STROKE_WIDTH);
      }
      tooltip?.style("opacity", "0");
    })
    .on("click", (_event, d) => onPointClick?.({ name: d.data.name, value: d.value ?? 0 } as D3Datum));

  if (showLabel) {
    const visibleLabelKeys = pickTreemapVisibleLabelKeys({
      leaves,
      fontSize: labelFontSize,
      labelLinesFor: (leaf) =>
        formatSimpleDataLabelLines(
          leaf.data.name,
          leaf.value ?? 0,
          labelTotal,
          labelContent,
          valueFormat,
        ),
    });

    cells.each(function (d) {
      if (!visibleLabelKeys.has(treemapLeafLabelKey(d))) return;
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      const lines = formatSimpleDataLabelLines(
        d.data.name,
        d.value ?? 0,
        labelTotal,
        labelContent,
        valueFormat,
      );
      if (lines.length === 0 || w <= 36) return;
      const minH = multilineLabelMinHeight(lines.length, labelFontSize);
      if (h < minH) return;
      appendMultilineSvgLabel(d3.select(this), lines, {
        x: 6,
        y: 4,
        fontSize: labelFontSize,
        fill: "#fff",
      });
    });
  }

  return () => container.replaceChildren();
}
