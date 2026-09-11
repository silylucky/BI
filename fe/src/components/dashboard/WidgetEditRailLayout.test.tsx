import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { WidgetEditRailLayout } from "./WidgetEditRailLayout";

function renderRail(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("WidgetEditRailLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders config and dataset columns without inner collapse controls", () => {
    renderRail(
      <WidgetEditRailLayout
        leftLabel="堆叠柱状图"
        leftSubtitle="政务核心指标"
        rightLabel="数据集"
        left={<div>配置</div>}
        right={<div data-testid="dataset-main">字段库</div>}
      />,
    );

    expect(screen.getByText("配置")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "堆叠柱状图" })).toBeInTheDocument();
    expect(screen.getByText("政务核心指标")).toBeInTheDocument();
    expect(screen.getByTestId("dataset-main")).toBeInTheDocument();
    expect(screen.queryByLabelText("收起堆叠柱状图")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("收起数据集")).not.toBeInTheDocument();
  });

  it("uses full rail width inside the fixed shell", () => {
    const { container } = renderRail(
      <WidgetEditRailLayout
        leftLabel="堆叠柱状图"
        rightLabel="数据集"
        left={<div>配置</div>}
        right={<div>字段库</div>}
      />,
    );

    const rail = container.querySelector('[data-testid="widget-edit-rail-layout"]') as HTMLElement;
    expect(rail).toHaveClass("w-full");
    expect(rail).not.toHaveClass("ml-auto");
  });

  it("exposes a vertical resize handle between config and dataset columns", () => {
    renderRail(
      <WidgetEditRailLayout
        leftLabel="GIS 地图"
        rightLabel="数据集"
        left={<div>配置</div>}
        right={<div>字段库</div>}
      />,
    );

    expect(screen.getByTestId("widget-edit-rail-resize-handle")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });
});
