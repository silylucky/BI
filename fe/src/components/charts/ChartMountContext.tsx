import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChartMountScheduler } from "@/lib/chartMountScheduler";
import { registerActiveChartMountScheduler } from "@/lib/chartMountDrain";
import { CHART_LOAD_MAX_CONCURRENCY } from "@/lib/chartLoadConcurrency";

const ChartMountContext = createContext<ChartMountScheduler | null>(null);

export const CHART_MOUNT_MAX_EDIT = CHART_LOAD_MAX_CONCURRENCY;
export const CHART_MOUNT_MAX_VIEW = 3;
export const CHART_MOUNT_MAX_LIST = 1;

type ChartMountProviderProps = {
  children: ReactNode;
  maxConcurrent: number;
};

export function ChartMountProvider({ children, maxConcurrent }: ChartMountProviderProps) {
  const schedulerRef = useRef<ChartMountScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new ChartMountScheduler(maxConcurrent);
  }

  useEffect(() => {
    schedulerRef.current?.setMaxConcurrent(maxConcurrent);
  }, [maxConcurrent]);

  useEffect(() => {
    registerActiveChartMountScheduler(schedulerRef.current);
    return () => registerActiveChartMountScheduler(null);
  }, []);

  return (
    <ChartMountContext.Provider value={schedulerRef.current}>
      {children}
    </ChartMountContext.Provider>
  );
}

export function useChartMountScheduler(): ChartMountScheduler | null {
  return useContext(ChartMountContext);
}

type ChartMountGateOptions = {
  priority?: number;
  inView?: boolean;
};

export function useChartMountGate(
  widgetId: string,
  options: ChartMountGateOptions = {},
): {
  canQuery: boolean;
  canRender: boolean;
  onMountReady: () => void;
} {
  const scheduler = useContext(ChartMountContext);
  const priority = options.priority ?? 1;
  const inView = options.inView ?? true;
  const [, revision] = useState(0);

  useEffect(() => {
    if (!scheduler) return undefined;
    return scheduler.subscribe(() => revision((n) => n + 1));
  }, [scheduler]);

  useEffect(() => {
    if (!scheduler) return undefined;
    scheduler.register(widgetId, priority, inView);
    return () => scheduler.unregister(widgetId);
  }, [scheduler, widgetId, priority, inView]);

  const onMountReady = useCallback(() => {
    scheduler?.markReady(widgetId);
  }, [scheduler, widgetId]);

  if (!scheduler) {
    return { canQuery: true, canRender: true, onMountReady: () => {} };
  }

  return { ...scheduler.getGate(widgetId), onMountReady };
}
