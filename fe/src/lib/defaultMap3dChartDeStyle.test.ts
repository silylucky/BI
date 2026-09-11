import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { readChartDeStyle } from "@/lib/chartDeStyle";
import { DEFAULT_MAP_3D_CHART_DE_STYLE } from "@/lib/defaultMap3dChartDeStyle";
import { geo3dPresetDefaults } from "@/components/charts/engine/three/geo3dVisualStyle";

describe("defaultMap3dChartDeStyle", () => {
  it("seeds new map-3d widgets with tuned geo/geo3d defaults", () => {
    const cfg = defaultChartConfig("map-3d");
    const deStyle = readChartDeStyle(cfg);
    expect(deStyle.geo).toEqual(DEFAULT_MAP_3D_CHART_DE_STYLE.geo);
    expect(deStyle.geo3d).toEqual(DEFAULT_MAP_3D_CHART_DE_STYLE.geo3d);
  });

  it("matches satellite preset defaults helper", () => {
    expect(geo3dPresetDefaults("satellite")).toEqual(DEFAULT_MAP_3D_CHART_DE_STYLE.geo3d);
  });

  it("classic preset includes shared effects defaults", () => {
    const defaults = geo3dPresetDefaults("classic");
    expect(defaults.sceneFog).toBe(true);
    expect(defaults.heatBlobRadius).toBe(15);
  });
});
