import { describe, expect, it } from "vitest";

describe("D3GeoMapView module import", () => {
  it(
    "loads without circular-import TDZ",
    async () => {
      const mod = await import("@/components/charts/engine/d3/views/D3GeoMapView");
      expect(mod.D3GeoMapView).toBeDefined();
    },
    30_000,
  );
});
