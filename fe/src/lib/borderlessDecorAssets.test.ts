import { describe, expect, it } from "vitest";
import { BORDERLESS_DECOR_ASSETS } from "./borderlessDecorAssets";

describe("borderlessDecorAssets", () => {
  it("exposes 100 borderless decor presets", () => {
    expect(BORDERLESS_DECOR_ASSETS.length).toBe(100);
    expect(BORDERLESS_DECOR_ASSETS[0]?.url).toContain("/template-assets/packs/borderless-decor-v1/items/");
  });
});
