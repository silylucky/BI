import { describe, expect, it } from "vitest";
import {
  advanceGeoMapDoubleTap,
  GEO_MAP_DOUBLE_TAP_MS,
  isPointerTapMove,
} from "@/components/charts/engine/three/geoMapDoubleTap";

describe("geoMapDoubleTap", () => {
  it("treats two taps on the same key within the window as double tap", () => {
    const first = advanceGeoMapDoubleTap(null, 100, "广东省");
    expect(first.isDouble).toBe(false);

    const second = advanceGeoMapDoubleTap(first.next, 100 + GEO_MAP_DOUBLE_TAP_MS - 1, "广东省");
    expect(second.isDouble).toBe(true);
    expect(second.next).toBeNull();
  });

  it("rejects taps on different keys", () => {
    const first = advanceGeoMapDoubleTap(null, 100, "广东省");
    const second = advanceGeoMapDoubleTap(first.next, 150, "浙江省");
    expect(second.isDouble).toBe(false);
    expect(second.next?.key).toBe("浙江省");
  });

  it("rejects taps outside the time window", () => {
    const first = advanceGeoMapDoubleTap(null, 100, "广东省");
    const second = advanceGeoMapDoubleTap(first.next, 100 + GEO_MAP_DOUBLE_TAP_MS + 1, "广东省");
    expect(second.isDouble).toBe(false);
  });

  it("detects pointer movement within tolerance as tap", () => {
    expect(isPointerTapMove(10, 10, 12, 11)).toBe(true);
    expect(isPointerTapMove(10, 10, 20, 20)).toBe(false);
  });
});
