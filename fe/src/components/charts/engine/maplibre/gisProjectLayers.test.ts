import { describe, expect, it } from "vitest";
import { readGisProject } from "@/components/charts/engine/maplibre/gisProject";
import {
  listGisProjectLayers,
  normalizeGisProjectLayers,
  patchGisProjectLayer,
  resolveActiveGisProjectLayer,
  writeGisProjectLayers,
} from "@/components/charts/engine/maplibre/gisProjectLayers";

describe("gisProjectLayers", () => {
  it("migrates legacy overlay to a single scatter layer", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { overlay: { color: "#ff0000", cluster: true } } },
    });
    const layers = listGisProjectLayers(project);
    expect(layers).toHaveLength(1);
    expect(layers[0].kind).toBe("scatter");
    expect(layers[0].style?.color).toBe("#ff0000");
    expect(layers[0].style?.cluster).not.toBe(false);
  });

  it("prefers explicit layers[] over overlay", () => {
    const layers = normalizeGisProjectLayers([
      { id: "a", name: "热力", kind: "heatmap", visible: true },
    ]);
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { layers, overlay: { color: "#00ff00" } } },
    });
    expect(listGisProjectLayers(project)[0].id).toBe("a");
    expect(listGisProjectLayers(project)[0].kind).toBe("heatmap");
  });

  it("writeGisProjectLayers clears legacy overlay", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { overlay: { color: "#abc" } } },
    });
    const next = writeGisProjectLayers(project, listGisProjectLayers(project));
    expect(next.overlay).toBeUndefined();
    expect(next.layers).toHaveLength(1);
  });

  it("patchGisProjectLayer keeps layer id stable", () => {
    const project = readGisProject({ chartType: "gis-map", nativeBody: { gisProject: {} } });
    const layerId = listGisProjectLayers(project)[0].id;
    const patched = patchGisProjectLayer(project, layerId, { name: "业务散点" });
    expect(patched[0].id).toBe(layerId);
    expect(patched[0].name).toBe("业务散点");
  });

  it("resolveActiveGisProjectLayer prefers activeLayerId", () => {
    const layers = normalizeGisProjectLayers([
      { id: "a", name: "A", kind: "scatter" },
      { id: "b", name: "B", kind: "heatmap" },
    ]);
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { layers, activeLayerId: "b" } },
    });
    expect(resolveActiveGisProjectLayer(project).id).toBe("b");
  });
});
