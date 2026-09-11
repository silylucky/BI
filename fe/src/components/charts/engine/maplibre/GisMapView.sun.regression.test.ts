import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("GisMapView sun mount regression", () => {
  it("defers sun engine mount until style is ready like overlay layers", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/GisMapView.tsx"),
      "utf8",
    );

    expect(source).toContain("ensureSunEngine");
    expect(source).toContain("whenGisMapStyleReady(map, mountSun)");
    expect(source).toContain('map.on("style.load", resyncSun)');
    expect(source).toContain("gisPaintState !== \"ready\"");
    expect(source).toContain("syncLayersRuntime(map)");
    expect(source).toContain("map.once(\"idle\", () => {");
  });
});
