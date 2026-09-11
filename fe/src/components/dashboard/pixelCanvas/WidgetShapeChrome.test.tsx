import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetShapeChrome } from "./WidgetShapeChrome";

describe("WidgetShapeChrome", () => {
  afterEach(() => cleanup());
  it("T-TITLE-DE-01: shows read-only title when not selected", () => {
    render(
      <WidgetShapeChrome
        title="销售趋势"
        titleStyle={{ fontSize: 14 }}
        showTitle
        mode="edit"
        selected={false}
        widgetId="w1"
      />,
    );
    expect(screen.getByTestId("pixel-shape-title-w1")).toHaveTextContent("销售趋势");
    expect(screen.queryByLabelText("组件标题")).not.toBeInTheDocument();
  });

  it("T-TITLE-DE-02: selected edit mode shows plain title until clicked", async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(
      <WidgetShapeChrome
        title="销售趋势"
        titleStyle={{}}
        showTitle
        mode="edit"
        selected
        widgetId="w1"
        onTitleChange={onTitleChange}
        onDragPointerDown={vi.fn()}
      />,
    );
    expect(screen.getByTestId("pixel-shape-title-w1")).toHaveTextContent("销售趋势");
    expect(screen.queryByLabelText("组件标题")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("pixel-shape-title-w1"));
    expect(screen.getByLabelText("组件标题")).toHaveValue("销售趋势");
  });

  it("T-TITLE-DE-03: view mode keeps title visible", () => {
    render(
      <WidgetShapeChrome
        title="KPI"
        titleStyle={{}}
        showTitle
        mode="view"
        selected={false}
        widgetId="w2"
      />,
    );
    expect(screen.getByTestId("pixel-shape-title-w2")).toBeInTheDocument();
  });

  it("T-TITLE-DE-04: remark renders when enabled", () => {
    render(
      <WidgetShapeChrome
        title="图表"
        titleStyle={{}}
        showTitle
        remark={{ show: true, text: "单位：万元" }}
        mode="view"
        selected={false}
        widgetId="w3"
      />,
    );
    expect(screen.getByTestId("pixel-shape-remark-w3")).toHaveTextContent("单位：万元");
  });

  it("T-TITLE-DE-05: title bar selects when not selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <WidgetShapeChrome
        title="销售趋势"
        titleStyle={{}}
        showTitle
        mode="edit"
        selected={false}
        widgetId="w4"
        onTitleChange={vi.fn()}
        onSelectPointerDown={onSelect}
      />,
    );
    await user.pointer({ keys: "[MouseLeft>]", target: screen.getByTestId("pixel-shape-title-w4") });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
