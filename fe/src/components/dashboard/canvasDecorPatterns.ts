import type { CSSProperties } from "react";

export type DecorPresetId = "dots" | "grid" | "cross" | "diagonal";
export type DecorPatternContext = "canvas" | "thumb";
export type DecorColorScheme = "light" | "dark";

type TileSpec = { width: number; height: number };

/** 画布平铺：与吸附/布局尺度一致 */
const CANVAS_TILE: Record<DecorPresetId, TileSpec> = {
  dots: { width: 16, height: 16 },
  grid: { width: 24, height: 24 },
  cross: { width: 20, height: 20 },
  diagonal: { width: 10, height: 10 },
};

/** 面板缩略图：更小步长 + 更高对比，20–24px 预览块内至少可见 2 个周期 */
const THUMB_TILE: Record<DecorPresetId, TileSpec> = {
  dots: { width: 8, height: 8 },
  grid: { width: 8, height: 8 },
  cross: { width: 8, height: 8 },
  diagonal: { width: 8, height: 8 },
};

function tileSpec(presetId: DecorPresetId, context: DecorPatternContext): TileSpec {
  return context === "thumb" ? THUMB_TILE[presetId] : CANVAS_TILE[presetId];
}

/** 纹理描边/填充色：缩略图用更高对比，画布用中等对比（避免 #e2e8f0 类近不可见） */
function patternColor(scheme: DecorColorScheme, context: DecorPatternContext): string {
  if (context === "thumb") {
    return scheme === "dark" ? "#cbd5e1" : "#64748b";
  }
  return scheme === "dark" ? "#94a3b8" : "#94a3b8";
}

function strokeWidth(context: DecorPatternContext, canvasWidth: number): number {
  return context === "thumb" ? Math.max(canvasWidth * 1.5, 1) : canvasWidth;
}

function buildDecorSvg(
  presetId: DecorPresetId,
  scheme: DecorColorScheme,
  context: DecorPatternContext,
): string {
  const { width: w, height: h } = tileSpec(presetId, context);
  const color = patternColor(scheme, context);

  switch (presetId) {
    case "dots": {
      const r = context === "thumb" ? 1.15 : scheme === "dark" ? 1.25 : 1;
      const origin = context === "thumb" ? w / 2 : 1;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${origin}" cy="${origin}" r="${r}" fill="${color}"/></svg>`;
    }
    case "grid": {
      const sw = strokeWidth(context, 0.75);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill="none" stroke="${color}" stroke-width="${sw}" d="M${w} 0H0v${h}"/></svg>`;
    }
    case "cross": {
      const sw = strokeWidth(context, 0.75);
      const midX = w / 2;
      const midY = h / 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="M0 ${midY}h${w}M${midX} 0v${h}" fill="none" stroke="${color}" stroke-width="${sw}"/></svg>`;
    }
    case "diagonal": {
      const sw = strokeWidth(context, 0.75);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="M-1 1l2-2M0 ${h}L${w} 0M${w - 1} ${h + 1}l2-2" fill="none" stroke="${color}" stroke-width="${sw}"/></svg>`;
    }
  }
}

export function decorTileDataUrl(
  presetId: DecorPresetId,
  scheme: DecorColorScheme = "light",
  context: DecorPatternContext = "canvas",
): string {
  return `data:image/svg+xml,${encodeURIComponent(buildDecorSvg(presetId, scheme, context))}`;
}

export function decorTileSize(
  presetId: DecorPresetId,
  context: DecorPatternContext = "canvas",
): TileSpec {
  return tileSpec(presetId, context);
}

export function isDecorPresetId(id: string): id is DecorPresetId {
  return id === "dots" || id === "grid" || id === "cross" || id === "diagonal";
}

export function decorTileBackgroundLayers(
  presetId: DecorPresetId,
  scheme: DecorColorScheme,
  context: DecorPatternContext,
): Pick<
  CSSProperties,
  "backgroundImage" | "backgroundSize" | "backgroundRepeat"
> {
  const tileUrl = decorTileDataUrl(presetId, scheme, context);
  const { width, height } = decorTileSize(presetId, context);
  return {
    backgroundImage: `url("${tileUrl}")`,
    backgroundSize: `${width}px ${height}px`,
    backgroundRepeat: "repeat",
  };
}
