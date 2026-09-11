import { useDataScreenVisualScaleBundle } from "@/components/dashboard/screen/dataScreenVisualScaleContext";
import { usePixelCanvasScale } from "@/components/dashboard/pixelCanvas/PixelCanvasScaleContext";

/** 嵌入看板/大屏 canvas 时的视觉缩放（含 CSS transform scale） */
export function useChartVisualScale(): number {
  const viewportScale = useDataScreenVisualScaleBundle();
  const pixel = usePixelCanvasScale();
  if (viewportScale) return viewportScale.paintScale;
  return pixel;
}
