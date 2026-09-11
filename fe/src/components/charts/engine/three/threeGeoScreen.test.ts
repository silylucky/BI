import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  projectWorldToContainer,
  projectWorldToViewport,
  provinceWorldCenter,
} from "@/components/charts/engine/three/threeGeoScreen";

function mockRect(el: HTMLElement, rect: Pick<DOMRect, "left" | "top" | "width" | "height">) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("threeGeoScreen", () => {
  it("maps world origin in front of camera to container center", () => {
    const container = document.createElement("div");
    const canvas = document.createElement("canvas");
    Object.defineProperty(container, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 300, configurable: true });
    mockRect(container, { left: 100, top: 50, width: 400, height: 300 });
    mockRect(canvas, { left: 100, top: 50, width: 400, height: 300 });

    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const point = projectWorldToContainer(new THREE.Vector3(0, 0, 0), camera, canvas, container);
    expect(point.x).toBeCloseTo(200, 0);
    expect(point.y).toBeCloseTo(150, 0);
  });

  it("compensates for css scale on container when projecting labels", () => {
    const container = document.createElement("div");
    const canvas = document.createElement("canvas");
    Object.defineProperty(container, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 300, configurable: true });
    mockRect(container, { left: 100, top: 50, width: 408, height: 306 });
    mockRect(canvas, { left: 100, top: 50, width: 408, height: 306 });

    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const point = projectWorldToContainer(new THREE.Vector3(0, 0, 0), camera, canvas, container);
    expect(point.x).toBeCloseTo(200, 0);
    expect(point.y).toBeCloseTo(150, 0);
  });

  it("maps world origin to viewport client coordinates", () => {
    const canvas = document.createElement("canvas");
    mockRect(canvas, { left: 100, top: 50, width: 400, height: 300 });

    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const point = projectWorldToViewport(new THREE.Vector3(0, 0, 0), camera, canvas);
    expect(point.x).toBeCloseTo(300, 0);
    expect(point.y).toBeCloseTo(200, 0);
  });

  it("computes province world center from parts", () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.set(1, 0, 1);
    group.add(mesh);
    const center = provinceWorldCenter([group]);
    expect(center.x).toBeCloseTo(1, 1);
    expect(center.z).toBeCloseTo(1, 1);
  });
});
