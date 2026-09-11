import { describe, expect, it, afterEach } from "vitest";
import {
  GEO3D_ORBIT_STATE_VERSION,
  readGeo3dOrbitState,
  resetGeo3dOrbitStateForTests,
  seedGeo3dOrbitStateForTests,
  writeGeo3dOrbitState,
} from "@/components/charts/engine/three/geo3dOrbitState";

afterEach(() => {
  resetGeo3dOrbitStateForTests();
});

describe("geo3dOrbitState", () => {
  it("persists orbit snapshot per widget instance", () => {
    writeGeo3dOrbitState("w-1", {
      v: GEO3D_ORBIT_STATE_VERSION,
      target: { x: 1, y: 0, z: 2 },
      position: { x: 3, y: 4, z: 5 },
    });
    expect(readGeo3dOrbitState("w-1")).toEqual({
      v: GEO3D_ORBIT_STATE_VERSION,
      target: { x: 1, y: 0, z: 2 },
      position: { x: 3, y: 4, z: 5 },
    });
    expect(readGeo3dOrbitState("w-2")).toBeNull();
  });

  it("ignores snapshots from older orbit state versions", () => {
    seedGeo3dOrbitStateForTests("w-old", {
      v: 1,
      target: { x: 0, y: 0, z: 0 },
      position: { x: 1, y: 2, z: 3 },
    });
    expect(readGeo3dOrbitState("w-old")).toBeNull();
  });
});
