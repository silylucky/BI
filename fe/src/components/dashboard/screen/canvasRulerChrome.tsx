import type { CSSProperties } from "react";
import {
  CANVAS_RULER_SIZE_PX,
  DATA_SCREEN_RULER_BG,
  DATA_SCREEN_RULER_EDGE,
  DATA_SCREEN_RULER_LABEL,
  DATA_SCREEN_RULER_TICK_MAJOR,
} from "./canvasRulerUtils";

/** 标尺角块：与尺同底色、不拦截指针事件 */
export const canvasRulerCornerClass =
  "pointer-events-none relative z-0 shrink-0 bg-[var(--canvas-ruler-bg)]";

export const canvasRulerCornerStyle = {
  width: CANVAS_RULER_SIZE_PX,
  height: CANVAS_RULER_SIZE_PX,
} satisfies CSSProperties;

export const canvasRulerSurfaceClass =
  "pointer-events-none relative z-[1] shrink-0 overflow-hidden bg-[var(--canvas-ruler-bg)]";

export function canvasRulerChromeVars(): CSSProperties {
  return {
    "--canvas-ruler-size": `${CANVAS_RULER_SIZE_PX}px`,
    "--canvas-ruler-bg": DATA_SCREEN_RULER_BG,
    "--canvas-ruler-edge": DATA_SCREEN_RULER_EDGE,
    "--canvas-ruler-label": DATA_SCREEN_RULER_LABEL,
    "--canvas-ruler-tick-major": DATA_SCREEN_RULER_TICK_MAJOR,
  } as CSSProperties;
}

/** 标尺原点角标（L 形，替代数字 0） */
export function CanvasRulerCornerMark() {
  return (
    <svg
      className="absolute right-0.5 bottom-0.5 size-3.5 text-[var(--canvas-ruler-tick-major)]"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      data-testid="canvas-ruler-corner-mark"
    >
      <path
        d="M2.5 11H11.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M11.5 2.5V11.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
