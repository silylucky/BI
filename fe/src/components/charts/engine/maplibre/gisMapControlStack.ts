type MapLibreMap = import("maplibre-gl").Map;

export const GIS_MAP_CANVAS_Z = "4";
/** 星场/流星叠在 WebGL 地图之上（球盘区裁剪），控件仍在其上。 */
export const GIS_MAP_STARS_Z = "5";
export const GIS_MAP_COMETS_Z = "6";
export const GIS_MAP_CANVAS_CONTAINER_Z = "1";
export const GIS_MAP_CONTROL_Z = "10";

const GIS_MAP_CONTROL_STACK_CLASS = "vs-gis-map-control-stack";
const GIS_MAP_CONTROL_STACK_STYLE_ID = "vs-gis-map-control-stack-style";

const GIS_MAP_CONTROL_CORNER_SELECTORS = [
  ".maplibregl-ctrl-top-right",
  ".maplibregl-ctrl-bottom-left",
  ".maplibregl-ctrl-bottom-right",
  ".maplibregl-ctrl-top-left",
] as const;

function ensureGisMapControlStackStyle(): void {
  if (document.getElementById(GIS_MAP_CONTROL_STACK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GIS_MAP_CONTROL_STACK_STYLE_ID;
  style.textContent = `
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-canvas-container {
      z-index: ${GIS_MAP_CANVAS_CONTAINER_Z};
    }
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-ctrl-top-right,
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-ctrl-bottom-left,
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-ctrl-bottom-right,
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-ctrl-top-left {
      z-index: ${GIS_MAP_CONTROL_Z} !important;
      pointer-events: none;
    }
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-ctrl {
      pointer-events: auto;
    }
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-boxzoom {
      z-index: ${GIS_MAP_CONTROL_Z};
    }
    .${GIS_MAP_CONTROL_STACK_CLASS} .maplibregl-marker {
      z-index: ${GIS_MAP_CONTROL_Z};
    }
  `;
  document.head.appendChild(style);
}

function raiseGisMapControlCorners(mapRoot: ParentNode): void {
  for (const selector of GIS_MAP_CONTROL_CORNER_SELECTORS) {
    const corner = mapRoot.querySelector<HTMLElement>(selector);
    if (!corner) continue;
    corner.style.zIndex = GIS_MAP_CONTROL_Z;
    corner.style.pointerEvents = "none";
    for (const ctrl of corner.querySelectorAll<HTMLElement>(".maplibregl-ctrl")) {
      ctrl.style.pointerEvents = "auto";
    }
  }
}

/** 标尺/导航/归属等控件须叠在光晕与深空 overlay 之上（canvas-container 内最高 z=4）。 */
export function ensureGisMapControlStack(map: MapLibreMap): void {
  const mapCanvas = map.getCanvas();
  const mapRoot = mapCanvas.closest(".maplibregl-map");
  const canvasContainer = map.getCanvasContainer();

  mapCanvas.style.zIndex = GIS_MAP_CANVAS_Z;
  canvasContainer.style.zIndex = GIS_MAP_CANVAS_CONTAINER_Z;
  canvasContainer.style.position = canvasContainer.style.position || "relative";
  if (mapRoot) {
    raiseGisMapControlCorners(mapRoot);
    mapRoot.classList.add(GIS_MAP_CONTROL_STACK_CLASS);
  }
  ensureGisMapControlStackStyle();
}
