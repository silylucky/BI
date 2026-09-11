import { describe, expect, it, vi } from "vitest";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";
import {
  GEO_MAP_QUALITY_FALLBACK_BANNER,
  GEO_MAP_THREE_INIT_FALLBACK_BANNER,
  GEO_MAP_WEBGL_FALLBACK_BANNER,
  GEO_MAP_WEBGL_CAP_FALLBACK_BANNER,
  resolveGeoMapFallbackBanner,
} from "@/components/charts/engine/geo/geoMapRenderResult";
import { renderThreeChoroplethChart } from "@/components/charts/engine/three/renderThreeChoropleth";
import * as webglProbe from "@/components/charts/engine/three/webglProbe";

describe("renderThreeChoroplethChart", () => {
  it("shows error instead of 2D when WebGL probe fails", async () => {
    vi.spyOn(webglProbe, "probeWebGL").mockReturnValue({ ok: false, reason: "context-null" });

    const container = document.createElement("div");
    document.body.appendChild(container);

    const result = await renderThreeChoroplethChart(container, {
      width: 800,
      height: 600,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showTooltip: false,
      rows: [
        ["广东省", 320],
        ["浙江省", 280],
      ],
      columns: ["province", "value"],
      regionField: "province",
      metricField: "value",
      mapId: VS_REGIONS_MAP_ID,
      isDark: false,
      geoStyle: {},
    });

    expect(result.engine).toBe("three");
    expect(result.fallbackReason).toBe("webgl-unavailable");
    expect(container.dataset.webglApi).toBe("none");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("WebGL");
    result.dispose();
    container.remove();
    vi.restoreAllMocks();
  });

  it("does not downgrade to 2D when auto quality resolves to low", async () => {
    vi.spyOn(webglProbe, "probeWebGL").mockReturnValue({ ok: false, reason: "context-null" });

    const container = document.createElement("div");
    document.body.appendChild(container);

    const result = await renderThreeChoroplethChart(container, {
      width: 400,
      height: 300,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showTooltip: false,
      rows: [
        ["广东省", 320],
        ["浙江省", 280],
      ],
      columns: ["province", "value"],
      regionField: "province",
      metricField: "value",
      mapId: VS_REGIONS_MAP_ID,
      drillDepth: 2,
      isDark: false,
      geoStyle: {},
      geo3dStyle: { quality: "auto" },
    });

    expect(result.engine).toBe("three");
    expect(result.fallbackReason).toBe("webgl-unavailable");
    expect(container.querySelector("svg")).toBeNull();
    result.dispose();
    container.remove();
    vi.restoreAllMocks();
  });
});

describe("resolveGeoMapFallbackBanner", () => {
  it("returns WebGL-specific copy", () => {
    expect(resolveGeoMapFallbackBanner("webgl-unavailable")).toBe(GEO_MAP_WEBGL_FALLBACK_BANNER);
    expect(GEO_MAP_WEBGL_FALLBACK_BANNER).toContain("硬件加速");
    expect(GEO_MAP_WEBGL_FALLBACK_BANNER).not.toContain("2D");
  });

  it("returns three-init copy", () => {
    expect(resolveGeoMapFallbackBanner("three-init-failed")).toBe(GEO_MAP_THREE_INIT_FALLBACK_BANNER);
    expect(GEO_MAP_THREE_INIT_FALLBACK_BANNER).not.toContain("2D");
  });

  it("returns quality copy without 2D fallback wording", () => {
    expect(resolveGeoMapFallbackBanner("quality-degraded")).toBe(GEO_MAP_QUALITY_FALLBACK_BANNER);
    expect(GEO_MAP_QUALITY_FALLBACK_BANNER).not.toContain("2D");
  });

  it("returns webgl cap copy without 2D fallback wording", () => {
    expect(resolveGeoMapFallbackBanner("webgl-cap-exceeded")).toBe(GEO_MAP_WEBGL_CAP_FALLBACK_BANNER);
    expect(GEO_MAP_WEBGL_CAP_FALLBACK_BANNER).not.toContain("2D");
  });
});
