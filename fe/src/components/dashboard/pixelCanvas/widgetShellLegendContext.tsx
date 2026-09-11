import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChartLegendIconShape, ChartLegendStyle } from "@/lib/chartDeStyle";
import type { ChartLegendItem } from "@/lib/chartLegendItems";
import {
  DEFAULT_CHART_LEGEND_ICON,
  DEFAULT_CHART_LEGEND_ICON_SIZE,
  DEFAULT_CHART_LEGEND_FONT_SIZE,
} from "@/lib/chartLegendPresentation";
import type { ChartLegendHAlign, ChartLegendVAlign } from "@/lib/chartLegendPresentation";

export type WidgetShellLegendState = {
  visible: boolean;
  position: NonNullable<ChartLegendStyle["position"]>;
  orient: NonNullable<ChartLegendStyle["orient"]>;
  hAlign: ChartLegendHAlign;
  vAlign: ChartLegendVAlign;
  fontSize: number;
  icon: ChartLegendIconShape;
  iconSize: number;
  textColor?: string;
  items: ChartLegendItem[];
};

const EMPTY_LEGEND: WidgetShellLegendState = {
  visible: false,
  position: "bottom",
  orient: "horizontal",
  hAlign: "center",
  vAlign: "bottom",
  fontSize: DEFAULT_CHART_LEGEND_FONT_SIZE,
  icon: DEFAULT_CHART_LEGEND_ICON,
  iconSize: DEFAULT_CHART_LEGEND_ICON_SIZE,
  items: [],
};

type WidgetShellLegendContextValue = {
  state: WidgetShellLegendState;
  setState: (patch: Partial<WidgetShellLegendState>) => void;
};

const WidgetShellLegendContext = createContext<WidgetShellLegendContextValue | null>(null);

export function legendItemsKey(items: ChartLegendItem[]): string {
  return items.map((item) => `${item.name}\0${item.color}`).join("|");
}

function legendStateEqual(a: WidgetShellLegendState, b: WidgetShellLegendState): boolean {
  return (
    a.visible === b.visible &&
    a.position === b.position &&
    a.orient === b.orient &&
    a.hAlign === b.hAlign &&
    a.vAlign === b.vAlign &&
    a.fontSize === b.fontSize &&
    a.icon === b.icon &&
    a.iconSize === b.iconSize &&
    a.textColor === b.textColor &&
    legendItemsKey(a.items) === legendItemsKey(b.items)
  );
}

export function WidgetShellLegendProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<WidgetShellLegendState>(EMPTY_LEGEND);
  const setState = useCallback((patch: Partial<WidgetShellLegendState>) => {
    setStateRaw((prev) => {
      const next = { ...prev, ...patch };
      return legendStateEqual(prev, next) ? prev : next;
    });
  }, []);
  const value = useMemo(() => ({ state, setState }), [state, setState]);
  return (
    <WidgetShellLegendContext.Provider value={value}>{children}</WidgetShellLegendContext.Provider>
  );
}

export function useWidgetShellLegend() {
  return useContext(WidgetShellLegendContext);
}

/** 看板内嵌图表向 pixel-shape-inner 发布图例布局 */
export function usePublishWidgetShellLegend(
  state: WidgetShellLegendState,
  enabled: boolean,
) {
  const ctx = useWidgetShellLegend();
  const setStateRef = useRef(ctx?.setState);
  setStateRef.current = ctx?.setState;
  const stateRef = useRef(state);
  stateRef.current = state;
  const itemsKey = legendItemsKey(state.items);

  useEffect(() => {
    if (!enabled) {
      setStateRef.current?.(EMPTY_LEGEND);
      return;
    }
    setStateRef.current?.(stateRef.current);
  }, [enabled, state.visible, state.position, state.orient, state.hAlign, state.vAlign, state.fontSize, state.icon, state.iconSize, state.textColor, itemsKey]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      setStateRef.current?.(EMPTY_LEGEND);
    };
  }, [enabled]);
}
