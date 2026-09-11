import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MAX_DRILL_DEPTH, type ChartDrillFrame } from "@/lib/chartDrill";

type StackMap = Record<string, ChartDrillFrame[]>;

type ChartDrillContextValue = {
  getStack: (widgetId: string) => ChartDrillFrame[];
  push: (widgetId: string, frame: ChartDrillFrame) => void;
  pop: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  navigateTo: (widgetId: string, depth: number) => void;
  setStack: (widgetId: string, stack: ChartDrillFrame[]) => void;
};

const ChartDrillContext = createContext<ChartDrillContextValue | null>(null);

const EMPTY_DRILL_STACK: ChartDrillFrame[] = [];

export function ChartDrillProvider({ children }: { children: ReactNode }) {
  const [stacks, setStacks] = useState<StackMap>({});

  const getStack = useCallback((widgetId: string) => stacks[widgetId] ?? EMPTY_DRILL_STACK, [stacks]);

  const push = useCallback((widgetId: string, frame: ChartDrillFrame) => {
    setStacks((prev) => {
      const current = prev[widgetId] ?? [];
      if (current.length >= MAX_DRILL_DEPTH) return prev;
      const last = current[current.length - 1];
      if (last?.field === frame.field && last.value === frame.value) return prev;
      return { ...prev, [widgetId]: [...current, frame] };
    });
  }, []);

  const pop = useCallback((widgetId: string) => {
    setStacks((prev) => {
      const current = prev[widgetId] ?? [];
      if (!current.length) return prev;
      const next = current.slice(0, -1);
      if (!next.length) {
        const copy = { ...prev };
        delete copy[widgetId];
        return copy;
      }
      return { ...prev, [widgetId]: next };
    });
  }, []);

  const reset = useCallback((widgetId: string) => {
    setStacks((prev) => {
      if (!prev[widgetId]?.length) return prev;
      const copy = { ...prev };
      delete copy[widgetId];
      return copy;
    });
  }, []);

  const navigateTo = useCallback((widgetId: string, depth: number) => {
    setStacks((prev) => {
      const current = prev[widgetId] ?? [];
      if (depth <= 0 || !current.length) {
        const copy = { ...prev };
        delete copy[widgetId];
        return copy;
      }
      return { ...prev, [widgetId]: current.slice(0, depth) };
    });
  }, []);

  const setStack = useCallback((widgetId: string, stack: ChartDrillFrame[]) => {
    setStacks((prev) => {
      if (!stack.length) {
        if (!prev[widgetId]?.length) return prev;
        const copy = { ...prev };
        delete copy[widgetId];
        return copy;
      }
      return { ...prev, [widgetId]: stack.slice(0, MAX_DRILL_DEPTH) };
    });
  }, []);

  const value = useMemo(
    () => ({ getStack, push, pop, reset, navigateTo, setStack }),
    [getStack, push, pop, reset, navigateTo, setStack],
  );

  return <ChartDrillContext.Provider value={value}>{children}</ChartDrillContext.Provider>;
}

const noop = () => {};

export function useChartDrill(widgetId?: string) {
  const ctx = useContext(ChartDrillContext);
  if (!ctx || !widgetId) {
    return {
      stack: EMPTY_DRILL_STACK,
      push: noop,
      pop: noop,
      reset: noop,
      navigateTo: noop,
      setStack: noop,
      active: false,
    };
  }

  const stack = ctx.getStack(widgetId);
  return {
    stack,
    push: (frame: ChartDrillFrame) => ctx.push(widgetId, frame),
    pop: () => ctx.pop(widgetId),
    reset: () => ctx.reset(widgetId),
    navigateTo: (depth: number) => ctx.navigateTo(widgetId, depth),
    setStack: (next: ChartDrillFrame[]) => ctx.setStack(widgetId, next),
    active: true,
  };
}

export function drillStackRevision(stack: ChartDrillFrame[]): string {
  if (!stack.length) return "";
  return stack.map((frame) => `${frame.field}=${frame.value}`).join("|");
}
