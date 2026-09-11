import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartResultLimitField } from "./ChartResultLimitField";

afterEach(cleanup);

describe("ChartResultLimitField", () => {
  it("shows custom amount input for non-preset counts", () => {
    const onChange = vi.fn();
    render(<ChartResultLimitField stored="600" onChange={onChange} />);

    expect(screen.getByText("结果展示")).toBeInTheDocument();
    expect(screen.getByLabelText("自定义结果条数")).toHaveValue(600);
  });

  it("writes clamped custom count", () => {
    const onChange = vi.fn();
    render(<ChartResultLimitField stored="200" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("自定义结果条数"), { target: { value: "80" } });
    expect(onChange).toHaveBeenCalledWith("custom:80");
  });

  it("keeps custom mode when stored is custom:1000", () => {
    render(<ChartResultLimitField stored="custom:1000" onChange={vi.fn()} />);
    expect(screen.getByLabelText("自定义结果条数")).toHaveValue(1000);
  });
});
