export type PresentationMode = "fit" | "fitWidth" | "fitHeight" | "fill" | "none";

/** 大屏编辑右栏「缩放方式」选项（对标 DataEase） */
export const DATA_SCREEN_EDIT_PRESENTATION_MODES: PresentationMode[] = [
  "fitWidth",
  "fitHeight",
  "fit",
];

export const DATA_SCREEN_EDIT_PRESENTATION_DEFAULT: PresentationMode = "fitWidth";

export type PresentationTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

export function computePresentationTransform(
  containerWidth: number,
  containerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  mode: PresentationMode,
): PresentationTransform {
  const safeContainerW = Math.max(containerWidth, 0);
  const safeContainerH = Math.max(containerHeight, 0);
  const safeCanvasW = Math.max(canvasWidth, 1);
  const safeCanvasH = Math.max(canvasHeight, 1);

  if (mode === "none") {
    const translateX = Math.max(0, (safeContainerW - safeCanvasW) / 2);
    const translateY = Math.max(0, (safeContainerH - safeCanvasH) / 2);
    return { scaleX: 1, scaleY: 1, translateX, translateY };
  }

  if (mode === "fill") {
    const scaleX = safeContainerW / safeCanvasW;
    const scaleY = safeContainerH / safeCanvasH;
    return { scaleX, scaleY, translateX: 0, translateY: 0 };
  }

  let scale = 1;
  if (mode === "fitWidth") {
    scale = safeContainerW / safeCanvasW;
  } else if (mode === "fitHeight") {
    scale = safeContainerH / safeCanvasH;
  } else {
    scale = Math.min(safeContainerW / safeCanvasW, safeContainerH / safeCanvasH);
  }

  const scaledW = safeCanvasW * scale;
  const scaledH = safeCanvasH * scale;
  return {
    scaleX: scale,
    scaleY: scale,
    translateX: Math.max(0, (safeContainerW - scaledW) / 2),
    translateY: Math.max(0, (safeContainerH - scaledH) / 2),
  };
}

/** 编辑视口留白：宽度/高度优先时固定贴齐一侧，等比适应时居中 */
export function resolveDataScreenViewportOffsets(
  mode: PresentationMode,
  viewportWidth: number,
  viewportHeight: number,
  base: PresentationTransform,
  scaledWidth: number,
  scaledHeight: number,
): { offsetX: number; offsetY: number } {
  if (mode === "fitWidth") {
    return {
      offsetX: 0,
      offsetY: scaledHeight > viewportHeight ? 0 : base.translateY,
    };
  }
  if (mode === "fitHeight") {
    return {
      offsetX: scaledWidth > viewportWidth ? 0 : base.translateX,
      offsetY: 0,
    };
  }
  return {
    offsetX: scaledWidth > viewportWidth ? 0 : base.translateX,
    offsetY: scaledHeight > viewportHeight ? 0 : base.translateY,
  };
}

/** 编辑视口：画布原点贴齐视口左上（不居中留白），与 DE 编辑相机一致 */
export function resolveDataScreenEditViewportOffsets(): { offsetX: number; offsetY: number } {
  return { offsetX: 0, offsetY: 0 };
}
