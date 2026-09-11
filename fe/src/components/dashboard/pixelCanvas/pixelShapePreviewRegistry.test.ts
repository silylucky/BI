import { describe, expect, it, vi } from "vitest";
import { createPixelShapePreviewRegistry } from "./pixelShapePreviewRegistry";

describe("createPixelShapePreviewRegistry", () => {
  it("applies preview rects to registered shapes", () => {
    const registry = createPixelShapePreviewRegistry();
    const sync = vi.fn();
    registry.register("w1", sync);
    registry.applyAll(
      new Map([["w1", { x: 10, y: 20, width: 300, height: 200 }]]),
    );
    expect(sync).toHaveBeenCalledWith({ x: 10, y: 20, width: 300, height: 200 });
  });

  it("skips active widget during drag preview to avoid stale rect stomp", () => {
    const registry = createPixelShapePreviewRegistry();
    const active = vi.fn();
    const neighbor = vi.fn();
    registry.register("active", active);
    registry.register("neighbor", neighbor);
    registry.applyAll(
      new Map([
        ["active", { x: 0, y: 0, width: 100, height: 80 }],
        ["neighbor", { x: 0, y: 120, width: 200, height: 100 }],
      ]),
      { skipWidgetIds: "active" },
    );
    expect(active).not.toHaveBeenCalled();
    expect(neighbor).toHaveBeenCalledWith({ x: 0, y: 120, width: 200, height: 100 });
  });

  it("skips active widget on reset after commit", () => {
    const registry = createPixelShapePreviewRegistry();
    const active = vi.fn();
    const neighbor = vi.fn();
    registry.register("active", active);
    registry.register("neighbor", neighbor);
    registry.reset(
      [
        { id: "active", x: 0, y: 0, width: 50, height: 40 },
        { id: "neighbor", x: 0, y: 120, width: 200, height: 100 },
      ],
      { skipWidgetIds: "active" },
    );
    expect(active).not.toHaveBeenCalled();
    expect(neighbor).toHaveBeenCalledWith({ x: 0, y: 120, width: 200, height: 100 });
  });
});
