import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartDeSliderField, DashboardConfigGridSlider, DashboardConfigSlider, DeAttrSliderField, DeProgressSlider, DE_SLIDER_WIDTH_WIDE } from "./deAttrSlider";

afterEach(cleanup);

describe("ChartDeSliderField", () => {
  it("renders range slider and emits value on change", () => {
    const onChange = vi.fn();
    render(
      <ChartDeSliderField
        label="不透明度 %"
        value={80}
        min={0}
        max={100}
        unit="%"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("不透明度 %")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "不透明度 %" });
    expect(slider).toHaveValue("80");
    expect(screen.getByTestId("de-progress-slider")).toHaveClass("w-full", "min-w-0");

    fireEvent.change(slider, { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it("renders filled progress track proportional to value", () => {
    const { container } = render(
      <DeProgressSlider
        value={50}
        min={0}
        max={100}
        step={1}
        ariaLabel="测试滑块"
        onChange={vi.fn()}
      />,
    );

    const fill = container.querySelector(".origin-left");
    expect(fill).toHaveStyle({ transform: "scaleX(0.5)" });
  });

  it("commits once on pointer up after drag when liveUpdate is off", () => {
    const onChange = vi.fn();
    render(
      <DeProgressSlider
        value={10}
        min={0}
        max={100}
        step={1}
        ariaLabel="测试"
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "测试" });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "20" } });
    fireEvent.change(slider, { target: { value: "30" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it("emits on each change while dragging when liveUpdate is on", () => {
    const onChange = vi.fn();
    render(
      <ChartDeSliderField
        label="外径"
        value={70}
        min={0}
        max={100}
        unit="%"
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "外径" });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "80" } });
    fireEvent.change(slider, { target: { value: "90" } });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 80);
    expect(onChange).toHaveBeenNthCalledWith(2, 90);

    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("uses fallback when value is undefined", () => {
    render(
      <ChartDeSliderField
        label="字号"
        value={undefined}
        fallback={18}
        min={10}
        max={48}
        unit="px"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("18px")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "字号" })).toHaveValue("18");
  });
});

describe("DashboardConfigSlider", () => {
  it("uses inline label row with fixed-width track", () => {
    render(
      <DashboardConfigSlider
        label="背景模糊"
        value={12}
        min={0}
        max={48}
        unit="px"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("背景模糊")).toBeInTheDocument();
    expect(screen.getByText("12px")).toBeInTheDocument();
    expect(screen.getByTestId("de-progress-slider")).toHaveClass(DE_SLIDER_WIDTH_WIDE);
    expect(screen.getByTestId("de-progress-slider")).not.toHaveClass("w-full");
  });

  it("uses stacked full-width track in compact popover density", () => {
    render(
      <DashboardConfigSlider
        compact
        label="字间距"
        value={2}
        min={0}
        max={8}
        unit="px"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("de-progress-slider")).toHaveClass("w-full", "min-w-0");
  });
});

describe("DashboardConfigGridSlider", () => {
  it("uses stacked layout in 2-col cells to avoid label overlap", () => {
    render(
      <div className="w-[180px]">
        <DashboardConfigGridSlider
          label="左上"
          value={8}
          min={0}
          max={64}
          unit="px"
          onChange={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText("左上")).toBeInTheDocument();
    expect(screen.getByText("8px")).toBeInTheDocument();
    expect(screen.getByTestId("de-progress-slider")).toHaveClass("w-full");
  });
});

describe("DeAttrSliderField", () => {
  it("renders DeAttrField layout with live value hint", () => {
    const onChange = vi.fn();
    render(
      <DeAttrSliderField
        label="组件圆角"
        value={12}
        min={0}
        max={48}
        unit="px"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("组件圆角")).toBeInTheDocument();
    expect(screen.getByText("12px")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "组件圆角" }), {
      target: { value: "20" },
    });
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("uses full-width stacked track when compact in narrow chart rail", () => {
    render(
      <DeAttrSliderField
        compact
        label="拖影长度"
        value={48}
        min={8}
        max={120}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("de-progress-slider")).toHaveClass("w-full", "min-w-0");
    expect(screen.getByTestId("de-progress-slider")).not.toHaveClass(DE_SLIDER_WIDTH_WIDE);
  });
});
