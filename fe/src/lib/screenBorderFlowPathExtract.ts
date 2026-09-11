import { DATAEASE_BOARD_SVGS } from "@/lib/chartFrameBorderSvgs";
import { SCREEN_BORDER_DE_FRAME_IDS } from "@/lib/screenBorderDeFrames";
import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";

const PATH_CMD_RE = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/g;

type PathCmd = { type: string; args: number[] };

function tokenizePath(d: string): PathCmd[] {
  const cmds: PathCmd[] = [];
  let match: RegExpExecArray | null;
  PATH_CMD_RE.lastIndex = 0;
  while ((match = PATH_CMD_RE.exec(d))) {
    const args = (match[2].match(NUM_RE) ?? []).map(Number);
    cmds.push({ type: match[1]!, args });
  }
  return cmds;
}

function splitSubpaths(d: string): string[] {
  const parts = d.split(/(?=[Mm])/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part) => (part[0] === "m" ? `M${part.slice(1)}` : part));
}

function absolutizePath(d: string): string {
  const cmds = tokenizePath(d);
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const out: string[] = [];

  const push = (type: string, ...nums: number[]) => {
    out.push(type);
    for (const n of nums) out.push(formatNum(n));
  };

  for (const { type, args } of cmds) {
    const upper = type.toUpperCase();
    const rel = type >= "a" && type <= "z";

    if (upper === "Z") {
      push("Z");
      x = sx;
      y = sy;
      continue;
    }

    if (upper === "M") {
      for (let i = 0; i < args.length; i += 2) {
        const nx = rel ? x + args[i]! : args[i]!;
        const ny = rel ? y + args[i + 1]! : args[i + 1]!;
        x = nx;
        y = ny;
        if (i === 0) {
          sx = x;
          sy = y;
          push(i === 0 ? "M" : "L", x, y);
        } else {
          push("L", x, y);
        }
      }
      continue;
    }

    if (upper === "L") {
      for (let i = 0; i < args.length; i += 2) {
        x = rel ? x + args[i]! : args[i]!;
        y = rel ? y + args[i + 1]! : args[i + 1]!;
        push("L", x, y);
      }
      continue;
    }

    if (upper === "H") {
      for (const arg of args) {
        x = rel ? x + arg : arg;
        push("L", x, y);
      }
      continue;
    }

    if (upper === "V") {
      for (const arg of args) {
        y = rel ? y + arg : arg;
        push("L", x, y);
      }
      continue;
    }

    if (upper === "C") {
      for (let i = 0; i < args.length; i += 6) {
        const x1 = rel ? x + args[i]! : args[i]!;
        const y1 = rel ? y + args[i + 1]! : args[i + 1]!;
        const x2 = rel ? x + args[i + 2]! : args[i + 2]!;
        const y2 = rel ? y + args[i + 3]! : args[i + 3]!;
        x = rel ? x + args[i + 4]! : args[i + 4]!;
        y = rel ? y + args[i + 5]! : args[i + 5]!;
        push("C", x1, y1, x2, y2, x, y);
      }
    }
  }

  return out.join(" ");
}

function formatNum(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function scaleAbsPath(d: string, scaleX: number, scaleY: number): string {
  const cmds = tokenizePath(d);
  const out: string[] = [];
  for (const { type, args } of cmds) {
    const upper = type.toUpperCase();
    out.push(upper);
    if (upper === "Z") continue;
    for (let i = 0; i < args.length; i += 1) {
      const scale = upper === "C" || upper === "S" || upper === "Q" || upper === "T"
        ? i % 2 === 0
          ? scaleX
          : scaleY
        : i % 2 === 0
          ? scaleX
          : scaleY;
      out.push(formatNum(args[i]! * scale));
    }
  }
  return out.join(" ");
}

/** 将 viewBox 0–100 归一化流光路径缩放到实际像素尺寸（与 DE 边框拉伸一致） */
export function scaleNormalizedFlowPath(
  normalizedPath: string,
  width: number,
  height: number,
): string {
  if (width <= 0 || height <= 0) return normalizedPath;
  return scaleAbsPath(normalizedPath, width / 100, height / 100);
}

function pathBBox(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const cmds = tokenizePath(absolutizePath(d));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { args } of cmds) {
    for (let i = 0; i < args.length; i += 2) {
      const x = args[i];
      const y = args[i + 1];
      if (x == null || y == null) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function parseViewBox(svg: string): { width: number; height: number } {
  const match = svg.match(/viewBox=\"([^\"]+)\"/);
  if (!match) return { width: 100, height: 100 };
  const parts = match[1]!.trim().split(/\s+/).map(Number);
  return { width: parts[2] ?? 100, height: parts[3] ?? 100 };
}

function extractPathElements(svg: string): string[] {
  return [...svg.matchAll(/<path[^>]*\sd=\"([^\"]+)\"/g)].map((m) => m[1]!);
}

function readMovePoint(cmds: PathCmd[]): { x: number; y: number } | null {
  for (const { type, args } of cmds) {
    if (type.toUpperCase() === "M" && args.length >= 2) {
      return { x: args[0]!, y: args[1]! };
    }
  }
  return null;
}

function readLastVertex(cmds: PathCmd[]): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let hasPoint = false;
  for (const { type, args } of cmds) {
    const upper = type.toUpperCase();
    if (upper === "M") {
      x = args[0]!;
      y = args[1]!;
      hasPoint = true;
      continue;
    }
    if (upper === "L" && args.length >= 2) {
      x = args[0]!;
      y = args[1]!;
      hasPoint = true;
      continue;
    }
    if (upper === "C" && args.length >= 6) {
      x = args[4]!;
      y = args[5]!;
      hasPoint = true;
    }
  }
  return hasPoint ? { x, y } : null;
}

/** 保证流光路径为单圈闭合环（animateMotion 单向循环，避免折返） */
export function ensureRingClosedPath(d: string): string {
  const abs = absolutizePath(d).trim();
  const cmds = tokenizePath(abs);
  const start = readMovePoint(cmds);
  if (!start) return abs;

  const endsWithClose = /\bZ\s*$/i.test(abs);
  const last = readLastVertex(cmds);
  const gap =
    last == null
      ? Infinity
      : Math.hypot(last.x - start.x, last.y - start.y);

  if (!endsWithClose) {
    if (gap < 0.05) return `${abs} Z`;
    return `${abs} L ${formatNum(start.x)} ${formatNum(start.y)} Z`;
  }

  if (gap > 0.05) {
    return `${abs.replace(/\bZ\s*$/i, "")} L ${formatNum(start.x)} ${formatNum(start.y)} Z`;
  }

  return abs;
}

function finalizeFlowPath(d: string): string {
  return ensureRingClosedPath(d);
}

function touchesAllEdges(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number,
): boolean {
  return (
    box.minX <= width * 0.02 &&
    box.minY <= height * 0.02 &&
    box.maxX >= width * 0.98 &&
    box.maxY >= height * 0.98
  );
}

/** 无整圈外轮廓子路径时，用 frame 全局点集外接矩形（顺时针单圈） */
function buildGlobalBoundsRectPath(svg: string, width: number, height: number): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pathD of extractPathElements(svg)) {
    const { minX: x1, minY: y1, maxX: x2, maxY: y2 } = pathBBox(absolutizePath(pathD));
    if (!Number.isFinite(x1)) continue;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  const padX = width * 0.008;
  const padY = height * 0.008;
  const x1 = Math.max(0, minX + padX);
  const y1 = Math.max(0, minY + padY);
  const x2 = Math.min(width, maxX - padX);
  const y2 = Math.min(height, maxY - padY);

  return `M ${formatNum(x1)} ${formatNum(y1)} L ${formatNum(x2)} ${formatNum(y1)} L ${formatNum(x2)} ${formatNum(y2)} L ${formatNum(x1)} ${formatNum(y2)} Z`;
}

/** 取 DataEase frame 中最像外轮廓的闭合子路径 */
export function pickOuterFlowSubpath(svg: string): { d: string; viewWidth: number; viewHeight: number } {
  const { width, height } = parseViewBox(svg);

  let best = { d: "", score: 0 };

  for (const pathD of extractPathElements(svg)) {
    for (const sub of splitSubpaths(pathD)) {
      if (!/z/i.test(sub)) continue;
      const abs = absolutizePath(sub);
      const box = pathBBox(abs);
      if (!Number.isFinite(box.minX)) continue;
      if (!touchesAllEdges(box, width, height)) continue;
      const area = (box.maxX - box.minX) * (box.maxY - box.minY);
      const score = area;
      if (score > best.score) best = { d: abs, score };
    }
  }

  const raw = best.score > 0 ? best.d : buildGlobalBoundsRectPath(svg, width, height);

  return {
    d: finalizeFlowPath(scaleAbsPath(raw, 100 / width, 100 / height)),
    viewWidth: width,
    viewHeight: height,
  };
}

export function buildBorderFlowPathsFromDeFrames(): Record<ScreenBorderVariant, string> {
  const variants = Object.keys(SCREEN_BORDER_DE_FRAME_IDS) as ScreenBorderVariant[];
  const paths = {} as Record<ScreenBorderVariant, string>;
  for (const variant of variants) {
    const frameId = SCREEN_BORDER_DE_FRAME_IDS[variant];
    const svg = DATAEASE_BOARD_SVGS[frameId] ?? DATAEASE_BOARD_SVGS["frame-1"]!;
    paths[variant] = pickOuterFlowSubpath(svg).d;
  }
  return paths;
}
