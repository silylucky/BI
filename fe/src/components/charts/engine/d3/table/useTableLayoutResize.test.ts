import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTableLayoutResize } from "./useTableLayoutResize";

function createTableFixture() {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const th = document.createElement("th");
  th.textContent = "name";
  th.getBoundingClientRect = () =>
    ({
      width: 120,
      height: 32,
      top: 0,
      left: 0,
      right: 120,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  headerRow.appendChild(th);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const bodyRow = document.createElement("tr");
  const td = document.createElement("td");
  bodyRow.appendChild(td);
  bodyRow.getBoundingClientRect = () =>
    ({
      width: 120,
      height: 36,
      top: 32,
      left: 0,
      right: 120,
      bottom: 68,
      x: 0,
      y: 32,
      toJSON: () => ({}),
    }) as DOMRect;
  tbody.appendChild(bodyRow);
  table.appendChild(tbody);
  document.body.appendChild(table);
  return table;
}

describe("useTableLayoutResize", () => {
  it("updates column width on pointer drag and commits on pointerup", () => {
    const onCommit = vi.fn();
    const tableRef = { current: createTableFixture() };
    const { result } = renderHook(() =>
      useTableLayoutResize({
        columns: ["name"],
        showSeriesNumber: false,
        initial: {},
        enabled: true,
        tableRef,
        onCommit,
      }),
    );

    const handle = document.createElement("div");
    handle.closest = () => tableRef.current?.querySelector("th") ?? null;

    act(() => {
      result.current.startColumnResize("name", {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        currentTarget: handle,
        pointerId: 1,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(result.current.pixelActive).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 130 }));
    });

    expect(result.current.layout.columnWidthsPx.name).toBe(150);
    expect(result.current.guide).toEqual({ orientation: "column", position: 130 });

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    expect(result.current.guide).toBeNull();
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        columnWidthsPx: expect.objectContaining({ name: 150 }),
      }),
    );
    expect(onCommit.mock.calls[0]?.[0]).not.toHaveProperty("rowHeightPx");
  });

  it("row drag commits only rowHeightPx without columnWidthsPx", () => {
    const onCommit = vi.fn();
    const tableRef = { current: createTableFixture() };
    const { result } = renderHook(() =>
      useTableLayoutResize({
        columns: ["name"],
        showSeriesNumber: false,
        initial: { rowHeightPx: 32 },
        enabled: true,
        tableRef,
        onCommit,
      }),
    );

    const handle = document.createElement("div");

    act(() => {
      result.current.startRowResize({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientY: 100,
        currentTarget: handle,
        pointerId: 2,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientY: 120 }));
    });

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ rowHeightPx: expect.any(Number) });
    expect(onCommit.mock.calls[0]?.[0]).not.toHaveProperty("columnWidthsPx");
  });
});
