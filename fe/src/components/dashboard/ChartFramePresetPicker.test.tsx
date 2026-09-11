import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartFramePresetPicker } from "./ChartFramePresetPicker";

afterEach(() => cleanup());

describe("ChartFramePresetPicker", () => {
  it("opens preset grid and commits selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartFramePresetPicker value="frame-1" onChange={onChange} label="装饰边框" />);

    await user.click(screen.getByRole("button", { name: "选择装饰边框" }));
    expect(screen.getByRole("listbox", { name: "装饰边框" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "边框3" }));
    expect(onChange).toHaveBeenCalledWith("frame-3");
  });
});
