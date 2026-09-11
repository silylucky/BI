import { describe, expect, it, vi } from "vitest";
import {
  resolveGisOverlayStyle,
  readGisProject,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  buildGisOverlayCirclePaint,
  buildGisOverlayCircleRadius,
  buildGisOverlayStyleKey,
  syncGisOverlayData,
  syncGisOverlayStyle,
} from "@/components/charts/engine/maplibre/gisMapOverlayStyle";
import { GIS_OVERLAY_SOURCE_ID } from "@/components/charts/engine/maplibre/gisMapStyle";
import { appendGisOverlayLayers, buildPmtilesStyle } from "@/components/charts/engine/maplibre/gisMapStyle";
import {
  GIS_OVERLAY_CIRCLE_LAYER_ID,
  GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID,
  GIS_OVERLAY_CLUSTER_HALO_LAYER_ID,
  GIS_OVERLAY_CLUSTER_LAYER_ID,
  GIS_OVERLAY_GLOW_LAYER_ID,
  GIS_OVERLAY_LABEL_LAYER_ID,
  GIS_OVERLAY_SCATTER_HALO_LAYER_ID,
  GIS_OVERLAY_SOURCE_ID,
} from "@/components/charts/engine/maplibre/gisMapStyle";

const RESOLVED = {
  id: "planet-z15",
  name: "Planet Z15 Global",
  pmtilesUrl: "http://localhost:8080/planet-z15-20260817.pmtiles",
  glyphsUrl: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  spriteUrl: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
};

describe("resolveGisOverlayStyle", () => {
  it("uses chart palette color by default", () => {
    expect(resolveGisOverlayStyle(undefined, ["#abcdef"]).color).toBe("#abcdef");
  });

  it("clamps radius max to min", () => {
    const resolved = resolveGisOverlayStyle({ radiusMin: 10, radiusMax: 2 });
    expect(resolved.radiusMin).toBe(10);
    expect(resolved.radiusMax).toBeGreaterThanOrEqual(10);
  });

  it("respects overlay color override", () => {
    expect(resolveGisOverlayStyle({ color: "#ff0000" }, ["#abcdef"]).color).toBe("#ff0000");
  });
});

describe("buildGisOverlayCircleRadius", () => {
  it("uses zoom-interpolated radius when scaleByMetric is false", () => {
    const resolved = resolveGisOverlayStyle({ scaleByMetric: false, radiusMin: 4, radiusMax: 12 });
    expect(buildGisOverlayCircleRadius(resolved)).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      5.2,
      8,
      8,
      14,
      9.2,
    ]);
  });

  it("interpolates sizeNorm with zoom when scaleByMetric is true", () => {
    const resolved = resolveGisOverlayStyle({ scaleByMetric: true, radiusMin: 4, radiusMax: 14 });
    const radius = buildGisOverlayCircleRadius(resolved);
    expect(radius[0]).toBe("interpolate");
    expect(radius[2]).toEqual(["zoom"]);
  });
});

describe("appendGisOverlayLayers", () => {
  it("adds overlay source and layers with resolved paint", () => {
    const base = buildPmtilesStyle(RESOLVED, "zh-Hans");
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [116.4, 39.9] },
          properties: { value: 10, sizeNorm: 0.5 },
        },
      ],
    };
    const style = appendGisOverlayLayers(base, geojson, {
      flavor: "light",
      overlay: { color: "#112233", opacity: 0.5, colorByCategory: false, scaleByMetric: false },
      chartColors: ["#999999"],
    });
    expect(style.sources?.[GIS_OVERLAY_SOURCE_ID]).toBeDefined();
    expect(style.layers?.some((layer) => layer.id === GIS_OVERLAY_SCATTER_HALO_LAYER_ID)).toBe(true);
    expect(style.layers?.some((layer) => layer.id === GIS_OVERLAY_GLOW_LAYER_ID)).toBe(true);
    const circle = style.layers?.find((layer) => layer.id === GIS_OVERLAY_CIRCLE_LAYER_ID);
    expect(circle?.paint?.["circle-color"]).toBe("#112233");
    expect(circle?.paint?.["circle-opacity"]?.[0]).toBe("interpolate");
    expect(style.layers?.some((layer) => layer.id === GIS_OVERLAY_LABEL_LAYER_ID)).toBe(true);
  });
});

describe("buildGisOverlayStyleKey", () => {
  it("changes when overlay paint changes", () => {
    const a = buildGisOverlayStyleKey({ flavor: "light", overlay: { color: "#111111" } });
    const b = buildGisOverlayStyleKey({ flavor: "light", overlay: { color: "#222222" } });
    expect(a).not.toBe(b);
  });
});

describe("readGisProject overlay", () => {
  it("normalizes overlay fields", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: {
        gisProject: {
          overlay: {
            color: "#123456",
            radiusMin: 3,
            radiusMax: 20,
            opacity: 0.6,
            showLabels: false,
            labelMinZoom: 6,
            scaleByMetric: false,
            strokeWidth: 2,
          },
        },
      },
    });
    expect(project.overlay).toEqual({
      color: "#123456",
      radiusMin: 3,
      radiusMax: 20,
      opacity: 0.6,
      showLabels: false,
      labelMinZoom: 6,
      scaleByMetric: false,
      strokeWidth: 2,
    });
  });
});

describe("buildGisOverlayCirclePaint", () => {
  it("uses resolved stroke and blur on core circles", () => {
    const paint = buildGisOverlayCirclePaint(
      resolveGisOverlayStyle({ strokeColor: "#ff00aa", strokeWidth: 2, circleBlur: 0.35 }),
      undefined,
      "dark",
    );
    expect(paint["circle-stroke-color"]).toBe("#ff00aa");
    expect(paint["circle-stroke-width"]).toBe(2);
    expect(paint["circle-blur"]).toBe(0.35);
  });
});

describe("syncGisOverlayStyle", () => {
  it("updates circle and label paint when layers exist", () => {
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const setLayerZoomRange = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      getLayer: (id: string) =>
        id === GIS_OVERLAY_SCATTER_HALO_LAYER_ID ||
        id === GIS_OVERLAY_GLOW_LAYER_ID ||
        id === GIS_OVERLAY_CLUSTER_HALO_LAYER_ID ||
        id === GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID ||
        id === GIS_OVERLAY_CIRCLE_LAYER_ID ||
        id === GIS_OVERLAY_CLUSTER_LAYER_ID ||
        id === GIS_OVERLAY_LABEL_LAYER_ID
          ? {}
          : null,
      setPaintProperty,
      setLayoutProperty,
      setLayerZoomRange,
      once: vi.fn(),
    };

    syncGisOverlayStyle(map as never, {
      flavor: "light",
      overlay: { color: "#aabbcc", opacity: 0.4 },
      chartColors: ["#111111"],
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      GIS_OVERLAY_CIRCLE_LAYER_ID,
      "circle-color",
      expect.anything(),
    );
    expect(setLayoutProperty).toHaveBeenCalled();
    expect(setLayerZoomRange).toHaveBeenCalled();
  });
});

describe("syncGisOverlayData", () => {
  it("calls setData on overlay source without waiting when style is loaded", () => {
    const setData = vi.fn();
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [116.4, 39.9] },
          properties: { value: 1 },
        },
      ],
    };
    const map = {
      isStyleLoaded: () => true,
      getSource: (id: string) => (id === GIS_OVERLAY_SOURCE_ID ? { setData } : undefined),
      once: vi.fn(),
    };

    syncGisOverlayData(map as never, geojson);
    expect(setData).toHaveBeenCalledWith(geojson);
  });

  it("writes empty collection when geojson is null", () => {
    const setData = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      getSource: () => ({ setData }),
      once: vi.fn(),
    };

    syncGisOverlayData(map as never, null);
    expect(setData).toHaveBeenCalledWith({ type: "FeatureCollection", features: [] });
  });
});
