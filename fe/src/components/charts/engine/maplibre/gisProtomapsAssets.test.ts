import { describe, expect, it } from "vitest";
import { colocatedSpriteBase } from "@/components/charts/engine/maplibre/gisProtomapsAssets";

describe("gisProtomapsAssets", () => {
  it("derives sprite base from the tile service origin", () => {
    expect(
      colocatedSpriteBase(
        "http://127.0.0.1:8080/planet.pmtiles",
        "http://127.0.0.1:8080/basemaps-assets/sprites/v4/light",
      ),
    ).toBe("http://127.0.0.1:8080/basemaps-assets/sprites/v4");
  });
});
