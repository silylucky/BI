import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chainPixelCanvasWheelScroll,
  findVerticalScrollable,
  isInsideWheelZoomSurface,
  normalizeWheelDeltaY,
  routePixelCanvasWheel,
  shouldDelegateWheelFromCanvasHost,
  VIZ_WHEEL_ZOOM_SURFACE_ATTR,
} from "./pixelCanvasWheelScroll";

function mockScrollable(
  tag: string,
  options: {
    scrollTop?: number;
    scrollHeight?: number;
    clientHeight?: number;
    overflowY?: string;
  } = {},
) {
  const el = document.createElement(tag);
  const state = {
    scrollTop: options.scrollTop ?? 0,
    scrollHeight: options.scrollHeight ?? 400,
    clientHeight: options.clientHeight ?? 200,
    overflowY: options.overflowY ?? "auto",
  };
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => state.scrollTop,
    set: (value: number) => {
      state.scrollTop = value;
    },
  });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => state.scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => state.clientHeight,
  });
  vi.spyOn(window, "getComputedStyle").mockImplementation((node) => {
    if (node === el) {
      return { overflowY: state.overflowY } as CSSStyleDeclaration;
    }
    return { overflowY: "visible" } as CSSStyleDeclaration;
  });
  return { el, state };
}

function mockHost(scrollTop = 0) {
  const host = document.createElement("div");
  let hostScrollTop = scrollTop;
  Object.defineProperty(host, "scrollTop", {
    configurable: true,
    get: () => hostScrollTop,
    set: (value: number) => {
      hostScrollTop = value;
    },
  });
  Object.defineProperty(host, "scrollHeight", { configurable: true, value: 1_200 });
  Object.defineProperty(host, "clientHeight", { configurable: true, value: 500 });
  return { host, getScrollTop: () => hostScrollTop };
}

describe("shouldDelegateWheelFromCanvasHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates when pointer is over a map zoom surface", () => {
    const host = document.createElement("div");
    const mapSurface = document.createElement("div");
    mapSurface.setAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR, "true");
    host.append(mapSurface);
    const event = new WheelEvent("wheel", { deltaY: 80, bubbles: true });
    expect(shouldDelegateWheelFromCanvasHost(host, event, mapSurface)).toBe(true);
  });

  it("delegates when an inner scroller can still move", () => {
    const host = document.createElement("div");
    const { el: inner } = mockScrollable("div", {
      scrollTop: 40,
      scrollHeight: 400,
      clientHeight: 200,
    });
    host.append(inner);
    const event = new WheelEvent("wheel", { deltaY: 60, bubbles: true });
    expect(shouldDelegateWheelFromCanvasHost(host, event, inner)).toBe(true);
  });

  it("does not delegate when inner scroller is at the bottom", () => {
    const host = document.createElement("div");
    const { el: inner } = mockScrollable("div", {
      scrollTop: 200,
      scrollHeight: 400,
      clientHeight: 200,
    });
    host.append(inner);
    const event = new WheelEvent("wheel", { deltaY: 60, bubbles: true });
    expect(shouldDelegateWheelFromCanvasHost(host, event, inner)).toBe(false);
  });
});

describe("routePixelCanvasWheel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls the canvas host when an inner scroller is at the bottom", () => {
    const { host, getScrollTop } = mockHost(120);
    const { el: inner } = mockScrollable("div", {
      scrollTop: 200,
      scrollHeight: 400,
      clientHeight: 200,
    });
    host.append(inner);
    const leaf = document.createElement("span");
    inner.append(leaf);

    const event = new WheelEvent("wheel", { deltaY: 80, bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    expect(routePixelCanvasWheel(host, event, leaf)).toBe(true);
    expect(getScrollTop()).toBe(200);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("scrolls the canvas host when an inner scroller is at the top", () => {
    const { host, getScrollTop } = mockHost(120);
    const { el: inner } = mockScrollable("div", {
      scrollTop: 0,
      scrollHeight: 400,
      clientHeight: 200,
    });
    host.append(inner);
    const leaf = document.createElement("span");
    inner.append(leaf);

    const event = new WheelEvent("wheel", { deltaY: -60, bubbles: true });

    expect(routePixelCanvasWheel(host, event, leaf)).toBe(true);
    expect(getScrollTop()).toBe(60);
  });

  it("does not intercept when the inner scroller can still move", () => {
    const { host } = mockHost(0);
    const { el: inner, state } = mockScrollable("div", {
      scrollTop: 40,
      scrollHeight: 400,
      clientHeight: 200,
    });
    host.append(inner);
    const leaf = document.createElement("span");
    inner.append(leaf);

    const event = new WheelEvent("wheel", { deltaY: 60, bubbles: true });

    expect(routePixelCanvasWheel(host, event, leaf)).toBe(false);
    expect(state.scrollTop).toBe(40);
  });

  it("scrolls the canvas host when the pointer is over a non-scrollable widget subtree", () => {
    const { host, getScrollTop } = mockHost(80);
    const widget = document.createElement("div");
    widget.className = "overflow-hidden";
    const leaf = document.createElement("span");
    widget.append(leaf);
    host.append(widget);

    const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true });

    expect(routePixelCanvasWheel(host, event, leaf)).toBe(true);
    expect(getScrollTop()).toBe(200);
  });

  it("does not intercept wheel when the pointer is over a map zoom surface", () => {
    const { host, getScrollTop } = mockHost(80);
    const mapSurface = document.createElement("div");
    mapSurface.setAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR, "true");
    const canvas = document.createElement("canvas");
    mapSurface.append(canvas);
    host.append(mapSurface);

    const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");

    expect(routePixelCanvasWheel(host, event, canvas)).toBe(false);
    expect(getScrollTop()).toBe(80);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe("isInsideWheelZoomSurface", () => {
  it("detects nested chart canvas inside a wheel-zoom surface", () => {
    const host = document.createElement("div");
    const surface = document.createElement("div");
    surface.setAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR, "true");
    const canvas = document.createElement("canvas");
    surface.append(canvas);
    host.append(surface);
    expect(isInsideWheelZoomSurface(canvas, host)).toBe(true);
    expect(isInsideWheelZoomSurface(host, host)).toBe(false);
  });
});

describe("chainPixelCanvasWheelScroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to routePixelCanvasWheel", () => {
    const { host } = mockHost();
    const event = new WheelEvent("wheel", { deltaY: 40, bubbles: true });
    const widget = document.createElement("div");
    host.append(widget);
    expect(chainPixelCanvasWheelScroll(host, event, widget)).toBe(true);
  });
});

describe("normalizeWheelDeltaY", () => {
  it("scales line-based wheel deltas", () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 500 });
    const event = new WheelEvent("wheel", { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(normalizeWheelDeltaY(event, host)).toBe(48);
  });
});

describe("findVerticalScrollable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ignores overflow hidden containers", () => {
    const host = document.createElement("div");
    const { el: inner } = mockScrollable("div", {
      overflowY: "hidden",
      scrollHeight: 800,
      clientHeight: 200,
    });
    host.append(inner);
    expect(findVerticalScrollable(inner, host)).toBeNull();
  });
});
