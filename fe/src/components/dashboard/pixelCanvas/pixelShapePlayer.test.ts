import { describe, expect, it } from "vitest";
import { isResizeInteraction } from "./pixelShapePlayer";

describe("pixelShapePlayer", () => {
  it("matches DataEase isPlayer resize kinds", () => {
    expect(isResizeInteraction("move")).toBe(false);
    expect(isResizeInteraction("se")).toBe(true);
    expect(isResizeInteraction("w")).toBe(true);
  });
});
