import type { CSSProperties } from "react";
import type { mergeShapeInnerPresentation } from "@/lib/chartDeStyle";

const TRANSPARENT_SHELL: CSSProperties = {
  backgroundColor: "transparent",
  backgroundImage: "none",
  border: "none",
  boxShadow: "none",
  padding: 0,
};

/** 边框装饰素材仅渲染描边图形，去掉看板默认组件外框与内边距 */
export function applyScreenBorderShellPresentation(
  layers: ReturnType<typeof mergeShapeInnerPresentation>,
): ReturnType<typeof mergeShapeInnerPresentation> {
  return {
    shell: {
      ...layers.shell,
      style: { ...layers.shell.style, ...TRANSPARENT_SHELL },
      backgroundLayers: [],
      frameLayers: [],
    },
    content: {
      ...layers.content,
      style: { ...layers.content.style, ...TRANSPARENT_SHELL },
      backgroundLayers: [],
      frameLayers: [],
    },
  };
}
