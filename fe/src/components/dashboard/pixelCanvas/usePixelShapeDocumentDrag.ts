import { useEffect, useRef } from "react";

type DocumentDragHandlers = {
  onMove: (event: PointerEvent) => void;
  onEnd: (event: PointerEvent, commit: boolean) => void;
};

/** DataEase Shape.vue：document 级 pointer 监听，避免手柄/参考线导致丢事件 */
export function usePixelShapeDocumentDrag() {
  const handlersRef = useRef<DocumentDragHandlers | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const unbind = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    handlersRef.current = null;
  };

  useEffect(() => {
    return () => {
      unbind();
    };
  }, []);

  const bind = (pointerId: number, handlers: DocumentDragHandlers) => {
    unbind();
    handlersRef.current = handlers;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      handlersRef.current?.onMove(event);
    };

    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const commit = event.type !== "pointercancel";
      handlersRef.current?.onEnd(event, commit);
      unbind();
    };

    document.addEventListener("pointermove", onMove, { capture: true });
    document.addEventListener("pointerup", onEnd, { capture: true });
    document.addEventListener("pointercancel", onEnd, { capture: true });
    cleanupRef.current = () => {
      document.removeEventListener("pointermove", onMove, { capture: true });
      document.removeEventListener("pointerup", onEnd, { capture: true });
      document.removeEventListener("pointercancel", onEnd, { capture: true });
    };
  };

  return bind;
}
