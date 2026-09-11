import { useCallback, useEffect, useRef, useState } from "react";

type VisibleCardRegistry<T extends string> = {
  visibleIds: Set<T>;
  registerVisibleCard: (id: T, element: HTMLElement | null) => void;
};

/** Hub 卡片网格：跟踪视口内卡片 ID（用于延迟 batch-resolve / 预览） */
export function useVisibleCardIds<T extends string>(
  rootMargin = "120px",
): VisibleCardRegistry<T> {
  const [visibleIds, setVisibleIds] = useState<Set<T>>(() => new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef(new Map<T, HTMLElement>());

  const registerVisibleCard = useCallback((id: T, element: HTMLElement | null) => {
    const prev = elementsRef.current.get(id);
    if (prev && observerRef.current) {
      observerRef.current.unobserve(prev);
    }
    if (!element) {
      elementsRef.current.delete(id);
      setVisibleIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }
    elementsRef.current.set(id, element);
    observerRef.current?.observe(element);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIds((current) => {
          let changed = false;
          const next = new Set(current);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.visibleCardId as T | undefined;
            if (!id) continue;
            if (entry.isIntersecting) {
              if (!next.has(id)) {
                next.add(id);
                changed = true;
              }
            } else if (next.delete(id)) {
              changed = true;
            }
          }
          return changed ? next : current;
        });
      },
      { rootMargin },
    );
    observerRef.current = observer;
    for (const el of elementsRef.current.values()) {
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [rootMargin]);

  return { visibleIds, registerVisibleCard };
}
