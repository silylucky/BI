import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChartFieldMultiSlot } from "./ChartFieldMultiSlot";

function renderSlot(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("ChartFieldMultiSlot", () => {
  it("renders multiple field chips", () => {
    cleanup();
    renderSlot(
      <ChartFieldMultiSlot
        label="数据列 / 维度或指标"
        axisId="xAxis"
        fields={["sale_date", "amount"]}
        showAggregation
      />,
    );
    expect(screen.getByText("sale_date")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();
  });

  it("calls onRemoveAt when chip clear clicked", () => {
    cleanup();
    const onRemoveAt = vi.fn();
    renderSlot(
      <ChartFieldMultiSlot
        label="数据列 / 维度或指标"
        axisId="xAxis"
        fields={["amount"]}
        onRemoveAt={onRemoveAt}
      />,
    );
    fireEvent.click(screen.getByLabelText("移除 amount"));
    expect(onRemoveAt).toHaveBeenCalledWith(0);
  });

  it("calls onClearAll from header trash", () => {
    cleanup();
    const onClearAll = vi.fn();
    renderSlot(
      <ChartFieldMultiSlot
        label="数据列 / 维度或指标"
        axisId="xAxis"
        fields={["amount"]}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByLabelText("清空数据列 / 维度或指标"));
    expect(onClearAll).toHaveBeenCalled();
  });
});
