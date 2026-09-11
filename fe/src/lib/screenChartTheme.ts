type EChartsOption = Record<string, unknown>;

const SCREEN_AXIS_LABEL = "rgba(255,255,255,0.72)";
const SCREEN_AXIS_LINE = "rgba(255,255,255,0.2)";
const SCREEN_GRID_LINE = "rgba(255,255,255,0.12)";
const SCREEN_LEGEND = "rgba(255,255,255,0.75)";

function patchAxis(axis: EChartsOption["xAxis"]): EChartsOption["xAxis"] {
  if (!axis) return axis;
  const patchOne = (item: Record<string, unknown>) => ({
    ...item,
    axisLabel: {
      ...(typeof item.axisLabel === "object" ? item.axisLabel : {}),
      color: SCREEN_AXIS_LABEL,
    },
    axisLine: {
      ...(typeof item.axisLine === "object" ? item.axisLine : {}),
      lineStyle: {
        ...(typeof item.axisLine === "object" &&
        item.axisLine &&
        typeof (item.axisLine as { lineStyle?: object }).lineStyle === "object"
          ? (item.axisLine as { lineStyle: object }).lineStyle
          : {}),
        color: SCREEN_AXIS_LINE,
      },
    },
    splitLine: {
      ...(typeof item.splitLine === "object" ? item.splitLine : {}),
      lineStyle: {
        ...(typeof item.splitLine === "object" &&
        item.splitLine &&
        typeof (item.splitLine as { lineStyle?: object }).lineStyle === "object"
          ? (item.splitLine as { lineStyle: object }).lineStyle
          : {}),
        color: SCREEN_GRID_LINE,
        opacity: 0.35,
      },
    },
  });
  if (Array.isArray(axis)) return axis.map((item) => patchOne(item as Record<string, unknown>));
  return patchOne(axis as Record<string, unknown>);
}

/** 数据大屏深色投放：强化轴/图例/grid 对比度（仅 surfaceKind=data-screen） */
export function applyDataScreenSurfaceToEchartsOption(option: EChartsOption): EChartsOption {
  const next: EChartsOption = { ...option };
  next.xAxis = patchAxis(next.xAxis);
  next.yAxis = patchAxis(next.yAxis);
  if (next.legend && typeof next.legend === "object" && !Array.isArray(next.legend)) {
    next.legend = {
      ...next.legend,
      textStyle: {
        ...(typeof next.legend.textStyle === "object" ? next.legend.textStyle : {}),
        color: SCREEN_LEGEND,
      },
    };
  }
  if (next.grid && typeof next.grid === "object" && !Array.isArray(next.grid)) {
    next.grid = {
      ...next.grid,
      borderColor: SCREEN_GRID_LINE,
    };
  }
  return next;
}

export function isDataScreenSurfaceKind(
  surfaceKind?: string | null,
): boolean {
  return surfaceKind === "data-screen";
}

export const DATA_SCREEN_THEME_FINGERPRINT = "data-screen-v1";
