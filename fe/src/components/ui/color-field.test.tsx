import type { ReactElement } from "react";
import { CANVAS_BG_RECOMMENDED } from "@/components/dashboard/dashboardStyleConfig";
import { act, cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorField } from "./color-field";

vi.mock("react-colorful", () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (value: string) => void;
  }) => (
    <input
      type="color"
      aria-label="hex-color-picker"
      value={color}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("ColorField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("debounces hex input commits", () => {
    const onChange = vi.fn();
    render(<ColorField value="#ffffff" onChange={onChange} label="画布底色" />);
    const input = screen.getByPlaceholderText("#ffffff");

    fireEvent.change(input, { target: { value: "#111111" } });
    fireEvent.change(input, { target: { value: "#7e4a44" } });

    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("#7e4a44");
  });

  it("flushes pending color when popover closes", () => {
    const onChange = vi.fn();
    render(<ColorField value="#ffffff" onChange={onChange} label="主题色" />);
    fireEvent.click(screen.getByLabelText("主题色取色器"));
    const picker = screen.getByLabelText("hex-color-picker");

    fireEvent.change(picker, { target: { value: "#465fff" } });
    fireEvent.click(screen.getByLabelText("主题色取色器"));

    expect(onChange).toHaveBeenCalledWith("#465fff");
  });

  it("commits picker changes while popover stays open (debounced)", () => {
    const onChange = vi.fn();
    render(<ColorField value="#ffffff" onChange={onChange} label="背景色" />);
    fireEvent.click(screen.getByLabelText("背景色取色器"));
    const picker = screen.getByLabelText("hex-color-picker");

    fireEvent.change(picker, { target: { value: "#43b379" } });

    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(onChange).toHaveBeenCalledWith("#43b379");
  });

  it("does not commit partial hex while typing", () => {
    const onChange = vi.fn();
    render(<ColorField value="#ffffff" onChange={onChange} label="边框色" />);
    const input = screen.getByLabelText("边框色 Hex");

    fireEvent.change(input, { target: { value: "#43" } });
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders recommended swatches in a grid with labels", () => {
    const onChange = vi.fn();
    render(
      <ColorField
        value="#ffffff"
        onChange={onChange}
        label="画布底色"
        swatches={CANVAS_BG_RECOMMENDED}
      />,
    );
    fireEvent.click(screen.getByLabelText("画布底色取色器"));

    expect(screen.getByRole("listbox", { name: "画布底色推荐色" })).toHaveClass("grid");
    expect(screen.getByRole("option", { name: "纯白" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "墨蓝" })).toBeInTheDocument();
  });

  it("renders swatch variant without hex input", () => {
    const onChange = vi.fn();
    render(
      <ColorField
        variant="swatch"
        value="#3370ff"
        onChange={onChange}
        label="边框色"
        swatches={["#3370ff"]}
      />,
    );
    expect(screen.queryByPlaceholderText("#ffffff")).not.toBeInTheDocument();
    expect(screen.getByLabelText("边框色取色器")).toBeInTheDocument();
    expect(screen.queryByText("#3370FF")).not.toBeInTheDocument();
    expect(screen.getByText("边框色")).toBeInTheDocument();
  });

  it("renders swatch variant without hex code when label is external", () => {
    const onChange = vi.fn();
    render(
      <ColorField
        variant="swatch"
        showLabel={false}
        buttonAriaLabel="背景色取色器"
        value="#43b379"
        onChange={onChange}
      />,
    );
    expect(screen.queryByText("#43B379")).not.toBeInTheDocument();
    expect(screen.queryByText("背景色")).not.toBeInTheDocument();
  });

  it("shows fallback color in swatch trigger instead of 未设置", () => {
    const onChange = vi.fn();
    render(
      <ColorField
        variant="swatch"
        showLabel={false}
        buttonAriaLabel="字体颜色取色器"
        value=""
        fallbackValue="#667085"
        onChange={onChange}
      />,
    );
    expect(screen.queryByText("未设置")).not.toBeInTheDocument();
    expect(screen.getByLabelText("字体颜色取色器")).toHaveAttribute(
      "title",
      "字体颜色 · #667085",
    );
  });

  it("commits swatch picker color and clear without nesting tooltip trigger", () => {
    const onChange = vi.fn();
    render(
      <ColorField
        variant="swatch"
        label="装饰色"
        value="#3370ff"
        onChange={onChange}
        swatches={["#ff0000"]}
        liveCommitMs={0}
      />,
    );
    fireEvent.click(screen.getByLabelText("装饰色取色器"));
    fireEvent.click(screen.getByRole("option", { name: "#ff0000" }));
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    fireEvent.click(screen.getByRole("button", { name: "清除颜色" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
