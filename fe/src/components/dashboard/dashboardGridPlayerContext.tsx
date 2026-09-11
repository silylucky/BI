import { createContext, useContext, type ReactNode } from "react";

const DashboardGridPlayerContext = createContext<string | null>(null);

/** 栅格 RGL 拖拽/缩放中：仅当前交互组件暂停嵌入图表 React 尺寸上报 */
export function DashboardGridPlayerProvider({
  playingWidgetId,
  children,
}: {
  playingWidgetId: string | null;
  children: ReactNode;
}) {
  return (
    <DashboardGridPlayerContext.Provider value={playingWidgetId}>
      {children}
    </DashboardGridPlayerContext.Provider>
  );
}

export function useDashboardGridPlayingWidgetId(): string | null {
  return useContext(DashboardGridPlayerContext);
}

export function useDashboardGridPlayer(widgetId?: string): boolean {
  const playingWidgetId = useDashboardGridPlayingWidgetId();
  if (widgetId) return playingWidgetId === widgetId;
  return playingWidgetId !== null;
}

/** 栅格拖缩放期间：仅 playing widget 获得 mount priority 0（交互冻结期可 query） */
export function resolveChartMountPriority(
  widgetId: string,
  selected: boolean,
  shell: "grid" | "shape",
  gridPlayingWidgetId: string | null,
): number {
  if (shell === "grid" && gridPlayingWidgetId !== null) {
    return widgetId === gridPlayingWidgetId ? 0 : 1;
  }
  return selected ? 0 : 1;
}
