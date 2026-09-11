import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("GisMapView overlay style regression", () => {
  it("does not rebuild basemap style when only overlay paint changes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/GisMapView.tsx"),
      "utf8",
    );

    expect(source).toContain("buildGisLayersStructuralKey");
    expect(source).toContain("layersStructuralKey");
    expect(source).not.toContain("layersStyleKey,\n      }),");
    expect(source).toMatch(/useLayoutEffect[\s\S]*layersStyleKey/);
  });

  it("remounts geolibre effects on atmosphere changes, not overlay paint", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/GisMapView.tsx"),
      "utf8",
    );

    expect(source).toMatch(/createGisGeolibreEffectsEngine[\s\S]*atmosphereKey|ensureGisEffectsEngine[\s\S]*atmosphereKey/);
    expect(source).not.toMatch(
      /ensureGisEffectsEngine[\s\S]*\], \[effectsSettings\.enabled[\s\S]*styleKey\]/,
    );
  });
});
