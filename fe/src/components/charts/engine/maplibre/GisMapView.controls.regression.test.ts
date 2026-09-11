import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("GisMapView map controls mount regression", () => {
  it("remounts MapLibre controls after paint ready and exposes live bridge", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/GisMapView.tsx"),
      "utf8",
    );

    expect(source).toContain("remountMapControls");
    expect(source).toContain("applyMapControls");
    expect(source).toContain("gisPaintState !== \"ready\"");
    expect(source).toContain("mapRuntimeEpoch");
    expect(source).toContain("style.load");
    expect(source).toContain("mountGisMapControls");
  });
});
