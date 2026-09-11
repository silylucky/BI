/**
 * GapPolicy — 看板组件间隙 deep module（单源 preset 表 + normalize + patch + resolve）。
 * 对标 DataEase gap + gapSize；布局坐标不变，shell padding 透出画板。
 */

export const GAP_PRESET_PX = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
} as const;

/** 像素画布间隙上限（预设 lg=10；自定义滑块可至 PIXEL_GAP_CUSTOM_MAX） */
export const PIXEL_GAP_PRESET_PX = {
  none: 0,
  sm: 2,
  md: 5,
  lg: 10,
} as const;

/** 像素画布自定义间隙滑块上限（超出 DataEase 0–10，满足大屏留白需求） */
export const PIXEL_GAP_CUSTOM_MAX = 24;
export const GRID_GAP_CUSTOM_MAX = 48;

export type GapPreset = keyof typeof GAP_PRESET_PX | "custom";

export type GapConfigInput = {
  gapPreset?: GapPreset;
  widgetGap?: number;
  pixelGutter?: number;
};

export const DEFAULT_WIDGET_GAP = 8;
export const DEFAULT_PIXEL_GUTTER = 0;
export const DEFAULT_CUSTOM_PIXEL_GAP = 3;
export const DEFAULT_CUSTOM_GRID_GAP = 6;

export const DASHBOARD_SHAPE_GAP_VAR = "--dashboard-shape-gap";

export type DashboardGapUiState = {
  hasGap: boolean;
  preset: GapPreset;
  customPx: number;
  customMax: number;
};

export type GapPatchAction =
  | { type: "toggle"; hasGap: boolean }
  | { type: "preset"; preset: Exclude<GapPreset, "custom"> | "custom" }
  | { type: "customPx"; px: number };

function gapPresetFields(
  preset: Exclude<GapPreset, "custom">,
): Required<Pick<GapConfigInput, "gapPreset" | "widgetGap" | "pixelGutter">> {
  if (preset === "none") {
    return { gapPreset: "none", widgetGap: 0, pixelGutter: 0 };
  }
  return {
    gapPreset: preset,
    widgetGap: GAP_PRESET_PX[preset],
    pixelGutter: PIXEL_GAP_PRESET_PX[preset],
  };
}

export function inferWidgetGapPreset(gap: number): GapPreset {
  if (gap <= 0) return "none";
  for (const [key, px] of Object.entries(GAP_PRESET_PX)) {
    if (key !== "none" && px === gap) return key as GapPreset;
  }
  return "custom";
}

export function inferPixelGapPreset(gutter: number): GapPreset {
  if (gutter <= 0) return "none";
  for (const [key, px] of Object.entries(PIXEL_GAP_PRESET_PX)) {
    if (key !== "none" && px === gutter) return key as GapPreset;
  }
  return "custom";
}

export function resolveWidgetGap(config: GapConfigInput): number {
  if (config.gapPreset === "none") return 0;
  const preset = config.gapPreset;
  if (preset && preset !== "custom" && preset in GAP_PRESET_PX) {
    return GAP_PRESET_PX[preset as keyof typeof GAP_PRESET_PX];
  }
  if (config.gapPreset === "custom") {
    return Math.max(0, config.widgetGap ?? DEFAULT_CUSTOM_GRID_GAP);
  }
  if (config.widgetGap != null) {
    return Math.max(0, config.widgetGap);
  }
  return DEFAULT_PIXEL_GUTTER;
}

export function resolvePixelGutter(config: GapConfigInput): number {
  if (config.gapPreset === "none") return 0;
  const preset = config.gapPreset;
  if (preset && preset !== "custom" && preset in PIXEL_GAP_PRESET_PX) {
    return PIXEL_GAP_PRESET_PX[preset as keyof typeof PIXEL_GAP_PRESET_PX];
  }
  if (config.gapPreset === "custom") {
    return Math.min(PIXEL_GAP_CUSTOM_MAX, Math.max(0, config.pixelGutter ?? DEFAULT_CUSTOM_PIXEL_GAP));
  }
  if (config.pixelGutter != null) {
    return Math.min(PIXEL_GAP_CUSTOM_MAX, Math.max(0, config.pixelGutter));
  }
  return DEFAULT_PIXEL_GUTTER;
}

export function resolveDashboardComponentGap(
  config: GapConfigInput,
  options: { pixel?: boolean } = {},
): number {
  return options.pixel ? resolvePixelGutter(config) : resolveWidgetGap(config);
}

export function normalizeDashboardGapConfig<T extends GapConfigInput>(config: T): T {
  if (config.gapPreset === "none") {
    return { ...config, gapPreset: "none", pixelGutter: 0, widgetGap: 0 };
  }

  if (config.gapPreset && config.gapPreset !== "custom" && config.gapPreset in GAP_PRESET_PX) {
    return { ...config, ...gapPresetFields(config.gapPreset as Exclude<GapPreset, "custom">) };
  }

  if (config.gapPreset === "custom") {
    return {
      ...config,
      gapPreset: "custom",
      widgetGap: Math.max(0, config.widgetGap ?? DEFAULT_CUSTOM_GRID_GAP),
      pixelGutter: Math.min(
        PIXEL_GAP_CUSTOM_MAX,
        Math.max(0, config.pixelGutter ?? DEFAULT_CUSTOM_PIXEL_GAP),
      ),
    };
  }

  const widgetGap = config.widgetGap ?? 0;
  const pixelGutter = config.pixelGutter ?? 0;
  const hasWidget = config.widgetGap != null && widgetGap > 0;
  const hasPixel = config.pixelGutter != null && pixelGutter > 0;

  if (!hasWidget && !hasPixel) {
    return { ...config, gapPreset: "none", pixelGutter: 0, widgetGap: 0 };
  }

  if (hasWidget && !hasPixel) {
    // widgetGap 为栅格 v1 遗留；像素 shell 不随其推断 md/5px（避免「莫名」绿条）
    return { ...config, gapPreset: "none", widgetGap, pixelGutter: 0 };
  }

  if (hasPixel && !hasWidget) {
    const inferred = inferPixelGapPreset(pixelGutter);
    if (inferred !== "custom") {
      return { ...config, ...gapPresetFields(inferred) };
    }
    return {
      ...config,
      gapPreset: "custom",
      widgetGap: pixelGutter,
      pixelGutter,
    };
  }

  const gridInferred = inferWidgetGapPreset(widgetGap);
  const pixelInferred = inferPixelGapPreset(pixelGutter);
  if (gridInferred === pixelInferred && gridInferred !== "custom") {
    return { ...config, ...gapPresetFields(gridInferred) };
  }

  return {
    ...config,
    gapPreset: "custom",
    widgetGap,
    pixelGutter: Math.min(PIXEL_GAP_CUSTOM_MAX, pixelGutter),
  };
}

export const normalizeDashboardGapForPersist = normalizeDashboardGapConfig;

export function resolveDashboardGapUiState(
  config: GapConfigInput,
  options: { pixel?: boolean } = {},
): DashboardGapUiState {
  const pixel = options.pixel === true;
  const customMax = pixel ? PIXEL_GAP_CUSTOM_MAX : GRID_GAP_CUSTOM_MAX;
  const presetMap = pixel ? PIXEL_GAP_PRESET_PX : GAP_PRESET_PX;

  if (config.gapPreset === "none") {
    return {
      hasGap: false,
      preset: "none",
      customPx: pixel ? config.pixelGutter ?? 0 : config.widgetGap ?? 0,
      customMax,
    };
  }

  if (config.gapPreset === "custom") {
    const customPx = pixel
      ? Math.min(customMax, Math.max(0, config.pixelGutter ?? DEFAULT_CUSTOM_PIXEL_GAP))
      : Math.min(customMax, Math.max(0, config.widgetGap ?? DEFAULT_CUSTOM_GRID_GAP));
    return { hasGap: true, preset: "custom", customPx, customMax };
  }

  if (config.gapPreset && config.gapPreset in presetMap) {
    const px = presetMap[config.gapPreset as keyof typeof presetMap];
    return { hasGap: px > 0, preset: config.gapPreset, customPx: px, customMax };
  }

  const gapPx = pixel ? resolvePixelGutter(config) : resolveWidgetGap(config);
  const inferred = pixel ? inferPixelGapPreset(gapPx) : inferWidgetGapPreset(gapPx);
  return {
    hasGap: gapPx > 0,
    preset: inferred,
    customPx: pixel ? (config.pixelGutter ?? gapPx) : (config.widgetGap ?? gapPx),
    customMax,
  };
}

function isPresetGapPx(px: number, pixel: boolean): boolean {
  const map = pixel ? PIXEL_GAP_PRESET_PX : GAP_PRESET_PX;
  return Object.entries(map).some(([key, value]) => key !== "none" && value === px);
}

function defaultCustomGapPx(config: GapConfigInput, pixel: boolean): number {
  const current = pixel ? config.pixelGutter ?? 0 : config.widgetGap ?? 0;
  const fallback = pixel ? DEFAULT_CUSTOM_PIXEL_GAP : DEFAULT_CUSTOM_GRID_GAP;
  if (current > 0 && !isPresetGapPx(current, pixel)) return current;
  return fallback;
}

export function buildDashboardGapPatch(
  config: GapConfigInput,
  action: GapPatchAction,
  options: { pixel?: boolean } = {},
): Partial<GapConfigInput> {
  const pixel = options.pixel === true;

  if (action.type === "toggle") {
    return action.hasGap ? gapPresetFields("md") : gapPresetFields("none");
  }

  if (action.type === "preset") {
    if (action.preset === "custom") {
      return {
        gapPreset: "custom",
        widgetGap: defaultCustomGapPx(config, false),
        pixelGutter: defaultCustomGapPx(config, true),
      };
    }
    return gapPresetFields(action.preset);
  }

  const px = Math.max(0, Math.min(pixel ? PIXEL_GAP_CUSTOM_MAX : GRID_GAP_CUSTOM_MAX, action.px));
  if (px <= 0) return gapPresetFields("none");

  return pixel
    ? {
        gapPreset: "custom",
        pixelGutter: px,
        widgetGap: config.widgetGap ?? px,
      }
    : {
        gapPreset: "custom",
        widgetGap: px,
        pixelGutter: config.pixelGutter ?? Math.min(PIXEL_GAP_CUSTOM_MAX, px),
      };
}

/** FE/BE parity 契约表（单源）；后端 gap_policy.py 须同步 */
export const GAP_POLICY_PRESET_TABLE = {
  grid: GAP_PRESET_PX,
  pixel: PIXEL_GAP_PRESET_PX,
} as const;
