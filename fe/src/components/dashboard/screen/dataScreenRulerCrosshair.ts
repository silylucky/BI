import type { ViewportPan } from "./dataScreenViewportScroll";

export type DesignCoord = { x: number; y: number };

export type ScreenToDesignInput = {
  clientX: number;
  clientY: number;
  viewportRect: Pick<DOMRect, "left" | "top" | "width" | "height">;
  pan: ViewportPan;
  offsetX: number;
  offsetY: number;
  scale: number;
};

/** 将视口内指针位置换算为设计坐标；指针在视口外时返回 null */
export function screenToDesignCoord(input: ScreenToDesignInput): DesignCoord | null {
  const pointerX = input.clientX - input.viewportRect.left;
  const pointerY = input.clientY - input.viewportRect.top;
  if (
    pointerX < 0 ||
    pointerY < 0 ||
    pointerX > input.viewportRect.width ||
    pointerY > input.viewportRect.height
  ) {
    return null;
  }
  if (input.scale <= 0) return null;
  return {
    x: (pointerX - input.offsetX - input.pan.x) / input.scale,
    y: (pointerY - input.offsetY - input.pan.y) / input.scale,
  };
}

export function formatDesignCoord(coord: DesignCoord): string {
  return `${Math.round(coord.x)}, ${Math.round(coord.y)}`;
}
