import type { PixelRect } from "./geometry";
import { PIXEL_SHAPE_SELECTED_Z_BOOST } from "./geometry";

type PaletteDropPreviewProps = {
  rect: PixelRect;
};

/** 工具栏拖入画布时的落点虚线框（对标 RGL droppingItem） */
export function PaletteDropPreview({ rect }: PaletteDropPreviewProps) {
  return (
    <div
      data-testid="palette-drop-preview"
      className="pointer-events-none absolute rounded-md border-2 border-dashed border-cyan-400 bg-cyan-400/15 shadow-[0_0_0_1px_rgba(34,211,238,0.35)] dark:border-cyan-300 dark:bg-cyan-300/10"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: PIXEL_SHAPE_SELECTED_Z_BOOST + 1,
      }}
      aria-hidden
    />
  );
}
