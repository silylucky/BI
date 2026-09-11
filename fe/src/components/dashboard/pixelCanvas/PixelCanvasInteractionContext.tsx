import { createContext, useContext, type ReactNode } from "react";

export type PixelCanvasInteraction = {
  widgetId: string;
} | null;

const PixelCanvasInteractionContext = createContext<PixelCanvasInteraction>(null);

export function PixelCanvasInteractionProvider({
  interaction,
  children,
}: {
  interaction: PixelCanvasInteraction;
  children: ReactNode;
}) {
  return (
    <PixelCanvasInteractionContext.Provider value={interaction}>
      {children}
    </PixelCanvasInteractionContext.Provider>
  );
}

export function usePixelCanvasInteraction(): PixelCanvasInteraction {
  return useContext(PixelCanvasInteractionContext);
}

/** 当前组件是否处于 DataEase isPlayer 交互（DOM 直改尺寸，不触发 React 布局 props） */
export function usePixelWidgetInteracting(widgetId: string): boolean {
  const interaction = usePixelCanvasInteraction();
  return interaction?.widgetId === widgetId;
}
