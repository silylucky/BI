import { useCallback, useRef } from "react";
import { endPaletteDragSession } from "@/lib/paletteDragSession";

/** 工具栏 Dropdown 内 HTML5 拖放：阻止 Radix 在 dragstart 时关闭菜单导致拖不出来 */
export function usePaletteDropdownDragLock() {
  const lockedRef = useRef(false);

  const onDragStart = useCallback(() => {
    lockedRef.current = true;
  }, []);

  const onDragEnd = useCallback(() => {
    lockedRef.current = false;
    endPaletteDragSession();
  }, []);

  const guardOpenChange = useCallback((next: boolean, setOpen: (open: boolean) => void) => {
    if (!next && lockedRef.current) return;
    setOpen(next);
  }, []);

  const dismissGuardProps = {
    onPointerDownOutside: (event: Event) => {
      if (lockedRef.current) event.preventDefault();
    },
    onFocusOutside: (event: Event) => {
      if (lockedRef.current) event.preventDefault();
    },
  };

  return { onDragStart, onDragEnd, guardOpenChange, dismissGuardProps };
}
