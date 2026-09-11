import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const CHART_PAINT_SCALE_SETTLE_MS = 480;

export type DataScreenVisualScaleValue = {
  /** 画布 CSS 缩放（实时） */
  liveScale: number;
  /** 图表绘制用缩放（缩放停稳后更新） */
  paintScale: number;
  /** 视口缩放/平移交互中：图表暂停 commit 重绘 */
  isViewportTransforming: boolean;
};

type DataScreenPaintScaleValue = {
  paintScale: number;
  isViewportTransforming: boolean;
};

const DataScreenLiveScaleContext = createContext<number | null>(null);
const DataScreenPaintScaleContext = createContext<DataScreenPaintScaleValue | null>(null);

export function DataScreenVisualScaleProvider({
  liveScale,
  children,
}: {
  liveScale: number;
  children: ReactNode;
}) {
  const safeLive = liveScale > 0 ? liveScale : 1;
  const [paintScale, setPaintScale] = useState(safeLive);
  const [isViewportTransforming, setIsViewportTransforming] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paintScaleRef = useRef(paintScale);
  paintScaleRef.current = paintScale;

  useEffect(() => {
    if (Math.abs(safeLive - paintScaleRef.current) < 0.0001) {
      setIsViewportTransforming(false);
      return undefined;
    }
    setIsViewportTransforming(true);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      setPaintScale(safeLive);
      setIsViewportTransforming(false);
    }, CHART_PAINT_SCALE_SETTLE_MS);
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [safeLive]);

  const paintValue = useMemo(
    () => ({
      paintScale,
      isViewportTransforming,
    }),
    [paintScale, isViewportTransforming],
  );

  return (
    <DataScreenLiveScaleContext.Provider value={safeLive}>
      <DataScreenPaintScaleContext.Provider value={paintValue}>
        {children}
      </DataScreenPaintScaleContext.Provider>
    </DataScreenLiveScaleContext.Provider>
  );
}

function usePaintScaleContext(): DataScreenPaintScaleValue | null {
  return useContext(DataScreenPaintScaleContext);
}

/** @internal 图表/壳层判断是否在视口 Provider 内 */
export function useDataScreenVisualScaleBundle(): DataScreenVisualScaleValue | null {
  const liveScale = useContext(DataScreenLiveScaleContext);
  const paint = usePaintScaleContext();
  if (liveScale == null || paint == null) return null;
  return { liveScale, ...paint };
}

/** 大屏编辑视口实时缩放（PixelCanvas 测量等） */
export function useDataScreenVisualScale(): number | null {
  return useContext(DataScreenLiveScaleContext);
}

/** 图表绘制缩放（停稳后更新） */
export function useDataScreenChartPaintScale(): number {
  return usePaintScaleContext()?.paintScale ?? 1;
}

export function useDataScreenViewportTransforming(): boolean {
  return usePaintScaleContext()?.isViewportTransforming ?? false;
}
