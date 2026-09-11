import * as THREE from "three";

/** 祖先 CSS transform（scale）会把 getBoundingClientRect 与 layout 尺寸拉开，需还原到本地坐标 */
function readElementLayoutScale(el: HTMLElement): { scaleX: number; scaleY: number } {
  const rect = el.getBoundingClientRect();
  const layoutW = el.clientWidth || el.offsetWidth || rect.width || 1;
  const layoutH = el.clientHeight || el.offsetHeight || rect.height || 1;
  return {
    scaleX: layoutW > 0 ? rect.width / layoutW : 1,
    scaleY: layoutH > 0 ? rect.height / layoutH : 1,
  };
}

/** 将世界坐标投影到 WebGL canvas 内的局部像素坐标 */
export function projectWorldToDomLocal(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  domElement: HTMLElement,
): { x: number; y: number } {
  const ndc = worldPoint.clone().project(camera);
  const rect = domElement.getBoundingClientRect();
  const { scaleX, scaleY } = readElementLayoutScale(domElement);
  return {
    x: (((ndc.x + 1) / 2) * rect.width) / scaleX,
    y: (((-ndc.y + 1) / 2) * rect.height) / scaleY,
  };
}

/** 将世界坐标投影到图表容器内的局部像素坐标（与 tooltip absolute 定位一致） */
export function projectWorldToContainer(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  domElement: HTMLElement,
  container: HTMLElement,
): { x: number; y: number } {
  const ndc = worldPoint.clone().project(camera);
  const domRect = domElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const { scaleX, scaleY } = readElementLayoutScale(container);
  const screenX = ((ndc.x + 1) / 2) * domRect.width + (domRect.left - containerRect.left);
  const screenY = ((-ndc.y + 1) / 2) * domRect.height + (domRect.top - containerRect.top);
  return {
    x: screenX / scaleX,
    y: screenY / scaleY,
  };
}

/** 将世界坐标投影到视口 client 坐标（配合 position:fixed 的 tooltip） */
export function projectWorldToViewport(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  domElement: HTMLElement,
): { x: number; y: number } {
  const ndc = worldPoint.clone().project(camera);
  const rect = domElement.getBoundingClientRect();
  return {
    x: ((ndc.x + 1) / 2) * rect.width + rect.left,
    y: ((-ndc.y + 1) / 2) * rect.height + rect.top,
  };
}

export function provinceWorldCenter(parts: THREE.Object3D[]): THREE.Vector3 {
  const box = new THREE.Box3();
  for (const part of parts) {
    part.updateMatrixWorld(true);
    box.expandByObject(part);
  }
  if (box.isEmpty()) return new THREE.Vector3();
  return box.getCenter(new THREE.Vector3());
}
