import { describe, expect, it } from "vitest";
import {
  buildGisLayersStructuralKey,
  buildGisLayersStyleKey,
  gisLayerClusterGlowId,
  gisLayerClusterHaloId,
  gisLayerHeatmapDetailGlowId,
  gisLayerHeatmapGlowId,
  gisLayerHeatmapHaloId,
  gisLayerHeatmapId,
  gisLayerScatterGlowId,
  gisLayerScatterHaloId,
  gisLayerSourceId,
  type GisLayerRuntimeEntry,
} from "@/components/charts/engine/maplibre/gisMapLayerStyle";

const scatterEntry = (overlay: Record<string, unknown> = {}): GisLayerRuntimeEntry => ({
  layer: { id: "scatter-1", kind: "scatter", style: overlay },
  geoJson: { type: "FeatureCollection", features: [] },
  options: { flavor: "light", overlay, chartColors: ["#3370ff"] },
});

describe("gisMapLayerStyle ids", () => {
  it("builds stable source and heatmap layer ids", () => {
    expect(gisLayerSourceId("layer-a")).toBe("vs-gis-layer-layer-a");
    expect(gisLayerHeatmapId("layer-a")).toBe("vs-gis-layer-layer-a-heat");
    expect(gisLayerHeatmapHaloId("layer-a")).toBe("vs-gis-layer-layer-a-heat-halo");
    expect(gisLayerHeatmapGlowId("layer-a")).toBe("vs-gis-layer-layer-a-heat-glow");
    expect(gisLayerHeatmapDetailGlowId("layer-a")).toBe("vs-gis-layer-layer-a-heat-detail-glow");
    expect(gisLayerScatterHaloId("layer-a")).toBe("vs-gis-layer-layer-a-scatter-halo");
    expect(gisLayerScatterGlowId("layer-a")).toBe("vs-gis-layer-layer-a-glow");
    expect(gisLayerClusterGlowId("layer-a")).toBe("vs-gis-layer-layer-a-cluster-glow");
    expect(gisLayerClusterHaloId("layer-a")).toBe("vs-gis-layer-layer-a-cluster-halo");
  });
});

describe("buildGisLayersStructuralKey", () => {
  it("ignores paint-only overlay changes", () => {
    const a = buildGisLayersStructuralKey([scatterEntry({ color: "#111111", opacity: 0.5 })]);
    const b = buildGisLayersStructuralKey([scatterEntry({ color: "#222222", opacity: 0.9, radiusMax: 24 })]);
    expect(a).toBe(b);
  });

  it("changes when cluster topology toggles", () => {
    const off = buildGisLayersStructuralKey([scatterEntry({ cluster: false })]);
    const on = buildGisLayersStructuralKey([scatterEntry({ cluster: true, clusterRadius: 64 })]);
    expect(off).not.toBe(on);
  });

  it("style key still tracks paint changes for runtime sync", () => {
    const a = buildGisLayersStyleKey([scatterEntry({ color: "#111111" })]);
    const b = buildGisLayersStyleKey([scatterEntry({ color: "#222222" })]);
    expect(a).not.toBe(b);
  });
});
