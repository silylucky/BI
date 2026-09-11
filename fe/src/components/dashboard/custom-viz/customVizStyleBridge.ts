import {
  buildCustomVizStyleHooksCss,
  styleSchemaKeyToDataAttr,
  type CustomVizStyleHooks,
} from "@/lib/customVizStyleHooks";

export type { CustomVizStyleHooks };

export const CUSTOM_VIZ_STYLE_BRIDGE_CLASS = "vs-cv-style-bridge";
export const CUSTOM_VIZ_STYLE_HOOKS_CLASS = "vs-cv-style-hooks";

const HOST_CLASS = "vs-custom-viz-host";

function styleKeyToDataAttr(key: string): string {
  return styleSchemaKeyToDataAttr(key);
}

/**
 * Best-effort CSS bridge for bundles that hardcode colors/sizes instead of
 * reading payload.style / --vs-style-* (common in external AI artifacts).
 * Vars are set on the host by injectCustomVizPayload + customVizHostStyle.
 */
export const CUSTOM_VIZ_STYLE_BRIDGE_CSS = `
.${HOST_CLASS} .fill,
.${HOST_CLASS} .bar,
.${HOST_CLASS} .bar-fill,
.${HOST_CLASS} .progress,
.${HOST_CLASS} .progress-bar,
.${HOST_CLASS} .item .fill,
.${HOST_CLASS} [class*="bar-fill"],
.${HOST_CLASS} [class*="rank-bar"],
.${HOST_CLASS} [class*="progress-fill"] {
  background: var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #3b82f6))) !important;
  opacity: calc(var(--vs-style-fill-opacity, 100) / 100);
  border-radius: calc(var(--vs-style-corner-radius, 4) * 1px);
}
.${HOST_CLASS} .track,
.${HOST_CLASS} .bar-track,
.${HOST_CLASS} .bar-bg,
.${HOST_CLASS} .bar,
.${HOST_CLASS} [class*="bar-track"] {
  height: var(--vs-style-bar-height, inherit);
}
.${HOST_CLASS} .row,
.${HOST_CLASS} [class*="rank-row"],
.${HOST_CLASS} [class*="list-row"] {
  gap: var(--vs-style-gap, inherit);
  margin-bottom: var(--vs-style-gap, inherit);
}
.${HOST_CLASS} .lbl,
.${HOST_CLASS} .label,
.${HOST_CLASS} .name,
.${HOST_CLASS} [class*="rank-label"] {
  color: var(--vs-style-label-color, var(--dashboard-text-primary, inherit)) !important;
  font-size: calc(var(--vs-style-font-size, var(--vs-style-label-font-size, 12)) * 1px);
}
.${HOST_CLASS} .val,
.${HOST_CLASS} .value,
.${HOST_CLASS} .num,
.${HOST_CLASS} [class*="rank-value"] {
  color: var(--vs-style-label-color, var(--dashboard-text-muted, inherit));
  font-size: calc(var(--vs-style-font-size, 12) * 1px);
}
.${HOST_CLASS} .badge,
.${HOST_CLASS} [class*="rank-badge"],
.${HOST_CLASS} [class*="rank-num"] {
  font-size: calc(var(--vs-style-font-size, 14) * 1px);
}
.${HOST_CLASS} .card .val {
  color: var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #38bdf8))) !important;
}
.${HOST_CLASS}[data-vs-show-rank-badge="false"] .badge,
.${HOST_CLASS}[data-vs-show-rank-badge="false"] [class*="rank-badge"],
.${HOST_CLASS}[data-vs-show-rank-badge="false"] [class*="rank-num"] {
  display: none !important;
}
.${HOST_CLASS}[data-vs-show-value="false"] .val,
.${HOST_CLASS}[data-vs-show-value="false"] .value,
.${HOST_CLASS}[data-vs-show-value="false"] [class*="rank-value"] {
  display: none !important;
}
.${HOST_CLASS}[data-vs-label-show="false"] .lbl,
.${HOST_CLASS}[data-vs-label-show="false"] .label,
.${HOST_CLASS}[data-vs-label-show="false"] .name,
.${HOST_CLASS}[data-vs-label-show="false"] [class*="rank-label"],
.${HOST_CLASS}[data-vs-label-show="false"] .value-label,
.${HOST_CLASS}[data-vs-label-show="false"] .axis text {
  visibility: hidden !important;
}
.${HOST_CLASS} .trend-line,
.${HOST_CLASS} .trend-area,
.${HOST_CLASS} .latest-dot {
  stroke: var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #10b981))) !important;
}
.${HOST_CLASS} .trend-area,
.${HOST_CLASS} .latest-dot {
  fill: var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #10b981))) !important;
}
.${HOST_CLASS} .data-point {
  stroke: var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #10b981))) !important;
}
.${HOST_CLASS} .value-label,
.${HOST_CLASS} .axis text {
  fill: var(--vs-style-label-color, var(--dashboard-text-primary, inherit)) !important;
  font-size: calc(var(--vs-style-label-font-size, 11) * 1px);
}
.${HOST_CLASS} .tooltip,
.${HOST_CLASS} #tooltip {
  color: var(--vs-style-tooltip-color, var(--dashboard-text-primary, inherit)) !important;
  background: var(--vs-style-tooltip-background, rgba(15, 23, 42, 0.95)) !important;
  font-size: calc(var(--vs-style-tooltip-font-size, 12) * 1px);
}
.${HOST_CLASS}[data-vs-tooltip-show="false"] .tooltip,
.${HOST_CLASS}[data-vs-tooltip-show="false"] #tooltip {
  display: none !important;
  pointer-events: none !important;
}
.${HOST_CLASS}[data-vs-tooltip-show="false"] .data-point {
  pointer-events: none !important;
  cursor: default !important;
}
.${HOST_CLASS} .podium-value,
.${HOST_CLASS} .row-value {
  color: var(--vs-style-label-color, inherit) !important;
  font-size: calc(var(--vs-style-label-font-size, 12) * 1px);
}
.${HOST_CLASS}[data-vs-label-show="false"] .podium-value,
.${HOST_CLASS}[data-vs-label-show="false"] .row-value {
  display: none !important;
}
.${HOST_CLASS}[data-vs-series-gradient="true"] .fill,
.${HOST_CLASS}[data-vs-series-gradient="true"] .bar-fill,
.${HOST_CLASS}[data-vs-series-gradient="true"] .progress-fill,
.${HOST_CLASS}[data-vs-series-gradient="true"] [class*="bar-fill"],
.${HOST_CLASS}[data-vs-series-gradient="true"] [class*="progress-fill"] {
  background: linear-gradient(
    180deg,
    var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #3b82f6))) 0%,
    color-mix(in srgb, var(--vs-palette-0, var(--vs-style-accent-color, var(--vs-d3-accent, #3b82f6))) 55%, transparent) 100%
  ) !important;
}
`.trim();

const SVG_AREA_GRADIENT_SELECTORS =
  ".trend-area,[class*='area-fill'],.line-area-fill,path.area";

function resolveCustomVizBridgeAccentColor(
  host: HTMLElement,
  style: Record<string, unknown>,
): string {
  if (style.accentColor != null) return String(style.accentColor);
  if (Array.isArray(style.paletteColors) && style.paletteColors[0]) {
    return String(style.paletteColors[0]);
  }
  const inlineAccent = host.style.getPropertyValue("--vs-style-accent-color").trim();
  if (inlineAccent) return inlineAccent;
  const palette0 = getComputedStyle(host).getPropertyValue("--vs-palette-0").trim();
  if (palette0) return palette0;
  return "#3b82f6";
}

function ensureHostSeriesGradientId(host: HTMLElement): string {
  const existing = host.dataset.vsCvSeriesGradId;
  if (existing) return existing;
  const id = `vs-cv-series-grad-${Math.random().toString(36).slice(2, 10)}`;
  host.dataset.vsCvSeriesGradId = id;
  return id;
}

/** SVG 面积/区域填充：对齐内置 D3 seriesGradient（上深下浅） */
export function applyCustomVizSeriesGradientBridge(
  host: HTMLElement,
  style: Record<string, unknown> | undefined,
): void {
  if (!style) return;
  const enabled = style.seriesGradient === true;
  const accent = resolveCustomVizBridgeAccentColor(host, style);
  const gradId = ensureHostSeriesGradientId(host);

  host.querySelectorAll("svg").forEach((svg) => {
    const areas = svg.querySelectorAll<SVGGeometryElement>(SVG_AREA_GRADIENT_SELECTORS);
    if (!areas.length) return;

    const existingGrad = svg.querySelector(`#${CSS.escape(gradId)}`);
    existingGrad?.remove();

    if (!enabled) {
      areas.forEach((area) => {
        area.setAttribute("fill", accent);
        area.setAttribute("fill-opacity", "0.4");
      });
      return;
    }

    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }

    const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    gradient.setAttribute("id", gradId);
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "0%");
    gradient.setAttribute("y2", "100%");

    const stopTop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stopTop.setAttribute("offset", "0%");
    stopTop.setAttribute("stop-color", accent);
    stopTop.setAttribute("stop-opacity", "0.95");

    const stopBottom = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stopBottom.setAttribute("offset", "100%");
    stopBottom.setAttribute("stop-color", accent);
    stopBottom.setAttribute("stop-opacity", "0.55");

    gradient.appendChild(stopTop);
    gradient.appendChild(stopBottom);
    defs.appendChild(gradient);

    areas.forEach((area) => {
      area.setAttribute("fill", `url(#${gradId})`);
      area.setAttribute("fill-opacity", "1");
    });
  });
}

export function appendCustomVizStyleBridge(
  host: HTMLElement,
  styleHooks?: CustomVizStyleHooks | null,
): void {
  if (!host.querySelector(`.${CUSTOM_VIZ_STYLE_BRIDGE_CLASS}`)) {
    const style = document.createElement("style");
    style.className = CUSTOM_VIZ_STYLE_BRIDGE_CLASS;
    style.textContent = CUSTOM_VIZ_STYLE_BRIDGE_CSS;
    host.appendChild(style);
  }

  const hooksCss = buildCustomVizStyleHooksCss(styleHooks ?? undefined);
  let hooksEl = host.querySelector(`.${CUSTOM_VIZ_STYLE_HOOKS_CLASS}`) as HTMLStyleElement | null;
  if (!hooksCss) {
    hooksEl?.remove();
    return;
  }
  if (!hooksEl) {
    hooksEl = document.createElement("style");
    hooksEl.className = CUSTOM_VIZ_STYLE_HOOKS_CLASS;
    host.appendChild(hooksEl);
  }
  hooksEl.textContent = hooksCss;
}

/** Mirror payload.style onto host data-* hooks for generic CSS bridge rules. */
export function applyCustomVizStyleBridgeAttributes(
  host: HTMLElement,
  style: Record<string, unknown> | undefined,
): void {
  if (!style) return;
  for (const [key, value] of Object.entries(style)) {
    const attr = styleKeyToDataAttr(key);
    if (value === null || value === undefined) {
      host.removeAttribute(attr);
      continue;
    }
    host.setAttribute(attr, String(value));
  }
}

/** Post-render DOM tweaks for common schema keys external bundles often skip in JS. */
export function applyCustomVizStyleBridgeDom(
  host: HTMLElement,
  style: Record<string, unknown> | undefined,
  styleHooks?: CustomVizStyleHooks | null,
): void {
  applyCustomVizStyleBridgeAttributes(host, style);
  if (!style) return;

  const hideWhenFalse = [
    { key: "showRankBadge", selector: ".badge,[class*='rank-badge'],[class*='rank-num']" },
    { key: "showValue", selector: ".val,.value,[class*='rank-value']" },
    {
      key: "labelShow",
      selector:
        ".lbl,.label,.name,[class*='rank-label'],.value-label,.axis text,.podium-value,.row-value",
    },
    { key: "tooltipShow", selector: ".tooltip,#tooltip" },
  ] as const;

  for (const { key, selector } of hideWhenFalse) {
    const hook = styleHooks?.[key];
    const hookSelectors =
      hook?.hideWhenFalse && hook.hideSelectors?.length
        ? hook.hideSelectors.join(",")
        : selector;
    const flag = style[key];
    if (flag === false) {
      host.querySelectorAll(hookSelectors).forEach((node) => {
        (node as HTMLElement).style.display = "none";
      });
    } else if (flag === true) {
      host.querySelectorAll(hookSelectors).forEach((node) => {
        (node as HTMLElement).style.removeProperty("display");
      });
    }
  }

  applyCustomVizSeriesGradientBridge(host, style);
}
