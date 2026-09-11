import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomVizStyleForm } from "./CustomVizStyleForm";

const schema = {
  type: "object",
  "x-styleSections": [
    { title: "条形外观", properties: ["accentColor", "showValue"] },
    { title: "排列", properties: ["layoutMode"] },
  ],
  properties: {
    accentColor: { type: "string", format: "color", title: "强调色" },
    showValue: { type: "boolean", title: "显示数值" },
    layoutMode: {
      type: "string",
      enum: ["horizontal", "compact"],
      enumNames: ["标准横向", "紧凑模式"],
      title: "排列方式",
    },
  },
};

describe("CustomVizStyleForm", () => {
  afterEach(() => cleanup());

  it("renders grouped sections with switch and select controls", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <CustomVizStyleForm
          styleSchema={schema}
          value={{ accentColor: "#2563eb", showValue: true, layoutMode: "horizontal" }}
          onChange={onChange}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("条形外观")).toBeInTheDocument();
    expect(screen.getByText("排列")).toBeInTheDocument();
    expect(screen.getByText("显示数值")).toBeInTheDocument();
    expect(screen.getByText("排列方式")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "显示数值" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showValue: false }),
    );
  });
});
