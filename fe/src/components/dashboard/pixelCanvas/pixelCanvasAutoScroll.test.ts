import { describe, expect, it } from "vitest";
import { autoScrollPixelCanvasHost } from "./pixelCanvasAutoScroll";

function mockHost(options: {
  top?: number;
  bottom?: number;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
}) {
  const state = {
    scrollTop: options.scrollTop ?? 0,
    scrollHeight: options.scrollHeight ?? 2_000,
    clientHeight: options.clientHeight ?? 600,
    top: options.top ?? 100,
    bottom: options.bottom ?? 700,
  };
  return {
    get scrollTop() {
      return state.scrollTop;
    },
    set scrollTop(value: number) {
      state.scrollTop = value;
    },
    get scrollHeight() {
      return state.scrollHeight;
    },
    get clientHeight() {
      return state.clientHeight;
    },
    getBoundingClientRect: () => ({
      top: state.top,
      bottom: state.bottom,
      left: 0,
      right: 800,
      width: 800,
      height: state.bottom - state.top,
      x: 0,
      y: state.top,
      toJSON: () => ({}),
    }),
  };
}

describe("autoScrollPixelCanvasHost", () => {
  it("scrolls down when the pointer is near the bottom edge", () => {
    const host = mockHost({ scrollTop: 100 });
    const delta = autoScrollPixelCanvasHost(host, 660);
    expect(delta).toBe(20);
    expect(host.scrollTop).toBe(120);
  });

  it("scrolls up when the pointer is near the top edge", () => {
    const host = mockHost({ scrollTop: 100 });
    const delta = autoScrollPixelCanvasHost(host, 120);
    expect(delta).toBe(-20);
    expect(host.scrollTop).toBe(80);
  });

  it("does not scroll when the pointer is in the safe zone", () => {
    const host = mockHost({ scrollTop: 100 });
    expect(autoScrollPixelCanvasHost(host, 400)).toBe(0);
    expect(host.scrollTop).toBe(100);
  });

  it("clamps at scroll bounds", () => {
    const host = mockHost({ scrollTop: 0 });
    expect(autoScrollPixelCanvasHost(host, 120)).toBe(0);

    const maxed = mockHost({ scrollTop: 1_400, scrollHeight: 2_000, clientHeight: 600 });
    expect(autoScrollPixelCanvasHost(maxed, 660)).toBe(0);
  });
});
