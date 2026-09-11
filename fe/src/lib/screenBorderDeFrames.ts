import { DATAEASE_BOARD_SVGS } from "@/lib/chartFrameBorderSvgs";
import { tintBoardSvg } from "@/lib/chartFrameBorderPresets";
import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";

/** 大屏素材边框 border-N 对标 DataEase Board.vue frame-N */
export const SCREEN_BORDER_DE_FRAME_IDS: Record<ScreenBorderVariant, keyof typeof DATAEASE_BOARD_SVGS> =
  {
    "border-1": "frame-1",
    "border-2": "frame-2",
    "border-3": "frame-3",
    "border-4": "frame-4",
    "border-5": "frame-5",
    "border-6": "frame-6",
    "border-7": "frame-7",
    "border-8": "frame-8",
    "border-9": "frame-9",
  };

export function buildScreenBorderDeSvg(variant: ScreenBorderVariant, accent: string): string {
  const frameId = SCREEN_BORDER_DE_FRAME_IDS[variant] ?? "frame-1";
  const raw = DATAEASE_BOARD_SVGS[frameId] ?? DATAEASE_BOARD_SVGS["frame-1"];
  const color = accent.trim() || "#22d3ee";
  return tintBoardSvg(raw, color);
}

export function buildScreenBorderDeSvgUrl(variant: ScreenBorderVariant, accent: string): string {
  return `data:image/svg+xml,${encodeURIComponent(buildScreenBorderDeSvg(variant, accent))}`;
}
