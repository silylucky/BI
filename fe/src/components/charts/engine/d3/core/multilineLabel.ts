import * as d3 from "d3";

export type MultilineLabelAnchor = "start" | "middle" | "end";

export function appendMultilineSvgLabel(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  lines: string[],
  opts: {
    x: number;
    y: number;
    fontSize: number;
    fill: string;
    anchor?: MultilineLabelAnchor;
    lineHeightRatio?: number;
    firstLineDy?: string;
  },
): d3.Selection<SVGTextElement, unknown, null, undefined> | null {
  if (lines.length === 0) return null;

  const anchor = opts.anchor ?? "start";
  const lineHeight = Math.round(opts.fontSize * (opts.lineHeightRatio ?? 1.25));
  const text = parent
    .append("text")
    .attr("x", opts.x)
    .attr("y", opts.y)
    .attr("text-anchor", anchor)
    .attr("fill", opts.fill)
    .style("font-size", `${opts.fontSize}px`)
    .style("pointer-events", "none");

  if (lines.length === 1) {
    text.attr("dy", opts.firstLineDy ?? "0.9em").text(lines[0]);
    return text;
  }

  lines.forEach((line, index) => {
    text
      .append("tspan")
      .attr("x", opts.x)
      .attr("dy", index === 0 ? (opts.firstLineDy ?? `${opts.fontSize}px`) : lineHeight)
      .text(line);
  });
  return text;
}

export function setMultilineSvgLabel(
  text: d3.Selection<SVGTextElement, unknown, null, undefined>,
  lines: string[],
  opts: {
    fontSize: number;
    anchor?: MultilineLabelAnchor;
    x?: number;
    lineHeightRatio?: number;
    firstLineDy?: string;
    centerBlock?: boolean;
  },
): void {
  text.selectAll("tspan").remove();
  text.text("");
  if (lines.length === 0) return;

  const anchor = opts.anchor ?? "start";
  const x = opts.x ?? (Number(text.attr("x")) || 0);
  text.attr("text-anchor", anchor);

  if (lines.length === 1) {
    text.attr("dy", opts.firstLineDy ?? "0.9em").text(lines[0]);
    return;
  }

  const lineHeight = Math.round(opts.fontSize * (opts.lineHeightRatio ?? 1.25));
  const blockOffset = opts.centerBlock ? -((lines.length - 1) * lineHeight) / 2 : 0;
  lines.forEach((line, index) => {
    text
      .append("tspan")
      .attr("x", x)
      .attr(
        "dy",
        index === 0
          ? (opts.firstLineDy ?? `${blockOffset + opts.fontSize}px`)
          : lineHeight,
      )
      .text(line);
  });
}

export function multilineLabelMinHeight(lineCount: number, fontSize: number, padding = 10): number {
  if (lineCount <= 0) return 0;
  const lineHeight = Math.round(fontSize * 1.25);
  return lineCount * lineHeight + padding;
}
