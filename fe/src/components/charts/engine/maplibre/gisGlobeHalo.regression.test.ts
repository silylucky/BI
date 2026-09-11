import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("gisGlobeHalo atmosphere sync regression", () => {
  it("does not paint halo from viewport fallback when map transform is not ready", () => {
    const haloSource = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/gisGlobeHalo.ts"),
      "utf8",
    );
    const layoutSource = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/gisGlobeLayout.ts"),
      "utf8",
    );

    expect(haloSource).not.toContain("resolveGlobeScreenBoundsFallback");
    expect(haloSource).toContain("resolveGlobeLimbBoundsForHaloPaint");
    expect(haloSource).toContain("schedulePaint");
    expect(haloSource).toContain("requestPaint: schedulePaint");
    expect(haloSource).toContain("bindMapHaloPaintSync");
    expect(haloSource).not.toMatch(/bootLoop\s*\(/);
    expect(haloSource).toContain("lastResolvedLimb");
    expect(haloSource).toContain("requestPaint: schedulePaint");
    expect(haloSource).toContain('const HALO_CANVAS_Z = "3"');
    expect(haloSource).toContain("ensureGisMapControlStack");
    expect(haloSource).toContain("insertBefore(canvas, mapCanvas)");
    expect(haloSource).toContain("readMapOverlayPaintSize");
    expect(haloSource).toContain("applyOverlayCanvasLayout");
    expect(haloSource).not.toContain("h-full w-full");
    expect(haloSource).toContain("resolveGlobeLimbBoundsForHaloPaint");
    expect(haloSource).toContain("if (!effects.enabled)");
    expect(haloSource).not.toMatch(/const ctx = getContext\(\)/);
    expect(haloSource).toContain("drawGlobeAtmosphereHalo(ctx");
    expect(layoutSource).toContain("禁止 viewport fallback");
    expect(layoutSource).toContain('"style.load"');
  });
});
