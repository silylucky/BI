import { describe, expect, it } from "vitest";
import {
  ensureGisMapControlStack,
  GIS_MAP_CANVAS_CONTAINER_Z,
  GIS_MAP_CANVAS_Z,
  GIS_MAP_CONTROL_Z,
} from "@/components/charts/engine/maplibre/gisMapControlStack";

function buildMapFixture() {
  const mapRoot = document.createElement("div");
  mapRoot.className = "maplibregl-map";
  const canvasContainer = document.createElement("div");
  canvasContainer.className = "maplibregl-canvas-container";
  const mapCanvas = document.createElement("canvas");
  mapCanvas.className = "maplibregl-canvas";
  const bottomLeft = document.createElement("div");
  bottomLeft.className = "maplibregl-ctrl-bottom-left";
  const scale = document.createElement("div");
  scale.className = "maplibregl-ctrl maplibregl-ctrl-scale";
  bottomLeft.append(scale);
  canvasContainer.append(mapCanvas);
  mapRoot.append(canvasContainer, bottomLeft);

  const map = {
    getCanvas: () => mapCanvas,
    getCanvasContainer: () => canvasContainer,
  } as import("maplibre-gl").Map;

  return { map, mapRoot, mapCanvas, canvasContainer, bottomLeft };
}

describe("ensureGisMapControlStack", () => {
  it("raises maplibre corner controls above overlay canvases", () => {
    const { map, mapRoot, mapCanvas, canvasContainer, bottomLeft } = buildMapFixture();

    ensureGisMapControlStack(map);

    expect(mapCanvas.style.zIndex).toBe(GIS_MAP_CANVAS_Z);
    expect(canvasContainer.style.zIndex).toBe(GIS_MAP_CANVAS_CONTAINER_Z);
    expect(bottomLeft.style.zIndex).toBe(GIS_MAP_CONTROL_Z);
    expect(mapRoot.classList.contains("vs-gis-map-control-stack")).toBe(true);
    expect(document.getElementById("vs-gis-map-control-stack-style")).not.toBeNull();
  });
});
