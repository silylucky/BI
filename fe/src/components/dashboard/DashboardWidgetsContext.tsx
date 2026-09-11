import { createContext, useContext, type ReactNode } from "react";
import type { LayoutWidget } from "./layoutUtils";

const DashboardWidgetsContext = createContext<LayoutWidget[]>([]);

export function DashboardWidgetsProvider({
  widgets,
  children,
}: {
  widgets: LayoutWidget[];
  children: ReactNode;
}) {
  return (
    <DashboardWidgetsContext.Provider value={widgets}>
      {children}
    </DashboardWidgetsContext.Provider>
  );
}

export function useDashboardWidgets(): LayoutWidget[] {
  return useContext(DashboardWidgetsContext);
}
