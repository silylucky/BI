import * as d3 from "d3";
import type { GeoSurfacePalette } from "@/components/charts/engine/geo/geoSurfaceColors";

export type GeoChoroplethFilterIds = {
  mapShadow: string;
};

type AtmosphereOpts = {
  uid: string;
  width: number;
  height: number;
  isDark: boolean;
  surface: GeoSurfacePalette;
  /** 2D 默认透明，与看板组件底融合；3D 可开启径向渐变底衬 */
  plotBackground?: boolean;
};

export function mountGeoChoroplethAtmosphere(
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  opts: AtmosphereOpts,
): GeoChoroplethFilterIds {
  const defs = root.append("defs");
  const plotBackground = opts.plotBackground === true;

  if (plotBackground) {
    const bgId = `${opts.uid}-plot-bg`;
    const bg = defs
      .append("radialGradient")
      .attr("id", bgId)
      .attr("cx", "50%")
      .attr("cy", "42%")
      .attr("r", "72%");
    bg.append("stop").attr("offset", "0%").attr("stop-color", opts.surface.plotBgCenter);
    bg.append("stop").attr("offset", "100%").attr("stop-color", opts.surface.plotBgEdge);
    root.select<SVGRectElement>(".map-plot-bg").attr("fill", `url(#${bgId})`);
  }

  const mapShadow = `${opts.uid}-map-shadow`;
  const shadow = defs
    .append("filter")
    .attr("id", mapShadow)
    .attr("x", "-30%")
    .attr("y", "-30%")
    .attr("width", "160%")
    .attr("height", "160%");
  shadow
    .append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", opts.isDark ? 4 : 3)
    .attr("stdDeviation", opts.isDark ? 5 : 3.5)
    .attr("flood-color", opts.isDark ? "#0ea5e9" : "#64748b")
    .attr("flood-opacity", opts.isDark ? 0.22 : 0.14);

  return { mapShadow };
}

export function paintGeoSilhouetteGlow(
  mapLayer: d3.Selection<SVGGElement, unknown, null, undefined>,
  featureCollection: GeoJSON.FeatureCollection,
  pathGen: d3.GeoPath,
  surface: GeoSurfacePalette,
  filterId: string,
): void {
  mapLayer
    .append("path")
    .attr("class", "map-silhouette-glow")
    .datum(featureCollection)
    .attr("d", pathGen)
    .attr("fill", surface.glow)
    .attr("fill-opacity", 0.1)
    .attr("stroke", "none")
    .attr("filter", `url(#${filterId})`)
    .attr("pointer-events", "none");
}
