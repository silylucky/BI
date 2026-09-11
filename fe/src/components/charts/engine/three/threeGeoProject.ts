import * as d3 from "d3";
import { fitChinaGeoProjection } from "@/components/charts/engine/geo/geoProjection";

const GEO_MAP_MARGIN = { top: 8, right: 12, bottom: 24, left: 12 } as const;

/** 与 D3 choropleth 同源的投影，输出以场景原点为中心的 XY 坐标 */
export function createThreeGeoProjector(
  width: number,
  height: number,
  collection: GeoJSON.FeatureCollection,
): (coord: [number, number]) => [number, number] | null {
  const innerW = Math.max(0, width - GEO_MAP_MARGIN.left - GEO_MAP_MARGIN.right);
  const innerH = Math.max(0, height - GEO_MAP_MARGIN.top - GEO_MAP_MARGIN.bottom);
  const projection = fitChinaGeoProjection(d3.geoMercator(), innerW, innerH, collection);

  return (coord) => {
    const p = projection(coord);
    if (!p) return null;
    return [p[0] - innerW / 2, -(p[1] - innerH / 2)];
  };
}
