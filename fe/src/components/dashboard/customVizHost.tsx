import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import { getDashboardThemeTokens, themeTokensToScopeVars } from "./dashboardThemeTokens";
import { resolveCustomVizEffectivePaletteColors } from "./custom-viz/customVizDisplayStyle";
import type { CustomVizWidgetConfig } from "./layoutUtils";
import { appendCustomVizStyleBridge } from "./custom-viz/customVizStyleBridge";
import { attachCustomVizRuntime } from "./custom-viz/customVizRuntime";

export const CUSTOM_VIZ_HOST_CLASS = "vs-custom-viz-host";

const HOST_SEL = `.${CUSTOM_VIZ_HOST_CLASS}`;

/** 兼容 bundle 内 `(host||document).getElementById`：宿主是 div 时没有原生 getElementById。 */
export function ensureCustomVizHostElementLookup(host: HTMLElement): void {
  const patched = host as HTMLElement & { getElementById?: (id: string) => Element | null };
  if (typeof patched.getElementById === "function") return;
  patched.getElementById = function getElementById(id: string) {
    return this.querySelector(`#${CSS.escape(id)}`);
  };
}

/** 把 bundle 里的 html/body/:root 收到宿主，避免污染整页看板。 */
export function rewriteBundleCss(css: string): string {
  return css.replace(/(^|})([^{}]+)\{/g, (_match, lead: string, selectors: string) => {
    const trimmed = selectors.trim();
    if (
      !trimmed ||
      trimmed.startsWith("@") ||
      trimmed.startsWith("from") ||
      trimmed.startsWith("to") ||
      /^\d/.test(trimmed)
    ) {
      return `${lead}${selectors}{`;
    }
    const next = trimmed
      .split(",")
      .map((raw) => {
        let sel = raw.trim();
        if (!sel) return sel;
        sel = sel.replace(/^:root\b/, HOST_SEL).replace(/^html\b/, HOST_SEL).replace(/^body\b/, HOST_SEL);
        if (sel.startsWith(HOST_SEL)) return sel;
        return `${HOST_SEL} ${sel}`;
      })
      .join(", ");
    return `${lead}${next}{`;
  });
}

function importStyle(styleEl: HTMLStyleElement): HTMLStyleElement {
  const clone = document.importNode(styleEl, true);
  clone.textContent = rewriteBundleCss(clone.textContent ?? "");
  return clone;
}

function runInsertedScriptIfNeeded(scriptEl: HTMLScriptElement, source: string): void {
  // 浏览器会执行 createElement('script') 后 append 的脚本；jsdom 默认不会。
  if (!/jsdom/i.test(navigator.userAgent)) return;
  const previous = Object.getOwnPropertyDescriptor(Document.prototype, "currentScript")
    ?? Object.getOwnPropertyDescriptor(document, "currentScript");
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    get: () => scriptEl,
  });
  try {
    // eslint-disable-next-line no-new-func -- 与浏览器执行 bundle 源码同路径
    new Function(source)();
  } finally {
    if (previous) {
      Object.defineProperty(document, "currentScript", previous);
    } else {
      delete (document as { currentScript?: unknown }).currentScript;
    }
  }
}

/** 把库里的 HTML 源码挂进主页面 Base（innerHTML 不会跑 script，需重建）。 */
export function mountCustomVizHtml(
  host: HTMLElement,
  html: string,
  options?: { styleHooks?: import("@/lib/customVizStyleHooks").CustomVizStyleHooks | null },
): () => void {
  host.replaceChildren();
  ensureCustomVizHostElementLookup(host);
  const styleHooks = options?.styleHooks ?? null;
  const detachRuntime = attachCustomVizRuntime(host, { styleHooks });
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();

  parsed.head.querySelectorAll("style").forEach((styleEl) => {
    fragment.appendChild(importStyle(styleEl));
  });

  const scripts: string[] = [];
  Array.from(parsed.body.childNodes).forEach((node) => {
    if (node.nodeName === "SCRIPT") {
      scripts.push((node as HTMLScriptElement).textContent ?? "");
      return;
    }
    if (node.nodeName === "STYLE") {
      fragment.appendChild(importStyle(node as HTMLStyleElement));
      return;
    }
    fragment.appendChild(document.importNode(node, true));
  });

  host.appendChild(fragment);
  for (const source of scripts) {
    const script = document.createElement("script");
    script.textContent = source;
    host.appendChild(script);
    try {
      runInsertedScriptIfNeeded(script, source);
    } catch (error) {
      detachRuntime();
      host.replaceChildren();
      throw error instanceof Error ? error : new Error("自定义组件脚本执行失败");
    }
  }

  appendCustomVizStyleBridge(host, styleHooks);

  return () => {
    detachRuntime();
    host.replaceChildren();
  };
}

export function customVizHostStyle(
  dashboardStyle?: DashboardStyleConfig,
  config?: CustomVizWidgetConfig,
): CSSProperties {
  const scheme = dashboardStyle?.colorScheme ?? "light";
  const vars = themeTokensToScopeVars(getDashboardThemeTokens(scheme));
  const palette = resolveCustomVizEffectivePaletteColors(config, dashboardStyle);
  const fontFamily = dashboardStyle?.fontFamily?.trim();
  const next: Record<string, string> = { ...vars };
  palette.forEach((color, index) => {
    next[`--vs-palette-${index}`] = color;
  });
  if (palette[0]) next["--vs-d3-accent"] = palette[0];
  if (fontFamily) next["--dashboard-font-family"] = fontFamily;
  return {
    ...next,
    height: "100%",
    minHeight: 64,
    overflow: "hidden",
    color: vars["--dashboard-text-primary"],
    background: "transparent",
    fontFamily: fontFamily || "inherit",
  } as CSSProperties;
}

type HostErrorBoundaryProps = { children: ReactNode };

type HostErrorBoundaryState = { message: string | null };

export class CustomVizHostErrorBoundary extends Component<
  HostErrorBoundaryProps,
  HostErrorBoundaryState
> {
  state: HostErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: Error): HostErrorBoundaryState {
    return { message: error.message || "自定义组件渲染失败" };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    void error;
  }

  render(): ReactNode {
    if (this.state.message) {
      return (
        <div className="flex h-full min-h-[64px] items-center justify-center px-3 text-center text-theme-xs text-gray-500 dark:text-gray-400">
          {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
