import { createContext, useContext, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type RichTextToolbarTheme = {
  className: string;
  style: CSSProperties;
};

export const RichTextThemeContext = createContext<RichTextToolbarTheme>({
  className: "",
  style: {},
});

export function useRichTextTheme(): RichTextToolbarTheme {
  return useContext(RichTextThemeContext);
}

/** 从看板 theme scope 复制令牌，供 portal 到 body 的浮动工具栏跟随仪表板明/暗主题 */
export function resolveRichTextToolbarTheme(anchor: HTMLElement | null): {
  className: string;
  style: CSSProperties;
} {
  const scope = anchor?.closest(".dashboard-theme-scope") as HTMLElement | null;
  const scheme =
    scope?.getAttribute("data-dashboard-color-scheme") ??
    (document.documentElement.classList.contains("dark") ? "dark" : "light");

  const style: CSSProperties = {
    colorScheme: scheme === "dark" ? "dark" : "light",
  };

  if (scope?.style) {
    for (let i = 0; i < scope.style.length; i += 1) {
      const prop = scope.style[i];
      if (prop.startsWith("--dashboard-")) {
        (style as Record<string, string>)[prop] = scope.style.getPropertyValue(prop);
      }
    }
  }

  return {
    className: cn("dashboard-theme-scope", scheme === "dark" && "dark"),
    style,
  };
}
