import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyCapHoverVisual,
  applyCapVisual,
  snapshotCapVisual,
} from "./capVisualSnapshot";

describe("capVisualSnapshot", () => {
  it("restores MeshStandardMaterial emissive after hover", () => {
    const cap = new THREE.MeshStandardMaterial({
      color: "#c2410c",
      emissive: "#1a6aaa",
      emissiveIntensity: 0.35,
    });
    const resting = snapshotCapVisual(cap);
    const hoverTint = new THREE.Color("#f8fafc");

    applyCapHoverVisual(cap, resting, hoverTint, true);
    expect(cap.color.getHexString()).toBe(hoverTint.getHexString());
    expect(cap.emissive.getHexString()).toBe("1a6aaa");

    applyCapVisual(cap, resting);
    expect(cap.color.getHexString()).toBe("c2410c");
    expect(cap.emissive.getHexString()).toBe("1a6aaa");
    expect(cap.emissiveIntensity).toBeCloseTo(0.35);
  });

  it("restores MeshBasicMaterial color after hover", () => {
    const cap = new THREE.MeshBasicMaterial({ color: "#ea580c" });
    const resting = snapshotCapVisual(cap);
    const hoverTint = new THREE.Color("#ffffff");

    applyCapHoverVisual(cap, resting, hoverTint, false);
    applyCapVisual(cap, resting);
    expect(cap.color.getHexString()).toBe("ea580c");
  });
});
