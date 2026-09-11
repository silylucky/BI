import { createContext, useContext, type ReactNode } from "react";
import { resolveShapeTitleCanvasScale } from "../dashboardWidgetTypography";

const PixelCanvasScaleContext = createContext(1);
const PixelCanvasDesignViewportContext = createContext(false);
const PixelCanvasChromeScaleContext = createContext(1);

export function PixelCanvasScaleProvider({
  scale,
  designViewportLocked = false,
  mode = "view",
  children,
}: {
  scale: number;
  designViewportLocked?: boolean;
  mode?: "edit" | "view";
  children: ReactNode;
}) {
  const safeScale = scale > 0 ? scale : 1;
  return (
    <PixelCanvasScaleContext.Provider value={safeScale}>
      <PixelCanvasDesignViewportContext.Provider value={designViewportLocked}>
        <PixelCanvasChromeScaleContext.Provider
          value={resolveShapeTitleCanvasScale(safeScale, designViewportLocked, mode)}
        >
          {children}
        </PixelCanvasChromeScaleContext.Provider>
      </PixelCanvasDesignViewportContext.Provider>
    </PixelCanvasScaleContext.Provider>
  );
}

export function usePixelCanvasScale(): number {
  return useContext(PixelCanvasScaleContext);
}

/** 外层 CanvasScaleViewport 已缩放时，不再对标题字号做二次补偿 */
export function usePixelCanvasDesignViewportLocked(): boolean {
  return useContext(PixelCanvasDesignViewportContext);
}

/** 组件壳层（标题字号/标题栏高度/页签字号）的补偿基数 */
export function usePixelChromeScale(): number {
  return useContext(PixelCanvasChromeScaleContext);
}
