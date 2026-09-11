export type CustomVizStyleHookProperty =
  | "background"
  | "color"
  | "height"
  | "gap"
  | "font-size"
  | "opacity";

export type CustomVizStyleHookDef = {
  cssVar?: string;
  selectors?: string[];
  property?: CustomVizStyleHookProperty;
  hideWhenFalse?: boolean;
  hideSelectors?: string[];
};

export type CustomVizStyleHooks = Record<string, CustomVizStyleHookDef>;

const HOST_CLASS = "vs-custom-viz-host";

export function styleSchemaKeyToCssVar(key: string, cssVar?: string): string {
  if (cssVar?.trim()) {
    const trimmed = cssVar.trim();
    return trimmed.startsWith("--") ? trimmed : `--${trimmed}`;
  }
  const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
  return `--vs-style-${kebab}`;
}

export function styleSchemaKeyToDataAttr(key: string): string {
  return `data-vs-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

function inferHookProperty(key: string): CustomVizStyleHookProperty {
  if (/color|Color|fg|Fg|accent/i.test(key)) return "background";
  if (/height|Height/i.test(key)) return "height";
  if (/gap|Gap|spacing/i.test(key)) return "gap";
  if (/font|Font|size|Size/i.test(key)) return "font-size";
  if (/opacity|Opacity/i.test(key)) return "opacity";
  return "color";
}

function cssPropertyValue(property: CustomVizStyleHookProperty, cssVar: string): string {
  switch (property) {
    case "background":
      return `var(${cssVar}, var(--vs-palette-0, var(--vs-d3-accent, #3b82f6)))`;
    case "height":
    case "gap":
      return `var(${cssVar}, inherit)`;
    case "font-size":
      return `calc(var(${cssVar}, 12) * 1px)`;
    case "opacity":
      return `calc(var(${cssVar}, 100) / 100)`;
    default:
      return `var(${cssVar}, inherit)`;
  }
}

/** 由 manifest.styleHooks 生成 Bridge CSS（自愿声明，覆盖 generic Bridge 猜测）。 */
export function buildCustomVizStyleHooksCss(hooks: CustomVizStyleHooks | undefined): string {
  if (!hooks) return "";
  const lines: string[] = [];

  for (const [key, hook] of Object.entries(hooks)) {
    if (!hook || typeof hook !== "object") continue;
    const dataAttr = styleSchemaKeyToDataAttr(key);

    if (hook.hideWhenFalse) {
      const hideSelectors = hook.hideSelectors ?? hook.selectors ?? [];
      for (const selector of hideSelectors) {
        const trimmed = selector.trim();
        if (!trimmed) continue;
        lines.push(
          `.${HOST_CLASS}[${dataAttr}="false"] ${trimmed} { display: none !important; }`,
        );
      }
      continue;
    }

    const selectors = hook.selectors ?? [];
    if (selectors.length === 0) continue;
    const cssVar = styleSchemaKeyToCssVar(key, hook.cssVar);
    const property = hook.property ?? inferHookProperty(key);
    const value = cssPropertyValue(property, cssVar);

    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      lines.push(`.${HOST_CLASS} ${trimmed} { ${property}: ${value} !important; }`);
    }
  }

  return lines.join("\n");
}

export function readCustomVizStyleHooks(
  manifest: Record<string, unknown> | undefined,
): CustomVizStyleHooks | undefined {
  const hooks = manifest?.styleHooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return undefined;
  return hooks as CustomVizStyleHooks;
}
