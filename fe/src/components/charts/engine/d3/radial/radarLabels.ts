import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { DataLabelContentOptions } from "@/lib/chartDataLabelFormat";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import {
  bboxFromAnchor,
  boxesOverlap,
  estimateLabelPixelWidth,
  parseSvgDyEm,
  pickCandidatesWithoutOverlap,
  pickCircularThinIndicesWithoutOverlap,
  type LabelBBox,
} from "@/components/charts/engine/d3/core/labelOverlap";

export type RadarAxisLabelLayout = {
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  dx: number;
  dy: string;
};

export function radarAxisLabelLayout(
  angle: number,
  labelR: number,
): RadarAxisLabelLayout {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = cos * labelR;
  const y = sin * labelR;
  if (cos > 0.3) return { x, y, anchor: "start", dx: 6, dy: "0.35em" };
  if (cos < -0.3) return { x, y, anchor: "end", dx: -6, dy: "0.35em" };
  return { x, y, anchor: "middle", dx: 0, dy: sin > 0 ? "0.9em" : "-0.45em" };
}

function buildAxisLabelBBox(
  layout: RadarAxisLabelLayout,
  text: string,
  fontSize: number,
): LabelBBox {
  const w = estimateLabelPixelWidth(text, fontSize);
  const h = fontSize + 4;
  const dyPx = parseSvgDyEm(layout.dy, fontSize);
  return bboxFromAnchor(layout.x, layout.y, w, h, layout.anchor, layout.dx, dyPx);
}

function pickGreedyIndicesWithoutBBoxOverlap(
  indices: number[],
  buildBBox: (index: number) => LabelBBox | null,
  pad = 3,
): number[] {
  const placed: LabelBBox[] = [];
  const result: number[] = [];
  for (const i of indices) {
    const box = buildBBox(i);
    if (!box) continue;
    let hit = false;
    for (const b of placed) {
      if (boxesOverlap(box, b, pad)) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      result.push(i);
      placed.push(box);
    }
  }
  return result;
}

export function layoutRadarAxisLabelIndices(
  texts: string[],
  angles: number[],
  labelR: number,
  fontSize: number,
): number[] {
  const count = texts.length;
  if (count === 0) return [];

  const circular = pickCircularThinIndicesWithoutOverlap(
    count,
    (i) => texts[i] ?? "",
    fontSize,
    labelR,
    4,
  );

  const buildBBoxFor = (i: number): LabelBBox | null => {
    const text = texts[i]?.trim();
    if (!text) return null;
    return buildAxisLabelBBox(radarAxisLabelLayout(angles[i]!, labelR), text, fontSize);
  };

  const indices = pickGreedyIndicesWithoutBBoxOverlap(circular, buildBBoxFor, 2);
  if (indices.length > 0) return indices;
  if (circular.length > 0) return [circular[0]!];
  return [0];
}

export function radarPointLabelOutwardOffset(dist: number, maxRadius: number, fontSize: number): number {
  const baseOffset = Math.max(8, fontSize * 0.75);
  const rRatio = maxRadius > 0 ? dist / maxRadius : 1;
  const outwardBoost =
    rRatio < 0.12 ? 3.2 : rRatio < 0.3 ? 2 : 1 + (1 - Math.min(rRatio, 1)) * 0.45;
  return baseOffset * outwardBoost;
}

export function layoutRadarPointLabelKeys(
  items: Array<{
    key: string;
    text: string;
    px: number;
    py: number;
    angle: number;
    priority: number;
  }>,
  fontSize: number,
  occupied: LabelBBox[] = [],
  maxRadius = 0,
): Set<string> {
  const candidates = items
    .filter((item) => item.text.trim())
    .map((item) => {
      const cos = Math.cos(item.angle);
      const sin = Math.sin(item.angle);
      const dist = Math.hypot(item.px, item.py);
      const offset = radarPointLabelOutwardOffset(dist, maxRadius, fontSize);
      const lx = item.px + cos * offset;
      const ly = item.py + sin * offset;
      const w = estimateLabelPixelWidth(item.text, fontSize);
      const h = fontSize + 4;
      const dyPx = -0.55 * fontSize;
      const cy = ly + dyPx;
      const bbox: LabelBBox = {
        left: lx - w / 2,
        right: lx + w / 2,
        top: cy - h / 2,
        bottom: cy + h / 2,
      };
      return { key: item.key, priority: item.priority, bbox };
    });

  return pickCandidatesWithoutOverlap(candidates, occupied, 5);
}

export function buildRadarPointLabelText(
  row: Record<string, unknown>,
  xField: string,
  yField: string,
  maxValue: number,
  labelContent: DataLabelContentOptions | undefined,
  valueFormat: NumberFormatConfig | undefined,
): string {
  return formatSimpleDataLabel(
    String(row[xField] ?? ""),
    row[yField],
    maxValue,
    labelContent,
    valueFormat,
  );
}

export function radarAxisLabelBboxes(
  indices: number[],
  texts: string[],
  angles: number[],
  labelR: number,
  fontSize: number,
): LabelBBox[] {
  return indices
    .map((i) => {
      const text = texts[i]?.trim();
      if (!text) return null;
      return buildAxisLabelBBox(radarAxisLabelLayout(angles[i]!, labelR), text, fontSize);
    })
    .filter((b): b is LabelBBox => b != null);
}
