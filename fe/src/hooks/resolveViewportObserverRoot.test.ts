import { describe, expect, it } from "vitest";
import { resolveViewportObserverRoot } from "./resolveViewportObserverRoot";

describe("resolveViewportObserverRoot", () => {
  it("uses closest named viewport when present", () => {
    const viewport = document.createElement("div");
    viewport.setAttribute("data-canvas-scale-viewport", "");
    const child = document.createElement("div");
    viewport.appendChild(child);
    document.body.appendChild(viewport);
    expect(resolveViewportObserverRoot(child, "[data-canvas-scale-viewport]")).toBe(viewport);
    viewport.remove();
  });

  it("falls back to pixel-canvas-host when scale viewport is missing", () => {
    const host = document.createElement("div");
    host.className = "pixel-canvas-host";
    host.dataset.testid = "pixel-canvas-host";
    const child = document.createElement("div");
    host.appendChild(child);
    document.body.appendChild(host);
    expect(resolveViewportObserverRoot(child, "[data-canvas-scale-viewport]")).toBe(host);
    host.remove();
  });
});
