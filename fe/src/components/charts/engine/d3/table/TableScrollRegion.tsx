import { forwardRef, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTableScrollEdges } from "@/components/charts/engine/d3/table/useTableScrollEdges";

type TableScrollRegionProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  edgeDeps?: unknown[];
};

/** 表格滚动区：细滚动条 + 四向滚动渐隐提示（对标 DE 冻结/横向浏览） */
export const TableScrollRegion = forwardRef<HTMLDivElement, TableScrollRegionProps>(
  function TableScrollRegion({ children, className, style, edgeDeps = [] }, ref) {
    const innerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);
    const edges = useTableScrollEdges(innerRef, edgeDeps);

    return (
      <div
        ref={innerRef}
        className={cn(
          "vs-table-scroll dashboard-scroll relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain",
          className,
        )}
        style={style}
        data-scroll-left={edges.left ? "" : undefined}
        data-scroll-right={edges.right ? "" : undefined}
        data-scroll-top={edges.top ? "" : undefined}
        data-scroll-bottom={edges.bottom ? "" : undefined}
      >
        {children}
      </div>
    );
  },
);
