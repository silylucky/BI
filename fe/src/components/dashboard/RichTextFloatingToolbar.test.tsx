import { describe, expect, it, vi, afterEach } from "vitest";
import {
  measureFloatingToolbarPosition,
  resolveToolbarClampRect,
} from "./RichTextFloatingToolbar";
import { resolveRichTextToolbarTheme } from "./richTextToolbarTheme";

describe("measureFloatingToolbarPosition", () => {
  const anchor = { top: 200, left: 100, right: 400, bottom: 280, width: 300, height: 80 } as DOMRect;
  const toolbarWidth = 400;
  const toolbarHeight = 36;
  const canvasBounds = { left: 80, right: 900, top: 120, bottom: 900 };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("places toolbar above anchor and aligns to anchor left", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);

    const { left, top } = measureFloatingToolbarPosition(
      anchor,
      toolbarWidth,
      toolbarHeight,
      canvasBounds,
    );
    expect(left).toBe(100);
    expect(top).toBe(anchor.top - 10 - toolbarHeight);
  });

  it("falls back below anchor when there is no room above", () => {
    const looseCanvas = { left: 80, right: 900, top: 0, bottom: 900 };
    const tightTop = { ...anchor, top: 20, bottom: 100 } as DOMRect;
    const { top } = measureFloatingToolbarPosition(
      tightTop,
      toolbarWidth,
      toolbarHeight,
      looseCanvas,
    );
    expect(top).toBe(tightTop.bottom + 10);
  });

  it("shifts left when toolbar would overflow canvas right edge", () => {
    const nearRight = { top: 200, left: 500, right: 890, bottom: 280, width: 390, height: 80 } as DOMRect;
    const { left } = measureFloatingToolbarPosition(
      nearRight,
      toolbarWidth,
      toolbarHeight,
      canvasBounds,
    );
    expect(left).toBe(canvasBounds.right - toolbarWidth - 12);
  });
});

describe("resolveToolbarClampRect", () => {
  it("uses dashboard canvas surface bounds when anchor is inside canvas", () => {
    const canvas = document.createElement("div");
    canvas.className = "dashboard-canvas-surface";
    canvas.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 800,
        top: 50,
        bottom: 700,
        width: 700,
        height: 650,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect;

    const anchor = document.createElement("div");
    canvas.appendChild(anchor);
    document.body.appendChild(canvas);

    expect(resolveToolbarClampRect(anchor)).toEqual({
      left: 100,
      right: 800,
      top: 50,
      bottom: 700,
    });

    canvas.remove();
  });
});

describe("resolveRichTextToolbarTheme", () => {
  it("inherits dashboard theme scope dark class and css vars", () => {
    const scope = document.createElement("div");
    scope.className = "dashboard-theme-scope dark";
    scope.setAttribute("data-dashboard-color-scheme", "dark");
    scope.style.setProperty("--dashboard-dialog-bg", "#1d2939");
    scope.style.setProperty("--dashboard-text-primary", "#ececed");

    const anchor = document.createElement("div");
    scope.appendChild(anchor);
    document.body.appendChild(scope);

    const theme = resolveRichTextToolbarTheme(anchor);
    expect(theme.className).toContain("dark");
    expect(theme.style.colorScheme).toBe("dark");
    expect(theme.style["--dashboard-dialog-bg" as keyof typeof theme.style]).toBe("#1d2939");

    scope.remove();
  });
});
