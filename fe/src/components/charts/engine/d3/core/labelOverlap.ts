import { pickUniformOverlapAwareTickIndices } from "./axes";
import { estimateLabelPixelWidth } from "./labelWidth";

export type LabelBBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export { estimateLabelPixelWidth } from "./labelWidth";

export function bboxFromAnchor(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: "start" | "end" | "middle",
  dx = 0,
  dyPx = 0,
): LabelBBox {
  const cx = x + dx;
  const cy = y + dyPx;
  const halfH = height / 2;
  if (anchor === "start") {
    return { left: cx, right: cx + width, top: cy - halfH, bottom: cy + halfH };
  }
  if (anchor === "end") {
    return { left: cx - width, right: cx, top: cy - halfH, bottom: cy + halfH };
  }
  const halfW = width / 2;
  return { left: cx - halfW, right: cx + halfW, top: cy - halfH, bottom: cy + halfH };
}

export function boxesOverlap(a: LabelBBox, b: LabelBBox, pad = 3): boolean {
  return (
    a.left < b.right + pad &&
    a.right > b.left - pad &&
    a.top < b.bottom + pad &&
    a.bottom > b.top - pad
  );
}

export function anyBoxesOverlap(boxes: LabelBBox[], pad = 3): boolean {
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(boxes[i]!, boxes[j]!, pad)) return true;
    }
  }
  return false;
}

/** 仅比较纵向字块是否重叠（桑基/关系图同列标签） */
export function verticalBandsOverlap(
  topA: number,
  bottomA: number,
  topB: number,
  bottomB: number,
  pad = 3,
): boolean {
  return topA < bottomB + pad && bottomA > topB - pad;
}

export function anyVerticalBandsOverlap(
  bands: Array<{ top: number; bottom: number }>,
  pad = 3,
): boolean {
  const sorted = [...bands].sort((a, b) => a.top - b.top);
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]!;
    const curr = sorted[index]!;
    if (verticalBandsOverlap(prev.top, prev.bottom, curr.top, curr.bottom, pad)) {
      return true;
    }
  }
  return false;
}

function pickUniformIndices(count: number, targetCount: number): number[] {
  if (count <= 0 || targetCount <= 0) return [];
  if (targetCount === 1) return [0];
  if (count <= targetCount) return Array.from({ length: count }, (_, i) => i);
  const indices: number[] = [];
  for (let k = 0; k < targetCount; k += 1) {
    indices.push(Math.round((k * (count - 1)) / (targetCount - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** 圆周均匀取点（首尾在圆上相邻，不能用线性 0…count-1 均匀） */
function pickUniformCircularIndices(count: number, targetCount: number): number[] {
  if (count <= 0 || targetCount <= 0) return [];
  if (targetCount === 1) return [0];
  if (count <= targetCount) return Array.from({ length: count }, (_, i) => i);
  const indices: number[] = [];
  for (let k = 0; k < targetCount; k += 1) {
    indices.push(Math.round((k * count) / targetCount) % count);
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** 圆周相邻标签的切向间距（含首尾回绕） */
export function circularTangentDistancePx(
  indexA: number,
  indexB: number,
  count: number,
  arcStep: number,
  labelR: number,
): number {
  const diff = Math.abs(indexA - indexB);
  const steps = Math.min(diff, count - diff);
  return steps * arcStep * labelR;
}

export function circularTickIndicesNoOverlap(
  indices: number[],
  widthAt: (index: number) => number,
  count: number,
  arcStep: number,
  labelR: number,
  minGapPx = 6,
): boolean {
  if (indices.length <= 1) return true;
  const sorted = [...indices].sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k += 1) {
    const curr = sorted[k]!;
    const next = sorted[(k + 1) % sorted.length]!;
    const w1 = widthAt(curr);
    const w2 = widthAt(next);
    if (w1 <= 0 && w2 <= 0) continue;
    const dist = circularTangentDistancePx(curr, next, count, arcStep, labelR);
    const minDist = (w1 + w2) / 2 + minGapPx;
    if (dist < minDist) return false;
  }
  return true;
}

export function pickCircularThinIndicesWithoutOverlap(
  count: number,
  labelFor: (index: number) => string,
  fontSize: number,
  labelR: number,
  minGapPx = 6,
): number[] {
  if (count <= 0) return [];
  const arcStep = (2 * Math.PI) / count;
  const widthAt = (i: number) => estimateLabelPixelWidth(labelFor(i) ?? "", fontSize);

  const withLabel = Array.from({ length: count }, (_, i) => i).filter((i) => Boolean(labelFor(i)?.trim()));
  if (withLabel.length === 0) return count > 0 ? [0] : [];

  if (circularTickIndicesNoOverlap(withLabel, widthAt, count, arcStep, labelR, minGapPx)) {
    return withLabel;
  }

  for (let target = count; target >= 1; target -= 1) {
    const indices = pickUniformCircularIndices(count, target).filter((i) => Boolean(labelFor(i)?.trim()));
    if (circularTickIndicesNoOverlap(indices, widthAt, count, arcStep, labelR, minGapPx)) {
      return indices;
    }
  }

  return [withLabel[0]!];
}

/** 均匀抽稀 + 二维 bbox 校验，保证标签不重叠 */
export function pickThinIndicesWithoutBBoxOverlap(
  count: number,
  labelFor: (index: number) => string,
  fontSize: number,
  toPx: (index: number) => number,
  buildBBox: (index: number, text: string) => LabelBBox | null,
  minGapPx = 4,
): number[] {
  if (count <= 0) return [];

  const categories = Array.from({ length: count }, (_, i) => labelFor(i) || `__${i}`);
  const widthAt = (i: number) => estimateLabelPixelWidth(labelFor(i), fontSize);

  let indices = pickUniformOverlapAwareTickIndices(
    count,
    categories,
    (c) => (c.startsWith("__") ? "" : c),
    0,
    minGapPx,
    toPx,
    widthAt,
  );

  const boxesFor = (idxs: number[]): LabelBBox[] =>
    idxs
      .map((i) => {
        const text = labelFor(i).trim();
        if (!text) return null;
        return buildBBox(i, text);
      })
      .filter((b): b is LabelBBox => b != null);

  while (indices.length > 1 && anyBoxesOverlap(boxesFor(indices))) {
    const nextCount = indices.length - 1;
    indices = pickUniformIndices(count, nextCount).filter((i) => labelFor(i).trim());
  }

  if (indices.length === 0) {
    const first = categories.findIndex((c) => !c.startsWith("__") && c.trim());
    return first >= 0 ? [first] : [];
  }

  return indices;
}

export type LabelPlacementCandidate = {
  key: string;
  priority: number;
  bbox: LabelBBox;
};

/** 按优先级贪心放置，跳过与已占位 bbox 重叠的项 */
export function pickCandidatesWithoutOverlap(
  candidates: LabelPlacementCandidate[],
  occupied: LabelBBox[] = [],
  pad = 3,
): Set<string> {
  const visible = new Set<string>();
  const placed = [...occupied];
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);

  for (const item of sorted) {
    let hit = false;
    for (const box of placed) {
      if (boxesOverlap(item.bbox, box, pad)) {
        hit = true;
        break;
      }
    }
    if (hit) continue;
    visible.add(item.key);
    placed.push(item.bbox);
  }

  return visible;
}

export function parseSvgDyEm(dy: string, fontSize: number): number {
  if (dy.endsWith("em")) return parseFloat(dy) * fontSize;
  return 0;
}
