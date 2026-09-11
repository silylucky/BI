import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TablePaginationBar } from "./TablePaginationBar";

afterEach(cleanup);

describe("TablePaginationBar", () => {
  it("applies pagination font color and size to bar text", () => {
    const { container } = render(
      <TablePaginationBar
        page={2}
        totalPages={5}
        pageSize={20}
        totalRows={100}
        tableStyle={{ paginationFg: "#ff0000", paginationFontSize: 20 }}
        onPageChange={vi.fn()}
      />,
    );

    const bar = screen.getByTestId("table-pagination-compact");
    expect(bar).toHaveStyle({ fontSize: "20px", color: "rgb(255, 0, 0)" });

    const countLabel = container.querySelector("span");
    expect(countLabel?.textContent).toContain("共 100 条");
    expect(countLabel?.className).not.toContain("text-theme-sm");
    expect(countLabel?.className).not.toContain("dashboard-text-muted");
  });
});
