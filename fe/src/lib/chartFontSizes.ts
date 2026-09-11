/** 看板/图表检查器统一字号档位：6–24 逐档 + 26–48 偶数档（覆盖小标签到标题/KPI） */
export const CHART_FONT_SIZE_OPTIONS: readonly number[] = (() => {
  const sizes: number[] = [];
  for (let n = 6; n <= 24; n += 1) sizes.push(n);
  for (let n = 26; n <= 48; n += 2) sizes.push(n);
  return sizes;
})();

export type ChartFontSizeOption = number;

/** 当前值不在预设档位时，追加后排序（保留历史配置可编辑） */
export function resolveChartFontSizeOptions(
  current: number | undefined,
  fallback: number,
  base: readonly number[] = CHART_FONT_SIZE_OPTIONS,
): number[] {
  const size = current ?? fallback;
  if (base.includes(size)) return [...base];
  return [...base, size].sort((a, b) => a - b);
}
