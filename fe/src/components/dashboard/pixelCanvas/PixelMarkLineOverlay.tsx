import { PIXEL_MARK_LINE_Z_INDEX, type PixelCanvasBounds } from "./geometry";
import type { MarkLineGuide } from "./pixelMarkLine";

const HORIZONTAL_LINES = new Set<MarkLineGuide["id"]>(["xt", "xc", "xb"]);

type PixelMarkLineOverlayProps = {
  guides: MarkLineGuide[];
  canvas: PixelCanvasBounds;
};

/**
 * 对标 DE `#canvas-mark-line`：编辑态常驻对齐线层，拖拽时绘制参考线。
 */
export function PixelMarkLineOverlay({ guides, canvas }: PixelMarkLineOverlayProps) {
  return (
    <svg
      id="canvas-mark-line"
      data-testid="canvas-mark-line"
      className="mark-line pixel-mark-line-overlay pointer-events-none absolute inset-0"
      style={{ zIndex: PIXEL_MARK_LINE_Z_INDEX }}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      aria-hidden
    >
      {guides.map((guide) =>
        HORIZONTAL_LINES.has(guide.id) ? (
          <line
            key={guide.id}
            data-testid={`mark-line-${guide.id}`}
            className="pixel-canvas-mark-line"
            x1={0}
            y1={guide.position}
            x2={canvas.width}
            y2={guide.position}
          />
        ) : (
          <line
            key={guide.id}
            data-testid={`mark-line-${guide.id}`}
            className="pixel-canvas-mark-line"
            x1={guide.position}
            y1={0}
            x2={guide.position}
            y2={canvas.height}
          />
        ),
      )}
    </svg>
  );
}
