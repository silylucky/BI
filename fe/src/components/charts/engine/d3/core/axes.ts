import * as d3 from "d3";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { formatCompositeCategoryDisplay } from "@/components/charts/engine/buildDatasetEncoding";
import { VCDS, resolveAxisFontSize, scaleAxisLayoutPx } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { estimateLabelPixelWidth } from "@/components/charts/engine/d3/core/labelWidth";
import type { AxisLabelRotate } from "@/lib/chartDeStyleBlocks";

/** 数值轴：ASCII 数字估宽（与 estimateLabelPixelWidth 的 0.58 倍对齐） */
const ASCII_CHAR_PX_AT_11 = 7.15;
const CATEGORY_LABEL_GAP_BASE_PX = 12;
const CATEGORY_THINNING_MIN_BASE_PX = 48;
const CATEGORY_AXIS_TICK_SIZE_BASE = 6;
const CATEGORY_AXIS_TICK_PADDING_BASE = 10;

export function categoryBottomAxisTickSize(): number {
  return scaleAxisLayoutPx(CATEGORY_AXIS_TICK_SIZE_BASE);
}

export function categoryBottomAxisTickPadding(): number {
  return scaleAxisLayoutPx(CATEGORY_AXIS_TICK_PADDING_BASE);
}

export function categoryBottomAxisLabelY(): number {
  return categoryBottomAxisTickSize() + categoryBottomAxisTickPadding();
}

function axisAsciiCharPx(): number {
  return ASCII_CHAR_PX_AT_11 * (resolveAxisFontSize() / VCDS.axis.fontSize);
}

function categoryLabelGapPx(): number {
  return scaleAxisLayoutPx(CATEGORY_LABEL_GAP_BASE_PX);
}

function categoryThinningMinPx(): number {
  return scaleAxisLayoutPx(CATEGORY_THINNING_MIN_BASE_PX);
}

export type CategoryAxisLayout = {
  ticks: string[];
  rotateDeg: number;
  slotSpan: number;
  extraBottom: number;
};

export function estimateAxisLabelWidth(charCount: number, rotateDeg = 0): number {
  const w = charCount * axisAsciiCharPx();
  return rotateDeg ? projectedRotatedWidth(w, rotateDeg) : w;
}

/** 类目轴：按中英文字符真实占位估宽，旋转时取水平投影 */
export function estimateAxisLabelTextWidth(text: string, rotateDeg = 0): number {
  const fontSize = resolveAxisFontSize();
  const raw = estimateLabelPixelWidth(text, fontSize);
  return rotateDeg ? projectedRotatedWidth(raw, rotateDeg, fontSize) : raw;
}

function projectedRotatedWidth(textWidth: number, rotateDeg: number, fontSize = resolveAxisFontSize()): number {
  const rad = (Math.abs(rotateDeg) * Math.PI) / 180;
  return textWidth * Math.cos(rad) + fontSize * Math.sin(rad);
}

/** 固定索引步长抽稀：0, step, 2*step, …（末段不足 step 时不硬塞尾点，保证步长恒定） */
export function buildStrictUniformTickIndices(count: number, tickCount: number): number[] {
  if (count <= 0 || tickCount <= 0) return [];
  if (count <= tickCount) return Array.from({ length: count }, (_, i) => i);
  if (tickCount === 1) return [0];

  const step = Math.ceil((count - 1) / (tickCount - 1));
  const indices: number[] = [];
  for (let i = 0; i < count; i += step) {
    indices.push(i);
  }
  return indices;
}

function hasStrictUniformIndexGaps(indices: number[]): boolean {
  if (indices.length <= 1) return true;
  const gap = indices[1]! - indices[0]!;
  for (let j = 2; j < indices.length; j += 1) {
    if (indices[j]! - indices[j - 1]! !== gap) return false;
  }
  return true;
}

/** 均匀索引抽稀（固定步长；视口决定最多刻度数） */
export function pickCategoryTickIndices(count: number, innerSpan: number, minPx = 48): number[] {
  if (count <= 0 || innerSpan <= 0) return [];
  const maxTicks = Math.max(2, Math.floor(innerSpan / minPx));
  return buildStrictUniformTickIndices(count, maxTicks);
}

function indexToSpanPx(index: number, count: number, innerSpan: number): number {
  if (count <= 1) return innerSpan;
  return (index / (count - 1)) * innerSpan;
}

/** band 柱图类目中心像素（无 scale 时估算，padding≈0.1） */
export function estimateCategoryBandCenterPx(
  index: number,
  count: number,
  innerSpan: number,
  bandWidth?: number,
): number {
  if (count <= 0) return 0;
  if (count === 1) return innerSpan / 2;
  if (bandWidth != null && bandWidth > 0) {
    const step = (innerSpan - bandWidth) / (count - 1);
    return index * step + bandWidth / 2;
  }
  const step = innerSpan / count;
  return index * step + step * 0.4;
}

/** band 轴：与 buildStrictUniformTickIndices 同策略，索引步长恒定 */
export function pickCategoryTickIndicesByPixel(
  count: number,
  innerSpan: number,
  minPx: number,
  _indexToPx: (index: number) => number,
): number[] {
  if (count <= 0 || innerSpan <= 0) return [];
  const maxTicks = Math.max(2, Math.floor(innerSpan / minPx));
  return buildStrictUniformTickIndices(count, maxTicks);
}

function horizontalLabelWidthPx(label: string, rotateDeg: number): number {
  return estimateAxisLabelTextWidth(label, rotateDeg);
}

function labelWidthAtIndex(
  categories: string[],
  idx: number,
  labelFor: (category: string) => string,
  rotateDeg: number,
): number {
  const label = labelFor(categories[idx]!).trim();
  if (!label) return 0;
  return horizontalLabelWidthPx(label, rotateDeg);
}


function tickIndicesHaveNoOverlap(
  indices: number[],
  minGapPx: number,
  toPx: (index: number) => number,
  widthAt: (idx: number) => number,
): boolean {
  for (let j = 1; j < indices.length; j += 1) {
    const prev = indices[j - 1]!;
    const curr = indices[j]!;
    const prevW = widthAt(prev);
    const currW = widthAt(curr);
    if (prevW <= 0 && currW <= 0) continue;
    const minDist = (prevW + currW) / 2 + minGapPx;
    if (toPx(curr) - toPx(prev) < minDist) return false;
  }
  return true;
}

/**
 * 能全显则全显；必须抽稀时固定索引步长均匀取点；仍重叠则逐层减少刻度数再抽稀。
 * @param labelWidthAt 可选自定义宽度（分层轴各层最宽标签）
 */
export function pickUniformOverlapAwareTickIndices(
  count: number,
  categories: string[],
  labelFor: (category: string) => string,
  rotateDeg: number,
  minGapPx: number,
  toPx: (index: number) => number,
  labelWidthAt?: (idx: number) => number,
): number[] {
  if (count <= 0) return [];

  const widthAt =
    labelWidthAt ?? ((idx: number) => labelWidthAtIndex(categories, idx, labelFor, rotateDeg));
  const withLabel = Array.from({ length: count }, (_, i) => i).filter((i) => widthAt(i) > 0);
  if (withLabel.length === 0) return [0];

  const allIndices = Array.from({ length: count }, (_, i) => i);
  if (tickIndicesHaveNoOverlap(allIndices, minGapPx, toPx, widthAt)) {
    return allIndices;
  }

  for (let tickCount = count; tickCount >= 2; tickCount -= 1) {
    const indices = buildStrictUniformTickIndices(count, tickCount);
    if (indices.length < 2 || !hasStrictUniformIndexGaps(indices)) continue;
    if (tickIndicesHaveNoOverlap(indices, minGapPx, toPx, widthAt)) {
      return indices;
    }
  }

  return [withLabel[0]!];
}

/** band 轴：全显优先，否则均匀抽稀 */
export function pickCategoryTickIndicesForLabels(
  categories: string[],
  innerSpan: number,
  labelFor: (category: string) => string,
  minPx = categoryThinningMinPx(),
  rotateDeg = 0,
  indexToPx?: (index: number) => number,
): number[] {
  const count = categories.length;
  if (count === 0 || innerSpan <= 0) return [];

  const toPx =
    indexToPx ?? ((idx: number) => estimateCategoryBandCenterPx(idx, count, innerSpan));

  return pickUniformOverlapAwareTickIndices(
    count,
    categories,
    labelFor,
    rotateDeg,
    categoryLabelGapPx(),
    toPx,
  );
}

/** 在均匀抽稀结果上按标签宽度过滤，保证相邻标签像素间距 */
export function filterTickIndicesByLabelSpacing(
  categories: string[],
  indices: number[],
  innerSpan: number,
  labelFor: (category: string) => string,
  minGapPx = categoryLabelGapPx(),
  indexToPx?: (index: number) => number,
): number[] {
  if (indices.length === 0 || categories.length === 0) return indices;
  const toPx =
    indexToPx ??
    ((idx: number) => indexToSpanPx(idx, categories.length, innerSpan));
  const kept: number[] = [];

  for (const idx of indices) {
    const category = categories[idx];
    if (!category) continue;
    const label = labelFor(category).trim();
    if (!label) continue;

    const labelW = estimateAxisLabelTextWidth(label);
    const pos = toPx(idx);
    const prev = kept[kept.length - 1];
    if (prev != null) {
      const prevPos = toPx(prev);
      if (pos - prevPos < labelW + minGapPx) continue;
    }
    const slot =
      kept.length > 0 ? pos - toPx(kept[0]!) : innerSpan;
    if (!axisLabelFitsSlot(label, Math.max(slot, labelW + minGapPx), 0)) continue;
    kept.push(idx);
  }

  if (kept.length > 0) return kept;
  return indices.length > 0 ? [indices[0]!] : [];
}

/** 对标 DataEase：视口内抽稀轴刻度，不缩小绘图区 */
export function pickCategoryTicks(categories: string[], innerSpan: number, minPx = 48): string[] {
  if (innerSpan <= 0 || categories.length === 0) return categories;
  const indices = pickCategoryTickIndices(categories.length, innerSpan, minPx);
  return indices.map((index) => categories[index]!);
}

/** 类目轴完整展示文案（不截断） */
export function axisCategoryDisplayText(label: string): string {
  return formatCompositeCategoryDisplay(label);
}

/** 槽位是否可容纳完整标签（对标 DataEase：放不下则隐藏，不用省略号） */
export function axisLabelFitsSlot(text: string, slotSpan: number, rotateDeg = 0): boolean {
  if (!text) return false;
  return estimateAxisLabelTextWidth(text, rotateDeg) <= slotSpan;
}

/** 按标签宽度过滤抽稀结果（均匀间距 + 像素防重叠） */
export function pickCategoryTicksForLabels(
  categories: string[],
  innerSpan: number,
  labelFor: (category: string) => string,
  minPx = categoryThinningMinPx(),
  rotateDeg = 0,
  indexToPx?: (index: number) => number,
): string[] {
  const indices = pickCategoryTickIndicesForLabels(
    categories,
    innerSpan,
    labelFor,
    minPx,
    rotateDeg,
    indexToPx,
  );
  if (indices.length === 0) {
    return categories.length > 0 ? [categories[0]!] : [];
  }
  return indices.map((index) => categories[index]!);
}

function resolveAutoCategoryLabelRotate(tickLabels: string[], innerSpan: number): number {
  if (tickLabels.length === 0 || innerSpan <= 0) return 0;

  const slot = innerSpan / tickLabels.length;
  const estWidth = Math.max(...tickLabels.map((t) => estimateAxisLabelTextWidth(String(t))));

  if (estWidth > slot * 1.4) return -45;
  if (estWidth > slot * 0.82) return VCDS.axis.rotateDeg;
  if (tickLabels.length >= 3 && slot < scaleAxisLayoutPx(VCDS.axis.rotateThreshold)) return VCDS.axis.rotateDeg;
  return 0;
}

export function resolveCategoryLabelRotate(
  tickLabels: string[],
  innerSpan: number,
  explicitRotate?: AxisLabelRotate,
): number {
  if (explicitRotate === "auto") return resolveAutoCategoryLabelRotate(tickLabels, innerSpan);
  if (explicitRotate == null) return 0;
  return explicitRotate;
}

export function resolveRotatedAxisExtraSpan(rotateDeg: number): number {
  if (!rotateDeg) return 0;
  return scaleAxisLayoutPx(rotateDeg <= -40 ? 28 : 18);
}

/** 首尾类目标签超出绘图区时补边，避免压住 Y 轴刻度 */
export function categoryAxisEdgePad(
  ticks: string[],
  rotateDeg: number,
): { left: number; right: number } {
  if (ticks.length === 0) return { left: 0, right: 0 };
  const first = estimateAxisLabelTextWidth(axisCategoryDisplayText(ticks[0]!), rotateDeg);
  const last = estimateAxisLabelTextWidth(
    axisCategoryDisplayText(ticks[ticks.length - 1]!),
    rotateDeg,
  );
  if (rotateDeg) {
    return {
      left: Math.min(scaleAxisLayoutPx(40), Math.round(first * 0.5)),
      right: scaleAxisLayoutPx(10),
    };
  }
  return {
    left: Math.max(0, Math.round(first / 2) - scaleAxisLayoutPx(6)),
    right: Math.max(0, Math.round(last / 2) - scaleAxisLayoutPx(6)),
  };
}

/** 对标 DataEase：槽位足够时展示完整类目名，不足则隐藏（不截断为省略号） */
export function formatAxisCategoryLabel(label: string, slotSpan = 48, rotateDeg = 0): string {
  const display = axisCategoryDisplayText(label);
  if (!axisLabelFitsSlot(display, slotSpan, rotateDeg)) return "";
  return display;
}

/** 横向柱图 / 热力图行轴：宽度不足时隐藏 */
export function formatHorizontalBandAxisLabel(
  label: string,
  maxWidthPx = 120,
  rotateDeg = 0,
): string {
  const display = axisCategoryDisplayText(label);
  if (!axisLabelFitsSlot(display, maxWidthPx, rotateDeg)) return "";
  return display;
}

export function planCategoryAxisLayout(
  categories: string[],
  innerSpan: number,
  explicitRotate?: AxisLabelRotate,
  minPx = categoryThinningMinPx(),
  bandWidth?: number,
): CategoryAxisLayout {
  const count = categories.length;
  const indexToPx = (idx: number) =>
    estimateCategoryBandCenterPx(idx, count, innerSpan, bandWidth);
  const allLabels = categories.map((category) => axisCategoryDisplayText(String(category)));
  const rotateDeg = resolveCategoryLabelRotate(allLabels, innerSpan, explicitRotate);
  const tickIndices = pickCategoryTickIndicesForLabels(
    categories,
    innerSpan,
    (category) => axisCategoryDisplayText(String(category)),
    minPx,
    rotateDeg,
    indexToPx,
  );
  const ticks = tickIndices.map((index) => categories[index]!);
  const slotSpan = innerSpan / Math.max(1, tickIndices.length);
  return {
    ticks,
    rotateDeg,
    slotSpan,
    extraBottom: resolveRotatedAxisExtraSpan(rotateDeg),
  };
}

/** 数据显示优先：数值轴尽量多刻度 */
export function resolveNumericTickCount(innerSpan: number, min = 4, max = 12): number {
  if (innerSpan <= 0) return min;
  return Math.max(min, Math.min(max, Math.floor(innerSpan / scaleAxisLayoutPx(48))));
}

/** 折线/面积纵轴上界：在数据最大值之上预留 headroom，避免点标记贴顶被 clip 裁切 */
export function valueAxisUpperBound(maxVal: number, headroomRatio = 0.12): number {
  const safeMax = Number.isFinite(maxVal) ? Math.max(0, maxVal) : 0;
  if (safeMax <= 0) return 1;
  if (safeMax <= 4) return safeMax + 1;
  return safeMax * (1 + headroomRatio);
}

const NUMERIC_TICK_LABEL_GAP_BASE_PX = 8;
const NUMERIC_TICK_MIN_LABEL_BASE_PX = 44;

function sampleNumericDomain(scale: d3.ScaleLinear<number, number>): number[] {
  const [a, b] = scale.domain();
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const mid = (lo + hi) / 2;
  const samples = [lo, hi, mid];
  if (lo <= 0 && hi >= 0) samples.push(0);
  return [...new Set(samples)];
}

/** 按格式化后标签宽度抽稀数值轴刻度（对标类目轴 pickCategoryTicks） */
export function planNumericAxisTicks(
  scale: d3.ScaleLinear<number, number>,
  innerSpan: number,
  formatLabel: (value: d3.NumberValue) => string,
  options?: { minTicks?: number; maxTicks?: number; minLabelPx?: number },
): number[] {
  const minTicks = options?.minTicks ?? 2;
  const maxTicks = options?.maxTicks ?? 12;
  const minLabelPx = options?.minLabelPx ?? scaleAxisLayoutPx(NUMERIC_TICK_MIN_LABEL_BASE_PX);
  if (innerSpan <= 0) return scale.ticks(minTicks);

  const maxLabelW = Math.max(
    minLabelPx,
    ...sampleNumericDomain(scale).map(
      (v) => estimateAxisLabelWidth(formatLabel(v).length) + scaleAxisLayoutPx(NUMERIC_TICK_LABEL_GAP_BASE_PX),
    ),
  );
  const capacity = Math.max(minTicks, Math.min(maxTicks, Math.floor(innerSpan / maxLabelW)));
  const ticks = scale.ticks(capacity);
  if (ticks.length <= capacity) return ticks;

  const step = Math.ceil(ticks.length / capacity);
  const picked: number[] = [];
  for (let i = 0; i < ticks.length; i += step) picked.push(ticks[i]!);
  const last = ticks[ticks.length - 1]!;
  if (picked[picked.length - 1] !== last) picked.push(last);
  return picked;
}

/** 去掉格式化后重复的数值轴刻度（小整数域如 0–1 时避免 0 0 0 1 1 1） */
export function distinctFormattedNumericTickValues(
  scale: d3.ScaleLinear<number, number>,
  innerSpan: number,
  formatLabel: (value: d3.NumberValue) => string,
  options?: { minTicks?: number; maxTicks?: number; minLabelPx?: number },
): number[] {
  const candidates = planNumericAxisTicks(scale, innerSpan, formatLabel, options);
  if (candidates.length <= 2) return candidates;

  const [d0, d1] = scale.domain();
  const min = Math.min(d0, d1);
  const max = Math.max(d0, d1);
  const seen = new Set<string>();
  const picked: number[] = [];

  const push = (tick: number) => {
    const label = formatLabel(tick);
    if (!label || seen.has(label)) return;
    seen.add(label);
    picked.push(tick);
  };

  push(min);
  for (const tick of candidates) {
    if (tick === min || tick === max) continue;
    push(tick);
  }
  push(max);

  return picked.length >= 2 ? picked : candidates;
}

/** 类目 band 过窄时缩小轴标签字号，但不隐藏 */
export function resolveBandAxisFontSize(bandHeight: number, base = resolveAxisFontSize()): number {
  if (bandHeight >= 13) return base;
  return Math.max(7, Math.min(base, Math.floor(bandHeight * 0.85)));
}

/** 柱上数值标签：随 band 高度缩小，但不跳过 */
export function resolveBarLabelFontSize(bandSpan: number, preferred = 11): number {
  if (bandSpan >= 12) return preferred;
  return Math.max(7, Math.min(preferred, Math.floor(bandSpan * 0.85)));
}

export type HorizontalCategoryAxisLayout = {
  ticks: string[];
  leftMargin: number;
  bandHeight: number;
  labelMaxWidth: number;
  rotateDeg: number;
};

/** 横向柱图左侧类目轴：抽稀刻度 + 按最长标签估算左边距 */
export function resolveHorizontalCategoryAxisLayout(
  categories: string[],
  innerH: number,
  minPx = 28,
  explicitRotate?: AxisLabelRotate,
): HorizontalCategoryAxisLayout {
  if (categories.length === 0 || innerH <= 0) {
    return { ticks: [], leftMargin: scaleAxisLayoutPx(52), bandHeight: 0, labelMaxWidth: 120, rotateDeg: 0 };
  }

  const bandHeight = innerH / categories.length;
  const allLabels = categories.map((category) => axisCategoryDisplayText(String(category)));
  const rotateDeg = resolveCategoryLabelRotate(allLabels, innerH, explicitRotate);
  const indexToPx = (idx: number) =>
    estimateCategoryBandCenterPx(idx, categories.length, innerH);
  const tickIndices = pickCategoryTickIndicesForLabels(
    categories,
    innerH,
    (category) => axisCategoryDisplayText(String(category)),
    minPx,
    rotateDeg,
    indexToPx,
  );
  const ticks = tickIndices.map((index) => categories[index]!);
  const labelMaxWidth = categories.reduce((max, cat) => {
    const label = formatCompositeCategoryDisplay(String(cat));
    return Math.max(max, estimateAxisLabelTextWidth(label, rotateDeg));
  }, 0);
  const extraLeft = resolveRotatedAxisExtraSpan(rotateDeg);
  const leftMargin = Math.max(scaleAxisLayoutPx(52), labelMaxWidth + scaleAxisLayoutPx(18)) + extraLeft;

  return { ticks, leftMargin, bandHeight, labelMaxWidth, rotateDeg };
}

export function styleAxis(
  sel: d3.Selection<SVGGElement, unknown, null, undefined>,
  theme: AntvThemeTokens,
  fontSize = resolveAxisFontSize(),
  sideStyle?: { lineColor?: string; lineWidth?: number },
) {
  sel
    .selectAll("text")
    .attr("fill", theme.axisLabel)
    .style("font-size", `${fontSize}px`)
    .style("font-family", "inherit");
  const stroke = sideStyle?.lineColor ?? theme.axisLine;
  const strokeWidth = sideStyle?.lineWidth ?? 1;
  sel.select(".domain").attr("stroke", stroke).attr("stroke-width", strokeWidth);
  sel.selectAll(".tick line").attr("stroke", stroke).attr("stroke-width", strokeWidth);
}

export function applyRotatedCategoryLabels(
  sel: d3.Selection<SVGGElement, unknown, null, undefined>,
  rotateDeg: number,
) {
  if (!rotateDeg) return;
  sel
    .selectAll("text")
    .attr("transform", function () {
      const x = Number(d3.select(this).attr("x") ?? 0);
      const y = Number(d3.select(this).attr("y") ?? 0);
      return `rotate(${rotateDeg}, ${x}, ${y})`;
    })
    .style("text-anchor", "end")
    .attr("dx", "-0.2em")
    .attr("dy", "0.65em");
}

export function applyRotatedLeftCategoryLabels(
  sel: d3.Selection<SVGTextElement, unknown, null, undefined>,
  rotateDeg: number,
) {
  if (!rotateDeg) return;
  sel.attr("transform", function () {
    const x = Number(d3.select(this).attr("x") ?? 0);
    const y = Number(d3.select(this).attr("y") ?? 0);
    return `rotate(${rotateDeg}, ${x}, ${y})`;
  });
}

type CategoryBandAxisSideStyle = { lineColor?: string; lineWidth?: number };

/** 对标 DataEase：类目标签锚定在 band 中心，而非 d3 axis 默认左缘 */
export function drawCategoryBandAxisBottom(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleBand<string>,
  innerW: number,
  ticks: string[],
  rotateDeg: number,
  theme: AntvThemeTokens,
  sideStyle?: CategoryBandAxisSideStyle,
): void {
  const bw = xScale.bandwidth();
  const stroke = sideStyle?.lineColor ?? theme.axisLine;
  const strokeWidth = sideStyle?.lineWidth ?? 1;
  const fontSize = resolveAxisFontSize();
  const axisRoot = g.append("g").attr("class", "vs-axis-x");

  axisRoot
    .append("line")
    .attr("class", "domain")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);

  for (const tick of ticks) {
    const bandX = xScale(tick);
    if (bandX == null) continue;
    const cx = bandX + bw / 2;
    const label = axisCategoryDisplayText(String(tick));
    if (!label) continue;

    axisRoot
      .append("line")
      .attr("class", "tick")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", 0)
      .attr("y2", categoryBottomAxisTickSize())
      .attr("stroke", stroke)
      .attr("stroke-width", strokeWidth);

    const labelY = categoryBottomAxisLabelY();
    const text = axisRoot
      .append("text")
      .attr("x", cx)
      .attr("y", labelY)
      .attr("fill", theme.axisLabel)
      .style("font-size", `${fontSize}px`)
      .style("font-family", "inherit")
      .text(label);

    if (rotateDeg) {
      text
        .attr("transform", `rotate(${rotateDeg}, ${cx}, ${labelY})`)
        .style("text-anchor", "end")
        .attr("dx", "-0.2em")
        .attr("dy", "0.65em");
    } else {
      text.attr("text-anchor", "middle");
    }
  }
}

/** 横向柱图：Y 轴类目标签锚定在 band 中心 */
export function drawCategoryBandAxisLeft(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  yScale: d3.ScaleBand<string>,
  innerH: number,
  ticks: string[],
  labelMaxWidth: number,
  theme: AntvThemeTokens,
  fontSize = resolveBandAxisFontSize(innerH / Math.max(1, yScale.domain().length)),
  sideStyle?: CategoryBandAxisSideStyle,
  rotateDeg = 0,
): void {
  const bh = yScale.bandwidth();
  const stroke = sideStyle?.lineColor ?? theme.axisLine;
  const strokeWidth = sideStyle?.lineWidth ?? 1;
  const axisRoot = g.append("g").attr("class", "vs-axis-y");

  axisRoot
    .append("line")
    .attr("class", "domain")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);

  for (const tick of ticks) {
    const bandY = yScale(tick);
    if (bandY == null) continue;
    const cy = bandY + bh / 2;
    const label = formatHorizontalBandAxisLabel(String(tick), labelMaxWidth, rotateDeg);
    if (!label) continue;

    axisRoot
      .append("line")
      .attr("class", "tick")
      .attr("x1", -6)
      .attr("x2", 0)
      .attr("y1", cy)
      .attr("y2", cy)
      .attr("stroke", stroke)
      .attr("stroke-width", strokeWidth);

    const text = axisRoot
      .append("text")
      .attr("x", -8)
      .attr("y", cy)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${fontSize}px`)
      .style("font-family", "inherit")
      .text(label);
    applyRotatedLeftCategoryLabels(text, rotateDeg);
  }
}
