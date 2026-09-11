import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmbeddedChartTable } from "@/components/charts/adapters/EmbeddedChartTable";
import { resolveTableThemeVars } from "@/lib/chartSurfaceTheme";

afterEach(cleanup);

/** 样式 Tab 字段 → 渲染接线回归（防「能点但不生效」） */
describe("table style wiring contract", () => {
  it("auto mode ignores saved drag pixel widths", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a", "b"]}
        displayCols={["a", "b"]}
        rows={[[1, 2]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
        tableStyle={{
          columnWidthMode: "auto",
          columnWidthsPx: { a: 240, b: 240 },
        }}
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveAttribute("data-column-width-mode", "auto");
    const cols = container.querySelectorAll("col");
    expect(cols[0]).toHaveStyle({ width: "50%" });
  });

  it("columnBg and cornerBg theme vars reach table host", () => {
    const themeVars = resolveTableThemeVars(
      { columnBg: "#eef2ff", cornerBg: "#c7d2fe", headerBg: "#f9fafb" },
      { colorScheme: "light" },
    );
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1]]}
        page={1}
        onPageChange={() => {}}
        themeVars={themeVars}
      />,
    );
    const host = container.firstElementChild as HTMLElement;
    expect(host.style.getPropertyValue("--dashboard-table-column-bg")).toBe("#eef2ff");
    expect(host.style.getPropertyValue("--dashboard-table-corner-bg")).toBe("#c7d2fe");
  });

  it("saved rowHeightPx applies without entering drag pixel mode", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1], [2]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
        tableStyle={{ rowHeightPx: 52 }}
      />,
    );
    const cell = container.querySelector("tbody td") as HTMLElement;
    expect(cell.style.height).toBe("52px");
  });
});
