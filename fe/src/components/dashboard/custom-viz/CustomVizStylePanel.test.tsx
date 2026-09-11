import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomVizStylePanel } from "./CustomVizStylePanel";

afterEach(cleanup);

describe("CustomVizStylePanel", () => {
  it("renders platform common style sections and schema form", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <CustomVizStylePanel
          config={{ artifactId: "550e8400-e29b-41d4-a716-446655440000" }}
          widgetTitle="演示组件"
          styleSchema={{
            type: "object",
            properties: {
              accentColor: { type: "string", format: "color", title: "强调色" },
            },
          }}
          defaultStyle={{ accentColor: "#2563eb" }}
          onChange={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("custom-viz-style-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "背景" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图表配色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "备注" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提示" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "图表标签" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "图表提示" })).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-viz-style-form")).toBeInTheDocument();
  });
});
