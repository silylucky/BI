import * as d3 from "d3";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";

export function buildLineGenerator(
  horizontal: boolean,
  smooth: boolean,
  xScale: d3.ScalePoint<string> | d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScalePoint<string>,
) {
  const curve = smooth ? d3.curveMonotoneX : d3.curveLinear;
  if (horizontal) {
    return d3
      .line<D3CartesianDatum>()
      .x((d) => (yScale as d3.ScaleLinear<number, number>)(Number(d.__value__ ?? 0)))
      .y((d) => (xScale as d3.ScalePoint<string>)(String(d.__category__ ?? "")) ?? 0)
      .curve(d3.curveMonotoneY);
  }
  return d3
    .line<D3CartesianDatum>()
    .x((d) => (xScale as d3.ScalePoint<string>)(String(d.__category__ ?? "")) ?? 0)
    .y((d) => (yScale as d3.ScaleLinear<number, number>)(Number(d.__value__ ?? 0)))
    .curve(curve);
}

export function buildAreaGenerator(
  horizontal: boolean,
  smooth: boolean,
  innerBaseline: number,
  xScale: d3.ScalePoint<string> | d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScalePoint<string>,
) {
  const curve = smooth ? d3.curveMonotoneX : d3.curveLinear;
  if (horizontal) {
    return d3
      .area<D3CartesianDatum>()
      .x0(0)
      .x1((d) => (yScale as d3.ScaleLinear<number, number>)(Number(d.__value__ ?? 0)))
      .y((d) => (xScale as d3.ScalePoint<string>)(String(d.__category__ ?? "")) ?? 0)
      .curve(d3.curveMonotoneY);
  }
  return d3
    .area<D3CartesianDatum>()
    .x((d) => (xScale as d3.ScalePoint<string>)(String(d.__category__ ?? "")) ?? 0)
    .y0(innerBaseline)
    .y1((d) => (yScale as d3.ScaleLinear<number, number>)(Number(d.__value__ ?? 0)))
    .curve(curve);
}
