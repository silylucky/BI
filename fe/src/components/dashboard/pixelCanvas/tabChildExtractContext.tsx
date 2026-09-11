import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { PixelPoint } from "./geometry";

type TabChildExtractContextValue = {
  beginExtract: (widgetId: string, event: ReactPointerEvent) => void;
  extractingWidgetId: string | null;
};

const TabChildExtractContext = createContext<TabChildExtractContextValue>({
  beginExtract: () => {},
  extractingWidgetId: null,
});

export function TabChildExtractProvider({
  children,
  onExtractEnd,
  resolveCanvasPoint,
}: {
  children: ReactNode;
  onExtractEnd: (widgetId: string, point: PixelPoint) => void;
  resolveCanvasPoint: (clientX: number, clientY: number) => PixelPoint | null;
}) {
  const [extractingWidgetId, setExtractingWidgetId] = useState<string | null>(null);

  const beginExtract = useCallback((widgetId: string, event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExtractingWidgetId(widgetId);
  }, []);

  useEffect(() => {
    if (!extractingWidgetId) return;

    const finish = (clientX: number, clientY: number) => {
      const point = resolveCanvasPoint(clientX, clientY);
      if (point) {
        onExtractEnd(extractingWidgetId, point);
      }
      setExtractingWidgetId(null);
    };

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      finish(event.clientX, event.clientY);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExtractingWidgetId(null);
    };

    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [extractingWidgetId, onExtractEnd, resolveCanvasPoint]);

  const value = useMemo(
    () => ({ beginExtract, extractingWidgetId }),
    [beginExtract, extractingWidgetId],
  );

  return (
    <TabChildExtractContext.Provider value={value}>{children}</TabChildExtractContext.Provider>
  );
}

export function useTabChildExtract() {
  return useContext(TabChildExtractContext);
}
