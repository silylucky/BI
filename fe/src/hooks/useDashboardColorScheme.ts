import { useEffect, useState, type RefObject } from "react";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";

function readScopeScheme(scope: Element | null): ColorScheme | null {
  if (!scope) return null;
  const attr = scope.getAttribute("data-dashboard-color-scheme");
  if (attr === "dark" || attr === "light") return attr;
  return scope.classList.contains("dark") ? "dark" : "light";
}

/**
 * 读取看板主题作用域（data-dashboard-color-scheme），与 Admin 壳层解耦。
 * prop 优先；嵌入画布内监听 DOM 属性变化以支持实时切换。
 */
export function useDashboardColorScheme(
  containerRef: RefObject<HTMLElement | null>,
  propScheme?: ColorScheme,
): ColorScheme {
  const [domScheme, setDomScheme] = useState<ColorScheme>(() => propScheme ?? "light");

  useEffect(() => {
    if (propScheme) setDomScheme(propScheme);
  }, [propScheme]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const scope = root.closest(".dashboard-theme-scope");
    if (!scope) return undefined;

    const sync = () => {
      const next = readScopeScheme(scope);
      if (next) setDomScheme(next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(scope, {
      attributes: true,
      attributeFilter: ["data-dashboard-color-scheme", "class"],
    });
    return () => observer.disconnect();
  }, [containerRef, containerRef.current]);

  return propScheme ?? domScheme;
}
