import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";
import { buildBorderFlowPathsFromDeFrames } from "./screenBorderFlowPathExtract";

/** 从 DataEase Board frame 外轮廓提取，归一化到 viewBox 0 0 100 100 */
export const BORDER_FLOW_PATHS: Record<ScreenBorderVariant, string> =
  buildBorderFlowPathsFromDeFrames();

export type BorderFlowMotion = "loop";

export type BorderFlowSegment = {
  path: string;
  motion: BorderFlowMotion;
};

export function getBorderFlowSegments(variant: ScreenBorderVariant): BorderFlowSegment[] {
  const path = BORDER_FLOW_PATHS[variant] ?? BORDER_FLOW_PATHS["border-1"];
  return [{ path, motion: "loop" }];
}

export function getBorderFlowSegment(variant: ScreenBorderVariant, _index: number): BorderFlowSegment {
  return getBorderFlowSegments(variant)[0]!;
}
