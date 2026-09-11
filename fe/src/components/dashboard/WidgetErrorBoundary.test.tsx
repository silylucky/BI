import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

function Boom() {
  throw new Error("boom");
}

describe("WidgetErrorBoundary", () => {
  afterEach(() => cleanup());

  it("isolates widget crash and keeps root mounted", () => {
    const onDelete = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <div data-testid="root-surrogate">
        <WidgetErrorBoundary widgetTitle="测试图表" onDelete={onDelete}>
          <Boom />
        </WidgetErrorBoundary>
      </div>,
    );

    expect(screen.getByTestId("root-surrogate")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("无法渲染");
    expect(screen.getByRole("alert")).toHaveTextContent("测试图表");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
