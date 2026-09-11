import { createContext, useContext, type ReactNode } from "react";

/** 面板拖放时，落点命中（含碰撞缓冲）的 Tab 容器 id */
const TabPaletteDropTargetContext = createContext<string | null>(null);

export function TabPaletteDropTargetProvider({
  targetTabsId,
  children,
}: {
  targetTabsId: string | null;
  children: ReactNode;
}) {
  return (
    <TabPaletteDropTargetContext.Provider value={targetTabsId}>
      {children}
    </TabPaletteDropTargetContext.Provider>
  );
}

export function useTabPaletteDropTarget(): string | null {
  return useContext(TabPaletteDropTargetContext);
}
