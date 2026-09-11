import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScreenBorderSparkle } from "@/lib/screenBorderSparkle";
import { ScreenBorderDisplay } from "./ScreenBorderDisplay";

const sparkle = createScreenBorderSparkle({ id: "sparkle-test-1" });

function mockBoundingRect(width: number, height: number) {
  return {
    width,
    height,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
  } as DOMRect;
}

describe("ScreenBorderDisplay", () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue(mockBoundingRect(320, 240));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(() => {
    cleanup();
    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("isolates sparkle SVG defs across canvas and inspector thumbnail", () => {
    const styleConfig = {
      variant: "border-1" as const,
      sparkle: { enabled: true, sparkles: [sparkle] },
    };

    const { container: canvas } = render(<ScreenBorderDisplay styleConfig={styleConfig} />);
    const { container: thumb } = render(
      <ScreenBorderDisplay styleConfig={styleConfig} showSparkle={false} />,
    );

    const canvasMaskIds = [
      ...canvas.querySelectorAll("mask[id]"),
    ].map((node) => node.getAttribute("id"));
    const thumbMaskIds = [
      ...thumb.querySelectorAll("mask[id]"),
    ].map((node) => node.getAttribute("id"));

    expect(canvasMaskIds).toHaveLength(1);
    expect(thumbMaskIds).toHaveLength(0);

    const { container: canvas2 } = render(
      <ScreenBorderDisplay styleConfig={styleConfig} />,
    );
    const allMaskIds = [
      ...canvas.querySelectorAll("mask[id]"),
      ...canvas2.querySelectorAll("mask[id]"),
    ].map((node) => node.getAttribute("id"));

    expect(new Set(allMaskIds).size).toBe(2);
  });

  it("does not mount flow svg before layout size is ready", () => {
    rectSpy.mockReturnValue(mockBoundingRect(0, 0));

    const styleConfig = {
      variant: "border-1" as const,
      sparkle: { enabled: true, sparkles: [sparkle] },
    };

    const { container } = render(
      <div style={{ width: 0, height: 0 }}>
        <ScreenBorderDisplay styleConfig={styleConfig} />
      </div>,
    );

    expect(container.querySelector("[data-screen-border-flow] svg")).toBeNull();
    expect(container.querySelector("animateMotion")).toBeNull();
  });

  it("keeps mask spot small relative to widget bounds", () => {
    const styleConfig = {
      variant: "border-1" as const,
      sparkle: { enabled: true, sparkles: [sparkle] },
    };

    const { container } = render(
      <div style={{ width: 320, height: 240 }}>
        <ScreenBorderDisplay styleConfig={styleConfig} />
      </div>,
    );

    const radius = Number(container.querySelector("mask circle")?.getAttribute("r"));
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThanOrEqual(34);
    expect(container.querySelector("animateMotion")).not.toBeNull();
  });
});
