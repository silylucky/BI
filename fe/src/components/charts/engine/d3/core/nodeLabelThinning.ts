import {
  anyBoxesOverlap,
  anyVerticalBandsOverlap,
  bboxFromAnchor,
  estimateLabelPixelWidth,
  pickCandidatesWithoutOverlap,
  type LabelPlacementCandidate,
} from "@/components/charts/engine/d3/core/labelOverlap";

export function verticalLabelBandHeight(fontSize: number): number {
  return Math.round(fontSize * 1.15);
}

function pickUniformIndices(count: number, targetCount: number): number[] {
  if (count <= 0 || targetCount <= 0) return [];
  if (targetCount === 1) return [0];
  if (count <= targetCount) return Array.from({ length: count }, (_, index) => index);
  const indices: number[] = [];
  for (let k = 0; k < targetCount; k += 1) {
    indices.push(Math.round((k * (count - 1)) / (targetCount - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function verticalBandsForIndices(
  indices: number[],
  centerYAt: (index: number) => number,
  halfBand: number,
): Array<{ top: number; bottom: number }> {
  return indices.map((index) => {
    const center = centerYAt(index);
    return { top: center - halfBand, bottom: center + halfBand };
  });
}

/** 同列纵向标签：不叠字则全显；必须抽稀时均匀取点 */
export function pickVerticalStackIndicesWithoutOverlap(
  count: number,
  centerYAt: (index: number) => number,
  labelFor: (index: number) => string,
  fontSize: number,
  minGapPx = 2,
): number[] {
  if (count <= 0) return [];

  const withText = Array.from({ length: count }, (_, index) => index).filter((index) =>
    labelFor(index).trim(),
  );
  if (withText.length <= 1) return withText;

  const halfBand = verticalLabelBandHeight(fontSize) / 2;
  if (!anyVerticalBandsOverlap(verticalBandsForIndices(withText, centerYAt, halfBand), minGapPx)) {
    return withText;
  }

  for (let target = withText.length - 1; target >= 1; target -= 1) {
    const indices = pickUniformIndices(count, target).filter((index) => labelFor(index).trim());
    if (!anyVerticalBandsOverlap(verticalBandsForIndices(indices, centerYAt, halfBand), minGapPx)) {
      return indices;
    }
  }

  return [withText[0]!];
}

/** 二维标签：无 bbox 重叠则全显，否则按优先级贪心避让 */
export function pickSpatialLabelKeysWithoutOverlap(
  candidates: LabelPlacementCandidate[],
  pad = 3,
): Set<string> {
  if (candidates.length <= 1) {
    return new Set(candidates.map((item) => item.key));
  }
  const boxes = candidates.map((item) => item.bbox);
  if (!anyBoxesOverlap(boxes, pad)) {
    return new Set(candidates.map((item) => item.key));
  }
  return pickCandidatesWithoutOverlap(candidates, [], pad);
}

type SankeyLayoutNode = { id: string; depth: number; y: number; height: number };

export function pickSankeyVisibleLabelIds(
  nodes: SankeyLayoutNode[],
  fontSize: number,
  labelFor: (node: SankeyLayoutNode) => string = (node) => node.id,
): Set<string> {
  const visible = new Set<string>();
  const byDepth = new Map<number, SankeyLayoutNode[]>();
  for (const node of nodes) {
    const column = byDepth.get(node.depth) ?? [];
    column.push(node);
    byDepth.set(node.depth, column);
  }

  for (const column of byDepth.values()) {
    const ordered = [...column].sort((a, b) => a.y - b.y);
    const indices = pickVerticalStackIndicesWithoutOverlap(
      ordered.length,
      (index) => ordered[index]!.y + ordered[index]!.height / 2,
      (index) => labelFor(ordered[index]!),
      fontSize,
    );
    for (const index of indices) {
      visible.add(ordered[index]!.id);
    }
  }

  return visible;
}

type GraphLayoutNode = { id: string; label: string; x?: number; y?: number };

export function pickGraphVisibleLabelIds(input: {
  nodes: GraphLayoutNode[];
  fontSize: number;
  nodeRadius: (id: string) => number;
  nodeDegree: Map<string, number>;
  leftIds?: Set<string>;
  rightIds?: Set<string>;
  middleIds?: Set<string>;
}): Set<string> {
  const { nodes, fontSize, nodeRadius, nodeDegree, leftIds, rightIds, middleIds } = input;
  const hasBipartite =
    (leftIds?.size ?? 0) > 0 &&
    (rightIds?.size ?? 0) > 0 &&
    nodes.every((node) => node.x != null && node.y != null);

  if (hasBipartite && leftIds && rightIds) {
    const visible = new Set<string>();
    const thinColumn = (ids: Set<string>) => {
      const column = nodes
        .filter((node) => ids.has(node.id))
        .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
      const indices = pickVerticalStackIndicesWithoutOverlap(
        column.length,
        (index) => graphLabelCenterY(column[index]!, nodeRadius, fontSize),
        (index) => column[index]!.label,
        fontSize,
      );
      for (const index of indices) {
        visible.add(column[index]!.id);
      }
    };
    thinColumn(leftIds);
    thinColumn(rightIds);
    if (middleIds?.size) thinColumn(middleIds);
    return visible;
  }

  const candidates: LabelPlacementCandidate[] = [];
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const label = node.label.trim();
    if (!label) continue;
    const width = estimateLabelPixelWidth(label, fontSize);
    const height = verticalLabelBandHeight(fontSize);
    const centerY = graphLabelCenterY(node, nodeRadius, fontSize);
    candidates.push({
      key: node.id,
      priority: nodeDegree.get(node.id) ?? 1,
      bbox: bboxFromAnchor(node.x, centerY, width, height, "middle"),
    });
  }
  return pickSpatialLabelKeysWithoutOverlap(candidates);
}

function graphLabelCenterY(
  node: GraphLayoutNode,
  nodeRadius: (id: string) => number,
  _fontSize: number,
): number {
  const radius = nodeRadius(node.id);
  return (node.y ?? 0) + radius + 11;
}

export function treemapLeafLabelKey(leaf: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}): string {
  return `${leaf.x0}:${leaf.y0}:${leaf.x1}:${leaf.y1}`;
}

export function pickTreemapVisibleLabelKeys(input: {
  leaves: Array<{
    data: { name: string };
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    value?: number | null;
  }>;
  fontSize: number;
  labelLinesFor: (leaf: (typeof input.leaves)[number]) => string[];
  minCellWidth?: number;
}): Set<string> {
  const { leaves, fontSize, labelLinesFor, minCellWidth = 36 } = input;
  const candidates: LabelPlacementCandidate[] = [];

  for (const leaf of leaves) {
    const width = leaf.x1 - leaf.x0;
    const height = leaf.y1 - leaf.y0;
    const lines = labelLinesFor(leaf).filter((line) => line.trim());
    if (lines.length === 0 || width <= minCellWidth) continue;

    const lineHeight = Math.round(fontSize * 1.25);
    const labelHeight = lines.length * lineHeight;
    const labelWidth = Math.max(...lines.map((line) => estimateLabelPixelWidth(line, fontSize)), 0);
    const minHeight = labelHeight + 10;
    if (height < minHeight) continue;

    candidates.push({
      key: treemapLeafLabelKey(leaf),
      priority: width * height,
      bbox: {
        left: leaf.x0 + 6,
        right: leaf.x0 + 6 + labelWidth,
        top: leaf.y0 + 4,
        bottom: leaf.y0 + 4 + labelHeight,
      },
    });
  }

  return pickSpatialLabelKeysWithoutOverlap(candidates);
}
