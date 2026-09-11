import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import {
  CARTESIAN_CATEGORY_KEY_SEP,
  formatCategoryCellValue,
  inferCompositeCategoryLevels,
  sortCompositeCategoryKeys,
} from "@/components/charts/engine/buildDatasetEncoding";
import {
  axisCategoryDisplayText,
  categoryBottomAxisTickPadding,
  estimateAxisLabelTextWidth,
  estimateCategoryBandCenterPx,
  pickUniformOverlapAwareTickIndices,
  resolveCategoryLabelRotate,
} from "@/components/charts/engine/d3/core/axes";
import { resolveAxisFontSize, scaleAxisLayoutPx } from "@/components/charts/engine/d3/core/chartVisualTokens";
import type { AxisLabelRotate, ChartAxisStyle } from "@/lib/chartDeStyleBlocks";

const ROW_HEIGHT_BASE = 16;

type HierarchicalAxisPlanOptions = {
  /** 类别轴字段数下限（axes.xAxis），避免仅首维有值时层数被低估 */
  structuralLevelCount?: number;
};

export type HierarchicalAxisLayout = {
  levelCount: number;
  extraBottom: number;
  rowHeight: number;
};

export function resolveHierarchicalAxisLayout(activeLevelCount: number): HierarchicalAxisLayout {
  const rowHeight = scaleAxisLayoutPx(ROW_HEIGHT_BASE);
  if (activeLevelCount <= 1) {
    return { levelCount: 1, extraBottom: 0, rowHeight };
  }
  return {
    levelCount: activeLevelCount,
    extraBottom: activeLevelCount * rowHeight + scaleAxisLayoutPx(6) + categoryBottomAxisTickPadding(),
    rowHeight,
  };
}

export { inferCompositeCategoryLevels };

export function splitCompositeCategoryParts(key: string, levelCount: number): string[] {
  const parts = String(key).split(CARTESIAN_CATEGORY_KEY_SEP);
  while (parts.length < levelCount) parts.push("");
  return parts.slice(0, levelCount).map(formatCategoryPartLabel);
}

function formatCategoryPartLabel(part: string): string {
  return formatCategoryCellValue(part);
}

function prefixKey(parts: string[], level: number): string {
  return parts.slice(0, level + 1).join(CARTESIAN_CATEGORY_KEY_SEP);
}

export type CategoryAxisSegment = {
  start: number;
  end: number;
  label: string;
};

export function buildCategoryLevelSegments(
  categories: string[],
  level: number,
  levelCount: number,
): CategoryAxisSegment[] {
  const segments: CategoryAxisSegment[] = [];
  let index = 0;
  while (index < categories.length) {
    const parts = splitCompositeCategoryParts(categories[index]!, levelCount);
    const label = parts[level] ?? "";
    const groupKey = prefixKey(parts, level);
    let end = index;
    while (end + 1 < categories.length) {
      const nextParts = splitCompositeCategoryParts(categories[end + 1]!, levelCount);
      if (prefixKey(nextParts, level) !== groupKey) break;
      end += 1;
    }
    segments.push({ start: index, end, label });
    index = end + 1;
  }
  return segments;
}

/** 跳过全空维行，只保留至少有一个可见标签的层级 */
export function resolveActiveCategoryLevels(
  categories: string[],
  structuralLevelCount: number,
): number[] {
  const active: number[] = [];
  for (let level = 0; level < structuralLevelCount; level += 1) {
    const segments = buildCategoryLevelSegments(categories, level, structuralLevelCount);
    if (segments.some((segment) => segment.label.length > 0)) active.push(level);
  }
  return active.length > 0 ? active : [0];
}

/** 叶级（最细维度）用于底行抽稀 */
export function resolveFinestLevelForThinning(activeLevels: number[]): number {
  return activeLevels[activeLevels.length - 1] ?? 0;
}

export type HierarchicalAxisPlan = {
  structuralLevelCount: number;
  activeLevels: number[];
  orderedCategories: string[];
  visibleCategories: string[];
  thinningLevel: number;
  extraBottom: number;
};

/** 粗粒度层边界索引（分组切换点，用于底行刻度对齐） */
export function pickCategoryBoundaryIndices(
  categories: string[],
  level: number,
  structuralLevelCount: number,
): number[] {
  if (categories.length === 0) return [];
  const indices = new Set<number>([0, categories.length - 1]);
  for (let i = 1; i < categories.length; i += 1) {
    const prev = categories[i - 1]!.split(CARTESIAN_CATEGORY_KEY_SEP);
    const curr = categories[i]!.split(CARTESIAN_CATEGORY_KEY_SEP);
    const prevPart = formatCategoryCellValue(prev[level] ?? "");
    const currPart = formatCategoryCellValue(curr[level] ?? "");
    if (prevPart !== currPart) indices.add(i);
  }
  return [...indices].sort((a, b) => a - b);
}

const LABEL_GAP_BASE_PX = 12;

function defaultBandIndexToPx(count: number, innerW: number): (index: number) => number {
  return (index: number) => estimateCategoryBandCenterPx(index, count, innerW);
}

function widestLabelWidthAtIndex(
  categories: string[],
  index: number,
  structuralLevelCount: number,
  activeLevels: number[],
): number {
  const parts = splitCompositeCategoryParts(categories[index]!, structuralLevelCount);
  let maxW = 0;
  for (const level of activeLevels) {
    const label = axisCategoryDisplayText(parts[level] ?? "").trim();
    if (label) maxW = Math.max(maxW, estimateAxisLabelTextWidth(label));
  }
  return maxW;
}

/** 按索引同步抽稀：间距容纳各层最宽标签，同索引各层同显同隐 */
export function pickSynchronizedVisibleIndices(
  categories: string[],
  innerW: number,
  structuralLevelCount: number,
  activeLevels: number[],
  indexToPx?: (index: number) => number,
): number[] {
  const count = categories.length;
  if (count === 0 || innerW <= 0) return [];

  const toPx = indexToPx ?? defaultBandIndexToPx(count, innerW);
  const labelWidthAt = (idx: number) =>
    widestLabelWidthAtIndex(categories, idx, structuralLevelCount, activeLevels);

  return pickUniformOverlapAwareTickIndices(
    count,
    categories,
    () => "",
    0,
    scaleAxisLayoutPx(LABEL_GAP_BASE_PX),
    toPx,
    labelWidthAt,
  );
}

function pickThinningVisibleCategories(
  categories: string[],
  innerW: number,
  structuralLevelCount: number,
  activeLevels: number[],
  indexToPx?: (index: number) => number,
): string[] {
  const indices = pickSynchronizedVisibleIndices(
    categories,
    innerW,
    structuralLevelCount,
    activeLevels,
    indexToPx,
  );
  return indices.map((index) => categories[index]!);
}

/** 对标 DataEase：分层轴底行抽稀、全层水平标签（不旋转进绘图区） */
export function planHierarchicalCategoryAxis(
  categories: string[],
  innerW: number,
  options?: HierarchicalAxisPlanOptions,
): HierarchicalAxisPlan | null {
  if (categories.length === 0 || innerW <= 0) return null;

  const structuralLevelCount = Math.max(
    inferCompositeCategoryLevels(categories),
    options?.structuralLevelCount ?? 1,
  );
  const orderedCategories = sortCompositeCategoryKeys(categories, structuralLevelCount);
  const activeLevels = resolveActiveCategoryLevels(orderedCategories, structuralLevelCount);
  if (activeLevels.length <= 1) return null;

  const thinningLevel = resolveFinestLevelForThinning(activeLevels);
  const visibleCategories = pickThinningVisibleCategories(
    orderedCategories,
    innerW,
    structuralLevelCount,
    activeLevels,
  );

  return {
    structuralLevelCount,
    activeLevels,
    orderedCategories,
    visibleCategories,
    thinningLevel,
    extraBottom: resolveHierarchicalAxisLayout(activeLevels.length).extraBottom,
  };
}

type CategoryScale = d3.ScalePoint<string> | d3.ScaleBand<string>;

function bandCenterPx(
  xScale: CategoryScale,
  category: string,
  bandWidth?: number,
): number {
  const x = xScale(category);
  if (x == null) return 0;
  const bw =
    bandWidth ??
    ("bandwidth" in xScale && typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0);
  return x + bw / 2;
}

function bandEdgePx(
  xScale: CategoryScale,
  category: string,
  bandWidth?: number,
): { left: number; right: number } {
  const x = xScale(category);
  if (x == null) return { left: 0, right: 0 };
  const bw =
    bandWidth ??
    ("bandwidth" in xScale && typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0);
  return { left: x, right: x + bw };
}

type DrawHierarchicalCategoryAxisOptions = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: CategoryScale;
  categories: string[];
  innerH: number;
  innerW: number;
  theme: AntvThemeTokens;
  axisStyle?: ChartAxisStyle;
  plan?: HierarchicalAxisPlan;
};

export function resolveHierarchicalCategoryAxisRotate(
  categories: string[],
  innerW: number,
  labelRotate?: AxisLabelRotate,
  structuralLevelCount?: number,
): number {
  const levelCount = structuralLevelCount ?? inferCompositeCategoryLevels(categories);
  const leafLevel = Math.max(0, levelCount - 1);
  const leafLabels = categories.map((category) => {
    const partLabel = splitCompositeCategoryParts(category, levelCount)[leafLevel] ?? "";
    return axisCategoryDisplayText(partLabel);
  });
  return resolveCategoryLabelRotate(leafLabels, innerW, labelRotate);
}

/** 对标 DataEase：多维度分行 + 底行抽稀，最底行可配置倾斜 */
export function drawHierarchicalCategoryAxis(opts: DrawHierarchicalCategoryAxisOptions): void {
  if (opts.axisStyle?.x?.show === false) return;

  const plan = opts.plan ?? planHierarchicalCategoryAxis(opts.categories, opts.innerW);
  if (!plan) return;

  // 必须与 band/point scale domain 顺序一致（柱位序），禁止再 sort 打乱索引
  const categories = [...opts.xScale.domain()];
  const { structuralLevelCount, activeLevels } = plan;
  const bandWidth =
    "bandwidth" in opts.xScale && typeof opts.xScale.bandwidth === "function"
      ? opts.xScale.bandwidth()
      : undefined;
  const indexToPx = (index: number) => {
    const key = categories[index];
    if (!key) return estimateCategoryBandCenterPx(index, categories.length, opts.innerW, bandWidth);
    const x = opts.xScale(key);
    if (x == null) {
      return estimateCategoryBandCenterPx(index, categories.length, opts.innerW, bandWidth);
    }
    return x + (bandWidth ?? 0) / 2;
  };
  const visibleIndices = pickSynchronizedVisibleIndices(
    categories,
    opts.innerW,
    structuralLevelCount,
    activeLevels,
    indexToPx,
  );
  const fontSize = resolveAxisFontSize();
  const rowHeight = scaleAxisLayoutPx(ROW_HEIGHT_BASE);
  const stroke = opts.axisStyle?.x?.lineColor ?? opts.theme.axisLine;
  const strokeWidth = opts.axisStyle?.x?.lineWidth ?? 1;
  const bottomLevel = activeLevels[activeLevels.length - 1] ?? 0;
  const rotateDeg = resolveHierarchicalCategoryAxisRotate(
    categories,
    opts.innerW,
    opts.axisStyle?.x?.labelRotate,
    structuralLevelCount,
  );
  const axisRoot = opts.g.append("g").attr("class", "vs-axis-x vs-axis-x-tiered");

  axisRoot
    .append("line")
    .attr("class", "domain")
    .attr("x1", 0)
    .attr("x2", opts.innerW)
    .attr("y1", opts.innerH)
    .attr("y2", opts.innerH)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);

  activeLevels.forEach((level, rowIdx) => {
    const rowY = opts.innerH + categoryBottomAxisTickPadding() + (rowIdx + 1) * rowHeight - 4;
    const isBottomRow = level === bottomLevel;

    for (const idx of visibleIndices) {
      const category = categories[idx]!;
      const partLabel = splitCompositeCategoryParts(category, structuralLevelCount)[level] ?? "";
      const display = axisCategoryDisplayText(partLabel);
      if (!display) continue;

      const text = axisRoot
        .append("text")
        .attr("x", bandCenterPx(opts.xScale, category, bandWidth))
        .attr("y", rowY)
        .attr("text-anchor", "middle")
        .attr("fill", opts.theme.axisLabel)
        .style("font-size", `${fontSize}px`)
        .style("font-family", "inherit")
        .text(display);

      if (isBottomRow && rotateDeg) {
        const x = Number(text.attr("x") ?? 0);
        const y = Number(text.attr("y") ?? 0);
        text
          .attr("transform", `rotate(${rotateDeg}, ${x}, ${y})`)
          .style("text-anchor", "end")
          .attr("dx", "-0.2em")
          .attr("dy", "0.15em");
      }
    }

    const nextRowIdx = rowIdx + 1;
    if (nextRowIdx < activeLevels.length) {
      const nextRowY = opts.innerH + categoryBottomAxisTickPadding() + (nextRowIdx + 1) * rowHeight - 4;
      for (const idx of visibleIndices) {
        const category = categories[idx]!;
        const edges = bandEdgePx(opts.xScale, category, bandWidth);
        axisRoot
          .append("line")
          .attr("class", "tick")
          .attr("x1", edges.left)
          .attr("x2", edges.left)
          .attr("y1", rowY + 2)
          .attr("y2", nextRowY + 2)
          .attr("stroke", stroke)
          .attr("stroke-width", strokeWidth)
          .attr("opacity", 0.35);
        axisRoot
          .append("line")
          .attr("class", "tick")
          .attr("x1", edges.right)
          .attr("x2", edges.right)
          .attr("y1", rowY + 2)
          .attr("y2", nextRowY + 2)
          .attr("stroke", stroke)
          .attr("stroke-width", strokeWidth)
          .attr("opacity", 0.35);
      }
    }
  });
}
