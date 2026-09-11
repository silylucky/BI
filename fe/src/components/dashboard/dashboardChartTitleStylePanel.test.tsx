import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardChartTitleStylePanel } from "./dashboardChartTitleStylePanel";

afterEach(cleanup);

describe("DashboardChartTitleStylePanel", () => {
  it("renders compact toolbar and emits patches", async () => {
    const user = userEvent.setup();
    const onPatch = vi.fn();

    render(
      <DashboardChartTitleStylePanel
        titleStyle={{ fontSize: 16, color: "#333333", align: "left", fontWeight: 600 }}
        onPatch={onPatch}
      />,
    );

    expect(screen.getByText("显示标题")).toBeInTheDocument();
    expect(screen.getByText("文本")).toBeInTheDocument();
    expect(screen.getByTestId("de-title-style-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "字号" })).toHaveTextContent("16");
    expect(screen.getByRole("button", { name: "粗体" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("switch", { name: "显示标题" }));
    expect(onPatch).toHaveBeenCalledWith({ show: false });

    await user.click(screen.getByRole("button", { name: "粗体" }));
    expect(onPatch).toHaveBeenCalledWith({ fontWeight: 400 });

    await user.click(screen.getByRole("button", { name: "居中对齐" }));
    expect(onPatch).toHaveBeenCalledWith({ align: "center" });
  });
});
