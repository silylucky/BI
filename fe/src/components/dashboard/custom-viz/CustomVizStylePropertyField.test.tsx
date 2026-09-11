import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomVizStylePropertyField } from "./CustomVizStylePropertyField";

describe("CustomVizStylePropertyField", () => {
  afterEach(() => cleanup());

  it("renders Chinese labels for trend-line schema without manifest titles", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <div>
          <CustomVizStylePropertyField
            propKey="lineWidth"
            prop={{ type: "number", minimum: 1, maximum: 8, default: 3 }}
            value={{ lineWidth: 3 }}
            onChange={vi.fn()}
          />
          <CustomVizStylePropertyField
            propKey="showDots"
            prop={{ type: "boolean", default: true }}
            value={{ showDots: true }}
            onChange={vi.fn()}
          />
          <CustomVizStylePropertyField
            propKey="curveType"
            prop={{ type: "string", enum: ["linear", "smooth"], default: "smooth" }}
            value={{ curveType: "smooth" }}
            onChange={vi.fn()}
          />
        </div>
      </TooltipProvider>,
    );

    expect(screen.getByText("线宽")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "显示数据点" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "曲线类型" })).toBeInTheDocument();
  });
});
