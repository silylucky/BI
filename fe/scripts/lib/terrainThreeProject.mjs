/**
 * 构建期复刻 fe/src/components/charts/engine/three/geo/threeGeoProject.ts
 * 参考视口须与运行时 map-3d 默认尺寸一致（800×600）。
 */
import * as d3 from "d3";

export const TERRAIN_REF_VIEWPORT = { width: 800, height: 600 };

export const THREE_GEO_MAP_MARGIN = {
  top: 8,
  right: 12,
  bottom: 24,
  left: 12,
};

const LAYOUT_SIZE = 0.92;
const LAYOUT_CENTER_Y = 0.52;

function fitChinaGeoProjection(projection, width, height, collection) {
  const layoutW = width * LAYOUT_SIZE;
  const layoutH = height * LAYOUT_SIZE;
  const left = (width - layoutW) / 2;
  const top = height * LAYOUT_CENTER_Y - layoutH / 2;
  return projection.fitExtent(
    [
      [left, top],
      [left + layoutW, top + layoutH],
    ],
    collection,
  );
}

function computeGeoProjBounds(features, project) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const visit = (coord) => {
    const p = project(coord);
    if (!p) return;
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  };

  const walk = (geometry) => {
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        for (const c of ring) visit(c);
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const poly of geometry.coordinates) {
        for (const ring of poly) {
          for (const c of ring) visit(c);
        }
      }
    }
  };

  for (const f of features) {
    if (f.geometry) walk(f.geometry);
  }

  const padX = (maxX - minX) * 0.02 || 1;
  const padY = (maxY - minY) * 0.02 || 1;
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
}

/**
 * @param {Array<{ geometry: import('geojson').Geometry | null }>} boundsFeatures
 * @param {import('geojson').FeatureCollection} fitCollection
 */
export function buildTerrainThreeProject(
  width,
  height,
  boundsFeatures,
  fitCollection,
) {
  const margin = THREE_GEO_MAP_MARGIN;
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const projection = fitChinaGeoProjection(d3.geoMercator(), innerW, innerH, fitCollection);

  const projectRaw = (coord) => {
    const p = projection(coord);
    if (!p) return null;
    return [p[0] + margin.left - width / 2, -(p[1] + margin.top - height / 2)];
  };

  const rawBounds = computeGeoProjBounds(boundsFeatures, projectRaw);
  const centerX = (rawBounds.minX + rawBounds.maxX) / 2;
  const centerY = (rawBounds.minY + rawBounds.maxY) / 2;

  const project = (coord) => {
    const p = projectRaw(coord);
    if (!p) return null;
    return [p[0] - centerX, p[1] - centerY];
  };

  return {
    projection,
    project,
    projBounds: computeGeoProjBounds(boundsFeatures, project),
    margin,
    centerX,
    centerY,
    viewport: { width, height },
  };
}
