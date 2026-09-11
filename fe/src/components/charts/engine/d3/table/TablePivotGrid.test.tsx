import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TablePivotGrid } from "./TablePivotGrid";
import type { PivotTableModel } from "./types";

function renderGrid(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const baseModel: PivotTableModel = {
  kind: "pivot",
  rowField: "product",
  rowLabel: "产品",
  colField: "city",
  colLabel: "城市",
  metrics: [{ field: "amount", label: "销售额" }],
  rowKeys: ["A", "B", "C", "D", "E"],
  colKeys: ["北京"],
  cells: {
    A: { 北京: { amount: 1 } },
    B: { 北京: { amount: 2 } },
    C: { 北京: { amount: 3 } },
    D: { 北京: { amount: 4 } },
    E: { 北京: { amount: 5 } },
  },
  showRowTotal: true,
  showColTotal: true,
};

describe("TablePivotGrid", () => {
  it("paginates row keys when page mode exceeds page size", () => {
    cleanup();
    renderGrid(
      <TablePivotGrid
        model={baseModel}
        tableStyle={{ paginationMode: "page", pageSize: 2 }}
        page={1}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
    expect(screen.getByTestId("table-pagination-compact")).toBeInTheDocument();
  });

  it("fires drill callback on row header click", () => {
    cleanup();
    const onDrill = vi.fn();
    renderGrid(
      <TablePivotGrid
        model={baseModel}
        tableStyle={{ paginationMode: "scroll" }}
        drillField="product"
        onDrillCellClick={onDrill}
      />,
    );
    fireEvent.click(screen.getByText("A"));
    expect(onDrill).toHaveBeenCalledWith("product", "A");
  });
});
