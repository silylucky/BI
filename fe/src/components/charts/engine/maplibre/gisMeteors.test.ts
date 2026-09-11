import { describe, expect, it } from "vitest";
import { spawnMeteor } from "@/components/charts/engine/maplibre/gisMeteors";
import { resolveGlobeScreenBoundsFallback } from "@/components/charts/engine/maplibre/gisGlobeLayout";

describe("gisMeteors", () => {
  it("spawns meteor outside globe disc", () => {
    const globe = resolveGlobeScreenBoundsFallback(400, 300);
    let step = 0;
    const meteor = spawnMeteor({ width: 400, height: 300, globe, intensity: 1 }, () => {
      step += 1;
      return step % 2 === 1 ? 0.05 : 0.95;
    });
    expect(meteor).not.toBeNull();
    expect(meteor?.vx).not.toBe(0);
  });
});
