import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  computePresentationTransform,
  DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  resolveDataScreenEditViewportOffsets,
  type PresentationMode,
} from "./presentationScale";

export type CanvasScaleViewportProps = {
  canvasWidth: number;
  canvasHeight: number;
  mode?: PresentationMode;
  /** 与数据大屏编辑视口一致：画布贴齐左上，不做等比居中留白 */
  pinTopLeft?: boolean;
  className?: string;
  children: ReactNode;
};

export function CanvasScaleViewport({
  canvasWidth,
  canvasHeight,
  mode = DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  pinTopLeft = false,
  className,
  children,
}: CanvasScaleViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const transform = computePresentationTransform(
    size.width,
    size.height,
    canvasWidth,
    canvasHeight,
    mode,
  );
  const { offsetX, offsetY } = pinTopLeft
    ? resolveDataScreenEditViewportOffsets()
    : { offsetX: transform.translateX, offsetY: transform.translateY };

  const stageStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${transform.scaleX}, ${transform.scaleY})`,
    transformOrigin: "top left",
  };

  return (
    <div
      ref={hostRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      data-canvas-scale-viewport
      data-presentation-mode={mode}
    >
      <div className="absolute left-0 top-0" style={stageStyle}>
        {children}
      </div>
    </div>
  );
}
