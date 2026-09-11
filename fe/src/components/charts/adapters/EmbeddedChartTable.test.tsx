import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dispatchPixelLayoutGeometryCommitted } from "@/components/dashboard/pixelCanvas/pixelShapeLiveResize";
import { EmbeddedChartTable } from "./EmbeddedChartTable";

afterEach(cleanup);

describe("EmbeddedChartTable", () => {
  it("uses table-fixed equal columns in standalone mode by default", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["id", "name"]}
        displayCols={["id", "name"]}
        rows={[[1, "a"]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");
    expect(table).toHaveClass("min-w-full");
    expect(container.querySelectorAll("col")).toHaveLength(2);
  });

  it("embedded auto column mode fills container with equal columns", () => {
    const { container } = render(
      <div style={{ position: "relative", width: 320, height: 200 }}>
        <EmbeddedChartTable
          embedded
          layoutInteractive={false}
          columns={["a", "b", "c"]}
          displayCols={["a", "b", "c"]}
          rows={[[1, 2, 3]]}
          page={1}
          onPageChange={() => {}}
          tableStyle={{ columnWidthMode: "auto" }}
        />
      </div>,
    );
    const host = container.querySelector(".embedded-chart-table-host");
    expect(host).toHaveClass("absolute", "inset-0");
    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");
    const cols = container.querySelectorAll("col");
    expect(cols).toHaveLength(3);
    expect(cols[0]).toHaveStyle({ width: "33.333333333333336%" });
  });

  it("embedded fixed column mode uses pixel colgroup and horizontal scroll", () => {
    const { container } = render(
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <EmbeddedChartTable
          embedded
          layoutInteractive={false}
          columns={["a", "b", "c", "d"]}
          displayCols={["a", "b", "c", "d"]}
          rows={[["长文本列标题A", 2, 3, 4]]}
          page={1}
          onPageChange={() => {}}
          tableStyle={{ columnWidthMode: "fixed" }}
        />
      </div>,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");
    expect(table).toHaveClass("w-max");
    expect(table).toHaveAttribute("data-column-width-mode", "fixed");
    const cols = container.querySelectorAll("col");
    expect(cols.length).toBeGreaterThan(0);
    expect(cols[0]?.getAttribute("style")).toMatch(/px/);
    expect(cols).toHaveLength(4);
  });

  it("truncates cell text with title tooltip", () => {
    render(
      <EmbeddedChartTable
        columns={["channel"]}
        displayCols={["channel"]}
        rows={[["线下门店"]]}
        page={1}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByTitle("线下门店")).toHaveClass("truncate");
  });

  it("applies custom table theme variables", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1]]}
        page={1}
        onPageChange={() => {}}
        themeVars={{
          "--dashboard-table-header-bg": "#eef2ff",
          "--dashboard-table-header-fg": "#312e81",
          "--dashboard-scroll-track": "rgb(249 250 251)",
        }}
        surfaceScheme="light"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--dashboard-table-header-bg")).toBe("#eef2ff");
    const thead = container.querySelector("thead th");
    expect(thead).toHaveClass("vs-table-th");
  });

  it("applies opacity, border and scrollbar theme variables", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{
          opacity: 80,
          borderColor: "#ff0000",
          scrollbarColor: "#00ff00",
        }}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveStyle({ border: "1px solid rgb(255, 0, 0)", opacity: "0.8" });
    const scroll = container.querySelector(".dashboard-scroll") as HTMLElement;
    expect(scroll.style.getPropertyValue("--dashboard-scroll-thumb")).toBe("#00ff00");
  });

  it("page mode shows pagination bar even when rows fit one page", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["id"]}
        displayCols={["id"]}
        rows={[[1], [2]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{ paginationMode: "page", pageSize: 20 }}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(within(root).getByTestId("table-pagination-compact")).toBeInTheDocument();
    expect(within(root).getByText("1/1")).toBeInTheDocument();
  });

  it("scroll mode renders all rows without pagination", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["id"]}
        displayCols={["id"]}
        rows={[[1], [2], [3]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{ paginationMode: "scroll", pageSize: 2 }}
      />,
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(within(container).queryByLabelText("上一页")).not.toBeInTheDocument();
    expect(within(container).getByText("下拉滚动浏览")).toBeInTheDocument();
  });

  it("page mode uses compact pagination variant", () => {
    render(
      <EmbeddedChartTable
        columns={["id"]}
        displayCols={["id"]}
        rows={[[1], [2], [3]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{ paginationMode: "page", pageSize: 2, paginationVariant: "compact" }}
      />,
    );
    expect(screen.getByLabelText("上一页")).toBeInTheDocument();
    const bar = screen.getByTestId("table-pagination-compact");
    expect(within(bar).getByText("1/2")).toBeInTheDocument();
    expect(within(bar).getByText("共 3 条")).toBeInTheDocument();
    expect(within(bar).getByText("2 条/页")).toBeInTheDocument();
  });

  it("auto column mode uses equal col widths in container", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a", "b"]}
        displayCols={["a", "b"]}
        rows={[[1, 2]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
        tableStyle={{ columnWidthMode: "auto" }}
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");
    const cols = container.querySelectorAll("col");
    expect(cols).toHaveLength(2);
    expect(cols[0]).toHaveStyle({ width: "50%" });
  });

  it("fixed column mode uses table-fixed with pixel colgroup", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a", "b"]}
        displayCols={["a", "b"]}
        rows={[[1, 2]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
        tableStyle={{ columnWidthMode: "fixed" }}
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveClass("table-fixed");
    expect(table).toHaveAttribute("data-column-width-mode", "fixed");
    const cols = container.querySelectorAll("col");
    expect(cols).toHaveLength(2);
    expect(cols[0]?.getAttribute("style")).toMatch(/px/);
  });

  it("custom column mode applies configured widths", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a", "b"]}
        displayCols={["a", "b"]}
        rows={[[1, 2]]}
        page={1}
        onPageChange={() => {}}
        layoutInteractive={false}
        tableStyle={{
          columnWidthMode: "custom",
          columnWidths: { a: 30, b: 70 },
        }}
      />,
    );
    const cols = container.querySelectorAll("col");
    expect(cols[0]).toHaveStyle({ width: "30%" });
    expect(cols[1]).toHaveStyle({ width: "70%" });
  });

  it("row hover can be disabled", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{ rowHover: false }}
      />,
    );
    expect(container.querySelector("table")).not.toHaveAttribute("data-row-hover");
  });

  it("enables row hover marker on table by default", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["a"]}
        displayCols={["a"]}
        rows={[[1]]}
        page={1}
        onPageChange={() => {}}
      />,
    );
    expect(container.querySelector("table")).toHaveAttribute("data-row-hover");
  });

  it("T-TABLE-UI-03: wordWrap uses break-words", () => {
    render(
      <EmbeddedChartTable
        columns={["t"]}
        displayCols={["t"]}
        rows={[["长文本"]]}
        page={1}
        onPageChange={() => {}}
        tableStyle={{ wordWrap: true }}
      />,
    );
    expect(screen.getByTitle("长文本")).toHaveClass("break-words");
  });

  it("renders summary footer for metric columns", () => {
    render(
      <EmbeddedChartTable
        columns={["region", "amount"]}
        displayCols={["region", "amount"]}
        rows={[
          ["华东", 10],
          ["华北", 20],
        ]}
        page={1}
        onPageChange={() => {}}
        metricFields={["amount"]}
        themeVars={{
          "--dashboard-table-summary-bg": "#fef3c7",
          "--dashboard-table-summary-fg": "#92400e",
        }}
      />,
    );
    expect(screen.getByText("合计")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    const footer = document.querySelector("tfoot tr");
    expect(footer).toHaveClass("vs-table-summary-row");
  });

  it("hides summary when showSummary is false", () => {
    const { container } = render(
      <EmbeddedChartTable
        columns={["amount"]}
        displayCols={["amount"]}
        rows={[[1], [2]]}
        page={1}
        onPageChange={() => {}}
        metricFields={["amount"]}
        tableStyle={{ showSummary: false }}
      />,
    );
    expect(container.querySelector("tfoot")).toBeNull();
  });

  it("responds to pixel layout geometry committed after resize", async () => {
    const rects: DOMRect[] = [];
    const { container } = render(
      <div data-component-id="table-w1" className="pixel-shape-outer" style={{ width: 400, height: 240 }}>
        <div className="pixel-shape-inner">
          <EmbeddedChartTable
            embedded
            columns={["a"]}
            displayCols={["a"]}
            rows={[[1]]}
            page={1}
            onPageChange={() => {}}
          />
        </div>
      </div>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const host = container.querySelector(".embedded-chart-table-host") as HTMLElement;
    const original = host.getBoundingClientRect.bind(host);
    host.getBoundingClientRect = () => {
      const rect = original();
      rects.push(rect);
      return rect;
    };
    await act(() => {
      dispatchPixelLayoutGeometryCommitted(["table-w1"]);
    });
    expect(rects.length).toBeGreaterThan(0);
  });
});
