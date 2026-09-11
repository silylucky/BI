import * as THREE from "three";
import {
  colorForGeoValue,
  geoClassicSurfaceColors,
  geoMinimalSurfaceColors,
  geoSurfaceColors as buildGeoPalette,
  geoValueIntensity,
  type GeoSurfacePalette,
} from "@/components/charts/engine/geo/geoSurfaceColors";

export type GeoSurfaceColors = {
  palette: GeoSurfacePalette;
  emptyFill: number;
  rangeLow: number;
  rangeHigh: number;
  rangeLowCss: string;
  rangeMidCss: string;
  rangeHighCss: string;
  rangePeakCss: string;
};

function cssToHex(color: string): number {
  return new THREE.Color(color).getHex();
}

export function geoSurfaceColors(isDark: boolean): GeoSurfaceColors {
  const palette = buildGeoPalette(isDark);
  return geoSurfaceColorsFromPalette(palette);
}

function geoSurfaceColorsFromPalette(palette: GeoSurfacePalette): GeoSurfaceColors {
  return {
    palette,
    emptyFill: cssToHex(palette.emptyFill),
    rangeLow: cssToHex(palette.rangeLow),
    rangeHigh: cssToHex(palette.rangeHigh),
    rangeLowCss: palette.rangeLow,
    rangeMidCss: palette.rangeMid,
    rangeHighCss: palette.rangeHigh,
    rangePeakCss: palette.rangePeak,
  };
}

export function geoSurfaceColorsForPreset(
  isDark: boolean,
  preset: "satellite" | "tech" | "classic" | "minimal",
): GeoSurfaceColors {
  let palette: GeoSurfacePalette;
  if (preset === "classic") palette = geoClassicSurfaceColors(isDark);
  else if (preset === "minimal") palette = geoMinimalSurfaceColors(isDark);
  else palette = buildGeoPalette(isDark);
  return geoSurfaceColorsFromPalette(palette);
}

export function colorForValue(value: number, min: number, max: number, surface: GeoSurfaceColors): number {
  return cssToHex(colorForGeoValue(value, min, max, surface.palette));
}

export function emissiveIntensityForValue(value: number, min: number, max: number): number {
  return 0.12 + geoValueIntensity(value, min, max) * 0.62;
}

type ProjectFn = (coord: [number, number]) => [number, number] | null;

function traceRing(path: THREE.Path, ring: [number, number][], project: ProjectFn): void {
  let started = false;
  for (const coord of ring) {
    const p = project(coord);
    if (!p) continue;
    if (!started) {
      path.moveTo(p[0], p[1]);
      started = true;
    } else {
      path.lineTo(p[0], p[1]);
    }
  }
}

export function geometryToShapes(geometry: GeoJSON.Geometry, project: ProjectFn): THREE.Shape[] {
  if (geometry.type === "Polygon") {
    const shape = new THREE.Shape();
    geometry.coordinates.forEach((ring, index) => {
      if (index === 0) traceRing(shape, ring as [number, number][], project);
      else {
        const hole = new THREE.Path();
        traceRing(hole, ring as [number, number][], project);
        shape.holes.push(hole);
      }
    });
    return shape.curves.length > 0 ? [shape] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((poly) =>
      geometryToShapes({ type: "Polygon", coordinates: poly }, project),
    );
  }
  return [];
}

export { webglAvailable } from "@/components/charts/engine/three/webglProbe";
