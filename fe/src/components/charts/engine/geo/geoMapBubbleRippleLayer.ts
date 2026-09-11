import * as d3 from "d3";
import type { GeoPath } from "d3";
import { prefersNativeReducedMotion } from "@/components/charts/engine/d3/core/animate";
import type { D3GeoFeature } from "@/components/charts/engine/d3/types";
import type { ResolvedGeoMapBubbleEffect } from "@/components/charts/engine/geo/geoMapBubbleEffectStyle";

type RippleMount = {
  mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  features: D3GeoFeature[];
  pathGen: GeoPath;
  effect: ResolvedGeoMapBubbleEffect;
  maxVal: number;
};

function rippleRadius(value: number, maxVal: number): number {
  const ratio = maxVal > 0 ? value / maxVal : 1;
  return 5 + ratio * 9;
}

function appendRippleRings(
  host: d3.Selection<SVGGElement, D3GeoFeature, SVGGElement, unknown>,
  effect: ResolvedGeoMapBubbleEffect,
  baseR: number,
) {
  const core = host.append("circle").attr("class", "bubble-core").attr("r", baseR * 0.35);
  core.attr("fill", effect.color).attr("opacity", 0.88);

  if (prefersNativeReducedMotion()) return;

  for (let i = 0; i < effect.ringCount; i += 1) {
    const ring = host
      .append("circle")
      .attr("class", "bubble-ring")
      .attr("fill", "none")
      .attr("stroke", effect.color)
      .attr("stroke-width", 1.25)
      .attr("r", baseR * 0.55);
    const begin = (i / effect.ringCount) * effect.durationMs;
    ring
      .append("animate")
      .attr("attributeName", "r")
      .attr("from", String(baseR * 0.55))
      .attr("to", String(baseR * 2.8))
      .attr("dur", `${effect.durationMs}ms`)
      .attr("begin", `${begin}ms`)
      .attr("repeatCount", "indefinite");
    ring
      .append("animate")
      .attr("attributeName", "opacity")
      .attr("from", "0.72")
      .attr("to", "0")
      .attr("dur", `${effect.durationMs}ms`)
      .attr("begin", `${begin}ms`)
      .attr("repeatCount", "indefinite");
  }
}

/** 2D 地图区域中心水波气泡（对标 DataEase effectScatter 水波） */
export function mountGeoMapBubbleRippleLayer(mount: RippleMount): () => void {
  if (!mount.effect.enabled) return () => undefined;

  const points = mount.features.filter((f) => f.value > 0 && f.geometry);
  if (!points.length) return () => undefined;

  const layer = mount.mapLayer
    .append("g")
    .attr("class", "map-bubble-effect-layer")
    .attr("pointer-events", "none")
    .attr("data-testid", "geo-map-bubble-layer");

  layer
    .selectAll<SVGGElement, D3GeoFeature>("g.bubble-point")
    .data(points, (d) => d.name)
    .join("g")
    .attr("class", "bubble-point")
    .attr("transform", (d) => {
      const centroid = mount.pathGen.centroid({
        type: "Feature",
        properties: {},
        geometry: d.geometry!,
      });
      return `translate(${centroid[0]},${centroid[1]})`;
    })
    .each(function (d) {
      appendRippleRings(d3.select(this), mount.effect, rippleRadius(d.value, mount.maxVal));
    });

  return () => {
    layer.remove();
  };
}
