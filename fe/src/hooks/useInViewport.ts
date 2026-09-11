import { useCallback, useEffect, useState } from "react";
import { resolveViewportObserverRoot } from "@/hooks/resolveViewportObserverRoot";

type UseInViewportOptions = {
  rootSelector?: string;
  rootMargin?: string;
  enabled?: boolean;
};

type UseInViewportResult<T extends Element> = {
  ref: (node: T | null) => void;
  inView: boolean;
};

/** 观测元素是否进入滚动容器/视口 */
export function useInViewport<T extends Element>(
  options: UseInViewportOptions = {},
): UseInViewportResult<T> {
  const { rootSelector, rootMargin = "200px", enabled = true } = options;
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(true);
  const ref = useCallback((next: T | null) => setNode(next), []);

  useEffect(() => {
    if (!enabled) {
      setInView(true);
      return undefined;
    }
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const root = resolveViewportObserverRoot(node, rootSelector);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { root, rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootSelector, rootMargin, enabled]);

  return { ref, inView: enabled ? inView : true };
}
