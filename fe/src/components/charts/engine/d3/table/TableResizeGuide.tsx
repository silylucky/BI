import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { TableResizeGuideState } from "@/components/charts/engine/d3/table/useTableLayoutResize";

type TableResizeGuideProps = {
  guide: TableResizeGuideState | null;
};

/** S2 风格拖拽参考线（视口固定坐标，不随表格滚动偏移） */
export function TableResizeGuide({ guide }: TableResizeGuideProps) {
  if (!guide || typeof document === "undefined") return null;

  const style: CSSProperties =
    guide.orientation === "column"
      ? { left: guide.position, top: 0, width: 0, height: "100vh" }
      : { top: guide.position, left: 0, width: "100vw", height: 0 };

  return createPortal(
    <div
      aria-hidden
      data-orientation={guide.orientation}
      className="vs-table-resize-guide pointer-events-none fixed z-[9999]"
      style={style}
    />,
    document.body,
  );
}
