import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  measureColumnAutoFitWidth,
  measureTableLayoutFromDom,
} from "@/components/charts/engine/d3/table/measureTableLayout";
import {
  TABLE_DEFAULT_COL_PX,
  TABLE_DEFAULT_ROW_PX,
  TABLE_DEFAULT_SERIES_PX,
  TABLE_MIN_COL_PX,
  TABLE_MIN_ROW_PX,
} from "@/components/charts/engine/d3/table/tableLayoutConstants";

export type TableLayoutResizeState = {
  columnWidthsPx: Record<string, number>;
  seriesColumnWidthPx: number;
  rowHeightPx: number;
};

export type TableResizeGuideState = {
  orientation: "column" | "row";
  position: number;
};

type AutoFitContext = {
  columns: string[];
  displayCols: string[];
  rows: unknown[][];
  showSeriesNumber: boolean;
  headerLabel: (field: string) => string;
  formatCell: (value: unknown) => string;
};

type UseTableLayoutResizeOptions = {
  columns: string[];
  showSeriesNumber: boolean;
  initial: Partial<TableLayoutResizeState>;
  enabled: boolean;
  tableRef: React.RefObject<HTMLTableElement | null>;
  onCommit?: (patch: Partial<TableLayoutResizeState>) => void;
};

type DragTarget =
  | { kind: "column"; field: string; startX: number; startWidth: number }
  | { kind: "series"; startX: number; startWidth: number }
  | { kind: "row"; startY: number; startHeight: number };

function hasSavedColumnWidths(initial: Partial<TableLayoutResizeState>): boolean {
  return Boolean(initial.columnWidthsPx && Object.keys(initial.columnWidthsPx).length > 0);
}

function buildInitialState(
  columns: string[],
  showSeriesNumber: boolean,
  initial: Partial<TableLayoutResizeState>,
): TableLayoutResizeState {
  const columnWidthsPx: Record<string, number> = {};
  for (const col of columns) {
    columnWidthsPx[col] = initial.columnWidthsPx?.[col] ?? TABLE_DEFAULT_COL_PX;
  }
  return {
    columnWidthsPx,
    seriesColumnWidthPx:
      initial.seriesColumnWidthPx ?? (showSeriesNumber ? TABLE_DEFAULT_SERIES_PX : 0),
    rowHeightPx: initial.rowHeightPx ?? TABLE_DEFAULT_ROW_PX,
  };
}

export function useTableLayoutResize({
  columns,
  showSeriesNumber,
  initial,
  enabled,
  tableRef,
  onCommit,
}: UseTableLayoutResizeOptions) {
  const savedInitially = hasSavedColumnWidths(initial);
  const [pixelActive, setPixelActive] = useState(savedInitially);
  const [layout, setLayout] = useState<TableLayoutResizeState>(() =>
    buildInitialState(columns, showSeriesNumber, initial),
  );
  const [guide, setGuide] = useState<TableResizeGuideState | null>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const autoFitRef = useRef<AutoFitContext | null>(null);

  const initialKey = useMemo(
    () =>
      JSON.stringify({
        columns,
        showSeriesNumber,
        columnWidthsPx: initial.columnWidthsPx,
        seriesColumnWidthPx: initial.seriesColumnWidthPx,
        rowHeightPx: initial.rowHeightPx,
      }),
    [
      columns,
      showSeriesNumber,
      initial.columnWidthsPx,
      initial.seriesColumnWidthPx,
      initial.rowHeightPx,
    ],
  );

  useEffect(() => {
    const nextSaved = hasSavedColumnWidths(initial);
    setLayout(buildInitialState(columns, showSeriesNumber, initial));
    setPixelActive(nextSaved);
  }, [initialKey]);

  const hydrateColumnWidthsFromDom = useCallback(() => {
    const table = tableRef.current;
    if (!table) return false;
    const measured = measureTableLayoutFromDom({ table, columns, showSeriesNumber });
    const next = {
      ...layoutRef.current,
      columnWidthsPx: { ...layoutRef.current.columnWidthsPx, ...measured.columnWidthsPx },
      seriesColumnWidthPx: measured.seriesColumnWidthPx,
    };
    layoutRef.current = next;
    setLayout(next);
    setPixelActive(true);
    return true;
  }, [columns, showSeriesNumber, tableRef]);

  const ensurePixelReady = useCallback(() => {
    if (pixelActive) return true;
    return hydrateColumnWidthsFromDom();
  }, [hydrateColumnWidthsFromDom, pixelActive]);

  const commitDrag = useCallback(
    (drag: DragTarget) => {
      if (!onCommit) return;
      const current = layoutRef.current;
      if (drag.kind === "row") {
        onCommit({ rowHeightPx: Math.round(current.rowHeightPx) });
        return;
      }
      onCommit({
        columnWidthsPx: current.columnWidthsPx,
        seriesColumnWidthPx: showSeriesNumber ? current.seriesColumnWidthPx : undefined,
      });
    },
    [onCommit, showSeriesNumber],
  );

  useEffect(() => {
    if (!enabled) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === "row") {
        const next = Math.round(
          Math.max(TABLE_MIN_ROW_PX, drag.startHeight + (event.clientY - drag.startY)),
        );
        setLayout((prev) => ({ ...prev, rowHeightPx: next }));
        setGuide({ orientation: "row", position: event.clientY });
        return;
      }
      const delta = event.clientX - drag.startX;
      const next = Math.max(TABLE_MIN_COL_PX, drag.startWidth + delta);
      if (drag.kind === "series") {
        setLayout((prev) => ({ ...prev, seriesColumnWidthPx: next }));
      } else {
        setLayout((prev) => ({
          ...prev,
          columnWidthsPx: { ...prev.columnWidthsPx, [drag.field]: next },
        }));
      }
      setGuide({ orientation: "column", position: event.clientX });
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setGuide(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.removeAttribute("data-vs-table-resizing");
      commitDrag(drag);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [commitDrag, enabled]);

  const beginDrag = useCallback(
    (target: DragTarget, cursor: string, guideState: TableResizeGuideState) => {
      dragRef.current = target;
      setGuide(guideState);
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
      document.body.setAttribute("data-vs-table-resizing", "");
    },
    [],
  );

  const startColumnResize = useCallback(
    (field: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      ensurePixelReady();
      const th = event.currentTarget.closest("th");
      const startWidth = th?.getBoundingClientRect().width ?? TABLE_DEFAULT_COL_PX;
      beginDrag(
        { kind: "column", field, startX: event.clientX, startWidth },
        "col-resize",
        { orientation: "column", position: event.clientX },
      );
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginDrag, enabled, ensurePixelReady],
  );

  const startSeriesResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !showSeriesNumber) return;
      event.preventDefault();
      event.stopPropagation();
      ensurePixelReady();
      const th = event.currentTarget.closest("th");
      const startWidth = th?.getBoundingClientRect().width ?? TABLE_DEFAULT_SERIES_PX;
      beginDrag(
        { kind: "series", startX: event.clientX, startWidth },
        "col-resize",
        { orientation: "column", position: event.clientX },
      );
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginDrag, enabled, ensurePixelReady, showSeriesNumber],
  );

  const startRowResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      const table = tableRef.current;
      const bodyRow = table?.querySelector("tbody tr");
      const startHeight = Math.round(
        layoutRef.current.rowHeightPx ||
          bodyRow?.getBoundingClientRect().height ||
          TABLE_DEFAULT_ROW_PX,
      );
      beginDrag(
        { kind: "row", startY: event.clientY, startHeight },
        "row-resize",
        { orientation: "row", position: event.clientY },
      );
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [beginDrag, enabled, tableRef],
  );

  const setAutoFitContext = useCallback((ctx: AutoFitContext | null) => {
    autoFitRef.current = ctx;
  }, []);

  const autoFitColumn = useCallback(
    (field: string) => {
      const ctx = autoFitRef.current;
      if (!ctx || !enabled) return;
      ensurePixelReady();
      const width = measureColumnAutoFitWidth({
        field,
        columns: ctx.columns,
        displayCols: ctx.displayCols,
        rows: ctx.rows,
        headerLabel: ctx.headerLabel(field),
        showSeriesNumber: ctx.showSeriesNumber,
        formatCell: ctx.formatCell,
      });
      setLayout((prev) => {
        const next =
          field === "__vs_series__"
            ? { ...prev, seriesColumnWidthPx: width }
            : { ...prev, columnWidthsPx: { ...prev.columnWidthsPx, [field]: width } };
        layoutRef.current = next;
        return next;
      });
      setPixelActive(true);
      if (onCommit) {
        const current = layoutRef.current;
        onCommit({
          columnWidthsPx: current.columnWidthsPx,
          seriesColumnWidthPx: showSeriesNumber ? current.seriesColumnWidthPx : undefined,
        });
      }
    },
    [enabled, ensurePixelReady, onCommit, showSeriesNumber],
  );

  return {
    layout,
    pixelActive,
    guide,
    startColumnResize,
    startSeriesResize,
    startRowResize,
    autoFitColumn,
    setAutoFitContext,
  };
}
