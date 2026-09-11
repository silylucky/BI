import { afterEach, describe, expect, it, vi } from "vitest";
import { probeWebGL, webglAvailable } from "@/components/charts/engine/three/webglProbe";

describe("probeWebGL", () => {
  const originalCreateElement = document.createElement.bind(document);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when webgl2 context is available", () => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "canvas") {
        vi.spyOn(el, "getContext").mockImplementation((type: string) => {
          if (type === "webgl2") return {} as WebGL2RenderingContext;
          return null;
        });
      }
      return el;
    });

    expect(probeWebGL()).toEqual({ ok: true, api: "webgl2" });
    expect(webglAvailable()).toBe(true);
  });

  it("falls back to webgl when webgl2 is unavailable", () => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "canvas") {
        vi.spyOn(el, "getContext").mockImplementation((type: string) => {
          if (type === "webgl2") return null;
          if (type === "webgl" || type === "experimental-webgl") return {} as WebGLRenderingContext;
          return null;
        });
      }
      return el;
    });

    expect(probeWebGL()).toEqual({ ok: true, api: "webgl" });
  });

  it("returns context-null when no WebGL context can be created", () => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "canvas") {
        vi.spyOn(el, "getContext").mockReturnValue(null);
      }
      return el;
    });

    expect(probeWebGL()).toEqual({ ok: false, reason: "context-null" });
    expect(webglAvailable()).toBe(false);
  });
});
