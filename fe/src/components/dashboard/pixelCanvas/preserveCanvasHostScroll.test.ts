import { afterEach, describe, expect, it } from "vitest";
import {
  consumePendingCanvasHostScrollRestore,
  preservePixelCanvasHostScroll,
} from "./preserveCanvasHostScroll";

function mockCanvasHost(initialTop = 0, initialLeft = 0) {
  let scrollTop = initialTop;
  let scrollLeft = initialLeft;
  const host = document.createElement("div");
  host.dataset.testid = "pixel-canvas-host";
  Object.defineProperty(host, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(host, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  document.body.appendChild(host);
  return {
    host,
    setScrollTop: (value: number) => {
      scrollTop = value;
    },
    getScrollTop: () => scrollTop,
    getScrollLeft: () => scrollLeft,
  };
}

afterEach(() => {
  document.querySelectorAll('[data-testid="pixel-canvas-host"]').forEach((node) => node.remove());
});

describe("preservePixelCanvasHostScroll", () => {
  it("restores scrollTop when callback resets host scroll", async () => {
    const { host, setScrollTop, getScrollTop } = mockCanvasHost(240);
    preservePixelCanvasHostScroll(() => {
      setScrollTop(0);
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(getScrollTop()).toBe(240);
    consumePendingCanvasHostScrollRestore(host);
    expect(getScrollTop()).toBe(240);
  });

  it("skips restore when host was already at top", () => {
    const { getScrollTop } = mockCanvasHost(0);
    preservePixelCanvasHostScroll(() => {});
    expect(getScrollTop()).toBe(0);
  });
});
