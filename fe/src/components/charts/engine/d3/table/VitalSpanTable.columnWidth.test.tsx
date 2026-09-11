import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VitalSpanTable } from "@/components/charts/engine/d3/table/VitalSpanTable";

describe("VitalSpanTable column width wiring", () => {
  it("applies custom percentage widths when only rowHeightPx is set (no drag pixels)", () => {
    const { container } = render(
      <TooltipProvider>
        <VitalSpanTable
          columns={["a", "b"]}
          displayCols={["a", "b"]}
          rows={[
            ["x", 1],
            ["y", 2],
          ]}
          page={1}
          onPageChange={() => {}}
          embedded
          layoutInteractive={false}
          tableStyle={{
            columnWidthMode: "custom",
            columnWidths: { a: 30, b: 70 },
            rowHeightPx: 48,
          }}
        />
      </TooltipProvider>,
    );

    const colA = container.querySelector('col[style*="width: 30%"]');
    const colB = container.querySelector('col[style*="width: 70%"]');
    expect(colA).toBeTruthy();
    expect(colB).toBeTruthy();
  });
});
