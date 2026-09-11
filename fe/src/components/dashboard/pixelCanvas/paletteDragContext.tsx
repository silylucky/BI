import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isNativePaletteDragEvent } from "@/lib/dashboardDnd";
import {
  endPaletteDragSession,
  isPaletteDragSessionActive,
} from "@/lib/paletteDragSession";
import type { TabInsertIntent } from "./tabInsertResolver";

type PaletteDragContextValue = {
  active: boolean;
  tabInsertIntent: TabInsertIntent | null;
  setTabInsertIntent: (intent: TabInsertIntent | null) => void;
};

const PaletteDragContext = createContext<PaletteDragContextValue>({
  active: false,
  tabInsertIntent: null,
  setTabInsertIntent: () => {},
});

export function PaletteDragProvider({
  active,
  tabInsertIntent,
  onTabInsertIntentChange,
  children,
}: {
  active: boolean;
  tabInsertIntent: TabInsertIntent | null;
  onTabInsertIntentChange: (intent: TabInsertIntent | null) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      active,
      tabInsertIntent,
      setTabInsertIntent: onTabInsertIntentChange,
    }),
    [active, tabInsertIntent, onTabInsertIntentChange],
  );
  return <PaletteDragContext.Provider value={value}>{children}</PaletteDragContext.Provider>;
}

export function usePaletteDragActive(): boolean {
  return useContext(PaletteDragContext).active;
}

export function useTabInsertIntent(): TabInsertIntent | null {
  return useContext(PaletteDragContext).tabInsertIntent;
}

export function useSetTabInsertIntent(): (intent: TabInsertIntent | null) => void {
  return useContext(PaletteDragContext).setTabInsertIntent;
}

/** 文档级监听：面板拖拽期间 active=true（不在 capture drop 上提前结束，避免卸载投放层） */
export function usePaletteDocumentDrag(enabled: boolean): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    const activate = (event: DragEvent) => {
      if (isNativePaletteDragEvent(event) || isPaletteDragSessionActive()) {
        setActive(true);
      }
    };
    const end = () => {
      endPaletteDragSession();
      setActive(false);
    };
    document.addEventListener("dragstart", activate, true);
    document.addEventListener("dragover", activate, true);
    document.addEventListener("dragend", end);
    document.addEventListener("drop", end);
    return () => {
      document.removeEventListener("dragstart", activate, true);
      document.removeEventListener("dragover", activate, true);
      document.removeEventListener("dragend", end);
      document.removeEventListener("drop", end);
    };
  }, [enabled]);

  return active;
}
