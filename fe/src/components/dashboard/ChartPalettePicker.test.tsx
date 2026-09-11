import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChartPalettePicker } from "./ChartPalettePicker";

afterEach(cleanup);

describe("ChartPalettePicker", () => {
  it("renders wide select with swatch presets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartPalettePicker showInherit value={undefined} onChange={onChange} />);

    const trigger = screen.getByRole("combobox", { name: "配色方案" });
    expect(trigger).toBeInTheDocument();
    expect(trigger.querySelector("[aria-hidden]")).toBeTruthy();
    expect(screen.getByText("默认")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /浅韵/ }));
    expect(onChange).toHaveBeenCalledWith("pastel", expect.any(Array));
  });

  it("renders wide select trigger swatch for active preset", () => {
    render(<ChartPalettePicker value="default" onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "配色方案" });
    expect(trigger).toHaveTextContent("品牌");
    expect(trigger.querySelector("[aria-hidden]")).toBeTruthy();
    expect(trigger.className).toContain("text-left");
    const label = screen.getByTestId("chart-palette-option-label");
    expect(label).toHaveTextContent("品牌");
    expect(label.className).toContain("text-left");
    expect(label.className).toContain("w-full");
  });

  it("renders series color rows for bar chart metrics", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <ChartPalettePicker
          value="default"
          seriesColors={[{ id: "amount", name: "amount", color: "#465fff" }]}
          onChange={vi.fn()}
          onSeriesColorsChange={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "自定义配色" }));
    expect(screen.getByText("amount")).toBeInTheDocument();
  });

  it("switches from inherit to default when opening custom colors", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartPalettePicker dense showInherit value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "自定义配色" }));
    expect(onChange).toHaveBeenCalledWith("default", expect.arrayContaining(["#465fff"]));
    expect(screen.getByTestId("chart-palette-custom")).toBeInTheDocument();
  });

  it("closes dense inline menu when clicking outside", async () => {
    const user = userEvent.setup();
    render(<ChartPalettePicker dense showInherit value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "配色方案" }));
    expect(screen.getByTestId("chart-palette-inline-menu-panel")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });

  it("selects preset via collapsible inline menu in dense chart inspector mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartPalettePicker dense showInherit value={undefined} onChange={onChange} />);

    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配色方案" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "配色方案" }));
    expect(screen.getByTestId("chart-palette-inline-menu-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /清透/ }));
    expect(onChange).toHaveBeenCalledWith("clarity", expect.any(Array));
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });

  it("opens custom palette editor and resets to preset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChartPalettePicker
        value="default"
        paletteColors={["#465fff", "#ff0000"]}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId("chart-palette-custom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(onChange).toHaveBeenCalledWith("default", expect.arrayContaining(["#465fff"]));
  });

  it("keeps color picker open after adjusting a custom swatch", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChartPalettePicker
        value="default"
        paletteColors={["#465fff", "#ff0000", "#12b76a", "#f79009", "#7a5af8", "#0ba5ec", "#ee46bc", "#3641f5"]}
        onChange={onChange}
      />,
    );

    const swatch = screen.getByRole("button", { name: "系列色 1" });
    await user.click(swatch);
    expect(swatch).toHaveAttribute("aria-expanded", "true");

    const rInput = screen.getByLabelText("R 分量");
    await user.clear(rInput);
    await user.type(rInput, "18");

    expect(swatch).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes color picker on first outside click", async () => {
    const user = userEvent.setup();
    render(
      <ChartPalettePicker
        value="default"
        paletteColors={["#465fff", "#ff0000", "#12b76a", "#f79009", "#7a5af8", "#0ba5ec", "#ee46bc", "#3641f5"]}
        onChange={vi.fn()}
      />,
    );

    const swatch = screen.getByRole("button", { name: "系列色 1" });
    await user.click(swatch);
    expect(swatch).toHaveAttribute("aria-expanded", "true");

    await user.click(document.body);
    expect(swatch).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
