import * as THREE from "three";
import { projectWorldToContainer } from "@/components/charts/engine/three/threeGeoScreen";
import type { RegionPointSample } from "@/components/charts/engine/three/geo3dRegionCentroid";
import type { ResolvedPointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

export type FloatingLabelEntry = {
  name: string;
  el: HTMLDivElement;
};

export type Geo3dFloatingLabelsHandle = {
  layer: HTMLDivElement;
  entries: FloatingLabelEntry[];
  applyStyle: (style: ResolvedPointEffectsStyle) => void;
  sync: (
    camera: THREE.Camera,
    domElement: HTMLElement,
    container: HTMLElement,
    resolveAnchorWorld: (name: string) => THREE.Vector3 | null,
  ) => void;
  dispose: () => void;
};

export function buildGeo3dFloatingLabels(
  container: HTMLElement,
  samples: RegionPointSample[],
  style: ResolvedPointEffectsStyle,
): Geo3dFloatingLabelsHandle | null {
  if (!style.layers.floatingLabels || samples.length === 0) return null;

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const layer = document.createElement("div");
  layer.className = "pointer-events-none absolute inset-0 z-[2] overflow-hidden";
  layer.setAttribute("data-testid", "geo3d-floating-labels");
  container.appendChild(layer);

  const entries: FloatingLabelEntry[] = samples.map((sample) => {
    const el = document.createElement("div");
    el.textContent = sample.name;
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      transform: "translate(-50%, -100%)",
      whiteSpace: "nowrap",
      fontSize: `${style.floatingLabelFontSize}px`,
      color: style.floatingLabelTextColor,
      background: style.floatingLabelBgColor,
      border: `1px solid ${style.floatingLabelBorderColor}`,
      borderRadius: "4px",
      padding: "0 4px",
      lineHeight: "1.4",
      pointerEvents: "none",
    });
    layer.appendChild(el);
    return { name: sample.name, el };
  });

  return {
    layer,
    entries,
    applyStyle(nextStyle: ResolvedPointEffectsStyle) {
      for (const entry of entries) {
        Object.assign(entry.el.style, {
          fontSize: `${nextStyle.floatingLabelFontSize}px`,
          color: nextStyle.floatingLabelTextColor,
          background: nextStyle.floatingLabelBgColor,
          border: `1px solid ${nextStyle.floatingLabelBorderColor}`,
        });
      }
    },
    sync(camera, domElement, chartContainer, resolveAnchorWorld) {
      for (const entry of entries) {
        const world = resolveAnchorWorld(entry.name);
        if (!world) continue;
        const { x, y } = projectWorldToContainer(world, camera, domElement, chartContainer);
        entry.el.style.left = `${x}px`;
        entry.el.style.top = `${y}px`;
      }
    },
    dispose() {
      layer.remove();
    },
  };
}
